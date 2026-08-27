<script setup lang="ts">
import { ref } from 'vue';
import type { EventComparison, EventComparisonMetric } from '@/services/analytics';
import { formatDate } from '@/services/dates';
import type { LifeEventRecord } from '@/types';
import PeriodDetails from '@/features/reviews/ui/PeriodDetails.vue';
import ReviewNotice from '@/features/reviews/ui/ReviewNotice.vue';

defineProps<{
  events: LifeEventRecord[];
  selectedKey: string;
  selectedEvent: LifeEventRecord | null;
  comparison: EventComparison | null;
  metrics: EventComparisonMetric[];
  eventKey: (event: LifeEventRecord) => string;
  formatValue: (value: number | null, format: EventComparisonMetric['format']) => string;
  observationLabel: (samples: number | null) => string;
}>();
const emit = defineEmits<{ select: [event: LifeEventRecord] }>();
const picker = ref<HTMLDetailsElement>();

function select(event: LifeEventRecord) {
  emit('select', event);
  picker.value?.removeAttribute('open');
}
</script>

<template>
  <PeriodDetails class="trends-event-details" title="Показать сравнение рядом с важным событием">
    <article class="dashboard-card event-comparison-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">До и после</span>
          <h2>Что менялось рядом с событием</h2>
        </div>
        <details ref="picker" class="event-picker">
          <summary aria-label="Выбрать событие для сравнения">
            <span class="event-picker__icon">◆</span>
            <span class="event-picker__current">
              <small>Событие для сравнения</small>
              <strong v-if="selectedEvent"
                >{{ formatDate(selectedEvent.date, { day: 'numeric', month: 'short', year: 'numeric' }) }} ·
                {{ selectedEvent.title }}</strong
              >
            </span>
            <span class="event-picker__chevron">⌄</span>
          </summary>
          <div class="event-picker__menu" role="listbox" aria-label="Важные события">
            <button
              v-for="event in events"
              :key="eventKey(event)"
              class="event-picker__option"
              :class="{ active: eventKey(event) === selectedKey }"
              type="button"
              role="option"
              :aria-selected="eventKey(event) === selectedKey"
              @click="select(event)"
            >
              <time>{{ formatDate(event.date, { day: 'numeric', month: 'short' }) }}</time>
              <span
                ><strong>{{ event.title }}</strong
                ><small v-if="event.note">{{ event.note }}</small></span
              >
              <i>{{ eventKey(event) === selectedKey ? '✓' : '' }}</i>
            </button>
          </div>
        </details>
      </div>
      <template v-if="comparison">
        <div class="comparison-periods">
          <span
            >До: {{ formatDate(comparison.beforeStart, { day: 'numeric', month: 'short' }) }} —
            {{ formatDate(comparison.beforeEnd, { day: 'numeric', month: 'short' }) }} · заполнено {{ comparison.beforeEntries }}/{{
              comparison.windowDays
            }}</span
          >
          <span
            >После: {{ formatDate(comparison.afterStart, { day: 'numeric', month: 'short' }) }} —
            {{ formatDate(comparison.afterEnd, { day: 'numeric', month: 'short' }) }} · заполнено {{ comparison.afterEntries }}/{{
              comparison.windowDays
            }}</span
          >
        </div>
        <div v-if="metrics.length" class="comparison-table">
          <div class="comparison-table__head"><span>Показатель</span><span>До</span><span>После</span></div>
          <div v-for="metric in metrics" :key="metric.id" class="comparison-table__row">
            <strong>{{ metric.label }}</strong>
            <span
              >{{ formatValue(metric.before, metric.format) }} <small>{{ observationLabel(metric.beforeSamples) }}</small></span
            >
            <span
              >{{ formatValue(metric.after, metric.format) }} <small>{{ observationLabel(metric.afterSamples) }}</small></span
            >
          </div>
        </div>
        <ReviewNotice v-else tag="p">Для сравнения показателей нужно минимум по три наблюдения до и после события.</ReviewNotice>
        <p class="data-note">
          День события исключён. Показываются только показатели с достаточным числом наблюдений; совпадение во времени не означает причинный
          эффект.
        </p>
      </template>
      <p v-else class="empty-copy">После события пока не прошло ни одного полного дня для сравнения.</p>
    </article>
  </PeriodDetails>
</template>

<style scoped src="./EventComparisonDetails.css"></style>
