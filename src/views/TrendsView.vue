<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { EChartsCoreOption } from 'echarts/core';
import EChartPanel from '../components/charts/EChartPanel.vue';
import MetricCard from '../components/MetricCard.vue';
import { buildCoverageSeries, buildEventComparison, buildRangeReviewCues, entriesForPeriod, factorSummaries, ratioPercent, resultsForPeriod, summarize, type EventComparisonMetric } from '../services/analytics';
import { addMonths, dateRange, endOfMonth, endOfWeek, formatDate, formatMinutes, monthsBetween, startOfMonth, toDateKey, todayKey } from '../services/dates';
import { buildRangePackage, copyAiPrompt as copyPackagePrompt, downloadAiPackage } from '../services/exportPackage';
import { notifyInfo, notifySaved, notifyUnknownError } from '../services/notifications';
import { useAppStore } from '../stores/app';
import { eveningFactorOptions } from '../types';

type RangeMonths = 3 | 6 | 12;

const store = useAppStore();
const range = ref<RangeMonths>(3);
const selectedEventKey = ref('');
const eventPicker = ref<HTMLDetailsElement>();
const rangeOptions: Array<{ value: RangeMonths; label: string }> = [
  { value: 3, label: '3 месяца' },
  { value: 6, label: '6 месяцев' },
  { value: 12, label: '12 месяцев' },
];

const externalCareerIds = computed(() => ['external', 'interview', 'result', ...store.settings.customCareerOptions.filter((option) => option.countsAsExternal).map((option) => option.id)]);
const end = computed(() => todayKey());
const start = computed(() => startOfMonth(addMonths(todayKey(), -(range.value - 1))));
const entries = computed(() => entriesForPeriod(store.dailyEntries, start.value, end.value));
const eveningFactorItems = computed(() => [...eveningFactorOptions, ...store.settings.customEveningFactorOptions]);
const results = computed(() => resultsForPeriod(store.results, start.value, end.value));
const lifeEvents = computed(() => store.lifeEvents.filter((event) => event.date >= start.value && event.date <= end.value).sort((a, b) => b.date.localeCompare(a.date)));
const summary = computed(() => summarize(entries.value, externalCareerIds.value));
const factors = computed(() => factorSummaries(entries.value, eveningFactorItems.value).slice(0, 5));
const cues = computed(() => buildRangeReviewCues(range.value, entries.value, results.value, lifeEvents.value, externalCareerIds.value, eveningFactorItems.value));

function eventKey(event: (typeof store.lifeEvents)[number]): string {
  return `${event.date}|${event.createdAt}`;
}

watch(lifeEvents, (events) => {
  if (!events.some((event) => eventKey(event) === selectedEventKey.value)) {
    selectedEventKey.value = events[0] ? eventKey(events[0]) : '';
  }
}, { immediate: true });

const selectedEvent = computed(() => lifeEvents.value.find((event) => eventKey(event) === selectedEventKey.value) ?? null);
const eventComparison = computed(() => selectedEvent.value
  ? buildEventComparison(selectedEvent.value.date, store.dailyEntries, store.results, externalCareerIds.value, 14, end.value)
  : null);
const coverageSeries = computed(() => buildCoverageSeries(entries.value, start.value, end.value));

const monthRows = computed(() => monthsBetween(start.value, end.value).map((monthStart) => {
  const calendarEnd = endOfMonth(monthStart);
  const monthEnd = monthStart === startOfMonth(todayKey()) ? todayKey() : calendarEnd;
  const monthEntries = entriesForPeriod(entries.value, monthStart, monthEnd);
  const monthSummary = summarize(monthEntries, externalCareerIds.value);
  return {
    monthStart,
    label: `${formatDate(monthStart, { month: 'short' })}${monthStart === startOfMonth(todayKey()) ? '*' : ''}`,
    isPartial: monthStart === startOfMonth(todayKey()),
    expectedDays: dateRange(monthStart, monthEnd).length,
    summary: monthSummary,
    resultsCount: resultsForPeriod(results.value, monthStart, monthEnd).length,
    eventsCount: lifeEvents.value.filter((event) => event.date >= monthStart && event.date <= monthEnd).length,
  };
}));

const eventLines = computed(() => monthRows.value.flatMap((row) => {
  const events = lifeEvents.value.filter((event) => event.date.startsWith(row.monthStart.slice(0, 7)));
  return events.length ? [{
    name: events.map((event) => `${formatDate(event.date, { day: 'numeric', month: 'short' })}: ${event.title}`).join('\n'),
    value: events.length,
    xAxis: row.label,
  }] : [];
}));

const trendOverviewOption = computed<EChartsCoreOption>(() => ({
  color: ['#7467e8', '#2eaa7f'],
  tooltip: { trigger: 'axis' },
  legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#657085', fontSize: 12 } },
  grid: { left: 44, right: 44, top: 44, bottom: 34 },
  xAxis: {
    type: 'category',
    data: monthRows.value.map((row) => row.label),
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#dfe4ed' } },
    axisLabel: { color: '#7d8798' }
  },
  yAxis: [
    { type: 'value', min: 0, max: 12, axisLabel: { formatter: '{value}ч', color: '#7d8798' }, splitLine: { lineStyle: { color: '#edf1f6' } } },
    { type: 'value', min: 1, max: 5, interval: 1, axisLabel: { color: '#7d8798' }, splitLine: { show: false } }
  ],
  series: [
    {
      name: 'сон, ч',
      type: 'line',
      symbolSize: 8,
      data: monthRows.value.map((row) => minutesToHours(row.summary.averageSleep)),
      connectNulls: false,
      lineStyle: { width: 3 },
      markLine: {
        symbol: ['none', 'none'],
        lineStyle: { color: '#eb7458', type: 'dashed', width: 1.5 },
        label: { color: '#a94f3e', fontWeight: 750, formatter: (params: { value?: number }) => String(params.value ?? '') },
        tooltip: { formatter: (params: { data?: { name?: string } }) => params.data?.name ?? 'Важное событие' },
        data: eventLines.value,
      },
    },
    {
      name: 'энергия',
      type: 'line',
      yAxisIndex: 1,
      symbolSize: 8,
      data: monthRows.value.map((row) => roundValue(row.summary.averageEnergy)),
      connectNulls: false,
      lineStyle: { width: 3 },
    }
  ]
}));

const coverageOption = computed<EChartsCoreOption>(() => ({
  tooltip: {
    formatter: (params: { value?: [string, number] }) => {
      const date = params.value?.[0];
      const level = params.value?.[1] ?? 0;
      const label = level === 2 ? 'основные поля заполнены' : level === 1 ? 'заполнено частично' : 'записи нет';
      return date ? `${formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}<br>${label}` : label;
    },
  },
  visualMap: {
    type: 'piecewise',
    orient: 'horizontal',
    left: 18,
    top: 0,
    itemWidth: 13,
    itemHeight: 13,
    textStyle: { color: '#657085', fontSize: 11 },
    pieces: [
      { value: 0, label: 'нет записи', color: '#edf0f5' },
      { value: 1, label: 'частично', color: '#b8c8c2' },
      { value: 2, label: 'основные поля', color: '#2eaa7f' },
    ],
  },
  calendar: {
    range: [start.value, end.value],
    top: 52,
    left: 48,
    right: 18,
    bottom: 18,
    cellSize: ['auto', 15],
    splitLine: { show: true, lineStyle: { color: '#fff', width: 3 } },
    itemStyle: { borderWidth: 2, borderColor: '#fff' },
    yearLabel: { show: false },
    monthLabel: { color: '#657085', fontSize: 11, nameMap: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'] },
    dayLabel: { firstDay: 1, color: '#8a94a7', fontSize: 10, nameMap: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] },
  },
  series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: coverageSeries.value }],
}));

function savedDate(updatedAt: string, fallback: string): string {
  if (!updatedAt) return fallback;
  const date = new Date(updatedAt);
  return Number.isNaN(date.getTime()) ? fallback : toDateKey(date);
}

const decisionTimeline = computed(() => [
  ...lifeEvents.value.map((event) => ({ date: event.date, type: 'Событие', tone: 'event', title: event.title, detail: event.note })),
  ...results.value.map((result) => ({ date: result.date, type: 'Итог', tone: 'result', title: result.title, detail: '' })),
  ...store.weeklyReviews.flatMap((review) => {
    const date = savedDate(review.updatedAt, endOfWeek(review.weekStart));
    const items = [];
    if (review.nextLever || review.ifThenPlan) items.push({ date, type: 'Решение недели', tone: 'decision', title: review.nextLever || 'План недели', detail: review.ifThenPlan });
    if (review.previousPlanOutcome) items.push({ date, type: 'Проверка решения', tone: 'outcome', title: review.previousPlanOutcome, detail: '' });
    return items;
  }),
  ...store.monthlyReviews.map((review) => ({
    date: savedDate(review.updatedAt, endOfMonth(review.monthStart)),
    type: 'Решение месяца',
    tone: 'decision',
    title: review.nextFocus || review.courseChange || review.mainPattern || 'Обзор месяца',
    detail: review.ifThenPlan,
  })),
].filter((item) => item.date >= start.value && item.date <= end.value).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30));
const weightOption = computed<EChartsCoreOption>(() => ({
  color: ['#d9952f'],
  tooltip: { trigger: 'axis' },
  grid: { left: 52, right: 24, top: 20, bottom: 34 },
  xAxis: { type: 'category', data: monthRows.value.map((row) => row.label), axisTick: { show: false }, axisLine: { lineStyle: { color: '#dfe4ed' } }, axisLabel: { color: '#7d8798' } },
  yAxis: { type: 'value', scale: true, axisLabel: { formatter: '{value}кг', color: '#7d8798' }, splitLine: { lineStyle: { color: '#edf1f6' } } },
  series: [{ name: 'средний вес', type: 'line', symbolSize: 8, data: monthRows.value.map((row) => roundValue(row.summary.averageWeightKg)), connectNulls: false, lineStyle: { width: 3 } }]
}));
const progressOption = computed<EChartsCoreOption>(() => ({
  color: ['#1d5148', '#6f9f91', '#2eaa7f', '#b8c8c2', '#b85c4c', '#e7a43b'],
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#657085', fontSize: 12 } },
  grid: { left: 36, right: 24, top: 44, bottom: 34 },
  xAxis: {
    type: 'category',
    data: monthRows.value.map((row) => row.label),
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#dfe4ed' } },
    axisLabel: { color: '#7d8798' }
  },
  yAxis: [
    { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%', color: '#7d8798' }, splitLine: { lineStyle: { color: '#edf1f6' } } },
    { type: 'value', minInterval: 1, axisLabel: { color: '#7d8798' }, splitLine: { show: false } }
  ],
  series: [
    { name: 'реальные шаги', type: 'bar', stack: 'direction', data: monthRows.value.map((row) => ratioPercent(row.summary.externalActionDays, row.summary.actionDirectionSamples)), itemStyle: { borderRadius: [5, 5, 0, 0] } },
    { name: 'подготовка', type: 'bar', stack: 'direction', data: monthRows.value.map((row) => ratioPercent(row.summary.preparationDays, row.summary.actionDirectionSamples)) },
    { name: 'поддержание', type: 'bar', stack: 'direction', data: monthRows.value.map((row) => ratioPercent(row.summary.actionDirectionCounts.maintenance, row.summary.actionDirectionSamples)) },
    { name: 'восстановление', type: 'bar', stack: 'direction', data: monthRows.value.map((row) => ratioPercent(row.summary.actionDirectionCounts.recovery, row.summary.actionDirectionSamples)) },
    { name: 'в сторону', type: 'bar', stack: 'direction', data: monthRows.value.map((row) => ratioPercent(row.summary.driftDays, row.summary.actionDirectionSamples)) },
    { name: 'итоги', type: 'line', yAxisIndex: 1, data: monthRows.value.map((row) => row.resultsCount), symbolSize: 8, lineStyle: { width: 3 } }
  ]
}));

function coverageText(row: (typeof monthRows.value)[number]): string {
  return `${row.summary.coveredEntriesCount}/${row.expectedDays}`;
}

function directionText(row: (typeof monthRows.value)[number]): string {
  const external = ratioPercent(row.summary.externalActionDays, row.summary.actionDirectionSamples);
  const preparation = ratioPercent(row.summary.preparationDays, row.summary.actionDirectionSamples);
  return external === null ? '—' : `${external}%/${preparation}%`;
}

function nutritionText(row: (typeof monthRows.value)[number]): string {
  const support = ratioPercent(row.summary.nutritionSupportDays, row.summary.nutritionSamples);
  const block = ratioPercent(row.summary.nutritionBlockDays, row.summary.nutritionSamples);
  return support === null ? '—' : `${support}%/${block}%`;
}

function minutesToHours(value: number | null): number | null {
  return value === null ? null : Math.round((value / 60) * 10) / 10;
}

function roundValue(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

function formatComparisonValue(value: number | null, format: EventComparisonMetric['format']): string {
  if (value === null) return '—';
  if (format === 'minutes') return formatMinutes(Math.round(value));
  if (format === 'number') return `${roundValue(value)}/5`;
  if (format === 'weight') return `${roundValue(value)} кг`;
  if (format === 'percent') return `${Math.round(value)}%`;
  return String(Math.round(value));
}

function observationLabel(samples: number | null): string {
  if (samples === null) return '';
  if (samples === 0) return 'нет наблюдений';
  const lastTwo = samples % 100;
  const last = samples % 10;
  const noun = lastTwo >= 11 && lastTwo <= 14 ? 'наблюдений' : last === 1 ? 'наблюдение' : last >= 2 && last <= 4 ? 'наблюдения' : 'наблюдений';
  return `${samples} ${noun}`;
}

function factorSleepText(factor: (typeof factors.value)[number]): string {
  if (factor.averageSleep === null) return '—';
  const withFactor = `${formatMinutes(Math.round(factor.averageSleep))} · ${factor.sleepSamples} дн.`;
  const withoutFactor = factor.averageSleepWithout === null ? '—' : `${formatMinutes(Math.round(factor.averageSleepWithout))} · ${factor.sleepSamplesWithout} дн.`;
  return `${withFactor} / ${withoutFactor}`;
}

function factorEnergyText(factor: (typeof factors.value)[number]): string {
  if (factor.averageEnergy === null) return '—';
  const withFactor = `${factor.averageEnergy.toFixed(1).replace('.0', '')} · ${factor.energySamples} дн.`;
  const withoutFactor = factor.averageEnergyWithout === null ? '—' : `${factor.averageEnergyWithout.toFixed(1).replace('.0', '')} · ${factor.energySamplesWithout} дн.`;
  return `${withFactor} / ${withoutFactor}`;
}

function selectEvent(event: (typeof store.lifeEvents)[number]) {
  selectedEventKey.value = eventKey(event);
  eventPicker.value?.removeAttribute('open');
}

function createPackage() {
  return buildRangePackage(range.value, todayKey(), {
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
    notifySaved(`Промпт за ${range.value} мес. скопирован`);
  } catch (error) {
    notifyUnknownError(error, 'Не удалось скопировать промпт');
  }
}

function downloadJson() {
  try {
    downloadAiPackage(createPackage());
    notifyInfo(`Данные за ${range.value} мес. скачаны`);
  } catch (error) {
    notifyUnknownError(error, 'Не удалось скачать данные');
  }
}

</script>

<template>
  <section class="page page--review page--trends">
    <div class="page-heading">
      <div><span class="eyebrow">3–12 месяцев</span><h1>Тренды</h1><p>Долгий обзор без общего балла: сон, энергия, вес, питание, реальные шаги и важные события.</p></div>
    </div>

    <div class="range-tabs" aria-label="Период динамики">
      <button v-for="option in rangeOptions" :key="option.value" type="button" :class="{ active: range === option.value }" @click="range = option.value">{{ option.label }}</button>
    </div>

    <div class="metrics-grid">
      <MetricCard label="Заполненных дней" :value="summary.coveredEntriesCount" :hint="`${summary.ordinaryCoreEntriesCount} с основными полями`" accent="#1d5148" />
      <MetricCard label="Средний сон" :value="formatMinutes(summary.averageSleep === null ? null : Math.round(summary.averageSleep))" :hint="`${summary.sleepSamples} дн. без особых`" accent="#7467e8" />
      <MetricCard label="Карьера" :value="summary.externalSteps" hint="дней с откликом, разговором или итогом" accent="#3f82d5" />
      <MetricCard label="Реальные шаги" :value="`${summary.externalActionDays}/${summary.preparationDays}`" :hint="`шаги / подготовка · ${summary.actionDirectionSamples} дн.`" accent="#2eaa7f" />
      <MetricCard label="Питание" :value="`${summary.nutritionSupportDays}/${summary.nutritionBlockDays}`" :hint="summary.averageWeightKg === null ? `${summary.nutritionSamples} дн. с отметкой` : `вес ${summary.averageWeightKg.toFixed(1).replace('.0', '')} кг · ${summary.weightSamples} изм.`" accent="#d9952f" />
      <MetricCard label="Итогов" :value="results.length" :hint="`${lifeEvents.length} важных событий`" accent="#e7a43b" />
    </div>

    <article class="dashboard-card dashboard-card--quality">
      <div class="section-heading"><div><span class="eyebrow">Качество наблюдений</span><h2>Карта заполнения</h2></div><small>без серий и оценок</small></div>
      <EChartPanel :option="coverageOption" :height="230" aria-label="Календарная карта полноты дневных записей" />
      <p class="data-note">«Основные поля» означают, что заполнены хотя бы два блока: состояние, действия или питание. Карта нужна только для оценки надёжности выводов.</p>
    </article>

    <article class="dashboard-card dashboard-card--trend">
      <div class="section-heading"><div><span class="eyebrow">Динамика периода</span><h2>Сон и энергия</h2></div><small>* неполный текущий месяц</small></div>
      <EChartPanel :option="trendOverviewOption" :height="320" aria-label="Динамика сна и энергии по месяцам" />
      <p v-if="lifeEvents.length" class="data-note">Оранжевые пунктирные линии показывают месяцы с важными событиями. Число у линии — количество событий; наведи на неё, чтобы увидеть список.</p>
    </article>

    <article v-if="lifeEvents.length" class="dashboard-card dashboard-card--event">
      <div class="section-heading">
        <div><span class="eyebrow">До и после</span><h2>Что менялось рядом с событием</h2></div>
        <details ref="eventPicker" class="event-picker">
          <summary aria-label="Выбрать событие для сравнения">
            <span class="event-picker__icon">◆</span>
            <span class="event-picker__current">
              <small>Событие для сравнения</small>
              <strong v-if="selectedEvent">{{ formatDate(selectedEvent.date, { day: 'numeric', month: 'short', year: 'numeric' }) }} · {{ selectedEvent.title }}</strong>
            </span>
            <span class="event-picker__chevron">⌄</span>
          </summary>
          <div class="event-picker__menu" role="listbox" aria-label="Важные события">
            <button
              v-for="event in lifeEvents"
              :key="eventKey(event)"
              class="event-picker__option"
              :class="{ active: eventKey(event) === selectedEventKey }"
              type="button"
              role="option"
              :aria-selected="eventKey(event) === selectedEventKey"
              @click="selectEvent(event)"
            >
              <time>{{ formatDate(event.date, { day: 'numeric', month: 'short' }) }}</time>
              <span><strong>{{ event.title }}</strong><small v-if="event.note">{{ event.note }}</small></span>
              <i>{{ eventKey(event) === selectedEventKey ? '✓' : '' }}</i>
            </button>
          </div>
        </details>
      </div>
      <template v-if="eventComparison">
        <div class="comparison-periods">
          <span>До: {{ formatDate(eventComparison.beforeStart, { day: 'numeric', month: 'short' }) }} — {{ formatDate(eventComparison.beforeEnd, { day: 'numeric', month: 'short' }) }} · заполнено {{ eventComparison.beforeEntries }}/{{ eventComparison.windowDays }}</span>
          <span>После: {{ formatDate(eventComparison.afterStart, { day: 'numeric', month: 'short' }) }} — {{ formatDate(eventComparison.afterEnd, { day: 'numeric', month: 'short' }) }} · заполнено {{ eventComparison.afterEntries }}/{{ eventComparison.windowDays }}</span>
        </div>
        <div class="comparison-table">
          <div class="comparison-table__head"><span>Показатель</span><span>До</span><span>После</span></div>
          <div v-for="metric in eventComparison.metrics" :key="metric.id" class="comparison-table__row">
            <strong>{{ metric.label }}</strong>
            <span>{{ formatComparisonValue(metric.before, metric.format) }} <small>{{ observationLabel(metric.beforeSamples) }}</small></span>
            <span>{{ formatComparisonValue(metric.after, metric.format) }} <small>{{ observationLabel(metric.afterSamples) }}</small></span>
          </div>
        </div>
        <p class="data-note">Под значением указано число дневных наблюдений, вошедших в расчёт. Сравниваются равные календарные окна, день события исключён. Разница показывает совпадение во времени, а не причинный эффект.</p>
      </template>
      <p v-else class="empty-copy">После события пока не прошло ни одного полного дня для сравнения.</p>
    </article>

    <article class="dashboard-card dashboard-card--weight">
      <div class="section-heading"><div><span class="eyebrow">Тренд без разовых скачков</span><h2>Вес по месяцам</h2></div><small>среднее и число измерений — в таблице</small></div>
      <EChartPanel :option="weightOption" :height="260" aria-label="Динамика среднего веса по месяцам" />
    </article>

    <article class="dashboard-card dashboard-card--insights">
      <div class="section-heading">
        <div><span class="eyebrow">Опорные выводы</span><h2>Что видно за выбранные месяцы</h2></div>
        <div class="period-actions">
          <button class="secondary-button" type="button" @click="copyPrompt">Скопировать промпт</button>
          <button class="secondary-button" type="button" @click="downloadJson">Скачать данные</button>
        </div>
      </div>
      <div class="review-cue-grid">
        <article v-for="cue in cues" :key="cue.id" class="review-cue" :class="`review-cue--${cue.tone}`">
          <strong>{{ cue.title }}</strong>
          <p>{{ cue.text }}</p>
        </article>
      </div>
    </article>

    <article class="dashboard-card dashboard-card--progress">
      <div class="section-heading"><div><span class="eyebrow">Движение к цели</span><h2>Реальные шаги, подготовка и итоги</h2></div><small>столбцы: % отмеченных дней</small></div>
      <EChartPanel :option="progressOption" :height="320" aria-label="Динамика реальных шагов, подготовки, ухода в сторону и итогов" />
    </article>

    <article class="dashboard-card dashboard-card--table">
      <div class="section-heading"><div><span class="eyebrow">Состояние</span><h2>Сон и энергия по месяцам</h2></div></div>
      <div class="trend-table">
        <div class="trend-table__head"><span>месяц</span><span>заполнено</span><span>сон (дни)</span><span>вес (изм.)</span><span>энергия (дни)</span><span>шаги / подг.</span><span>питание + / −</span><span>особые</span></div>
        <div v-for="row in monthRows" :key="`${row.monthStart}-state`" class="trend-table__row">
          <strong>{{ row.label }}</strong>
          <span>{{ coverageText(row) }}</span>
          <span>{{ formatMinutes(row.summary.averageSleep === null ? null : Math.round(row.summary.averageSleep)) }} ({{ row.summary.sleepSamples }})</span>
          <span>{{ row.summary.averageWeightKg === null ? '—' : `${row.summary.averageWeightKg.toFixed(1).replace('.0', '')} кг (${row.summary.weightSamples})` }}</span>
          <span>{{ row.summary.averageEnergy === null ? '—' : `${row.summary.averageEnergy.toFixed(1).replace('.0', '')}/5 (${row.summary.energySamples})` }}</span>
          <span>{{ directionText(row) }}</span>
          <span>{{ nutritionText(row) }}</span>
          <span>{{ row.summary.specialDays }}</span>
        </div>
      </div>
    </article>

    <article v-if="factors.length" class="dashboard-card dashboard-card--factors">
      <div class="section-heading"><div><span class="eyebrow">Повторяемость</span><h2>Главные вечерние факторы</h2></div></div>
      <div class="factor-summary-list">
        <article v-for="factor in factors" :key="factor.id" class="factor-summary-item">
          <span class="factor-summary-item__name"><i>{{ factor.icon }}</i>{{ factor.label }}</span>
          <strong>{{ factor.count }}</strong>
          <small>{{ factorSleepText(factor) }}</small>
          <small>{{ factorEnergyText(factor) }}</small>
        </article>
      </div>
      <p class="data-note">Формат: значение в дни с фактором / в обычные дни без него. Особые дни исключены; это связь, а не доказанная причина.</p>
    </article>

    <article v-if="decisionTimeline.length" class="dashboard-card dashboard-card--timeline">
      <div class="section-heading"><div><span class="eyebrow">История изменений</span><h2>События, решения и итоги</h2></div><span class="count-badge">{{ decisionTimeline.length }}</span></div>
      <div class="decision-timeline">
        <article v-for="(item, index) in decisionTimeline" :key="`${item.date}-${item.type}-${index}`" class="decision-timeline__item" :class="`decision-timeline__item--${item.tone}`">
          <time>{{ formatDate(item.date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</time>
          <span>{{ item.type }}</span>
          <div><strong>{{ item.title }}</strong><p v-if="item.detail">{{ item.detail }}</p></div>
        </article>
      </div>
    </article>
  </section>
</template>
