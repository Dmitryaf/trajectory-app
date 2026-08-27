<script setup lang="ts">
import SurfaceCard from '@/shared/ui/layout/SurfaceCard.vue';
import SectionHeading from '@/shared/ui/layout/SectionHeading.vue';
import ActionButton from '@/shared/ui/actions/ActionButton.vue';
import { RouterLink } from 'vue-router';
import AiAnalysisSteps from '@/features/analysis/ui/AiAnalysisSteps.vue';
import PeriodActions from '@/features/reviews/ui/PeriodActions.vue';
import ReviewCueGrid from '@/features/reviews/ui/ReviewCueGrid.vue';
import type { ReviewCue } from '@/features/analytics/reviewCues';
import ReviewNudge from '@/shared/ui/content/ReviewNudge.vue';
import EyebrowText from '@/shared/ui/typography/EyebrowText.vue';

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
  <SurfaceCard :id="sectionId" kind="dashboard" class="period-analysis-card">
    <SectionHeading>
      <div>
        <EyebrowText>Короткий разбор</EyebrowText>
        <h2>{{ title }}</h2>
      </div>
      <PeriodActions :copying="copying" @copy="$emit('copy')" @download="$emit('download')" />
    </SectionHeading>
    <AiAnalysisSteps />
    <ReviewNudge class="range-custom-action period-analysis-card__range">
      <div>
        <strong>Нужен другой период?</strong>
        <p>Выберите точные даты и подготовьте текст в настройках.</p>
      </div>
      <ActionButton :as="RouterLink" variant="secondary" to="/settings#analysis-settings">Выбрать даты</ActionButton>
    </ReviewNudge>
    <ReviewCueGrid :cues="cues" />
  </SurfaceCard>
</template>

<style scoped>
.period-analysis-card {
  position: relative;
  margin-bottom: 16px;
  border-color: var(--line-success);
}
.period-analysis-card > .section-heading {
  padding-bottom: 15px;
  border-bottom: 1px solid var(--review-section-divider);
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
