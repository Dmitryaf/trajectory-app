<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const mode = ref<'sign-in' | 'sign-up'>('sign-in');
const email = ref('');
const password = ref('');
const passwordConfirmation = ref('');
const inviteCode = ref('');
const status = ref('');
const confirmationEmail = ref('');

const canSubmit = computed(() => {
  if (email.value.trim().length <= 3 || auth.loading) return false;
  if (mode.value === 'sign-in') return password.value.length >= 6;
  return password.value.length >= 8
    && password.value === passwordConfirmation.value
    && inviteCode.value.trim().length >= 10;
});

function selectMode(nextMode: 'sign-in' | 'sign-up') {
  mode.value = nextMode;
  password.value = '';
  passwordConfirmation.value = '';
  inviteCode.value = '';
  status.value = '';
  confirmationEmail.value = '';
  auth.error = '';
}

async function submit() {
  if (!canSubmit.value) return;
  status.value = '';
  try {
    if (mode.value === 'sign-up') {
      const result = await auth.signUp(email.value.trim(), password.value, inviteCode.value.trim());
      confirmationEmail.value = result.confirmationRequired ? email.value.trim() : '';
      status.value = result.confirmationRequired
        ? 'Аккаунт создан. Проверь почту и подтверди email.'
        : 'Аккаунт создан.';
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
    <article class="auth-card">
      <div class="auth-card__brand">
        <span class="brand__mark"><i></i></span>
        <div>
          <h1>Траектория</h1>
        </div>
      </div>

      <div v-if="auth.signupEnabled" class="auth-mode" aria-label="Выбор действия">
        <button type="button" :class="{ 'is-active': mode === 'sign-in' }" @click="selectMode('sign-in')">Войти</button>
        <button type="button" :class="{ 'is-active': mode === 'sign-up' }" @click="selectMode('sign-up')">Создать аккаунт</button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <label class="form-control">
          <span class="field-label">Email</span>
          <input v-model="email" type="email" autocomplete="email" inputmode="email" required placeholder="you@example.com" />
        </label>
        <label class="form-control">
          <span class="field-label">Пароль</span>
          <input v-model="password" type="password" :autocomplete="mode === 'sign-up' ? 'new-password' : 'current-password'" required :minlength="mode === 'sign-up' ? 8 : 6" placeholder="Пароль" />
        </label>
        <template v-if="mode === 'sign-up'">
          <label class="form-control">
            <span class="field-label">Повтори пароль</span>
            <input v-model="passwordConfirmation" type="password" autocomplete="new-password" required minlength="8" placeholder="Повтори пароль" />
          </label>
          <label class="form-control">
            <span class="field-label">Код приглашения</span>
            <input v-model="inviteCode" type="text" autocomplete="off" required minlength="10" maxlength="80" placeholder="Код приглашения" />
          </label>
        </template>
        <button class="primary-button" type="submit" :disabled="!canSubmit">
          {{ auth.loading ? 'Проверяю...' : mode === 'sign-up' ? 'Создать аккаунт' : 'Войти' }}
        </button>
      </form>
      <button v-if="mode === 'sign-in'" class="auth-reset" type="button" :disabled="auth.loading" @click="requestPasswordReset">Не помню пароль</button>
      <button v-if="confirmationEmail" class="auth-reset" type="button" :disabled="auth.loading" @click="resendConfirmation">Отправить письмо ещё раз</button>
      <p v-if="status || auth.error" class="settings-status">{{ status || auth.error }}</p>
    </article>
  </section>
</template>
