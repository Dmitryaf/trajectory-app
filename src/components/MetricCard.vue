<script setup lang="ts">
defineProps<{ label: string; value: string | number; accent?: string; hint?: string }>();
</script>

<template>
  <article class="metric-card" :style="accent ? { '--metric-accent': accent } : undefined">
    <span class="metric-card__label">{{ label }}</span>
    <strong class="metric-card__value">{{ value }}</strong>
    <span v-if="hint" class="metric-card__hint">{{ hint }}</span>
  </article>
</template>
