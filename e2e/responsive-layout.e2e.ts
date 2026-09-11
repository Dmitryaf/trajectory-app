import { expect, test } from './fixtures';
import type { Locator } from '@playwright/test';
import { demoAnchor, demoFilePath, emptyPeriodDate, visualDemoFilePath } from './demo-data';
import {
  breakpointProbeWidths,
  expectBoxInside,
  expectHorizontalSeparation,
  expectPageFitsViewport,
  expectSamePosition,
  expectVerticalSeparation,
  readDocumentLayoutBox,
  readLayoutBox,
  sampleHeights,
  uniqueWidths,
} from './layout-assertions';

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
    await expectPageFitsViewport(page, route);
    const feedback = page.getByRole('button', { name: 'Обратная связь' });
    await expect(feedback).toBeVisible();
  }
});

test('keeps archive filters aligned across responsive widths', async ({ page }) => {
  test.slow();
  const layouts = new Map<number, { height: number; searchWidth: number }>();

  for (const width of uniqueWidths([390, 768, 820, 821, 900, 1100], breakpointProbeWidths(1024))) {
    await page.setViewportSize({ width, height: 1024 });
    for (const route of ['/results', '/events']) {
      await page.goto(route);
      await page.locator('.page--archive').waitFor();

      await expectPageFitsViewport(page, `${route} at ${width}px`);

      const panel = page.locator('.archive-panel');
      const filters = page.locator('.archive-filters');
      const [panelBox, filtersBox] = await Promise.all([
        readLayoutBox(panel, `${route} panel at ${width}px`),
        readLayoutBox(filters, `${route} filters at ${width}px`),
      ]);
      expectBoxInside(filtersBox, panelBox, `${route} filters at ${width}px`);

      const fields = page.locator('.archive-filter-field');
      await expect(fields).toHaveCount(4);
      const fieldGeometry = await fields.evaluateAll((elements) =>
        elements.map((element) => {
          const label = element.querySelector<HTMLElement>('.archive-filter-field__label')!;
          const control = element.querySelector<HTMLElement>('input, select')!;
          const labelBox = label.getBoundingClientRect();
          const controlBox = control.getBoundingClientRect();
          return {
            labelTop: labelBox.top,
            controlTop: controlBox.top,
            controlHeight: controlBox.height,
            controlLeft: controlBox.left,
            controlRight: controlBox.right,
          };
        }),
      );
      const rows = fieldGeometry.reduce<Record<string, typeof fieldGeometry>>((groups, field) => {
        const key = String(Math.round(field.labelTop));
        (groups[key] ??= []).push(field);
        return groups;
      }, {});
      for (const row of Object.values(rows)) {
        expect(Math.max(...row.map((field) => field.controlTop)) - Math.min(...row.map((field) => field.controlTop))).toBeLessThanOrEqual(
          1,
        );
        expect(
          Math.max(...row.map((field) => field.controlHeight)) - Math.min(...row.map((field) => field.controlHeight)),
        ).toBeLessThanOrEqual(1);
      }
      for (const field of fieldGeometry) {
        expect(field.controlLeft).toBeGreaterThanOrEqual(filtersBox.x);
        expect(field.controlRight).toBeLessThanOrEqual(filtersBox.x + filtersBox.width);
        expect(field.controlRight - field.controlLeft).toBeGreaterThanOrEqual(140);
        expect(field.controlHeight).toBeLessThanOrEqual(52);
      }
      expect(fieldGeometry.map((field) => field.labelTop)).toEqual([...fieldGeometry.map((field) => field.labelTop)].sort((a, b) => a - b));

      const searchBox = await fields.first().locator('input').boundingBox();
      expect(searchBox).not.toBeNull();
      if (route === '/results') {
        layouts.set(width, { height: filtersBox.height, searchWidth: searchBox!.width });
      }
    }
  }

  expect(Math.abs(layouts.get(820)!.height - layouts.get(821)!.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(layouts.get(820)!.searchWidth - layouts.get(821)!.searchWidth)).toBeLessThanOrEqual(2);
});

test('keeps archive reset geometry stable between active and inactive ranges', async ({ page }) => {
  for (const width of [390, 1100]) {
    await page.setViewportSize({ width, height: 1024 });
    for (const route of ['/results', '/events']) {
      await page.goto(route);
      const filters = page.locator('.archive-filters');
      const reset = page.getByRole('button', { name: 'За всё время' });
      const beforeFilters = await readDocumentLayoutBox(filters, `${route} active filters at ${width}px`);
      const beforeReset = await readDocumentLayoutBox(reset, `${route} active reset at ${width}px`);

      await reset.click();
      await expect(reset).toBeDisabled();
      const afterFilters = await readDocumentLayoutBox(filters, `${route} inactive filters at ${width}px`);
      const afterReset = await readDocumentLayoutBox(reset, `${route} inactive reset at ${width}px`);

      expect(Math.abs(afterFilters.height - beforeFilters.height), `${route} filter height at ${width}px`).toBeLessThanOrEqual(1);
      expectSamePosition(beforeReset, afterReset, `${route} reset at ${width}px`);
    }
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
    const goalCardBox = await page.locator('#goal-actions').boundingBox();
    expect(quickCaptureBox).not.toBeNull();
    expect(goalCardBox).not.toBeNull();
    expect(goalCardBox!.y, `goal should stay below quick actions at ${width}px`).toBeGreaterThanOrEqual(
      quickCaptureBox!.y + quickCaptureBox!.height + 12,
    );
  }
});

test('separates month metric controls from the chart and keeps compact daily actions visible', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/month');

    for (const layout of [
      { switcher: '.month-metric-card .metric-switcher', chart: '.month-metric-card .echart-panel' },
      { switcher: '.trend-metric-switcher', chart: '.trend-metric-card .echart-panel' },
    ]) {
      if (layout.switcher === '.trend-metric-switcher') {
        await page.goto('/trends');
        await page.locator('.trends-metric-details > summary').click();
      }

      const switcherBox = await page.locator(layout.switcher).boundingBox();
      const chartBox = await page.locator(layout.chart).boundingBox();
      expect(switcherBox).not.toBeNull();
      expect(chartBox).not.toBeNull();
      expect(chartBox!.y - (switcherBox!.y + switcherBox!.height)).toBeGreaterThanOrEqual(14);
    }
  }

  await page.goto('/');
  const settingsAction = page.locator('.daily-layout-settings .secondary-button');
  const goalAction = page.locator('#goal-actions .card-settings-link');
  await expect(settingsAction).toBeVisible();
  await expect(goalAction).toBeVisible();
  await expect(goalAction).toHaveText('Изменить');
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
      const cardBox = element.closest('.period-analysis-card')?.getBoundingClientRect();
      const linkBox = element.querySelector('a')?.getBoundingClientRect();
      let after = 0;
      if (nextBox) {
        after = nextBox.top - box.bottom;
      } else if (cardBox) {
        after = cardBox.bottom - box.bottom;
      }
      return {
        before: previousBox ? box.top - previousBox.bottom : 0,
        after,
        linkInside: linkBox ? linkBox.left >= box.left && linkBox.right <= box.right : false,
      };
    });

    expect(spacing.before, `${route} should leave space before the custom-period action`).toBeGreaterThanOrEqual(14);
    expect(spacing.after, `${route} should leave space after the custom-period action`).toBeGreaterThanOrEqual(12);
    expect(spacing.linkInside, `${route} action should stay inside its card`).toBe(true);
  }
});

test('keeps history entry colors aligned with the type summary', async ({ page }) => {
  await page.goto('/trends');
  const history = page.locator('.history-timeline--featured');
  await expect(history).toBeVisible();

  const summaryItems = history.locator('.history-timeline__summary > span');
  const readSummaryColors = () =>
    summaryItems.evaluateAll((elements) =>
      Object.fromEntries(
        elements.map((element) => {
          const toneClass = [...element.classList].find((name) => name.startsWith('history-timeline__summary-item--')) ?? '';
          const tone = toneClass.replace('history-timeline__summary-item--', '');
          return [tone, getComputedStyle(element.querySelector('i')!).backgroundColor];
        }),
      ),
    );
  await expect
    .poll(async () => {
      const colors = Object.values(await readSummaryColors());
      return colors.length > 0 && colors.every(Boolean);
    })
    .toBe(true);
  const summaryColors = await readSummaryColors();
  expect(new Set(Object.values(summaryColors)).size).toBe(Object.keys(summaryColors).length);

  const entryColors: Record<string, string> = {};
  const entries = history.locator('.history-timeline__list > article');
  const readEntryColors = () =>
    entries.evaluateAll((elements) =>
      Object.fromEntries(
        elements.map((element) => {
          const toneClass = [...element.classList].find((name) => name.startsWith('history-timeline__item--')) ?? '';
          const tone = toneClass.replace('history-timeline__item--', '');
          return [tone, getComputedStyle(element, '::before').backgroundColor];
        }),
      ),
    );
  const nextPage = history.locator('.archive-pagination button', { hasText: 'Дальше' });
  const transitioningEntries = history.locator('.reveal-list-enter-active, .reveal-list-leave-active');
  for (let pageNumber = 1; pageNumber <= 20; pageNumber += 1) {
    await expect(transitioningEntries).toHaveCount(0);
    const currentEntryColors = await readEntryColors();
    expect(Object.values(currentEntryColors).every(Boolean)).toBe(true);
    Object.assign(entryColors, currentEntryColors);
    if (await nextPage.isDisabled()) {
      break;
    }
    await nextPage.click();
    await expect(history.locator('.archive-pagination span')).toHaveText(new RegExp(`^${pageNumber + 1} из \\d+$`));
  }

  expect(Object.keys(entryColors).sort()).toEqual(Object.keys(summaryColors).sort());
  for (const [tone, color] of Object.entries(summaryColors)) {
    expect(entryColors[tone], `${tone} entries should use their summary color`).toBe(color);
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
  const transitionHeightsPromise = sampleHeights(list);
  await history.locator('.archive-pagination button', { hasText: 'Дальше' }).click();
  const transitionHeights = await transitionHeightsPromise;
  await expect(history.locator('.decision-timeline__item')).toHaveCount(10);
  await expect(history.locator('.archive-pagination span')).toHaveText(/^2 из \d+$/);
  const finalListHeight = transitionHeights.at(-1)!;
  expect(Math.min(...transitionHeights)).toBeGreaterThanOrEqual(Math.min(initialListHeight, finalListHeight) - 2);
  expect(Math.max(...transitionHeights)).toBeLessThanOrEqual(Math.max(initialListHeight, finalListHeight) + 2);

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});

test('moves paginated list height smoothly instead of collapsing between pages', async ({ page }) => {
  for (const scenario of [
    { route: '/trends', list: '.history-timeline__list', pagination: '.history-timeline .archive-pagination', width: 390 },
    { route: '/trends', list: '.history-timeline__list', pagination: '.history-timeline .archive-pagination', width: 1280 },
    { route: '/results', list: '.results-list', pagination: '.archive-panel .archive-pagination', width: 390 },
    { route: '/events', list: '.timeline-list', pagination: '.archive-panel .archive-pagination', width: 390 },
  ]) {
    await page.setViewportSize({ width: scenario.width, height: 1024 });
    await page.goto(scenario.route);
    if (scenario.route === '/results' || scenario.route === '/events') {
      await page.getByRole('button', { name: 'За всё время' }).click();
    }
    const list = page.locator(scenario.list);
    const pagination = page.locator(scenario.pagination);
    await expect(pagination).toBeVisible();

    const pageCount = Number((await pagination.locator('span').textContent())?.split(' из ')[1]);
    expect(pageCount, `${scenario.route} should have enough data to test pagination`).toBeGreaterThan(1);
    for (let currentPage = 1; currentPage < pageCount - 1; currentPage += 1) {
      await pagination.getByRole('button', { name: 'Дальше' }).click();
      await expect(pagination.locator('span')).toHaveText(`${currentPage + 1} из ${pageCount}`);
    }

    const samplesPromise = sampleHeights(list, 450);
    await pagination.getByRole('button', { name: 'Дальше' }).click();
    const activeTransition = await list.evaluate((element) => ({
      inlineHeight: (element as HTMLElement).style.height,
      property: getComputedStyle(element).transitionProperty,
      duration: getComputedStyle(element).transitionDuration,
    }));
    expect(activeTransition.inlineHeight, `${scenario.route} at ${scenario.width}px should lock the previous height`).not.toBe('');
    expect(activeTransition.property).toContain('height');
    expect(activeTransition.duration).not.toBe('0s');
    const samples = await samplesPromise;
    await expect(pagination.locator('span')).toHaveText(`${pageCount} из ${pageCount}`);

    expect(Math.min(...samples), `${scenario.route} at ${scenario.width}px should not collapse`).toBeGreaterThan(0);
  }
});

test('reserves header space while the feedback action loads', async ({ browser }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 720 },
  ]) {
    const context = await browser.newContext({ viewport });
    const isolatedPage = await context.newPage();
    let releaseFeedbackModule!: () => void;
    let markFeedbackModuleRequested!: () => void;
    const feedbackModuleRequested = new Promise<void>((resolve) => {
      markFeedbackModuleRequested = resolve;
    });
    const feedbackModuleReleased = new Promise<void>((resolve) => {
      releaseFeedbackModule = resolve;
    });

    await isolatedPage.route('**/src/features/feedback/ui/FeedbackDialog.vue*', async (route) => {
      markFeedbackModuleRequested();
      await feedbackModuleReleased;
      await route.continue();
    });

    try {
      await isolatedPage.goto('/');
      await feedbackModuleRequested;
      const help = isolatedPage.getByRole('button', { name: 'Как работает приложение' });
      await expect(help).toBeVisible();
      const before = await readLayoutBox(help, `help before feedback at ${viewport.width}px`);

      releaseFeedbackModule();
      await expect(isolatedPage.getByRole('button', { name: 'Обратная связь' })).toBeVisible();
      const after = await readLayoutBox(help, `help after feedback at ${viewport.width}px`);
      expectSamePosition(before, after, `help while feedback loads at ${viewport.width}px`);
    } finally {
      releaseFeedbackModule();
      await context.close();
    }
  }
});

test('removes paginated list motion when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/trends');
  const list = page.locator('.history-timeline__list');
  await expect(list).toHaveCSS('transition-duration', '0s');
  await page.locator('.history-timeline .archive-pagination').getByRole('button', { name: 'Дальше' }).click();
  await expect(page.locator('.history-timeline .archive-pagination span')).toHaveText(/^2 из \d+$/);
  await expect.poll(() => list.evaluate((element) => element.style.height)).toBe('');
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
  await expect(page.getByText('Дополнительные разделы', { exact: true })).toBeVisible();
  await expect(page.getByText('Короткий итог дня', { exact: true })).toBeVisible();
  await expect(page.getByText('Сон перед этой датой и сколько сил было в этот день.', { exact: true })).toBeHidden();

  const goalCard = page.locator('#goal-actions');
  const additionalBlocks = page.locator('.daily-additional-blocks');
  const workCard = page.locator('#career');
  const goalBox = await goalCard.boundingBox();
  const quickCaptureBox = await page.locator('.quick-capture').boundingBox();
  const additionalBlocksBox = await additionalBlocks.boundingBox();
  expect(goalBox).not.toBeNull();
  expect(quickCaptureBox).not.toBeNull();
  expect(additionalBlocksBox).not.toBeNull();
  expect(goalBox!.y).toBeGreaterThanOrEqual(quickCaptureBox!.y + quickCaptureBox!.height + 12);
  expect(goalBox!.y).toBeLessThan(additionalBlocksBox!.y);
  await expect(additionalBlocks).not.toHaveAttribute('open', '');
  await additionalBlocks.locator('summary').click();
  await expect(additionalBlocks).toHaveAttribute('open', '');
  const expandedGoalBox = await goalCard.boundingBox();
  const workBox = await workCard.boundingBox();
  expect(expandedGoalBox).not.toBeNull();
  expect(workBox).not.toBeNull();
  expect(expandedGoalBox!.y).toBeLessThan(workBox!.y);
  await expect(workCard.locator('textarea')).toHaveCount(0);

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
  await page.locator('.daily-additional-blocks > summary').click();
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
  await page.clock.setFixedTime(new Date('2026-08-30T12:00:00.000Z'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings');
  await page.locator('input[type="file"]').setInputFiles(visualDemoFilePath);
  await page.getByText('Резервная копия восстановлена', { exact: true }).waitFor();
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

test('keeps weekly facts, observations, reflection and external analysis in decision order', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/week?week=${demoAnchor()}`);
  const records = page.locator('.period-records--featured');
  await expect(records.getByText('Итоги недели', { exact: true })).toBeVisible();
  await expect(records.getByText('События недели', { exact: true })).toBeVisible();
  await expect(records.getByRole('link', { name: 'Открыть все итоги' })).toHaveCount(0);
  await expect(records.getByRole('link', { name: 'Открыть все события' })).toHaveCount(0);
  const observations = page.locator('.period-analysis-card:not(#ai-analysis)');
  const review = page.locator('#week-review');
  const externalAnalysis = page.locator('#ai-analysis');
  const details = page.locator('.week-data-details');
  await expect(observations.locator('.review-cue-grid')).toBeVisible();
  await expect(observations.locator('.period-actions')).toHaveCount(0);
  await expect(externalAnalysis.getByRole('button', { name: 'Подготовить текст для нейросети' })).toBeVisible();
  await expect(externalAnalysis.locator('.review-cue-grid')).toHaveCount(0);
  await expect(details).not.toHaveAttribute('open', '');
  await expectPeriodDetailsChrome(details);

  const positions = await Promise.all(
    [records, observations, review, externalAnalysis, details].map(async (locator) => (await locator.boundingBox())?.y ?? -1),
  );
  expect(positions).toEqual([...positions].sort((left, right) => left - right));
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

test('keeps navigation clear of the header controls around its desktop breakpoint', async ({ page }) => {
  for (const width of uniqueWidths(breakpointProbeWidths(980), [1100, 1280, 1514])) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto('/');
    await expectPageFitsViewport(page, `application chrome at ${width}px`);

    const headerBox = await readLayoutBox(page.locator('.app-header'), `header at ${width}px`);
    const brandBox = await readLayoutBox(page.locator('.brand'), `brand at ${width}px`);
    const navigationBox = await readLayoutBox(page.locator('.bottom-nav'), `navigation at ${width}px`);
    const actionsBox = await readLayoutBox(page.locator('.header-actions'), `header actions at ${width}px`);
    if (width < 980) {
      expectVerticalSeparation(headerBox, navigationBox, 0, `header and bottom navigation at ${width}px`);
      continue;
    }
    expectHorizontalSeparation(brandBox, navigationBox, 8, `brand and navigation at ${width}px`);
    expectHorizontalSeparation(navigationBox, actionsBox, 8, `navigation and actions at ${width}px`);
  }
});
