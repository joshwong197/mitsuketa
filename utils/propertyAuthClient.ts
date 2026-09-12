// Tokens stay in Clerk's session handling; never write them to browser storage here.
let token: (() => Promise<string | null>) | undefined;
let exitSession: (() => Promise<void>) | undefined;
export function setPropertyAuth(getToken?: () => Promise<string | null>, signOut?: () => Promise<void>) {
    token = getToken; exitSession = signOut;
}
export async function propertyAuthHeaders(): Promise<Record<string, string>> {
    const value = await token?.();
    return value ? { Authorization: `Bearer ${value}` } : {};
}
export async function exitPropertyAuth() { await exitSession?.(); }
export const usesClerk = () => import.meta.env.VITE_PROPERTY_AUTH_MODE === 'clerk';
