// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App.vue';
import { useAppStore } from '../src/stores/app';
import { useAuthStore } from '../src/stores/auth';

const sync = vi.hoisted(() => ({
  prepareLocalCacheOwner: vi.fn(),
  reconcileCloudSnapshotOnStartup: vi.fn(),
}));
const funnel = vi.hoisted(() => ({ recordFirstUseEvent: vi.fn(), recordFirstUseReturnEvents: vi.fn() }));

vi.mock('../src/features/sync/startup', () => sync);
vi.mock('../src/features/first-use/funnel', () => funnel);
vi.mock('../src/features/sync/resume', () => ({
  createResumeCloudRefresh: () => vi.fn().mockResolvedValue(false),
}));
vi.mock('../src/services/notifications', () => ({
  notifyInfo: vi.fn(),
  notifyUnknownError: vi.fn(),
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
    wrapper.unmount();
  });
});
