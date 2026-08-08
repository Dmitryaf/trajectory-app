// @vitest-environment happy-dom

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WeeklyReviewJournalLinks from '../src/components/WeeklyReviewJournalLinks.vue';
import { readFirstUseFunnel } from '../src/features/first-use/funnel';
import { useAppStore } from '../src/stores/app';
import { defaultSettings, emptyWeeklyReview, type LifeEventRecord, type ResultRecord } from '../src/types';

function setup(existingResults: ResultRecord[] = []) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useAppStore();
  store.settings = structuredClone(defaultSettings);
  store.results = existingResults;
  store.addResult = vi.fn(async (result: Omit<ResultRecord, 'id' | 'createdAt'>) => {
    store.results.unshift({ ...result, id: 1, createdAt: '2026-08-08T12:00:00.000Z' });
  });
  store.addLifeEvent = vi.fn(async (event: Omit<LifeEventRecord, 'id' | 'createdAt'>) => {
    store.lifeEvents.unshift({ ...event, id: 1, createdAt: '2026-08-08T12:00:00.000Z' });
  });
  const review = {
    ...emptyWeeklyReview('2026-07-27'),
    results: ['Закончил черновик'],
    highlights: ['Состоялся важный разговор'],
  };
  const wrapper = mount(WeeklyReviewJournalLinks, { props: { review }, global: { plugins: [pinia] } });
  return { store, wrapper };
}

describe('weekly review journal links', () => {
  beforeEach(() => window.localStorage.clear());

  it('saves only explicitly dated and classified items', async () => {
    const { store, wrapper } = setup();
    const items = wrapper.findAll('.weekly-review-journal__item');
    const result = items[0]!;
    const event = items[1]!;

    expect(result.get('button').attributes('disabled')).toBeDefined();
    await result.get('input[type="date"]').setValue('2026-07-29');
    await result.get('select').setValue('career');
    await result.get('button').trigger('click');

    expect(store.addResult).toHaveBeenCalledWith({
      date: '2026-07-29',
      area: 'career',
      title: 'Закончил черновик',
      note: '',
    });
    expect(result.text()).toContain('Уже есть в Журнале');
    expect(readFirstUseFunnel().map((item) => item.name)).toContain('first_use_journal_record_saved');

    await event.get('input[type="date"]').setValue('2026-07-30');
    await event.get('select').setValue('event');
    await event.get('button').trigger('click');

    expect(store.addLifeEvent).toHaveBeenCalledWith({
      date: '2026-07-30',
      type: 'event',
      title: 'Состоялся важный разговор',
      note: '',
    });
    expect(event.text()).toContain('Уже есть в Журнале');
  });

  it('does not create a duplicate with the same date and normalized title', async () => {
    const { store, wrapper } = setup([
      {
        id: 7,
        date: '2026-07-29',
        area: 'career',
        title: '  ЗАКОНЧИЛ   черновик ',
        note: '',
        createdAt: '2026-07-29T12:00:00.000Z',
      },
    ]);
    const result = wrapper.findAll('.weekly-review-journal__item')[0]!;

    expect((result.get('input[type="date"]').element as HTMLInputElement).value).toBe('2026-07-29');
    expect((result.get('select').element as HTMLSelectElement).value).toBe('career');
    expect(result.get('button').attributes('disabled')).toBeDefined();
    expect(result.text()).toContain('Уже есть в Журнале');
    await result.get('button').trigger('click');
    expect(store.addResult).not.toHaveBeenCalled();
  });
});
