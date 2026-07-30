<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { EChartsCoreOption } from 'echarts/core';
import EChartPanel from '../components/charts/EChartPanel.vue';
import MetricCard from '../components/MetricCard.vue';
import PeriodNavigator from '../components/PeriodNavigator.vue';
import {
  actionDirectionLabel,
  buildReviewCues,
  buildReviewQuestions,
  careerStatesForEntry,
  contextFactorLabel,
  entriesForWeek,
  hasArea,
  resultsForPeriod,
  specialDayLabel,
  summarize,
  weekSummaryText,
} from '../services/analytics';
import { addDays, endOfWeek, formatDate, formatMinutes, startOfWeek, todayKey } from '../services/dates';
import { buildPeriodPackage, copyAiPrompt as copyPackagePrompt, downloadAiPackage } from '../features/export/browser';
import { experimentDecisionLabel } from '../features/experiments/model';
import { notifyInfo, notifySaved, notifyUnknownError } from '../services/notifications';
import { plainCopy } from '../services/plain';
import { useAppStore } from '../stores/app';
import { contextFactorOptions, emptyWeeklyReview, lifeAreaOptions, type WeeklyReview } from '../types';

const store = useAppStore();
const anchor = ref(todayKey());
const start = computed(() => startOfWeek(anchor.value));
const end = computed(() => endOfWeek(anchor.value));
const days = computed(() => Array.from({ length: 7 }, (_, index) => addDays(start.value, index)));
const entries = computed(() => entriesForWeek(store.dailyEntries, anchor.value));
const entriesByDate = computed(() => new Map(entries.value.map((entry) => [entry.date, entry])));
const lifeAreaItems = computed(() => [...lifeAreaOptions, ...store.settings.customLifeAreaOptions]);
const contextFactorItems = computed(() => [...contextFactorOptions, ...store.settings.customContextFactorOptions]);
const externalCareerIds = computed(() => [
  'external',
  'interview',
  'result',
  ...store.settings.customCareerOptions.filter((option) => option.countsAsExternal).map((option) => option.id),
]);
const summary = computed(() => summarize(entries.value, externalCareerIds.value));
const results = computed(() => resultsForPeriod(store.results, start.value, end.value));
const lifeEvents = computed(() =>
  store.lifeEvents.filter((event) => event.date >= start.value && event.date <= end.value).sort((a, b) => b.date.localeCompare(a.date)),
);
const activeExperimentWeek = computed(() => {
  const experiment = store.settings.experiment;
  if (
    !experiment.active ||
    !experiment.startDate ||
    !experiment.endDate ||
    experiment.startDate > end.value ||
    experiment.endDate < start.value
  )
    return null;
  const experimentDays = days.value.filter((day) => day >= experiment.startDate && day <= experiment.endDate);
  const experimentEntries = entries.value.filter((entry) => entry.date >= experiment.startDate && entry.date <= experiment.endDate);
  const marked = experimentEntries.filter((entry) => entry.experimentCompleted !== null);
  return {
    experiment,
    plannedDays: experimentDays.length,
    completedDays: marked.filter((entry) => entry.experimentCompleted === true).length,
    notCompletedDays: marked.filter((entry) => entry.experimentCompleted === false).length,
    unmarkedDays: Math.max(0, experimentDays.length - marked.length),
  };
});
const completedExperiments = computed(() =>
  store.settings.experimentHistory.filter((experiment) => experiment.endDate >= start.value && experiment.endDate <= end.value),
);
const reviewCues = computed(() =>
  buildReviewCues('week', entries.value, results.value, lifeEvents.value, externalCareerIds.value, contextFactorItems.value),
);
const reviewQuestions = buildReviewQuestions('week');
const previousReview = computed(() => store.reviewByWeek(addDays(start.value, -7)));
const rows = computed(() => [
  { id: 'career', label: 'Карьера', icon: '↗' },
  { id: 'sport', label: 'Спорт', icon: '△' },
  ...lifeAreaItems.value.filter((option) => store.settings.activeLifeAreas.includes(option.id)),
]);
const summaryText = computed(() => weekSummaryText(summary.value, store.settings.activeLifeAreas, lifeAreaItems.value));
const contextNotes = computed(() =>
  entries.value.filter((entry) => entry.contextFactors.length || entry.contextNote.trim()).sort((a, b) => a.date.localeCompare(b.date)),
);
const actionNotes = computed(() =>
  entries.value.filter((entry) => entry.actionDirection !== null).sort((a, b) => a.date.localeCompare(b.date)),
);
const specialDays = computed(() => entries.value.filter((entry) => entry.specialDay !== null).sort((a, b) => a.date.localeCompare(b.date)));
const rhythmDays = computed(() =>
  days.value.map((day) => {
    const entry = entriesByDate.value.get(day);
    return {
      day,
      entry,
      hasCareer: entry ? careerStatesForEntry(entry).length > 0 : false,
      hasExternalAction: entry?.actionDirection === 'external',
      hasDrift: entry?.actionDirection === 'drift',
      hasMovement: Boolean(entry?.activities.some((activity) => activity !== 'recovery')),
      hasNutritionSupport: entry?.nutritionState === 'supports_goal',
      hasNutritionNeutral: entry?.nutritionState === 'neutral',
      hasNutritionBlock: entry?.nutritionState === 'blocks_goal',
    };
  }),
);
const rhythmOption = computed<EChartsCoreOption>(() => {
  const labels = rhythmDays.value.map((item) => formatDate(item.day, { weekday: 'short', day: '2-digit' }));
  const actionRows = ['Карьера', 'Реальный шаг', 'В сторону', 'Движение', 'Питание', 'Особый день'];
  const actionSeries = [
    { name: 'Карьера', row: 'Карьера', color: '#4188e8', active: (item: (typeof rhythmDays.value)[number]) => item.hasCareer },
    {
      name: 'Реальный шаг',
      row: 'Реальный шаг',
      color: '#5264d8',
      active: (item: (typeof rhythmDays.value)[number]) => item.hasExternalAction,
    },
    { name: 'В сторону', row: 'В сторону', color: '#b85c4c', active: (item: (typeof rhythmDays.value)[number]) => item.hasDrift },
    { name: 'Движение', row: 'Движение', color: '#38b989', active: (item: (typeof rhythmDays.value)[number]) => item.hasMovement },
    {
      name: 'Питание поддержало',
      row: 'Питание',
      color: '#38b989',
      active: (item: (typeof rhythmDays.value)[number]) => item.hasNutritionSupport,
    },
    {
      name: 'Питание нейтрально',
      row: 'Питание',
      color: '#d39b2f',
      active: (item: (typeof rhythmDays.value)[number]) => item.hasNutritionNeutral,
    },
    {
      name: 'Питание мешало',
      row: 'Питание',
      color: '#b85c4c',
      active: (item: (typeof rhythmDays.value)[number]) => item.hasNutritionBlock,
    },
    {
      name: 'Особый день',
      row: 'Особый день',
      color: '#eb7458',
      active: (item: (typeof rhythmDays.value)[number]) => Boolean(item.entry?.specialDay),
    },
  ];

  return {
    color: ['#7467e8', '#1d5148'],
    tooltip: { trigger: 'item' },
    legend: { data: ['Сон', 'Энергия'], top: 0, right: 0, itemWidth: 12, itemHeight: 10, textStyle: { color: '#657085', fontSize: 12 } },
    grid: [
      { left: 50, right: 44, top: 42, height: 178 },
      { left: 82, right: 44, top: 244, height: 94 },
    ],
    xAxis: [
      {
        type: 'category',
        gridIndex: 0,
        data: labels,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dfe4ed' } },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: labels,
        axisLabel: { color: '#7d8798', fontSize: 11 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dfe4ed' } },
      },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        min: 0,
        max: 12,
        interval: 3,
        axisLabel: { formatter: '{value}ч', color: '#7d8798' },
        splitLine: { lineStyle: { color: '#edf1f6' } },
      },
      { type: 'value', gridIndex: 0, min: 1, max: 5, interval: 1, axisLabel: { color: '#7d8798' }, splitLine: { show: false } },
      {
        type: 'category',
        gridIndex: 1,
        data: actionRows,
        axisLabel: { color: '#657085', fontSize: 10 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Сон',
        type: 'bar',
        xAxisIndex: 0,
        yAxisIndex: 0,
        barMaxWidth: 34,
        data: rhythmDays.value.map((item) =>
          item.entry?.sleepMinutes === null || item.entry?.sleepMinutes === undefined
            ? null
            : {
                value: Math.round((item.entry.sleepMinutes / 60) * 10) / 10,
                itemStyle: { color: item.entry.specialDay ? '#eb7458' : '#7467e8', borderRadius: [6, 6, 2, 2] },
              },
        ),
      },
      {
        name: 'Энергия',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 1,
        symbolSize: 9,
        lineStyle: { width: 3 },
        data: rhythmDays.value.map((item) => item.entry?.energy ?? null),
      },
      ...actionSeries.map((series) => ({
        name: series.name,
        type: 'scatter' as const,
        xAxisIndex: 1,
        yAxisIndex: 2,
        symbolSize: 10,
        itemStyle: { color: series.color },
        data: rhythmDays.value.flatMap((item, index) => (series.active(item) ? [[labels[index], series.row]] : [])),
      })),
    ],
  };
});
const review = reactive<WeeklyReview>(emptyWeeklyReview(start.value));

function loadReview() {
  const existing = store.reviewByWeek(start.value);
  Object.assign(review, emptyWeeklyReview(start.value), existing ? plainCopy(existing) : {});
}
watch(start, loadReview, { immediate: true });

async function saveReview() {
  await store.saveReview(plainCopy(review));
  notifySaved('Обзор недели сохранён');
}

function createPackage() {
  return buildPeriodPackage('week', anchor.value, {
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
    notifyInfo('Данные недели скачаны');
  } catch (error) {
    notifyUnknownError(error, 'Не удалось скачать данные недели');
  }
}
</script>

<template>
  <section class="page page--review page--week">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Недельная сводка</span>
        <h1>Неделя</h1>
        <p>Факты недели без общего балла.</p>
      </div>
      <a class="review-jump" href="#week-review">К обзору <span aria-hidden="true">↓</span></a>
    </div>
    <PeriodNavigator
      :title="`${formatDate(start, { day: 'numeric', month: 'short' })} — ${formatDate(end, { day: 'numeric', month: 'short' })}`"
      :subtitle="start === startOfWeek(todayKey()) ? 'Текущая неделя' : ''"
      @previous="anchor = addDays(anchor, -7)"
      @next="anchor = addDays(anchor, 7)"
      @current="anchor = todayKey()"
    />

    <div class="metrics-grid">
      <MetricCard
        label="Средний сон"
        :value="formatMinutes(summary.averageSleep === null ? null : Math.round(summary.averageSleep))"
        :hint="`${summary.sleepSamples} дн. без особых`"
        accent="#7467e8"
      />
      <MetricCard
        label="Карьера"
        :value="`${summary.careerDays}/${summary.careerSamples}`"
        :hint="`${summary.externalSteps} дн. с откликом или разговором`"
        accent="#3f82d5"
      />
      <MetricCard
        label="Реальные шаги"
        :value="`${summary.externalActionDays}/${summary.preparationDays}`"
        :hint="`шаги / подготовка · ${summary.actionDirectionSamples} дн.`"
        accent="#1d5148"
      />
      <MetricCard
        label="Дней с активностью"
        :value="summary.movementDays"
        :hint="`${summary.movementSamples} дн. с отметкой`"
        accent="#2eaa7f"
      />
      <MetricCard
        label="Питание"
        :value="`${summary.nutritionSupportDays}/${summary.nutritionBlockDays}`"
        :hint="`поддержало / мешало · ${summary.nutritionSamples} дн.`"
        accent="#d9952f"
      />
      <MetricCard label="Итогов" :value="results.length" accent="#e7a43b" />
    </div>

    <article class="insight-card">
      <span class="insight-card__mark">⌁</span>
      <p>{{ summaryText }}</p>
    </article>

    <article class="dashboard-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Ритм недели</span>
          <h2>Сон, энергия и действия</h2>
        </div>
      </div>
      <EChartPanel :option="rhythmOption" :height="380" aria-label="Ритм сна, энергии и действий за неделю" />
      <p class="data-note">
        Столбцы показывают сон, линия — энергию. Оранжевый столбец означает особый день. В строке питания: зелёный — поддержало цель, жёлтый
        — нейтрально, красный — мешало.
      </p>
    </article>

    <article class="dashboard-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Короткий разбор</span>
          <h2>На что обратить внимание</h2>
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

    <article v-if="activeExperimentWeek || completedExperiments.length" class="dashboard-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Личные проверки</span>
          <h2>Эксперименты недели</h2>
        </div>
        <span class="count-badge">{{ (activeExperimentWeek ? 1 : 0) + completedExperiments.length }}</span>
      </div>
      <div v-if="activeExperimentWeek" class="previous-plan">
        <span class="eyebrow">Идёт сейчас</span>
        <p>
          <strong>{{ activeExperimentWeek.experiment.title }}</strong>
        </p>
        <p v-if="activeExperimentWeek.experiment.hypothesis">Что проверяю: {{ activeExperimentWeek.experiment.hypothesis }}</p>
        <div class="comparison-periods">
          <span>Выполнено: {{ activeExperimentWeek.completedDays }}</span>
          <span>Не выполнено: {{ activeExperimentWeek.notCompletedDays }}</span>
          <span>Без отметки: {{ activeExperimentWeek.unmarkedDays }} из {{ activeExperimentWeek.plannedDays }}</span>
        </div>
      </div>
      <div v-if="completedExperiments.length" class="note-list">
        <article v-for="experiment in completedExperiments" :key="experiment.id" class="note-item">
          <time>{{ formatDate(experiment.endDate, { weekday: 'short', day: 'numeric' }) }}</time>
          <p>
            <strong>{{ experiment.title }}</strong
            ><br />{{ experiment.conclusion
            }}<span v-if="experiment.decision"
              ><br />Дальше: {{ experimentDecisionLabel(experiment.decision).toLocaleLowerCase('ru-RU') }}</span
            >
          </p>
        </article>
      </div>
    </article>

    <article v-if="actionNotes.length" class="dashboard-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Действия по цели</span>
          <h2>Конкретные действия и подготовка</h2>
        </div>
        <span class="count-badge">{{ actionNotes.length }}</span>
      </div>
      <div class="note-list">
        <article v-for="entry in actionNotes" :key="entry.date" class="note-item">
          <time>{{ formatDate(entry.date, { weekday: 'short', day: 'numeric' }) }}</time>
          <p>
            <strong>{{ actionDirectionLabel(entry.actionDirection) }}</strong
            ><span v-if="entry.focusTitle"><br />Цель: {{ entry.focusTitle }}</span
            ><span v-if="entry.actionNote"><br />{{ entry.actionNote }}</span>
          </p>
        </article>
      </div>
    </article>

    <article v-if="specialDays.length" class="dashboard-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Поправка на контекст</span>
          <h2>Особые дни</h2>
        </div>
        <span class="count-badge">{{ specialDays.length }}</span>
      </div>
      <div class="special-day-list">
        <article v-for="entry in specialDays" :key="entry.date" class="special-day-item">
          <time>{{ formatDate(entry.date, { weekday: 'short', day: 'numeric' }) }}</time>
          <strong>{{ specialDayLabel(entry.specialDay) }}</strong>
          <p v-if="entry.specialDayNote">{{ entry.specialDayNote }}</p>
        </article>
      </div>
    </article>

    <article v-if="contextNotes.length" class="dashboard-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Контекст дня</span>
          <h2>Повторяющиеся условия и заметки</h2>
        </div>
        <span class="count-badge">{{ contextNotes.length }}</span>
      </div>
      <div class="factor-note-list">
        <article v-for="entry in contextNotes" :key="entry.date" class="factor-note-item">
          <time>{{ formatDate(entry.date, { weekday: 'short', day: 'numeric' }) }}</time>
          <div>
            <span v-for="factor in entry.contextFactors" :key="factor" class="mini-pill">{{
              contextFactorLabel(factor, contextFactorItems)
            }}</span>
            <p v-if="entry.contextNote">{{ entry.contextNote }}</p>
          </div>
        </article>
      </div>
    </article>

    <article class="dashboard-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Присутствие областей</span>
          <h2>Карта недели</h2>
        </div>
      </div>
      <div class="heatmap" :style="{ '--day-count': days.length }">
        <div class="heatmap__corner"></div>
        <div v-for="day in days" :key="day" class="heatmap__day">
          <strong>{{ formatDate(day, { weekday: 'short' }) }}</strong
          ><small>{{ formatDate(day, { day: '2-digit' }) }}</small>
        </div>
        <template v-for="row in rows" :key="row.id">
          <div class="heatmap__label">
            <span>{{ row.icon }}</span
            >{{ row.label }}
          </div>
          <div
            v-for="day in days"
            :key="`${row.id}-${day}`"
            class="heatmap__cell"
            :class="{ active: hasArea(entriesByDate.get(day), row.id) }"
          >
            <span></span>
          </div>
        </template>
      </div>
    </article>

    <article v-if="results.length" class="dashboard-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Завершённые факты</span>
          <h2>Итоги недели</h2>
        </div>
      </div>
      <ul class="compact-results">
        <li v-for="result in results" :key="result.id"><span>✓</span>{{ result.title }}</li>
      </ul>
    </article>

    <article v-if="lifeEvents.length" class="dashboard-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Важный контекст</span>
          <h2>События недели</h2>
        </div>
        <span class="count-badge">{{ lifeEvents.length }}</span>
      </div>
      <div class="note-list">
        <article v-for="event in lifeEvents" :key="event.id" class="note-item">
          <time>{{ formatDate(event.date, { weekday: 'short', day: 'numeric' }) }}</time>
          <p>
            <strong>{{ event.title }}</strong
            ><span v-if="event.note"><br />{{ event.note }}</span>
          </p>
        </article>
      </div>
    </article>

    <article id="week-review" class="review-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Обзор недели</span>
          <h2>Короткий обзор</h2>
        </div>
        <span class="period-pill">До {{ formatDate(end, { day: 'numeric', month: 'long', year: 'numeric' }) }}</span>
      </div>
      <template v-if="previousReview?.nextLever || previousReview?.ifThenPlan">
        <div class="previous-plan">
          <span class="eyebrow">Проверка прошлого решения</span>
          <p v-if="previousReview.nextLever"><strong>Изменение:</strong> {{ previousReview.nextLever }}</p>
          <p v-if="previousReview.ifThenPlan"><strong>План:</strong> {{ previousReview.ifThenPlan }}</p>
        </div>
        <label class="field-label">Что получилось на практике?</label
        ><textarea
          v-model="review.previousPlanOutcome"
          rows="2"
          placeholder="Сработало, не сработало или данных пока недостаточно — и почему"
        ></textarea>
      </template>
      <label class="field-label">Три опорных факта недели</label>
      <input
        v-for="(_, index) in review.results"
        :key="index"
        v-model="review.results[index]"
        type="text"
        :placeholder="`${index + 1}. Итог или значимый факт`"
      />
      <label class="field-label">Что помогало?</label
      ><textarea v-model="review.support" rows="2" placeholder="Люди, режим, место, привычка или решение"></textarea>
      <label class="field-label">Что мешало сильнее всего?</label
      ><textarea v-model="review.obstacle" rows="2" placeholder="Один главный фактор"></textarea>
      <label class="field-label">Одно изменение на следующую неделю</label
      ><textarea v-model="review.nextLever" rows="2" placeholder="Что конкретно изменить, оставить или убрать"></textarea>
      <label class="field-label">План если-то</label
      ><textarea
        v-model="review.ifThenPlan"
        rows="2"
        placeholder="Если появится главный фактор, то я сделаю конкретное действие"
      ></textarea>
      <button class="primary-button" type="button" @click="saveReview">Сохранить обзор</button>
    </article>
  </section>
</template>
