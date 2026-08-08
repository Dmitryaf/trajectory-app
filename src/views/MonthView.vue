<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import type { EChartsCoreOption } from 'echarts/core';
import EChartPanel from '../components/charts/EChartPanel.vue';
import MetricCard from '../components/MetricCard.vue';
import PeriodNavigator from '../components/PeriodNavigator.vue';
import ArchivePagination from '../features/journal/ArchivePagination.vue';
import {
  actionDirectionLabel,
  buildObservations,
  buildReviewCues,
  buildReviewQuestions,
  careerStatesForEntry,
  entriesForMonth,
  factorSummaries,
  resultsForPeriod,
  specialDayLabel,
  summarize,
} from '../services/analytics';
import {
  addDays,
  dateRange,
  endOfMonth,
  formatDate,
  formatMinutes,
  fromDateKey,
  startOfMonth,
  todayKey,
  toDateKey,
} from '../services/dates';
import { buildPeriodPackage, copyAiPrompt as copyPackagePrompt, downloadAiPackage } from '../features/export/browser';
import { buildWeightSeries } from '../features/analytics/weightSeries';
import { pageCount, pageItems } from '../services/pagination';
import { useAppStore } from '../stores/app';
import { notifyInfo, notifySaved, notifyUnknownError } from '../services/notifications';
import { plainCopy } from '../services/plain';
import {
  actionDirectionOptions,
  contextFactorOptions,
  emptyMonthlyReview,
  lifeAreaOptions,
  lifeEventTypeOptions,
  resultAreaOptions,
  type MonthlyReview,
} from '../types';

const store = useAppStore();
const anchor = ref(todayKey());
const start = computed(() => startOfMonth(anchor.value));
const end = computed(() => endOfMonth(anchor.value));
const archiveEnd = computed(() => (end.value > todayKey() ? todayKey() : end.value));
const entries = computed(() => entriesForMonth(store.dailyEntries, anchor.value));
const externalCareerIds = computed(() => [
  'external',
  'interview',
  'result',
  ...store.settings.customCareerOptions.filter((option) => option.countsAsExternal).map((option) => option.id),
]);
const summary = computed(() => summarize(entries.value, externalCareerIds.value));
const contextFactorItems = computed(() => [...contextFactorOptions, ...store.settings.customContextFactorOptions]);
const observations = computed(() => buildObservations(entries.value, contextFactorItems.value));
const factors = computed(() => factorSummaries(entries.value, contextFactorItems.value));
const results = computed(() => resultsForPeriod(store.results, start.value, end.value));
const displayedResults = computed(() => results.value.slice(0, 3));
const lifeEvents = computed(() =>
  store.lifeEvents.filter((event) => event.date >= start.value && event.date <= end.value).sort((a, b) => b.date.localeCompare(a.date)),
);
const displayedLifeEvents = computed(() => lifeEvents.value.slice(0, 3));
const reviewCues = computed(() =>
  buildReviewCues('month', entries.value, results.value, lifeEvents.value, externalCareerIds.value, contextFactorItems.value),
);
const reviewQuestions = buildReviewQuestions('month');
const hasSavedReview = computed(() => Boolean(store.reviewByMonth(start.value)));
const reviewAvailable = computed(
  () =>
    hasSavedReview.value || end.value < todayKey() || (start.value === startOfMonth(todayKey()) && todayKey() >= addDays(end.value, -2)),
);
const monthDates = computed(() => dateRange(start.value, end.value));
const chartDates = computed(() => monthDates.value.filter((date) => date <= todayKey()));
const entriesByDate = computed(() => new Map(entries.value.map((entry) => [entry.date, entry])));
const sleepEntries = computed(() =>
  [...entries.value]
    .filter((entry) => entry.specialDay === null && entry.sleepMinutes !== null)
    .sort((a, b) => a.date.localeCompare(b.date)),
);
const weightEntries = computed(() =>
  entries.value
    .filter((entry) => entry.date <= todayKey() && entry.specialDay === null && entry.weightKg !== null)
    .sort((a, b) => a.date.localeCompare(b.date)),
);
const sleepEnergyOption = computed<EChartsCoreOption>(() => {
  const rows = chartDates.value.map((date) => {
    const entry = entriesByDate.value.get(date);
    return { date, entry: entry?.specialDay === null ? entry : undefined };
  });
  return {
    color: ['#7467e8', '#b8c8c2', '#2eaa7f'],
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => formatSleepTooltip(params),
    },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#657085', fontSize: 12 } },
    grid: { left: 46, right: 42, top: 42, bottom: 34 },
    xAxis: {
      type: 'category',
      data: rows.map((row) => formatDate(row.date, { day: 'numeric' })),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dfe4ed' } },
      axisLabel: { color: '#7d8798' },
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: 12,
        interval: 3,
        axisLabel: { formatter: '{value}ч', color: '#7d8798' },
        splitLine: { lineStyle: { color: '#edf1f6' } },
      },
      { type: 'value', min: 1, max: 5, interval: 1, axisLabel: { color: '#7d8798' }, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'Сон',
        type: 'bar',
        data: rows.map((row) => minutesToHours(row.entry?.sleepMinutes ?? null)),
        barMaxWidth: 16,
        itemStyle: { borderRadius: [7, 7, 2, 2] },
      },
      {
        name: 'В кровати',
        type: 'bar',
        data: rows.map((row) => minutesToHours(row.entry?.timeInBedMinutes ?? null)),
        barMaxWidth: 16,
        itemStyle: { borderRadius: [7, 7, 2, 2] },
      },
      {
        name: 'Энергия',
        type: 'line',
        yAxisIndex: 1,
        data: rows.map((row) => row.entry?.energy ?? null),
        smooth: false,
        symbolSize: 8,
        connectNulls: false,
        lineStyle: { width: 3 },
      },
    ],
  };
});
const weightOption = computed<EChartsCoreOption>(() => {
  const rows = buildWeightSeries(monthDates.value, store.dailyEntries, todayKey());
  return {
    color: ['#d9952f', '#1d5148'],
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#657085', fontSize: 12 } },
    grid: { left: 52, right: 24, top: 42, bottom: 34 },
    xAxis: {
      type: 'category',
      data: rows.map((row) => formatDate(row.date, { day: 'numeric' })),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dfe4ed' } },
      axisLabel: { color: '#7d8798' },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { formatter: '{value}кг', color: '#7d8798' },
      splitLine: { lineStyle: { color: '#edf1f6' } },
    },
    series: [
      { name: 'измерение', type: 'line', symbolSize: 7, data: rows.map((row) => row.weight), lineStyle: { width: 1, opacity: 0.4 } },
      {
        name: 'среднее за 7 дней',
        type: 'line',
        symbolSize: 8,
        data: rows.map((row) => row.rolling),
        connectNulls: false,
        lineStyle: { width: 3 },
      },
    ],
  };
});
const contextNotes = computed(() => entries.value.filter((entry) => entry.contextNote.trim()).sort((a, b) => b.date.localeCompare(a.date)));
const actionNotes = computed(() =>
  entries.value.filter((entry) => entry.actionDirection !== null).sort((a, b) => b.date.localeCompare(a.date)),
);
const specialDays = computed(() => entries.value.filter((entry) => entry.specialDay !== null).sort((a, b) => b.date.localeCompare(a.date)));
const contextEntries = computed(() =>
  entries.value.filter((entry) => entry.contextNote.trim() || entry.specialDay !== null).sort((a, b) => b.date.localeCompare(a.date)),
);
const actionPage = ref(1);
const contextPage = ref(1);
const recordPageSize = 7;
const visibleActionNotes = computed(() => pageItems(actionNotes.value, actionPage.value, recordPageSize));
const actionPageCount = computed(() => pageCount(actionNotes.value.length, recordPageSize));
const visibleContextEntries = computed(() => pageItems(contextEntries.value, contextPage.value, recordPageSize));
const contextPageCount = computed(() => pageCount(contextEntries.value.length, recordPageSize));
const actionDirectionSummary = computed(() =>
  actionDirectionOptions
    .map((option) => ({ ...option, count: actionNotes.value.filter((entry) => entry.actionDirection === option.id).length }))
    .filter((option) => option.count > 0),
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
const lifeAreaItems = computed(() => [...lifeAreaOptions, ...store.settings.customLifeAreaOptions]);
const activeAreas = computed(() => lifeAreaItems.value.filter((option) => store.settings.activeLifeAreas.includes(option.id)));
const monthCalendarDays = computed(() => {
  const leadingDays = (fromDateKey(start.value).getDay() || 7) - 1;
  const blanks = Array.from({ length: leadingDays }, (_, index) => ({ id: `blank-${index}`, date: '', blank: true as const }));
  const monthDays = dateRange(start.value, end.value).map((date) => {
    const entry = entriesByDate.value.get(date);
    return {
      id: date,
      date,
      blank: false as const,
      entry,
      energyLevel: energyLevel(entry?.energy ?? null),
      hasShortSleep: entry?.sleepMinutes !== null && entry?.sleepMinutes !== undefined && entry.sleepMinutes < 420,
      hasMovement: Boolean(entry?.activities.some((activity) => activity !== 'recovery')),
      hasCareer: entry ? careerStatesForEntry(entry).length > 0 : false,
      hasExternalAction: entry?.actionDirection === 'external',
      hasDrift: entry?.actionDirection === 'drift',
      hasNutritionSupport: entry?.nutritionState === 'supports_goal',
      hasNutritionBlock: entry?.nutritionState === 'blocks_goal',
      title: entry
        ? `${formatDate(date)} · сон ${formatMinutes(entry.sleepMinutes)} · энергия ${entry.energy ?? '—'}${entry.actionDirection ? ` · ${actionDirectionLabel(entry.actionDirection)}` : ''}${entry.nutritionState ? ` · питание ${nutritionText(entry.nutritionState)}` : ''}${entry.weightKg ? ` · вес ${entry.weightKg} кг` : ''}`
        : `${formatDate(date)} · записи нет`,
    };
  });
  return [...blanks, ...monthDays];
});
const monthWeekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const review = reactive<MonthlyReview>(emptyMonthlyReview(start.value));

function loadReview() {
  const existing = store.reviewByMonth(start.value);
  Object.assign(review, emptyMonthlyReview(start.value), existing ? plainCopy(existing) : {});
  actionPage.value = 1;
  contextPage.value = 1;
}

watch(start, loadReview, { immediate: true });
watch(actionPageCount, (count) => {
  actionPage.value = Math.min(actionPage.value, count);
});
watch(contextPageCount, (count) => {
  contextPage.value = Math.min(contextPage.value, count);
});

async function saveReview() {
  await store.saveMonthlyReview(plainCopy(review));
  notifySaved('Итог месяца сохранён');
}

function createPackage() {
  return buildPeriodPackage('month', anchor.value, {
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
    notifyInfo('Данные месяца скачаны');
  } catch (error) {
    notifyUnknownError(error, 'Не удалось скачать данные месяца');
  }
}

function energyLevel(value: number | null): 'empty' | 'low' | 'mid' | 'high' {
  if (value === null) return 'empty';
  if (value <= 2) return 'low';
  if (value <= 3) return 'mid';
  return 'high';
}

function nutritionText(value: string): string {
  if (value === 'supports_goal') return 'поддержало цель';
  if (value === 'blocks_goal') return 'мешало цели';
  return 'нейтрально';
}

function minutesToHours(value: number | null): number | null {
  return value === null ? null : Math.round((value / 60) * 10) / 10;
}

function factorSleepText(factor: (typeof factors.value)[number]): string {
  if (factor.averageSleep === null) return '—';
  const withFactor = `${formatMinutes(Math.round(factor.averageSleep))} · ${factor.sleepSamples} дн.`;
  const withoutFactor =
    factor.averageSleepWithout === null
      ? '—'
      : `${formatMinutes(Math.round(factor.averageSleepWithout))} · ${factor.sleepSamplesWithout} дн.`;
  return `${withFactor} / ${withoutFactor}`;
}

function factorEnergyText(factor: (typeof factors.value)[number]): string {
  if (factor.averageEnergy === null) return '—';
  const withFactor = `${factor.averageEnergy.toFixed(1).replace('.0', '')} · ${factor.energySamples} дн.`;
  const withoutFactor =
    factor.averageEnergyWithout === null
      ? '—'
      : `${factor.averageEnergyWithout.toFixed(1).replace('.0', '')} · ${factor.energySamplesWithout} дн.`;
  return `${withFactor} / ${withoutFactor}`;
}

function sleepRegularityText(): string {
  const variation = Math.max(summary.value.bedtimeVariationMinutes ?? 0, summary.value.wakeTimeVariationMinutes ?? 0);
  if (summary.value.sleepTimingSamples < 2) return `${summary.value.sleepSamples} ночей с длительностью`;
  return `${summary.value.sleepTimingSamples} ночей со временем · разброс около ${variation} мин.`;
}

function formatSleepTooltip(params: unknown): string {
  const items = Array.isArray(params) ? params : [];
  const first = items[0] as { axisValue?: string } | undefined;
  const lines = items.map((item) => {
    const typed = item as { marker?: string; seriesName?: string; data?: number | null };
    const value = typed.seriesName === 'Энергия' ? `${typed.data ?? '—'}/5` : typed.data === null ? '—' : `${typed.data} ч`;
    return `${typed.marker ?? ''}${typed.seriesName}: ${value}`;
  });
  return [`День ${first?.axisValue ?? ''}`, ...lines].join('<br />');
}

function shiftMonth(offset: number) {
  const date = fromDateKey(anchor.value);
  date.setMonth(date.getMonth() + offset, 1);
  anchor.value = toDateKey(date);
}
</script>

<template>
  <section class="page page--review page--month">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Месячная сводка</span>
        <h1>Месяц</h1>
        <p>Сравните недели, важные события и результаты. Решите, что продолжить или изменить.</p>
      </div>
      <a v-if="summary.coveredEntriesCount > 0" class="review-jump" href="#month-review"
        >{{ reviewAvailable ? 'К итогу' : 'Итог позже' }} <span aria-hidden="true">↓</span></a
      >
    </div>
    <PeriodNavigator
      :title="formatDate(start, { month: 'long', year: 'numeric' })"
      :subtitle="start === startOfMonth(todayKey()) ? 'Текущий месяц' : ''"
      @previous="shiftMonth(-1)"
      @next="shiftMonth(1)"
      @current="anchor = todayKey()"
    />

    <section v-if="summary.coveredEntriesCount === 0" class="period-empty-guide">
      <strong>За этот месяц пока нет записей</strong>
      <p>Данные появятся здесь после ежедневных записей. Итоги и важные события из Журнала тоже войдут в обзор месяца.</p>
      <RouterLink class="secondary-button" to="/">Перейти к записи за день</RouterLink>
    </section>

    <template v-else>
      <div class="metrics-grid">
        <MetricCard
          label="Заполненных дней"
          :value="summary.coveredEntriesCount"
          :hint="`${summary.ordinaryCoreEntriesCount} с основными полями`"
          accent="#1d5148"
        />
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
          accent="#2eaa7f"
        />
        <MetricCard
          label="Питание"
          :value="`${summary.nutritionSupportDays}/${summary.nutritionBlockDays}`"
          :hint="
            summary.averageWeightKg === null
              ? `${summary.nutritionSamples} дн. с отметкой`
              : `вес ${summary.averageWeightKg.toFixed(1).replace('.0', '')} кг · ${summary.weightSamples} изм.`
          "
          accent="#d9952f"
        />
        <MetricCard label="Особых дней" :value="summary.specialDays" :hint="`${results.length} итогов`" accent="#eb7458" />
      </div>

      <details class="period-details">
        <summary>Показать календарь месяца</summary>
        <div class="period-details__content">
          <article class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Карта месяца</span>
                <h2>Энергия, сон и контекст по дням</h2>
              </div>
            </div>
            <div class="month-calendar">
              <div v-for="weekday in monthWeekdays" :key="weekday" class="month-calendar__head">{{ weekday }}</div>
              <article
                v-for="day in monthCalendarDays"
                :key="day.id"
                class="month-day"
                :class="
                  day.blank
                    ? 'month-day--blank'
                    : [
                        `month-day--${day.energyLevel}`,
                        { 'month-day--short-sleep': day.hasShortSleep, 'month-day--special': day.entry?.specialDay },
                      ]
                "
                :title="day.blank ? '' : day.title"
              >
                <template v-if="!day.blank">
                  <strong>{{ formatDate(day.date, { day: 'numeric' }) }}</strong>
                  <span v-if="day.entry?.energy" class="month-day__energy">{{ day.entry.energy }}/5</span>
                  <div class="month-day__marks">
                    <i v-if="day.hasCareer" class="legend-dot legend-dot--career"></i>
                    <i v-if="day.hasExternalAction" class="legend-dot legend-dot--direction"></i>
                    <i v-if="day.hasDrift" class="legend-dot legend-dot--drift"></i>
                    <i v-if="day.hasMovement" class="legend-dot legend-dot--movement"></i>
                    <i v-if="day.hasNutritionSupport" class="legend-dot legend-dot--nutrition"></i>
                    <i v-if="day.hasNutritionBlock" class="legend-dot legend-dot--nutrition-block"></i>
                    <i v-if="day.entry?.specialDay" class="legend-dot legend-dot--special"></i>
                  </div>
                </template>
              </article>
            </div>
            <div class="chart-legend">
              <span><i class="legend-dot legend-dot--energy-low"></i>низкая энергия</span>
              <span><i class="legend-dot legend-dot--energy-high"></i>высокая энергия</span>
              <span><i class="legend-dot legend-dot--career"></i>работа</span>
              <span><i class="legend-dot legend-dot--direction"></i>шаг к цели</span>
              <span><i class="legend-dot legend-dot--drift"></i>в сторону</span>
              <span><i class="legend-dot legend-dot--movement"></i>физическая активность</span>
              <span><i class="legend-dot legend-dot--nutrition"></i>питание поддержало</span>
              <span><i class="legend-dot legend-dot--nutrition-block"></i>питание мешало</span>
              <span><i class="legend-dot legend-dot--special"></i>особый день</span>
            </div>
          </article>
        </div>
      </details>

      <article v-if="reviewAvailable" id="month-review" class="review-card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Сохранить вывод</span>
            <h2>Итог месяца</h2>
          </div>
          <small>{{ formatDate(end, { day: 'numeric', month: 'long' }) }}</small>
        </div>
        <label class="field-label">Что чаще всего повторялось?</label
        ><textarea v-model="review.mainPattern" rows="2" placeholder="Повторяющееся действие, состояние или условие"></textarea>
        <label class="field-label">Что поддерживало?</label
        ><textarea v-model="review.support" rows="2" placeholder="Условия, решения или люди, которые помогали"></textarea>
        <label class="field-label">Что мешало сильнее всего?</label
        ><textarea v-model="review.obstacle" rows="2" placeholder="Один главный повторяющийся фактор"></textarea>
        <label class="field-label">Что изменило месяц?</label
        ><textarea
          v-model="review.courseChange"
          rows="2"
          placeholder="Событие, решение или итог, после которого данные стали выглядеть иначе"
        ></textarea>
        <label class="field-label">Главное направление следующего месяца</label
        ><textarea v-model="review.nextFocus" rows="2" placeholder="Что стоит продолжить, изменить или проверить"></textarea>
        <button class="primary-button" type="button" @click="saveReview">Сохранить итог месяца</button>
      </article>
      <section v-else id="month-review" class="period-review-note">
        <strong>Итог появится ближе к концу месяца</strong>
        <p>Его можно пропустить — дневные записи и сводка месяца останутся на месте.</p>
      </section>

      <article class="dashboard-card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Короткий разбор</span>
            <h2>Месячный обзор</h2>
          </div>
          <div class="period-actions">
            <button class="secondary-button" type="button" @click="copyPrompt">Скопировать промпт</button>
            <button class="secondary-button" type="button" @click="downloadJson">Скачать данные</button>
          </div>
        </div>
        <div class="review-cue-grid">
          <article v-for="cue in reviewCues" :key="cue.id" class="review-cue" :class="`review-cue--${cue.tone}`">
            <strong>{{ cue.title }}</strong>
            <p>{{ cue.text }}</p>
          </article>
        </div>
        <ol class="review-question-list">
          <li v-for="question in reviewQuestions" :key="question">{{ question }}</li>
        </ol>
      </article>

      <article v-if="observations.length" class="dashboard-card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Автоматические наблюдения</span>
            <h2>Что видно по данным</h2>
          </div>
        </div>
        <div class="observation-grid">
          <article v-for="observation in observations.slice(0, 3)" :key="observation.id" class="observation-card">
            <strong>{{ observation.title }}</strong>
            <p>{{ observation.text }}</p>
          </article>
        </div>
      </article>

      <details class="period-details">
        <summary>Показать графики месяца</summary>
        <div class="period-details__content">
          <article class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Сон обычных дней</span>
                <h2>Динамика сна</h2>
              </div>
              <small>{{ sleepRegularityText() }}</small>
            </div>
            <EChartPanel
              v-if="sleepEntries.length"
              :option="sleepEnergyOption"
              :height="320"
              aria-label="Динамика сна, времени в кровати и энергии"
            />
            <div v-else class="empty-chart">Добавьте данные о сне — здесь будет видно, как он менялся.</div>
          </article>

          <article v-if="weightEntries.length" class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Вес</span>
                <h2>Измерения и семидневный тренд</h2>
              </div>
              <small>данные по {{ formatDate(chartDates.at(-1) || end, { day: 'numeric', month: 'short' }) }} · особые дни исключены</small>
            </div>
            <EChartPanel :option="weightOption" :height="280" aria-label="Вес и среднее значение за семь дней" />
          </article>

          <article v-if="factors.length" class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Факторы состояния</span>
                <h2>Что повторялось в течение дня</h2>
              </div>
              <span class="count-badge">{{ factors.length }}</span>
            </div>
            <div class="factor-summary-head"><span>фактор</span><span>дни</span><span>сон: с / без</span><span>энергия: с / без</span></div>
            <div class="factor-summary-list">
              <article v-for="factor in factors" :key="factor.id" class="factor-summary-item">
                <span class="factor-summary-item__name"
                  ><i>{{ factor.icon }}</i
                  >{{ factor.label }}</span
                >
                <strong>{{ factor.count }}</strong>
                <small>{{ factorSleepText(factor) }}</small>
                <small>{{ factorEnergyText(factor) }}</small>
              </article>
            </div>
          </article>

          <article class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Сколько дней появлялось</span>
                <h2>Области жизни</h2>
              </div>
            </div>
            <div class="coverage-list">
              <div v-for="area in activeAreas" :key="area.id" class="coverage-row">
                <span class="coverage-row__label"
                  ><i>{{ area.icon }}</i
                  >{{ area.label }}</span
                >
                <div class="coverage-row__track">
                  <span
                    :style="{
                      width: `${summary.lifeAreaSamples ? ((summary.areaCounts[area.id] ?? 0) / summary.lifeAreaSamples) * 100 : 0}%`,
                    }"
                  ></span>
                </div>
                <strong>{{ summary.areaCounts[area.id] ?? 0 }}/{{ summary.lifeAreaSamples }}</strong>
              </div>
            </div>
          </article>
        </div>
      </details>

      <details class="period-details period-records">
        <summary>Показать записи месяца</summary>
        <div class="period-details__content period-records__content">
          <article v-if="results.length" class="period-record-card">
            <div class="period-record-card__heading">
              <div>
                <span class="eyebrow">Завершённые факты</span>
                <h2>Итоги месяца</h2>
              </div>
              <span class="count-badge">{{ results.length }}</span>
            </div>
            <div class="period-record-card__breakdown" aria-label="Итоги по областям">
              <span v-for="area in resultAreaSummary" :key="area.id">{{ area.icon }} {{ area.label }} · {{ area.count }}</span>
            </div>
            <ul class="period-record-preview">
              <li v-for="result in displayedResults" :key="result.id ?? result.createdAt">
                <span>✓</span>
                <div>
                  {{ result.title }}<small>{{ formatDate(result.date, { day: 'numeric', month: 'short' }) }}</small>
                </div>
              </li>
            </ul>
            <RouterLink class="secondary-button period-record-card__link" :to="`/results?from=${start}&to=${archiveEnd}`">
              Открыть все итоги
            </RouterLink>
          </article>

          <details v-if="actionNotes.length" class="period-record-card period-record-card--disclosure">
            <summary>
              <span class="period-record-card__heading">
                <span><span class="eyebrow">Действия по цели</span><strong>Конкретные действия и подготовка</strong></span>
                <span class="count-badge">{{ actionNotes.length }}</span>
              </span>
              <span class="period-record-card__breakdown" aria-label="Действия по направлению">
                <span v-for="direction in actionDirectionSummary" :key="direction.id"
                  >{{ direction.icon }} {{ direction.label }} · {{ direction.count }}</span
                >
              </span>
            </summary>
            <div class="period-record-card__details">
              <div class="note-list note-list--columns">
                <article v-for="entry in visibleActionNotes" :key="entry.date" class="note-item">
                  <time>{{ formatDate(entry.date, { day: 'numeric', month: 'short' }) }}</time>
                  <p>
                    <strong>{{ actionDirectionLabel(entry.actionDirection) }}</strong
                    ><span v-if="entry.focusTitle"><br />Цель: {{ entry.focusTitle }}</span
                    ><span v-if="entry.actionNote"><br />{{ entry.actionNote }}</span>
                  </p>
                </article>
              </div>
              <ArchivePagination v-model:page="actionPage" :page-count="actionPageCount" context-label="действий месяца" />
            </div>
          </details>

          <article v-if="lifeEvents.length" class="period-record-card">
            <div class="period-record-card__heading">
              <div>
                <span class="eyebrow">Важный контекст</span>
                <h2>События месяца</h2>
              </div>
              <span class="count-badge">{{ lifeEvents.length }}</span>
            </div>
            <div class="period-record-card__breakdown" aria-label="События по типам">
              <span v-for="type in eventTypeSummary" :key="type.id">{{ type.icon }} {{ type.label }} · {{ type.count }}</span>
            </div>
            <ul class="period-record-preview">
              <li v-for="event in displayedLifeEvents" :key="event.id ?? event.createdAt">
                <span>{{ eventTypeSummary.find((type) => type.id === event.type)?.icon ?? '·' }}</span>
                <div>
                  {{ event.title }}<small>{{ formatDate(event.date, { day: 'numeric', month: 'short' }) }}</small>
                </div>
              </li>
            </ul>
            <RouterLink class="secondary-button period-record-card__link" :to="`/events?from=${start}&to=${archiveEnd}`">
              Открыть все события
            </RouterLink>
          </article>

          <details v-if="contextEntries.length" class="period-record-card period-record-card--disclosure">
            <summary>
              <span class="period-record-card__heading">
                <span><span class="eyebrow">Условия и исключения</span><strong>Контекст месяца</strong></span>
                <span class="count-badge">{{ contextEntries.length }}</span>
              </span>
              <span class="period-record-card__breakdown">
                <span>Заметок: {{ contextNotes.length }}</span
                ><span>Особых дней: {{ specialDays.length }}</span>
              </span>
            </summary>
            <div class="period-record-card__details">
              <div class="note-list note-list--columns">
                <article v-for="entry in visibleContextEntries" :key="entry.date" class="note-item">
                  <time>{{ formatDate(entry.date, { day: 'numeric', month: 'short' }) }}</time>
                  <p>
                    <strong v-if="entry.specialDay">{{ specialDayLabel(entry.specialDay) }}</strong
                    ><span v-if="entry.specialDayNote"><br />{{ entry.specialDayNote }}</span
                    ><span v-if="entry.contextNote"><br />{{ entry.contextNote }}</span>
                  </p>
                </article>
              </div>
              <ArchivePagination v-model:page="contextPage" :page-count="contextPageCount" context-label="записей контекста" />
            </div>
          </details>
        </div>
      </details>
    </template>
  </section>
</template>
