import type {VercelRequest,VercelResponse} from '@vercel/node';
import {checkRateLimit} from '../mcp/lib/rateLimit.js';
import {parseAddressHistory,parseDocumentLinks,parseShareholderHistory} from '../utils/registerEvidence.js';
import { registerDocumentSource } from '../utils/registerDocumentSource.js';

export default async function handler(req:VercelRequest,res:VercelResponse) {
    res.setHeader('Cache-Control','private, max-age=300');
    if(req.method!=='GET')return res.status(405).json({error:'GET_required'});
    // `companyNumber` is retained for existing clients. Other public registers
    // use the explicit source/number pair so their document availability can be
    // reported without pretending that a Companies Register URL applies.
    const legacyCompanyNumber=req.query.companyNumber;
    const sourceRegister=typeof req.query.sourceRegister==='string'?req.query.sourceRegister:typeof legacyCompanyNumber==='string'?'COMPANY':'';
    const number=typeof req.query.registerNumber==='string'?req.query.registerNumber:legacyCompanyNumber;
    if(typeof number!=='string'||!/^[A-Za-z0-9-]{1,30}$/.test(number))return res.status(400).json({error:'invalid_register_number'});
    const documentSource=registerDocumentSource(sourceRegister,number);
    if(documentSource.kind==='none')return res.status(200).json({
        historicalAddresses:[],historicalShareholders:[],documents:[],limited:false,documentsStatus:'not_supported',
        documentsStatusNote:documentSource.note,documentsSource:documentSource,unavailable:[],retrievedAt:new Date().toISOString(),
    });
    if(!checkRateLimit(String(req.headers['x-forwarded-for']||'unknown'),'entity-record',30).allowed)return res.status(429).json({error:'rate_limited'});
    // The societies, charitable-trusts and limited-partnerships registers do
    // publish public documents, but do not document a stable record/PDF endpoint
    // that can be derived from a NZBN. Link their verified search screens instead.
    if(!documentSource.canFetchDocuments)return res.status(200).json({
        historicalAddresses:[],historicalShareholders:[],documents:[],limited:false,documentsStatus:'not_supported',
        documentsStatusNote:documentSource.note,documentsSource:documentSource,unavailable:[],retrievedAt:new Date().toISOString(),
    });
    const tabs=['addresses','shareholdings','documents'] as const;
    const loadTab=async(tab:typeof tabs[number])=>{
        const response=await fetch(`https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/${number}/${tab}`,{signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new Error('Register unavailable');
        const html=await response.text();if(html.length>4_000_000)throw new Error('Register page too large');
        return html;
    };
    const results=await Promise.allSettled([
        loadTab('addresses').then(parseAddressHistory),
        loadTab('shareholdings').then(parseShareholderHistory),
        loadTab('documents').then(parseDocumentLinks),
    ]);
    return res.status(200).json({
        historicalAddresses:results[0].status==='fulfilled'?results[0].value:[],
        historicalShareholders:results[1].status==='fulfilled'?results[1].value:[],
        ...(results[2].status==='fulfilled'?results[2].value:{documents:[],limited:false}),
        documentsStatus:results[2].status==='fulfilled'?(results[2].value.documents.length?'available':'empty'):'unavailable',
        documentsStatusNote:results[2].status==='fulfilled'?'':'The Companies Register document list could not be retrieved.',
        documentsSource:documentSource,
        unavailable:tabs.filter((_,i)=>results[i].status==='rejected'),retrievedAt:new Date().toISOString(),
    });
}
