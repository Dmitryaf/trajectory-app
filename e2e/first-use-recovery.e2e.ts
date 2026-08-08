import { expect, test } from '@playwright/test';

test('saves and resumes the first week recovery on a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Соберите картину прошлой недели' })).toBeVisible();
  await expect(page.locator('.checkin-grid')).toBeHidden();
  await page.getByRole('button', { name: 'Собрать неделю' }).click();
  await expect(page.getByRole('heading', { name: 'Что вам удалось закончить или получить?' })).toBeVisible();

  await page.getByLabel('По одному пункту в строке').fill('Закончил черновик\nОтправил важное письмо');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Что важного произошло?' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Что важного произошло?' })).toBeVisible();

  await page.getByLabel('По одному пункту в строке').fill('Состоялся важный разговор');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Как вы себя чувствовали?' })).toBeVisible();
  await page.getByLabel('Состояние и важные условия').fill('К середине недели было мало сил');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Что помогало, а что мешало?' })).toBeVisible();
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await page.getByRole('button', { name: 'Пока без решения' }).click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Вот чем была наполнена ваша неделя' })).toBeVisible();
  const firstOverview = page.locator('.first-use-overview .weekly-review-overview');
  await expect(firstOverview.getByText('Закончил черновик')).toBeVisible();
  await expect(firstOverview.getByText('Состоялся важный разговор')).toBeVisible();

  const journal = page.locator('.weekly-review-journal');
  await journal.getByText('Добавить точные даты в Журнал').click();
  const resultItem = journal.locator('.weekly-review-journal__item').filter({ hasText: 'Закончил черновик' });
  const eventItem = journal.locator('.weekly-review-journal__item').filter({ hasText: 'Состоялся важный разговор' });
  const exactDate = await resultItem.locator('input[type="date"]').getAttribute('min');
  expect(exactDate).not.toBeNull();
  await resultItem.locator('input[type="date"]').fill(exactDate!);
  await resultItem.locator('select').selectOption('career');
  await resultItem.getByRole('button', { name: /Сохранить в Журнале/ }).click();
  await expect(resultItem.getByText('Уже есть в Журнале')).toBeVisible();
  await eventItem.locator('input[type="date"]').fill(exactDate!);
  await eventItem.locator('select').selectOption('event');
  await eventItem.getByRole('button', { name: /Сохранить в Журнале/ }).click();
  await expect(eventItem.getByText('Уже есть в Журнале')).toBeVisible();

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

  await page.getByRole('button', { name: 'Готово' }).click();
  await expect(page).toHaveURL(/\/week\?week=\d{4}-\d{2}-\d{2}#first-use-overview$/);
  const restoredOverview = page.locator('#first-use-overview');
  await expect(restoredOverview.getByText('Восстановлено по вашим ответам')).toBeVisible();
  await expect(restoredOverview.getByText('К середине недели было мало сил')).toBeVisible();
  await restoredOverview.getByText('Добавить точные даты в Журнал').click();
  await expect(restoredOverview.getByText('Уже есть в Журнале')).toHaveCount(2);

  await restoredOverview.getByRole('link', { name: 'Исправить ответы' }).click();
  await expect(page).toHaveURL(/\/?first-use=edit$/);
  await expect(page.getByRole('heading', { name: 'Что вам удалось закончить или получить?' })).toBeVisible();
  await expect(page.getByLabel('По одному пункту в строке')).toHaveValue('Закончил черновик\nОтправил важное письмо');
});
