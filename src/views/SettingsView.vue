<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import ChipGroup from '../components/ChipGroup.vue';
import { useAppStore, type ExportPayload } from '../stores/app';
import { useAuthStore } from '../stores/auth';
import { buildAiReportPayload, buildAiReportPrompt, type AiReportPeriod } from '../services/aiReport';
import { copyText, downloadJson } from '../services/exportPackage';
import { loadCloudSnapshot, markCloudSyncSynced } from '../services/cloudSync';
import { todayKey } from '../services/dates';
import { notifyError, notifyInfo, notifySaved, notifyUnknownError } from '../services/notifications';
import { plainCopy } from '../services/plain';
import { careerOptions, createCustomOption, eveningFactorOptions, lifeAreaOptions, type AppSettings, type CareerState, type EveningFactorId, type LifeAreaId, type Option } from '../types';

const store = useAppStore();
const settings = reactive<AppSettings>(plainCopy(store.settings));
const importInput = ref<HTMLInputElement>();
const newCareerLabel = ref('');
const newCareerCountsAsExternal = ref(true);
const newLifeAreaLabel = ref('');
const newEveningFactorLabel = ref('');
const auth = useAuthStore();
const allCareerOptions = computed(() => [...careerOptions, ...settings.customCareerOptions.filter((option) => !option.archived)]);
const allLifeAreaOptions = computed(() => [...lifeAreaOptions, ...settings.customLifeAreaOptions.filter((option) => !option.archived)]);
const allEveningFactorOptions = computed(() => [...eveningFactorOptions, ...settings.customEveningFactorOptions.filter((option) => !option.archived)]);
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
const experimentConclusionOptions = [
  { id: 'helped', label: 'Помогло', icon: '✓' },
  { id: 'unclear', label: 'Пока неясно', icon: '·' },
  { id: 'not_helped', label: 'Не помогло', icon: '×' },
];

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
  if (experiment.startDate && experiment.endDate && experiment.startDate > experiment.endDate) {
    notifyError('Дата окончания эксперимента должна быть не раньше даты начала');
    return;
  }
  await save('Эксперимент сохранён');
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

async function addEveningFactor() {
  const label = newEveningFactorLabel.value.trim();
  if (!label || hasOption(eveningFactorOptions, label)) return;
  const archived = findArchived(settings.customEveningFactorOptions, label);
  if (archived) archived.archived = false;
  else if (!hasOption(settings.customEveningFactorOptions, label)) settings.customEveningFactorOptions.push(createCustomOption(label, 'evening'));
  newEveningFactorLabel.value = '';
  await save('Факторы перед сном сохранены');
}

async function removeEveningFactor(id: EveningFactorId) {
  const option = settings.customEveningFactorOptions.find((item) => item.id === id);
  if (option) option.archived = true;
  await save('Фактор скрыт из ежедневной записи');
}

function hasOption(options: { label: string }[], label: string) {
  return options.some((option) => option.label.trim().toLocaleLowerCase('ru-RU') === label.toLocaleLowerCase('ru-RU'));
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
    await store.importData(snapshot.payload as ExportPayload, { syncCloud: false });
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
    <div class="page-heading"><div><span class="eyebrow">Настройка трекера</span><h1>Настройки</h1><p>Здесь задаются личные области, рабочий фокус, питание, эксперимент и копии данных.</p></div></div>

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

    <article class="settings-card settings-card--sleep">
      <div class="form-card__heading"><span class="section-icon section-icon--violet">◒</span><div><h2>Факторы перед сном</h2><p>Добавляй только повторяющиеся условия, которые пригодятся в недельном или месячном разборе.</p></div></div>
      <div class="option-preview">
        <span v-for="option in allEveningFactorOptions" :key="option.id" class="option-pill"><i v-if="option.icon">{{ option.icon }}</i>{{ option.label }}</span>
      </div>
      <div class="custom-options">
        <label class="field-label" for="new-evening-factor">Свой фактор</label>
        <div class="inline-add">
          <input id="new-evening-factor" v-model="newEveningFactorLabel" type="text" maxlength="40" placeholder="Например: душ перед сном" @keyup.enter="addEveningFactor" />
          <button class="secondary-button" type="button" :disabled="!newEveningFactorLabel.trim()" @click="addEveningFactor">Добавить</button>
        </div>
        <div v-if="settings.customEveningFactorOptions.some((option) => !option.archived)" class="custom-list">
          <div v-for="option in settings.customEveningFactorOptions.filter((item) => !item.archived)" :key="option.id" class="custom-list__item">
            <span><i>{{ option.icon }}</i>{{ option.label }}</span>
            <button class="ghost-button ghost-button--danger" type="button" :aria-label="`Скрыть ${option.label}`" @click="removeEveningFactor(option.id)">×</button>
          </div>
        </div>
        <p class="data-note">Скрытый фактор исчезает из новых записей, но остаётся подписанным в истории.</p>
      </div>
    </article>

    <article class="settings-card settings-card--career">
      <div class="form-card__heading"><span class="section-icon section-icon--blue">↗</span><div><h2>Карьера</h2><p>Задай текущую рабочую цель и что считать реальным шагом к ней.</p></div></div>
      <div class="settings-field-stack">
        <label class="field-label" for="active-focus">Текущая рабочая цель</label>
        <input id="active-focus" v-model="settings.activeFocusTitle" type="text" maxlength="100" placeholder="Например: найти работу frontend-разработчиком" />
        <label class="field-label" for="external-evidence">Что считать реальным шагом</label>
        <textarea id="external-evidence" v-model="settings.externalEvidenceCriterion" rows="2" maxlength="220" placeholder="Например: отклик, сообщение человеку, собеседование или публикация проекта"></textarea>
      </div>
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
        <label class="toggle-row toggle-row--compact"><span><strong>Считать реальным шагом</strong><small>Подходит для откликов, сообщений рекрутерам, публикаций и собеседований.</small></span><input v-model="newCareerCountsAsExternal" type="checkbox" /></label>
        <div v-if="settings.customCareerOptions.some((option) => !option.archived)" class="custom-list">
          <div v-for="option in settings.customCareerOptions.filter((item) => !item.archived)" :key="option.id" class="custom-list__item">
            <span><i>{{ option.icon }}</i>{{ option.label }}<small v-if="option.countsAsExternal">реальный шаг</small></span>
            <button class="ghost-button ghost-button--danger" type="button" :aria-label="`Скрыть ${option.label}`" @click="removeCareerOption(option.id)">×</button>
          </div>
        </div>
      </div>
      <button class="primary-button" type="button" @click="save('Карьерный фокус сохранён')">Сохранить карьерный фокус</button>
    </article>

    <article class="settings-card settings-card--nutrition">
      <div class="form-card__heading"><span class="section-icon section-icon--green">◐</span><div><h2>Критерий питания</h2><p>Определи наблюдаемые признаки заранее, чтобы ежедневная отметка не зависела только от настроения.</p></div></div>
      <label class="field-label" for="nutrition-criterion">Что означает «поддержало цель»</label>
      <textarea id="nutrition-criterion" v-model="settings.nutritionGoalCriterion" rows="3" maxlength="280" placeholder="Например: ел по плану, был нормальный ужин, не было незапланированных вечерних перекусов"></textarea>
      <button class="primary-button" type="button" @click="save('Критерий питания сохранён')">Сохранить настройки</button>
    </article>

    <article class="settings-card settings-card--experiment">
      <div class="form-card__heading"><span class="section-icon section-icon--orange">⌁</span><div><h2>Временный эксперимент</h2><p>Например: не читать новости после 22:00 в течение двух недель.</p></div></div>
      <label class="toggle-row"><span><strong>Включить эксперимент</strong><small>В ежедневной записи появится один дополнительный вопрос.</small></span><input v-model="settings.experiment.active" type="checkbox" /></label>
      <label class="field-label" for="experiment-title">Условие эксперимента</label>
      <input id="experiment-title" v-model="settings.experiment.title" type="text" maxlength="140" placeholder="Не читать новости после 22:00" />
      <label class="field-label" for="experiment-hypothesis">Гипотеза</label>
      <textarea id="experiment-hypothesis" v-model="settings.experiment.hypothesis" rows="2" maxlength="220" placeholder="Если не читать новости поздно вечером, засыпать будет легче, а энергия утром станет выше"></textarea>
      <label class="field-label" for="experiment-metric">Что проверяем</label>
      <input id="experiment-metric" v-model="settings.experiment.targetMetric" type="text" maxlength="120" placeholder="Энергия и качество сна" />
      <div class="form-row">
        <label class="form-control"><span class="field-label">Начало</span><input v-model="settings.experiment.startDate" type="date" /></label>
        <label class="form-control"><span class="field-label">Окончание</span><input v-model="settings.experiment.endDate" type="date" /></label>
      </div>
      <label class="field-label" for="experiment-conclusion">Итог после завершения</label>
      <ChipGroup v-model="settings.experiment.conclusion" :options="experimentConclusionOptions" allow-clear />
      <button class="primary-button" type="button" @click="saveExperiment">Сохранить настройки</button>
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
      <div class="form-card__heading"><span class="section-icon section-icon--green">↗</span><div><h2>Данные для внешнего анализа</h2><p>Скопируй готовый промпт или скачай JSON, чтобы вручную передать его выбранной нейросети. Приложение само ничего не отправляет.</p></div></div>
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
