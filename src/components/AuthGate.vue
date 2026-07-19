<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const mode = ref<'sign-in' | 'sign-up'>('sign-in');
const email = ref('');
const password = ref('');
const status = ref('');

const isSignUp = computed(() => mode.value === 'sign-up');
const canSubmit = computed(() => email.value.trim().length > 3 && password.value.length >= 6 && !auth.loading);

async function submit() {
  if (!canSubmit.value) return;
  status.value = '';
  try {
    if (isSignUp.value) {
      await auth.signUp(email.value.trim(), password.value);
      password.value = '';
      status.value = auth.session ? 'Аккаунт создан. Вход выполнен.' : 'Аккаунт создан. Если включено подтверждение, проверь почту.';
    } else {
      await auth.signIn(email.value.trim(), password.value);
      password.value = '';
      status.value = 'Вход выполнен.';
    }
  } catch {
    password.value = '';
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
          <p class="eyebrow">Личное пространство</p>
          <h1>Траектория</h1>
          <p>Войди, чтобы открыть записи, обзоры и облачную копию. Доступ к данным в базе ограничен твоим аккаунтом.</p>
        </div>
      </div>

      <div class="auth-tabs" role="tablist" aria-label="Режим входа">
        <button type="button" :class="{ active: !isSignUp }" @click="mode = 'sign-in'">Вход</button>
        <button type="button" :class="{ active: isSignUp }" @click="mode = 'sign-up'">Регистрация</button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <label class="form-control">
          <span class="field-label">Email</span>
          <input v-model="email" type="email" autocomplete="email" inputmode="email" required placeholder="you@example.com" />
        </label>
        <label class="form-control">
          <span class="field-label">Пароль</span>
          <input v-model="password" type="password" :autocomplete="isSignUp ? 'new-password' : 'current-password'" required minlength="6" placeholder="Минимум 6 символов" />
        </label>
        <button class="primary-button" type="submit" :disabled="!canSubmit">{{ auth.loading ? 'Проверяю...' : isSignUp ? 'Создать аккаунт' : 'Войти' }}</button>
      </form>

      <p v-if="status || auth.error" class="settings-status">{{ status || auth.error }}</p>
      <p class="auth-footnote">Публичный адрес открывает только экран входа. Данные в Supabase защищаются RLS-правилами, а локальные записи загружаются после входа.</p>
    </article>
  </section>
</template>
