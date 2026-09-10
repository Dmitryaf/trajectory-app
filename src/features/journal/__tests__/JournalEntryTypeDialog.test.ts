// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import JournalEntryTypeDialog from '../ui/JournalEntryTypeDialog.vue';

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/more', component: { template: '<div />' } },
      { path: '/results', component: { template: '<div />' } },
      { path: '/events', component: { template: '<div />' } },
    ],
  });
}

describe('JournalEntryTypeDialog', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('offers both existing entry types with examples', async () => {
    const router = createTestRouter();
    await router.push('/more');
    await router.isReady();
    const wrapper = mount(JournalEntryTypeDialog, {
      attachTo: document.body,
      global: { plugins: [router] },
    });

    await wrapper.get('button').trigger('click');
    await flushPromises();

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Что хотите сохранить?');
    expect(dialog?.textContent).toContain('закончил курс или получил ответ');
    expect(dialog?.textContent).toContain('встреча, решение или новое понимание');
    expect(dialog?.querySelector('a[href="/results?compose=journal"]')).not.toBeNull();
    expect(dialog?.querySelector('a[href="/events?compose=journal"]')).not.toBeNull();
    expect(dialog?.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(5);
    wrapper.unmount();
  });

  it('returns focus to the add action after cancellation', async () => {
    const router = createTestRouter();
    await router.push('/more');
    await router.isReady();
    const wrapper = mount(JournalEntryTypeDialog, {
      attachTo: document.body,
      global: { plugins: [router] },
    });
    const trigger = wrapper.get('button');

    await trigger.trigger('click');
    await flushPromises();
    const cancel = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Отменить');
    expect(cancel).toBeDefined();
    cancel!.click();
    await flushPromises();

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(trigger.element).toBe(document.activeElement);
    wrapper.unmount();
  });
});
