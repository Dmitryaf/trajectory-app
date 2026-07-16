import { defineStore } from 'pinia';
import { db } from '../db';
import { plainCopy } from '../services/plain';
import { defaultSettings, normalizeDailyEntry, normalizeSettings, normalizeWeeklyReview, type AppSettings, type DailyEntry, type ResultRecord, type WeeklyReview } from '../types';

type ExportPayload = {
  version: 1;
  exportedAt: string;
  dailyEntries: DailyEntry[];
  results: ResultRecord[];
  weeklyReviews: WeeklyReview[];
  settings: AppSettings;
};

export const useAppStore = defineStore('app', {
  state: () => ({
    loaded: false,
    loadError: '',
    dailyEntries: [] as DailyEntry[],
    results: [] as ResultRecord[],
    weeklyReviews: [] as WeeklyReview[],
    settings: structuredClone(defaultSettings) as AppSettings
  }),
  getters: {
    entryByDate: (state) => (date: string) => state.dailyEntries.find((entry) => entry.date === date),
    reviewByWeek: (state) => (weekStart: string) => state.weeklyReviews.find((review) => review.weekStart === weekStart)
  },
  actions: {
    async load() {
      this.loadError = '';
      try {
        const [dailyEntries, results, weeklyReviews, settings] = await Promise.all([
          db.dailyEntries.toArray(),
          db.results.toArray(),
          db.weeklyReviews.toArray(),
          db.settings.get('main')
        ]);
        this.dailyEntries = dailyEntries.map((entry) => normalizeDailyEntry(entry));
        this.results = results.sort((a, b) => b.date.localeCompare(a.date));
        this.weeklyReviews = weeklyReviews.map((review) => normalizeWeeklyReview(review));
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
    },
    async addResult(result: Omit<ResultRecord, 'id' | 'createdAt'>) {
      const record: ResultRecord = plainCopy({ ...result, createdAt: new Date().toISOString() });
      const id = await db.results.add(record);
      this.results.unshift({ ...record, id });
    },
    async removeResult(id: number) {
      await db.results.delete(id);
      this.results = this.results.filter((result) => result.id !== id);
    },
    async saveReview(review: WeeklyReview) {
      const plainReview = plainCopy(normalizeWeeklyReview(review));
      await db.weeklyReviews.put(plainReview);
      const index = this.weeklyReviews.findIndex((item) => item.weekStart === review.weekStart);
      if (index >= 0) this.weeklyReviews[index] = plainReview;
      else this.weeklyReviews.push(plainReview);
    },
    async saveSettings(settings: AppSettings) {
      await db.settings.put(plainCopy(settings));
      this.settings = plainCopy(settings);
    },
    exportData(): ExportPayload {
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        dailyEntries: this.dailyEntries,
        results: this.results,
        weeklyReviews: this.weeklyReviews,
        settings: this.settings
      };
    },
    async importData(payload: ExportPayload) {
      if (payload.version !== 1 || !Array.isArray(payload.dailyEntries) || !Array.isArray(payload.results)) {
        throw new Error('Неподдерживаемый формат резервной копии');
      }
      await db.transaction('rw', [db.dailyEntries, db.results, db.weeklyReviews, db.settings], async () => {
        await Promise.all([db.dailyEntries.clear(), db.results.clear(), db.weeklyReviews.clear(), db.settings.clear()]);
        await db.dailyEntries.bulkPut(payload.dailyEntries.map((entry) => normalizeDailyEntry(entry)));
        await db.results.bulkPut(payload.results);
        await db.weeklyReviews.bulkPut((payload.weeklyReviews ?? []).map((review) => normalizeWeeklyReview(review)));
        await db.settings.put(plainCopy(normalizeSettings(payload.settings ?? defaultSettings)));
      });
      await this.load();
    },
    async clearAll() {
      await db.transaction('rw', [db.dailyEntries, db.results, db.weeklyReviews, db.settings], async () => {
        await Promise.all([db.dailyEntries.clear(), db.results.clear(), db.weeklyReviews.clear(), db.settings.clear()]);
      });
      this.dailyEntries = [];
      this.results = [];
      this.weeklyReviews = [];
      this.settings = structuredClone(defaultSettings);
      await db.settings.put(plainCopy(this.settings));
    }
  }
});
