import { test, expect } from '@playwright/test';
import { dismissOverlays } from './helpers';

test.describe('Feed & Navigation @smoke', () => {
  test('community tab loads topics', async ({ page }) => {
    await page.goto('/');
    await dismissOverlays(page);
    await page.locator('#tabCommunity').click();
    await expect(page.locator('#topicsView')).toBeVisible();

    // Wait for topics to load
    await page.waitForTimeout(2000);
    const topicCards = page.locator('.topic-card');

    if (await topicCards.count() > 0) {
      await topicCards.first().click();
      await expect(page.locator('#topicFeedView')).toBeVisible();
    }
  });

  test('composer is hidden when not logged in', async ({ page }) => {
    await page.goto('/');
    await dismissOverlays(page);
    await page.locator('#tabCommunity').click();
    await page.waitForTimeout(2000);

    const topicCards = page.locator('.topic-card');
    if (await topicCards.count() > 0) {
      await topicCards.first().click();
      await expect(page.locator('#topicFeedView')).toBeVisible();

      const composer = page.locator('#feedComposer');
      if (await composer.count() > 0) {
        await expect(composer).toBeHidden();
      }
    }
  });
});

test.describe('Content Filter Validation @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!(window as any).app, { timeout: 15_000 });
  });

  test('content filter blocks phone numbers', async ({ page }) => {
    const result = await page.evaluate(() => {
      return (window as any).app.constructor.name !== undefined
        ? ContentFilter.check('Meu numero e 11 99999-8888')
        : null;
    });
    expect(result).not.toBeNull();
    expect(result!.blocked).toBe(true);
    expect(result!.type).toBe('numero de telefone');
  });

  test('content filter blocks emails', async ({ page }) => {
    const result = await page.evaluate(() => {
      return ContentFilter.check('Me manda email: teste@gmail.com');
    });
    expect(result.blocked).toBe(true);
    expect(result.type).toBe('endereco de email');
  });

  test('content filter blocks URLs', async ({ page }) => {
    const result = await page.evaluate(() => {
      return ContentFilter.check('Acesse https://meuperfil.com.br');
    });
    expect(result.blocked).toBe(true);
  });

  test('content filter blocks social handles', async ({ page }) => {
    const result = await page.evaluate(() => {
      return ContentFilter.check('Me segue @meuperfil123');
    });
    expect(result.blocked).toBe(true);
    expect(result.type).toBe('perfil de rede social');
  });

  test('content filter allows normal text', async ({ page }) => {
    const result = await page.evaluate(() => {
      return ContentFilter.check('Estou me sentindo melhor hoje! Obrigada pelo acolhimento.');
    });
    expect(result.blocked).toBe(false);
  });
});

test.describe('Validation Module @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!(window as any).app, { timeout: 15_000 });
  });

  test('Validation module is loaded', async ({ page }) => {
    const exists = await page.evaluate(() => {
      return typeof Validation !== 'undefined';
    });
    expect(exists).toBe(true);
  });

  test('email validation works', async ({ page }) => {
    const results = await page.evaluate(() => {
      return {
        valid: Validation.email('user@test.com'),
        invalid: Validation.email('not-email'),
        empty: Validation.email(''),
      };
    });
    expect(results.valid.valid).toBe(true);
    expect(results.invalid.valid).toBe(false);
    expect(results.empty.valid).toBe(false);
  });

  test('password validation enforces min 8 chars', async ({ page }) => {
    const results = await page.evaluate(() => {
      return {
        short: Validation.password('1234567'),
        ok: Validation.password('12345678'),
        empty: Validation.password(''),
      };
    });
    expect(results.short.valid).toBe(false);
    expect(results.ok.valid).toBe(true);
    expect(results.empty.valid).toBe(false);
  });

  test('whatsapp validation works', async ({ page }) => {
    const results = await page.evaluate(() => {
      return {
        valid10: Validation.whatsapp('1199998888'),
        valid11: Validation.whatsapp('11999998888'),
        short: Validation.whatsapp('123456'),
        empty: Validation.whatsapp(''),
      };
    });
    expect(results.valid10.valid).toBe(true);
    expect(results.valid11.valid).toBe(true);
    expect(results.short.valid).toBe(false);
    expect(results.empty.valid).toBe(false);
  });

  test('avatar file validation rejects large files', async ({ page }) => {
    const result = await page.evaluate(() => {
      const fakeFile = { type: 'image/png', size: 3 * 1024 * 1024, name: 'big.png' };
      return Validation.avatarFile(fakeFile);
    });
    expect(result.valid).toBe(false);
  });

  test('avatar file validation rejects non-image types', async ({ page }) => {
    const result = await page.evaluate(() => {
      const fakeFile = { type: 'application/pdf', size: 100000, name: 'doc.pdf' };
      return Validation.avatarFile(fakeFile);
    });
    expect(result.valid).toBe(false);
  });
});
