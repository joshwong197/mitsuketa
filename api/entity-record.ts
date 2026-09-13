import type {VercelRequest,VercelResponse} from '@vercel/node';
import {checkRateLimit} from '../mcp/lib/rateLimit.js';
import {parseAddressHistory,parseDocumentLinks,parseShareholderHistory} from '../utils/registerEvidence.js';

export default async function handler(req:VercelRequest,res:VercelResponse) {
    res.setHeader('Cache-Control','private, max-age=300');
    if(req.method!=='GET')return res.status(405).json({error:'GET_required'});
    const number=req.query.companyNumber;
    if(typeof number!=='string'||!/^\d{1,10}$/.test(number))return res.status(400).json({error:'invalid_company_number'});
    if(!checkRateLimit(String(req.headers['x-forwarded-for']||'unknown'),'entity-record',30).allowed)return res.status(429).json({error:'rate_limited'});
    const tabs=['addresses','shareholdings','documents'] as const;
    const results=await Promise.allSettled(tabs.map(async tab=>{
        const response=await fetch(`https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/${number}/${tab}`,{signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new Error('Register unavailable');
        const html=await response.text();if(html.length>4_000_000)throw new Error('Register page too large');
        return tab==='addresses'?parseAddressHistory(html):tab==='shareholdings'?parseShareholderHistory(html):parseDocumentLinks(html);
    }));
    return res.status(200).json({
        historicalAddresses:results[0].status==='fulfilled'?results[0].value:[],
        historicalShareholders:results[1].status==='fulfilled'?results[1].value:[],
        ...(results[2].status==='fulfilled'?results[2].value:{documents:[],limited:false}),
        unavailable:tabs.filter((_,i)=>results[i].status==='rejected'),retrievedAt:new Date().toISOString(),
    });
}
