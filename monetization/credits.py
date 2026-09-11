"""
Credit ledger: buy, check balance, consume one per property search.

The rule that matters is in `consume`: a search draws a credit only if the
balance can cover it, and the balance can never go negative (no free searches,
no double-spend). That rule is written once here and validated by
test_monetization.py against MemStore; PgStore (db.py) enforces the same rule at
the database with a per-account lock so concurrent searches can't both spend the
last credit.
"""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Protocol


# ── credit bundles ──────────────────────────────────────────────────────────
# credits + price in NZD cents. The Stripe Price id is filled in once the
# account exists (see billing.py); until then these drive the pricing UI and the
# self-check. Prices are placeholders for you to set.
@dataclass(frozen=True)
class Bundle:
    key: str
    credits: int
    price_cents: int          # NZD, GST-exclusive (GST doesn't arise under $60k turnover)

BUNDLES: dict[str, Bundle] = {
    "starter":  Bundle("starter",  50,  2500),   # $25.00  -> 50c/search
    "standard": Bundle("standard", 200, 8000),   # $40.00  -> 40c/search
    "pro":      Bundle("pro",      500, 15000),   # $150.00 -> 30c/search
}


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
    Draw n credits for a search. Returns True if drawn, False if the balance
    can't cover it (the caller then blocks the search / shows the paywall).
    Never lets the balance go negative.
    """
    if n <= 0:
        raise ValueError("consume needs a positive credit count")
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
