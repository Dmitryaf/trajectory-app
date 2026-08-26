<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
defineEmits<{ previous: []; next: []; current: [] }>();
</script>

<template>
  <div class="period-nav">
    <button class="icon-button" type="button" aria-label="Предыдущий период" @click="$emit('previous')">←</button>
    <button class="period-nav__label" type="button" @click="$emit('current')">
      <strong>{{ title }}</strong>
      <span v-if="subtitle">{{ subtitle }}</span>
    </button>
    <button class="icon-button" type="button" aria-label="Следующий период" @click="$emit('next')">→</button>
  </div>
</template>

<style scoped>
.period-nav {
  display: grid;
  grid-template-columns: 46px 1fr 46px;
  gap: 8px;
  align-items: center;
  max-width: 560px;
  margin: 0 auto 22px;
  padding: 7px;
  border-radius: 20px;
  background: var(--navy);
  box-shadow: 0 14px 32px rgba(16, 45, 44, 0.18);
}
.icon-button {
  height: 46px;
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.09);
  color: #bfe9d9;
  cursor: pointer;
  font-size: 18px;
  transition:
    background-color 0.15s,
    color 0.15s;
}
.icon-button:hover {
  background: rgba(140, 225, 191, 0.18);
  color: var(--text-inverse);
}
.period-nav__label {
  min-width: 0;
  min-height: 46px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--text-inverse);
  cursor: pointer;
  text-align: center;
}
.period-nav__label strong,
.period-nav__label span {
  display: block;
}
.period-nav__label strong {
  font-size: 17px;
  text-transform: capitalize;
}
.period-nav__label span {
  margin-top: 3px;
  color: var(--text-inverse-muted);
  font-size: 11px;
}

@media (max-width: 720px) {
  .period-nav {
    grid-template-columns: 42px minmax(0, 1fr) 42px;
    margin-bottom: 16px;
    padding: 6px;
    border-radius: 18px;
  }
  .icon-button,
  .period-nav__label {
    min-height: 42px;
    height: 42px;
  }
  .period-nav__label strong {
    font-size: 16px;
  }
}
</style>
