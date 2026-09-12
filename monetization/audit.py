"""
Search-input audit log — a LINZ licence obligation.

Records what was searched (mode + query, and the title number when known),
never what came back. Retention and deletion run here: keep the trail long
enough to answer a LINZ query, purge past that, and be able to delete a specific
subject's rows on request.

No-ops when the DB isn't configured, so the site keeps working without it.
"""
from __future__ import annotations

import ipaddress

from . import db


def normalize_ip(value: str | None) -> str | None:
    """Return a Postgres ``inet``-safe address, or ``None`` for peer labels.

    ASGI test clients use values such as ``testclient`` for the peer host, and
    some hosting adapters can omit it. Audit logging must never turn either
    case into a failed property search.
    """
    if not value:
        return None
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None


def record_search(mode: str, query: str, *, account_id: str | None = None,
                  title_no: str | None = None, ip: str | None = None,
                  actor: str | None = None, matter_ref: str | None = None) -> int | None:
    """Record input and return its durable audit ID; never accept result data."""
    matter_ref = normalize_matter_ref(matter_ref)
    if not db.available():
        return None
    with db.connect() as conn:
        row = conn.execute(
            "INSERT INTO search_audit "
            "(account_id, mode, query, title_no, ip, actor, matter_ref) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (account_id, mode, query, title_no, normalize_ip(ip), actor, matter_ref),
        ).fetchone()
        return int(row[0])


def normalize_matter_ref(value: str | None) -> str | None:
    value = (value or "").strip()
    if len(value) > 120 or any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("Matter reference must be at most 120 characters without control characters")
    return value or None


def purge_older_than(days: int) -> int:
    """Delete audit rows older than `days`. Returns the row count removed."""
    if type(days) is not int or days <= 0:
        raise ValueError("audit retention days must be a positive integer")
    if not db.available():
        return 0
    with db.connect() as conn:
        row = conn.execute(
            "DELETE FROM search_audit "
            "WHERE created_at < now() - make_interval(days => %s) RETURNING id",
            (days,),
        )
        return len(row.fetchall())


def delete_for_account(account_id: str) -> int:
    """Delete one account's audit rows (a correction/erasure request)."""
    if not db.available():
        return 0
    with db.connect() as conn:
        row = conn.execute(
            "DELETE FROM search_audit WHERE account_id=%s RETURNING id",
            (account_id,),
        )
        return len(row.fetchall())
