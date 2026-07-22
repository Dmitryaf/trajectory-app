export type BaseCareerState =
  | "preparation"
  | "project"
  | "external"
  | "interview"
  | "result";
export type CareerState = BaseCareerState | string;
export type ActivityId = "boxing" | "bachata" | "walk" | "workout" | "recovery";
export type NutritionState = "supports_goal" | "neutral" | "blocks_goal";
export type ActionDirectionId = "external" | "preparation" | "maintenance" | "recovery" | "drift";
export type SpecialDayId = "sick" | "travel" | "overload" | "event" | "recovery" | "other";
export type LifeEventType = "change" | "milestone" | "decision" | "event" | "insight" | "other";
export type BaseContextFactorId =
  | "late_bedtime"
  | "screen"
  | "news"
  | "series_video"
  | "porn"
  | "work_code"
  | "late_food"
  | "caffeine_alcohol"
  | "anxiety_overload"
  | "other";
export type ContextFactorId = BaseContextFactorId | string;
export type BaseLifeAreaId =
  | "family"
  | "reading"
  | "creativity"
  | "spiritual"
  | "rest"
  | "friends"
  | "english";
export type LifeAreaId = BaseLifeAreaId | string;
export type DailyBlockId = "sleep" | "context" | "career" | "movement" | "nutrition";
export type DailyRecordedFieldId =
  | "bedtime"
  | "wakeTime"
  | "sleepMinutes"
  | "timeInBedMinutes"
  | "sleepQuality"
  | "energy"
  | "contextFactors"
  | "contextNote"
  | "specialDay"
  | "careerStates"
  | "activities"
  | "nutritionState"
  | "nutritionNote"
  | "weightKg"
  | "actionDirection"
  | "actionNote"
  | "lifeAreas"
  | "importantFact"
  | "experimentCompleted";

export const currentDailyEntrySchemaVersion = 2;
export type ExperimentMetricId = "sleepMinutes" | "timeInBedMinutes" | "sleepQuality" | "energy" | "weightKg";
export type ExperimentDirection = "increase" | "decrease";
export type ExperimentDecision = "continue" | "adjust" | "stop" | "more_data";

const removedDemoCareerOptionId = "custom:career:responses";
const removedDemoContextFactorId = "custom:evening:shower";

export type DailyEntry = {
  date: string;
  entrySchemaVersion: number | null;
  activeDailyBlocksSnapshot: DailyBlockId[] | null;
  recordedFields: DailyRecordedFieldId[];
  bedtime: string;
  wakeTime: string;
  sleepMinutes: number | null;
  timeInBedMinutes: number | null;
  sleepQuality: number | null;
  energy: number | null;
  contextFactors: ContextFactorId[];
  contextFactorsRecorded: boolean;
  contextNote: string;
  specialDay: SpecialDayId | null;
  specialDayNote: string;
  careerState: CareerState | null;
  careerStates: CareerState[];
  activities: ActivityId[];
  activitiesRecorded: boolean;
  nutritionState: NutritionState | null;
  nutritionNote: string;
  nutritionCriterion: string;
  weightKg: number | null;
  actionDirection: ActionDirectionId | null;
  actionNote: string;
  focusTitle: string;
  focusOutcomeCriterion: string;
  focusReviewDate: string;
  externalEvidenceCriterion: string;
  lifeAreas: LifeAreaId[];
  lifeAreasRecorded: boolean;
  importantFact: string;
  experimentCompleted: boolean | null;
  updatedAt: string;
};

export type ResultRecord = {
  id?: number;
  date: string;
  area: LifeAreaId | "career" | "sport" | "nutrition" | "sleep" | "health";
  title: string;
  createdAt: string;
};

export type LifeEventRecord = {
  id?: number;
  date: string;
  type: LifeEventType;
  title: string;
  note: string;
  createdAt: string;
};

export type WeeklyReview = {
  weekStart: string;
  updatedAt: string;
  previousPlanOutcome: string;
  results: string[];
  support: string;
  obstacle: string;
  nextLever: string;
  ifThenPlan: string;
};

export type MonthlyReview = {
  monthStart: string;
  updatedAt: string;
  mainPattern: string;
  support: string;
  obstacle: string;
  courseChange: string;
  nextFocus: string;
  ifThenPlan: string;
};

export type Experiment = {
  active: boolean;
  title: string;
  hypothesis: string;
  targetMetricId: ExperimentMetricId | null;
  targetMetric: string;
  targetDirection: ExperimentDirection;
  minimumMeaningfulChange: number | null;
  startDate: string;
  endDate: string;
  conclusion: string;
  decision: ExperimentDecision | null;
};

export type ExperimentRecord = Omit<Experiment, "active"> & {
  id: string;
  completedAt: string;
};

export type AppSettings = {
  id: "main";
  settingsVersion: number;
  activeDailyBlocks: DailyBlockId[];
  activeLifeAreas: LifeAreaId[];
  customCareerOptions: Option<CareerState>[];
  customLifeAreaOptions: Option<LifeAreaId>[];
  customContextFactorOptions: Option<ContextFactorId>[];
  hiddenContextFactorIds: ContextFactorId[];
  activeFocusTitle: string;
  focusOutcomeCriterion: string;
  focusReviewDate: string;
  externalEvidenceCriterion: string;
  nutritionGoalCriterion: string;
  experiment: Experiment;
  experimentHistory: ExperimentRecord[];
};

export type Option<T extends string = string> = {
  id: T;
  label: string;
  icon?: string;
  custom?: boolean;
  countsAsExternal?: boolean;
  archived?: boolean;
};

export type ExperimentMetricOption = Option<ExperimentMetricId> & {
  unit: string;
  defaultMinimumChange: number;
  step: number;
};

export const careerOptions: Option<BaseCareerState>[] = [
  { id: "preparation", label: "Подготовка", icon: "◫" },
  { id: "project", label: "Проект", icon: "◇" },
  { id: "external", label: "Отклик/контакт", icon: "↗" },
  { id: "interview", label: "Собеседование", icon: "◉" },
  { id: "result", label: "Итог", icon: "✓" },
];

export const activityOptions: Option<ActivityId>[] = [
  { id: "boxing", label: "Бокс", icon: "◈" },
  { id: "bachata", label: "Бачата", icon: "♪" },
  { id: "walk", label: "Прогулка", icon: "→" },
  { id: "workout", label: "Тренировка", icon: "△" },
  { id: "recovery", label: "Восстановление", icon: "○" },
];

export const nutritionOptions: Option<NutritionState>[] = [
  { id: "supports_goal", label: "Поддержало цель", icon: "✓" },
  { id: "neutral", label: "Нейтрально", icon: "·" },
  { id: "blocks_goal", label: "Мешало цели", icon: "!" },
];

export const actionDirectionOptions: Option<ActionDirectionId>[] = [
  { id: "external", label: "Конкретное действие", icon: "↗" },
  { id: "preparation", label: "Подготовка", icon: "◫" },
  { id: "maintenance", label: "Поддержание", icon: "○" },
  { id: "recovery", label: "Восстановление", icon: "◌" },
  { id: "drift", label: "Занимался другим", icon: "!" },
];

export const actionDirectionEntryOptions = actionDirectionOptions.filter((option) => option.id !== "recovery");

export const specialDayOptions: Option<SpecialDayId>[] = [
  { id: "sick", label: "Болел", icon: "+" },
  { id: "travel", label: "Поездка", icon: "→" },
  { id: "overload", label: "Перегруз", icon: "!" },
  { id: "event", label: "Событие", icon: "◉" },
  { id: "recovery", label: "Восстановление", icon: "○" },
  { id: "other", label: "Другое", icon: "·" },
];

export const lifeEventTypeOptions: Option<LifeEventType>[] = [
  { id: "change", label: "Изменение", icon: "↻" },
  { id: "decision", label: "Решение", icon: "✓" },
  { id: "event", label: "Событие", icon: "◉" },
  { id: "insight", label: "Инсайт", icon: "✦" },
  { id: "other", label: "Другое", icon: "·" },
];

export const contextFactorOptions: Option<BaseContextFactorId>[] = [
  { id: "late_bedtime", label: "Изменившийся режим сна", icon: "◷" },
  { id: "screen", label: "Экранное время", icon: "▣" },
  { id: "news", label: "Новости и инфопоток", icon: "!" },
  { id: "series_video", label: "Видео и сериалы", icon: "▶" },
  { id: "work_code", label: "Рабочая нагрузка", icon: "◇" },
  { id: "late_food", label: "Поздний приём пищи", icon: "+" },
  { id: "caffeine_alcohol", label: "Кофеин или алкоголь", icon: "◌" },
  { id: "anxiety_overload", label: "Эмоциональная нагрузка", icon: "⌁" },
  { id: "other", label: "Другое", icon: "…" },
];

export const lifeAreaOptions: Option<BaseLifeAreaId>[] = [
  { id: "family", label: "Семья", icon: "⌂" },
  { id: "reading", label: "Чтение", icon: "▤" },
  { id: "creativity", label: "Творчество", icon: "✦" },
  { id: "spiritual", label: "Духовное", icon: "◎" },
  { id: "rest", label: "Отдых", icon: "☼" },
  { id: "friends", label: "Друзья", icon: "◌" },
  { id: "english", label: "Английский", icon: "A" },
];

export const resultAreaOptions: Option<ResultRecord["area"]>[] = [
  { id: "career", label: "Карьера", icon: "↗" },
  { id: "sport", label: "Спорт", icon: "△" },
  { id: "nutrition", label: "Питание", icon: "◐" },
  { id: "sleep", label: "Сон", icon: "◒" },
  { id: "health", label: "Здоровье", icon: "+" },
  ...lifeAreaOptions,
];

export const dailyBlockOptions: Option<DailyBlockId>[] = [
  { id: "sleep", label: "Сон и состояние", icon: "◒" },
  { id: "context", label: "Контекст дня", icon: "⌁" },
  { id: "career", label: "Карьера", icon: "↗" },
  { id: "movement", label: "Физическая активность", icon: "△" },
  { id: "nutrition", label: "Питание и вес", icon: "◐" },
];

export const experimentMetricOptions: ExperimentMetricOption[] = [
  { id: "sleepMinutes", label: "Продолжительность сна", unit: "мин", defaultMinimumChange: 30, step: 5 },
  { id: "timeInBedMinutes", label: "Время в кровати", unit: "мин", defaultMinimumChange: 30, step: 5 },
  { id: "sleepQuality", label: "Качество сна", unit: "балла", defaultMinimumChange: 0.5, step: 0.1 },
  { id: "energy", label: "Энергия за день", unit: "балла", defaultMinimumChange: 0.5, step: 0.1 },
  { id: "weightKg", label: "Вес", unit: "кг", defaultMinimumChange: 0.5, step: 0.1 },
];

const dailyRecordedFieldIds: DailyRecordedFieldId[] = [
  "bedtime", "wakeTime", "sleepMinutes", "timeInBedMinutes", "sleepQuality", "energy",
  "contextFactors", "contextNote", "specialDay", "careerStates", "activities",
  "nutritionState", "nutritionNote", "weightKg", "actionDirection", "actionNote",
  "lifeAreas", "importantFact", "experimentCompleted",
];

export const defaultSettings: AppSettings = {
  id: "main",
  settingsVersion: 9,
  activeDailyBlocks: dailyBlockOptions.map((option) => option.id),
  activeLifeAreas: ["family", "reading", "creativity", "rest"],
  customCareerOptions: [],
  customLifeAreaOptions: [],
  customContextFactorOptions: [],
  hiddenContextFactorIds: [],
  activeFocusTitle: "",
  focusOutcomeCriterion: "",
  focusReviewDate: "",
  externalEvidenceCriterion: "",
  nutritionGoalCriterion: "",
  experiment: {
    active: false,
    title: "",
    hypothesis: "",
    targetMetricId: null,
    targetMetric: "",
    targetDirection: "increase",
    minimumMeaningfulChange: null,
    startDate: "",
    endDate: "",
    conclusion: "",
    decision: null,
  },
  experimentHistory: [],
};

export const externalCareerStates: CareerState[] = ["external", "interview", "result"];

type LegacyAppSettings = Partial<AppSettings> & {
  customEveningFactorOptions?: unknown;
};

function validDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
}

export function normalizeSettings(settings: LegacyAppSettings | null | undefined): AppSettings {
  const source = settings ?? {};
  const customCareerOptions = sanitizeOptions(source.customCareerOptions)
    .filter((option) => option.id !== removedDemoCareerOptionId);
  const customLifeAreaOptions = sanitizeOptions(source.customLifeAreaOptions);
  const customContextFactorOptions = sanitizeOptions(source.customContextFactorOptions ?? source.customEveningFactorOptions)
    .filter((option) => option.id !== removedDemoContextFactorId);
  const hiddenContextFactorIds = Array.isArray(source.hiddenContextFactorIds)
    ? Array.from(new Set(source.hiddenContextFactorIds.filter((id): id is ContextFactorId => (
        typeof id === "string" && contextFactorOptions.some((option) => option.id === id)
      ))))
    : [];

  const activeLifeAreas = Array.isArray(source.activeLifeAreas)
    ? source.activeLifeAreas.filter((area): area is LifeAreaId => typeof area === "string")
    : defaultSettings.activeLifeAreas;
  const parsedDailyBlocks = Array.isArray(source.activeDailyBlocks)
    ? source.activeDailyBlocks.filter((block): block is DailyBlockId => dailyBlockOptions.some((option) => option.id === block))
    : defaultSettings.activeDailyBlocks;
  const activeDailyBlocks = (source.settingsVersion ?? 1) < 5 && !parsedDailyBlocks.includes("context")
    ? [...parsedDailyBlocks, "context" as const]
    : parsedDailyBlocks;

  return {
    ...structuredClone(defaultSettings),
    id: "main",
    settingsVersion: defaultSettings.settingsVersion,
    activeDailyBlocks,
    activeLifeAreas: (source.settingsVersion ?? 1) < 2 ? activeLifeAreas.filter((area) => area !== "spiritual") : activeLifeAreas,
    customCareerOptions,
    customLifeAreaOptions,
    customContextFactorOptions,
    hiddenContextFactorIds,
    activeFocusTitle: typeof source.activeFocusTitle === "string" ? source.activeFocusTitle : "",
    focusOutcomeCriterion: typeof source.focusOutcomeCriterion === "string" ? source.focusOutcomeCriterion : "",
    focusReviewDate: validDate(source.focusReviewDate),
    externalEvidenceCriterion: typeof source.externalEvidenceCriterion === "string" ? source.externalEvidenceCriterion : "",
    nutritionGoalCriterion: typeof source.nutritionGoalCriterion === "string" ? source.nutritionGoalCriterion : "",
    experiment: normalizeExperiment(source.experiment),
    experimentHistory: normalizeExperimentHistory(source.experimentHistory),
  };
}

function normalizeExperiment(value: unknown): Experiment {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<Experiment> : {};
  const targetMetric = typeof source.targetMetric === "string" ? source.targetMetric : "";
  const targetMetricId = isExperimentMetricId(source.targetMetricId)
    ? source.targetMetricId
    : legacyExperimentMetricId(targetMetric);
  const metricOption = experimentMetricOptions.find((option) => option.id === targetMetricId);
  return {
    active: typeof source.active === "boolean" ? source.active : false,
    title: typeof source.title === "string" ? source.title : "",
    hypothesis: typeof source.hypothesis === "string" ? source.hypothesis : "",
    targetMetricId,
    targetMetric: metricOption?.label ?? targetMetric,
    targetDirection: source.targetDirection === "decrease" ? "decrease" : "increase",
    minimumMeaningfulChange: typeof source.minimumMeaningfulChange === "number"
      && Number.isFinite(source.minimumMeaningfulChange)
      && source.minimumMeaningfulChange > 0
      ? source.minimumMeaningfulChange
      : targetMetricId ? metricOption?.defaultMinimumChange ?? null : null,
    startDate: typeof source.startDate === "string" ? source.startDate : "",
    endDate: typeof source.endDate === "string" ? source.endDate : "",
    conclusion: typeof source.conclusion === "string" ? source.conclusion : "",
    decision: isExperimentDecision(source.decision) ? source.decision : null,
  };
}

function normalizeExperimentHistory(value: unknown): ExperimentRecord[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Partial<ExperimentRecord>;
    const experiment = normalizeExperiment(source);
    if (!experiment.title.trim() || !experiment.startDate || !experiment.endDate || experiment.startDate > experiment.endDate) return [];
    const id = typeof source.id === "string" && source.id.trim() ? source.id : `legacy-experiment-${index}-${experiment.startDate}`;
    if (seen.has(id)) return [];
    seen.add(id);
    const { active: _active, ...snapshot } = experiment;
    return [{
      ...snapshot,
      id,
      completedAt: typeof source.completedAt === "string" ? source.completedAt : "",
    }];
  });
}

function isExperimentDecision(value: unknown): value is ExperimentDecision {
  return value === "continue" || value === "adjust" || value === "stop" || value === "more_data";
}

function isExperimentMetricId(value: unknown): value is ExperimentMetricId {
  return typeof value === "string" && experimentMetricOptions.some((option) => option.id === value);
}

function legacyExperimentMetricId(value: string): ExperimentMetricId | null {
  const normalized = value.trim().toLocaleLowerCase("ru-RU");
  const exactLabels: Record<string, ExperimentMetricId> = {
    "продолжительность сна": "sleepMinutes",
    "сон": "sleepMinutes",
    "время в кровати": "timeInBedMinutes",
    "качество сна": "sleepQuality",
    "энергия": "energy",
    "энергия за день": "energy",
    "вес": "weightKg",
  };
  return exactLabels[normalized] ?? null;
}

export function createCustomOption(label: string, prefix: "career" | "life" | "context"): Option<string> {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return { id: `custom:${prefix}:${suffix}`, label: label.trim(), icon: "+", custom: true };
}

export function experimentAppliesToDate(experiment: Experiment, date: string): boolean {
  return experiment.active
    && (!experiment.startDate || date >= experiment.startDate)
    && (!experiment.endDate || date <= experiment.endDate);
}

function sanitizeOptions(options: unknown): Option<string>[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter((option): option is Option<string> => Boolean(option) && typeof option.id === "string" && typeof option.label === "string")
    .map((option) => ({
      id: option.id,
      label: option.label,
      icon: typeof option.icon === "string" ? option.icon : "+",
      custom: true,
      countsAsExternal: Boolean(option.countsAsExternal),
      archived: Boolean(option.archived),
    }));
}

function isNutritionState(value: unknown): value is NutritionState {
  return typeof value === "string" && nutritionOptions.some((option) => option.id === value);
}

function isActionDirection(value: unknown): value is ActionDirectionId {
  return typeof value === "string" && actionDirectionOptions.some((option) => option.id === value);
}

function nullableNumber(value: unknown, min: number, max: number, integer = false): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return null;
  return integer && !Number.isInteger(value) ? null : value;
}

function validTime(value: unknown): string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return "";
  const [hours, minutes] = value.split(":").map(Number);
  return hours! <= 23 && minutes! <= 59 ? value : "";
}

export function emptyDailyEntry(date: string): DailyEntry {
  return {
    date,
    entrySchemaVersion: currentDailyEntrySchemaVersion,
    activeDailyBlocksSnapshot: null,
    recordedFields: [],
    bedtime: "",
    wakeTime: "",
    sleepMinutes: null,
    timeInBedMinutes: null,
    sleepQuality: null,
    energy: null,
    contextFactors: [],
    contextFactorsRecorded: false,
    contextNote: "",
    specialDay: null,
    specialDayNote: "",
    careerState: null,
    careerStates: [],
    activities: [],
    activitiesRecorded: false,
    nutritionState: null,
    nutritionNote: "",
    nutritionCriterion: "",
    weightKg: null,
    actionDirection: null,
    actionNote: "",
    focusTitle: "",
    focusOutcomeCriterion: "",
    focusReviewDate: "",
    externalEvidenceCriterion: "",
    lifeAreas: [],
    lifeAreasRecorded: false,
    importantFact: "",
    experimentCompleted: null,
    updatedAt: new Date().toISOString(),
  };
}

type LegacyDailyEntry = Partial<DailyEntry> & {
  stateContext?: unknown;
  eveningFactors?: unknown;
  eveningFactorsRecorded?: unknown;
  eveningFactorNote?: unknown;
};

export function normalizeDailyEntry(entry: LegacyDailyEntry & { date: string }): DailyEntry {
  const sourceCareerStates = Array.isArray(entry.careerStates)
    ? Array.from(new Set(entry.careerStates.filter((state): state is CareerState => typeof state === "string")))
    : typeof entry.careerState === "string" ? [entry.careerState] : [];
  const careerStates = Array.from(new Set(sourceCareerStates.map((state) => (
    state === removedDemoCareerOptionId ? "external" : state
  ))));
  const activities = Array.isArray(entry.activities)
    ? entry.activities.filter((activity): activity is ActivityId => activityOptions.some((option) => option.id === activity))
    : [];
  const sourceContextFactors = Array.isArray(entry.contextFactors)
    ? entry.contextFactors
    : Array.isArray(entry.eveningFactors) ? entry.eveningFactors : [];
  const contextFactors = sourceContextFactors
    .filter((factor): factor is ContextFactorId => typeof factor === "string" && factor !== removedDemoContextFactorId);
  const contextNote = typeof entry.contextNote === "string"
    ? entry.contextNote
    : [entry.stateContext, entry.eveningFactorNote]
        .filter((note): note is string => typeof note === "string" && note.trim().length > 0)
        .join("\n");
  const specialDay = typeof entry.specialDay === "string" && specialDayOptions.some((option) => option.id === entry.specialDay)
    ? entry.specialDay as SpecialDayId
    : null;
  const bedtime = validTime(entry.bedtime);
  const wakeTime = validTime(entry.wakeTime);
  const sleepMinutes = nullableNumber(entry.sleepMinutes, 0, 24 * 60, true);
  const timeInBedMinutes = nullableNumber(entry.timeInBedMinutes, 0, 18 * 60, true);
  const sleepQuality = nullableNumber(entry.sleepQuality, 1, 5, true);
  const energy = nullableNumber(entry.energy, 1, 5, true);
  const weightKg = nullableNumber(entry.weightKg, 30, 250);
  const nutritionState = isNutritionState(entry.nutritionState) ? entry.nutritionState : null;
  const nutritionNote = typeof entry.nutritionNote === "string" ? entry.nutritionNote : "";
  const actionDirection = isActionDirection(entry.actionDirection) ? entry.actionDirection : null;
  const actionNote = typeof entry.actionNote === "string" ? entry.actionNote : "";
  const lifeAreas = Array.isArray(entry.lifeAreas) ? entry.lifeAreas.filter((area): area is LifeAreaId => typeof area === "string") : [];
  const importantFact = typeof entry.importantFact === "string" ? entry.importantFact : "";
  const experimentCompleted = typeof entry.experimentCompleted === "boolean" ? entry.experimentCompleted : null;
  const activitiesRecorded = typeof entry.activitiesRecorded === "boolean" ? entry.activitiesRecorded : activities.length > 0;
  const lifeAreasRecorded = typeof entry.lifeAreasRecorded === "boolean" ? entry.lifeAreasRecorded : lifeAreas.length > 0;
  const contextFactorsRecorded = typeof entry.contextFactorsRecorded === "boolean"
    ? entry.contextFactorsRecorded
    : typeof entry.eveningFactorsRecorded === "boolean" ? entry.eveningFactorsRecorded : sourceContextFactors.length > 0;
  const recordedFields = new Set<DailyRecordedFieldId>(
    Array.isArray(entry.recordedFields)
      ? entry.recordedFields.filter((field): field is DailyRecordedFieldId => dailyRecordedFieldIds.includes(field as DailyRecordedFieldId))
      : [],
  );
  if (bedtime) recordedFields.add("bedtime");
  if (wakeTime) recordedFields.add("wakeTime");
  if (sleepMinutes !== null) recordedFields.add("sleepMinutes");
  if (timeInBedMinutes !== null) recordedFields.add("timeInBedMinutes");
  if (sleepQuality !== null) recordedFields.add("sleepQuality");
  if (energy !== null) recordedFields.add("energy");
  if (contextFactorsRecorded) recordedFields.add("contextFactors");
  if (contextNote.trim()) recordedFields.add("contextNote");
  if (specialDay) recordedFields.add("specialDay");
  if (careerStates.length) recordedFields.add("careerStates");
  if (activitiesRecorded) recordedFields.add("activities");
  if (nutritionState !== null) recordedFields.add("nutritionState");
  if (nutritionNote.trim()) recordedFields.add("nutritionNote");
  if (weightKg !== null) recordedFields.add("weightKg");
  if (actionDirection !== null) recordedFields.add("actionDirection");
  if (actionNote.trim()) recordedFields.add("actionNote");
  if (lifeAreasRecorded) recordedFields.add("lifeAreas");
  if (importantFact.trim()) recordedFields.add("importantFact");
  if (experimentCompleted !== null) recordedFields.add("experimentCompleted");
  const activeDailyBlocksSnapshot = Array.isArray(entry.activeDailyBlocksSnapshot)
    ? Array.from(new Set(entry.activeDailyBlocksSnapshot.filter((block): block is DailyBlockId => dailyBlockOptions.some((option) => option.id === block))))
    : null;

  return {
    ...emptyDailyEntry(entry.date),
    entrySchemaVersion: typeof entry.entrySchemaVersion === "number" && Number.isInteger(entry.entrySchemaVersion) && entry.entrySchemaVersion > 0
      ? entry.entrySchemaVersion
      : null,
    activeDailyBlocksSnapshot,
    recordedFields: Array.from(recordedFields),
    bedtime,
    wakeTime,
    sleepMinutes,
    timeInBedMinutes,
    sleepQuality,
    energy,
    careerState: careerStates[0] ?? null,
    careerStates,
    weightKg,
    activities,
    activitiesRecorded: recordedFields.has("activities"),
    nutritionState,
    nutritionNote,
    nutritionCriterion: typeof entry.nutritionCriterion === "string" ? entry.nutritionCriterion : "",
    actionDirection,
    actionNote,
    focusTitle: typeof entry.focusTitle === "string" ? entry.focusTitle : "",
    focusOutcomeCriterion: typeof entry.focusOutcomeCriterion === "string" ? entry.focusOutcomeCriterion : "",
    focusReviewDate: validDate(entry.focusReviewDate),
    externalEvidenceCriterion: typeof entry.externalEvidenceCriterion === "string" ? entry.externalEvidenceCriterion : "",
    lifeAreas,
    lifeAreasRecorded: recordedFields.has("lifeAreas"),
    contextFactors,
    contextFactorsRecorded: recordedFields.has("contextFactors"),
    contextNote,
    specialDay,
    specialDayNote: typeof entry.specialDayNote === "string" ? entry.specialDayNote : "",
    importantFact,
    experimentCompleted,
    updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : "",
  };
}

export function dailyFieldWasRecorded(entry: DailyEntry, field: DailyRecordedFieldId): boolean {
  if (entry.recordedFields.includes(field)) return true;
  switch (field) {
    case "bedtime": return Boolean(entry.bedtime);
    case "wakeTime": return Boolean(entry.wakeTime);
    case "sleepMinutes": return entry.sleepMinutes !== null;
    case "timeInBedMinutes": return entry.timeInBedMinutes !== null;
    case "sleepQuality": return entry.sleepQuality !== null;
    case "energy": return entry.energy !== null;
    case "contextFactors": return entry.contextFactorsRecorded;
    case "contextNote": return Boolean(entry.contextNote.trim());
    case "specialDay": return entry.specialDay !== null;
    case "careerStates": return entry.careerStates.length > 0 || entry.careerState !== null;
    case "activities": return entry.activitiesRecorded;
    case "nutritionState": return entry.nutritionState !== null;
    case "nutritionNote": return Boolean(entry.nutritionNote.trim());
    case "weightKg": return entry.weightKg !== null;
    case "actionDirection": return entry.actionDirection !== null;
    case "actionNote": return Boolean(entry.actionNote.trim());
    case "lifeAreas": return entry.lifeAreasRecorded;
    case "importantFact": return Boolean(entry.importantFact.trim());
    case "experimentCompleted": return entry.experimentCompleted !== null;
  }
}

export function normalizeLifeEvent(event: Partial<LifeEventRecord> & { date: string; title: string }): LifeEventRecord {
  let type: LifeEventType = "other";
  if (event.type === "milestone") type = "change";
  else if (lifeEventTypeOptions.some((option) => option.id === event.type)) type = event.type as LifeEventType;
  return {
    date: event.date,
    type,
    title: typeof event.title === "string" ? event.title : "",
    note: typeof event.note === "string" ? event.note : "",
    createdAt: typeof event.createdAt === "string" ? event.createdAt : "",
    ...(typeof event.id === "number" ? { id: event.id } : {}),
  };
}

export function emptyWeeklyReview(weekStart: string): WeeklyReview {
  return {
    weekStart,
    updatedAt: "",
    previousPlanOutcome: "",
    results: ["", "", ""],
    support: "",
    obstacle: "",
    nextLever: "",
    ifThenPlan: "",
  };
}

export function normalizeWeeklyReview(review: Partial<WeeklyReview> & { weekStart: string }): WeeklyReview {
  return {
    ...emptyWeeklyReview(review.weekStart),
    ...review,
    previousPlanOutcome: typeof review.previousPlanOutcome === "string" ? review.previousPlanOutcome : "",
    updatedAt: typeof review.updatedAt === "string" ? review.updatedAt : "",
    results: Array.isArray(review.results) ? review.results.filter((result): result is string => typeof result === "string") : ["", "", ""],
    support: typeof review.support === "string" ? review.support : "",
    obstacle: typeof review.obstacle === "string" ? review.obstacle : "",
    nextLever: typeof review.nextLever === "string" ? review.nextLever : "",
    ifThenPlan: typeof review.ifThenPlan === "string" ? review.ifThenPlan : "",
  };
}

export function emptyMonthlyReview(monthStart: string): MonthlyReview {
  return {
    monthStart,
    updatedAt: "",
    mainPattern: "",
    support: "",
    obstacle: "",
    courseChange: "",
    nextFocus: "",
    ifThenPlan: "",
  };
}

export function normalizeMonthlyReview(review: Partial<MonthlyReview> & { monthStart: string }): MonthlyReview {
  return {
    ...emptyMonthlyReview(review.monthStart),
    ...review,
    mainPattern: typeof review.mainPattern === "string" ? review.mainPattern : "",
    updatedAt: typeof review.updatedAt === "string" ? review.updatedAt : "",
    support: typeof review.support === "string" ? review.support : "",
    obstacle: typeof review.obstacle === "string" ? review.obstacle : "",
    courseChange: typeof review.courseChange === "string" ? review.courseChange : "",
    nextFocus: typeof review.nextFocus === "string" ? review.nextFocus : "",
    ifThenPlan: typeof review.ifThenPlan === "string" ? review.ifThenPlan : "",
  };
}
