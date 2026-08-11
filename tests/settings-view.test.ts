// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import SettingsView from '../src/views/SettingsView.vue';
import { loadCloudSnapshot, markCloudSyncSynced } from '../src/services/cloudSync';
import { notifyError, notifySaved, notifyUnknownError } from '../src/services/notifications';
import { useAuthStore } from '../src/stores/auth';
import { createStore } from './helpers/viewScenario';

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
    expect(
      wrapper
        .get('#account-settings')
        .findAll('button')
        .filter((button) => button.text() === 'Удалить аккаунт'),
    ).toHaveLength(1);
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
