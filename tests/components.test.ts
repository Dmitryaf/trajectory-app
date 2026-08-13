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
import PasswordField from '../src/components/PasswordField.vue';
import PeriodNavigator from '../src/components/PeriodNavigator.vue';
import PasswordResetView from '../src/views/PasswordResetView.vue';
import { readFirstUseFunnel } from '../src/features/first-use/funnel';
import { useAuthStore } from '../src/stores/auth';

describe('form components', () => {
  it('toggles password visibility without changing the entered value', async () => {
    const wrapper = mount(PasswordField, {
      props: {
        id: 'test-password',
        modelValue: 'safe-password',
        autocomplete: 'current-password',
      },
    });
    const input = wrapper.get('input');
    const toggle = wrapper.get('button');

    expect(input.attributes('type')).toBe('password');
    expect(input.attributes('autocomplete')).toBe('current-password');
    expect(input.element.value).toBe('safe-password');
    expect(toggle.attributes('aria-label')).toBe('Показать пароль');
    expect(toggle.attributes('aria-pressed')).toBe('false');
    expect(toggle.attributes('aria-controls')).toBe('test-password');
    expect(toggle.text()).toBe('');
    expect(toggle.get('svg').attributes('aria-hidden')).toBe('true');
    expect(wrapper.get('.password-field').element.children[1]).toBe(toggle.element);

    await toggle.trigger('click');

    expect(input.attributes('type')).toBe('text');
    expect(input.element.value).toBe('safe-password');
    expect(toggle.attributes('aria-label')).toBe('Скрыть пароль');
    expect(toggle.attributes('aria-pressed')).toBe('true');
  });

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
  it('can use a clearer label inside onboarding', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/settings', component: { template: '<div />' } },
      ],
    });
    const wrapper = mount(HowItWorksDialog, {
      props: { buttonLabel: 'Зачем это заполнять?', inline: true },
      global: { plugins: [router] },
    });

    expect(wrapper.get('button').text()).toContain('Зачем это заполнять?');
    expect(wrapper.get('button').classes()).toContain('help-link--inline');
  });

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
    expect(document.querySelectorAll('.help-steps > li')).toHaveLength(3);
    expect(document.body.textContent).toContain('Записать важное');
    expect(document.body.textContent).toContain('Увидеть период целиком');
    expect(document.body.textContent).toContain('Сохранить следующее решение');

    (document.querySelector('[aria-label="Закрыть объяснение"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(wrapper.emitted('intro-seen')).toHaveLength(1);
  });

  it('returns keyboard focus to the help button after a manual close', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/settings', component: { template: '<div />' } },
      ],
    });
    const wrapper = mount(HowItWorksDialog, {
      attachTo: document.body,
      global: { plugins: [router] },
    });

    await wrapper.get('button').trigger('click');
    const closeButton = document.querySelector('[aria-label="Закрыть объяснение"]') as HTMLButtonElement;
    expect(closeButton).toBe(document.activeElement);
    closeButton.click();
    await flushPromises();
    expect(wrapper.get('button').element).toBe(document.activeElement);
    wrapper.unmount();
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
