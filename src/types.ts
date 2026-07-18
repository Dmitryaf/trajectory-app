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
export type EveningFactorId =
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
export type BaseLifeAreaId =
  | "family"
  | "reading"
  | "creativity"
  | "spiritual"
  | "rest"
  | "friends"
  | "english";
export type LifeAreaId = BaseLifeAreaId | string;

export type DailyEntry = {
  date: string;
  bedtime: string;
  wakeTime: string;
  sleepMinutes: number | null;
  timeInBedMinutes: number | null;
  sleepQuality: number | null;
  energy: number | null;
  stateContext: string;
  eveningFactors: EveningFactorId[];
  eveningFactorNote: string;
  specialDay: SpecialDayId | null;
  specialDayNote: string;
  careerState: CareerState | null;
  careerStates: CareerState[];
  activities: ActivityId[];
  nutritionState: NutritionState | null;
  nutritionNote: string;
  nutritionCriterion: string;
  weightKg: number | null;
  actionDirection: ActionDirectionId | null;
  actionNote: string;
  focusTitle: string;
  externalEvidenceCriterion: string;
  lifeAreas: LifeAreaId[];
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
  previousPlanOutcome: string;
  results: string[];
  support: string;
  obstacle: string;
  nextLever: string;
  ifThenPlan: string;
};

export type MonthlyReview = {
  monthStart: string;
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
  activeLifeAreas: LifeAreaId[];
  customCareerOptions: Option<CareerState>[];
  customLifeAreaOptions: Option<LifeAreaId>[];
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
};

export const careerOptions: Option<BaseCareerState>[] = [
  { id: "preparation", label: "Подготовка", icon: "◫" },
  { id: "project", label: "Проект", icon: "◇" },
  { id: "external", label: "Внешний шаг", icon: "↗" },
  { id: "interview", label: "Собеседование", icon: "◉" },
  { id: "result", label: "Результат", icon: "✓" },
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
  { id: "external", label: "Внешний шаг", icon: "↗" },
  { id: "preparation", label: "Подготовка", icon: "◫" },
  { id: "maintenance", label: "Поддержание", icon: "○" },
  { id: "recovery", label: "Восстановление", icon: "◌" },
  { id: "drift", label: "Уход в сторону", icon: "!" },
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
  { id: "milestone", label: "Веха", icon: "◆" },
  { id: "decision", label: "Решение", icon: "✓" },
  { id: "event", label: "Событие", icon: "◉" },
  { id: "insight", label: "Наблюдение", icon: "✦" },
  { id: "other", label: "Другое", icon: "·" },
];

export const eveningFactorOptions: Option<EveningFactorId>[] = [
  { id: "late_bedtime", label: "Поздно лёг", icon: "◷" },
  { id: "screen", label: "Экран перед сном", icon: "▣" },
  { id: "news", label: "Новости", icon: "!" },
  { id: "series_video", label: "Сериалы/видео", icon: "▶" },
  { id: "porn", label: "Порно", icon: "·" },
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

export const defaultSettings: AppSettings = {
  id: "main",
  activeLifeAreas: ["family", "reading", "creativity", "spiritual", "rest"],
  customCareerOptions: [],
  customLifeAreaOptions: [],
  activeFocusTitle: "",
  externalEvidenceCriterion: "",
  nutritionGoalCriterion: "",
  experiment: { active: false, title: "", hypothesis: "", targetMetric: "", startDate: "", endDate: "", conclusion: "" },
};

export const externalCareerStates: CareerState[] = ["external", "interview", "result"];

export function normalizeSettings(settings: Partial<AppSettings> | null | undefined): AppSettings {
  const source = settings ?? {};
  const customCareerOptions = sanitizeOptions(source.customCareerOptions);
  const customLifeAreaOptions = sanitizeOptions(source.customLifeAreaOptions);

  return {
    ...structuredClone(defaultSettings),
    ...source,
    id: "main",
    activeLifeAreas: Array.isArray(source.activeLifeAreas) ? source.activeLifeAreas.filter((area): area is LifeAreaId => typeof area === "string") : defaultSettings.activeLifeAreas,
    customCareerOptions,
    customLifeAreaOptions,
    activeFocusTitle: typeof source.activeFocusTitle === "string" ? source.activeFocusTitle : "",
    externalEvidenceCriterion: typeof source.externalEvidenceCriterion === "string" ? source.externalEvidenceCriterion : "",
    nutritionGoalCriterion: typeof source.nutritionGoalCriterion === "string" ? source.nutritionGoalCriterion : "",
    experiment: { ...defaultSettings.experiment, ...(source.experiment ?? {}) },
  };
}

export function createCustomOption(label: string, prefix: "career" | "life"): Option<string> {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return { id: `custom:${prefix}:${suffix}`, label: label.trim(), icon: "+", custom: true };
}

function sanitizeOptions(options: unknown): Option<string>[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter((option): option is Option<string> => Boolean(option) && typeof option.id === "string" && typeof option.label === "string")
    .map((option) => ({
      id: option.id,
      label: option.label,
      icon: option.icon ?? "+",
      custom: true,
      countsAsExternal: Boolean(option.countsAsExternal),
    }));
}

function isNutritionState(value: unknown): value is NutritionState {
  return typeof value === "string" && nutritionOptions.some((option) => option.id === value);
}

function isActionDirection(value: unknown): value is ActionDirectionId {
  return typeof value === "string" && actionDirectionOptions.some((option) => option.id === value);
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
    stateContext: "",
    eveningFactors: [],
    eveningFactorNote: "",
    specialDay: null,
    specialDayNote: "",
    careerState: null,
    careerStates: [],
    activities: [],
    nutritionState: null,
    nutritionNote: "",
    nutritionCriterion: "",
    weightKg: null,
    actionDirection: null,
    actionNote: "",
    focusTitle: "",
    externalEvidenceCriterion: "",
    lifeAreas: [],
    importantFact: "",
    experimentCompleted: null,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeDailyEntry(entry: Partial<DailyEntry> & { date: string }): DailyEntry {
  const careerStates = Array.isArray(entry.careerStates)
    ? Array.from(new Set(entry.careerStates.filter((state): state is CareerState => typeof state === "string")))
    : typeof entry.careerState === "string" ? [entry.careerState] : [];

  return {
    ...emptyDailyEntry(entry.date),
    ...entry,
    bedtime: typeof entry.bedtime === "string" ? entry.bedtime : "",
    wakeTime: typeof entry.wakeTime === "string" ? entry.wakeTime : "",
    careerState: careerStates[0] ?? null,
    careerStates,
    timeInBedMinutes: typeof entry.timeInBedMinutes === "number" ? entry.timeInBedMinutes : null,
    weightKg: typeof entry.weightKg === "number" ? entry.weightKg : null,
    activities: Array.isArray(entry.activities) ? entry.activities : [],
    nutritionState: isNutritionState(entry.nutritionState) ? entry.nutritionState : null,
    nutritionNote: typeof entry.nutritionNote === "string" ? entry.nutritionNote : "",
    nutritionCriterion: typeof entry.nutritionCriterion === "string" ? entry.nutritionCriterion : "",
    actionDirection: isActionDirection(entry.actionDirection) ? entry.actionDirection : null,
    actionNote: typeof entry.actionNote === "string" ? entry.actionNote : "",
    focusTitle: typeof entry.focusTitle === "string" ? entry.focusTitle : "",
    externalEvidenceCriterion: typeof entry.externalEvidenceCriterion === "string" ? entry.externalEvidenceCriterion : "",
    lifeAreas: Array.isArray(entry.lifeAreas) ? entry.lifeAreas : [],
    stateContext: typeof entry.stateContext === "string" ? entry.stateContext : "",
    eveningFactors: Array.isArray(entry.eveningFactors) ? entry.eveningFactors : [],
    eveningFactorNote: typeof entry.eveningFactorNote === "string" ? entry.eveningFactorNote : "",
    specialDay: typeof entry.specialDay === "string" ? entry.specialDay : null,
    specialDayNote: typeof entry.specialDayNote === "string" ? entry.specialDayNote : "",
    importantFact: typeof entry.importantFact === "string" ? entry.importantFact : "",
  };
}

export function normalizeLifeEvent(event: Partial<LifeEventRecord> & { date: string; title: string }): LifeEventRecord {
  return {
    date: event.date,
    type: typeof event.type === "string" ? event.type : "event",
    title: typeof event.title === "string" ? event.title : "",
    note: typeof event.note === "string" ? event.note : "",
    createdAt: typeof event.createdAt === "string" ? event.createdAt : new Date().toISOString(),
    ...(typeof event.id === "number" ? { id: event.id } : {}),
  };
}

export function emptyWeeklyReview(weekStart: string): WeeklyReview {
  return {
    weekStart,
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
    results: Array.isArray(review.results) ? review.results : ["", "", ""],
    support: typeof review.support === "string" ? review.support : "",
    obstacle: typeof review.obstacle === "string" ? review.obstacle : "",
    nextLever: typeof review.nextLever === "string" ? review.nextLever : "",
    ifThenPlan: typeof review.ifThenPlan === "string" ? review.ifThenPlan : "",
  };
}

export function emptyMonthlyReview(monthStart: string): MonthlyReview {
  return {
    monthStart,
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
    support: typeof review.support === "string" ? review.support : "",
    obstacle: typeof review.obstacle === "string" ? review.obstacle : "",
    courseChange: typeof review.courseChange === "string" ? review.courseChange : "",
    nextFocus: typeof review.nextFocus === "string" ? review.nextFocus : "",
    ifThenPlan: typeof review.ifThenPlan === "string" ? review.ifThenPlan : "",
  };
}
