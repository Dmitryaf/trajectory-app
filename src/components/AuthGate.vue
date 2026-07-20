<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const email = ref('');
const password = ref('');
const status = ref('');

const canSubmit = computed(() => email.value.trim().length > 3 && password.value.length >= 6 && !auth.loading);

async function submit() {
  if (!canSubmit.value) return;
  status.value = '';
  try {
    await auth.signIn(email.value.trim(), password.value);
    password.value = '';
    status.value = 'Вход выполнен.';
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

      <form class="auth-form" @submit.prevent="submit">
        <label class="form-control">
          <span class="field-label">Email</span>
          <input v-model="email" type="email" autocomplete="email" inputmode="email" required placeholder="you@example.com" />
        </label>
        <label class="form-control">
          <span class="field-label">Пароль</span>
          <input v-model="password" type="password" autocomplete="current-password" required minlength="6" placeholder="Пароль" />
        </label>
        <button class="primary-button" type="submit" :disabled="!canSubmit">{{ auth.loading ? 'Проверяю...' : 'Войти' }}</button>
      </form>

      <p v-if="status || auth.error" class="settings-status">{{ status || auth.error }}</p>
      <p class="auth-footnote">Новые аккаунты через приложение не создаются. Данные в Supabase защищены правилами доступа, а локальные записи загружаются только после входа.</p>
    </article>
  </section>
</template>
