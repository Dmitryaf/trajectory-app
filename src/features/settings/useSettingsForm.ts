import { computed, reactive, ref } from 'vue';
import ChipGroup from '../../components/ChipGroup.vue';
import { useAppStore } from '../../stores/app';
import { useAuthStore } from '../../stores/auth';
import { copyText, downloadJson } from '../export/browser';
import { buildAiReportCustomRangePayload, buildAiReportPayload, buildAiReportPrompt, type AiReportPeriod } from '../export/report';
import { createExperimentRecord, emptyExperiment, experimentDecisionOptions, experimentPeriodsOverlap } from '../experiments/model';
import { loadCloudSnapshot, markCloudSyncSynced } from '../../services/cloudSync';
import { addDays, todayKey } from '../../services/dates';
import { notifyError, notifyInfo, notifySaved, notifyUnknownError } from '../../services/notifications';
import { plainCopy } from '../../services/plain';
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
  const importInput = ref<HTMLInputElement>();
  const newCareerLabel = ref('');
  const newActivityLabel = ref('');
  const newLifeAreaLabel = ref('');
  const newContextFactorLabel = ref('');
  const newPassword = ref('');
  const newPasswordConfirmation = ref('');
  const analysisStart = ref(addDays(todayKey(), -30));
  const analysisEnd = ref(todayKey());
  const analysisMaxDate = todayKey();
  const auth = useAuthStore();
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
    if (store.cloudSyncStatus === 'conflict') return 'Нужен выбор';
    return 'Статус облака';
  });
  const cloudStatusText = computed(() => store.cloudSyncMessage || 'Синхронизация готова.');
  const experimentCanConclude = computed(() => Boolean(settings.experiment.endDate && settings.experiment.endDate <= todayKey()));

  async function save(message = 'Настройки сохранены') {
    await store.saveSettings(plainCopy(settings));
    notifySaved(message);
  }

  async function saveExperiment() {
    const experiment = settings.experiment;
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
    if (experiment.active && settings.experimentHistory.some((record) => experimentPeriodsOverlap(experiment, record))) {
      notifyError('Период пересекается с завершённым экспериментом');
      return;
    }
    await save('Эксперимент сохранён');
  }

  async function completeExperiment() {
    const experiment = settings.experiment;
    if (!experiment.title.trim() || !experiment.startDate || !experiment.endDate) {
      notifyError('Напишите, что пробовали, и укажите даты');
      return;
    }
    if (experiment.startDate > experiment.endDate) {
      notifyError('Дата окончания эксперимента должна быть не раньше даты начала');
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
    settings.experimentHistory.unshift(createExperimentRecord(experiment));
    settings.experiment = emptyExperiment();
    await save('Эксперимент добавлен в историю');
  }

  async function addCareerOption() {
    const label = newCareerLabel.value.trim();
    if (!label || hasOption(careerOptions, label)) return;
    const archived = findArchived(settings.customCareerOptions, label);
    if (archived) {
      archived.archived = false;
      newCareerLabel.value = '';
      await save();
      return;
    }
    if (hasOption(settings.customCareerOptions, label)) return;
    settings.customCareerOptions.push({ ...createCustomOption(label, 'career'), countsAsExternal: false });
    newCareerLabel.value = '';
    await save();
  }

  async function addActivityOption() {
    const label = newActivityLabel.value.trim();
    if (!label) return;
    const hiddenBuiltIn = activityOptions.find(
      (option) => settings.hiddenActivityIds.includes(option.id) && sameLabel(option.label, label),
    );
    if (hiddenBuiltIn) {
      settings.hiddenActivityIds = settings.hiddenActivityIds.filter((id) => id !== hiddenBuiltIn.id);
      newActivityLabel.value = '';
      await save('Вариант активности возвращён');
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
    await save('Варианты активности сохранены');
  }

  async function removeActivityOption(id: ActivityId) {
    const option = settings.customActivityOptions.find((item) => item.id === id);
    if (option) option.archived = true;
    else if (!settings.hiddenActivityIds.includes(id)) settings.hiddenActivityIds.push(id);
    await save('Вариант убран из ежедневной записи');
  }

  async function restoreActivityOption(id: ActivityId) {
    const option = settings.customActivityOptions.find((item) => item.id === id);
    if (option) option.archived = false;
    else settings.hiddenActivityIds = settings.hiddenActivityIds.filter((activityId) => activityId !== id);
    await save('Вариант активности возвращён');
  }

  async function removeCareerOption(id: CareerState) {
    const option = settings.customCareerOptions.find((item) => item.id === id);
    if (option) option.archived = true;
    await save();
  }

  async function addLifeArea() {
    const label = newLifeAreaLabel.value.trim();
    if (!label || hasOption(lifeAreaOptions, label)) return;
    const archived = findArchived(settings.customLifeAreaOptions, label);
    if (archived) {
      archived.archived = false;
      settings.activeLifeAreas.push(archived.id);
      newLifeAreaLabel.value = '';
      await save();
      return;
    }
    if (hasOption(settings.customLifeAreaOptions, label)) return;
    const option = createCustomOption(label, 'life');
    settings.customLifeAreaOptions.push(option);
    settings.activeLifeAreas.push(option.id);
    newLifeAreaLabel.value = '';
    await save();
  }

  async function removeLifeArea(id: LifeAreaId) {
    const option = settings.customLifeAreaOptions.find((item) => item.id === id);
    if (option) option.archived = true;
    settings.activeLifeAreas = settings.activeLifeAreas.filter((area) => area !== id);
    await save();
  }

  async function addContextFactor() {
    const label = newContextFactorLabel.value.trim();
    if (!label) return;
    const hiddenBuiltIn = contextFactorOptions.find(
      (option) => settings.hiddenContextFactorIds.includes(option.id) && sameLabel(option.label, label),
    );
    if (hiddenBuiltIn) {
      settings.hiddenContextFactorIds = settings.hiddenContextFactorIds.filter((id) => id !== hiddenBuiltIn.id);
      newContextFactorLabel.value = '';
      await save('Фактор дня возвращён');
      return;
    }
    if (hasOption(contextFactorOptions, label)) return;
    const archived = findArchived(settings.customContextFactorOptions, label);
    if (archived) archived.archived = false;
    else if (!hasOption(settings.customContextFactorOptions, label))
      settings.customContextFactorOptions.push(createCustomOption(label, 'context'));
    newContextFactorLabel.value = '';
    await save('Факторы дня сохранены');
  }

  async function removeContextFactor(id: ContextFactorId) {
    const option = settings.customContextFactorOptions.find((item) => item.id === id);
    if (option) option.archived = true;
    else if (!settings.hiddenContextFactorIds.includes(id)) settings.hiddenContextFactorIds.push(id);
    await save('Фактор убран из ежедневной записи');
  }

  async function restoreContextFactor(id: ContextFactorId) {
    const option = settings.customContextFactorOptions.find((item) => item.id === id);
    if (option) option.archived = false;
    else settings.hiddenContextFactorIds = settings.hiddenContextFactorIds.filter((factorId) => factorId !== id);
    await save('Фактор дня возвращён');
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
    await runCloudAction(async () => {
      await auth.signOut();
      notifyInfo('Выход выполнен');
    });
  }

  async function changePassword() {
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
      notifySaved('Пароль изменён');
    } catch {
      notifyError(auth.error || 'Не удалось изменить пароль');
    }
  }

  async function saveBackupToCloud() {
    await runCloudAction(async () => {
      await store.syncCloudSnapshot({ force: true });
      notifySaved('Локальная версия сохранена в облако');
    });
  }

  async function restoreBackupFromCloud() {
    await runCloudAction(async () => {
      const snapshot = await loadCloudSnapshot();
      if (!snapshot) {
        notifyInfo('В облаке пока нет копии');
        return;
      }

      const updatedAt = new Date(snapshot.updatedAt).toLocaleString('ru-RU');
      if (!window.confirm(`Заменить локальные данные облачной копией от ${updatedAt}? Перед этим лучше скачать локальную копию.`)) return;
      await store.importData(snapshot.payload, { syncCloud: false });
      Object.assign(settings, plainCopy(store.settings));
      markCloudSyncSynced(snapshot.userId, snapshot.updatedAt);
      store.setCloudSyncState('synced', `Загружена облачная копия: ${updatedAt}`, { updatedAt: snapshot.updatedAt });
      notifySaved(`Данные восстановлены из облака: ${updatedAt}`);
    });
  }

  async function runCloudAction(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      notifyUnknownError(error, 'Облачное действие не выполнено');
    }
  }

  async function copyAnalysisPrompt(period: Exclude<AiReportPeriod, 'range'>) {
    try {
      const payload = createAnalysisPayload(period);
      await copyText(buildAiReportPrompt(payload, store.settings));
      notifySaved('Промпт для анализа скопирован');
    } catch (error) {
      notifyUnknownError(error, 'Не удалось скопировать промпт');
    }
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
    try {
      const payload = createCustomAnalysisPayload();
      await copyText(buildAiReportPrompt(payload, store.settings));
      notifySaved('Промпт выбранного периода скопирован');
    } catch (error) {
      notifyUnknownError(error, 'Не удалось скопировать промпт');
    }
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
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      await store.importData(payload, { syncCloud: Boolean(cloudSession.value) });
      Object.assign(settings, plainCopy(store.settings));
      if (cloudSession.value) {
        notifySaved('Резервная копия восстановлена. Облако обновляется.');
      } else {
        notifySaved('Резервная копия восстановлена');
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Не удалось импортировать данные');
    }
    if (importInput.value) importInput.value.value = '';
  }

  async function clearAll() {
    if (!window.confirm('Удалить все записи, итоги и обзоры? Перед этим лучше скачать резервную копию.')) return;
    if (!window.confirm('Это действие нельзя отменить. Точно удалить все данные?')) return;
    await store.clearAll({ syncCloud: Boolean(cloudSession.value) });
    Object.assign(settings, plainCopy(store.settings));
    notifyInfo('Все данные удалены');
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
      await store.clearAll({ syncCloud: false });
      Object.assign(settings, plainCopy(store.settings));
      notifyInfo(auth.error || 'Аккаунт и его данные удалены');
    } catch {
      notifyError(auth.error || 'Не удалось удалить аккаунт');
    }
  }

  return {
    ChipGroup,
    experimentDecisionOptions,
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
    experimentCanConclude,
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
    saveBackupToCloud,
    restoreBackupFromCloud,
    copyAnalysisPrompt,
    downloadAnalysisData,
    copyCustomAnalysisPrompt,
    downloadCustomAnalysisData,
    importData,
    clearAll,
    deleteAccount,
  };
}
