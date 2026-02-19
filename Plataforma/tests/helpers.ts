import { Page } from '@playwright/test';

/**
 * Dismiss the welcome modal and any toast overlays blocking the UI.
 * Call this after page.goto('/') and before interacting with the page.
 */
export async function dismissOverlays(page: Page) {
  // Wait for the app to initialize (window.app is set on DOMContentLoaded)
  await page.waitForFunction(() => !!(window as any).app, { timeout: 15_000 });

  // Dismiss welcome modal if visible
  const skipBtn = page.locator('#modalSkipBtn');
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
  }

  // Dismiss any blocking toasts (may be multiple, use try/catch for race conditions)
  try {
    const toastClose = page.locator('.ab-toast-close').first();
    if (await toastClose.isVisible({ timeout: 1000 }).catch(() => false)) {
      await toastClose.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  } catch {
    // Toast may have auto-dismissed, that's fine
  }
}
