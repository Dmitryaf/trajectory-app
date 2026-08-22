<script setup lang="ts">
import { RouterLink } from 'vue-router';
import AiAnalysisSteps from '../../analysis/ui/AiAnalysisSteps.vue';
import type { ReviewCue } from '../../analytics/reviewCues';

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
  <article :id="sectionId" class="dashboard-card">
    <div class="section-heading">
      <div>
        <span class="eyebrow">Короткий разбор</span>
        <h2>{{ title }}</h2>
      </div>
      <div class="period-actions">
        <button class="secondary-button" type="button" :disabled="copying" :aria-busy="copying" @click="$emit('copy')">
          Подготовить текст для нейросети
        </button>
        <button class="secondary-button" type="button" @click="$emit('download')">Скачать данные</button>
      </div>
    </div>
    <AiAnalysisSteps />
    <div class="review-nudge range-custom-action" style="margin-top: 16px">
      <div>
        <strong>Нужен другой период?</strong>
        <p>Выберите точные даты и подготовьте текст в настройках.</p>
      </div>
      <RouterLink class="secondary-button" to="/settings#analysis-settings">Выбрать даты</RouterLink>
    </div>
    <div class="review-cue-grid review-cue-grid--primary">
      <article v-for="cue in cues" :key="cue.id" class="review-cue" :class="`review-cue--${cue.tone}`">
        <strong>{{ cue.title }}</strong>
        <p>{{ cue.text }}</p>
      </article>
    </div>
  </article>
</template>
