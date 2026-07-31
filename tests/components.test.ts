// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import AccountMenu from '../src/components/AccountMenu.vue';
import AuthGate from '../src/components/AuthGate.vue';
import ChipGroup from '../src/components/ChipGroup.vue';
import DurationInput from '../src/components/DurationInput.vue';
import HowItWorksDialog from '../src/components/HowItWorksDialog.vue';
import PeriodNavigator from '../src/components/PeriodNavigator.vue';
import PasswordResetView from '../src/views/PasswordResetView.vue';
import { useAuthStore } from '../src/stores/auth';

describe('form components', () => {
  it('shows a duration as hours and minutes and emits exact minute values', async () => {
    const wrapper = mount(DurationInput, {
      props: { id: 'sleep-duration', modelValue: 415, maxHours: 24 },
    });
    const [hours, minutes] = wrapper.findAll('input');

    expect(hours.element.value).toBe('6');
    expect(minutes.element.value).toBe('55');

    await hours.setValue('7');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([475]);

    await minutes.setValue('30');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([450]);

    await wrapper.setProps({ modelValue: 90 });
    expect(hours.element.value).toBe('1');
    expect(minutes.element.value).toBe('30');
  });

  it('adds and removes values in a multiple choice group', async () => {
    const wrapper = mount(ChipGroup, {
      props: {
        options: [
          { id: 'reading', label: 'Чтение' },
          { id: 'walk', label: 'Прогулка' },
        ],
        modelValue: ['reading'],
        multiple: true,
      },
    });
    const buttons = wrapper.findAll('button');

    expect(buttons[0].attributes('aria-pressed')).toBe('true');
    expect(buttons[1].attributes('aria-pressed')).toBe('false');

    await buttons[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['reading', 'walk']]);

    await wrapper.setProps({ modelValue: ['reading', 'walk'] });
    await buttons[0].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['walk']]);
  });
});

describe('period navigation', () => {
  it('exposes previous, current and next actions with accessible labels', async () => {
    const wrapper = mount(PeriodNavigator, {
      props: { title: 'Июль 2026', subtitle: '20 записей' },
    });

    expect(wrapper.text()).toContain('Июль 2026');
    expect(wrapper.text()).toContain('20 записей');

    await wrapper.get('[aria-label="Предыдущий период"]').trigger('click');
    await wrapper.get('.period-nav__label').trigger('click');
    await wrapper.get('[aria-label="Следующий период"]').trigger('click');

    expect(wrapper.emitted('previous')).toHaveLength(1);
    expect(wrapper.emitted('current')).toHaveLength(1);
    expect(wrapper.emitted('next')).toHaveLength(1);
  });
});

describe('app explanation', () => {
  it('opens for a first visit and explains the whole path in plain language', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/settings', component: { template: '<div />' } },
      ],
    });
    await router.push('/');
    await router.isReady();
    const wrapper = mount(HowItWorksDialog, {
      props: { openForFirstVisit: true },
      attachTo: document.body,
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(document.body.textContent).toContain('Зачем нужна «Траектория»');
    expect(document.body.textContent).toContain('Итог — конкретное сделанное дело или полученный результат');
    expect(document.body.textContent).toContain('Эксперимент: проверить одно изменение');
    expect(document.body.textContent).toContain('что оставить, что изменить или что проверить дальше');

    (document.querySelector('[aria-label="Закрыть объяснение"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(wrapper.emitted('intro-seen')).toHaveLength(1);
  });
});

describe('account menu', () => {
  it('groups settings and sign out under the current account', async () => {
    const wrapper = mount(AccountMenu, {
      props: { email: 'friend@example.com' },
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        },
      },
    });

    expect(wrapper.text()).toContain('friend@example.com');
    expect(wrapper.text()).toContain('Настройки');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('signOut')).toHaveLength(1);
  });
});

describe('beta authentication', () => {
  it('requires a matching password and invitation code for self-registration', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.signupEnabled = true;
    auth.signUp = vi.fn().mockResolvedValue({ session: null, confirmationRequired: true });
    const wrapper = mount(AuthGate, { global: { plugins: [pinia] } });

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Создать аккаунт')!
      .trigger('click');
    expect(wrapper.text()).toContain('Не меньше 8 символов.');
    expect(wrapper.get('button.primary-button').attributes('disabled')).toBeUndefined();
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('friend@example.com');
    await inputs[1].setValue('safe-password');
    await inputs[2].setValue('safe-password');
    await inputs[3].setValue('BETA-INVITE-2026');
    await wrapper.get('form').trigger('submit');

    expect(auth.signUp).toHaveBeenCalledWith('friend@example.com', 'safe-password', 'BETA-INVITE-2026');
    expect(wrapper.text()).toContain('Проверь почту и подтверди email');
    expect(wrapper.text()).toContain('Отправить письмо ещё раз');
  });

  it('uses a dedicated password reset page before returning to sign-in', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.recoveryRequired = true;
    auth.session = { user: { id: 'user-1', email: 'friend@example.com' } } as typeof auth.session;
    auth.completePasswordRecovery = vi.fn().mockResolvedValue(undefined);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Вход</div>' } },
        { path: '/password-reset', component: PasswordResetView },
      ],
    });
    await router.push('/password-reset');
    await router.isReady();
    const wrapper = mount(PasswordResetView, { global: { plugins: [pinia, router] } });

    expect(wrapper.text()).toContain('Создай новый пароль');
    expect(wrapper.text()).toContain('Не меньше 8 символов.');
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('new-safe-password');
    await inputs[1].setValue('new-safe-password');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(auth.completePasswordRecovery).toHaveBeenCalledWith('new-safe-password');
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('explains why an incomplete registration cannot be submitted', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.signupEnabled = true;
    auth.signUp = vi.fn();
    const wrapper = mount(AuthGate, { global: { plugins: [pinia] } });

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Создать аккаунт')!
      .trigger('click');
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('friend@example.com');
    await inputs[1].setValue('short');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.text()).toContain('Пароль должен содержать не меньше 8 символов.');
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});
