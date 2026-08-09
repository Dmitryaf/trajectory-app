// @vitest-environment happy-dom

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cloud = vi.hoisted(() => ({
  authRequired: vi.fn(),
  clearLocalSession: vi.fn(),
  configured: vi.fn(),
  deleteAccount: vi.fn(),
  getStartupSession: vi.fn(),
  onAuthChange: vi.fn(),
  requestPasswordReset: vi.fn(),
  resendConfirmation: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock('../src/services/cloudSync', () => ({
  clearCloudSyncMeta: vi.fn(),
  clearLocalCloudSession: cloud.clearLocalSession,
  deleteCloudAccount: cloud.deleteAccount,
  getStartupCloudSession: cloud.getStartupSession,
  isBetaSignupConfigured: vi.fn(() => true),
  isCloudAuthRequired: cloud.authRequired,
  isCloudSyncConfigured: cloud.configured,
  onCloudAuthChange: cloud.onAuthChange,
  resendCloudSignupConfirmation: cloud.resendConfirmation,
  requestCloudPasswordReset: cloud.requestPasswordReset,
  signInToCloud: vi.fn(),
  signOutFromCloud: cloud.signOut,
  signUpToCloud: cloud.signUp,
  updateCloudPassword: cloud.updatePassword,
}));

import { useAuthStore } from '../src/stores/auth';

describe('auth store beta lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
    window.sessionStorage.clear();
    cloud.authRequired.mockReturnValue(false);
    cloud.configured.mockReturnValue(true);
    cloud.getStartupSession.mockResolvedValue(null);
    cloud.onAuthChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }));
  });

  it('keeps the user signed out until a new email is confirmed', async () => {
    cloud.signUp.mockResolvedValue({ session: null, confirmationRequired: true });
    const auth = useAuthStore();

    await expect(auth.signUp('friend@example.com', 'safe-password', 'BETA-INVITE-2026')).resolves.toEqual({
      session: null,
      confirmationRequired: true,
    });
    expect(auth.session).toBeNull();
    expect(cloud.signUp).toHaveBeenCalledWith('friend@example.com', 'safe-password', 'BETA-INVITE-2026');
  });

  it('fails closed when a deployed preview requires auth but has no backend configuration', async () => {
    cloud.authRequired.mockReturnValue(true);
    cloud.configured.mockReturnValue(false);
    const auth = useAuthStore();

    await auth.init();

    expect(auth.configurationMissing).toBe(true);
    expect(auth.requiresAuth).toBe(true);
    expect(auth.isAuthenticated).toBe(false);
  });

  it('keeps a cached session when startup verification is temporarily unavailable', async () => {
    const cachedSession = { user: { id: 'user-1', email: 'friend@example.com' } } as ReturnType<typeof useAuthStore>['session'];
    cloud.getStartupSession.mockResolvedValue(cachedSession);
    const auth = useAuthStore();

    await auth.init();

    expect(auth.session).toEqual(cachedSession);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.error).toBe('');
  });

  it('requests a password recovery email without exposing account existence', async () => {
    cloud.requestPasswordReset.mockResolvedValue(undefined);
    const auth = useAuthStore();

    await auth.requestPasswordReset('friend@example.com');
    expect(cloud.requestPasswordReset).toHaveBeenCalledWith('friend@example.com');
    expect(auth.error).toBe('');
  });

  it('resends the signup confirmation for the pending email', async () => {
    cloud.resendConfirmation.mockResolvedValue(undefined);
    const auth = useAuthStore();

    await auth.resendSignupConfirmation('friend@example.com');
    expect(cloud.resendConfirmation).toHaveBeenCalledWith('friend@example.com');
  });

  it('updates the password only through the authenticated cloud session', async () => {
    cloud.updatePassword.mockResolvedValue(undefined);
    const auth = useAuthStore();

    await auth.updatePassword('new-safe-password');
    expect(cloud.updatePassword).toHaveBeenCalledWith('new-safe-password');
  });

  it('blocks a recovery session until the password changes and a normal sign-in starts', async () => {
    let authListener: ((event: string, session: unknown) => void) | undefined;
    cloud.onAuthChange.mockImplementation((callback) => {
      authListener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    cloud.updatePassword.mockResolvedValue(undefined);
    cloud.signOut.mockResolvedValue(undefined);
    const auth = useAuthStore();

    await auth.init();
    authListener?.('PASSWORD_RECOVERY', { user: { id: 'user-1', email: 'friend@example.com' } });

    expect(auth.recoveryRequired).toBe(true);
    expect(auth.isAuthenticated).toBe(false);

    await auth.completePasswordRecovery('new-safe-password');

    expect(cloud.updatePassword).toHaveBeenCalledWith('new-safe-password');
    expect(cloud.signOut).toHaveBeenCalledOnce();
    expect(auth.session).toBeNull();
    expect(auth.recoveryRequired).toBe(false);
    expect(auth.notice).toBe('Пароль изменён. Войди с новым паролем.');
  });

  it('deletes only the current account and clears its local cloud session', async () => {
    cloud.deleteAccount.mockResolvedValue(undefined);
    cloud.clearLocalSession.mockResolvedValue(undefined);
    const auth = useAuthStore();
    auth.session = { user: { id: 'user-1' } } as typeof auth.session;

    await auth.deleteAccount();

    expect(cloud.deleteAccount).toHaveBeenCalledOnce();
    expect(cloud.clearLocalSession).toHaveBeenCalledOnce();
    expect(auth.session).toBeNull();
  });
});
