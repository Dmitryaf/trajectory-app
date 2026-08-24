<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import type { EChartsCoreOption } from 'echarts/core';
import ArchivePagination from '@/features/journal/ui/ArchivePagination.vue';
import PeriodRecordCard from '@/features/reviews/ui/PeriodRecordCard.vue';
import PeriodAnalysisCard from '@/features/reviews/ui/PeriodAnalysisCard.vue';
import { usePeriodReview } from '@/features/reviews/usePeriodReview';
import EChartPanel from '@/shared/ui/charts/EChartPanel.vue';
import AutoGrowTextarea from '@/shared/ui/forms/AutoGrowTextarea.vue';
import PeriodNavigator from '@/shared/ui/navigation/PeriodNavigator.vue';
import { chartColors as c, chartStyles as s } from '@/shared/theme/colors';
import {
  actionDirectionLabel,
  buildObservations,
  buildReviewCues,
  entriesForMonth,
  resultsForPeriod,
  specialDayLabel,
  summarize,
} from '@/services/analytics';
import { addDays, dateRange, endOfMonth, formatDate, fromDateKey, startOfMonth, startOfWeek, todayKey, toDateKey } from '@/services/dates';
import { buildWeightSeries } from '@/features/analytics/weightSeries';
import { pageCount, pageItems } from '@/services/pagination';
import { useAppStore } from '@/stores/app';
import {
  actionDirectionOptions,
  contextFactorOptions,
  emptyMonthlyReview,
  externalCareerIdsForOptions,
  lifeAreaOptions,
  lifeEventTypeOptions,
  resultAreaOptions,
  type MonthlyReview,
} from '@/types';

const store = useAppStore();
const anchor = ref(todayKey());
const start = computed(() => startOfMonth(anchor.value));
const end = computed(() => endOfMonth(anchor.value));
const archiveEnd = computed(() => (end.value > todayKey() ? todayKey() : end.value));
const entries = computed(() => entriesForMonth(store.dailyEntries, anchor.value));
const externalCareerIds = computed(() => externalCareerIdsForOptions(store.settings.customCareerOptions));
const summary = computed(() => summarize(entries.value, externalCareerIds.value));
const contextFactorItems = computed(() => [...contextFactorOptions, ...store.settings.customContextFactorOptions]);
const observations = computed(() => buildObservations(entries.value, contextFactorItems.value));
const results = computed(() => resultsForPeriod(store.results, start.value, end.value));
const lifeEvents = computed(() =>
  store.lifeEvents.filter((event) => event.date >= start.value && event.date <= end.value).sort((a, b) => b.date.localeCompare(a.date)),
);
const reviewCues = computed(() =>
  buildReviewCues('month', entries.value, results.value, lifeEvents.value, externalCareerIds.value, contextFactorItems.value),
);
const primaryReviewCues = computed(() => reviewCues.value.slice(0, 3));
const additionalObservations = computed(() =>
  observations.value.filter((observation) => !['special-days', 'context-factor'].includes(observation.id)),
);
const hasDailyData = computed(() => summary.value.coveredEntriesCount > 0);
const hasJournalData = computed(() => results.value.length > 0 || lifeEvents.value.length > 0);
const hasPeriodData = computed(() => hasDailyData.value || hasJournalData.value || hasSavedReview.value);
const monthDates = computed(() => dateRange(start.value, end.value));
const chartDates = computed(() => monthDates.value.filter((date) => date <= todayKey()));
const monthWeekSummaries = computed(() =>
  [...new Set(chartDates.value.map((date) => startOfWeek(date)))]
    .map((weekStart) => {
      const rangeStart = weekStart < start.value ? start.value : weekStart;
      const naturalEnd = addDays(weekStart, 6);
      const rangeEnd = naturalEnd > archiveEnd.value ? archiveEnd.value : naturalEnd;
      const weekEntries = entries.value.filter((entry) => entry.date >= rangeStart && entry.date <= rangeEnd);
      const weekSummary = summarize(weekEntries, externalCareerIds.value);
      return {
        rangeStart,
        rangeEnd,
        summary: weekSummary,
        resultsCount: results.value.filter((result) => result.date >= rangeStart && result.date <= rangeEnd).length,
        eventsCount: lifeEvents.value.filter((event) => event.date >= rangeStart && event.date <= rangeEnd).length,
      };
    })
    .filter((week) => week.summary.coveredEntriesCount > 0),
);
const entriesByDate = computed(() => new Map(entries.value.map((entry) => [entry.date, entry])));
const sleepEntries = computed(() =>
  [...entries.value]
    .filter((entry) => entry.specialDay === null && entry.sleepMinutes !== null)
    .sort((a, b) => a.date.localeCompare(b.date)),
);
const energyEntries = computed(() =>
  [...entries.value].filter((entry) => entry.specialDay === null && entry.energy !== null).sort((a, b) => a.date.localeCompare(b.date)),
);
const weightEntries = computed(() =>
  entries.value
    .filter((entry) => entry.date <= todayKey() && entry.specialDay === null && entry.weightKg !== null)
    .sort((a, b) => a.date.localeCompare(b.date)),
);
type MonthMetricId = 'sleep' | 'energy' | 'weight';
const selectedMonthMetric = ref<MonthMetricId>('sleep');
const monthMetricOptions = computed(() =>
  [
    { id: 'sleep' as const, label: 'Сон', samples: sleepEntries.value.length, available: sleepEntries.value.length >= 4 },
    { id: 'energy' as const, label: 'Энергия', samples: energyEntries.value.length, available: energyEntries.value.length >= 4 },
    { id: 'weight' as const, label: 'Вес', samples: weightEntries.value.length, available: weightEntries.value.length > 0 },
  ].filter((option) => option.available),
);
watch(
  monthMetricOptions,
  (options) => {
    if (!options.some((option) => option.id === selectedMonthMetric.value) && options[0]) {
      selectedMonthMetric.value = options[0].id;
    }
  },
  { immediate: true },
);
const sleepOption = computed<EChartsCoreOption>(() => {
  const rows = chartDates.value.map((date) => {
    const entry = entriesByDate.value.get(date);
    return { date, entry: entry?.specialDay === null ? entry : undefined };
  });
  return {
    color: [c.sleep],
    tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${value} ч` },
    grid: { left: 46, right: 24, top: 20, bottom: 34 },
    xAxis: {
      type: 'category',
      data: rows.map((row) => formatDate(row.date, { day: 'numeric' })),
      axisTick: { show: false },
      axisLine: { lineStyle: s.axisLine },
      axisLabel: s.axisLabel,
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 12,
      interval: 3,
      axisLabel: { formatter: '{value}ч', color: c.axis },
      splitLine: { lineStyle: s.splitLine },
    },
    series: [
      {
        name: 'Сон',
        type: 'line',
        data: rows.map((row) => minutesToHours(row.entry?.sleepMinutes ?? null)),
        symbolSize: 8,
        connectNulls: false,
        lineStyle: { width: 3 },
      },
    ],
  };
});
const energyOption = computed<EChartsCoreOption>(() => ({
  color: [c.energy],
  tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${value}/5` },
  grid: { left: 42, right: 24, top: 20, bottom: 34 },
  xAxis: {
    type: 'category',
    data: chartDates.value.map((date) => formatDate(date, { day: 'numeric' })),
    axisTick: { show: false },
    axisLine: { lineStyle: s.axisLine },
    axisLabel: s.axisLabel,
  },
  yAxis: {
    type: 'value',
    min: 1,
    max: 5,
    interval: 1,
    axisLabel: s.axisLabel,
    splitLine: { lineStyle: s.splitLine },
  },
  series: [
    {
      name: 'Энергия',
      type: 'line',
      data: chartDates.value.map((date) => {
        const entry = entriesByDate.value.get(date);
        return entry?.specialDay === null ? entry.energy : null;
      }),
      symbolSize: 8,
      connectNulls: false,
      lineStyle: { width: 3 },
    },
  ],
}));
const weightOption = computed<EChartsCoreOption>(() => {
  const rows = buildWeightSeries(monthDates.value, store.dailyEntries, todayKey());
  const rollingSeries = rows.some((row) => row.rolling !== null)
    ? [
        {
          name: 'среднее за 7 дней',
          type: 'line',
          symbolSize: 8,
          data: rows.map((row) => row.rolling),
          connectNulls: false,
          lineStyle: { width: 3 },
        },
      ]
    : [];
  return {
    color: [c.weight, c.deepGreen],
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: c.legend, fontSize: 12 } },
    grid: { left: 52, right: 24, top: 42, bottom: 34 },
    xAxis: {
      type: 'category',
      data: rows.map((row) => formatDate(row.date, { day: 'numeric' })),
      axisTick: { show: false },
      axisLine: { lineStyle: s.axisLine },
      axisLabel: s.axisLabel,
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { formatter: '{value}кг', color: c.axis },
      splitLine: { lineStyle: s.splitLine },
    },
    series: [
      { name: 'измерение', type: 'line', symbolSize: 7, data: rows.map((row) => row.weight), lineStyle: { width: 1, opacity: 0.4 } },
      ...rollingSeries,
    ],
  };
});
const monthMetricOption = computed(() => {
  if (selectedMonthMetric.value === 'weight') {
    return weightOption.value;
  }
  if (selectedMonthMetric.value === 'energy') {
    return energyOption.value;
  }
  return sleepOption.value;
});
const selectedMonthMetricInfo = computed(() => monthMetricOptions.value.find((option) => option.id === selectedMonthMetric.value));
const monthMetricDescription = computed(() => {
  const metric = selectedMonthMetric.value;
  const rows = {
    energy: energyEntries.value,
    sleep: sleepEntries.value,
    weight: weightEntries.value,
  }[metric];
  const values = rows.map((entry) => {
    const date = formatDate(entry.date, { day: 'numeric', month: 'short' });
    if (metric === 'sleep') {
      return `${date}: ${minutesToHours(entry.sleepMinutes)} ч`;
    }
    if (metric === 'energy') {
      return `${date}: ${entry.energy}/5`;
    }
    return `${date}: ${entry.weightKg} кг`;
  });
  return `${selectedMonthMetricInfo.value?.label ?? 'Показатель'}: ${rows.length} наблюдений. ${values.join('; ')}. Особые дни исключены, пропуски не заполняются.`;
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
const resultRecordItems = computed(() =>
  results.value.map((result) => ({
    id: result.id ?? result.createdAt,
    icon: resultAreaItems.value.find((option) => option.id === result.area)?.icon ?? '·',
    title: result.title,
    dateLabel: formatDate(result.date, { day: 'numeric', month: 'short' }),
  })),
);
const eventRecordItems = computed(() =>
  lifeEvents.value.map((event) => ({
    id: event.id ?? event.createdAt,
    icon: lifeEventTypeOptions.find((option) => option.id === event.type)?.icon ?? '·',
    title: event.title,
    dateLabel: formatDate(event.date, { day: 'numeric', month: 'short' }),
  })),
);
const lifeAreaItems = computed(() => [...lifeAreaOptions, ...store.settings.customLifeAreaOptions]);
const activeAreas = computed(() => lifeAreaItems.value.filter((option) => store.settings.activeLifeAreas.includes(option.id)));
const {
  copyPrompt,
  downloadJson,
  hasSavedReview,
  promptCopying,
  review,
  reviewAvailable,
  reviewContextOpen,
  reviewHasContext,
  reviewSaving,
  saveReview,
  updateReviewContextOpen,
} = usePeriodReview<MonthlyReview>({
  period: 'month',
  anchor,
  start,
  end,
  emptyReview: emptyMonthlyReview,
  findReview: (monthStart) => store.reviewByMonth(monthStart),
  persistReview: (draft) => store.saveMonthlyReview(draft),
  hasContext: (draft) => Boolean(draft.mainPattern.trim() || draft.support.trim() || draft.obstacle.trim() || draft.courseChange.trim()),
  afterLoad: () => {
    actionPage.value = 1;
    contextPage.value = 1;
  },
});
watch(actionPageCount, (count) => {
  actionPage.value = Math.min(actionPage.value, count);
});
watch(contextPageCount, (count) => {
  contextPage.value = Math.min(contextPage.value, count);
});

function minutesToHours(value: number | null): number | null {
  return value === null ? null : Math.round((value / 60) * 10) / 10;
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
      <a v-if="hasPeriodData" class="review-jump" href="#month-review"
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

    <section v-if="!hasPeriodData" class="period-empty-guide">
      <strong>За этот месяц пока нет записей</strong>
      <p>Данные появятся здесь после ежедневных записей. Итоги и важные события из Журнала тоже войдут в обзор месяца.</p>
      <RouterLink class="secondary-button" to="/">Перейти к записи за день</RouterLink>
    </section>

    <template v-else>
      <section v-if="!hasDailyData" class="period-review-note period-data-guide">
        <strong>За этот месяц нет дневных записей</strong>
        <p>Итоги, события и сохранённый обзор показаны ниже. Данных для сравнения дней и построения графиков пока нет.</p>
      </section>

      <article v-if="hasDailyData" class="dashboard-card month-week-overview">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Недели месяца</span>
            <h2>Как менялись записи</h2>
          </div>
          <span class="count-badge">{{ summary.coveredEntriesCount }} дн.</span>
        </div>
        <div v-if="monthWeekSummaries.length >= 2" class="month-week-story">
          <article v-for="week in monthWeekSummaries" :key="week.rangeStart">
            <strong>
              {{ formatDate(week.rangeStart, { day: 'numeric', month: 'short' }) }}–{{
                formatDate(week.rangeEnd, { day: 'numeric', month: 'short' })
              }}
            </strong>
            <span>{{ week.summary.coveredEntriesCount }} дн. с записями</span>
            <span v-if="week.resultsCount">Итогов: {{ week.resultsCount }}</span>
            <span v-if="week.eventsCount">Событий: {{ week.eventsCount }}</span>
            <span v-if="week.summary.specialDays">Особых дней: {{ week.summary.specialDays }}</span>
          </article>
        </div>
        <div v-else class="period-review-note">
          <strong>Для сравнения нужны записи хотя бы за две недели</strong>
          <p>Сейчас данные есть только в одной части месяца. Подробности уже доступны ниже.</p>
        </div>
      </article>

      <section v-if="hasJournalData" class="period-records period-records--featured">
        <PeriodRecordCard
          v-if="results.length"
          eyebrow="Завершённые факты"
          title="Итоги месяца"
          :items="resultRecordItems"
          :breakdown="resultAreaSummary"
          breakdown-label="Итоги по областям"
          pagination-label="итогов месяца"
        />
        <PeriodRecordCard
          v-if="lifeEvents.length"
          eyebrow="Важный контекст"
          title="События месяца"
          :items="eventRecordItems"
          :breakdown="eventTypeSummary"
          breakdown-label="События по типам"
          pagination-label="событий месяца"
        />
      </section>

      <article v-if="reviewAvailable" id="month-review" class="review-card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Сохранить вывод</span>
            <h2>Итог месяца</h2>
          </div>
          <small>{{ formatDate(end, { day: 'numeric', month: 'long' }) }}</small>
        </div>
        <details class="period-details month-review-context" :open="reviewContextOpen" @toggle="updateReviewContextOpen">
          <summary>{{ reviewHasContext ? 'Разбор месяца' : 'Добавить разбор месяца' }}</summary>
          <div class="period-details__content">
            <label class="field-label">Что чаще всего повторялось?</label
            ><AutoGrowTextarea v-model="review.mainPattern" :rows="2" placeholder="Повторяющееся действие, состояние или условие" />
            <label class="field-label">Что поддерживало?</label
            ><AutoGrowTextarea v-model="review.support" :rows="2" placeholder="Условия, решения или люди, которые помогали" />
            <label class="field-label">Что мешало сильнее всего?</label
            ><AutoGrowTextarea v-model="review.obstacle" :rows="2" placeholder="Один главный повторяющийся фактор" />
            <label class="field-label">Что изменило месяц?</label
            ><AutoGrowTextarea
              v-model="review.courseChange"
              :rows="2"
              placeholder="Событие, решение или итог, после которого данные стали выглядеть иначе"
            />
          </div>
        </details>
        <label class="field-label">Главное направление следующего месяца</label
        ><AutoGrowTextarea v-model="review.nextFocus" :rows="2" placeholder="Что стоит продолжить, изменить или проверить" />
        <button class="primary-button" type="button" :disabled="reviewSaving" @click="saveReview">
          {{ reviewSaving ? 'Сохраняю…' : 'Сохранить итог месяца' }}
        </button>
      </article>
      <section v-else id="month-review" class="period-review-note">
        <strong>Итог появится ближе к концу месяца</strong>
        <p>Его можно пропустить — дневные записи и сводка месяца останутся на месте.</p>
      </section>

      <PeriodAnalysisCard
        v-if="hasDailyData || hasJournalData"
        title="Месячный обзор"
        :cues="primaryReviewCues"
        :copying="promptCopying"
        @copy="copyPrompt"
        @download="downloadJson"
      />

      <details v-if="hasDailyData" class="period-details month-analysis-details">
        <summary>Показать выбранный показатель и подробный разбор</summary>
        <div class="period-details__content">
          <article v-if="additionalObservations.length" class="dashboard-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Сопоставление записей</span>
                <h2>Что ещё видно по данным</h2>
              </div>
            </div>
            <div class="observation-grid">
              <article v-for="observation in additionalObservations" :key="observation.id" class="observation-card">
                <strong>{{ observation.title }}</strong>
                <p>{{ observation.text }}</p>
              </article>
            </div>
          </article>

          <article v-if="monthMetricOptions.length" class="dashboard-card month-metric-card">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Один показатель за раз</span>
                <h2>{{ selectedMonthMetricInfo?.label }}</h2>
              </div>
              <small>{{ selectedMonthMetricInfo?.samples }} изм. · особые дни исключены</small>
            </div>
            <div class="metric-switcher" aria-label="Показатель графика">
              <button
                v-for="option in monthMetricOptions"
                :key="option.id"
                type="button"
                :class="{ active: selectedMonthMetric === option.id }"
                @click="selectedMonthMetric = option.id"
              >
                {{ option.label }}
              </button>
            </div>
            <EChartPanel
              :option="monthMetricOption"
              :height="280"
              :aria-label="`Динамика: ${selectedMonthMetricInfo?.label}`"
              :description="monthMetricDescription"
            />
          </article>
          <div v-else class="period-review-note month-chart-guide">
            <strong>Для графика пока мало данных</strong>
            <p>
              Нужны 4 обычных дня со сном или энергией либо 1 измерение веса. Сейчас: сон — {{ sleepEntries.length }}, энергия —
              {{ energyEntries.length }}, вес — {{ weightEntries.length }}.
            </p>
          </div>

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

      <details v-if="actionNotes.length || contextEntries.length" class="period-details period-records">
        <summary>Показать действия и дополнительный контекст</summary>
        <div class="period-details__content period-records__content">
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
