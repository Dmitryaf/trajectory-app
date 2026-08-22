import { defineStore } from 'pinia';
import { db } from '../db';
import {
  CloudRevisionConflictError,
  getCloudSyncMeta,
  isCloudSyncConfigured,
  loadCloudSnapshot,
  markCloudSyncPending,
  saveCloudSnapshot,
} from '../services/cloudSync';
import { plainCopy } from '../services/plain';
import { useAuthStore } from './auth';
import {
  defaultSettings,
  normalizeDailyEntry,
  normalizeLifeEvent,
  normalizeMonthlyReview,
  normalizeResult,
  normalizeSettings,
  normalizeWeeklyReview,
  type AppSettings,
  type DailyEntry,
  type DailyEntryDraft,
  type LifeEventRecord,
  type MonthlyReview,
  type ResultRecord,
  type WeeklyReview,
} from '../types';
import { normalizeSnapshot, type ExportPayload } from '../features/backup/snapshot';
import { BACKUP_VERSION } from '../features/backup/version';
import { clearFirstUseFunnel } from '../features/first-use/funnel';
import { experimentEntryLinkError, experimentIntegrityError, linkLegacyExperimentEntries } from '../features/experiments/model';
import { validDate } from '../model/normalization';
import { startOfMonth, startOfWeek } from '../services/dates';
import { loadCloudSyncBase, saveCloudSyncBase } from '../features/sync/base';
import { mergeCloudSnapshots } from '../features/sync/merge';
import {
  checkStoragePersistence,
  requestStoragePersistence,
  runStorageWrite,
  type StoragePersistenceStatus,
} from '../services/storageProtection';

export type { ExportPayload } from '../features/backup/snapshot';

type CloudSyncStatus = 'disabled' | 'idle' | 'syncing' | 'synced' | 'pending' | 'conflict' | 'error';

export type CloudSyncResult =
  { status: 'synced'; updatedAt: string } | { status: 'pending'; error: string } | { status: 'disabled' | 'conflict' | 'queued' };

export const useAppStore = defineStore('app', {
  state: () => ({
    loaded: false,
    loadError: '',
    cloudSyncStatus: (isCloudSyncConfigured() ? 'idle' : 'disabled') as CloudSyncStatus,
    cloudSyncMessage: '',
    cloudSyncUpdatedAt: '',
    cloudSyncError: '',
    cloudSyncQueued: false,
    storagePersistenceStatus: 'unknown' as StoragePersistenceStatus,
    storagePersistenceRequested: false,
    storagePersistenceRevision: 0,
    dailyEntries: [] as DailyEntry[],
    dailyEntryDrafts: [] as DailyEntryDraft[],
    results: [] as ResultRecord[],
    lifeEvents: [] as LifeEventRecord[],
    weeklyReviews: [] as WeeklyReview[],
    monthlyReviews: [] as MonthlyReview[],
    settings: structuredClone(defaultSettings) as AppSettings,
  }),
  getters: {
    entryByDate: (state) => (date: string) => state.dailyEntries.find((entry) => entry.date === date),
    draftByDate: (state) => (date: string) => state.dailyEntryDrafts.find((draft) => draft.date === date),
    reviewByWeek: (state) => (weekStart: string) => state.weeklyReviews.find((review) => review.weekStart === weekStart),
    reviewByMonth: (state) => (monthStart: string) => state.monthlyReviews.find((review) => review.monthStart === monthStart),
  },
  actions: {
    async load() {
      this.loadError = '';
      try {
        const [dailyEntries, dailyEntryDrafts, results, lifeEvents, weeklyReviews, monthlyReviews, settings] = await Promise.all([
          db.dailyEntries.toArray(),
          db.dailyEntryDrafts.toArray(),
          db.results.toArray(),
          db.lifeEvents.toArray(),
          db.weeklyReviews.toArray(),
          db.monthlyReviews.toArray(),
          db.settings.get('main'),
        ]);
        const activeSettings = normalizeSettings(settings);
        const normalizedEntries = dailyEntries.map((entry) => normalizeDailyEntry(entry));
        const linkedEntries = linkLegacyExperimentEntries(normalizedEntries, activeSettings);
        const normalizedDrafts = dailyEntryDrafts.map((draft) => ({
          ...draft,
          entry: normalizeDailyEntry(draft.entry),
        }));
        const linkedDrafts = normalizedDrafts.map((draft) => {
          const linkedEntry = linkLegacyExperimentEntries([draft.entry], activeSettings)[0]!;
          return {
            ...draft,
            entry: experimentEntryLinkError([linkedEntry], activeSettings) ? { ...linkedEntry, experimentId: null } : linkedEntry,
          };
        });
        this.dailyEntries = linkedEntries;
        this.dailyEntryDrafts = linkedDrafts;
        this.results = results.map((result) => normalizeResult(result)).sort((a, b) => b.date.localeCompare(a.date));
        this.lifeEvents = lifeEvents.map((event) => normalizeLifeEvent(event)).sort((a, b) => b.date.localeCompare(a.date));
        this.weeklyReviews = weeklyReviews.map((review) => normalizeWeeklyReview(review));
        this.monthlyReviews = monthlyReviews.map((review) => normalizeMonthlyReview(review));
        this.settings = activeSettings;
        await runStorageWrite(() =>
          db.transaction('rw', [db.dailyEntries, db.dailyEntryDrafts, db.settings], async () => {
            await Promise.all([
              linkedEntries.length ? db.dailyEntries.bulkPut(plainCopy(linkedEntries)) : Promise.resolve(),
              linkedDrafts.length ? db.dailyEntryDrafts.bulkPut(plainCopy(linkedDrafts)) : Promise.resolve(),
              db.settings.put(plainCopy(activeSettings)),
            ]);
          }),
        );
        void this.checkLocalStoragePersistence();
      } catch (error) {
        this.loadError = error instanceof Error ? error.message : 'Не удалось открыть локальное хранилище';
        throw error;
      } finally {
        this.loaded = true;
      }
    },
    async saveEntry(entry: DailyEntry) {
      if (!validDate(entry.date)) {
        throw new Error('Укажите корректную дату записи');
      }
      const saved = plainCopy(normalizeDailyEntry({ ...entry, updatedAt: new Date().toISOString() }));
      const entryLinkError = experimentEntryLinkError([saved], this.settings);
      if (entryLinkError) {
        throw new Error(entryLinkError);
      }
      await runStorageWrite(() =>
        db.transaction('rw', [db.dailyEntries, db.dailyEntryDrafts], async () => {
          await db.dailyEntries.put(saved);
          await db.dailyEntryDrafts.delete(saved.date);
        }),
      );
      const index = this.dailyEntries.findIndex((item) => item.date === saved.date);
      if (index >= 0) {
        this.dailyEntries[index] = saved;
      } else {
        this.dailyEntries.push(saved);
      }
      this.dailyEntryDrafts = this.dailyEntryDrafts.filter((draft) => draft.date !== saved.date);
      void this.requestLocalStoragePersistence();
      void this.syncCloudSnapshot();
      return saved;
    },
    async saveDailyEntryDraft(entry: DailyEntry) {
      if (!validDate(entry.date)) {
        throw new Error('Укажите корректную дату черновика');
      }
      const normalizedEntry = plainCopy(normalizeDailyEntry(entry));
      const entryLinkError = experimentEntryLinkError([normalizedEntry], this.settings);
      if (entryLinkError) {
        throw new Error(entryLinkError);
      }
      const draft: DailyEntryDraft = {
        date: normalizedEntry.date,
        entry: normalizedEntry,
        updatedAt: new Date().toISOString(),
      };
      await runStorageWrite(() => db.dailyEntryDrafts.put(draft));
      const index = this.dailyEntryDrafts.findIndex((item) => item.date === draft.date);
      if (index >= 0) {
        this.dailyEntryDrafts[index] = draft;
      } else {
        this.dailyEntryDrafts.push(draft);
      }
      return draft;
    },
    async removeDailyEntryDraft(date: string) {
      await runStorageWrite(() => db.dailyEntryDrafts.delete(date));
      this.dailyEntryDrafts = this.dailyEntryDrafts.filter((draft) => draft.date !== date);
    },
    async addResult(result: Omit<ResultRecord, 'id' | 'createdAt'>) {
      if (!validDate(result.date)) {
        throw new Error('Укажите корректную дату итога');
      }
      const record: ResultRecord = plainCopy(
        normalizeResult({
          ...result,
          createdAt: new Date().toISOString(),
        }),
      );
      const id = await runStorageWrite(() => db.results.add(record));
      this.results.unshift({ ...record, id });
      void this.requestLocalStoragePersistence();
      void this.syncCloudSnapshot();
    },
    async updateResult(result: ResultRecord) {
      if (result.id === undefined) {
        return;
      }
      if (!validDate(result.date)) {
        throw new Error('Укажите корректную дату итога');
      }
      const record = plainCopy(normalizeResult(result));
      await runStorageWrite(() => db.results.put(record));
      const index = this.results.findIndex((item) => item.id === record.id);
      if (index >= 0) {
        this.results[index] = record;
      }
      this.results.sort((a, b) => b.date.localeCompare(a.date));
      void this.requestLocalStoragePersistence();
      void this.syncCloudSnapshot();
    },
    async removeResult(id: number) {
      await runStorageWrite(() => db.results.delete(id));
      this.results = this.results.filter((result) => result.id !== id);
      void this.requestLocalStoragePersistence();
      void this.syncCloudSnapshot();
    },
    async addLifeEvent(event: Omit<LifeEventRecord, 'id' | 'createdAt'>) {
      if (!validDate(event.date)) {
        throw new Error('Укажите корректную дату события');
      }
      const record: LifeEventRecord = plainCopy(
        normalizeLifeEvent({
          ...event,
          createdAt: new Date().toISOString(),
        }),
      );
      const id = await runStorageWrite(() => db.lifeEvents.add(record));
      this.lifeEvents.unshift({ ...record, id });
      this.lifeEvents.sort((a, b) => b.date.localeCompare(a.date));
      void this.requestLocalStoragePersistence();
      void this.syncCloudSnapshot();
    },
    async updateLifeEvent(event: LifeEventRecord) {
      if (event.id === undefined) {
        return;
      }
      if (!validDate(event.date)) {
        throw new Error('Укажите корректную дату события');
      }
      const record = plainCopy(normalizeLifeEvent(event));
      await runStorageWrite(() => db.lifeEvents.put(record));
      const index = this.lifeEvents.findIndex((item) => item.id === record.id);
      if (index >= 0) {
        this.lifeEvents[index] = record;
      }
      this.lifeEvents.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      void this.requestLocalStoragePersistence();
      void this.syncCloudSnapshot();
    },
    async removeLifeEvent(id: number) {
      await runStorageWrite(() => db.lifeEvents.delete(id));
      this.lifeEvents = this.lifeEvents.filter((event) => event.id !== id);
      void this.requestLocalStoragePersistence();
      void this.syncCloudSnapshot();
    },
    async saveReview(review: WeeklyReview) {
      if (!validDate(review.weekStart) || startOfWeek(review.weekStart) !== review.weekStart) {
        throw new Error('Начало недельного обзора должно быть понедельником');
      }
      const plainReview = plainCopy(
        normalizeWeeklyReview({
          ...review,
          updatedAt: new Date().toISOString(),
        }),
      );
      await runStorageWrite(() => db.weeklyReviews.put(plainReview));
      const index = this.weeklyReviews.findIndex((item) => item.weekStart === review.weekStart);
      if (index >= 0) {
        this.weeklyReviews[index] = plainReview;
      } else {
        this.weeklyReviews.push(plainReview);
      }
      void this.requestLocalStoragePersistence();
      void this.syncCloudSnapshot();
    },
    async saveMonthlyReview(review: MonthlyReview) {
      if (!validDate(review.monthStart) || startOfMonth(review.monthStart) !== review.monthStart) {
        throw new Error('Начало месячного обзора должно быть первым днём месяца');
      }
      const plainReview = plainCopy(
        normalizeMonthlyReview({
          ...review,
          updatedAt: new Date().toISOString(),
        }),
      );
      await runStorageWrite(() => db.monthlyReviews.put(plainReview));
      const index = this.monthlyReviews.findIndex((item) => item.monthStart === review.monthStart);
      if (index >= 0) {
        this.monthlyReviews[index] = plainReview;
      } else {
        this.monthlyReviews.push(plainReview);
      }
      void this.requestLocalStoragePersistence();
      void this.syncCloudSnapshot();
    },
    async saveSettings(settings: AppSettings) {
      const integrityError = experimentIntegrityError(settings);
      if (integrityError) {
        throw new Error(integrityError);
      }
      const normalized = plainCopy(normalizeSettings(settings));
      const entryLinkError = experimentEntryLinkError(this.dailyEntries, normalized);
      if (entryLinkError) {
        throw new Error(entryLinkError);
      }
      await runStorageWrite(() => db.settings.put(normalized));
      this.settings = normalized;
      void this.requestLocalStoragePersistence();
      void this.syncCloudSnapshot();
    },
    exportData(): ExportPayload {
      return {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        dailyEntries: this.dailyEntries,
        results: this.results,
        lifeEvents: this.lifeEvents,
        weeklyReviews: this.weeklyReviews,
        monthlyReviews: this.monthlyReviews,
        settings: this.settings,
      };
    },
    async importData(payload: unknown, options: { syncCloud?: boolean; preserveDailyDrafts?: boolean } = {}) {
      const prepared = normalizeSnapshot(payload);
      await runStorageWrite(() =>
        db.transaction(
          'rw',
          [db.dailyEntries, db.dailyEntryDrafts, db.results, db.lifeEvents, db.weeklyReviews, db.monthlyReviews, db.settings],
          async () => {
            await Promise.all([
              db.dailyEntries.clear(),
              options.preserveDailyDrafts ? Promise.resolve() : db.dailyEntryDrafts.clear(),
              db.results.clear(),
              db.lifeEvents.clear(),
              db.weeklyReviews.clear(),
              db.monthlyReviews.clear(),
              db.settings.clear(),
            ]);
            await db.dailyEntries.bulkPut(prepared.dailyEntries);
            await db.results.bulkPut(prepared.results);
            await db.lifeEvents.bulkPut(prepared.lifeEvents ?? []);
            await db.weeklyReviews.bulkPut(prepared.weeklyReviews);
            await db.monthlyReviews.bulkPut(prepared.monthlyReviews ?? []);
            await db.settings.put(plainCopy(prepared.settings));
          },
        ),
      );
      await this.load();
      void this.requestLocalStoragePersistence();
      if (options.syncCloud) {
        void this.syncCloudSnapshot({ force: true });
      }
    },
    async clearAll(options: { syncCloud?: boolean } = { syncCloud: true }) {
      await runStorageWrite(() =>
        db.transaction(
          'rw',
          [
            db.dailyEntries,
            db.dailyEntryDrafts,
            db.results,
            db.lifeEvents,
            db.weeklyReviews,
            db.monthlyReviews,
            db.settings,
            db.cloudSyncBases,
          ],
          async () => {
            await Promise.all([
              db.dailyEntries.clear(),
              db.dailyEntryDrafts.clear(),
              db.results.clear(),
              db.lifeEvents.clear(),
              db.weeklyReviews.clear(),
              db.monthlyReviews.clear(),
              db.settings.clear(),
              options.syncCloud ? Promise.resolve() : db.cloudSyncBases.clear(),
            ]);
          },
        ),
      );
      this.dailyEntries = [];
      this.dailyEntryDrafts = [];
      this.results = [];
      this.lifeEvents = [];
      this.weeklyReviews = [];
      this.monthlyReviews = [];
      this.settings = structuredClone(defaultSettings);
      clearFirstUseFunnel();
      await runStorageWrite(() => db.settings.put(plainCopy(this.settings)));
      if (options.syncCloud) {
        void this.syncCloudSnapshot({ force: true });
      }
    },
    setCloudSyncState(status: CloudSyncStatus, message = '', details: { updatedAt?: string; error?: string } = {}) {
      this.cloudSyncStatus = isCloudSyncConfigured() ? status : 'disabled';
      this.cloudSyncMessage = message;
      this.cloudSyncUpdatedAt = details.updatedAt ?? this.cloudSyncUpdatedAt;
      this.cloudSyncError = details.error ?? '';
    },
    async checkLocalStoragePersistence() {
      const revision = ++this.storagePersistenceRevision;
      this.storagePersistenceStatus = 'checking';
      const status = await checkStoragePersistence();
      if (revision === this.storagePersistenceRevision) {
        this.storagePersistenceStatus = status;
      }
      return status;
    },
    async requestLocalStoragePersistence() {
      if (this.storagePersistenceRequested || this.storagePersistenceStatus === 'persisted') {
        return this.storagePersistenceStatus;
      }
      this.storagePersistenceRequested = true;
      const revision = ++this.storagePersistenceRevision;
      this.storagePersistenceStatus = 'checking';
      const status = await requestStoragePersistence();
      if (revision === this.storagePersistenceRevision) {
        this.storagePersistenceStatus = status;
      }
      return status;
    },
    async syncCloudSnapshot(options: { force?: boolean } = {}) {
      void options;
      if (!isCloudSyncConfigured()) {
        this.setCloudSyncState('disabled');
        return { status: 'disabled' } as CloudSyncResult;
      }
      if (this.cloudSyncStatus === 'syncing') {
        this.cloudSyncQueued = true;
        return { status: 'queued' } as CloudSyncResult;
      }

      const userId = useAuthStore().session?.user.id;
      if (userId) {
        markCloudSyncPending(userId, 'Локальные изменения ожидают синхронизации');
      }
      this.setCloudSyncState('syncing', 'Сохраняю облачную копию…');
      let updatedAt = '';
      do {
        this.cloudSyncQueued = false;
        try {
          let payload = this.exportData();
          let expectedRevision = userId ? getCloudSyncMeta(userId).lastCloudRevision : 0;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              const saved = await saveCloudSnapshot(payload, expectedRevision);
              updatedAt = saved.updatedAt;
              if (userId) {
                await saveCloudSyncBase(userId, saved.revision ?? expectedRevision + 1, saved.payload);
              }
              break;
            } catch (error) {
              if (!(error instanceof CloudRevisionConflictError) || !userId || attempt === 2) {
                throw error;
              }
              const remote = await loadCloudSnapshot();
              if (!remote) {
                expectedRevision = 0;
                continue;
              }
              const base = await loadCloudSyncBase(userId);
              payload = mergeCloudSnapshots(base?.snapshot ?? emptyExportPayload(), payload, remote.payload);
              await this.importData(payload, { syncCloud: false, preserveDailyDrafts: true });
              expectedRevision = remote.revision ?? 1;
            }
          }
          this.setCloudSyncState('synced', `Облако обновлено: ${new Date(updatedAt).toLocaleString('ru-RU')}`, { updatedAt });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Не удалось сохранить облачную копию';
          if (userId) {
            markCloudSyncPending(userId, message);
          }
          this.setCloudSyncState('pending', 'Изменения сохранены локально. Облако обновится после повторной синхронизации.', {
            error: message,
          });
          return { status: 'pending', error: message } as CloudSyncResult;
        }
      } while (this.cloudSyncQueued);
      return { status: 'synced', updatedAt } as CloudSyncResult;
    },
    unload() {
      this.loaded = false;
      this.loadError = '';
      this.cloudSyncStatus = isCloudSyncConfigured() ? 'idle' : 'disabled';
      this.cloudSyncMessage = '';
      this.cloudSyncUpdatedAt = '';
      this.cloudSyncError = '';
      this.cloudSyncQueued = false;
      this.storagePersistenceStatus = 'unknown';
      this.storagePersistenceRequested = false;
      this.storagePersistenceRevision = 0;
      this.dailyEntries = [];
      this.dailyEntryDrafts = [];
      this.results = [];
      this.lifeEvents = [];
      this.weeklyReviews = [];
      this.monthlyReviews = [];
      this.settings = structuredClone(defaultSettings);
    },
  },
});

function emptyExportPayload(): ExportPayload {
  return {
    version: BACKUP_VERSION,
    exportedAt: '',
    dailyEntries: [],
    results: [],
    lifeEvents: [],
    weeklyReviews: [],
    monthlyReviews: [],
    settings: structuredClone(defaultSettings),
  };
}
