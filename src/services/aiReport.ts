import { buildObservations, entriesForPeriod, factorSummaries, resultsForPeriod, summarize, weekSummaryText } from './analytics';
import { addDays, addMonths, endOfMonth, endOfWeek, formatDate, startOfMonth, startOfWeek, todayKey } from './dates';
import {
  actionDirectionOptions,
  activityOptions,
  careerOptions,
  eveningFactorOptions,
  lifeAreaOptions,
  lifeEventTypeOptions,
  nutritionOptions,
  resultAreaOptions,
  specialDayOptions,
  type AppSettings,
  type DailyEntry,
  type LifeEventRecord,
  type MonthlyReview,
  type ResultRecord,
  type WeeklyReview,
} from '../types';

export type AiReportPeriod = 'week' | 'month' | 'range';

export type AiReportPayload = {
  app: 'trajectory';
  version: 4;
  period: AiReportPeriod;
  rangeMonths?: number;
  start: string;
  end: string;
  dataThrough: string;
  generatedAt: string;
  summary: ReturnType<typeof summarize>;
  observations: ReturnType<typeof buildObservations>;
  factorSummaries: ReturnType<typeof factorSummaries>;
  entries: DailyEntry[];
  results: ResultRecord[];
  lifeEvents: LifeEventRecord[];
  weeklyReview?: WeeklyReview;
  previousWeeklyReview?: WeeklyReview;
  monthlyReview?: MonthlyReview;
  previousMonthlyReview?: MonthlyReview;
  monthlyReviews?: MonthlyReview[];
  labels: ReturnType<typeof buildLabelDictionary>;
  settingsSnapshot: {
    activeLifeAreas: string[];
    activeFocusTitle: string;
    externalEvidenceCriterion: string;
    nutritionGoalCriterion: string;
    experiment: AppSettings['experiment'];
  };
};

export type AiReportSourceData = {
  entries: DailyEntry[];
  results: ResultRecord[];
  lifeEvents: LifeEventRecord[];
  reviews: WeeklyReview[];
  monthlyReviews: MonthlyReview[];
  settings: AppSettings;
};

export function buildAiReportPayload(period: Exclude<AiReportPeriod, 'range'>, anchor: string, source: AiReportSourceData): AiReportPayload {
  const start = period === 'week' ? startOfWeek(anchor) : startOfMonth(anchor);
  const end = period === 'week' ? endOfWeek(anchor) : endOfMonth(anchor);
  const dataThrough = end < todayKey() ? end : todayKey();
  return buildPayload(period, start, end, dataThrough, source, {
    weeklyReview: period === 'week' ? source.reviews.find((review) => review.weekStart === start) : undefined,
    previousWeeklyReview: period === 'week' ? source.reviews.find((review) => review.weekStart === addDays(start, -7)) : undefined,
    monthlyReview: period === 'month' ? source.monthlyReviews.find((review) => review.monthStart === start) : undefined,
    previousMonthlyReview: period === 'month' ? source.monthlyReviews.find((review) => review.monthStart === addMonths(start, -1)) : undefined,
  });
}

export function buildAiReportRangePayload(rangeMonths: number, anchor: string, source: AiReportSourceData): AiReportPayload {
  const start = startOfMonth(addMonths(anchor, -(rangeMonths - 1)));
  const end = anchor < todayKey() ? anchor : todayKey();
  return buildPayload('range', start, end, end, source, {
    rangeMonths,
    monthlyReviews: source.monthlyReviews.filter((review) => review.monthStart >= start && review.monthStart <= end).sort((a, b) => a.monthStart.localeCompare(b.monthStart)),
  });
}

function buildPayload(
  period: AiReportPeriod,
  start: string,
  end: string,
  dataThrough: string,
  source: AiReportSourceData,
  extra: Partial<AiReportPayload>,
): AiReportPayload {
  const entries = dataThrough >= start ? entriesForPeriod(source.entries, start, dataThrough) : [];
  const careerItems = [...careerOptions, ...source.settings.customCareerOptions];
  const factorItems = [...eveningFactorOptions, ...source.settings.customEveningFactorOptions];
  const externalCareerIds = careerItems.filter((option) => option.countsAsExternal || ['external', 'interview', 'result'].includes(option.id)).map((option) => option.id);

  return {
    app: 'trajectory',
    version: 4,
    period,
    start,
    end,
    dataThrough,
    generatedAt: new Date().toISOString(),
    summary: summarize(entries, externalCareerIds),
    observations: buildObservations(entries, factorItems),
    factorSummaries: factorSummaries(entries, factorItems),
    entries,
    results: dataThrough >= start ? resultsForPeriod(source.results, start, dataThrough) : [],
    lifeEvents: source.lifeEvents.filter((event) => event.date >= start && event.date <= dataThrough).sort((a, b) => b.date.localeCompare(a.date)),
    labels: buildLabelDictionary(source.settings),
    settingsSnapshot: {
      activeLifeAreas: source.settings.activeLifeAreas,
      activeFocusTitle: source.settings.activeFocusTitle,
      externalEvidenceCriterion: source.settings.externalEvidenceCriterion,
      nutritionGoalCriterion: source.settings.nutritionGoalCriterion,
      experiment: { ...source.settings.experiment },
    },
    ...extra,
  };
}

function buildLabelDictionary(settings: AppSettings) {
  const copyOptions = <T extends string>(options: Array<{ id: T; label: string; countsAsExternal?: boolean; archived?: boolean }>) => options.map(({ id, label, countsAsExternal, archived }) => ({ id, label, ...(countsAsExternal ? { countsAsExternal: true } : {}), ...(archived ? { archived: true } : {}) }));
  return {
    career: copyOptions([...careerOptions, ...settings.customCareerOptions]),
    lifeAreas: copyOptions([...lifeAreaOptions, ...settings.customLifeAreaOptions]),
    eveningFactors: copyOptions([...eveningFactorOptions, ...settings.customEveningFactorOptions]),
    activities: copyOptions(activityOptions),
    actionDirections: copyOptions(actionDirectionOptions),
    nutrition: copyOptions(nutritionOptions),
    specialDays: copyOptions(specialDayOptions),
    eventTypes: copyOptions(lifeEventTypeOptions),
    resultAreas: copyOptions([...resultAreaOptions, ...settings.customLifeAreaOptions]),
  };
}

export function buildAiReportPrompt(payload: AiReportPayload, settings: AppSettings): string {
  const areaOptions = [...lifeAreaOptions, ...settings.customLifeAreaOptions];
  const summaryText = payload.period === 'week' ? weekSummaryText(payload.summary, settings.activeLifeAreas, areaOptions) : '';
  const periodTitle = payload.period === 'week'
    ? `неделю ${formatDate(payload.start, { day: 'numeric', month: 'short' })} — ${formatDate(payload.end, { day: 'numeric', month: 'short' })}`
    : payload.period === 'month'
      ? `месяц ${formatDate(payload.start, { month: 'long', year: 'numeric' })}`
      : `${payload.rangeMonths ?? 'несколько'} месяцев: ${formatDate(payload.start, { month: 'short', year: 'numeric' })} — ${formatDate(payload.end, { month: 'short', year: 'numeric' })}`;

  return [
    `Проанализируй данные личного трекера «Траектория» за ${periodTitle}. Фактические данные доступны по ${formatDate(payload.dataThrough, { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    '',
    'Роль: спокойный аналитик поведения. Не морализируй, не ставь диагнозы, не оценивай личность и не считай общий балл.',
    'Цель: показать факты, повторяющиеся условия, осторожные гипотезы и 1–3 практических изменения на следующий период.',
    '',
    'Формат ответа:',
    '1. Короткая фактическая сводка с числом наблюдений.',
    '2. Что поддерживало состояние и движение.',
    '3. Что могло мешать; называй это связью, а не причиной.',
    '4. Какие действия дали внешний результат, а где преобладала подготовка.',
    '5. Одно главное изменение и короткий план «если — то».',
    '6. Ограничения данных: пропуски, малая выборка, особые дни и неполный период.',
    '7. Если есть прошлый обзор, сопоставь его решение с последующими фактами.',
    '',
    'Правила:',
    '- технические идентификаторы расшифровывай через объект labels;',
    '- пропуск не считай нулём или ответом «нет»;',
    '- особые дни не используй как обычную базу сравнения;',
    '- вечерний фактор сравнивай с отмеченными днями без него;',
    '- не обсуждай карьеру, вес или эксперимент, если соответствующих данных нет;',
    '- не продолжай данные в будущее и не выдавай сглаживание за прогноз;',
    '',
    summaryText ? `Локальная сводка приложения: ${summaryText}` : '',
    '',
    'Данные JSON:',
    JSON.stringify(payload, null, 2),
  ].filter(Boolean).join('\n');
}
