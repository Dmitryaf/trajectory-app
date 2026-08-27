<script setup lang="ts">
withDefaults(
  defineProps<{
    icon: string;
    tone?: 'default' | 'purple' | 'blue' | 'green' | 'amber' | 'orange';
  }>(),
  { tone: 'default' },
);
</script>

<template>
  <header class="form-card__heading">
    <span class="section-icon" :class="`section-icon--${tone}`" aria-hidden="true">{{ icon }}</span>
    <slot />
  </header>
</template>

<style scoped>
.form-card__heading {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  margin-bottom: 20px;
}
.form-card__heading > :deep(div) {
  min-width: 0;
}
.form-card__heading :deep(h2),
.form-card__heading :deep(p) {
  margin-bottom: 0;
}
.form-card__heading :deep(p) {
  margin-top: 3px;
  font-size: 13px;
}
.section-icon {
  width: 38px;
  height: 38px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 13px;
  background: var(--form-heading-neutral-surface);
  color: var(--form-heading-neutral-text);
  font-weight: 850;
  box-shadow: inset 0 0 0 1px var(--form-heading-highlight);
}
.section-icon--purple {
  background: var(--form-heading-purple-surface);
  color: var(--form-heading-purple-text);
}
.section-icon--blue {
  background: var(--form-heading-blue-surface);
  color: var(--form-heading-blue-text);
}
.section-icon--green {
  background: var(--form-heading-green-surface);
  color: var(--form-heading-green-text);
}
.section-icon--amber {
  background: var(--form-heading-amber-surface);
  color: var(--form-heading-amber-text);
}
.section-icon--orange {
  background: var(--form-heading-orange-surface);
  color: var(--form-heading-orange-text);
}
@media (max-width: 390px) {
  .form-card__heading :deep(p) {
    font-size: 12px;
  }
}
</style>
