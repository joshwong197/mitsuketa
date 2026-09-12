"""Local entitlement tests; no Stripe, network, or database required."""
from datetime import datetime, timedelta, timezone
import unittest

from monetization import credits, entitlements


class EntitlementTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 9, 11, tzinfo=timezone.utc)
        self.passes = credits.MemStore()
        self.entitlements = entitlements.MemEntitlementStore(now=self.now)

    def test_pass_holder_consumes_exactly_one_report_pass(self):
        credits.grant(self.passes, "account-1", 2)
        access = entitlements.authorize_report(
            self.passes, self.entitlements, "account-1", ref="title-1", manual=True
        )
        self.assertEqual(access, entitlements.ReportAccess(
            True, "report_pass", pass_consumed=True
        ))
        self.assertEqual(credits.balance(self.passes, "account-1"), 1)

    def test_active_professional_is_unlimited_without_consuming_passes(self):
        credits.grant(self.passes, "account-1", 3)
        entitlements.activate_professional(
            self.entitlements, "account-1", source_ref="manual-term-1",
            starts_at=self.now - timedelta(days=1),
            ends_at=self.now + timedelta(days=364),
        )
        first = entitlements.authorize_report(
            self.passes, self.entitlements, "account-1", ref="title-1", manual=True
        )
        second = entitlements.authorize_report(
            self.passes, self.entitlements, "account-1", ref="title-2", manual=True
        )
        self.assertEqual(first.source, "professional_annual")
        self.assertEqual(second.source, "professional_annual")
        self.assertFalse(first.pass_consumed)
        self.assertEqual(credits.balance(self.passes, "account-1"), 3)

    def test_expired_professional_falls_back_to_a_report_pass(self):
        credits.grant(self.passes, "account-1", 1)
        entitlements.activate_professional(
            self.entitlements, "account-1", source_ref="expired-term",
            starts_at=self.now - timedelta(days=366),
            ends_at=self.now - timedelta(days=1),
        )
        access = entitlements.authorize_report(
            self.passes, self.entitlements, "account-1", ref="title-1", manual=True
        )
        self.assertEqual(access.source, "report_pass")
        self.assertEqual(credits.balance(self.passes, "account-1"), 0)

    def test_no_passes_and_no_subscription_is_denied(self):
        access = entitlements.authorize_report(
            self.passes, self.entitlements, "account-1", manual=True
        )
        self.assertEqual(access, entitlements.ReportAccess(
            False, "no_report_passes"
        ))

    def test_professional_does_not_authorize_automation_or_bulk_access(self):
        entitlements.activate_professional(
            self.entitlements, "account-1", source_ref="manual-term-1",
            starts_at=self.now - timedelta(days=1),
            ends_at=self.now + timedelta(days=364),
        )
        access = entitlements.authorize_report(
            self.passes, self.entitlements, "account-1", manual=False
        )
        self.assertEqual(access, entitlements.ReportAccess(
            False, "manual_reports_only"
        ))

    def test_activation_is_idempotent_by_source_reference(self):
        start = self.now - timedelta(days=1)
        entitlements.activate_professional(
            self.entitlements, "account-1", source_ref="term-1",
            starts_at=start, ends_at=self.now + timedelta(days=30),
        )
        entitlements.activate_professional(
            self.entitlements, "account-1", source_ref="term-1",
            starts_at=start, ends_at=self.now + timedelta(days=365),
        )
        self.assertEqual(len(self.entitlements.entries), 1)
        self.assertTrue(self.entitlements.has_active(
            "account-1", credits.PROFESSIONAL_ANNUAL.entitlement_key
        ))

    def test_source_reference_cannot_move_between_named_users(self):
        entitlements.activate_professional(
            self.entitlements, "account-1", source_ref="term-1",
            starts_at=self.now, ends_at=self.now + timedelta(days=365),
        )
        with self.assertRaisesRegex(RuntimeError, "another account"):
            entitlements.activate_professional(
                self.entitlements, "account-2", source_ref="term-1",
                starts_at=self.now, ends_at=self.now + timedelta(days=365),
            )

    def test_activation_requires_valid_term_and_reference(self):
        with self.assertRaises(ValueError):
            entitlements.activate_professional(
                self.entitlements, "account-1", source_ref="",
                starts_at=self.now, ends_at=self.now + timedelta(days=365),
            )
        with self.assertRaises(ValueError):
            entitlements.activate_professional(
                self.entitlements, "account-1", source_ref="bad-term",
                starts_at=self.now, ends_at=self.now,
            )


if __name__ == "__main__":
    unittest.main()
