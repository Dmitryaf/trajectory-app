<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { Toaster } from 'vue-sonner';
import 'vue-sonner/style.css';
import AuthGate from './components/AuthGate.vue';
import { prepareLocalCacheOwner, reconcileCloudSnapshotOnStartup } from './features/sync/startup';
import { notifyInfo, notifyUnknownError } from './services/notifications';
import { useAppStore } from './stores/app';
import { useAuthStore } from './stores/auth';

const store = useAppStore();
const auth = useAuthStore();
const canOpenApp = computed(() => auth.initialized && auth.isAuthenticated);
let appDataLoadPromise: Promise<void> | null = null;

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
  if (store.loaded && !store.loadError) return;
  if (appDataLoadPromise) return appDataLoadPromise;

  appDataLoadPromise = (async () => {
    try {
      await prepareLocalCacheOwner(store, auth.requiresAuth ? auth.session?.user.id : null);
      await store.load();
      await reconcileCloudSnapshotOnStartup(store, auth.requiresAuth ? auth.session?.user.id : null);
    } catch (error) {
      console.error('Не удалось загрузить локальные данные', error);
    } finally {
      appDataLoadPromise = null;
    }
  })();

  return appDataLoadPromise;
}

async function retryLoadAppData() {
  store.unload();
  await loadAppData();
}

async function signOut() {
  try {
    await auth.signOut();
    store.unload();
    notifyInfo('Выход выполнен');
  } catch (error) {
    notifyUnknownError(error, 'Не удалось выйти');
  }
}

const navItems = [
  { to: '/', label: 'Сегодня', icon: '●' },
  { to: '/week', label: 'Неделя', icon: '▦' },
  { to: '/month', label: 'Месяц', icon: '▥' },
  { to: '/trends', label: 'Тренды', icon: '≋' },
  { to: '/more', label: 'Журнал', icon: '◇' }
];
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink to="/" class="brand" aria-label="Траектория — главная">
        <span class="brand__mark"><i></i></span>
        <span><strong>Траектория</strong><small>факты, а не оценка</small></span>
      </RouterLink>
      <div v-if="canOpenApp && store.loaded" class="header-actions">
        <RouterLink to="/settings" class="header-settings-link" aria-label="Открыть настройки" title="Настройки">
          <span>⚙</span><strong>Настройки</strong>
        </RouterLink>
        <div v-if="auth.requiresAuth" class="account-strip" aria-label="Аккаунт">
          <span class="account-strip__email" :title="auth.userEmail">{{ auth.userEmail }}</span>
          <button class="account-strip__logout" type="button" :disabled="auth.loading" @click="signOut">
            Выйти
          </button>
        </div>
      </div>
    </header>

    <main class="app-main">
      <div v-if="!auth.initialized" class="loading-card" role="status" aria-live="polite">
        <span class="loading-card__mark" aria-hidden="true"><i></i></span>
        <strong>Проверяю доступ…</strong>
      </div>
      <AuthGate v-else-if="auth.requiresAuth && !auth.isAuthenticated" />
      <div v-else-if="!store.loaded" class="loading-card" role="status" aria-live="polite">
        <span class="loading-card__mark" aria-hidden="true"><i></i></span>
        <strong>Загружаю записи…</strong>
      </div>
      <section v-else-if="store.loadError" class="storage-error" role="alert">
        <span class="storage-error__mark" aria-hidden="true">!</span>
        <div>
          <p class="eyebrow">Локальное хранилище недоступно</p>
          <h1>Записи пока не открылись</h1>
          <p>{{ store.loadError }}</p>
          <button class="primary-button" type="button" @click="retryLoadAppData">Повторить</button>
        </div>
      </section>
      <template v-else>
        <section v-if="store.cloudSyncStatus === 'pending' || store.cloudSyncStatus === 'conflict' || store.cloudSyncStatus === 'error'" class="sync-banner" :class="`sync-banner--${store.cloudSyncStatus}`">
          <span class="sync-banner__mark" aria-hidden="true">{{ store.cloudSyncStatus === 'conflict' ? '!' : '↥' }}</span>
          <div>
            <strong>{{ store.cloudSyncStatus === 'conflict' ? 'Нужен выбор по облаку' : 'Облако не обновлено' }}</strong>
            <p>{{ store.cloudSyncMessage }}</p>
          </div>
          <RouterLink class="secondary-button" to="/settings">Настройки</RouterLink>
        </section>
        <RouterView />
      </template>
    </main>

    <nav v-if="canOpenApp && store.loaded" class="bottom-nav" aria-label="Основная навигация">
      <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="bottom-nav__item" :class="{ 'router-link-active': item.to === '/more' && ['/results', '/events'].includes($route.path) }">
        <span>{{ item.icon }}</span>
        <small>{{ item.label }}</small>
      </RouterLink>
    </nav>

    <Toaster position="top-right" rich-colors close-button />
  </div>
</template>
