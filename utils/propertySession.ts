// Unlock state for the property feature (家族).
//
// Held in a module-scope variable and NOWHERE ELSE. That is the whole design,
// and it is what gives the required lifetime for free:
//
//   navigate to a company graph and come back  -> module still loaded, still
//                                                 unlocked, no re-login
//   reload, new tab, or close and reopen       -> fresh module, locked again
//
// sessionStorage would survive a reload and localStorage would survive
// everything, so neither is used. It also means the acknowledgement cannot be
// forged: there is no cookie or storage key a user can set by hand to skip the
// privacy notice, because the flag only ever exists in memory.
//
// The server keeps its own httpOnly session cookie for actual authorisation —
// this state is the client's view of it, not the credential.

export interface PropertySession {
    /** Self-declared name, echoed back by the server after a successful login. */
    searcher: string;
    /** Has the privacy notice been accepted this session? */
    acknowledged: boolean;
}

let current: PropertySession | null = null;
const listeners = new Set<() => void>();

function emit() {
    for (const fn of listeners) fn();
}

export function getSession(): PropertySession | null {
    return current;
}

export function signIn(searcher: string): void {
    current = { searcher, acknowledged: false };
    emit();
}

export function acknowledge(): void {
    if (!current) return;
    current = { ...current, acknowledged: true };
    emit();
}

/** Called on sign-out and whenever the API reports the session is gone (401). */
export function signOut(): void {
    current = null;
    emit();
}

export function subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
