import assert from 'node:assert/strict';
import { registerDocumentSource, registerDocumentSources, sourceRegisterForDocumentKind } from './registerDocumentSource';

const company = registerDocumentSource('COMPANY', '12345');
assert.equal(company.kind, 'companies');
assert.equal(company.canFetchDocuments, true);
assert.match(company.browseUrl, /companies\/12345\/documents$/);
for (const [source, kind, host] of [
    ['I', 'incorporated-societies', 'is-register.companiesoffice.govt.nz'],
    ['T', 'charitable-trusts', 'charitabletrusts.companiesoffice.govt.nz'],
    ['LP', 'limited-partnerships', 'app.businessregisters.govt.nz'],
] as const) {
    const entry = registerDocumentSource(source, '12345');
    assert.equal(entry.kind, kind);
    assert.equal(entry.canFetchDocuments, false);
    assert.equal(new URL(entry.browseUrl).host, host);
}
const trustAndCharity = registerDocumentSources('T', '12345', 'CC12345');
assert.deepEqual(trustAndCharity.map(source => source.kind), ['charitable-trusts', 'charities']);
assert.equal(registerDocumentSource('Partnership', '123').kind, 'none');
assert.equal(sourceRegisterForDocumentKind('limited-partnerships'), 'LP');
console.log('PASS: official register document source routing and explicit unsupported retrieval states');
