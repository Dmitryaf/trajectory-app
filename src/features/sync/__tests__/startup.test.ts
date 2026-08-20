import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasLocalUserData, prepareLocalCacheOwner, reconcileCloudSnapshotAfterResume, reconcileCloudSnapshotOnStartup } from '../startup';
import type { CloudSnapshot, CloudSyncMeta } from '../../../services/cloudSync';
import { useAppStore } from '../../../stores/app';
import { defaultSettings, emptyDailyEntry } from '../../../types';

vi.mock('../base', () => ({ saveCloudSyncBase: vi.fn() }));

const emptyMeta: CloudSyncMeta = {
  lastCloudUpdatedAt: '',
  lastCloudRevision: 0,
  lastSyncedAt: '',
  pending: false,
  conflict: false,
  error: '',
};

function createStore() {
  setActivePinia(createPinia());
  const store = useAppStore();
  store.settings = structuredClone(defaultSettings);
  vi.spyOn(store, 'importData').mockResolvedValue(undefined);
  vi.spyOn(store, 'syncCloudSnapshot').mockResolvedValue({ status: 'synced', updatedAt: '2026-07-22T10:00:00.000Z' });
  vi.spyOn(store, 'setCloudSyncState');
  vi.spyOn(store, 'clearAll').mockResolvedValue(undefined);
  return store;
}

function createServices(snapshot: CloudSnapshot | null, meta: Partial<CloudSyncMeta> = {}) {
  return {
    loadSnapshot: vi.fn().mockResolvedValue(snapshot),
    getMeta: vi.fn(() => ({ ...emptyMeta, ...meta })),
    markSynced: vi.fn(),
  };
}

beforeEach(() => vi.clearAllMocks());

describe('startup cloud reconciliation', () => {
  it('restores cloud data into a genuinely empty local store', async () => {
    const store = createStore();
    const snapshot = { payload: { version: 3 }, updatedAt: '2026-07-22T10:00:00.000Z', userId: 'user-1', revision: 4 };
    const services = createServices(snapshot);

    await reconcileCloudSnapshotOnStartup(store, 'user-1', services);

    expect(store.importData).toHaveBeenCalledWith(snapshot.payload, { syncCloud: false, preserveDailyDrafts: true });
    expect(services.markSynced).toHaveBeenCalledWith('user-1', snapshot.updatedAt, 4);
  });

  it('applies the cloud snapshot automatically when there are no pending local changes', async () => {
    const store = createStore();
    store.settings.activeFocusTitle = 'Локальная цель';
    const snapshot = { payload: { version: 3 }, updatedAt: '2026-07-22T10:00:00.000Z', userId: 'user-1', revision: 2 };
    const services = createServices(snapshot);

    expect(hasLocalUserData(store)).toBe(true);
    await reconcileCloudSnapshotOnStartup(store, 'user-1', services);

    expect(store.importData).toHaveBeenCalledWith(snapshot.payload, { syncCloud: false, preserveDailyDrafts: true });
    expect(services.markSynced).toHaveBeenCalledWith('user-1', snapshot.updatedAt, 2);
  });

  it('uploads pending local changes when the known cloud revision is unchanged', async () => {
    const store = createStore();
    const snapshot = { payload: {}, updatedAt: '2026-07-22T10:00:00.000+00:00', userId: 'user-1', revision: 3 };
    const services = createServices(snapshot, { lastCloudUpdatedAt: '2026-07-22T10:00:00.000Z', lastCloudRevision: 3, pending: true });

    await reconcileCloudSnapshotOnStartup(store, 'user-1', services);

    expect(store.syncCloudSnapshot).toHaveBeenCalledWith({ force: true });
    expect(store.importData).not.toHaveBeenCalled();
  });

  it('imports a newer known cloud revision before working screens mount', async () => {
    const store = createStore();
    store.dailyEntries = [emptyDailyEntry('2026-07-21')];
    const snapshot = { payload: { version: 3 }, updatedAt: '2026-07-22T10:00:00.000Z', userId: 'user-1', revision: 5 };
    const services = createServices(snapshot, { lastCloudUpdatedAt: '2026-07-21T10:00:00.000Z' });

    await reconcileCloudSnapshotOnStartup(store, 'user-1', services);

    expect(store.importData).toHaveBeenCalledWith(snapshot.payload, { syncCloud: false, preserveDailyDrafts: true });
    expect(services.markSynced).toHaveBeenCalledWith('user-1', snapshot.updatedAt, 5);
  });

  it('applies a newer cloud revision after resume without asking the user to refresh', async () => {
    const store = createStore();
    store.dailyEntries = [emptyDailyEntry('2026-07-21')];
    const snapshot = { payload: { version: 3 }, updatedAt: '2026-07-22T10:00:00.000Z', userId: 'user-1', revision: 6 };
    const services = createServices(snapshot, { lastCloudUpdatedAt: '2026-07-21T10:00:00.000Z' });

    await reconcileCloudSnapshotAfterResume(store, 'user-1', services);

    expect(store.importData).toHaveBeenCalledWith(snapshot.payload, { syncCloud: false, preserveDailyDrafts: true });
    expect(services.markSynced).toHaveBeenCalledWith('user-1', snapshot.updatedAt, 6);
  });

  it('recognizes identical data regardless of the timestamp notation', async () => {
    const store = createStore();
    store.dailyEntries = [emptyDailyEntry('2026-07-21')];
    const snapshot = {
      payload: { ...store.exportData(), exportedAt: '2026-07-22T10:00:00.000Z' },
      updatedAt: '2026-07-22T10:00:00.000+00:00',
      userId: 'user-1',
      revision: 7,
    };
    const services = createServices(snapshot, { lastCloudUpdatedAt: '2026-07-22T10:00:00.000Z' });

    await reconcileCloudSnapshotAfterResume(store, 'user-1', services);

    expect(store.importData).not.toHaveBeenCalled();
    expect(services.markSynced).toHaveBeenCalledWith('user-1', snapshot.updatedAt, 7);
    expect(store.setCloudSyncState).toHaveBeenCalledWith('synced', expect.stringContaining('Облако синхронизировано:'), {
      updatedAt: snapshot.updatedAt,
    });
  });

  it('clears a stale conflict when local and cloud data are identical', async () => {
    const store = createStore();
    store.settings.activeFocusTitle = 'Одна и та же цель';
    const updatedAt = '2026-07-22T10:00:00.000+00:00';
    const snapshot = {
      payload: { ...store.exportData(), exportedAt: '2026-07-22T10:00:00.000Z' },
      updatedAt,
      userId: 'user-1',
      revision: 8,
    };
    const services = createServices(snapshot, { lastCloudUpdatedAt: updatedAt, conflict: true });

    await reconcileCloudSnapshotOnStartup(store, 'user-1', services);

    expect(store.importData).not.toHaveBeenCalled();
    expect(store.syncCloudSnapshot).not.toHaveBeenCalled();
    expect(services.markSynced).toHaveBeenCalledWith('user-1', updatedAt, 8);
    expect(store.setCloudSyncState).toHaveBeenCalledWith('synced', expect.stringContaining('Облако синхронизировано:'), {
      updatedAt,
    });
  });

  it('replaces a stale conflict with the current cloud snapshot', async () => {
    const store = createStore();
    store.settings.activeFocusTitle = 'Локальная цель';
    const updatedAt = '2026-07-22T10:00:00.000+00:00';
    const cloudPayload = {
      ...store.exportData(),
      settings: { ...store.settings, activeFocusTitle: 'Облачная цель' },
    };
    const snapshot = { payload: cloudPayload, updatedAt, userId: 'user-1', revision: 9 };
    const services = createServices(snapshot, { lastCloudUpdatedAt: updatedAt, conflict: true });

    await reconcileCloudSnapshotOnStartup(store, 'user-1', services);

    expect(store.importData).toHaveBeenCalledWith(cloudPayload, { syncCloud: false, preserveDailyDrafts: true });
    expect(store.syncCloudSnapshot).not.toHaveBeenCalled();
    expect(services.markSynced).toHaveBeenCalledWith('user-1', updatedAt, 9);
  });

  it('keeps local data available when the cloud check fails', async () => {
    const store = createStore();
    const services = createServices(null);
    services.loadSnapshot.mockRejectedValue(new Error('network unavailable'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await reconcileCloudSnapshotOnStartup(store, 'user-1', services);

    expect(store.setCloudSyncState).toHaveBeenCalledWith('pending', 'Локальные данные доступны. Облако пока не проверено.', {
      error: 'network unavailable',
    });
    expect(store.cloudSyncError).toBe('network unavailable');
    warning.mockRestore();
  });

  it('clears a cache owned by another account before assigning the new owner', async () => {
    const store = createStore();
    const values = new Map([['trajectory:local-owner-id', 'user-old']]);
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };

    await prepareLocalCacheOwner(store, 'user-new', storage);

    expect(store.clearAll).toHaveBeenCalledWith({ syncCloud: false });
    expect(storage.setItem).toHaveBeenCalledWith('trajectory:local-owner-id', 'user-new');
  });
});
