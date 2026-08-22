<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import PasswordField from '../shared/ui/forms/PasswordField.vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const password = ref('');
const passwordConfirmation = ref('');
const status = ref('');

const submitIssue = computed(() => {
  if (password.value.length < 8) {
    return 'Пароль должен содержать не меньше 8 символов.';
  }
  if (password.value !== passwordConfirmation.value) {
    return 'Пароли не совпадают.';
  }
  return '';
});

async function savePassword() {
  status.value = submitIssue.value;
  if (status.value) {
    return;
  }

  try {
    await auth.completePasswordRecovery(password.value);
    await router.replace('/');
  } catch {
    status.value = auth.error || 'Не удалось изменить пароль.';
  }
}

async function returnToSignIn() {
  await auth.cancelPasswordRecovery();
  await router.replace('/');
}
</script>

<template>
  <main class="password-reset-shell">
    <article class="password-reset-card">
      <div class="auth-card__brand">
        <span class="brand__mark"><i></i></span>
        <div><strong>Траектория</strong></div>
      </div>

      <template v-if="auth.session">
        <p class="eyebrow">Восстановление доступа</p>
        <h1>Создай новый пароль</h1>
        <p class="password-reset-card__intro">После сохранения войди в аккаунт с новым паролем.</p>

        <form class="auth-form" @submit.prevent="savePassword">
          <div class="form-control">
            <label class="field-label" for="reset-password">Новый пароль</label>
            <PasswordField
              id="reset-password"
              v-model="password"
              autocomplete="new-password"
              required
              minlength="8"
              aria-describedby="reset-password-hint"
              placeholder="Не меньше 8 символов"
            />
            <small id="reset-password-hint" class="auth-field-hint">Не меньше 8 символов.</small>
          </div>
          <div class="form-control">
            <label class="field-label" for="reset-password-confirmation">Повтори пароль</label>
            <PasswordField
              id="reset-password-confirmation"
              v-model="passwordConfirmation"
              autocomplete="new-password"
              required
              minlength="8"
              placeholder="Повтори новый пароль"
            />
          </div>
          <button class="primary-button" type="submit" :disabled="auth.loading">
            {{ auth.loading ? 'Сохраняю...' : 'Сохранить новый пароль' }}
          </button>
        </form>
        <p v-if="status || auth.error" class="settings-status" aria-live="polite">{{ status || auth.error }}</p>
      </template>

      <template v-else>
        <p class="eyebrow">Восстановление доступа</p>
        <h1>Ссылка больше не действует</h1>
        <p class="password-reset-card__intro">Вернись ко входу и запроси новое письмо для восстановления.</p>
        <button class="primary-button" type="button" :disabled="auth.loading" @click="returnToSignIn">Вернуться ко входу</button>
      </template>
    </article>
  </main>
</template>
