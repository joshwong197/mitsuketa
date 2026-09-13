import React, { useEffect, useState } from 'react';
import { SignIn, SignUp, UserButton, useUser } from '@clerk/react';
import { accountRequest, type AccountStatus } from '../services/propertyAccountService';
import { NoticeAcceptance, PropertyApplication } from './PropertyApplication';

export default function AccessPage({ mode }: { mode: string }) {
    const { isLoaded, user } = useUser();
    const [account, setAccount] = useState<AccountStatus | null>(null);
    const [accepted, setAccepted] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const refresh = async () => {
        setBusy(true); setError('');
        try {
            const next = await accountRequest<AccountStatus>('status'); setAccount(next);
            if (next.status === 'approved' && next.accepted_notice_version === next.noticeVersion) window.location.replace('/?property=1#/app');
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not activate access.'); }
        finally { setBusy(false); }
    };
    useEffect(() => { if (user && mode !== 'request') void refresh(); }, [user?.id, mode]);
    return <main className="sumi-access-page">
        <header><a href="/" className="sumi-access-brand">見 <span>Mitsuketa</span></a><a href="/#/app" className="sumi-text-action">Company searches ↗</a>{user && <UserButton />}</header>
        <div className="sumi-access-layout"><section>
            <p className="sumi-eyebrow">地 · Property access</p>
            <h1>{mode === 'request' ? 'Begin with a request.' : user ? 'Your access, connected.' : mode === 'signin' ? 'Welcome back.' : 'A place for your next enquiry.'}</h1>
            <p>{mode === 'request' ? 'Property searches are available to approved users. Company searches remain open to everyone.' : 'Settle in to Mitsuketa. Your approved account brings title searches, registered owners and property interests into view.'}</p>
        </section><section aria-label="Mitsuketa account" className="sumi-access-form">
            {!isLoaded ? <p role="status">Loading your account…</p> : mode === 'request' ? <PropertyApplication /> : user ? <>
                <p>{user.primaryEmailAddress?.emailAddress}</p>
                {!account && !error && <p role="status">Connecting your approved access…</p>}
                {account?.status === 'approved' && account.accepted_notice_version !== account.noticeVersion && <>
                    <h2>One last step</h2><p>Your access is approved. Read and accept the current notice before searching.</p>
                    <NoticeAcceptance key={account.noticeVersion} accepted={accepted} onChange={setAccepted} />
                    <button className="sumi-primary" disabled={!accepted || busy} onClick={async () => {
                        setBusy(true); setError('');
                        try { await accountRequest('accept-notice', { noticeVersion: account.noticeVersion }); await refresh(); }
                        catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
                        finally { setBusy(false); }
                    }}>Continue to Property →</button>
                </>}
                {account && account.status !== 'approved' && <><h2>{account.status === 'pending' ? 'Access is awaiting approval' : 'Access is unavailable'}</h2>
                    <p>An account alone does not grant property access. If you were invited, check that you signed in with the invited email.</p>
                    {account.status === 'pending' && <a href="/?access=request" className="sumi-text-action">Request access</a>}
                    <button className="sumi-text-action" disabled={busy} onClick={() => void refresh()}>Check access again</button></>}
                {error && <p role="alert">{error} <button disabled={busy} onClick={() => void refresh()}>Retry</button></p>}
            </> : mode === 'signin' ? <SignIn routing="hash" signUpUrl="/?access=request" forceRedirectUrl="/?access=complete" />
                : mode === 'invite' && new URLSearchParams(window.location.search).has('__clerk_ticket')
                    ? <SignUp routing="hash" signInUrl="/?access=signin" forceRedirectUrl="/?access=complete" />
                    : <><h2>Your invitation starts here</h2><p>Open the link in your invitation email to set up your account. If the link has expired, ask the administrator to resend it.</p><a href="/?access=signin" className="sumi-text-action">Already registered? Sign in</a></>}
        </section></div>
        <footer><a href="/#/privacy">Privacy notice</a> · <a href="/#/terms">Terms</a></footer>
    </main>;
}
