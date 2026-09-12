import React, { useEffect, useRef, useState } from 'react';
import { ClerkProvider, useAuth, useClerk } from '@clerk/react';
import { setPropertyAuth } from '../utils/propertyAuthClient';
import { signOut } from '../utils/propertySession';

function Bridge({ children }: { children: React.ReactNode }) {
    const { getToken, userId, isLoaded } = useAuth();
    const clerk = useClerk();
    const [ready, setReady] = useState(false);
    const previousUserId = useRef<string | null | undefined>(undefined);
    useEffect(() => {
        setPropertyAuth(() => getToken(), async () => { await clerk.signOut(); signOut(); });
        setReady(true);
        return () => setPropertyAuth();
    }, [getToken, clerk]);
    useEffect(() => {
        if (!isLoaded) return;
        if (previousUserId.current !== userId) signOut();
        previousUserId.current = userId;
    }, [isLoaded, userId]);
    return ready ? children : <p>Loading Mitsuketa…</p>;
}
// Clerk must complete hash-only navigation without waiting for a document unload.
// Its default window navigation leaves the session transition pending on /#/app.
function navigate(to: string, replace = false) {
    const destination = new URL(to, window.location.href);
    if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) {
        const oldURL = window.location.href;
        window.history[replace ? 'replaceState' : 'pushState'](null, '', destination.href);
        window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL: destination.href }));
    } else if (replace) window.location.replace(destination.href);
    else window.location.assign(destination.href);
}
const push = (to: string) => navigate(to);
const replace = (to: string) => navigate(to, true);

export default function ClerkRoot({ children }: { children: React.ReactNode }) {
    return <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
        routerPush={push} routerReplace={replace}
        signInForceRedirectUrl="/#/app" signUpForceRedirectUrl="/#/app">
        <Bridge>{children}</Bridge>
    </ClerkProvider>;
}
