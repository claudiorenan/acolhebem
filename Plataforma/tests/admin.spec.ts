import { test, expect } from '@playwright/test';
import { dismissOverlays } from './helpers';

test.describe('Error Handling & Modules @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!(window as any).app, { timeout: 15_000 });
  });

  test('ErrorHandler module is loaded and initialized', async ({ page }) => {
    const exists = await page.evaluate(() => {
      return typeof ErrorHandler !== 'undefined'
        && typeof ErrorHandler.handle === 'function'
        && typeof ErrorHandler.showToast === 'function';
    });
    expect(exists).toBe(true);
  });

  test('ErrorHandler.showToast displays a toast notification', async ({ page }) => {
    // Dismiss any existing toasts first
    await dismissOverlays(page);

    await page.evaluate(() => {
      ErrorHandler.showToast('Teste de notificacao', 'info', 10000);
    });

    const toast = page.locator('.ab-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Teste de notificacao');
  });

  test('ErrorHandler toast can be dismissed', async ({ page }) => {
    await dismissOverlays(page);

    await page.evaluate(() => {
      ErrorHandler.showToast('Dismiss test', 'warning', 30000);
    });

    const toast = page.locator('.ab-toast');
    await expect(toast).toBeVisible();

    await page.locator('.ab-toast-close').click();
    await expect(toast).toBeHidden({ timeout: 2000 });
  });

  test('all JS modules are loaded without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.waitForTimeout(2000);

    const modules = await page.evaluate(() => {
      return {
        Auth: typeof Auth !== 'undefined',
        Feed: typeof Feed !== 'undefined',
        Profile: typeof Profile !== 'undefined',
        Notifications: typeof Notifications !== 'undefined',
        ErrorHandler: typeof ErrorHandler !== 'undefined',
        Validation: typeof Validation !== 'undefined',
        ContentFilter: typeof ContentFilter !== 'undefined',
      };
    });

    expect(modules.Auth).toBe(true);
    expect(modules.Feed).toBe(true);
    expect(modules.Profile).toBe(true);
    expect(modules.Notifications).toBe(true);
    expect(modules.ErrorHandler).toBe(true);
    expect(modules.Validation).toBe(true);
    expect(modules.ContentFilter).toBe(true);

    // Filter out expected Sentry DSN warnings and Supabase connection errors
    const realErrors = consoleErrors.filter(e =>
      !e.includes('YOUR_DSN_HERE')
      && !e.includes('Sentry')
      && !e.includes('supabase')
      && !e.includes('AcolheBem')
      && !e.includes('Failed to load resource')
      && !e.includes('the server responded with a status of')
    );
    expect(realErrors).toHaveLength(0);
  });

  test('page has correct language attribute', async ({ page }) => {
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('pt-BR');
  });

  test('login button has aria-label', async ({ page }) => {
    await dismissOverlays(page);
    const loginBtn = page.locator('#loginBtn');
    await expect(loginBtn).toHaveAttribute('aria-label');
  });
});
