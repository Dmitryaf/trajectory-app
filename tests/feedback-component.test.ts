// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const feedback = vi.hoisted(() => ({ send: vi.fn() }));
const notifications = vi.hoisted(() => ({ error: vi.fn(), saved: vi.fn() }));

vi.mock('../src/services/feedback', () => ({ sendFeedback: feedback.send }));
vi.mock('../src/services/notifications', () => ({
  notifyError: notifications.error,
  notifySaved: notifications.saved,
}));

import FeedbackDialog from '../src/components/FeedbackDialog.vue';

describe('feedback dialog', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('asks for one message and closes after successful delivery', async () => {
    feedback.send.mockResolvedValueOnce(undefined);
    const wrapper = mount(FeedbackDialog, { props: { accessToken: 'session-token' }, attachTo: document.body });

    await wrapper.get('.beta-feedback-link').trigger('click');
    const textarea = document.body.querySelector<HTMLTextAreaElement>('#beta-feedback-message');
    expect(textarea).not.toBeNull();
    textarea!.value = 'Добавьте подсказку на экране недели';
    textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    document.body
      .querySelector<HTMLFormElement>('.feedback-dialog form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(feedback.send).toHaveBeenCalledWith('Добавьте подсказку на экране недели', 'session-token');
    expect(notifications.saved).toHaveBeenCalledWith('Спасибо, сообщение отправлено');
    expect(document.body.querySelector('.feedback-dialog')).toBeNull();
    wrapper.unmount();
  });
});
