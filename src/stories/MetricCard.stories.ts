import type { Meta, StoryObj } from '@storybook/vue3-vite';
import MetricCard from '../components/MetricCard.vue';

const meta = {
  title: 'Карточки/Показатель',
  component: MetricCard,
  tags: ['autodocs'],
  args: {
    label: 'Средний сон',
    value: '7 ч 32 мин',
    hint: '6 дней с данными',
    accent: '#7467e8',
  },
  decorators: [() => ({ template: '<div style="max-width: 320px"><story /></div>' })],
} satisfies Meta<typeof MetricCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithData: Story = {};

export const WithoutData: Story = {
  args: {
    value: '—',
    hint: 'Пока нет измерений',
  },
};

export const LongLabel: Story = {
  args: {
    label: 'Доля дней с отмеченным конкретным действием',
    value: '4 из 7',
    hint: 'Считаются только заполненные дни',
  },
};
