// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import PwaInstallGuide from '../ui/PwaInstallGuide.vue';

describe('PwaInstallGuide', () => {
  it('keeps one honest guide for browser installation, iOS fallback and removal', async () => {
    const wrapper = mount(PwaInstallGuide, { props: { open: true }, attachTo: document.body });

    expect(wrapper.text()).toContain('Установить на телефон');
    expect(wrapper.text()).toContain('Установить приложение');
    expect(wrapper.text()).toContain('На экран Домой');
    expect(wrapper.text()).toContain('фоновая синхронизация не гарантируется');
    expect(wrapper.text()).toContain('удаление значка не гарантирует удаление аккаунта');

    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: prompt },
      userChoice: { value: Promise.resolve({ outcome: 'accepted' }) },
    });
    window.dispatchEvent(event);
    await flushPromises();

    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(prompt).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('Подтвердите установку');

    const failedEvent = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperties(failedEvent, {
      prompt: { value: vi.fn().mockRejectedValue(new Error('prompt unavailable')) },
      userChoice: { value: Promise.resolve({ outcome: 'dismissed' }) },
    });
    window.dispatchEvent(failedEvent);
    await flushPromises();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Используйте команду установки в меню браузера');

    window.dispatchEvent(new Event('appinstalled'));
    await flushPromises();
    expect(wrapper.text()).toContain('Открыто с домашнего экрана');
    wrapper.unmount();
  });
});
