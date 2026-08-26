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

<style scoped>
.account-menu {
  position: relative;
  z-index: 31;
  min-width: 0;
}
.account-menu > summary {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 9px;
  padding: 5px 9px 5px 5px;
  border: 1px solid #d5e2dc;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 6px 18px rgba(16, 45, 44, 0.06);
  cursor: pointer;
  list-style: none;
  transition:
    border-color var(--motion-fast),
    background-color var(--motion-fast);
}
.account-menu > summary::-webkit-details-marker {
  display: none;
}
.account-menu > summary:hover,
.account-menu[open] > summary {
  border-color: #bcd8cc;
  background: var(--surface);
}
.account-menu__avatar {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 10px;
  background: #dff5ec;
  color: #145e49;
  font-size: 12px;
  font-weight: 850;
}
.account-menu__email {
  max-width: 180px;
  overflow: hidden;
  color: #52635e;
  font-size: 12px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-menu__chevron {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: #83908b;
  transition: transform var(--motion-fast);
}
.account-menu[open] .account-menu__chevron {
  transform: rotate(180deg);
}
.account-menu__panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  display: grid;
  width: 220px;
  gap: 4px;
  padding: 7px;
  border: 1px solid #d5e2dc;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18px 44px rgba(16, 45, 44, 0.16);
}
.account-menu__action {
  display: flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: #315b4e;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  text-decoration: none;
}
.account-menu__action:hover,
.account-menu__action.router-link-active {
  background: #eaf7f1;
  color: #145e49;
}
.account-menu__action span {
  width: 18px;
  text-align: center;
}
.account-menu__action strong {
  font-weight: 800;
}
.account-menu__logout {
  color: #65716d;
}
.account-menu__logout:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .account-menu__email {
    display: none;
  }
  .account-menu > summary {
    min-height: 38px;
    padding: 3px 7px 3px 3px;
  }
  .account-menu__avatar {
    width: 30px;
    height: 30px;
  }
}

@media (min-width: 980px) {
  .account-menu__email {
    max-width: 145px;
  }
}

@media (min-width: 980px) and (max-width: 1150px) {
  .account-menu__email {
    display: none;
  }
}
</style>
