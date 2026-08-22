<script setup lang="ts">
import { RouterLink } from 'vue-router';
import AiAnalysisSteps from '../features/analysis/ui/AiAnalysisSteps.vue';
import EChartPanel from '../shared/ui/charts/EChartPanel.vue';
import { useChangeHistoryView } from '../features/analytics/useChangeHistoryView';
import ArchivePagination from '../features/journal/ui/ArchivePagination.vue';

const {
  range,
  timelinePage,
  timelinePageCount,
  selectedEventKey,
  selectedTrendMetric,
  eventPicker,
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
  formatDate,
} = useChangeHistoryView();
</script>

<template>
  <section class="page page--review page--trends">
    <div class="page-heading">
      <div>
        <span class="eyebrow">3–12 месяцев</span>
        <h1>История изменений</h1>
        <p>Смотрите, какие события, решения и итоги меняли вашу траекторию.</p>
      </div>
    </div>

    <div class="range-tabs" aria-label="Период истории">
      <button
        v-for="option in rangeOptions"
        :key="option.value"
        type="button"
        :class="{ active: range === option.value }"
        @click="range = option.value"
      >
        {{ option.label }}
      </button>
    </div>
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
      <article v-if="summary.coveredEntriesCount" class="dashboard-card dashboard-card--insights">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Главное за период</span>
            <h2>Что стоит заметить</h2>
          </div>
          <div class="period-actions">
            <button class="secondary-button" type="button" @click="copyPrompt">Подготовить текст для нейросети</button>
            <button class="secondary-button" type="button" @click="downloadJson">Скачать данные</button>
          </div>
        </div>
        <AiAnalysisSteps />
        <div class="review-cue-grid review-cue-grid--primary">
          <article v-for="cue in primaryCues" :key="cue.id" class="review-cue" :class="'review-cue--' + cue.tone">
            <strong>{{ cue.title }}</strong>
            <p>{{ cue.text }}</p>
          </article>
        </div>
        <p class="data-note history-coverage-note">
          Основа разбора: {{ summary.coveredEntriesCount }} дней с записями, {{ summary.ordinaryCoreEntriesCount }} обычных дней с основными
          полями. Пропуски не заполняются.
        </p>
      </article>

      <article v-if="decisionTimeline.length" class="dashboard-card dashboard-card--timeline history-timeline--featured">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Основа истории</span>
            <h2>События, решения и итоги</h2>
          </div>
          <span class="count-badge">{{ decisionTimeline.length }}</span>
        </div>
        <div class="decision-timeline__summary" aria-label="Состав истории">
          <span v-for="item in timelineSummary" :key="item.tone" :class="'decision-timeline__summary-item--' + item.tone">
            <i></i>{{ item.label }} <strong>{{ item.count }}</strong>
          </span>
        </div>
        <TransitionGroup name="reveal-list" tag="div" class="decision-timeline">
          <article
            v-for="(item, index) in displayedDecisionTimeline"
            :key="item.date + '-' + item.type + '-' + item.title + '-' + index"
            class="decision-timeline__item"
            :class="'decision-timeline__item--' + item.tone"
          >
            <time>{{ formatDate(item.date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</time>
            <span>{{ item.type }}</span>
            <div>
              <strong>{{ item.title }}</strong>
              <p v-if="item.detail">{{ item.detail }}</p>
            </div>
          </article>
        </TransitionGroup>
        <ArchivePagination v-model:page="timelinePage" :page-count="timelinePageCount" context-label="истории изменений" />
      </article>

      <details v-if="summary.coveredEntriesCount" class="period-details trends-metric-details">
        <summary>Показать один показатель по месяцам</summary>
        <div class="period-details__content">
          <article v-if="trendMetricOptions.length" class="dashboard-card dashboard-card--trend">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Динамика периода</span>
                <h2>{{ selectedTrendMetricInfo?.label }}</h2>
              </div>
              <small>{{ selectedTrendMetricInfo?.samples }} наблюдений · минимум два месяца</small>
            </div>
            <div class="metric-switcher" aria-label="Показатель графика">
              <button
                v-for="option in trendMetricOptions"
                :key="option.id"
                type="button"
                :class="{ active: selectedTrendMetric === option.id }"
                @click="selectedTrendMetric = option.id"
              >
                {{ option.label }}
              </button>
            </div>
            <EChartPanel
              :option="trendMetricOption"
              :height="300"
              :aria-label="`Динамика: ${selectedTrendMetricInfo?.label}`"
              :description="trendMetricDescription"
            />
            <p class="data-note trend-chart-description">
              Показаны месячные средние и важные события. Совпадение изменений во времени не доказывает причину; текущий месяц может быть
              неполным.
            </p>
          </article>
          <div v-else class="period-review-note trends-chart-guide">
            <strong>Для графика пока мало сопоставимых данных</strong>
            <p>Нужны наблюдения хотя бы в двух месяцах: 6 для сна или энергии либо 3 измерения веса.</p>
          </div>
        </div>
      </details>

      <details v-if="lifeEvents.length" class="period-details trends-event-details">
        <summary>Показать сравнение рядом с важным событием</summary>
        <div class="period-details__content">
          <article class="dashboard-card dashboard-card--event">
            <div class="section-heading">
              <div>
                <span class="eyebrow">До и после</span>
                <h2>Что менялось рядом с событием</h2>
              </div>
              <details ref="eventPicker" class="event-picker">
                <summary aria-label="Выбрать событие для сравнения">
                  <span class="event-picker__icon">◆</span>
                  <span class="event-picker__current">
                    <small>Событие для сравнения</small>
                    <strong v-if="selectedEvent">
                      {{ formatDate(selectedEvent.date, { day: 'numeric', month: 'short', year: 'numeric' }) }} · {{ selectedEvent.title }}
                    </strong>
                  </span>
                  <span class="event-picker__chevron">⌄</span>
                </summary>
                <div class="event-picker__menu" role="listbox" aria-label="Важные события">
                  <button
                    v-for="event in lifeEvents"
                    :key="eventKey(event)"
                    class="event-picker__option"
                    :class="{ active: eventKey(event) === selectedEventKey }"
                    type="button"
                    role="option"
                    :aria-selected="eventKey(event) === selectedEventKey"
                    @click="selectEvent(event)"
                  >
                    <time>{{ formatDate(event.date, { day: 'numeric', month: 'short' }) }}</time>
                    <span
                      ><strong>{{ event.title }}</strong
                      ><small v-if="event.note">{{ event.note }}</small></span
                    >
                    <i>{{ eventKey(event) === selectedEventKey ? '✓' : '' }}</i>
                  </button>
                </div>
              </details>
            </div>
            <template v-if="eventComparison">
              <div class="comparison-periods">
                <span>
                  До: {{ formatDate(eventComparison.beforeStart, { day: 'numeric', month: 'short' }) }} —
                  {{ formatDate(eventComparison.beforeEnd, { day: 'numeric', month: 'short' }) }} · заполнено
                  {{ eventComparison.beforeEntries }}/{{ eventComparison.windowDays }}
                </span>
                <span>
                  После: {{ formatDate(eventComparison.afterStart, { day: 'numeric', month: 'short' }) }} —
                  {{ formatDate(eventComparison.afterEnd, { day: 'numeric', month: 'short' }) }} · заполнено
                  {{ eventComparison.afterEntries }}/{{ eventComparison.windowDays }}
                </span>
              </div>
              <div v-if="eventComparisonMetrics.length" class="comparison-table">
                <div class="comparison-table__head"><span>Показатель</span><span>До</span><span>После</span></div>
                <div v-for="metric in eventComparisonMetrics" :key="metric.id" class="comparison-table__row">
                  <strong>{{ metric.label }}</strong>
                  <span
                    >{{ formatComparisonValue(metric.before, metric.format) }}
                    <small>{{ observationLabel(metric.beforeSamples) }}</small></span
                  >
                  <span
                    >{{ formatComparisonValue(metric.after, metric.format) }}
                    <small>{{ observationLabel(metric.afterSamples) }}</small></span
                  >
                </div>
              </div>
              <p v-else class="period-review-note">Для сравнения показателей нужно минимум по три наблюдения до и после события.</p>
              <p class="data-note">
                День события исключён. Показываются только показатели с достаточным числом наблюдений; совпадение во времени не означает
                причинный эффект.
              </p>
            </template>
            <p v-else class="empty-copy">После события пока не прошло ни одного полного дня для сравнения.</p>
          </article>
        </div>
      </details>
    </template>
  </section>
</template>
