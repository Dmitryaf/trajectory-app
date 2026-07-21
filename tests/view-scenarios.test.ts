// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EventsView from '../src/views/EventsView.vue';
import ResultsView from '../src/views/ResultsView.vue';
import SettingsView from '../src/views/SettingsView.vue';
import TodayView from '../src/views/TodayView.vue';
import { useAppStore } from '../src/stores/app';
import { defaultSettings, emptyDailyEntry } from '../src/types';

vi.mock('../src/services/notifications', () => ({
  notifyError: vi.fn(),
  notifyInfo: vi.fn(),
  notifySaved: vi.fn(),
  notifyUnknownError: vi.fn()
}));

const routerLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
};

function createStore() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useAppStore();
  store.loaded = true;
  store.settings = structuredClone(defaultSettings);
  return { pinia, store };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 21, 12));
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('daily entry scenario', () => {
  it('validates sleep duration and saves the completed day with current criteria', async () => {
    const { pinia, store } = createStore();
    store.settings.activeFocusTitle = 'Главный фокус';
    store.settings.externalEvidenceCriterion = 'Получен ответ извне';
    store.settings.nutritionGoalCriterion = 'Обычный режим питания';
    const saveEntry = vi.spyOn(store, 'saveEntry').mockImplementation(async (entry) => {
      store.dailyEntries = [entry];
    });
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } }
    });

    expect(wrapper.get('[aria-label="Дата записи"]').attributes('max')).toBe('2026-07-21');
    expect(wrapper.text()).toContain('Действия по текущей цели');
    expect(wrapper.text()).toContain('Физическая активность');

    await wrapper.get('#bedtime').setValue('23:40');
    await wrapper.get('#wake-time').setValue('07:30');
    await wrapper.get('#sleep-hours').setValue('9');
    await flushPromises();
    await wrapper.get('form').trigger('submit');

    expect(wrapper.get('[role="alert"]').text()).toBe('Время сна не может быть больше времени в кровати.');
    expect(saveEntry).not.toHaveBeenCalled();

    await wrapper.get('#sleep-hours').setValue('7');
    const factCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Факт дня');
    expect(factCard).toBeDefined();
    await factCard!.get('textarea').setValue('Завершил важный разговор');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(saveEntry).toHaveBeenCalledTimes(1);
    expect(saveEntry.mock.calls[0][0]).toMatchObject({
      date: '2026-07-21',
      bedtime: '23:40',
      wakeTime: '07:30',
      sleepMinutes: 420,
      timeInBedMinutes: 470,
      importantFact: 'Завершил важный разговор',
      focusTitle: 'Главный фокус',
      externalEvidenceCriterion: 'Получен ответ извне',
      nutritionCriterion: 'Обычный режим питания'
    });
  });

  it('hides inactive blocks while preserving values in an existing entry', async () => {
    const { pinia, store } = createStore();
    store.settings.activeDailyBlocks = [];
    store.dailyEntries = [{
      ...emptyDailyEntry('2026-07-21'),
      bedtime: '23:40',
      wakeTime: '07:30',
      sleepMinutes: 600,
      timeInBedMinutes: 470,
      nutritionState: 'supports_goal'
    }];
    const saveEntry = vi.spyOn(store, 'saveEntry').mockImplementation(async (entry) => {
      store.dailyEntries = [entry];
    });
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } }
    });

    const headings = wrapper.findAll('.form-card h2').map((heading) => heading.text());
    expect(headings).not.toContain('Сон и состояние');
    expect(headings).not.toContain('Карьера');
    expect(headings).not.toContain('Физическая активность');
    expect(headings).not.toContain('Питание');
    expect(headings).toContain('Факт дня');

    const factCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Факт дня');
    await factCard!.get('textarea').setValue('Обновил только общий факт');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(saveEntry).toHaveBeenCalledWith(expect.objectContaining({
      bedtime: '23:40',
      sleepMinutes: 600,
      timeInBedMinutes: 470,
      nutritionState: 'supports_goal',
      importantFact: 'Обновил только общий факт'
    }));
  });
});

describe('journal scenarios', () => {
  it('adds an outcome and filters the existing archive by text', async () => {
    const { pinia, store } = createStore();
    store.results = [
      { id: 1, date: '2026-07-20', area: 'reading', title: 'Дочитал книгу', createdAt: '2026-07-20T10:00:00.000Z' },
      { id: 2, date: '2026-07-19', area: 'career', title: 'Получил ответ', createdAt: '2026-07-19T10:00:00.000Z' }
    ];
    const addResult = vi.spyOn(store, 'addResult').mockResolvedValue(undefined);
    const wrapper = mount(ResultsView, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain('Здесь можно сохранить выполненное дело, полученный результат или другое важное завершение.');
    await wrapper.get('[aria-label="Поиск по итогам"]').setValue('книгу');
    expect(wrapper.text()).toContain('Дочитал книгу');
    expect(wrapper.text()).not.toContain('Получил ответ');

    await wrapper.get('[aria-label="Поиск по итогам"]').setValue('');
    await wrapper.get('.result-composer input[type="text"]').setValue('Закончил курс');
    await wrapper.get('.result-composer .primary-button').trigger('click');
    await flushPromises();

    expect(addResult).toHaveBeenCalledWith({
      date: '2026-07-21',
      area: 'career',
      title: 'Закончил курс'
    });
  });

  it('adds an insight and finds an event by its note', async () => {
    const { pinia, store } = createStore();
    store.lifeEvents = [
      { id: 1, date: '2026-07-20', type: 'insight', title: 'Наблюдение', note: 'Лучше думаю после прогулки', createdAt: '2026-07-20T10:00:00.000Z' },
      { id: 2, date: '2026-07-19', type: 'event', title: 'Встреча', note: 'Обсудили планы', createdAt: '2026-07-19T10:00:00.000Z' }
    ];
    const addLifeEvent = vi.spyOn(store, 'addLifeEvent').mockResolvedValue(undefined);
    const wrapper = mount(EventsView, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain('Событие — то, что произошло. Инсайт — мысль или вывод, который важно сохранить.');
    await wrapper.get('[aria-label="Поиск по событиям"]').setValue('прогулки');
    expect(wrapper.text()).toContain('Наблюдение');
    expect(wrapper.text()).not.toContain('Встреча');

    await wrapper.get('[aria-label="Поиск по событиям"]').setValue('');
    const insightChoice = wrapper.findAll('.result-composer .chip').find((chip) => chip.text().includes('Инсайт'));
    expect(insightChoice).toBeDefined();
    await insightChoice!.trigger('click');
    await wrapper.get('.result-composer input[type="text"]').setValue('Понял причину усталости');
    await wrapper.get('.result-composer textarea').setValue('Нужно проверить это наблюдение на нескольких днях');
    await wrapper.get('.result-composer .primary-button').trigger('click');
    await flushPromises();

    expect(addLifeEvent).toHaveBeenCalledWith({
      date: '2026-07-21',
      type: 'insight',
      title: 'Понял причину усталости',
      note: 'Нужно проверить это наблюдение на нескольких днях'
    });
  });
});

describe('settings scenarios', () => {
  it('saves the selected daily entry blocks', async () => {
    const { pinia, store } = createStore();
    const saveSettings = vi.spyOn(store, 'saveSettings').mockResolvedValue(undefined);
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });
    const blockCard = wrapper.get('.settings-card--daily-blocks');
    const careerChip = blockCard.findAll('.chip').find((chip) => chip.text().includes('Карьера'));

    expect(careerChip?.attributes('aria-pressed')).toBe('true');
    await careerChip!.trigger('click');
    await blockCard.get('.primary-button').trigger('click');
    await flushPromises();

    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      activeDailyBlocks: ['sleep', 'movement', 'nutrition']
    }));
  });
});
