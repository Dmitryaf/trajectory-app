<script setup lang="ts">
import ActionButton from '@/shared/ui/actions/ActionButton.vue';
import { computed, nextTick, ref } from 'vue';
import PasswordField from '@/shared/ui/forms/PasswordField.vue';
import UiIcon from '@/shared/ui/icons/UiIcon.vue';
import FormFieldLabel from '@/shared/ui/forms/FormFieldLabel.vue';
import PwaInstallGuide from '@/features/pwa/ui/PwaInstallGuide.vue';
import { useAuthStore } from '@/stores/auth';
import BrandMark from '@/shared/ui/branding/BrandMark.vue';
import EyebrowText from '@/shared/ui/typography/EyebrowText.vue';

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
      { label: 'История', text: 'Покажет события, решения и итоги без оценки «хорошо» или «плохо».' },
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
const statusIsError = ref(false);
const activePreview = computed(() => previewLevels.find((level) => level.id === activePreviewId.value) ?? previewLevels[0]!);
const submitLabel = computed(() => {
  if (auth.operation === 'signing-up') {
    return 'Создаём аккаунт…';
  }
  if (auth.operation === 'signing-in') {
    return 'Входим…';
  }
  return mode.value === 'sign-up' ? 'Создать аккаунт' : 'Войти';
});

const canSubmit = computed(() => {
  if (email.value.trim().length <= 3 || auth.loading) {
    return false;
  }
  if (mode.value === 'sign-in') {
    return password.value.length >= 6;
  }
  return password.value.length >= 8 && password.value === passwordConfirmation.value && inviteCode.value.trim().length >= 10;
});

const submitIssue = computed(() => {
  if (email.value.trim().length <= 3) {
    return 'Укажи email.';
  }
  const minimumLength = mode.value === 'sign-up' ? 8 : 6;
  if (password.value.length < minimumLength) {
    return `Пароль должен содержать не меньше ${minimumLength} символов.`;
  }
  if (mode.value === 'sign-up' && password.value !== passwordConfirmation.value) {
    return 'Пароли не совпадают.';
  }
  if (mode.value === 'sign-up' && inviteCode.value.trim().length < 10) {
    return 'Укажи код приглашения.';
  }
  return '';
});

function selectMode(nextMode: 'sign-in' | 'sign-up') {
  mode.value = nextMode;
  password.value = '';
  passwordConfirmation.value = '';
  inviteCode.value = '';
  status.value = '';
  statusIsError.value = false;
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
    statusIsError.value = true;
    return;
  }
  status.value = '';
  statusIsError.value = false;
  try {
    if (mode.value === 'sign-up') {
      const result = await auth.signUp(email.value.trim(), password.value, inviteCode.value.trim());
      confirmationEmail.value = result.confirmationRequired ? email.value.trim() : '';
      status.value = result.confirmationRequired ? '' : 'Аккаунт создан.';
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
    statusIsError.value = true;
  }
}

async function resendConfirmation() {
  if (!confirmationEmail.value || auth.loading) {
    return;
  }
  status.value = '';
  statusIsError.value = false;
  try {
    await auth.resendSignupConfirmation(confirmationEmail.value);
    status.value = 'Письмо отправлено повторно. Проверь входящие и папку «Спам».';
  } catch {
    status.value = auth.error || 'Действие не выполнено.';
    statusIsError.value = true;
  }
}

async function editConfirmationEmail() {
  confirmationEmail.value = '';
  status.value = '';
  statusIsError.value = false;
  await nextTick();
  emailInput.value?.focus();
}

async function continueToSignIn() {
  selectMode('sign-in');
  await nextTick();
  emailInput.value?.focus();
}

async function requestPasswordReset() {
  if (email.value.trim().length <= 3 || auth.loading) {
    status.value = 'Сначала укажи email.';
    statusIsError.value = true;
    return;
  }
  status.value = '';
  statusIsError.value = false;
  try {
    await auth.requestPasswordReset(email.value.trim());
    status.value = 'Если аккаунт существует, письмо для восстановления отправлено.';
  } catch {
    status.value = auth.error || 'Действие не выполнено.';
    statusIsError.value = true;
  }
}
</script>

<template>
  <section class="auth-shell">
    <div class="auth-layout">
      <article class="auth-presentation" aria-labelledby="auth-presentation-title">
        <div class="auth-presentation__intro">
          <EyebrowText tag="p">Личная картина времени</EyebrowText>
          <h1 id="auth-presentation-title">Увидьте, чем были наполнены ваши дни, недели и месяцы</h1>
          <p>
            Записывайте, что сделали, что произошло и как себя чувствовали. В обзоре недели эти записи окажутся рядом — будет проще
            вспомнить важные события, результаты и условия.
          </p>
          <p class="auth-presentation__choice">Приложение не оценивает ваши дни. Менять что-то или нет — решаете вы.</p>

          <div class="auth-presentation__actions">
            <ActionButton v-if="auth.signupEnabled" variant="primary" type="button" @click="openAuthForm('sign-up')"
              >Создать аккаунт</ActionButton
            >
            <ActionButton variant="secondary" type="button" @click="openAuthForm('sign-in')">Войти</ActionButton>
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
            <EyebrowText tag="p">{{ activePreview.tab }}</EyebrowText>
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
          <BrandMark />
          <div>
            <EyebrowText tag="p">{{ mode === 'sign-up' ? 'Новый аккаунт' : 'С возвращением' }}</EyebrowText>
            <h2>{{ mode === 'sign-up' ? 'Создайте аккаунт' : 'Войдите в «Траекторию»' }}</h2>
          </div>
        </div>

        <div v-if="auth.signupEnabled && !confirmationEmail" class="auth-mode" aria-label="Выбор действия">
          <button type="button" :class="{ 'is-active': mode === 'sign-in' }" @click="selectMode('sign-in')">Войти</button>
          <button type="button" :class="{ 'is-active': mode === 'sign-up' }" @click="selectMode('sign-up')">Создать аккаунт</button>
        </div>

        <section v-if="confirmationEmail" class="auth-confirmation" aria-labelledby="auth-confirmation-title" aria-live="polite">
          <div class="auth-confirmation__mark"><UiIcon name="result" /></div>
          <h3 id="auth-confirmation-title">Аккаунт создан</h3>
          <p>
            Мы отправили письмо на <strong>{{ confirmationEmail }}</strong
            >.
          </p>
          <ol>
            <li>Открой письмо от «Траектории».</li>
            <li>Подтверди email по ссылке.</li>
            <li>Вернись сюда и войди в аккаунт.</li>
          </ol>
          <p class="auth-confirmation__note">Если письма нет, проверь папку «Спам» или отправь его ещё раз.</p>
          <div class="auth-confirmation__actions">
            <ActionButton variant="primary" type="button" :disabled="auth.loading" @click="continueToSignIn">Перейти ко входу</ActionButton>
            <ActionButton variant="secondary" type="button" :disabled="auth.loading" @click="resendConfirmation">
              {{ auth.operation === 'resending-confirmation' ? 'Отправляем письмо…' : 'Отправить письмо ещё раз' }}
            </ActionButton>
            <button class="auth-reset" type="button" :disabled="auth.loading" @click="editConfirmationEmail">Изменить email</button>
          </div>
        </section>

        <form v-else class="auth-form" :aria-busy="auth.loading" @submit.prevent="submit">
          <p v-if="mode === 'sign-up'" id="signup-account-hint" class="auth-form__intro">
            Будет создан аккаунт для облачной синхронизации записей. После регистрации нужно подтвердить email по ссылке из письма.
          </p>
          <label class="form-control">
            <FormFieldLabel tag="span">Email</FormFieldLabel>
            <input
              ref="emailInput"
              v-model="email"
              type="email"
              autocomplete="email"
              inputmode="email"
              required
              placeholder="you@example.com"
              :aria-describedby="mode === 'sign-up' ? 'signup-account-hint' : undefined"
            />
          </label>
          <div class="form-control">
            <FormFieldLabel for="auth-password">Пароль</FormFieldLabel>
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
              <FormFieldLabel for="auth-password-confirmation">Повтори пароль</FormFieldLabel>
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
              <FormFieldLabel tag="span">Код приглашения</FormFieldLabel>
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
          <ActionButton variant="primary" type="submit" :disabled="auth.loading">
            <span v-if="auth.loading" class="auth-button-spinner" aria-hidden="true"></span>
            {{ submitLabel }}
          </ActionButton>
        </form>
        <button
          v-if="mode === 'sign-in' && !confirmationEmail"
          class="auth-reset"
          type="button"
          :disabled="auth.loading"
          @click="requestPasswordReset"
        >
          {{ auth.operation === 'requesting-password-reset' ? 'Отправляем письмо…' : 'Не помню пароль' }}
        </button>
        <p
          v-if="status || auth.error || auth.notice"
          class="settings-status"
          :class="{ 'settings-status--error': statusIsError }"
          :role="statusIsError ? 'alert' : 'status'"
          :aria-live="statusIsError ? 'assertive' : 'polite'"
        >
          {{ status || auth.error || auth.notice }}
        </p>
        <PwaInstallGuide />
      </article>
    </div>
  </section>
</template>

<style scoped src="./AuthGate.css"></style>
