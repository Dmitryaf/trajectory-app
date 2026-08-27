<script setup lang="ts">
import { ref } from 'vue';

defineOptions({ inheritAttrs: false });
withDefaults(defineProps<{ icon: string; variant?: 'feedback' | 'help' | 'inline' }>(), { variant: 'feedback' });

const element = ref<HTMLButtonElement>();
defineExpose({ element });
</script>

<template>
  <button ref="element" class="utility-trigger" :class="`utility-trigger--${variant}`" type="button" v-bind="$attrs">
    <span aria-hidden="true">{{ icon }}</span>
    <strong><slot /></strong>
  </button>
</template>

<style scoped>
.utility-trigger {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 15px;
  border: 1px solid #c9ded5;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: #245f4d;
  box-shadow: 0 12px 30px rgba(16, 45, 44, 0.14);
  font-size: 12px;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform var(--motion-fast),
    border-color var(--motion-fast),
    box-shadow var(--motion-fast);
}
.utility-trigger span {
  color: var(--accent-dark);
  font-size: 15px;
}
.utility-trigger strong {
  font-weight: 850;
}
.utility-trigger--help {
  width: 38px;
  min-height: 38px;
  justify-content: center;
  padding: 0;
}
.utility-trigger--help strong {
  display: none;
}
.utility-trigger--inline {
  width: auto;
  min-height: 42px;
  justify-content: center;
  padding: 9px 13px;
  background: var(--surface);
}
.utility-trigger:hover {
  border-color: #8fcdb5;
  box-shadow: 0 15px 34px rgba(16, 45, 44, 0.18);
  transform: translateY(-2px);
}
@media (min-width: 980px) {
  .utility-trigger:not(.utility-trigger--inline) {
    min-height: 38px;
    padding: 8px 12px;
  }
}
@media (min-width: 980px) and (max-width: 1150px) {
  .utility-trigger--feedback {
    width: 38px;
    justify-content: center;
    padding: 0;
  }
  .utility-trigger--feedback strong {
    display: none;
  }
}
@media (max-width: 720px) {
  .utility-trigger--feedback {
    min-height: 36px;
    padding: 7px 10px;
  }
  .utility-trigger--feedback strong {
    display: none;
  }
  .utility-trigger--help {
    width: 36px;
    min-height: 36px;
  }
}
@media (max-width: 390px) {
  .utility-trigger--feedback {
    width: 36px;
    justify-content: center;
    padding: 0;
  }
}
</style>
