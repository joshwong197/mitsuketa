import {test,expect} from '@playwright/test';
import {pathToFileURL} from 'node:url';

for(const scope of ['simple','comprehensive'])test(`${scope} HTML includes an offline record and preserves its chart`,async({page,context},testInfo)=>{
    await page.goto('/#/app');
    const download=page.waitForEvent('download');
    await page.evaluate(async(scope)=>{
        const profileModule='/services/entityProfile.ts',exportModule='/services/exportService.ts';
        const {normaliseEntityProfile}=await import(/* @vite-ignore */ profileModule);
        const {downloadInteractiveGraphHtml}=await import(/* @vite-ignore */ exportModule);
        const record=normaliseEntityProfile({nzbn:'9429000000001',entityName:'EXAMPLE LIMITED',sourceRegister:'COMPANY',sourceRegisterUniqueIdentifier:'12345',entityStatusDescription:'Registered'});
        record.formerNames=[{name:'FORMER NAME LIMITED',startDate:'2000-01-01',endDate:'2010-01-01'}];
        record.historicalAddresses=[{type:'Registered office',text:'Former business address',startDate:'2000-01-01',endDate:'2010-01-01'}];
        record.historicalShareholders=[{name:'Former Holder',endDate:'2010-01-01'}];
        record.constitution=true;
        record.documents=[
            {title:'Annual return </script><script>window.injected=true</script>',filing:'Annual Return',date:'1 Jan 2020',size:'20kb',url:'https://app.companiesoffice.govt.nz/companies/app/service/services/documents/ABC123'},
            {title:'Adoption of Constitution',filing:'Adoption of Constitution',date:'2 Jan 2020',size:'30kb',url:'https://app.companiesoffice.govt.nz/companies/app/service/services/documents/C0A123'},
        ];
        await downloadInteractiveGraphHtml({title:record.name,nzbn:record.nzbn,record,nodes:[{id:record.nzbn,type:'companyNode',position:{x:0,y:0},data:{label:record.name,nzbn:record.nzbn,isTarget:true,isVisible:true,companySearchScope:scope}}],edges:[]});
    },scope);
    const file=testInfo.outputPath('record.html');await(await download).saveAs(file);
    const offline=await context.newPage();
    const external:string[]=[];offline.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
    await context.setOffline(true);
    await offline.goto(pathToFileURL(file).href);
    await expect(offline.locator('.react-flow__node')).toHaveCount(1);
    await expect(offline.getByText(`${scope==='simple'?'Simple':'Comprehensive'} search`,{exact:true})).toBeVisible();
    const reportDetails=offline.locator('.export-network-panel');
    await expect(reportDetails.getByText('Report details',{exact:true})).toBeVisible();
    await expect(reportDetails.getByRole('heading',{name:'EXAMPLE LIMITED',exact:true})).not.toBeVisible();
    await reportDetails.getByText('Report details',{exact:true}).click();
    await expect(reportDetails.getByRole('heading',{name:'EXAMPLE LIMITED',exact:true})).toBeVisible();
    await reportDetails.getByText('Report details',{exact:true}).click();
    await offline.getByRole('button',{name:'Details',exact:true}).click();
    await expect(offline.locator('.export-network')).toHaveCount(0);
    await expect(offline.locator('.react-flow__node')).toHaveCount(0);
    await expect(offline.getByRole('heading',{name:'EXAMPLE LIMITED',exact:true})).toBeVisible();
    await expect(offline.getByText('FORMER NAME LIMITED',{exact:true})).not.toBeVisible();
    await offline.getByText('Former names (1)',{exact:true}).click();
    await expect(offline.getByText('FORMER NAME LIMITED',{exact:true})).toBeVisible();
    await offline.getByText('Historical addresses (1)',{exact:true}).click();
    await expect(offline.getByText('Former business address',{exact:true})).toBeVisible();
    await offline.getByText('Historical shareholders (1)',{exact:true}).click();
    await expect(offline.getByText('Former Holder',{exact:true})).toBeVisible();
    await expect(offline.getByRole('link',{name:/Annual return/})).toHaveAttribute('href',/documents\/ABC123$/);
    await expect(offline.getByRole('link',{name:'View constitution ↗',exact:true})).toHaveAttribute('href',/documents\/C0A123$/);
    expect(await offline.evaluate(()=>Boolean((window as any).injected))).toBe(false);
    await offline.getByRole('button',{name:'Org Chart',exact:true}).click();
    await expect(offline.locator('.react-flow__node')).toBeVisible();
    expect(external).toEqual([]);
});
