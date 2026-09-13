import { test, expect } from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.beforeEach(async ({page})=>{
    await page.route('**/api/entity-record?**',route=>route.fulfill({json:{historicalAddresses:[],historicalShareholders:[],documents:[],unavailable:[]}}));
});

test('company scope defaults to Comprehensive and Simple only renders immediate relationships', async ({ page }) => {
    const requests: string[] = [];
    let failRoot = false;
    const root = { nzbn: '9429000000001', entityName: 'ABC FIXTURE LIMITED', entityStatusDescription: 'Registered',
        sourceRegister: 'COMPANY', sourceRegisterUniqueIdentifier: '12345', entityTypeCode: 'LTD', entityTypeDescription: 'NZ Limited Company',
        registrationDate: '2000-12-19T00:00:00+13:00',
        addresses: { addressList: [{ addressType: 'REGISTERED', address1: 'Example business address' }] },
        'company-details': { hasConstitutionFiled: true, shareholding: { numberOfShares: 100, shareAllocation: [
            { allocation: 100, shareholder: [{ otherShareholder: { nzbn: '9429000000002', currentEntityName: 'PARENT FIXTURE LIMITED' } }] },
        ] } }, roles: [{ roleType: 'Director', roleStatus: 'Active', rolePerson: { fullName: 'Alex Fixture' } }] };
    await page.route('**/api/proxy?**', async route => {
        const path = new URL(route.request().url()).searchParams.get('path') || '';
        requests.push(path);
        if (failRoot && path.endsWith('/entities/9429000000001')) return route.fulfill({ status: 503, json: { error: 'synthetic failure' } });
        const json = path.includes('/history/') ? []
            : path.endsWith('/entities/9429000000001') ? root
            : path.endsWith('/entities/9429000000002') ? { nzbn: '9429000000002', entityName: 'PARENT FIXTURE LIMITED', entityStatusDescription: 'Registered' }
            : path.includes('/entities?') ? { items: [root], totalItems: 1, pageSize: 10, page: 0 }
            : { roles: [], items: [], results: [], searchResults: [], totalItems: 0 };
        await route.fulfill({ json });
    });
    await page.goto('/#/app');
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.count()) await skip.click();
    await expect(page.getByRole('button', { name: 'Comprehensive', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Simple', exact: true }).click();
    await expect(page.getByText('Selected company, immediate shareholders and directors.', { exact: true })).toBeVisible();
    await page.getByLabel('Search company or person').fill('ABC FIXTURE');
    await page.getByLabel('Search company or person').press('Enter');
    await page.getByText('ABC FIXTURE LIMITED', { exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Simple · immediate relationships', exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.react-flow__node')).toHaveCount(3);
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Alex Fixture' })).toBeVisible();
    const layout = await page.evaluate(() => ({
        toolbarBottom: document.querySelector('.sumi-graph-tools')!.getBoundingClientRect().bottom,
        nodes: [...document.querySelectorAll('.react-flow__node')].map(node => {
            const box = node.getBoundingClientRect();
            return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        }),
    }));
    expect(Math.min(...layout.nodes.map(node => node.top))).toBeGreaterThanOrEqual(layout.toolbarBottom);
    for (let i = 0; i < layout.nodes.length; i++) for (let j = i + 1; j < layout.nodes.length; j++) {
        const a = layout.nodes[i], b = layout.nodes[j];
        expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
    }
    expect(requests.some(p => p.includes('role-type=SHR'))).toBe(false);
    await page.getByRole('button', { name: 'Entity details', exact: true }).click();
    const profile = page.getByRole('region', { name: 'Entity details' });
    await expect(profile.getByText('19 Dec 2000', { exact: true })).toBeVisible();
    await expect(profile.getByText('Example business address', { exact: false })).toBeVisible();
    await expect(profile.getByRole('link', { name: 'Open Companies Register' })).toHaveAttribute('href', /companies\/12345$/);
    await expect(profile.getByText('Total shares: 100', { exact: true })).toBeVisible();
    const download=page.waitForEvent('download');
    await page.getByRole('button',{name:'Export interactive chart',exact:true}).click();
    const html=await readFile((await(await download).path())!,'utf8');
    const embedded=JSON.parse(html.match(/<script id="mitsuketa-data" type="application\/json">(.*?)<\/script>/s)![1]);
    expect(embedded.scope).toBe('simple');
    expect(embedded.record.name).toBe('ABC FIXTURE LIMITED');
    expect(embedded.nodes).toHaveLength(3);
    await profile.getByRole('button',{name:'Back to network',exact:true}).focus();
    await page.keyboard.press('Escape');
    await expect(profile).toHaveCount(0);
    // Let the session save, then verify the graph's scope survives rehydration.
    await expect.poll(() => page.evaluate(() => localStorage.getItem('mitsuketa_session_v1') || '')).toContain('"companySearchScope":"simple"');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Simple · immediate relationships', exact: true })).toBeVisible();
    await expect(page.locator('.react-flow__node')).toHaveCount(3);
    const countBefore = requests.length;
    await page.getByRole('button', { name: 'Simple · immediate relationships', exact: true }).click();
    await page.getByRole('button', { name: 'Keep simple', exact: true }).click();
    expect(requests.length).toBe(countBefore);
    failRoot = true;
    await page.getByRole('button', { name: 'Simple · immediate relationships', exact: true }).click();
    await page.getByRole('button', { name: 'Run comprehensive search', exact: true }).click();
    await expect(page.getByText('NZBN API Error: 503', { exact: true })).toBeVisible();
    await expect(page.locator('.react-flow__node')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Simple · immediate relationships', exact: true })).toBeEnabled();
    failRoot = false;
    await page.getByRole('button', { name: 'Simple · immediate relationships', exact: true }).click();
    await page.getByRole('button', { name: 'Run comprehensive search', exact: true }).click();
    await expect(page.getByLabel('Comprehensive · wider network', { exact: true })).toBeVisible({ timeout: 30000 });
    expect(requests.some(p => p.includes('role-type=SHR'))).toBe(true);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('mitsuketa_session_v1') || '{}').companyTabs?.[0]?.allNodesInMemory?.find((n: any) => n.data.isTarget)?.data.companySearchScope)).toBe('comprehensive');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mitsuketa_session_v1') || '{}').companyTabs.length)).toBe(1);
});

for (const [code, type, role, register] of [
    ['I', 'Incorporated Society', 'officer', 'Incorporated Societies Register'],
    ['Trading_Trust', 'Trust', 'Trustee', 'NZBN Register'],
    ['Y', 'Limited Partnership (NZ)', 'Partner', 'Limited Partnerships Register'],
    ['Partnership', 'Partnership', '', 'NZBN Register'],
    ['T', 'Charitable Trust', '', 'Charitable Trusts Register'],
]) {
    test(`${type} shows its real entity type and public-role coverage`, async ({ page }) => {
        const entity = { nzbn: '9429000000003', entityName: 'EXAMPLE ORGANISATION', entityTypeCode: code, entityTypeDescription: type,
            sourceRegister: code, sourceRegisterUniqueIdentifier: '12345', entityStatusDescription: 'Registered',
            roles: role ? [{ roleType: role, roleStatus: 'Active', startDate: '2020-01-01T00:00:00+13:00', rolePerson: { firstName: 'Alex', middleNames: 'Taylor', lastName: 'Example' } }] : [],
            'non-company-details': code === 'T' ? { charitiesNumber: 'CC12345' } : null };
        await page.route('**/api/proxy?**', async route => {
            const path = new URL(route.request().url()).searchParams.get('path') || '';
            await route.fulfill({ json: path.includes('/history/') ? [] : path.endsWith('/entities/9429000000003') ? entity
                : path.includes('/entities?') ? { items: [entity], totalItems: 1 }
                : { roles: [], items: [], results: [], searchResults: [], totalItems: 0 } });
        });
        await page.goto('/#/app');
        const skip = page.getByRole('button', { name: 'Skip', exact: true });
        if (await skip.count()) await skip.click();
        await page.getByRole('button', { name: 'Simple', exact: true }).click();
        await page.getByLabel('Search company or person').fill('EXAMPLE ORGANISATION');
        await page.getByLabel('Search company or person').press('Enter');
        await expect(page.getByRole('option').getByText(type, { exact: true })).toBeVisible();
        await page.getByRole('option').first().click();
        await page.getByRole('button', { name: 'Entity details', exact: true }).click();
        const panel = page.getByRole('region', { name: 'Entity details' });
        await expect(panel.getByText(`${type} · Registered`, { exact: true })).toBeVisible();
        await expect(panel.getByRole('link', { name: `Open ${register}`, exact: true })).toBeVisible();
        if (role) {
            await expect(panel.getByText('Alex Taylor Example', { exact: true })).toBeVisible();
            await expect(panel.getByText(`${role} · Active`, { exact: true })).toBeVisible();
        } else await expect(panel.getByText('No public roles supplied in this NZBN response.', { exact: true })).toBeVisible();
        if (code === 'T') await expect(panel.getByText('CC12345', { exact: true })).toBeVisible();
        await expect(panel.getByText('Relationship coverage', { exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.react-flow__node')).toHaveCount(role ? 2 : 1);
    });
}
