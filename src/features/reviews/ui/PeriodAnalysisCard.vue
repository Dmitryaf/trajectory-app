<script setup lang="ts">
import { RouterLink } from 'vue-router';
import AiAnalysisSteps from '@/features/analysis/ui/AiAnalysisSteps.vue';
import PeriodActions from '@/features/reviews/ui/PeriodActions.vue';
import ReviewCueGrid from '@/features/reviews/ui/ReviewCueGrid.vue';
import type { ReviewCue } from '@/features/analytics/reviewCues';

defineProps<{
  title: string;
  cues: ReviewCue[];
  copying: boolean;
  sectionId?: string;
}>();

defineEmits<{
  copy: [];
  download: [];
}>();
</script>

<template>
  <article :id="sectionId" class="dashboard-card period-analysis-card">
    <div class="section-heading">
      <div>
        <span class="eyebrow">Короткий разбор</span>
        <h2>{{ title }}</h2>
      </div>
      <PeriodActions :copying="copying" @copy="$emit('copy')" @download="$emit('download')" />
    </div>
    <AiAnalysisSteps />
    <div class="review-nudge range-custom-action period-analysis-card__range">
      <div>
        <strong>Нужен другой период?</strong>
        <p>Выберите точные даты и подготовьте текст в настройках.</p>
      </div>
      <RouterLink class="secondary-button" to="/settings#analysis-settings">Выбрать даты</RouterLink>
    </div>
    <ReviewCueGrid :cues="cues" />
  </article>
</template>

<style scoped>
.period-analysis-card {
  position: relative;
  margin-bottom: 16px;
  border-color: var(--line-success);
}
.period-analysis-card > .section-heading {
  padding-bottom: 15px;
  border-bottom: 1px solid #e8eeeb;
}
.period-analysis-card__range {
  margin-top: 16px;
}
@media (max-width: 720px) {
  .section-heading:has(.period-actions) {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
