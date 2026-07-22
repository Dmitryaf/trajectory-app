import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('copies a readable prompt and downloads the lossless weekly package', async ({ page }) => {
  await page.goto('/week');
  await expect(page.getByRole('heading', { name: 'Неделя', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Скопировать промпт' }).click();
  const prompt = await page.evaluate(() => navigator.clipboard.readText());

  expect(prompt).toContain('ДАННЫЕ ДЛЯ АНАЛИЗА');
  expect(prompt).toContain('за неделю');
  expect(prompt).not.toContain('"generatedAt"');
  expect(prompt).not.toContain('Данные JSON');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать данные' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const payload = JSON.parse(await readFile(downloadPath!, 'utf8')) as Record<string, unknown>;

  expect(download.suggestedFilename()).toMatch(/^trajectory-analysis-week-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.json$/);
  expect(payload.period).toBe('week');
  expect(payload).toHaveProperty('generatedAt');
  expect(payload).toHaveProperty('entries');
  expect(payload).toHaveProperty('settingsSnapshot');
});
