"""
Stripe billing scaffold: turn a bundle into a Checkout session, and turn a paid
webhook back into credits. Env-gated and written to run in Stripe test mode
first (use an sk_test_ key); nothing here charges real money until you switch to
a live key.

    pip install "stripe>=9"

Env:
    STRIPE_SECRET_KEY        sk_test_... then sk_live_...
    STRIPE_WEBHOOK_SECRET    whsec_...  (from `stripe listen` or the dashboard)
    SITE_URL                 https://... (for the success/cancel redirect)

The Product/Price objects and the webhook endpoint are created once in the
Stripe dashboard after the account exists (see README). Until STRIPE_SECRET_KEY
is set, configured() is False and the pricing UI can show "coming soon".
"""
from __future__ import annotations

import os
import uuid

from . import credits, db

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
SITE_URL = os.environ.get("SITE_URL", "http://localhost:8000")


def configured() -> bool:
    return bool(STRIPE_SECRET_KEY)


def _stripe():
    import stripe  # lazy: only needed when billing is turned on
    stripe.api_key = STRIPE_SECRET_KEY
    return stripe


def create_checkout_session(account_id: str, bundle_key: str, *,
                            customer_email: str | None = None) -> str:
    """
    Start a purchase. Returns the Stripe Checkout URL to send the buyer to.
    A `purchase` row is written now (status 'pending') and flipped to 'paid'
    when the webhook confirms it, which is also when credits are granted.
    """
    bundle = credits.BUNDLES.get(bundle_key)
    if bundle is None:
        raise ValueError(f"unknown bundle {bundle_key!r}")
    stripe = _stripe()

    session = stripe.checkout.Session.create(
        mode="payment",
        customer_email=customer_email,
        line_items=[{
            "quantity": 1,
            "price_data": {
                "currency": "nzd",
                "unit_amount": bundle.price_cents,
                "product_data": {"name": f"Mitsuketa {bundle.credits} property credits"},
            },
        }],
        success_url=f"{SITE_URL}/billing/done?session={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{SITE_URL}/billing",
        client_reference_id=account_id,
        metadata={"account_id": account_id, "bundle": bundle_key,
                  "credits": str(bundle.credits)},
    )
    if db.available():
        with db.connect() as conn:
            conn.execute(
                "INSERT INTO purchase (id, account_id, stripe_checkout_session_id, "
                "amount_cents, currency, credits, status) "
                "VALUES (%s,%s,%s,%s,'nzd',%s,'pending') "
                "ON CONFLICT (stripe_checkout_session_id) DO NOTHING",
                (str(uuid.uuid4()), account_id, session.id, bundle.price_cents,
                 bundle.credits),
            )
    return session.url


def handle_webhook(payload: bytes, sig_header: str) -> bool:
    """
    Verify a Stripe webhook and, on a completed checkout, grant the credits.
    Idempotent: the purchase row's session id gates it, so a redelivered event
    won't double-credit. Returns True if credits were granted.
    """
    stripe = _stripe()
    event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    if event["type"] != "checkout.session.completed":
        return False

    session = event["data"]["object"]
    if session.get("payment_status") != "paid":
        return False
    account_id = session.get("client_reference_id") or session["metadata"]["account_id"]
    n = int(session["metadata"]["credits"])
    session_id = session["id"]

    if db.available():
        # Flip the purchase to 'paid' exactly once; only then grant. The UPDATE
        # returning nothing means it was already paid (redelivered event).
        with db.connect() as conn:
            done = conn.execute(
                "UPDATE purchase SET status='paid', "
                "stripe_payment_intent=%s "
                "WHERE stripe_checkout_session_id=%s AND status<>'paid' RETURNING id",
                (session.get("payment_intent"), session_id),
            ).fetchone()
        if not done:
            return False
        credits.grant(db.store, account_id, n, reason="purchase", ref=session_id)
    return True
