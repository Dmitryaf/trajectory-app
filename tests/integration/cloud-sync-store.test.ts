import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db';
import { markCloudSyncPending, saveCloudSnapshot } from '../../src/services/cloudSync';
import { useAppStore } from '../../src/stores/app';
import { useAuthStore } from '../../src/stores/auth';
import { emptyWeeklyReview } from '../../src/types';

vi.mock('../../src/services/cloudSync', () => ({
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
  beforeEach(async () => {
    await db.delete();
    await db.open();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await db.delete();
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

    await expect(store.syncCloudSnapshot()).resolves.toEqual({
      status: 'synced',
      updatedAt: '2026-07-22T10:00:00.000Z',
    });

    expect(markCloudSyncPending).toHaveBeenCalledWith('user-1', 'Локальные изменения ожидают синхронизации');
    expect(vi.mocked(markCloudSyncPending).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(saveCloudSnapshot).mock.invocationCallOrder[0],
    );
    expect(saveCloudSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 10,
        settings: expect.objectContaining({ firstUse: expect.objectContaining({ status: 'not_started' }) }),
        weeklyReviews: [
          expect.objectContaining({
            highlights: ['Важный разговор', '', ''],
            stateContext: 'Неделя была неровной.',
          }),
        ],
      }),
    );
    expect(vi.mocked(saveCloudSnapshot).mock.calls[0]![0]).not.toHaveProperty('firstUseFunnel');
  });

  it('keeps first-use progress locally when the cloud copy fails', async () => {
    const auth = useAuthStore();
    auth.session = { user: { id: 'user-1' } } as typeof auth.session;
    vi.mocked(saveCloudSnapshot).mockRejectedValue(new Error('network unavailable'));
    const store = useAppStore();

    await store.saveSettings({
      ...store.settings,
      firstUse: {
        status: 'in_progress',
        weekStart: '2026-07-27',
        periodEnd: '2026-08-02',
        lastStep: 'highlights',
        overviewSeen: false,
        updatedAt: '2026-08-03T12:00:00.000Z',
      },
    });
    await vi.waitFor(() => expect(store.cloudSyncStatus).toBe('pending'));

    expect(store.settings.firstUse).toMatchObject({ status: 'in_progress', lastStep: 'highlights' });
    expect((await db.settings.get('main'))?.firstUse).toMatchObject({ status: 'in_progress', lastStep: 'highlights' });
    expect(store.cloudSyncMessage).toBe('Изменения сохранены локально. Облако обновится после повторной синхронизации.');
    expect(store.cloudSyncError).toBe('network unavailable');
  });

  it('reports that a requested cloud copy is still pending after a network failure', async () => {
    const auth = useAuthStore();
    auth.session = { user: { id: 'user-1' } } as typeof auth.session;
    vi.mocked(saveCloudSnapshot).mockRejectedValue(new Error('network unavailable'));
    const store = useAppStore();

    await expect(store.syncCloudSnapshot({ force: true })).resolves.toEqual({
      status: 'pending',
      error: 'network unavailable',
    });

    expect(store.cloudSyncStatus).toBe('pending');
    expect(store.cloudSyncError).toBe('network unavailable');
  });
});
