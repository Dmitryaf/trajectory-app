// @vitest-environment happy-dom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AccountMenu from '../ui/AccountMenu.vue';

describe('AccountMenu', () => {
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
    expect(wrapper.get('a[href="/settings#install-settings"]').text()).toContain('Установить приложение');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('signOut')).toHaveLength(1);
  });
});
