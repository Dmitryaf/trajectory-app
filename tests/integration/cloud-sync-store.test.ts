import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db';
import { BACKUP_VERSION } from '../../src/features/backup/version';
import { saveCloudSyncBase } from '../../src/features/sync/base';
import {
  CloudRevisionConflictError,
  getCloudSyncMeta,
  loadCloudSnapshot,
  markCloudSyncPending,
  saveCloudSnapshot,
} from '../../src/services/cloudSync';
import { useAppStore } from '../../src/stores/app';
import { useAuthStore } from '../../src/stores/auth';
import { defaultSettings, emptyDailyEntry, emptyMonthlyReview, emptyWeeklyReview } from '../../src/types';

vi.mock('../../src/services/cloudSync', () => ({
  CloudRevisionConflictError: class CloudRevisionConflictError extends Error {},
  clearCloudSyncMeta: vi.fn(),
  clearLocalCloudSession: vi.fn(),
  deleteCloudAccount: vi.fn(),
  getVerifiedCloudSession: vi.fn(),
  getCloudSyncMeta: vi.fn(() => ({
    lastCloudUpdatedAt: '',
    lastCloudRevision: 0,
    lastSyncedAt: '',
    pending: false,
    conflict: false,
    error: '',
  })),
  isBetaSignupConfigured: () => false,
  isCloudAuthRequired: () => false,
  isCloudSyncConfigured: () => true,
  markCloudSyncPending: vi.fn(),
  loadCloudSnapshot: vi.fn(),
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
    vi.mocked(saveCloudSnapshot).mockImplementation(async (payload) => ({
      payload,
      updatedAt: '2026-07-22T10:00:00.000Z',
      revision: 1,
      userId: 'user-1',
    }));

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
        version: BACKUP_VERSION,
        settings: expect.objectContaining({ firstUse: expect.objectContaining({ status: 'not_started' }) }),
        weeklyReviews: [
          expect.objectContaining({
            highlights: ['Важный разговор', '', ''],
            stateContext: 'Неделя была неровной.',
          }),
        ],
      }),
      0,
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

  it('merges independent edits after a concurrent cloud update and retries automatically', async () => {
    const auth = useAuthStore();
    auth.session = { user: { id: 'user-1' } } as typeof auth.session;
    const store = useAppStore();
    const baseEntry = { ...emptyDailyEntry('2026-08-20'), energy: 3, importantFact: '' };
    store.dailyEntries = [baseEntry];
    const basePayload = store.exportData();
    await saveCloudSyncBase('user-1', 1, basePayload);
    store.dailyEntries = [{ ...baseEntry, energy: 4 }];
    const remotePayload = {
      ...basePayload,
      dailyEntries: [{ ...baseEntry, importantFact: 'Изменение с телефона' }],
    };
    vi.mocked(getCloudSyncMeta).mockReturnValue({
      lastCloudUpdatedAt: '2026-08-20T10:00:00.000Z',
      lastCloudRevision: 1,
      lastSyncedAt: '2026-08-20T10:00:00.000Z',
      pending: true,
      conflict: false,
      error: '',
    });
    vi.mocked(loadCloudSnapshot).mockResolvedValue({
      payload: remotePayload,
      updatedAt: '2026-08-20T10:01:00.000Z',
      revision: 2,
      userId: 'user-1',
    });
    vi.mocked(saveCloudSnapshot)
      .mockRejectedValueOnce(new CloudRevisionConflictError())
      .mockImplementationOnce(async (payload) => ({
        payload,
        updatedAt: '2026-08-20T10:02:00.000Z',
        revision: 3,
        userId: 'user-1',
      }));

    await expect(store.syncCloudSnapshot()).resolves.toEqual({
      status: 'synced',
      updatedAt: '2026-08-20T10:02:00.000Z',
    });

    expect(saveCloudSnapshot).toHaveBeenNthCalledWith(1, expect.any(Object), 1);
    expect(saveCloudSnapshot).toHaveBeenNthCalledWith(2, expect.any(Object), 2);
    expect(store.dailyEntries[0]).toMatchObject({ energy: 4, importantFact: 'Изменение с телефона' });
  });

  it('removes the saved sync base when local data is cleared for an account boundary', async () => {
    const store = useAppStore();
    await saveCloudSyncBase('user-1', 2, store.exportData());

    await store.clearAll({ syncCloud: false });

    expect(await db.cloudSyncBases.get('user-1')).toBeUndefined();
  });

  it('rejects journal records with invalid dates before writing to IndexedDB', async () => {
    const store = useAppStore();

    await expect(store.addResult({ date: '', area: 'career', title: 'Итог', note: '' })).rejects.toThrow('Укажите корректную дату итога');
    await expect(store.updateResult({ id: 1, date: '2026-02-30', area: 'career', title: 'Итог', note: '', createdAt: '' })).rejects.toThrow(
      'Укажите корректную дату итога',
    );
    await expect(store.addLifeEvent({ date: '', type: 'event', title: 'Событие', note: '' })).rejects.toThrow(
      'Укажите корректную дату события',
    );
    await expect(
      store.updateLifeEvent({ id: 1, date: '2026-02-30', type: 'event', title: 'Событие', note: '', createdAt: '' }),
    ).rejects.toThrow('Укажите корректную дату события');

    expect(await db.results.count()).toBe(0);
    expect(await db.lifeEvents.count()).toBe(0);
  });

  it('rejects non-canonical entry and review keys before writing to IndexedDB', async () => {
    const store = useAppStore();

    await expect(store.saveEntry(emptyDailyEntry('2026-02-30'))).rejects.toThrow('Укажите корректную дату записи');
    await expect(store.saveReview(emptyWeeklyReview('2026-07-21'))).rejects.toThrow('Начало недельного обзора должно быть понедельником');
    await expect(store.saveMonthlyReview(emptyMonthlyReview('2026-07-02'))).rejects.toThrow(
      'Начало месячного обзора должно быть первым днём месяца',
    );

    expect(await db.dailyEntries.count()).toBe(0);
    expect(await db.weeklyReviews.count()).toBe(0);
    expect(await db.monthlyReviews.count()).toBe(0);
  });

  it('does not save a daily experiment link outside its period or shrink a period past linked entries', async () => {
    const store = useAppStore();
    const settings = structuredClone(defaultSettings);
    settings.experiment = {
      ...settings.experiment,
      id: 'active-experiment',
      active: true,
      title: 'Ложиться раньше',
      startDate: '2026-07-20',
      endDate: '2026-07-24',
    };
    await store.saveSettings(settings);

    await expect(
      store.saveEntry({
        ...emptyDailyEntry('2026-07-25'),
        experimentId: 'active-experiment',
        experimentCompleted: true,
      }),
    ).rejects.toThrow('Запись 2026-07-25 находится вне периода эксперимента: active-experiment');

    await store.saveEntry({
      ...emptyDailyEntry('2026-07-24'),
      experimentId: 'active-experiment',
      experimentCompleted: true,
    });
    await expect(
      store.saveSettings({
        ...settings,
        experiment: { ...settings.experiment, endDate: '2026-07-23' },
      }),
    ).rejects.toThrow('Запись 2026-07-24 находится вне периода эксперимента: active-experiment');

    expect(store.settings.experiment.endDate).toBe('2026-07-24');
    expect((await db.settings.get('main'))?.experiment.endDate).toBe('2026-07-24');
  });
});
