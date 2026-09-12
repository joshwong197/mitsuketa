"""
Stripe billing: turn a report-pass pack into a Checkout session, and turn a
paid webhook back into internal credits. Env-gated and written to run in Stripe
test mode first (use an sk_test_ key); nothing here charges real money until
you switch to a live key.

    pip install "stripe>=9"

Env:
    STRIPE_SECRET_KEY        sk_test_... then sk_live_...
    STRIPE_WEBHOOK_SECRET    whsec_...  (from `stripe listen` or the dashboard)
    STRIPE_PRICE_ID_PAYG       price_...  (one-time NZD Price; optional fallback)
    STRIPE_PRICE_ID_PASSES_10  price_...  (one-time NZD Price; optional fallback)
    STRIPE_PRICE_ID_PASSES_100 price_...  (one-time NZD Price; optional fallback)
    STRIPE_TAX_ENABLED       1 to enable automatic tax; default is off
    SITE_URL                 https://... (for the success/cancel redirect)

Set the account-wide statement descriptor to MITSUKETA in Stripe Dashboard.
That is valid for card and non-card payments; setting PaymentIntent
`statement_descriptor` here would be invalid for card payments. Until
STRIPE_SECRET_KEY is set, configured() is False and the pricing UI can show
"coming soon".
"""
from __future__ import annotations

import logging
import os
import uuid

from . import credits, db

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
SITE_URL = os.environ.get("SITE_URL", "http://localhost:8000")
STRIPE_TAX_ENABLED = os.environ.get("STRIPE_TAX_ENABLED", "") == "1"

# This is configured account-wide in Dashboard, not sent as a per-payment
# descriptor. Stripe limits complete descriptors to 5-22 Latin characters.
STATEMENT_DESCRIPTOR = "MITSUKETA"

_FULFILLMENT_EVENTS = {
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
}
logger = logging.getLogger(__name__)


def configured() -> bool:
    return bool(STRIPE_SECRET_KEY)


def _stripe():
    import stripe  # lazy: only needed when billing is turned on
    stripe.api_key = STRIPE_SECRET_KEY
    return stripe


def _id(value) -> str | None:
    """Return the ID from either a Stripe object, expanded dict, or plain ID."""
    if value is None or isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get("id")
    return getattr(value, "id", None)


def _require_database(operation: str) -> None:
    if db.available():
        return
    logger.error("Cannot %s: DATABASE_URL is unavailable", operation)
    raise RuntimeError(f"cannot {operation} without the billing database")


def create_checkout_session(account_id: str, bundle_key: str, *,
                            customer_email: str | None = None) -> str:
    """
    Start a purchase. Returns the Stripe Checkout URL to send the buyer to.
    A `purchase` row is written now (status 'pending') and flipped to 'paid'
    when the webhook confirms it, which is also when credits are granted.
    """
    bundle = credits.REPORT_PASS_PACKS.get(bundle_key)
    if bundle is None:
        raise ValueError(f"unknown report pass pack {bundle_key!r}")
    # Never create a payable session unless its pending purchase can be
    # recorded. Otherwise payment could succeed with nothing for the webhook
    # to fulfill.
    _require_database("create a Checkout session")
    stripe = _stripe()

    if bundle.stripe_price_id:
        line_item = {"quantity": 1, "price": bundle.stripe_price_id}
    else:
        # Local/test fallback until dashboard Prices have been configured.
        line_item = {
            "quantity": 1,
            "price_data": {
                "currency": "nzd",
                "unit_amount": bundle.price_cents,
                "product_data": {
                    "name": bundle.public_name or (
                        f"Mitsuketa {bundle.report_passes} report passes"
                    )
                },
            },
        }

    session_args = dict(
        mode="payment",
        customer_creation="always",
        invoice_creation={"enabled": True},
        line_items=[line_item],
        automatic_tax={"enabled": STRIPE_TAX_ENABLED},
        billing_address_collection="required" if STRIPE_TAX_ENABLED else "auto",
        tax_id_collection={"enabled": STRIPE_TAX_ENABLED},
        success_url=f"{SITE_URL}/billing/done?session={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{SITE_URL}/billing",
        client_reference_id=account_id,
        metadata={"account_id": account_id, "pack": bundle_key,
                  "report_passes": str(bundle.report_passes)},
    )
    if customer_email:
        session_args["customer_email"] = customer_email
    session = stripe.checkout.Session.create(**session_args)

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


def fulfill_checkout_session(session_id: str) -> bool:
    """
    Retrieve and fulfill a paid Checkout session exactly once.

    The purchase transition and ledger append are one SQL statement, so a
    process failure cannot leave a paid purchase without its credits. Returns
    True only when this call performed the grant; duplicates and unpaid
    sessions return False.
    """
    stripe = _stripe()
    session = stripe.checkout.Session.retrieve(session_id, expand=["line_items"])
    # Stripe recommends fulfilling any Session that isn't unpaid. This also
    # covers `no_payment_required` if a zero-total Checkout is introduced.
    if session.get("payment_status") == "unpaid":
        return False

    _require_database("fulfill a Checkout session")
    payment_intent_id = _id(session.get("payment_intent"))
    customer_id = _id(session.get("customer"))

    with db.connect() as conn:
        # UPDATE + INSERT is atomic. Restricting the transition to pending also
        # prevents a replayed checkout event from resurrecting a refund.
        granted = conn.execute(
            "WITH paid AS ("
            " UPDATE purchase SET status='paid', stripe_payment_intent=%s"
            " WHERE stripe_checkout_session_id=%s AND status='pending'"
            " RETURNING account_id, credits"
            ") "
            "INSERT INTO credit_ledger (account_id, delta, reason, ref) "
            "SELECT account_id, credits, 'purchase', %s FROM paid RETURNING id",
            (payment_intent_id, session_id, session_id),
        ).fetchone()

        if not granted:
            existing = conn.execute(
                "SELECT status FROM purchase WHERE stripe_checkout_session_id=%s",
                (session_id,),
            ).fetchone()
            if not existing:
                # An acknowledged payment with no local purchase could never be
                # recovered automatically, so fail and let Stripe retry.
                logger.error("Paid Checkout session %s has no purchase row", session_id)
                raise RuntimeError(
                    f"paid Checkout session {session_id} has no purchase row"
                )

        if customer_id:
            # Link the Stripe Customer through the purchase rather than trusting
            # mutable event metadata for the account identity.
            conn.execute(
                "UPDATE account AS a SET stripe_customer_id=%s "
                "FROM purchase AS p "
                "WHERE p.stripe_checkout_session_id=%s AND p.account_id=a.id "
                "AND a.stripe_customer_id IS DISTINCT FROM %s",
                (customer_id, session_id, customer_id),
            )
    return bool(granted)


def _record_refund(charge) -> bool:
    """Mark a fully refunded purchase; credits remain an audit-safe ledger."""
    # Stripe sends charge.refunded for partial refunds too. The current schema
    # has no partial-refund state or amount column, so leave those purchases
    # paid until that policy and accounting representation are designed.
    if not charge.get("refunded", False):
        logger.warning("Ignoring a partial charge refund")
        return False
    payment_intent_id = _id(charge.get("payment_intent"))
    if not payment_intent_id:
        logger.warning("Verified charge.refunded event has no PaymentIntent")
        return False

    _require_database("record a refund")
    with db.connect() as conn:
        changed = conn.execute(
            "UPDATE purchase SET status='refunded' "
            "WHERE stripe_payment_intent=%s AND status='paid' RETURNING id",
            (payment_intent_id,),
        ).fetchone()
    # Deliberately do not claw credits back. The ledger is append-only and the
    # policy for already-spent credits needs an explicit business decision.
    return bool(changed)


def handle_webhook(payload: bytes, sig_header: str) -> bool:
    """
    Verify and process a Stripe webhook.

    Returns True for every successfully verified event, including ignored,
    unpaid, and duplicate events. A route can therefore map True to HTTP 200;
    signature verification and processing errors remain exceptions and should
    map to 400 and 5xx respectively.
    """
    stripe = _stripe()
    event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)

    event_type = event["type"]
    stripe_object = event["data"]["object"]
    if event_type in _FULFILLMENT_EVENTS:
        session_id = _id(stripe_object)
        if not session_id:
            raise ValueError(f"verified {event_type} event has no session id")
        fulfill_checkout_session(session_id)
    elif event_type == "charge.refunded":
        _record_refund(stripe_object)
    return True
