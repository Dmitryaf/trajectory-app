// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it } from 'vitest';
import HowItWorksDialog from '../ui/HowItWorksDialog.vue';

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/settings', component: { template: '<div />' } },
    ],
  });
}

describe('HowItWorksDialog', () => {
  it('can use a clearer label inside onboarding', () => {
    const wrapper = mount(HowItWorksDialog, {
      props: { buttonLabel: 'Зачем это заполнять?', inline: true },
      global: { plugins: [createTestRouter()] },
    });

    expect(wrapper.get('button').text()).toContain('Зачем это заполнять?');
    expect(wrapper.get('button').classes()).toContain('help-link--inline');
  });

  it('opens for a first visit and explains the whole path in plain language', async () => {
    const router = createTestRouter();
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
    const wrapper = mount(HowItWorksDialog, {
      attachTo: document.body,
      global: { plugins: [createTestRouter()] },
    });

    await wrapper.get('button').trigger('click');
    const closeButton = document.querySelector('[aria-label="Закрыть объяснение"]') as HTMLButtonElement;
    expect(closeButton.querySelector('svg')).not.toBeNull();
    expect(closeButton.textContent).toBe('');
    expect(closeButton).toBe(document.activeElement);
    closeButton.click();
    await flushPromises();
    expect(wrapper.get('button').element).toBe(document.activeElement);
    wrapper.unmount();
  });
});
