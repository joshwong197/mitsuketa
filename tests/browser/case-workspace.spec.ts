import { expect, test } from '@playwright/test';

const alpha = {
    nzbn: '9429000000101', entityName: 'ALPHA FIXTURE LIMITED', entityStatusDescription: 'Registered',
    sourceRegister: 'COMPANY', sourceRegisterUniqueIdentifier: '10101', entityTypeDescription: 'NZ Limited Company',
    addresses: { addressList: [{ addressType: 'REGISTERED', address1: '1 Alpha Street' }] },
    'company-details': { shareholding: { numberOfShares: 100, shareAllocation: [] } },
    roles: [{ roleType: 'Director', roleStatus: 'Active', rolePerson: { fullName: 'Alex Alpha' } }],
};
const beta = {
    nzbn: '9429000000102', entityName: 'BETA FIXTURE LIMITED', entityStatusDescription: 'Registered',
    sourceRegister: 'COMPANY', sourceRegisterUniqueIdentifier: '10102', entityTypeDescription: 'NZ Limited Company',
    addresses: { addressList: [{ addressType: 'REGISTERED', address1: '2 Beta Street' }] },
    'company-details': { shareholding: { numberOfShares: 100, shareAllocation: [] } },
    roles: [{ roleType: 'Director', roleStatus: 'Active', rolePerson: { fullName: 'Bea Beta' } }],
};

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('mitsuketa_intro_seen', '1'));
    await page.route('**/api/entity-record?**', route => route.fulfill({ json: {
        historicalAddresses: [], historicalShareholders: [], documents: [], unavailable: [], documentsStatus: 'empty',
    } }));
});

test('company cases keep their case state while scope and home navigation do not discard tabs', async ({ page }) => {
    const requests: string[] = [];
    await page.route('**/api/proxy?**', async route => {
        const path = new URL(route.request().url()).searchParams.get('path') || '';
        requests.push(path);
        const selected = /BETA/i.test(path) ? beta : alpha;
        const json = path.includes('/history/') ? []
            : path.endsWith(`/entities/${alpha.nzbn}`) ? alpha
            : path.endsWith(`/entities/${beta.nzbn}`) ? beta
            : path.includes('/entities?') ? { items: [selected], totalItems: 1, pageSize: 10, page: 0 }
            : { roles: [], items: [], results: [], searchResults: [], totalItems: 0 };
        await route.fulfill({ json });
    });

    await page.goto('/#/app');
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.count()) await skip.click();

    const search = page.getByLabel('Search company or person');
    await search.fill('ALPHA FIXTURE');
    await search.press('Enter');
    await page.getByText(alpha.entityName, { exact: true }).first().click();
    await expect(page.getByLabel('Comprehensive · wider network')).toBeVisible({ timeout: 30000 });

    // The role view is part of the case, not a global preference.
    const alphaHide = page.getByRole('button', { name: 'Hide directors', exact: true });
    await expect(alphaHide).toHaveAttribute('aria-pressed', 'false');
    await alphaHide.click();
    await expect(alphaHide).toHaveAttribute('aria-pressed', 'true');

    await page.locator('.react-flow__node').filter({ hasText: alpha.entityName }).click({ button: 'right' });
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await page.getByPlaceholder(`Note on NZBN ${alpha.nzbn}…`).fill('Alpha-only note');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Alpha-only note', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Trail/ }).click();
    await expect(page.getByText(/Note added · ALPHA FIXTURE LIMITED/)).toBeVisible();

    // A named save point belongs to the current case and must not show in Beta.
    await page.getByRole('button', { name: 'Save snapshot', exact: true }).last().click();
    await page.getByLabel('Snapshot name').fill('Alpha case save');
    await page.getByRole('button', { name: 'Save snapshot', exact: true }).last().click();
    await expect(page.getByText('Alpha case save', { exact: true })).toBeVisible();

    await page.getByLabel('New search').click();
    await search.fill('BETA FIXTURE');
    await search.press('Enter');
    await page.getByText(beta.entityName, { exact: true }).first().click();
    await expect(page.getByLabel('Comprehensive · wider network')).toBeVisible({ timeout: 30000 });
    const betaHide = page.getByRole('button', { name: 'Hide directors', exact: true });
    await expect(betaHide).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('Alpha case save', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Alpha-only note', { exact: true })).toHaveCount(0);

    // Comprehensive → Simple → Comprehensive projects cached data only.
    const requestsBeforeScopeToggle = requests.length;
    await page.getByLabel('Comprehensive · wider network').click();
    await expect(page.getByLabel('Simple · immediate relationships')).toBeVisible();
    await page.getByLabel('Simple · immediate relationships').click();
    await expect(page.getByLabel('Comprehensive · wider network')).toBeVisible();
    expect(requests.length).toBe(requestsBeforeScopeToggle);

    // Switch back to Alpha. Its independent view setting and named save remain.
    await page.getByText(alpha.entityName, { exact: true }).last().click();
    await expect(page.getByRole('button', { name: 'Hide directors', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Alpha case save', { exact: true })).toBeVisible();
    await expect(page.getByText('Alpha-only note', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Workspace', exact: true }).click();
    await expect(page.getByText('Open cases', { exact: true })).toBeVisible();
    await expect(page.getByText(alpha.entityName, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(beta.entityName, { exact: true }).first()).toBeVisible();

    await page.getByRole('link', { name: /Mitsuketa/i }).click();
    await expect(page.getByRole('button', { name: 'Start searching', exact: true }).first()).toBeVisible();
    await page.goBack();
    await page.getByRole('button', { name: 'Companies, 2 open company tabs' }).click();
    await expect(page.getByText(alpha.entityName, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(beta.entityName, { exact: true }).first()).toBeVisible();
    // Restore opens a third case with its saved annotations and filter.
    await page.getByText('Alpha case save', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Companies, 3 open company tabs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide directors', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Alpha-only note', { exact: true })).toBeVisible();
    // A fresh search for the same subject remains a distinct case.
    await page.getByLabel('New search').click();
    await search.fill('ALPHA FIXTURE'); await search.press('Enter');
    await page.getByRole('option').first().click();
    await expect(page.getByLabel('Comprehensive · wider network')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Companies, 4 open company tabs' })).toBeVisible();
    await expect(page.getByText('Alpha case save', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Alpha-only note', { exact: true })).toHaveCount(0);
});


test('late company loads update their originating tab and trail', async ({ page }) => {
    let releaseAlpha!: () => void;
    const gate = new Promise<void>(resolve => { releaseAlpha = resolve; });
    await page.route('**/api/proxy?**', async route => {
        const path = new URL(route.request().url()).searchParams.get('path') || '';
        if (path.endsWith(`/entities/${alpha.nzbn}`)) await gate;
        const selected = /BETA/i.test(path) ? beta : alpha;
        await route.fulfill({ json: path.includes('/history/') ? []
            : path.endsWith(`/entities/${alpha.nzbn}`) ? alpha
            : path.endsWith(`/entities/${beta.nzbn}`) ? beta
            : path.includes('/entities?') ? { items: [selected], totalItems: 1 }
            : { roles: [], items: [], searchResults: [], totalItems: 0 } });
    });
    await page.goto('/#/app');
    const search = page.getByLabel('Search company or person');
    await search.fill('ALPHA FIXTURE'); await search.press('Enter');
    await page.getByRole('option').first().click();
    await expect(page.getByRole('button', { name: alpha.entityName, exact: true })).toBeVisible();
    await page.getByLabel('New search').click();
    await search.fill('BETA FIXTURE'); await search.press('Enter');
    await page.getByRole('option').first().click();
    await expect(page.locator('.react-flow__node').filter({ hasText: beta.entityName })).toBeVisible();
    releaseAlpha();
    await expect(page.getByRole('button', { name: alpha.entityName, exact: true }).locator('.animate-pulse')).toHaveCount(0);
    await expect(page.locator('.react-flow__node').filter({ hasText: beta.entityName })).toBeVisible();
    await expect(page.locator('.react-flow__node').filter({ hasText: alpha.entityName })).toHaveCount(0);
    await page.getByRole('button', { name: /Trail/ }).click();
    await expect(page.getByText(/Mapped BETA FIXTURE LIMITED/)).toBeVisible();
    await expect(page.getByText(/Mapped ALPHA FIXTURE LIMITED/)).toHaveCount(0);
    await page.getByRole('button', { name: alpha.entityName, exact: true }).click();
    await expect(page.locator('.react-flow__node').filter({ hasText: alpha.entityName })).toBeVisible();
    await page.getByRole('button', { name: /Trail/ }).click();
    await expect(page.getByText(/Mapped ALPHA FIXTURE LIMITED/)).toBeVisible();
    await expect(page.getByText(/Mapped BETA FIXTURE LIMITED/)).toHaveCount(0);
});
