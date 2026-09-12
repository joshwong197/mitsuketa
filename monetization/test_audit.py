"""Audit-log safety checks that do not require Neon."""
from __future__ import annotations

import unittest
from unittest import mock

from monetization import audit


class _Connection:
    def __init__(self):
        self.params = None

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, _sql, params):
        self.params = params
        return self

    def fetchone(self):
        return (123,)


class AuditTests(unittest.TestCase):
    def test_invalid_retention_never_reaches_database(self):
        with mock.patch.object(audit.db, "connect") as connect:
            for days in (0, -1, True, 1.5, "30", None):
                with self.subTest(days=days), self.assertRaises(ValueError):
                    audit.purge_older_than(days)
            connect.assert_not_called()

    def test_normalize_ip_accepts_v4_and_v6(self):
        self.assertEqual(audit.normalize_ip("203.0.113.9"), "203.0.113.9")
        self.assertEqual(audit.normalize_ip("2001:db8::1"), "2001:db8::1")

    def test_normalize_ip_rejects_asgi_peer_labels(self):
        self.assertIsNone(audit.normalize_ip("testclient"))
        self.assertIsNone(audit.normalize_ip(""))
        self.assertIsNone(audit.normalize_ip(None))

    def test_record_search_never_sends_invalid_inet_value(self):
        conn = _Connection()
        with (mock.patch.object(audit.db, "available", return_value=True),
              mock.patch.object(audit.db, "connect", return_value=conn)):
            audit_id = audit.record_search(
                "title", "SAMPLE-TITLE", title_no="SAMPLE-TITLE",
                ip="testclient",
            )

        self.assertEqual(
            conn.params,
            (None, "title", "SAMPLE-TITLE", "SAMPLE-TITLE", None, None, None),
        )
        self.assertEqual(audit_id, 123)

    def test_reference_validation(self):
        self.assertEqual(audit.normalize_matter_ref(" CASE-123 "), "CASE-123")
        self.assertIsNone(audit.normalize_matter_ref("  "))
        for value in ("x" * 121, "CASE\n123", "CASE\x00123"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                audit.normalize_matter_ref(value)

    def test_actor_and_matter_are_separate_from_query(self):
        conn = _Connection()
        with (mock.patch.object(audit.db, "available", return_value=True),
              mock.patch.object(audit.db, "connect", return_value=conn)):
            audit.record_search("address", "810 Great South Road",
                                actor="basic:operator", matter_ref=" CASE-123 ")
        self.assertEqual(conn.params[-2:], ("basic:operator", "CASE-123"))

    def test_no_database_does_not_invent_reference(self):
        with mock.patch.object(audit.db, "available", return_value=False):
            self.assertIsNone(audit.record_search("address", "example"))


if __name__ == "__main__":
    unittest.main()
