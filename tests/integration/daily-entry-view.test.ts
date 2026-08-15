// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import { notifySaved, notifyUnknownError } from '../../src/services/notifications';
import CurrentGoalDialog from '../../src/features/daily-entry/ui/CurrentGoalDialog.vue';
import { emptyDailyEntry, emptyWeeklyReview } from '../../src/types';
import TodayView from '../../src/views/TodayView.vue';
import { createStore, routerLinkStub } from '../helpers/viewScenario';

vi.mock('../../src/services/notifications', () => ({
  notifyError: vi.fn(),
  notifyInfo: vi.fn(),
  notifySaved: vi.fn(),
  notifyUnknownError: vi.fn(),
}));

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
    expect(wrapper.text()).toContain('Текущая цель');
    expect(wrapper.text()).toContain('Остальные части дня');
    expect(wrapper.text()).toContain('Короткий итог дня');
    expect(wrapper.text()).not.toContain('Сон перед этой датой и сколько сил было в этот день.');
  });

  it('keeps one goal action before optional work context', async () => {
    const { pinia, store } = createStore();
    store.dailyEntries = [{ ...emptyDailyEntry('2026-07-20'), importantFact: 'Обычная запись' }];
    store.settings.activeDailyBlocks = ['career'];
    store.settings.activeLifeAreas = [];
    store.settings.activeFocusTitle = 'Подготовить доклад';
    store.settings.focusOutcomeCriterion = 'Провести репетицию';
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });
    const goalCard = wrapper.get('#goal-actions');
    const workCard = wrapper.get('#career');

    expect(wrapper.html().indexOf('id="goal-actions"')).toBeLessThan(wrapper.html().indexOf('id="career"'));
    expect(goalCard.get('h2').text()).toBe('Шаг по текущей цели');
    expect(goalCard.get('.goal-context-details').attributes('open')).toBeUndefined();
    expect(workCard.get('h2').text()).toBe('Рабочий контекст');
    expect(workCard.text()).toContain('не считается шагом по текущей цели');
    expect(workCard.find('textarea').exists()).toBe(false);
    expect(wrapper.find('#life-areas').exists()).toBe(false);

    await goalCard
      .findAll('.chip')
      .find((chip) => chip.text().includes('Шаг к цели'))!
      .trigger('click');
    expect(goalCard.find('#goal-action-note').exists()).toBe(true);
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
    expect(wrapper.text()).toContain('Шаг по текущей цели');
    expect(wrapper.text()).toContain('Физическая активность');
    const directionCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Шаг по текущей цели');
    expect(directionCard?.findAll('.chip').map((chip) => chip.text())).not.toContain('Восстановление');
    expect(directionCard?.get('.goal-context-details').attributes('open')).toBeUndefined();
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
    expect(document.body.querySelector('.floating-save-button')?.textContent).toContain('Сохранить день');
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
      entrySchemaVersion: 3,
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
    expect(document.body.querySelector('.floating-save-button')).toBeNull();
  });

  it('saves an optional daily experiment note and rejects a bypassed length limit', async () => {
    const { pinia, store } = createStore();
    store.settings.experiment = {
      ...store.settings.experiment,
      active: true,
      title: 'Не читать новости после 22:00',
      startDate: '2026-07-20',
      endDate: '2026-07-27',
    };
    const saveEntry = vi.spyOn(store, 'saveEntry').mockImplementation(async (entry) => entry);
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });
    const experimentCard = wrapper.get('#experiment');
    const note = experimentCard.get('#experiment-note');

    expect(note.attributes('maxlength')).toBe('500');
    await note.setValue('x'.repeat(501));
    await wrapper.get('form').trigger('submit');
    expect(saveEntry).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain('Заметка к эксперименту длиннее 500 символов');

    await note.setValue('Заранее убрал телефон, но поздний звонок сбил план');
    await experimentCard
      .findAll('button')
      .find((button) => button.text() === 'Нет')!
      .trigger('click');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        experimentCompleted: false,
        experimentNote: 'Заранее убрал телефон, но поздний звонок сбил план',
      }),
    );
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
    const actionNone = wrapper.findAll('button').find((button) => button.text() === 'Шага по цели не было');
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
    store.settings.activeLifeAreas = [];
    store.dailyEntries = [
      {
        ...emptyDailyEntry('2026-07-21'),
        bedtime: '23:40',
        wakeTime: '07:30',
        sleepMinutes: 600,
        timeInBedMinutes: 470,
        nutritionState: 'supports_goal',
        actionDirection: 'preparation',
        lifeAreas: ['family'],
        lifeAreasRecorded: true,
        recordedFields: ['actionDirection', 'lifeAreas'],
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
    expect(headings).not.toContain('Рабочий контекст');
    expect(headings).not.toContain('Физическая активность');
    expect(headings).not.toContain('Питание');
    expect(headings).toContain('Заметка дня');
    expect(headings).toContain('Области жизни');
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

  it('protects a daily draft locally and restores it without creating a completed entry', async () => {
    const { pinia, store } = createStore();
    vi.spyOn(store, 'saveDailyEntryDraft').mockImplementation(async (entry) => {
      const draft = { date: entry.date, entry: structuredClone(entry), updatedAt: '2026-07-21T12:00:00.000Z' };
      store.dailyEntryDrafts = [draft];
      return draft;
    });
    const firstWrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });
    const firstFact = firstWrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Заметка дня');

    await firstFact!.get('textarea').setValue('Черновик важной мысли');
    expect(document.body.querySelector('.floating-save-button')?.textContent).toContain('Сохранить день');
    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();

    expect(store.saveDailyEntryDraft).toHaveBeenCalledWith(expect.objectContaining({ importantFact: 'Черновик важной мысли' }));
    expect(store.dailyEntries).toEqual([]);
    expect(firstWrapper.text()).toContain('Черновик сохранён на этом устройстве');
    firstWrapper.unmount();

    const restoredWrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });
    const restoredFact = restoredWrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Заметка дня');
    expect(restoredFact!.get('textarea').element).toHaveProperty('value', 'Черновик важной мысли');
    expect(restoredWrapper.text()).toContain('Восстановлены несохранённые изменения');
  });

  it('edits the current goal on Today without leaving or losing a dirty daily form', async () => {
    const { pinia, store } = createStore();
    vi.spyOn(store, 'saveSettings').mockImplementation(async (settings) => {
      store.settings = JSON.parse(JSON.stringify(settings));
    });
    const confirm = vi.spyOn(window, 'confirm');
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub, Teleport: true } },
    });
    const factCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Заметка дня');
    await factCard!.get('textarea').setValue('Не потерять введённый текст');

    await wrapper.get('.current-goal-summary button').trigger('click');
    const goalDialog = wrapper.getComponent(CurrentGoalDialog);
    expect(goalDialog.props('open')).toBe(true);
    await flushPromises();
    await goalDialog.get('#current-goal-title').setValue('Подготовиться к собеседованию');
    await goalDialog.get('#current-goal-outcome').setValue('Провести пробную встречу');
    await goalDialog.get('#current-goal-review-date').setValue('2026-08-01');
    await goalDialog.get('#current-goal-evidence').setValue('Получить независимую обратную связь');
    await goalDialog.get('form').trigger('submit');
    await flushPromises();

    expect(store.settings.activeFocusTitle).toBe('Подготовиться к собеседованию');
    expect(store.settings.externalEvidenceCriterion).toBe('Получить независимую обратную связь');
    expect(wrapper.get('.current-goal-summary').text()).toContain('Подготовиться к собеседованию');
    expect(factCard!.get('textarea').element).toHaveProperty('value', 'Не потерять введённый текст');
    expect(confirm).not.toHaveBeenCalled();
    expect(notifySaved).toHaveBeenCalledWith('Текущая цель сохранена');
  });

  it('allows removing the current goal after its settings block was moved to Today', async () => {
    const { pinia, store } = createStore();
    store.settings.activeFocusTitle = 'Старая цель';
    vi.spyOn(store, 'saveSettings').mockImplementation(async (settings) => {
      store.settings = JSON.parse(JSON.stringify(settings));
    });
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub, Teleport: true } },
    });

    await wrapper.get('.current-goal-summary button').trigger('click');
    const goalDialog = wrapper.getComponent(CurrentGoalDialog);
    const removeButton = goalDialog.findAll('button').find((button) => button.text() === 'Убрать цель');
    await removeButton!.trigger('click');
    await flushPromises();

    expect(store.settings.activeFocusTitle).toBe('');
    expect(wrapper.get('.current-goal-summary').text()).toContain('Пока не выбрана');
    expect(notifySaved).toHaveBeenCalledWith('Текущая цель убрана');
  });

  it('reports a local save error and allows retrying', async () => {
    const { pinia, store } = createStore();
    const saveEntry = vi.spyOn(store, 'saveEntry').mockRejectedValue(new Error('IndexedDB unavailable'));
    const wrapper = mount(TodayView, {
      global: { plugins: [pinia], stubs: { RouterLink: routerLinkStub } },
    });
    const factCard = wrapper.findAll('.form-card').find((card) => card.find('h2').text() === 'Заметка дня');
    await factCard!.get('textarea').setValue('Не потерять эту запись');
    expect(document.body.querySelector('.floating-save-button')).not.toBeNull();
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(saveEntry).toHaveBeenCalledOnce();
    expect(notifyUnknownError).toHaveBeenCalledWith(expect.any(Error), 'Не удалось сохранить день');
    expect(notifySaved).not.toHaveBeenCalled();
    expect((document.body.querySelector('.floating-save-button') as HTMLButtonElement).disabled).toBe(false);
    expect(document.body.querySelector('.floating-save-button')).not.toBeNull();
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
    const { pinia, store } = createStore();
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
    vi.spyOn(store, 'saveDailyEntryDraft').mockRejectedValue(new Error('IndexedDB unavailable'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
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
