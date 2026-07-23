import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cloud = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resendConfirmation: vi.fn(),
  signUp: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock('../src/services/cloudSync', () => ({
  getVerifiedCloudSession: vi.fn().mockResolvedValue(null),
  isBetaSignupConfigured: vi.fn(() => true),
  isCloudSyncConfigured: vi.fn(() => true),
  onCloudAuthChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  resendCloudSignupConfirmation: cloud.resendConfirmation,
  requestCloudPasswordReset: cloud.requestPasswordReset,
  signInToCloud: vi.fn(),
  signOutFromCloud: vi.fn(),
  signUpToCloud: cloud.signUp,
  updateCloudPassword: cloud.updatePassword,
}));

import { useAuthStore } from '../src/stores/auth';

describe('auth store beta lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
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
});
