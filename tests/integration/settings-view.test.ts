// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { copyText } from '../../src/features/export/browser';
import { notifyError, notifySaved, notifyUnknownError } from '../../src/services/notifications';
import { useAuthStore } from '../../src/stores/auth';
import { emptyDailyEntry } from '../../src/types';
import SettingsView from '../../src/views/SettingsView.vue';
import { createStore } from '../helpers/viewScenario';

vi.mock('../../src/services/notifications', () => ({
  notifyError: vi.fn(),
  notifyInfo: vi.fn(),
  notifySaved: vi.fn(),
  notifyUnknownError: vi.fn(),
}));

vi.mock('../../src/features/export/browser', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/features/export/browser')>()),
  copyText: vi.fn(),
}));

describe('settings scenarios', () => {
  it('separates daily, experiment, data and account settings without duplicating controls', async () => {
    const { pinia } = createStore();
    const auth = useAuthStore();
    auth.configured = true;
    auth.session = { user: { id: 'user-1', email: 'friend@example.com' } } as typeof auth.session;
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });
    const tabs = wrapper.findAll('[aria-label="Разделы настроек"] button');

    expect(tabs.map((tab) => tab.text())).toEqual(['Ежедневная запись', 'Эксперимент', 'Данные и синхронизация', 'Аккаунт и безопасность']);
    expect(wrapper.findAll('.settings-group')).toHaveLength(4);
    expect(wrapper.get('#daily-settings').attributes('style')).toContain('animation: page-in 0.25s ease-out');
    expect(wrapper.get('#daily-settings').attributes('style')).not.toContain('display: none');
    expect(wrapper.get('#data-settings').attributes('style')).toContain('display: none');
    expect(wrapper.find('#goal-settings').exists()).toBe(false);
    expect(wrapper.get('#daily-settings').text()).not.toContain('Текущая цель');

    await tabs[2]!.trigger('click');
    expect(wrapper.get('#daily-settings').attributes('style')).toContain('display: none');
    expect(wrapper.get('#data-settings').attributes('style')).toContain('animation: page-in 0.25s ease-out');
    expect(wrapper.get('#data-settings').attributes('style')).not.toContain('display: none');
    expect(wrapper.get('#data-settings').text()).toContain('Автоматическая облачная копия');
    expect(wrapper.get('#data-settings').text()).not.toContain('Удалить аккаунт');

    await tabs[3]!.trigger('click');
    expect(wrapper.get('#account-settings').attributes('style')).toContain('animation: page-in 0.25s ease-out');
    expect(wrapper.get('#account-settings').attributes('style')).not.toContain('display: none');
    expect(wrapper.get('#account-settings').text()).toContain('friend@example.com');
    expect(wrapper.get('#account-settings').findAll('button[aria-label="Показать пароль"]')).toHaveLength(2);
    expect(wrapper.get('#new-password').attributes('autocomplete')).toBe('new-password');
    await wrapper.get('#new-password').setValue('new-safe-password');
    await wrapper.get('#account-settings button[aria-controls="new-password"]').trigger('click');
    expect(wrapper.get('#new-password').attributes('type')).toBe('text');
    expect((wrapper.get('#new-password').element as HTMLInputElement).value).toBe('new-safe-password');
    expect(
      wrapper
        .get('#account-settings')
        .findAll('button')
        .filter((button) => button.text() === 'Удалить аккаунт'),
    ).toHaveLength(1);
  });

  it('keeps a confirmed password update visible beside the form until the next input', async () => {
    const { pinia } = createStore();
    const auth = useAuthStore();
    auth.configured = true;
    auth.session = { user: { id: 'user-1', email: 'friend@example.com' } } as typeof auth.session;
    auth.updatePassword = vi.fn().mockResolvedValue(undefined);
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });

    await wrapper.get('#new-password').setValue('new-safe-password');
    await wrapper.get('#new-password-confirmation').setValue('new-safe-password');
    await wrapper.get('.account-security__form .secondary-button').trigger('click');
    await flushPromises();

    expect(auth.updatePassword).toHaveBeenCalledWith('new-safe-password');
    expect((wrapper.get('#new-password').element as HTMLInputElement).value).toBe('');
    expect((wrapper.get('#new-password-confirmation').element as HTMLInputElement).value).toBe('');
    expect(wrapper.get('.account-security__form [role="status"]').text()).toBe('Пароль обновлён');
    expect(wrapper.get('.account-security__form [role="status"]').attributes('aria-live')).toBe('polite');

    await wrapper.get('#new-password').setValue('another-password');
    expect(wrapper.find('.account-security__form [role="status"]').exists()).toBe(false);
  });

  it('does not keep a stale password success after an error or sign out', async () => {
    const { pinia } = createStore();
    const auth = useAuthStore();
    auth.configured = true;
    auth.session = { user: { id: 'user-1', email: 'friend@example.com' } } as typeof auth.session;
    auth.updatePassword = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('network error'));
    auth.signOut = vi.fn().mockImplementation(async () => {
      auth.session = null;
    });
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });

    await wrapper.get('#new-password').setValue('new-safe-password');
    await wrapper.get('#new-password-confirmation').setValue('new-safe-password');
    await wrapper.get('.account-security__form .secondary-button').trigger('click');
    await flushPromises();
    expect(wrapper.find('.account-security__form [role="status"]').exists()).toBe(true);

    await wrapper.get('#new-password').setValue('second-safe-password');
    await wrapper.get('#new-password-confirmation').setValue('second-safe-password');
    await wrapper.get('.account-security__form .secondary-button').trigger('click');
    await flushPromises();
    expect(wrapper.find('.account-security__form [role="status"]').exists()).toBe(false);
    expect(notifyError).toHaveBeenCalledWith('Не удалось изменить пароль');

    auth.updatePassword = vi.fn().mockResolvedValue(undefined);
    await wrapper.get('.account-security__form .secondary-button').trigger('click');
    await wrapper.get('.cloud-session__logout').trigger('click');
    await flushPromises();
    expect(wrapper.find('.account-security__form [role="status"]').exists()).toBe(false);
  });

  it('blocks a repeated settings save and allows retrying after an error', async () => {
    const { pinia, store } = createStore();
    let rejectFirstSave!: (error: Error) => void;
    const firstSave = new Promise<void>((_, reject) => {
      rejectFirstSave = reject;
    });
    const saveSettings = vi.spyOn(store, 'saveSettings').mockReturnValueOnce(firstSave).mockResolvedValueOnce(undefined);
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });
    const saveButton = wrapper.get('.settings-card--daily-blocks .primary-button');

    await saveButton.trigger('click');
    await saveButton.trigger('click');
    expect(saveSettings).toHaveBeenCalledOnce();
    expect(saveButton.attributes('disabled')).toBeDefined();

    rejectFirstSave(new Error('IndexedDB unavailable'));
    await flushPromises();
    expect(notifyUnknownError).toHaveBeenCalledWith(expect.any(Error), 'Не удалось сохранить настройки');
    expect(saveButton.attributes('disabled')).toBeUndefined();

    await saveButton.trigger('click');
    await flushPromises();
    expect(saveSettings).toHaveBeenCalledTimes(2);
    expect(notifySaved).toHaveBeenCalledWith('Блоки ежедневной записи сохранены');
  });

  it('blocks repeated data clearing and allows retrying after an error', async () => {
    const { pinia, store } = createStore();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let rejectFirstClear!: (error: Error) => void;
    const firstClear = new Promise<void>((_, reject) => {
      rejectFirstClear = reject;
    });
    const clearAll = vi.spyOn(store, 'clearAll').mockReturnValueOnce(firstClear).mockResolvedValueOnce(undefined);
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });
    const clearButton = wrapper.get('.settings-card--backup .danger-button');

    await clearButton.trigger('click');
    await clearButton.trigger('click');

    expect(clearAll).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(clearButton.text()).toBe('Удаляю…');
    expect(clearButton.attributes('disabled')).toBeDefined();

    rejectFirstClear(new Error('IndexedDB unavailable'));
    await flushPromises();

    expect(notifyUnknownError).toHaveBeenCalledWith(expect.any(Error), 'Не удалось удалить данные');
    expect(clearButton.text()).toBe('Удалить');
    expect(clearButton.attributes('disabled')).toBeUndefined();

    await clearButton.trigger('click');
    await flushPromises();
    expect(clearAll).toHaveBeenCalledTimes(2);
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

    const deleteButton = wrapper.findAll('.settings-card--account button').find((button) => button.text() === 'Удалить аккаунт');
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

    const deleteButton = wrapper.findAll('.settings-card--account button').find((button) => button.text() === 'Удалить аккаунт');
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(clearAll).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith('Не удалось удалить аккаунт.');
    confirm.mockRestore();
    prompt.mockRestore();
  });

  it('reports partial success and hides in-memory data when local cleanup fails after account deletion', async () => {
    const { pinia, store } = createStore();
    const auth = useAuthStore();
    auth.configured = true;
    auth.session = { user: { id: 'user-1', email: 'friend@example.com' } } as typeof auth.session;
    auth.deleteAccount = vi.fn().mockResolvedValue(undefined);
    store.results = [{ id: 1, date: '2026-07-21', area: 'career', title: 'Личный итог', note: '', createdAt: '' }];
    const clearAll = vi.spyOn(store, 'clearAll').mockRejectedValue(new Error('IndexedDB unavailable'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('friend@example.com');
    const wrapper = mount(SettingsView, {
      global: { plugins: [pinia], mocks: { $route: { query: {} } } },
    });

    const deleteButton = wrapper.findAll('.settings-card--account button').find((button) => button.text() === 'Удалить аккаунт');
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(auth.deleteAccount).toHaveBeenCalledOnce();
    expect(clearAll).toHaveBeenCalledWith({ syncCloud: false });
    expect(store.results).toEqual([]);
    expect(notifyError).toHaveBeenCalledWith(
      'Аккаунт и облачная копия удалены, но данные на этом устройстве очистить не удалось. Очистите данные сайта в настройках браузера.',
    );
    expect(notifyError).not.toHaveBeenCalledWith('Не удалось удалить аккаунт');
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
    await wrapper.get('#analysis-settings .analysis-range').findAll('button')[0]!.trigger('click');

    expect(notifyError).toHaveBeenCalledWith('Начало периода должно быть не позже окончания');
  });

  it('blocks repeated external analysis copy until the current copy finishes', async () => {
    const { pinia } = createStore();
    let finishCopy: () => void = () => undefined;
    vi.mocked(copyText).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishCopy = resolve;
        }),
    );
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });
    const copyButton = wrapper
      .get('#analysis-settings')
      .findAll('button')
      .find((button) => button.text() === 'Подготовить текст недели')!;

    await copyButton.trigger('click');
    await copyButton.trigger('click');

    expect(copyText).toHaveBeenCalledTimes(1);
    expect(copyButton.attributes('disabled')).toBeDefined();

    finishCopy();
    await flushPromises();

    expect(copyButton.attributes('disabled')).toBeUndefined();
    expect(notifySaved).toHaveBeenCalledWith('Текст для нейросети скопирован');
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
    expect(card.get('#experiment-title').attributes('maxlength')).toBe('800');
    expect(card.get('#experiment-hypothesis').attributes('maxlength')).toBe('800');
    await card.get('#experiment-title').setValue(experimentTitle);
    await card.get('.primary-button').trigger('click');
    expect(notifyError).toHaveBeenCalledWith('Укажите, с какого и до какого дня идёт эксперимент');
    expect(saveSettings).not.toHaveBeenCalled();

    await card.findAll('input[type="date"]')[0]!.setValue('2026-07-15');
    await card.findAll('input[type="date"]')[1]!.setValue('2026-07-21');
    await card.get('#experiment-title').setValue('x'.repeat(801));
    await card.get('.primary-button').trigger('click');
    expect(notifyError).toHaveBeenCalledWith('Условие эксперимента длиннее 800 символов. Сократите текст, чтобы сохранить его.');
    expect(saveSettings).not.toHaveBeenCalled();

    await card.get('#experiment-title').setValue(experimentTitle);
    await card.get('.primary-button').trigger('click');
    await flushPromises();

    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        experiment: expect.objectContaining({
          id: expect.stringMatching(/^experiment-/),
          title: experimentTitle,
          targetMetricId: null,
          minimumMeaningfulChange: null,
          startDate: '2026-07-15',
          endDate: '2026-07-21',
        }),
      }),
    );

    await card.get('#experiment-conclusion').setValue('Вечером было спокойнее');
    expect(card.get('#experiment-conclusion').attributes('maxlength')).toBe('2000');
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

  it('keeps a started experiment identity stable and allows only extending its end date', async () => {
    const { pinia, store } = createStore();
    store.settings.experiment = {
      ...store.settings.experiment,
      id: 'started-experiment',
      active: true,
      title: 'Начинать важное действие сразу',
      startDate: '2026-07-15',
      endDate: '2026-07-21',
    };
    store.dailyEntries = [
      {
        ...emptyDailyEntry('2026-07-20'),
        experimentId: 'started-experiment',
        experimentCompleted: true,
      },
    ];
    const saveSettings = vi.spyOn(store, 'saveSettings').mockImplementation(async (nextSettings) => {
      store.settings = structuredClone(nextSettings);
    });
    const wrapper = mount(SettingsView, { global: { plugins: [pinia] } });
    const card = wrapper.get('.settings-card--experiment');
    const dates = card.findAll('input[type="date"]');

    expect(card.get('#experiment-title').attributes('readonly')).toBeDefined();
    expect(dates[0]!.attributes('disabled')).toBeDefined();
    expect(dates[1]!.attributes('min')).toBe('2026-07-21');

    await dates[1]!.setValue('2026-07-20');
    await card.get('.primary-button').trigger('click');
    expect(notifyError).toHaveBeenCalledWith(
      'Начавшийся эксперимент можно только продлить. Уже сохранённые дни останутся в текущем периоде.',
    );
    expect(saveSettings).not.toHaveBeenCalled();

    await dates[1]!.setValue('2026-07-28');
    expect(card.get('.primary-button').text()).toBe('Продлить эксперимент');
    await card.get('.primary-button').trigger('click');
    await flushPromises();

    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ experiment: expect.objectContaining({ id: 'started-experiment', endDate: '2026-07-28' }) }),
    );
    expect(notifySaved).toHaveBeenCalledWith('Эксперимент продлён');
  });
});
