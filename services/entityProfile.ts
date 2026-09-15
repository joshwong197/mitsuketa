// Deliberately project public business fields, not the entire NZBN payload.
// Personal role/shareholder addresses, bank accounts and GST identifiers stay out.
import { registerDocumentSource, registerDocumentSources, type DocumentStatus } from '../utils/registerDocumentSource.js';
export const asText = (value: unknown): string => typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
const list = (value: unknown): any[] => Array.isArray(value) ? value : [];
const numeric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
export const personName = (person: any): string => asText(person?.fullName) ||
    [person?.firstName, person?.middleNames || person?.middleName, person?.lastName].map(asText).filter(Boolean).join(' ');
export function registerLink(source: string, number: string): { label: string; url: string } {
    if (source === 'COMPANY' && /^\d+$/.test(number)) return { label: 'Companies Register', url: `https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/${number}` };
    if (source === 'I') return { label: 'Incorporated Societies Register', url: 'https://is-register.companiesoffice.govt.nz/' };
    if (source === 'T') return { label: 'Charitable Trusts Register', url: 'https://ct-register.companiesoffice.govt.nz/' };
    if (['Y', 'Z', 'LP', 'LimitedPartnershipNz', 'LimitedPartnershipOverseas'].includes(source)) return { label: 'Limited Partnerships Register', url: 'https://lp-register.companiesoffice.govt.nz/' };
    return { label: 'NZBN Register', url: 'https://www.nzbn.govt.nz/' };
}
export function normaliseEntityProfile(raw: any, retrievedAt = new Date().toISOString()) {
    const company = raw?.['company-details'];
    const nonCompany = raw?.['non-company-details'];
    const source = asText(raw?.sourceRegister);
    const number = asText(raw?.sourceRegisterUniqueIdentifier || raw?.sourceRegisterUniqueId);
    const totalShares = numeric(company?.shareholding?.numberOfShares);
    const allocations = list(company?.shareholding?.shareAllocation).map(allocation => ({
        shares: numeric(allocation.allocation),
        // Joint holders belong to ONE allocation; do not multiply its shares.
        holders: list(allocation.shareholder).map(holder => ({
            name: holder.individualShareholder ? personName(holder.individualShareholder) : asText(holder.otherShareholder?.currentEntityName),
            nzbn: asText(holder.otherShareholder?.nzbn),
            number: asText(holder.otherShareholder?.companyNumber),
        })),
    }));
    const roles = list(raw?.roles).map(role => ({
        name: role.rolePerson ? personName(role.rolePerson) : asText(role.roleEntity?.entityName || role.roleEntity?.name),
        role: asText(role.roleType) || 'Role not supplied', status: asText(role.roleStatus),
        startDate: asText(role.startDate), endDate: asText(role.endDate), nzbn: asText(role.roleEntity?.nzbn),
        historical: (!!role.endDate && Date.parse(role.endDate) <= Date.now()) || (!!role.roleStatus && asText(role.roleStatus).toLowerCase() !== 'active'),
    }));
    const current = (item: any) => !item.endDate || Date.parse(item.endDate) > Date.now();
    const addresses = list(raw?.addresses?.addressList).filter(current).map(address => ({
        type: asText(address.addressType) || 'Business address',
        text: [address.careOf, address.address1, address.address2, address.address3, address.address4, address.postCode, address.countryCode].map(asText).filter(Boolean).join(', '),
    })).filter(a => a.text);
    const websites = list(raw?.websites).filter(current).map(item => asText(item.url)).filter(url => {
        try { return ['https:', 'http:'].includes(new URL(url).protocol); } catch { return false; }
    });
    const charityNumber = asText(nonCompany?.charitiesNumber);
    const documentSources = registerDocumentSources(source, number, charityNumber);
    return {
        nzbn: asText(raw?.nzbn), name: asText(raw?.entityName), typeCode: asText(raw?.entityTypeCode),
        type: asText(raw?.entityTypeDescription), status: asText(raw?.entityStatusDescription), source, number,
        registered: asText(raw?.registrationDate), updated: asText(raw?.lastUpdatedDate), retrievedAt,
        register: registerLink(source, number), isCompany: source === 'COMPANY',
        addresses, websites,
        phones: list(raw?.phoneNumbers).filter(current).map(p => [p.phoneCountryCode ? `+${p.phoneCountryCode}` : '', p.phoneAreaCode, p.phoneNumber].map(asText).filter(Boolean).join(' ')).filter(Boolean),
        emails: list(raw?.emailAddresses).filter(current).map(e => asText(e.emailAddress)).filter(Boolean),
        tradingNames: list(raw?.tradingNames).filter(current).map(n => asText(n.name || n.tradingName)).filter(Boolean),
        industries: list(raw?.industryClassifications).map(i => [i.classificationCode || i.code, i.classificationDescription || i.description].map(asText).filter(Boolean).join(' · ')).filter(Boolean),
        annualMonth: numeric(company?.annualReturnFilingMonth ?? nonCompany?.annualReturnFilingMonth),
        annualFiled: asText(company?.annualReturnLastFiled), reportingMonth: numeric(company?.financialReportFilingMonth),
        constitution: typeof company?.hasConstitutionFiled === 'boolean' ? company.hasConstitutionFiled : null,
        country: asText(company?.countryOfOrigin || nonCompany?.countryOfOrigin),
        charityNumber, balanceDate: asText(nonCompany?.balanceDate),
        ultimateHolding: company?.ultimateHoldingCompany?.yn === false ? 'None declared' : asText(company?.ultimateHoldingCompany?.name),
        totalShares, extensive: company?.extensiveShareholding === true, allocations, roles,
        shareholdingSupplied: !!company?.shareholding,
        formerNames: [] as {name:string;startDate:string;endDate:string}[],
        historicalAddresses: list(raw?.addresses?.addressList).filter(a=>a.endDate && Date.parse(a.endDate)<=Date.now()).map(a=>({
            type:asText(a.addressType),text:[a.address1,a.address2,a.address3,a.address4,a.postCode,a.countryCode].map(asText).filter(Boolean).join(', '),startDate:asText(a.startDate),endDate:asText(a.endDate),
        })),
        historicalShareholders: [] as {name:string;endDate:string}[],
        documents: [] as {title:string;filing:string;date:string;size:string;url:string}[],
        documentSource: registerDocumentSource(source, number, charityNumber), documentSources,
        documentsStatus: 'not_checked' as DocumentStatus, documentsStatusNote: '', documentsLimited:false,historyIssues:[] as string[],historyCheckedAt:'',
    };
}
export type EntityProfile = ReturnType<typeof normaliseEntityProfile>;

// Session memory only: reuse the graph's record; never persist raw register data.
const cache = new Map<string, EntityProfile>();
export function rememberEntityProfile(raw: unknown): EntityProfile {
    const profile = normaliseEntityProfile(raw);
    if (cache.size >= 100) cache.clear();
    cache.set(profile.nzbn, profile);
    return profile;
}
export function cachedEntityProfile(nzbn: string) {
    const profile = cache.get(nzbn);
    return profile && Date.now() - Date.parse(profile.retrievedAt) < 300000 ? profile : null;
}
export function cacheEntityProfile(profile:EntityProfile) { if(cache.size>=100&&!cache.has(profile.nzbn))cache.clear();cache.set(profile.nzbn,profile); return profile; }
