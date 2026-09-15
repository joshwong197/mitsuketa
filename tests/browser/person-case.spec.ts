import { expect, test } from '@playwright/test';

const personName = 'Mira Person';
const company = {
    nzbn: '9429000000201', entityName: 'PERSON CASE FIXTURE LIMITED', entityStatusDescription: 'Registered',
    sourceRegister: 'COMPANY', sourceRegisterUniqueIdentifier: '20201', entityTypeDescription: 'NZ Limited Company',
    registrationDate: '2020-01-02T00:00:00+13:00',
    addresses: { addressList: [{ addressType: 'REGISTERED', address1: '20 Person Street', address3: 'Auckland' }] },
    'company-details': { shareholding: { numberOfShares: 100, shareAllocation: [] } },
    roles: [{ roleType: 'Director', roleStatus: 'Active', rolePerson: { fullName: personName } }],
};

const personRoles = {
    roles: [{
        roleType: 'Director', status: 'active', firstName: 'Mira', lastName: 'Person',
        appointmentDate: '2020-01-02', associatedCompanyName: company.entityName,
        associatedCompanyNzbn: company.nzbn, associatedCompanyNumber: '20201', associatedCompanyStatusCode: '0',
        physicalAddress: { addressLines: ['20 Person Street', 'Auckland'], postCode: '1010', countryCode: 'NZ' },
    }],
};

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('mitsuketa_intro_seen', '1'));
    await page.route('**/api/entity-record?**', route => route.fulfill({ json: {
        historicalAddresses: [], historicalShareholders: [], documents: [], unavailable: [], documentsStatus: 'empty',
    } }));
});

test('person subject card is retained through person-to-company chart and Details', async ({ page }, testInfo) => {
    await page.route('**/api/proxy?**', async route => {
        const path = new URL(route.request().url()).searchParams.get('path') || '';
        const json = path.includes('entity-roles/v3/search') ? personRoles
            : path.includes('/history/') ? []
            : path.endsWith(`/entities/${company.nzbn}`) ? company
            : path.includes('/entities?') ? { items: [company], totalItems: 1, pageSize: 10, page: 0 }
            : { roles: [], items: [], results: [], searchResults: [], totalItems: 0 };
        await route.fulfill({ json });
    });

    await page.goto('/#/app');
    await page.getByRole('button', { name: 'People', exact: true }).click();
    const search = page.getByLabel('Search company or person');
    await search.fill(personName);
    await search.press('Enter');

    const personPanel = page.locator('#person-search-results');
    await expect(personPanel).toBeVisible({ timeout: 30000 });
    await expect(personPanel.getByRole('heading', { name: personName, exact: true })).toBeVisible();
    await expect(personPanel.getByText('Name returned by the Companies Register search', { exact: true })).toBeVisible();
    await expect(personPanel.getByText('All addresses match', { exact: true })).toBeVisible();
    await expect(personPanel.getByText('Same-name notice:', { exact: false })).toBeVisible();
    await personPanel.locator('aside').screenshot({ path: testInfo.outputPath('person-subject-card.png') });

    await personPanel.getByRole('row').filter({ hasText: company.entityName }).click();
    await expect(page.getByLabel('Comprehensive · wider network')).toBeVisible({ timeout: 30000 });

    const hideDirectors = page.getByRole('button', { name: 'Hide directors', exact: true });
    await expect(hideDirectors).toBeEnabled();
    await expect(hideDirectors).toHaveAttribute('aria-pressed', 'false');
    await hideDirectors.click();
    await expect(hideDirectors).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Details', exact: true }).click();
    const details = page.getByRole('region', { name: 'Details' });
    await expect(details.getByRole('heading', { name: 'Details', exact: true })).toBeVisible();
    await expect(details.getByText(company.entityName, { exact: true })).toBeVisible();
    await details.screenshot({ path: testInfo.outputPath('company-details.png') });
});
