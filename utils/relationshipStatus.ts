import type { NZBNFullEntity } from '../types';

const normalise = (name: string) => name.toUpperCase().replace(/\bLTD\.?\b/g, 'LIMITED').replace(/[^A-Z0-9]/g, '');

/** Role-search hits are discovery evidence, not proof of current ownership. */
export function shareholderStatus(ownerNzbn: string, ownerName: string, child: Pick<NZBNFullEntity, 'company-details'> | null, holding: any, role: any): 'current' | 'former' | 'unverified' {
    const ended = (value: any) => [value?.endDate, value?.resignationDate, value?.cessationDate].some(date => date && Date.parse(date) <= Date.now()) || /^(inactive|ceased|resigned|historic|historical)$/i.test(value?.status || value?.roleStatus || '');
    if (ended(holding) || ended(role)) return 'former';
    const allocations = child?.['company-details']?.shareholding?.shareAllocation;
    if (!Array.isArray(allocations)) return 'unverified';
    const holders = allocations.flatMap(a => a.shareholder || []).map(h => h.otherShareholder).filter(Boolean);
    if (holders.some(h => h!.nzbn ? h!.nzbn === ownerNzbn : normalise(h!.currentEntityName || '') === normalise(ownerName))) return 'current';
    // Missing/truncated allocations cannot establish cessation.
    return child?.['company-details']?.extensiveShareholding ? 'unverified' : 'former';
}

export const removedCompany = (data: { status?: string; entityStatusDescription?: string }) =>
    /removed|deregistered|dissolved|struck off|amalgamated|deleted/i.test(`${data.status || ''} ${data.entityStatusDescription || ''}`);
