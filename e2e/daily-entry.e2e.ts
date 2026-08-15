import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

test('saves a dirty daily entry from the mobile action', async ({ page }) => {
  await page.goto('/');
  const introClose = page.getByRole('button', { name: 'Закрыть объяснение' });
  if (await introClose.isVisible()) await introClose.click();
  const startToday = page.getByRole('button', { name: 'Начать с сегодняшнего дня' });
  await expect(startToday).toBeVisible();
  await startToday.click();
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
