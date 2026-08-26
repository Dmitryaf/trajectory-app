<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ArchivePagination from '@/features/journal/ui/ArchivePagination.vue';

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

<style scoped>
.period-record-preview {
  display: grid;
  gap: 8px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}
.period-record-preview li {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid #e1ebe6;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.72);
  color: #38564d;
  font-size: 13px;
  line-height: 1.4;
}
.period-record-preview li > span {
  color: #298564;
  font-weight: 850;
  text-align: center;
}
.period-record-preview li > div,
.period-record-preview small {
  min-width: 0;
}
.period-record-preview small {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
}
</style>
