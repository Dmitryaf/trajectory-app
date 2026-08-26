<script setup lang="ts">
import { computed } from 'vue';
import { formatDate } from '@/services/dates';

const props = defineProps<{
  dateFrom: string;
  dateTo: string;
  contextLabel: string;
}>();

const emit = defineEmits<{
  'update:dateFrom': [value: string];
  'update:dateTo': [value: string];
}>();

const hasRange = computed(() => Boolean(props.dateFrom || props.dateTo));

const rangeLabel = computed(() => {
  const from = readableDate(props.dateFrom);
  const to = readableDate(props.dateTo);
  if (from && to) {
    return `Показаны записи с ${from} по ${to}`;
  }
  if (from) {
    return `Показаны записи с ${from}`;
  }
  if (to) {
    return `Показаны записи по ${to}`;
  }
  return 'Показаны записи за всё время';
});

function readableDate(value: string) {
  return value ? formatDate(value, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

function showAllTime() {
  emit('update:dateFrom', '');
  emit('update:dateTo', '');
}
</script>

<template>
  <div class="archive-date-filter">
    <label>
      <span>С</span>
      <input
        :value="dateFrom"
        type="date"
        :aria-label="`Начальная дата ${contextLabel}`"
        @input="emit('update:dateFrom', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      <span>По</span>
      <input
        :value="dateTo"
        type="date"
        :aria-label="`Конечная дата ${contextLabel}`"
        @input="emit('update:dateTo', ($event.target as HTMLInputElement).value)"
      />
    </label>
  </div>
  <p class="archive-date-filter__state" aria-live="polite">{{ rangeLabel }}</p>
  <button class="archive-filter__all-time" type="button" :disabled="!hasRange" @click="showAllTime">За всё время</button>
</template>

<style scoped>
.archive-date-filter {
  display: grid;
  grid-column: span 2;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.archive-date-filter__state {
  display: flex;
  grid-column: 1 / -2;
  min-height: 34px;
  align-items: center;
  margin: 0;
  padding: 0 4px;
  color: #315f50;
  font-size: 12px;
  font-weight: 700;
}
.archive-filter__all-time {
  min-height: 34px;
  align-self: center;
  justify-self: end;
  padding: 5px 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #267057;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}
.archive-filter__all-time:hover:not(:disabled) {
  background: rgba(38, 112, 87, 0.08);
  color: #174f40;
}
.archive-filter__all-time:disabled {
  color: #96a49f;
  cursor: default;
}

@media (max-width: 720px) {
  .archive-date-filter {
    grid-column: 1 / -1;
  }
  .archive-date-filter__state {
    grid-column: 1;
  }
  .archive-filter__all-time {
    grid-column: 2;
  }
}

@media (max-width: 520px) {
  .archive-date-filter {
    grid-template-columns: 1fr;
  }
  .archive-date-filter__state,
  .archive-filter__all-time {
    grid-column: auto;
  }
  .archive-filter__all-time {
    justify-self: start;
  }
}
</style>
