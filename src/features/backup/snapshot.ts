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
} from '../../types';
import { BACKUP_VERSION } from './version';

export type ExportPayload = {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | typeof BACKUP_VERSION;
  exportedAt: string;
  dailyEntries: DailyEntry[];
  results: ResultRecord[];
  lifeEvents?: LifeEventRecord[];
  weeklyReviews: WeeklyReview[];
  monthlyReviews?: MonthlyReview[];
  settings: AppSettings;
};

type UnknownRecord = Record<string, unknown>;

export function normalizeSnapshot(input: unknown): ExportPayload {
  const source = requireRecord(input, 'резервная копия');
  const version = source.version;
  if (
    version !== 1 &&
    version !== 2 &&
    version !== 3 &&
    version !== 4 &&
    version !== 5 &&
    version !== 6 &&
    version !== 7 &&
    version !== 8 &&
    version !== 9 &&
    version !== 10
  ) {
    throw new Error('Неподдерживаемый формат резервной копии');
  }

  const dailyEntries = requireArray(source.dailyEntries, 'dailyEntries').map((value, index) => {
    const entry = requireRecord(value, `dailyEntries[${index}]`);
    return normalizeDailyEntry({ ...entry, date: requireDate(entry.date, `dailyEntries[${index}].date`) });
  });
  const results = requireArray(source.results, 'results').map((value, index) => normalizeSnapshotResult(value, index));
  const lifeEvents = optionalArray(source.lifeEvents, 'lifeEvents').map((value, index) => {
    const event = requireRecord(value, `lifeEvents[${index}]`);
    return normalizeLifeEvent({
      ...event,
      date: requireDate(event.date, `lifeEvents[${index}].date`),
      title: requireString(event.title, `lifeEvents[${index}].title`),
    });
  });
  const weeklyReviews = optionalArray(source.weeklyReviews, 'weeklyReviews').map((value, index) => {
    const review = requireRecord(value, `weeklyReviews[${index}]`);
    return normalizeWeeklyReview({ ...review, weekStart: requireDate(review.weekStart, `weeklyReviews[${index}].weekStart`) });
  });
  const monthlyReviews = optionalArray(source.monthlyReviews, 'monthlyReviews').map((value, index) => {
    const review = requireRecord(value, `monthlyReviews[${index}]`);
    return normalizeMonthlyReview({ ...review, monthStart: requireDate(review.monthStart, `monthlyReviews[${index}].monthStart`) });
  });
  const settings =
    source.settings === undefined
      ? normalizeSettings({
          ...structuredClone(defaultSettings),
          firstUse: { ...structuredClone(defaultSettings.firstUse), status: 'available' },
        })
      : normalizeSettings(requireRecord(source.settings, 'settings') as Partial<AppSettings>);

  return {
    version,
    exportedAt: typeof source.exportedAt === 'string' ? source.exportedAt : '',
    dailyEntries,
    results,
    lifeEvents,
    weeklyReviews,
    monthlyReviews,
    settings,
  };
}

function normalizeSnapshotResult(value: unknown, index: number): ResultRecord {
  const result = requireRecord(value, `results[${index}]`);
  const id = result.id;
  if (id !== undefined && (!Number.isInteger(id) || (id as number) <= 0)) {
    throw new Error(`Некорректное поле results[${index}].id`);
  }

  return normalizeResult({
    ...(typeof id === 'number' ? { id } : {}),
    date: requireDate(result.date, `results[${index}].date`),
    area: requireString(result.area, `results[${index}].area`) as ResultRecord['area'],
    title: requireString(result.title, `results[${index}].title`),
    note: typeof result.note === 'string' ? result.note : '',
    createdAt: typeof result.createdAt === 'string' ? result.createdAt : '',
  });
}

function requireRecord(value: unknown, field: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Некорректное поле ${field}`);
  }
  return value as UnknownRecord;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Некорректное поле ${field}`);
  return value;
}

function optionalArray(value: unknown, field: string): unknown[] {
  if (value === undefined) return [];
  return requireArray(value, field);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Некорректное поле ${field}`);
  return value;
}

function requireDate(value: unknown, field: string): string {
  const date = requireString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Некорректная дата в ${field}`);
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year!, month! - 1, day!);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month! - 1 || parsed.getDate() !== day) {
    throw new Error(`Некорректная дата в ${field}`);
  }
  return date;
}
