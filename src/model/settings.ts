import { activityOptions, contextFactorOptions, dailyBlockOptions, experimentMetricOptions, legacyLifeAreaOptions } from './options';
import { removedDemoCareerOptionId, removedDemoContextFactorId, validDate } from './normalization';
import type {
  ActivityId,
  AppSettings,
  ContextFactorId,
  DailyBlockId,
  Experiment,
  ExperimentDecision,
  ExperimentMetricId,
  ExperimentRecord,
  LifeAreaId,
  Option,
} from './schema';

export const defaultSettings: AppSettings = {
  id: 'main',
  settingsVersion: 11,
  introSeen: false,
  activeDailyBlocks: dailyBlockOptions.filter((option) => option.id !== 'career').map((option) => option.id),
  activeLifeAreas: ['family', 'reading', 'creativity', 'rest'],
  customActivityOptions: [],
  hiddenActivityIds: [],
  customCareerOptions: [],
  customLifeAreaOptions: [],
  customContextFactorOptions: [],
  hiddenContextFactorIds: [],
  activeFocusTitle: '',
  focusOutcomeCriterion: '',
  focusReviewDate: '',
  externalEvidenceCriterion: '',
  nutritionGoalCriterion: '',
  experiment: {
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
  },
  experimentHistory: [],
};

type LegacyAppSettings = Partial<AppSettings> & {
  customEveningFactorOptions?: unknown;
};

export function normalizeSettings(settings: LegacyAppSettings | null | undefined): AppSettings {
  const source = settings ?? {};
  const customActivityOptions = sanitizeOptions(source.customActivityOptions).filter(
    (option) => !activityOptions.some((builtIn) => builtIn.id === option.id),
  );
  const hiddenActivityIds = Array.isArray(source.hiddenActivityIds)
    ? Array.from(
        new Set(
          source.hiddenActivityIds.filter(
            (id): id is ActivityId => typeof id === 'string' && activityOptions.some((option) => option.id === id),
          ),
        ),
      )
    : [];
  const customCareerOptions = sanitizeOptions(source.customCareerOptions).filter((option) => option.id !== removedDemoCareerOptionId);
  const activeLifeAreas = Array.isArray(source.activeLifeAreas)
    ? source.activeLifeAreas.filter((area): area is LifeAreaId => typeof area === 'string')
    : defaultSettings.activeLifeAreas;
  const customLifeAreaOptions = sanitizeOptions(source.customLifeAreaOptions);
  for (const option of legacyLifeAreaOptions) {
    if (activeLifeAreas.includes(option.id) && !customLifeAreaOptions.some((item) => item.id === option.id)) {
      customLifeAreaOptions.push({ ...option, custom: true });
    }
  }
  const customContextFactorOptions = sanitizeOptions(source.customContextFactorOptions ?? source.customEveningFactorOptions).filter(
    (option) => option.id !== removedDemoContextFactorId,
  );
  const hiddenContextFactorIds = Array.isArray(source.hiddenContextFactorIds)
    ? Array.from(
        new Set(
          source.hiddenContextFactorIds.filter(
            (id): id is ContextFactorId => typeof id === 'string' && contextFactorOptions.some((option) => option.id === id),
          ),
        ),
      )
    : [];

  const parsedDailyBlocks = Array.isArray(source.activeDailyBlocks)
    ? source.activeDailyBlocks.filter((block): block is DailyBlockId => dailyBlockOptions.some((option) => option.id === block))
    : settings == null
      ? defaultSettings.activeDailyBlocks
      : dailyBlockOptions.map((option) => option.id);
  const activeDailyBlocks =
    (source.settingsVersion ?? 1) < 5 && !parsedDailyBlocks.includes('context')
      ? [...parsedDailyBlocks, 'context' as const]
      : parsedDailyBlocks;

  return {
    ...structuredClone(defaultSettings),
    id: 'main',
    settingsVersion: defaultSettings.settingsVersion,
    introSeen: source.introSeen === true,
    activeDailyBlocks,
    activeLifeAreas: (source.settingsVersion ?? 1) < 2 ? activeLifeAreas.filter((area) => area !== 'spiritual') : activeLifeAreas,
    customActivityOptions,
    hiddenActivityIds,
    customCareerOptions,
    customLifeAreaOptions,
    customContextFactorOptions,
    hiddenContextFactorIds,
    activeFocusTitle: typeof source.activeFocusTitle === 'string' ? source.activeFocusTitle : '',
    focusOutcomeCriterion: typeof source.focusOutcomeCriterion === 'string' ? source.focusOutcomeCriterion : '',
    focusReviewDate: validDate(source.focusReviewDate),
    externalEvidenceCriterion: typeof source.externalEvidenceCriterion === 'string' ? source.externalEvidenceCriterion : '',
    nutritionGoalCriterion: typeof source.nutritionGoalCriterion === 'string' ? source.nutritionGoalCriterion : '',
    experiment: normalizeExperiment(source.experiment),
    experimentHistory: normalizeExperimentHistory(source.experimentHistory),
  };
}

function normalizeExperiment(value: unknown): Experiment {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<Experiment>) : {};
  const targetMetric = typeof source.targetMetric === 'string' ? source.targetMetric : '';
  const targetMetricId = isExperimentMetricId(source.targetMetricId) ? source.targetMetricId : legacyExperimentMetricId(targetMetric);
  const metricOption = experimentMetricOptions.find((option) => option.id === targetMetricId);
  return {
    active: typeof source.active === 'boolean' ? source.active : false,
    title: typeof source.title === 'string' ? source.title : '',
    hypothesis: typeof source.hypothesis === 'string' ? source.hypothesis : '',
    targetMetricId,
    targetMetric: metricOption?.label ?? targetMetric,
    targetDirection: source.targetDirection === 'decrease' ? 'decrease' : 'increase',
    minimumMeaningfulChange:
      typeof source.minimumMeaningfulChange === 'number' &&
      Number.isFinite(source.minimumMeaningfulChange) &&
      source.minimumMeaningfulChange > 0
        ? source.minimumMeaningfulChange
        : targetMetricId
          ? (metricOption?.defaultMinimumChange ?? null)
          : null,
    startDate: validDate(source.startDate),
    endDate: validDate(source.endDate),
    conclusion: typeof source.conclusion === 'string' ? source.conclusion : '',
    decision: isExperimentDecision(source.decision) ? source.decision : null,
  };
}

function normalizeExperimentHistory(value: unknown): ExperimentRecord[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const source = item as Partial<ExperimentRecord>;
    const experiment = normalizeExperiment(source);
    if (!experiment.title.trim() || !experiment.startDate || !experiment.endDate || experiment.startDate > experiment.endDate) return [];
    const id = typeof source.id === 'string' && source.id.trim() ? source.id : `legacy-experiment-${index}-${experiment.startDate}`;
    if (seen.has(id)) return [];
    seen.add(id);
    const { active: _active, ...snapshot } = experiment;
    return [
      {
        ...snapshot,
        id,
        completedAt: typeof source.completedAt === 'string' ? source.completedAt : '',
      },
    ];
  });
}

function isExperimentDecision(value: unknown): value is ExperimentDecision {
  return value === 'continue' || value === 'adjust' || value === 'stop' || value === 'more_data';
}

function isExperimentMetricId(value: unknown): value is ExperimentMetricId {
  return typeof value === 'string' && experimentMetricOptions.some((option) => option.id === value);
}

function legacyExperimentMetricId(value: string): ExperimentMetricId | null {
  const normalized = value.trim().toLocaleLowerCase('ru-RU');
  const exactLabels: Record<string, ExperimentMetricId> = {
    'продолжительность сна': 'sleepMinutes',
    сон: 'sleepMinutes',
    'время в кровати': 'timeInBedMinutes',
    'качество сна': 'sleepQuality',
    энергия: 'energy',
    'энергия за день': 'energy',
    вес: 'weightKg',
  };
  return exactLabels[normalized] ?? null;
}

export function createCustomOption(label: string, prefix: 'activity' | 'career' | 'life' | 'context'): Option<string> {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return { id: `custom:${prefix}:${suffix}`, label: label.trim(), icon: '+', custom: true };
}

export function experimentAppliesToDate(experiment: Experiment, date: string): boolean {
  return (
    experiment.active && (!experiment.startDate || date >= experiment.startDate) && (!experiment.endDate || date <= experiment.endDate)
  );
}

function sanitizeOptions(options: unknown): Option<string>[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter((option): option is Option<string> => Boolean(option) && typeof option.id === 'string' && typeof option.label === 'string')
    .map((option) => ({
      id: option.id,
      label: option.label,
      icon: typeof option.icon === 'string' ? option.icon : '+',
      custom: true,
      countsAsExternal: Boolean(option.countsAsExternal),
      archived: Boolean(option.archived),
    }));
}
