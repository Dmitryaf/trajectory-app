<script setup lang="ts">
defineProps<{ modelValue: number | null; lowLabel: string; highLabel: string }>();
defineEmits<{ 'update:modelValue': [value: number] }>();
</script>

<template>
  <div>
    <div class="scale-picker">
      <button
        v-for="value in 5"
        :key="value"
        type="button"
        class="scale-picker__item"
        :class="{ 'scale-picker__item--selected': modelValue === value }"
        @click="$emit('update:modelValue', value)"
      >
        {{ value }}
      </button>
    </div>
    <div class="scale-picker__labels">
      <span>{{ lowLabel }}</span
      ><span>{{ highLabel }}</span>
    </div>
  </div>
</template>
