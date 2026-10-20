import { test, expect } from '@playwright/test';

test('the record paints from NZBN first, then fills in documents and the summary report', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('mitsuketa_intro_seen', '1'));
    const root = { nzbn: '9429000000001', entityName: 'WOUND UP FIXTURE LIMITED', entityStatusDescription: 'Removed',
        sourceRegister: 'COMPANY', sourceRegisterUniqueIdentifier: '12345', entityTypeCode: 'LTD', entityTypeDescription: 'NZ Limited Company',
        registrationDate: '2000-12-19T00:00:00+13:00', roles: [], 'company-details': { shareholding: { numberOfShares: 100, shareAllocation: [] } } };
    await page.route('**/api/proxy?**', route => {
        const path = new URL(route.request().url()).searchParams.get('path') || '';
        return route.fulfill({ json: path.endsWith('/history/entity-statuses') ? [
            { entityStatusDescription: 'Registered', startDate: '2000-12-19', endDate: '2023-01-01' },
            { entityStatusDescription: 'In Liquidation', startDate: '2023-01-01', endDate: '2025-07-10' },
            { entityStatusDescription: 'Removed', startDate: '2025-07-10', endDate: '' },
        ] : path.includes('/history/') ? [] : path.endsWith(`/entities/${root.nzbn}`) ? root : { items: [root], totalItems: 1, pageSize: 10, page: 0 } });
    });
    let releaseRecord = () => {};
    const recordHeld = new Promise<void>(resolve => { releaseRecord = resolve; });
    const filingRequests: string[] = [];
    await page.route('**/api/entity-record?**', async route => {
        const filing = new URL(route.request().url()).searchParams.get('filing');
        if (filing) {
            filingRequests.push(filing);
            return route.fulfill({ json: { summary: { filed: '10 July 2025 09:49:09', presenter: { name: 'Pat EXAMPLE', firm: 'EXAMPLE ADVISORY', address: '' },
                appointees: [{ name: 'Pat EXAMPLE', appointed: '1 Jan 2023 10:00:00', registration: 'IP130' }], start: '', end: '', method: '', reasons: [],
                solvency: 'Solvent', creditors: [], recoveries: [], recoveriesTotal: 0, fees: 0, email: '', url: 'https://example.invalid/summary' } } });
        }
        await recordHeld;
        return route.fulfill({ json: { historicalAddresses: [], historicalShareholders: [], limited: false, unavailable: [], documentsStatus: 'available',
            documents: [{ title: 'Liquidators Summary Report', filing: '', date: '10 Jul 2025', size: '', url: 'https://app.companiesoffice.govt.nz/companies/app/service/services/documents/abc123' }],
            summaryFilings: [{ id: '38702343', title: 'Liquidators Summary Report', date: '10 Jul 2025 09:49' }] } });
    });
    await page.goto('/#/app');
    await page.getByLabel('Search company or person').fill('WOUND UP FIXTURE');
    await page.getByLabel('Search company or person').press('Enter');
    await page.getByRole('option').first().click();
    await expect(page.locator('.react-flow__node').filter({ hasText: 'WOUND UP FIXTURE LIMITED' })).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Details', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Details' });
    // The register scrape is still held: the NZBN core and status history are already on screen.
    await expect(panel.getByRole('heading', { name: 'WOUND UP FIXTURE LIMITED' })).toBeVisible();
    await expect(panel.getByText('Checking the register for practitioner reports…')).toBeVisible();
    await expect(panel.getByText(/^Checking Companies Register for documents/)).toBeVisible();
    releaseRecord();
    await expect(panel.getByText('Pat EXAMPLE', { exact: true })).toBeVisible();
    await expect(panel.getByText('Solvent', { exact: true })).toBeVisible();
    await expect(panel.getByText('Checking the register for practitioner reports…')).toHaveCount(0);
    expect(filingRequests).toEqual(['38702343']);
});
