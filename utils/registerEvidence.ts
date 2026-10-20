import * as cheerio from 'cheerio';

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
const withoutLabel = ($: cheerio.CheerioAPI, row: any) => { const copy=$(row).clone();copy.find('label').remove();return clean(copy.text()); };
export function parseAddressHistory(html: string) {
    const $=cheerio.load(html);
    if (!$('#addressPanel').length) throw new Error('Address page unavailable');
    const addresses: {type:string;text:string;startDate:string;endDate:string}[]=[];
    let type='Business address';
    $('#addressPanel .historic .row').each((_,row)=>{
        if ($(row).hasClass('panelNote')) return;
        const label=clean($(row).find('label').first().text()).replace(/:$/,'');
        if(label)type=label;
        const text=withoutLabel($,row); if(!text)return;
        const dates=clean($(row).nextAll('.panelNote').first().text());
        const match=dates.match(/Effective from:\s*(.*?)\s*Effective to:\s*(.*)/i);
        addresses.push({type,text,startDate:match?.[1]||'',endDate:match?.[2]||''});
    });
    return addresses;
}
export function parseShareholderHistory(html:string) {
    const $=cheerio.load(html);
    if(!$('#shareholdersPanel').length)throw new Error('Shareholding page unavailable');
    return $('#shareholdersPanel .historic .shareholder').map((_,row)=>({
        name:withoutLabel($,$(row).find('.legalName').closest('.row')),
        endDate:withoutLabel($,$(row).find('.vacationDate').closest('.row')),
    })).get().filter(r=>r.name);
}
export function parseDocumentLinks(html:string) {
    const $=cheerio.load(html);
    const table=$('table').filter((_,e)=>/Document Type/i.test($(e).find('th').text())).first();
    if(!table.length)throw new Error('Document list unavailable');
    let date='',filing='';
    const documents: {title:string;filing:string;date:string;size:string;url:string}[]=[];
    table.find('tr').each((_,row)=>{
        const cells=$(row).children('td');if(!cells.length)return;
        const nextDate=clean(cells.eq(0).text());
        if(nextDate){date=nextDate;filing=clean(cells.eq(1).text());}
        cells.find('a[href]').each((_,anchor)=>{
            let url:URL;try{url=new URL($(anchor).attr('href')!,'https://app.companiesoffice.govt.nz');}catch{return;}
            if(url.origin!=='https://app.companiesoffice.govt.nz'||!/^\/companies\/app\/service\/services\/documents\/[a-f0-9]+$/i.test(url.pathname)||url.search||url.hash)return;
            documents.push({title:clean($(anchor).text())||filing,filing,date,size:clean(cells.eq(2).text()),url:url.href});
        });
    });
    const selected=documents.slice(0,250);
    const latestConstitution=documents.find(document=>/constitution/i.test(`${document.filing} ${document.title}`));
    if(latestConstitution&&!selected.includes(latestConstitution))selected[selected.length-1]=latestConstitution;
    return {documents:selected,limited:documents.length>250};
}

// Liquidators Summary Reports are online forms (no PDF), listed on the documents
// page as showDocumentDetails(<filingId>). They keep the liquidator's name,
// licence and the outcome after the register stops publishing appointees.
export function parseSummaryReportFilings(html:string) {
    const $=cheerio.load(html);
    return $('a[href^="javascript:showDocumentDetails("]').map((_,a)=>({
        id:($(a).attr('href')!.match(/\((\d+)\)/)||[])[1]||'',title:clean($(a).text()),date:clean($(a).closest('tr').children('td').first().text()),
    })).get().filter(f=>f.id&&/summary report/i.test(f.title));
}
const money=(s:string)=>{const n=Number(s.replace(/[^0-9.-]/g,''));return s.trim()&&Number.isFinite(n)?n:null;};
export type InsolvencySummary=ReturnType<typeof parseSummaryReport>;
export function parseSummaryReport(html:string) {
    const $=cheerio.load(html);
    if(!/summary report/i.test($('body').text()))throw new Error('Summary report unavailable');
    // Labelled read-only fields in page order; an empty label continues the previous field.
    const fields:[string,string][]=[];
    $('label').each((_,l)=>{
        const key=clean($(l).text()).replace(/:$/,'');
        const parent=$(l).parent();const copy=parent.clone();copy.find('label').remove();const value=clean(copy.text());
        if(key)fields.push([key,value]);else if(value&&fields.length)fields[fields.length-1][1]+=`\n${value}`;
    });
    const get=(key:string)=>fields.find(([k])=>k.toLowerCase()===key.toLowerCase())?.[1]||'';
    const appointees:{name:string;appointed:string;registration:string}[]=[];
    for(const [k,v] of fields){
        if(k==='Name')appointees.push({name:v,appointed:'',registration:''});
        else if(appointees.length&&/^Appointment date/i.test(k))appointees[appointees.length-1].appointed=v;
        else if(appointees.length&&/^Registration number/i.test(k))appointees[appointees.length-1].registration=v;
    }
    const [presenterName,presenterFirm]=(get('Presenter').split('\n')[0].match(/^(.*?)\s*\(\s*(.*?)\s*\)\s*$/)||[,get('Presenter').split('\n')[0],'']).slice(1) as string[];
    const rows=(i:number)=>$('table').eq(i).find('tr').map((_,tr)=>[$(tr).children('td,th').map((_,c)=>clean($(c).text())).get()]).get() as string[][];
    const payments=rows(0), row=(label:RegExp)=>payments.find(r=>label.test(r[0]))?.slice(1).map(money)||[];
    const paid=row(/amount paid/i),rate=row(/rate of payment/i),owed=row(/remaining amounts owed/i);
    const creditors=['Preferential','Secured','Unsecured'].map((name,i)=>({name,paid:paid[i]??null,centsInDollar:rate[i]??null,owed:owed[i]??null}));
    const recoveries=rows(1).filter(r=>r.length>=2&&r[0]&&!/^total/i.test(r[0])).map(r=>({label:r[0].replace(/\s*\(e\.g\..*\)$/,''),amount:money(r[r.length-1])}));
    const fees=rows(2).find(r=>/grand total/i.test(r[0]))?.slice(1).map(money)||[];
    return {
        filed:get('Registration Date and Time'),
        presenter:{name:presenterName||'',firm:presenterFirm||'',address:get('Presenter').split('\n').slice(1).filter(l=>!/^new zealand$/i.test(l)).join(', ')},
        appointees,start:get('Liquidation start date and time'),end:get('Liquidation end date and time'),
        method:[get('Subsection'),get('Paragraph')].filter(Boolean).join(' · '),
        reasons:get('Reasons for liquidation').split('\n').filter(Boolean),
        solvency:get('Was this a solvent or insolvent liquidation?'),
        creditors,recoveries,recoveriesTotal:recoveries.reduce((sum,r)=>sum+(r.amount||0),0),
        fees:fees.reduce<number>((sum,f)=>sum+(f||0),0),email:get('Email address of the practitioner filing the report'),
    };
}

