<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { EChartsCoreOption } from 'echarts/core';
import EChartPanel from '../components/charts/EChartPanel.vue';
import MetricCard from '../components/MetricCard.vue';
import { buildCoverageSeries, buildEventComparison, buildRangeReviewCues, entriesForPeriod, factorSummaries, ratioPercent, resultsForPeriod, summarize, type EventComparisonMetric } from '../services/analytics';
import { addMonths, dateRange, endOfMonth, formatDate, formatMinutes, monthsBetween, startOfMonth, todayKey } from '../services/dates';
import { buildRangePackage, copyAiPrompt as copyPackagePrompt, downloadAiPackage } from '../services/exportPackage';
import { useAppStore } from '../stores/app';

type RangeMonths = 3 | 6 | 12;

const store = useAppStore();
const range = ref<RangeMonths>(3);
const exportStatus = ref('');
const selectedEventKey = ref('');
const rangeOptions: Array<{ value: RangeMonths; label: string }> = [
  { value: 3, label: '3 месяца' },
  { value: 6, label: '6 месяцев' },
  { value: 12, label: '12 месяцев' },
];

const externalCareerIds = computed(() => ['external', 'interview', 'result', ...store.settings.customCareerOptions.filter((option) => option.countsAsExternal).map((option) => option.id)]);
const end = computed(() => todayKey());
const start = computed(() => startOfMonth(addMonths(todayKey(), -(range.value - 1))));
const entries = computed(() => entriesForPeriod(store.dailyEntries, start.value, end.value));
const results = computed(() => resultsForPeriod(store.results, start.value, end.value));
const lifeEvents = computed(() => store.lifeEvents.filter((event) => event.date >= start.value && event.date <= end.value).sort((a, b) => b.date.localeCompare(a.date)));
const summary = computed(() => summarize(entries.value, externalCareerIds.value));
const factors = computed(() => factorSummaries(entries.value).slice(0, 5));
const cues = computed(() => buildRangeReviewCues(range.value, entries.value, results.value, lifeEvents.value, externalCareerIds.value));
const monthlyReviews = computed(() => store.monthlyReviews.filter((review) => review.monthStart >= start.value && review.monthStart <= end.value).sort((a, b) => b.monthStart.localeCompare(a.monthStart)));

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

const eventMarkers = computed(() => monthRows.value.flatMap((row) => {
  const events = lifeEvents.value.filter((event) => event.date.startsWith(row.monthStart.slice(0, 7)));
  return events.length ? [{
    name: events.map((event) => `${formatDate(event.date, { day: 'numeric', month: 'short' })}: ${event.title}`).join('\n'),
    value: events.length,
    coord: [row.label, 5],
  }] : [];
}));

const trendOverviewOption = computed<EChartsCoreOption>(() => ({
  color: ['#7367f0', '#4bcda0'],
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
    { name: 'сон, ч', type: 'line', symbolSize: 8, data: monthRows.value.map((row) => minutesToHours(row.summary.averageSleep)), connectNulls: false, lineStyle: { width: 3 } },
    {
      name: 'энергия',
      type: 'line',
      yAxisIndex: 1,
      symbolSize: 8,
      data: monthRows.value.map((row) => roundValue(row.summary.averageEnergy)),
      connectNulls: false,
      lineStyle: { width: 3 },
      markPoint: {
        symbol: 'pin',
        symbolSize: 42,
        itemStyle: { color: '#eb7458' },
        label: { color: '#fff', fontWeight: 750 },
        tooltip: { formatter: (params: { data?: { name?: string } }) => params.data?.name ?? 'Событие архива' },
        data: eventMarkers.value,
      },
    }
  ]
}));

const coverageOption = computed<EChartsCoreOption>(() => ({
  tooltip: {
    formatter: (params: { value?: [string, number] }) => {
      const date = params.value?.[0];
      const level = params.value?.[1] ?? 0;
      const label = level === 2 ? 'основные данные есть' : level === 1 ? 'заполнено частично' : 'записи нет';
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
      { value: 1, label: 'частично', color: '#b8c1d8' },
      { value: 2, label: 'основные данные', color: '#4bcda0' },
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

const decisionTimeline = computed(() => [
  ...lifeEvents.value.map((event) => ({ date: event.date, type: 'Событие', tone: 'event', title: event.title, detail: event.note })),
  ...results.value.map((result) => ({ date: result.date, type: 'Результат', tone: 'result', title: result.title, detail: '' })),
  ...store.weeklyReviews
    .filter((review) => review.weekStart >= start.value && review.weekStart <= end.value)
    .flatMap((review) => {
      const items = [];
      if (review.nextLever || review.ifThenPlan) items.push({ date: review.weekStart, type: 'Решение недели', tone: 'decision', title: review.nextLever || 'План недели', detail: review.ifThenPlan });
      if (review.previousPlanOutcome) items.push({ date: review.weekStart, type: 'Проверка решения', tone: 'outcome', title: review.previousPlanOutcome, detail: '' });
      return items;
    }),
  ...monthlyReviews.value.map((review) => ({
    date: review.monthStart,
    type: 'Решение месяца',
    tone: 'decision',
    title: review.nextFocus || review.courseChange || review.mainPattern || 'Обзор месяца',
    detail: review.ifThenPlan,
  })),
].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30));
const weightOption = computed<EChartsCoreOption>(() => ({
  color: ['#d39b2f'],
  tooltip: { trigger: 'axis' },
  grid: { left: 52, right: 24, top: 20, bottom: 34 },
  xAxis: { type: 'category', data: monthRows.value.map((row) => row.label), axisTick: { show: false }, axisLine: { lineStyle: { color: '#dfe4ed' } }, axisLabel: { color: '#7d8798' } },
  yAxis: { type: 'value', scale: true, axisLabel: { formatter: '{value}кг', color: '#7d8798' }, splitLine: { lineStyle: { color: '#edf1f6' } } },
  series: [{ name: 'средний вес', type: 'line', symbolSize: 8, data: monthRows.value.map((row) => roundValue(row.summary.averageWeightKg)), connectNulls: false, lineStyle: { width: 3 } }]
}));
const progressOption = computed<EChartsCoreOption>(() => ({
  color: ['#5264d8', '#7eb4ef', '#4bcda0', '#b8c1d8', '#b85c4c', '#f0ad42'],
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
    { name: 'наружу', type: 'bar', stack: 'direction', data: monthRows.value.map((row) => ratioPercent(row.summary.externalActionDays, row.summary.actionDirectionSamples)), itemStyle: { borderRadius: [5, 5, 0, 0] } },
    { name: 'подготовка', type: 'bar', stack: 'direction', data: monthRows.value.map((row) => ratioPercent(row.summary.preparationDays, row.summary.actionDirectionSamples)) },
    { name: 'поддержание', type: 'bar', stack: 'direction', data: monthRows.value.map((row) => ratioPercent(row.summary.actionDirectionCounts.maintenance, row.summary.actionDirectionSamples)) },
    { name: 'восстановление', type: 'bar', stack: 'direction', data: monthRows.value.map((row) => ratioPercent(row.summary.actionDirectionCounts.recovery, row.summary.actionDirectionSamples)) },
    { name: 'в сторону', type: 'bar', stack: 'direction', data: monthRows.value.map((row) => ratioPercent(row.summary.driftDays, row.summary.actionDirectionSamples)) },
    { name: 'результаты', type: 'line', yAxisIndex: 1, data: monthRows.value.map((row) => row.resultsCount), symbolSize: 8, lineStyle: { width: 3 } }
  ]
}));

function coverageText(row: (typeof monthRows.value)[number]): string {
  return `${row.summary.entriesCount}/${row.expectedDays}`;
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

function sampleLabel(samples: number | null): string {
  return samples === null ? '' : `n=${samples}`;
}

function createPackage() {
  return buildRangePackage(range.value, todayKey(), {
    entries: store.dailyEntries,
    results: store.results,
    lifeEvents: store.lifeEvents,
    reviews: store.weeklyReviews,
    monthlyReviews: store.monthlyReviews,
    settings: store.settings
  });
}

async function copyPrompt() {
  await copyPackagePrompt(createPackage(), store.settings);
  showExportStatus(`Промпт за ${range.value} мес. скопирован`);
}

function downloadJson() {
  downloadAiPackage(createPackage());
  showExportStatus(`Пакет за ${range.value} мес. скачан`);
}

function showExportStatus(message: string) {
  exportStatus.value = message;
  window.setTimeout(() => (exportStatus.value = ''), 1800);
}
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div><span class="eyebrow">Длинная динамика</span><h1>Тренды</h1><p>Календарные 3, 6 и 12 месяцев: не для самооценки, а чтобы увидеть устойчивые контуры.</p></div>
    </div>

    <div class="range-tabs" aria-label="Период динамики">
      <button v-for="option in rangeOptions" :key="option.value" type="button" :class="{ active: range === option.value }" @click="range = option.value">{{ option.label }}</button>
    </div>

    <div class="metrics-grid">
      <MetricCard label="Заполнено дней" :value="summary.entriesCount" :hint="`${summary.ordinaryEntriesCount} обычных`" accent="#5865db" />
      <MetricCard label="Средний сон" :value="formatMinutes(summary.averageSleep === null ? null : Math.round(summary.averageSleep))" :hint="`${summary.sleepSamples} дн. без особых`" accent="#7367f0" />
      <MetricCard label="Внешних шагов" :value="summary.externalSteps" accent="#4188e8" />
      <MetricCard label="Направление" :value="`${summary.externalActionDays}/${summary.preparationDays}`" :hint="`наружу / подготовка · ${summary.actionDirectionSamples} дн.`" accent="#5264d8" />
      <MetricCard label="Питание" :value="`${summary.nutritionSupportDays}/${summary.nutritionBlockDays}`" :hint="summary.averageWeightKg === null ? `${summary.nutritionSamples} дн. с отметкой` : `вес ${summary.averageWeightKg.toFixed(1).replace('.0', '')} кг · ${summary.weightSamples} изм.`" accent="#d39b2f" />
      <MetricCard label="Результатов" :value="results.length" :hint="`${lifeEvents.length} событий архива`" accent="#f0ad42" />
    </div>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Качество наблюдений</span><h2>Карта заполнения</h2></div><small>без серий и оценок</small></div>
      <EChartPanel :option="coverageOption" :height="230" aria-label="Календарная карта полноты дневных записей" />
      <p class="data-note">«Основные данные» означают, что заполнены хотя бы два слоя: состояние, действия или питание. Карта нужна только для оценки надёжности выводов.</p>
    </article>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Динамика периода</span><h2>Сон и энергия</h2></div><small>* неполный текущий месяц</small></div>
      <EChartPanel :option="trendOverviewOption" :height="320" aria-label="Динамика сна и энергии по месяцам" />
      <p v-if="lifeEvents.length" class="data-note">Оранжевые маркеры показывают месяцы с событиями из Архива. Наведи на маркер, чтобы увидеть события.</p>
    </article>

    <article v-if="lifeEvents.length" class="dashboard-card">
      <div class="section-heading">
        <div><span class="eyebrow">До и после</span><h2>Что менялось рядом с событием</h2></div>
        <select v-model="selectedEventKey" class="event-select" aria-label="Событие для сравнения">
          <option v-for="event in lifeEvents" :key="eventKey(event)" :value="eventKey(event)">{{ formatDate(event.date, { day: 'numeric', month: 'short' }) }} · {{ event.title }}</option>
        </select>
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
            <span>{{ formatComparisonValue(metric.before, metric.format) }} <small>{{ sampleLabel(metric.beforeSamples) }}</small></span>
            <span>{{ formatComparisonValue(metric.after, metric.format) }} <small>{{ sampleLabel(metric.afterSamples) }}</small></span>
          </div>
        </div>
        <p class="data-note">Сравниваются равные календарные окна, день события исключён. Особые дни не входят в средние состояния. Разница показывает совпадение во времени, а не причинный эффект.</p>
      </template>
      <p v-else class="empty-copy">После события пока не прошло ни одного полного дня для сравнения.</p>
    </article>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Тренд без разовых скачков</span><h2>Вес по месяцам</h2></div><small>среднее и число измерений — в таблице</small></div>
      <EChartPanel :option="weightOption" :height="260" aria-label="Динамика среднего веса по месяцам" />
    </article>

    <article class="dashboard-card">
      <div class="section-heading">
        <div><span class="eyebrow">Опорные выводы</span><h2>Что видно на длинном периоде</h2></div>
        <div class="period-actions">
          <button class="secondary-button" type="button" @click="copyPrompt">Скопировать промпт</button>
          <button class="secondary-button" type="button" @click="downloadJson">Скачать пакет</button>
        </div>
      </div>
      <p v-if="exportStatus" class="settings-status">{{ exportStatus }}</p>
      <div class="review-cue-grid">
        <article v-for="cue in cues" :key="cue.id" class="review-cue" :class="`review-cue--${cue.tone}`">
          <strong>{{ cue.title }}</strong>
          <p>{{ cue.text }}</p>
        </article>
      </div>
    </article>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Контакт с реальностью</span><h2>Доля направлений и результаты</h2></div><small>столбцы: % отмеченных дней</small></div>
      <EChartPanel :option="progressOption" :height="320" aria-label="Динамика внешних действий, подготовки, ухода в сторону и результатов" />
    </article>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Состояние</span><h2>Сон и энергия по месяцам</h2></div></div>
      <div class="trend-table">
        <div class="trend-table__head"><span>месяц</span><span>заполнено</span><span>сон (n)</span><span>вес (n)</span><span>энергия (n)</span><span>наружу / подг.</span><span>питание + / −</span><span>особые</span></div>
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

    <article v-if="factors.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Повторяемость</span><h2>Главные вечерние факторы</h2></div></div>
      <div class="factor-summary-list">
        <article v-for="factor in factors" :key="factor.id" class="factor-summary-item">
          <span class="factor-summary-item__name"><i>{{ factor.icon }}</i>{{ factor.label }}</span>
          <strong>{{ factor.count }}</strong>
          <small>{{ factor.averageSleep === null ? '—' : `${formatMinutes(Math.round(factor.averageSleep))} / ${formatMinutes(factor.averageSleepWithout === null ? null : Math.round(factor.averageSleepWithout))}` }}</small>
          <small>{{ factor.averageEnergy === null ? '—' : `${factor.averageEnergy.toFixed(1).replace('.0', '')} / ${factor.averageEnergyWithout?.toFixed(1).replace('.0', '') ?? '—'}` }}</small>
        </article>
      </div>
      <p class="data-note">Формат: значение в дни с фактором / в обычные дни без него. Особые дни исключены; это связь, а не доказанная причина.</p>
    </article>

    <article v-if="decisionTimeline.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">История изменений</span><h2>События, решения и результаты</h2></div><span class="count-badge">{{ decisionTimeline.length }}</span></div>
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
