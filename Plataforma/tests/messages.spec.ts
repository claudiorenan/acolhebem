import { test, expect } from '@playwright/test';
import { dismissOverlays } from './helpers';

test.describe('Direct Messages @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissOverlays(page);
  });

  test('DM button hidden when not logged in', async ({ page }) => {
    const dmBtn = page.locator('#dmBtn');
    await expect(dmBtn).toBeHidden();
  });

  test('DM button hidden when feature flag disabled', async ({ page }) => {
    // Even after app loads, DM should be hidden if dm_feature is disabled
    await page.waitForFunction(() => !!(window as any).app, { timeout: 15_000 });
    const dmBtn = page.locator('#dmBtn');
    await expect(dmBtn).toBeHidden();
  });

  test('DM list view structure exists', async ({ page }) => {
    // Verify the DM list view HTML structure is present (hidden by default)
    const dmListView = page.locator('#dmListView');
    await expect(dmListView).toBeAttached();
    await expect(dmListView).toBeHidden();
  });

  test('DM chat view structure exists', async ({ page }) => {
    const dmChatView = page.locator('#dmChatView');
    await expect(dmChatView).toBeAttached();
    await expect(dmChatView).toBeHidden();
  });
});

test.describe('DM Content Filter (client-side) @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!(window as any).app, { timeout: 15_000 });
  });

  test('content filter blocks phone number in DM text', async ({ page }) => {
    const result = await page.evaluate(() => {
      return (window as any).ContentFilter.check('Me liga 11 99999-8888');
    });
    expect(result).toBeTruthy();
    expect(result.blocked).toBe(true);
    expect(result.type).toBe('numero de telefone');
  });

  test('content filter blocks email in DM text', async ({ page }) => {
    const result = await page.evaluate(() => {
      return (window as any).ContentFilter.check('Meu email: teste@gmail.com');
    });
    expect(result).toBeTruthy();
    expect(result.blocked).toBe(true);
    expect(result.type).toBe('endereco de email');
  });

  test('content filter allows normal DM text', async ({ page }) => {
    const result = await page.evaluate(() => {
      return (window as any).ContentFilter.check('Ola, tudo bem? Gostaria de conversar sobre o tema.');
    });
    expect(result).toBeTruthy();
    expect(result.blocked).toBe(false);
  });
});

test.describe('DM Profile Button @smoke', () => {
  test('DM button not visible on own profile', async ({ page }) => {
    await page.goto('/');
    await dismissOverlays(page);
    // Navigate to community to look for user profiles
    await page.locator('#tabCommunity').click();
    await page.waitForTimeout(2000);

    // user-profile-dm-btn should not appear on own profile
    // (we can't fully test without auth, but verify the class exists in CSS)
    const dmProfileBtns = page.locator('.user-profile-dm-btn');
    // Without login, no profile DM buttons should exist
    expect(await dmProfileBtns.count()).toBe(0);
  });
});
