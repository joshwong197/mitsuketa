import { test, expect } from '@playwright/test';
import { applicationConfirmation, applicationDetails, fillApplication, noticeAcceptance, reviewNotice } from './property-fixtures';

test('one larger reader stays in the tab and shares completion with the inline reader', async ({ page, context }, testInfo) => {
    await page.route('**/api/property-applications?*', route => route.fulfill({ json: { noticeVersion: 'test-notice' } }));
    await page.goto('/?access=request');
    const readLarger = page.getByRole('button', { name: 'Read privacy notice and terms of use in a larger window', exact: true });
    await expect(readLarger).toHaveCount(1);
    await expect(noticeAcceptance(page)).toBeDisabled();
    await readLarger.click();
    const dialog = page.getByRole('dialog', { name: 'Privacy notice and terms of use — larger view' });
    await expect(dialog).toBeVisible();
    const notice = dialog.getByRole('region', { name: 'Privacy notice and terms of use document', exact: true });
    await expect(page.getByRole('region', { name: 'Privacy notice and terms of use document', exact: true })).toHaveCount(1);
    await notice.focus();
    await notice.press('End');
    await expect(dialog.getByText('Reached the end ✓', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(readLarger).toBeFocused();
    await expect(noticeAcceptance(page)).toBeEnabled();
    await expect(page.getByRole('status').filter({ hasText: 'You have reached the end.' })).toBeVisible();
    expect(context.pages()).toHaveLength(1);
    await page.setViewportSize({ width: 390, height: 844 });
    await readLarger.click();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: testInfo.outputPath('notice-larger-mobile.png') });
    await dialog.getByRole('button', { name: 'Close reader ×', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(readLarger).toBeFocused();
    await expect(noticeAcceptance(page)).toBeEnabled();
});

test('request access before signup; require both confirmations and preserve the complete application', async ({ page }) => {
    let posted: any;
    await page.route('**/api/property-applications?*', async route => {
        if (route.request().method() === 'GET') return route.fulfill({ json: { noticeVersion: 'test-notice' } });
        posted = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true, message: 'Request received. If approved, you will receive an invitation by email.' } });
    });
    await page.goto('/?access=request');
    await expect(page.getByRole('heading', { name: 'Apply for access', exact: true })).toBeVisible();
    const submit = page.getByRole('button', { name: 'Submit application' });
    await expect(submit).toBeDisabled();
    await page.getByLabel('Email address', { exact: true }).fill('synthetic@example.test');
    await fillApplication(page);
    await applicationConfirmation(page).check();
    await expect(submit).toBeDisabled();
    await applicationConfirmation(page).uncheck();
    await reviewNotice(page);
    await noticeAcceptance(page).check();
    await expect(submit).toBeDisabled();
    await applicationConfirmation(page).check();
    await expect(submit).toBeEnabled();
    // Native required-field validation must block a network request even after review.
    await page.getByLabel('Full name', { exact: true }).fill('');
    await submit.click();
    await expect(page.getByLabel('Full name', { exact: true })).toBeFocused();
    expect(posted).toBeUndefined();
    await page.getByLabel('Full name', { exact: true }).fill(applicationDetails.fullName);
    await submit.click();
    await expect(page.getByRole('status').filter({ hasText: 'Request received' })).toBeVisible();
    expect(posted).toEqual({ email: 'synthetic@example.test', organisation: '', purpose: 'Property diligence',
        details: applicationDetails, noticeVersion: 'test-notice' });
    await expect(page.getByRole('button', { name: 'Submit application' })).toHaveCount(0);
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
});

test('application failures retain answers and allow retry; invitation without ticket does not offer open signup', async ({ page }) => {
    let attempts = 0;
    const posted: any[] = [];
    await page.route('**/api/property-applications?*', async route => {
        if (route.request().method() === 'GET') return route.fulfill({ json: { noticeVersion: 'test-notice' } });
        posted.push(route.request().postDataJSON());
        if (++attempts === 1) return route.fulfill({ status: 503, json: { message: 'Applications are temporarily unavailable.' } });
        return route.fulfill({ json: { ok: true, message: 'Request received.' } });
    });
    await page.goto('/?access=request');
    await page.getByLabel('Email address', { exact: true }).fill('synthetic@example.test');
    await fillApplication(page);
    await reviewNotice(page);
    await noticeAcceptance(page).check();
    await applicationConfirmation(page).check();
    const submit = page.getByRole('button', { name: 'Submit application' });
    await submit.click();
    await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
    await expect(submit).toBeEnabled();
    await expect(page.getByLabel('Full name', { exact: true })).toHaveValue(applicationDetails.fullName);
    await expect(applicationConfirmation(page)).toBeChecked();
    await expect(noticeAcceptance(page)).toBeChecked();
    await submit.click();
    await expect(page.getByRole('status').filter({ hasText: 'Request received.' })).toBeVisible();
    expect(posted).toHaveLength(2);
    expect(posted[1]).toEqual(posted[0]);
    await page.goto('/?access=invite');
    await expect(page.getByRole('heading', { name: 'Your invitation starts here' })).toBeVisible();
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
});

test('inline notice fits mobile and resets review on a fresh visit', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/property-applications?*', route => route.fulfill({ json: { noticeVersion: 'test-notice' } }));
    await page.goto('/?access=request');
    await reviewNotice(page);
    await noticeAcceptance(page).check();
    await applicationConfirmation(page).check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.reload();
    await expect(noticeAcceptance(page)).toBeDisabled();
    await expect(noticeAcceptance(page)).not.toBeChecked();
    await expect(applicationConfirmation(page)).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Submit application' })).toBeDisabled();
});
