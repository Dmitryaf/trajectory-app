<script setup lang="ts">
import { computed, ref } from 'vue';
import EnergySleepScatter from '../components/charts/EnergySleepScatter.vue';
import SleepBarChart from '../components/charts/SleepBarChart.vue';
import MetricCard from '../components/MetricCard.vue';
import PeriodNavigator from '../components/PeriodNavigator.vue';
import { actionDirectionLabel, buildObservations, buildReviewCues, buildReviewQuestions, entriesForMonth, factorSummaries, hasMovement, resultsForPeriod, specialDayLabel, summarize } from '../services/analytics';
import { dateRange, endOfMonth, formatDate, formatMinutes, fromDateKey, startOfMonth, todayKey, toDateKey } from '../services/dates';
import { buildPeriodPackage, copyAiPrompt as copyPackagePrompt, downloadAiPackage } from '../services/exportPackage';
import { useAppStore } from '../stores/app';
import { lifeAreaOptions } from '../types';

const store = useAppStore();
const anchor = ref(todayKey());
const exportStatus = ref('');
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
const sleepEntries = computed(() => [...entries.value].filter((entry) => entry.sleepMinutes !== null).sort((a, b) => a.date.localeCompare(b.date)));
const energySleepEntries = computed(() => entries.value.filter((entry) => entry.sleepMinutes !== null && entry.energy !== null).sort((a, b) => a.date.localeCompare(b.date)));
const sleepChartData = computed(() => sleepEntries.value.map((entry) => ({
  key: entry.date,
  label: formatDate(entry.date, { day: 'numeric' }),
  value: entry.sleepMinutes,
  title: `${formatDate(entry.date)}: ${formatMinutes(entry.sleepMinutes)}`
})));
const energySleepPoints = computed(() => energySleepEntries.value.map((entry) => ({
  key: entry.date,
  sleepMinutes: entry.sleepMinutes ?? 0,
  energy: entry.energy ?? 1,
  hasMovement: hasMovement(entry),
  isSpecial: Boolean(entry.specialDay),
  title: `${formatDate(entry.date)} · сон ${formatMinutes(entry.sleepMinutes)} · энергия ${entry.energy}${hasMovement(entry) ? ' · было движение' : ''}${entry.specialDay ? ` · ${specialDayLabel(entry.specialDay)}` : ''}`
})));
const stateNotes = computed(() => entries.value.filter((entry) => entry.stateContext.trim()).sort((a, b) => b.date.localeCompare(a.date)));
const actionNotes = computed(() => entries.value.filter((entry) => entry.actionDirection !== null).sort((a, b) => b.date.localeCompare(a.date)));
const specialDays = computed(() => entries.value.filter((entry) => entry.specialDay !== null).sort((a, b) => b.date.localeCompare(a.date)));
const lifeAreaItems = computed(() => [...lifeAreaOptions, ...store.settings.customLifeAreaOptions]);
const activeAreas = computed(() => lifeAreaItems.value.filter((option) => store.settings.activeLifeAreas.includes(option.id)));
const maxAreaCount = computed(() => Math.max(1, ...activeAreas.value.map((area) => summary.value.areaCounts[area.id] ?? 0)));
const entriesByDate = computed(() => new Map(entries.value.map((entry) => [entry.date, entry])));
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
      hasCareer: Boolean(entry?.careerState),
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
    settings: store.settings
  });
}

async function copyPrompt() {
  await copyPackagePrompt(createPackage(), store.settings);
  showExportStatus('Промпт для GPT скопирован');
}

function downloadJson() {
  downloadAiPackage(createPackage());
  showExportStatus('Пакет месяца скачан');
}

function showExportStatus(message: string) {
  exportStatus.value = message;
  window.setTimeout(() => (exportStatus.value = ''), 1800);
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
      <MetricCard label="Заполнено дней" :value="summary.entriesCount" accent="#5865db" />
      <MetricCard label="Средний сон" :value="formatMinutes(summary.averageSleep === null ? null : Math.round(summary.averageSleep))" :hint="summary.averageSleepEfficiency === null ? '' : `доля сна ${Math.round(summary.averageSleepEfficiency)}%`" accent="#7367f0" />
      <MetricCard label="Внешних шагов" :value="summary.externalSteps" accent="#4188e8" />
      <MetricCard label="Направление" :value="`${summary.externalActionDays}/${summary.preparationDays}`" hint="наружу / подготовка" accent="#5264d8" />
      <MetricCard label="Питание" :value="`${summary.nutritionSupportDays}/${summary.nutritionBlockDays}`" :hint="summary.averageWeightKg === null ? 'поддержало / мешало' : `вес ${summary.averageWeightKg.toFixed(1).replace('.0', '')} кг`" accent="#d39b2f" />
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

    <article class="dashboard-card">
      <div class="section-heading">
        <div><span class="eyebrow">Разбор без ИИ</span><h2>Месячный обзор</h2></div>
        <div class="period-actions">
          <button class="secondary-button" type="button" @click="copyPrompt">Скопировать промпт</button>
          <button class="secondary-button" type="button" @click="downloadJson">Скачать пакет</button>
        </div>
      </div>
      <p v-if="exportStatus" class="settings-status">{{ exportStatus }}</p>
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
      <div class="section-heading"><div><span class="eyebrow">Сон</span><h2>Динамика сна</h2></div><small>0–12 часов</small></div>
      <SleepBarChart v-if="sleepEntries.length" :data="sleepChartData" />
      <div v-else class="empty-chart">Добавь данные о сне — здесь появится динамика.</div>
    </article>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Связь показателей</span><h2>Сон, энергия и движение</h2></div><small>точки: дни</small></div>
      <EnergySleepScatter v-if="energySleepEntries.length" :points="energySleepPoints" />
      <div v-else class="empty-chart">Когда появятся сон и энергия за несколько дней, здесь будет видна связь.</div>
      <div class="chart-legend">
        <span><i class="legend-dot"></i>без движения</span>
        <span><i class="legend-dot legend-dot--movement"></i>с движением</span>
        <span><i class="legend-dot legend-dot--special"></i>особый день</span>
      </div>
    </article>

    <article v-if="factors.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Факторы состояния</span><h2>Что повторялось перед сном</h2></div><span class="count-badge">{{ factors.length }}</span></div>
      <div class="factor-summary-head">
        <span>фактор</span><span>дни</span><span>сон</span><span>энергия</span>
      </div>
      <div class="factor-summary-list">
        <article v-for="factor in factors" :key="factor.id" class="factor-summary-item">
          <span class="factor-summary-item__name"><i>{{ factor.icon }}</i>{{ factor.label }}</span>
          <strong>{{ factor.count }}</strong>
          <small>{{ formatMinutes(factor.averageSleep === null ? null : Math.round(factor.averageSleep)) }}</small>
          <small>{{ factor.averageEnergy === null ? '—' : `${factor.averageEnergy.toFixed(1).replace('.0', '')}/5` }}</small>
        </article>
      </div>
    </article>

    <div class="month-layout">
      <article class="dashboard-card">
        <div class="section-heading"><div><span class="eyebrow">Сколько дней появлялось</span><h2>Области жизни</h2></div></div>
        <div class="coverage-list">
          <div v-for="area in activeAreas" :key="area.id" class="coverage-row">
            <span class="coverage-row__label"><i>{{ area.icon }}</i>{{ area.label }}</span>
            <div class="coverage-row__track"><span :style="{ width: `${((summary.areaCounts[area.id] ?? 0) / maxAreaCount) * 100}%` }"></span></div>
            <strong>{{ summary.areaCounts[area.id] ?? 0 }}</strong>
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
          <p><strong>{{ actionDirectionLabel(entry.actionDirection) }}</strong><span v-if="entry.actionNote"><br />{{ entry.actionNote }}</span></p>
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
