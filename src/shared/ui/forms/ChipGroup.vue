<script setup lang="ts" generic="T extends string">
import type { Option } from '../../../types';

const props = defineProps<{
  options: Option<T>[];
  modelValue: T | T[] | null;
  multiple?: boolean;
  allowClear?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: T | T[] | null] }>();

function isSelected(id: T): boolean {
  return Array.isArray(props.modelValue) ? props.modelValue.includes(id) : props.modelValue === id;
}

function toggle(id: T) {
  if (props.multiple) {
    const current = Array.isArray(props.modelValue) ? props.modelValue : [];
    emit('update:modelValue', current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    return;
  }
  emit('update:modelValue', props.allowClear && props.modelValue === id ? null : id);
}
</script>

<template>
  <div class="chip-group">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      class="chip"
      :class="{ 'chip--selected': isSelected(option.id) }"
      :aria-pressed="isSelected(option.id)"
      @click="toggle(option.id)"
    >
      <span v-if="option.icon" class="chip__icon">{{ option.icon }}</span>
      {{ option.label }}
    </button>
  </div>
</template>
