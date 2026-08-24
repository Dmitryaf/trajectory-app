import type { useAppStore } from '@/stores/app';
import { defaultSettings } from '@/types';
import { normalizeSnapshot } from '../backup/snapshot';
import { getCloudSyncMeta, loadCloudSnapshot, markCloudSyncSynced, type CloudSnapshot, type CloudSyncMeta } from '@/services/cloudSync';
import { applyCloudSnapshot, formatCloudUpdatedAt } from './snapshot';
import { saveCloudSyncBase } from './base';

type AppStore = ReturnType<typeof useAppStore>;

type StartupSyncServices = {
  loadSnapshot: () => Promise<CloudSnapshot | null>;
  getMeta: (userId: string) => CloudSyncMeta;
  markSynced: (userId: string, cloudUpdatedAt: string, cloudRevision?: number) => unknown;
};

const defaultServices: StartupSyncServices = {
  loadSnapshot: loadCloudSnapshot,
  getMeta: getCloudSyncMeta,
  markSynced: markCloudSyncSynced,
};

const localOwnerKey = 'trajectory:local-owner-id';

export async function reconcileCloudSnapshotOnStartup(
  store: AppStore,
  userId: string | null | undefined,
  services: StartupSyncServices = defaultServices,
) {
  await reconcileCloudSnapshot(store, userId, services);
}

export async function reconcileCloudSnapshotAfterResume(
  store: AppStore,
  userId: string | null | undefined,
  services: StartupSyncServices = defaultServices,
) {
  await reconcileCloudSnapshot(store, userId, services);
}

async function reconcileCloudSnapshot(store: AppStore, userId: string | null | undefined, services: StartupSyncServices) {
  if (!userId) {
    return;
  }

  try {
    const snapshot = await services.loadSnapshot();
    const meta = services.getMeta(userId);

    if (!snapshot) {
      if (hasLocalUserData(store) || meta.pending) {
        await store.syncCloudSnapshot({ force: true });
      } else {
        store.setCloudSyncState('synced', 'Облако пока пустое');
      }
      return;
    }

    if (sameSnapshotData(store, snapshot)) {
      await saveCloudSyncBase(userId, snapshot.revision ?? 1, snapshot.payload);
      services.markSynced(userId, snapshot.updatedAt, snapshot.revision ?? 1);
      store.setCloudSyncState('synced', `Облако синхронизировано: ${formatCloudUpdatedAt(snapshot.updatedAt)}`, {
        updatedAt: snapshot.updatedAt,
      });
      return;
    }

    if (meta.pending) {
      await store.syncCloudSnapshot({ force: true });
      return;
    }

    await applyCloudSnapshot(store, userId, snapshot, 'Загружена более свежая облачная копия', {
      markSynced: services.markSynced,
    });
  } catch (error) {
    console.warn('Не удалось загрузить облачную копию', error);
    store.setCloudSyncState('pending', 'Локальные данные доступны. Облако пока не проверено.', {
      error: error instanceof Error ? error.message : 'Не удалось проверить облако',
    });
  }
}

export function sameSnapshotData(store: AppStore, snapshot: CloudSnapshot) {
  try {
    const localData = { ...store.exportData(), exportedAt: '' };
    const cloudData = { ...normalizeSnapshot(snapshot.payload), exportedAt: '' };
    return JSON.stringify(localData) === JSON.stringify(cloudData);
  } catch {
    return false;
  }
}

export async function prepareLocalCacheOwner(
  store: AppStore,
  userId: string | null | undefined,
  storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage,
) {
  if (!userId) {
    return;
  }

  const localOwnerId = storage.getItem(localOwnerKey);
  if (localOwnerId && localOwnerId !== userId) {
    await store.clearAll({ syncCloud: false });
  }
  storage.setItem(localOwnerKey, userId);
}

export function hasLocalUserData(store: AppStore): boolean {
  return Boolean(
    store.dailyEntries.length ||
    store.results.length ||
    store.lifeEvents.length ||
    store.weeklyReviews.length ||
    store.monthlyReviews.length ||
    JSON.stringify(store.settings) !== JSON.stringify(defaultSettings),
  );
}
