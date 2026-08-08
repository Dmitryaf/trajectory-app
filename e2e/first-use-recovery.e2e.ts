import { expect, test } from '@playwright/test';

test('saves and resumes the first week recovery on a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Соберите картину прошлой недели' })).toBeVisible();
  await expect(page.locator('.checkin-grid')).toBeHidden();
  await page.getByRole('button', { name: 'Собрать неделю' }).click();
  await expect(page.getByRole('heading', { name: 'Что вам удалось закончить или получить?' })).toBeVisible();

  await page.getByLabel('По одному пункту в строке').fill('Закончил черновик\nОтправил важное письмо');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByRole('heading', { name: 'Что важного произошло?' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Что важного произошло?' })).toBeVisible();

  const mobileWidth = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(mobileWidth.content).toBeLessThanOrEqual(mobileWidth.viewport);

  await page.setViewportSize({ width: 1280, height: 900 });
  const desktopWidth = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(desktopWidth.content).toBeLessThanOrEqual(desktopWidth.viewport);
});
