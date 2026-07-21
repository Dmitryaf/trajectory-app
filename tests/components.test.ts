// @vitest-environment happy-dom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ChipGroup from '../src/components/ChipGroup.vue';
import DurationInput from '../src/components/DurationInput.vue';
import PeriodNavigator from '../src/components/PeriodNavigator.vue';

describe('form components', () => {
  it('shows a duration as hours and minutes and emits exact minute values', async () => {
    const wrapper = mount(DurationInput, {
      props: { id: 'sleep-duration', modelValue: 415, maxHours: 24 }
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
          { id: 'walk', label: 'Прогулка' }
        ],
        modelValue: ['reading'],
        multiple: true
      }
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
      props: { title: 'Июль 2026', subtitle: '20 записей' }
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
