<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { init, use } from 'echarts/core';
import { BarChart, HeatmapChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  CalendarComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ECharts, EChartsCoreOption } from 'echarts/core';

use([
  BarChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  CalendarComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

const props = withDefaults(
  defineProps<{
    option: EChartsCoreOption;
    height?: number;
    ariaLabel?: string;
  }>(),
  {
    height: 300,
    ariaLabel: 'График',
  },
);

const chartEl = ref<HTMLDivElement>();
let chart: ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

function render() {
  if (!chart) return;
  chart.setOption(props.option, true);
}

function resize() {
  chart?.resize();
}

onMounted(async () => {
  await nextTick();
  if (!chartEl.value) return;
  chart = init(chartEl.value, null, { renderer: 'canvas' });
  render();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(chartEl.value);
});

watch(() => props.option, render, { deep: true });
watch(
  () => props.height,
  () => nextTick(resize),
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  chart?.dispose();
});
</script>

<template>
  <div ref="chartEl" class="echart-panel" :style="{ height: `${height}px` }" role="img" :aria-label="ariaLabel"></div>
</template>
