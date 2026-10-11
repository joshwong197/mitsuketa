import { expect, test } from '@playwright/test';
import { applicationConfirmation, applicationDetails, fillApplication, noticeAcceptance, reviewNotice } from './property-fixtures';

test('pending application and approval review preserve answers without offering payment', async ({ page }) => {
    const account = { id: 'synthetic', searcher: 'example@example.test', status: 'pending', canAudit: true,
        balance: 0, billing: 'sandbox', noticeVersion: '2026-09-12', accepted_notice_version: null as string | null };
    let application: any;
    const accountRequests: string[] = [];
    await page.route('**/api/property-account?**', async route => {
        const mode = new URL(route.request().url()).searchParams.get('mode')!;
        accountRequests.push(mode);
        let body: any = { ok: true };
        if (mode === 'status') body = account;
        if (mode === 'acceptance-history' || mode === 'privacy-requests') body = { rows: [] };
        if (mode === 'retention-review') body = { configured: false, rows: [], scope: 'Synthetic fixture only.' };
        await route.fulfill({ json: body });
    });
    await page.route('**/api/property-applications?**', async route => {
        const mode = new URL(route.request().url()).searchParams.get('mode');
        let body: any = { ok: true };
        if (mode === 'notice') body = { noticeVersion: account.noticeVersion };
        if (mode === 'apply') {
            application = route.request().postDataJSON();
            account.accepted_notice_version = application.noticeVersion;
            body = { message: 'Application received.' };
        }
        if (mode === 'invite') account.status = 'approved';
        if (mode === 'list') body = { rows: application ? [{ id: 'application-1', email: account.searcher,
            organisation: '', purpose: application.purpose, application_details: application.details,
            status: account.status === 'approved' ? 'approved' : 'pending',
            invitation_state: account.status === 'approved' ? 'sent' : null,
            expires_at: '2099-10-01T00:00:00Z' }] : [] };
        await route.fulfill({ json: body });
    });
    await page.goto('/tests/browser/account-harness.html');
    await expect(page.getByText(/Awaiting approval/)).toBeVisible();
    await expect(page.getByRole('button', { name: /pass.*NZ\$|checkout|top.?up/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit application' })).toBeDisabled();
    await fillApplication(page, 'Property due diligence');
    await reviewNotice(page);
    await noticeAcceptance(page).check();
    await applicationConfirmation(page).check();
    await page.getByRole('button', { name: 'Submit application' }).click();
    await expect(page.getByText('Application received.', { exact: true })).toBeVisible();
    expect(application).toEqual({ email: account.searcher, organisation: '', purpose: 'Property due diligence',
        details: applicationDetails, noticeVersion: account.noticeVersion });
    await page.getByRole('button', { name: 'Review access requests' }).click();
    const answers = page.locator('.application-review-answers');
    for (const answer of Object.values(applicationDetails).filter(value => typeof value === 'string')) {
        await expect(answers.getByText(answer as string, { exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Approve & invite', exact: true }).click();
    await expect(page.getByText('Invited · awaiting signup', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Refresh access', exact: true }).click();
    await expect(page.getByText(`${account.searcher} · approved`, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit application' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /pass.*NZ\$|checkout|top.?up/i })).toHaveCount(0);
    await expect(page.getByText(/Sandbox billing|search balance/i)).toHaveCount(0);
    expect(accountRequests).not.toContain('checkout');
    await expect(page).toHaveURL(/account-harness\.html$/);
});

test('approved accounts must accept the current notice and LINZ licence before continuing', async ({ page }) => {
    const account = { id: 'synthetic', searcher: 'example@example.test', status: 'approved', canAudit: false,
        balance: 0, billing: 'off', noticeVersion: 'test-current', accepted_notice_version: 'test-old',
        legal: { documentSet: 'test-document-set', release: 'test-release', linzVersion: 'test-linz', linzUrl: 'https://example.test/licence' } };
    let acceptance: any;
    await page.route('**/api/property-account?**', async route => {
        const mode = new URL(route.request().url()).searchParams.get('mode');
        if (mode === 'accept-notice') {
            acceptance = route.request().postDataJSON();
            account.accepted_notice_version = acceptance.noticeVersion;
        }
        await route.fulfill({ json: mode === 'status' ? account : { ok: true } });
    });
    await page.goto('/tests/browser/account-harness.html');
    const continueButton = page.getByRole('button', { name: 'Continue to Property' });
    await expect(continueButton).toBeDisabled();
    await reviewNotice(page);
    await noticeAcceptance(page).check();
    await expect(continueButton).toBeDisabled();
    await page.getByRole('checkbox', { name: /^I agree to the LINZ Licence/ }).check();
    await continueButton.click();
    await expect(continueButton).toHaveCount(0);
    expect(acceptance).toEqual({ noticeVersion: 'test-current', documentSet: 'test-document-set',
        acceptTerms: true, acknowledgePrivacy: true, acceptLinz: true });
});

test('privacy notice describes required matter and request metadata', async ({ page }) => {
    await page.goto('/#/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy notice.' })).toBeVisible();
    await expect(page.getByText(/your IP address where available/)).toBeVisible();
    await expect(page.getByText(/A matter reference is required/)).toBeVisible();
    await expect(page.getByText(/automatic expiry is not yet configured/)).toBeVisible();
});
