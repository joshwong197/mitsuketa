import { expect, test } from '@playwright/test';

test('pending application, approval review and sandbox checkout use distinct account states', async ({ page }) => {
    const account = { id: 'synthetic', searcher: 'example@example.test', status: 'pending', canAudit: true,
        balance: 0, billing: 'sandbox', noticeVersion: '2026-09-12', accepted_notice_version: null as string | null };
    let application: any, checkout: any;
    await page.route('**/api/property-account?**', async route => {
        const mode = new URL(route.request().url()).searchParams.get('mode');
        let body: any = { ok: true };
        if (mode === 'apply') { application = route.request().postDataJSON(); account.accepted_notice_version = application.noticeVersion; }
        if (mode === 'review') account.status = route.request().postDataJSON().status;
        if (mode === 'status') body = account;
        if (mode === 'members') body = { rows: [{ ...account, email: account.searcher, purpose: 'Property due diligence' }] };
        if (mode === 'checkout') { checkout = route.request().postDataJSON(); body = { url: 'https://checkout.stripe.com/c/pay/synthetic' }; }
        await route.fulfill({ json: body });
    });
    await page.route('https://checkout.stripe.com/**', route => route.fulfill({ body: 'Synthetic checkout — no Stripe request made' }));
    await page.goto('/tests/browser/account-harness.html');
    await expect(page.getByText(/Awaiting approval/)).toBeVisible();
    await expect(page.getByRole('button', { name: '1 pass · NZ$5 (test)', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit for review' })).toBeDisabled();
    await page.getByLabel('Intended property-related use').fill('Property due diligence');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await expect(page.getByText('Application received.', { exact: false })).toBeVisible();
    expect(application.purpose).toBe('Property due diligence');
    await page.getByRole('button', { name: 'Review property applications' }).click();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.getByText('Sandbox billing — no real payments.')).toBeVisible();
    await page.getByRole('button', { name: '1 pass · NZ$5 (test)', exact: true }).click();
    await expect(page).toHaveURL(/checkout\.stripe\.com/);
    expect(checkout.offer).toBe('payg');
    expect(checkout).not.toHaveProperty('accountId');
});

test('privacy notice describes required matter and request metadata', async ({ page }) => {
    await page.goto('/#/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy notice.' })).toBeVisible();
    await expect(page.getByText(/your IP address where available/)).toBeVisible();
    await expect(page.getByText(/A matter reference is required/)).toBeVisible();
    await expect(page.getByText(/automatic expiry is not yet configured/)).toBeVisible();
});
