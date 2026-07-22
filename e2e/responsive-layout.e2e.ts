import { expect, test } from '@playwright/test';

const routes = ['/', '/week', '/month', '/trends', '/more', '/results', '/events', '/settings'];

test.beforeEach(async ({ page }) => {
  await page.goto('/settings');
  await page.locator('input[type="file"]').setInputFiles('demo/trajectory-test-user-2026-07-20.json');
  await page.getByText('Резервная копия восстановлена', { exact: true }).waitFor();
});

test('keeps every primary screen inside the minimum viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });

  for (const route of routes) {
    await page.goto(route);
    await page.locator('.page').waitFor();
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content, `${route} should not scroll horizontally`).toBeLessThanOrEqual(widths.viewport);
  }
});

test('opens period review forms from the summary shortcuts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [route, target] of [['/week', '#week-review'], ['/month', '#month-review']] as const) {
    await page.goto(route);
    await page.locator(`a[href="${target}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(page.locator(target)).toBeInViewport();
  }
});

test('keeps desktop navigation visible while the page scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/trends');
  const navigation = page.locator('.bottom-nav');
  await expect(navigation).toHaveCSS('position', 'fixed');
  const initialTop = (await navigation.boundingBox())?.y;

  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
  await expect.poll(async () => (await navigation.boundingBox())?.y).toBe(initialTop);
});
