"""Focused Stripe billing tests. No Stripe package, network, or database needed."""
from __future__ import annotations

import os
import unittest
from types import SimpleNamespace
from unittest import mock

from monetization import billing, credits


class _Result:
    def __init__(self, row=None):
        self.row = row

    def fetchone(self):
        return self.row


class _Database:
    """Small stateful interpreter for only the SQL emitted by billing.py."""

    def __init__(self):
        self.purchases = {}
        self.ledger = []
        self.customers = {}

    def connect(self):
        return _Connection(self)


class _Connection:
    def __init__(self, database):
        self.database = database

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, sql, params):
        normalized = " ".join(sql.split()).upper()
        if normalized.startswith("INSERT INTO PURCHASE"):
            _purchase_id, account_id, session_id, amount, count = params
            self.database.purchases.setdefault(session_id, {
                "account_id": account_id,
                "amount": amount,
                "credits": count,
                "status": "pending",
                "payment_intent": None,
            })
            return _Result()

        if normalized.startswith("WITH PAID AS"):
            payment_intent, session_id, reference = params
            purchase = self.database.purchases.get(session_id)
            if purchase and purchase["status"] == "pending":
                purchase["status"] = "paid"
                purchase["payment_intent"] = payment_intent
                self.database.ledger.append(
                    (purchase["account_id"], purchase["credits"], "purchase", reference)
                )
                return _Result((len(self.database.ledger),))
            return _Result()

        if normalized.startswith("SELECT STATUS FROM PURCHASE"):
            (session_id,) = params
            purchase = self.database.purchases.get(session_id)
            return _Result((purchase["status"],) if purchase else None)

        if normalized.startswith("UPDATE ACCOUNT AS A"):
            customer_id, session_id, _same_customer_id = params
            purchase = self.database.purchases.get(session_id)
            if purchase:
                self.database.customers[purchase["account_id"]] = customer_id
            return _Result()

        if normalized.startswith("UPDATE PURCHASE SET STATUS='REFUNDED'"):
            (payment_intent,) = params
            for purchase in self.database.purchases.values():
                if (purchase["payment_intent"] == payment_intent
                        and purchase["status"] == "paid"):
                    purchase["status"] = "refunded"
                    return _Result((1,))
            return _Result()

        raise AssertionError(f"unexpected SQL: {sql}")


class _SessionApi:
    def __init__(self):
        self.created_with = None
        self.retrieved_with = []
        self.session = None

    def create(self, **kwargs):
        self.created_with = kwargs
        return SimpleNamespace(id="cs_created", url="https://checkout.test/cs_created")

    def retrieve(self, session_id, **kwargs):
        self.retrieved_with.append((session_id, kwargs))
        return self.session


class _WebhookApi:
    def __init__(self):
        self.event = None
        self.error = None
        self.calls = []

    def construct_event(self, payload, signature, secret):
        self.calls.append((payload, signature, secret))
        if self.error:
            raise self.error
        return self.event


class BillingTests(unittest.TestCase):
    def setUp(self):
        self.database = _Database()
        self.sessions = _SessionApi()
        self.webhooks = _WebhookApi()
        self.stripe = SimpleNamespace(
            checkout=SimpleNamespace(Session=self.sessions),
            Webhook=self.webhooks,
        )
        self.patchers = [
            mock.patch.object(billing, "_stripe", return_value=self.stripe),
            mock.patch.object(billing.db, "available", return_value=True),
            mock.patch.object(billing.db, "connect", side_effect=self.database.connect),
        ]
        for patcher in self.patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

    def _set_event(self, event_type, stripe_object):
        self.webhooks.event = {
            "type": event_type,
            "data": {"object": stripe_object},
        }

    def test_checkout_uses_price_customer_invoice_and_default_off_tax(self):
        bundle = credits.Bundle("passes_10", 10, 3000, "price_passes_10_test")
        with (mock.patch.dict(credits.REPORT_PASS_PACKS, {"passes_10": bundle}),
              mock.patch.object(billing, "STRIPE_TAX_ENABLED", False)):
            url = billing.create_checkout_session(
                "account-1", "passes_10", customer_email="buyer@example.test"
            )

        self.assertEqual(url, "https://checkout.test/cs_created")
        options = self.sessions.created_with
        self.assertEqual(options["line_items"], [
            {"quantity": 1, "price": "price_passes_10_test"}
        ])
        self.assertEqual(options["customer_creation"], "always")
        self.assertEqual(options["customer_email"], "buyer@example.test")
        self.assertEqual(options["invoice_creation"], {"enabled": True})
        self.assertEqual(options["automatic_tax"], {"enabled": False})
        self.assertEqual(options["billing_address_collection"], "auto")
        self.assertEqual(options["tax_id_collection"], {"enabled": False})
        self.assertNotIn("payment_intent_data", options)
        self.assertEqual(billing.STATEMENT_DESCRIPTOR, "MITSUKETA")
        self.assertEqual(self.database.purchases["cs_created"]["status"], "pending")

    def test_checkout_falls_back_to_inline_price_and_can_enable_tax(self):
        bundle = credits.Bundle("payg", 1, 500)
        with (mock.patch.dict(credits.REPORT_PASS_PACKS, {"payg": bundle}),
              mock.patch.object(billing, "STRIPE_TAX_ENABLED", True)):
            billing.create_checkout_session("account-1", "payg")

        options = self.sessions.created_with
        self.assertEqual(
            options["line_items"][0]["price_data"]["unit_amount"], 500
        )
        self.assertEqual(options["metadata"], {
            "account_id": "account-1",
            "pack": "payg",
            "report_passes": "1",
        })
        self.assertEqual(options["automatic_tax"], {"enabled": True})
        self.assertEqual(options["billing_address_collection"], "required")
        self.assertEqual(options["tax_id_collection"], {"enabled": True})
        self.assertNotIn("customer_email", options)

    def test_price_ids_are_configurable_from_environment(self):
        with mock.patch.dict(
            os.environ, {"STRIPE_PRICE_ID_PASSES_100": " price_pack_live "}
        ):
            self.assertEqual(
                credits._stripe_price_id("passes_100"), "price_pack_live"
            )

    def test_completed_and_async_events_share_idempotent_fulfillment(self):
        self.database.purchases["cs_paid"] = {
            "account_id": "account-1",
            "amount": 2500,
            "credits": 50,
            "status": "pending",
            "payment_intent": None,
        }
        self.sessions.session = {
            "id": "cs_paid",
            "payment_status": "paid",
            "payment_intent": {"id": "pi_paid"},
            "customer": {"id": "cus_buyer"},
        }

        self._set_event("checkout.session.completed", {"id": "cs_paid"})
        self.assertTrue(billing.handle_webhook(b"first", "sig"))
        self._set_event("checkout.session.async_payment_succeeded", {"id": "cs_paid"})
        self.assertTrue(billing.handle_webhook(b"retry", "sig"))

        self.assertEqual(self.database.ledger, [
            ("account-1", 50, "purchase", "cs_paid")
        ])
        self.assertEqual(self.database.purchases["cs_paid"]["status"], "paid")
        self.assertEqual(self.database.customers["account-1"], "cus_buyer")
        self.assertEqual(self.sessions.retrieved_with, [
            ("cs_paid", {"expand": ["line_items"]}),
            ("cs_paid", {"expand": ["line_items"]}),
        ])

    def test_verified_ignored_and_unpaid_events_are_acknowledged(self):
        self._set_event("customer.created", {"id": "cus_ignored"})
        self.assertTrue(billing.handle_webhook(b"ignored", "sig"))
        self.assertEqual(self.sessions.retrieved_with, [])

        self.sessions.session = {"id": "cs_unpaid", "payment_status": "unpaid"}
        self._set_event("checkout.session.completed", {"id": "cs_unpaid"})
        self.assertTrue(billing.handle_webhook(b"unpaid", "sig"))
        self.assertEqual(self.database.ledger, [])

    def test_paid_event_without_purchase_fails_for_stripe_to_retry(self):
        self.sessions.session = {"id": "cs_missing", "payment_status": "paid"}
        self._set_event("checkout.session.completed", {"id": "cs_missing"})
        with self.assertLogs(billing.logger, level="ERROR"):
            with self.assertRaisesRegex(RuntimeError, "no purchase row"):
                billing.handle_webhook(b"paid", "sig")

    def test_refund_marks_purchase_without_clawing_back_credits(self):
        self.database.purchases["cs_refund"] = {
            "account_id": "account-1",
            "amount": 2500,
            "credits": 50,
            "status": "paid",
            "payment_intent": "pi_refund",
        }
        self.database.ledger.append(("account-1", 50, "purchase", "cs_refund"))
        self._set_event("charge.refunded", {
            "payment_intent": "pi_refund",
            "refunded": True,
        })

        self.assertTrue(billing.handle_webhook(b"refund", "sig"))
        self.assertEqual(self.database.purchases["cs_refund"]["status"], "refunded")
        self.assertEqual(self.database.ledger, [
            ("account-1", 50, "purchase", "cs_refund")
        ])

    def test_partial_refund_does_not_mislabel_purchase_as_fully_refunded(self):
        self.database.purchases["cs_partial"] = {
            "account_id": "account-1",
            "amount": 2500,
            "credits": 50,
            "status": "paid",
            "payment_intent": "pi_partial",
        }
        self._set_event("charge.refunded", {
            "payment_intent": "pi_partial",
            "refunded": False,
            "amount_refunded": 500,
        })

        with self.assertLogs(billing.logger, level="WARNING"):
            self.assertTrue(billing.handle_webhook(b"partial-refund", "sig"))
        self.assertEqual(self.database.purchases["cs_partial"]["status"], "paid")

    def test_signature_error_propagates_for_route_to_return_400(self):
        self.webhooks.error = ValueError("bad signature")
        with self.assertRaisesRegex(ValueError, "bad signature"):
            billing.handle_webhook(b"bad", "bad-signature")

    def test_actionable_event_fails_loudly_when_database_is_down(self):
        self.sessions.session = {"id": "cs_paid", "payment_status": "paid"}
        self._set_event("checkout.session.completed", {"id": "cs_paid"})
        with (mock.patch.object(billing.db, "available", return_value=False),
              self.assertLogs(billing.logger, level="ERROR")):
            with self.assertRaisesRegex(RuntimeError, "billing database"):
                billing.handle_webhook(b"paid", "sig")


if __name__ == "__main__":
    unittest.main()
