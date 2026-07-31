<script setup lang="ts">
import { RouterLink } from 'vue-router';
import EChartPanel from '../components/charts/EChartPanel.vue';
import MetricCard from '../components/MetricCard.vue';
import { useTrendsView } from '../features/analytics/useTrendsView';

const {
  range,
  timelineExpanded,
  selectedEventKey,
  eventPicker,
  rangeOptions,
  summary,
  factors,
  cues,
  eventKey,
  selectedEvent,
  eventComparison,
  lifeEvents,
  results,
  coverageOption,
  trendOverviewOption,
  monthRows,
  decisionTimeline,
  displayedDecisionTimeline,
  timelineSummary,
  weightOption,
  progressOption,
  coverageText,
  directionText,
  nutritionText,
  formatComparisonValue,
  observationLabel,
  factorSleepText,
  factorEnergyText,
  selectEvent,
  copyPrompt,
  downloadJson,
  formatDate,
  formatMinutes,
} = useTrendsView();
</script>

<template>
  <section class="page page--review page--trends">
    <div class="page-heading">
      <div>
        <span class="eyebrow">3–12 месяцев</span>
        <h1>Тренды</h1>
        <p>Сравните несколько месяцев и посмотрите, какие изменения повторялись.</p>
      </div>
    </div>

    <div class="range-tabs" aria-label="Период динамики">
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

    <section v-if="summary.coveredEntriesCount === 0" class="period-empty-guide">
      <strong>Для сравнения пока нет записей</strong>
      <p>Тренды становятся полезны со временем. Начните с коротких записей за день, а здесь позже можно будет сравнить месяцы.</p>
      <RouterLink class="secondary-button" to="/">Перейти к записи за день</RouterLink>
    </section>

    <div class="metrics-grid">
      <MetricCard
        label="Заполненных дней"
        :value="summary.coveredEntriesCount"
        :hint="`${summary.ordinaryCoreEntriesCount} с основными полями`"
        accent="#1d5148"
      />
      <MetricCard
        label="Средний сон"
        :value="formatMinutes(summary.averageSleep === null ? null : Math.round(summary.averageSleep))"
        :hint="`${summary.sleepSamples} дн. без особых`"
        accent="#7467e8"
      />
      <MetricCard
        label="Работа"
        :value="`${summary.careerDays}/${summary.careerSamples}`"
        hint="дни с работой / дни с отметкой"
        accent="#3f82d5"
      />
      <MetricCard
        label="Шаги к цели"
        :value="`${summary.externalActionDays}/${summary.preparationDays}`"
        :hint="`шаги / подготовка · ${summary.actionDirectionSamples} дн.`"
        accent="#2eaa7f"
      />
      <MetricCard
        label="Питание"
        :value="`${summary.nutritionSupportDays}/${summary.nutritionBlockDays}`"
        :hint="
          summary.averageWeightKg === null
            ? `${summary.nutritionSamples} дн. с отметкой`
            : `вес ${summary.averageWeightKg.toFixed(1).replace('.0', '')} кг · ${summary.weightSamples} изм.`
        "
        accent="#d9952f"
      />
      <MetricCard label="Итогов" :value="results.length" :hint="`${lifeEvents.length} важных событий`" accent="#e7a43b" />
    </div>

    <article class="dashboard-card dashboard-card--quality">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Качество наблюдений</span>
          <h2>Карта заполнения</h2>
        </div>
        <small>без серий и оценок</small>
      </div>
      <EChartPanel :option="coverageOption" :height="230" aria-label="Календарная карта полноты дневных записей" />
      <p class="data-note">
        «Основные поля» означают, что заполнены хотя бы два блока: состояние, действия или питание. Карта нужна только для оценки надёжности
        выводов.
      </p>
    </article>

    <article class="dashboard-card dashboard-card--trend">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Динамика периода</span>
          <h2>Сон и энергия</h2>
        </div>
        <small>* неполный текущий месяц</small>
      </div>
      <EChartPanel :option="trendOverviewOption" :height="320" aria-label="Динамика сна и энергии по месяцам" />
      <p v-if="lifeEvents.length" class="data-note">
        Оранжевые пунктирные линии показывают месяцы с важными событиями. Число у линии — количество событий; наведи на неё, чтобы увидеть
        список.
      </p>
    </article>

    <article v-if="lifeEvents.length" class="dashboard-card dashboard-card--event">
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
              <strong v-if="selectedEvent"
                >{{ formatDate(selectedEvent.date, { day: 'numeric', month: 'short', year: 'numeric' }) }} ·
                {{ selectedEvent.title }}</strong
              >
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
          <span
            >До: {{ formatDate(eventComparison.beforeStart, { day: 'numeric', month: 'short' }) }} —
            {{ formatDate(eventComparison.beforeEnd, { day: 'numeric', month: 'short' }) }} · заполнено
            {{ eventComparison.beforeEntries }}/{{ eventComparison.windowDays }}</span
          >
          <span
            >После: {{ formatDate(eventComparison.afterStart, { day: 'numeric', month: 'short' }) }} —
            {{ formatDate(eventComparison.afterEnd, { day: 'numeric', month: 'short' }) }} · заполнено {{ eventComparison.afterEntries }}/{{
              eventComparison.windowDays
            }}</span
          >
        </div>
        <div class="comparison-table">
          <div class="comparison-table__head"><span>Показатель</span><span>До</span><span>После</span></div>
          <div v-for="metric in eventComparison.metrics" :key="metric.id" class="comparison-table__row">
            <strong>{{ metric.label }}</strong>
            <span
              >{{ formatComparisonValue(metric.before, metric.format) }} <small>{{ observationLabel(metric.beforeSamples) }}</small></span
            >
            <span
              >{{ formatComparisonValue(metric.after, metric.format) }} <small>{{ observationLabel(metric.afterSamples) }}</small></span
            >
          </div>
        </div>
        <p class="data-note">
          Под значением указано число дневных наблюдений, вошедших в расчёт. Сравниваются равные календарные окна, день события исключён.
          Разница показывает совпадение во времени, а не причинный эффект.
        </p>
      </template>
      <p v-else class="empty-copy">После события пока не прошло ни одного полного дня для сравнения.</p>
    </article>

    <article class="dashboard-card dashboard-card--weight">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Тренд без разовых скачков</span>
          <h2>Вес по месяцам</h2>
        </div>
        <small>среднее и число измерений — в таблице</small>
      </div>
      <EChartPanel :option="weightOption" :height="260" aria-label="Динамика среднего веса по месяцам" />
    </article>

    <article class="dashboard-card dashboard-card--insights">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Опорные выводы</span>
          <h2>Что видно за выбранные месяцы</h2>
        </div>
        <div class="period-actions">
          <button class="secondary-button" type="button" @click="copyPrompt">Скопировать промпт</button>
          <button class="secondary-button" type="button" @click="downloadJson">Скачать данные</button>
        </div>
      </div>
      <div class="review-cue-grid">
        <article v-for="cue in cues" :key="cue.id" class="review-cue" :class="`review-cue--${cue.tone}`">
          <strong>{{ cue.title }}</strong>
          <p>{{ cue.text }}</p>
        </article>
      </div>
    </article>

    <article class="dashboard-card dashboard-card--progress">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Действия по цели</span>
          <h2>Конкретные действия, подготовка и итоги</h2>
        </div>
        <small>столбцы: % отмеченных дней</small>
      </div>
      <EChartPanel :option="progressOption" :height="320" aria-label="Динамика конкретных действий, подготовки, других занятий и итогов" />
    </article>

    <article class="dashboard-card dashboard-card--table">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Состояние</span>
          <h2>Сон и энергия по месяцам</h2>
        </div>
      </div>
      <div class="trend-table">
        <div class="trend-table__head">
          <span>месяц</span><span>заполнено</span><span>сон (дни)</span><span>вес (изм.)</span><span>энергия (дни)</span
          ><span>шаги / подг.</span><span>питание + / −</span><span>особые</span>
        </div>
        <div v-for="row in monthRows" :key="`${row.monthStart}-state`" class="trend-table__row">
          <strong>{{ row.label }}</strong>
          <span>{{ coverageText(row) }}</span>
          <span
            >{{ formatMinutes(row.summary.averageSleep === null ? null : Math.round(row.summary.averageSleep)) }} ({{
              row.summary.sleepSamples
            }})</span
          >
          <span>{{
            row.summary.averageWeightKg === null
              ? '—'
              : `${row.summary.averageWeightKg.toFixed(1).replace('.0', '')} кг (${row.summary.weightSamples})`
          }}</span>
          <span>{{
            row.summary.averageEnergy === null
              ? '—'
              : `${row.summary.averageEnergy.toFixed(1).replace('.0', '')}/5 (${row.summary.energySamples})`
          }}</span>
          <span>{{ directionText(row) }}</span>
          <span>{{ nutritionText(row) }}</span>
          <span>{{ row.summary.specialDays }}</span>
        </div>
      </div>
    </article>

    <article v-if="factors.length" class="dashboard-card dashboard-card--factors">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Повторяемость</span>
          <h2>Главные факторы дня</h2>
        </div>
      </div>
      <div class="factor-summary-list">
        <article v-for="factor in factors" :key="factor.id" class="factor-summary-item">
          <span class="factor-summary-item__name"
            ><i>{{ factor.icon }}</i
            >{{ factor.label }}</span
          >
          <strong>{{ factor.count }}</strong>
          <small>{{ factorSleepText(factor) }}</small>
          <small>{{ factorEnergyText(factor) }}</small>
        </article>
      </div>
      <p class="data-note">
        Сначала показаны дни с условием, затем обычные дни без него. Особые дни не учитываются. Совпадение не доказывает причину.
      </p>
    </article>

    <article v-if="decisionTimeline.length" class="dashboard-card dashboard-card--timeline">
      <div class="section-heading">
        <div>
          <span class="eyebrow">История изменений</span>
          <h2>События, решения и итоги</h2>
        </div>
        <span class="count-badge">{{ decisionTimeline.length }}</span>
      </div>
      <div class="decision-timeline__summary" aria-label="Состав истории">
        <span v-for="item in timelineSummary" :key="item.tone" :class="`decision-timeline__summary-item--${item.tone}`"
          ><i></i>{{ item.label }} <strong>{{ item.count }}</strong></span
        >
      </div>
      <TransitionGroup name="reveal-list" tag="div" class="decision-timeline">
        <article
          v-for="(item, index) in displayedDecisionTimeline"
          :key="`${item.date}-${item.type}-${item.title}-${index}`"
          class="decision-timeline__item"
          :class="`decision-timeline__item--${item.tone}`"
        >
          <time>{{ formatDate(item.date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</time>
          <span>{{ item.type }}</span>
          <div>
            <strong>{{ item.title }}</strong>
            <p v-if="item.detail">{{ item.detail }}</p>
            <details v-if="item.extra" class="decision-timeline__details">
              <summary>Показать сравнение показателей</summary>
              <p>{{ item.extra }}</p>
            </details>
          </div>
        </article>
      </TransitionGroup>
      <button
        v-if="decisionTimeline.length > 8"
        class="secondary-button load-more timeline-toggle"
        type="button"
        :aria-expanded="timelineExpanded"
        @click="timelineExpanded = !timelineExpanded"
      >
        {{ timelineExpanded ? 'Свернуть историю' : `Показать всю историю (${decisionTimeline.length})` }}
      </button>
    </article>
  </section>
</template>
