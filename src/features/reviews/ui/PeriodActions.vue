<script setup lang="ts">
withDefaults(defineProps<{ copying?: boolean }>(), { copying: false });
defineEmits<{ copy: []; download: [] }>();
</script>

<template>
  <div class="period-actions">
    <button class="secondary-button" type="button" :disabled="copying" :aria-busy="copying" @click="$emit('copy')">
      Подготовить текст для нейросети
    </button>
    <button class="secondary-button" type="button" @click="$emit('download')">Скачать данные</button>
  </div>
</template>

<style scoped>
.period-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.period-actions .secondary-button {
  padding: 10px 12px;
  font-size: 12px;
}
@media (max-width: 720px) {
  .period-actions {
    width: 100%;
    justify-content: stretch;
  }
  .period-actions .secondary-button {
    flex: 1;
  }
}
</style>
