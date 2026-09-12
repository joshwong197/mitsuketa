// Opt-in DEVELOPMENT test of the actual Clerk modals, including session activation.
// Uses synthetic email codes; no real emails or LINZ requests are sent.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), '');
const base = process.argv[2] || 'http://localhost:3000';
assert.ok(env.CLERK_SECRET_KEY?.startsWith('sk_test_'));
assert.ok(env.DATABASE_URL);
assert.ok(env.CLERK_AUTHORIZED_PARTIES?.split(',').includes(new URL(base).origin));
const client = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
process.env.CLERK_FAPI = new URL(env.CLERK_ISSUER).host;
process.env.CLERK_TESTING_TOKEN = (await client.testingTokens.createTestingToken()).token;
const db = neon(env.DATABASE_URL);
const email = `mitsuketa+clerk_test_${crypto.randomUUID()}@example.com`;
// Exactly eight characters, mixed case + special, no mandatory number.
const password = `A!${Array.from(crypto.getRandomValues(new Uint8Array(6)), n => String.fromCharCode(97 + n % 26)).join('')}`;
let browser;
let stage = 'load';
let subject;
try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    await setupClerkTestingToken({ page });
    await page.goto(new URL('/#/app', base).href);
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.count()) await skip.click();
    await page.getByRole('button', { name: /Property/ }).first().click();
    stage = 'password signup';
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.locator('input[name="emailAddress"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.locator('input[autocomplete="one-time-code"]').first().pressSequentially('424242', { delay: 120 });

    const verifyAccount = async () => {
        await page.getByText(/Awaiting approval/).waitFor();
        const result = await page.evaluate(async () => {
            const token = await window.Clerk.session.getToken();
            const response = await fetch('/api/property-account?mode=status', { headers: { Authorization: `Bearer ${token}` } });
            return { status: response.status, body: await response.json() };
        });
        assert.equal(result.status, 200);
        assert.equal(result.body.status, 'pending');
        assert.equal(result.body.canAudit, false);
        if (subject) assert.equal(result.body.subject, subject);
        subject = result.body.subject;
    };
    stage = 'signup session activation';
    await verifyAccount();
    console.log('PASS: eight-character password signup, email verification and pending Neon account');

    const beginSignIn = async () => {
        await page.evaluate(() => window.Clerk.signOut({ redirectUrl: '/#/app' }));
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await page.locator('input[name="identifier"]').fill(email);
    };
    stage = 'password sign-in';
    await beginSignIn();
    // Clerk may show password alongside the identifier, or on the next step.
    if (!(await page.locator('input[name="password"]').count())) {
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
    }
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await verifyAccount();
    console.log('PASS: password sign-in returns to the same pending account');

    stage = 'email-code sign-in';
    await beginSignIn();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    stage = 'choose email-code method';
    await page.getByText('Use another method', { exact: true }).click();
    stage = 'request email code';
    await page.getByRole('button', { name: /Email code/ }).click();
    stage = 'enter email code';
    await page.locator('input[autocomplete="one-time-code"]').first().pressSequentially('424242', { delay: 120 });
    await verifyAccount();
    console.log('PASS: passwordless email-code sign-in returns to the same pending account');

    stage = 'reload persistence';
    await page.reload();
    await page.getByRole('button', { name: /Property/ }).first().click();
    await verifyAccount();
    console.log('PASS: signed-in account survives page reload');
} catch (error) {
    console.error(`FAIL at ${stage}: ${error.name}; credentials withheld`);
    process.exitCode = 1;
} finally {
    await browser?.close();
    // Only the unique synthetic email generated for this run is eligible for cleanup.
    const users = await client.users.getUserList({ emailAddress: [email] });
    for (const user of users.data) {
        assert.ok(user.emailAddresses.some(address => address.emailAddress === email));
        await db.transaction([
            db.query('DELETE FROM property_access WHERE account_id IN (SELECT id FROM account WHERE auth_issuer=$1 AND auth_subject=$2)', [env.CLERK_ISSUER, user.id]),
            db.query('DELETE FROM account WHERE auth_issuer=$1 AND auth_subject=$2', [env.CLERK_ISSUER, user.id]),
        ]);
        await client.users.deleteUser(user.id);
    }
    console.log('Removed synthetic UI test account');
}
