import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('copies a readable prompt and downloads the lossless weekly package', async ({ page }) => {
  await page.goto('/settings');
  await page.locator('input[type="file"]').setInputFiles('demo/trajectory-test-user-2026-07-20.json');
  await page.getByText('Резервная копия восстановлена', { exact: true }).waitFor();
  await page.goto('/week');
  await expect(page.getByRole('heading', { name: 'Неделя', exact: true })).toBeVisible();

  const copyButton = page.getByRole('button', { name: 'Скопировать промпт' });
  for (let index = 0; index < 8 && !(await copyButton.isVisible()); index += 1) {
    await page.getByRole('button', { name: 'Предыдущий период' }).click();
  }

  await copyButton.click();
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

test('includes daily reflections from an exact cross-month period', async ({ page }) => {
  await page.goto('/settings');
  await page.locator('input[type="file"]').setInputFiles('demo/trajectory-test-user-2026-07-20.json');
  await page.getByText('Резервная копия восстановлена', { exact: true }).waitFor();

  await page.getByText('Выбрать другой период', { exact: true }).click();
  await page.getByLabel('Начало периода анализа').fill('2026-06-15');
  await page.getByLabel('Конец периода анализа').fill('2026-07-02');
  await page.getByRole('button', { name: 'Скопировать промпт периода' }).click();

  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  expect(prompt).toContain('Записи по дням');
  expect(prompt).not.toContain('Покрытие по месяцам');
  expect(prompt).toContain('2026-06');
  expect(prompt).toContain('2 июля 2026 г.');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать данные периода' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const payload = JSON.parse(await readFile(downloadPath!, 'utf8')) as {
    period: string;
    start: string;
    end: string;
    entries: Array<{ date: string }>;
  };

  expect(download.suggestedFilename()).toBe('trajectory-analysis-period-2026-06-15-2026-07-02.json');
  expect(payload.period).toBe('range');
  expect(payload.start).toBe('2026-06-15');
  expect(payload.end).toBe('2026-07-02');
  expect(payload.entries.length).toBeGreaterThan(0);
  expect(payload.entries.every((entry) => entry.date >= payload.start && entry.date <= payload.end)).toBe(true);
});
