import { test, expect } from '@playwright/test';

test('Mitsuketa entry, Property tab, reference, report and admin audit stay connected', async ({ page }) => {
    const requests: URL[] = [];
    // Synthetic responses only: this test never queries LINZ or writes Neon.
    await page.route('**/api/property?**', async route => {
        const url = new URL(route.request().url());
        requests.push(url);
        const mode = url.searchParams.get('mode');
        const body = mode === 'login' ? { searcher: 'example', canAudit: true }
            : mode === 'address' ? { resolution_status: 'ok', query: url.searchParams.get('q'),
                titles: [{ title_no: 'SAMPLE-1', type: 'Freehold', status: 'Live' }],
                audit_reference: 'AUD-101', matter_reference: url.searchParams.get('ref') }
            : mode === 'title' ? { title: { title_no: 'SAMPLE-1', status: 'Live', type: 'Freehold' },
                owners: [], memorials: [], estates: [], address: 'Example commercial address',
                geometry: null, bbox: null, audit_reference: 'AUD-102', matter_reference: url.searchParams.get('ref') }
            : { rows: [{ audit_reference: 'AUD-102', created_at: '2026-09-12T00:00:00Z',
                mode: 'title', query: 'SAMPLE-1', title_no: 'SAMPLE-1',
                actor: 'password:example', matter_ref: 'CASE-BROWSER', ip: null }] };
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
    expect(requests.find(url => url.searchParams.get('mode') === 'address')?.searchParams.get('ref')).toBe('CASE-BROWSER');
    // Editing the next query's reference must not relabel existing results.
    await page.getByLabel('Matter reference', { exact: true }).fill('NEXT-MATTER');
    await page.getByRole('button', { name: /SAMPLE-1/ }).first().click();
    await expect(page.getByText('Search reference: AUD-102', { exact: false })).toBeVisible();
    expect(requests.find(url => url.searchParams.get('mode') === 'title')?.searchParams.get('ref')).toBe('CASE-BROWSER');
    await page.getByRole('button', { name: /Back to property search/ }).click();
    await page.getByLabel('Saved matter references').selectOption('CASE-BROWSER');
    await page.getByRole('button', { name: 'Remove saved reference', exact: true }).click();
    await expect(page.getByLabel('Saved matter references')).toHaveCount(0);
    await expect(page.getByLabel('Matter reference', { exact: true })).toHaveValue('CASE-BROWSER');
    await page.getByRole('button', { name: 'Search audit', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'CASE-BROWSER', exact: true })).toBeVisible();
});
