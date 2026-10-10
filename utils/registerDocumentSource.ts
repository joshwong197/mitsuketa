export type DocumentStatus = 'not_checked' | 'available' | 'empty' | 'unavailable' | 'not_supported';

export type RegisterDocumentSource = {
    kind: 'companies' | 'incorporated-societies' | 'charitable-trusts' | 'limited-partnerships' | 'charities' | 'none';
    label: string;
    browseUrl: string;
    canFetchDocuments: boolean;
    note: string;
};

const NZBN = 'https://www.nzbn.govt.nz/';
const NONE: RegisterDocumentSource = {
    kind: 'none', label: 'Source register', browseUrl: NZBN, canFetchDocuments: false,
    note: 'No public document register was identified from this NZBN record.',
};

// These are official public search routes. The Companies Office documents are
// fetched only where its documented public page has a stable document URL.
// Other registers publish documents through their interactive record screens;
// do not guess an entity or PDF route from a name or register number.
export function registerDocumentSources(source: string, number: string, charityNumber = ''): RegisterDocumentSource[] {
    const sources: RegisterDocumentSource[] = [];
    if (source === 'COMPANY' && /^\d+$/.test(number)) {
        sources.push({
            kind: 'companies', label: 'Companies Register',
            browseUrl: `https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/${number}/documents`,
            canFetchDocuments: true, note: 'Public Companies Register filing links.',
        });
    } else if (source === 'I') {
        sources.push({
            kind: 'incorporated-societies', label: 'Incorporated Societies Register',
            browseUrl: 'https://is-register.companiesoffice.govt.nz/', canFetchDocuments: false,
            note: 'Search the society by NZBN or incorporation number, then open its Filings tab.',
        });
    } else if (source === 'T') {
        sources.push({
            kind: 'charitable-trusts', label: 'Charitable Trusts Register',
            browseUrl: 'https://charitabletrusts.companiesoffice.govt.nz/', canFetchDocuments: false,
            note: 'Search the trust board by NZBN or incorporation number to view registered documents.',
        });
    } else if (['Y', 'Z', 'LP', 'LimitedPartnershipNz', 'LimitedPartnershipOverseas'].includes(source)) {
        sources.push({
            kind: 'limited-partnerships', label: 'Limited Partnerships Register',
            browseUrl: 'https://app.businessregisters.govt.nz/sber-master/service/create.html?dpl_SourceAppCode=sber-businesses&service=registerItemSearch',
            canFetchDocuments: false,
            note: 'Search by the limited partnership name, registration number or NZBN to view public filings.',
        });
    }
    if (/^CC\d+$/i.test(charityNumber.trim())) {
        sources.push({
            kind: 'charities', label: 'Charities Register',
            browseUrl: 'https://register.charities.govt.nz/CharitiesRegister/Search', canFetchDocuments: false,
            note: 'Search by the complete charity registration number to view public governing documents and annual reporting.',
        });
    }
    return sources.length ? sources : [NONE];
}

export function registerDocumentSource(source: string, number: string, charityNumber = ''): RegisterDocumentSource {
    return registerDocumentSources(source, number, charityNumber)[0];
}

export function sourceRegisterForDocumentKind(kind: RegisterDocumentSource['kind']): string {
    if (kind === 'companies') return 'COMPANY';
    if (kind === 'incorporated-societies') return 'I';
    if (kind === 'charitable-trusts') return 'T';
    if (kind === 'limited-partnerships') return 'LP';
    return '';
}
