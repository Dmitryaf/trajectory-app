import { expect, test } from '@playwright/test';

const routes = ['/', '/week', '/month', '/trends', '/more', '/results', '/events', '/settings'];

test.beforeEach(async ({ page }) => {
  await page.goto('/settings');
  await page.locator('input[type="file"]').setInputFiles('demo/trajectory-test-user-2026-07-20.json');
  await page.getByText('Резервная копия восстановлена', { exact: true }).waitFor();
});

test('keeps every primary screen inside the minimum viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });

  for (const route of routes) {
    await page.goto(route);
    await page.locator('.page').waitFor();
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content, `${route} should not scroll horizontally`).toBeLessThanOrEqual(widths.viewport);
    const feedback = page.getByRole('button', { name: 'Обратная связь' });
    await expect(feedback).toBeVisible();
  }
});

test('keeps empty-period actions below their explanatory text', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });

  for (const route of ['/week', '/month']) {
    await page.goto(route);
    const paragraph = page.locator('.period-empty-guide p');
    const action = page.locator('.period-empty-guide .secondary-button');
    const paragraphBox = await paragraph.boundingBox();
    const actionBox = await action.boundingBox();

    expect(paragraphBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    expect(actionBox!.y).toBeGreaterThanOrEqual(paragraphBox!.y + paragraphBox!.height + 10);
  }
});

test('keeps mobile form controls inside their cards', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const overflow = await page.locator('.form-card').evaluateAll((cards) =>
      cards.flatMap((card) => {
        const cardBox = card.getBoundingClientRect();
        return Array.from(card.querySelectorAll('input, textarea, .duration-field'))
          .map((element) => ({ element, box: element.getBoundingClientRect() }))
          .filter(({ box }) => box.left < cardBox.left - 1 || box.right > cardBox.right + 1)
          .map(({ element }) => `${element.tagName.toLowerCase()}#${element.id || element.className}`);
      }),
    );
    expect(overflow, `form controls should stay inside cards at ${width}px`).toEqual([]);
  }
});

test('keeps trend evidence grouped behind compact mobile disclosures', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/trends');

  const insights = page.locator('.dashboard-card--insights');
  const quality = page.locator('.trends-quality-details');
  await expect(insights).toBeVisible();
  await expect(quality).not.toHaveAttribute('open', '');
  const primaryCueCount = await page.locator('.review-cue-grid--primary .review-cue').count();
  expect(primaryCueCount).toBeGreaterThan(0);
  expect(primaryCueCount).toBeLessThanOrEqual(3);

  const insightsBox = await insights.boundingBox();
  const qualityBox = await quality.boundingBox();
  expect(insightsBox).not.toBeNull();
  expect(qualityBox).not.toBeNull();
  expect(qualityBox!.y).toBeGreaterThan(insightsBox!.y);

  await quality.locator(':scope > summary').click();
  await expect(quality).toHaveAttribute('open', '');
  await expect(quality.locator('.metrics-grid')).toBeVisible();
  await expect(quality.locator('.trends-table-details')).toBeVisible();

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});

test('keeps the returning daily form compact and visibly grouped', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  const headingBox = await page.locator('.page--today > .page-heading').boundingBox();
  expect(headingBox).not.toBeNull();
  expect(headingBox!.height).toBeLessThanOrEqual(150);
  await expect(page.getByText('Запись за дату', { exact: true })).toBeVisible();
  await expect(page.getByText('Состояние и условия', { exact: true })).toBeVisible();
  await expect(page.getByText('Действия и области жизни', { exact: true })).toBeVisible();
  await expect(page.getByText('Короткий итог дня', { exact: true })).toBeVisible();
  await expect(page.getByText('Сон перед этой датой и сколько сил было в этот день.', { exact: true })).toBeHidden();
});

test('keeps result details editable when Backspace clears the field', async ({ page }) => {
  await page.goto('/results');
  const details = page.locator('.result-composer textarea');

  await expect(details).toBeVisible();
  await expect(details).toHaveAttribute('rows', '4');
  await details.fill('Т');
  await details.press('Backspace');
  await expect(details).toHaveValue('');
  await expect(details).toBeFocused();
  await details.press('Backspace');
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.locator('.result-composer details')).toHaveCount(0);

  await page.goto('/events');
  await expect(page.locator('.result-composer textarea')).toBeVisible();
  await expect(page.locator('.result-composer textarea')).toHaveAttribute('rows', '4');
});

test('explains the app from the permanent help button', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Как работает приложение' }).click();
  const dialog = page.getByRole('dialog', { name: 'Зачем нужна «Траектория»' });

  await expect(dialog).toContainText('Заполнять всё не обязательно');
  await expect(dialog).toContainText('Журнал: сохранить важное отдельно');
  await expect(dialog).toContainText('Эксперимент: проверить одно изменение');
});

test('opens the exact settings section from a daily card', async ({ page }) => {
  await page.goto('/');
  await page.locator('#life-areas').getByRole('link', { name: 'Настроить' }).click();

  await expect(page).toHaveURL(/\/settings#life-areas$/);
  await expect(page.locator('#life-areas')).toBeInViewport();
});

test('switches settings scenarios with the keyboard on a mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings');

  const dataTab = page.getByRole('button', { name: 'Данные и синхронизация' });
  await dataTab.focus();
  await dataTab.press('Enter');
  await expect(page.locator('#data-settings')).toBeVisible();
  await expect(page.locator('#daily-settings')).toBeHidden();
  await expect(page.locator('.settings-card--cloud')).toBeVisible();
  await expect(page.locator('.settings-card--account')).toBeHidden();

  await page.getByRole('button', { name: 'Аккаунт и безопасность' }).click();
  await expect(page.locator('#account-settings')).toBeVisible();
  await expect(page.locator('#data-settings')).toBeHidden();

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});

test('sends feedback from the built-in form without asking for recipient details', async ({ page }) => {
  let submittedMessage = '';
  await page.route('/api/feedback', async (route) => {
    submittedMessage = ((await route.request().postDataJSON()) as { message: string }).message;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto('/');

  await page.getByRole('button', { name: 'Обратная связь' }).click();
  const dialog = page.getByRole('dialog', { name: 'Написать разработчику' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Предложение, проблема или ошибка').fill('Добавьте короткую подсказку к недельному обзору.');
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click();

  await expect(page.getByText('Спасибо, сообщение отправлено', { exact: true })).toBeVisible();
  expect(submittedMessage).toBe('Добавьте короткую подсказку к недельному обзору.');
});

test('opens period review forms from the summary shortcuts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [route, target] of [
    ['/week', '#week-review'],
    ['/month', '#month-review'],
  ] as const) {
    await page.goto(route);
    const shortcut = page.locator(`a[href="${target}"]`);
    for (let index = 0; index < 8 && !(await shortcut.isVisible()); index += 1) {
      await page.getByRole('button', { name: 'Предыдущий период' }).click();
    }
    await shortcut.click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(page.locator(target)).toBeInViewport();
  }
});

test('keeps monthly records compact and opens the matching archives', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/month');
  await page.getByRole('button', { name: 'Предыдущий период' }).click();
  await expect(page.locator('.month-featured-events')).toBeVisible();
  await expect(page.locator('.month-featured-events').getByRole('link', { name: 'Открыть все события' })).toHaveAttribute(
    'href',
    '/events?from=2026-07-01&to=2026-07-31',
  );
  await expect(page.locator('.month-facts-details')).not.toHaveAttribute('open', '');
  await expect(page.locator('.month-analysis-details')).not.toHaveAttribute('open', '');
  await page.getByText('Показать записи месяца', { exact: true }).click();

  const records = page.locator('.period-records');
  await expect(records.getByText('Итоги месяца', { exact: true })).toBeVisible();
  await expect(records.locator('.period-record-preview').first().locator('li')).toHaveCount(3);
  const lastPreviewBox = await records.locator('.period-record-preview').first().locator('li').last().boundingBox();
  const archiveLinkBox = await records.getByRole('link', { name: 'Открыть все итоги' }).boundingBox();
  expect(lastPreviewBox).not.toBeNull();
  expect(archiveLinkBox).not.toBeNull();
  expect(archiveLinkBox!.y).toBeGreaterThanOrEqual(lastPreviewBox!.y + lastPreviewBox!.height + 10);
  await records.getByText('Конкретные действия и подготовка', { exact: true }).click();
  await expect(records.getByRole('navigation', { name: 'Страницы действий месяца' })).toBeVisible();

  await records.getByRole('link', { name: 'Открыть все итоги' }).click();
  await expect(page).toHaveURL(/\/results\?from=2026-07-01&to=2026-07-31$/);
  await expect(page.getByLabel('Начальная дата итогов')).toHaveValue('2026-07-01');
  await expect(page.getByLabel('Конечная дата итогов')).toHaveValue('2026-07-31');
});

test('shows weekly results and events as compact archive previews', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/week');
  await page.getByRole('button', { name: 'Предыдущий период' }).click();
  await page.getByRole('button', { name: 'Предыдущий период' }).click();
  await page.getByText('Показать показатели и записи недели', { exact: true }).click();

  const records = page.locator('.week-data-details').filter({ hasText: 'Показать показатели и записи недели' });
  await expect(records.getByText('Итоги недели', { exact: true })).toBeVisible();
  await expect(records.getByText('События недели', { exact: true })).toBeVisible();
  await expect(records.getByRole('link', { name: 'Открыть все итоги' })).toHaveAttribute('href', '/results?from=2026-07-20&to=2026-07-26');
  await expect(records.getByRole('link', { name: 'Открыть все события' })).toHaveAttribute('href', '/events?from=2026-07-20&to=2026-07-26');
});

test('keeps desktop navigation visible while the page scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/trends');
  const navigation = page.locator('.bottom-nav');
  await expect(navigation).toHaveCSS('position', 'fixed');
  const initialTop = (await navigation.boundingBox())?.y;

  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
  await expect.poll(async () => (await navigation.boundingBox())?.y).toBe(initialTop);
});

test('keeps desktop navigation clear of the header controls', async ({ page }) => {
  for (const width of [980, 1100, 1280, 1514]) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto('/');

    const brandBox = await page.locator('.brand').boundingBox();
    const navigationBox = await page.locator('.bottom-nav').boundingBox();
    const actionsBox = await page.locator('.header-actions').boundingBox();
    expect(brandBox).not.toBeNull();
    expect(navigationBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(brandBox!.x + brandBox!.width + 8, `brand and navigation overlap at ${width}px`).toBeLessThanOrEqual(navigationBox!.x);
    expect(navigationBox!.x + navigationBox!.width + 8, `navigation and actions overlap at ${width}px`).toBeLessThanOrEqual(actionsBox!.x);
  }
});
