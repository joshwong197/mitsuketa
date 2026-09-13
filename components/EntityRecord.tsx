import React, {useId} from 'react';
import type {EntityProfile} from '../services/entityProfile';

export const registerDate=(date:string)=>{
    const m=date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m?`${m[3]} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m[2])-1]} ${m[1]}`:date||'Not supplied';
};
const month=(n:number|null)=>n&&n>=1&&n<=12?['January','February','March','April','May','June','July','August','September','October','November','December'][n-1]:'Not supplied';
const addressType=(t:string)=>({REGISTERED:'Registered office',SERVICE:'Address for service',POSTAL:'Postal address',RECORDS:'Address for records'}[t]||t);
const Facts=({rows}:{rows:[string,React.ReactNode][]})=><dl className="entity-facts">{rows.map(([name,value])=><React.Fragment key={name}><dt>{name}</dt><dd>{value||'Not supplied'}</dd></React.Fragment>)}</dl>;
const Roles=({roles}:{roles:EntityProfile['roles']})=><div className="entity-people">{roles.map((r,i)=><div className="entity-person" key={i}><span className="entity-person-mark" aria-hidden="true">人</span><div><strong>{r.name||'Name not supplied'}</strong><p>{r.role} · {r.status||'Status not supplied'}</p><small>From {registerDate(r.startDate)}{r.endDate?` · To ${registerDate(r.endDate)}`:''}</small></div></div>)}</div>;

export function EntityRecord({profile,onRefresh}:{profile:EntityProfile;onRefresh?:()=>void}) {
    const id=useId();
    const currentRoles=profile.roles.filter(r=>!r.historical);
    const historicRoles=profile.roles.filter(r=>r.historical);
    const documents=profile.documents||[];
    const registerDocumentsUrl=profile.isCompany&&/^\d+$/.test(profile.number)?`${profile.register.url}/documents`:profile.register.url;
    const constitutionDocument=profile.constitution===true?documents.find(d=>/constitution/i.test(`${d.filing} ${d.title}`)):undefined;
    const constitutionValue=profile.constitution===null?'Not supplied':profile.constitution
        ?constitutionDocument?<a href={constitutionDocument.url} target="_blank" rel="noreferrer">Yes · view latest filing ↗</a>:'Yes'
        :'No';
    const docList=(items:typeof documents)=><ul className="entity-documents">{items.map((d,i)=><li key={i}><div><time>{d.date||'Date not supplied'}</time><a href={d.url} target="_blank" rel="noreferrer">{d.title}<span aria-hidden="true"> ↗</span></a>{d.filing&&d.filing!==d.title&&<small>{d.filing}</small>}</div><span>{d.size}</span></li>)}</ul>;
    return <article className="entity-record">
        <header className="entity-card">
            <div className="entity-card-spine" aria-hidden="true"><span>記録</span><small>見つけた</small></div>
            <div className="entity-card-main">
                <div className="entity-card-top"><span>Mitsuketa · Entity record</span><span className="entity-status">{profile.status||'Status not supplied'}</span></div>
                <h3>{profile.name}</h3>
                <p className="entity-type">{profile.type||'Entity type not supplied'} · {profile.status||'Status not supplied'}</p>
                <div className="entity-identifiers"><span>NZBN <strong>{profile.nzbn}</strong></span><span>Register no. <strong>{profile.number||'Not supplied'}</strong></span></div>
                <div className="entity-card-bottom"><span>Registered <strong>{registerDate(profile.registered)}</strong></span><div className="entity-card-actions"><a aria-label={`Open ${profile.register.label}`} href={profile.register.url} target="_blank" rel="noreferrer">Open {profile.register.label} ↗</a>{constitutionDocument&&<a className="entity-constitution-link" href={constitutionDocument.url} target="_blank" rel="noreferrer">View constitution ↗</a>}</div></div>
            </div>
        </header>
        <div className="entity-at-a-glance" aria-label="Record at a glance">
            <div><strong>{currentRoles.length}</strong><span>Current roles supplied</span></div>
            {profile.isCompany?<><div><strong>{profile.allocations.length}</strong><span>Share allocations supplied</span></div><div><strong>{profile.totalShares===null?'—':profile.totalShares.toLocaleString('en-NZ')}</strong><span>Total issued shares</span></div></>:<div><strong>{profile.addresses.length}</strong><span>Business addresses supplied</span></div>}
        </div>
        <nav className="entity-record-index" aria-label="Record sections">{[['identity','一','Business'],['people','二','People'],['ownership','三','Ownership'],['documents','四','Documents']].map(([key,mark,label])=><button key={key} onClick={()=>document.getElementById(`${id}-${key}`)?.scrollIntoView({block:'start'})}><span aria-hidden="true">{mark}</span>{label}</button>)}</nav>
        <div className="entity-record-grid">
            <section id={`${id}-identity`} className="entity-record-section entity-business">
                <header><span aria-hidden="true">一</span><div><p>Identity & place</p><h4>Business record</h4></div></header>
                {!!profile.formerNames?.length&&<details className="entity-history"><summary>Former names ({profile.formerNames.length})</summary>{profile.formerNames.map((n,i)=><p key={i}><strong>{n.name}</strong><br/><small>{n.startDate&&`From ${registerDate(n.startDate)}`}{n.endDate&&` · To ${registerDate(n.endDate)}`}</small></p>)}</details>}
                <Facts rows={[
                    ['Country of origin',profile.country],['Trading names',profile.tradingNames.join(', ')],['Industry',profile.industries.join(', ')],
                    ['Annual return month',month(profile.annualMonth)],
                    ...(profile.isCompany?[
                        ['Last annual return',registerDate(profile.annualFiled)],['Financial reporting month',month(profile.reportingMonth)],
                        ['Constitution filed',constitutionValue],['Ultimate holding company',profile.ultimateHolding],
                    ] as [string,React.ReactNode][]:[['Charity number',profile.charityNumber],['Balance date',registerDate(profile.balanceDate)]] as [string,React.ReactNode][]),
                ]}/>
                <h5>Business addresses & contact</h5>
                {profile.addresses.map((a,i)=><div key={i} className="entity-address"><strong>{addressType(a.type)}</strong><p>{a.text}</p></div>)}
                {!profile.addresses.length&&<p>No public business addresses supplied in this response.</p>}
                <Facts rows={[
                    ['Website',profile.websites.length?profile.websites.map(url=><a key={url} href={url} target="_blank" rel="noreferrer">{url}</a>):null],['Phone',profile.phones.join(', ')],['Email',profile.emails.join(', ')],
                ]}/>
                {!!profile.historicalAddresses?.length&&<details className="entity-history"><summary>Historical addresses ({profile.historicalAddresses.length})</summary>{profile.historicalAddresses.map((a,i)=><div key={i} className="entity-address"><strong>{addressType(a.type)}</strong><p>{a.text}</p><small>From {registerDate(a.startDate)} · To {registerDate(a.endDate)}</small></div>)}</details>}
            </section>
            <section id={`${id}-people`} className="entity-record-section">
                <header><span aria-hidden="true">二</span><div><p>The people</p><h4>Directors & other roles</h4></div><strong className="entity-section-count">{currentRoles.length}</strong></header>
                {!profile.roles.length&&<p>No public roles supplied in this NZBN response.</p>}
                <Roles roles={currentRoles}/>
                {!!historicRoles.length&&<details className="entity-history"><summary>Historical appointments ({historicRoles.length})</summary><Roles roles={historicRoles}/></details>}
                {!profile.isCompany&&<p className="entity-coverage">NZBN role coverage varies by entity type. Missing roles do not establish that none exist.</p>}
            </section>
            <section id={`${id}-ownership`} className="entity-record-section">
                <header><span aria-hidden="true">三</span><div><p>Ownership</p><h4>{profile.isCompany?'Shares & holders':'Relationship coverage'}</h4></div></header>
                {profile.totalShares!==null&&<p>Total shares: {profile.totalShares.toLocaleString('en-NZ')}</p>}
                {profile.extensive&&<p className="entity-coverage">Extensive shareholding: the supplied allocations cover the register’s largest parcels. They are not a complete list of beneficial owners.</p>}
                {!profile.allocations.length&&<p>{profile.isCompany?'No share allocations supplied in this response.':'Company shareholdings are not supplied for this entity. Its officers, trustees or partners are shown as roles where available.'}</p>}
                {profile.allocations.map((a,i)=>{const percent=a.shares!==null&&profile.totalShares?100*a.shares/profile.totalShares:null;return <div className="entity-allocation" key={i}>
                    <div><strong>{a.holders.map(h=>h.name||'Name not supplied').join(' + ')||'Holder not supplied'}</strong><span>{percent===null?'—':`${percent.toLocaleString('en-NZ',{maximumFractionDigits:2})}%`}</span></div>
                    <p>{a.shares===null?'Share count not supplied':`${a.shares.toLocaleString('en-NZ')} shares`}{a.holders.length>1?' · Joint allocation':''}</p>
                    {percent!==null&&<div className="entity-share-track" aria-hidden="true"><i style={{width:`${Math.min(100,Math.max(0,percent))}%`}}/></div>}
                </div>;})}
                {!!profile.historicalShareholders?.length&&<details className="entity-history"><summary>Historical shareholders ({profile.historicalShareholders.length})</summary><p className="entity-coverage">Names and cessation dates supplied by the Companies Register. Historic parcel sizes are not supplied here; this is not a complete ownership timeline.</p>{profile.historicalShareholders.map((h,i)=><p key={i}><strong>{h.name}</strong><br/><small>Ceased {registerDate(h.endDate)}</small></p>)}</details>}
            </section>
            <section id={`${id}-documents`} className="entity-record-section entity-document-section">
                <header><span aria-hidden="true">四</span><div><p>The paper trail</p><h4>Documents & filings</h4></div><strong className="entity-section-count">{documents.length}</strong></header>
                <p className="entity-coverage">Links open the source register’s files. PDFs are not included in this record. Annual returns and shareholding filings can help with historical checks.</p>
                {docList(documents.slice(0,12))}
                {documents.length>12&&<details className="entity-history"><summary>More documents ({documents.length-12})</summary>{docList(documents.slice(12))}</details>}
                {!documents.length&&<p>No document links were returned for this record. Check the source register for available filings.</p>}
                {profile.documentsLimited&&<p>Showing 250 document links; the latest constitution filing is retained when available.</p>}
                <a className="entity-source-link" href={registerDocumentsUrl} target="_blank" rel="noreferrer">Browse {profile.register.label} documents ↗</a>
                {(profile.charityNumber||/trust|charit/i.test(profile.type))&&<p><a href="https://register.charities.govt.nz/CharitiesRegister/CharityAdvancedSearch.aspx" target="_blank" rel="noreferrer">Check the Charities Register ↗</a> for charity registration, officers and annual reports. A trust name alone does not establish charity registration.</p>}
            </section>
        </div>
        <footer className="entity-provenance"><div><p>Core record · NZBN API · {profile.source||'Source not supplied'}</p><p>Record updated {registerDate(profile.updated)} · Retrieved {new Date(profile.retrievedAt).toLocaleString('en-NZ')}</p>
            {profile.historyCheckedAt&&<p>History & document links checked {new Date(profile.historyCheckedAt).toLocaleString('en-NZ')}. Former names: NZBN; company address/shareholder history and documents: Companies Register.</p>}
            {profile.historyIssues?.map(issue=><p key={issue}>{issue}</p>)}</div>{onRefresh&&<button onClick={onRefresh}>Refresh from register ↻</button>}</footer>
    </article>;
}
