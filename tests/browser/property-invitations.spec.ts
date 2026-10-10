import { test, expect } from '@playwright/test';

test('larger readers stay in the tab and share completion with inline readers', async ({page,context})=>{
    await page.route('**/api/property-applications?*',route=>route.fulfill({json:{noticeVersion:'test-notice'}}));
    await page.goto('/?access=request');
    const privacyButton=page.getByRole('button',{name:'Read privacy notice in a larger window'});
    await privacyButton.click();
    const dialog=page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const privacy=dialog.getByRole('region',{name:'Privacy notice document',exact:true});
    await privacy.focus();await privacy.press('End');
    await expect(dialog.getByText('Reached the end ✓',{exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(privacyButton).toBeFocused();
    await expect(page.getByRole('checkbox')).toBeDisabled();
    await page.locator('summary').filter({hasText:'Terms of use'}).click();
    await page.getByRole('button',{name:'Read terms of use in a larger window'}).click();
    const terms=dialog.getByRole('region',{name:'Terms of use document',exact:true});
    await terms.focus();await terms.press('End');
    await expect(dialog.getByText('Reached the end ✓',{exact:true})).toBeVisible();
    await dialog.getByRole('button',{name:'Close reader ×'}).click();
    await expect(page.getByRole('checkbox')).toBeEnabled();
    expect(context.pages()).toHaveLength(1);
    await page.setViewportSize({width:390,height:844});
    await privacyButton.click();
    const bounds=await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.width).toBeLessThanOrEqual(390);
    await page.screenshot({path:'tmp/notice-larger-mobile.png'});
});

async function reviewDocuments(page: any) {
    await expect(page.getByRole('checkbox')).toBeDisabled();
    const privacy = page.getByRole('region', { name: 'Privacy notice document', exact: true });
    await privacy.focus();
    await privacy.press('End');
    await expect(page.getByText('Privacy notice complete.', { exact: false })).toBeVisible();
    await expect(page.getByRole('checkbox')).toBeDisabled();
    await page.locator('summary').filter({ hasText: 'Terms of use' }).click();
    const terms = page.getByRole('region', { name: 'Terms of use document', exact: true });
    await terms.evaluate((node: HTMLElement) => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll')); });
    await expect(page.getByRole('checkbox')).toBeEnabled();
}

test('request access before signup; show receipt and preserve trusted notice version', async ({ page }) => {
    let posted: any;
    await page.route('**/api/property-applications?*', async route => {
        if (route.request().method() === 'GET') return route.fulfill({json:{noticeVersion:'test-notice'}});
        posted=route.request().postDataJSON();
        return route.fulfill({json:{ok:true,message:'Request received. If approved, you will receive an invitation by email.'}});
    });
    await page.goto('/?access=request');
    await expect(page.getByRole('heading',{name:'Request property access'})).toBeVisible();
    const submit=page.getByRole('button',{name:'Submit for review'});
    await expect(submit).toBeDisabled();
    await page.getByLabel('Email address',{exact:true}).fill('synthetic@example.test');
    await page.getByLabel('Intended property-related use').fill('Property diligence');
    await reviewDocuments(page);
    await page.getByRole('checkbox').check();
    await submit.click();
    await expect(page.getByRole('status').filter({hasText:'Request received'})).toBeVisible();
    expect(posted).toEqual({email:'synthetic@example.test',organisation:'',purpose:'Property diligence',noticeVersion:'test-notice'});
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
});

test('application failures allow retry; invitation without ticket does not offer open signup', async ({ page }) => {
    await page.route('**/api/property-applications?*', async route => route.request().method()==='GET'
        ? route.fulfill({json:{noticeVersion:'test-notice'}})
        : route.fulfill({status:503,json:{message:'Applications are temporarily unavailable.'}}));
    await page.goto('/?access=request');
    await page.getByLabel('Email address',{exact:true}).fill('synthetic@example.test');
    await page.getByLabel('Intended property-related use').fill('Property diligence');
    await reviewDocuments(page);
    await page.getByRole('checkbox').check();
    await page.getByRole('button',{name:'Submit for review'}).click();
    await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
    await expect(page.getByRole('button',{name:'Submit for review'})).toBeEnabled();
    await page.goto('/?access=invite');
    await expect(page.getByRole('heading',{name:'Your invitation starts here'})).toBeVisible();
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
});

test('inline notice fits mobile and resets review on a fresh visit', async ({ page }) => {
    await page.setViewportSize({ width:390, height:844 });
    await page.route('**/api/property-applications?*', route => route.fulfill({json:{noticeVersion:'test-notice'}}));
    await page.goto('/?access=request');
    await reviewDocuments(page);
    await page.getByRole('checkbox').check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.reload();
    await expect(page.getByRole('checkbox')).toBeDisabled();
    await expect(page.getByRole('checkbox')).not.toBeChecked();
});
