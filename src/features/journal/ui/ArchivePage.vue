<script setup lang="ts">
defineProps<{
  tone: 'results' | 'events';
  headingEyebrow: string;
  headingTitle: string;
  headingDescription: string;
  archiveEyebrow: string;
  archiveTitle: string;
  count: number;
  hasItems: boolean;
  emptyIcon: string;
  emptyTitle: string;
  emptyDescription: string;
}>();
</script>

<template>
  <section class="page page--archive" :class="`page--${tone}`">
    <div class="page-heading">
      <div>
        <span class="eyebrow">{{ headingEyebrow }}</span>
        <h1>{{ headingTitle }}</h1>
        <p>{{ headingDescription }}</p>
      </div>
    </div>

    <article class="form-card result-composer archive-composer" :class="`archive-composer--${tone}`">
      <slot name="composer"></slot>
    </article>

    <section class="archive-panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">{{ archiveEyebrow }}</span>
          <h2>{{ archiveTitle }}</h2>
        </div>
        <span class="archive-count">{{ count }}</span>
      </div>
      <div class="archive-filters">
        <slot name="filters"></slot>
      </div>
      <slot v-if="hasItems"></slot>
      <div v-else class="archive-empty">
        <span>{{ emptyIcon }}</span>
        <h3>{{ emptyTitle }}</h3>
        <p>{{ emptyDescription }}</p>
      </div>
    </section>
  </section>
</template>

<style scoped>
.page--archive > .page-heading {
  position: relative;
  min-height: 158px;
  align-items: center;
  overflow: hidden;
  margin: 10px 0 18px;
  padding: 28px 30px;
  border-radius: 28px;
  box-shadow: var(--shadow-soft);
}
.page--archive > .page-heading::after {
  content: '';
  position: absolute;
  width: 190px;
  height: 190px;
  right: -42px;
  bottom: -128px;
  border-radius: 50%;
  opacity: 0.5;
}
.page--archive > .page-heading > * {
  position: relative;
  z-index: 1;
}
.page--archive > .page-heading h1 {
  margin-top: 5px;
  font-size: clamp(38px, 5vw, 58px);
  letter-spacing: -0.045em;
}
.page--results > .page-heading {
  border: 1px solid #d2e9df;
  background: linear-gradient(135deg, #fafffd, #dff5ec);
}
.page--results > .page-heading::after {
  background: var(--mint);
}
.page--events > .page-heading {
  border: 1px solid #eee0c5;
  background: linear-gradient(135deg, #fffdf8, #fff0ce);
}
.page--events > .page-heading::after {
  background: #ffd06e;
}
.archive-composer {
  position: relative;
  margin-bottom: 20px;
  overflow: hidden;
  box-shadow: 0 12px 30px rgba(16, 45, 44, 0.075);
}
.archive-composer::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 5px;
  background: var(--status-success);
}
.archive-composer--events::before {
  background: var(--amber);
}
:deep(.composer-cancel) {
  margin-top: 10px;
}
.archive-panel {
  padding: 24px;
  border: 1px solid #dce6e1;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 12px 34px rgba(16, 45, 44, 0.07);
}
.archive-panel > .section-heading {
  padding-bottom: 15px;
  border-bottom: 1px solid #e7eeea;
}
.archive-count {
  min-width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #e3f4ed;
  color: #24634e;
  font-weight: 750;
}
.page--events .archive-count {
  background: #fff0ce;
  color: #805614;
}
.archive-filters {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 190px 150px 150px;
  gap: 10px;
  margin-bottom: 18px;
  padding: 12px;
  border: 1px solid #e4ebe7;
  border-radius: 17px;
  background: #f5f9f7;
}
.page--events .archive-filters {
  border-color: #eee5d2;
  background: #fffcf6;
}
:deep(.archive-filters > input),
:deep(.archive-filters > select) {
  width: 100%;
  min-width: 0;
}
.archive-empty {
  padding: 45px 24px;
  border: 1px dashed #ced5e2;
  border-radius: 20px;
  color: var(--muted);
  text-align: center;
}
.archive-empty > span {
  color: var(--accent-dark);
  font-size: 30px;
}
.archive-empty h3 {
  margin: 10px 0 5px;
  color: var(--text);
}
.archive-empty p {
  margin-bottom: 0;
}
:deep(.archive-list-enter-active),
:deep(.archive-list-leave-active),
:deep(.archive-list-move) {
  transition:
    opacity var(--motion-base) var(--motion-ease),
    transform var(--motion-base) var(--motion-ease);
}
:deep(.archive-list-enter-from),
:deep(.archive-list-leave-to) {
  opacity: 0;
  transform: translateY(-6px) scale(0.99);
}
:deep(.archive-list-leave-active) {
  position: absolute;
  width: 100%;
}
@media (max-width: 720px) {
  .page--archive > .page-heading {
    min-height: 132px;
    margin: 4px 0 14px;
    padding: 22px;
    border-radius: 24px;
  }
  .page--archive > .page-heading h1 {
    font-size: 40px;
  }
  .page--archive > .page-heading::after {
    right: -82px;
    bottom: -142px;
  }
  .archive-composer,
  .archive-panel {
    padding: 18px;
    border-radius: 20px;
  }
  .archive-filters {
    grid-template-columns: 1fr 1fr;
  }
  :deep(.archive-filters > input:first-child) {
    grid-column: 1 / -1;
  }
}
@media (max-width: 520px) {
  .archive-filters {
    grid-template-columns: 1fr;
  }
  :deep(.archive-filters > input:first-child) {
    grid-column: auto;
  }
}
</style>
