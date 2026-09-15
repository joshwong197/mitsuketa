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
        roleType: 'DirectorShareholder', status: 'active', firstName: 'Mira', lastName: 'Person',
        appointmentDate: '2020-01-02',
        physicalAddress: { addressLines: ['20 Person Street', 'Auckland'], postCode: '1010', countryCode: 'NZ' },
        shareholdings: [{
            associatedCompanyName: company.entityName, associatedCompanyNzbn: company.nzbn,
            associatedCompanyNumber: '20201', associatedCompanyStatusCode: '0', sharePercentage: 100,
        }],
    }],
};

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('mitsuketa_intro_seen', '1'));
    await page.route('**/api/consent-forms**', route => route.fulfill({ json: { forms: [] } }));
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
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'People', exact: true }).click();
    const search = page.getByLabel('Search company or person');
    await search.fill(personName);
    await search.press('Enter');

    const personPanel = page.locator('#person-search-results');
    await expect(personPanel).toBeVisible({ timeout: 30000 });
    const subject = personPanel.getByRole('region', { name: 'Individual search subject' });
    const identifyingEvidence = personPanel.getByRole('region', { name: 'Identifying evidence' });
    await expect(subject.getByRole('heading', { name: personName, exact: true })).toBeVisible();
    await expect(subject.getByRole('img', { name: 'Director and shareholder', exact: true })).toBeVisible();
    await expect(subject.getByText('Individual search · Companies Office', { exact: true })).toBeVisible();
    await expect(identifyingEvidence.getByText('All addresses match', { exact: true })).toBeVisible();
    await expect(subject.getByText('Results for this name', { exact: false })).toBeVisible();
    await expect(subject.getByText('Identity not confirmed', { exact: false })).toBeVisible();

    const [subjectBox, panelBox] = await Promise.all([subject.boundingBox(), personPanel.boundingBox()]);
    expect(subjectBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(subjectBox!.width / panelBox!.width).toBeGreaterThan(0.85);
    await subject.screenshot({ path: testInfo.outputPath('person-subject-card-desktop.png') });

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

    await page.getByRole('button', { name: /^Individual, 1 open individual tab$/ }).click();
    await page.getByRole('button', { name: personName, exact: true }).click();
    await expect(personPanel).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileBackdrop = page.locator('div.absolute.inset-0.z-30');
    await expect(mobileBackdrop).toBeVisible();
    const backdropBox = await mobileBackdrop.boundingBox();
    await mobileBackdrop.click({ position: { x: backdropBox!.width - 8, y: 100 } });
    await expect(mobileBackdrop).toBeHidden();
    await expect(subject).toBeVisible();
    await expect(personPanel.getByRole('row').filter({ hasText: company.entityName })).toBeVisible();
    const mobileSubjectBox = await subject.boundingBox();
    expect(mobileSubjectBox).not.toBeNull();
    expect(mobileSubjectBox!.x).toBeLessThan(40);
    await personPanel.screenshot({ path: testInfo.outputPath('person-panel-mobile.png') });
});

test('person subject reports an unavailable register check without a completed timestamp', async ({ page }) => {
    await page.route('**/api/proxy?**', async route => {
        const path = new URL(route.request().url()).searchParams.get('path') || '';
        if (path.includes('disqualified-directors')) {
            await route.fulfill({ status: 503, body: 'Register unavailable' });
            return;
        }
        const json = path.includes('entity-roles/v3/search') ? personRoles
            : path.includes('/history/') ? []
            : path.endsWith(`/entities/${company.nzbn}`) ? company
            : path.includes('/entities?') ? { items: [company], totalItems: 1, pageSize: 10, page: 0 }
            : { roles: [], items: [], results: [], searchResults: [], totalItems: 0 };
        await route.fulfill({ json });
    });

    await page.goto('/#/app');
    await page.getByRole('button', { name: 'People', exact: true }).click();
    await page.getByLabel('Search company or person').fill(personName);
    await page.getByLabel('Search company or person').press('Enter');

    const subject = page.getByRole('region', { name: 'Individual search subject' });
    await expect(subject).toBeVisible({ timeout: 30000 });
    await expect(subject.getByText('Register check completion not available', { exact: true })).toBeVisible();
    await expect(subject.getByText('Disqualified directors check unavailable', { exact: true })).toBeVisible();
    await expect(subject.getByText(/^Checked /)).toHaveCount(0);
    await expect(subject.getByText('No insolvency or disqualification name matches returned', { exact: true })).toHaveCount(0);
});
