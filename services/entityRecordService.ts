import type {ApiConfig} from '../types';
import {fetchEntityDetails} from './apiService';
import {asText,cachedEntityProfile,cacheEntityProfile,rememberEntityProfile} from './entityProfile';

const pending=new Map<string,Promise<ReturnType<typeof rememberEntityProfile>>>();
export function loadEntityRecord(nzbn:string,config:ApiConfig,refresh=false) {
    const key=`${nzbn}:${refresh}`;
    const existing=pending.get(key);if(existing)return existing;
    const request=fetchRecord(nzbn,config,refresh).finally(()=>pending.delete(key));
    pending.set(key,request);return request;
}
async function fetchRecord(nzbn:string,config:ApiConfig,refresh=false) {
    const cached=!refresh&&cachedEntityProfile(nzbn);
    const profile=cached||rememberEntityProfile(await fetchEntityDetails(nzbn,config));
    if(profile.historyCheckedAt&&!refresh)return profile;
    const result={...profile,historyIssues:[] as string[]};
    const tasks=[(async()=>{
        try {
            const r=await fetch(`/api/proxy?path=${encodeURIComponent(`/nzbn/v5/entities/${nzbn}/history/entity-names`)}`,{headers:{'x-api-type':'nzbn','x-user-api-key':config.nzbnKey||''},signal:AbortSignal.timeout(12000)});
            if(!r.ok)throw new Error();const rows=await r.json();if(!Array.isArray(rows))throw new Error();
            result.formerNames=rows.map(row=>({name:asText(row.entityName||row.name),startDate:asText(row.startDate),endDate:asText(row.endDate)})).filter(row=>row.name&&row.name!==profile.name);
        } catch { result.historyIssues.push('Former-name history could not be retrieved.'); }
    })()];
    if(profile.documentSource.kind!=='none'&&profile.number)tasks.push((async()=>{
        try {
            const params=new URLSearchParams({sourceRegister:profile.source,registerNumber:profile.number});
            const r=await fetch(`/api/entity-record?${params}`,{signal:AbortSignal.timeout(15000)});
            if(!r.ok)throw new Error();const extra=await r.json();
            if(!Array.isArray(extra.documents)||typeof extra.documentsStatus!=='string')throw new Error();
            if(profile.isCompany&&!extra.unavailable?.includes('addresses'))result.historicalAddresses=Array.isArray(extra.historicalAddresses)?extra.historicalAddresses:[];
            if(profile.isCompany)result.historicalShareholders=Array.isArray(extra.historicalShareholders)?extra.historicalShareholders:[];
            result.documents=extra.documents;result.documentsLimited=extra.limited===true;
            result.documentsStatus=extra.documentsStatus;
            result.documentsStatusNote=asText(extra.documentsStatusNote);
            if(extra.documentsSource&&typeof extra.documentsSource==='object')result.documentSource=extra.documentsSource;
            for(const kind of extra.unavailable||[])result.historyIssues.push(`${profile.documentSource.label} ${kind} could not be retrieved.`);
        }catch {
            result.documentsStatus='unavailable';
            result.documentsStatusNote=`${profile.documentSource.label} could not be reached.`;
            result.historyIssues.push(`${profile.documentSource.label} history and document links could not be retrieved.`);
        }
    })());
    await Promise.all(tasks);result.historyCheckedAt=new Date().toISOString();
    return cacheEntityProfile(result);
}
