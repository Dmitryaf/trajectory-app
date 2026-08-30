import { expect, test } from './fixtures';
import type { Locator } from '@playwright/test';
import { demoAnchor, demoFilePath, emptyPeriodDate } from './demo-data';

const routes = ['/', '/week', '/month', '/trends', '/more', '/results', '/events', '/settings'];

async function expectPeriodDetailsChrome(details: Locator) {
  await expect(details).toHaveCSS('border-top-style', 'solid');
  await expect(details).toHaveCSS('border-top-color', 'rgb(220, 229, 225)');
  await expect(details).toHaveCSS('border-radius', '16px');
  await expect(details).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.72)');
  const summary = details.locator(':scope > summary');
  await expect(summary).toHaveCSS('padding-top', '16px');
  await expect(summary).toHaveCSS('padding-right', '18px');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/settings');
  await page.locator('input[type="file"]').setInputFiles(demoFilePath);
  await page.getByText('Резервная копия восстановлена', { exact: true }).waitFor();
});

test('keeps every primary screen inside the minimum viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });

  for (const route of routes) {
    await page.goto(route);
    await page.locator('.page').waitFor();
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    const offenders =
      layout.content > layout.viewport
        ? await page.evaluate(
            (viewport) =>
              [...document.querySelectorAll<HTMLElement>('body *')]
                .map((element) => {
                  const rect = element.getBoundingClientRect();
                  const style = getComputedStyle(element);
                  const selector = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${[...element.classList]
                    .slice(0, 3)
                    .map((name) => `.${name}`)
                    .join('')}`;
                  return {
                    selector,
                    left: Math.round(rect.left * 10) / 10,
                    right: Math.round(rect.right * 10) / 10,
                    width: Math.round(rect.width * 10) / 10,
                    clientWidth: element.clientWidth,
                    scrollWidth: element.scrollWidth,
                    display: style.display,
                    position: style.position,
                    overflowX: style.overflowX,
                  };
                })
                .filter(
                  (item) =>
                    item.left < -0.5 ||
                    item.right > viewport + 0.5 ||
                    (item.overflowX === 'visible' && item.scrollWidth > item.clientWidth + 1),
                )
                .slice(0, 12),
            layout.viewport,
          )
        : [];
    expect(layout.content, `${route} should not scroll horizontally; offenders: ${JSON.stringify(offenders)}`).toBeLessThanOrEqual(
      layout.viewport,
    );
    const feedback = page.getByRole('button', { name: 'Обратная связь' });
    await expect(feedback).toBeVisible();
  }
});

test('shows an unknown user route and returns to Today with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/missing-page');

  await expect(page.getByRole('heading', { name: 'Такой страницы нет' })).toBeVisible();
  await expect(page).toHaveTitle('Страница не найдена · Траектория');
  await page.getByRole('link', { name: 'Перейти к «Сегодня»' }).focus();
  await page.getByRole('link', { name: 'Перейти к «Сегодня»' }).press('Enter');
  await expect(page).toHaveURL(/\/$/);
});

test('keeps empty-period actions below their explanatory text', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const emptyDate = emptyPeriodDate();

  async function expectEmptyGuideSpacing() {
    const paragraph = page.locator('.period-empty-guide p');
    const action = page.locator('.period-empty-guide .secondary-button');
    const paragraphBox = await paragraph.boundingBox();
    const actionBox = await action.boundingBox();

    expect(paragraphBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    expect(actionBox!.y).toBeGreaterThanOrEqual(paragraphBox!.y + paragraphBox!.height + 10);
  }

  await page.goto(`/week?week=${emptyDate}`);
  await expectEmptyGuideSpacing();
  await page.goto('/month');
  for (let index = 0; index < 5; index += 1) {
    await page.getByRole('button', { name: 'Предыдущий период' }).click();
  }
  await expectEmptyGuideSpacing();
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

    const quickCaptureBox = await page.locator('.quick-capture').boundingBox();
    const goalSummaryBox = await page.locator('.current-goal-summary').boundingBox();
    expect(quickCaptureBox).not.toBeNull();
    expect(goalSummaryBox).not.toBeNull();
    expect(goalSummaryBox!.y, `goal should stay below quick actions at ${width}px`).toBeGreaterThanOrEqual(
      quickCaptureBox!.y + quickCaptureBox!.height + 12,
    );
  }
});

test('separates the custom-period action from adjacent review content', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ['/week', '/month', '/trends']) {
    await page.goto(route);
    const action = page.locator('.range-custom-action');
    await expect(action).toBeVisible();
    const spacing = await action.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const previousBox = element.previousElementSibling?.getBoundingClientRect();
      const nextBox = element.nextElementSibling?.getBoundingClientRect();
      const linkBox = element.querySelector('a')?.getBoundingClientRect();
      return {
        before: previousBox ? box.top - previousBox.bottom : 0,
        after: nextBox ? nextBox.top - box.bottom : 0,
        linkInside: linkBox ? linkBox.left >= box.left && linkBox.right <= box.right : false,
      };
    });

    expect(spacing.before, `${route} should leave space before the custom-period action`).toBeGreaterThanOrEqual(14);
    expect(spacing.after, `${route} should leave space after the custom-period action`).toBeGreaterThanOrEqual(12);
    expect(spacing.linkInside, `${route} action should stay inside its card`).toBe(true);
  }
});

test('keeps change history visible and one metric behind a compact mobile disclosure', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/trends');

  const insights = page.locator('.dashboard-card--insights');
  const history = page.locator('.history-timeline--featured');
  const metric = page.locator('.trends-metric-details');
  await expect(insights).toBeVisible();
  await expect(history).toBeVisible();
  await expect(metric).not.toHaveAttribute('open', '');
  await expect(history.locator('.decision-timeline__item')).toHaveCount(10);
  await expect(history.locator('.archive-pagination')).toBeVisible();
  await expect(history.locator('.archive-pagination span')).toHaveText(/^1 из \d+$/);
  const primaryCueCount = await page.locator('.review-cue-grid--primary .review-cue').count();
  expect(primaryCueCount).toBeGreaterThan(0);
  expect(primaryCueCount).toBeLessThanOrEqual(3);

  const insightsBox = await insights.boundingBox();
  const historyBox = await history.boundingBox();
  expect(insightsBox).not.toBeNull();
  expect(historyBox).not.toBeNull();
  expect(historyBox!.y).toBeGreaterThan(insightsBox!.y);

  await metric.locator(':scope > summary').click();
  await expect(metric).toHaveAttribute('open', '');
  await expect(metric.locator('.metric-switcher')).toBeVisible();
  await expect(page.locator('.trend-table')).toHaveCount(0);

  const list = history.locator('.history-timeline__list');
  const initialListHeight = await list.evaluate((element) => element.getBoundingClientRect().height);
  await history.locator('.archive-pagination button', { hasText: 'Дальше' }).click();
  const transitionHeights = await list.evaluate(
    (element) =>
      new Promise<number[]>((resolve) => {
        const heights: number[] = [];
        const startedAt = performance.now();
        const sample = () => {
          heights.push(element.getBoundingClientRect().height);
          if (performance.now() - startedAt >= 400) {
            resolve(heights);
            return;
          }
          requestAnimationFrame(sample);
        };
        sample();
      }),
  );
  await expect(history.locator('.decision-timeline__item')).toHaveCount(10);
  await expect(history.locator('.archive-pagination span')).toHaveText(/^2 из \d+$/);
  const finalListHeight = transitionHeights.at(-1)!;
  expect(Math.max(...transitionHeights)).toBeLessThanOrEqual(Math.max(initialListHeight, finalListHeight) + 2);

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
  await expect(page.locator('form').getByText('Текущая цель', { exact: true })).toBeVisible();
  await expect(page.getByText('Остальные части дня', { exact: true })).toBeVisible();
  await expect(page.getByText('Короткий итог дня', { exact: true })).toBeVisible();
  await expect(page.getByText('Сон перед этой датой и сколько сил было в этот день.', { exact: true })).toBeHidden();

  const goalCard = page.locator('#goal-actions');
  const workCard = page.locator('#career');
  const goalBox = await goalCard.boundingBox();
  const workBox = await workCard.boundingBox();
  expect(goalBox).not.toBeNull();
  expect(workBox).not.toBeNull();
  expect(goalBox!.y).toBeLessThan(workBox!.y);
  await expect(workCard.locator('textarea')).toHaveCount(0);

  const goalSummaryBox = await page.locator('.current-goal-summary').boundingBox();
  const quickCaptureBox = await page.locator('.quick-capture').boundingBox();
  expect(goalSummaryBox).not.toBeNull();
  expect(quickCaptureBox).not.toBeNull();
  expect(goalSummaryBox!.y).toBeGreaterThanOrEqual(quickCaptureBox!.y + quickCaptureBox!.height + 12);

  const dailySummaryHeadingBox = await page.getByText('Короткий итог дня', { exact: true }).boundingBox();
  const dailySummaryCardBox = await page.locator('.form-card--daily-summary').boundingBox();
  expect(dailySummaryHeadingBox).not.toBeNull();
  expect(dailySummaryCardBox).not.toBeNull();
  expect(dailySummaryCardBox!.y).toBeGreaterThan(dailySummaryHeadingBox!.y + dailySummaryHeadingBox!.height);

  const goalCriteria = goalCard.locator('.goal-context-details');
  await expect(goalCriteria).not.toHaveAttribute('open', '');
  await goalCriteria.locator('summary').focus();
  await goalCriteria.locator('summary').press('Enter');
  await expect(goalCriteria).toHaveAttribute('open', '');

  await page.getByPlaceholder('Например: после прогулки стало легче собраться с мыслями').fill('Проверка fixed-сохранения');
  const floatingSave = page.locator('.floating-save-button');
  await expect(floatingSave).toBeVisible();
  await expect(floatingSave).toHaveCSS('position', 'fixed');
  const floatingSaveBox = await floatingSave.boundingBox();
  expect(floatingSaveBox).not.toBeNull();
  expect(floatingSaveBox!.x + floatingSaveBox!.width).toBeLessThanOrEqual(1280);
  expect(floatingSaveBox!.y + floatingSaveBox!.height).toBeLessThanOrEqual(720);
});

test('keeps the save action above tablet bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await page.getByPlaceholder('Например: после прогулки стало легче собраться с мыслями').fill('Проверка сохранения на планшете');

  const floatingSave = page.locator('.floating-save-button');
  const bottomNavigation = page.locator('.bottom-nav');
  await expect(floatingSave).toBeVisible();
  const floatingSaveBox = await floatingSave.boundingBox();
  const bottomNavigationBox = await bottomNavigation.boundingBox();
  expect(floatingSaveBox).not.toBeNull();
  expect(bottomNavigationBox).not.toBeNull();
  expect(floatingSaveBox!.y + floatingSaveBox!.height).toBeLessThanOrEqual(bottomNavigationBox!.y - 10);
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 320));
  const scrollBeforeOpen = await page.evaluate(() => window.scrollY);
  await page.getByRole('button', { name: 'Как работает приложение' }).click();
  const dialog = page.getByRole('dialog', { name: 'Зачем нужна «Траектория»' });

  await expect(dialog.locator('.help-steps > li')).toHaveCount(3);
  await expect(dialog).toContainText('Записать важное');
  await expect(dialog).toContainText('Увидеть период целиком');
  await expect(dialog).toContainText('Сохранить следующее решение');
  await expect(page.locator('body')).toHaveCSS('position', 'fixed');
  const dialogActions = dialog.locator(':scope > .help-dialog__actions > a');
  const analysisLink = dialog.getByRole('link', { name: 'Подготовить текст для нейросети' });
  await expect(analysisLink).toHaveCSS('display', 'flex');
  await expect(analysisLink).toHaveCSS('background-color', 'rgb(233, 238, 234)');
  await expect(dialogActions).toHaveCount(2);
  await expect(dialogActions.nth(0)).toHaveCSS('text-align', 'center');
  await expect(dialogActions.nth(1)).toHaveCSS('text-align', 'center');
  await page.getByRole('button', { name: 'Закрыть объяснение' }).click();
  await expect(page.getByRole('button', { name: 'Как работает приложение' })).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeOpen);

  await page.getByRole('button', { name: 'Как работает приложение' }).click();
  await dialog.getByRole('link', { name: 'Настроить записи' }).click();
  await expect(page).toHaveURL(/\/settings#daily-settings$/);
  await expect(page.getByRole('button', { name: 'Ежедневная запись' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#daily-settings')).toBeVisible();
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
  await expect(page.locator('#data-settings')).toHaveCSS('animation-name', 'page-in');
  await expect(page.locator('#daily-settings')).toBeHidden();
  await expect(page.locator('.settings-card--cloud')).toBeVisible();
  await expect(page.locator('.settings-card--account')).toBeHidden();

  const cloudStatusBox = await page.locator('.settings-card--cloud .cloud-sync-note').boundingBox();
  expect(cloudStatusBox).not.toBeNull();
  const cloudActions = page.locator('.settings-card--cloud .data-actions');
  if ((await cloudActions.count()) > 0) {
    const cloudActionsBox = await cloudActions.boundingBox();
    expect(cloudActionsBox).not.toBeNull();
    expect(cloudActionsBox!.y - (cloudStatusBox!.y + cloudStatusBox!.height)).toBeGreaterThanOrEqual(10);
  }

  await page.locator('#analysis-settings .analysis-range > summary').click();
  const rangeFieldsBox = await page.locator('#analysis-settings .analysis-range .form-row').boundingBox();
  const rangeActionsBox = await page.locator('#analysis-settings .analysis-range .ai-actions').boundingBox();
  expect(rangeFieldsBox).not.toBeNull();
  expect(rangeActionsBox).not.toBeNull();
  expect(rangeActionsBox!.y - (rangeFieldsBox!.y + rangeFieldsBox!.height)).toBeGreaterThanOrEqual(10);

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

test('keeps monthly results before the review and secondary context behind a disclosure', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/month');
  await page.getByRole('button', { name: 'Предыдущий период' }).click();
  await expect(page.locator('.month-featured-events')).toHaveCount(0);
  await expect(page.locator('.month-facts-details')).toHaveCount(0);
  await expect(page.locator('.month-analysis-details')).not.toHaveAttribute('open', '');
  await expectPeriodDetailsChrome(page.locator('.month-analysis-details'));

  const records = page.locator('.period-records--featured');
  await expect(records.getByText('Итоги месяца', { exact: true })).toBeVisible();
  await expect(records.getByText('События месяца', { exact: true })).toBeVisible();
  await expect(records.locator('.period-record-preview').first().locator('li')).toHaveCount(5);
  await expect(records.getByRole('navigation', { name: 'Страницы итогов месяца' })).toBeVisible();
  await expect(records.getByRole('link', { name: 'Открыть все итоги' })).toHaveCount(0);
  await expect(records.getByRole('link', { name: 'Открыть все события' })).toHaveCount(0);

  const reviewBox = await page.locator('#month-review').boundingBox();
  const recordsBox = await records.boundingBox();
  expect(reviewBox).not.toBeNull();
  expect(recordsBox).not.toBeNull();
  expect(recordsBox!.y).toBeLessThan(reviewBox!.y);

  await records.getByRole('navigation', { name: 'Страницы итогов месяца' }).getByRole('button', { name: 'Дальше' }).click();
  await expect(records.getByRole('navigation', { name: 'Страницы итогов месяца' })).toContainText('2 из');
  const secondaryRecords = page.locator('details.period-records');
  await expectPeriodDetailsChrome(secondaryRecords);
  await secondaryRecords.getByText('Показать действия и дополнительный контекст', { exact: true }).click();
  await secondaryRecords.getByText('Конкретные действия и подготовка', { exact: true }).click();
  await expect(secondaryRecords.getByRole('navigation', { name: 'Страницы действий месяца' })).toBeVisible();
});

test('keeps weekly results and events visible before detailed daily context', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/week?week=${demoAnchor()}`);
  const records = page.locator('.period-records--featured');
  await expect(records.getByText('Итоги недели', { exact: true })).toBeVisible();
  await expect(records.getByText('События недели', { exact: true })).toBeVisible();
  await expect(records.getByRole('link', { name: 'Открыть все итоги' })).toHaveCount(0);
  await expect(records.getByRole('link', { name: 'Открыть все события' })).toHaveCount(0);
  await expect(page.locator('.week-data-details')).not.toHaveAttribute('open', '');
  await expectPeriodDetailsChrome(page.locator('.week-data-details'));
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
