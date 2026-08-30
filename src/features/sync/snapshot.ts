import { markCloudSyncSynced, type CloudSnapshot } from '@/services/cloudSync';
import type { useAppStore } from '@/stores/app';
import { saveCloudSyncBase } from './base';

type AppStore = ReturnType<typeof useAppStore>;

type ApplyCloudSnapshotServices = {
  markSynced: (userId: string, cloudUpdatedAt: string, cloudRevision?: number) => unknown;
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
  const revision = snapshot.revision ?? 1;
  await saveCloudSyncBase(userId, revision, snapshot.payload);
  services.markSynced(userId, snapshot.updatedAt, revision);
  store.setCloudSyncState('synced', `${message}: ${formatCloudUpdatedAt(snapshot.updatedAt)}`, {
    updatedAt: snapshot.updatedAt,
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('trajectory:cloud-snapshot-applied'));
  }
}

export function formatCloudUpdatedAt(value: string) {
  return new Date(value).toLocaleString('ru-RU');
}
