<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

const props = defineProps<{
  open: boolean;
  title: string;
  outcomeCriterion: string;
  reviewDate: string;
  externalEvidenceCriterion: string;
  saving: boolean;
}>();

const emit = defineEmits<{
  close: [];
  remove: [];
  save: [goal: { title: string; outcomeCriterion: string; reviewDate: string; externalEvidenceCriterion: string }];
}>();

const draftTitle = ref('');
const draftOutcomeCriterion = ref('');
const draftReviewDate = ref('');
const draftExternalEvidenceCriterion = ref('');
const titleInput = ref<HTMLInputElement>();
const backdropPointerId = ref<number | null>(null);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    draftTitle.value = props.title;
    draftOutcomeCriterion.value = props.outcomeCriterion;
    draftReviewDate.value = props.reviewDate;
    draftExternalEvidenceCriterion.value = props.externalEvidenceCriterion;
    await nextTick();
    titleInput.value?.focus();
  },
);

function close() {
  if (!props.saving) emit('close');
}

function startBackdropClose(event: PointerEvent) {
  backdropPointerId.value = event.target === event.currentTarget ? event.pointerId : null;
}

function finishBackdropClose(event: PointerEvent) {
  const shouldClose = event.target === event.currentTarget && backdropPointerId.value === event.pointerId;
  backdropPointerId.value = null;
  if (shouldClose) close();
}

function cancelBackdropClose() {
  backdropPointerId.value = null;
}

function submit() {
  const preparedTitle = draftTitle.value.trim();
  if (!preparedTitle || props.saving) return;
  emit('save', {
    title: preparedTitle,
    outcomeCriterion: draftOutcomeCriterion.value.trim(),
    reviewDate: draftReviewDate.value,
    externalEvidenceCriterion: draftExternalEvidenceCriterion.value.trim(),
  });
}

function remove() {
  if (!props.saving) emit('remove');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="goal-dialog-backdrop"
      @pointerdown="startBackdropClose"
      @pointerup="finishBackdropClose"
      @pointercancel="cancelBackdropClose"
    >
      <section class="goal-dialog" role="dialog" aria-modal="true" aria-labelledby="current-goal-dialog-title" @keydown.esc="close">
        <div class="goal-dialog__heading">
          <div>
            <span class="eyebrow">Текущая цель</span>
            <h2 id="current-goal-dialog-title">Над чем вы сейчас работаете</h2>
          </div>
          <button type="button" :disabled="saving" aria-label="Закрыть выбор цели" @click="close">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="1.8"
            >
              <path d="M6 6 18 18M18 6 6 18" />
            </svg>
          </button>
        </div>

        <form @submit.prevent="submit">
          <label class="field-label" for="current-goal-title">Что хотите изменить или закончить</label>
          <input
            id="current-goal-title"
            ref="titleInput"
            v-model="draftTitle"
            type="text"
            maxlength="100"
            required
            placeholder="Например: подготовиться к собеседованию"
          />

          <label class="field-label" for="current-goal-outcome">Как понять, что получилось</label>
          <input
            id="current-goal-outcome"
            v-model="draftOutcomeCriterion"
            type="text"
            maxlength="220"
            placeholder="Наблюдаемый результат — необязательно"
          />

          <label class="field-label" for="current-goal-review-date">Когда вернуться к цели</label>
          <input id="current-goal-review-date" v-model="draftReviewDate" type="date" />

          <label class="field-label" for="current-goal-evidence">Что считать шагом к цели</label>
          <textarea
            id="current-goal-evidence"
            v-model="draftExternalEvidenceCriterion"
            rows="2"
            maxlength="220"
            placeholder="Например: выполненное задание, тренировка, разговор или принятое решение"
          ></textarea>
          <p class="goal-dialog__hint">Цель помогает связать отдельные шаги с периодом, но не обязательна для сохранения дня.</p>

          <div class="goal-dialog__actions">
            <button v-if="title" class="secondary-button" type="button" :disabled="saving" @click="remove">Убрать цель</button>
            <button class="secondary-button" type="button" :disabled="saving" @click="close">Отмена</button>
            <button class="primary-button" type="submit" :disabled="saving || !draftTitle.trim()">
              {{ saving ? 'Сохраняю…' : 'Сохранить цель' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
