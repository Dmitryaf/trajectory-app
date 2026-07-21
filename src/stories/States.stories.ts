import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Основы/Кнопки и состояния',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  render: () => ({
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center">
        <button class="primary-button" type="button">Сохранить</button>
        <button class="secondary-button" type="button">Скачать данные</button>
        <button class="ghost-button" type="button" aria-label="Редактировать">✎</button>
        <button class="primary-button" type="button" disabled>Сохраняю…</button>
      </div>
    `,
  }),
};

export const EmptyState: Story = {
  render: () => ({
    template: `
      <div class="empty-state" style="max-width: 680px">
        <span>◇</span>
        <h3>Событий пока нет</h3>
        <p>Добавь изменение, решение, событие или мысль, к которой важно вернуться позже.</p>
      </div>
    `,
  }),
};

export const ErrorState: Story = {
  render: () => ({
    template: `
      <section class="storage-error" role="alert" style="max-width: 760px">
        <span class="storage-error__mark" aria-hidden="true">!</span>
        <div>
          <p class="eyebrow">Локальное хранилище недоступно</p>
          <h1>Записи пока не открылись</h1>
          <p>Попробуй открыть данные ещё раз.</p>
          <button class="primary-button" type="button">Повторить</button>
        </div>
      </section>
    `,
  }),
};
