<script setup lang="ts">
import { computed } from 'vue';
import { formatDate } from '../../services/dates';

const props = defineProps<{
  dateFrom: string;
  dateTo: string;
  contextLabel: string;
}>();

const emit = defineEmits<{
  'update:dateFrom': [value: string];
  'update:dateTo': [value: string];
}>();

const rangeLabel = computed(() => {
  const from = readableDate(props.dateFrom);
  const to = readableDate(props.dateTo);
  if (from && to) return `Показаны записи с ${from} по ${to}`;
  if (from) return `Показаны записи с ${from}`;
  if (to) return `Показаны записи по ${to}`;
  return '';
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
  <div class="archive-date-filter" :class="{ 'archive-date-filter--active': rangeLabel }">
    <label>
      <span>С</span>
      <input :value="dateFrom" type="date" :aria-label="`Начальная дата ${contextLabel}`" @input="emit('update:dateFrom', ($event.target as HTMLInputElement).value)" />
    </label>
    <label>
      <span>По</span>
      <input :value="dateTo" type="date" :aria-label="`Конечная дата ${contextLabel}`" @input="emit('update:dateTo', ($event.target as HTMLInputElement).value)" />
    </label>
    <div v-if="rangeLabel" class="archive-date-filter__state" aria-live="polite">
      <span>{{ rangeLabel }}</span>
      <button class="ghost-button" type="button" @click="showAllTime">За всё время</button>
    </div>
  </div>
</template>
