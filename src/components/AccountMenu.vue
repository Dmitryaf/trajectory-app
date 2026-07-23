<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';

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
      <span class="account-menu__chevron" aria-hidden="true">⌄</span>
    </summary>
    <div class="account-menu__panel">
      <RouterLink to="/settings" class="account-menu__action" @click="close">
        <span aria-hidden="true">⚙</span><strong>Настройки</strong>
      </RouterLink>
      <button class="account-menu__action account-menu__logout" type="button" :disabled="loading" @click="signOut">
        <span aria-hidden="true">↪</span><strong>Выйти</strong>
      </button>
    </div>
  </details>
</template>
