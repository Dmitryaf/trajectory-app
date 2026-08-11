import type { Experiment, ExperimentDecision, ExperimentRecord } from '../../types';

export const experimentTextLimits = {
  title: 800,
  hypothesis: 800,
  conclusion: 2000,
  dailyNote: 500,
} as const;

export const experimentDecisionOptions: Array<{ id: ExperimentDecision; label: string; icon: string }> = [
  { id: 'continue', label: 'Продолжить', icon: '→' },
  { id: 'adjust', label: 'Изменить', icon: '⌁' },
  { id: 'stop', label: 'Завершить', icon: '✓' },
  { id: 'more_data', label: 'Собрать ещё данные', icon: '+' },
];

export function emptyExperiment(): Experiment {
  return {
    active: false,
    title: '',
    hypothesis: '',
    targetMetricId: null,
    targetMetric: '',
    targetDirection: 'increase',
    minimumMeaningfulChange: null,
    startDate: '',
    endDate: '',
    conclusion: '',
    decision: null,
  };
}

export function createExperimentRecord(experiment: Experiment, completedAt = new Date().toISOString()): ExperimentRecord {
  const { active: _active, ...snapshot } = experiment;
  return {
    ...snapshot,
    id: `experiment-${completedAt}-${Math.random().toString(36).slice(2, 8)}`,
    completedAt,
  };
}

export function experimentDecisionLabel(decision: ExperimentDecision | null): string {
  return experimentDecisionOptions.find((option) => option.id === decision)?.label ?? '';
}

export function experimentPeriodsOverlap(
  first: Pick<Experiment, 'startDate' | 'endDate'>,
  second: Pick<Experiment, 'startDate' | 'endDate'>,
): boolean {
  return Boolean(
    first.startDate &&
    first.endDate &&
    second.startDate &&
    second.endDate &&
    first.startDate <= second.endDate &&
    second.startDate <= first.endDate,
  );
}

export function validateExperimentTextLengths(experiment: Experiment): string {
  if (experiment.title.length > experimentTextLimits.title)
    return `Условие эксперимента длиннее ${experimentTextLimits.title} символов. Сократите текст, чтобы сохранить его.`;
  if (experiment.hypothesis.length > experimentTextLimits.hypothesis)
    return `Вопрос эксперимента длиннее ${experimentTextLimits.hypothesis} символов. Сократите текст, чтобы сохранить его.`;
  if (experiment.conclusion.length > experimentTextLimits.conclusion)
    return `Итог эксперимента длиннее ${experimentTextLimits.conclusion} символов. Сократите текст, чтобы сохранить его.`;
  return '';
}
