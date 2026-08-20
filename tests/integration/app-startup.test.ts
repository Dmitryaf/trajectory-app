// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import App from '../../src/App.vue';
import { useAppStore } from '../../src/stores/app';
import { useAuthStore } from '../../src/stores/auth';

const sync = vi.hoisted(() => ({
  prepareLocalCacheOwner: vi.fn(),
  reconcileCloudSnapshotAfterResume: vi.fn(),
  reconcileCloudSnapshotOnStartup: vi.fn(),
  sameSnapshotData: vi.fn(),
}));
const resume = vi.hoisted(() => ({
  refresh: undefined as (() => Promise<void>) | undefined,
  request: vi.fn().mockResolvedValue(false),
}));
const funnel = vi.hoisted(() => ({ recordFirstUseEvent: vi.fn(), recordFirstUseReturnEvents: vi.fn() }));
const cloud = vi.hoisted(() => ({
  callback: undefined as (() => void) | undefined,
  subscribe: vi.fn((_userId: string, callback: () => void) => {
    cloud.callback = callback;
    return vi.fn();
  }),
}));

vi.mock('../../src/features/sync/startup', () => sync);
vi.mock('../../src/features/first-use/funnel', () => funnel);
vi.mock('../../src/services/cloudSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/cloudSync')>()),
  subscribeToCloudSnapshot: cloud.subscribe,
}));
vi.mock('../../src/features/sync/resume', () => ({
  createResumeCloudRefresh: (refresh: () => Promise<void>) => {
    resume.refresh = refresh;
    return resume.request;
  },
}));
vi.mock('../../src/services/notifications', () => ({
  notifyInfo: vi.fn(),
  notifySaved: vi.fn(),
  notifyUnknownError: vi.fn(),
  notifyWarning: vi.fn(),
}));

describe('application startup', () => {
  it('returns an unauthenticated deep link to the sign-in entry route', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.configured = true;
    auth.authRequired = true;
    auth.initialized = true;
    auth.session = null;
    vi.spyOn(auth, 'init').mockResolvedValue(undefined);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Главная</div>' } },
        { path: '/trends', component: { template: '<div>Тренды</div>' } },
        { path: '/password-reset', component: { template: '<div>Новый пароль</div>' } },
      ],
    });
    await router.push('/trends');
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, router],
        stubs: {
          FeedbackDialog: true,
          Toaster: true,
        },
      },
    });

    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/');
    expect(wrapper.find('.auth-shell').exists()).toBe(true);
    expect(wrapper.find('.app-main').classes()).toContain('app-main--auth');
    wrapper.unmount();
  });

  it('does not mount working screens before the required cloud reconciliation finishes', async () => {
    let finishCloudCheck!: () => void;
    sync.prepareLocalCacheOwner.mockResolvedValue(undefined);
    sync.reconcileCloudSnapshotOnStartup.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishCloudCheck = resolve;
        }),
    );

    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.configured = true;
    auth.authRequired = true;
    auth.initialized = true;
    auth.session = { user: { id: 'user-1', email: 'friend@example.com' } } as typeof auth.session;
    vi.spyOn(auth, 'init').mockResolvedValue(undefined);

    const store = useAppStore();
    vi.spyOn(store, 'load').mockImplementation(async () => {
      store.loaded = true;
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div data-testid="working-screen">Записи</div>' } },
        { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
      ],
    });
    await router.push('/');
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, router],
        stubs: {
          FeedbackDialog: true,
          Toaster: true,
        },
      },
    });

    await flushPromises();
    expect(store.loaded).toBe(true);
    expect(sync.reconcileCloudSnapshotOnStartup).toHaveBeenCalledWith(store, 'user-1');
    expect(wrapper.text()).toContain('Сверяю записи с облаком…');
    expect(wrapper.find('[data-testid="working-screen"]').exists()).toBe(false);
    expect(wrapper.find('.bottom-nav').exists()).toBe(false);

    finishCloudCheck();
    await flushPromises();

    expect(wrapper.find('[data-testid="working-screen"]').exists()).toBe(true);
    expect(wrapper.find('.bottom-nav').exists()).toBe(true);
    expect(funnel.recordFirstUseReturnEvents).toHaveBeenCalledOnce();
    expect(cloud.subscribe).toHaveBeenCalledWith('user-1', expect.any(Function));

    cloud.callback!();
    expect(resume.request).toHaveBeenCalledWith(expect.objectContaining({ authenticated: true, loaded: true }), true);

    store.cloudSyncStatus = 'conflict';
    store.cloudSyncMessage =
      'В облаке появились более свежие данные. Открытые записи не заменены. Выберите нужную копию в разделе «Данные и синхронизация».';
    await flushPromises();
    expect(wrapper.find('.sync-banner button').exists()).toBe(false);
    const cloudSettingsLink = wrapper.get('.sync-banner a');
    expect(cloudSettingsLink.text()).toBe('Настройки синхронизации');
    expect(cloudSettingsLink.attributes('href')).toBe('/settings#cloud-settings');

    const startupCalls = sync.reconcileCloudSnapshotOnStartup.mock.calls.length;
    await resume.refresh!();
    expect(sync.reconcileCloudSnapshotAfterResume).toHaveBeenCalledWith(store, 'user-1');
    expect(sync.reconcileCloudSnapshotOnStartup).toHaveBeenCalledTimes(startupCalls);
    wrapper.unmount();
  });
});
