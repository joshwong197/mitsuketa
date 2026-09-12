// Opt-in smoke test against a configured Clerk DEVELOPMENT instance and Neon.
// Creates/removes one synthetic user. It never contacts LINZ or sends real email.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), '');
const base = process.argv[2] || 'http://localhost:3000';
assert.ok(env.CLERK_SECRET_KEY?.startsWith('sk_test_'), 'Development Clerk keys are required');
assert.ok(env.DATABASE_URL, 'Neon configuration is required');
assert.ok(env.CLERK_AUTHORIZED_PARTIES?.split(',').includes(new URL(base).origin), 'Use a configured app origin');
Object.assign(process.env, {
    CLERK_SECRET_KEY: env.CLERK_SECRET_KEY,
    CLERK_PUBLISHABLE_KEY: env.CLERK_PUBLISHABLE_KEY,
    CLERK_FAPI: new URL(env.CLERK_ISSUER).host,
});
const client = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
process.env.CLERK_TESTING_TOKEN = (await client.testingTokens.createTestingToken()).token;
const email = `mitsuketa+clerk_test_${crypto.randomUUID()}@example.com`;
const user = await client.users.createUser({ emailAddress: [email], password: `${crypto.randomUUID()}Aa9!` });
const db = neon(env.DATABASE_URL);
let browser;
let stage = 'sign-in';
try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    await page.goto(new URL('/#/app', base).href);
    await clerk.signIn({ page, emailAddress: email });
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.count()) await skip.click();
    await page.getByRole('button', { name: /Property/ }).first().click();
    stage = 'pending account';
    await page.getByText(/Awaiting approval/).waitFor();
    const result = await page.evaluate(async () => {
        const jwt = await window.Clerk.session.getToken();
        const headers = { Authorization: `Bearer ${jwt}` };
        const account = await fetch('/api/property-account?mode=status', { headers });
        const body = await account.json();
        const refused = await fetch('/api/property?mode=title&title_no=NA96C%2F861&ref=CLERK-GATE-TEST', { headers });
        return { code: account.status, body, refused: refused.status };
    });
    assert.equal(result.code, 200);
    assert.equal(result.body.subject, user.id);
    assert.equal(result.body.status, 'pending');
    assert.equal(result.body.canAudit, false);
    assert.equal(result.refused, 403);
    stage = 'application';
    await page.getByLabel('Intended property-related use').fill('Synthetic integration check; not a real applicant.');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await page.getByText('Application received.', { exact: false }).waitFor();
    console.log('PASS: real Clerk sign-in, linked Neon identity, pending access refusal and application submission');
} catch {
    console.error(`FAIL at ${stage}; provider details and credentials withheld`);
    process.exitCode = 1;
} finally {
    await browser?.close();
    // Exact provider identity created above, not an email-based account lookup.
    await db.transaction([
        db.query('DELETE FROM property_access WHERE account_id IN (SELECT id FROM account WHERE auth_issuer=$1 AND auth_subject=$2)', [env.CLERK_ISSUER, user.id]),
        db.query('DELETE FROM account WHERE auth_issuer=$1 AND auth_subject=$2', [env.CLERK_ISSUER, user.id]),
    ]);
    await client.users.deleteUser(user.id);
    console.log('Removed synthetic test account');
}
