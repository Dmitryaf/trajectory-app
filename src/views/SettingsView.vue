<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import ChipGroup from '../components/ChipGroup.vue';
import { useAppStore } from '../stores/app';
import { useAuthStore } from '../stores/auth';
import { copyText, downloadJson } from '../features/export/browser';
import { buildAiReportPayload, buildAiReportPrompt, type AiReportPeriod } from '../features/export/report';
import { createExperimentRecord, emptyExperiment, experimentDecisionOptions, experimentPeriodsOverlap } from '../features/experiments/model';
import { loadCloudSnapshot, markCloudSyncSynced } from '../services/cloudSync';
import { todayKey } from '../services/dates';
import { notifyError, notifyInfo, notifySaved, notifyUnknownError } from '../services/notifications';
import { plainCopy } from '../services/plain';
import { careerOptions, contextFactorOptions, createCustomOption, dailyBlockOptions, lifeAreaOptions, type AppSettings, type CareerState, type ContextFactorId, type DailyBlockId, type LifeAreaId, type Option } from '../types';

const store = useAppStore();
const settings = reactive<AppSettings>(plainCopy(store.settings));
const importInput = ref<HTMLInputElement>();
const newCareerLabel = ref('');
const newCareerCountsAsExternal = ref(true);
const newLifeAreaLabel = ref('');
const newContextFactorLabel = ref('');
const auth = useAuthStore();
const allCareerOptions = computed(() => [...careerOptions, ...settings.customCareerOptions.filter((option) => !option.archived)]);
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
    notifyError('Укажи условие эксперимента');
    return;
  }
  if (experiment.active && (!experiment.startDate || !experiment.endDate)) {
    notifyError('Укажи даты начала и окончания эксперимента');
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
    notifyError('Укажи условие и даты эксперимента');
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
    notifyError('Запиши, что заметил по итогам эксперимента');
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
    archived.countsAsExternal = newCareerCountsAsExternal.value;
    newCareerLabel.value = '';
    await save();
    return;
  }
  if (hasOption(settings.customCareerOptions, label)) return;
  settings.customCareerOptions.push({ ...createCustomOption(label, 'career'), countsAsExternal: newCareerCountsAsExternal.value });
  newCareerLabel.value = '';
  newCareerCountsAsExternal.value = true;
  await save();
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
  const hiddenBuiltIn = contextFactorOptions.find((option) => settings.hiddenContextFactorIds.includes(option.id) && sameLabel(option.label, label));
  if (hiddenBuiltIn) {
    settings.hiddenContextFactorIds = settings.hiddenContextFactorIds.filter((id) => id !== hiddenBuiltIn.id);
    newContextFactorLabel.value = '';
    await save('Фактор дня возвращён');
    return;
  }
  if (hasOption(contextFactorOptions, label)) return;
  const archived = findArchived(settings.customContextFactorOptions, label);
  if (archived) archived.archived = false;
  else if (!hasOption(settings.customContextFactorOptions, label)) settings.customContextFactorOptions.push(createCustomOption(label, 'context'));
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

function createAnalysisPayload(period: Exclude<AiReportPeriod, 'range'>) {
  return buildAiReportPayload(period, todayKey(), {
    entries: store.dailyEntries,
    results: store.results,
    lifeEvents: store.lifeEvents,
    reviews: store.weeklyReviews,
    monthlyReviews: store.monthlyReviews,
    settings: store.settings,
  });
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
</script>

<template>
  <section class="page page--settings">
    <div class="page-heading"><div><span class="eyebrow">Настройка приложения</span><h1>Настройки</h1><p>Выбери, что отмечать каждый день, и управляй экспериментом и копиями данных.</p></div></div>

    <article class="settings-card settings-card--daily-blocks">
      <div class="form-card__heading"><span class="section-icon section-icon--blue">☷</span><div><h2>Блоки ежедневной записи</h2><p>Скрой то, что сейчас не нужно заполнять. Старые записи и их данные останутся в обзорах и выгрузке.</p></div></div>
      <ChipGroup v-model="settings.activeDailyBlocks as DailyBlockId[]" :options="dailyBlockOptions" multiple />
      <p v-if="!settings.activeDailyBlocks.length" class="data-note">Останутся общие блоки: действия по текущей цели, области жизни и факт дня.</p>
      <button class="primary-button" type="button" @click="save('Блоки ежедневной записи сохранены')">Сохранить блоки</button>
    </article>

    <article class="settings-card settings-card--areas">
      <div class="form-card__heading"><span class="section-icon section-icon--amber">✦</span><div><h2>Области жизни</h2><p>То, что важно замечать в обычные дни: семья, отдых, чтение или свои пункты.</p></div></div>
      <ChipGroup v-model="settings.activeLifeAreas as LifeAreaId[]" :options="allLifeAreaOptions" multiple />
      <div class="custom-options">
        <label class="field-label" for="new-life-area">Своя область</label>
        <div class="inline-add">
          <input id="new-life-area" v-model="newLifeAreaLabel" type="text" maxlength="32" placeholder="Учёба" @keyup.enter="addLifeArea" />
          <button class="secondary-button" type="button" :disabled="!newLifeAreaLabel.trim()" @click="addLifeArea">Добавить</button>
        </div>
        <div v-if="settings.customLifeAreaOptions.some((option) => !option.archived)" class="custom-list">
          <div v-for="option in settings.customLifeAreaOptions.filter((item) => !item.archived)" :key="option.id" class="custom-list__item">
            <span><i>{{ option.icon }}</i>{{ option.label }}</span>
            <button class="ghost-button ghost-button--danger" type="button" :aria-label="`Скрыть ${option.label}`" @click="removeLifeArea(option.id)">×</button>
          </div>
        </div>
      </div>
      <button class="primary-button" type="button" @click="save('Области сохранены')">Сохранить области</button>
    </article>

    <article class="settings-card settings-card--context">
      <div class="form-card__heading"><span class="section-icon section-icon--orange">⌁</span><div><h2>Факторы дня</h2><p>Добавляй повторяющиеся условия, которые могут пригодиться в недельном или месячном разборе.</p></div></div>
      <div class="custom-list context-factor-list">
        <div v-for="option in activeContextFactorOptions" :key="option.id" class="custom-list__item">
          <span><i v-if="option.icon">{{ option.icon }}</i>{{ option.label }}</span>
          <button class="hide-option-button" type="button" :aria-label="`Убрать ${option.label} из ежедневной записи`" title="Убрать из ежедневной записи" @click="removeContextFactor(option.id)">−</button>
        </div>
      </div>
      <div class="custom-options">
        <label class="field-label" for="new-context-factor">Добавить свой фактор</label>
        <div class="inline-add">
          <input id="new-context-factor" v-model="newContextFactorLabel" type="text" maxlength="40" placeholder="Например: долгая дорога" @keyup.enter="addContextFactor" />
          <button class="secondary-button" type="button" :disabled="!newContextFactorLabel.trim()" @click="addContextFactor">Добавить</button>
        </div>
        <div v-if="hiddenContextFactorOptions.length" class="hidden-options">
          <span class="field-label">Убраны из ежедневной записи</span>
          <div class="hidden-options__list">
            <button v-for="option in hiddenContextFactorOptions" :key="option.id" class="restore-option" type="button" :aria-label="`Вернуть ${option.label} в ежедневную запись`" @click="restoreContextFactor(option.id)"><span>+</span>{{ option.label }}</button>
          </div>
        </div>
        <p class="data-note">Минус убирает вариант из ежедневной записи. Прежние отметки остаются в истории, графиках и выгрузке.</p>
      </div>
    </article>

    <article class="settings-card settings-card--career">
      <div class="form-card__heading"><span class="section-icon section-icon--blue">↗</span><div><h2>Цель и карьерные действия</h2><p>Опиши цель, заметный результат и дату, когда стоит решить: продолжать, изменить или завершить.</p></div></div>
      <div class="settings-field-stack">
        <label class="field-label" for="active-focus">Над чем ты сейчас работаешь</label>
        <input id="active-focus" v-model="settings.activeFocusTitle" type="text" maxlength="100" placeholder="Например: восстановить режим сна или подготовиться к смене работы" />
        <label class="field-label" for="focus-outcome">Какой результат покажет прогресс</label>
        <textarea id="focus-outcome" v-model="settings.focusOutcomeCriterion" rows="2" maxlength="220" placeholder="Например: пять дней подряд вставать до 08:00 или получить приглашение на собеседование"></textarea>
        <label class="field-label" for="focus-review-date">Когда пересмотреть цель</label>
        <input id="focus-review-date" v-model="settings.focusReviewDate" type="date" />
        <label class="field-label" for="external-evidence">Что считать конкретным действием</label>
        <textarea id="external-evidence" v-model="settings.externalEvidenceCriterion" rows="2" maxlength="220" placeholder="Например: отправленный отклик, разговор, собеседование или выполненное задание"></textarea>
      </div>
      <span class="field-label">Варианты карьерных действий</span>
      <div class="option-preview">
        <span v-for="option in allCareerOptions" :key="option.id" class="option-pill">
          <i v-if="option.icon">{{ option.icon }}</i>{{ option.label }}
        </span>
      </div>
      <div class="custom-options">
        <label class="field-label" for="new-career-option">Карьерный пункт</label>
        <div class="inline-add">
          <input id="new-career-option" v-model="newCareerLabel" type="text" maxlength="32" placeholder="Отклики" @keyup.enter="addCareerOption" />
          <button class="secondary-button" type="button" :disabled="!newCareerLabel.trim()" @click="addCareerOption">Добавить</button>
        </div>
        <label class="toggle-row toggle-row--compact"><span><strong>Считать конкретным действием</strong><small>Подходит для откликов, разговоров, выполненных заданий и собеседований.</small></span><input v-model="newCareerCountsAsExternal" type="checkbox" /></label>
        <div v-if="settings.customCareerOptions.some((option) => !option.archived)" class="custom-list">
          <div v-for="option in settings.customCareerOptions.filter((item) => !item.archived)" :key="option.id" class="custom-list__item">
            <span><i>{{ option.icon }}</i>{{ option.label }}<small v-if="option.countsAsExternal">конкретное действие</small></span>
            <button class="ghost-button ghost-button--danger" type="button" :aria-label="`Скрыть ${option.label}`" @click="removeCareerOption(option.id)">×</button>
          </div>
        </div>
      </div>
      <button class="primary-button" type="button" @click="save('Настройки цели сохранены')">Сохранить настройки цели</button>
    </article>

    <article class="settings-card settings-card--nutrition">
      <div class="form-card__heading"><span class="section-icon section-icon--green">◐</span><div><h2>Критерий питания</h2><p>Определи наблюдаемые признаки заранее, чтобы ежедневная отметка не зависела только от настроения.</p></div></div>
      <label class="field-label" for="nutrition-criterion">Что означает «поддержало цель»</label>
      <textarea id="nutrition-criterion" v-model="settings.nutritionGoalCriterion" rows="3" maxlength="280" placeholder="Например: ел по плану, был нормальный ужин, не было незапланированных вечерних перекусов"></textarea>
      <button class="primary-button" type="button" @click="save('Критерий питания сохранён')">Сохранить настройки</button>
    </article>

    <article class="settings-card settings-card--experiment">
      <div class="form-card__heading"><span class="section-icon section-icon--orange">⌁</span><div><h2>Личный эксперимент</h2><p>Задай временное условие, отмечай его выполнение и сформулируй собственный вывод.</p></div></div>
      <label class="toggle-row"><span><strong>Включить эксперимент</strong><small>В ежедневной записи появится один дополнительный вопрос.</small></span><input v-model="settings.experiment.active" type="checkbox" /></label>
      <label class="field-label" for="experiment-title">Условие эксперимента</label>
      <input id="experiment-title" v-model="settings.experiment.title" type="text" maxlength="140" placeholder="Не читать новости после 22:00" />
      <label class="field-label" for="experiment-hypothesis">Что хочешь проверить <span class="field-optional">необязательно</span></label>
      <textarea id="experiment-hypothesis" v-model="settings.experiment.hypothesis" rows="2" maxlength="300" placeholder="Например: станет ли проще засыпать и сохранять энергию утром"></textarea>
      <div class="form-row">
        <label class="form-control"><span class="field-label">Начало</span><input v-model="settings.experiment.startDate" type="date" /></label>
        <label class="form-control"><span class="field-label">Окончание</span><input v-model="settings.experiment.endDate" type="date" /></label>
      </div>
      <template v-if="experimentCanConclude">
        <label class="field-label" for="experiment-conclusion">Что заметил по итогам</label>
        <textarea id="experiment-conclusion" v-model="settings.experiment.conclusion" rows="3" maxlength="800" placeholder="Опиши наблюдения своими словами. Совпадение показателей не обязательно означает влияние эксперимента."></textarea>
        <label class="field-label">Что делать дальше <span class="field-optional">необязательно</span></label>
        <ChipGroup v-model="settings.experiment.decision" :options="experimentDecisionOptions" allow-clear />
      </template>
      <p v-else-if="settings.experiment.endDate" class="field-hint">После окончания периода здесь можно записать вывод и сохранить эксперимент в общей истории.</p>
      <button class="primary-button" type="button" @click="saveExperiment">Сохранить настройки</button>
      <button v-if="experimentCanConclude" class="secondary-button" type="button" @click="completeExperiment">Завершить и добавить в историю</button>
      <p v-if="settings.experimentHistory.length" class="data-note">Завершённые эксперименты находятся в общей истории изменений: {{ settings.experimentHistory.length }}.</p>
    </article>

    <article class="settings-card settings-card--backup">
      <div class="form-card__heading"><span class="section-icon section-icon--blue">↓</span><div><h2>Резервная копия</h2><p>JSON-копия нужна как ручная страховка независимо от облачной синхронизации.</p></div></div>
      <div class="data-actions">
        <button class="secondary-button" type="button" @click="exportData">Скачать копию</button>
        <button class="secondary-button" type="button" @click="importInput?.click()">Восстановить из копии</button>
        <input ref="importInput" class="visually-hidden" type="file" accept="application/json" @change="importData" />
      </div>
      <div class="danger-zone"><div><strong>Удалить все данные</strong><p>Записи, итоги, обзоры и настройки будут очищены.</p></div><button class="danger-button" type="button" @click="clearAll">Удалить</button></div>
    </article>

    <article class="settings-card settings-card--cloud">
      <div class="form-card__heading"><span class="section-icon section-icon--green">↥</span><div><h2>Облачная копия</h2></div></div>
      <div v-if="!auth.configured" class="cloud-sync-note">
        <strong>Облачная копия недоступна</strong>
        <p>В этой сборке синхронизация не настроена.</p>
      </div>
      <template v-else>
        <template v-if="cloudSession">
          <div class="cloud-session">
            <div><strong>{{ cloudUserEmail }}</strong></div>
            <button class="secondary-button cloud-session__logout" type="button" @click="signOutCloud">Выйти</button>
          </div>
          <div class="cloud-sync-note" :class="`cloud-sync-note--${store.cloudSyncStatus}`">
            <strong>{{ cloudStatusTitle }}</strong>
            <p>{{ cloudStatusText }}</p>
            <p v-if="store.cloudSyncError">Ошибка: {{ store.cloudSyncError }}</p>
          </div>
        </template>
        <div v-else class="cloud-sync-note">
          <strong>Сессия не найдена</strong>
          <p>Обнови страницу и войди снова. До входа приложение не загружает записи.</p>
        </div>
        <div class="data-actions">
          <button class="secondary-button" type="button" :disabled="!cloudSession" @click="saveBackupToCloud">Сохранить в облако</button>
          <button class="secondary-button" type="button" :disabled="!cloudSession" @click="restoreBackupFromCloud">Загрузить из облака</button>
        </div>
      </template>
    </article>

    <article class="settings-card settings-card--analysis">
      <div class="form-card__heading"><span class="section-icon section-icon--green">↗</span><div><h2>Данные для внешнего анализа</h2><p>Промпт содержит читаемую сводку, а отдельный JSON — полную копию данных выбранного периода. Приложение само ничего не отправляет.</p></div></div>
      <div class="ai-actions">
        <button class="secondary-button" type="button" @click="copyAnalysisPrompt('week')">Промпт недели</button>
        <button class="secondary-button" type="button" @click="copyAnalysisPrompt('month')">Промпт месяца</button>
        <button class="secondary-button" type="button" @click="downloadAnalysisData('week')">Данные недели</button>
        <button class="secondary-button" type="button" @click="downloadAnalysisData('month')">Данные месяца</button>
      </div>
      <p class="data-note">В пакет входят личные заметки выбранного периода. Перед передачей внешнему сервису можно просмотреть скачанный JSON.</p>
    </article>

  </section>
</template>
