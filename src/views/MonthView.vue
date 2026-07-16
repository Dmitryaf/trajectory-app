<script setup lang="ts">
import { computed, ref } from 'vue';
import MetricCard from '../components/MetricCard.vue';
import PeriodNavigator from '../components/PeriodNavigator.vue';
import { buildObservations, buildReviewCues, buildReviewQuestions, entriesForMonth, factorSummaries, hasMovement, resultsForPeriod, specialDayLabel, summarize } from '../services/analytics';
import { addDays, endOfMonth, formatDate, formatMinutes, fromDateKey, startOfMonth, todayKey, toDateKey } from '../services/dates';
import { useAppStore } from '../stores/app';
import { lifeAreaOptions } from '../types';

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
const sleepEntries = computed(() => [...entries.value].filter((entry) => entry.sleepMinutes !== null).sort((a, b) => a.date.localeCompare(b.date)));
const energySleepEntries = computed(() => entries.value.filter((entry) => entry.sleepMinutes !== null && entry.energy !== null).sort((a, b) => a.date.localeCompare(b.date)));
const stateNotes = computed(() => entries.value.filter((entry) => entry.stateContext.trim()).sort((a, b) => b.date.localeCompare(a.date)));
const specialDays = computed(() => entries.value.filter((entry) => entry.specialDay !== null).sort((a, b) => b.date.localeCompare(a.date)));
const lifeAreaItems = computed(() => [...lifeAreaOptions, ...store.settings.customLifeAreaOptions]);
const activeAreas = computed(() => lifeAreaItems.value.filter((option) => store.settings.activeLifeAreas.includes(option.id)));
const maxAreaCount = computed(() => Math.max(1, ...activeAreas.value.map((area) => summary.value.areaCounts[area.id] ?? 0)));

function shiftMonth(offset: number) {
  const date = fromDateKey(anchor.value);
  date.setMonth(date.getMonth() + offset, 1);
  anchor.value = toDateKey(date);
}
</script>

<template>
  <section class="page">
    <div class="page-heading"><div><span class="eyebrow">Агрегация недель</span><h1>Месяц</h1><p>Динамика и законченные результаты — без отдельной системы нормативов.</p></div></div>
    <PeriodNavigator
      :title="formatDate(start, { month: 'long', year: 'numeric' })"
      :subtitle="start === startOfMonth(todayKey()) ? 'Текущий месяц' : ''"
      @previous="shiftMonth(-1)" @next="shiftMonth(1)" @current="anchor = todayKey()"
    />

    <div class="metrics-grid">
      <MetricCard label="Заполнено дней" :value="summary.entriesCount" accent="#5865db" />
      <MetricCard label="Средний сон" :value="formatMinutes(summary.averageSleep === null ? null : Math.round(summary.averageSleep))" accent="#7367f0" />
      <MetricCard label="Внешних шагов" :value="summary.externalSteps" accent="#4188e8" />
      <MetricCard label="Особых дней" :value="summary.specialDays" :hint="`${results.length} результатов`" accent="#eb7458" />
    </div>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Без ИИ</span><h2>Месячный разбор</h2></div></div>
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
      <div class="section-heading"><div><span class="eyebrow">Не цель, а состояние</span><h2>Продолжительность сна</h2></div><small>0–12 часов</small></div>
      <div v-if="sleepEntries.length" class="bar-chart">
        <div v-for="entry in sleepEntries" :key="entry.date" class="bar-chart__item" :title="`${formatDate(entry.date)}: ${formatMinutes(entry.sleepMinutes)}`">
          <div class="bar-chart__bar" :style="{ height: `${Math.min(100, ((entry.sleepMinutes ?? 0) / 720) * 100)}%` }"></div>
          <small>{{ formatDate(entry.date, { day: 'numeric' }) }}</small>
        </div>
      </div>
      <div v-else class="empty-chart">Добавь данные о сне — здесь появится динамика.</div>
    </article>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Связь показателей</span><h2>Сон, энергия и движение</h2></div><small>точки: дни</small></div>
      <div v-if="energySleepEntries.length" class="scatter-chart" aria-label="График связи сна, энергии и движения">
        <div class="scatter-chart__axis scatter-chart__axis--y">энергия</div>
        <div class="scatter-chart__axis scatter-chart__axis--x">сон</div>
        <span v-for="level in [5, 4, 3, 2, 1]" :key="level" class="scatter-chart__tick" :style="{ bottom: `${((level - 1) / 4) * 100}%` }">{{ level }}</span>
        <button
          v-for="entry in energySleepEntries"
          :key="entry.date"
          type="button"
          class="scatter-chart__point"
          :class="{ 'scatter-chart__point--movement': hasMovement(entry), 'scatter-chart__point--special': entry.specialDay }"
          :style="{ left: `${Math.min(100, ((entry.sleepMinutes ?? 0) / 720) * 100)}%`, bottom: `${(((entry.energy ?? 1) - 1) / 4) * 100}%` }"
          :title="`${formatDate(entry.date)} · сон ${formatMinutes(entry.sleepMinutes)} · энергия ${entry.energy}${hasMovement(entry) ? ' · было движение' : ''}${entry.specialDay ? ` · ${specialDayLabel(entry.specialDay)}` : ''}`"
          :aria-label="`${formatDate(entry.date)}: сон ${formatMinutes(entry.sleepMinutes)}, энергия ${entry.energy}`"
        ></button>
      </div>
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
        <div class="section-heading"><div><span class="eyebrow">Ответ на главный вопрос</span><h2>Результаты месяца</h2></div><span class="count-badge">{{ results.length }}</span></div>
        <ul v-if="results.length" class="compact-results"><li v-for="result in results" :key="result.id"><span>✓</span><div>{{ result.title }}<small>{{ formatDate(result.date, { day: 'numeric', month: 'short' }) }}</small></div></li></ul>
        <div v-else class="empty-state empty-state--compact"><p>Пока нет зафиксированных результатов.</p></div>
      </article>
    </div>

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
      <div class="section-heading"><div><span class="eyebrow">Мешающие факторы</span><h2>Контекст сна и состояния</h2></div><span class="count-badge">{{ stateNotes.length }}</span></div>
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
