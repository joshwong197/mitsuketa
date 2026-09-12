import React, { useEffect, useState } from 'react';
import { fetchSearchAudit, type SearchAuditRow } from '../services/propertyService';

export function PropertyAudit({ onBack }: { onBack: () => void }) {
    const [rows, setRows] = useState<SearchAuditRow[]>([]);
    const [searcher, setSearcher] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const refresh = async (filter: string) => {
        setBusy(true); setError(''); setRows([]);
        try { setRows((await fetchSearchAudit(filter)).rows); }
        catch { setError('The search log could not be loaded. Administrator access is required.'); }
        finally { setBusy(false); }
    };
    useEffect(() => { void refresh(''); }, []);
    return <section className="text-left" aria-label="Search audit">
        <button onClick={onBack} className="text-accent" style={{ fontSize: 12 }}>← Back to property search</button>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, margin: '16px 0 6px' }}>Search audit</h3>
        <p className="text-ink-mid" style={{ fontSize: 12, marginBottom: 16 }}>
            Latest 200 search attempts. Inputs only; returned property data is not stored here.
        </p>
        <form onSubmit={e => { e.preventDefault(); void refresh(searcher); }} className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
            <input aria-label="Filter by username" placeholder="Email or username (optional)" value={searcher}
                onChange={e => setSearcher(e.target.value)} className="bg-paper text-ink"
                style={{ border: '1px solid var(--rule)', padding: 8, minWidth: 230 }} />
            <button disabled={busy} className="bg-ink text-paper" style={{ padding: '8px 16px' }}>Refresh log</button>
        </form>
        <div role="status" style={{ fontSize: 12, marginBottom: 12 }}>{busy ? 'Loading searches…' : error || `${rows.length} records`}</div>
        <div style={{ overflowX: 'auto', border: '1px solid var(--rule)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>{['Search ID', 'Time', 'Credential', 'Matter reference', 'Mode', 'Query', 'Title', 'IP'].map(label =>
                    <th key={label} style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--rule)' }}>{label}</th>)}</tr></thead>
                <tbody>{rows.map(row => <tr key={row.audit_reference}>
                    {[row.audit_reference, new Date(row.created_at).toLocaleString(), row.actor, row.matter_ref,
                        row.mode, row.query, row.title_no, row.ip].map((value, index) =>
                        <td key={index} style={{ padding: 10, borderBottom: '1px solid var(--rule)', overflowWrap: 'anywhere', minWidth: 95 }}>{value || '—'}</td>)}
                </tr>)}</tbody>
            </table>
        </div>
        <p className="text-ink-pale" style={{ fontSize: 11, marginTop: 10 }}>“password:” identifies the credential used, not verified ownership of an email address.</p>
    </section>;
}
