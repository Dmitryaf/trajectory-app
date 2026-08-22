<script setup lang="ts">
import PasswordField from '../../../shared/ui/forms/PasswordField.vue';
import { useAccountSettings } from '../useAccountSettings';

defineProps<{
  passwordRecoveryRequested: boolean;
}>();

const emit = defineEmits<{
  localDataReset: [];
}>();

const { auth, changePassword, deleteAccount, newPassword, newPasswordConfirmation, passwordUpdateStatus, session, signOut, userEmail } =
  useAccountSettings(() => emit('localDataReset'));
</script>

<template>
  <article class="settings-card settings-card--account settings-card--career">
    <div class="form-card__heading">
      <span class="section-icon section-icon--blue">◉</span>
      <div>
        <h2>Аккаунт и безопасность</h2>
        <p>Управляйте входом, паролем и удалением аккаунта отдельно от копий данных.</p>
      </div>
    </div>
    <div v-if="!auth.configured" class="cloud-sync-note">
      <strong>Аккаунт недоступен</strong>
      <p>В этой сборке облачный вход не настроен.</p>
    </div>
    <template v-else-if="session">
      <div class="cloud-session">
        <div>
          <strong>{{ userEmail }}</strong>
        </div>
        <button class="secondary-button cloud-session__logout" type="button" :disabled="auth.loading" @click="signOut">Выйти</button>
      </div>
      <details class="account-security" :open="passwordRecoveryRequested">
        <summary>Изменить пароль</summary>
        <div class="settings-field-stack account-security__form">
          <label class="field-label" for="new-password">Новый пароль</label>
          <PasswordField
            id="new-password"
            v-model="newPassword"
            autocomplete="new-password"
            minlength="8"
            placeholder="Не меньше 8 символов"
          />
          <label class="field-label" for="new-password-confirmation">Повтори пароль</label>
          <PasswordField
            id="new-password-confirmation"
            v-model="newPasswordConfirmation"
            autocomplete="new-password"
            minlength="8"
            placeholder="Повтори пароль"
          />
          <button class="secondary-button" type="button" :disabled="auth.loading || !newPassword" @click="changePassword">
            Сохранить новый пароль
          </button>
          <p v-if="passwordUpdateStatus" class="settings-status" role="status" aria-live="polite">
            {{ passwordUpdateStatus }}
          </p>
        </div>
      </details>
      <div class="danger-zone">
        <div>
          <strong>Удалить аккаунт</strong>
          <p>Аккаунт, облачная копия и данные на этом устройстве будут удалены.</p>
        </div>
        <button class="danger-button" type="button" :disabled="auth.loading" @click="deleteAccount">Удалить аккаунт</button>
      </div>
    </template>
    <div v-else class="cloud-sync-note">
      <strong>Сессия не найдена</strong>
      <p>Обновите страницу и войдите снова, чтобы управлять аккаунтом.</p>
    </div>
  </article>
</template>
