// @vitest-environment happy-dom

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FirstUseRecovery from '../src/components/FirstUseRecovery.vue';
import { readFirstUseFunnel } from '../src/features/first-use/funnel';
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
    window.localStorage.clear();
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
    expect(readFirstUseFunnel().map((event) => event.name)).toContain('first_use_recovery_started');
    expect(wrapper.text()).toContain('Что вам удалось закончить или получить?');
  });

  it('keeps the choice visible when starting cannot be saved', async () => {
    const { pinia, store } = setupStore();
    store.saveSettings = vi.fn().mockRejectedValue(new Error('IndexedDB unavailable'));
    const wrapper = mount(FirstUseRecovery, { global: { plugins: [pinia] } });

    await wrapper.get('.first-use-card--choice .primary-button').trigger('click');
    await vi.waitFor(() => expect(wrapper.text()).toContain('Не удалось начать. Попробуйте ещё раз.'));

    expect(store.settings.firstUse.status).toBe('not_started');
    expect(wrapper.text()).toContain('Соберите картину прошлой недели');
    expect(wrapper.get('.first-use-card--choice .primary-button').attributes('disabled')).toBeUndefined();
    expect(readFirstUseFunnel().map((event) => event.name)).not.toContain('first_use_recovery_started');
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
    expect(wrapper.get('#first-use-highlights').attributes('placeholder')).toBeUndefined();
    expect(readFirstUseFunnel().map((event) => event.name)).toContain('first_use_first_answer_saved');
  });

  it('keeps an unsaved answer on the same step and allows retrying', async () => {
    const { pinia, store } = setupStore();
    const weekStart = '2026-07-27';
    store.settings.firstUse = {
      status: 'in_progress',
      weekStart,
      lastStep: 'results',
      overviewSeen: false,
      updatedAt: '',
    };
    vi.mocked(store.saveReview).mockRejectedValueOnce(new Error('IndexedDB unavailable'));
    const wrapper = mount(FirstUseRecovery, { global: { plugins: [pinia] } });

    await wrapper.get('#first-use-results').setValue('Ответ не должен пропасть');
    await wrapper.get('.first-use-recovery__footer .primary-button').trigger('click');
    await vi.waitFor(() => expect(wrapper.text()).toContain('Не удалось сохранить ответ'));

    expect(store.settings.firstUse.lastStep).toBe('results');
    expect((wrapper.get('#first-use-results').element as HTMLTextAreaElement).value).toBe('Ответ не должен пропасть');
    expect(readFirstUseFunnel().map((event) => event.name)).not.toContain('first_use_first_answer_saved');

    await wrapper.get('.first-use-recovery__footer .primary-button').trigger('click');
    await vi.waitFor(() => expect(store.settings.firstUse.lastStep).toBe('highlights'));
    expect(store.reviewByWeek(weekStart)?.results).toEqual(['Ответ не должен пропасть']);
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
    expect(readFirstUseFunnel().map((event) => event.name)).toContain('first_use_overview_viewed');
    expect(wrapper.get('.first-use-recovery__footer .primary-button').attributes('disabled')).toBeUndefined();
    await wrapper.get('.first-use-recovery__footer .primary-button').trigger('click');

    expect(store.saveReview).toHaveBeenLastCalledWith(
      expect.objectContaining({ weekStart, results: ['Закончил черновик'], highlights: ['Поговорил с другом'] }),
    );
    expect(store.settings.firstUse).toMatchObject({ status: 'completed', lastStep: 'overview', overviewSeen: true });
  });

  it('explains how the next-week change will be used later', async () => {
    const { pinia, store } = setupStore();
    store.settings.firstUse = {
      status: 'in_progress',
      weekStart: '2026-07-27',
      lastStep: 'decision',
      overviewSeen: false,
      updatedAt: '',
    };
    const wrapper = mount(FirstUseRecovery, { global: { plugins: [pinia] } });

    await wrapper.findAll('.first-use-recovery__choices button')[1]!.trigger('click');

    expect(wrapper.text()).toContain('Какое одно изменение хотите попробовать на следующей неделе?');
    expect(wrapper.text()).toContain('этот ответ появится как ваше прошлое решение');
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
