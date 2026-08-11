<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { recordFirstUseEvent } from '../features/first-use/funnel';
import { useAuthStore } from '../stores/auth';
import PasswordField from './PasswordField.vue';

type PreviewLevelId = 'today' | 'journal' | 'week' | 'month';

type PreviewLevel = {
  id: PreviewLevelId;
  tab: string;
  title: string;
  description: string;
  items: Array<{ label: string; text: string }>;
  note?: string;
};

const previewLevels: PreviewLevel[] = [
  {
    id: 'today',
    tab: 'Сегодня',
    title: 'Короткие записи за несколько дней',
    description: 'Достаточно записать главное. Заполнять всё каждый день не нужно.',
    items: [
      { label: 'Понедельник', text: 'Закончил черновик презентации. К вечеру устал.' },
      { label: 'Среда', text: 'Перенёс встречу: плохо спал и не хватало сил.' },
      { label: 'Пятница', text: 'Отправил презентацию. После работы прошёлся.' },
    ],
  },
  {
    id: 'journal',
    tab: 'Журнал',
    title: 'То, что важно сохранить отдельно',
    description: 'Итоги и события не потеряются среди ежедневных записей.',
    items: [
      { label: 'Итог', text: 'Отправил презентацию клиенту.' },
      { label: 'Событие', text: 'Решил не брать новую задачу на этой неделе.' },
    ],
  },
  {
    id: 'week',
    tab: 'Неделя',
    title: 'Неделя видна целиком',
    description: 'То, что вы сделали, что случилось и как вы себя чувствовали, видно рядом — без оценки за вас.',
    items: [
      { label: 'Итоги', text: 'Закончил и отправил презентацию.' },
      { label: 'Что происходило', text: 'Два дня было мало сил. Важную встречу перенёс.' },
      { label: 'Помогало', text: 'Прогулки и свободный вечер.' },
      { label: 'Мешало', text: 'Плохой сон в середине недели.' },
      { label: 'Решение', text: 'Пока ничего не менять.' },
    ],
  },
  {
    id: 'month',
    tab: 'Месяц',
    title: 'Сравнение появится со временем',
    description: 'Когда наберётся несколько недель, их можно будет сравнить.',
    items: [
      { label: 'Месяц', text: 'Покажет итоги и важные события рядом.' },
      { label: 'Тренды', text: 'Помогут заметить изменения без оценки «хорошо» или «плохо».' },
    ],
    note: 'Для честного сравнения нужны записи за несколько периодов.',
  },
];

const auth = useAuthStore();
const mode = ref<'sign-in' | 'sign-up'>('sign-in');
const activePreviewId = ref<PreviewLevelId>('today');
const email = ref('');
const emailInput = ref<HTMLInputElement | null>(null);
const password = ref('');
const passwordConfirmation = ref('');
const inviteCode = ref('');
const status = ref('');
const confirmationEmail = ref('');
const activePreview = computed(() => previewLevels.find((level) => level.id === activePreviewId.value) ?? previewLevels[0]!);

onMounted(() => recordFirstUseEvent('first_use_presentation_viewed'));

const canSubmit = computed(() => {
  if (email.value.trim().length <= 3 || auth.loading) return false;
  if (mode.value === 'sign-in') return password.value.length >= 6;
  return password.value.length >= 8 && password.value === passwordConfirmation.value && inviteCode.value.trim().length >= 10;
});

const submitIssue = computed(() => {
  if (email.value.trim().length <= 3) return 'Укажи email.';
  const minimumLength = mode.value === 'sign-up' ? 8 : 6;
  if (password.value.length < minimumLength) return `Пароль должен содержать не меньше ${minimumLength} символов.`;
  if (mode.value === 'sign-up' && password.value !== passwordConfirmation.value) return 'Пароли не совпадают.';
  if (mode.value === 'sign-up' && inviteCode.value.trim().length < 10) return 'Укажи код приглашения.';
  return '';
});

function selectMode(nextMode: 'sign-in' | 'sign-up') {
  mode.value = nextMode;
  password.value = '';
  passwordConfirmation.value = '';
  inviteCode.value = '';
  status.value = '';
  confirmationEmail.value = '';
  auth.error = '';
  auth.notice = '';
}

async function openAuthForm(nextMode: 'sign-in' | 'sign-up') {
  selectMode(nextMode);
  await nextTick();
  emailInput.value?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  emailInput.value?.focus({ preventScroll: true });
}

async function submit() {
  if (!canSubmit.value) {
    status.value = submitIssue.value;
    return;
  }
  status.value = '';
  try {
    if (mode.value === 'sign-up') {
      const result = await auth.signUp(email.value.trim(), password.value, inviteCode.value.trim());
      recordFirstUseEvent('first_use_signup_completed');
      confirmationEmail.value = result.confirmationRequired ? email.value.trim() : '';
      status.value = result.confirmationRequired ? 'Аккаунт создан. Проверь почту и подтверди email.' : 'Аккаунт создан.';
    } else {
      await auth.signIn(email.value.trim(), password.value);
      status.value = 'Вход выполнен.';
    }
    password.value = '';
    passwordConfirmation.value = '';
    inviteCode.value = '';
  } catch {
    password.value = '';
    passwordConfirmation.value = '';
    status.value = auth.error || 'Действие не выполнено.';
  }
}

async function resendConfirmation() {
  if (!confirmationEmail.value || auth.loading) return;
  status.value = '';
  try {
    await auth.resendSignupConfirmation(confirmationEmail.value);
    status.value = 'Письмо отправлено повторно. Проверь входящие и папку «Спам».';
  } catch {
    status.value = auth.error || 'Действие не выполнено.';
  }
}

async function requestPasswordReset() {
  if (email.value.trim().length <= 3 || auth.loading) {
    status.value = 'Сначала укажи email.';
    return;
  }
  status.value = '';
  try {
    await auth.requestPasswordReset(email.value.trim());
    status.value = 'Если аккаунт существует, письмо для восстановления отправлено.';
  } catch {
    status.value = auth.error || 'Действие не выполнено.';
  }
}
</script>

<template>
  <section class="auth-shell">
    <div class="auth-layout">
      <article class="auth-presentation" aria-labelledby="auth-presentation-title">
        <div class="auth-presentation__intro">
          <p class="eyebrow">Личная картина времени</p>
          <h1 id="auth-presentation-title">Увидьте, чем были наполнены ваши дни, недели и месяцы</h1>
          <p>
            Записывайте, что сделали, что случилось и как себя чувствовали. «Траектория» соберёт всё по времени. Так общее ощущение не
            сотрёт то, что было на самом деле.
          </p>
          <p class="auth-presentation__choice">Приложение не оценивает ваши дни. Менять что-то или нет — решаете вы.</p>

          <div class="auth-presentation__actions">
            <button v-if="auth.signupEnabled" class="primary-button" type="button" @click="openAuthForm('sign-up')">Создать аккаунт</button>
            <button class="secondary-button" type="button" @click="openAuthForm('sign-in')">Войти</button>
          </div>
        </div>

        <section class="auth-preview" aria-labelledby="auth-preview-title">
          <div class="auth-preview__heading">
            <div>
              <span>Пример</span>
              <h2 id="auth-preview-title">Как одна неделя складывается в общую картину</h2>
            </div>
          </div>

          <div class="auth-preview__tabs" aria-label="Уровни примера">
            <button
              v-for="level in previewLevels"
              :key="level.id"
              type="button"
              :class="{ 'is-active': activePreviewId === level.id }"
              :aria-pressed="activePreviewId === level.id"
              @click="activePreviewId = level.id"
            >
              {{ level.tab }}
            </button>
          </div>

          <div class="auth-preview__content" aria-live="polite">
            <p class="eyebrow">{{ activePreview.tab }}</p>
            <h3>{{ activePreview.title }}</h3>
            <p>{{ activePreview.description }}</p>
            <ul>
              <li v-for="item in activePreview.items" :key="`${activePreview.id}-${item.label}`">
                <strong>{{ item.label }}</strong>
                <span>{{ item.text }}</span>
              </li>
            </ul>
            <small v-if="activePreview.note">{{ activePreview.note }}</small>
          </div>
        </section>
      </article>

      <article class="auth-card">
        <div class="auth-card__brand">
          <span class="brand__mark"><i></i></span>
          <div>
            <p class="eyebrow">{{ mode === 'sign-up' ? 'Новый аккаунт' : 'С возвращением' }}</p>
            <h2>{{ mode === 'sign-up' ? 'Создайте аккаунт' : 'Войдите в «Траекторию»' }}</h2>
          </div>
        </div>

        <div v-if="auth.signupEnabled" class="auth-mode" aria-label="Выбор действия">
          <button type="button" :class="{ 'is-active': mode === 'sign-in' }" @click="selectMode('sign-in')">Войти</button>
          <button type="button" :class="{ 'is-active': mode === 'sign-up' }" @click="selectMode('sign-up')">Создать аккаунт</button>
        </div>

        <form class="auth-form" @submit.prevent="submit">
          <label class="form-control">
            <span class="field-label">Email</span>
            <input
              ref="emailInput"
              v-model="email"
              type="email"
              autocomplete="email"
              inputmode="email"
              required
              placeholder="you@example.com"
            />
          </label>
          <div class="form-control">
            <label class="field-label" for="auth-password">Пароль</label>
            <PasswordField
              id="auth-password"
              v-model="password"
              :autocomplete="mode === 'sign-up' ? 'new-password' : 'current-password'"
              required
              :minlength="mode === 'sign-up' ? 8 : 6"
              :aria-describedby="mode === 'sign-up' ? 'signup-password-hint' : undefined"
              :placeholder="mode === 'sign-up' ? 'Не меньше 8 символов' : 'Пароль'"
            />
            <small v-if="mode === 'sign-up'" id="signup-password-hint" class="auth-field-hint">Не меньше 8 символов.</small>
          </div>
          <template v-if="mode === 'sign-up'">
            <div class="form-control">
              <label class="field-label" for="auth-password-confirmation">Повтори пароль</label>
              <PasswordField
                id="auth-password-confirmation"
                v-model="passwordConfirmation"
                autocomplete="new-password"
                required
                minlength="8"
                placeholder="Повтори пароль"
              />
            </div>
            <label class="form-control">
              <span class="field-label">Код приглашения</span>
              <input
                v-model="inviteCode"
                type="text"
                autocomplete="off"
                required
                minlength="10"
                maxlength="80"
                placeholder="Код приглашения"
              />
            </label>
          </template>
          <button class="primary-button" type="submit" :disabled="auth.loading">
            {{ auth.loading ? 'Проверяю...' : mode === 'sign-up' ? 'Создать аккаунт' : 'Войти' }}
          </button>
        </form>
        <button v-if="mode === 'sign-in'" class="auth-reset" type="button" :disabled="auth.loading" @click="requestPasswordReset">
          Не помню пароль
        </button>
        <button v-if="confirmationEmail" class="auth-reset" type="button" :disabled="auth.loading" @click="resendConfirmation">
          Отправить письмо ещё раз
        </button>
        <p v-if="status || auth.error || auth.notice" class="settings-status" aria-live="polite">
          {{ status || auth.error || auth.notice }}
        </p>
      </article>
    </div>
  </section>
</template>
