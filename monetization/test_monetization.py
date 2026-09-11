"""
Self-check for the credit ledger money path. No database needed: it runs the
same consume/grant rule the site uses against MemStore.

    python test_monetization.py
"""
import credits
from credits import BUNDLES, MemStore, grant, consume, balance

ACC = "acc-1"


def test_grant_and_balance():
    s = MemStore()
    assert balance(s, ACC) == 0
    grant(s, ACC, 50, reason="purchase", ref="sess_1")
    assert balance(s, ACC) == 50


def test_consume_draws_one():
    s = MemStore()
    grant(s, ACC, 2)
    assert consume(s, ACC, ref="search_a") is True
    assert balance(s, ACC) == 1
    assert consume(s, ACC, ref="search_b") is True
    assert balance(s, ACC) == 0


def test_no_free_search_and_no_negative():
    s = MemStore()
    grant(s, ACC, 1)
    assert consume(s, ACC) is True          # spends the last credit
    assert consume(s, ACC) is False         # nothing left: blocked
    assert consume(s, ACC) is False         # still blocked
    assert balance(s, ACC) == 0             # never goes negative


def test_two_accounts_are_isolated():
    s = MemStore()
    grant(s, "a", 3)
    grant(s, "b", 1)
    assert consume(s, "b") is True
    assert consume(s, "b") is False         # b is out
    assert balance(s, "a") == 3             # a untouched


def test_grant_rejects_nonpositive():
    s = MemStore()
    for bad in (0, -5):
        try:
            grant(s, ACC, bad)
            assert False, "expected ValueError"
        except ValueError:
            pass


def test_bundles_are_sane():
    assert BUNDLES, "at least one bundle"
    for b in BUNDLES.values():
        assert b.credits > 0 and b.price_cents > 0
        per = b.price_cents / b.credits         # cents per search
        assert 1 <= per <= 500, f"{b.key}: {per}c/credit looks wrong"
    # larger bundles should not cost more per credit than smaller ones
    ordered = sorted(BUNDLES.values(), key=lambda b: b.credits)
    per = [b.price_cents / b.credits for b in ordered]
    assert per == sorted(per, reverse=True), "bulk should be cheaper per credit"


def demo():
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("all monetisation checks passed")


if __name__ == "__main__":
    demo()
