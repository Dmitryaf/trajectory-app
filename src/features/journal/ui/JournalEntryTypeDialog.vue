<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import ActionButton from '@/shared/ui/actions/ActionButton.vue';
import DialogCloseButton from '@/shared/ui/overlays/DialogCloseButton.vue';
import DialogSurface from '@/shared/ui/overlays/DialogSurface.vue';
import EyebrowText from '@/shared/ui/typography/EyebrowText.vue';
import { useBodyScrollLock } from '@/shared/ui/overlays/useBodyScrollLock';
import { useDialogBackdropClose } from '@/shared/ui/overlays/useDialogBackdropClose';
import { useDialogFocus } from '@/shared/ui/overlays/useDialogFocus';

const props = withDefaults(
  defineProps<{
    openInitially?: boolean;
  }>(),
  { openInitially: false },
);

const isOpen = ref(false);
const trigger = ref<{ $el?: HTMLElement }>();
const triggerButton = computed(() => trigger.value?.$el);
const dialogSurface = ref<InstanceType<typeof DialogSurface>>();
const dialog = computed(() => dialogSurface.value?.element);

useBodyScrollLock(isOpen);
const { handleDialogKeydown } = useDialogFocus(isOpen, dialog, triggerButton);

function open() {
  isOpen.value = true;
}

function close() {
  isOpen.value = false;
}

const { startBackdropClose, finishBackdropClose, cancelBackdropClose } = useDialogBackdropClose(close);

onMounted(() => {
  if (props.openInitially) {
    isOpen.value = true;
  }
});
</script>

<template>
  <ActionButton ref="trigger" class="journal-add-button" variant="primary" type="button" aria-haspopup="dialog" @click="open">
    <span aria-hidden="true">＋</span>
    Добавить запись
  </ActionButton>

  <Teleport to="body">
    <DialogSurface
      v-if="isOpen"
      ref="dialogSurface"
      backdrop-class="journal-entry-backdrop"
      panel-class="journal-entry-dialog"
      labelledby="journal-entry-dialog-title"
      mobile="sheet"
      width="min(620px, 100%)"
      padding="28px"
      @pointerdown="startBackdropClose"
      @pointerup="finishBackdropClose"
      @pointercancel="cancelBackdropClose"
      @keydown="handleDialogKeydown"
      @keydown.esc="close"
    >
      <div class="dialog-heading">
        <div>
          <EyebrowText>Новая запись</EyebrowText>
          <h2 id="journal-entry-dialog-title">Что хотите сохранить?</h2>
        </div>
        <DialogCloseButton label="Закрыть выбор типа записи" @click="close" />
      </div>

      <p class="journal-entry-dialog__lead">Выберите тип — откроется короткая форма. Архивы и уже сохранённые записи останутся на месте.</p>

      <div class="journal-entry-options">
        <RouterLink
          class="journal-entry-option journal-entry-option--result"
          :to="{ path: '/results', query: { compose: 'journal' } }"
          @click="close"
        >
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Итог</strong>
            <p>Завершённое дело или полученный результат. Например: закончил курс или получил ответ.</p>
          </div>
          <i aria-hidden="true">→</i>
        </RouterLink>
        <RouterLink
          class="journal-entry-option journal-entry-option--event"
          :to="{ path: '/events', query: { compose: 'journal' } }"
          @click="close"
        >
          <span aria-hidden="true">✦</span>
          <div>
            <strong>Событие или наблюдение</strong>
            <p>Важная ситуация, мысль или деталь. Например: встреча, решение или новое понимание.</p>
          </div>
          <i aria-hidden="true">→</i>
        </RouterLink>
      </div>

      <div class="dialog-actions journal-entry-dialog__actions">
        <ActionButton variant="secondary" type="button" @click="close">Отменить</ActionButton>
      </div>
    </DialogSurface>
  </Teleport>
</template>

<style scoped>
.journal-add-button {
  min-width: min(100%, 240px);
  min-height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin: 4px 0 18px;
  font-size: 15px;
}
.journal-add-button > span {
  font-size: 20px;
  line-height: 1;
}
.journal-entry-dialog__lead {
  margin: 14px 0 18px;
  color: var(--muted);
  line-height: 1.5;
}
.journal-entry-options {
  display: grid;
  gap: 12px;
}
.journal-entry-option {
  min-width: 0;
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface-soft);
  color: inherit;
  text-decoration: none;
  transition:
    border-color var(--motion-fast) var(--motion-ease),
    transform var(--motion-fast) var(--motion-ease),
    box-shadow var(--motion-fast) var(--motion-ease);
}
.journal-entry-option:hover {
  transform: translateY(-1px);
  border-color: var(--chip-selected-border);
  box-shadow: var(--shadow-soft);
}
.journal-entry-option:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}
.journal-entry-option > span {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  background: var(--chip-selected-surface);
  color: var(--more-view-journal-text);
  font-size: 19px;
  font-weight: 850;
}
.journal-entry-option--event > span {
  background: var(--archive-event-surface-end);
  color: var(--more-view-event-text);
}
.journal-entry-option strong,
.journal-entry-option p {
  overflow-wrap: anywhere;
}
.journal-entry-option p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
}
.journal-entry-option > i {
  color: var(--more-view-muted);
  font-size: 20px;
  font-style: normal;
}
.journal-entry-dialog__actions {
  margin-top: 18px;
}
@media (max-width: 520px) {
  .journal-add-button {
    width: 100%;
  }
  .journal-entry-option {
    grid-template-columns: 42px minmax(0, 1fr);
    padding: 14px;
  }
  .journal-entry-option > span {
    width: 42px;
    height: 42px;
  }
  .journal-entry-option > i {
    display: none;
  }
}
</style>
