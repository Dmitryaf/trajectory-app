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

const removedDemoCareerOptionId = "custom:career:responses";
const removedDemoContextFactorId = "custom:evening:shower";

export type DailyEntry = {
  date: string;
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
  targetMetric: string;
  startDate: string;
  endDate: string;
  conclusion: string;
};

export type AppSettings = {
  id: "main";
  settingsVersion: number;
  activeDailyBlocks: DailyBlockId[];
  activeLifeAreas: LifeAreaId[];
  customCareerOptions: Option<CareerState>[];
  customLifeAreaOptions: Option<LifeAreaId>[];
  customContextFactorOptions: Option<ContextFactorId>[];
  activeFocusTitle: string;
  externalEvidenceCriterion: string;
  nutritionGoalCriterion: string;
  experiment: Experiment;
};

export type Option<T extends string = string> = {
  id: T;
  label: string;
  icon?: string;
  custom?: boolean;
  countsAsExternal?: boolean;
  archived?: boolean;
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
  { id: "late_bedtime", label: "Поздно лёг", icon: "◷" },
  { id: "screen", label: "Экран перед сном", icon: "▣" },
  { id: "news", label: "Новости", icon: "!" },
  { id: "series_video", label: "Сериалы/видео", icon: "▶" },
  { id: "work_code", label: "Работа/код", icon: "◇" },
  { id: "late_food", label: "Поздняя еда", icon: "+" },
  { id: "caffeine_alcohol", label: "Кофеин/алкоголь", icon: "◌" },
  { id: "anxiety_overload", label: "Тревога/перегруз", icon: "⌁" },
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

export const defaultSettings: AppSettings = {
  id: "main",
  settingsVersion: 5,
  activeDailyBlocks: dailyBlockOptions.map((option) => option.id),
  activeLifeAreas: ["family", "reading", "creativity", "rest"],
  customCareerOptions: [],
  customLifeAreaOptions: [],
  customContextFactorOptions: [],
  activeFocusTitle: "",
  externalEvidenceCriterion: "",
  nutritionGoalCriterion: "",
  experiment: { active: false, title: "", hypothesis: "", targetMetric: "", startDate: "", endDate: "", conclusion: "" },
};

export const externalCareerStates: CareerState[] = ["external", "interview", "result"];

type LegacyAppSettings = Partial<AppSettings> & {
  customEveningFactorOptions?: unknown;
};

export function normalizeSettings(settings: LegacyAppSettings | null | undefined): AppSettings {
  const source = settings ?? {};
  const customCareerOptions = sanitizeOptions(source.customCareerOptions)
    .filter((option) => option.id !== removedDemoCareerOptionId);
  const customLifeAreaOptions = sanitizeOptions(source.customLifeAreaOptions);
  const customContextFactorOptions = sanitizeOptions(source.customContextFactorOptions ?? source.customEveningFactorOptions)
    .filter((option) => option.id !== removedDemoContextFactorId);

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
    activeFocusTitle: typeof source.activeFocusTitle === "string" ? source.activeFocusTitle : "",
    externalEvidenceCriterion: typeof source.externalEvidenceCriterion === "string" ? source.externalEvidenceCriterion : "",
    nutritionGoalCriterion: typeof source.nutritionGoalCriterion === "string" ? source.nutritionGoalCriterion : "",
    experiment: normalizeExperiment(source.experiment),
  };
}

function normalizeExperiment(value: unknown): Experiment {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<Experiment> : {};
  return {
    active: typeof source.active === "boolean" ? source.active : false,
    title: typeof source.title === "string" ? source.title : "",
    hypothesis: typeof source.hypothesis === "string" ? source.hypothesis : "",
    targetMetric: typeof source.targetMetric === "string" ? source.targetMetric : "",
    startDate: typeof source.startDate === "string" ? source.startDate : "",
    endDate: typeof source.endDate === "string" ? source.endDate : "",
    conclusion: typeof source.conclusion === "string" ? source.conclusion : "",
  };
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

  return {
    ...emptyDailyEntry(entry.date),
    bedtime: validTime(entry.bedtime),
    wakeTime: validTime(entry.wakeTime),
    sleepMinutes: nullableNumber(entry.sleepMinutes, 0, 24 * 60, true),
    timeInBedMinutes: nullableNumber(entry.timeInBedMinutes, 0, 18 * 60, true),
    sleepQuality: nullableNumber(entry.sleepQuality, 1, 5, true),
    energy: nullableNumber(entry.energy, 1, 5, true),
    careerState: careerStates[0] ?? null,
    careerStates,
    weightKg: nullableNumber(entry.weightKg, 30, 250),
    activities,
    activitiesRecorded: typeof entry.activitiesRecorded === "boolean" ? entry.activitiesRecorded : activities.length > 0,
    nutritionState: isNutritionState(entry.nutritionState) ? entry.nutritionState : null,
    nutritionNote: typeof entry.nutritionNote === "string" ? entry.nutritionNote : "",
    nutritionCriterion: typeof entry.nutritionCriterion === "string" ? entry.nutritionCriterion : "",
    actionDirection: isActionDirection(entry.actionDirection) ? entry.actionDirection : null,
    actionNote: typeof entry.actionNote === "string" ? entry.actionNote : "",
    focusTitle: typeof entry.focusTitle === "string" ? entry.focusTitle : "",
    externalEvidenceCriterion: typeof entry.externalEvidenceCriterion === "string" ? entry.externalEvidenceCriterion : "",
    lifeAreas: Array.isArray(entry.lifeAreas) ? entry.lifeAreas.filter((area): area is LifeAreaId => typeof area === "string") : [],
    lifeAreasRecorded: typeof entry.lifeAreasRecorded === "boolean" ? entry.lifeAreasRecorded : Array.isArray(entry.lifeAreas) && entry.lifeAreas.length > 0,
    contextFactors,
    contextFactorsRecorded: typeof entry.contextFactorsRecorded === "boolean"
      ? entry.contextFactorsRecorded
      : typeof entry.eveningFactorsRecorded === "boolean" ? entry.eveningFactorsRecorded : sourceContextFactors.length > 0,
    contextNote,
    specialDay: typeof entry.specialDay === "string" && specialDayOptions.some((option) => option.id === entry.specialDay) ? entry.specialDay : null,
    specialDayNote: typeof entry.specialDayNote === "string" ? entry.specialDayNote : "",
    importantFact: typeof entry.importantFact === "string" ? entry.importantFact : "",
    experimentCompleted: typeof entry.experimentCompleted === "boolean" ? entry.experimentCompleted : null,
    updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : "",
  };
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
