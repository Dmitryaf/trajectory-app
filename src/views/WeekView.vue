<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import ArchivePagination from '../features/journal/ui/ArchivePagination.vue';
import PeriodAnalysisCard from '../features/reviews/ui/PeriodAnalysisCard.vue';
import PeriodDetails from '../features/reviews/ui/PeriodDetails.vue';
import PeriodRecordCard from '../features/reviews/ui/PeriodRecordCard.vue';
import Pill from '../features/reviews/ui/PeriodPill.vue';
import ReviewHeading from '../features/reviews/ui/ReviewPageHeading.vue';
import ReviewNotice from '../features/reviews/ui/ReviewNotice.vue';
import WeeklyReviewJournalLinks from '../features/reviews/ui/WeeklyReviewJournalLinks.vue';
import WeeklyReviewOverview from '../features/reviews/ui/WeeklyReviewOverview.vue';
import WeeklyRhythmCard from '../features/reviews/ui/WeeklyRhythmCard.vue';
import DecisionFollowUp from '../features/reviews/ui/DecisionFollowUp.vue';
import { buildDecisionFollowUp } from '../features/reviews/decisionFollowUp';
import { usePeriodReview } from '../features/reviews/usePeriodReview';
import AutoGrowTextarea from '../shared/ui/forms/AutoGrowTextarea.vue';
import FormFieldLabel from '../shared/ui/forms/FormFieldLabel.vue';
import FormHint from '../shared/ui/forms/FormHint.vue';
import PeriodNavigator from '../shared/ui/navigation/PeriodNavigator.vue';
import Badge from '../shared/ui/data-display/CountBadge.vue';
import {
  actionDirectionLabel,
  buildReviewCues,
  contextFactorLabel,
  entriesForWeek,
  hasArea,
  resultsForPeriod,
  specialDayLabel,
  summarize,
  weekSummaryText,
} from '../services/analytics';
import { addDays, dateRange, endOfWeek, formatDate, fromDateKey, startOfWeek, todayKey, toDateKey } from '../services/dates';
import { experimentDecisionLabel, experimentOverlapsRange } from '../features/experiments/model';
import { experimentWeekStatusLabel, truncateExperimentText } from '../features/experiments/presentation';
import { useAppStore } from '../stores/app';
import {
  contextFactorOptions,
  emptyWeeklyReview,
  externalCareerIdsForOptions,
  lifeAreaOptions,
  lifeEventTypeOptions,
  resultAreaOptions,
  type DailyEntry,
  type Experiment,
  type ExperimentDecision,
  type ExperimentRecord,
  type WeeklyReview,
} from '../types';

const props = defineProps<{ initialWeek?: string }>();
const store = useAppStore();

function validAnchor(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return todayKey();
  }
  return toDateKey(fromDateKey(value)) === value ? value : todayKey();
}

function initialAnchor(value: string | undefined) {
  return value ? validAnchor(value) : todayKey();
}

const anchor = ref(initialAnchor(props.initialWeek));
const start = computed(() => startOfWeek(anchor.value));
const end = computed(() => endOfWeek(anchor.value));
const days = computed(() => Array.from({ length: 7 }, (_, index) => addDays(start.value, index)));
const entries = computed(() => entriesForWeek(store.dailyEntries, anchor.value));
const entriesByDate = computed(() => new Map(entries.value.map((entry) => [entry.date, entry])));
const lifeAreaItems = computed(() => [...lifeAreaOptions, ...store.settings.customLifeAreaOptions]);
const contextFactorItems = computed(() => [...contextFactorOptions, ...store.settings.customContextFactorOptions]);
const externalCareerIds = computed(() => externalCareerIdsForOptions(store.settings.customCareerOptions));
const summary = computed(() => summarize(entries.value, externalCareerIds.value));
const results = computed(() => resultsForPeriod(store.results, start.value, end.value));
const lifeEvents = computed(() =>
  store.lifeEvents.filter((event) => event.date >= start.value && event.date <= end.value).sort((a, b) => b.date.localeCompare(a.date)),
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
    dateLabel: formatDate(result.date, { weekday: 'short', day: 'numeric' }),
  })),
);
const eventRecordItems = computed(() =>
  lifeEvents.value.map((event) => ({
    id: event.id ?? event.createdAt,
    icon: lifeEventTypeOptions.find((option) => option.id === event.type)?.icon ?? '·',
    title: event.title,
    dateLabel: formatDate(event.date, { weekday: 'short', day: 'numeric' }),
  })),
);
type WeekExperimentCard = {
  id: string;
  active: boolean;
  title: string;
  titlePreview: string;
  hypothesis: string;
  conclusion: string;
  decision: ExperimentDecision | null;
  statusLabel: string;
  periodLabel: string;
  plannedDays: number;
  completedDays: number;
  notCompletedDays: number;
  unmarkedDays: number;
  totalPlannedDays: number;
  totalCompletedDays: number;
  totalNotCompletedDays: number;
  totalUnmarkedDays: number;
  notes: DailyEntry[];
};

const activeExperiment = computed(() => {
  const experiment = store.settings.experiment;
  if (!experiment.active || !experimentOverlapsRange(experiment, start.value, end.value)) {
    return null;
  }
  return experiment;
});
const completedExperiments = computed(() =>
  store.settings.experimentHistory.filter((experiment) => experimentOverlapsRange(experiment, start.value, end.value)),
);
const experimentCards = computed<WeekExperimentCard[]>(() => [
  ...(activeExperiment.value ? [buildExperimentCard('active-experiment', activeExperiment.value, true)] : []),
  ...completedExperiments.value.map((experiment) => buildExperimentCard(experiment.id, experiment, false)),
]);
const openExperimentId = ref('');
const openExperimentNotesId = ref('');
const experimentNotePages = reactive<Record<string, number>>({});

watch(
  () => experimentCards.value.map((experiment) => experiment.id).join('|'),
  () => {
    const cards = experimentCards.value;
    if (!cards.some((experiment) => experiment.id === openExperimentId.value)) {
      openExperimentId.value = cards.find((experiment) => experiment.active)?.id ?? cards[0]?.id ?? '';
    }
    if (!cards.some((experiment) => experiment.id === openExperimentNotesId.value)) {
      openExperimentNotesId.value = '';
    }
  },
  { immediate: true },
);

function buildExperimentCard(id: string, experiment: Experiment | ExperimentRecord, active: boolean): WeekExperimentCard {
  const experimentDays = days.value.filter((day) => day >= experiment.startDate && day <= experiment.endDate);
  const experimentEntries = entries.value.filter((entry) => entry.experimentId === experiment.id);
  const marked = experimentEntries.filter((entry) => entry.experimentCompleted !== null);
  const totalDays = dateRange(experiment.startDate, experiment.endDate);
  const totalEntries = store.dailyEntries.filter((entry) => entry.experimentId === experiment.id);
  const totalMarked = totalEntries.filter((entry) => entry.experimentCompleted !== null);
  const currentWeekStart = startOfWeek(todayKey());
  const statusLabel = experimentWeekStatusLabel(
    active,
    start.value === currentWeekStart,
    end.value < currentWeekStart,
    formatDate(experiment.endDate, { weekday: 'short', day: 'numeric' }),
  );
  return {
    id,
    active,
    title: experiment.title,
    titlePreview: truncateExperimentText(experiment.title, 180),
    hypothesis: experiment.hypothesis,
    conclusion: experiment.conclusion,
    decision: experiment.decision,
    statusLabel,
    periodLabel: `${formatDate(experiment.startDate, { day: 'numeric', month: 'short' })} — ${formatDate(experiment.endDate, {
      day: 'numeric',
      month: 'short',
    })}`,
    plannedDays: experimentDays.length,
    completedDays: marked.filter((entry) => entry.experimentCompleted === true).length,
    notCompletedDays: marked.filter((entry) => entry.experimentCompleted === false).length,
    unmarkedDays: Math.max(0, experimentDays.length - marked.length),
    totalPlannedDays: totalDays.length,
    totalCompletedDays: totalMarked.filter((entry) => entry.experimentCompleted === true).length,
    totalNotCompletedDays: totalMarked.filter((entry) => entry.experimentCompleted === false).length,
    totalUnmarkedDays: Math.max(0, totalDays.length - totalMarked.length),
    notes: experimentEntries.filter((entry) => entry.experimentNote.trim()),
  };
}

function handleExperimentToggle(event: Event, id: string): void {
  const details = event.currentTarget as HTMLDetailsElement;
  if (details.open) {
    openExperimentId.value = id;
  } else if (openExperimentId.value === id) {
    openExperimentId.value = '';
  }
}

function toggleExperimentNotes(id: string): void {
  openExperimentNotesId.value = openExperimentNotesId.value === id ? '' : id;
  if (!experimentNotePages[id]) {
    experimentNotePages[id] = 1;
  }
}

function experimentNotePage(id: string): number {
  return experimentNotePages[id] ?? 1;
}

function setExperimentNotePage(id: string, page: number): void {
  experimentNotePages[id] = page;
}

function visibleExperimentNote(experiment: WeekExperimentCard): DailyEntry | null {
  return experiment.notes[experimentNotePage(experiment.id) - 1] ?? null;
}

function experimentNoteStatus(entry: DailyEntry): string {
  if (entry.experimentCompleted === true) {
    return 'Получилось';
  }
  if (entry.experimentCompleted === false) {
    return 'Не получилось';
  }
  return 'Без отметки';
}
const reviewCues = computed(() =>
  buildReviewCues('week', entries.value, results.value, lifeEvents.value, externalCareerIds.value, contextFactorItems.value),
);
const primaryReviewCues = computed(() => reviewCues.value.slice(0, 3));
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
  savedReview,
  updateReviewContextOpen,
} = usePeriodReview<WeeklyReview>({
  period: 'week',
  anchor,
  start,
  end,
  emptyReview: emptyWeeklyReview,
  findReview: (weekStart) => store.reviewByWeek(weekStart),
  persistReview: (draft) => store.saveReview(draft),
  hasContext: (draft) =>
    draft.results.some((value) => value.trim()) ||
    draft.highlights.some((value) => value.trim()) ||
    Boolean(draft.stateContext.trim() || draft.support.trim() || draft.obstacle.trim()),
  prepareDraft: (draft) => {
    while (draft.results.length < 3) {
      draft.results.push('');
    }
    while (draft.highlights.length < 3) {
      draft.highlights.push('');
    }
  },
});
const previousReview = computed(() => store.reviewByWeek(addDays(start.value, -7)));
const decisionFollowUp = computed(() =>
  buildDecisionFollowUp(previousReview.value, savedReview.value, entries.value, results.value, lifeEvents.value),
);
const recoveredReview = computed(() => {
  const weekStart = store.settings.firstUse.weekStart;
  if (store.settings.firstUse.status !== 'completed' || !weekStart || weekStart === start.value || !store.settings.firstUse.overviewSeen) {
    return null;
  }
  return store.reviewByWeek(weekStart) ?? null;
});
const recoveredWeekEnd = computed(() =>
  recoveredReview.value ? recoveredReview.value.coveredThrough || addDays(recoveredReview.value.weekStart, 6) : '',
);
const isRecoveredReview = computed(
  () =>
    Boolean(savedReview.value) &&
    store.settings.firstUse.weekStart === start.value &&
    store.settings.firstUse.overviewSeen &&
    (store.settings.firstUse.status === 'in_progress' || store.settings.firstUse.status === 'completed'),
);
const showRecoveredOverview = computed(() => isRecoveredReview.value && window.location.hash === '#first-use-overview');
const navigatorSubtitle = computed(() => {
  if (showRecoveredOverview.value) {
    return 'Ваш первый обзор недели';
  }
  return start.value === startOfWeek(todayKey()) ? 'Текущая неделя' : '';
});
const recoveredPeriodIsIncomplete = computed(
  () => Boolean(savedReview.value?.coveredThrough) && savedReview.value!.coveredThrough < addDays(savedReview.value!.weekStart, 6),
);
const hasDailyData = computed(() => summary.value.coveredEntriesCount > 0);
const hasJournalData = computed(() => results.value.length > 0 || lifeEvents.value.length > 0);
const hasPeriodData = computed(
  () => hasDailyData.value || hasJournalData.value || hasSavedReview.value || experimentCards.value.length > 0,
);
const rows = computed(() => [
  { id: 'career', label: 'Работа', icon: '↗' },
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
const rhythmDays = computed(() => days.value.map((day) => ({ day, entry: entriesByDate.value.get(day) })));
watch(
  () => props.initialWeek,
  (value) => {
    anchor.value = initialAnchor(value);
  },
);
</script>

<template>
  <section class="page page--review page--week">
    <ReviewHeading
      label="Недельная сводка"
      title="Неделя"
      summary="Посмотрите, чем была наполнена неделя, и решите, хотите ли что-то менять."
      :action="hasPeriodData ? (reviewAvailable ? 'К обзору' : 'Обзор позже') : undefined"
      href="#week-review"
    />
    <PeriodNavigator
      :title="`${formatDate(start, { day: 'numeric', month: 'short' })} — ${formatDate(end, { day: 'numeric', month: 'short' })}`"
      :subtitle="navigatorSubtitle"
      @previous="anchor = addDays(anchor, -7)"
      @next="anchor = addDays(anchor, 7)"
      @current="anchor = todayKey()"
    />

    <ReviewNotice v-if="recoveredReview && !hasSavedReview" tag="section" class="recovered-week-link">
      <div>
        <strong>Ваш первый обзор сохранён</strong>
        <p>
          Сейчас открыта другая неделя. Сохранённый обзор относится к
          {{ formatDate(recoveredReview.weekStart, { day: 'numeric', month: 'long' }) }} —
          {{ formatDate(recoveredWeekEnd, { day: 'numeric', month: 'long', year: 'numeric' }) }}.
        </p>
      </div>
      <RouterLink class="secondary-button context-action" :to="`/week?week=${recoveredReview.weekStart}#first-use-overview`">
        Открыть обзор
      </RouterLink>
    </ReviewNotice>

    <section v-if="!hasPeriodData" class="period-empty-guide">
      <strong>За эту неделю пока нет записей</strong>
      <p>Заполняйте на главной несколько важных пунктов. Здесь они соберутся по дням и помогут сравнить сон, состояние и действия.</p>
      <RouterLink class="secondary-button" to="/">Перейти к записи за день</RouterLink>
    </section>

    <template v-else>
      <ReviewNotice v-if="!hasDailyData" tag="section" class="period-data-guide">
        <strong>{{ experimentCards.length ? 'Есть только отметки эксперимента' : 'За эту неделю нет дневных записей' }}</strong>
        <p>
          {{ experimentCards.length ? 'Отметки эксперимента показаны ниже.' : 'Итоги, события и сохранённый обзор показаны ниже.' }} Данных
          для сравнения сна, состояния и действий пока нет.
        </p>
      </ReviewNotice>

      <article v-if="showRecoveredOverview && savedReview" id="first-use-overview" class="restored-week-overview">
        <div class="restored-week-overview__heading">
          <div>
            <p class="eyebrow">Восстановлено по вашим ответам</p>
            <h2>Вот чем была наполнена ваша неделя</h2>
            <p>Здесь собраны ваши факты, важные события и условия недели. Это не оценка и не автоматический вывод.</p>
            <p v-if="recoveredPeriodIsIncomplete" class="restored-week-overview__coverage">
              Ответы собраны по {{ formatDate(savedReview.coveredThrough, { day: 'numeric', month: 'long' }) }}. Остальные дни этой недели
              не считаются пропущенными.
            </p>
          </div>
        </div>
        <WeeklyReviewOverview :review="savedReview" />
        <WeeklyReviewJournalLinks :review="savedReview" />
        <div class="restored-week-overview__actions">
          <RouterLink class="primary-button" to="/">Записать сегодняшний день</RouterLink>
          <RouterLink class="secondary-button" to="/?first-use=edit">Исправить ответы</RouterLink>
        </div>
      </article>

      <article v-if="hasDailyData" class="insight-card">
        <span class="insight-card__mark">⌁</span>
        <p>{{ summaryText }}</p>
      </article>

      <PeriodAnalysisCard
        v-if="hasDailyData || hasJournalData"
        section-id="ai-analysis"
        title="На что обратить внимание"
        :cues="primaryReviewCues"
        :copying="promptCopying"
        @copy="copyPrompt"
        @download="downloadJson"
      />

      <section
        v-if="results.length || lifeEvents.length"
        class="period-records period-records--featured"
        aria-label="Главные записи недели"
      >
        <PeriodRecordCard
          v-if="results.length"
          eyebrow="Завершённые факты"
          title="Итоги недели"
          :items="resultRecordItems"
          :breakdown="resultAreaSummary"
          breakdown-label="Итоги по областям"
          pagination-label="итогов недели"
        />

        <PeriodRecordCard
          v-if="lifeEvents.length"
          eyebrow="Важный контекст"
          title="События недели"
          :items="eventRecordItems"
          :breakdown="eventTypeSummary"
          breakdown-label="События по типам"
          pagination-label="событий недели"
        />
      </section>

      <DecisionFollowUp v-if="decisionFollowUp" :follow-up="decisionFollowUp" />

      <article v-if="reviewAvailable" id="week-review" class="review-card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Обзор недели</span>
            <h2>Короткий обзор</h2>
          </div>
          <Pill>До {{ formatDate(end, { day: 'numeric', month: 'long', year: 'numeric' }) }}</Pill>
        </div>
        <template v-if="previousReview?.nextLever || previousReview?.ifThenPlan">
          <div class="previous-plan">
            <span class="eyebrow">Решение из прошлого обзора</span>
            <p v-if="previousReview.nextLever"><strong>Вы решили:</strong> {{ previousReview.nextLever }}</p>
            <p v-if="previousReview.ifThenPlan"><strong>План:</strong> {{ previousReview.ifThenPlan }}</p>
          </div>
          <FormFieldLabel>Что получилось с этим решением?</FormFieldLabel
          ><AutoGrowTextarea
            v-model="review.previousPlanOutcome"
            :rows="2"
            placeholder="Сработало, не сработало или данных пока недостаточно — и почему"
          />
        </template>
        <PeriodDetails
          class="review-context-details"
          :title="reviewHasContext ? 'Итоги и контекст' : 'Добавить итоги и контекст'"
          :open="reviewContextOpen"
          @toggle="updateReviewContextOpen"
        >
          <FormFieldLabel>До трёх итогов или сделанных дел</FormFieldLabel>
          <input
            v-for="(_, index) in review.results"
            :key="index"
            v-model="review.results[index]"
            type="text"
            :placeholder="`${index + 1}. Итог или важный факт`"
          />
          <FormFieldLabel>До трёх событий, решений или мыслей</FormFieldLabel>
          <input
            v-for="(_, index) in review.highlights"
            :key="`highlight-${index}`"
            v-model="review.highlights[index]"
            type="text"
            :placeholder="`${index + 1}. Что важно запомнить`"
          />
          <FormFieldLabel>Как вы себя чувствовали и что влияло на неделю?</FormFieldLabel>
          <AutoGrowTextarea v-model="review.stateContext" :rows="2" placeholder="Силы, настроение и важные обстоятельства" />
          <FormFieldLabel>Что помогало?</FormFieldLabel
          ><AutoGrowTextarea v-model="review.support" :rows="2" placeholder="Люди, режим, место, привычка или решение" />
          <FormFieldLabel>Что мешало сильнее всего?</FormFieldLabel
          ><AutoGrowTextarea v-model="review.obstacle" :rows="2" placeholder="Один главный фактор" />
        </PeriodDetails>
        <FormFieldLabel>Что продолжить или изменить на следующей неделе?</FormFieldLabel
        ><AutoGrowTextarea v-model="review.nextLever" :rows="2" placeholder="Можно продолжить как есть или пока ничего не решать" />
        <FormFieldLabel>План если-то</FormFieldLabel
        ><AutoGrowTextarea
          v-model="review.ifThenPlan"
          class="review-plan-field"
          :rows="2"
          placeholder="Если снова появится главное препятствие, то я сделаю конкретное действие"
        />
        <button class="primary-button" type="button" :disabled="reviewSaving" @click="saveReview">
          {{ reviewSaving ? 'Сохраняю…' : 'Сохранить обзор' }}
        </button>
      </article>
      <ReviewNotice v-else id="week-review" tag="section">
        <strong>Короткий обзор появится в конце недели</strong>
        <p>Его можно пропустить — дневные записи и сводка недели останутся на месте.</p>
      </ReviewNotice>

      <PeriodDetails
        v-if="hasDailyData || hasJournalData || experimentCards.length"
        class="week-data-details"
        :title="hasDailyData ? 'Показать дни и дополнительный контекст' : 'Записи недели'"
        :open="!hasDailyData"
      >
        <WeeklyRhythmCard v-if="hasDailyData" :days="rhythmDays" />

        <article v-if="experimentCards.length" class="dashboard-card">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Личные проверки</span>
              <h2>Эксперименты в эту неделю</h2>
            </div>
            <Badge>{{ experimentCards.length }}</Badge>
          </div>
          <div class="period-records__content">
            <details
              v-for="(experiment, index) in experimentCards"
              :key="experiment.id"
              class="period-record-card period-record-card--disclosure experiment-period-card"
              :open="openExperimentId === experiment.id"
              @toggle="handleExperimentToggle($event, experiment.id)"
            >
              <summary>
                <span class="period-record-card__heading">
                  <span
                    ><span class="eyebrow">{{ experiment.statusLabel }}</span
                    ><strong>{{ experiment.titlePreview }}</strong
                    ><span class="eyebrow">Период: {{ experiment.periodLabel }}</span></span
                  >
                  <Badge v-if="experiment.notes.length" :aria-label="`Заметок: ${experiment.notes.length}`">
                    {{ experiment.notes.length }}
                  </Badge>
                </span>
                <span class="period-record-card__breakdown" aria-label="Отметки эксперимента за эту неделю">
                  <span>За неделю: получилось · {{ experiment.completedDays }}</span>
                  <span>Не получилось · {{ experiment.notCompletedDays }}</span>
                  <span>Без отметки · {{ experiment.unmarkedDays }} из {{ experiment.plannedDays }}</span>
                </span>
              </summary>
              <div class="period-record-card__details">
                <div class="previous-plan">
                  <span class="eyebrow">Условие</span>
                  <p>
                    <strong>{{ experiment.title }}</strong>
                  </p>
                  <p v-if="experiment.hypothesis">Что хотите узнать: {{ experiment.hypothesis }}</p>
                  <p v-if="experiment.conclusion">
                    <strong>{{ experiment.active ? 'Промежуточное наблюдение:' : 'Что заметили:' }}</strong
                    ><br />{{ experiment.conclusion }}
                  </p>
                  <p v-if="experiment.decision">Дальше: {{ experimentDecisionLabel(experiment.decision).toLocaleLowerCase('ru-RU') }}</p>
                  <p v-if="experiment.totalPlannedDays !== experiment.plannedDays">
                    За весь период: получилось {{ experiment.totalCompletedDays }}, не получилось {{ experiment.totalNotCompletedDays }},
                    без отметки {{ experiment.totalUnmarkedDays }} из {{ experiment.totalPlannedDays }}.
                  </p>
                </div>
                <button
                  v-if="experiment.notes.length"
                  class="secondary-button"
                  type="button"
                  :aria-expanded="openExperimentNotesId === experiment.id"
                  :aria-controls="`experiment-notes-${index}`"
                  @click="toggleExperimentNotes(experiment.id)"
                >
                  {{ openExperimentNotesId === experiment.id ? 'Скрыть заметки' : `Заметки этой недели · ${experiment.notes.length}` }}
                </button>
                <FormHint v-else>Заметок за эту неделю нет.</FormHint>
                <div
                  v-if="openExperimentNotesId === experiment.id && visibleExperimentNote(experiment)"
                  :id="`experiment-notes-${index}`"
                  class="period-record-card__details experiment-note-page"
                >
                  <article class="note-item">
                    <time>{{ formatDate(visibleExperimentNote(experiment)!.date, { weekday: 'short', day: 'numeric' }) }}</time>
                    <p>
                      <strong>{{ experimentNoteStatus(visibleExperimentNote(experiment)!) }}</strong
                      ><br />{{ visibleExperimentNote(experiment)!.experimentNote }}
                    </p>
                  </article>
                  <ArchivePagination
                    :page="experimentNotePage(experiment.id)"
                    :page-count="experiment.notes.length"
                    context-label="заметок эксперимента"
                    @update:page="setExperimentNotePage(experiment.id, $event)"
                  />
                </div>
              </div>
            </details>
          </div>
        </article>

        <article v-if="hasDailyData && actionNotes.length" class="dashboard-card">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Действия по цели</span>
              <h2>Конкретные действия и подготовка</h2>
            </div>
            <Badge>{{ actionNotes.length }}</Badge>
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

        <article v-if="hasDailyData && specialDays.length" class="dashboard-card">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Поправка на контекст</span>
              <h2>Особые дни</h2>
            </div>
            <Badge>{{ specialDays.length }}</Badge>
          </div>
          <div class="special-day-list">
            <article v-for="entry in specialDays" :key="entry.date" class="special-day-item">
              <time>{{ formatDate(entry.date, { weekday: 'short', day: 'numeric' }) }}</time>
              <strong>{{ specialDayLabel(entry.specialDay) }}</strong>
              <p v-if="entry.specialDayNote">{{ entry.specialDayNote }}</p>
            </article>
          </div>
        </article>

        <article v-if="hasDailyData && contextNotes.length" class="dashboard-card">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Условия дня</span>
              <h2>Повторяющиеся условия и заметки</h2>
            </div>
            <Badge>{{ contextNotes.length }}</Badge>
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

        <article v-if="hasDailyData" class="dashboard-card">
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
      </PeriodDetails>
    </template>
  </section>
</template>

<style scoped src="./WeekView.css"></style>
