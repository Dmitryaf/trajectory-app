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
