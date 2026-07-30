<script setup lang="ts">
import { ref, watch } from 'vue';
import { combineDuration, splitDuration } from '../services/duration';

const props = defineProps<{
  id: string;
  modelValue: number | null;
  maxHours: number;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>();
const hours = ref<number | string | null>(null);
const minutes = ref<number | string | null>(null);
let syncing = false;

watch(
  () => props.modelValue,
  (value) => {
    syncing = true;
    const parts = splitDuration(value);
    hours.value = parts.hours;
    minutes.value = parts.minutes;
    syncing = false;
  },
  { immediate: true },
);

watch([hours, minutes], () => {
  if (syncing) return;
  const hourValue = typeof hours.value === 'number' ? hours.value : null;
  const minuteValue = typeof minutes.value === 'number' ? minutes.value : null;
  emit('update:modelValue', combineDuration(hourValue, minuteValue, props.maxHours * 60));
});
</script>

<template>
  <div class="duration-field">
    <label>
      <input
        :id="id"
        v-model.number="hours"
        type="number"
        min="0"
        :max="maxHours"
        step="1"
        inputmode="numeric"
        aria-label="Часы"
        placeholder="7"
      />
      <span>ч</span>
    </label>
    <label>
      <input v-model.number="minutes" type="number" min="0" max="59" step="1" inputmode="numeric" aria-label="Минуты" placeholder="30" />
      <span>мин</span>
    </label>
  </div>
</template>
