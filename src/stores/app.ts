import { defineStore } from 'pinia';
import { db } from '../db';
import { isCloudSyncConfigured, markCloudSyncPending, saveCloudSnapshot } from '../services/cloudSync';
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
  type LifeEventRecord,
  type MonthlyReview,
  type ResultRecord,
  type WeeklyReview,
} from '../types';
import { normalizeSnapshot, type ExportPayload } from '../features/backup/snapshot';
import { clearFirstUseFunnel } from '../features/first-use/funnel';

export type { ExportPayload } from '../features/backup/snapshot';

type CloudSyncStatus = 'disabled' | 'idle' | 'syncing' | 'synced' | 'pending' | 'conflict' | 'error';

export const useAppStore = defineStore('app', {
  state: () => ({
    loaded: false,
    loadError: '',
    cloudSyncStatus: (isCloudSyncConfigured() ? 'idle' : 'disabled') as CloudSyncStatus,
    cloudSyncMessage: '',
    cloudSyncUpdatedAt: '',
    cloudSyncError: '',
    cloudSyncQueued: false,
    dailyEntries: [] as DailyEntry[],
    results: [] as ResultRecord[],
    lifeEvents: [] as LifeEventRecord[],
    weeklyReviews: [] as WeeklyReview[],
    monthlyReviews: [] as MonthlyReview[],
    settings: structuredClone(defaultSettings) as AppSettings,
  }),
  getters: {
    entryByDate: (state) => (date: string) => state.dailyEntries.find((entry) => entry.date === date),
    reviewByWeek: (state) => (weekStart: string) => state.weeklyReviews.find((review) => review.weekStart === weekStart),
    reviewByMonth: (state) => (monthStart: string) => state.monthlyReviews.find((review) => review.monthStart === monthStart),
  },
  actions: {
    async load() {
      this.loadError = '';
      try {
        const [dailyEntries, results, lifeEvents, weeklyReviews, monthlyReviews, settings] = await Promise.all([
          db.dailyEntries.toArray(),
          db.results.toArray(),
          db.lifeEvents.toArray(),
          db.weeklyReviews.toArray(),
          db.monthlyReviews.toArray(),
          db.settings.get('main'),
        ]);
        this.dailyEntries = dailyEntries.map((entry) => normalizeDailyEntry(entry));
        this.results = results.map((result) => normalizeResult(result)).sort((a, b) => b.date.localeCompare(a.date));
        this.lifeEvents = lifeEvents.map((event) => normalizeLifeEvent(event)).sort((a, b) => b.date.localeCompare(a.date));
        this.weeklyReviews = weeklyReviews.map((review) => normalizeWeeklyReview(review));
        this.monthlyReviews = monthlyReviews.map((review) => normalizeMonthlyReview(review));
        const activeSettings = normalizeSettings(settings);
        this.settings = activeSettings;
        await db.settings.put(plainCopy(activeSettings));
      } catch (error) {
        this.loadError = error instanceof Error ? error.message : 'Не удалось открыть локальное хранилище';
        throw error;
      } finally {
        this.loaded = true;
      }
    },
    async saveEntry(entry: DailyEntry) {
      const saved = plainCopy(normalizeDailyEntry({ ...entry, updatedAt: new Date().toISOString() }));
      await db.dailyEntries.put(saved);
      const index = this.dailyEntries.findIndex((item) => item.date === saved.date);
      if (index >= 0) this.dailyEntries[index] = saved;
      else this.dailyEntries.push(saved);
      void this.syncCloudSnapshot();
      return saved;
    },
    async addResult(result: Omit<ResultRecord, 'id' | 'createdAt'>) {
      const record: ResultRecord = plainCopy(
        normalizeResult({
          ...result,
          createdAt: new Date().toISOString(),
        }),
      );
      const id = await db.results.add(record);
      this.results.unshift({ ...record, id });
      void this.syncCloudSnapshot();
    },
    async updateResult(result: ResultRecord) {
      if (result.id === undefined) return;
      const record = plainCopy(normalizeResult(result));
      await db.results.put(record);
      const index = this.results.findIndex((item) => item.id === record.id);
      if (index >= 0) this.results[index] = record;
      this.results.sort((a, b) => b.date.localeCompare(a.date));
      void this.syncCloudSnapshot();
    },
    async removeResult(id: number) {
      await db.results.delete(id);
      this.results = this.results.filter((result) => result.id !== id);
      void this.syncCloudSnapshot();
    },
    async addLifeEvent(event: Omit<LifeEventRecord, 'id' | 'createdAt'>) {
      const record: LifeEventRecord = plainCopy({
        ...event,
        createdAt: new Date().toISOString(),
      });
      const id = await db.lifeEvents.add(record);
      this.lifeEvents.unshift({ ...record, id });
      this.lifeEvents.sort((a, b) => b.date.localeCompare(a.date));
      void this.syncCloudSnapshot();
    },
    async updateLifeEvent(event: LifeEventRecord) {
      if (event.id === undefined) return;
      const record = plainCopy(event);
      await db.lifeEvents.put(record);
      const index = this.lifeEvents.findIndex((item) => item.id === record.id);
      if (index >= 0) this.lifeEvents[index] = record;
      this.lifeEvents.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      void this.syncCloudSnapshot();
    },
    async removeLifeEvent(id: number) {
      await db.lifeEvents.delete(id);
      this.lifeEvents = this.lifeEvents.filter((event) => event.id !== id);
      void this.syncCloudSnapshot();
    },
    async saveReview(review: WeeklyReview) {
      const plainReview = plainCopy(
        normalizeWeeklyReview({
          ...review,
          updatedAt: new Date().toISOString(),
        }),
      );
      await db.weeklyReviews.put(plainReview);
      const index = this.weeklyReviews.findIndex((item) => item.weekStart === review.weekStart);
      if (index >= 0) this.weeklyReviews[index] = plainReview;
      else this.weeklyReviews.push(plainReview);
      void this.syncCloudSnapshot();
    },
    async saveMonthlyReview(review: MonthlyReview) {
      const plainReview = plainCopy(
        normalizeMonthlyReview({
          ...review,
          updatedAt: new Date().toISOString(),
        }),
      );
      await db.monthlyReviews.put(plainReview);
      const index = this.monthlyReviews.findIndex((item) => item.monthStart === review.monthStart);
      if (index >= 0) this.monthlyReviews[index] = plainReview;
      else this.monthlyReviews.push(plainReview);
      void this.syncCloudSnapshot();
    },
    async saveSettings(settings: AppSettings) {
      const normalized = plainCopy(normalizeSettings(settings));
      await db.settings.put(normalized);
      this.settings = normalized;
      void this.syncCloudSnapshot();
    },
    exportData(): ExportPayload {
      return {
        version: 9,
        exportedAt: new Date().toISOString(),
        dailyEntries: this.dailyEntries,
        results: this.results,
        lifeEvents: this.lifeEvents,
        weeklyReviews: this.weeklyReviews,
        monthlyReviews: this.monthlyReviews,
        settings: this.settings,
      };
    },
    async importData(payload: unknown, options: { syncCloud?: boolean } = {}) {
      const prepared = normalizeSnapshot(payload);
      await db.transaction(
        'rw',
        [db.dailyEntries, db.results, db.lifeEvents, db.weeklyReviews, db.monthlyReviews, db.settings],
        async () => {
          await Promise.all([
            db.dailyEntries.clear(),
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
      );
      await this.load();
      if (options.syncCloud) void this.syncCloudSnapshot({ force: true });
    },
    async clearAll(options: { syncCloud?: boolean } = { syncCloud: true }) {
      await db.transaction(
        'rw',
        [db.dailyEntries, db.results, db.lifeEvents, db.weeklyReviews, db.monthlyReviews, db.settings],
        async () => {
          await Promise.all([
            db.dailyEntries.clear(),
            db.results.clear(),
            db.lifeEvents.clear(),
            db.weeklyReviews.clear(),
            db.monthlyReviews.clear(),
            db.settings.clear(),
          ]);
        },
      );
      this.dailyEntries = [];
      this.results = [];
      this.lifeEvents = [];
      this.weeklyReviews = [];
      this.monthlyReviews = [];
      this.settings = structuredClone(defaultSettings);
      clearFirstUseFunnel();
      await db.settings.put(plainCopy(this.settings));
      if (options.syncCloud) void this.syncCloudSnapshot({ force: true });
    },
    setCloudSyncState(status: CloudSyncStatus, message = '', details: { updatedAt?: string; error?: string } = {}) {
      this.cloudSyncStatus = isCloudSyncConfigured() ? status : 'disabled';
      this.cloudSyncMessage = message;
      this.cloudSyncUpdatedAt = details.updatedAt ?? this.cloudSyncUpdatedAt;
      this.cloudSyncError = details.error ?? '';
    },
    async syncCloudSnapshot(options: { force?: boolean } = {}) {
      if (!isCloudSyncConfigured()) {
        this.setCloudSyncState('disabled');
        return;
      }
      if (this.cloudSyncStatus === 'conflict' && !options.force) return;
      if (this.cloudSyncStatus === 'syncing') {
        this.cloudSyncQueued = true;
        return;
      }

      const userId = useAuthStore().session?.user.id;
      if (userId) markCloudSyncPending(userId, 'Локальные изменения ожидают синхронизации');
      this.setCloudSyncState('syncing', 'Сохраняю облачную копию…');
      do {
        this.cloudSyncQueued = false;
        try {
          const updatedAt = await saveCloudSnapshot(this.exportData());
          this.setCloudSyncState('synced', `Облако обновлено: ${new Date(updatedAt).toLocaleString('ru-RU')}`, { updatedAt });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Не удалось сохранить облачную копию';
          if (userId) markCloudSyncPending(userId, message);
          this.setCloudSyncState('pending', 'Изменения сохранены локально. Облако обновится после повторной синхронизации.', {
            error: message,
          });
          return;
        }
      } while (this.cloudSyncQueued);
    },
    unload() {
      this.loaded = false;
      this.loadError = '';
      this.cloudSyncStatus = isCloudSyncConfigured() ? 'idle' : 'disabled';
      this.cloudSyncMessage = '';
      this.cloudSyncUpdatedAt = '';
      this.cloudSyncError = '';
      this.cloudSyncQueued = false;
      this.dailyEntries = [];
      this.results = [];
      this.lifeEvents = [];
      this.weeklyReviews = [];
      this.monthlyReviews = [];
      this.settings = structuredClone(defaultSettings);
    },
  },
});
