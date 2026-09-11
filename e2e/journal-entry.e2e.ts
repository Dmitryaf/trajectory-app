import { expect, test } from './fixtures';
import { demoFilePath } from './demo-data';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/settings');
  await page.locator('input[type="file"]').setInputFiles(demoFilePath);
  await page.getByText('Резервная копия восстановлена', { exact: true }).waitFor();
});

test('adds both journal entry types through their direct section links', async ({ page }) => {
  await page.goto('/more');
  await expect(page.getByRole('button', { name: 'Добавить запись' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Что хотите сохранить?' })).toHaveCount(0);
  await expect(page.locator('.journal-guide-card')).toHaveCount(0);

  const resultsLink = page.locator('a.more-card[href="/results"]');
  await resultsLink.focus();
  await expect(resultsLink).toBeFocused();
  await resultsLink.press('Enter');
  await expect(page).toHaveURL(/\/results$/);
  const resultTitle = page.getByPlaceholder('Что вы сделали или какой результат получили');
  await resultTitle.fill('Завершил проверку прямого добавления');
  await page.getByPlaceholder('Что произошло, почему это важно или какой контекст стоит сохранить').fill('Проверен прямой путь из Журнала');
  await page.getByRole('button', { name: 'Добавить итог' }).click();
  await expect(page.getByText('Итог добавлен', { exact: true })).toBeVisible();
  await expect(page.locator('.result-item').filter({ hasText: 'Завершил проверку прямого добавления' })).toBeVisible();

  await page.goto('/more');
  const eventsLink = page.locator('a.more-card[href="/events"]');
  await eventsLink.focus();
  await expect(eventsLink).toBeFocused();
  await eventsLink.press('Enter');
  await expect(page).toHaveURL(/\/events$/);
  const eventTitle = page.getByPlaceholder('Короткое название');
  await page.getByRole('button', { name: /Мысль или наблюдение/ }).click();
  await eventTitle.fill('Заметил прямой путь к новой записи');
  await page.getByPlaceholder('Что произошло или что вы поняли и почему это важно').fill('Тип выбирается в форме раздела');
  await page.locator('.result-composer .primary-button').click();
  await expect(page.getByText('Событие добавлено', { exact: true })).toBeVisible();
  await expect(page.locator('.timeline-item').filter({ hasText: 'Заметил прямой путь к новой записи' })).toBeVisible();
});

test('does not revive the removed journal modal or composer return from legacy queries', async ({ page }) => {
  await page.goto('/more?add=1');
  await expect(page.locator('a.more-card[href="/results"]')).toBeVisible();
  await expect(page.locator('a.more-card[href="/events"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Добавить запись' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Что хотите сохранить?' })).toHaveCount(0);

  for (const route of ['/results?compose=journal', '/events?compose=journal']) {
    await page.goto(route);
    await expect(page.locator('.archive-composer')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Отменить добавление' })).toHaveCount(0);
  }
});

test('keeps cancellation for the remaining archive edit scenarios', async ({ page }) => {
  await page.goto('/results');
  const resultTitle = page.getByPlaceholder('Что вы сделали или какой результат получили');
  await page.getByRole('button', { name: 'Редактировать итог' }).first().click();
  await resultTitle.fill('Изменение, которое не нужно сохранять');
  await page.getByRole('button', { name: 'Отменить редактирование' }).click();
  await expect(resultTitle).toHaveValue('');
  await expect(page.getByText('Изменение, которое не нужно сохранять', { exact: true })).toHaveCount(0);

  await page.goto('/events');
  const eventTitle = page.getByPlaceholder('Короткое название');
  await page.getByRole('button', { name: 'Редактировать событие' }).first().click();
  await eventTitle.fill('Другое несохранённое изменение');
  await page.getByRole('button', { name: 'Отменить редактирование' }).click();
  await expect(eventTitle).toHaveValue('');
  await expect(page.getByText('Другое несохранённое изменение', { exact: true })).toHaveCount(0);
});
