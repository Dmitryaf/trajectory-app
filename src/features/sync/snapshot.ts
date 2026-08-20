import { markCloudSyncSynced, type CloudSnapshot } from '../../services/cloudSync';
import type { useAppStore } from '../../stores/app';

type AppStore = ReturnType<typeof useAppStore>;

type ApplyCloudSnapshotServices = {
  markSynced: (userId: string, cloudUpdatedAt: string) => unknown;
};

const defaultServices: ApplyCloudSnapshotServices = {
  markSynced: markCloudSyncSynced,
};

export async function applyCloudSnapshot(
  store: AppStore,
  userId: string,
  snapshot: CloudSnapshot,
  message: string,
  services: ApplyCloudSnapshotServices = defaultServices,
) {
  await store.importData(snapshot.payload, { syncCloud: false, preserveDailyDrafts: true });
  services.markSynced(userId, snapshot.updatedAt);
  store.setCloudSyncState('synced', `${message}: ${formatCloudUpdatedAt(snapshot.updatedAt)}`, {
    updatedAt: snapshot.updatedAt,
  });
}

export function formatCloudUpdatedAt(value: string) {
  return new Date(value).toLocaleString('ru-RU');
}
