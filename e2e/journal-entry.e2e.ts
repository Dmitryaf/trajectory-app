import { expect, test, type Page } from './fixtures';
import { demoFilePath } from './demo-data';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/settings');
  await page.locator('input[type="file"]').setInputFiles(demoFilePath);
  await page.getByText('Резервная копия восстановлена', { exact: true }).waitFor();
});

async function openEntryChoice(page: Page) {
  await page.goto('/more');
  const addAction = page.getByRole('button', { name: 'Добавить запись' });
  await expect(addAction).toHaveCount(1);
  await addAction.click();
  return page.getByRole('dialog', { name: 'Что хотите сохранить?' });
}

test('adds both existing journal entry types from one action', async ({ page }) => {
  let dialog = await openEntryChoice(page);
  await dialog.getByRole('link', { name: /Итог/ }).click();
  await expect(page).toHaveURL(/\/results\?compose=journal$/);
  const resultTitle = page.getByPlaceholder('Что вы сделали или какой результат получили');
  await expect(resultTitle).toBeFocused();
  await resultTitle.fill('Завершил проверку единого добавления');
  await page.getByPlaceholder('Что произошло, почему это важно или какой контекст стоит сохранить').fill('Проверен новый путь из Журнала');
  await page.getByRole('button', { name: 'Добавить итог' }).click();
  await expect(page.getByText('Итог добавлен', { exact: true })).toBeVisible();
  await expect(page.locator('.result-item').filter({ hasText: 'Завершил проверку единого добавления' })).toBeVisible();

  dialog = await openEntryChoice(page);
  await dialog.getByRole('link', { name: /Событие или наблюдение/ }).click();
  await expect(page).toHaveURL(/\/events\?compose=journal$/);
  const eventTitle = page.getByPlaceholder('Короткое название');
  await expect(eventTitle).toBeFocused();
  await page.getByRole('button', { name: /Мысль или наблюдение/ }).click();
  await eventTitle.fill('Заметил понятный путь к новой записи');
  await page.getByPlaceholder('Что произошло или что вы поняли и почему это важно').fill('Тип выбирается до начала ввода');
  await page.locator('.result-composer .primary-button').click();
  await expect(page.getByText('Событие добавлено', { exact: true })).toBeVisible();
  await expect(page.locator('.timeline-item').filter({ hasText: 'Заметил понятный путь к новой записи' })).toBeVisible();
});

test('keeps a dirty draft until cancellation is confirmed and returns focus after closing the choice', async ({ page }) => {
  let dialog = await openEntryChoice(page);
  await dialog.getByRole('button', { name: 'Отменить' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Добавить запись' })).toBeFocused();

  await page.getByRole('button', { name: 'Добавить запись' }).click();
  dialog = page.getByRole('dialog', { name: 'Что хотите сохранить?' });
  await dialog.getByRole('link', { name: /Итог/ }).click();
  const resultTitle = page.getByPlaceholder('Что вы сделали или какой результат получили');
  await resultTitle.fill('Черновик, который нельзя потерять');

  page.once('dialog', (confirmation) => confirmation.dismiss());
  await page.getByRole('button', { name: 'Отменить добавление' }).click();
  await expect(page).toHaveURL(/\/results\?compose=journal$/);
  await expect(resultTitle).toHaveValue('Черновик, который нельзя потерять');

  page.once('dialog', (confirmation) => confirmation.accept());
  await page.getByRole('button', { name: 'Отменить добавление' }).click();
  await expect(page).toHaveURL(/\/more\?add=1$/);
  dialog = page.getByRole('dialog', { name: 'Что хотите сохранить?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Отменить' }).click();
  await expect(page.getByRole('button', { name: 'Добавить запись' })).toBeFocused();
});
