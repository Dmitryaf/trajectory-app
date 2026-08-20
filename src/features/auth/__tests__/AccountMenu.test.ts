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
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('signOut')).toHaveLength(1);
  });
});
