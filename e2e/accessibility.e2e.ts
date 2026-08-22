import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from './fixtures';
import { demoFilePath } from './demo-data';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const criticalRoutes = ['/', '/week', '/month', '/trends', '/more', '/settings'];

test.beforeEach(async ({ page }) => {
  await page.goto('/settings');
  await page.locator('input[type="file"]').setInputFiles(demoFilePath);
  await page.getByText('Резервная копия восстановлена', { exact: true }).waitFor();
});

test('has no serious automated accessibility violations on critical routes', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'One deterministic axe run is enough; interaction coverage stays cross-browser.');
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const route of criticalRoutes) {
    await page.goto(route);
    await page.locator('.page').waitFor();
    await page.addScriptTag({ content: axeSource });
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      });
      return result.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
        }));
    });
    expect(violations, `${route} has serious or critical axe findings`).toEqual([]);
  }
});

test('keeps the critical path keyboard-visible and traps focus in dialogs', async ({ page }) => {
  await page.goto('/');
  const weekLink = page.getByRole('link', { name: 'Неделя' });
  await weekLink.focus();
  await expect(weekLink).toBeFocused();
  expect(await weekLink.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await weekLink.press('Enter');
  await expect(page).toHaveURL(/\/week/);

  await page.getByRole('button', { name: 'Как работает приложение' }).click();
  const dialog = page.getByRole('dialog', { name: 'Зачем нужна «Траектория»' });
  const first = dialog.getByRole('button', { name: 'Закрыть объяснение' });
  const last = dialog.getByRole('link', { name: 'Начать запись' });
  await first.focus();
  await first.press('Shift+Tab');
  await expect(last).toBeFocused();
  await last.press('Tab');
  await expect(first).toBeFocused();
  await first.press('Escape');
  await expect(page.getByRole('button', { name: 'Как работает приложение' })).toBeFocused();
});

test('reflows critical routes at 200 percent without hiding navigation', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  for (const route of criticalRoutes) {
    await page.goto(route);
    await page.locator('.page').waitFor();
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content, `${route} should reflow at 200%`).toBeLessThanOrEqual(widths.viewport);
    await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
  }
});

test('gives chart users the same facts, sample size and limitations in text', async ({ page }) => {
  await page.goto('/trends');
  await page.locator('.trends-metric-details > summary').click();
  const chart = page.getByRole('img', { name: /Динамика:/ });
  const descriptionId = await chart.getAttribute('aria-describedby');
  expect(descriptionId).toBeTruthy();
  const description = page.locator(`#${descriptionId}`);
  await expect(description).toContainText('наблюдений');
  await expect(description).toContainText('Месячные значения');
  await expect(description).toContainText('не доказывает причину');
});

test('announces an asynchronous save result without relying on a visual toast', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Данные и синхронизация' }).click();
  await page.locator('input[type="file"]').setInputFiles(demoFilePath);
  const message = page.getByText('Резервная копия восстановлена', { exact: true }).last();
  await expect(message).toBeVisible();
  expect(await message.evaluate((element) => Boolean(element.closest('[role="status"], [aria-live]')))).toBe(true);
});

declare global {
  interface Window {
    axe: {
      run: (
        context: Document,
        options: { runOnly: { type: 'tag'; values: string[] } },
      ) => Promise<{
        violations: Array<{
          id: string;
          impact: string | null;
          nodes: Array<{ target: unknown; failureSummary?: string }>;
        }>;
      }>;
    };
  }
}
