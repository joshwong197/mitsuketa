import assert from 'node:assert/strict';
import {parseAddressHistory,parseShareholderHistory,parseDocumentLinks} from './registerEvidence';

const addresses=parseAddressHistory(`<div id="addressPanel"><div class="row">Current address must stay out</div><div class="historic">
<div class="row"><label>Registered office address:</label>10 Example Road</div><div class="row panelNote">Effective from: 1 Jan 2000 Effective to: 2 Feb 2010</div>
<div class="row"><label></label>20 Previous Road</div><div class="row panelNote">Effective from: 1 Jan 1990 Effective to: 1 Jan 2000</div></div></div>`);
assert.equal(addresses.length,2);assert.equal(addresses[1].type,'Registered office address');assert.equal(addresses[0].endDate,'2 Feb 2010');
const holders=parseShareholderHistory(`<div id="shareholdersPanel"><div class="historic"><div class="shareholder"><div class="row"><label class="legalName">Name:</label>Former Holder</div><div class="row"><label class="vacationDate">Ceased:</label>1 Jan 2000</div><div>Private residential address</div></div></div></div>`);
assert.deepEqual(holders,[{name:'Former Holder',endDate:'1 Jan 2000'}]);
const docs=parseDocumentLinks(`<table><tr><th>Date</th><th>Document Type</th><th>Size</th></tr>
<tr><td>1 Jan 2020</td><td><a href="javascript:showDocumentDetails(1)">Annual Return</a></td><td></td></tr>
<tr><td></td><td><a href="/companies/app/service/services/documents/ABC123">Attachment A</a><a href="https://evil.example/companies/app/service/services/documents/ABC123">Unsafe</a></td><td>12kb</td></tr>
<tr><td></td><td><a href="https://app.companiesoffice.govt.nz/companies/app/service/services/documents/DEF456">Attachment B</a></td><td>24kb</td></tr>
<tr><td>2 Jan 2020</td><td>Adoption of Constitution<a href="https://app.companiesoffice.govt.nz/companies/app/service/services/documents/C0A123">Adoption of Constitution</a></td><td>30kb</td></tr></table>`);
assert.equal(docs.documents.length,3);assert.equal(docs.documents[1].date,'1 Jan 2020');assert.equal(docs.documents[1].filing,'Annual Return');assert.equal(docs.documents[0].size,'12kb');
assert.match(docs.documents[2].title,/Constitution/);assert.match(docs.documents[2].url,/C0A123$/);
const manyRows=Array.from({length:251},(_,i)=>`<tr><td>${i}</td><td>Annual Return<a href="https://app.companiesoffice.govt.nz/companies/app/service/services/documents/${i.toString(16).padStart(8,'0')}">Annual Return</a></td><td>1kb</td></tr>`).join('');
const capped=parseDocumentLinks(`<table><tr><th>Date</th><th>Document Type</th><th>Size</th></tr>${manyRows}<tr><td>Historic</td><td>Adoption of Constitution<a href="https://app.companiesoffice.govt.nz/companies/app/service/services/documents/C0A999">Adoption of Constitution</a></td><td>30kb</td></tr></table>`);
assert.equal(capped.documents.length,250);assert.equal(capped.limited,true);assert.match(capped.documents.at(-1)!.title,/Constitution/);
for(const parser of [parseAddressHistory,parseShareholderHistory,parseDocumentLinks])assert.throws(()=>parser('<html>Unavailable</html>'));
console.log('PASS: history parsing, inherited labels, document grouping, safe source URLs and unavailable-page handling');
