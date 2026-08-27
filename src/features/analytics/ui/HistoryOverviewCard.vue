<script setup lang="ts">
import AiAnalysisSteps from '@/features/analysis/ui/AiAnalysisSteps.vue';
import type { ReviewCue } from '@/features/analytics/reviewCues';
import PeriodActions from '@/features/reviews/ui/PeriodActions.vue';
import ReviewCueGrid from '@/features/reviews/ui/ReviewCueGrid.vue';

defineProps<{ cues: ReviewCue[]; coveredEntries: number; ordinaryEntries: number }>();
defineEmits<{ copy: []; download: [] }>();
</script>

<template>
  <article class="dashboard-card dashboard-card--insights history-overview-card">
    <div class="section-heading">
      <div>
        <span class="eyebrow">Главное за период</span>
        <h2>Что стоит заметить</h2>
      </div>
      <PeriodActions @copy="$emit('copy')" @download="$emit('download')" />
    </div>
    <AiAnalysisSteps />
    <ReviewCueGrid :cues="cues" />
    <p class="data-note history-coverage-note">
      Основа разбора: {{ coveredEntries }} дней с записями, {{ ordinaryEntries }} обычных дней с основными полями. Пропуски не заполняются.
    </p>
  </article>
</template>

<style scoped>
.history-overview-card {
  --section-accent: var(--brand-strong);
  position: relative;
  margin-bottom: 16px;
  border-color: var(--line-success);
  background: linear-gradient(145deg, var(--surface), #f1faf6);
}
.history-overview-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 24px;
  right: 24px;
  height: 3px;
  border-radius: 0 0 4px 4px;
  background: var(--section-accent);
}
.history-overview-card > .section-heading {
  padding-bottom: 15px;
  border-bottom: 1px solid #e8eeeb;
}
.data-note {
  margin: 10px 0 0;
  color: #7a8497;
  font-size: 12px;
  line-height: 1.5;
}
@media (max-width: 720px) {
  .section-heading:has(.period-actions) {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
