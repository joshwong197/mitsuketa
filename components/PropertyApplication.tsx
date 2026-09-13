import React, { useEffect, useState } from 'react';
import { propertyAuthHeaders } from '../utils/propertyAuthClient';
import { NoticeAcceptance } from './NoticeAcceptance';
export { NoticeAcceptance } from './NoticeAcceptance';

export async function applicationRequest(mode: string, body?: object) {
    const response = await fetch(`/api/property-applications?mode=${mode}`, {
        method: body ? 'POST' : 'GET', credentials: 'same-origin',
        headers: { ...await propertyAuthHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Applications are temporarily unavailable.');
    return data;
}
export function PropertyApplication({ email: initialEmail = '' }: { email?: string }) {
    const [email, setEmail] = useState(initialEmail);
    const [organisation, setOrganisation] = useState('');
    const [purpose, setPurpose] = useState('');
    const [notice, setNotice] = useState('');
    const [accepted, setAccepted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const loadNotice = () => applicationRequest('notice').then(data => { setNotice(data.noticeVersion); setError(''); }).catch(() => setError('Could not load the access notice. Please retry.'));
    useEffect(() => { void loadNotice(); }, []);
    return <form className="sumi-application" aria-label="Request property access" onSubmit={async e => {
        e.preventDefault(); if (!accepted || !notice || busy) return; setBusy(true); setError('');
        try { const data = await applicationRequest('apply', { email, organisation, purpose, noticeVersion: notice }); setMessage(data.message); }
        catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
        finally { setBusy(false); }
    }}>
        <h3>Request property access</h3>
        <p>Tell us a little about your work. If approved, we’ll email a link to set up your Mitsuketa account.</p>
        {message ? <p role="status">{message}</p> : <>
            <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label>Organisation (optional)<input autoComplete="organization" maxLength={160} value={organisation} onChange={e => setOrganisation(e.target.value)} /></label>
            <label>Intended property-related use<textarea required maxLength={1000} rows={3} value={purpose} onChange={e => setPurpose(e.target.value)} /></label>
            <NoticeAcceptance key={notice} accepted={accepted} onChange={setAccepted} />
            <button className="sumi-primary" disabled={busy || !accepted || !notice}>{busy ? 'Submitting…' : 'Submit for review'} <span aria-hidden="true">→</span></button>
        </>}
        {error && <p role="alert">{error} {!notice && <button type="button" onClick={() => void loadNotice()}>Retry</button>}</p>}
    </form>;
}
export function ApplicationReview() {
    const [rows, setRows] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const run = async (mode = 'list', id?: string) => {
        setBusy(true); setError(''); setMessage('');
        try {
            if (id) { const result = await applicationRequest(mode, { applicationId: id }); setMessage(result.message || 'Invitation sent.'); }
            setRows((await applicationRequest('list')).rows); setOpen(true);
        } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
        finally { setBusy(false); }
    };
    return <div style={{ marginTop: 18 }}>
        <button className="sumi-text-action" disabled={busy} onClick={() => void run()}>Review access requests</button>
        {open && rows.length === 0 && <p>No access requests yet.</p>}
        {open && rows.map(row => <div key={row.id} style={{ borderTop: '1px solid var(--rule)', padding: '14px 0' }}>
            <strong>{row.email}</strong>
            <p>{row.status === 'pending' ? 'Awaiting review' : row.status === 'approved'
                ? row.invitation_state === 'failed' ? 'Approved · invitation needs retry'
                    : new Date(row.expires_at).getTime() < Date.now() ? 'Invitation expired'
                        : row.invitation_state === 'sent' ? 'Invited · awaiting signup' : 'Approved · sending invitation'
                : row.status === 'active' ? 'Active' : row.status}</p>
            <p>{row.organisation} {row.organisation && '·'} {row.purpose}</p>
            <div className="flex flex-wrap gap-4">
                {row.status === 'pending' && <button className="sumi-text-action" disabled={busy} onClick={() => void run('invite', row.id)}>Approve & invite</button>}
                {row.status === 'approved' && <button className="sumi-text-action" disabled={busy} onClick={() => void run(row.invitation_state === 'sent' ? 'resend' : 'invite', row.id)}>{row.invitation_state === 'sent' ? 'Resend invitation' : 'Retry invitation'}</button>}
                {row.status === 'pending' && <button className="sumi-text-action" disabled={busy} onClick={() => void run('reject', row.id)}>Reject</button>}
                {['approved','active'].includes(row.status) && <button className="sumi-text-action" disabled={busy} onClick={() => void run('revoke', row.id)}>Revoke access</button>}
            </div>
        </div>)}
        {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    </div>;
}
