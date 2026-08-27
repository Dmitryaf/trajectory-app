<script setup lang="ts">
import type { Component } from 'vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    as?: string | Component;
    variant?: 'primary' | 'secondary' | 'danger';
  }>(),
  {
    as: 'button',
    variant: 'primary',
  },
);
</script>

<template>
  <component
    :is="props.as"
    v-bind="$attrs"
    :type="props.as === 'button' ? ($attrs.type ?? 'button') : undefined"
    :class="`${props.variant}-button`"
  >
    <slot />
  </component>
</template>

<style scoped src="./ActionButton.css"></style>
