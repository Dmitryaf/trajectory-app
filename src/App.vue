<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { Toaster } from 'vue-sonner';
import 'vue-sonner/style.css';
import AuthGate from './components/AuthGate.vue';
import { useAppStore } from './stores/app';
import { useAuthStore } from './stores/auth';

const store = useAppStore();
const auth = useAuthStore();
const canOpenApp = computed(() => auth.initialized && auth.isAuthenticated);
const localOwnerKey = 'trajectory:local-owner-id';

onMounted(async () => {
  await auth.init();
  if (canOpenApp.value) await loadAppData();
});

watch(canOpenApp, async (allowed) => {
  if (allowed) {
    await loadAppData();
  } else if (auth.requiresAuth) {
    store.unload();
  }
});

async function loadAppData() {
  if (store.loaded) return;
  try {
    await prepareLocalCacheOwner();
    await store.load();
  } catch (error) {
    console.error('Не удалось загрузить локальные данные', error);
  }
}

async function prepareLocalCacheOwner() {
  if (!auth.requiresAuth || !auth.session?.user.id) return;

  const userId = auth.session.user.id;
  const localOwnerId = window.localStorage.getItem(localOwnerKey);
  if (localOwnerId && localOwnerId !== userId) {
    await store.clearAll();
  }
  window.localStorage.setItem(localOwnerKey, userId);
}

const navItems = [
  { to: '/', label: 'Сегодня', icon: '●' },
  { to: '/results', label: 'Результаты', icon: '✓' },
  { to: '/events', label: 'Архив', icon: '◆' },
  { to: '/week', label: 'Неделя', icon: '▦' },
  { to: '/month', label: 'Месяц', icon: '▥' },
  { to: '/trends', label: 'Тренды', icon: '≋' },
  { to: '/settings', label: 'Настройки', icon: '⚙' }
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
      <div v-if="!auth.initialized" class="loading-card">Проверяю доступ…</div>
      <AuthGate v-else-if="auth.requiresAuth && !auth.isAuthenticated" />
      <div v-else-if="!store.loaded" class="loading-card">Загружаю записи…</div>
      <section v-else-if="store.loadError" class="card storage-error">
        <p class="eyebrow">Локальное хранилище недоступно</p>
        <h1>Записи пока не открылись</h1>
        <p>{{ store.loadError }}</p>
        <button class="button button--primary" type="button" @click="store.load()">Повторить</button>
      </section>
      <RouterView v-else />
    </main>

    <nav v-if="canOpenApp && store.loaded" class="bottom-nav" aria-label="Основная навигация">
      <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="bottom-nav__item">
        <span>{{ item.icon }}</span>
        <small>{{ item.label }}</small>
      </RouterLink>
    </nav>

    <Toaster position="top-right" rich-colors close-button />
  </div>
</template>
