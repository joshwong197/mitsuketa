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
    if(profile.isCompany&&/^\d+$/.test(profile.number))tasks.push((async()=>{
        try {
            const r=await fetch(`/api/entity-record?companyNumber=${encodeURIComponent(profile.number)}`,{signal:AbortSignal.timeout(15000)});
            if(!r.ok)throw new Error();const extra=await r.json();
            if(!Array.isArray(extra.historicalAddresses)||!Array.isArray(extra.documents))throw new Error();
            if(!extra.unavailable?.includes('addresses'))result.historicalAddresses=extra.historicalAddresses;
            result.historicalShareholders=extra.historicalShareholders||[];
            result.documents=extra.documents;result.documentsLimited=extra.limited===true;
            for(const kind of extra.unavailable||[])result.historyIssues.push(`Companies Register ${kind} could not be retrieved.`);
        }catch {result.historyIssues.push('Companies Register history and document links could not be retrieved.');}
    })());
    await Promise.all(tasks);result.historyCheckedAt=new Date().toISOString();
    return cacheEntityProfile(result);
}
