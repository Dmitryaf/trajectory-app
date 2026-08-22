import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import ChipGroup from '../../shared/ui/forms/ChipGroup.vue';
import { useAppStore } from '../../stores/app';
import { useAuthStore } from '../../stores/auth';
import { copyText, downloadJson } from '../export/browser';
import { buildAiReportCustomRangePayload, buildAiReportPayload, buildAiReportPrompt, type AiReportPeriod } from '../export/report';
import {
  createExperimentRecord,
  createExperimentId,
  emptyExperiment,
  experimentDecisionOptions,
  experimentPeriodsOverlap,
  experimentTextLimits,
  validateExperimentTextLengths,
} from '../experiments/model';
import { addDays, todayKey } from '../../services/dates';
import { notifyError, notifyInfo, notifySaved, notifyUnknownError } from '../../services/notifications';
import { plainCopy } from '../../services/plain';
import { setSyncEditorDirty } from '../sync/editing';
import {
  activityOptions,
  careerOptions,
  contextFactorOptions,
  createCustomOption,
  dailyBlockOptions,
  legacyActivityOptions,
  legacyCareerOptions,
  lifeAreaOptions,
  type ActivityId,
  type AppSettings,
  type CareerState,
  type ContextFactorId,
  type LifeAreaId,
  type Option,
} from '../../types';

export function useSettingsForm() {
  const store = useAppStore();
  const settings = reactive<AppSettings>(plainCopy(store.settings));
  const settingsBaseline = ref(JSON.stringify(store.settings));
  const settingsDirty = computed(() => JSON.stringify(settings) !== settingsBaseline.value);
  watch(settingsDirty, (dirty) => setSyncEditorDirty('settings', dirty), { immediate: true });
  function replaceSettingsFromStore() {
    Object.assign(settings, plainCopy(store.settings));
    settingsBaseline.value = JSON.stringify(store.settings);
  }
  function handleCloudSnapshotApplied() {
    if (!settingsDirty.value) replaceSettingsFromStore();
  }
  window.addEventListener('trajectory:cloud-snapshot-applied', handleCloudSnapshotApplied);
  onBeforeUnmount(() => {
    setSyncEditorDirty('settings', false);
    window.removeEventListener('trajectory:cloud-snapshot-applied', handleCloudSnapshotApplied);
  });
  const importInput = ref<HTMLInputElement>();
  const newCareerLabel = ref('');
  const newActivityLabel = ref('');
  const newLifeAreaLabel = ref('');
  const newContextFactorLabel = ref('');
  const newPassword = ref('');
  const newPasswordConfirmation = ref('');
  const passwordUpdateStatus = ref('');
  const analysisStart = ref(addDays(todayKey(), -30));
  const analysisEnd = ref(todayKey());
  const analysisMaxDate = todayKey();
  const savingActions = reactive(new Set<string>());
  const auth = useAuthStore();
  watch([newPassword, newPasswordConfirmation], ([password, confirmation]) => {
    if (password || confirmation) passwordUpdateStatus.value = '';
  });
  watch(
    () => auth.session?.user.id,
    () => {
      passwordUpdateStatus.value = '';
    },
  );
  const allCareerOptions = computed(() => {
    const usedIds = new Set([
      ...store.dailyEntries.flatMap((entry) => entry.careerStates),
      ...store.dailyEntries.flatMap((entry) => (entry.careerState ? [entry.careerState] : [])),
    ]);
    return Array.from(
      new Map(
        [
          ...careerOptions,
          ...settings.customCareerOptions.filter((option) => !option.archived),
          ...legacyCareerOptions.filter((option) => usedIds.has(option.id)),
        ].map((option) => [option.id, option]),
      ).values(),
    );
  });
  const activeActivityOptions = computed(() => [
    ...activityOptions.filter((option) => !settings.hiddenActivityIds.includes(option.id)),
    ...settings.customActivityOptions.filter((option) => !option.archived),
  ]);
  const hiddenActivityOptions = computed(() => [
    ...activityOptions.filter((option) => settings.hiddenActivityIds.includes(option.id)),
    ...settings.customActivityOptions.filter((option) => option.archived),
  ]);
  const allLifeAreaOptions = computed(() => [...lifeAreaOptions, ...settings.customLifeAreaOptions.filter((option) => !option.archived)]);
  const activeContextFactorOptions = computed(() => [
    ...contextFactorOptions.filter((option) => !settings.hiddenContextFactorIds.includes(option.id)),
    ...settings.customContextFactorOptions.filter((option) => !option.archived),
  ]);
  const hiddenContextFactorOptions = computed(() => [
    ...contextFactorOptions.filter((option) => settings.hiddenContextFactorIds.includes(option.id)),
    ...settings.customContextFactorOptions.filter((option) => option.archived),
  ]);
  const cloudSession = computed(() => auth.session);
  const cloudUserEmail = computed(() => auth.userEmail);
  const cloudStatusTitle = computed(() => {
    if (!auth.configured) return 'Облако не подключено';
    if (store.cloudSyncStatus === 'synced') return 'Облако синхронизировано';
    if (store.cloudSyncStatus === 'syncing') return 'Идёт синхронизация';
    if (store.cloudSyncStatus === 'pending') return 'Есть локальные изменения';
    if (store.cloudSyncStatus === 'conflict') return 'Синхронизация повторяется';
    return 'Статус облака';
  });
  const cloudStatusText = computed(() => store.cloudSyncMessage || 'Синхронизация готова.');
  const storageProtectionTitle = computed(() => {
    if (store.storagePersistenceStatus === 'persisted') return 'Локальное хранилище защищено';
    if (store.storagePersistenceStatus === 'checking' || store.storagePersistenceStatus === 'unknown')
      return 'Проверяю локальное хранилище';
    if (store.storagePersistenceStatus === 'best-effort') return 'Локальное хранилище работает без дополнительной защиты';
    if (store.storagePersistenceStatus === 'unsupported') return 'Режим хранения не сообщается браузером';
    return 'Не удалось проверить режим хранения';
  });
  const storageProtectionText = computed(() => {
    if (store.storagePersistenceStatus === 'persisted') {
      return 'Браузер постарается не удалять локальные записи автоматически. Это не заменяет облачную копию или экспорт JSON.';
    }
    if (store.storagePersistenceStatus === 'checking' || store.storagePersistenceStatus === 'unknown') {
      return 'Записи уже доступны. Проверка не блокирует работу приложения.';
    }
    return 'Записи сохраняются на устройстве, но браузер может очистить их при нехватке места. Используйте облачную копию и периодически скачивайте JSON.';
  });
  const experimentCanConclude = computed(() => Boolean(settings.experiment.endDate && settings.experiment.endDate <= todayKey()));
  const experimentIdentityLocked = computed(() => {
    const saved = store.settings.experiment;
    return Boolean(saved.active && saved.id && store.dailyEntries.some((entry) => entry.experimentId === saved.id));
  });
  const experimentSaveLabel = computed(() => {
    if (isSaving('experiment')) return 'Сохраняю…';
    const saved = store.settings.experiment;
    return experimentIdentityLocked.value && settings.experiment.endDate > saved.endDate ? 'Продлить эксперимент' : 'Сохранить настройки';
  });

  function isSaving(action: string) {
    return savingActions.has(action);
  }

  async function runAction(action: string, fallback: string, operation: () => Promise<void>) {
    if (isSaving(action)) return false;
    savingActions.add(action);
    try {
      await operation();
      return true;
    } catch (error) {
      notifyUnknownError(error, fallback);
      return false;
    } finally {
      savingActions.delete(action);
    }
  }

  async function save(message = 'Настройки сохранены', action = 'settings', nextSettings: AppSettings = plainCopy(settings)) {
    return runAction(action, 'Не удалось сохранить настройки', async () => {
      await store.saveSettings(nextSettings);
      settingsBaseline.value = JSON.stringify(nextSettings);
      notifySaved(message);
    });
  }

  function validateStartedExperimentChange(experiment: AppSettings['experiment']): string {
    if (!experimentIdentityLocked.value) return '';
    const saved = store.settings.experiment;
    if (experiment.id !== saved.id || experiment.title.trim() !== saved.title.trim() || experiment.startDate !== saved.startDate) {
      return 'После первой записи условие и дату начала нельзя менять. Завершите этот эксперимент и создайте новый.';
    }
    if (experiment.endDate < saved.endDate) {
      return 'Начавшийся эксперимент можно только продлить. Уже сохранённые дни останутся в текущем периоде.';
    }
    return '';
  }

  async function saveExperiment() {
    if (isSaving('experiment')) return;
    const nextSettings = plainCopy(settings);
    const experiment = nextSettings.experiment;
    if (experiment.active && !experiment.id) experiment.id = createExperimentId();
    const lengthError = validateExperimentTextLengths(experiment);
    if (lengthError) {
      notifyError(lengthError);
      return;
    }
    if (experiment.active && !experiment.title.trim()) {
      notifyError('Напишите, что хотите попробовать');
      return;
    }
    if (experiment.active && (!experiment.startDate || !experiment.endDate)) {
      notifyError('Укажите, с какого и до какого дня идёт эксперимент');
      return;
    }
    if (experiment.startDate && experiment.endDate && experiment.startDate > experiment.endDate) {
      notifyError('Дата окончания эксперимента должна быть не раньше даты начала');
      return;
    }
    const identityError = validateStartedExperimentChange(experiment);
    if (identityError) {
      notifyError(identityError);
      return;
    }
    if (experiment.active && settings.experimentHistory.some((record) => experimentPeriodsOverlap(experiment, record))) {
      notifyError('Период пересекается с завершённым экспериментом');
      return;
    }
    const extending = experimentIdentityLocked.value && experiment.endDate > store.settings.experiment.endDate;
    if (await save(extending ? 'Эксперимент продлён' : 'Эксперимент сохранён', 'experiment', nextSettings)) {
      Object.assign(settings, nextSettings);
    }
  }

  async function completeExperiment() {
    if (isSaving('experiment')) return;
    const nextSettings = plainCopy(settings);
    const experiment = nextSettings.experiment;
    if (!experiment.id) experiment.id = createExperimentId();
    const lengthError = validateExperimentTextLengths(experiment);
    if (lengthError) {
      notifyError(lengthError);
      return;
    }
    if (!experiment.title.trim() || !experiment.startDate || !experiment.endDate) {
      notifyError('Напишите, что пробовали, и укажите даты');
      return;
    }
    if (experiment.startDate > experiment.endDate) {
      notifyError('Дата окончания эксперимента должна быть не раньше даты начала');
      return;
    }
    const identityError = validateStartedExperimentChange(experiment);
    if (identityError) {
      notifyError(identityError);
      return;
    }
    if (!experimentCanConclude.value) {
      notifyError('Эксперимент ещё не завершён');
      return;
    }
    if (!experiment.conclusion.trim()) {
      notifyError('Запишите, что вы заметили');
      return;
    }
    if (settings.experimentHistory.some((record) => experimentPeriodsOverlap(experiment, record))) {
      notifyError('Период пересекается с завершённым экспериментом');
      return;
    }
    nextSettings.experimentHistory.unshift(createExperimentRecord(experiment));
    nextSettings.experiment = emptyExperiment();
    if (await save('Эксперимент добавлен в историю', 'experiment', nextSettings)) {
      Object.assign(settings, nextSettings);
    }
  }

  async function addCareerOption() {
    if (isSaving('career')) return;
    const label = newCareerLabel.value.trim();
    if (!label || hasOption(careerOptions, label)) return;
    const archived = findArchived(settings.customCareerOptions, label);
    if (archived) {
      archived.archived = false;
      newCareerLabel.value = '';
      await save('Настройки сохранены', 'career');
      return;
    }
    if (hasOption(settings.customCareerOptions, label)) return;
    settings.customCareerOptions.push({ ...createCustomOption(label, 'career'), countsAsExternal: false });
    newCareerLabel.value = '';
    await save('Настройки сохранены', 'career');
  }

  async function addActivityOption() {
    if (isSaving('activity')) return;
    const label = newActivityLabel.value.trim();
    if (!label) return;
    const hiddenBuiltIn = activityOptions.find(
      (option) => settings.hiddenActivityIds.includes(option.id) && sameLabel(option.label, label),
    );
    if (hiddenBuiltIn) {
      settings.hiddenActivityIds = settings.hiddenActivityIds.filter((id) => id !== hiddenBuiltIn.id);
      newActivityLabel.value = '';
      await save('Вариант активности возвращён', 'activity');
      return;
    }
    if (hasOption(activityOptions, label)) return;
    const archived = findArchived(settings.customActivityOptions, label);
    if (archived) archived.archived = false;
    else if (!hasOption(settings.customActivityOptions, label)) {
      const legacy = legacyActivityOptions.find((option) => sameLabel(option.label, label));
      settings.customActivityOptions.push(legacy ? { ...legacy, custom: true } : createCustomOption(label, 'activity'));
    }
    newActivityLabel.value = '';
    await save('Варианты активности сохранены', 'activity');
  }

  async function removeActivityOption(id: ActivityId) {
    if (isSaving('activity')) return;
    const option = settings.customActivityOptions.find((item) => item.id === id);
    if (option) option.archived = true;
    else if (!settings.hiddenActivityIds.includes(id)) settings.hiddenActivityIds.push(id);
    await save('Вариант убран из ежедневной записи', 'activity');
  }

  async function restoreActivityOption(id: ActivityId) {
    if (isSaving('activity')) return;
    const option = settings.customActivityOptions.find((item) => item.id === id);
    if (option) option.archived = false;
    else settings.hiddenActivityIds = settings.hiddenActivityIds.filter((activityId) => activityId !== id);
    await save('Вариант активности возвращён', 'activity');
  }

  async function removeCareerOption(id: CareerState) {
    if (isSaving('career')) return;
    const option = settings.customCareerOptions.find((item) => item.id === id);
    if (option) option.archived = true;
    await save('Настройки сохранены', 'career');
  }

  async function addLifeArea() {
    if (isSaving('life-areas')) return;
    const label = newLifeAreaLabel.value.trim();
    if (!label || hasOption(lifeAreaOptions, label)) return;
    const archived = findArchived(settings.customLifeAreaOptions, label);
    if (archived) {
      archived.archived = false;
      settings.activeLifeAreas.push(archived.id);
      newLifeAreaLabel.value = '';
      await save('Настройки сохранены', 'life-areas');
      return;
    }
    if (hasOption(settings.customLifeAreaOptions, label)) return;
    const option = createCustomOption(label, 'life');
    settings.customLifeAreaOptions.push(option);
    settings.activeLifeAreas.push(option.id);
    newLifeAreaLabel.value = '';
    await save('Настройки сохранены', 'life-areas');
  }

  async function removeLifeArea(id: LifeAreaId) {
    if (isSaving('life-areas')) return;
    const option = settings.customLifeAreaOptions.find((item) => item.id === id);
    if (option) option.archived = true;
    settings.activeLifeAreas = settings.activeLifeAreas.filter((area) => area !== id);
    await save('Настройки сохранены', 'life-areas');
  }

  async function addContextFactor() {
    if (isSaving('context')) return;
    const label = newContextFactorLabel.value.trim();
    if (!label) return;
    const hiddenBuiltIn = contextFactorOptions.find(
      (option) => settings.hiddenContextFactorIds.includes(option.id) && sameLabel(option.label, label),
    );
    if (hiddenBuiltIn) {
      settings.hiddenContextFactorIds = settings.hiddenContextFactorIds.filter((id) => id !== hiddenBuiltIn.id);
      newContextFactorLabel.value = '';
      await save('Фактор дня возвращён', 'context');
      return;
    }
    if (hasOption(contextFactorOptions, label)) return;
    const archived = findArchived(settings.customContextFactorOptions, label);
    if (archived) archived.archived = false;
    else if (!hasOption(settings.customContextFactorOptions, label))
      settings.customContextFactorOptions.push(createCustomOption(label, 'context'));
    newContextFactorLabel.value = '';
    await save('Факторы дня сохранены', 'context');
  }

  async function removeContextFactor(id: ContextFactorId) {
    if (isSaving('context')) return;
    const option = settings.customContextFactorOptions.find((item) => item.id === id);
    if (option) option.archived = true;
    else if (!settings.hiddenContextFactorIds.includes(id)) settings.hiddenContextFactorIds.push(id);
    await save('Фактор убран из ежедневной записи', 'context');
  }

  async function restoreContextFactor(id: ContextFactorId) {
    if (isSaving('context')) return;
    const option = settings.customContextFactorOptions.find((item) => item.id === id);
    if (option) option.archived = false;
    else settings.hiddenContextFactorIds = settings.hiddenContextFactorIds.filter((factorId) => factorId !== id);
    await save('Фактор дня возвращён', 'context');
  }

  function hasOption(options: { label: string }[], label: string) {
    return options.some((option) => sameLabel(option.label, label));
  }

  function sameLabel(left: string, right: string) {
    return left.trim().toLocaleLowerCase('ru-RU') === right.trim().toLocaleLowerCase('ru-RU');
  }

  function findArchived<T extends string>(options: Option<T>[], label: string) {
    return options.find((option) => option.archived && option.label.trim().toLocaleLowerCase('ru-RU') === label.toLocaleLowerCase('ru-RU'));
  }

  function exportData() {
    try {
      downloadJson(store.exportData(), `trajectory-backup-${new Date().toISOString().slice(0, 10)}.json`);
      notifyInfo('Резервная копия скачана');
    } catch (error) {
      notifyUnknownError(error, 'Не удалось скачать резервную копию');
    }
  }

  async function signOutCloud() {
    passwordUpdateStatus.value = '';
    try {
      await auth.signOut();
      notifyInfo('Выход выполнен');
    } catch (error) {
      notifyUnknownError(error, 'Не удалось выйти из аккаунта');
    }
  }

  async function changePassword() {
    passwordUpdateStatus.value = '';
    if (newPassword.value.length < 8) {
      notifyError('Пароль должен содержать не меньше 8 символов');
      return;
    }
    if (newPassword.value !== newPasswordConfirmation.value) {
      notifyError('Пароли не совпадают');
      return;
    }
    try {
      await auth.updatePassword(newPassword.value);
      newPassword.value = '';
      newPasswordConfirmation.value = '';
      passwordUpdateStatus.value = 'Пароль обновлён';
      notifySaved('Пароль изменён');
    } catch {
      notifyError(auth.error || 'Не удалось изменить пароль');
    }
  }

  async function copyAnalysisPrompt(period: Exclude<AiReportPeriod, 'range'>) {
    await runAction(`analysis-${period}`, 'Не удалось подготовить текст для нейросети', async () => {
      const payload = createAnalysisPayload(period);
      await copyText(buildAiReportPrompt(payload, store.settings));
      notifySaved('Текст для нейросети скопирован');
    });
  }

  function downloadAnalysisData(period: Exclude<AiReportPeriod, 'range'>) {
    try {
      const payload = createAnalysisPayload(period);
      downloadJson(payload, `trajectory-analysis-${period}-${payload.start}-${payload.dataThrough}.json`);
      notifyInfo(period === 'week' ? 'Данные недели скачаны' : 'Данные месяца скачаны');
    } catch (error) {
      notifyUnknownError(error, 'Не удалось скачать данные для анализа');
    }
  }

  async function copyCustomAnalysisPrompt() {
    if (!analysisRangeIsValid()) return;
    await runAction('analysis-range', 'Не удалось подготовить текст для нейросети', async () => {
      const payload = createCustomAnalysisPayload();
      await copyText(buildAiReportPrompt(payload, store.settings));
      notifySaved('Текст выбранного периода скопирован');
    });
  }

  function downloadCustomAnalysisData() {
    if (!analysisRangeIsValid()) return;
    try {
      const payload = createCustomAnalysisPayload();
      downloadJson(payload, `trajectory-analysis-period-${payload.start}-${payload.dataThrough}.json`);
      notifyInfo('Данные выбранного периода скачаны');
    } catch (error) {
      notifyUnknownError(error, 'Не удалось скачать данные для анализа');
    }
  }

  function createAnalysisPayload(period: Exclude<AiReportPeriod, 'range'>) {
    return buildAiReportPayload(period, todayKey(), analysisSource());
  }

  function createCustomAnalysisPayload() {
    return buildAiReportCustomRangePayload(analysisStart.value, analysisEnd.value, analysisSource());
  }

  function analysisSource() {
    return {
      entries: store.dailyEntries,
      results: store.results,
      lifeEvents: store.lifeEvents,
      reviews: store.weeklyReviews,
      monthlyReviews: store.monthlyReviews,
      settings: store.settings,
    };
  }

  function analysisRangeIsValid() {
    if (!analysisStart.value || !analysisEnd.value) {
      notifyError('Укажите начало и конец периода');
      return false;
    }
    if (analysisStart.value > analysisEnd.value) {
      notifyError('Начало периода должно быть не позже окончания');
      return false;
    }
    if (analysisEnd.value > todayKey()) {
      notifyError('Период анализа не может заканчиваться в будущем');
      return false;
    }
    return true;
  }

  async function importData(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || isSaving('import')) return;
    try {
      await runAction('import', 'Не удалось импортировать данные', async () => {
        const payload = JSON.parse(await file.text());
        await store.importData(payload, { syncCloud: Boolean(cloudSession.value) });
        replaceSettingsFromStore();
        if (cloudSession.value) {
          notifySaved('Резервная копия восстановлена. Облако обновляется.');
        } else {
          notifySaved('Резервная копия восстановлена');
        }
      });
    } finally {
      if (importInput.value) importInput.value.value = '';
    }
  }

  async function clearAll() {
    if (isSaving('clear-data')) return;
    if (!window.confirm('Удалить все записи, итоги и обзоры? Перед этим лучше скачать резервную копию.')) return;
    if (!window.confirm('Это действие нельзя отменить. Точно удалить все данные?')) return;
    await runAction('clear-data', 'Не удалось удалить данные', async () => {
      await store.clearAll({ syncCloud: Boolean(cloudSession.value) });
      replaceSettingsFromStore();
      notifyInfo('Все данные удалены');
    });
  }

  async function deleteAccount() {
    const email = cloudUserEmail.value;
    if (!email) return;
    if (
      !window.confirm(
        'Аккаунт и его облачная копия будут удалены без возможности восстановления. Перед этим лучше скачать резервную копию.',
      )
    )
      return;
    const confirmation = window.prompt(`Для подтверждения введи email аккаунта: ${email}`)?.trim().toLowerCase();
    if (confirmation !== email.toLowerCase()) {
      notifyError('Email не совпал. Аккаунт не удалён.');
      return;
    }

    try {
      await auth.deleteAccount();
    } catch {
      notifyError(auth.error || 'Не удалось удалить аккаунт');
      return;
    }

    try {
      await store.clearAll({ syncCloud: false });
      replaceSettingsFromStore();
      notifyInfo(auth.error || 'Аккаунт и его данные удалены');
    } catch {
      store.unload();
      replaceSettingsFromStore();
      notifyError(
        'Аккаунт и облачная копия удалены, но данные на этом устройстве очистить не удалось. Очистите данные сайта в настройках браузера.',
      );
    }
  }

  return {
    ChipGroup,
    experimentDecisionOptions,
    experimentTextLimits,
    dailyBlockOptions,
    store,
    settings,
    importInput,
    newCareerLabel,
    newActivityLabel,
    newLifeAreaLabel,
    newContextFactorLabel,
    newPassword,
    newPasswordConfirmation,
    passwordUpdateStatus,
    analysisStart,
    analysisEnd,
    analysisMaxDate,
    auth,
    allCareerOptions,
    activeActivityOptions,
    hiddenActivityOptions,
    allLifeAreaOptions,
    activeContextFactorOptions,
    hiddenContextFactorOptions,
    cloudSession,
    cloudUserEmail,
    cloudStatusTitle,
    cloudStatusText,
    storageProtectionTitle,
    storageProtectionText,
    experimentCanConclude,
    experimentIdentityLocked,
    experimentSaveLabel,
    isSaving,
    save,
    saveExperiment,
    completeExperiment,
    addCareerOption,
    addActivityOption,
    removeActivityOption,
    restoreActivityOption,
    removeCareerOption,
    addLifeArea,
    removeLifeArea,
    addContextFactor,
    removeContextFactor,
    restoreContextFactor,
    exportData,
    signOutCloud,
    changePassword,
    copyAnalysisPrompt,
    downloadAnalysisData,
    copyCustomAnalysisPrompt,
    downloadCustomAnalysisData,
    importData,
    clearAll,
    deleteAccount,
  };
}
