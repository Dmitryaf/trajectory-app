<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { sendFeedback } from '../services/feedback';
import { notifyError, notifySaved } from '../services/notifications';

const props = defineProps<{
  accessToken: string;
}>();

const isOpen = ref(false);
const isSending = ref(false);
const message = ref('');
const messageInput = ref<HTMLTextAreaElement>();

async function open() {
  isOpen.value = true;
  await nextTick();
  messageInput.value?.focus();
}

function close() {
  if (isSending.value) return;
  isOpen.value = false;
}

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
    <div v-if="isOpen" class="feedback-backdrop" @click.self="close">
      <section class="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title" @keydown.esc="close">
        <div class="feedback-dialog__heading">
          <div>
            <span class="eyebrow">Закрытая бета</span>
            <h2 id="feedback-title">Написать разработчику</h2>
          </div>
          <button class="feedback-dialog__close" type="button" :disabled="isSending" aria-label="Закрыть форму" @click="close">×</button>
        </div>

        <form @submit.prevent="submit">
          <label for="beta-feedback-message" class="field-label">Предложение, проблема или ошибка</label>
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
