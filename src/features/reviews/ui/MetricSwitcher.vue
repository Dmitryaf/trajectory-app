<script setup lang="ts">
defineProps<{
  modelValue: string;
  options: Array<{ id: string; label: string }>;
  label: string;
}>();
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <div class="metric-switcher" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      :class="{ active: modelValue === option.id }"
      @click="$emit('update:modelValue', option.id)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.metric-switcher {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.metric-switcher button {
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid #dfe6f0;
  border-radius: 12px;
  background: #f8fafc;
  color: #687287;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}
.metric-switcher button.active {
  border-color: var(--accent);
  background: #eaf7f2;
  color: #235f4c;
}
</style>
