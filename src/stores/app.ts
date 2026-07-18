import { defineStore } from 'pinia';
import { db } from '../db';
import { plainCopy } from '../services/plain';
import { defaultSettings, normalizeDailyEntry, normalizeLifeEvent, normalizeMonthlyReview, normalizeSettings, normalizeWeeklyReview, type AppSettings, type DailyEntry, type LifeEventRecord, type MonthlyReview, type ResultRecord, type WeeklyReview } from '../types';

export type ExportPayload = {
  version: 1 | 2 | 3;
  exportedAt: string;
  dailyEntries: DailyEntry[];
  results: ResultRecord[];
  lifeEvents?: LifeEventRecord[];
  weeklyReviews: WeeklyReview[];
  monthlyReviews?: MonthlyReview[];
  settings: AppSettings;
};

export const useAppStore = defineStore('app', {
  state: () => ({
    loaded: false,
    loadError: '',
    dailyEntries: [] as DailyEntry[],
    results: [] as ResultRecord[],
    lifeEvents: [] as LifeEventRecord[],
    weeklyReviews: [] as WeeklyReview[],
    monthlyReviews: [] as MonthlyReview[],
    settings: structuredClone(defaultSettings) as AppSettings
  }),
  getters: {
    entryByDate: (state) => (date: string) => state.dailyEntries.find((entry) => entry.date === date),
    reviewByWeek: (state) => (weekStart: string) => state.weeklyReviews.find((review) => review.weekStart === weekStart),
    reviewByMonth: (state) => (monthStart: string) => state.monthlyReviews.find((review) => review.monthStart === monthStart)
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
          db.settings.get('main')
        ]);
        this.dailyEntries = dailyEntries.map((entry) => normalizeDailyEntry(entry));
        this.results = results.sort((a, b) => b.date.localeCompare(a.date));
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
    },
    async addResult(result: Omit<ResultRecord, 'id' | 'createdAt'>) {
      const record: ResultRecord = plainCopy({ ...result, createdAt: new Date().toISOString() });
      const id = await db.results.add(record);
      this.results.unshift({ ...record, id });
    },
    async updateResult(result: ResultRecord) {
      if (result.id === undefined) return;
      const record = plainCopy(result);
      await db.results.put(record);
      const index = this.results.findIndex((item) => item.id === record.id);
      if (index >= 0) this.results[index] = record;
      this.results.sort((a, b) => b.date.localeCompare(a.date));
    },
    async removeResult(id: number) {
      await db.results.delete(id);
      this.results = this.results.filter((result) => result.id !== id);
    },
    async addLifeEvent(event: Omit<LifeEventRecord, 'id' | 'createdAt'>) {
      const record: LifeEventRecord = plainCopy({ ...event, createdAt: new Date().toISOString() });
      const id = await db.lifeEvents.add(record);
      this.lifeEvents.unshift({ ...record, id });
      this.lifeEvents.sort((a, b) => b.date.localeCompare(a.date));
    },
    async updateLifeEvent(event: LifeEventRecord) {
      if (event.id === undefined) return;
      const record = plainCopy(event);
      await db.lifeEvents.put(record);
      const index = this.lifeEvents.findIndex((item) => item.id === record.id);
      if (index >= 0) this.lifeEvents[index] = record;
      this.lifeEvents.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    },
    async removeLifeEvent(id: number) {
      await db.lifeEvents.delete(id);
      this.lifeEvents = this.lifeEvents.filter((event) => event.id !== id);
    },
    async saveReview(review: WeeklyReview) {
      const plainReview = plainCopy(normalizeWeeklyReview({ ...review, updatedAt: new Date().toISOString() }));
      await db.weeklyReviews.put(plainReview);
      const index = this.weeklyReviews.findIndex((item) => item.weekStart === review.weekStart);
      if (index >= 0) this.weeklyReviews[index] = plainReview;
      else this.weeklyReviews.push(plainReview);
    },
    async saveMonthlyReview(review: MonthlyReview) {
      const plainReview = plainCopy(normalizeMonthlyReview({ ...review, updatedAt: new Date().toISOString() }));
      await db.monthlyReviews.put(plainReview);
      const index = this.monthlyReviews.findIndex((item) => item.monthStart === review.monthStart);
      if (index >= 0) this.monthlyReviews[index] = plainReview;
      else this.monthlyReviews.push(plainReview);
    },
    async saveSettings(settings: AppSettings) {
      await db.settings.put(plainCopy(settings));
      this.settings = plainCopy(settings);
    },
    exportData(): ExportPayload {
      return {
        version: 3,
        exportedAt: new Date().toISOString(),
        dailyEntries: this.dailyEntries,
        results: this.results,
        lifeEvents: this.lifeEvents,
        weeklyReviews: this.weeklyReviews,
        monthlyReviews: this.monthlyReviews,
        settings: this.settings
      };
    },
    async importData(payload: ExportPayload) {
      if (![1, 2, 3].includes(payload.version) || !Array.isArray(payload.dailyEntries) || !Array.isArray(payload.results)) {
        throw new Error('Неподдерживаемый формат резервной копии');
      }
      await db.transaction('rw', [db.dailyEntries, db.results, db.lifeEvents, db.weeklyReviews, db.monthlyReviews, db.settings], async () => {
        await Promise.all([db.dailyEntries.clear(), db.results.clear(), db.lifeEvents.clear(), db.weeklyReviews.clear(), db.monthlyReviews.clear(), db.settings.clear()]);
        await db.dailyEntries.bulkPut(payload.dailyEntries.map((entry) => normalizeDailyEntry(entry)));
        await db.results.bulkPut(payload.results);
        await db.lifeEvents.bulkPut((payload.lifeEvents ?? []).map((event) => normalizeLifeEvent(event)));
        await db.weeklyReviews.bulkPut((payload.weeklyReviews ?? []).map((review) => normalizeWeeklyReview(review)));
        await db.monthlyReviews.bulkPut((payload.monthlyReviews ?? []).map((review) => normalizeMonthlyReview(review)));
        await db.settings.put(plainCopy(normalizeSettings(payload.settings ?? defaultSettings)));
      });
      await this.load();
    },
    async clearAll() {
      await db.transaction('rw', [db.dailyEntries, db.results, db.lifeEvents, db.weeklyReviews, db.monthlyReviews, db.settings], async () => {
        await Promise.all([db.dailyEntries.clear(), db.results.clear(), db.lifeEvents.clear(), db.weeklyReviews.clear(), db.monthlyReviews.clear(), db.settings.clear()]);
      });
      this.dailyEntries = [];
      this.results = [];
      this.lifeEvents = [];
      this.weeklyReviews = [];
      this.monthlyReviews = [];
      this.settings = structuredClone(defaultSettings);
      await db.settings.put(plainCopy(this.settings));
    }
  }
});
