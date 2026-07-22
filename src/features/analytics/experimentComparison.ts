import { addDays, dateRange } from '../../services/dates';
import {
  experimentMetricOptions,
  type DailyEntry,
  type Experiment,
  type ExperimentMetricId,
} from '../../types';

export type ExperimentComparison = {
  metricId: ExperimentMetricId;
  metricLabel: string;
  unit: string;
  direction: Experiment['targetDirection'];
  minimumMeaningfulChange: number;
  baselineStart: string;
  baselineEnd: string;
  experimentStart: string;
  experimentEnd: string;
  baselineAverage: number | null;
  experimentAverage: number | null;
  baselineSamples: number;
  experimentSamples: number;
  adherenceMarkedDays: number;
  adherenceCompletedDays: number;
  rawDifference: number | null;
  improvement: number | null;
  thresholdMet: boolean | null;
};

export function buildExperimentComparison(entries: DailyEntry[], experiment: Experiment): ExperimentComparison | null {
  if (!experiment.targetMetricId
    || !experiment.startDate
    || !experiment.endDate
    || experiment.startDate > experiment.endDate
    || experiment.minimumMeaningfulChange === null
    || experiment.minimumMeaningfulChange <= 0) return null;

  const metric = experimentMetricOptions.find((option) => option.id === experiment.targetMetricId);
  if (!metric) return null;

  const periodDays = dateRange(experiment.startDate, experiment.endDate).length;
  const baselineEnd = addDays(experiment.startDate, -1);
  const baselineStart = addDays(experiment.startDate, -periodDays);
  const baselineEntries = ordinaryEntriesInRange(entries, baselineStart, baselineEnd);
  const experimentEntries = ordinaryEntriesInRange(entries, experiment.startDate, experiment.endDate);
  const plannedExperimentEntries = entries.filter((entry) => entry.date >= experiment.startDate && entry.date <= experiment.endDate);
  const baselineValues = metricValues(baselineEntries, metric.id);
  const experimentValues = metricValues(experimentEntries, metric.id);
  const baselineAverage = average(baselineValues);
  const experimentAverage = average(experimentValues);
  const rawDifference = baselineAverage === null || experimentAverage === null
    ? null
    : experimentAverage - baselineAverage;
  const improvement = rawDifference === null
    ? null
    : experiment.targetDirection === 'increase' ? rawDifference : -rawDifference;
  const enoughData = baselineValues.length >= 4 && experimentValues.length >= 4;

  return {
    metricId: metric.id,
    metricLabel: metric.label,
    unit: metric.unit,
    direction: experiment.targetDirection,
    minimumMeaningfulChange: experiment.minimumMeaningfulChange,
    baselineStart,
    baselineEnd,
    experimentStart: experiment.startDate,
    experimentEnd: experiment.endDate,
    baselineAverage,
    experimentAverage,
    baselineSamples: baselineValues.length,
    experimentSamples: experimentValues.length,
    adherenceMarkedDays: plannedExperimentEntries.filter((entry) => entry.experimentCompleted !== null).length,
    adherenceCompletedDays: plannedExperimentEntries.filter((entry) => entry.experimentCompleted === true).length,
    rawDifference,
    improvement,
    thresholdMet: enoughData && improvement !== null ? improvement >= experiment.minimumMeaningfulChange : null,
  };
}

function ordinaryEntriesInRange(entries: DailyEntry[], start: string, end: string): DailyEntry[] {
  return entries.filter((entry) => entry.date >= start && entry.date <= end && entry.specialDay === null);
}

function metricValues(entries: DailyEntry[], metricId: ExperimentMetricId): number[] {
  return entries
    .map((entry) => entry[metricId])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
