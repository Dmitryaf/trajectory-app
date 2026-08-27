<script setup lang="ts">
import type { RangeMonths } from '@/features/analytics/useChangeHistoryView';

defineProps<{
  modelValue: RangeMonths;
  options: Array<{ value: RangeMonths; label: string }>;
}>();
defineEmits<{ 'update:modelValue': [value: RangeMonths] }>();
</script>

<template>
  <div class="range-tabs history-range-tabs" aria-label="Период истории">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :class="{ active: modelValue === option.value }"
      @click="$emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.history-range-tabs {
  width: fit-content;
  display: flex;
  gap: 4px;
  margin: 0 0 22px;
  padding: 6px;
  border-radius: 18px;
  background: var(--navy);
  box-shadow: 0 12px 28px rgba(16, 45, 44, 0.16);
}
.history-range-tabs button {
  min-width: 112px;
  min-height: 48px;
  padding: 10px 14px;
  border: 0;
  border-radius: 13px;
  background: transparent;
  color: var(--text-inverse-muted);
  cursor: pointer;
  font-weight: 750;
}
.history-range-tabs button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-inverse);
}
.history-range-tabs button.active {
  background: var(--mint);
  color: var(--navy);
  box-shadow: 0 5px 14px rgba(0, 0, 0, 0.15);
}
@media (max-width: 720px) {
  .history-range-tabs {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-bottom: 14px;
  }
  .history-range-tabs button {
    min-width: 0;
    padding: 10px 6px;
    font-size: 12px;
  }
}
</style>
