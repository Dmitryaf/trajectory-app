// @vitest-environment happy-dom

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FirstUseRecovery from '../src/components/FirstUseRecovery.vue';
import { addDays, startOfWeek, todayKey } from '../src/services/dates';
import { useAppStore } from '../src/stores/app';
import { defaultSettings, emptyWeeklyReview, type AppSettings, type WeeklyReview } from '../src/types';

function setupStore() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useAppStore();
  store.settings = structuredClone(defaultSettings);
  store.saveSettings = vi.fn(async (settings: AppSettings) => {
    store.settings = structuredClone(settings);
  });
  store.saveReview = vi.fn(async (review: WeeklyReview) => {
    const index = store.weeklyReviews.findIndex((item) => item.weekStart === review.weekStart);
    if (index >= 0) store.weeklyReviews[index] = structuredClone(review);
    else store.weeklyReviews.push(structuredClone(review));
  });
  return { pinia, store };
}

describe('first-use week recovery', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  it('starts with the previous completed week', async () => {
    const { pinia, store } = setupStore();
    const wrapper = mount(FirstUseRecovery, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain('Соберите картину прошлой недели');
    await wrapper.get('.first-use-card--choice .primary-button').trigger('click');

    expect(store.settings.firstUse).toMatchObject({
      status: 'in_progress',
      weekStart: startOfWeek(addDays(todayKey(), -7)),
      lastStep: 'results',
    });
    expect(wrapper.text()).toContain('Что вам удалось закончить или получить?');
  });

  it('saves an answer in the weekly review before opening the next step', async () => {
    const { pinia, store } = setupStore();
    const weekStart = '2026-07-27';
    store.settings.firstUse = {
      status: 'in_progress',
      weekStart,
      lastStep: 'results',
      overviewSeen: false,
      updatedAt: '',
    };
    const wrapper = mount(FirstUseRecovery, { global: { plugins: [pinia] } });

    await wrapper.get('#first-use-results').setValue('Закончил черновик\nОтправил письмо');
    await wrapper.get('.first-use-recovery__footer .primary-button').trigger('click');

    expect(store.saveReview).toHaveBeenCalledWith(
      expect.objectContaining({ weekStart, results: ['Закончил черновик', 'Отправил письмо'] }),
    );
    expect(store.settings.firstUse.lastStep).toBe('highlights');
    expect(wrapper.text()).toContain('Что важного произошло?');
  });

  it('keeps existing answers when a step is skipped', async () => {
    const { pinia, store } = setupStore();
    const weekStart = '2026-07-27';
    store.settings.firstUse = {
      status: 'in_progress',
      weekStart,
      lastStep: 'highlights',
      overviewSeen: false,
      updatedAt: '',
    };
    store.weeklyReviews = [{ ...emptyWeeklyReview(weekStart), highlights: ['Важный разговор'] }];
    const wrapper = mount(FirstUseRecovery, { global: { plugins: [pinia] } });

    await wrapper
      .findAll('.first-use-card__text-button')
      .find((button) => button.text() === 'Пропустить')!
      .trigger('click');

    expect(store.saveReview).not.toHaveBeenCalled();
    expect(store.reviewByWeek(weekStart)?.highlights).toEqual(['Важный разговор']);
    expect(store.settings.firstUse.lastStep).toBe('state_context');
  });

  it('shows saved answers together and completes only a useful overview', async () => {
    const { pinia, store } = setupStore();
    const weekStart = '2026-07-27';
    store.settings.firstUse = {
      status: 'in_progress',
      weekStart,
      lastStep: 'overview',
      overviewSeen: true,
      updatedAt: '',
    };
    store.weeklyReviews = [
      {
        ...emptyWeeklyReview(weekStart),
        results: ['Закончил черновик'],
        highlights: ['Поговорил с другом'],
        nextLever: 'Пока без решения',
      },
    ];
    const wrapper = mount(FirstUseRecovery, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain('Вот чем была наполнена ваша неделя');
    expect(wrapper.text()).toContain('Закончил черновик');
    expect(wrapper.text()).toContain('Поговорил с другом');
    expect(wrapper.get('.first-use-recovery__footer .primary-button').attributes('disabled')).toBeUndefined();
    await wrapper.get('.first-use-recovery__footer .primary-button').trigger('click');

    expect(store.settings.firstUse).toMatchObject({ status: 'completed', lastStep: 'overview', overviewSeen: true });
  });

  it('reopens completed answers when editing is requested from the week overview', async () => {
    window.history.replaceState({}, '', '/?first-use=edit');
    const { pinia, store } = setupStore();
    store.settings.firstUse = {
      status: 'completed',
      weekStart: '2026-07-27',
      lastStep: 'overview',
      overviewSeen: true,
      updatedAt: '',
    };
    store.weeklyReviews = [{ ...emptyWeeklyReview('2026-07-27'), results: ['Закончил черновик'] }];

    const wrapper = mount(FirstUseRecovery, { global: { plugins: [pinia] } });
    await vi.waitFor(() => expect(store.settings.firstUse.status).toBe('in_progress'));

    expect(store.settings.firstUse).toMatchObject({ lastStep: 'results', overviewSeen: true });
    expect(wrapper.text()).toContain('Что вам удалось закончить или получить?');
    expect((wrapper.get('#first-use-results').element as HTMLTextAreaElement).value).toBe('Закончил черновик');
  });
});
