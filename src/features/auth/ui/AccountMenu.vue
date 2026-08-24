<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { pwaPlatform } from '@/features/pwa/installation';

const props = defineProps<{
  email: string;
  loading?: boolean;
}>();
const emit = defineEmits<{
  signOut: [];
}>();
const menu = ref<HTMLDetailsElement>();
const initial = computed(() => props.email.trim().slice(0, 1).toLocaleUpperCase('ru-RU') || 'Я');

function close() {
  menu.value?.removeAttribute('open');
}

function signOut() {
  close();
  emit('signOut');
}
</script>

<template>
  <details ref="menu" class="account-menu">
    <summary aria-label="Открыть меню аккаунта">
      <span class="account-menu__avatar" aria-hidden="true">{{ initial }}</span>
      <span class="account-menu__email" :title="email">{{ email }}</span>
      <svg class="account-menu__chevron" aria-hidden="true" viewBox="0 0 16 16" fill="none">
        <path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </summary>
    <div class="account-menu__panel">
      <RouterLink to="/settings" class="account-menu__action" @click="close">
        <span aria-hidden="true">⚙</span><strong>Настройки</strong>
      </RouterLink>
      <RouterLink v-if="pwaPlatform !== 'other'" to="/settings#install-settings" class="account-menu__action" @click="close">
        <span aria-hidden="true">⌂</span><strong>Установить приложение</strong>
      </RouterLink>
      <button class="account-menu__action account-menu__logout" type="button" :disabled="loading" @click="signOut">
        <span aria-hidden="true">↪</span><strong>Выйти</strong>
      </button>
    </div>
  </details>
</template>
