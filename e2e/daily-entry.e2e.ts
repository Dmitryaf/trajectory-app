import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

test('saves a dirty daily entry from the mobile action', async ({ page }) => {
  await page.goto('/');
  const introClose = page.getByRole('button', { name: 'Закрыть объяснение' });
  if (await introClose.isVisible()) await introClose.click();
  const mobileSave = page.locator('.mobile-save-button');
  const formSave = page.locator('.primary-button--save');
  await expect(mobileSave).toBeHidden();
  await expect(formSave).toBeHidden();

  await page.getByPlaceholder('Например: после прогулки стало легче собраться с мыслями').fill('Проверка мобильного сохранения');
  await expect(mobileSave).toBeVisible();
  await expect(formSave).toBeHidden();
  await expect(mobileSave).toHaveCSS('position', 'fixed');
  const saveBox = await mobileSave.boundingBox();
  const navigationBox = await page.locator('.bottom-nav').boundingBox();
  expect(saveBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(saveBox!.y + saveBox!.height).toBeLessThan(navigationBox!.y);

  await mobileSave.click();
  await expect(page.getByText('День сохранён', { exact: true })).toBeVisible();
  await expect(mobileSave).toBeHidden();
});
