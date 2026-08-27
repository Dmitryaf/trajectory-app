<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { sendFeedback } from '@/services/feedback';
import { notifyError, notifySaved } from '@/services/notifications';
import DialogCloseButton from '@/shared/ui/overlays/DialogCloseButton.vue';
import FormFieldLabel from '@/shared/ui/forms/FormFieldLabel.vue';
import { useBodyScrollLock } from '@/shared/ui/overlays/useBodyScrollLock';
import { useDialogBackdropClose } from '@/shared/ui/overlays/useDialogBackdropClose';
import { useDialogFocus } from '@/shared/ui/overlays/useDialogFocus';

const props = defineProps<{
  accessToken: string;
}>();

const isOpen = ref(false);
const isSending = ref(false);
const message = ref('');
const messageInput = ref<HTMLTextAreaElement>();
const dialog = ref<HTMLElement>();

useBodyScrollLock(isOpen);
const { handleDialogKeydown } = useDialogFocus(isOpen, dialog);

async function open() {
  isOpen.value = true;
  await nextTick();
  messageInput.value?.focus();
}

function close() {
  if (isSending.value) {
    return;
  }
  isOpen.value = false;
}

const { startBackdropClose, finishBackdropClose, cancelBackdropClose } = useDialogBackdropClose(close);

async function submit() {
  const value = message.value.trim();
  if (value.length < 3) {
    notifyError('Напиши хотя бы несколько слов');
    return;
  }

  isSending.value = true;
  try {
    await sendFeedback(value, props.accessToken);
    message.value = '';
    isOpen.value = false;
    notifySaved('Спасибо, сообщение отправлено');
  } catch (error) {
    notifyError(error instanceof Error ? error.message : 'Не удалось отправить сообщение');
  } finally {
    isSending.value = false;
  }
}
</script>

<template>
  <button class="beta-feedback-link" type="button" aria-label="Обратная связь" aria-haspopup="dialog" @click="open">
    <span aria-hidden="true">✦</span>
    <strong>Обратная связь</strong>
  </button>

  <Teleport to="body">
    <div
      v-if="isOpen"
      class="feedback-backdrop"
      @pointerdown="startBackdropClose"
      @pointerup="finishBackdropClose"
      @pointercancel="cancelBackdropClose"
    >
      <section
        ref="dialog"
        class="feedback-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        @keydown="handleDialogKeydown"
        @keydown.esc="close"
      >
        <div class="feedback-dialog__heading">
          <div>
            <span class="eyebrow">Закрытая бета</span>
            <h2 id="feedback-title">Написать разработчику</h2>
          </div>
          <DialogCloseButton label="Закрыть форму" :disabled="isSending" @click="close" />
        </div>

        <form @submit.prevent="submit">
          <FormFieldLabel for="beta-feedback-message">Предложение, проблема или ошибка</FormFieldLabel>
          <textarea
            id="beta-feedback-message"
            ref="messageInput"
            v-model="message"
            rows="7"
            minlength="3"
            maxlength="4000"
            required
            placeholder="Расскажи, что произошло или чего не хватило. Для ошибки можно добавить короткие шаги воспроизведения."
          ></textarea>
          <p class="feedback-dialog__hint">
            К сообщению будет приложен email аккаунта, чтобы при необходимости уточнить детали. Не отправляй пароли, код приглашения и
            содержимое личных записей.
          </p>
          <div class="feedback-dialog__actions">
            <button class="secondary-button" type="button" :disabled="isSending" @click="close">Отмена</button>
            <button class="primary-button" type="submit" :disabled="isSending || message.trim().length < 3">
              {{ isSending ? 'Отправляю…' : 'Отправить' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.feedback-dialog {
  width: min(540px, 100%);
  padding: 26px;
}
.feedback-dialog textarea {
  min-height: 150px;
}
.feedback-dialog__hint {
  margin: 10px 0 0;
  color: #77827e;
  font-size: 12px;
  line-height: 1.5;
}
.feedback-dialog__actions button {
  min-width: 120px;
}

@media (max-width: 720px) {
  .feedback-dialog__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .feedback-dialog__actions button {
    min-width: 0;
  }
}
</style>
