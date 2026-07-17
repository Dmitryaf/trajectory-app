<script setup lang="ts">
type EnergySleepPoint = {
  key: string;
  sleepMinutes: number;
  energy: number;
  hasMovement: boolean;
  isSpecial: boolean;
  title: string;
};

defineProps<{
  points: EnergySleepPoint[];
}>();

const width = 720;
const height = 280;
const padding = { top: 18, right: 28, bottom: 40, left: 48 };
const plotWidth = width - padding.left - padding.right;
const plotHeight = height - padding.top - padding.bottom;
const sleepTicks = [0, 180, 360, 540, 720];
const energyTicks = [1, 2, 3, 4, 5];

function xFor(minutes: number): number {
  const percent = Math.min(1, Math.max(0, minutes / 720));
  return padding.left + plotWidth * percent;
}

function yFor(energy: number): number {
  const percent = Math.min(1, Math.max(0, (energy - 1) / 4));
  return padding.top + plotHeight * (1 - percent);
}

function sleepLabel(minutes: number): string {
  return minutes === 0 ? '0' : `${minutes / 60}ч`;
}
</script>

<template>
  <div class="svg-chart-scroll">
    <svg class="svg-chart svg-chart--scatter" :viewBox="`0 0 ${width} ${height}`" :style="{ minWidth: `${width}px` }" role="img" aria-label="Связь сна, энергии и движения">
      <g class="svg-chart__grid">
        <g v-for="tick in energyTicks" :key="`energy-${tick}`">
          <line :x1="padding.left" :x2="width - padding.right" :y1="yFor(tick)" :y2="yFor(tick)" />
          <text :x="padding.left - 12" :y="yFor(tick) + 4" text-anchor="end">{{ tick }}</text>
        </g>
        <g v-for="tick in sleepTicks" :key="`sleep-${tick}`">
          <line :x1="xFor(tick)" :x2="xFor(tick)" :y1="padding.top" :y2="height - padding.bottom" />
          <text class="svg-chart__x-label" :x="xFor(tick)" :y="height - 14" text-anchor="middle">{{ sleepLabel(tick) }}</text>
        </g>
      </g>

      <text class="svg-chart__axis-title" :x="padding.left" y="10">энергия</text>
      <text class="svg-chart__axis-title" :x="width - padding.right" :y="height - 2" text-anchor="end">сон</text>

      <g>
        <circle
          v-for="point in points"
          :key="point.key"
          class="svg-chart__point"
          :class="{ 'svg-chart__point--movement': point.hasMovement, 'svg-chart__point--special': point.isSpecial }"
          :cx="xFor(point.sleepMinutes)"
          :cy="yFor(point.energy)"
          :r="point.isSpecial ? 8 : 7"
        >
          <title>{{ point.title }}</title>
        </circle>
      </g>
    </svg>
  </div>
</template>
