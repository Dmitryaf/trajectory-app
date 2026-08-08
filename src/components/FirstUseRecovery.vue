<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { addDays, formatDate, startOfWeek, todayKey } from '../services/dates';
import { plainCopy } from '../services/plain';
import { useAppStore } from '../stores/app';
import { emptyWeeklyReview, type FirstUseState, type FirstUseStep, type WeeklyReview } from '../types';

type DecisionChoice = '' | 'continue' | 'change' | 'later';

const store = useAppStore();
const hiddenForNow = ref(false);
const saving = ref(false);
const saveError = ref('');
const review = reactive<WeeklyReview>(emptyWeeklyReview(''));
const resultsText = ref('');
const highlightsText = ref('');
const stateContext = ref('');
const support = ref('');
const obstacle = ref('');
const decision = ref<DecisionChoice>('');
const decisionText = ref('');
const ifThenPlan = ref('');

const steps: FirstUseStep[] = ['results', 'highlights', 'state_context', 'support_obstacle', 'decision'];
const firstUse = computed(() => store.settings.firstUse);
const isChoice = computed(
  () => firstUse.value.status === 'not_started' || (firstUse.value.status === 'in_progress' && firstUse.value.lastStep === 'choice'),
);
const showAvailablePrompt = computed(() => firstUse.value.status === 'available' && store.dailyEntries.length > 0 && !hiddenForNow.value);
const isRecovery = computed(() => firstUse.value.status === 'in_progress' && !isChoice.value);
const currentStep = computed(() => firstUse.value.lastStep);
const currentStepIndex = computed(() => steps.indexOf(currentStep.value));
const weekEnd = computed(() => (firstUse.value.weekStart ? addDays(firstUse.value.weekStart, 6) : ''));
const weekLabel = computed(() => {
  if (!firstUse.value.weekStart) return '';
  return `${formatDate(firstUse.value.weekStart)} — ${formatDate(weekEnd.value, { day: 'numeric', month: 'long', year: 'numeric' })}`;
});
const meaningfulAnswerCount = computed(
  () =>
    review.results.filter(Boolean).length +
    review.highlights.filter(Boolean).length +
    [review.stateContext, review.support, review.obstacle].filter((value) => value.trim()).length,
);
const currentAnswerIsValid = computed(
  () => currentStep.value !== 'decision' || decision.value !== 'change' || Boolean(decisionText.value.trim()),
);

watch(
  () => `${firstUse.value.status}:${firstUse.value.weekStart}:${firstUse.value.lastStep}`,
  () => loadDraft(),
  { immediate: true },
);

function lines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadDraft() {
  if (!firstUse.value.weekStart) return;
  const existing = store.reviewByWeek(firstUse.value.weekStart);
  Object.assign(review, emptyWeeklyReview(firstUse.value.weekStart), existing ? plainCopy(existing) : {});
  resultsText.value = review.results.filter(Boolean).join('\n');
  highlightsText.value = review.highlights.filter(Boolean).join('\n');
  stateContext.value = review.stateContext;
  support.value = review.support;
  obstacle.value = review.obstacle;
  if (review.nextLever === 'Продолжить как есть') decision.value = 'continue';
  else if (review.nextLever === 'Пока без решения') decision.value = 'later';
  else if (review.nextLever) decision.value = 'change';
  else decision.value = '';
  decisionText.value = decision.value === 'change' ? review.nextLever : '';
  ifThenPlan.value = review.ifThenPlan;
}

async function saveFirstUse(next: FirstUseState) {
  const settings = plainCopy(store.settings);
  settings.firstUse = { ...next, updatedAt: new Date().toISOString() };
  await store.saveSettings(settings);
}

async function beginRecovery() {
  saveError.value = '';
  saving.value = true;
  try {
    const weekStart = firstUse.value.weekStart || startOfWeek(addDays(todayKey(), -7));
    await saveFirstUse({ status: 'in_progress', weekStart, lastStep: 'results', overviewSeen: false, updatedAt: '' });
  } catch {
    saveError.value = 'Не удалось начать. Попробуйте ещё раз.';
  } finally {
    saving.value = false;
  }
}

async function continueWithToday() {
  saveError.value = '';
  saving.value = true;
  try {
    await saveFirstUse({ status: 'available', weekStart: '', lastStep: 'choice', overviewSeen: false, updatedAt: '' });
  } catch {
    saveError.value = 'Не удалось сохранить выбор. Попробуйте ещё раз.';
  } finally {
    saving.value = false;
  }
}

async function dismiss() {
  saveError.value = '';
  saving.value = true;
  try {
    await saveFirstUse({ status: 'dismissed', weekStart: '', lastStep: 'choice', overviewSeen: false, updatedAt: '' });
  } catch {
    saveError.value = 'Не удалось сохранить выбор. Попробуйте ещё раз.';
  } finally {
    saving.value = false;
  }
}

function applyCurrentAnswer() {
  if (currentStep.value === 'results') review.results = lines(resultsText.value);
  if (currentStep.value === 'highlights') review.highlights = lines(highlightsText.value);
  if (currentStep.value === 'state_context') review.stateContext = stateContext.value.trim();
  if (currentStep.value === 'support_obstacle') {
    review.support = support.value.trim();
    review.obstacle = obstacle.value.trim();
  }
  if (currentStep.value === 'decision') {
    review.nextLever =
      decision.value === 'continue'
        ? 'Продолжить как есть'
        : decision.value === 'later'
          ? 'Пока без решения'
          : decision.value === 'change'
            ? decisionText.value.trim()
            : '';
    review.ifThenPlan = decision.value === 'change' ? ifThenPlan.value.trim() : '';
  }
}

async function moveTo(nextStep: FirstUseStep, saveAnswer: boolean) {
  saveError.value = '';
  saving.value = true;
  try {
    if (saveAnswer) {
      applyCurrentAnswer();
      await store.saveReview(plainCopy(review));
    }
    await saveFirstUse({
      status: 'in_progress',
      weekStart: firstUse.value.weekStart,
      lastStep: nextStep,
      overviewSeen: nextStep === 'overview' || firstUse.value.overviewSeen,
      updatedAt: '',
    });
  } catch {
    saveError.value = 'Не удалось сохранить ответ. Он остался на экране — попробуйте ещё раз.';
  } finally {
    saving.value = false;
  }
}

function nextStep() {
  if (currentStep.value === 'decision') return 'overview';
  const index = currentStepIndex.value;
  return steps[index + 1] ?? 'overview';
}

function previousStep() {
  if (currentStep.value === 'overview') return 'decision';
  const index = currentStepIndex.value;
  return index <= 0 ? 'choice' : steps[index - 1]!;
}

async function completeRecovery() {
  saveError.value = '';
  saving.value = true;
  try {
    await saveFirstUse({
      status: 'completed',
      weekStart: firstUse.value.weekStart,
      lastStep: 'overview',
      overviewSeen: true,
      updatedAt: '',
    });
  } catch {
    saveError.value = 'Не удалось завершить обзор. Ответы уже сохранены — попробуйте ещё раз.';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section v-if="isChoice" class="first-use-card first-use-card--choice" aria-labelledby="first-use-choice-title">
    <div>
      <p class="eyebrow">Первый обзор</p>
      <h2 id="first-use-choice-title">Соберите картину прошлой недели</h2>
      <p>Вспомните несколько итогов, событий и то, как вы себя чувствовали. Это займёт несколько коротких шагов.</p>
      <p class="first-use-card__note">Точные цифры и записи за каждый день не нужны.</p>
    </div>
    <div class="first-use-card__actions">
      <button class="primary-button" type="button" :disabled="saving" @click="beginRecovery">
        {{ firstUse.status === 'in_progress' ? 'Продолжить' : 'Собрать неделю' }}
      </button>
      <button class="secondary-button" type="button" :disabled="saving" @click="continueWithToday">Начать с сегодняшнего дня</button>
    </div>
    <p v-if="saveError" class="first-use-card__error" role="alert">{{ saveError }}</p>
  </section>

  <section v-else-if="showAvailablePrompt" class="first-use-card first-use-card--available" aria-label="Обзор прошлой недели">
    <div>
      <strong>Хотите собрать прошлую неделю?</strong>
      <p>Несколько коротких вопросов помогут увидеть её целиком.</p>
    </div>
    <div class="first-use-card__actions">
      <button class="secondary-button" type="button" :disabled="saving" @click="beginRecovery">Собрать неделю</button>
      <button class="first-use-card__text-button" type="button" @click="hiddenForNow = true">Не сейчас</button>
      <button class="first-use-card__text-button" type="button" :disabled="saving" @click="dismiss">Больше не показывать</button>
    </div>
    <p v-if="saveError" class="first-use-card__error" role="alert">{{ saveError }}</p>
  </section>

  <section v-else-if="isRecovery" class="first-use-card first-use-recovery" aria-labelledby="first-use-step-title">
    <header class="first-use-recovery__header">
      <div>
        <p class="eyebrow">{{ currentStep === 'overview' ? 'Ваш обзор' : `Шаг ${currentStepIndex + 1} из ${steps.length}` }}</p>
        <span>{{ weekLabel }}</span>
      </div>
      <div v-if="currentStep !== 'overview'" class="first-use-recovery__progress" aria-hidden="true">
        <i :style="{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }"></i>
      </div>
    </header>

    <div v-if="currentStep === 'results'" class="first-use-recovery__step">
      <h2 id="first-use-step-title">Что вам удалось закончить или получить?</h2>
      <p>Подойдут и большие результаты, и небольшие сделанные дела.</p>
      <label class="field-label" for="first-use-results">По одному пункту в строке</label>
      <textarea id="first-use-results" v-model="resultsText" rows="5" placeholder="Например: закончил черновик презентации"></textarea>
    </div>

    <div v-else-if="currentStep === 'highlights'" class="first-use-recovery__step">
      <h2 id="first-use-step-title">Что важного произошло?</h2>
      <p>События, решения, мысли или разговоры, которые хочется помнить.</p>
      <label class="field-label" for="first-use-highlights">По одному пункту в строке</label>
      <textarea
        id="first-use-highlights"
        v-model="highlightsText"
        rows="5"
        placeholder="Например: решил не брать ещё одну задачу"
      ></textarea>
    </div>

    <div v-else-if="currentStep === 'state_context'" class="first-use-recovery__step">
      <h2 id="first-use-step-title">Как вы себя чувствовали?</h2>
      <p>Можно коротко написать про силы, настроение и обстоятельства недели.</p>
      <label class="field-label" for="first-use-state">Состояние и важные условия</label>
      <textarea
        id="first-use-state"
        v-model="stateContext"
        rows="5"
        placeholder="Например: в середине недели мало спал и быстро уставал"
      ></textarea>
    </div>

    <div v-else-if="currentStep === 'support_obstacle'" class="first-use-recovery__step">
      <h2 id="first-use-step-title">Что помогало, а что мешало?</h2>
      <p>Оба ответа необязательны.</p>
      <div class="first-use-recovery__paired-fields">
        <label>
          <span class="field-label">Что помогало</span>
          <textarea v-model="support" rows="4" placeholder="Например: прогулки и свободный вечер"></textarea>
        </label>
        <label>
          <span class="field-label">Что мешало</span>
          <textarea v-model="obstacle" rows="4" placeholder="Например: плохой сон"></textarea>
        </label>
      </div>
    </div>

    <div v-else-if="currentStep === 'decision'" class="first-use-recovery__step">
      <h2 id="first-use-step-title">Хотите что-то решить на следующую неделю?</h2>
      <p>Правильного ответа нет. Можно ничего не менять.</p>
      <div class="first-use-recovery__choices" aria-label="Решение на следующую неделю">
        <button type="button" :aria-pressed="decision === 'continue'" @click="decision = 'continue'">Продолжить как есть</button>
        <button type="button" :aria-pressed="decision === 'change'" @click="decision = 'change'">Что-то изменить</button>
        <button type="button" :aria-pressed="decision === 'later'" @click="decision = 'later'">Пока без решения</button>
      </div>
      <template v-if="decision === 'change'">
        <label class="field-label" for="first-use-decision">Что хотите изменить?</label>
        <textarea id="first-use-decision" v-model="decisionText" rows="3" placeholder="Одно небольшое изменение"></textarea>
        <label class="field-label" for="first-use-plan">Необязательный план «если — то»</label>
        <textarea
          id="first-use-plan"
          v-model="ifThenPlan"
          rows="3"
          placeholder="Если снова не будет сил, то перенесу одну необязательную задачу"
        ></textarea>
        <p v-if="!currentAnswerIsValid" class="first-use-recovery__hint">Напишите одно изменение или выберите другой вариант.</p>
      </template>
    </div>

    <div v-else class="first-use-recovery__step first-use-overview">
      <h2 id="first-use-step-title">Вот чем была наполнена ваша неделя</h2>
      <p>Мы собрали ваши ответы вместе. Это не оценка недели, а её факты и важный контекст.</p>

      <div v-if="review.results.some(Boolean)" class="first-use-overview__group">
        <strong>Итоги</strong>
        <ul>
          <li v-for="(item, index) in review.results.filter(Boolean)" :key="`${index}-${item}`">{{ item }}</li>
        </ul>
      </div>
      <div v-if="review.highlights.some(Boolean)" class="first-use-overview__group">
        <strong>Что произошло</strong>
        <ul>
          <li v-for="(item, index) in review.highlights.filter(Boolean)" :key="`${index}-${item}`">{{ item }}</li>
        </ul>
      </div>
      <div v-if="review.stateContext" class="first-use-overview__group">
        <strong>Как вы себя чувствовали</strong>
        <p>{{ review.stateContext }}</p>
      </div>
      <div v-if="review.support" class="first-use-overview__group">
        <strong>Что помогало</strong>
        <p>{{ review.support }}</p>
      </div>
      <div v-if="review.obstacle" class="first-use-overview__group">
        <strong>Что мешало</strong>
        <p>{{ review.obstacle }}</p>
      </div>
      <div v-if="review.nextLever" class="first-use-overview__group">
        <strong>Ваше решение</strong>
        <p>{{ review.nextLever }}</p>
      </div>

      <p v-if="meaningfulAnswerCount < 2" class="first-use-overview__empty">
        Чтобы получилась полезная картина, добавьте ещё хотя бы два факта или важных условия недели.
      </p>
    </div>

    <footer class="first-use-recovery__footer">
      <button class="secondary-button" type="button" :disabled="saving" @click="moveTo(previousStep(), currentStep !== 'overview')">
        {{ currentStep === 'overview' ? 'Исправить ответы' : 'Назад' }}
      </button>
      <div v-if="currentStep !== 'overview'">
        <button class="first-use-card__text-button" type="button" :disabled="saving" @click="moveTo(nextStep(), false)">Пропустить</button>
        <button class="primary-button" type="button" :disabled="saving || !currentAnswerIsValid" @click="moveTo(nextStep(), true)">
          Продолжить
        </button>
      </div>
      <div v-else>
        <button class="first-use-card__text-button" type="button" :disabled="saving" @click="continueWithToday">
          Вернуться к сегодняшнему дню
        </button>
        <button class="primary-button" type="button" :disabled="saving || meaningfulAnswerCount < 2" @click="completeRecovery">
          Готово
        </button>
      </div>
    </footer>
    <p v-if="saveError" class="first-use-card__error" role="alert">{{ saveError }}</p>
  </section>
</template>
