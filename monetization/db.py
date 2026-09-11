"""
Neon Postgres connection + the production ledger/audit store.

Env-gated: with no DATABASE_URL the site runs exactly as it does today (no
billing, no DB writes) — available() is how callers decide. Neon connection
strings already carry sslmode=require, so nothing extra is needed here.

    pip install "psycopg[binary]>=3.1"
"""
from __future__ import annotations

import os
from contextlib import contextmanager

DATABASE_URL = os.environ.get("DATABASE_URL", "")


def available() -> bool:
    return bool(DATABASE_URL)


def connect():
    import psycopg  # imported lazily so fixture-mode never needs the driver
    return psycopg.connect(DATABASE_URL, autocommit=True)


def apply_schema(path: str | None = None) -> None:
    """Run schema.sql against DATABASE_URL. Safe to re-run (all IF NOT EXISTS)."""
    if not available():
        raise RuntimeError("DATABASE_URL is not set")
    if path is None:
        path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(path, encoding="utf-8") as fh:
        sql = fh.read()
    with connect() as conn:
        conn.execute(sql)


class PgStore:
    """Postgres-backed credit ledger. Same contract as credits.MemStore."""

    def balance(self, account_id: str) -> int:
        with connect() as conn:
            row = conn.execute(
                "SELECT COALESCE(SUM(delta),0) FROM credit_ledger WHERE account_id=%s",
                (account_id,),
            ).fetchone()
            return int(row[0]) if row else 0

    def append(self, account_id: str, delta: int, reason: str, ref: str | None) -> None:
        with connect() as conn:
            conn.execute(
                "INSERT INTO credit_ledger (account_id, delta, reason, ref) "
                "VALUES (%s,%s,%s,%s)",
                (account_id, delta, reason, ref),
            )

    @contextmanager
    def lock(self, account_id: str):
        # A transaction-scoped advisory lock keyed on the account serialises
        # concurrent consumes, so two searches can't both spend the last credit.
        # ponytail: one lock per account; fine at this scale, revisit only if a
        # single account fires searches faster than a short DB round-trip.
        with connect() as conn:
            conn.autocommit = False
            try:
                conn.execute(
                    "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                    (str(account_id),),
                )
                yield conn
                conn.commit()
            except BaseException:
                conn.rollback()
                raise


# One shared instance for the app to import.
store = PgStore()
