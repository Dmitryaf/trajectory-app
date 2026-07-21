import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { useAppStore, type ExportPayload } from '../src/stores/app';
import { emptyDailyEntry } from '../src/types';

beforeEach(async () => {
  await db.delete();
  await db.open();
  setActivePinia(createPinia());
});

afterAll(async () => {
  await db.delete();
});

describe('backup import', () => {
  it('replaces current data and migrates a version 1 backup to the current model', async () => {
    await db.dailyEntries.put({
      ...emptyDailyEntry('2026-07-21'),
      importantFact: 'Эта запись должна быть заменена',
      updatedAt: '2026-07-21T10:00:00.000Z'
    });

    const oldBackup = {
      version: 1,
      exportedAt: '2025-02-02T10:00:00.000Z',
      dailyEntries: [{
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
        updatedAt: '2025-02-01T20:00:00.000Z'
      }],
      results: [{
        id: 1,
        date: '2025-02-01',
        area: 'career',
        title: 'Получен ответ',
        createdAt: '2025-02-01T20:00:00.000Z'
      }],
      weeklyReviews: [{
        weekStart: '2025-01-27',
        results: ['Получен ответ'],
        support: 'Режим',
        obstacle: '',
        nextLever: 'Продолжить',
        updatedAt: '2025-02-02T20:00:00.000Z'
      }],
      settings: {
        id: 'main',
        settingsVersion: 1,
        activeLifeAreas: ['family', 'spiritual']
      }
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
      eveningFactorsRecorded: false,
      timeInBedMinutes: null,
      importantFact: 'Старая запись сохранена'
    });
    expect(store.results).toHaveLength(1);
    expect(store.lifeEvents).toEqual([]);
    expect(store.monthlyReviews).toEqual([]);
    expect(store.weeklyReviews[0].ifThenPlan).toBe('');
    expect(store.settings.settingsVersion).toBe(2);
    expect(store.settings.activeLifeAreas).toEqual(['family']);

    const storedDates = await db.dailyEntries.toCollection().primaryKeys();
    expect(storedDates).toEqual(['2025-02-01']);

    const exported = store.exportData();
    expect(exported.version).toBe(3);
    expect(exported.dailyEntries[0].careerStates).toEqual(['external']);
    expect(exported.monthlyReviews).toEqual([]);
  });

  it('rejects an unsupported backup before clearing current data', async () => {
    const store = useAppStore();
    await store.saveEntry({
      ...emptyDailyEntry('2026-07-21'),
      importantFact: 'Не удалять',
      updatedAt: ''
    });

    await expect(store.importData({ version: 99 } as unknown as ExportPayload)).rejects.toThrow('Неподдерживаемый формат резервной копии');

    expect(await db.dailyEntries.get('2026-07-21')).toMatchObject({ importantFact: 'Не удалять' });
  });
});
