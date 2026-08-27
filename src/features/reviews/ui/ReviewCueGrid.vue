<script setup lang="ts">
import type { ReviewCue } from '@/features/analytics/reviewCues';

defineProps<{ cues: ReviewCue[] }>();
</script>

<template>
  <div class="review-cue-grid review-cue-grid--primary">
    <article v-for="cue in cues" :key="cue.id" class="review-cue" :class="`review-cue--${cue.tone}`">
      <strong>{{ cue.title }}</strong>
      <p>{{ cue.text }}</p>
    </article>
  </div>
</template>

<style scoped>
.review-cue-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.review-cue {
  position: relative;
  overflow: hidden;
  padding: 16px 16px 16px 19px;
  border: 1px solid #e5eaf2;
  border-radius: 16px;
  background: #f9fbfd;
}
.review-cue::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: #aab5c4;
}
.review-cue strong {
  display: block;
  margin-bottom: 6px;
  color: #344055;
  font-size: 13px;
}
.review-cue p {
  margin: 0;
  color: #5c687a;
  font-size: 13px;
  line-height: 1.45;
}
.review-cue--good {
  border-color: #d9eee5;
  background: #f4fbf8;
}
.review-cue--good::before {
  background: #42b98f;
}
.review-cue--good strong {
  color: #2f604e;
}
.review-cue--warning {
  border-color: #f2dfc6;
  background: var(--surface-warning);
}
.review-cue--warning::before {
  background: #dfa646;
}
.review-cue--warning strong {
  color: #71502a;
}
@media (max-width: 720px) {
  .review-cue-grid {
    grid-template-columns: 1fr;
  }
}
</style>
