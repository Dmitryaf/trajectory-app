import { defineStore } from 'pinia';
import type { Session } from '@supabase/supabase-js';
import { getVerifiedCloudSession, isCloudSyncConfigured, onCloudAuthChange, signInToCloud, signOutFromCloud, signUpToCloud } from '../services/cloudSync';

let unsubscribeAuth: (() => void) | null = null;

export const useAuthStore = defineStore('auth', {
  state: () => ({
    configured: isCloudSyncConfigured(),
    initialized: false,
    loading: false,
    session: null as Session | null,
    error: ''
  }),
  getters: {
    requiresAuth: (state) => state.configured,
    isAuthenticated: (state) => !state.configured || Boolean(state.session),
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

        this.session = await getVerifiedCloudSession();
        unsubscribeAuth?.();
        const listener = onCloudAuthChange((session) => {
          this.session = session;
        });
        unsubscribeAuth = () => listener.data.subscription.unsubscribe();
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
      try {
        this.session = await signInToCloud(email, password);
      } catch (error) {
        this.error = 'Не удалось войти. Проверь email и пароль.';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async signUp(email: string, password: string) {
      this.loading = true;
      this.error = '';
      try {
        this.session = await signUpToCloud(email, password);
      } catch (error) {
        this.error = 'Не удалось создать аккаунт. Проверь email и пароль.';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async signOut() {
      this.loading = true;
      this.error = '';
      try {
        await signOutFromCloud();
        this.session = null;
      } finally {
        this.loading = false;
      }
    }
  }
});
