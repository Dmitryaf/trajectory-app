<script setup lang="ts">
import { RouterLink } from 'vue-router';

const sections = [
  { to: '/results', icon: '✓', title: 'Итоги', text: 'Завершённые действия, полученные ответы и созданные вещи.' },
  { to: '/events', icon: '◆', title: 'События', text: 'Изменения и обстоятельства, которые объясняют общий контекст.' },
  { to: '/settings', icon: '⚙', title: 'Настройки', text: 'Личные области, факторы сна, эксперимент и резервные копии.' },
];
</script>

<template>
  <section class="page">
    <div class="page-heading"><div><span class="eyebrow">Дополнительно</span><h1>Ещё</h1><p>Архив фактов, важный контекст и личные настройки.</p></div></div>
    <div class="more-grid">
      <RouterLink v-for="section in sections" :key="section.to" :to="section.to" class="more-card">
        <span>{{ section.icon }}</span>
        <div><h2>{{ section.title }}</h2><p>{{ section.text }}</p></div>
        <i>→</i>
      </RouterLink>
    </div>
  </section>
</template>
