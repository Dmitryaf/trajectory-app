<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    danger?: boolean;
    disabled?: boolean;
  }>(),
  { danger: false, disabled: false },
);

defineEmits<{ click: [event: MouseEvent] }>();
</script>

<template>
  <button
    class="icon-action-button"
    :class="{ 'icon-action-button--danger': danger }"
    type="button"
    :aria-label="label"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot></slot>
  </button>
</template>

<style scoped>
.icon-action-button {
  border: 0;
  background: transparent;
  color: var(--icon-action-muted);
  cursor: pointer;
  font-size: 22px;
}
.icon-action-button--danger:hover {
  color: var(--icon-action-danger);
}
</style>
