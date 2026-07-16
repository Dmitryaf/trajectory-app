<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { useAppStore } from './stores/app';

const store = useAppStore();
onMounted(async () => {
  try {
    await store.load();
  } catch (error) {
    console.error('Не удалось загрузить локальные данные', error);
  }
});

const navItems = [
  { to: '/', label: 'Сегодня', icon: '●' },
  { to: '/results', label: 'Результаты', icon: '✓' },
  { to: '/week', label: 'Неделя', icon: '▦' },
  { to: '/month', label: 'Месяц', icon: '▥' },
  { to: '/settings', label: 'Ещё', icon: '•••' }
];
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink to="/" class="brand" aria-label="Траектория — главная">
        <span class="brand__mark"><i></i></span>
        <span><strong>Траектория</strong><small>факты, а не оценка</small></span>
      </RouterLink>
    </header>

    <main class="app-main">
      <div v-if="!store.loaded" class="loading-card">Загружаю записи…</div>
      <section v-else-if="store.loadError" class="card storage-error">
        <p class="eyebrow">Локальное хранилище недоступно</p>
        <h1>Записи пока не открылись</h1>
        <p>{{ store.loadError }}</p>
        <button class="button button--primary" type="button" @click="store.load()">Повторить</button>
      </section>
      <RouterView v-else />
    </main>

    <nav class="bottom-nav" aria-label="Основная навигация">
      <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="bottom-nav__item">
        <span>{{ item.icon }}</span>
        <small>{{ item.label }}</small>
      </RouterLink>
    </nav>
  </div>
</template>
