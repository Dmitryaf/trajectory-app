import { currentDailyEntrySchemaVersion, type DailyBlockId, type DailyEntry } from '../../types';
import { plainCopy } from '../../services/plain';
import { experimentTextLimits } from '../experiments/model';

export type DailyEntryMetrics = {
  sleepMinutes: number | null;
  timeInBedMinutes: number | null;
  weightKg: number | null;
};

export type DailyEntryDefaults = {
  focusTitle: string;
  focusOutcomeCriterion: string;
  focusReviewDate: string;
  externalEvidenceCriterion: string;
  nutritionCriterion: string;
  activeDailyBlocks: DailyBlockId[];
};

export function timeBetween(start: string, end: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [endHours, endMinutes] = end.split(':').map(Number);
  if (startHours > 23 || endHours > 23 || startMinutes > 59 || endMinutes > 59) return null;
  let duration = endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
  if (duration <= 0) duration += 24 * 60;
  return duration <= 18 * 60 ? duration : null;
}

export function normalizeWeight(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

export function snapshotDailyEntry(entry: DailyEntry, metrics: DailyEntryMetrics): string {
  return JSON.stringify({
    ...plainCopy(entry),
    ...metrics,
    weightKg: normalizeWeight(metrics.weightKg),
    updatedAt: '',
  });
}

export function prepareDailyEntryForSave(
  entry: DailyEntry,
  metrics: DailyEntryMetrics,
  defaults: DailyEntryDefaults,
  isNew: boolean,
): DailyEntry {
  const prepared = plainCopy(entry);
  prepared.sleepMinutes = metrics.sleepMinutes;
  prepared.timeInBedMinutes = metrics.timeInBedMinutes;
  prepared.weightKg = normalizeWeight(metrics.weightKg);
  if (isNew) {
    prepared.entrySchemaVersion = currentDailyEntrySchemaVersion;
    prepared.activeDailyBlocksSnapshot = [...defaults.activeDailyBlocks];
    if (!prepared.focusTitle.trim()) prepared.focusTitle = defaults.focusTitle.trim();
    if (!prepared.focusOutcomeCriterion.trim()) prepared.focusOutcomeCriterion = defaults.focusOutcomeCriterion.trim();
    if (!prepared.focusReviewDate) prepared.focusReviewDate = defaults.focusReviewDate;
    if (!prepared.externalEvidenceCriterion.trim()) prepared.externalEvidenceCriterion = defaults.externalEvidenceCriterion.trim();
    if (!prepared.nutritionCriterion.trim()) prepared.nutritionCriterion = defaults.nutritionCriterion.trim();
  }
  return prepared;
}

export function validateDailyEntryMetrics(metrics: DailyEntryMetrics, sleepBlockActive: boolean): string {
  if (
    sleepBlockActive &&
    metrics.sleepMinutes !== null &&
    metrics.timeInBedMinutes !== null &&
    metrics.sleepMinutes > metrics.timeInBedMinutes
  ) {
    return 'Время сна не может быть больше времени в кровати.';
  }
  return '';
}

export function validateDailyEntryText(entry: DailyEntry): string {
  if (entry.experimentNote.length > experimentTextLimits.dailyNote)
    return `Заметка к эксперименту длиннее ${experimentTextLimits.dailyNote} символов. Сократите текст, чтобы сохранить день.`;
  return '';
}
