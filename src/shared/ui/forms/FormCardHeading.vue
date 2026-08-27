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
  background: #edf0ed;
  color: #52645e;
  font-weight: 850;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.55);
}
.section-icon--purple {
  background: #eeeafd;
  color: #6257dc;
}
.section-icon--blue {
  background: #e9f2fd;
  color: #2f79d8;
}
.section-icon--green {
  background: #e6f7f1;
  color: #258c68;
}
.section-icon--amber {
  background: #fff3d9;
  color: #a66c10;
}
.section-icon--orange {
  background: #ffede7;
  color: #ba4d37;
}
@media (max-width: 390px) {
  .form-card__heading :deep(p) {
    font-size: 12px;
  }
}
</style>
