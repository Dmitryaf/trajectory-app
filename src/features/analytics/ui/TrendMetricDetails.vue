<script setup lang="ts">
import type { EChartsCoreOption } from 'echarts/core';
import PeriodDetails from '@/features/reviews/ui/PeriodDetails.vue';
import MetricSwitcher from '@/features/reviews/ui/MetricSwitcher.vue';
import ReviewNotice from '@/features/reviews/ui/ReviewNotice.vue';
import EChartPanel from '@/shared/ui/charts/EChartPanel.vue';

defineProps<{
  options: Array<{ id: string; label: string; samples: number }>;
  modelValue: string;
  selectedLabel?: string;
  selectedSamples?: number;
  chartOption: EChartsCoreOption;
  description: string;
}>();
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <PeriodDetails class="trends-metric-details" title="Показать один показатель по месяцам">
    <article v-if="options.length" class="dashboard-card trend-metric-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Динамика периода</span>
          <h2>{{ selectedLabel }}</h2>
        </div>
        <small>{{ selectedSamples }} наблюдений · минимум два месяца</small>
      </div>
      <MetricSwitcher
        :model-value="modelValue"
        :options="options"
        label="Показатель графика"
        @update:model-value="$emit('update:modelValue', $event)"
      />
      <EChartPanel :option="chartOption" :height="300" :aria-label="`Динамика: ${selectedLabel}`" :description="description" />
      <p class="data-note trend-chart-description">
        Показаны месячные средние и важные события. Совпадение изменений во времени не доказывает причину; текущий месяц может быть
        неполным.
      </p>
    </article>
    <ReviewNotice v-else class="trends-chart-guide">
      <strong>Для графика пока мало сопоставимых данных</strong>
      <p>Нужны наблюдения хотя бы в двух месяцах: 6 для сна или энергии либо 3 измерения веса.</p>
    </ReviewNotice>
  </PeriodDetails>
</template>

<style scoped>
.trend-metric-card {
  --section-accent: var(--purple);
  position: relative;
  margin-bottom: 16px;
  border-color: var(--line-success);
}
.trend-metric-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 24px;
  right: 24px;
  height: 3px;
  border-radius: 0 0 4px 4px;
  background: var(--section-accent);
}
.trend-metric-card > .section-heading {
  padding-bottom: 15px;
  border-bottom: 1px solid #e8eeeb;
}
.data-note {
  margin: 10px 0 0;
  color: #7a8497;
  font-size: 12px;
  line-height: 1.5;
}
</style>
