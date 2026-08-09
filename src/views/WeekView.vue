<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import type { EChartsCoreOption } from 'echarts/core';
import EChartPanel from '../components/charts/EChartPanel.vue';
import MetricCard from '../components/MetricCard.vue';
import PeriodNavigator from '../components/PeriodNavigator.vue';
import WeeklyReviewJournalLinks from '../components/WeeklyReviewJournalLinks.vue';
import WeeklyReviewOverview from '../components/WeeklyReviewOverview.vue';
import ArchivePagination from '../features/journal/ArchivePagination.vue';
import {
  actionDirectionLabel,
  buildReviewCues,
  buildReviewQuestions,
  careerStatesForEntry,
  contextFactorLabel,
  entriesForWeek,
  hasArea,
  resultsForPeriod,
  specialDayLabel,
  summarize,
  weekSummaryText,
} from '../services/analytics';
import { addDays, endOfWeek, formatDate, formatMinutes, fromDateKey, startOfWeek, todayKey, toDateKey } from '../services/dates';
import { buildPeriodPackage, copyAiPrompt as copyPackagePrompt, downloadAiPackage } from '../features/export/browser';
import { experimentDecisionLabel } from '../features/experiments/model';
import { notifyInfo, notifySaved, notifyUnknownError } from '../services/notifications';
import { pageCount, pageItems } from '../services/pagination';
import { plainCopy } from '../services/plain';
import { useAppStore } from '../stores/app';
import {
  contextFactorOptions,
  emptyWeeklyReview,
  externalCareerIdsForOptions,
  lifeAreaOptions,
  lifeEventTypeOptions,
  resultAreaOptions,
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
const resultPage = ref(1);
const eventPage = ref(1);
const recordPageSize = 5;
const visibleResults = computed(() => pageItems(results.value, resultPage.value, recordPageSize));
const resultPageCount = computed(() => pageCount(results.value.length, recordPageSize));
const visibleLifeEvents = computed(() => pageItems(lifeEvents.value, eventPage.value, recordPageSize));
const eventPageCount = computed(() => pageCount(lifeEvents.value.length, recordPageSize));
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
const activeExperimentWeek = computed(() => {
  const experiment = store.settings.experiment;
  if (
    !experiment.active ||
    !experiment.startDate ||
    !experiment.endDate ||
    experiment.startDate > end.value ||
    experiment.endDate < start.value
  )
    return null;
  const experimentDays = days.value.filter((day) => day >= experiment.startDate && day <= experiment.endDate);
  const experimentEntries = entries.value.filter((entry) => entry.date >= experiment.startDate && entry.date <= experiment.endDate);
  const marked = experimentEntries.filter((entry) => entry.experimentCompleted !== null);
  return {
    experiment,
    plannedDays: experimentDays.length,
    completedDays: marked.filter((entry) => entry.experimentCompleted === true).length,
    notCompletedDays: marked.filter((entry) => entry.experimentCompleted === false).length,
    unmarkedDays: Math.max(0, experimentDays.length - marked.length),
  };
});
const completedExperiments = computed(() =>
  store.settings.experimentHistory.filter((experiment) => experiment.endDate >= start.value && experiment.endDate <= end.value),
);
const reviewCues = computed(() =>
  buildReviewCues('week', entries.value, results.value, lifeEvents.value, externalCareerIds.value, contextFactorItems.value),
);
const primaryReviewCues = computed(() => reviewCues.value.slice(0, 3));
const additionalReviewCues = computed(() => reviewCues.value.slice(3));
const hasEnoughDataForWeekChart = computed(() => reviewCues.value.find((cue) => cue.id === 'coverage')?.tone === 'good');
const reviewQuestions = buildReviewQuestions('week');
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
const hasPeriodData = computed(() => hasDailyData.value || hasJournalData.value || hasSavedReview.value);
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
const rhythmOption = computed<EChartsCoreOption>(() => {
  const labels = rhythmDays.value.map((item) => formatDate(item.day, { weekday: 'short', day: '2-digit' }));
  const actionRows = ['Работа', 'Шаг к цели', 'Занимался другим', 'Движение', 'Питание', 'Особый день'];
  const actionSeries = [
    { name: 'Работа', row: 'Работа', color: '#4188e8', active: (item: (typeof rhythmDays.value)[number]) => item.hasCareer },
    {
      name: 'Шаг к цели',
      row: 'Шаг к цели',
      color: '#5264d8',
      active: (item: (typeof rhythmDays.value)[number]) => item.hasExternalAction,
    },
    {
      name: 'Занимался другим',
      row: 'Занимался другим',
      color: '#b85c4c',
      active: (item: (typeof rhythmDays.value)[number]) => item.hasDrift,
    },
    { name: 'Движение', row: 'Движение', color: '#38b989', active: (item: (typeof rhythmDays.value)[number]) => item.hasMovement },
    {
      name: 'Питание поддержало',
      row: 'Питание',
      color: '#38b989',
      active: (item: (typeof rhythmDays.value)[number]) => item.hasNutritionSupport,
    },
    {
      name: 'Питание нейтрально',
      row: 'Питание',
      color: '#d39b2f',
      active: (item: (typeof rhythmDays.value)[number]) => item.hasNutritionNeutral,
    },
    {
      name: 'Питание мешало',
      row: 'Питание',
      color: '#b85c4c',
      active: (item: (typeof rhythmDays.value)[number]) => item.hasNutritionBlock,
    },
    {
      name: 'Особый день',
      row: 'Особый день',
      color: '#eb7458',
      active: (item: (typeof rhythmDays.value)[number]) => Boolean(item.entry?.specialDay),
    },
  ];

  return {
    color: ['#7467e8', '#1d5148'],
    tooltip: { trigger: 'item' },
    legend: { data: ['Сон', 'Энергия'], top: 0, right: 0, itemWidth: 12, itemHeight: 10, textStyle: { color: '#657085', fontSize: 12 } },
    grid: [
      { left: 50, right: 44, top: 42, height: 178 },
      { left: 82, right: 44, top: 244, height: 94 },
    ],
    xAxis: [
      {
        type: 'category',
        gridIndex: 0,
        data: labels,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dfe4ed' } },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: labels,
        axisLabel: { color: '#7d8798', fontSize: 11 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dfe4ed' } },
      },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        min: 0,
        max: 12,
        interval: 3,
        axisLabel: { formatter: '{value}ч', color: '#7d8798' },
        splitLine: { lineStyle: { color: '#edf1f6' } },
      },
      { type: 'value', gridIndex: 0, min: 1, max: 5, interval: 1, axisLabel: { color: '#7d8798' }, splitLine: { show: false } },
      {
        type: 'category',
        gridIndex: 1,
        data: actionRows,
        axisLabel: { color: '#657085', fontSize: 10 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Сон',
        type: 'bar',
        xAxisIndex: 0,
        yAxisIndex: 0,
        barMaxWidth: 34,
        data: rhythmDays.value.map((item) =>
          item.entry?.sleepMinutes === null || item.entry?.sleepMinutes === undefined
            ? null
            : {
                value: Math.round((item.entry.sleepMinutes / 60) * 10) / 10,
                itemStyle: { color: item.entry.specialDay ? '#eb7458' : '#7467e8', borderRadius: [6, 6, 2, 2] },
              },
        ),
      },
      {
        name: 'Энергия',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 1,
        symbolSize: 9,
        lineStyle: { width: 3 },
        data: rhythmDays.value.map((item) => item.entry?.energy ?? null),
      },
      ...actionSeries.map((series) => ({
        name: series.name,
        type: 'scatter' as const,
        xAxisIndex: 1,
        yAxisIndex: 2,
        symbolSize: 10,
        itemStyle: { color: series.color },
        data: rhythmDays.value.flatMap((item, index) => (series.active(item) ? [[labels[index], series.row]] : [])),
      })),
    ],
  };
});
const review = reactive<WeeklyReview>(emptyWeeklyReview(start.value));
const reviewSaving = ref(false);
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
  resultPage.value = 1;
  eventPage.value = 1;
}
watch(start, loadReview, { immediate: true });
watch(resultPageCount, (count) => {
  resultPage.value = Math.min(resultPage.value, count);
});
watch(eventPageCount, (count) => {
  eventPage.value = Math.min(eventPage.value, count);
});
watch(
  () => props.initialWeek,
  (value) => {
    anchor.value = initialAnchor(value);
  },
);

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
  try {
    await copyPackagePrompt(createPackage(), store.settings);
    notifySaved('Промпт для анализа скопирован');
  } catch (error) {
    notifyUnknownError(error, 'Не удалось скопировать промпт');
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
        <strong>За эту неделю нет дневных записей</strong>
        <p>Итоги, события и сохранённый обзор показаны ниже. Данных для сравнения сна, состояния и действий пока нет.</p>
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
            <button class="secondary-button" type="button" @click="copyPrompt">Скопировать промпт</button>
            <button class="secondary-button" type="button" @click="downloadJson">Скачать данные</button>
          </div>
        </div>
        <div class="review-cue-grid review-cue-grid--primary">
          <article v-for="cue in primaryReviewCues" :key="cue.id" class="review-cue" :class="`review-cue--${cue.tone}`">
            <strong>{{ cue.title }}</strong>
            <p>{{ cue.text }}</p>
          </article>
        </div>
      </article>

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
        <details class="period-details review-context-details" :open="reviewHasContext">
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

      <details v-if="hasDailyData || hasJournalData" class="period-details week-data-details" :open="!hasDailyData">
        <summary>{{ hasDailyData ? 'Показать показатели и записи недели' : 'Записи недели' }}</summary>
        <div class="period-details__content">
          <section v-if="hasDailyData" class="week-detail-section" aria-labelledby="week-metrics-title">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Показатели недели</span>
                <h2 id="week-metrics-title">Сводка по отмеченным дням</h2>
              </div>
            </div>
            <div class="metrics-grid">
              <MetricCard
                label="Средний сон"
                :value="formatMinutes(summary.averageSleep === null ? null : Math.round(summary.averageSleep))"
                :hint="`${summary.sleepSamples} дн. без особых`"
                accent="#7467e8"
              />
              <MetricCard
                label="Работа"
                :value="`${summary.careerDays}/${summary.careerSamples}`"
                hint="дни с работой / дни с отметкой"
                accent="#3f82d5"
              />
              <MetricCard
                label="Шаги к цели"
                :value="`${summary.externalActionDays}/${summary.preparationDays}`"
                :hint="`шаги / подготовка · ${summary.actionDirectionSamples} дн.`"
                accent="#1d5148"
              />
              <MetricCard
                label="Дней с активностью"
                :value="summary.movementDays"
                :hint="`${summary.movementSamples} дн. с отметкой`"
                accent="#2eaa7f"
              />
              <MetricCard
                label="Питание"
                :value="`${summary.nutritionSupportDays}/${summary.nutritionBlockDays}`"
                :hint="`поддержало / мешало · ${summary.nutritionSamples} дн.`"
                accent="#d9952f"
              />
              <MetricCard label="Итогов" :value="results.length" accent="#e7a43b" />
            </div>
          </section>

          <article v-if="hasDailyData" class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Ритм недели</span>
                <h2>Сон, энергия и действия</h2>
              </div>
            </div>
            <template v-if="hasEnoughDataForWeekChart">
              <EChartPanel :option="rhythmOption" :height="380" aria-label="Ритм сна, энергии и действий за неделю" />
              <p class="data-note">
                Столбцы показывают сон, линия — энергию. Оранжевый столбец означает особый день. В строке питания: зелёный — поддержало
                цель, жёлтый — нейтрально, красный — мешало.
              </p>
            </template>
            <div v-else class="period-review-note week-chart-guide">
              <strong>Для графика пока мало сопоставимых данных</strong>
              <p>
                Нужны хотя бы 4 обычных заполненных дня, из них 2 с основными полями. Сейчас: {{ summary.ordinaryCoveredEntriesCount }} и
                {{ summary.ordinaryCoreEntriesCount }}.
              </p>
            </div>
          </article>

          <article v-if="additionalReviewCues.length || reviewQuestions.length" class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Дополнительный разбор</span>
                <h2>Другие наблюдения и вопросы</h2>
              </div>
            </div>
            <div v-if="additionalReviewCues.length" class="review-cue-grid review-cue-grid--additional">
              <article v-for="cue in additionalReviewCues" :key="cue.id" class="review-cue" :class="`review-cue--${cue.tone}`">
                <strong>{{ cue.title }}</strong>
                <p>{{ cue.text }}</p>
              </article>
            </div>
            <ol class="review-question-list">
              <li v-for="question in reviewQuestions" :key="question">{{ question }}</li>
            </ol>
          </article>

          <article v-if="hasDailyData && (activeExperimentWeek || completedExperiments.length)" class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Личные проверки</span>
                <h2>Эксперименты недели</h2>
              </div>
              <span class="count-badge">{{ (activeExperimentWeek ? 1 : 0) + completedExperiments.length }}</span>
            </div>
            <div v-if="activeExperimentWeek" class="previous-plan">
              <span class="eyebrow">Идёт сейчас</span>
              <p>
                <strong>{{ activeExperimentWeek.experiment.title }}</strong>
              </p>
              <p v-if="activeExperimentWeek.experiment.hypothesis">Что хотите узнать: {{ activeExperimentWeek.experiment.hypothesis }}</p>
              <div class="comparison-periods">
                <span>Получилось: {{ activeExperimentWeek.completedDays }}</span>
                <span>Не получилось: {{ activeExperimentWeek.notCompletedDays }}</span>
                <span>Без отметки: {{ activeExperimentWeek.unmarkedDays }} из {{ activeExperimentWeek.plannedDays }}</span>
              </div>
            </div>
            <div v-if="completedExperiments.length" class="note-list">
              <article v-for="experiment in completedExperiments" :key="experiment.id" class="note-item">
                <time>{{ formatDate(experiment.endDate, { weekday: 'short', day: 'numeric' }) }}</time>
                <p>
                  <strong>{{ experiment.title }}</strong
                  ><br />{{ experiment.conclusion
                  }}<span v-if="experiment.decision"
                    ><br />Дальше: {{ experimentDecisionLabel(experiment.decision).toLocaleLowerCase('ru-RU') }}</span
                  >
                </p>
              </article>
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

          <article v-if="results.length" class="period-record-card">
            <div class="period-record-card__heading">
              <div>
                <span class="eyebrow">Завершённые факты</span>
                <h2>Итоги недели</h2>
              </div>
              <span class="count-badge">{{ results.length }}</span>
            </div>
            <div class="period-record-card__breakdown" aria-label="Итоги по областям">
              <span v-for="area in resultAreaSummary" :key="area.id">{{ area.icon }} {{ area.label }} · {{ area.count }}</span>
            </div>
            <ul class="period-record-preview">
              <li v-for="result in visibleResults" :key="result.id ?? result.createdAt">
                <span>✓</span>
                <div>
                  {{ result.title }}<small>{{ formatDate(result.date, { weekday: 'short', day: 'numeric' }) }}</small>
                </div>
              </li>
            </ul>
            <ArchivePagination v-model:page="resultPage" :page-count="resultPageCount" context-label="итогов недели" />
          </article>

          <article v-if="lifeEvents.length" class="period-record-card">
            <div class="period-record-card__heading">
              <div>
                <span class="eyebrow">Важный контекст</span>
                <h2>События недели</h2>
              </div>
              <span class="count-badge">{{ lifeEvents.length }}</span>
            </div>
            <div class="period-record-card__breakdown" aria-label="События по типам">
              <span v-for="type in eventTypeSummary" :key="type.id">{{ type.icon }} {{ type.label }} · {{ type.count }}</span>
            </div>
            <ul class="period-record-preview">
              <li v-for="event in visibleLifeEvents" :key="event.id ?? event.createdAt">
                <span>{{ eventTypeSummary.find((type) => type.id === event.type)?.icon ?? '·' }}</span>
                <div>
                  {{ event.title }}<small>{{ formatDate(event.date, { weekday: 'short', day: 'numeric' }) }}</small>
                </div>
              </li>
            </ul>
            <ArchivePagination v-model:page="eventPage" :page-count="eventPageCount" context-label="событий недели" />
          </article>
        </div>
      </details>
    </template>
  </section>
</template>
