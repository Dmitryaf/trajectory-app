import { defineStore } from 'pinia';
import type { Session } from '@supabase/supabase-js';
import {
  clearCloudSyncMeta,
  clearLocalCloudSession,
  deleteCloudAccount,
  getVerifiedCloudSession,
  isBetaSignupConfigured,
  isCloudAuthRequired,
  isCloudSyncConfigured,
  onCloudAuthChange,
  resendCloudSignupConfirmation,
  requestCloudPasswordReset,
  signInToCloud,
  signOutFromCloud,
  signUpToCloud,
  updateCloudPassword,
} from '../services/cloudSync';

let unsubscribeAuth: (() => void) | null = null;
const passwordRecoveryKey = 'trajectory:password-recovery-required';

function hasPasswordRecoveryRedirect() {
  const url = new URL(window.location.href);
  return url.pathname === '/password-reset'
    || url.searchParams.get('password-recovery') === '1'
    || window.sessionStorage.getItem(passwordRecoveryKey) === '1';
}

function persistPasswordRecovery(required: boolean) {
  if (required) window.sessionStorage.setItem(passwordRecoveryKey, '1');
  else window.sessionStorage.removeItem(passwordRecoveryKey);
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    configured: isCloudSyncConfigured(),
    authRequired: isCloudAuthRequired(),
    signupEnabled: isBetaSignupConfigured(),
    initialized: false,
    loading: false,
    session: null as Session | null,
    recoveryRequired: false,
    error: '',
    notice: ''
  }),
  getters: {
    requiresAuth: (state) => state.configured || state.authRequired,
    configurationMissing: (state) => state.authRequired && !state.configured,
    isAuthenticated: (state) => state.configured
      ? Boolean(state.session && !state.recoveryRequired)
      : !state.authRequired,
    userEmail: (state) => state.session?.user.email ?? ''
  },
  actions: {
    async init() {
      if (this.initialized || this.loading) return;
      this.loading = true;
      this.error = '';
      try {
        if (!this.configured) {
          this.initialized = true;
          return;
        }

        this.recoveryRequired = hasPasswordRecoveryRedirect();
        persistPasswordRecovery(this.recoveryRequired);
        unsubscribeAuth?.();
        const listener = onCloudAuthChange((event, session) => {
          this.session = session;
          if (event === 'PASSWORD_RECOVERY') {
            this.recoveryRequired = true;
            persistPasswordRecovery(true);
          }
        });
        unsubscribeAuth = () => listener.data.subscription.unsubscribe();
        this.session = await getVerifiedCloudSession();
        this.initialized = true;
      } catch (error) {
        this.session = null;
        this.error = error instanceof Error ? error.message : 'Не удалось проверить вход';
        this.initialized = true;
      } finally {
        this.loading = false;
      }
    },
    async signIn(email: string, password: string) {
      this.loading = true;
      this.error = '';
      this.notice = '';
      try {
        this.session = await signInToCloud(email, password);
      } catch (error) {
        this.error = 'Не удалось войти. Проверь email и пароль.';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async signUp(email: string, password: string, inviteCode: string) {
      this.loading = true;
      this.error = '';
      try {
        const result = await signUpToCloud(email, password, inviteCode);
        this.session = result.session;
        return result;
      } catch (error) {
        this.error = 'Не удалось создать аккаунт. Проверь код приглашения и введённые данные.';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async requestPasswordReset(email: string) {
      this.loading = true;
      this.error = '';
      try {
        await requestCloudPasswordReset(email);
      } catch (error) {
        this.error = 'Не удалось отправить письмо. Попробуй ещё раз позже.';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async resendSignupConfirmation(email: string) {
      this.loading = true;
      this.error = '';
      try {
        await resendCloudSignupConfirmation(email);
      } catch (error) {
        this.error = 'Не удалось отправить письмо повторно. Попробуй ещё раз позже.';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async updatePassword(password: string) {
      this.loading = true;
      this.error = '';
      try {
        await updateCloudPassword(password);
      } catch (error) {
        this.error = 'Не удалось изменить пароль. Попробуй ещё раз.';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async completePasswordRecovery(password: string) {
      if (!this.recoveryRequired || !this.session) throw new Error('Ссылка восстановления недействительна');
      this.loading = true;
      this.error = '';
      try {
        await updateCloudPassword(password);
        await signOutFromCloud();
        this.session = null;
        this.recoveryRequired = false;
        persistPasswordRecovery(false);
        this.notice = 'Пароль изменён. Войди с новым паролем.';
      } catch (error) {
        this.error = 'Не удалось изменить пароль. Запроси новую ссылку и попробуй ещё раз.';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async cancelPasswordRecovery() {
      this.loading = true;
      this.error = '';
      try {
        if (this.session) await signOutFromCloud();
      } finally {
        this.session = null;
        this.recoveryRequired = false;
        persistPasswordRecovery(false);
        this.loading = false;
      }
    },
    async deleteAccount() {
      const userId = this.session?.user.id;
      if (!userId) throw new Error('Сессия не найдена');

      this.loading = true;
      this.error = '';
      try {
        await deleteCloudAccount();
      } catch (error) {
        this.error = 'Не удалось удалить аккаунт. Данные не были очищены на этом устройстве.';
        throw error;
      }

      clearCloudSyncMeta(userId);
      try {
        await clearLocalCloudSession();
      } catch {
        this.error = 'Аккаунт удалён. Локальный выход завершится после обновления страницы.';
      } finally {
        this.session = null;
        this.loading = false;
      }
    },
    async signOut() {
      this.loading = true;
      this.error = '';
      try {
        await signOutFromCloud();
        this.session = null;
        this.recoveryRequired = false;
        persistPasswordRecovery(false);
      } finally {
        this.loading = false;
      }
    }
  }
});
