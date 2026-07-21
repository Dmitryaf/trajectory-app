<script setup lang="ts">
const props = defineProps<{
  page: number;
  pageCount: number;
  contextLabel: string;
}>();

const emit = defineEmits<{
  'update:page': [value: number];
}>();

function changePage(nextPage: number) {
  emit('update:page', Math.min(Math.max(1, nextPage), props.pageCount));
}
</script>

<template>
  <nav v-if="pageCount > 1" class="archive-pagination" :aria-label="`Страницы ${contextLabel}`">
    <button class="secondary-button" type="button" :disabled="page === 1" @click="changePage(page - 1)">Назад</button>
    <span>{{ page }} из {{ pageCount }}</span>
    <button class="secondary-button" type="button" :disabled="page === pageCount" @click="changePage(page + 1)">Дальше</button>
  </nav>
</template>
