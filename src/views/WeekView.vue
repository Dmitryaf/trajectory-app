<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import MetricCard from '../components/MetricCard.vue';
import PeriodNavigator from '../components/PeriodNavigator.vue';
import { buildReviewCues, buildReviewQuestions, entriesForWeek, eveningFactorLabel, hasArea, resultsForPeriod, specialDayLabel, summarize, weekSummaryText } from '../services/analytics';
import { addDays, endOfWeek, formatDate, formatMinutes, startOfWeek, todayKey } from '../services/dates';
import { plainCopy } from '../services/plain';
import { useAppStore } from '../stores/app';
import { emptyWeeklyReview, lifeAreaOptions, type WeeklyReview } from '../types';

const store = useAppStore();
const anchor = ref(todayKey());
const saved = ref(false);
const start = computed(() => startOfWeek(anchor.value));
const end = computed(() => endOfWeek(anchor.value));
const days = computed(() => Array.from({ length: 7 }, (_, index) => addDays(start.value, index)));
const entries = computed(() => entriesForWeek(store.dailyEntries, anchor.value));
const entriesByDate = computed(() => new Map(entries.value.map((entry) => [entry.date, entry])));
const lifeAreaItems = computed(() => [...lifeAreaOptions, ...store.settings.customLifeAreaOptions]);
const externalCareerIds = computed(() => ['external', 'interview', 'result', ...store.settings.customCareerOptions.filter((option) => option.countsAsExternal).map((option) => option.id)]);
const summary = computed(() => summarize(entries.value, externalCareerIds.value));
const results = computed(() => resultsForPeriod(store.results, start.value, end.value));
const lifeEvents = computed(() => store.lifeEvents.filter((event) => event.date >= start.value && event.date <= end.value).sort((a, b) => b.date.localeCompare(a.date)));
const reviewCues = computed(() => buildReviewCues('week', entries.value, results.value, lifeEvents.value, externalCareerIds.value));
const reviewQuestions = buildReviewQuestions('week');
const rows = computed(() => [
  { id: 'career', label: 'Карьера', icon: '↗' },
  { id: 'sport', label: 'Спорт', icon: '△' },
  ...lifeAreaItems.value.filter((option) => store.settings.activeLifeAreas.includes(option.id))
]);
const summaryText = computed(() => weekSummaryText(summary.value, store.settings.activeLifeAreas, lifeAreaItems.value));
const stateNotes = computed(() => entries.value.filter((entry) => entry.stateContext.trim()).sort((a, b) => a.date.localeCompare(b.date)));
const factorNotes = computed(() => entries.value.filter((entry) => entry.eveningFactors.length).sort((a, b) => a.date.localeCompare(b.date)));
const specialDays = computed(() => entries.value.filter((entry) => entry.specialDay !== null).sort((a, b) => a.date.localeCompare(b.date)));
const review = reactive<WeeklyReview>(emptyWeeklyReview(start.value));

function loadReview() {
  const existing = store.reviewByWeek(start.value);
  Object.assign(review, emptyWeeklyReview(start.value), existing ? plainCopy(existing) : {});
  saved.value = false;
}
watch(start, loadReview, { immediate: true });

async function saveReview() {
  await store.saveReview(plainCopy(review));
  saved.value = true;
  window.setTimeout(() => (saved.value = false), 1800);
}
</script>

<template>
  <section class="page">
    <div class="page-heading"><div><span class="eyebrow">Автоматический обзор</span><h1>Неделя</h1><p>Что действительно происходило, без общего балла.</p></div></div>
    <PeriodNavigator
      :title="`${formatDate(start, { day: 'numeric', month: 'short' })} — ${formatDate(end, { day: 'numeric', month: 'short' })}`"
      :subtitle="start === startOfWeek(todayKey()) ? 'Текущая неделя' : ''"
      @previous="anchor = addDays(anchor, -7)" @next="anchor = addDays(anchor, 7)" @current="anchor = todayKey()"
    />

    <div class="metrics-grid">
      <MetricCard label="Средний сон" :value="formatMinutes(summary.averageSleep === null ? null : Math.round(summary.averageSleep))" accent="#7367f0" />
      <MetricCard label="Карьерных дней" :value="summary.careerDays" :hint="`${summary.externalSteps} внешних шагов`" accent="#4188e8" />
      <MetricCard label="Тренировок" :value="summary.sportSessions" accent="#38b989" />
      <MetricCard label="Результатов" :value="results.length" accent="#f0ad42" />
    </div>

    <article class="insight-card"><span class="insight-card__mark">⌁</span><p>{{ summaryText }}</p></article>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Без ИИ</span><h2>На что смотреть в обзоре</h2></div></div>
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

    <article v-if="specialDays.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Поправка на контекст</span><h2>Особые дни</h2></div><span class="count-badge">{{ specialDays.length }}</span></div>
      <div class="special-day-list">
        <article v-for="entry in specialDays" :key="entry.date" class="special-day-item">
          <time>{{ formatDate(entry.date, { weekday: 'short', day: 'numeric' }) }}</time>
          <strong>{{ specialDayLabel(entry.specialDay) }}</strong>
          <p v-if="entry.specialDayNote">{{ entry.specialDayNote }}</p>
        </article>
      </div>
    </article>

    <article v-if="stateNotes.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Контекст состояния</span><h2>Что влияло на сон и энергию</h2></div><span class="count-badge">{{ stateNotes.length }}</span></div>
      <div class="note-list">
        <article v-for="entry in stateNotes" :key="entry.date" class="note-item">
          <time>{{ formatDate(entry.date, { weekday: 'short', day: 'numeric' }) }}</time>
          <p>{{ entry.stateContext }}</p>
        </article>
      </div>
    </article>

    <article v-if="factorNotes.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Вечерние факторы</span><h2>Что могло влиять</h2></div><span class="count-badge">{{ factorNotes.length }}</span></div>
      <div class="factor-note-list">
        <article v-for="entry in factorNotes" :key="entry.date" class="factor-note-item">
          <time>{{ formatDate(entry.date, { weekday: 'short', day: 'numeric' }) }}</time>
          <div>
            <span v-for="factor in entry.eveningFactors" :key="factor" class="mini-pill">{{ eveningFactorLabel(factor) }}</span>
            <p v-if="entry.eveningFactorNote">{{ entry.eveningFactorNote }}</p>
          </div>
        </article>
      </div>
    </article>

    <article class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Присутствие областей</span><h2>Карта недели</h2></div></div>
      <div class="heatmap" :style="{ '--day-count': days.length }">
        <div class="heatmap__corner"></div>
        <div v-for="day in days" :key="day" class="heatmap__day"><strong>{{ formatDate(day, { weekday: 'short' }) }}</strong><small>{{ formatDate(day, { day: '2-digit' }) }}</small></div>
        <template v-for="row in rows" :key="row.id">
          <div class="heatmap__label"><span>{{ row.icon }}</span>{{ row.label }}</div>
          <div v-for="day in days" :key="`${row.id}-${day}`" class="heatmap__cell" :class="{ active: hasArea(entriesByDate.get(day), row.id) }"><span></span></div>
        </template>
      </div>
    </article>

    <article v-if="results.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Законченные вещи</span><h2>Результаты недели</h2></div></div>
      <ul class="compact-results"><li v-for="result in results" :key="result.id"><span>✓</span>{{ result.title }}</li></ul>
    </article>

    <article v-if="lifeEvents.length" class="dashboard-card">
      <div class="section-heading"><div><span class="eyebrow">Длинная дуга</span><h2>События из архива</h2></div><span class="count-badge">{{ lifeEvents.length }}</span></div>
      <div class="note-list">
        <article v-for="event in lifeEvents" :key="event.id" class="note-item">
          <time>{{ formatDate(event.date, { weekday: 'short', day: 'numeric' }) }}</time>
          <p><strong>{{ event.title }}</strong><span v-if="event.note"><br />{{ event.note }}</span></p>
        </article>
      </div>
    </article>

    <article class="review-card">
      <div class="section-heading"><div><span class="eyebrow">До 10 минут</span><h2>Короткий обзор</h2></div></div>
      <label class="field-label">Три факта, почему неделя прошла не зря</label>
      <input v-for="(_, index) in review.results" :key="index" v-model="review.results[index]" type="text" :placeholder="`${index + 1}. Результат или значимый факт`" />
      <label class="field-label">Что поддержало?</label><textarea v-model="review.support" rows="2" placeholder="Люди, режим, место, привычка или решение, которое помогло"></textarea>
      <label class="field-label">Что сильнее всего мешало?</label><textarea v-model="review.obstacle" rows="2" placeholder="Один главный фактор"></textarea>
      <label class="field-label">Какой один рычаг меняем?</label><textarea v-model="review.nextLever" rows="2" placeholder="Одно конкретное изменение на следующую неделю"></textarea>
      <button class="primary-button" type="button" @click="saveReview">{{ saved ? 'Сохранено ✓' : 'Сохранить обзор' }}</button>
    </article>
  </section>
</template>
