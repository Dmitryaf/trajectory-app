// @vitest-environment happy-dom

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EventsView from '../src/views/EventsView.vue';
import ResultsView from '../src/views/ResultsView.vue';
import SettingsView from '../src/views/SettingsView.vue';
import TodayView from '../src/views/TodayView.vue';
import TrendsView from '../src/views/TrendsView.vue';
import { notifySaved, notifyUnknownError } from '../src/services/notifications';
import { useAppStore } from '../src/stores/app';
import { defaultSettings, emptyDailyEntry } from '../src/types';

vi.mock('../src/services/notifications', () => ({
  notifyError: vi.fn(),
  notifyInfo: vi.fn(),
  notifySaved: vi.fn(),
  notifyUnknownError: vi.fn()
}));

enableAutoUnmount(afterEach);

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
      return entry;
    });
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } }
    });

    expect(wrapper.get('[aria-label="Дата записи"]').attributes('max')).toBe('2026-07-21');
    expect(wrapper.text()).toContain('Действия по текущей цели');
    expect(wrapper.text()).toContain('Физическая активность');
    const directionCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Действия по текущей цели');
    expect(directionCard?.findAll('.chip').map((chip) => chip.text())).not.toContain('Восстановление');

    await wrapper.get('#bedtime').setValue('23:40');
    await wrapper.get('#wake-time').setValue('07:30');
    await wrapper.get('#sleep-hours').setValue('9');
    await flushPromises();
    expect(wrapper.get('.mobile-save-button').text()).toContain('Сохранить день');
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
    expect(wrapper.find('.mobile-save-button').exists()).toBe(false);
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
      return entry;
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

  it('shows context independently when the sleep block is hidden', () => {
    const { pinia, store } = createStore();
    store.settings.activeDailyBlocks = ['context'];
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } }
    });

    const headings = wrapper.findAll('.form-card h2').map((heading) => heading.text());
    expect(headings).toContain('Контекст дня');
    expect(headings).not.toContain('Сон и состояние');
    expect(wrapper.text()).toContain('Необычный день');
  });

  it('keeps a dirty entry until the user confirms changing the date', async () => {
    const { pinia, store } = createStore();
    store.dailyEntries = [{
      ...emptyDailyEntry('2026-07-20'),
      importantFact: 'Сохранённый факт за вчера',
    }];
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });
    const factCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Факт дня');
    await factCard!.get('textarea').setValue('Несохранённый факт');

    const unloadEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unloadEvent);
    expect(unloadEvent.defaultPrevented).toBe(true);

    const dateInput = wrapper.get('[aria-label="Дата записи"]');
    await dateInput.setValue('2026-07-20');
    expect(confirm).toHaveBeenCalledOnce();
    expect((dateInput.element as HTMLInputElement).value).toBe('2026-07-21');
    expect(factCard!.get('textarea').element).toHaveProperty('value', 'Несохранённый факт');

    confirm.mockReturnValue(true);
    await dateInput.setValue('2026-07-20');
    expect((dateInput.element as HTMLInputElement).value).toBe('2026-07-20');
    expect(factCard!.get('textarea').element).toHaveProperty('value', 'Сохранённый факт за вчера');
  });

  it('reports a local save error and allows retrying', async () => {
    const { pinia, store } = createStore();
    const saveEntry = vi.spyOn(store, 'saveEntry').mockRejectedValue(new Error('IndexedDB unavailable'));
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });
    const factCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Факт дня');
    await factCard!.get('textarea').setValue('Не потерять эту запись');
    expect(wrapper.find('.mobile-save-button').exists()).toBe(true);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(saveEntry).toHaveBeenCalledOnce();
    expect(notifyUnknownError).toHaveBeenCalledWith(expect.any(Error), 'Не удалось сохранить день');
    expect(notifySaved).not.toHaveBeenCalled();
    expect(wrapper.get('.primary-button--save').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('.mobile-save-button').exists()).toBe(true);
    expect(factCard!.get('textarea').element).toHaveProperty('value', 'Не потерять эту запись');
  });

  it('clears an automatically derived time in bed but preserves a manual duration', async () => {
    const { pinia } = createStore();
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });
    await wrapper.get('#bedtime').setValue('23:40');
    await wrapper.get('#wake-time').setValue('07:30');
    const timeInBedHours = wrapper.get('#time-in-bed-hours');
    expect((timeInBedHours.element as HTMLInputElement).value).toBe('7');

    await wrapper.get('#wake-time').setValue('');
    expect((timeInBedHours.element as HTMLInputElement).value).toBe('');

    await wrapper.get('#wake-time').setValue('07:30');
    await timeInBedHours.setValue('8');
    await wrapper.get('#wake-time').setValue('');
    expect((timeInBedHours.element as HTMLInputElement).value).toBe('8');
  });

  it('blocks route navigation while the daily entry is dirty', async () => {
    const { pinia } = createStore();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: TodayView },
        { path: '/next', component: { template: '<div>Следующая страница</div>' } },
      ],
    });
    await router.push('/');
    await router.isReady();
    const wrapper = mount(
      { template: '<RouterView />' },
      { global: { plugins: [pinia, router], stubs: { RouterLink: routerLinkStub } } },
    );
    const factCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Факт дня');
    await factCard!.get('textarea').setValue('Несохранённая запись');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    await router.push('/next');
    expect(router.currentRoute.value.path).toBe('/');
    expect(confirm).toHaveBeenCalledOnce();

    confirm.mockReturnValue(true);
    await router.push('/next');
    expect(router.currentRoute.value.path).toBe('/next');
    expect(wrapper.text()).toContain('Следующая страница');
  });
});

describe('journal scenarios', () => {
  it('uses bounded pages and resets pagination when archive filters change', async () => {
    const { pinia, store } = createStore();
    store.results = Array.from({ length: 9 }, (_, index) => ({
      id: index + 1,
      date: '2026-07-21',
      area: 'career' as const,
      title: `Итог ${index + 1}`,
      createdAt: `2026-07-21T${String(index + 10).padStart(2, '0')}:00:00.000Z`
    }));
    const wrapper = mount(ResultsView, { global: { plugins: [pinia] } });

    expect(wrapper.get('[aria-label="Страницы итогов"]').text()).toContain('1 из 2');
    expect(wrapper.text()).not.toContain('Итог 9');
    await wrapper.get('[aria-label="Страницы итогов"] button:last-child').trigger('click');
    expect(wrapper.get('[aria-label="Страницы итогов"]').text()).toContain('2 из 2');
    expect(wrapper.text()).toContain('Итог 9');

    await wrapper.get('[aria-label="Поиск по итогам"]').setValue('Итог 1');
    expect(wrapper.text()).toContain('Итог 1');
    expect(wrapper.find('[aria-label="Страницы итогов"]').exists()).toBe(false);
  });

  it('adds an outcome and filters the existing archive by text', async () => {
    const { pinia, store } = createStore();
    store.results = [
      { id: 3, date: '2026-07-21', area: 'career', title: 'Сегодняшний итог', createdAt: '2026-07-21T10:00:00.000Z' },
      { id: 1, date: '2026-07-20', area: 'reading', title: 'Дочитал книгу', createdAt: '2026-07-20T10:00:00.000Z' },
      { id: 2, date: '2026-07-19', area: 'career', title: 'Получил ответ', createdAt: '2026-07-19T10:00:00.000Z' }
    ];
    const addResult = vi.spyOn(store, 'addResult').mockResolvedValue(undefined);
    const wrapper = mount(ResultsView, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain('Здесь можно сохранить выполненное дело, полученный результат или другое важное завершение.');
    expect(wrapper.get('[aria-label="Начальная дата итогов"]').element).toHaveProperty('value', '2026-07-21');
    expect(wrapper.get('[aria-label="Конечная дата итогов"]').element).toHaveProperty('value', '');
    expect(wrapper.text()).toContain('Сегодняшний итог');
    expect(wrapper.text()).not.toContain('Дочитал книгу');
    await wrapper.get('[aria-label="Конечная дата итогов"]').setValue('2026-07-21');
    const allTimeButton = wrapper.get('.archive-filter__all-time');
    expect(allTimeButton.attributes('disabled')).toBeUndefined();
    await allTimeButton.trigger('click');
    expect(wrapper.get('[aria-label="Начальная дата итогов"]').element).toHaveProperty('value', '');
    expect(wrapper.get('[aria-label="Конечная дата итогов"]').element).toHaveProperty('value', '');
    expect(wrapper.get('.archive-date-filter__state').text()).toBe('Показаны записи за всё время');
    expect(wrapper.get('.archive-filter__all-time').attributes('disabled')).toBeDefined();
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
    const longNote = 'Длинная мысль может объединять несколько связанных тем без обязательного разбиения. '.repeat(8).trim();
    store.lifeEvents = [
      { id: 3, date: '2026-07-21', type: 'decision', title: 'Сегодняшнее решение', note: '', createdAt: '2026-07-21T10:00:00.000Z' },
      { id: 4, date: '2026-07-21', type: 'insight', title: 'Развёрнутый инсайт', note: longNote, createdAt: '2026-07-21T11:00:00.000Z' },
      { id: 1, date: '2026-07-20', type: 'insight', title: 'Наблюдение', note: 'Лучше думаю после прогулки', createdAt: '2026-07-20T10:00:00.000Z' },
      { id: 2, date: '2026-07-19', type: 'event', title: 'Встреча', note: 'Обсудили планы', createdAt: '2026-07-19T10:00:00.000Z' }
    ];
    const addLifeEvent = vi.spyOn(store, 'addLifeEvent').mockResolvedValue(undefined);
    const wrapper = mount(EventsView, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain('Событие — то, что произошло. Инсайт — мысль или вывод, который важно сохранить.');
    expect(wrapper.get('[aria-label="Начальная дата событий"]').element).toHaveProperty('value', '2026-07-21');
    expect(wrapper.get('[aria-label="Конечная дата событий"]').element).toHaveProperty('value', '');
    expect(wrapper.text()).toContain('Сегодняшнее решение');
    expect(wrapper.text()).not.toContain('Наблюдение');
    const longNoteToggle = wrapper.get('.timeline-item__note-toggle');
    expect(longNoteToggle.attributes('aria-expanded')).toBe('false');
    expect(longNoteToggle.attributes('aria-controls')).toBe(wrapper.get('.timeline-item__note').attributes('id'));
    expect(wrapper.get('.timeline-item__note').classes()).toContain('timeline-item__note--clamped');
    await longNoteToggle.trigger('click');
    expect(longNoteToggle.attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('.timeline-item__note').classes()).not.toContain('timeline-item__note--clamped');
    expect(longNoteToggle.text()).toBe('Свернуть');
    await wrapper.get('.archive-filter__all-time').trigger('click');
    await wrapper.get('[aria-label="Поиск по событиям"]').setValue('прогулки');
    expect(wrapper.text()).toContain('Наблюдение');
    expect(wrapper.text()).not.toContain('Встреча');

    await wrapper.get('[aria-label="Поиск по событиям"]').setValue('');
    const insightChoice = wrapper.findAll('.result-composer .chip').find((chip) => chip.text().includes('Инсайт'));
    expect(insightChoice).toBeDefined();
    await insightChoice!.trigger('click');
    await wrapper.get('.result-composer input[type="text"]').setValue('Понял причину усталости');
    await wrapper.get('.result-composer textarea').setValue(longNote);
    await wrapper.get('.result-composer .primary-button').trigger('click');
    await flushPromises();

    expect(addLifeEvent).toHaveBeenCalledWith({
      date: '2026-07-21',
      type: 'insight',
      title: 'Понял причину усталости',
      note: longNote
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
      activeDailyBlocks: ['sleep', 'context', 'movement', 'nutrition']
    }));
  });

  it('hides and restores built-in context factors without deleting their definition', async () => {
    const { pinia, store } = createStore();
    const saveSettings = vi.spyOn(store, 'saveSettings').mockResolvedValue(undefined);
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });
    const contextCard = wrapper.get('.settings-card--context');

    await contextCard.get('[aria-label="Скрыть Экранное время"]').trigger('click');
    await flushPromises();
    expect(saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ hiddenContextFactorIds: ['screen'] }));
    expect(contextCard.text()).toContain('Скрытые факторы');

    const restoreButton = contextCard.findAll('.restore-option').find((button) => button.text().includes('Экранное время'));
    await restoreButton!.trigger('click');
    await flushPromises();
    expect(saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ hiddenContextFactorIds: [] }));
  });
});

describe('trends scenarios', () => {
  it('keeps the change history compact until the user expands it', async () => {
    const { pinia, store } = createStore();
    store.results = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      date: `2026-07-${String(21 - index).padStart(2, '0')}`,
      area: 'career' as const,
      title: `Итог ${index + 1}`,
      createdAt: `2026-07-${String(21 - index).padStart(2, '0')}T12:00:00.000Z`,
    }));
    const wrapper = mount(TrendsView, { global: { plugins: [pinia], stubs: { EChartPanel: true } } });

    expect(wrapper.findAll('.decision-timeline__item')).toHaveLength(8);
    const toggle = wrapper.get('.timeline-toggle');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    await toggle.trigger('click');
    expect(wrapper.findAll('.decision-timeline__item')).toHaveLength(10);
    expect(toggle.attributes('aria-expanded')).toBe('true');
  });
});
