<script setup lang="ts">
import { RouterLink } from 'vue-router';
import EventComparisonDetails from '@/features/analytics/ui/EventComparisonDetails.vue';
import HistoryOverviewCard from '@/features/analytics/ui/HistoryOverviewCard.vue';
import HistoryRangeTabs from '@/features/analytics/ui/HistoryRangeTabs.vue';
import HistoryTimeline from '@/features/analytics/ui/HistoryTimeline.vue';
import TrendMetricDetails from '@/features/analytics/ui/TrendMetricDetails.vue';
import { useChangeHistoryView } from '@/features/analytics/useChangeHistoryView';
import ReviewHeading from '@/features/reviews/ui/ReviewPageHeading.vue';

const {
  range,
  timelinePage,
  timelinePageCount,
  selectedEventKey,
  selectedTrendMetric,
  rangeOptions,
  summary,
  primaryCues,
  trendMetricOptions,
  selectedTrendMetricInfo,
  trendMetricOption,
  trendMetricDescription,
  eventKey,
  selectedEvent,
  eventComparison,
  eventComparisonMetrics,
  lifeEvents,
  decisionTimeline,
  displayedDecisionTimeline,
  timelineSummary,
  formatComparisonValue,
  observationLabel,
  selectEvent,
  copyPrompt,
  downloadJson,
} = useChangeHistoryView();
</script>

<template>
  <section class="page page--review page--trends">
    <ReviewHeading
      label="3–12 месяцев"
      title="История изменений"
      summary="Смотрите, какие события, решения и итоги меняли вашу траекторию."
    />

    <HistoryRangeTabs v-model="range" :options="rangeOptions" />
    <div class="review-nudge range-custom-action">
      <div>
        <strong>Нужен другой период?</strong>
        <p>Выберите точные даты и подготовьте текст в настройках.</p>
      </div>
      <RouterLink class="secondary-button" to="/settings#analysis-settings">Выбрать даты</RouterLink>
    </div>

    <section v-if="summary.coveredEntriesCount === 0 && decisionTimeline.length === 0" class="period-empty-guide">
      <strong>Для истории пока нет записей</strong>
      <p>Здесь появятся важные события, итоги и сохранённые решения.</p>
      <RouterLink class="secondary-button" to="/">Перейти к записи за день</RouterLink>
    </section>

    <template v-else>
      <HistoryOverviewCard
        v-if="summary.coveredEntriesCount"
        :cues="primaryCues"
        :covered-entries="summary.coveredEntriesCount"
        :ordinary-entries="summary.ordinaryCoreEntriesCount"
        @copy="copyPrompt"
        @download="downloadJson"
      />
      <HistoryTimeline
        v-if="decisionTimeline.length"
        v-model:page="timelinePage"
        :items="displayedDecisionTimeline"
        :summary="timelineSummary"
        :total="decisionTimeline.length"
        :page-count="timelinePageCount"
      />
      <TrendMetricDetails
        v-if="summary.coveredEntriesCount"
        v-model="selectedTrendMetric"
        :options="trendMetricOptions"
        :selected-label="selectedTrendMetricInfo?.label"
        :selected-samples="selectedTrendMetricInfo?.samples"
        :chart-option="trendMetricOption"
        :description="trendMetricDescription"
      />
      <EventComparisonDetails
        v-if="lifeEvents.length"
        :events="lifeEvents"
        :selected-key="selectedEventKey"
        :selected-event="selectedEvent"
        :comparison="eventComparison"
        :metrics="eventComparisonMetrics"
        :event-key="eventKey"
        :format-value="formatComparisonValue"
        :observation-label="observationLabel"
        @select="selectEvent"
      />
    </template>
  </section>
</template>

<style scoped>
.range-custom-action {
  margin-bottom: 16px;
}
@media (max-width: 720px) {
  .range-custom-action {
    gap: 10px;
    padding: 14px 15px;
  }
}
</style>
