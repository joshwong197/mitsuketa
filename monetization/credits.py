"""
Internal credit ledger for public-facing property report passes.

Customers see "report passes"; the database keeps the shorter historical
"credit" terminology. One generated property report consumes one internal
credit. The rule that matters is in `consume`: a report draws a credit only if the
balance can cover it, and the balance can never go negative (no free searches,
no double-spend). That rule is written once here and validated by
test_monetization.py against MemStore; PgStore (db.py) enforces the same rule at
the database with a per-account lock so concurrent searches can't both spend the
last credit.
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Protocol


# ── credit bundles ──────────────────────────────────────────────────────────
# Price is in NZD cents. Stripe Price ids remain unset until the deferred
# payment setup; these values can already drive the pricing UI and local tests.
@dataclass(frozen=True)
class Bundle:
    key: str
    credits: int
    price_cents: int          # NZD, GST-exclusive (GST doesn't arise under $60k turnover)
    stripe_price_id: str | None = None
    public_name: str | None = None

    @property
    def report_passes(self) -> int:
        """Public quantity; `credits` is retained as the internal ledger name."""
        return self.credits

    @property
    def price_per_report_cents(self) -> int:
        return self.price_cents // self.credits


def _stripe_price_id(bundle_key: str) -> str | None:
    """Read a dashboard-created Stripe Price ID without baking it into source."""
    value = os.environ.get(f"STRIPE_PRICE_ID_{bundle_key.upper()}", "").strip()
    return value or None

REPORT_PASS_PACKS: dict[str, Bundle] = {
    "payg": Bundle(
        "payg", 1, 500, _stripe_price_id("payg"), "Single report"
    ),
    "passes_10": Bundle(
        "passes_10", 10, 3000, _stripe_price_id("passes_10"),
        "10 report passes",
    ),
    "passes_100": Bundle(
        "passes_100", 100, 20000, _stripe_price_id("passes_100"),
        "100 report passes",
    ),
}

# Backwards-compatible name for the existing billing/UI scaffold. New UI copy
# should say "report pass pack", not "credit bundle".
BUNDLES = REPORT_PASS_PACKS


@dataclass(frozen=True)
class AnnualPlan:
    key: str
    price_cents: int
    entitlement_key: str
    interval: str = "year"
    public_name: str = "Professional"
    terms: str = "Unlimited manual reports for one named user"


# This describes the agreed entitlement locally. Stripe Product/Price creation
# and subscription webhook wiring are deliberately deferred.
PROFESSIONAL_ANNUAL = AnnualPlan(
    key="professional_annual",
    price_cents=50000,
    entitlement_key="professional_annual",
)


class Store(Protocol):
    """Backend for the ledger. MemStore for tests, PgStore for production."""
    def balance(self, account_id: str) -> int: ...
    def append(self, account_id: str, delta: int, reason: str, ref: str | None) -> None: ...
    @contextmanager
    def lock(self, account_id: str): ...   # serialises consume per account


def balance(store: Store, account_id: str) -> int:
    return store.balance(account_id)


def grant(store: Store, account_id: str, n: int, *, reason: str = "purchase",
          ref: str | None = None) -> None:
    """Add credits (a purchase, a manual top-up). n must be positive."""
    if n <= 0:
        raise ValueError("grant needs a positive credit count")
    store.append(account_id, n, reason, ref)


def consume(store: Store, account_id: str, *, ref: str | None = None, n: int = 1) -> bool:
    """
    Draw n internal credits for a generated report. Returns True if drawn,
    False if the balance can't cover it (the caller blocks the report / shows
    the paywall).
    Never lets the balance go negative.
    """
    if n <= 0:
        raise ValueError("consume needs a positive credit count")
    atomic_consume = getattr(store, "consume", None)
    if callable(atomic_consume):
        return bool(atomic_consume(account_id, n=n, ref=ref))
    with store.lock(account_id):
        if store.balance(account_id) < n:
            return False
        store.append(account_id, -n, "search", ref)
        return True


# ── in-memory store: reference implementation + test backend ────────────────
@dataclass
class MemStore:
    entries: list[tuple[str, int, str, str | None]] = field(default_factory=list)

    def balance(self, account_id: str) -> int:
        return sum(d for a, d, _r, _ref in self.entries if a == account_id)

    def append(self, account_id: str, delta: int, reason: str, ref: str | None) -> None:
        self.entries.append((account_id, delta, reason, ref))

    @contextmanager
    def lock(self, account_id: str):
        # Single-threaded tests: nothing to serialise. PgStore does the real lock.
        yield
