import type {ApiConfig} from '../types';
import {fetchEntityDetails} from './apiService';
import {asText,cachedEntityProfile,cacheEntityProfile,rememberEntityProfile,type EntityProfile} from './entityProfile';

type Listener=(profile:EntityProfile)=>void;
const pending=new Map<string,{request:Promise<EntityProfile>;listeners:Set<Listener>;latest?:EntityProfile}>();
// onProgress gets the record as each piece lands (NZBN core first, then history,
// documents and summary reports); historyCheckedAt stays empty until all are in.
export function loadEntityRecord(nzbn:string,config:ApiConfig,refresh=false,onProgress?:Listener) {
    const key=`${nzbn}:${refresh}`;
    let entry=pending.get(key);
    if(!entry){
        const listeners=new Set<Listener>();
        const created:{request?:Promise<EntityProfile>;listeners:Set<Listener>;latest?:EntityProfile}={listeners};
        created.request=fetchRecord(nzbn,config,refresh,p=>{created.latest=p;listeners.forEach(l=>l(p));}).finally(()=>pending.delete(key));
        entry=created as {request:Promise<EntityProfile>;listeners:Set<Listener>;latest?:EntityProfile};
        pending.set(key,entry);
    }
    if(onProgress){entry.listeners.add(onProgress);if(entry.latest)onProgress(entry.latest);}
    return entry.request;
}
async function fetchRecord(nzbn:string,config:ApiConfig,refresh:boolean,emit:Listener) {
    const cached=!refresh&&cachedEntityProfile(nzbn);
    const profile=cached||rememberEntityProfile(await fetchEntityDetails(nzbn,config));
    if(profile.historyCheckedAt&&!refresh)return profile;
    const result={...profile,historyIssues:[] as string[],historyCheckedAt:''};
    const update=()=>emit({...result,historyIssues:[...result.historyIssues]});
    update();
    const tasks=[(async()=>{
        try {
            const r=await fetch(`/api/proxy?path=${encodeURIComponent(`/nzbn/v5/entities/${nzbn}/history/entity-names`)}`,{headers:{'x-api-type':'nzbn','x-user-api-key':config.nzbnKey||''},signal:AbortSignal.timeout(12000)});
            if(!r.ok)throw new Error();const rows=await r.json();if(!Array.isArray(rows))throw new Error();
            result.formerNames=rows.map(row=>({name:asText(row.entityName||row.name),startDate:asText(row.startDate),endDate:asText(row.endDate)})).filter(row=>row.name&&row.name!==profile.name);
        } catch { result.historyIssues.push('Former-name history could not be retrieved.'); }
        update();
    })()];
    tasks.push((async()=>{
        try {
            const r=await fetch(`/api/proxy?path=${encodeURIComponent(`/nzbn/v5/entities/${nzbn}/history/entity-statuses`)}`,{headers:{'x-api-type':'nzbn','x-user-api-key':config.nzbnKey||''},signal:AbortSignal.timeout(12000)});
            if(!r.ok)throw new Error();const rows=await r.json();if(!Array.isArray(rows))throw new Error();
            result.statusHistory=rows.map(row=>({status:asText(row.entityStatusDescription),startDate:asText(row.startDate),endDate:asText(row.endDate)})).filter(row=>row.status).sort((a,b)=>a.startDate.localeCompare(b.startDate));
        } catch { result.historyIssues.push('Status history could not be retrieved.'); }
        update();
    })());
    if(profile.documentSource.kind!=='none'&&profile.number)tasks.push((async()=>{
        try {
            const params=new URLSearchParams({sourceRegister:profile.source,registerNumber:profile.number});
            // Refresh skips the browser and CDN copies of the register scrape.
            const r=await fetch(`/api/entity-record?${params}${refresh?`&fresh=${Date.now()}`:''}`,{signal:AbortSignal.timeout(15000)});
            if(!r.ok)throw new Error();const extra=await r.json();
            if(!Array.isArray(extra.documents)||typeof extra.documentsStatus!=='string')throw new Error();
            if(profile.isCompany&&!extra.unavailable?.includes('addresses'))result.historicalAddresses=Array.isArray(extra.historicalAddresses)?extra.historicalAddresses:[];
            if(profile.isCompany)result.historicalShareholders=Array.isArray(extra.historicalShareholders)?extra.historicalShareholders:[];
            result.documents=extra.documents;result.documentsLimited=extra.limited===true;
            result.documentsStatus=extra.documentsStatus;
            result.documentsStatusNote=asText(extra.documentsStatusNote);
            if(extra.documentsSource&&typeof extra.documentsSource==='object')result.documentSource=extra.documentsSource;
            for(const kind of extra.unavailable||[])result.historyIssues.push(`${profile.documentSource.label} ${kind} could not be retrieved.`);
            update();
            const filings=(Array.isArray(extra.summaryFilings)?extra.summaryFilings:[]).filter((f:any)=>/^\d+$/.test(String(f?.id)));
            result.insolvencySummaries=[];
            await Promise.all(filings.map(async(f:any)=>{
                try{
                    const response=await fetch(`/api/entity-record?${params}&filing=${f.id}`,{signal:AbortSignal.timeout(12000)});
                    if(!response.ok)throw new Error();const {summary}=await response.json();if(!summary)throw new Error();
                    result.insolvencySummaries=[...result.insolvencySummaries,summary].sort((a,b)=>Date.parse(b.filed)-Date.parse(a.filed));
                }catch{result.historyIssues.push(`Summary report${f.date?` filed ${f.date}`:''} could not be retrieved.`);}
                update();
            }));
        }catch {
            result.documentsStatus='unavailable';
            result.documentsStatusNote=`${profile.documentSource.label} could not be reached.`;
            result.historyIssues.push(`${profile.documentSource.label} history and document links could not be retrieved.`);
        }
    })());
    await Promise.all(tasks);result.historyCheckedAt=new Date().toISOString();
    return cacheEntityProfile(result);
}
