// Self-check for utils/memorials.ts — run with `npm run check:memorials`.
//
// Ported from the Python reference implementation's own self-check, against the
// same real LINZ rows pulled during the probe. Natural persons' names are
// replaced with invented ones — register text is personal data under the LINZ
// Licence for Personal Data and must not be republished. Company names are
// left as-is (public on the Companies Register), as are instrument numbers,
// which are what the parser is actually being tested against.
import assert from 'node:assert/strict';
import { analyse, isInstitutional, type MemorialRow, type MemorialEvent } from './memorials.ts';

const rows: MemorialRow[] = [
    { id: 13296143, memorial_text: 'D651878.3 Mortgage to ASB Bank Limited - 29.10.2001 at 11.21 am',
      current: false, instrument_number: 'D651878.3',
      instrument_lodged_datetime: '2001-10-29T11:21:00Z', instrument_type: 'Mortgage' },
    { id: 22778619, memorial_text: '5829156.1 Discharge of Mortgage D651878.3 - 8.12.2003 at 9:00 am',
      current: false, instrument_number: '5829156.1',
      instrument_lodged_datetime: '2003-12-08T09:00:00Z', instrument_type: 'Discharge of Mortgage' },
    { id: 22778620, memorial_text: '5829156.2 Transfer  to Alan Peter Rewa and Marie Jean Rewa - 8.12.2003 at 9:00 am',
      current: false, instrument_number: '5829156.2',
      instrument_lodged_datetime: '2003-12-08T09:00:00Z', instrument_type: 'Transfer' },
    { id: 22778622, memorial_text: '5829156.3 Mortgage to ASB Bank Limited - 8.12.2003 at 9:00 am',
      current: false, instrument_number: '5829156.3',
      instrument_lodged_datetime: '2003-12-08T09:00:00Z', instrument_type: 'Mortgage' },
    { id: 58632771, memorial_text: '12870399.2 Mortgage to WEI LIN CHEN - 8.11.2023 at 10:42 am',
      current: true, instrument_number: '12870399.2',
      instrument_lodged_datetime: '2023-11-08T10:42:12Z', instrument_type: 'Mortgage',
      encumbrancees: 'WEI LIN CHEN' },
    { id: 61919562, memorial_text: '13374411.1 CAVEAT BY MEI HUA LI - 13.8.2025 at 4:34 pm',
      current: false, instrument_number: '13374411.1',
      instrument_lodged_datetime: '2025-08-13T16:34:08Z', instrument_type: 'Caveat' },
    { id: 62245307, memorial_text: '13428047.1 Withdrawal of Caveat 13374411.1 - 9.10.2025 at 9:35 am',
      current: false, instrument_number: '13428047.1',
      instrument_lodged_datetime: '2025-10-09T09:35:44Z', instrument_type: 'Withdrawal of Caveat' },
    { id: 63751559, memorial_text: '13653395.1 Discharge of Mortgage 77413 - 17.7.2026 at 12:38 pm',
      current: false, instrument_number: '13653395.1',
      instrument_lodged_datetime: '2026-07-17T12:38:42Z', instrument_type: 'Discharge of Mortgage' },
    { id: 25883459, memorial_text: '6373412.2 Mortgage to Commonwealth Bank of Australia - 7.4.2005 at 9:00 am',
      current: false, instrument_number: '6373412.2',
      instrument_lodged_datetime: '2005-04-07T09:00:00Z', instrument_type: 'Mortgage' },
    { id: 30902349, memorial_text: '7315901.1 Discharge of Mortgage 6373412.2 - 12.4.2007 at 9:00 am',
      current: false, instrument_number: '7315901.1',
      instrument_lodged_datetime: '2007-04-12T09:00:00Z', instrument_type: 'Partial Discharge of Mortgage' },
    { id: 62785054, memorial_text: 'For area and dimensions see DP 604364',
      current: true, instrument_number: 'REDUCED LEVEL',
      instrument_lodged_datetime: '1860-01-01T09:00:00Z',
      instrument_type: 'Order for New Certificate of Title' },
    { id: 62785092, memorial_text: '9431593.1 Mortgage to (now) Public Trust - 27.6.2013 at 2:34 pm ( Affects parts formerly Lot 3 DP 554055 )',
      current: true, instrument_number: '9431593.1',
      instrument_lodged_datetime: '2013-06-27T14:34:51Z', instrument_type: 'Mortgage',
      encumbrancees: 'Public Trust' },
    // --- commercial shapes, from NA96C/861 ---
    { id: 11951585, memorial_text: 'C626345.4 Lease to Fletcher Building Limited Term 15 years commencing on 1 April 1994 - 14.7.1994 at 2.51 pm (Renewal clause)',
      current: false, instrument_number: 'C626345.4',
      instrument_lodged_datetime: '1994-07-14T14:51:00Z', instrument_type: 'Lease' },
    { id: 31200305, memorial_text: '7387285.1 Surrender of Lease C626345.4 - 25.5.2007 at 9:00 am',
      current: false, instrument_number: '7387285.1',
      instrument_lodged_datetime: '2007-05-25T09:00:00Z', instrument_type: 'Surrender of Lease/Licence' },
    { id: 30902367, memorial_text: '7315901.4 Encumbrance to Macquarie Goodman Nominee (NZ) Limited - 12.4.2007 at 9:00 am',
      current: false, instrument_number: '7315901.4',
      instrument_lodged_datetime: '2007-04-12T09:00:00Z', instrument_type: 'Encumbrance' },
    { id: 34499520, memorial_text: '8065536.1 Discharge of Encumbrance 7315901.4 - 10.2.2009 at 3:38 pm',
      current: false, instrument_number: '8065536.1',
      instrument_lodged_datetime: '2009-02-10T15:38:45Z', instrument_type: 'Discharge of Encumbrance' },
    { id: 34510151, memorial_text: '8065536.3 Variation of Lease 8065536.2 and extension of term to 31.10.2026 - 10.2.2009 at 3:38 pm',
      current: false, instrument_number: '8065536.3',
      instrument_lodged_datetime: '2009-02-10T15:38:45Z', instrument_type: 'Variation of Lease' },
    { id: 34509993, memorial_text: '8065536.2 Lease Term 12 years commencing on 1.11.2008 expiring 31.10.2020 (renewal and purchase clauses) CT 465566 issued - 10.2.2009 at 3:38 pm',
      current: false, instrument_number: '8065536.2',
      instrument_lodged_datetime: '2009-02-10T15:38:45Z', instrument_type: 'Lease' },
    { id: 11951578, memorial_text: 'Subject to Section 59 Land Act 1948 (affects part)',
      current: true, instrument_number: 'DEFAULTWS',
      instrument_lodged_datetime: '1870-01-01T09:00:00Z', instrument_type: null },
    { id: 48169881, memorial_text: '11010933.1 Subject to Section 81(2) and 81(3) Building Act 2004 (affects 714784 ) - 22.1.2018 at 4:47 pm',
      current: true, instrument_number: '11010933.1',
      instrument_lodged_datetime: '2018-01-22T16:47:35Z',
      instrument_type: 'Building Act 2004 - Certificate Imposing Condition - s77(4)' },
];

const byRow = new Map<number, MemorialEvent>(analyse(rows).map(e => [e.row_id, e]));
const at = (id: number): MemorialEvent => {
    const e = byRow.get(id);
    if (!e) throw new Error(`no event for row ${id}`);
    return e;
};

// Pairing: the 2001 ASB mortgage is closed by the 2003 discharge, ~25 months.
const asb = at(13296143);
assert.equal(asb.closed_by?.row_id, 22778619, 'mortgage -> discharge not paired');
assert.equal(asb.duration_months, 25);
assert.equal(at(22778619).closes?.row_id, 13296143, 'discharge -> mortgage not paired');

// Batch: 5829156.{1,2,3} registered together.
const batch = new Set(at(22778620).related
    .filter(r => r.relation === 'Same batch').map(r => r.target.row_id));
assert.deepEqual(batch, new Set([22778619, 22778622]));

// Party parsing across every text shape, incl. "(now)" and lease "Term".
assert.equal(asb.party, 'ASB Bank Limited');
assert.equal(at(22778620).party, 'Alan Peter Rewa and Marie Jean Rewa');
assert.equal(at(61919562).party, 'MEI HUA LI');
assert.equal(at(62785092).party, 'Public Trust');
assert.equal(at(11951585).party, 'Fletcher Building Limited');
assert.equal(at(30902367).party, 'Macquarie Goodman Nominee (NZ) Limited');
assert.equal(at(34509993).party, null, 'lease with no named lessee');

assert.ok(isInstitutional('ASB Bank Limited'));
assert.ok(!isInstitutional('WEI LIN CHEN'));

// Caveat -> withdrawal.
assert.equal(at(61919562).closed_by?.row_id, 62245307);
assert.ok(at(62245307).commentary.includes('Withdraws the caveat lodged by MEI HUA LI'));

// A partial discharge must NOT mark its mortgage as closed — reporting a live
// mortgage as discharged is the worst error this report can make.
const partial = at(30902349);
assert.ok(partial.partial);
assert.ok(partial.commentary.includes('Partially discharges the mortgage 6373412.2'));
assert.equal(at(25883459).closed_by, undefined, 'partial discharge must not close');

// Old-style letter-prefixed and bare target numbers both resolve.
assert.equal(at(63751559).refers_to, '77413');
assert.equal(at(22778619).refers_to, 'D651878.3');

// Lease -> surrender closes it; ~154 months.
const lease = at(11951585);
assert.equal(lease.closed_by?.row_id, 31200305, 'lease -> surrender not paired');
assert.ok(lease.commentary.includes('Surrendered after ~154 months'), lease.commentary);
assert.ok(at(31200305).commentary
    .includes('Surrenders the lease C626345.4 to Fletcher Building Limited'));

// Encumbrance -> discharge of encumbrance.
assert.equal(at(30902367).closed_by?.row_id, 34499520);
assert.ok(at(34499520).commentary.includes('Discharges the encumbrance 7315901.4'));

// A VARIATION references a lease without closing it.
const varied = at(34509993);
assert.equal(varied.closed_by, undefined, 'variation must not close the lease');
assert.ok(varied.related.some(r => r.relation === 'Varied'), 'variation link missing');

// Sentinel instrument numbers never become batch keys; null type is safe.
assert.equal(at(62785054).batch, null);
assert.equal(at(11951578).batch, null);
assert.equal(at(11951578).category, 'other');
assert.ok(at(11951578).undated, '1870 sentinel should be flagged');

// Long statutory type names get shortened for the card layout.
assert.equal(at(48169881).label, 'Building Act Certificate');

// Live private mortgage reads correctly.
assert.equal(at(58632771).commentary,
    'Mortgage to WEI LIN CHEN (private lender). Still registered against the title.');

console.log(`ok - ${byRow.size} memorials analysed, all assertions passed`);
