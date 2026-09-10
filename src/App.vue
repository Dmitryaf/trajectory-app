<script setup lang="ts">
import ActionButton from '@/shared/ui/actions/ActionButton.vue';
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { Toaster } from 'vue-sonner';
import BrandMark from './shared/ui/branding/BrandMark.vue';
import 'vue-sonner/style.css';
import AccountMenu from './features/auth/ui/AccountMenu.vue';
import AuthGate from './features/auth/ui/AuthGate.vue';
import HowItWorksDialog from './features/first-use/ui/HowItWorksDialog.vue';
import PasswordResetView from './views/PasswordResetView.vue';
import EyebrowText from './shared/ui/typography/EyebrowText.vue';
import { recordFirstUseReturnEvents } from './features/first-use/funnel';
import { isFirstUsePrimary } from './features/first-use/priority';
import { createResumeCloudRefresh } from './features/sync/resume';
import { prepareLocalCacheOwner, reconcileCloudSnapshotAfterResume, reconcileCloudSnapshotOnStartup } from './features/sync/startup';
import { hasUnsavedSyncEditors, onUnsavedSyncEditorsChange } from './features/sync/editing';
import { subscribeToCloudSnapshot } from './services/cloudSync';
import { configureErrorMonitoring, reportClientError } from './services/errorMonitoring';
import { notifyInfo, notifyUnknownError } from './services/notifications';
import { useAppStore } from './stores/app';
import { useAuthStore } from './stores/auth';

const store = useAppStore();
const auth = useAuthStore();
const router = useRouter();
const FeedbackDialog = defineAsyncComponent(() => import('./features/feedback/ui/FeedbackDialog.vue'));
const canOpenApp = computed(() => auth.initialized && auth.isAuthenticated);
const feedbackEnabled = import.meta.env.VITE_FEEDBACK_ENABLED === 'true';
const appDataReady = ref(false);
const appDataLoadError = ref('');
const appDataLoadingText = ref('Загружаю записи…');
const effectiveLoadError = computed(() => store.loadError || appDataLoadError.value);
const firstUseOwnsToday = computed(
  () =>
    router.currentRoute.value.path === '/' &&
    isFirstUsePrimary(store.settings.firstUse, router.currentRoute.value.query['first-use'] === 'edit'),
);
let appDataLoadPromise: Promise<void> | null = null;
let stopCloudSubscription: (() => void) | undefined;
let stopEditingSubscription: (() => void) | undefined;
let cloudRefreshTimer: number | undefined;
let cloudRefreshDeferred = false;
const stopErrorMonitoring = configureErrorMonitoring(
  () => auth.session?.access_token ?? '',
  import.meta.env.VITE_ERROR_MONITORING_ENABLED === 'true',
);
const refreshCloudAfterResume = createResumeCloudRefresh(async () => {
  await reconcileCloudSnapshotAfterResume(store, auth.requiresAuth ? auth.session?.user.id : null);
});

function currentCloudRefreshState() {
  return {
    authenticated: canOpenApp.value,
    loaded: store.loaded,
    status: store.cloudSyncStatus,
  };
}

function requestAutomaticCloudRefresh(force = false) {
  if (hasUnsavedSyncEditors()) {
    cloudRefreshDeferred = true;
    return;
  }
  cloudRefreshDeferred = false;
  void refreshCloudAfterResume(currentCloudRefreshState(), force);
}

function handleWindowFocus() {
  requestAutomaticCloudRefresh();
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    handleWindowFocus();
  }
}

function handleOnline() {
  requestAutomaticCloudRefresh(true);
}

function startCloudUpdates() {
  stopCloudSubscription?.();
  stopCloudSubscription = undefined;
  if (cloudRefreshTimer !== undefined) {
    window.clearInterval(cloudRefreshTimer);
  }
  const userId = auth.requiresAuth ? auth.session?.user.id : null;
  if (userId) {
    stopCloudSubscription = subscribeToCloudSnapshot(userId, () => requestAutomaticCloudRefresh(true));
  }
  cloudRefreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      requestAutomaticCloudRefresh();
    }
  }, 30_000);
}

async function keepUnauthenticatedRouteAtEntry() {
  if (!auth.initialized || !auth.requiresAuth || auth.isAuthenticated || auth.recoveryRequired) {
    return;
  }
  if (router.currentRoute.value.path !== '/') {
    await router.replace('/');
  }
}

onMounted(async () => {
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  stopEditingSubscription = onUnsavedSyncEditorsChange((dirty) => {
    if (!dirty && cloudRefreshDeferred) {
      requestAutomaticCloudRefresh(true);
    }
  });
  await auth.init();
  if (auth.recoveryRequired && router.currentRoute.value.path !== '/password-reset') {
    await router.replace('/password-reset');
  } else {
    await keepUnauthenticatedRouteAtEntry();
  }
  if (canOpenApp.value) {
    await loadAppData();
    startCloudUpdates();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', handleWindowFocus);
  window.removeEventListener('online', handleOnline);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  stopErrorMonitoring();
  stopCloudSubscription?.();
  stopEditingSubscription?.();
  if (cloudRefreshTimer !== undefined) {
    window.clearInterval(cloudRefreshTimer);
  }
});

watch(canOpenApp, async (allowed) => {
  if (allowed) {
    await loadAppData();
    startCloudUpdates();
  } else if (auth.requiresAuth) {
    stopCloudSubscription?.();
    stopCloudSubscription = undefined;
    resetAppDataState();
    store.unload();
  }
});

watch(
  () => auth.recoveryRequired,
  async (required) => {
    if (required && router.currentRoute.value.path !== '/password-reset') {
      await router.replace('/password-reset');
    }
  },
);

watch(
  () => [auth.initialized, auth.requiresAuth, auth.isAuthenticated, auth.recoveryRequired, router.currentRoute.value.path] as const,
  () => void keepUnauthenticatedRouteAtEntry(),
);

async function loadAppData() {
  if (appDataReady.value && store.loaded && !effectiveLoadError.value) {
    return;
  }
  if (appDataLoadPromise) {
    return appDataLoadPromise;
  }

  appDataReady.value = false;
  appDataLoadError.value = '';
  appDataLoadingText.value = 'Загружаю записи…';
  appDataLoadPromise = (async () => {
    try {
      const userId = auth.requiresAuth ? auth.session?.user.id : null;
      await prepareLocalCacheOwner(store, userId);
      await store.load();
      if (userId) {
        appDataLoadingText.value = 'Сверяю записи с облаком…';
      }
      await reconcileCloudSnapshotOnStartup(store, userId);
      recordFirstUseReturnEvents();
    } catch (error) {
      console.error('Не удалось подготовить записи');
      reportClientError('APP_DATA_LOAD_FAILED');
      appDataLoadError.value = error instanceof Error ? error.message : 'Не удалось подготовить записи';
    } finally {
      appDataReady.value = true;
      appDataLoadPromise = null;
    }
  })();

  return appDataLoadPromise;
}

async function retryLoadAppData() {
  resetAppDataState();
  store.unload();
  await loadAppData();
}

function resetAppDataState() {
  appDataReady.value = false;
  appDataLoadError.value = '';
  appDataLoadingText.value = 'Загружаю записи…';
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
  { to: '/trends', label: 'История', icon: '≋' },
  { to: '/more', label: 'Журнал', icon: '◇' },
];
</script>

<template>
  <PasswordResetView v-if="auth.initialized && auth.recoveryRequired" />
  <div v-else class="app-shell">
    <header class="app-header">
      <RouterLink to="/" class="brand" aria-label="Траектория — главная">
        <BrandMark />
        <span><strong>Траектория</strong><small>факты, а не оценка</small></span>
      </RouterLink>
      <div v-if="canOpenApp && appDataReady && store.loaded && !effectiveLoadError" class="header-actions">
        <HowItWorksDialog />
        <FeedbackDialog v-if="feedbackEnabled" :access-token="auth.session?.access_token ?? ''" />
        <RouterLink v-if="!auth.requiresAuth" to="/settings" class="header-settings-link" aria-label="Открыть настройки" title="Настройки">
          <span>⚙</span><strong>Настройки</strong>
        </RouterLink>
        <AccountMenu v-else :email="auth.userEmail" :loading="auth.loading" @sign-out="signOut" />
      </div>
    </header>

    <main
      class="app-main"
      :class="{
        'app-main--auth': auth.initialized && auth.requiresAuth && !auth.isAuthenticated,
        'app-main--first-use': firstUseOwnsToday,
      }"
    >
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
      <div v-else-if="!appDataReady" class="loading-card" role="status" aria-live="polite">
        <span class="loading-card__mark" aria-hidden="true"><i></i></span>
        <strong>{{ appDataLoadingText }}</strong>
      </div>
      <section v-else-if="effectiveLoadError" class="storage-error" role="alert">
        <span class="storage-error__mark" aria-hidden="true">!</span>
        <div>
          <EyebrowText tag="p">Локальное хранилище недоступно</EyebrowText>
          <h1>Записи пока не открылись</h1>
          <p>{{ effectiveLoadError }}</p>
          <ActionButton variant="primary" type="button" @click="retryLoadAppData">Повторить</ActionButton>
        </div>
      </section>
      <template v-else>
        <section
          v-if="store.cloudSyncStatus === 'pending' || store.cloudSyncStatus === 'conflict' || store.cloudSyncStatus === 'error'"
          class="sync-banner"
          :class="`sync-banner--${store.cloudSyncStatus}`"
        >
          <span class="sync-banner__mark" aria-hidden="true">↥</span>
          <div>
            <strong>Облако не обновлено</strong>
            <p>{{ store.cloudSyncMessage }}</p>
          </div>
          <ActionButton :as="RouterLink" variant="secondary" to="/settings#cloud-settings">Настройки синхронизации</ActionButton>
        </section>
        <RouterView />
      </template>
    </main>

    <nav
      v-if="canOpenApp && appDataReady && store.loaded && !effectiveLoadError"
      class="bottom-nav"
      :class="{ 'bottom-nav--first-use': firstUseOwnsToday }"
      aria-label="Основная навигация"
    >
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="bottom-nav__item"
        :class="{ 'router-link-active': item.to === '/more' && ['/results', '/events'].includes($route.path) }"
      >
        <span>{{ item.icon }}</span>
        <small>{{ item.label }}</small>
      </RouterLink>
    </nav>

    <Toaster position="top-right" rich-colors close-button />
  </div>
</template>

<style scoped src="./App.css"></style>
