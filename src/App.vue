<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { Toaster } from 'vue-sonner';
import 'vue-sonner/style.css';
import AuthGate from './components/AuthGate.vue';
import AccountMenu from './components/AccountMenu.vue';
import PasswordResetView from './views/PasswordResetView.vue';
import { createResumeCloudRefresh } from './features/sync/resume';
import { prepareLocalCacheOwner, reconcileCloudSnapshotOnStartup } from './features/sync/startup';
import { notifyInfo, notifyUnknownError } from './services/notifications';
import { useAppStore } from './stores/app';
import { useAuthStore } from './stores/auth';

const store = useAppStore();
const auth = useAuthStore();
const router = useRouter();
const canOpenApp = computed(() => auth.initialized && auth.isAuthenticated);
let appDataLoadPromise: Promise<void> | null = null;
const refreshCloudAfterResume = createResumeCloudRefresh(async () => {
  await reconcileCloudSnapshotOnStartup(store, auth.requiresAuth ? auth.session?.user.id : null);
});

function currentCloudRefreshState() {
  return {
    authenticated: canOpenApp.value,
    loaded: store.loaded,
    status: store.cloudSyncStatus,
  };
}

function handleWindowFocus() {
  void refreshCloudAfterResume(currentCloudRefreshState());
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') handleWindowFocus();
}

function handleOnline() {
  void refreshCloudAfterResume(currentCloudRefreshState(), true);
}

onMounted(async () => {
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  await auth.init();
  if (auth.recoveryRequired && router.currentRoute.value.path !== '/password-reset') {
    await router.replace('/password-reset');
  }
  if (canOpenApp.value) await loadAppData();
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', handleWindowFocus);
  window.removeEventListener('online', handleOnline);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

watch(canOpenApp, async (allowed) => {
  if (allowed) {
    await loadAppData();
  } else if (auth.requiresAuth) {
    store.unload();
  }
});

watch(() => auth.recoveryRequired, async (required) => {
  if (required && router.currentRoute.value.path !== '/password-reset') {
    await router.replace('/password-reset');
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
  <PasswordResetView v-if="auth.initialized && auth.recoveryRequired" />
  <div v-else class="app-shell">
    <header class="app-header">
      <RouterLink to="/" class="brand" aria-label="Траектория — главная">
        <span class="brand__mark"><i></i></span>
        <span><strong>Траектория</strong><small>факты, а не оценка</small></span>
      </RouterLink>
      <div v-if="canOpenApp && store.loaded" class="header-actions">
        <RouterLink v-if="!auth.requiresAuth" to="/settings" class="header-settings-link" aria-label="Открыть настройки" title="Настройки">
          <span>⚙</span><strong>Настройки</strong>
        </RouterLink>
        <AccountMenu v-else :email="auth.userEmail" :loading="auth.loading" @sign-out="signOut" />
      </div>
    </header>

    <main class="app-main">
      <div v-if="!auth.initialized" class="loading-card" role="status" aria-live="polite">
        <span class="loading-card__mark" aria-hidden="true"><i></i></span>
        <strong>Проверяю доступ…</strong>
      </div>
      <section v-else-if="auth.configurationMissing" class="auth-config-error" role="alert">
        <span class="auth-config-error__mark" aria-hidden="true">!</span>
        <div>
          <h1>Эта сборка временно недоступна</h1>
          <p>Не удалось подключить вход. Используй основную ссылку или попробуй позже.</p>
        </div>
      </section>
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
