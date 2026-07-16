<script setup lang="ts">
import { computed, ref } from 'vue';
import MetricCard from '../components/MetricCard.vue';
import { buildReviewCues, entriesForPeriod, factorSummaries, resultsForPeriod, summarize } from '../services/analytics';
import { addMonths, endOfMonth, formatDate, formatMinutes, monthsBetween, startOfMonth, todayKey } from '../services/dates';
import { buildRangePackage, copyAiPrompt as copyPackagePrompt, downloadAiPackage } from '../services/exportPackage';
import { useAppStore } from '../stores/app';

type RangeMonths = 3 | 6 | 12;

const store = useAppStore();
const range = ref<RangeMonths>(3);
const exportStatus = ref('');
const rangeOptions: Array<{ value: RangeMonths; label: string }> = [
  { value: 3, label: '3 месяца' },
  { value: 6, label: '6 месяцев' },
  { value: 12, label: '12 месяцев' },
];

const externalCareerIds = computed(() => ['external', 'interview', 'result', ...store.settings.customCareerOptions.filter((option) => option.countsAsExternal).map((option) => option.id)]);
const end = computed(() => endOfMonth(todayKey()));
const start = computed(() => startOfMonth(addMonths(todayKey(), -(range.value - 1))));
const entries = computed(() => entriesForPeriod(store.dailyEntries, start.value, end.value));
const results = computed(() => resultsForPeriod(store.results, start.value, end.value));
const lifeEvents = computed(() => store.lifeEvents.filter((event) => event.date >= start.value && event.date <= end.value).sort((a, b) => b.date.localeCompare(a.date)));
const summary = computed(() => summarize(entries.value, externalCareerIds.value));
const factors = computed(() => factorSummaries(entries.value).slice(0, 5));
const cues = computed(() => buildReviewCues('month', entries.value, results.value, lifeEvents.value, externalCareerIds.value));

const monthRows = computed(() => monthsBetween(start.value, end.value).map((monthStart) => {
  const monthEnd = endOfMonth(monthStart);
  const monthEntries = entriesForPeriod(entries.value, monthStart, monthEnd);
  const monthSummary = summarize(monthEntries, externalCareerIds.value);
  return {
    monthStart,
    label: formatDate(monthStart, { month: 'short' }),
    summary: monthSummary,
    resultsCount: resultsForPeriod(results.value, monthStart, monthEnd).length,
    eventsCount: lifeEvents.value.filter((event) => event.date >= monthStart && event.date <= monthEnd).length,
  };
}));

const maxEntries = computed(() => Math.max(1, ...monthRows.value.map((row) => row.summary.entriesCount)));
const maxExternalSteps = computed(() => Math.max(1, ...monthRows.value.map((row) => row.summary.externalSteps)));
const maxResults = computed(() => Math.max(1, ...monthRows.value.map((row) => row.resultsCount)));

function createPackage() {
  return buildRangePackage(range.value, todayKey(), {
    entries: store.dailyEntries,
    results: store.results,
    lifeEvents: store.lifeEvents,
    reviews: store.weeklyReviews,
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
      <MetricCard label="Заполнено дней" :value="summary.entriesCount" accent="#5865db" />
      <MetricCard label="Средний сон" :value="formatMinutes(summary.averageSleep === null ? null : Math.round(summary.averageSleep))" :hint="summary.averageTimeInBed === null ? '' : `в кровати ${formatMinutes(Math.round(summary.averageTimeInBed))}`" accent="#7367f0" />
      <MetricCard label="Внешних шагов" :value="summary.externalSteps" accent="#4188e8" />
      <MetricCard label="Результатов" :value="results.length" :hint="`${lifeEvents.length} событий архива`" accent="#f0ad42" />
    </div>

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
      <div class="section-heading"><div><span class="eyebrow">По месяцам</span><h2>Покрытие и действия</h2></div></div>
      <div class="long-chart">
        <div v-for="row in monthRows" :key="row.monthStart" class="long-chart__row">
          <time>{{ row.label }}</time>
          <div class="long-chart__tracks">
            <span class="long-chart__bar long-chart__bar--entries" :style="{ width: `${(row.summary.entriesCount / maxEntries) * 100}%` }"></span>
            <span class="long-chart__bar long-chart__bar--career" :style="{ width: `${(row.summary.externalSteps / maxExternalSteps) * 100}%` }"></span>
            <span class="long-chart__bar long-chart__bar--results" :style="{ width: `${(row.resultsCount / maxResults) * 100}%` }"></span>
          </div>
          <small>{{ row.summary.entriesCount }} дн. · {{ row.summary.externalSteps }} шаг. · {{ row.resultsCount }} рез.</small>
        </div>
      </div>
      <div class="chart-legend">
        <span><i class="legend-dot legend-dot--entries"></i>записи</span>
        <span><i class="legend-dot legend-dot--career"></i>внешние шаги</span>
        <span><i class="legend-dot legend-dot--results"></i>результаты</span>
      </div>
    </article>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Состояние</span><h2>Сон и энергия по месяцам</h2></div></div>
      <div class="trend-table">
        <div class="trend-table__head"><span>месяц</span><span>сон</span><span>в кровати</span><span>энергия</span><span>особые</span><span>события</span></div>
        <div v-for="row in monthRows" :key="`${row.monthStart}-state`" class="trend-table__row">
          <strong>{{ row.label }}</strong>
          <span>{{ formatMinutes(row.summary.averageSleep === null ? null : Math.round(row.summary.averageSleep)) }}</span>
          <span>{{ formatMinutes(row.summary.averageTimeInBed === null ? null : Math.round(row.summary.averageTimeInBed)) }}</span>
          <span>{{ row.summary.averageEnergy === null ? '—' : `${row.summary.averageEnergy.toFixed(1).replace('.0', '')}/5` }}</span>
          <span>{{ row.summary.specialDays }}</span>
          <span>{{ row.eventsCount }}</span>
        </div>
      </div>
    </article>

    <article v-if="factors.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Повторяемость</span><h2>Главные вечерние факторы</h2></div></div>
      <div class="factor-summary-list">
        <article v-for="factor in factors" :key="factor.id" class="factor-summary-item">
          <span class="factor-summary-item__name"><i>{{ factor.icon }}</i>{{ factor.label }}</span>
          <strong>{{ factor.count }}</strong>
          <small>{{ formatMinutes(factor.averageSleep === null ? null : Math.round(factor.averageSleep)) }}</small>
          <small>{{ factor.averageEnergy === null ? '—' : `${factor.averageEnergy.toFixed(1).replace('.0', '')}/5` }}</small>
        </article>
      </div>
    </article>
  </section>
</template>
