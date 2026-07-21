import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasLocalUserData, prepareLocalCacheOwner, reconcileCloudSnapshotOnStartup } from '../src/features/sync/startup';
import { useAppStore } from '../src/stores/app';
import { defaultSettings } from '../src/types';
import type { CloudSnapshot, CloudSyncMeta } from '../src/services/cloudSync';

const emptyMeta: CloudSyncMeta = {
  lastCloudUpdatedAt: '',
  lastSyncedAt: '',
  pending: false,
  conflict: false,
  error: ''
};

function createStore() {
  setActivePinia(createPinia());
  const store = useAppStore();
  store.settings = structuredClone(defaultSettings);
  vi.spyOn(store, 'importData').mockResolvedValue(undefined);
  vi.spyOn(store, 'syncCloudSnapshot').mockResolvedValue(undefined);
  vi.spyOn(store, 'setCloudSyncState');
  vi.spyOn(store, 'clearAll').mockResolvedValue(undefined);
  return store;
}

function createServices(snapshot: CloudSnapshot | null, meta: Partial<CloudSyncMeta> = {}) {
  return {
    loadSnapshot: vi.fn().mockResolvedValue(snapshot),
    getMeta: vi.fn(() => ({ ...emptyMeta, ...meta })),
    markConflict: vi.fn(),
    markSynced: vi.fn()
  };
}

beforeEach(() => vi.clearAllMocks());

describe('startup cloud reconciliation', () => {
  it('restores cloud data into a genuinely empty local store', async () => {
    const store = createStore();
    const snapshot = { payload: { version: 3 }, updatedAt: '2026-07-22T10:00:00.000Z', userId: 'user-1' };
    const services = createServices(snapshot);

    await reconcileCloudSnapshotOnStartup(store, 'user-1', services);

    expect(store.importData).toHaveBeenCalledWith(snapshot.payload, { syncCloud: false });
    expect(services.markSynced).toHaveBeenCalledWith('user-1', snapshot.updatedAt);
  });

  it('does not overwrite locally changed settings with an unrelated cloud snapshot', async () => {
    const store = createStore();
    store.settings.activeFocusTitle = 'Локальная цель';
    const snapshot = { payload: { version: 3 }, updatedAt: '2026-07-22T10:00:00.000Z', userId: 'user-1' };
    const services = createServices(snapshot);

    expect(hasLocalUserData(store)).toBe(true);
    await reconcileCloudSnapshotOnStartup(store, 'user-1', services);

    expect(store.importData).not.toHaveBeenCalled();
    expect(services.markConflict).toHaveBeenCalledWith('user-1', snapshot.updatedAt);
    expect(store.setCloudSyncState).toHaveBeenCalledWith(
      'conflict',
      'В этом браузере и в облаке есть разные данные. Выбери действие в настройках.',
      { updatedAt: snapshot.updatedAt }
    );
  });

  it('uploads pending local changes when the known cloud revision is unchanged', async () => {
    const store = createStore();
    const updatedAt = '2026-07-22T10:00:00.000Z';
    const snapshot = { payload: {}, updatedAt, userId: 'user-1' };
    const services = createServices(snapshot, { lastCloudUpdatedAt: updatedAt, pending: true });

    await reconcileCloudSnapshotOnStartup(store, 'user-1', services);

    expect(store.syncCloudSnapshot).toHaveBeenCalledWith({ force: true });
    expect(store.importData).not.toHaveBeenCalled();
  });

  it('keeps local data available when the cloud check fails', async () => {
    const store = createStore();
    const services = createServices(null);
    services.loadSnapshot.mockRejectedValue(new Error('network unavailable'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await reconcileCloudSnapshotOnStartup(store, 'user-1', services);

    expect(store.setCloudSyncState).toHaveBeenCalledWith(
      'pending',
      'Локальные данные доступны. Облако пока не проверено.',
      { error: 'network unavailable' }
    );
    expect(store.cloudSyncError).toBe('network unavailable');
    warning.mockRestore();
  });

  it('clears a cache owned by another account before assigning the new owner', async () => {
    const store = createStore();
    const values = new Map([['trajectory:local-owner-id', 'user-old']]);
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value))
    };

    await prepareLocalCacheOwner(store, 'user-new', storage);

    expect(store.clearAll).toHaveBeenCalledWith({ syncCloud: false });
    expect(storage.setItem).toHaveBeenCalledWith('trajectory:local-owner-id', 'user-new');
  });
});
