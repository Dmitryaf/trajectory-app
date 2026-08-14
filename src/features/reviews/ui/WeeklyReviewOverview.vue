<script setup lang="ts">
import { computed } from 'vue';
import type { WeeklyReview } from '../../../types';

const props = defineProps<{ review: WeeklyReview }>();
const results = computed(() => props.review.results.filter((item) => item.trim()));
const highlights = computed(() => props.review.highlights.filter((item) => item.trim()));
</script>

<template>
  <div class="weekly-review-overview">
    <div v-if="highlights.length" class="weekly-review-overview__group">
      <strong>Что произошло</strong>
      <ul>
        <li v-for="(item, index) in highlights" :key="`${index}-${item}`">{{ item }}</li>
      </ul>
    </div>
    <div v-if="results.length" class="weekly-review-overview__group">
      <strong>Итоги</strong>
      <ul>
        <li v-for="(item, index) in results" :key="`${index}-${item}`">{{ item }}</li>
      </ul>
    </div>
    <div v-if="review.stateContext" class="weekly-review-overview__group">
      <strong>Как вы себя чувствовали</strong>
      <p>{{ review.stateContext }}</p>
    </div>
    <div v-if="review.support" class="weekly-review-overview__group">
      <strong>Что помогало</strong>
      <p>{{ review.support }}</p>
    </div>
    <div v-if="review.obstacle" class="weekly-review-overview__group">
      <strong>Что мешало</strong>
      <p>{{ review.obstacle }}</p>
    </div>
    <div v-if="review.nextLever" class="weekly-review-overview__group">
      <strong>Ваше решение</strong>
      <p>{{ review.nextLever }}</p>
    </div>
    <div v-if="review.ifThenPlan" class="weekly-review-overview__group">
      <strong>План «если — то»</strong>
      <p>{{ review.ifThenPlan }}</p>
    </div>
  </div>
</template>
