import { dailyFieldWasRecorded, type DailyEntry } from '../../types';
import { dateRange } from '../../services/dates';

export type DataCoverageLevel = 0 | 1 | 2;

export function dataCoverageLevel(entry: DailyEntry): DataCoverageLevel {
  const careerStates = entry.careerStates.length ? entry.careerStates : entry.careerState ? [entry.careerState] : [];
  const hasState =
    entry.sleepMinutes !== null ||
    entry.timeInBedMinutes !== null ||
    entry.energy !== null ||
    entry.sleepQuality !== null ||
    entry.bedtime.length > 0 ||
    entry.wakeTime.length > 0;
  const hasAction =
    entry.actionDirection !== null ||
    careerStates.length > 0 ||
    dailyFieldWasRecorded(entry, 'actionDirection') ||
    dailyFieldWasRecorded(entry, 'careerStates') ||
    dailyFieldWasRecorded(entry, 'activities') ||
    dailyFieldWasRecorded(entry, 'lifeAreas') ||
    entry.importantFact.trim().length > 0;
  const hasNutrition = entry.nutritionState !== null || entry.weightKg !== null;
  const coreDomains = [hasState, hasAction, hasNutrition].filter(Boolean).length;
  if (coreDomains >= 2) return 2;

  const hasContext = entry.specialDay !== null || dailyFieldWasRecorded(entry, 'contextFactors') || entry.contextNote.trim().length > 0;
  return coreDomains === 1 || hasContext ? 1 : 0;
}

export function buildCoverageSeries(entries: DailyEntry[], start: string, end: string): Array<[string, DataCoverageLevel]> {
  const entriesByDate = new Map(entries.map((entry) => [entry.date, entry]));
  return dateRange(start, end).map((date) => {
    const entry = entriesByDate.get(date);
    return [date, entry ? dataCoverageLevel(entry) : 0];
  });
}
