import assert from 'node:assert/strict';
import {parseAddressHistory,parseShareholderHistory,parseDocumentLinks,parseSummaryReport,parseSummaryReportFilings} from './registerEvidence';

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
const empty=parseDocumentLinks(`<table><tr><th>Date</th><th>Document Type</th><th>Size</th></tr></table>`);
assert.deepEqual(empty,{documents:[],limited:false},'A supplied empty document table is distinguishable from an unavailable page');
for(const parser of [parseAddressHistory,parseShareholderHistory,parseDocumentLinks])assert.throws(()=>parser('<html>Unavailable</html>'));
const filings=parseSummaryReportFilings(`<table><tr><td>10 Jul 2025 09:49</td><td><a class="link" href="javascript:showDocumentDetails(38702343);">Liquidators Summary Report</a></td></tr>
<tr><td>1 Jan 2025</td><td><a href="javascript:showDocumentDetails(1);">Annual Return</a></td></tr></table>`);
assert.deepEqual(filings,[{id:'38702343',title:'Liquidators Summary Report',date:'10 Jul 2025 09:49'}],'Only summary report filings are picked up');
const summary=parseSummaryReport(`<body><div class="readonly"><label>Registration Date and Time</label>10 July 2025 09:49:09</div><div class="readonly"><label>Document Type</label>Liquidators Summary Report</div>
<div><label>Presenter</label>Pat EXAMPLE ( EXAMPLE ADVISORY )</div><div><label></label>1 Example Street</div><div><label></label>Auckland 1010</div><div><label></label>New Zealand</div>
<h2>Appointee details</h2><div class="readonly"><label>Name:</label>Pat EXAMPLE</div><div class="readonly"><label>Appointment date and time:</label>12 Dec 2024 10:57:00</div><div><label>Registration number:</label> IP130 </div>
<div class="readonly"><label>Name:</label>Sam SECOND</div><div class="readonly"><label>Appointment date and time:</label>13 Dec 2024 09:00:00</div>
<div class="readonly"><label>Reasons for liquidation:</label>Poor financial control</div><div><label></label>Legal action from creditors</div>
<div class="readonly"><label>Was this a solvent or insolvent liquidation?:</label>Insolvent</div>
<table><tr><th></th><th>Preferential creditors</th><th>Secured creditors</th><th>Unsecured creditors</th></tr><tr><td>Total amount paid to</td><td>0.00</td><td>1,000.00</td><td>0.00</td></tr>
<tr><td>Rate of payment (cents per dollar)</td><td>0.00</td><td>100.00</td><td>0.00</td></tr><tr><td>Remaining amounts owed to</td><td>4,500.00</td><td>0.00</td><td>226,000.00</td></tr></table>
<table><tr><td>Assets realised (e.g. sale of plant and machinery)</td><td>1,000.00</td></tr><tr><td>Other</td><td>0.00</td></tr></table>
<table><tr><td>Grand total of amount of fees</td><td>250.00</td><td>50.00</td></tr></table></body>`);
assert.deepEqual(summary.appointees.map(a=>[a.name,a.registration]),[['Pat EXAMPLE','IP130'],['Sam SECOND','']],'Each Name starts a new appointee');
assert.deepEqual(summary.presenter,{name:'Pat EXAMPLE',firm:'EXAMPLE ADVISORY',address:'1 Example Street, Auckland 1010'});
assert.deepEqual(summary.reasons,['Poor financial control','Legal action from creditors'],'Unlabelled rows continue the field above');
assert.deepEqual(summary.creditors.map(c=>[c.name,c.paid,c.owed]),[['Preferential',0,4500],['Secured',1000,0],['Unsecured',0,226000]]);
assert.equal(summary.recoveriesTotal,1000);assert.equal(summary.recoveries[0].label,'Assets realised');assert.equal(summary.fees,300);
assert.throws(()=>parseSummaryReport('<html>Unavailable</html>'));
console.log('PASS: history parsing, inherited labels, document grouping, safe source URLs, summary reports and unavailable-page handling');
