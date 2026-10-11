import assert from 'node:assert/strict';
import { parseApplicationDetails } from './propertyApplicationDetails';
import { createApplicationsHandler } from '../api/property-applications';
import { NOTICE_VERSION } from './propertyAccount';

const details = {version:1,fullName:' Test Applicant ',role:'Researcher',use:'Research or public-interest work',volume:'Not sure yet',sharing:'Public reports, websites or other distribution',recipients:'Aggregated findings only\nNo names',safeguards:'Restricted folder; delete source reports after the project',confirmed:true};
assert.equal(parseApplicationDetails(details).fullName,'Test Applicant');
assert.equal(parseApplicationDetails(details).recipients,details.recipients);
for (const invalid of [null, {...details,version:2}, {...details,confirmed:'true'}, {...details,fullName:' '}, {...details,use:'anything'}, {...details,volume:'unlimited'}, {...details,sharing:'unknown'}, {...details,safeguards:'x'.repeat(1001)}, {...details,role:'bad\u0000role'}]) assert.throws(()=>parseApplicationDetails(invalid));
process.env.PROPERTY_AUTH_MODE='clerk';
process.env.CLERK_AUTHORIZED_PARTIES='http://localhost:3000';
process.env.CLERK_ISSUER='questionnaire-test';
let calls: {sql:string,params:unknown[]}[]=[];
const handler=createApplicationsHandler({query:async(sql,params=[])=>{calls.push({sql,params});return [];}});
async function submit(body:object,ip:string){
    const res:any={code:200,setHeader(){},status(code:number){this.code=code;return this;},json(body:unknown){this.body=body;return this;}};
    await handler({method:'POST',headers:{origin:'http://localhost:3000','x-forwarded-for':ip},query:{mode:'apply'},body} as any,res);
    return res;
}
const body={email:'APPLICANT@example.test',organisation:'',purpose:'Research\nUnderstand ownership',noticeVersion:NOTICE_VERSION,details};
assert.equal((await submit({...body,details:undefined},'test-missing')).code,400);
assert.equal(calls.length,0);
assert.equal((await submit(body,'test-valid')).code,200);
assert.equal(calls.length,1);
assert.equal(calls[0].params[1],'applicant@example.test');
assert.equal(JSON.parse(calls[0].params[5] as string).safeguards,details.safeguards);
assert.match(calls[0].sql,/ON CONFLICT\(issuer,email\) DO NOTHING/);
assert.equal((await submit({...body,purpose:'x'.repeat(1001)},'test-long')).code,400);
assert.equal(calls.length,1);
console.log('PASS: questionnaire validation, multiline answers, anonymous submission, stored review details, duplicate protection and invalid-input rejection');
