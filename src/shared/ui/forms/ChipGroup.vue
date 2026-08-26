<script setup lang="ts" generic="T extends string">
import type { Option } from '@/types';

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

<style scoped>
.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}
.chip {
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-soft);
  color: #53625d;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}
.chip:active {
  transform: scale(0.98);
}
.chip:hover {
  border-color: #c1c9d9;
  background: var(--surface);
  box-shadow: 0 3px 10px rgba(39, 50, 75, 0.06);
}
.chip--selected {
  border-color: rgba(73, 201, 155, 0.7);
  background: #dff7ee;
  color: #0f6048;
  box-shadow: 0 5px 14px rgba(73, 201, 155, 0.16);
}
.chip__icon {
  margin-right: 6px;
  font-weight: 900;
}

@media (max-width: 390px) {
  .chip {
    padding: 9px 11px;
    font-size: 12px;
  }
}
</style>
