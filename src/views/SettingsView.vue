<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import ChipGroup from '../components/ChipGroup.vue';
import { useAppStore, type ExportPayload } from '../stores/app';
import { useAuthStore } from '../stores/auth';
import { buildAiReportPayload, buildAiReportPrompt, type AiReportPeriod } from '../services/aiReport';
import { loadCloudSnapshot, saveCloudSnapshot } from '../services/cloudSync';
import { todayKey } from '../services/dates';
import { notifyError, notifyInfo, notifySaved, notifyUnknownError } from '../services/notifications';
import { plainCopy } from '../services/plain';
import { careerOptions, createCustomOption, lifeAreaOptions, type AppSettings, type CareerState, type LifeAreaId } from '../types';

const store = useAppStore();
const settings = reactive<AppSettings>(plainCopy(store.settings));
const importInput = ref<HTMLInputElement>();
const newCareerLabel = ref('');
const newCareerCountsAsExternal = ref(true);
const newLifeAreaLabel = ref('');
const auth = useAuthStore();
const allCareerOptions = computed(() => [...careerOptions, ...settings.customCareerOptions]);
const allLifeAreaOptions = computed(() => [...lifeAreaOptions, ...settings.customLifeAreaOptions]);
const cloudSession = computed(() => auth.session);
const cloudUserEmail = computed(() => auth.userEmail);

async function save(message = 'Настройки сохранены') {
  await store.saveSettings(plainCopy(settings));
  notifySaved(message);
}

async function addCareerOption() {
  const label = newCareerLabel.value.trim();
  if (!label || hasOption(allCareerOptions.value, label)) return;
  settings.customCareerOptions.push({ ...createCustomOption(label, 'career'), countsAsExternal: newCareerCountsAsExternal.value });
  newCareerLabel.value = '';
  newCareerCountsAsExternal.value = true;
  await save();
}

async function removeCareerOption(id: CareerState) {
  settings.customCareerOptions = settings.customCareerOptions.filter((option) => option.id !== id);
  await save();
}

async function addLifeArea() {
  const label = newLifeAreaLabel.value.trim();
  if (!label || hasOption(allLifeAreaOptions.value, label)) return;
  const option = createCustomOption(label, 'life');
  settings.customLifeAreaOptions.push(option);
  settings.activeLifeAreas.push(option.id);
  newLifeAreaLabel.value = '';
  await save();
}

async function removeLifeArea(id: LifeAreaId) {
  settings.customLifeAreaOptions = settings.customLifeAreaOptions.filter((option) => option.id !== id);
  settings.activeLifeAreas = settings.activeLifeAreas.filter((area) => area !== id);
  await save();
}

function hasOption(options: { label: string }[], label: string) {
  return options.some((option) => option.label.trim().toLocaleLowerCase('ru-RU') === label.toLocaleLowerCase('ru-RU'));
}

function exportData() {
  const blob = new Blob([JSON.stringify(store.exportData(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `trajectory-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  notifyInfo('Резервная копия скачана');
}

async function signOutCloud() {
  await runCloudAction(async () => {
    await auth.signOut();
    notifyInfo('Выход выполнен');
  });
}

async function saveBackupToCloud() {
  await runCloudAction(async () => {
    const updatedAt = await saveCloudSnapshot(store.exportData());
    notifySaved(`Облачная копия сохранена: ${new Date(updatedAt).toLocaleString('ru-RU')}`);
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
    await store.importData(snapshot.payload as ExportPayload);
    Object.assign(settings, plainCopy(store.settings));
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

async function copyAiPrompt(period: Exclude<AiReportPeriod, 'range'>) {
  const payload = createAiPayload(period);
  await navigator.clipboard.writeText(buildAiReportPrompt(payload, store.settings));
  notifySaved('Промпт для GPT скопирован');
}

function downloadAiPackage(period: Exclude<AiReportPeriod, 'range'>) {
  const payload = createAiPayload(period);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `trajectory-ai-${period}-${payload.start}-${payload.end}.json`;
  link.click();
  URL.revokeObjectURL(url);
  notifyInfo(period === 'week' ? 'Пакет недели скачан' : 'Пакет месяца скачан');
}

function createAiPayload(period: Exclude<AiReportPeriod, 'range'>) {
  return buildAiReportPayload(period, todayKey(), {
    entries: store.dailyEntries,
    results: store.results,
    lifeEvents: store.lifeEvents,
    reviews: store.weeklyReviews,
    monthlyReviews: store.monthlyReviews,
    settings: store.settings
  });
}

async function importData(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    await store.importData(payload);
    Object.assign(settings, plainCopy(store.settings));
    notifySaved('Резервная копия восстановлена');
  } catch (error) {
    notifyError(error instanceof Error ? error.message : 'Не удалось импортировать данные');
  }
  if (importInput.value) importInput.value.value = '';
}

async function clearAll() {
  if (!window.confirm('Удалить все записи, результаты и обзоры? Перед этим лучше скачать резервную копию.')) return;
  if (!window.confirm('Это действие нельзя отменить. Точно удалить все данные?')) return;
  await store.clearAll();
  Object.assign(settings, plainCopy(store.settings));
  notifyInfo('Все данные удалены');
}
</script>

<template>
  <section class="page">
    <div class="page-heading"><div><span class="eyebrow">Настройка трекера</span><h1>Настройки</h1><p>Активные области, карьерные пункты, один эксперимент и резервная копия.</p></div></div>

    <article class="settings-card">
      <div class="form-card__heading"><span class="section-icon section-icon--amber">✦</span><div><h2>Области жизни</h2><p>Выбранные области появятся в ежедневной записи и обзорах.</p></div></div>
      <ChipGroup v-model="settings.activeLifeAreas as LifeAreaId[]" :options="allLifeAreaOptions" multiple />
      <div class="custom-options">
        <label class="field-label" for="new-life-area">Своя область</label>
        <div class="inline-add">
          <input id="new-life-area" v-model="newLifeAreaLabel" type="text" maxlength="32" placeholder="Учёба" @keyup.enter="addLifeArea" />
          <button class="secondary-button" type="button" :disabled="!newLifeAreaLabel.trim()" @click="addLifeArea">Добавить</button>
        </div>
        <div v-if="settings.customLifeAreaOptions.length" class="custom-list">
          <div v-for="option in settings.customLifeAreaOptions" :key="option.id" class="custom-list__item">
            <span><i>{{ option.icon }}</i>{{ option.label }}</span>
            <button class="ghost-button ghost-button--danger" type="button" :aria-label="`Удалить ${option.label}`" @click="removeLifeArea(option.id)">×</button>
          </div>
        </div>
      </div>
      <button class="primary-button" type="button" @click="save('Области сохранены')">Сохранить области</button>
    </article>

    <article class="settings-card">
      <div class="form-card__heading"><span class="section-icon section-icon--blue">↗</span><div><h2>Карьера</h2><p>Добавь пункт, который важно видеть в ежедневной записи: например «Отклики».</p></div></div>
      <div class="settings-field-stack">
        <label class="field-label" for="active-focus">Текущий фокус</label>
        <input id="active-focus" v-model="settings.activeFocusTitle" type="text" maxlength="100" placeholder="Например: найти работу frontend-разработчиком" />
        <label class="field-label" for="external-evidence">Что считается контактом с реальностью</label>
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
        <label class="toggle-row toggle-row--compact"><span><strong>Считать внешним шагом</strong><small>Подходит для откликов, сообщений рекрутерам и собеседований.</small></span><input v-model="newCareerCountsAsExternal" type="checkbox" /></label>
        <div v-if="settings.customCareerOptions.length" class="custom-list">
          <div v-for="option in settings.customCareerOptions" :key="option.id" class="custom-list__item">
            <span><i>{{ option.icon }}</i>{{ option.label }}<small v-if="option.countsAsExternal">внешний шаг</small></span>
            <button class="ghost-button ghost-button--danger" type="button" :aria-label="`Удалить ${option.label}`" @click="removeCareerOption(option.id)">×</button>
          </div>
        </div>
      </div>
      <button class="primary-button" type="button" @click="save('Карьерный фокус сохранён')">Сохранить карьерный фокус</button>
    </article>

    <article class="settings-card">
      <div class="form-card__heading"><span class="section-icon section-icon--green">◐</span><div><h2>Критерий питания</h2><p>Определи наблюдаемые признаки заранее, чтобы ежедневная отметка не зависела только от настроения.</p></div></div>
      <label class="field-label" for="nutrition-criterion">Что означает «поддержало цель»</label>
      <textarea id="nutrition-criterion" v-model="settings.nutritionGoalCriterion" rows="3" maxlength="280" placeholder="Например: ел по плану, был нормальный ужин, не было незапланированных вечерних перекусов"></textarea>
      <button class="primary-button" type="button" @click="save('Критерий питания сохранён')">Сохранить настройки</button>
    </article>

    <article class="settings-card">
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
      <textarea id="experiment-conclusion" v-model="settings.experiment.conclusion" rows="2" maxlength="240" placeholder="Помогло, не помогло или данных пока недостаточно"></textarea>
      <button class="primary-button" type="button" @click="save('Эксперимент сохранён')">Сохранить настройки</button>
    </article>

    <article class="settings-card">
      <div class="form-card__heading"><span class="section-icon section-icon--blue">↓</span><div><h2>Резервная копия</h2><p>Данные пока хранятся только в этом браузере.</p></div></div>
      <div class="data-actions">
        <button class="secondary-button" type="button" @click="exportData">Скачать копию</button>
        <button class="secondary-button" type="button" @click="importInput?.click()">Восстановить из копии</button>
        <input ref="importInput" class="visually-hidden" type="file" accept="application/json" @change="importData" />
      </div>
      <div class="danger-zone"><div><strong>Удалить все данные</strong><p>Записи, результаты, обзоры и настройки будут очищены.</p></div><button class="danger-button" type="button" @click="clearAll">Удалить</button></div>
    </article>

    <article class="settings-card">
      <div class="form-card__heading"><span class="section-icon section-icon--green">↥</span><div><h2>Облачная копия</h2><p>Личная синхронизация через Supabase. Доступ к копии закрыт правилами RLS и привязан к твоему аккаунту.</p></div></div>
      <div v-if="!auth.configured" class="cloud-sync-note">
        <strong>Облако ещё не подключено</strong>
        <p>Добавь `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` в Vercel Environment Variables после создания проекта Supabase.</p>
      </div>
      <template v-else>
        <div v-if="cloudSession" class="cloud-session">
          <div><strong>{{ cloudUserEmail }}</strong><p>Облачная копия доступна только этому пользователю.</p></div>
          <button class="ghost-button" type="button" @click="signOutCloud">Выйти</button>
        </div>
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

    <article class="settings-card">
      <div class="form-card__heading"><span class="section-icon section-icon--green">AI</span><div><h2>Пакет для GPT</h2><p>Без платного API: скопируй промпт или скачай JSON для ручного анализа.</p></div></div>
      <div class="ai-actions">
        <button class="secondary-button" type="button" @click="copyAiPrompt('week')">Скопировать промпт недели</button>
        <button class="secondary-button" type="button" @click="copyAiPrompt('month')">Скопировать промпт месяца</button>
        <button class="secondary-button" type="button" @click="downloadAiPackage('week')">Скачать пакет недели</button>
        <button class="secondary-button" type="button" @click="downloadAiPackage('month')">Скачать пакет месяца</button>
      </div>
    </article>
  </section>
</template>
