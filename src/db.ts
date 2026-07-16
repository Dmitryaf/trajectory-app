import Dexie, { type EntityTable } from 'dexie';
import type { AppSettings, DailyEntry, ResultRecord, WeeklyReview } from './types';

class TrajectoryDatabase extends Dexie {
  dailyEntries!: EntityTable<DailyEntry, 'date'>;
  results!: EntityTable<ResultRecord, 'id'>;
  weeklyReviews!: EntityTable<WeeklyReview, 'weekStart'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor() {
    super('trajectory');
    this.version(1).stores({
      dailyEntries: '&date, updatedAt, careerState',
      results: '++id, date, area, createdAt',
      weeklyReviews: '&weekStart',
      settings: '&id'
    });
  }
}

export const db = new TrajectoryDatabase();
