// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import AuthGate from '@/features/auth/ui/AuthGate.vue';
import { readFirstUseFunnel } from '@/features/first-use/funnel';
import { useAuthStore } from '@/stores/auth';
import PasswordResetView from '@/views/PasswordResetView.vue';

describe('beta authentication', () => {
  it('explains the app with a clearly marked example before registration', async () => {
    window.localStorage.clear();
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.signupEnabled = true;
    const wrapper = mount(AuthGate, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain('Увидьте, чем были наполнены ваши дни, недели и месяцы');
    expect(wrapper.text()).toContain('будет проще вспомнить важные события, результаты и условия');
    expect(wrapper.text()).not.toContain('общее ощущение не сотрёт');
    expect(wrapper.text()).toContain('Пример');
    expect(wrapper.text()).not.toContain('не ваши данные');
    expect(wrapper.text()).toContain('Приложение не оценивает ваши дни');
    expect(wrapper.text()).toContain('Короткие записи за несколько дней');
    expect(readFirstUseFunnel().map((event) => event.name)).toContain('first_use_presentation_viewed');

    await wrapper.get('[aria-label="Уровни примера"] button:nth-child(3)').trigger('click');
    expect(wrapper.text()).toContain('Неделя видна целиком');
    expect(wrapper.text()).toContain('Пока ничего не менять');
  });

  it('opens the requested auth form from the presentation', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.signupEnabled = true;
    const wrapper = mount(AuthGate, { attachTo: document.body, global: { plugins: [pinia] } });

    await wrapper.get('.auth-presentation__actions .primary-button').trigger('click');

    expect(wrapper.text()).toContain('Создайте аккаунт');
    expect(wrapper.text()).toContain('Будет создан аккаунт для облачной синхронизации записей');
    expect(wrapper.text()).toContain('После регистрации нужно подтвердить email');
    expect(wrapper.findAll('input')).toHaveLength(4);
    expect(wrapper.findAll('button[aria-label="Показать пароль"]')).toHaveLength(2);
    expect(wrapper.get('#auth-password').attributes('autocomplete')).toBe('new-password');
    expect(wrapper.get('#auth-password-confirmation').attributes('autocomplete')).toBe('new-password');
    expect(wrapper.get('input[type="email"]').element).toBe(document.activeElement);

    await wrapper
      .get('.auth-mode')
      .findAll('button')
      .find((button) => button.text() === 'Войти')!
      .trigger('click');
    expect(wrapper.findAll('button[aria-label="Показать пароль"]')).toHaveLength(1);
    expect(wrapper.get('#auth-password').attributes('autocomplete')).toBe('current-password');
    wrapper.unmount();
  });

  it('requires a matching password and invitation code for self-registration', async () => {
    window.localStorage.clear();
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
    expect(readFirstUseFunnel().map((event) => event.name)).toContain('first_use_signup_completed');
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.text()).toContain('Аккаунт создан');
    expect(wrapper.text()).toContain('friend@example.com');
    expect(wrapper.text()).toContain('Подтверди email по ссылке');
    expect(wrapper.text()).toContain('Отправить письмо ещё раз');
    expect(wrapper.text()).toContain('Изменить email');
    expect(wrapper.text()).toContain('Перейти ко входу');
  });

  it('resends confirmation and lets the user correct the email', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.signupEnabled = true;
    auth.signUp = vi.fn().mockResolvedValue({ session: null, confirmationRequired: true });
    auth.resendSignupConfirmation = vi.fn().mockResolvedValue(undefined);
    const wrapper = mount(AuthGate, { attachTo: document.body, global: { plugins: [pinia] } });

    await wrapper.get('.auth-presentation__actions .primary-button').trigger('click');
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('friend@example.com');
    await inputs[1].setValue('safe-password');
    await inputs[2].setValue('safe-password');
    await inputs[3].setValue('BETA-INVITE-2026');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Отправить письмо ещё раз')!
      .trigger('click');
    expect(auth.resendSignupConfirmation).toHaveBeenCalledWith('friend@example.com');
    expect(wrapper.text()).toContain('Письмо отправлено повторно');

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Изменить email')!
      .trigger('click');
    expect((wrapper.get('input[type="email"]').element as HTMLInputElement).value).toBe('friend@example.com');
    expect(wrapper.get('input[type="email"]').element).toBe(document.activeElement);
    wrapper.unmount();
  });

  it('shows the exact registration operation while signup is pending', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.signupEnabled = true;
    auth.signUp = vi.fn().mockImplementation(async () => {
      auth.operation = 'signing-up';
      await new Promise(() => undefined);
    });
    const wrapper = mount(AuthGate, { global: { plugins: [pinia] } });

    await wrapper.get('.auth-presentation__actions .primary-button').trigger('click');
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('friend@example.com');
    await inputs[1].setValue('safe-password');
    await inputs[2].setValue('safe-password');
    await inputs[3].setValue('BETA-INVITE-2026');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.get('form').attributes('aria-busy')).toBe('true');
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('button[type="submit"]').text()).toContain('Создаём аккаунт…');
    expect(wrapper.find('.auth-button-spinner').exists()).toBe(true);
  });

  it('keeps the email but clears passwords after a recoverable registration error', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.signupEnabled = true;
    auth.signUp = vi.fn().mockImplementation(async () => {
      auth.error = 'Код приглашения не подошёл. Проверь код или запроси новый.';
      throw new Error('Код приглашения не подошёл');
    });
    const wrapper = mount(AuthGate, { global: { plugins: [pinia] } });

    await wrapper.get('.auth-presentation__actions .primary-button').trigger('click');
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('friend@example.com');
    await inputs[1].setValue('safe-password');
    await inputs[2].setValue('safe-password');
    await inputs[3].setValue('BETA-INVITE-2026');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect((wrapper.get('input[type="email"]').element as HTMLInputElement).value).toBe('friend@example.com');
    expect((wrapper.get('#auth-password').element as HTMLInputElement).value).toBe('');
    expect((wrapper.get('#auth-password-confirmation').element as HTMLInputElement).value).toBe('');
    expect(wrapper.get('[role="alert"]').text()).toContain('Код приглашения не подошёл');
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
    const visibilityButtons = wrapper.findAll('button[aria-label="Показать пароль"]');
    expect(visibilityButtons).toHaveLength(2);
    await visibilityButtons[0]!.trigger('click');
    expect(inputs[0]!.attributes('type')).toBe('text');
    expect(inputs[0]!.element.value).toBe('new-safe-password');
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
