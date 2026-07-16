<script setup lang="ts">
import { computed, ref } from 'vue';
import MetricCard from '../components/MetricCard.vue';
import PeriodNavigator from '../components/PeriodNavigator.vue';
import { entriesForMonth, resultsForPeriod, summarize } from '../services/analytics';
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
const results = computed(() => resultsForPeriod(store.results, start.value, end.value));
const sleepEntries = computed(() => [...entries.value].filter((entry) => entry.sleepMinutes !== null).sort((a, b) => a.date.localeCompare(b.date)));
const stateNotes = computed(() => entries.value.filter((entry) => entry.stateContext.trim()).sort((a, b) => b.date.localeCompare(a.date)));
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
      <MetricCard label="Результатов" :value="results.length" accent="#f0ad42" />
    </div>

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

    <article v-if="stateNotes.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Мешающие факторы</span><h2>Контекст сна и состояния</h2></div><span class="count-badge">{{ stateNotes.length }}</span></div>
      <div class="note-list note-list--columns">
        <article v-for="entry in stateNotes" :key="entry.date" class="note-item">
          <time>{{ formatDate(entry.date, { day: 'numeric', month: 'short' }) }}</time>
          <p>{{ entry.stateContext }}</p>
        </article>
      </div>
    </article>
  </section>
</template>
