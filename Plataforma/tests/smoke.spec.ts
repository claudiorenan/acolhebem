import { test, expect } from '@playwright/test';
import { dismissOverlays } from './helpers';

test.describe('Smoke Tests @smoke', () => {
  test('page loads with title and topbar', async ({ page }) => {
    await page.goto('/');
    await dismissOverlays(page);
    await expect(page).toHaveTitle(/AcolheBem/);
    await expect(page.locator('.topbar-logo')).toBeVisible();
  });

  test('all tab buttons are visible', async ({ page }) => {
    await page.goto('/');
    await dismissOverlays(page);
    await expect(page.locator('#tabWomen')).toBeVisible();
    await expect(page.locator('#tabMen')).toBeVisible();
    await expect(page.locator('#tabCommunity')).toBeVisible();
    await expect(page.locator('#tabPsicologos')).toBeVisible();
  });

  test('navigating between tabs works', async ({ page }) => {
    await page.goto('/');
    await dismissOverlays(page);

    await page.locator('#tabCommunity').click();
    await expect(page.locator('#topicsView')).toBeVisible();

    await page.locator('#tabPsicologos').click();
    await expect(page.locator('#psicologosSection')).toBeVisible();

    await page.locator('#tabWomen').click();
    await expect(page.locator('#mainBody')).toBeVisible();
    await expect(page.locator('#tabWomen')).toHaveClass(/active/);

    await page.locator('#tabMen').click();
    await expect(page.locator('#mainBody')).toBeVisible();
    await expect(page.locator('#tabMen')).toHaveClass(/active/);
  });

  test('login button opens auth modal', async ({ page }) => {
    await page.goto('/');
    await dismissOverlays(page);
    await page.locator('#loginBtn').click();
    await expect(page.locator('#authModal')).toBeVisible();
    await expect(page.locator('#loginEmail')).toBeVisible();
    await expect(page.locator('#loginPassword')).toBeVisible();
  });

  test('auth modal has login and signup tabs', async ({ page }) => {
    await page.goto('/');
    await dismissOverlays(page);
    await page.locator('#loginBtn').click();
    await expect(page.locator('[data-auth-tab="login"]')).toBeVisible();
    await expect(page.locator('[data-auth-tab="signup"]')).toBeVisible();
  });

  test('switching to signup tab shows signup form', async ({ page }) => {
    await page.goto('/');
    await dismissOverlays(page);
    await page.locator('#loginBtn').click();
    await page.locator('[data-auth-tab="signup"]').click();
    await expect(page.locator('#signupForm')).toBeVisible();
    await expect(page.locator('#signupName')).toBeVisible();
    await expect(page.locator('#signupEmail')).toBeVisible();
    await expect(page.locator('#signupPassword')).toBeVisible();
    await expect(page.locator('#signupWhatsapp')).toBeVisible();
  });

  test('community tab shows topics view', async ({ page }) => {
    await page.goto('/');
    await dismissOverlays(page);
    await page.locator('#tabCommunity').click();
    await expect(page.locator('#topicsView')).toBeVisible();
  });
});
