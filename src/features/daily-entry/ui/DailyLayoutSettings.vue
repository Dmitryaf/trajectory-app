<script setup lang="ts">
import { RouterLink } from 'vue-router';
import ActionButton from '@/shared/ui/actions/ActionButton.vue';
</script>

<template>
  <div class="daily-layout-settings">
    <span>Хотите добавить или убрать разделы?</span>
    <ActionButton :as="RouterLink" variant="secondary" class="context-action" to="/settings#daily-blocks">
      Настроить главную →
    </ActionButton>
  </div>
</template>

<style scoped>
.daily-layout-settings {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: -4px 0 14px;
  padding: 10px 12px;
  border: 1px solid var(--daily-layout-border);
  border-radius: 14px;
  background: var(--daily-layout-surface);
  color: var(--daily-layout-text);
  font-size: 12px;
}
.context-action {
  flex: 0 0 auto;
  min-height: 40px;
  padding: 9px 13px;
  border-radius: 12px;
  box-shadow: none;
  font-size: 13px;
  line-height: 1.2;
}
@media (max-width: 720px) {
  .daily-layout-settings {
    margin-right: 2px;
    margin-left: 2px;
  }
}
</style>
