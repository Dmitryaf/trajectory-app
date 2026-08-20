<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import ArchivePagination from '../features/journal/ui/ArchivePagination.vue';
import PeriodRecordCard from '../features/reviews/ui/PeriodRecordCard.vue';
import WeeklyReviewJournalLinks from '../features/reviews/ui/WeeklyReviewJournalLinks.vue';
import WeeklyReviewOverview from '../features/reviews/ui/WeeklyReviewOverview.vue';
import PeriodNavigator from '../shared/ui/navigation/PeriodNavigator.vue';
import {
  actionDirectionLabel,
  buildReviewCues,
  careerStatesForEntry,
  contextFactorLabel,
  entriesForWeek,
  hasArea,
  resultsForPeriod,
  specialDayLabel,
  summarize,
  weekSummaryText,
} from '../services/analytics';
import { addDays, dateRange, endOfWeek, formatDate, formatMinutes, fromDateKey, startOfWeek, todayKey, toDateKey } from '../services/dates';
import { buildPeriodPackage, copyAiPrompt as copyPackagePrompt, downloadAiPackage } from '../features/export/browser';
import { experimentDecisionLabel } from '../features/experiments/model';
import { notifyInfo, notifySaved, notifyUnknownError } from '../services/notifications';
import { plainCopy } from '../services/plain';
import { useAppStore } from '../stores/app';
import {
  contextFactorOptions,
  emptyWeeklyReview,
  externalCareerIdsForOptions,
  lifeAreaOptions,
  lifeEventTypeOptions,
  resultAreaOptions,
  type DailyEntry,
  type Experiment,
  type ExperimentDecision,
  type ExperimentRecord,
  type WeeklyReview,
} from '../types';

const props = defineProps<{ initialWeek?: string }>();
const store = useAppStore();

function validAnchor(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return todayKey();
  return toDateKey(fromDateKey(value)) === value ? value : todayKey();
}

function initialAnchor(value: string | undefined) {
  return value ? validAnchor(value) : todayKey();
}

const anchor = ref(initialAnchor(props.initialWeek));
const start = computed(() => startOfWeek(anchor.value));
const end = computed(() => endOfWeek(anchor.value));
const days = computed(() => Array.from({ length: 7 }, (_, index) => addDays(start.value, index)));
const entries = computed(() => entriesForWeek(store.dailyEntries, anchor.value));
const entriesByDate = computed(() => new Map(entries.value.map((entry) => [entry.date, entry])));
const lifeAreaItems = computed(() => [...lifeAreaOptions, ...store.settings.customLifeAreaOptions]);
const contextFactorItems = computed(() => [...contextFactorOptions, ...store.settings.customContextFactorOptions]);
const externalCareerIds = computed(() => externalCareerIdsForOptions(store.settings.customCareerOptions));
const summary = computed(() => summarize(entries.value, externalCareerIds.value));
const results = computed(() => resultsForPeriod(store.results, start.value, end.value));
const lifeEvents = computed(() =>
  store.lifeEvents.filter((event) => event.date >= start.value && event.date <= end.value).sort((a, b) => b.date.localeCompare(a.date)),
);
const resultAreaItems = computed(() => [...resultAreaOptions, ...store.settings.customLifeAreaOptions]);
const resultAreaSummary = computed(() => {
  const knownAreas = resultAreaItems.value;
  const unknownAreas = [...new Set(results.value.map((result) => result.area))]
    .filter((area) => !knownAreas.some((option) => option.id === area))
    .map((area) => ({ id: area, label: area, icon: '·' }));

  return [...knownAreas, ...unknownAreas]
    .map((option) => ({ ...option, count: results.value.filter((result) => result.area === option.id).length }))
    .filter((option) => option.count > 0);
});
const eventTypeSummary = computed(() =>
  lifeEventTypeOptions
    .map((option) => ({ ...option, count: lifeEvents.value.filter((event) => event.type === option.id).length }))
    .filter((option) => option.count > 0),
);
const resultRecordItems = computed(() =>
  results.value.map((result) => ({
    id: result.id ?? result.createdAt,
    icon: resultAreaItems.value.find((option) => option.id === result.area)?.icon ?? '·',
    title: result.title,
    dateLabel: formatDate(result.date, { weekday: 'short', day: 'numeric' }),
  })),
);
const eventRecordItems = computed(() =>
  lifeEvents.value.map((event) => ({
    id: event.id ?? event.createdAt,
    icon: lifeEventTypeOptions.find((option) => option.id === event.type)?.icon ?? '·',
    title: event.title,
    dateLabel: formatDate(event.date, { weekday: 'short', day: 'numeric' }),
  })),
);
type WeekExperimentCard = {
  id: string;
  active: boolean;
  title: string;
  titlePreview: string;
  hypothesis: string;
  conclusion: string;
  decision: ExperimentDecision | null;
  statusLabel: string;
  periodLabel: string;
  plannedDays: number;
  completedDays: number;
  notCompletedDays: number;
  unmarkedDays: number;
  totalPlannedDays: number;
  totalCompletedDays: number;
  totalNotCompletedDays: number;
  totalUnmarkedDays: number;
  notes: DailyEntry[];
};

const activeExperiment = computed(() => {
  const experiment = store.settings.experiment;
  if (
    !experiment.active ||
    !experiment.startDate ||
    !experiment.endDate ||
    experiment.startDate > end.value ||
    experiment.endDate < start.value
  )
    return null;
  return experiment;
});
const completedExperiments = computed(() =>
  store.settings.experimentHistory.filter((experiment) => experiment.startDate <= end.value && experiment.endDate >= start.value),
);
const experimentCards = computed<WeekExperimentCard[]>(() => [
  ...(activeExperiment.value ? [buildExperimentCard('active-experiment', activeExperiment.value, true)] : []),
  ...completedExperiments.value.map((experiment) => buildExperimentCard(experiment.id, experiment, false)),
]);
const openExperimentId = ref('');
const openExperimentNotesId = ref('');
const experimentNotePages = reactive<Record<string, number>>({});

watch(
  () => experimentCards.value.map((experiment) => experiment.id).join('|'),
  () => {
    const cards = experimentCards.value;
    if (!cards.some((experiment) => experiment.id === openExperimentId.value)) {
      openExperimentId.value = cards.find((experiment) => experiment.active)?.id ?? cards[0]?.id ?? '';
    }
    if (!cards.some((experiment) => experiment.id === openExperimentNotesId.value)) openExperimentNotesId.value = '';
  },
  { immediate: true },
);

function buildExperimentCard(id: string, experiment: Experiment | ExperimentRecord, active: boolean): WeekExperimentCard {
  const experimentDays = days.value.filter((day) => day >= experiment.startDate && day <= experiment.endDate);
  const experimentEntries = entries.value.filter((entry) => entry.experimentId === experiment.id);
  const marked = experimentEntries.filter((entry) => entry.experimentCompleted !== null);
  const totalDays = dateRange(experiment.startDate, experiment.endDate);
  const totalEntries = store.dailyEntries.filter((entry) => entry.experimentId === experiment.id);
  const totalMarked = totalEntries.filter((entry) => entry.experimentCompleted !== null);
  return {
    id,
    active,
    title: experiment.title,
    titlePreview: truncateExperimentText(experiment.title, 180),
    hypothesis: experiment.hypothesis,
    conclusion: experiment.conclusion,
    decision: experiment.decision,
    statusLabel: active
      ? start.value === startOfWeek(todayKey())
        ? 'Идёт сейчас'
        : end.value < startOfWeek(todayKey())
          ? 'Шёл в эту неделю'
          : 'Запланирован'
      : `Завершён · ${formatDate(experiment.endDate, { weekday: 'short', day: 'numeric' })}`,
    periodLabel: `${formatDate(experiment.startDate, { day: 'numeric', month: 'short' })} — ${formatDate(experiment.endDate, {
      day: 'numeric',
      month: 'short',
    })}`,
    plannedDays: experimentDays.length,
    completedDays: marked.filter((entry) => entry.experimentCompleted === true).length,
    notCompletedDays: marked.filter((entry) => entry.experimentCompleted === false).length,
    unmarkedDays: Math.max(0, experimentDays.length - marked.length),
    totalPlannedDays: totalDays.length,
    totalCompletedDays: totalMarked.filter((entry) => entry.experimentCompleted === true).length,
    totalNotCompletedDays: totalMarked.filter((entry) => entry.experimentCompleted === false).length,
    totalUnmarkedDays: Math.max(0, totalDays.length - totalMarked.length),
    notes: experimentEntries.filter((entry) => entry.experimentNote.trim()),
  };
}

function truncateExperimentText(value: string, maxLength: number): string {
  const text = value.trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function handleExperimentToggle(event: Event, id: string): void {
  const details = event.currentTarget as HTMLDetailsElement;
  if (details.open) openExperimentId.value = id;
  else if (openExperimentId.value === id) openExperimentId.value = '';
}

function toggleExperimentNotes(id: string): void {
  openExperimentNotesId.value = openExperimentNotesId.value === id ? '' : id;
  if (!experimentNotePages[id]) experimentNotePages[id] = 1;
}

function experimentNotePage(id: string): number {
  return experimentNotePages[id] ?? 1;
}

function setExperimentNotePage(id: string, page: number): void {
  experimentNotePages[id] = page;
}

function visibleExperimentNote(experiment: WeekExperimentCard): DailyEntry | null {
  return experiment.notes[experimentNotePage(experiment.id) - 1] ?? null;
}

function experimentNoteStatus(entry: DailyEntry): string {
  if (entry.experimentCompleted === true) return 'Получилось';
  if (entry.experimentCompleted === false) return 'Не получилось';
  return 'Без отметки';
}
const reviewCues = computed(() =>
  buildReviewCues('week', entries.value, results.value, lifeEvents.value, externalCareerIds.value, contextFactorItems.value),
);
const primaryReviewCues = computed(() => reviewCues.value.slice(0, 3));
const previousReview = computed(() => store.reviewByWeek(addDays(start.value, -7)));
const savedReview = computed(() => store.reviewByWeek(start.value));
const hasSavedReview = computed(() => Boolean(savedReview.value));
const recoveredReview = computed(() => {
  const weekStart = store.settings.firstUse.weekStart;
  if (store.settings.firstUse.status !== 'completed' || !weekStart || weekStart === start.value || !store.settings.firstUse.overviewSeen)
    return null;
  return store.reviewByWeek(weekStart) ?? null;
});
const recoveredWeekEnd = computed(() =>
  recoveredReview.value ? recoveredReview.value.coveredThrough || addDays(recoveredReview.value.weekStart, 6) : '',
);
const isRecoveredReview = computed(
  () =>
    Boolean(savedReview.value) &&
    store.settings.firstUse.weekStart === start.value &&
    store.settings.firstUse.overviewSeen &&
    (store.settings.firstUse.status === 'in_progress' || store.settings.firstUse.status === 'completed'),
);
const showRecoveredOverview = computed(() => isRecoveredReview.value && window.location.hash === '#first-use-overview');
const navigatorSubtitle = computed(() => {
  if (showRecoveredOverview.value) return 'Ваш первый обзор недели';
  return start.value === startOfWeek(todayKey()) ? 'Текущая неделя' : '';
});
const recoveredPeriodIsIncomplete = computed(
  () => Boolean(savedReview.value?.coveredThrough) && savedReview.value!.coveredThrough < addDays(savedReview.value!.weekStart, 6),
);
const hasDailyData = computed(() => summary.value.coveredEntriesCount > 0);
const hasJournalData = computed(() => results.value.length > 0 || lifeEvents.value.length > 0);
const hasPeriodData = computed(
  () => hasDailyData.value || hasJournalData.value || hasSavedReview.value || experimentCards.value.length > 0,
);
const reviewAvailable = computed(
  () => hasSavedReview.value || end.value < todayKey() || (start.value === startOfWeek(todayKey()) && todayKey() >= addDays(end.value, -1)),
);
const rows = computed(() => [
  { id: 'career', label: 'Работа', icon: '↗' },
  { id: 'sport', label: 'Спорт', icon: '△' },
  ...lifeAreaItems.value.filter((option) => store.settings.activeLifeAreas.includes(option.id)),
]);
const summaryText = computed(() => weekSummaryText(summary.value, store.settings.activeLifeAreas, lifeAreaItems.value));
const contextNotes = computed(() =>
  entries.value.filter((entry) => entry.contextFactors.length || entry.contextNote.trim()).sort((a, b) => a.date.localeCompare(b.date)),
);
const actionNotes = computed(() =>
  entries.value.filter((entry) => entry.actionDirection !== null).sort((a, b) => a.date.localeCompare(b.date)),
);
const specialDays = computed(() => entries.value.filter((entry) => entry.specialDay !== null).sort((a, b) => a.date.localeCompare(b.date)));
const rhythmDays = computed(() =>
  days.value.map((day) => {
    const entry = entriesByDate.value.get(day);
    return {
      day,
      entry,
      hasCareer: entry ? careerStatesForEntry(entry).length > 0 : false,
      hasExternalAction: entry?.actionDirection === 'external',
      hasDrift: entry?.actionDirection === 'drift',
      hasMovement: Boolean(entry?.activities.some((activity) => activity !== 'recovery')),
      hasNutritionSupport: entry?.nutritionState === 'supports_goal',
      hasNutritionNeutral: entry?.nutritionState === 'neutral',
      hasNutritionBlock: entry?.nutritionState === 'blocks_goal',
    };
  }),
);
function weekDayFacts(item: (typeof rhythmDays.value)[number]): string[] {
  const facts: string[] = [];
  if (item.entry?.sleepMinutes !== null && item.entry?.sleepMinutes !== undefined) {
    facts.push(`Сон ${formatMinutes(item.entry.sleepMinutes)}`);
  }
  if (item.entry?.energy !== null && item.entry?.energy !== undefined) facts.push(`Энергия ${item.entry.energy}/5`);
  if (item.hasCareer) facts.push('Работа');
  if (item.hasExternalAction) facts.push('Шаг к цели');
  if (item.hasDrift) facts.push('Другие дела');
  if (item.hasMovement) facts.push('Физическая активность');
  if (item.hasNutritionSupport) facts.push('Питание поддержало');
  if (item.hasNutritionNeutral) facts.push('Питание нейтрально');
  if (item.hasNutritionBlock) facts.push('Питание мешало');
  if (item.entry?.specialDay) facts.push(specialDayLabel(item.entry.specialDay));
  return facts;
}
const review = reactive<WeeklyReview>(emptyWeeklyReview(start.value));
const reviewSaving = ref(false);
const promptCopying = ref(false);
const reviewContextOpen = ref(false);
const reviewHasContext = computed(
  () =>
    review.results.some((value) => value.trim()) ||
    review.highlights.some((value) => value.trim()) ||
    Boolean(review.stateContext.trim() || review.support.trim() || review.obstacle.trim()),
);

function loadReview() {
  const existing = store.reviewByWeek(start.value);
  Object.assign(review, emptyWeeklyReview(start.value), existing ? plainCopy(existing) : {});
  while (review.results.length < 3) review.results.push('');
  while (review.highlights.length < 3) review.highlights.push('');
  reviewContextOpen.value = reviewHasContext.value;
}
watch(start, loadReview, { immediate: true });
watch(
  () => props.initialWeek,
  (value) => {
    anchor.value = initialAnchor(value);
  },
);

function updateReviewContextOpen(event: Event) {
  reviewContextOpen.value = (event.currentTarget as HTMLDetailsElement).open;
}

async function saveReview() {
  if (reviewSaving.value) return;
  reviewSaving.value = true;
  try {
    await store.saveReview(plainCopy(review));
    notifySaved('Обзор недели сохранён');
  } catch (error) {
    notifyUnknownError(error, 'Не удалось сохранить обзор недели');
  } finally {
    reviewSaving.value = false;
  }
}

function createPackage() {
  return buildPeriodPackage('week', anchor.value, {
    entries: store.dailyEntries,
    results: store.results,
    lifeEvents: store.lifeEvents,
    reviews: store.weeklyReviews,
    monthlyReviews: store.monthlyReviews,
    settings: store.settings,
  });
}

async function copyPrompt() {
  if (promptCopying.value) return;
  promptCopying.value = true;
  try {
    await copyPackagePrompt(createPackage(), store.settings);
    notifySaved('Промпт для анализа скопирован');
  } catch (error) {
    notifyUnknownError(error, 'Не удалось скопировать промпт');
  } finally {
    promptCopying.value = false;
  }
}

function downloadJson() {
  try {
    downloadAiPackage(createPackage());
    notifyInfo('Данные недели скачаны');
  } catch (error) {
    notifyUnknownError(error, 'Не удалось скачать данные недели');
  }
}
</script>

<template>
  <section class="page page--review page--week">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Недельная сводка</span>
        <h1>Неделя</h1>
        <p>Посмотрите, чем была наполнена неделя, и решите, хотите ли что-то менять.</p>
      </div>
      <a v-if="hasPeriodData" class="review-jump" href="#week-review"
        >{{ reviewAvailable ? 'К обзору' : 'Обзор позже' }} <span aria-hidden="true">↓</span></a
      >
    </div>
    <PeriodNavigator
      :title="`${formatDate(start, { day: 'numeric', month: 'short' })} — ${formatDate(end, { day: 'numeric', month: 'short' })}`"
      :subtitle="navigatorSubtitle"
      @previous="anchor = addDays(anchor, -7)"
      @next="anchor = addDays(anchor, 7)"
      @current="anchor = todayKey()"
    />

    <section v-if="recoveredReview && !hasSavedReview" class="period-review-note recovered-week-link">
      <div>
        <strong>Ваш первый обзор сохранён</strong>
        <p>
          Сейчас открыта другая неделя. Сохранённый обзор относится к
          {{ formatDate(recoveredReview.weekStart, { day: 'numeric', month: 'long' }) }} —
          {{ formatDate(recoveredWeekEnd, { day: 'numeric', month: 'long', year: 'numeric' }) }}.
        </p>
      </div>
      <RouterLink class="secondary-button context-action" :to="`/week?week=${recoveredReview.weekStart}#first-use-overview`">
        Открыть обзор
      </RouterLink>
    </section>

    <section v-if="!hasPeriodData" class="period-empty-guide">
      <strong>За эту неделю пока нет записей</strong>
      <p>Заполняйте на главной несколько важных пунктов. Здесь они соберутся по дням и помогут сравнить сон, состояние и действия.</p>
      <RouterLink class="secondary-button" to="/">Перейти к записи за день</RouterLink>
    </section>

    <template v-else>
      <section v-if="!hasDailyData" class="period-review-note period-data-guide">
        <strong>{{ experimentCards.length ? 'Есть только отметки эксперимента' : 'За эту неделю нет дневных записей' }}</strong>
        <p>
          {{ experimentCards.length ? 'Отметки эксперимента показаны ниже.' : 'Итоги, события и сохранённый обзор показаны ниже.' }} Данных
          для сравнения сна, состояния и действий пока нет.
        </p>
      </section>

      <article v-if="showRecoveredOverview && savedReview" id="first-use-overview" class="restored-week-overview">
        <div class="restored-week-overview__heading">
          <div>
            <p class="eyebrow">Восстановлено по вашим ответам</p>
            <h2>Вот чем была наполнена ваша неделя</h2>
            <p>Здесь собраны ваши факты, важные события и условия недели. Это не оценка и не автоматический вывод.</p>
            <p v-if="recoveredPeriodIsIncomplete" class="restored-week-overview__coverage">
              Ответы собраны по {{ formatDate(savedReview.coveredThrough, { day: 'numeric', month: 'long' }) }}. Остальные дни этой недели
              не считаются пропущенными.
            </p>
          </div>
        </div>
        <WeeklyReviewOverview :review="savedReview" />
        <WeeklyReviewJournalLinks :review="savedReview" />
        <div class="restored-week-overview__actions">
          <RouterLink class="primary-button" to="/">Записать сегодняшний день</RouterLink>
          <RouterLink class="secondary-button" to="/?first-use=edit">Исправить ответы</RouterLink>
        </div>
      </article>

      <article v-if="hasDailyData" class="insight-card">
        <span class="insight-card__mark">⌁</span>
        <p>{{ summaryText }}</p>
      </article>

      <article v-if="hasDailyData || hasJournalData" class="dashboard-card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Короткий разбор</span>
            <h2>На что обратить внимание</h2>
          </div>
          <div class="period-actions">
            <button class="secondary-button" type="button" :disabled="promptCopying" @click="copyPrompt">
              {{ promptCopying ? 'Копирую…' : 'Скопировать промпт' }}
            </button>
            <button class="secondary-button" type="button" @click="downloadJson">Скачать данные</button>
          </div>
        </div>
        <div class="review-nudge range-custom-action" style="margin-top: 16px">
          <div>
            <strong>Нужен другой период?</strong>
            <p>Выберите точные даты и скопируйте промпт в настройках.</p>
          </div>
          <RouterLink class="secondary-button" to="/settings#analysis-settings">Выбрать даты</RouterLink>
        </div>
        <div class="review-cue-grid review-cue-grid--primary">
          <article v-for="cue in primaryReviewCues" :key="cue.id" class="review-cue" :class="`review-cue--${cue.tone}`">
            <strong>{{ cue.title }}</strong>
            <p>{{ cue.text }}</p>
          </article>
        </div>
      </article>

      <section
        v-if="results.length || lifeEvents.length"
        class="period-records period-records--featured"
        aria-label="Главные записи недели"
      >
        <PeriodRecordCard
          v-if="results.length"
          eyebrow="Завершённые факты"
          title="Итоги недели"
          :items="resultRecordItems"
          :breakdown="resultAreaSummary"
          breakdown-label="Итоги по областям"
          pagination-label="итогов недели"
        />

        <PeriodRecordCard
          v-if="lifeEvents.length"
          eyebrow="Важный контекст"
          title="События недели"
          :items="eventRecordItems"
          :breakdown="eventTypeSummary"
          breakdown-label="События по типам"
          pagination-label="событий недели"
        />
      </section>

      <article v-if="reviewAvailable" id="week-review" class="review-card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Обзор недели</span>
            <h2>Короткий обзор</h2>
          </div>
          <span class="period-pill">До {{ formatDate(end, { day: 'numeric', month: 'long', year: 'numeric' }) }}</span>
        </div>
        <template v-if="previousReview?.nextLever || previousReview?.ifThenPlan">
          <div class="previous-plan">
            <span class="eyebrow">Решение из прошлого обзора</span>
            <p v-if="previousReview.nextLever"><strong>Вы решили:</strong> {{ previousReview.nextLever }}</p>
            <p v-if="previousReview.ifThenPlan"><strong>План:</strong> {{ previousReview.ifThenPlan }}</p>
          </div>
          <label class="field-label">Что получилось с этим решением?</label
          ><textarea
            v-model="review.previousPlanOutcome"
            rows="2"
            placeholder="Сработало, не сработало или данных пока недостаточно — и почему"
          ></textarea>
        </template>
        <details class="period-details review-context-details" :open="reviewContextOpen" @toggle="updateReviewContextOpen">
          <summary>{{ reviewHasContext ? 'Итоги и контекст' : 'Добавить итоги и контекст' }}</summary>
          <div class="period-details__content">
            <label class="field-label">До трёх итогов или сделанных дел</label>
            <input
              v-for="(_, index) in review.results"
              :key="index"
              v-model="review.results[index]"
              type="text"
              :placeholder="`${index + 1}. Итог или важный факт`"
            />
            <label class="field-label">До трёх событий, решений или мыслей</label>
            <input
              v-for="(_, index) in review.highlights"
              :key="`highlight-${index}`"
              v-model="review.highlights[index]"
              type="text"
              :placeholder="`${index + 1}. Что важно запомнить`"
            />
            <label class="field-label">Как вы себя чувствовали и что влияло на неделю?</label>
            <textarea v-model="review.stateContext" rows="2" placeholder="Силы, настроение и важные обстоятельства"></textarea>
            <label class="field-label">Что помогало?</label
            ><textarea v-model="review.support" rows="2" placeholder="Люди, режим, место, привычка или решение"></textarea>
            <label class="field-label">Что мешало сильнее всего?</label
            ><textarea v-model="review.obstacle" rows="2" placeholder="Один главный фактор"></textarea>
          </div>
        </details>
        <label class="field-label">Что продолжить или изменить на следующей неделе?</label
        ><textarea v-model="review.nextLever" rows="2" placeholder="Можно продолжить как есть или пока ничего не решать"></textarea>
        <label class="field-label">План если-то</label
        ><textarea
          v-model="review.ifThenPlan"
          rows="2"
          placeholder="Если снова появится главное препятствие, то я сделаю конкретное действие"
        ></textarea>
        <button class="primary-button" type="button" :disabled="reviewSaving" @click="saveReview">
          {{ reviewSaving ? 'Сохраняю…' : 'Сохранить обзор' }}
        </button>
      </article>
      <section v-else id="week-review" class="period-review-note">
        <strong>Короткий обзор появится в конце недели</strong>
        <p>Его можно пропустить — дневные записи и сводка недели останутся на месте.</p>
      </section>

      <details
        v-if="hasDailyData || hasJournalData || experimentCards.length"
        class="period-details week-data-details"
        :open="!hasDailyData"
      >
        <summary>{{ hasDailyData ? 'Показать дни и дополнительный контекст' : 'Записи недели' }}</summary>
        <div class="period-details__content">
          <article v-if="hasDailyData" class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Факты по дням</span>
                <h2>Как проходила неделя</h2>
              </div>
            </div>
            <div class="week-story-list">
              <article v-for="item in rhythmDays" :key="item.day" class="week-story-day" :class="{ 'week-story-day--empty': !item.entry }">
                <time>{{ formatDate(item.day, { weekday: 'short', day: 'numeric' }) }}</time>
                <div>
                  <strong v-if="item.entry?.importantFact">{{ item.entry.importantFact }}</strong>
                  <span v-else>{{
                    item.entry ? 'Запись без заметки дня' : item.day > todayKey() ? 'День ещё не наступил' : 'Записи нет'
                  }}</span>
                  <div v-if="weekDayFacts(item).length" class="week-story-day__facts">
                    <small v-for="fact in weekDayFacts(item)" :key="fact">{{ fact }}</small>
                  </div>
                </div>
              </article>
            </div>
          </article>

          <article v-if="experimentCards.length" class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Личные проверки</span>
                <h2>Эксперименты в эту неделю</h2>
              </div>
              <span class="count-badge">{{ experimentCards.length }}</span>
            </div>
            <div class="period-records__content">
              <details
                v-for="(experiment, index) in experimentCards"
                :key="experiment.id"
                class="period-record-card period-record-card--disclosure experiment-period-card"
                :open="openExperimentId === experiment.id"
                @toggle="handleExperimentToggle($event, experiment.id)"
              >
                <summary>
                  <span class="period-record-card__heading">
                    <span
                      ><span class="eyebrow">{{ experiment.statusLabel }}</span
                      ><strong>{{ experiment.titlePreview }}</strong
                      ><span class="eyebrow">Период: {{ experiment.periodLabel }}</span></span
                    >
                    <span v-if="experiment.notes.length" class="count-badge" :aria-label="`Заметок: ${experiment.notes.length}`">
                      {{ experiment.notes.length }}
                    </span>
                  </span>
                  <span class="period-record-card__breakdown" aria-label="Отметки эксперимента за эту неделю">
                    <span>За неделю: получилось · {{ experiment.completedDays }}</span>
                    <span>Не получилось · {{ experiment.notCompletedDays }}</span>
                    <span>Без отметки · {{ experiment.unmarkedDays }} из {{ experiment.plannedDays }}</span>
                  </span>
                </summary>
                <div class="period-record-card__details">
                  <div class="previous-plan">
                    <span class="eyebrow">Условие</span>
                    <p>
                      <strong>{{ experiment.title }}</strong>
                    </p>
                    <p v-if="experiment.hypothesis">Что хотите узнать: {{ experiment.hypothesis }}</p>
                    <p v-if="experiment.conclusion">
                      <strong>{{ experiment.active ? 'Промежуточное наблюдение:' : 'Что заметили:' }}</strong
                      ><br />{{ experiment.conclusion }}
                    </p>
                    <p v-if="experiment.decision">Дальше: {{ experimentDecisionLabel(experiment.decision).toLocaleLowerCase('ru-RU') }}</p>
                    <p v-if="experiment.totalPlannedDays !== experiment.plannedDays">
                      За весь период: получилось {{ experiment.totalCompletedDays }}, не получилось {{ experiment.totalNotCompletedDays }},
                      без отметки {{ experiment.totalUnmarkedDays }} из {{ experiment.totalPlannedDays }}.
                    </p>
                  </div>
                  <button
                    v-if="experiment.notes.length"
                    class="secondary-button"
                    type="button"
                    :aria-expanded="openExperimentNotesId === experiment.id"
                    :aria-controls="`experiment-notes-${index}`"
                    @click="toggleExperimentNotes(experiment.id)"
                  >
                    {{ openExperimentNotesId === experiment.id ? 'Скрыть заметки' : `Заметки этой недели · ${experiment.notes.length}` }}
                  </button>
                  <p v-else class="field-hint">Заметок за эту неделю нет.</p>
                  <div
                    v-if="openExperimentNotesId === experiment.id && visibleExperimentNote(experiment)"
                    :id="`experiment-notes-${index}`"
                    class="period-record-card__details experiment-note-page"
                  >
                    <article class="note-item">
                      <time>{{ formatDate(visibleExperimentNote(experiment)!.date, { weekday: 'short', day: 'numeric' }) }}</time>
                      <p>
                        <strong>{{ experimentNoteStatus(visibleExperimentNote(experiment)!) }}</strong
                        ><br />{{ visibleExperimentNote(experiment)!.experimentNote }}
                      </p>
                    </article>
                    <ArchivePagination
                      :page="experimentNotePage(experiment.id)"
                      :page-count="experiment.notes.length"
                      context-label="заметок эксперимента"
                      @update:page="setExperimentNotePage(experiment.id, $event)"
                    />
                  </div>
                </div>
              </details>
            </div>
          </article>

          <article v-if="hasDailyData && actionNotes.length" class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Действия по цели</span>
                <h2>Конкретные действия и подготовка</h2>
              </div>
              <span class="count-badge">{{ actionNotes.length }}</span>
            </div>
            <div class="note-list">
              <article v-for="entry in actionNotes" :key="entry.date" class="note-item">
                <time>{{ formatDate(entry.date, { weekday: 'short', day: 'numeric' }) }}</time>
                <p>
                  <strong>{{ actionDirectionLabel(entry.actionDirection) }}</strong
                  ><span v-if="entry.focusTitle"><br />Цель: {{ entry.focusTitle }}</span
                  ><span v-if="entry.actionNote"><br />{{ entry.actionNote }}</span>
                </p>
              </article>
            </div>
          </article>

          <article v-if="hasDailyData && specialDays.length" class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Поправка на контекст</span>
                <h2>Особые дни</h2>
              </div>
              <span class="count-badge">{{ specialDays.length }}</span>
            </div>
            <div class="special-day-list">
              <article v-for="entry in specialDays" :key="entry.date" class="special-day-item">
                <time>{{ formatDate(entry.date, { weekday: 'short', day: 'numeric' }) }}</time>
                <strong>{{ specialDayLabel(entry.specialDay) }}</strong>
                <p v-if="entry.specialDayNote">{{ entry.specialDayNote }}</p>
              </article>
            </div>
          </article>

          <article v-if="hasDailyData && contextNotes.length" class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Условия дня</span>
                <h2>Повторяющиеся условия и заметки</h2>
              </div>
              <span class="count-badge">{{ contextNotes.length }}</span>
            </div>
            <div class="factor-note-list">
              <article v-for="entry in contextNotes" :key="entry.date" class="factor-note-item">
                <time>{{ formatDate(entry.date, { weekday: 'short', day: 'numeric' }) }}</time>
                <div>
                  <span v-for="factor in entry.contextFactors" :key="factor" class="mini-pill">{{
                    contextFactorLabel(factor, contextFactorItems)
                  }}</span>
                  <p v-if="entry.contextNote">{{ entry.contextNote }}</p>
                </div>
              </article>
            </div>
          </article>

          <article v-if="hasDailyData" class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Присутствие областей</span>
                <h2>Карта недели</h2>
              </div>
            </div>
            <div class="heatmap" :style="{ '--day-count': days.length }">
              <div class="heatmap__corner"></div>
              <div v-for="day in days" :key="day" class="heatmap__day">
                <strong>{{ formatDate(day, { weekday: 'short' }) }}</strong
                ><small>{{ formatDate(day, { day: '2-digit' }) }}</small>
              </div>
              <template v-for="row in rows" :key="row.id">
                <div class="heatmap__label">
                  <span>{{ row.icon }}</span
                  >{{ row.label }}
                </div>
                <div
                  v-for="day in days"
                  :key="`${row.id}-${day}`"
                  class="heatmap__cell"
                  :class="{ active: hasArea(entriesByDate.get(day), row.id) }"
                >
                  <span></span>
                </div>
              </template>
            </div>
          </article>
        </div>
      </details>
    </template>
  </section>
</template>
