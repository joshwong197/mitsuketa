import { expect, type Page } from '@playwright/test';

export const applicationDetails = {
    version: 1,
    fullName: 'Synthetic Applicant',
    role: 'Private individual',
    use: 'Property purchase or ownership',
    volume: '1–10 searches',
    sharing: 'Only me',
    recipients: 'No sharing or publication.',
    safeguards: 'Private device; delete saved reports after review.',
    confirmed: true,
};

export const noticeAcceptance = (page: Page) => page.getByRole('checkbox', { name: /^I have read the privacy notice/ });
export const applicationConfirmation = (page: Page) => page.getByRole('checkbox', { name: /^I confirm these answers/ });

export async function fillApplication(page: Page, purpose = 'Property diligence') {
    await page.getByLabel('Full name', { exact: true }).fill(applicationDetails.fullName);
    await page.getByLabel(/^Your role or capacity/).fill(applicationDetails.role);
    await page.getByLabel('Main reason for access', { exact: true }).selectOption(applicationDetails.use);
    await page.getByLabel(/^What will you use the information for/).fill(purpose);
    await page.getByLabel('Expected searches per month', { exact: true }).selectOption(applicationDetails.volume);
    await page.getByLabel('Who will receive the information?', { exact: true }).selectOption(applicationDetails.sharing);
    await page.getByLabel(/^Tell us about any sharing or publication/).fill(applicationDetails.recipients);
    await page.getByLabel(/^How will you store and protect the information/).fill(applicationDetails.safeguards);
}

export async function reviewNotice(page: Page) {
    await expect(noticeAcceptance(page)).toBeDisabled();
    const notice = page.getByRole('region', { name: 'Privacy notice and terms of use document', exact: true });
    await expect(notice).toHaveCount(1);
    await notice.evaluate(node => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll')); });
    await expect(page.getByRole('status').filter({ hasText: 'You have reached the end.' })).toBeVisible();
    await expect(noticeAcceptance(page)).toBeEnabled();
}
