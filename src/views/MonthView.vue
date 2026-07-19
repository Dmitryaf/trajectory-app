<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { EChartsCoreOption } from 'echarts/core';
import EChartPanel from '../components/charts/EChartPanel.vue';
import MetricCard from '../components/MetricCard.vue';
import PeriodNavigator from '../components/PeriodNavigator.vue';
import { actionDirectionLabel, buildObservations, buildReviewCues, buildReviewQuestions, careerStatesForEntry, entriesForMonth, factorSummaries, hasMovement, resultsForPeriod, specialDayLabel, summarize } from '../services/analytics';
import { addDays, dateRange, endOfMonth, formatDate, formatMinutes, fromDateKey, startOfMonth, todayKey, toDateKey } from '../services/dates';
import { buildPeriodPackage, copyAiPrompt as copyPackagePrompt, downloadAiPackage } from '../services/exportPackage';
import { useAppStore } from '../stores/app';
import { notifyInfo, notifySaved } from '../services/notifications';
import { plainCopy } from '../services/plain';
import { actionDirectionOptions, emptyMonthlyReview, lifeAreaOptions, type MonthlyReview } from '../types';

const store = useAppStore();
const anchor = ref(todayKey());
const start = computed(() => startOfMonth(anchor.value));
const end = computed(() => endOfMonth(anchor.value));
const entries = computed(() => entriesForMonth(store.dailyEntries, anchor.value));
const externalCareerIds = computed(() => ['external', 'interview', 'result', ...store.settings.customCareerOptions.filter((option) => option.countsAsExternal).map((option) => option.id)]);
const summary = computed(() => summarize(entries.value, externalCareerIds.value));
const observations = computed(() => buildObservations(entries.value));
const factors = computed(() => factorSummaries(entries.value));
const results = computed(() => resultsForPeriod(store.results, start.value, end.value));
const lifeEvents = computed(() => store.lifeEvents.filter((event) => event.date >= start.value && event.date <= end.value).sort((a, b) => b.date.localeCompare(a.date)));
const reviewCues = computed(() => buildReviewCues('month', entries.value, results.value, lifeEvents.value, externalCareerIds.value));
const reviewQuestions = buildReviewQuestions('month');
const monthDates = computed(() => dateRange(start.value, end.value));
const entriesByDate = computed(() => new Map(entries.value.map((entry) => [entry.date, entry])));
const sleepEntries = computed(() => [...entries.value].filter((entry) => entry.specialDay === null && entry.sleepMinutes !== null).sort((a, b) => a.date.localeCompare(b.date)));
const energySleepEntries = computed(() => entries.value.filter((entry) => entry.sleepMinutes !== null && entry.energy !== null).sort((a, b) => a.date.localeCompare(b.date)));
const weightEntries = computed(() => entries.value.filter((entry) => entry.specialDay === null && entry.weightKg !== null).sort((a, b) => a.date.localeCompare(b.date)));
const weightHistoryEntries = computed(() => store.dailyEntries
  .filter((entry) => entry.date >= addDays(start.value, -6) && entry.date <= end.value && entry.specialDay === null && entry.weightKg !== null)
  .sort((a, b) => a.date.localeCompare(b.date)));
const sleepEnergyOption = computed<EChartsCoreOption>(() => {
  const rows = monthDates.value.map((date) => {
    const entry = entriesByDate.value.get(date);
    return { date, entry: entry?.specialDay === null ? entry : undefined };
  });
  return {
    color: ['#7367f0', '#b8c1d8', '#4bcda0'],
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => formatSleepTooltip(params)
    },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#657085', fontSize: 12 } },
    grid: { left: 46, right: 42, top: 42, bottom: 34 },
    xAxis: {
      type: 'category',
      data: rows.map((row) => formatDate(row.date, { day: 'numeric' })),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dfe4ed' } },
      axisLabel: { color: '#7d8798' }
    },
    yAxis: [
      { type: 'value', min: 0, max: 12, interval: 3, axisLabel: { formatter: '{value}ч', color: '#7d8798' }, splitLine: { lineStyle: { color: '#edf1f6' } } },
      { type: 'value', min: 1, max: 5, interval: 1, axisLabel: { color: '#7d8798' }, splitLine: { show: false } }
    ],
    series: [
      { name: 'Сон', type: 'bar', data: rows.map((row) => minutesToHours(row.entry?.sleepMinutes ?? null)), barMaxWidth: 16, itemStyle: { borderRadius: [7, 7, 2, 2] } },
      { name: 'В кровати', type: 'bar', data: rows.map((row) => minutesToHours(row.entry?.timeInBedMinutes ?? null)), barMaxWidth: 16, itemStyle: { borderRadius: [7, 7, 2, 2] } },
      { name: 'Энергия', type: 'line', yAxisIndex: 1, data: rows.map((row) => row.entry?.energy ?? null), smooth: false, symbolSize: 8, connectNulls: false, lineStyle: { width: 3 } }
    ]
  };
});
const energySleepOption = computed<EChartsCoreOption>(() => ({
  color: ['#7f8ba1', '#4bcda0', '#eb7458'],
  tooltip: {
    trigger: 'item',
    formatter: (params: unknown) => formatScatterTooltip(params)
  },
  legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#657085', fontSize: 12 } },
  grid: { left: 46, right: 28, top: 42, bottom: 40 },
  xAxis: { type: 'value', min: 0, max: 12, interval: 2, name: 'сон', nameLocation: 'end', axisLabel: { formatter: '{value}ч', color: '#7d8798' }, splitLine: { lineStyle: { color: '#edf1f6' } } },
  yAxis: { type: 'value', min: 1, max: 5, interval: 1, name: 'энергия', axisLabel: { color: '#7d8798' }, splitLine: { lineStyle: { color: '#edf1f6' } } },
  series: [
    { name: 'без движения', type: 'scatter', data: scatterRows('still'), symbolSize: 12 },
    { name: 'с движением', type: 'scatter', data: scatterRows('movement'), symbolSize: 14 },
    { name: 'особый день', type: 'scatter', data: scatterRows('special'), symbolSize: 16 }
  ]
}));
const weightOption = computed<EChartsCoreOption>(() => {
  const rows = monthDates.value.map((date) => {
    const entry = entriesByDate.value.get(date);
    const weight = entry?.specialDay === null ? entry.weightKg : null;
    const windowStart = addDays(date, -6);
    const windowValues = weightHistoryEntries.value.filter((item) => item.date >= windowStart && item.date <= date).map((item) => item.weightKg as number);
    return {
      date,
      weight,
      rolling: windowValues.length >= 2 ? Math.round((windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length) * 10) / 10 : null
    };
  });
  return {
    color: ['#d39b2f', '#5264d8'],
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#657085', fontSize: 12 } },
    grid: { left: 52, right: 24, top: 42, bottom: 34 },
    xAxis: { type: 'category', data: rows.map((row) => formatDate(row.date, { day: 'numeric' })), axisTick: { show: false }, axisLine: { lineStyle: { color: '#dfe4ed' } }, axisLabel: { color: '#7d8798' } },
    yAxis: { type: 'value', scale: true, axisLabel: { formatter: '{value}кг', color: '#7d8798' }, splitLine: { lineStyle: { color: '#edf1f6' } } },
    series: [
      { name: 'измерение', type: 'line', symbolSize: 7, data: rows.map((row) => row.weight), lineStyle: { width: 1, opacity: .4 } },
      { name: 'среднее за 7 дней', type: 'line', symbolSize: 8, data: rows.map((row) => row.rolling), connectNulls: false, lineStyle: { width: 3 } }
    ]
  };
});
const actionDirectionOption = computed<EChartsCoreOption>(() => {
  const data = actionDirectionOptions
    .map((option) => ({ name: option.label, value: summary.value.actionDirectionCounts[option.id] }))
    .filter((item) => item.value > 0);
  return {
    color: ['#5264d8', '#7eb4ef', '#4bcda0', '#b8c1d8', '#b85c4c'],
    tooltip: { trigger: 'item', formatter: '{b}: {c} дн.' },
    legend: { orient: 'vertical', right: 8, top: 'middle', textStyle: { color: '#657085', fontSize: 12 } },
    series: [{
      name: 'Направление',
      type: 'pie',
      radius: ['48%', '72%'],
      center: ['38%', '50%'],
      data,
      avoidLabelOverlap: true,
      label: { formatter: '{b}\n{c}', color: '#344055', fontWeight: 700 },
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 3 }
    }]
  };
});
const stateNotes = computed(() => entries.value.filter((entry) => entry.stateContext.trim()).sort((a, b) => b.date.localeCompare(a.date)));
const actionNotes = computed(() => entries.value.filter((entry) => entry.actionDirection !== null).sort((a, b) => b.date.localeCompare(a.date)));
const specialDays = computed(() => entries.value.filter((entry) => entry.specialDay !== null).sort((a, b) => b.date.localeCompare(a.date)));
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
        : `${formatDate(date)} · записи нет`
    };
  });
  return [...blanks, ...monthDays];
});
const monthWeekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const review = reactive<MonthlyReview>(emptyMonthlyReview(start.value));

function loadReview() {
  const existing = store.reviewByMonth(start.value);
  Object.assign(review, emptyMonthlyReview(start.value), existing ? plainCopy(existing) : {});
}

watch(start, loadReview, { immediate: true });

async function saveReview() {
  await store.saveMonthlyReview(plainCopy(review));
  notifySaved('Итог месяца сохранён');
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
  const withoutFactor = factor.averageSleepWithout === null ? '—' : `${formatMinutes(Math.round(factor.averageSleepWithout))} · ${factor.sleepSamplesWithout} дн.`;
  return `${withFactor} / ${withoutFactor}`;
}

function factorEnergyText(factor: (typeof factors.value)[number]): string {
  if (factor.averageEnergy === null) return '—';
  const withFactor = `${factor.averageEnergy.toFixed(1).replace('.0', '')} · ${factor.energySamples} дн.`;
  const withoutFactor = factor.averageEnergyWithout === null ? '—' : `${factor.averageEnergyWithout.toFixed(1).replace('.0', '')} · ${factor.energySamplesWithout} дн.`;
  return `${withFactor} / ${withoutFactor}`;
}

function sleepRegularityText(): string {
  const variation = Math.max(summary.value.bedtimeVariationMinutes ?? 0, summary.value.wakeTimeVariationMinutes ?? 0);
  if (summary.value.sleepTimingSamples < 2) return `${summary.value.sleepSamples} ночей с длительностью`;
  return `${summary.value.sleepTimingSamples} ночей со временем · разброс около ${variation} мин.`;
}

function scatterRows(kind: 'still' | 'movement' | 'special') {
  return energySleepEntries.value
    .filter((entry) => {
      if (kind === 'special') return Boolean(entry.specialDay);
      if (kind === 'movement') return !entry.specialDay && hasMovement(entry);
      return !entry.specialDay && !hasMovement(entry);
    })
    .map((entry) => ({
      value: [minutesToHours(entry.sleepMinutes) ?? 0, entry.energy],
      date: entry.date,
      sleepMinutes: entry.sleepMinutes,
      energy: entry.energy,
      movement: hasMovement(entry),
      specialDay: entry.specialDay
    }));
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

function formatScatterTooltip(params: unknown): string {
  const data = (params as { data?: { date?: string; sleepMinutes?: number | null; energy?: number | null; movement?: boolean; specialDay?: string | null } }).data;
  if (!data) return '';
  return [
    data.date ? formatDate(data.date) : '',
    `сон: ${formatMinutes(data.sleepMinutes ?? null)}`,
    `энергия: ${data.energy ?? '—'}/5`,
    data.movement ? 'было движение' : 'без движения',
    data.specialDay ? specialDayLabel(data.specialDay) : ''
  ].filter(Boolean).join('<br />');
}

function shiftMonth(offset: number) {
  const date = fromDateKey(anchor.value);
  date.setMonth(date.getMonth() + offset, 1);
  anchor.value = toDateKey(date);
}

function createPackage() {
  return buildPeriodPackage('month', anchor.value, {
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
  notifySaved('Промпт для GPT скопирован');
}

function downloadJson() {
  downloadAiPackage(createPackage());
  notifyInfo('Пакет месяца скачан');
}
</script>

<template>
  <section class="page">
    <div class="page-heading"><div><span class="eyebrow">Месячная сводка</span><h1>Месяц</h1><p>Результаты, состояние и контекст месяца без общей оценки.</p></div></div>
    <PeriodNavigator
      :title="formatDate(start, { month: 'long', year: 'numeric' })"
      :subtitle="start === startOfMonth(todayKey()) ? 'Текущий месяц' : ''"
      @previous="shiftMonth(-1)" @next="shiftMonth(1)" @current="anchor = todayKey()"
    />

    <div class="metrics-grid">
      <MetricCard label="Содержательных дней" :value="summary.coveredEntriesCount" :hint="`${summary.ordinaryCoreEntriesCount} с основными данными`" accent="#5865db" />
      <MetricCard label="Средний сон" :value="formatMinutes(summary.averageSleep === null ? null : Math.round(summary.averageSleep))" :hint="`${summary.sleepSamples} дн. без особых`" accent="#7367f0" />
      <MetricCard label="Карьерный контакт" :value="summary.externalSteps" hint="дней с внешней отметкой" accent="#4188e8" />
      <MetricCard label="Направление" :value="`${summary.externalActionDays}/${summary.preparationDays}`" :hint="`наружу / подготовка · ${summary.actionDirectionSamples} дн.`" accent="#5264d8" />
      <MetricCard label="Питание" :value="`${summary.nutritionSupportDays}/${summary.nutritionBlockDays}`" :hint="summary.averageWeightKg === null ? `${summary.nutritionSamples} дн. с отметкой` : `вес ${summary.averageWeightKg.toFixed(1).replace('.0', '')} кг · ${summary.weightSamples} изм.`" accent="#d39b2f" />
      <MetricCard label="Особых дней" :value="summary.specialDays" :hint="`${results.length} результатов`" accent="#eb7458" />
    </div>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Карта месяца</span><h2>Энергия, сон и контекст по дням</h2></div></div>
      <div class="month-calendar">
        <div v-for="weekday in monthWeekdays" :key="weekday" class="month-calendar__head">{{ weekday }}</div>
        <article
          v-for="day in monthCalendarDays"
          :key="day.id"
          class="month-day"
          :class="day.blank ? 'month-day--blank' : [`month-day--${day.energyLevel}`, { 'month-day--short-sleep': day.hasShortSleep, 'month-day--special': day.entry?.specialDay }]"
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
        <span><i class="legend-dot legend-dot--career"></i>карьера</span>
        <span><i class="legend-dot legend-dot--direction"></i>внешний шаг</span>
        <span><i class="legend-dot legend-dot--drift"></i>в сторону</span>
        <span><i class="legend-dot legend-dot--movement"></i>движение</span>
        <span><i class="legend-dot legend-dot--nutrition"></i>питание поддержало</span>
        <span><i class="legend-dot legend-dot--nutrition-block"></i>питание мешало</span>
        <span><i class="legend-dot legend-dot--special"></i>особый день</span>
      </div>
    </article>

    <article class="review-card">
      <div class="section-heading"><div><span class="eyebrow">Сохранить вывод</span><h2>Итог месяца</h2></div><small>{{ formatDate(end, { day: 'numeric', month: 'long' }) }}</small></div>
      <label class="field-label">Главный повторяющийся паттерн</label><textarea v-model="review.mainPattern" rows="2" placeholder="Что устойчиво повторялось в данных и контексте"></textarea>
      <label class="field-label">Что поддерживало?</label><textarea v-model="review.support" rows="2" placeholder="Условия, решения или люди, которые помогали"></textarea>
      <label class="field-label">Что мешало сильнее всего?</label><textarea v-model="review.obstacle" rows="2" placeholder="Один главный повторяющийся фактор"></textarea>
      <label class="field-label">Что изменило курс?</label><textarea v-model="review.courseChange" rows="2" placeholder="Событие, решение или результат, после которого траектория изменилась"></textarea>
      <label class="field-label">Фокус следующего месяца</label><textarea v-model="review.nextFocus" rows="2" placeholder="Одно направление и наблюдаемый результат"></textarea>
      <label class="field-label">План если-то</label><textarea v-model="review.ifThenPlan" rows="2" placeholder="Если появится конкретный фактор, то я сделаю конкретное действие"></textarea>
      <button class="primary-button" type="button" @click="saveReview">Сохранить итог месяца</button>
    </article>

    <article class="dashboard-card">
      <div class="section-heading">
        <div><span class="eyebrow">Разбор без ИИ</span><h2>Месячный обзор</h2></div>
        <div class="period-actions">
          <button class="secondary-button" type="button" @click="copyPrompt">Скопировать промпт</button>
          <button class="secondary-button" type="button" @click="downloadJson">Скачать пакет</button>
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
      <div class="section-heading"><div><span class="eyebrow">Автоматические наблюдения</span><h2>Что видно по данным</h2></div></div>
      <div class="observation-grid">
        <article v-for="observation in observations" :key="observation.id" class="observation-card">
          <strong>{{ observation.title }}</strong>
          <p>{{ observation.text }}</p>
        </article>
      </div>
    </article>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Сон обычных дней</span><h2>Динамика сна</h2></div><small>{{ sleepRegularityText() }}</small></div>
      <EChartPanel v-if="sleepEntries.length" :option="sleepEnergyOption" :height="320" aria-label="Динамика сна, времени в кровати и энергии" />
      <div v-else class="empty-chart">Добавь данные о сне — здесь появится динамика.</div>
    </article>

    <article v-if="weightEntries.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Вес</span><h2>Измерения и семидневный тренд</h2></div><small>особые дни исключены</small></div>
      <EChartPanel :option="weightOption" :height="280" aria-label="Вес и среднее значение за семь дней" />
    </article>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Связь показателей</span><h2>Сон, энергия и движение</h2></div><small>точки: дни</small></div>
      <EChartPanel v-if="energySleepEntries.length" :option="energySleepOption" :height="320" aria-label="Связь сна, энергии и движения" />
      <div v-else class="empty-chart">Когда появятся сон и энергия за несколько дней, здесь будет видна связь.</div>
      <p v-if="energySleepEntries.length" class="data-note">Точки показывают совпадение показателей в один день. Они не доказывают, что движение вызвало энергию или наоборот.</p>
    </article>

    <article v-if="summary.externalActionDays || summary.preparationDays || summary.driftDays" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Контакт с реальностью</span><h2>Направление действий</h2></div><small>дни месяца</small></div>
      <EChartPanel :option="actionDirectionOption" :height="280" aria-label="Распределение направления действий за месяц" />
    </article>

    <article v-if="factors.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Факторы состояния</span><h2>Что повторялось перед сном</h2></div><span class="count-badge">{{ factors.length }}</span></div>
      <div class="factor-summary-head">
        <span>фактор</span><span>дни</span><span>сон: с / без</span><span>энергия: с / без</span>
      </div>
      <div class="factor-summary-list">
        <article v-for="factor in factors" :key="factor.id" class="factor-summary-item">
          <span class="factor-summary-item__name"><i>{{ factor.icon }}</i>{{ factor.label }}</span>
          <strong>{{ factor.count }}</strong>
          <small>{{ factorSleepText(factor) }}</small>
          <small>{{ factorEnergyText(factor) }}</small>
        </article>
      </div>
    </article>

    <div class="month-layout">
      <article class="dashboard-card">
        <div class="section-heading"><div><span class="eyebrow">Сколько дней появлялось</span><h2>Области жизни</h2></div></div>
        <div class="coverage-list">
          <div v-for="area in activeAreas" :key="area.id" class="coverage-row">
            <span class="coverage-row__label"><i>{{ area.icon }}</i>{{ area.label }}</span>
            <div class="coverage-row__track"><span :style="{ width: `${summary.lifeAreaSamples ? ((summary.areaCounts[area.id] ?? 0) / summary.lifeAreaSamples) * 100 : 0}%` }"></span></div>
            <strong>{{ summary.areaCounts[area.id] ?? 0 }}/{{ summary.lifeAreaSamples }}</strong>
          </div>
        </div>
      </article>

      <article class="dashboard-card">
        <div class="section-heading"><div><span class="eyebrow">Завершённые вещи</span><h2>Результаты месяца</h2></div><span class="count-badge">{{ results.length }}</span></div>
        <ul v-if="results.length" class="compact-results"><li v-for="result in results" :key="result.id"><span>✓</span><div>{{ result.title }}<small>{{ formatDate(result.date, { day: 'numeric', month: 'short' }) }}</small></div></li></ul>
        <div v-else class="empty-state empty-state--compact"><p>Пока нет зафиксированных результатов.</p></div>
      </article>
    </div>

    <article v-if="actionNotes.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Проверка направления</span><h2>Контакт с реальностью</h2></div><span class="count-badge">{{ actionNotes.length }}</span></div>
      <div class="note-list note-list--columns">
        <article v-for="entry in actionNotes" :key="entry.date" class="note-item">
          <time>{{ formatDate(entry.date, { day: 'numeric', month: 'short' }) }}</time>
          <p><strong>{{ actionDirectionLabel(entry.actionDirection) }}</strong><span v-if="entry.focusTitle"><br />Фокус: {{ entry.focusTitle }}</span><span v-if="entry.actionNote"><br />{{ entry.actionNote }}</span></p>
        </article>
      </div>
    </article>

    <article v-if="lifeEvents.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Длинная дуга</span><h2>События из архива</h2></div><span class="count-badge">{{ lifeEvents.length }}</span></div>
      <div class="note-list note-list--columns">
        <article v-for="event in lifeEvents" :key="event.id" class="note-item">
          <time>{{ formatDate(event.date, { day: 'numeric', month: 'short' }) }}</time>
          <p><strong>{{ event.title }}</strong><span v-if="event.note"><br />{{ event.note }}</span></p>
        </article>
      </div>
    </article>

    <article v-if="stateNotes.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Контекст состояния</span><h2>Сон и энергия</h2></div><span class="count-badge">{{ stateNotes.length }}</span></div>
      <div class="note-list note-list--columns">
        <article v-for="entry in stateNotes" :key="entry.date" class="note-item">
          <time>{{ formatDate(entry.date, { day: 'numeric', month: 'short' }) }}</time>
          <p>{{ entry.stateContext }}</p>
        </article>
      </div>
    </article>

    <article v-if="specialDays.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Поправка на контекст</span><h2>Особые дни месяца</h2></div><span class="count-badge">{{ specialDays.length }}</span></div>
      <div class="special-day-list special-day-list--columns">
        <article v-for="entry in specialDays" :key="entry.date" class="special-day-item">
          <time>{{ formatDate(entry.date, { day: 'numeric', month: 'short' }) }}</time>
          <strong>{{ specialDayLabel(entry.specialDay) }}</strong>
          <p v-if="entry.specialDayNote">{{ entry.specialDayNote }}</p>
        </article>
      </div>
    </article>
  </section>
</template>
