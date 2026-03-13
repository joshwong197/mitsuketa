# Downstream Capping Analysis & Post-Mortem

## The Core Challenge
The application currently attempts to completely crawl the corporate structure both upstream (parents) and downstream (subsidiaries) when searching for an entity to build the "Big Wide Web".

**The trigger symptom:** Searching for an entity like `Teak Constructiongroup Limited` takes 26 minutes to resolve because the recursive crawl traverses "Lawyer Trustee" nodes (e.g. `Dog Trustee Company Limited`). These trustees legitimately act as shareholders for 900+ completely unrelated entities, causing the crawler to individually fetch details for hundreds/thousands of unhelpful nodes.

## What Was Attempted (The Pragmatic Cap)
We attempted to build an inline structural cap to sever specific branches *during* the graph-building phase, without rewriting the whole engine.

1. **Attempt 1 (`> 100` total results):** We added logic inside `apiService.crawlDownstream()` to check if the MBIE Roles API returned $> 100$ items. If so, it would halt the crawl for that specific entity, preventing the recursive explosion from a mega-node. 
   * **Why it failed:** The MBIE API groups hundreds of subsidiaries inside a single role's `shareholdings` array. Consequently, `results.totalResults` would equal `1`, bypassing the `100` role cap.
2. **Attempt 2 (`totalHoldings` calculation):** We updated the math to explicitly count the length of the nested `shareholdings` arrays (`totalHoldings`).
   * **Why it failed:** The crawler executes upstream (Phase 1) and downstream (Phase 2 & 3) in parallel. The massive entity was discovered in Phase 1 as a parent, but Phase 2 then forced a downstream crawl on it. We had to ensure Phase 2 evaluated the cap *before* initiating recursion.
3. **Attempt 3 (`Threshold 15` & Keyword Matches):** We noticed that smaller lawyer trusts (like `Onehunga Trustee` or `Gereco Trust` with only 54 or 4 nodes) were slipping under the `100` threshold, so we aggressively dropped the limit to `15`, scaling down to `5` if the entity's name contained words like `TRUSTEE` or `NOMINEE`.
   * **Why it failed (Conceptual mismatch):** As identified by the user, capping regular companies at 15 is detrimental because legitimate holding companies (sometimes part of dodging or complex schemes) *do* legitimately own 50+ companies, and these connections are critical.

## Why The Bug (26 Minute Crawl) Persisted
Even with the mega-nodes successfully neutered by Attempt 2 and Attempt 3, the crawl times remained astronomically high.

This proves that the performance bottleneck is NOT uniquely caused by the 900+ lawyer trustees alone. It is caused by the **unconstrained exponential recursion depth of the crawler itself**. 

Currently, `apiService.ts` operates as follows:
1. **Phase 1 (Upstream):** Traverses UP to depth 3, fetching every single ancestor/parent. Let's say this finds 30 parents total.
2. **Phase 2 (Downstream off Parents):** For *each* of those 30 parents, the crawler executes `crawlDownstream(depth=0)`.
3. **Recursion (The Detonator):** `crawlDownstream` recurses downstream up to `depth=2`. 

Even if we completely exclude nodes with > 15 subsidiaries, a strictly normal branching factor of 5 will destroy the network:
* `depth=0`: 1 node
* `depth=1`: 5 subsidiaries
* `depth=2`: 25 subsidiaries

If Phase 1 finds 30 parents, Phase 2 instructs the crawler to explore `30 * 30 = 900` nodes. Each node requires a separate `fetchRolesByEntityName` API call fetching data over proxy (taking 2 seconds each). $900 \times 2 = 1800$ seconds = **30 Minutes**.

## Conclusion for Opus
To resolve the 26-minute crawl issue without destroying the integrity of legitimate dense corporate structures (the "Big Wide Web"), structural caps (`limit > X`) inside the asynchronous crawler are insufficient and unsafe. 

**Recommended Next Steps:**
1. **Remove Downstream Recursion:** The simplest fix is to limit `crawlDownstream` recursion. If we only execute `crawlDownstream` to depth `0` for Phase 2 parents (to discover direct siblings), and depth `1` for the root searched entity, it eliminates the exponential factorial growth while still rendering the complete immediate web.
2. **Lazy-loading Architecture ("Click to Expand"):** Rewrite the graph UI so it only loads up to 1 explicit layer outward on page load. If the user wants to see the 958 subsidiaries of Dog Trustee, they can double-click the central node to asynchronously fetch that branch on-demand.
