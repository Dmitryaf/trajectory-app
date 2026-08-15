import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { useAppStore, type ExportPayload } from '../../src/stores/app';
import { defaultSettings, emptyDailyEntry, emptyWeeklyReview } from '../../src/types';

beforeEach(async () => {
  await db.delete();
  await db.open();
  setActivePinia(createPinia());
});

afterAll(async () => {
  await db.delete();
});

describe('backup import', () => {
  it('keeps a daily draft local, restores it on load, and removes it when the day is saved', async () => {
    const store = useAppStore();
    const draftEntry = {
      ...emptyDailyEntry('2026-07-21'),
      importantFact: 'Несохранённая мысль',
    };

    await store.saveDailyEntryDraft(draftEntry);
    expect(store.draftByDate('2026-07-21')?.entry.importantFact).toBe('Несохранённая мысль');
    const cloudPayload = store.exportData();
    expect(cloudPayload).not.toHaveProperty('dailyEntryDrafts');

    await store.importData(cloudPayload, { syncCloud: false, preserveDailyDrafts: true });
    expect(store.draftByDate('2026-07-21')?.entry.importantFact).toBe('Несохранённая мысль');

    store.unload();
    await store.load();
    expect(store.draftByDate('2026-07-21')?.entry.importantFact).toBe('Несохранённая мысль');

    await store.saveEntry(draftEntry);
    expect(store.draftByDate('2026-07-21')).toBeUndefined();
    expect(await db.dailyEntryDrafts.get('2026-07-21')).toBeUndefined();
    expect(store.entryByDate('2026-07-21')?.importantFact).toBe('Несохранённая мысль');

    await store.saveDailyEntryDraft({ ...emptyDailyEntry('2026-07-22'), importantFact: 'Личный черновик' });
    await store.clearAll({ syncCloud: false });
    expect(store.dailyEntryDrafts).toEqual([]);
    expect(await db.dailyEntryDrafts.count()).toBe(0);
  });

  it('returns the normalized daily entry that was actually stored', async () => {
    const store = useAppStore();
    const saved = await store.saveEntry({
      ...emptyDailyEntry('2026-07-21'),
      careerState: 'preparation',
      careerStates: ['external'],
      sleepMinutes: 24 * 60 + 1,
      updatedAt: '',
    });

    expect(saved).toMatchObject({
      date: '2026-07-21',
      careerState: 'external',
      careerStates: ['external'],
      sleepMinutes: null,
    });
    expect(saved.updatedAt).not.toBe('');
    expect(store.entryByDate('2026-07-21')).toEqual(saved);
    expect(await db.dailyEntries.get('2026-07-21')).toEqual(saved);
  });

  it('replaces current data and migrates a version 1 backup to the current model', async () => {
    await db.dailyEntries.put({
      ...emptyDailyEntry('2026-07-21'),
      importantFact: 'Эта запись должна быть заменена',
      updatedAt: '2026-07-21T10:00:00.000Z',
    });

    const oldBackup = {
      version: 1,
      exportedAt: '2025-02-02T10:00:00.000Z',
      dailyEntries: [
        {
          date: '2025-02-01',
          bedtime: '23:40',
          wakeTime: '07:30',
          sleepMinutes: 430,
          sleepQuality: 4,
          energy: 3,
          careerState: 'external',
          activities: ['walk'],
          nutritionState: 'neutral',
          lifeAreas: ['family'],
          importantFact: 'Старая запись сохранена',
          experimentCompleted: null,
          updatedAt: '2025-02-01T20:00:00.000Z',
        },
      ],
      results: [
        {
          id: 1,
          date: '2025-02-01',
          area: 'career',
          title: 'Получен ответ',
          createdAt: '2025-02-01T20:00:00.000Z',
        },
      ],
      weeklyReviews: [
        {
          weekStart: '2025-01-27',
          results: ['Получен ответ'],
          support: 'Режим',
          obstacle: '',
          nextLever: 'Продолжить',
          updatedAt: '2025-02-02T20:00:00.000Z',
        },
      ],
      settings: {
        id: 'main',
        settingsVersion: 1,
        activeLifeAreas: ['family', 'spiritual'],
      },
    } as unknown as ExportPayload;

    const store = useAppStore();
    await store.importData(oldBackup, { syncCloud: false });

    expect(store.dailyEntries).toHaveLength(1);
    expect(store.dailyEntries[0]).toMatchObject({
      date: '2025-02-01',
      careerState: 'external',
      careerStates: ['external'],
      activitiesRecorded: true,
      lifeAreasRecorded: true,
      contextFactorsRecorded: false,
      timeInBedMinutes: null,
      importantFact: 'Старая запись сохранена',
    });
    expect(store.results).toHaveLength(1);
    expect(store.results[0].note).toBe('');
    expect(store.lifeEvents).toEqual([]);
    expect(store.monthlyReviews).toEqual([]);
    expect(store.weeklyReviews[0].ifThenPlan).toBe('');
    expect(store.weeklyReviews[0].highlights).toEqual(['', '', '']);
    expect(store.weeklyReviews[0].stateContext).toBe('');
    expect(store.settings.settingsVersion).toBe(13);
    expect(store.settings.firstUse.status).toBe('available');
    expect(store.settings.activeDailyBlocks).toEqual(['sleep', 'context', 'career', 'movement', 'nutrition']);
    expect(store.settings.activeLifeAreas).toEqual(['family']);

    const storedDates = await db.dailyEntries.toCollection().primaryKeys();
    expect(storedDates).toEqual(['2025-02-01']);

    const exported = store.exportData();
    expect(exported.version).toBe(10);
    expect(exported).not.toHaveProperty('firstUseFunnel');
    expect(exported.dailyEntries[0].careerStates).toEqual(['external']);
    expect(exported.monthlyReviews).toEqual([]);
  });

  it('round-trips approximate weekly highlights and state context', async () => {
    const store = useAppStore();
    await store.saveReview({
      ...emptyWeeklyReview('2026-07-20'),
      coveredThrough: '2026-07-24',
      highlights: ['Важный разговор изменил планы', 'Появилась новая мысль о проекте', ''],
      stateContext: 'Неделя была тяжёлой из-за болезни и нехватки сна.',
    });
    await store.saveSettings({
      ...store.settings,
      firstUse: {
        status: 'in_progress',
        weekStart: '2026-07-20',
        periodEnd: '2026-07-24',
        lastStep: 'state_context',
        overviewSeen: false,
        updatedAt: '2026-07-27T10:00:00.000Z',
      },
    });

    const exported = store.exportData();
    expect(exported.version).toBe(10);
    expect(exported.weeklyReviews[0]).toMatchObject({
      highlights: ['Важный разговор изменил планы', 'Появилась новая мысль о проекте', ''],
      stateContext: 'Неделя была тяжёлой из-за болезни и нехватки сна.',
      coveredThrough: '2026-07-24',
    });

    await store.clearAll({ syncCloud: false });
    await store.importData(exported, { syncCloud: false });

    expect(store.weeklyReviews[0]).toMatchObject({
      highlights: ['Важный разговор изменил планы', 'Появилась новая мысль о проекте', ''],
      stateContext: 'Неделя была тяжёлой из-за болезни и нехватки сна.',
      coveredThrough: '2026-07-24',
    });
    expect(store.settings.firstUse).toMatchObject({
      status: 'in_progress',
      weekStart: '2026-07-20',
      periodEnd: '2026-07-24',
      lastStep: 'state_context',
    });
  });

  it('rejects an unsupported backup before clearing current data', async () => {
    const store = useAppStore();
    await store.saveEntry({
      ...emptyDailyEntry('2026-07-21'),
      importantFact: 'Не удалять',
      updatedAt: '',
    });

    await expect(store.importData({ version: 99 } as unknown as ExportPayload)).rejects.toThrow('Неподдерживаемый формат резервной копии');

    expect(await db.dailyEntries.get('2026-07-21')).toMatchObject({ importantFact: 'Не удалять' });
  });

  it('treats an old backup without settings as an existing user without changing current defaults', async () => {
    const store = useAppStore();
    await store.importData({
      version: 1,
      exportedAt: '2025-02-02T10:00:00.000Z',
      dailyEntries: [],
      results: [],
      weeklyReviews: [],
    });

    expect(store.settings.firstUse.status).toBe('available');
    expect(store.settings.activeDailyBlocks).toEqual(defaultSettings.activeDailyBlocks);
    expect(store.settings.activeLifeAreas).toEqual(defaultSettings.activeLifeAreas);
  });

  it('rejects malformed records before replacing current data', async () => {
    const store = useAppStore();
    await store.saveEntry({
      ...emptyDailyEntry('2026-07-21'),
      importantFact: 'Сохранить при ошибке',
      updatedAt: '',
    });

    await expect(
      store.importData({
        version: 3,
        dailyEntries: [{ date: '2026-02-31' }],
        results: [],
        weeklyReviews: [],
        settings: {},
      }),
    ).rejects.toThrow('Некорректная дата в dailyEntries[0].date');

    expect(await db.dailyEntries.get('2026-07-21')).toMatchObject({ importantFact: 'Сохранить при ошибке' });
  });

  it('normalizes unsafe scalar and enum values without inventing zeroes', async () => {
    const store = useAppStore();
    await store.importData({
      version: 3,
      exportedAt: '2026-07-22T10:00:00.000Z',
      dailyEntries: [
        {
          date: '2026-07-20',
          bedtime: '29:70',
          wakeTime: '07:30',
          sleepMinutes: '480',
          timeInBedMinutes: 2000,
          sleepQuality: 8,
          energy: 0,
          activities: ['walk', 'unknown'],
          specialDay: 'unknown',
          weightKg: 999,
          experimentCompleted: 'yes',
        },
      ],
      results: [{ date: '2026-07-20', area: 'career', title: 'Итог', createdAt: '' }],
      lifeEvents: [{ date: '2026-07-20', type: 'unknown', title: 'Событие', note: '', createdAt: '' }],
      weeklyReviews: [],
      monthlyReviews: [],
      settings: {},
    });

    expect(store.dailyEntries[0]).toMatchObject({
      bedtime: '',
      wakeTime: '07:30',
      sleepMinutes: null,
      timeInBedMinutes: null,
      sleepQuality: null,
      energy: null,
      activities: ['walk'],
      specialDay: null,
      weightKg: null,
      experimentCompleted: null,
    });
    expect(store.lifeEvents[0].type).toBe('other');
  });
});
