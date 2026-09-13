import assert from 'node:assert/strict';
import { normaliseEntityProfile, registerLink, personName } from './entityProfile.js';
const profile = normaliseEntityProfile({
    nzbn: '123', entityName: 'EXAMPLE LIMITED', entityTypeCode: 'LTD', entityTypeDescription: 'NZ Limited Company',
    sourceRegister: 'COMPANY', sourceRegisterUniqueIdentifier: '12345', registrationDate: '2000-12-19T00:00:00+13:00',
    addresses: { addressList: [{ addressType: 'REGISTERED', address1: 'Business address' }, { address1: 'Old address', endDate: '2000-01-01' }] },
    websites: [{ url: 'javascript:alert(1)' }, { url: 'https://example.com' }],
    paymentBankAccounts: [{ account: 'bank-secret' }], gstNumbers: ['tax-secret'],
    roles: [{ roleType: 'Director', rolePerson: { firstName: 'Alex', middleNames: 'Taylor', lastName: 'Example' }, startDate: '2020-01-01', roleAddress: [{ address1: 'Personal address' }] }],
    'company-details': { hasConstitutionFiled: false, annualReturnFilingMonth: 6, extensiveShareholding: true,
        shareholding: { numberOfShares: 100, shareAllocation: [{ allocation: 40, shareholder: [
            { individualShareholder: { fullName: 'Joint Holder A', address1: 'Shareholder address' } },
            { individualShareholder: { fullName: 'Joint Holder B' } },
        ] }] } },
}, '2026-09-13T00:00:00Z');
assert.equal(profile.roles[0].name, 'Alex Taylor Example');
assert.equal(profile.constitution, false, 'False must not become unknown');
assert.equal(profile.allocations.length, 1, 'Joint holding stays a single allocation');
assert.equal(profile.allocations[0].shares, 40);
assert.equal(profile.allocations[0].holders.length, 2);
assert.deepEqual(profile.websites, ['https://example.com']);
assert.equal(profile.addresses.length, 1);
assert.equal(profile.register.url, 'https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/12345');
for (const excluded of ['bank-secret', 'tax-secret', 'Personal address', 'Shareholder address']) assert.ok(!JSON.stringify(profile).includes(excluded));
for (const [code, host] of [['I', 'is-register.companiesoffice.govt.nz'], ['T', 'ct-register.companiesoffice.govt.nz'], ['Y', 'lp-register.companiesoffice.govt.nz'], ['Trading_Trust', 'www.nzbn.govt.nz'], ['Partnership', 'www.nzbn.govt.nz']]) {
    const p = normaliseEntityProfile({ sourceRegister: code, sourceRegisterUniqueIdentifier: '12345', roles: [] });
    assert.equal(p.isCompany, false);
    assert.equal(new URL(p.register.url).host, host);
    assert.equal(p.totalShares, null);
    assert.equal(p.constitution, null);
}
assert.equal(new URL(registerLink('COMPANY', '../bad').url).host, 'www.nzbn.govt.nz');
assert.equal(personName({ firstName: 'Alex', middleName: 'Taylor', lastName: 'Example' }), 'Alex Taylor Example');
console.log('PASS: entity profile fields, source routing, joint allocations, safe URLs, unavailable vs false, and excluded personal/financial fields.');
