// @vitest-environment happy-dom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AccountMenu from '../ui/AccountMenu.vue';

describe('AccountMenu', () => {
  it('groups settings and sign out under the current account', async () => {
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
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
    expect(wrapper.find('a[href="/settings#install-settings"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Обновить данные');
    expect(wrapper.get('summary').attributes('aria-label')).toBe('Открыть меню аккаунта');
    expect(wrapper.get('.account-menu__chevron').element.tagName).toBe('svg');
    expect(wrapper.get('.account-menu__chevron path').attributes('d')).toBe('m4 6 4 4 4-4');
    expect(wrapper.findAll('.account-menu__action svg[aria-hidden="true"]')).toHaveLength(2);
    await wrapper.get('.account-menu__logout').trigger('click');
    expect(wrapper.emitted('signOut')).toHaveLength(1);
  });
});
