import { expect, test } from './fixtures';

test('saves and resumes the first week recovery on a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Соберите недавнюю неделю' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Эта неделя/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Прошлая неделя/ })).toBeVisible();
  await page.getByRole('radio', { name: /Эта неделя/ }).click();
  await expect(page.locator('.checkin-grid')).toBeHidden();
  await page.getByRole('button', { name: 'Начать обзор' }).click();
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
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole('button', { name: 'Готово' }).click();
  await expect(page).toHaveURL(/\/week\?week=\d{4}-\d{2}-\d{2}#first-use-overview$/);
  const restoredOverview = page.locator('#first-use-overview');
  await expect(restoredOverview.getByText('Восстановлено по вашим ответам')).toBeVisible();
  await expect(restoredOverview.getByText('К середине недели было мало сил')).toBeVisible();
  await restoredOverview.getByText('Добавить точные даты в Журнал').click();
  await expect(restoredOverview.getByText('Уже есть в Журнале')).toHaveCount(2);

  const localFunnel = await page.evaluate(() => window.localStorage.getItem('trajectory:first-use-funnel:v1'));
  expect(localFunnel).not.toBeNull();
  expect(localFunnel).toContain('first_use_recovery_started');
  expect(localFunnel).toContain('first_use_first_answer_saved');
  expect(localFunnel).toContain('first_use_journal_record_saved');
  expect(localFunnel).toContain('first_use_overview_viewed');
  expect(localFunnel).not.toContain('Закончил черновик');
  expect(localFunnel).not.toContain('Состоялся важный разговор');
  expect(localFunnel).not.toContain('К середине недели было мало сил');

  await page.locator('.bottom-nav a[href="/"]').press('Enter');
  await page.locator('.bottom-nav a[href="/week"]').press('Enter');
  await expect(page.locator('.period-nav__label')).toContainText('Текущая неделя');
  await expect(page.locator('#first-use-overview')).toHaveCount(0);
  await expect(page.locator('#week-review textarea').first()).toHaveValue('К середине недели было мало сил');

  await page.getByRole('button', { name: 'Следующий период' }).press('Enter');
  const savedOverviewNotice = page.locator('.recovered-week-link');
  await expect(page.getByText('За эту неделю пока нет записей')).toBeVisible();
  await expect(savedOverviewNotice.getByText('Ваш первый обзор сохранён')).toBeVisible();
  await savedOverviewNotice.getByRole('link', { name: 'Открыть обзор' }).click();

  const reopenedOverview = page.locator('#first-use-overview');
  await reopenedOverview.getByRole('link', { name: 'Исправить ответы' }).click();
  await expect(page).toHaveURL(/\/?first-use=edit$/);
  await expect(page.getByRole('heading', { name: 'Что вам удалось закончить или получить?' })).toBeVisible();
  await expect(page.getByLabel('По одному пункту в строке')).toHaveValue('Закончил черновик\nОтправил важное письмо');
});
