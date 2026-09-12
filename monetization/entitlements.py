"""Report access decisions for passes and the Professional annual plan.

The Professional entitlement is attached to one account, whose unique email is
the named user. It bypasses pass consumption only for manual report generation;
automation and bulk/API access are intentionally outside the plan.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Protocol

from . import credits


class EntitlementStore(Protocol):
    def has_active(self, account_id: str, entitlement_key: str, *,
                   at: datetime | None = None) -> bool: ...

    def upsert(self, account_id: str, entitlement_key: str, *,
               starts_at: datetime, ends_at: datetime, source: str,
               source_ref: str) -> None: ...


@dataclass(frozen=True)
class ReportAccess:
    allowed: bool
    source: str
    pass_consumed: bool = False


def authorize_report(pass_store: credits.Store, entitlement_store: EntitlementStore,
                     account_id: str, *, ref: str | None = None,
                     manual: bool) -> ReportAccess:
    """Authorise one report and consume a pass only when no annual access applies."""
    if not manual:
        return ReportAccess(False, "manual_reports_only")
    if entitlement_store.has_active(
        account_id, credits.PROFESSIONAL_ANNUAL.entitlement_key
    ):
        return ReportAccess(True, "professional_annual")
    if credits.consume(pass_store, account_id, ref=ref):
        return ReportAccess(True, "report_pass", pass_consumed=True)
    return ReportAccess(False, "no_report_passes")


def activate_professional(entitlement_store: EntitlementStore, account_id: str, *,
                          source_ref: str, starts_at: datetime | None = None,
                          ends_at: datetime | None = None,
                          source: str = "manual") -> None:
    """Idempotently grant the named account one annual Professional term."""
    start = starts_at or datetime.now(timezone.utc)
    end = ends_at or (start + timedelta(days=365))
    if end <= start:
        raise ValueError("Professional entitlement must end after it starts")
    if not source_ref.strip():
        raise ValueError("source_ref is required for idempotent activation")
    entitlement_store.upsert(
        account_id,
        credits.PROFESSIONAL_ANNUAL.entitlement_key,
        starts_at=start,
        ends_at=end,
        source=source,
        source_ref=source_ref,
    )


@dataclass
class MemEntitlementStore:
    """Small reference/test store keyed by an idempotent source reference."""

    entries: dict[str, tuple[str, str, datetime, datetime, str]] = field(
        default_factory=dict
    )
    now: datetime | None = None

    def has_active(self, account_id: str, entitlement_key: str, *,
                   at: datetime | None = None) -> bool:
        instant = at or self.now or datetime.now(timezone.utc)
        return any(
            account == account_id
            and key == entitlement_key
            and starts_at <= instant < ends_at
            for account, key, starts_at, ends_at, _source in self.entries.values()
        )

    def upsert(self, account_id: str, entitlement_key: str, *,
               starts_at: datetime, ends_at: datetime, source: str,
               source_ref: str) -> None:
        existing = self.entries.get(source_ref)
        if existing and existing[:2] != (account_id, entitlement_key):
            raise RuntimeError(
                "entitlement source_ref is already attached to another account"
            )
        self.entries[source_ref] = (
            account_id, entitlement_key, starts_at, ends_at, source
        )
