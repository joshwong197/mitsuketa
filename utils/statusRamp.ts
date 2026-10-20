import { NodeData } from '../types';

/**
 * Sumi status ramp (design/STATUS_RAMP.md): active = plain ink,
 * trouble = dyed, dead = faded.
 *
 *   active      — Registered (and crawl placeholders: Parent / Sibling /
 *                 Subsidiary / Unknown / role types). Default ink, no color.
 *   warning     — removal underway. --amber border + chip.
 *   faded       — struck off / removed / deregistered / dissolved.
 *                 --ink-pale text, --ink-wash border.
 *   crit        — external administration (liquidation / receivership /
 *                 voluntary administration / statutory management),
 *                 insolvency (current or historic) or disqualified
 *                 director. --crit border + chip — the ONLY red on canvas.
 *   amalgamated — faded, plus a → glyph to the successor.
 */
export type StatusBucket = 'active' | 'warning' | 'faded' | 'crit' | 'amalgamated';

export function getStatusBucket(data: NodeData): StatusBucket {
  const s = (data.status || '').toLowerCase();

  // crit first — it must win over everything else. A discharged insolvency
  // stays crit rather than demoting to amber (explicit decision, design/HANDOVER.md
  // §4.3) — currency is a separate fact, surfaced via data.insolvencyCurrent /
  // dischargeSuspended in the UI, not by softening the colour.
  if (data.isDisqualified || data.hasHistoricInsolvency || data.hasInsolvencyRecord) return 'crit';
  if (s.includes('insolven') || s.includes('bankrupt')) return 'crit';

  if (s.includes('amalgamat')) return 'amalgamated';

  // NZBN entityStatusDescription: "In Liquidation", "In Receivership",
  // "In Voluntary Administration", "In Statutory Administration" — plus the
  // enrichment flags patched in by companyStatusApi. Current external
  // administration is red (2026-10-20 decision), not amber: a company in
  // liquidation now must not read calmer than one that was in liquidation once.
  if (
    data.isInExternalAdmin ||
    s.includes('liquidat') ||
    s.includes('receiver') ||
    s.includes('administration') ||
    s.includes('statutory')
  ) {
    return 'crit';
  }
  if (data.removalCommenced) return 'warning';

  // Dead entities: "Removed", "Struck off", "Deregistered", "Dissolved", "Deleted"
  if (
    s.includes('removed') ||
    s.includes('struck') ||
    s.includes('deregister') ||
    s.includes('dissolv') ||
    s.includes('deleted') ||
    s === 'inactive'
  ) {
    return 'faded';
  }

  return 'active';
}
