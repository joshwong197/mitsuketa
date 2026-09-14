import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('Mitsuketa entry, Property tab, reference, report and admin audit stay connected', async ({ page }, testInfo) => {
    const requests: URL[] = [];
    // Synthetic responses only: this test never queries LINZ or writes Neon.
    await page.route('**/api/property?**', async route => {
        const url = new URL(route.request().url());
        requests.push(url);
        const mode = url.searchParams.get('mode');
        const body = mode === 'login' ? { searcher: 'example', canAudit: true }
            : mode === 'address' ? { resolution_status: 'ok', query: url.searchParams.get('q'),
                titles: [{ title_no: 'SAMPLE-1', type: 'Freehold', status: 'Live' }],
                resolved_address: { address_id: 123, full_address: 'Example commercial address',
                    territorial_authority: 'Waimakariri District' },
                audit_reference: 'AUD-101', matter_reference: url.searchParams.get('ref') }
            : mode === 'title' ? { title: { title_no: 'SAMPLE-1', status: 'Live', type: 'Freehold' },
                owners: [], memorials: [], estates: [], address: 'Example commercial address',
                rating_valuation: { status: 'matched', council: 'Waimakariri District Council',
                    valuationNumber: '2144002401', capitalValue: 500000, landValue: 290000,
                    improvementsValue: 210000, valuationDate: '2025-06-01T00:00:00.000Z',
                    retrievedAt: '2026-09-14T01:00:00.000Z',
                    officialUrl: 'https://gisservices.waimakariri.govt.nz/apps/YourRates/index.html',
                    sourceName: 'Waimakariri District Council',
                    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
                    sourceUrl: 'https://gisservices.waimakariri.govt.nz/arcgis/rest/services/Property/PropertyandLand/MapServer/5' },
                geometry: null, bbox: null, audit_reference: 'AUD-101', matter_reference: url.searchParams.get('ref') }
            : { rows: [{ audit_reference: 'AUD-101', created_at: '2026-09-12T00:00:00Z',
                mode: 'address', query: 'Example commercial address', title_no: 'SAMPLE-1',
                opened_titles: ['SAMPLE-1'], searcher: 'example', actor: 'password:example',
                matter_ref: 'CASE-BROWSER', ip: null }] };
        await route.fulfill({ json: body });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Start searching', exact: true }).first().click();
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.count()) await skip.click();
    await expect(page.getByRole('button', { name: /Compare/ }).first()).toBeVisible();
    // Use the top tab, not only the inner search-mode link (regression).
    await page.getByRole('button', { name: /Property/ }).first().click();
    await page.getByLabel('Email or username', { exact: false }).fill('example');
    await page.getByLabel('Password', { exact: true }).fill('synthetic-only');
    await page.getByRole('button', { name: /Unlock/ }).click();
    await expect(page.getByRole('button', { name: 'Agree and continue' })).toBeDisabled();
    await expect(page.getByRole('checkbox')).toBeDisabled();
    await page.getByRole('region', { name: 'Privacy notice document', exact: true }).evaluate(node => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll')); });
    await page.locator('summary').filter({ hasText: 'Terms of use' }).click();
    await page.getByRole('region', { name: 'Terms of use document', exact: true }).evaluate(node => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll')); });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Agree and continue' }).click();
    await page.getByLabel('Property address', { exact: true }).fill('Example commercial address');
    await expect(page.locator('form').getByRole('button', { name: 'Search', exact: true })).toBeDisabled();
    await page.getByLabel('Matter reference', { exact: true }).fill('   ');
    await expect(page.locator('form').getByRole('button', { name: 'Search', exact: true })).toBeDisabled();
    await page.getByLabel('Matter reference', { exact: true }).fill('CASE-BROWSER');
    await page.getByRole('button', { name: 'Save reference', exact: true }).click();
    await page.getByLabel('Matter reference', { exact: true }).fill('NEW');
    await page.getByLabel('Saved matter references').selectOption('CASE-BROWSER');
    await expect(page.getByLabel('Matter reference', { exact: true })).toHaveValue('CASE-BROWSER');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mitsuketa:matters:example') || '[]'))).toEqual(['CASE-BROWSER']);
    await page.getByLabel('Property address', { exact: true }).fill('Example commercial address');
    await page.locator('form').getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByText('Search reference: AUD-101', { exact: false })).toBeVisible();
    const addressRequest = requests.find(url => url.searchParams.get('mode') === 'address')!;
    expect(addressRequest.searchParams.get('ref')).toBe('CASE-BROWSER');
    expect(addressRequest.searchParams.get('search_id')).toMatch(/^[0-9a-f-]{36}$/i);
    // Editing the next query's reference must not relabel existing results.
    await page.getByLabel('Matter reference', { exact: true }).fill('NEXT-MATTER');
    await page.getByRole('button', { name: /SAMPLE-1/ }).first().click();
    await expect(page.getByText('Search reference: AUD-101', { exact: false })).toBeVisible();
    const titleRequest = requests.find(url => url.searchParams.get('mode') === 'title')!;
    expect(titleRequest.searchParams.get('ref')).toBe('CASE-BROWSER');
    expect(titleRequest.searchParams.get('search_id')).toBe(addressRequest.searchParams.get('search_id'));
    expect(titleRequest.searchParams.has('search_start')).toBe(false);
    expect(titleRequest.searchParams.get('address_id')).toBe('123');
    await expect(page.getByRole('heading', { name: /^Council rating valuation/ })).toBeVisible();
    await expect(page.getByText('$500,000', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Open official council valuation/ })).toHaveAttribute('href', /waimakariri/);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export report/ }).click();
    const file = testInfo.outputPath('property-report.html');
    await (await download).saveAs(file);
    const exported = await readFile(file, 'utf8');
    expect(exported).toContain('Council rating valuation');
    expect(exported).toContain('$500,000');
    expect(exported).toContain('Open official council valuation');
    expect(exported).toContain('CC BY 4.0');
    await page.getByRole('button', { name: /Back to property search/ }).click();
    await page.getByLabel('Saved matter references').selectOption('CASE-BROWSER');
    await page.getByRole('button', { name: 'Remove saved reference', exact: true }).click();
    await expect(page.getByLabel('Saved matter references')).toHaveCount(0);
    await expect(page.getByLabel('Matter reference', { exact: true })).toHaveValue('CASE-BROWSER');
    await page.getByRole('button', { name: 'Search audit', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'CASE-BROWSER', exact: true })).toBeVisible();
});
