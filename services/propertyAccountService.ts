import { propertyAuthHeaders } from '../utils/propertyAuthClient';
export interface AccountStatus {
    id: string; searcher: string; status: 'pending' | 'approved' | 'rejected' | 'suspended';
    canAudit: boolean; balance: number; billing: 'off' | 'sandbox'; noticeVersion: string;
    accepted_notice_version: string | null;
}
export async function accountRequest<T = any>(mode: string, body?: object): Promise<T> {
    const response = await fetch(`/api/property-account?mode=${encodeURIComponent(mode)}`, {
        method: body ? 'POST' : 'GET', credentials: 'same-origin',
        headers: { ...await propertyAuthHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Account services are temporarily unavailable.');
    return data;
}
