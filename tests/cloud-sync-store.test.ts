import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../src/stores/app';
import { useAuthStore } from '../src/stores/auth';
import { markCloudSyncPending, saveCloudSnapshot } from '../src/services/cloudSync';
import { emptyWeeklyReview } from '../src/types';

vi.mock('../src/services/cloudSync', () => ({
  clearCloudSyncMeta: vi.fn(),
  clearLocalCloudSession: vi.fn(),
  deleteCloudAccount: vi.fn(),
  getVerifiedCloudSession: vi.fn(),
  isBetaSignupConfigured: () => false,
  isCloudAuthRequired: () => false,
  isCloudSyncConfigured: () => true,
  markCloudSyncPending: vi.fn(),
  onCloudAuthChange: vi.fn(),
  saveCloudSnapshot: vi.fn(),
  signInToCloud: vi.fn(),
  signOutFromCloud: vi.fn(),
}));

describe('cloud synchronization state', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('marks local data as pending before the cloud request starts', async () => {
    const auth = useAuthStore();
    auth.session = { user: { id: 'user-1' } } as typeof auth.session;
    vi.mocked(saveCloudSnapshot).mockResolvedValue('2026-07-22T10:00:00.000Z');

    const store = useAppStore();
    store.weeklyReviews = [
      {
        ...emptyWeeklyReview('2026-07-20'),
        highlights: ['Важный разговор', '', ''],
        stateContext: 'Неделя была неровной.',
      },
    ];

    await store.syncCloudSnapshot();

    expect(markCloudSyncPending).toHaveBeenCalledWith('user-1', 'Локальные изменения ожидают синхронизации');
    expect(vi.mocked(markCloudSyncPending).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(saveCloudSnapshot).mock.invocationCallOrder[0],
    );
    expect(saveCloudSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 7,
        weeklyReviews: [
          expect.objectContaining({
            highlights: ['Важный разговор', '', ''],
            stateContext: 'Неделя была неровной.',
          }),
        ],
      }),
    );
  });
});
