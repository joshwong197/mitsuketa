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
export default function ClerkRoot({ children }: { children: React.ReactNode }) {
    return <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
        <Bridge>{children}</Bridge>
    </ClerkProvider>;
}
