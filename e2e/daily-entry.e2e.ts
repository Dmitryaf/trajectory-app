import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

test('saves a dirty daily entry from the mobile action', async ({ page }) => {
  await page.goto('/');
  const mobileSave = page.getByRole('button', { name: 'Сохранить день' }).last();
  await expect(mobileSave).toBeHidden();

  await page.getByPlaceholder('Например: разговор заметно изменил настроение на весь день').fill('Проверка мобильного сохранения');
  await expect(mobileSave).toBeVisible();
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
