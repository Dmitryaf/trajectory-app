<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ArchivePagination from '../features/journal/ArchivePagination.vue';

interface PeriodRecordItem {
  id: string | number;
  icon: string;
  title: string;
  dateLabel: string;
}

interface PeriodRecordBreakdownItem {
  id: string;
  icon?: string;
  label: string;
  count: number;
}

const props = withDefaults(
  defineProps<{
    eyebrow: string;
    title: string;
    items: PeriodRecordItem[];
    breakdown: PeriodRecordBreakdownItem[];
    breakdownLabel: string;
    paginationLabel: string;
    pageSize?: number;
  }>(),
  { pageSize: 5 },
);

const page = ref(1);
const pageCount = computed(() => Math.max(1, Math.ceil(props.items.length / props.pageSize)));
const visibleItems = computed(() => {
  const start = (page.value - 1) * props.pageSize;
  return props.items.slice(start, start + props.pageSize);
});

watch(
  () => props.items,
  () => {
    page.value = 1;
  },
);
watch(pageCount, (count) => {
  page.value = Math.min(page.value, count);
});
</script>

<template>
  <article class="period-record-card">
    <div class="period-record-card__heading">
      <div>
        <span class="eyebrow">{{ eyebrow }}</span>
        <h2>{{ title }}</h2>
      </div>
      <span class="count-badge">{{ items.length }}</span>
    </div>
    <div v-if="breakdown.length" class="period-record-card__breakdown" :aria-label="breakdownLabel">
      <span v-for="item in breakdown" :key="item.id">{{ item.icon ?? '·' }} {{ item.label }} · {{ item.count }}</span>
    </div>
    <ul class="period-record-preview">
      <li v-for="item in visibleItems" :key="item.id">
        <span>{{ item.icon }}</span>
        <div>
          {{ item.title }}<small>{{ item.dateLabel }}</small>
        </div>
      </li>
    </ul>
    <ArchivePagination v-model:page="page" :page-count="pageCount" :context-label="paginationLabel" />
  </article>
</template>
