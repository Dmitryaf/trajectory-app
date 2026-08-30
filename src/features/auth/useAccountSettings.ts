import { computed, ref, watch } from 'vue';
import { notifyError, notifyInfo, notifySaved, notifyUnknownError } from '@/services/notifications';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';

export function useAccountSettings(afterLocalDataReset: () => void) {
  const auth = useAuthStore();
  const store = useAppStore();
  const newPassword = ref('');
  const newPasswordConfirmation = ref('');
  const passwordUpdateStatus = ref('');
  const session = computed(() => auth.session);
  const userEmail = computed(() => auth.userEmail);

  watch([newPassword, newPasswordConfirmation], ([password, confirmation]) => {
    if (password || confirmation) {
      passwordUpdateStatus.value = '';
    }
  });
  watch(
    () => auth.session?.user.id,
    () => {
      passwordUpdateStatus.value = '';
    },
  );

  async function signOut() {
    passwordUpdateStatus.value = '';
    try {
      await auth.signOut();
      notifyInfo('Выход выполнен');
    } catch (error) {
      notifyUnknownError(error, 'Не удалось выйти из аккаунта');
    }
  }

  async function changePassword() {
    passwordUpdateStatus.value = '';
    if (newPassword.value.length < 8) {
      notifyError('Пароль должен содержать не меньше 8 символов');
      return;
    }
    if (newPassword.value !== newPasswordConfirmation.value) {
      notifyError('Пароли не совпадают');
      return;
    }
    try {
      await auth.updatePassword(newPassword.value);
      newPassword.value = '';
      newPasswordConfirmation.value = '';
      passwordUpdateStatus.value = 'Пароль обновлён';
      notifySaved('Пароль изменён');
    } catch {
      notifyError(auth.error || 'Не удалось изменить пароль');
    }
  }

  async function deleteAccount() {
    const email = userEmail.value;
    if (!email) {
      return;
    }
    if (
      !window.confirm(
        'Аккаунт и его облачная копия будут удалены без возможности восстановления. Перед этим лучше скачать резервную копию.',
      )
    ) {
      return;
    }
    const confirmation = window.prompt(`Для подтверждения введи email аккаунта: ${email}`)?.trim().toLowerCase();
    if (confirmation !== email.toLowerCase()) {
      notifyError('Email не совпал. Аккаунт не удалён.');
      return;
    }

    try {
      await auth.deleteAccount();
    } catch {
      notifyError(auth.error || 'Не удалось удалить аккаунт');
      return;
    }

    try {
      await store.clearAll({ syncCloud: false });
      afterLocalDataReset();
      notifyInfo(auth.error || 'Аккаунт и его данные удалены');
    } catch {
      store.unload();
      afterLocalDataReset();
      notifyError(
        'Аккаунт и облачная копия удалены, но данные на этом устройстве очистить не удалось. Очистите данные сайта в настройках браузера.',
      );
    }
  }

  return {
    auth,
    changePassword,
    deleteAccount,
    newPassword,
    newPasswordConfirmation,
    passwordUpdateStatus,
    session,
    signOut,
    userEmail,
  };
}
