"""Opt-in real Postgres checks in an isolated disposable schema, not customer tables.
Run: python -m monetization.check_sandbox_db (reads ignored .env).
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4
from dotenv import load_dotenv
load_dotenv('.env', override=False)
from monetization import db
from psycopg import sql

def main():
    schema = 'mitsuketa_sandbox_check_' + uuid4().hex
    root = Path(__file__).parent
    with db.connect() as conn:
        conn.autocommit = False
        conn.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
        try:
            conn.execute(sql.SQL('SET LOCAL search_path TO {}, public').format(sql.Identifier(schema)))
            # Minimal pre-existing account table; everything under test comes
            # from the exact migration used by the application.
            conn.execute('CREATE TABLE account(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL, created_at timestamptz DEFAULT now())')
            migration = (root / 'migrations/002_property_accounts_sandbox.sql').read_text()
            conn.execute(migration.replace('BEGIN;\n', '').replace('COMMIT;\n', ''))
            account = conn.execute("INSERT INTO account(email) VALUES ('synthetic@example.test') RETURNING id").fetchone()[0]
            conn.execute("INSERT INTO property_access(account_id,status) VALUES (%s,'approved')", (account,))
            for _ in range(2):
                conn.execute("SELECT sandbox_fulfill('cs_test',%s,'pi_test',1,500)", (account,))
            assert conn.execute('SELECT SUM(delta) FROM sandbox_pass_ledger').fetchone()[0] == 1
            conn.commit()
            def consume(index):
                with db.connect() as parallel:
                    parallel.autocommit = False
                    parallel.execute(sql.SQL('SET LOCAL search_path TO {}, public').format(sql.Identifier(schema)))
                    return parallel.execute('SELECT sandbox_consume_pass(%s,%s)', (account, 'report:' + str(index))).fetchone()[0]
            with ThreadPoolExecutor(max_workers=2) as pool:
                assert sorted(pool.map(consume, [1, 2])) == [False, True]
            conn.execute(sql.SQL('SET LOCAL search_path TO {}, public').format(sql.Identifier(schema)))
            assert conn.execute('SELECT SUM(delta) FROM sandbox_pass_ledger').fetchone()[0] == 0
            conn.execute("SELECT sandbox_fulfill('cs_pack',%s,'pi_pack',10,3000)", (account,))
            for amount in [1500, 1500, 1000, 3000, 3000]:
                conn.execute("SELECT sandbox_refund('pi_pack',%s)", (amount,))
            assert conn.execute('SELECT SUM(delta) FROM sandbox_pass_ledger').fetchone()[0] == 0
            conn.execute("SELECT sandbox_fulfill('cs_suspended',%s,'pi_suspended',1,500)", (account,))
            conn.execute("UPDATE property_access SET status='suspended' WHERE account_id=%s", (account,))
            assert not conn.execute('SELECT sandbox_consume_pass(%s,%s)', (account, 'report:3')).fetchone()[0]
            assert conn.execute('SELECT SUM(delta) FROM sandbox_pass_ledger').fetchone()[0] == 1
            print('PASS: real Postgres duplicate purchase, concurrent last-pass requests, cumulative refunds and suspension')
        finally:
            conn.rollback()
            # Only the random schema created by this invocation is removed.
            assert schema.startswith('mitsuketa_sandbox_check_') and len(schema) == 56
            conn.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema)))

if __name__ == '__main__':
    main()
