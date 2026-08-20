import { expect, test } from './fixtures';
import { demoFilePath } from './demo-data';

test('offers the browser install action and keeps the iOS fallback in one guide', async ({ page }) => {
  await page.goto('/settings#install-settings');
  const mobilePlatform = await page.evaluate(() => /iphone|ipad|ipod|android/i.test(navigator.userAgent));
  await page.evaluate(() => {
    Object.defineProperty(globalThis, '__trajectoryInstallPromptCalls', { value: 0, writable: true, configurable: true });
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperties(event, {
      prompt: {
        value: async () => {
          (globalThis as typeof globalThis & { __trajectoryInstallPromptCalls: number }).__trajectoryInstallPromptCalls += 1;
        },
      },
      userChoice: { value: Promise.resolve({ outcome: 'accepted' }) },
    });
    window.dispatchEvent(event);
  });

  const guide = page.locator('#install-settings');
  if (!mobilePlatform) {
    await expect(guide).toBeHidden();
    await expect(page.getByText('Установить на телефон')).toBeHidden();
    return;
  }
  await expect(guide.getByRole('heading', { name: 'Установка на телефон' })).toBeVisible();
  await expect(guide.getByRole('heading', { name: 'Android' })).toBeVisible();
  await expect(guide.getByRole('heading', { name: 'iPhone и iPad' })).toBeVisible();
  await expect(guide.getByText('Откройте сайт в Safari.')).toBeVisible();
  await guide.getByRole('button', { name: 'Установить через браузер' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (globalThis as typeof globalThis & { __trajectoryInstallPromptCalls: number }).__trajectoryInstallPromptCalls),
    )
    .toBe(1);

  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(guide.getByText('Открыто с домашнего экрана')).toBeVisible();
});

test('suggests installation after repeated use and respects Later', async ({ page }) => {
  await page.goto('/settings');
  const mobilePlatform = await page.evaluate(() => /iphone|ipad|ipod|android/i.test(navigator.userAgent));
  await page.locator('input[type="file"]').setInputFiles(demoFilePath);
  await page.getByText('Резервная копия восстановлена', { exact: true }).waitFor();
  await page.goto('/');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: async () => undefined },
      userChoice: { value: Promise.resolve({ outcome: 'dismissed' }) },
    });
    window.dispatchEvent(event);
  });
  const suggestion = page.getByLabel('Установка приложения');
  if (!mobilePlatform) {
    await expect(suggestion).toBeHidden();
    return;
  }
  await expect(suggestion).toBeVisible();
  await expect(suggestion).toContainText('Открывайте «Траекторию» без браузера');
  await suggestion.getByRole('button', { name: 'Позже' }).click();
  await expect(suggestion).toBeHidden();

  await page.reload();
  await expect(suggestion).toBeHidden();
});
