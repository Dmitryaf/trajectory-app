<script setup lang="ts">
defineProps<{ title: string; open?: boolean }>();
defineEmits<{ toggle: [event: Event] }>();
</script>

<template>
  <details class="period-details" :open="open" @toggle="$emit('toggle', $event)">
    <summary>{{ title }}</summary>
    <div class="period-details__content"><slot></slot></div>
  </details>
</template>

<style scoped>
.period-details {
  margin-bottom: 16px;
  font-weight: 750;
}
.period-details > summary {
  padding: 13px 15px;
  color: #315d50;
  cursor: pointer;
  font-size: 13px;
}
.period-details[open] > summary {
  margin-bottom: 10px;
}
.period-details__content {
  display: grid;
  gap: 14px;
}
</style>
