"""
Search-input audit log — a LINZ licence obligation.

Records what was searched (mode + query, and the title number when known),
never what came back. Retention and deletion run here: keep the trail long
enough to answer a LINZ query, purge past that, and be able to delete a specific
subject's rows on request.

No-ops when the DB isn't configured, so the site keeps working without it.
"""
from __future__ import annotations

from . import db


def record_search(mode: str, query: str, *, account_id: str | None = None,
                  title_no: str | None = None, ip: str | None = None) -> None:
    if not db.available():
        return
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO search_audit (account_id, mode, query, title_no, ip) "
            "VALUES (%s,%s,%s,%s,%s)",
            (account_id, mode, query, title_no, ip),
        )


def purge_older_than(days: int) -> int:
    """Delete audit rows older than `days`. Returns the row count removed."""
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
