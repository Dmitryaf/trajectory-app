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

<style scoped>
.metric-card {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 124px;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  padding: 20px;
  border: 1px solid var(--metric-card-border);
  border-radius: 20px;
  background: linear-gradient(155deg, var(--surface) 60%, var(--metric-card-gradient));
  box-shadow: 0 9px 24px var(--metric-card-shadow);
}
.metric-card::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 4px;
  background: var(--metric-accent, var(--accent));
  content: '';
}
.metric-card::after {
  position: absolute;
  right: -26px;
  bottom: -35px;
  width: 74px;
  height: 74px;
  border-radius: 50%;
  background: var(--metric-accent, var(--accent));
  content: '';
  opacity: 0.08;
}
.metric-card__label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}
.metric-card__value {
  position: relative;
  z-index: 1;
  margin-top: 9px;
  color: var(--navy);
  font-size: 27px;
  letter-spacing: -0.025em;
  line-height: 1;
}
.metric-card__hint {
  margin-top: 7px;
  color: var(--metric-card-meta);
  font-size: 11px;
}
.metric-card__label,
.metric-card__hint {
  overflow-wrap: anywhere;
}

@media (max-width: 720px) {
  .metric-card {
    min-height: 105px;
  }
  .metric-card__value {
    font-size: 21px;
  }
}

@media (max-width: 390px) {
  .metric-card {
    padding: 14px;
  }
}
</style>
