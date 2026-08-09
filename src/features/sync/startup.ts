import type { useAppStore } from '../../stores/app';
import { defaultSettings } from '../../types';
import {
  getCloudSyncMeta,
  loadCloudSnapshot,
  markCloudSyncConflict,
  markCloudSyncSynced,
  type CloudSnapshot,
  type CloudSyncMeta,
} from '../../services/cloudSync';

type AppStore = ReturnType<typeof useAppStore>;

type StartupSyncServices = {
  loadSnapshot: () => Promise<CloudSnapshot | null>;
  getMeta: (userId: string) => CloudSyncMeta;
  markConflict: (userId: string, cloudUpdatedAt: string) => unknown;
  markSynced: (userId: string, cloudUpdatedAt: string) => unknown;
};

const defaultServices: StartupSyncServices = {
  loadSnapshot: loadCloudSnapshot,
  getMeta: getCloudSyncMeta,
  markConflict: markCloudSyncConflict,
  markSynced: markCloudSyncSynced,
};

const localOwnerKey = 'trajectory:local-owner-id';

export async function reconcileCloudSnapshotOnStartup(
  store: AppStore,
  userId: string | null | undefined,
  services: StartupSyncServices = defaultServices,
) {
  await reconcileCloudSnapshot(store, userId, 'startup', services);
}

export async function reconcileCloudSnapshotAfterResume(
  store: AppStore,
  userId: string | null | undefined,
  services: StartupSyncServices = defaultServices,
) {
  await reconcileCloudSnapshot(store, userId, 'resume', services);
}

async function reconcileCloudSnapshot(
  store: AppStore,
  userId: string | null | undefined,
  mode: 'startup' | 'resume',
  services: StartupSyncServices,
) {
  if (!userId) return;

  try {
    const snapshot = await services.loadSnapshot();
    const meta = services.getMeta(userId);

    if (!snapshot) {
      if (hasLocalUserData(store) || meta.pending) await store.syncCloudSnapshot({ force: true });
      else store.setCloudSyncState('synced', 'Облако пока пустое');
      return;
    }

    if (!hasLocalUserData(store) && !meta.pending) {
      if (mode === 'startup') await importCloudSnapshot(store, userId, snapshot, services, 'Загружена облачная копия');
      else markResumeConflict(store, userId, snapshot, services);
      return;
    }

    if (meta.lastCloudUpdatedAt === snapshot.updatedAt) {
      if (meta.pending) await store.syncCloudSnapshot({ force: true });
      else
        store.setCloudSyncState('synced', `Облако синхронизировано: ${formatUpdatedAt(snapshot.updatedAt)}`, {
          updatedAt: snapshot.updatedAt,
        });
      return;
    }

    if (meta.lastCloudUpdatedAt && !meta.pending && !meta.conflict) {
      if (mode === 'startup') await importCloudSnapshot(store, userId, snapshot, services, 'Загружена более свежая облачная копия');
      else markResumeConflict(store, userId, snapshot, services);
      return;
    }

    services.markConflict(userId, snapshot.updatedAt);
    store.setCloudSyncState('conflict', 'В этом браузере и в облаке есть разные данные. Выбери действие в настройках.', {
      updatedAt: snapshot.updatedAt,
    });
  } catch (error) {
    console.warn('Не удалось загрузить облачную копию', error);
    store.setCloudSyncState('pending', 'Локальные данные доступны. Облако пока не проверено.', {
      error: error instanceof Error ? error.message : 'Не удалось проверить облако',
    });
  }
}

function markResumeConflict(store: AppStore, userId: string, snapshot: CloudSnapshot, services: StartupSyncServices) {
  services.markConflict(userId, snapshot.updatedAt);
  store.setCloudSyncState(
    'conflict',
    'В облаке появились более свежие данные. Открытые записи не заменены. Выбери действие в настройках.',
    {
      updatedAt: snapshot.updatedAt,
    },
  );
}

export async function prepareLocalCacheOwner(
  store: AppStore,
  userId: string | null | undefined,
  storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage,
) {
  if (!userId) return;

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

async function importCloudSnapshot(
  store: AppStore,
  userId: string,
  snapshot: CloudSnapshot,
  services: StartupSyncServices,
  message: string,
) {
  await store.importData(snapshot.payload, { syncCloud: false });
  services.markSynced(userId, snapshot.updatedAt);
  store.setCloudSyncState('synced', `${message}: ${formatUpdatedAt(snapshot.updatedAt)}`, { updatedAt: snapshot.updatedAt });
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString('ru-RU');
}
