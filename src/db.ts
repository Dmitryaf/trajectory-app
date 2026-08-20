import Dexie, { type EntityTable } from 'dexie';
import type { AppSettings, DailyEntry, DailyEntryDraft, LifeEventRecord, MonthlyReview, ResultRecord, WeeklyReview } from './types';

class TrajectoryDatabase extends Dexie {
  dailyEntries!: EntityTable<DailyEntry, 'date'>;
  dailyEntryDrafts!: EntityTable<DailyEntryDraft, 'date'>;
  results!: EntityTable<ResultRecord, 'id'>;
  lifeEvents!: EntityTable<LifeEventRecord, 'id'>;
  weeklyReviews!: EntityTable<WeeklyReview, 'weekStart'>;
  monthlyReviews!: EntityTable<MonthlyReview, 'monthStart'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor() {
    super('trajectory');
    this.version(1).stores({
      dailyEntries: '&date, updatedAt, careerState',
      results: '++id, date, area, createdAt',
      weeklyReviews: '&weekStart',
      settings: '&id',
    });
    this.version(2).stores({
      dailyEntries: '&date, updatedAt, careerState',
      results: '++id, date, area, createdAt',
      lifeEvents: '++id, date, type, createdAt',
      weeklyReviews: '&weekStart',
      settings: '&id',
    });
    this.version(3).stores({
      dailyEntries: '&date, updatedAt, careerState',
      results: '++id, date, area, createdAt',
      lifeEvents: '++id, date, type, createdAt',
      weeklyReviews: '&weekStart',
      monthlyReviews: '&monthStart',
      settings: '&id',
    });
    this.version(4).stores({
      dailyEntries: '&date, updatedAt, careerState',
      dailyEntryDrafts: '&date, updatedAt',
      results: '++id, date, area, createdAt',
      lifeEvents: '++id, date, type, createdAt',
      weeklyReviews: '&weekStart',
      monthlyReviews: '&monthStart',
      settings: '&id',
    });
  }
}

export const db = new TrajectoryDatabase();
