<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import DialogCloseButton from '../../../shared/ui/overlays/DialogCloseButton.vue';
import { useBodyScrollLock } from '../../../shared/ui/overlays/useBodyScrollLock';
import { useDialogBackdropClose } from '../../../shared/ui/overlays/useDialogBackdropClose';
import { useDialogFocus } from '../../../shared/ui/overlays/useDialogFocus';
import AiAnalysisSteps from '../../analysis/ui/AiAnalysisSteps.vue';

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
const closeButton = ref<InstanceType<typeof DialogCloseButton>>();
const dialog = ref<HTMLElement>();
const openedAsIntro = ref(false);

useBodyScrollLock(isOpen);
const { handleDialogKeydown } = useDialogFocus(isOpen, dialog, triggerButton);

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

function close() {
  isOpen.value = false;
  if (openedAsIntro.value) emit('intro-seen');
  openedAsIntro.value = false;
}

const { startBackdropClose, finishBackdropClose, cancelBackdropClose } = useDialogBackdropClose(close);
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
    <div
      v-if="isOpen"
      class="help-backdrop"
      @pointerdown="startBackdropClose"
      @pointerup="finishBackdropClose"
      @pointercancel="cancelBackdropClose"
    >
      <section
        ref="dialog"
        class="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-it-works-title"
        @keydown="handleDialogKeydown"
        @keydown.esc="close"
      >
        <div class="help-dialog__heading">
          <div>
            <span class="eyebrow">Зачем нужны записи</span>
            <h2 id="how-it-works-title">Зачем нужна «Траектория»</h2>
          </div>
          <DialogCloseButton ref="closeButton" label="Закрыть объяснение" @click="close" />
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

        <section class="help-dialog__note help-dialog__analysis" aria-labelledby="external-analysis-title">
          <strong id="external-analysis-title">Разобрать записи во внешней нейросети</strong>
          <p>Когда накопятся записи, приложение может собрать их в понятный текст для дополнительного разбора.</p>
          <AiAnalysisSteps />
          <RouterLink to="/week#ai-analysis" @click="close">Подготовить текст для нейросети →</RouterLink>
        </section>

        <div class="help-dialog__actions">
          <RouterLink class="secondary-button" to="/settings#daily-blocks" @click="close">Настроить записи</RouterLink>
          <RouterLink class="primary-button" to="/" @click="close">Начать запись</RouterLink>
        </div>
      </section>
    </div>
  </Teleport>
</template>
