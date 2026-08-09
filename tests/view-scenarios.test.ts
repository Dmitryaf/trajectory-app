// @vitest-environment happy-dom

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EventsView from '../src/views/EventsView.vue';
import MonthView from '../src/views/MonthView.vue';
import ResultsView from '../src/views/ResultsView.vue';
import SettingsView from '../src/views/SettingsView.vue';
import TodayView from '../src/views/TodayView.vue';
import TrendsView from '../src/views/TrendsView.vue';
import WeekView from '../src/views/WeekView.vue';
import { loadCloudSnapshot, markCloudSyncSynced } from '../src/services/cloudSync';
import { notifyError, notifySaved, notifyUnknownError } from '../src/services/notifications';
import { useAppStore } from '../src/stores/app';
import { useAuthStore } from '../src/stores/auth';
import { defaultSettings, emptyDailyEntry, emptyMonthlyReview, emptyWeeklyReview } from '../src/types';

vi.mock('../src/services/notifications', () => ({
  notifyError: vi.fn(),
  notifyInfo: vi.fn(),
  notifySaved: vi.fn(),
  notifyUnknownError: vi.fn(),
}));

vi.mock('../src/services/cloudSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/cloudSync')>()),
  loadCloudSnapshot: vi.fn(),
  markCloudSyncSynced: vi.fn(),
}));

enableAutoUnmount(afterEach);

const routerLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
};

function createStore() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useAppStore();
  store.loaded = true;
  store.settings = structuredClone(defaultSettings);
  store.settings.firstUse = {
    status: 'completed',
    weekStart: '2026-07-13',
    periodEnd: '2026-07-19',
    lastStep: 'overview',
    overviewSeen: true,
    updatedAt: '2026-07-20T12:00:00.000Z',
  };
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
  it('guides the first entry without treating yesterday as a missed day', () => {
    const { pinia } = createStore();
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });

    expect(wrapper.text()).toContain('Отметьте несколько деталей сегодняшнего дня');
    expect(wrapper.text()).toContain('Разделы на главной можно добавить или убрать в настройках');
    expect(wrapper.text()).toContain('Настроить блоки');
    expect(wrapper.text()).toContain('Зачем это заполнять?');
    expect(wrapper.text()).not.toContain('Вчера без записи');
    expect(wrapper.find('.quick-capture').exists()).toBe(false);
    expect(wrapper.text()).toContain('Сначала выберите, над чем сейчас хотите работать.');
    expect(wrapper.get('#goal-actions .context-action').text()).toBe('Выбрать цель');
    expect(wrapper.text()).not.toContain('Конкретное действие');
  });

  it('keeps the daily block settings available after the first entry', () => {
    const { pinia, store } = createStore();
    store.dailyEntries = [emptyDailyEntry('2026-07-20')];
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });

    expect(wrapper.text()).toContain('Хотите добавить или убрать разделы?');
    expect(wrapper.text()).toContain('Настроить главную');
    expect(wrapper.text()).not.toContain('С чего начать');
    expect(wrapper.text()).toContain('Состояние и условия');
    expect(wrapper.text()).toContain('Действия и области жизни');
    expect(wrapper.text()).toContain('Короткий итог дня');
    expect(wrapper.text()).not.toContain('Сон перед этой датой и сколько сил было в этот день.');
  });

  it('offers recovery to an existing user without blocking the daily form', () => {
    const { pinia, store } = createStore();
    store.settings.firstUse = {
      status: 'available',
      weekStart: '',
      periodEnd: '',
      lastStep: 'choice',
      overviewSeen: false,
      updatedAt: '',
    };
    store.dailyEntries = [emptyDailyEntry('2026-07-20')];
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });

    expect(wrapper.text()).toContain('Собрать недавнюю неделю?');
    expect(wrapper.text()).toContain('Не сейчас');
    expect(wrapper.find('.checkin-grid').exists()).toBe(true);
  });

  it('shows only one current cue and keeps a weekly plan visible without daily tracking', () => {
    const { pinia, store } = createStore();
    store.dailyEntries = [{ ...emptyDailyEntry('2026-07-20'), importantFact: 'Обычная запись' }];
    store.weeklyReviews = [{ ...emptyWeeklyReview('2026-07-20'), ifThenPlan: 'Если застряну, выйду на короткую прогулку' }];
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });

    expect(wrapper.get('[aria-label="Текущий план недели"]').text()).toContain('Если застряну, выйду на короткую прогулку');
    expect(wrapper.find('.today-pulse[aria-label="Пульс недели"]').exists()).toBe(false);
    expect(wrapper.find('.recovery-nudge').exists()).toBe(false);
  });

  it('validates sleep duration and saves the completed day with current criteria', async () => {
    const { pinia, store } = createStore();
    store.settings.activeFocusTitle = 'Главный фокус';
    store.settings.focusOutcomeCriterion = 'Получить проверяемый результат';
    store.settings.focusReviewDate = '2026-08-01';
    store.settings.externalEvidenceCriterion = 'Получен ответ извне';
    store.settings.nutritionGoalCriterion = 'Обычный режим питания';
    store.settings.customActivityOptions = [{ id: 'bachata', label: 'Бачата', icon: '♪', custom: true }];
    const saveEntry = vi.spyOn(store, 'saveEntry').mockImplementation(async (entry) => {
      store.dailyEntries = [entry];
      return entry;
    });
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });

    expect(wrapper.get('[aria-label="Дата записи"]').attributes('max')).toBe('2026-07-21');
    expect(wrapper.text()).toContain('Действия по цели');
    expect(wrapper.text()).toContain('Физическая активность');
    const directionCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Действия по цели');
    expect(directionCard?.findAll('.chip').map((chip) => chip.text())).not.toContain('Восстановление');
    const movementCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Физическая активность');
    expect(movementCard?.findAll('.chip').map((chip) => chip.text())).toEqual([
      '→ Прогулка',
      '△ Тренировка',
      '○ Восстановление',
      '♪ Бачата',
    ]);
    await movementCard!
      .findAll('.chip')
      .find((chip) => chip.text().includes('Бачата'))!
      .trigger('click');
    const lifeAreaCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Области жизни');
    expect(lifeAreaCard?.text()).not.toContain('Английский');

    await wrapper.get('#bedtime').setValue('23:40');
    await wrapper.get('#wake-time').setValue('07:30');
    await wrapper.get('#sleep-hours').setValue('9');
    await flushPromises();
    expect(wrapper.get('.mobile-save-button').text()).toContain('Сохранить день');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.get('[role="alert"]').text()).toBe('Время сна не может быть больше времени в кровати.');
    expect(saveEntry).not.toHaveBeenCalled();

    await wrapper.get('#sleep-hours').setValue('7');
    expect(wrapper.text()).toContain('Как понять, что получилось: Получить проверяемый результат');
    expect(wrapper.text()).toContain('Проверить цель: 1 августа 2026 г.');
    const factCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Заметка дня');
    expect(factCard).toBeDefined();
    await factCard!.get('textarea').setValue('Завершил важный разговор');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(saveEntry).toHaveBeenCalledTimes(1);
    expect(notifySaved).toHaveBeenCalledWith('День сохранён на устройстве');
    expect(saveEntry.mock.calls[0][0]).toMatchObject({
      date: '2026-07-21',
      entrySchemaVersion: 2,
      activeDailyBlocksSnapshot: ['sleep', 'context', 'movement', 'nutrition'],
      bedtime: '23:40',
      wakeTime: '07:30',
      sleepMinutes: 420,
      timeInBedMinutes: 470,
      importantFact: 'Завершил важный разговор',
      focusTitle: 'Главный фокус',
      focusOutcomeCriterion: 'Получить проверяемый результат',
      focusReviewDate: '2026-08-01',
      externalEvidenceCriterion: 'Получен ответ извне',
      nutritionCriterion: 'Обычный режим питания',
      activities: ['bachata'],
    });
    expect(wrapper.find('.mobile-save-button').exists()).toBe(false);
  });

  it('saves explicit empty career and goal answers separately from skipped blocks', async () => {
    const { pinia, store } = createStore();
    store.settings.activeDailyBlocks.push('career');
    store.settings.activeFocusTitle = 'Подготовиться к собеседованию';
    const saveEntry = vi.spyOn(store, 'saveEntry').mockImplementation(async (entry) => entry);
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });

    const workCard = wrapper.get('#career');
    expect(workCard.findAll('.chip').map((chip) => chip.text())).toEqual([
      '▤ Рабочий день',
      '◫ Обучение',
      '◉ Общение по работе',
      '◇ Свой проект',
      '✓ Завершённый результат',
    ]);

    const careerNone = workCard.findAll('button').find((button) => button.text() === 'Ничего из списка');
    const actionNone = wrapper.findAll('button').find((button) => button.text() === 'Действий по цели не было');
    await careerNone!.trigger('click');
    await actionNone!.trigger('click');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        careerStates: [],
        actionDirection: null,
        recordedFields: expect.arrayContaining(['careerStates', 'actionDirection']),
      }),
    );
  });

  it('keeps the original label of a legacy work option without offering unrelated old defaults', () => {
    const { pinia, store } = createStore();
    store.settings.activeDailyBlocks.push('career');
    store.dailyEntries = [
      {
        ...emptyDailyEntry('2026-07-21'),
        careerState: 'external',
        careerStates: ['external'],
        recordedFields: ['careerStates'],
      },
    ];

    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });
    const labels = wrapper
      .get('#career')
      .findAll('.chip')
      .map((chip) => chip.text());

    expect(labels).toContain('↗ Отклик/контакт');
    expect(labels).not.toContain('◉ Собеседование');
    expect(labels).toContain('▤ Рабочий день');
  });

  it('hides inactive blocks while preserving values in an existing entry', async () => {
    const { pinia, store } = createStore();
    store.settings.activeDailyBlocks = [];
    store.dailyEntries = [
      {
        ...emptyDailyEntry('2026-07-21'),
        bedtime: '23:40',
        wakeTime: '07:30',
        sleepMinutes: 600,
        timeInBedMinutes: 470,
        nutritionState: 'supports_goal',
        actionDirection: 'preparation',
        recordedFields: ['actionDirection'],
      },
    ];
    const saveEntry = vi.spyOn(store, 'saveEntry').mockImplementation(async (entry) => {
      store.dailyEntries = [entry];
      return entry;
    });
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });

    const headings = wrapper.findAll('.form-card h2').map((heading) => heading.text());
    expect(headings).not.toContain('Сон и состояние');
    expect(headings).not.toContain('Работа');
    expect(headings).not.toContain('Физическая активность');
    expect(headings).not.toContain('Питание');
    expect(headings).toContain('Заметка дня');
    expect(wrapper.text()).toContain('Для этой записи цель не была сохранена.');
    expect(wrapper.findAll('#goal-actions .chip').map((chip) => chip.text())).toContain('◫ Подготовка');

    const factCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Заметка дня');
    await factCard!.get('textarea').setValue('Обновил только общий факт');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        bedtime: '23:40',
        sleepMinutes: 600,
        timeInBedMinutes: 470,
        nutritionState: 'supports_goal',
        importantFact: 'Обновил только общий факт',
      }),
    );
  });

  it('shows context independently when the sleep block is hidden', () => {
    const { pinia, store } = createStore();
    store.settings.activeDailyBlocks = ['context'];
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });

    const headings = wrapper.findAll('.form-card h2').map((heading) => heading.text());
    expect(headings).toContain('Что могло повлиять на день');
    expect(headings).not.toContain('Сон и состояние');
    expect(wrapper.text()).toContain('Необычный день');
  });

  it('keeps a dirty entry until the user confirms changing the date', async () => {
    const { pinia, store } = createStore();
    store.dailyEntries = [
      {
        ...emptyDailyEntry('2026-07-20'),
        importantFact: 'Сохранённый факт за вчера',
      },
    ];
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });
    const factCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Заметка дня');
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
    const factCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Заметка дня');
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
    const wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [pinia, router], stubs: { RouterLink: routerLinkStub } } });
    const factCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Заметка дня');
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
      note: '',
      createdAt: `2026-07-21T${String(index + 10).padStart(2, '0')}:00:00.000Z`,
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
      {
        id: 3,
        date: '2026-07-21',
        area: 'career',
        title: 'Сегодняшний итог',
        note: 'Разобрался, почему откладывал эту задачу',
        createdAt: '2026-07-21T10:00:00.000Z',
      },
      { id: 1, date: '2026-07-20', area: 'reading', title: 'Дочитал книгу', note: '', createdAt: '2026-07-20T10:00:00.000Z' },
      { id: 2, date: '2026-07-19', area: 'career', title: 'Получил ответ', note: '', createdAt: '2026-07-19T10:00:00.000Z' },
    ];
    const addResult = vi.spyOn(store, 'addResult').mockResolvedValue(undefined);
    const wrapper = mount(ResultsView, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain('Итог — конкретное сделанное дело или полученный результат.');
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
    await wrapper.get('[aria-label="Поиск по итогам"]').setValue('откладывал');
    expect(wrapper.text()).toContain('Сегодняшний итог');
    await wrapper.get('[aria-label="Поиск по итогам"]').setValue('книгу');
    expect(wrapper.text()).toContain('Дочитал книгу');
    expect(wrapper.text()).not.toContain('Получил ответ');

    await wrapper.get('[aria-label="Поиск по итогам"]').setValue('');
    await wrapper.get('.result-composer input[type="text"]').setValue('Закончил курс');
    const note = wrapper.get('.result-composer textarea');
    await note.setValue('Собрал финальный проект и получил обратную связь');
    await note.setValue('');
    expect(note.element).toBeInstanceOf(HTMLTextAreaElement);
    await note.setValue('Собрал финальный проект и получил обратную связь');
    await wrapper.get('.result-composer .primary-button').trigger('click');
    await flushPromises();

    expect(addResult).toHaveBeenCalledWith({
      date: '2026-07-21',
      area: 'career',
      title: 'Закончил курс',
      note: 'Собрал финальный проект и получил обратную связь',
    });
  });

  it('adds an insight and finds an event by its note', async () => {
    const { pinia, store } = createStore();
    const longNote = 'Длинная мысль может объединять несколько связанных тем без обязательного разбиения. '.repeat(8).trim();
    store.lifeEvents = [
      { id: 3, date: '2026-07-21', type: 'decision', title: 'Сегодняшнее решение', note: '', createdAt: '2026-07-21T10:00:00.000Z' },
      { id: 4, date: '2026-07-21', type: 'insight', title: 'Развёрнутый инсайт', note: longNote, createdAt: '2026-07-21T11:00:00.000Z' },
      {
        id: 1,
        date: '2026-07-20',
        type: 'insight',
        title: 'Наблюдение',
        note: 'Лучше думаю после прогулки',
        createdAt: '2026-07-20T10:00:00.000Z',
      },
      { id: 2, date: '2026-07-19', type: 'event', title: 'Встреча', note: 'Обсудили планы', createdAt: '2026-07-19T10:00:00.000Z' },
    ];
    const addLifeEvent = vi.spyOn(store, 'addLifeEvent').mockResolvedValue(undefined);
    const wrapper = mount(EventsView, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain('Событие — ситуация, которую важно помнить.');
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
    const insightChoice = wrapper.findAll('.result-composer .chip').find((chip) => chip.text().includes('Мысль или наблюдение'));
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
      note: longNote,
    });
  });
});

describe('settings scenarios', () => {
  it('applies a confirmed cloud copy through the shared snapshot transition', async () => {
    const { pinia, store } = createStore();
    const auth = useAuthStore();
    auth.configured = true;
    auth.session = { user: { id: 'user-1', email: 'friend@example.com' } } as typeof auth.session;
    const snapshot = {
      userId: 'user-1',
      updatedAt: '2026-07-22T10:00:00.000Z',
      payload: { version: 3 },
    } as Awaited<ReturnType<typeof loadCloudSnapshot>>;
    vi.mocked(loadCloudSnapshot).mockResolvedValue(snapshot);
    const importData = vi.spyOn(store, 'importData').mockResolvedValue(undefined);
    const setCloudSyncState = vi.spyOn(store, 'setCloudSyncState');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const wrapper = mount(SettingsView, {
      global: { plugins: [pinia], mocks: { $route: { query: {} } } },
    });

    const restoreButton = wrapper.findAll('.settings-card--cloud button').find((button) => button.text() === 'Загрузить из облака');
    await restoreButton!.trigger('click');
    await flushPromises();

    expect(importData).toHaveBeenCalledWith(snapshot!.payload, { syncCloud: false });
    expect(markCloudSyncSynced).toHaveBeenCalledWith('user-1', snapshot!.updatedAt);
    expect(setCloudSyncState).toHaveBeenCalledWith('synced', expect.stringContaining('Загружена облачная копия'), {
      updatedAt: snapshot!.updatedAt,
    });
    expect(notifySaved).toHaveBeenCalledWith(expect.stringContaining('Данные восстановлены из облака'));
    confirm.mockRestore();
  });

  it('keeps local data when cloud restore is cancelled', async () => {
    const { pinia, store } = createStore();
    const auth = useAuthStore();
    auth.configured = true;
    auth.session = { user: { id: 'user-1', email: 'friend@example.com' } } as typeof auth.session;
    vi.mocked(loadCloudSnapshot).mockResolvedValue({
      userId: 'user-1',
      updatedAt: '2026-07-22T10:00:00.000Z',
      payload: { version: 3 },
    } as Awaited<ReturnType<typeof loadCloudSnapshot>>);
    const importData = vi.spyOn(store, 'importData').mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const wrapper = mount(SettingsView, {
      global: { plugins: [pinia], mocks: { $route: { query: {} } } },
    });

    const restoreButton = wrapper.findAll('.settings-card--cloud button').find((button) => button.text() === 'Загрузить из облака');
    await restoreButton!.trigger('click');
    await flushPromises();

    expect(importData).not.toHaveBeenCalled();
    expect(markCloudSyncSynced).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('does not mark an invalid cloud copy as synchronized', async () => {
    const { pinia, store } = createStore();
    const auth = useAuthStore();
    auth.configured = true;
    auth.session = { user: { id: 'user-1', email: 'friend@example.com' } } as typeof auth.session;
    vi.mocked(loadCloudSnapshot).mockResolvedValue({
      userId: 'user-1',
      updatedAt: '2026-07-22T10:00:00.000Z',
      payload: { version: 999 },
    } as Awaited<ReturnType<typeof loadCloudSnapshot>>);
    vi.spyOn(store, 'importData').mockRejectedValue(new Error('Неподдерживаемая версия резервной копии'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const wrapper = mount(SettingsView, {
      global: { plugins: [pinia], mocks: { $route: { query: {} } } },
    });

    const restoreButton = wrapper.findAll('.settings-card--cloud button').find((button) => button.text() === 'Загрузить из облака');
    await restoreButton!.trigger('click');
    await flushPromises();

    expect(markCloudSyncSynced).not.toHaveBeenCalled();
    expect(notifyUnknownError).toHaveBeenCalledWith(expect.any(Error), 'Облачное действие не выполнено');
    confirm.mockRestore();
  });

  it('does not confirm a cloud copy when the upload remains pending', async () => {
    const { pinia, store } = createStore();
    const auth = useAuthStore();
    auth.configured = true;
    auth.session = { user: { id: 'user-1', email: 'friend@example.com' } } as typeof auth.session;
    vi.spyOn(store, 'syncCloudSnapshot').mockResolvedValue({ status: 'pending', error: 'network unavailable' });
    const wrapper = mount(SettingsView, {
      global: { plugins: [pinia], mocks: { $route: { query: {} } } },
    });

    const backupButton = wrapper.findAll('.settings-card--cloud button').find((button) => button.text() === 'Обновить копию сейчас');
    await backupButton!.trigger('click');
    await flushPromises();

    expect(notifySaved).not.toHaveBeenCalledWith('Локальная версия сохранена в облако');
    expect(notifyError).toHaveBeenCalledWith('Облачная копия не обновлена. Локальные данные сохранены.');
  });

  it('clears local data only after the authenticated account is deleted', async () => {
    const { pinia, store } = createStore();
    const auth = useAuthStore();
    auth.configured = true;
    auth.session = { user: { id: 'user-1', email: 'friend@example.com' } } as typeof auth.session;
    auth.deleteAccount = vi.fn().mockResolvedValue(undefined);
    const clearAll = vi.spyOn(store, 'clearAll').mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('friend@example.com');
    const wrapper = mount(SettingsView, {
      global: { plugins: [pinia], mocks: { $route: { query: {} } } },
    });

    const deleteButton = wrapper.findAll('.settings-card--cloud button').find((button) => button.text() === 'Удалить аккаунт');
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(auth.deleteAccount).toHaveBeenCalledOnce();
    expect(clearAll).toHaveBeenCalledWith({ syncCloud: false });
    confirm.mockRestore();
    prompt.mockRestore();
  });

  it('preserves local data when server-side account deletion fails', async () => {
    const { pinia, store } = createStore();
    const auth = useAuthStore();
    auth.configured = true;
    auth.session = { user: { id: 'user-1', email: 'friend@example.com' } } as typeof auth.session;
    auth.deleteAccount = vi.fn().mockRejectedValue(new Error('network error'));
    auth.error = 'Не удалось удалить аккаунт.';
    const clearAll = vi.spyOn(store, 'clearAll').mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('friend@example.com');
    const wrapper = mount(SettingsView, {
      global: { plugins: [pinia], mocks: { $route: { query: {} } } },
    });

    const deleteButton = wrapper.findAll('.settings-card--cloud button').find((button) => button.text() === 'Удалить аккаунт');
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(clearAll).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith('Не удалось удалить аккаунт.');
    confirm.mockRestore();
    prompt.mockRestore();
  });

  it('saves the selected daily entry blocks', async () => {
    const { pinia, store } = createStore();
    const saveSettings = vi.spyOn(store, 'saveSettings').mockResolvedValue(undefined);
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });
    const blockCard = wrapper.get('.settings-card--daily-blocks');
    const careerChip = blockCard.findAll('.chip').find((chip) => chip.text().includes('Работа'));

    expect(careerChip?.attributes('aria-pressed')).toBe('false');
    await careerChip!.trigger('click');
    await blockCard.get('.primary-button').trigger('click');
    await flushPromises();

    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        activeDailyBlocks: ['sleep', 'context', 'movement', 'nutrition', 'career'],
      }),
    );
  });

  it('hides and restores built-in context factors without deleting their definition', async () => {
    const { pinia, store } = createStore();
    const saveSettings = vi.spyOn(store, 'saveSettings').mockResolvedValue(undefined);
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });
    const contextCard = wrapper.get('.settings-card--context');

    await contextCard.get('[aria-label="Убрать Экранное время из ежедневной записи"]').trigger('click');
    await flushPromises();
    expect(saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ hiddenContextFactorIds: ['screen'] }));
    expect(contextCard.text()).toContain('Убраны из ежедневной записи');
    expect(contextCard.text()).toContain('Прежние отметки остаются в истории, графиках и выгрузке.');

    const restoreButton = contextCard.findAll('.restore-option').find((button) => button.text().includes('Экранное время'));
    await restoreButton!.trigger('click');
    await flushPromises();
    expect(saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ hiddenContextFactorIds: [] }));
  });

  it('adds a personal activity and can hide and restore it', async () => {
    const { pinia, store } = createStore();
    const saveSettings = vi.spyOn(store, 'saveSettings').mockResolvedValue(undefined);
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });
    const movementCard = wrapper.get('.settings-card--movement');

    await movementCard.get('#new-activity-option').setValue('Бачата');
    await movementCard
      .findAll('button')
      .find((button) => button.text() === 'Добавить')!
      .trigger('click');
    await flushPromises();
    expect(saveSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        customActivityOptions: [expect.objectContaining({ id: 'bachata', label: 'Бачата', custom: true })],
      }),
    );

    await movementCard.get('[aria-label="Убрать Бачата из ежедневной записи"]').trigger('click');
    await flushPromises();
    expect(saveSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        customActivityOptions: [expect.objectContaining({ id: 'bachata', archived: true })],
      }),
    );

    await movementCard.get('[aria-label="Вернуть Бачата в ежедневную запись"]').trigger('click');
    await flushPromises();
    expect(saveSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        customActivityOptions: [expect.objectContaining({ id: 'bachata', archived: false })],
      }),
    );
  });

  it('validates an exact period before preparing external analysis', async () => {
    const { pinia } = createStore();
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });
    const start = wrapper.get('[aria-label="Начало периода анализа"]');
    const end = wrapper.get('[aria-label="Конец периода анализа"]');

    expect(start.element).toHaveProperty('value', '2026-06-21');
    expect(end.element).toHaveProperty('value', '2026-07-21');
    expect(end.attributes('max')).toBe('2026-07-21');

    await start.setValue('2026-07-10');
    await end.setValue('2026-07-09');
    await wrapper.get('.analysis-range').findAll('button')[0]!.trigger('click');

    expect(notifyError).toHaveBeenCalledWith('Начало периода должно быть не позже окончания');
  });

  it('saves a free-form experiment and completes it into history', async () => {
    const { pinia, store } = createStore();
    const saveSettings = vi.spyOn(store, 'saveSettings').mockResolvedValue(undefined);
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });
    const card = wrapper.get('.settings-card--experiment');
    const experimentTitle =
      'В течение недели после 22:00 оставлять телефон заряжаться в другой комнате и вместо новостей читать бумажную книгу не меньше десяти минут.';

    expect(wrapper.text()).toContain('Для обычной работы скачивать файл не требуется');

    await card.get('input[type="checkbox"]').setValue(true);
    expect(card.get('#experiment-title').attributes('maxlength')).toBe('400');
    await card.get('#experiment-title').setValue(experimentTitle);
    await card.get('.primary-button').trigger('click');
    expect(notifyError).toHaveBeenCalledWith('Укажите, с какого и до какого дня идёт эксперимент');
    expect(saveSettings).not.toHaveBeenCalled();

    await card.findAll('input[type="date"]')[0]!.setValue('2026-07-15');
    await card.findAll('input[type="date"]')[1]!.setValue('2026-07-21');
    await card.get('.primary-button').trigger('click');
    await flushPromises();

    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        experiment: expect.objectContaining({
          title: experimentTitle,
          targetMetricId: null,
          minimumMeaningfulChange: null,
          startDate: '2026-07-15',
          endDate: '2026-07-21',
        }),
      }),
    );

    await card.get('#experiment-conclusion').setValue('Вечером было спокойнее');
    const completeButton = card.findAll('button').find((button) => button.text().includes('Завершить эксперимент'));
    await completeButton!.trigger('click');
    await flushPromises();

    expect(saveSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        experiment: expect.objectContaining({ active: false, title: '' }),
        experimentHistory: [expect.objectContaining({ title: experimentTitle, conclusion: 'Вечером было спокойнее' })],
      }),
    );
  });
});

describe('trends scenarios', () => {
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

describe('period review navigation', () => {
  it('uses the compact archive previews for weekly results and events', () => {
    const { pinia, store } = createStore();
    store.dailyEntries = [{ ...emptyDailyEntry('2026-07-21'), importantFact: 'Есть данные недели' }];
    store.results = Array.from({ length: 4 }, (_, index) => ({
      id: index + 1,
      date: '2026-07-21',
      area: 'career' as const,
      title: `Итог недели ${index + 1}`,
      note: '',
      createdAt: `2026-07-21T${String(12 + index).padStart(2, '0')}:00:00.000Z`,
    }));
    store.lifeEvents = Array.from({ length: 4 }, (_, index) => ({
      id: index + 1,
      date: '2026-07-21',
      type: 'event' as const,
      title: `Событие недели ${index + 1}`,
      note: '',
      createdAt: `2026-07-21T${String(12 + index).padStart(2, '0')}:00:00.000Z`,
    }));
    const wrapper = mount(WeekView, { global: { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } } });

    expect(wrapper.get('.period-record-card__link[href="/results?from=2026-07-20&to=2026-07-21"]').text()).toContain('Открыть все итоги');
    expect(wrapper.get('.period-record-card__link[href="/events?from=2026-07-20&to=2026-07-21"]').text()).toContain('Открыть все события');
    expect(wrapper.text()).toContain('Итог недели 3');
    expect(wrapper.text()).not.toContain('Итог недели 4');
    expect(wrapper.text()).toContain('Событие недели 3');
    expect(wrapper.text()).not.toContain('Событие недели 4');
  });

  it('keeps monthly records compact and routes complete archives to the selected period', async () => {
    const { pinia, store } = createStore();
    store.dailyEntries = Array.from({ length: 9 }, (_, index) => {
      const day = String(21 - index).padStart(2, '0');
      return {
        ...emptyDailyEntry(`2026-07-${day}`),
        actionDirection: index % 2 === 0 ? 'preparation' : 'external',
        actionNote: `Действие ${index + 1}`,
        contextNote: `Контекст ${index + 1}`,
      };
    });
    store.results = Array.from({ length: 4 }, (_, index) => ({
      id: index + 1,
      date: `2026-07-${String(21 - index).padStart(2, '0')}`,
      area: 'career' as const,
      title: `Итог месяца ${index + 1}`,
      note: '',
      createdAt: `2026-07-${String(21 - index).padStart(2, '0')}T12:00:00.000Z`,
    }));
    store.lifeEvents = Array.from({ length: 4 }, (_, index) => ({
      id: index + 1,
      date: `2026-07-${String(21 - index).padStart(2, '0')}`,
      type: 'event' as const,
      title: `Событие месяца ${index + 1}`,
      note: '',
      createdAt: `2026-07-${String(21 - index).padStart(2, '0')}T12:00:00.000Z`,
    }));
    const wrapper = mount(MonthView, { global: { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } } });

    expect(wrapper.text()).toContain('Показать графики месяца');
    expect(wrapper.text()).toContain('Показать записи месяца');
    expect(wrapper.get('.period-record-card__link[href="/results?from=2026-07-01&to=2026-07-21"]').text()).toContain('Открыть все итоги');
    expect(wrapper.get('.period-record-card__link[href="/events?from=2026-07-01&to=2026-07-21"]').text()).toContain('Открыть все события');
    expect(wrapper.text()).toContain('Итог месяца 3');
    expect(wrapper.text()).not.toContain('Итог месяца 4');

    const actions = wrapper.get('.period-record-card--disclosure');
    await actions.get('summary').trigger('click');
    expect(actions.findAll('.note-item')).toHaveLength(7);
    expect(actions.text()).toContain('1 из 2');
    await actions.get('[aria-label="Страницы действий месяца"] button:last-child').trigger('click');
    expect(actions.text()).toContain('Действие 8');
    expect(actions.text()).toContain('Действие 9');
  });

  it('shows journal records without pretending that daily analytics exist', () => {
    const { pinia, store } = createStore();
    store.results = [
      {
        id: 1,
        date: '2026-07-21',
        area: 'career',
        title: 'Завершённый итог без дневной записи',
        note: '',
        createdAt: '2026-07-21T12:00:00.000Z',
      },
    ];
    store.lifeEvents = [
      {
        id: 1,
        date: '2026-07-21',
        type: 'event',
        title: 'Важное событие без дневной записи',
        note: '',
        createdAt: '2026-07-21T13:00:00.000Z',
      },
    ];
    const global = { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } };
    const week = mount(WeekView, { global });
    const month = mount(MonthView, { global });

    for (const wrapper of [week, month]) {
      expect(wrapper.find('.period-empty-guide').exists()).toBe(false);
      expect(wrapper.get('.period-data-guide').text()).toContain('нет дневных записей');
      expect(wrapper.find('.metrics-grid').exists()).toBe(false);
      expect(wrapper.text()).toContain('Завершённый итог без дневной записи');
      expect(wrapper.text()).toContain('Важное событие без дневной записи');
    }
    expect((week.get('details.period-details').element as HTMLDetailsElement).open).toBe(true);
    expect((month.get('details.period-records').element as HTMLDetailsElement).open).toBe(true);
  });

  it('keeps a saved period review visible without daily or journal records', () => {
    const { pinia, store } = createStore();
    store.weeklyReviews = [{ ...emptyWeeklyReview('2026-07-20'), results: ['Неделя не была пустой', '', ''] }];
    store.monthlyReviews = [{ ...emptyMonthlyReview('2026-07-01'), mainPattern: 'Важный вывод месяца' }];
    const global = { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } };
    const week = mount(WeekView, { global });
    const month = mount(MonthView, { global });

    for (const wrapper of [week, month]) {
      expect(wrapper.find('.period-empty-guide').exists()).toBe(false);
      expect(wrapper.find('.period-data-guide').exists()).toBe(true);
      expect(wrapper.find('.metrics-grid').exists()).toBe(false);
      expect(wrapper.find('.review-card').exists()).toBe(true);
      expect(wrapper.find('.period-details').exists()).toBe(false);
    }
    expect((week.get('.review-card input').element as HTMLInputElement).value).toBe('Неделя не была пустой');
    expect((month.get('.review-card textarea').element as HTMLTextAreaElement).value).toBe('Важный вывод месяца');
  });

  it('opens the recovered week on its exact dates and keeps all answers editable', () => {
    const { pinia, store } = createStore();
    store.weeklyReviews = [
      {
        ...emptyWeeklyReview('2026-07-13'),
        results: ['Закончил черновик'],
        highlights: ['Состоялся важный разговор'],
        stateContext: 'К середине недели было мало сил',
        support: 'Свободный вечер',
        obstacle: 'Недосып',
        nextLever: 'Пока без решения',
      },
    ];
    const wrapper = mount(WeekView, {
      props: { initialWeek: '2026-07-13' },
      global: { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } },
    });

    const overview = wrapper.get('#first-use-overview');
    expect(overview.text()).toContain('Восстановлено по вашим ответам');
    expect(overview.text()).toContain('Закончил черновик');
    expect(overview.text()).toContain('Состоялся важный разговор');
    expect(overview.text()).toContain('К середине недели было мало сил');
    expect(overview.get('a[href="/"]').text()).toBe('Записать сегодняшний день');
    expect(overview.get('a[href="/?first-use=edit"]').text()).toBe('Исправить ответы');

    const reviewForm = wrapper.get('#week-review');
    expect(reviewForm.findAll('input')).toHaveLength(6);
    expect(reviewForm.text()).toContain('До трёх событий, решений или мыслей');
    expect((reviewForm.findAll('textarea')[0]!.element as HTMLTextAreaElement).value).toBe('К середине недели было мало сил');
  });

  it('shows the real boundary of an incomplete recovered week', () => {
    const { pinia, store } = createStore();
    store.settings.firstUse.periodEnd = '2026-07-17';
    store.weeklyReviews = [
      {
        ...emptyWeeklyReview('2026-07-13'),
        coveredThrough: '2026-07-17',
        results: ['Закончил черновик'],
      },
    ];
    const wrapper = mount(WeekView, {
      props: { initialWeek: '2026-07-13' },
      global: { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } },
    });

    expect(wrapper.get('#first-use-overview').text()).toContain('Ответы собраны по 17 июля');
    expect(wrapper.get('#first-use-overview').text()).toContain('Остальные дни этой недели не считаются пропущенными');
    expect(wrapper.get('#first-use-overview input[type="date"]').attributes('max')).toBe('2026-07-17');
  });

  it('returns to the recovered overview while the following week is still empty', () => {
    const { pinia, store } = createStore();
    store.weeklyReviews = [{ ...emptyWeeklyReview('2026-07-13'), results: ['Закончил черновик'] }];
    const wrapper = mount(WeekView, {
      global: { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } },
    });

    expect(wrapper.get('.period-nav__label').text()).toContain('Ваш первый обзор недели');
    expect(wrapper.get('#first-use-overview').text()).toContain('Закончил черновик');
    expect(wrapper.find('.period-empty-guide').exists()).toBe(false);
  });

  it('keeps the current week as the default after it gets its own data', () => {
    const { pinia, store } = createStore();
    store.weeklyReviews = [{ ...emptyWeeklyReview('2026-07-13'), results: ['Закончил черновик'] }];
    store.dailyEntries = [{ ...emptyDailyEntry('2026-07-21'), importantFact: 'Первая запись текущей недели' }];
    const wrapper = mount(WeekView, {
      global: { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } },
    });

    expect(wrapper.get('.period-nav__label').text()).toContain('Текущая неделя');
    expect(wrapper.find('.metrics-grid').exists()).toBe(true);
    expect(wrapper.find('.period-empty-guide').exists()).toBe(false);
    expect(wrapper.get('.recovered-week-link').text()).toContain('Ваш первый обзор сохранён');
  });

  it('links the week and month summaries to their review forms', () => {
    vi.setSystemTime(new Date(2026, 7, 30, 12));
    const { pinia, store } = createStore();
    store.dailyEntries = [{ ...emptyDailyEntry('2026-08-30'), importantFact: 'Есть данные для обзора' }];
    const global = { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } };
    const week = mount(WeekView, { global });
    const month = mount(MonthView, { global });

    expect(week.get('.review-jump').attributes('href')).toBe('#week-review');
    expect(week.get('#week-review').classes()).toContain('review-card');
    expect(month.get('.review-jump').attributes('href')).toBe('#month-review');
    expect(month.get('#month-review').classes()).toContain('review-card');
  });

  it('keeps current-period reviews optional and out of the way until the end', () => {
    const { pinia, store } = createStore();
    store.dailyEntries = [{ ...emptyDailyEntry('2026-07-21'), importantFact: 'Обычная запись' }];
    const global = { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } };
    const week = mount(WeekView, { global });
    const month = mount(MonthView, { global });

    expect(week.get('#week-review').classes()).toContain('period-review-note');
    expect(week.text()).toContain('Его можно пропустить');
    expect(month.get('#month-review').classes()).toContain('period-review-note');
    expect(month.text()).toContain('Его можно пропустить');
    expect(week.find('.review-card').exists()).toBe(false);
    expect(month.find('.review-card').exists()).toBe(false);
  });

  it('does not show empty analytics or review forms as work to complete', () => {
    const { pinia } = createStore();
    const global = { plugins: [pinia], stubs: { EChartPanel: true, RouterLink: routerLinkStub } };
    const week = mount(WeekView, { global });
    const month = mount(MonthView, { global });
    const trends = mount(TrendsView, { global });

    for (const wrapper of [week, month, trends]) {
      expect(wrapper.find('.period-empty-guide').exists()).toBe(true);
      expect(wrapper.find('.metrics-grid').exists()).toBe(false);
      expect(wrapper.find('.dashboard-card').exists()).toBe(false);
    }
    expect(week.find('#week-review').exists()).toBe(false);
    expect(month.find('#month-review').exists()).toBe(false);
    expect(week.find('.review-jump').exists()).toBe(false);
    expect(month.find('.review-jump').exists()).toBe(false);
  });
});
