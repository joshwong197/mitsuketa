import React, { useEffect, useState } from 'react';
import { propertyAuthHeaders } from '../utils/propertyAuthClient';
import { NoticeAcceptance } from './NoticeAcceptance';
import { applicationOptions } from '../utils/propertyApplicationDetails';
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
    const [details, setDetails] = useState({ version: 1, fullName: '', role: '', use: '', volume: '', sharing: '', recipients: '', safeguards: '', confirmed: false });
    const answer = (key: string, value: string | boolean) => setDetails(previous => ({ ...previous, [key]: value }));
    const [notice, setNotice] = useState('');
    const [accepted, setAccepted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const loadNotice = () => applicationRequest('notice').then(data => { setNotice(data.noticeVersion); setError(''); }).catch(() => setError('Could not load the access notice. Please retry.'));
    useEffect(() => { void loadNotice(); }, []);
    return <form className="sumi-application" aria-label="Request property access" onSubmit={async e => {
        e.preventDefault(); if (!accepted || !details.confirmed || !notice || busy) return; setBusy(true); setError('');
        try { const data = await applicationRequest('apply', { email, organisation, purpose, details, noticeVersion: notice }); setMessage(data.message); }
        catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
        finally { setBusy(false); }
    }}>
        <h2>Your application</h2>
        <p>We review each request before granting property access. No account or password is needed to apply. All fields are required unless marked optional.</p>
        {message ? <p role="status">{message}</p> : <>
            <fieldset><legend><span aria-hidden="true">一</span> About you</legend>
            <label>Full name<input autoComplete="name" required maxLength={160} value={details.fullName} onChange={e => answer('fullName', e.target.value)} /></label>
            <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label>Organisation (optional)<input autoComplete="organization" maxLength={160} value={organisation} onChange={e => setOrganisation(e.target.value)} /></label>
            <label>Your role or capacity<span className="application-help">For example, solicitor, researcher, business owner or private individual.</span><input autoComplete="organization-title" required maxLength={160} value={details.role} onChange={e => answer('role', e.target.value)} /></label>
            </fieldset>
            <fieldset><legend><span aria-hidden="true">二</span> Using property information</legend>
            <p>Toitū Te Whenua Land Information New Zealand (LINZ) supplies the title information used in property searches. It can include personal information, such as registered owners’ names. These questions help us assess your intended use.</p>
            <label>Main reason for access<select required value={details.use} onChange={e => answer('use', e.target.value)}><option value="">Choose a reason</option>{applicationOptions.use.map(option => <option key={option}>{option}</option>)}</select></label>
            <label>What will you use the information for?<span className="application-help">Describe the task and why title or ownership information is needed. Use a general example; do not include client names, addresses or confidential case details.</span><textarea required maxLength={1000} rows={4} value={purpose} onChange={e => setPurpose(e.target.value)} /></label>
            <label>Expected searches per month<select required value={details.volume} onChange={e => answer('volume', e.target.value)}><option value="">Choose an estimate</option>{applicationOptions.volume.map(option => <option key={option}>{option}</option>)}</select></label>
            <label>Who will receive the information?<select required value={details.sharing} onChange={e => answer('sharing', e.target.value)}><option value="">Choose the closest option</option>{applicationOptions.sharing.map(option => <option key={option}>{option}</option>)}</select></label>
            <label>Tell us about any sharing or publication<span className="application-help">Describe recipients by role, not name. Include any exports, client reports, publication, marketing, bulk collection or automated use you intend. If none, say so.</span><textarea required maxLength={1000} rows={3} value={details.recipients} onChange={e => answer('recipients', e.target.value)} /></label>
            <label>How will you store and protect the information?<span className="application-help">Tell us who will have access to saved reports and when you expect to delete them. If you will not save reports, say so.</span><textarea required maxLength={1000} rows={3} value={details.safeguards} onChange={e => answer('safeguards', e.target.value)} /></label>
            </fieldset>
            <fieldset><legend><span aria-hidden="true">三</span> Review and submit</legend>
            <p>Administrators use these answers to assess and manage access. An application does not grant access or permission for a particular use of LINZ data. Approved users must meet the applicable terms before searching.</p>
            <NoticeAcceptance key={notice} accepted={accepted} onChange={setAccepted} />
            <label className="sumi-notice-confirm"><input type="checkbox" required checked={details.confirmed} onChange={e => answer('confirmed', e.target.checked)} />I confirm these answers describe my intended use accurately. I understand this request needs review before property access is granted.</label>
            <button className="sumi-primary" disabled={busy || !accepted || !details.confirmed || !notice}>{busy ? 'Submitting…' : 'Submit application'} <span aria-hidden="true">→</span></button>
            </fieldset>
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
            {row.application_details ? <dl className="application-review-answers">
                {([['fullName', 'Name'], ['role', 'Role or capacity'], ['use', 'Main use'], ['volume', 'Searches per month'], ['sharing', 'Recipients'], ['recipients', 'Sharing plans'], ['safeguards', 'Storage and protection']] as const).map(([key, label]) => <React.Fragment key={key}><dt>{label}</dt><dd>{row.application_details[key]}</dd></React.Fragment>)}
            </dl> : <p>Earlier application — the additional use and handling questions were not collected.</p>}
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
