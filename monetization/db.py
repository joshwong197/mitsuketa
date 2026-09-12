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

    def consume(self, account_id: str, *, n: int, ref: str | None) -> bool:
        """Atomically spend report passes without opening nested connections."""
        with connect() as conn:
            conn.autocommit = False
            try:
                conn.execute(
                    "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                    (str(account_id),),
                )
                row = conn.execute(
                    "SELECT COALESCE(SUM(delta),0) FROM credit_ledger "
                    "WHERE account_id=%s",
                    (account_id,),
                ).fetchone()
                current = int(row[0]) if row else 0
                if current < n:
                    conn.rollback()
                    return False
                conn.execute(
                    "INSERT INTO credit_ledger (account_id, delta, reason, ref) "
                    "VALUES (%s,%s,'search',%s)",
                    (account_id, -n, ref),
                )
                conn.commit()
                return True
            except BaseException:
                conn.rollback()
                raise

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


class PgEntitlementStore:
    """Postgres-backed named-user entitlements."""

    def has_active(self, account_id: str, entitlement_key: str, *,
                   at=None) -> bool:
        with connect() as conn:
            row = conn.execute(
                "SELECT EXISTS ("
                " SELECT 1 FROM account_entitlement"
                " WHERE account_id=%s AND entitlement_key=%s AND status='active'"
                " AND starts_at <= COALESCE(%s, now())"
                " AND ends_at > COALESCE(%s, now())"
                ")",
                (account_id, entitlement_key, at, at),
            ).fetchone()
            return bool(row and row[0])

    def upsert(self, account_id: str, entitlement_key: str, *, starts_at,
               ends_at, source: str, source_ref: str) -> None:
        with connect() as conn:
            row = conn.execute(
                "INSERT INTO account_entitlement "
                "(account_id, entitlement_key, status, starts_at, ends_at, "
                " source, source_ref) "
                "VALUES (%s,%s,'active',%s,%s,%s,%s) "
                "ON CONFLICT (source_ref) DO UPDATE SET "
                "account_id=EXCLUDED.account_id, "
                "entitlement_key=EXCLUDED.entitlement_key, status='active', "
                "starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at, "
                "source=EXCLUDED.source, updated_at=now() "
                "WHERE account_entitlement.account_id=EXCLUDED.account_id "
                "AND account_entitlement.entitlement_key=EXCLUDED.entitlement_key "
                "RETURNING id",
                (account_id, entitlement_key, starts_at, ends_at, source, source_ref),
            ).fetchone()
            if not row:
                raise RuntimeError(
                    "entitlement source_ref is already attached to another account"
                )


entitlement_store = PgEntitlementStore()
