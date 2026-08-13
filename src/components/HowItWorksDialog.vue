<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    openForFirstVisit?: boolean;
    buttonLabel?: string;
    inline?: boolean;
  }>(),
  { openForFirstVisit: false, buttonLabel: 'Как это работает', inline: false },
);

const emit = defineEmits<{ 'intro-seen': [] }>();
const isOpen = ref(false);
const triggerButton = ref<HTMLButtonElement>();
const closeButton = ref<HTMLButtonElement>();
const openedAsIntro = ref(false);

watch(
  () => props.openForFirstVisit,
  async (shouldOpen) => {
    if (!shouldOpen) {
      if (openedAsIntro.value) {
        isOpen.value = false;
        openedAsIntro.value = false;
      }
      return;
    }
    if (isOpen.value) return;
    openedAsIntro.value = true;
    isOpen.value = true;
    await nextTick();
    closeButton.value?.focus();
  },
  { immediate: true },
);

async function open() {
  openedAsIntro.value = false;
  isOpen.value = true;
  await nextTick();
  closeButton.value?.focus();
}

async function close() {
  const shouldRestoreFocus = !openedAsIntro.value;
  isOpen.value = false;
  if (openedAsIntro.value) emit('intro-seen');
  openedAsIntro.value = false;
  if (shouldRestoreFocus) {
    await nextTick();
    triggerButton.value?.focus();
  }
}
</script>

<template>
  <button
    ref="triggerButton"
    class="help-link"
    :class="{ 'help-link--inline': inline }"
    type="button"
    aria-label="Как работает приложение"
    title="Как это работает"
    aria-haspopup="dialog"
    @click="open"
  >
    <span aria-hidden="true">?</span>
    <strong>{{ buttonLabel }}</strong>
  </button>

  <Teleport to="body">
    <div v-if="isOpen" class="help-backdrop" @click.self="close">
      <section class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="how-it-works-title" @keydown.esc="close">
        <div class="help-dialog__heading">
          <div>
            <span class="eyebrow">Зачем нужны записи</span>
            <h2 id="how-it-works-title">Зачем нужна «Траектория»</h2>
          </div>
          <button ref="closeButton" class="help-dialog__close" type="button" aria-label="Закрыть объяснение" @click="close">×</button>
        </div>

        <p class="help-dialog__lead">
          Записи помогают вспомнить период по конкретным событиям, результатам и условиям. Приложение ничего не оценивает: следующий шаг
          выбираете вы.
        </p>

        <ol class="help-steps">
          <li>
            <span>1</span>
            <div>
              <strong>Записать важное</strong>
              <p>Коротко отметьте событие, результат, состояние или условие дня. Заполнять все поля не обязательно.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Увидеть период целиком</strong>
              <p>В обзоре недели или месяца записи окажутся рядом. Так проще заметить, что происходило и что менялось.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Сохранить следующее решение</strong>
              <p>
                Решите, что оставить, изменить или проверить дальше. Продолжить как есть и пока ничего не менять — тоже нормальный выбор.
              </p>
            </div>
          </li>
        </ol>

        <p class="help-dialog__note">
          Сами по себе записи не являются целью. Они нужны для одного решения: что оставить, что изменить или что проверить дальше.
        </p>

        <div class="help-dialog__actions">
          <RouterLink class="secondary-button" to="/settings#daily-blocks" @click="close">Настроить записи</RouterLink>
          <RouterLink class="primary-button" to="/" @click="close">Начать запись</RouterLink>
        </div>
      </section>
    </div>
  </Teleport>
</template>
