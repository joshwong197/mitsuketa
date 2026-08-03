// Drive the LINZ property search from the terminal, before there is any UI.
//
//   npm run property -- address "810 Great South Road, Penrose, Auckland"
//   npm run property -- address 742580          (an address_id from a tie)
//   npm run property -- owner   "Norak Properties Limited"
//   npm run property -- title   NA96C/861
//
// Reads LINZ_API_KEY from .env via node --env-file. Talks to LDS directly and
// skips api/property.ts entirely — no dev server, no login, no session. That is
// the point: it tests the search, not the plumbing around it.
//
// This prints real names of owners, mortgagees and caveators to your terminal.
// Same licence obligations as anywhere else in the feature.
import {
    LDSClient, estateLine, groupOwners, ownerName, searchAddress, searchOwner, titleReport,
} from './lds.ts';
import { analyse, heldFor, visible } from './memorials.ts';

const [mode, ...rest] = process.argv.slice(2);
const query = rest.join(' ').trim();

if (!mode || !query) {
    console.error('usage: npm run property -- <address|owner|title> "<query>"');
    process.exit(2);
}
if (!process.env.LINZ_API_KEY) {
    console.error('No LINZ_API_KEY. Is it set in .env? (this script needs --env-file=.env)');
    process.exit(2);
}

const client = new LDSClient();
const rule = (s: string) => console.log(`\n${s}\n${'─'.repeat(s.length)}`);

if (mode === 'address') {
    // A bare number is an address_id from a previous ambiguous result.
    const asId = /^\d+$/.test(query) ? Number(query) : undefined;
    const r = await searchAddress(client, asId === undefined ? query : '', asId);
    rule(`ADDRESS  ${query}`);
    console.log(`status: ${r.resolution_status}`);

    if (r.resolution_status === 'needs_confirmation') {
        console.log(`\n${r.candidates?.length} addresses matched — re-run with one of these ids:\n`);
        for (const c of r.candidates ?? []) {
            const where = [c.suburb_locality, c.town_city, c.territorial_authority]
                .filter(Boolean).join(' · ');
            console.log(`  ${String(c.address_id).padEnd(9)} ${c.full_address}`);
            if (where) console.log(`  ${' '.repeat(9)} ${where}`);
        }
        console.log(`\n  e.g. npm run property -- address ${r.candidates?.[0]?.address_id}`);
    } else if (r.resolution_status === 'ok') {
        console.log(`resolved: ${r.resolved_address?.full_address}`);
        console.log(`\n${r.titles?.length} title(s) at this address:\n`);
        for (const t of r.titles ?? []) {
            console.log(`  ${String(t.title_no).padEnd(14)} ${t.type} / ${t.status} / ${t.land_district}`);
            if (t.owners) console.log(`  ${' '.repeat(14)} ${t.owners}`);
        }
        console.log(`\n  next: npm run property -- title ${r.titles?.[0]?.title_no}`);
    } else {
        console.log('No title found at that address.');
    }
} else if (mode === 'owner') {
    const r = await searchOwner(client, query);
    rule(`OWNER  ${query}`);
    const seen = new Set<string>();
    const titles = r.results.filter(row => {
        if (!row.title_no || seen.has(row.title_no)) return false;
        seen.add(row.title_no);
        return true;
    });
    console.log(`${r.results.length} owner rows -> ${titles.length} distinct titles\n`);
    if (r.truncated) {
        console.log('  NOTE: more owners matched than can be listed, and these are NOT the');
        console.log('  closest matches — LINZ returns them in register order. Narrow the query.\n');
    }
    for (const row of titles) {
        const t = row.title ?? {};
        console.log(`  ${String(row.title_no).padEnd(14)} ${ownerName(row)}`);
        console.log(`  ${' '.repeat(14)} ${[t.type, t.status, t.land_district ?? row.land_district]
            .filter(Boolean).join(' / ')}`);
    }
    if (titles[0]) console.log(`\n  next: npm run property -- title ${titles[0].title_no}`);
} else if (mode === 'title') {
    const d = await titleReport(client, query);
    if (!d.title && d.memorials.length === 0) {
        console.log(`No title found for ${query}.`);
        process.exit(1);
    }
    rule(`TITLE  ${d.title?.title_no ?? query}`);
    console.log(`${d.title?.type} / ${d.title?.status} / ${d.title?.land_district}`);
    if (d.address) console.log(`address: ${d.address}`);

    const owners = groupOwners(d.owners, d.estates);
    console.log(`\nOwners (${owners.length}):`);
    for (const o of owners) {
        console.log(`  ${o.name}${o.shares.length ? `  ${o.shares.join(', ')}` : ''}`);
    }
    if (d.estates.length) {
        console.log(`\nEstates:`);
        for (const e of d.estates) console.log(`  ${estateLine(e)}`);
    }

    const events = analyse(d.memorials);
    const shown = visible(events);
    const current = shown.filter(e => e.current);
    console.log(`\n${d.memorials.length} memorials -> ${shown.length} events`
        + ` (${events.length - shown.length} folded), ${current.length} current\n`);

    for (const e of shown) {
        const when = e.date
            ? (e.undated ? `${e.date.getUTCFullYear()}?` : e.date.toISOString().slice(0, 10))
            : '          ';
        const flags = [
            e.current ? 'CURRENT' : '',
            e.closed_by ? `closed by ${e.closed_by.instrument}` : '',
            e.duration_days !== undefined ? heldFor(e) : '',
        ].filter(Boolean).join(' · ');
        console.log(`  ${when}  ${String(e.instrument ?? '-').padEnd(12)} ${e.headline}`);
        console.log(`              ${e.commentary}`);
        if (flags) console.log(`              [${flags}]`);
    }
} else {
    console.error(`unknown mode "${mode}". Use address, owner or title.`);
    process.exit(2);
}
