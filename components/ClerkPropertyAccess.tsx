import React, { useEffect, useState } from 'react';
import { UserButton, useUser } from '@clerk/react';
import { accountRequest, type AccountStatus } from '../services/propertyAccountService';
import { getSession, signIn, signOut } from '../utils/propertySession';
import { PropertyAudit } from './PropertyAudit';
import { ApplicationReview, NoticeAcceptance, PropertyApplication } from './PropertyApplication';


export function PropertyAccountPanel({ account, refresh }: { account: AccountStatus; refresh: () => Promise<void> }) {


    const [accepted, setAccepted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [members, setMembers] = useState<any[] | null>(null);
    const [audit, setAudit] = useState(false);
    const run = async (action: () => Promise<void>) => {
        setBusy(true); setError('');
        try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
        finally { setBusy(false); }
    };
    if (audit) return <PropertyAudit onBack={() => setAudit(false)} />;
    return <section aria-label="Property account" className="text-left" style={{ border: '1px solid var(--rule)', padding: 18, marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 21 }}>Your property access</h3>
        <p style={{ margin: '8px 0' }}>{account.searcher} · {account.status === 'pending' ? 'Awaiting approval' : account.status}</p>
        <button type="button" disabled={busy} onClick={() => void run(refresh)} className="text-accent">Refresh access and balance</button>
        {account.status === 'pending' && <PropertyApplication email={account.searcher} />}
        {account.status === 'approved' && account.accepted_notice_version !== account.noticeVersion && <div>
            <p>Read and accept the current notice before searching.</p>
            <NoticeAcceptance key={account.noticeVersion} accepted={accepted} onChange={setAccepted} />
            <button className="sumi-primary" disabled={busy || !accepted} onClick={() => void run(async () => {
                await accountRequest('accept-notice', { noticeVersion: account.noticeVersion }); await refresh();
            })}>Continue to Property →</button>
        </div>}
        {['rejected', 'suspended'].includes(account.status) && <p>Contact the administrator to discuss your access. Payment cannot change this decision.</p>}
        {account.status === 'approved' && account.billing === 'sandbox' && <div style={{ marginTop: 16 }}>
            <p><strong>Sandbox billing — no real payments.</strong> {account.balance} report passes available.</p>
            <p>One pass is used when a title report is generated successfully. Address and owner result lists do not use passes.</p>
            <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
                {[['payg', '1 pass · NZ$5'], ['passes10', '10 passes · NZ$30'], ['passes100', '100 passes · NZ$200']].map(([offer, label]) =>
                    <button key={offer} disabled={busy} type="button" className="bg-ink text-paper" style={{ padding: '8px 12px' }} onClick={() => void run(async () => {
                        const { url } = await accountRequest('checkout', { offer, requestId: crypto.randomUUID() });
                        if (new URL(url).origin !== 'https://checkout.stripe.com') throw new Error('Unexpected checkout destination.');
                        window.location.assign(url);
                    })}>{label} (test)</button>)}
            </div>
        </div>}
        {account.canAudit && <div style={{ marginTop: 16 }}>
            <ApplicationReview />
            <button type="button" className="text-accent" disabled={busy} onClick={() => void run(async () => setMembers((await accountRequest('members')).rows))}>Manage existing accounts</button>
            {' · '}<button type="button" className="text-accent" onClick={() => setAudit(true)}>View search audit</button>
            {members?.map(member => <div key={member.id} style={{ borderTop: '1px solid var(--rule)', padding: '12px 0', overflowWrap: 'anywhere' }}>
                <p>{member.email} · {member.status}</p><p>{member.organisation}</p><p>{member.purpose || 'No application submitted yet.'}</p>
                <div className="flex flex-wrap gap-3">{[['approved', 'Approve'], ['rejected', 'Reject'], ['suspended', 'Suspend']].map(([status, label]) =>
                    <button key={status} type="button" disabled={busy} className="text-accent" onClick={() => void run(async () => {
                        await accountRequest('review', { accountId: member.id, status });
                        setMembers((await accountRequest('members')).rows); await refresh();
                    })}>{label}</button>)}</div>
            </div>)}
        </div>}
        {error && <p role="alert" style={{ marginTop: 12 }}>{error}</p>}
    </section>;
}

export default function ClerkPropertyAccess({ children }: { children: React.ReactNode }) {
    const { isLoaded, user } = useUser();
    const [account, setAccount] = useState<AccountStatus | null>(null);
    const [error, setError] = useState('');
    const refresh = async () => {
        const next = await accountRequest<AccountStatus>('status');
        setAccount(next); setError('');
        if (next.status === 'approved') {
            if (getSession()?.searcher !== next.searcher) signIn(next.searcher, next.canAudit);
        } else signOut();
    };
    useEffect(() => {
        setAccount(null);
        if (!user) { signOut(); return; }
        let cancelled = false;
        accountRequest<AccountStatus>('status').then(next => {
            if (cancelled) return;
            setAccount(next); setError('');
            if (next.status === 'approved') {
                if (getSession()?.searcher !== next.searcher) signIn(next.searcher, next.canAudit);
            } else signOut();
        }).catch(e => { if (!cancelled) setError(e.message); });
        return () => { cancelled = true; };
    }, [user?.id]);
    if (!isLoaded) return <p>Loading sign-in…</p>;
    if (!user) return <section className="sumi-property-entry">
        <p className="sumi-eyebrow">地 · Property intelligence</p>
        <h3>The land.<br />The people behind it.</h3>
        <p className="sumi-property-copy">Search titles, trace registered owners and read the interests recorded against a property.</p>
        <div className="sumi-property-actions"><a href="/?access=signin" className="sumi-primary">Sign in <span aria-hidden="true">→</span></a>
            <a href="/?access=request" className="sumi-text-action">Request access</a></div>
        <div className="sumi-property-foot"><p>Property searches are for approved accounts.<br />Apply first. Once approved, we’ll email your signup link.</p>
          <a className="sumi-text-action" href="/#/privacy">Privacy notice ↗</a></div>
    </section>;
    return <>
        <div className="flex justify-end" style={{ marginBottom: 12 }}><UserButton /></div>
        {error && <p role="alert">{error} <button onClick={() => void refresh().catch(e => setError(e.message))}>Retry</button></p>}
        {!account && !error && <p>Loading your property access…</p>}
        {account && <PropertyAccountPanel account={account} refresh={refresh} />}
        {account?.status === 'approved' && account.accepted_notice_version === account.noticeVersion && children}
    </>;
}
