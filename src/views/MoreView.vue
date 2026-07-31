<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAppStore } from '../stores/app';

const store = useAppStore();
const sections = computed(() => [
  {
    to: '/results',
    icon: '✓',
    tone: 'mint',
    count: store.results.length,
    title: 'Итоги',
    text: 'Конкретные сделанные дела и полученные результаты.',
  },
  {
    to: '/events',
    icon: '✦',
    tone: 'amber',
    count: store.lifeEvents.length,
    title: 'События и важные мысли',
    text: 'Событие — важная для вас ситуация, которая произошла. Важная мысль — что вы поняли или стали видеть иначе.',
  },
]);
</script>

<template>
  <section class="page page--journal">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Важное отдельно</span>
        <h1>Журнал</h1>
        <p>Здесь отдельно хранятся конкретные итоги, важные события и мысли.</p>
      </div>
    </div>
    <article class="journal-guide-card">
      <strong>Что записывать в Журнал</strong>
      <p>
        <b>Итог</b> — конкретное сделанное дело или полученный результат. <b>Событие</b> — важная для вас ситуация, которая произошла.
        <b>Важная мысль</b> — что вы поняли или стали видеть иначе.
      </p>
    </article>
    <div class="more-grid">
      <RouterLink v-for="section in sections" :key="section.to" :to="section.to" class="more-card" :class="`more-card--${section.tone}`">
        <span>{{ section.icon }}</span>
        <div>
          <small>{{ section.count }} в журнале</small>
          <h2>{{ section.title }}</h2>
          <p>{{ section.text }}</p>
        </div>
        <i>→</i>
      </RouterLink>
    </div>
    <RouterLink to="/settings" class="journal-settings-card">
      <span>⚙</span>
      <div>
        <small>Управление приложением</small>
        <h2>Настройки</h2>
        <p>Поля ежедневной записи, текущая цель, эксперимент и копии данных.</p>
      </div>
      <i>→</i>
    </RouterLink>
  </section>
</template>
