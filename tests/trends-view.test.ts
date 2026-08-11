// @vitest-environment happy-dom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TrendsView from '../src/views/TrendsView.vue';
import { emptyDailyEntry, type DailyEntry } from '../src/types';
import { createStore, routerLinkStub } from './helpers/viewScenario';

describe('trends scenarios', () => {
  function buildCoveredTrendEntries(): DailyEntry[] {
    const months = [
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ];

    return months.flatMap((month, monthIndex) =>
      Array.from(
        { length: 8 },
        (_, dayIndex) =>
          ({
            ...emptyDailyEntry(`${month}-${String(dayIndex + 1).padStart(2, '0')}`),
            recordedFields: ['sleepMinutes', 'energy', 'contextFactors', 'weightKg', 'actionDirection'],
            sleepMinutes: 405 + (monthIndex % 3) * 15,
            energy: 2 + (monthIndex % 3),
            contextFactors: dayIndex < 4 ? ['screen'] : [],
            contextFactorsRecorded: true,
            weightKg: 80 - monthIndex * 0.2,
            actionDirection: dayIndex % 3 === 0 ? 'preparation' : 'external',
            importantFact: `Наблюдение ${dayIndex + 1}`,
          }) satisfies DailyEntry,
      ),
    );
  }

  it('shows conclusions first and reveals detailed evidence by topic', async () => {
    const { pinia, store } = createStore();
    store.dailyEntries = buildCoveredTrendEntries();
    store.results = [
      {
        id: 1,
        date: '2026-07-08',
        area: 'career',
        title: 'Готовый результат',
        note: '',
        createdAt: '2026-07-08T12:00:00.000Z',
      },
    ];
    store.lifeEvents = [
      {
        id: 1,
        date: '2026-07-05',
        type: 'event',
        title: 'Важное событие',
        note: '',
        createdAt: '2026-07-05T12:00:00.000Z',
      },
    ];
    const wrapper = mount(TrendsView, { global: { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } } });

    expect(wrapper.html().indexOf('dashboard-card--insights')).toBeLessThan(wrapper.html().indexOf('trends-quality-details'));
    expect(wrapper.findAll('.review-cue-grid--primary .review-cue')).toHaveLength(3);
    expect(wrapper.get('.trends-quality-details').attributes('open')).toBeUndefined();
    expect(wrapper.get('.trends-table-details').attributes('open')).toBeUndefined();
    expect(wrapper.get('.trends-event-details').attributes('open')).toBeUndefined();
    expect(wrapper.get('.trends-weight-details').attributes('open')).toBeUndefined();
    expect(wrapper.get('.trends-action-details').attributes('open')).toBeUndefined();
    expect(wrapper.get('.trends-factor-details').attributes('open')).toBeUndefined();
    expect(wrapper.get('.trends-history-details').attributes('open')).toBeUndefined();
    expect(wrapper.findAll('.trend-chart-description')).toHaveLength(4);
    expect(wrapper.text()).toContain('Сон рассчитан по 24 обычным дням');

    for (const [label, rowCount] of [
      ['3 месяца', 3],
      ['6 месяцев', 6],
      ['12 месяцев', 12],
    ] as const) {
      const button = wrapper.findAll('.range-tabs button').find((item) => item.text() === label);
      await button!.trigger('click');
      expect(wrapper.findAll('.trend-table__row')).toHaveLength(rowCount);
      expect(wrapper.findAll('e-chart-panel-stub').length).toBeGreaterThanOrEqual(4);
      expect(wrapper.find('.trends-chart-guide').exists()).toBe(false);
    }
  });

  it('does not render visually significant charts for a scarce sample', () => {
    const { pinia, store } = createStore();
    store.dailyEntries = [{ ...emptyDailyEntry('2026-07-21'), importantFact: 'Одна запись' }];
    const wrapper = mount(TrendsView, { global: { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } } });

    expect(wrapper.findAll('.review-cue-grid--primary .review-cue').length).toBeGreaterThan(0);
    expect(wrapper.get('.trends-quality-details').attributes('open')).toBeUndefined();
    expect(wrapper.get('.trends-chart-guide').text()).toContain('Для графиков пока мало сопоставимых данных');
    expect(wrapper.findAll('e-chart-panel-stub')).toHaveLength(0);
  });

  it('keeps the change history compact until the user expands it', async () => {
    const { pinia, store } = createStore();
    store.dailyEntries = [{ ...emptyDailyEntry('2026-07-21'), importantFact: 'Есть данные для трендов' }];
    store.results = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      date: `2026-07-${String(21 - index).padStart(2, '0')}`,
      area: 'career' as const,
      title: `Итог ${index + 1}`,
      note: '',
      createdAt: `2026-07-${String(21 - index).padStart(2, '0')}T12:00:00.000Z`,
    }));
    const wrapper = mount(TrendsView, { global: { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } } });

    expect(wrapper.findAll('.decision-timeline__item')).toHaveLength(8);
    const toggle = wrapper.get('.timeline-toggle');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    await toggle.trigger('click');
    expect(wrapper.findAll('.decision-timeline__item')).toHaveLength(10);
    expect(toggle.attributes('aria-expanded')).toBe('true');
  });
});
