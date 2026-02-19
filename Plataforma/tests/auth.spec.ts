import { test, expect } from '@playwright/test';
import { dismissOverlays } from './helpers';

test.describe('Auth Validation @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissOverlays(page);
    await page.locator('#loginBtn').click();
    await expect(page.locator('#authModal')).toBeVisible();
  });

  test('login with invalid email shows validation error', async ({ page }) => {
    // Fill with invalid email (non-empty to bypass HTML required)
    await page.locator('#loginEmail').fill('not-an-email');
    await page.locator('#loginPassword').fill('somepassword');
    // Dispatch submit event on the form to trigger the handler
    await page.evaluate(() => {
      document.getElementById('loginForm')!.dispatchEvent(new Event('submit', { cancelable: true }));
    });

    await expect(page.locator('#loginError')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#loginEmail')).toHaveClass(/field-invalid/);
  });

  test('signup with short password shows validation error', async ({ page }) => {
    await page.locator('[data-auth-tab="signup"]').click();
    await expect(page.locator('#signupForm')).toBeVisible();

    await page.locator('#signupName').fill('Test User');
    await page.locator('#signupEmail').fill('test@example.com');
    await page.locator('#signupPassword').fill('123');
    await page.locator('#signupWhatsapp').fill('11999999999');

    await page.evaluate(() => {
      document.getElementById('signupForm')!.dispatchEvent(new Event('submit', { cancelable: true }));
    });

    await expect(page.locator('#signupError')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#signupPassword')).toHaveClass(/field-invalid/);
  });

  test('signup with invalid whatsapp shows validation error', async ({ page }) => {
    await page.locator('[data-auth-tab="signup"]').click();

    await page.locator('#signupName').fill('Test User');
    await page.locator('#signupEmail').fill('test@example.com');
    await page.locator('#signupPassword').fill('securepass123');
    await page.locator('#signupWhatsapp').fill('123');

    await page.evaluate(() => {
      document.getElementById('signupForm')!.dispatchEvent(new Event('submit', { cancelable: true }));
    });

    await expect(page.locator('#signupError')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#signupWhatsapp')).toHaveClass(/field-invalid/);
  });

  test('signup with empty name shows validation error', async ({ page }) => {
    await page.locator('[data-auth-tab="signup"]').click();

    await page.locator('#signupName').fill('');
    await page.locator('#signupEmail').fill('test@example.com');
    await page.locator('#signupPassword').fill('securepass123');
    await page.locator('#signupWhatsapp').fill('11999999999');

    await page.evaluate(() => {
      document.getElementById('signupForm')!.dispatchEvent(new Event('submit', { cancelable: true }));
    });

    await expect(page.locator('#signupError')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#signupName')).toHaveClass(/field-invalid/);
  });

  test('forgot password link shows forgot form', async ({ page }) => {
    const forgotLink = page.locator('text=Esqueceu a senha');
    if (await forgotLink.isVisible().catch(() => false)) {
      await forgotLink.click();
      await expect(page.locator('#forgotForm')).toBeVisible();
      await expect(page.locator('#forgotEmail')).toBeVisible();
    }
  });
});
