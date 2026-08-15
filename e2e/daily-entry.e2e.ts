import { expect, test, type Page } from './fixtures';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

async function openDailyEntry(page: Page) {
  await page.goto('/');
  const introClose = page.getByRole('button', { name: 'Закрыть объяснение' });
  if (await introClose.isVisible()) await introClose.click();
  const startToday = page.getByRole('button', { name: 'Начать с сегодняшнего дня' });
  await expect(startToday).toBeVisible();
  await startToday.click();
}

async function selectEntryDate(page: Page, value: string) {
  const dateInput = page.getByLabel('Дата записи');
  await dateInput.evaluate((input, nextValue) => {
    const dateField = input as HTMLInputElement;
    dateField.value = nextValue;
    dateField.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await expect(dateInput).toHaveValue(value);
}

test('saves a dirty daily entry from the mobile action', async ({ page }) => {
  await openDailyEntry(page);
  const floatingSave = page.locator('.floating-save-button');
  await expect(floatingSave).toBeHidden();

  await page.getByPlaceholder('Например: после прогулки стало легче собраться с мыслями').fill('Проверка мобильного сохранения');
  await expect(floatingSave).toBeVisible();
  await expect(floatingSave).toHaveCSS('position', 'fixed');
  const saveBox = await floatingSave.boundingBox();
  const navigationBox = await page.locator('.bottom-nav').boundingBox();
  expect(saveBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(saveBox!.y + saveBox!.height).toBeLessThan(navigationBox!.y);

  await expect(page.getByText('Черновик сохранён на этом устройстве', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByPlaceholder('Например: после прогулки стало легче собраться с мыслями')).toHaveValue(
    'Проверка мобильного сохранения',
  );
  await expect(page.getByText('Восстановлены несохранённые изменения', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Выбрать цель' }).first().click();
  await page.getByLabel('Что хотите изменить или закончить').fill('Подготовить релиз');
  await page.getByLabel('Как понять, что получилось').fill('Пройти проверку основного сценария');
  await page.getByLabel('Что считать шагом к цели').fill('Проверенный сценарий на staging');
  await page.getByRole('button', { name: 'Сохранить цель' }).click();
  await expect(page.getByLabel('Текущая цель')).toContainText('Подготовить релиз');
  await expect(page.getByPlaceholder('Например: после прогулки стало легче собраться с мыслями')).toHaveValue(
    'Проверка мобильного сохранения',
  );

  await floatingSave.click();
  await expect(page.getByText('День сохранён на устройстве', { exact: true })).toBeVisible();
  await expect(floatingSave).toBeHidden();
});

test('selects and preserves a past daily entry on mobile', async ({ page }) => {
  await openDailyEntry(page);
  const dateInput = page.getByLabel('Дата записи');
  const today = await dateInput.getAttribute('max');
  expect(today).not.toBeNull();
  const pastDate = new Date(`${today}T12:00:00`);
  pastDate.setDate(pastDate.getDate() - 1);
  const pastDateKey = pastDate.toISOString().slice(0, 10);

  await selectEntryDate(page, pastDateKey);
  await expect(page.getByRole('heading', { name: 'Сегодня', exact: true })).toBeHidden();

  const note = page.getByPlaceholder('Например: после прогулки стало легче собраться с мыслями');
  await note.fill('Запись за выбранную дату');
  await page.locator('.floating-save-button').click();
  await expect(page.getByText('День сохранён на устройстве', { exact: true })).toBeVisible();

  await selectEntryDate(page, today!);
  await expect(note).toHaveValue('');
  await selectEntryDate(page, pastDateKey);
  await expect(note).toHaveValue('Запись за выбранную дату');
});
