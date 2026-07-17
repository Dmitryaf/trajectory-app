<script setup lang="ts">
import { computed } from 'vue';
import { formatMinutes } from '../../services/dates';

type SleepBarDatum = {
  key: string;
  label: string;
  value: number | null;
  title: string;
};

const props = withDefaults(defineProps<{
  data: SleepBarDatum[];
  maxMinutes?: number;
}>(), {
  maxMinutes: 720,
});

const height = 250;
const padding = { top: 18, right: 22, bottom: 38, left: 46 };
const plotHeight = height - padding.top - padding.bottom;
const ticks = [0, 180, 360, 540, 720];
const width = computed(() => Math.max(680, padding.left + padding.right + props.data.length * 25));
const plotWidth = computed(() => width.value - padding.left - padding.right);
const barWidth = computed(() => Math.max(8, Math.min(18, plotWidth.value / Math.max(1, props.data.length) - 6)));

function xFor(index: number): number {
  if (props.data.length <= 1) return padding.left + plotWidth.value / 2 - barWidth.value / 2;
  const step = plotWidth.value / props.data.length;
  return padding.left + step * index + (step - barWidth.value) / 2;
}

function yFor(value: number): number {
  const percent = Math.min(1, Math.max(0, value / props.maxMinutes));
  return padding.top + plotHeight * (1 - percent);
}

function gridY(value: number): number {
  return yFor(value);
}

function shortMinutes(value: number): string {
  if (value === 0) return '0';
  return formatMinutes(value).replace(' ', '');
}
</script>

<template>
  <div class="svg-chart-scroll">
    <svg class="svg-chart svg-chart--bar" :viewBox="`0 0 ${width} ${height}`" :style="{ minWidth: `${width}px` }" role="img" aria-label="Динамика сна по дням">
      <defs>
        <linearGradient id="sleepBarGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#8f84f5" />
          <stop offset="100%" stop-color="#5b55c8" />
        </linearGradient>
      </defs>

      <g class="svg-chart__grid">
        <g v-for="tick in ticks" :key="tick">
          <line :x1="padding.left" :x2="width - padding.right" :y1="gridY(tick)" :y2="gridY(tick)" />
          <text :x="padding.left - 10" :y="gridY(tick) + 4" text-anchor="end">{{ shortMinutes(tick) }}</text>
        </g>
      </g>

      <g>
        <g v-for="(item, index) in data" :key="item.key">
          <title>{{ item.title }}</title>
          <rect
            v-if="item.value !== null"
            class="svg-chart__bar"
            :x="xFor(index)"
            :y="yFor(item.value)"
            :width="barWidth"
            :height="height - padding.bottom - yFor(item.value)"
            :rx="barWidth / 2"
          />
          <circle
            v-else
            class="svg-chart__empty-dot"
            :cx="xFor(index) + barWidth / 2"
            :cy="height - padding.bottom"
            r="3"
          />
          <text class="svg-chart__x-label" :x="xFor(index) + barWidth / 2" :y="height - 14" text-anchor="middle">{{ item.label }}</text>
        </g>
      </g>
    </svg>
  </div>
</template>
