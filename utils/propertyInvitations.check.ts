import assert from 'node:assert/strict';
import { createInvitationService } from './propertyInvitations';
import { createApplicationsHandler } from '../api/property-applications';
import { AccessError, NOTICE_VERSION, type Member } from './propertyAccount';
process.env.PROPERTY_AUTH_MODE = 'clerk';
process.env.PROPERTY_APP_ORIGIN = 'http://localhost:3000';
process.env.CLERK_AUTHORIZED_PARTIES = 'http://localhost:3000';
process.env.CLERK_ISSUER = 'test-issuer';
const actor: Member = { id: 'reviewer', searcher: 'admin@example.test', issuer: 'test-issuer', subject: 'admin', canAudit: true, status: 'approved', accepted_notice_version: NOTICE_VERSION };
const id = '00000000-0000-4000-8000-000000000001';
let row: any, sends = 0, revoked = 0, writes = 0, failAfterSend = false, pending: any[] = [], existing: any[] = [], legacy = false;
const reset = () => { row = { id, issuer: actor.issuer, email: 'invite@example.test', status: 'pending', invitation_state: 'none' }; sends=0; revoked=0; writes=0; failAfterSend=false; pending=[]; existing=[]; legacy=false; };
const query: any = async (sql: string, params: any[]) => {
    writes++;
    if (sql.startsWith('UPDATE property_application SET send_lease_until=now()')) return row.status === 'pending' || row.status === 'approved' ? [{...row}] : [];
    if (sql.startsWith('SELECT auth_subject')) return legacy ? [{ auth_subject: null, auth_issuer: null }] : [];
    if (sql.startsWith('WITH changed')) { Object.assign(row, { status:'approved', invite_nonce:params[3],expected_subject:params[4],invitation_state:'sending' }); return [{...row}]; }
    if (sql.includes("invitation_state='sent'")) { Object.assign(row, {invitation_id:params[2],invitation_state:'sent'}); return [{id}]; }
    if (sql.includes("invitation_state='failed'")) row.invitation_state='failed';
    return [];
};
const clerk: any = () => ({ users: {getUserList: async()=>({totalCount:existing.length,data:existing})}, invitations: {
    getInvitationList: async()=>({data:pending}),
    createInvitation: async(p: any)=>{sends++; assert.equal(p.redirectUrl,'http://localhost:3000/?access=invite'); assert.equal(p.notify,true);
        const invitation={id:'invite-'+sends,emailAddress:p.emailAddress,publicMetadata:p.publicMetadata}; pending.push(invitation);
        if(failAfterSend)throw new Error('Response lost after delivery'); return invitation;},
    revokeInvitation:async()=>{revoked++;pending=[];},
} });
const invite=createInvitationService(query,clerk);
reset(); await assert.rejects(()=>invite(id,{...actor,canAudit:false}),AccessError); assert.equal(writes,0);
reset(); process.env.PROPERTY_APP_ORIGIN='https://evil.example'; await assert.rejects(()=>invite(id,actor),AccessError); assert.equal(writes,0); process.env.PROPERTY_APP_ORIGIN='http://localhost:3000';
reset(); await invite(id,actor); assert.equal(sends,1); assert.equal(row.invitation_state,'sent'); const nonce=row.invite_nonce;
await invite(id,actor); assert.equal(sends,1);
await invite(id,actor,true); assert.equal(sends,2); assert.equal(revoked,1); assert.notEqual(row.invite_nonce,nonce);
reset(); failAfterSend=true; await assert.rejects(()=>invite(id,actor),AccessError); assert.equal(row.invitation_state,'failed');
failAfterSend=false; await invite(id,actor); assert.equal(sends,1); assert.equal(row.invitation_state,'sent');
reset(); legacy=true; await assert.rejects(()=>invite(id,actor),AccessError); assert.equal(sends,0);
reset(); existing=[{id:'existing-user',banned:false,locked:false}]; await invite(id,actor); assert.equal(row.expected_subject,'existing-user');
reset(); row.status='revoked'; await assert.rejects(()=>invite(id,actor),AccessError); assert.equal(sends,0);

let signedIn=false, publicWrites=0;
const handler=createApplicationsHandler({query:async()=>{publicWrites++;return [];},member:async()=>{
    if(!signedIn)throw new AccessError(401,'unauthorised','Sign in.'); return {...actor,canAudit:false};
}});
const request=async(mode: string,body?: any,origin='http://localhost:3000')=>{
    const res:any={code:200,setHeader(){},status(c:number){this.code=c;return this;},json(b:any){this.body=b;return this;}};
    await handler({method:body?'POST':'GET',headers:{origin},query:{mode},body} as any,res);return res;
};
const application={email:'new@example.test',organisation:'',purpose:'Property diligence',noticeVersion:NOTICE_VERSION};
assert.equal((await request('apply',application,'https://evil.example')).code,403); assert.equal(publicWrites,0);
assert.equal((await request('apply',{...application,noticeVersion:'old'})).code,400); assert.equal(publicWrites,0);
assert.equal((await request('apply',application)).code,200); assert.equal(publicWrites,1);
assert.equal((await request('list')).code,401); signedIn=true;
assert.equal((await request('invite',{applicationId:id})).code,403); assert.equal(publicWrites,1);
console.log('PASS: public application/origin/notice/admin gates; trusted redirect; duplicate send; ambiguous delivery retry; resend rotation; legacy collision; existing identity; revoked grant');
