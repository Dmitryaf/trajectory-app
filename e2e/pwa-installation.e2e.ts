import { expect, test } from './fixtures';

test('offers the browser install action and keeps the iOS fallback in one guide', async ({ page }) => {
  await page.goto('/settings#install-settings');
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
  await expect(guide.getByRole('heading', { name: 'Установка на телефон' })).toBeVisible();
  await expect(guide.getByText('Откройте сайт именно в Safari.')).toBeVisible();
  await guide.getByRole('button', { name: 'Установить через браузер' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (globalThis as typeof globalThis & { __trajectoryInstallPromptCalls: number }).__trajectoryInstallPromptCalls),
    )
    .toBe(1);

  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(guide.getByText('Открыто с домашнего экрана')).toBeVisible();
});
