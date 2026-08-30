<script setup lang="ts">
import PageHeading from '@/shared/ui/layout/PageHeading.vue';
import EyebrowText from '@/shared/ui/typography/EyebrowText.vue';
defineProps<{
  label: string;
  title: string;
  summary: string;
  action?: string;
  href?: string;
}>();
</script>

<template>
  <PageHeading>
    <div>
      <EyebrowText>{{ label }}</EyebrowText>
      <h1>{{ title }}</h1>
      <p>{{ summary }}</p>
    </div>
    <a v-if="action && href" class="review-jump" :href="href">{{ action }} <span aria-hidden="true">↓</span></a>
  </PageHeading>
</template>

<style scoped>
.page-heading {
  position: relative;
  min-height: 148px;
  align-items: center;
  overflow: hidden;
  margin: 10px 0 16px;
  padding: 26px 30px;
  border: 1px solid var(--review-heading-border);
  border-radius: 28px;
  background: linear-gradient(135deg, var(--review-heading-surface-start), var(--review-heading-surface-end));
  box-shadow: var(--shadow-soft);
}
.page-heading::after {
  content: '';
  position: absolute;
  width: 210px;
  height: 210px;
  right: -62px;
  top: -118px;
  border: 36px solid var(--review-heading-decoration);
  border-radius: 50%;
}
.page-heading > * {
  position: relative;
  z-index: 1;
}
.page-heading h1 {
  margin-top: 5px;
  font-size: clamp(38px, 5vw, 58px);
  letter-spacing: -0.045em;
}
.page-heading p {
  max-width: 520px;
}
.review-jump {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 42px;
  padding: 10px 14px;
  border: 1px solid var(--review-heading-chip-border);
  border-radius: 14px;
  background: var(--review-heading-chip-surface);
  color: var(--review-heading-chip-text);
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
}
.review-jump span {
  color: var(--review-heading-accent);
  font-size: 16px;
}
@media (max-width: 720px) {
  .page-heading {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 12px;
    margin: 4px 0 14px;
    padding: 18px;
    border-radius: 24px;
  }
  .page-heading > div {
    min-width: 0;
  }
  .page-heading h1 {
    margin-top: 2px;
    font-size: clamp(35px, 10vw, 40px);
  }
  .page-heading p {
    font-size: 14px;
    line-height: 1.42;
  }
  .page-heading::after {
    right: -92px;
    top: -136px;
  }
  .review-jump {
    min-height: 38px;
    padding: 8px 11px;
  }
}
</style>
