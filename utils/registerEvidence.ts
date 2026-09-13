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
