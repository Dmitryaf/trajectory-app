import { buildObservations, entriesForMonth, entriesForPeriod, entriesForWeek, factorSummaries, resultsForPeriod, summarize, weekSummaryText } from './analytics';
import { addMonths, endOfMonth, endOfWeek, formatDate, startOfMonth, startOfWeek } from './dates';
import type { AppSettings, DailyEntry, LifeEventRecord, MonthlyReview, ResultRecord, WeeklyReview } from '../types';
import { lifeAreaOptions } from '../types';

export type AiReportPeriod = 'week' | 'month' | 'range';

export type AiReportPayload = {
  app: 'trajectory';
  version: 3;
  period: AiReportPeriod;
  rangeMonths?: number;
  start: string;
  end: string;
  generatedAt: string;
  summary: ReturnType<typeof summarize>;
  observations: ReturnType<typeof buildObservations>;
  factorSummaries: ReturnType<typeof factorSummaries>;
  entries: DailyEntry[];
  results: ResultRecord[];
  lifeEvents: LifeEventRecord[];
  weeklyReview?: WeeklyReview;
  monthlyReview?: MonthlyReview;
  monthlyReviews?: MonthlyReview[];
  settingsSnapshot: {
    activeLifeAreas: string[];
    activeFocusTitle: string;
    externalEvidenceCriterion: string;
    nutritionGoalCriterion: string;
    experimentActive: boolean;
    experimentTitle: string;
    experimentHypothesis: string;
    experimentTargetMetric: string;
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
  const entries = period === 'week' ? entriesForWeek(source.entries, anchor) : entriesForMonth(source.entries, anchor);
  const externalCareerIds = ['external', 'interview', 'result', ...source.settings.customCareerOptions.filter((option) => option.countsAsExternal).map((option) => option.id)];

  return {
    app: 'trajectory',
    version: 3,
    period,
    start,
    end,
    generatedAt: new Date().toISOString(),
    summary: summarize(entries, externalCareerIds),
    observations: buildObservations(entries),
    factorSummaries: factorSummaries(entries),
    entries,
    results: resultsForPeriod(source.results, start, end),
    lifeEvents: source.lifeEvents.filter((event) => event.date >= start && event.date <= end).sort((a, b) => b.date.localeCompare(a.date)),
    weeklyReview: period === 'week' ? source.reviews.find((review) => review.weekStart === start) : undefined,
    monthlyReview: period === 'month' ? source.monthlyReviews.find((review) => review.monthStart === start) : undefined,
    settingsSnapshot: {
      activeLifeAreas: source.settings.activeLifeAreas,
      activeFocusTitle: source.settings.activeFocusTitle,
      externalEvidenceCriterion: source.settings.externalEvidenceCriterion,
      nutritionGoalCriterion: source.settings.nutritionGoalCriterion,
      experimentActive: source.settings.experiment.active,
      experimentTitle: source.settings.experiment.title,
      experimentHypothesis: source.settings.experiment.hypothesis,
      experimentTargetMetric: source.settings.experiment.targetMetric,
    },
  };
}

export function buildAiReportRangePayload(rangeMonths: number, anchor: string, source: AiReportSourceData): AiReportPayload {
  const start = startOfMonth(addMonths(anchor, -(rangeMonths - 1)));
  const end = anchor;
  const entries = entriesForPeriod(source.entries, start, end);
  const externalCareerIds = ['external', 'interview', 'result', ...source.settings.customCareerOptions.filter((option) => option.countsAsExternal).map((option) => option.id)];

  return {
    app: 'trajectory',
    version: 3,
    period: 'range',
    rangeMonths,
    start,
    end,
    generatedAt: new Date().toISOString(),
    summary: summarize(entries, externalCareerIds),
    observations: buildObservations(entries),
    factorSummaries: factorSummaries(entries),
    entries,
    results: resultsForPeriod(source.results, start, end),
    lifeEvents: source.lifeEvents.filter((event) => event.date >= start && event.date <= end).sort((a, b) => b.date.localeCompare(a.date)),
    monthlyReviews: source.monthlyReviews.filter((review) => review.monthStart >= start && review.monthStart <= end).sort((a, b) => a.monthStart.localeCompare(b.monthStart)),
    settingsSnapshot: {
      activeLifeAreas: source.settings.activeLifeAreas,
      activeFocusTitle: source.settings.activeFocusTitle,
      externalEvidenceCriterion: source.settings.externalEvidenceCriterion,
      nutritionGoalCriterion: source.settings.nutritionGoalCriterion,
      experimentActive: source.settings.experiment.active,
      experimentTitle: source.settings.experiment.title,
      experimentHypothesis: source.settings.experiment.hypothesis,
      experimentTargetMetric: source.settings.experiment.targetMetric,
    },
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
    `Проанализируй данные приложения "Траектория" за ${periodTitle}.`,
    '',
    'Роль: спокойный аналитик поведения. Не морализируй, не ставь диагнозы, не используй стыд, оценки личности, streaks или общий балл.',
    'Цель: помочь увидеть факты, повторяющиеся факторы, возможные связи и 1-3 понятных изменения на следующий период.',
    '',
    'Формат ответа:',
    '1. Короткая фактическая сводка.',
    '2. Что поддерживало движение.',
    '3. Что, вероятно, мешало сну, энергии, действиям или цели по весу.',
    '4. Где подготовка могла заменять реальные шаги: отклик, разговор, публикацию, встречу, собеседование или другой ответ извне.',
    '5. Одно главное изменение на следующий период и короткий план если-то.',
    '6. Что не стоит переинтерпретировать из-за малого количества данных или особых дней.',
    '7. Если есть сохранённый прошлый обзор: что из принятого решения подтвердилось, а что нет.',
    '',
    'Правила анализа данных:',
    '- всегда учитывай число наблюдений по конкретной метрике, а не только общее число записей;',
    '- особые дни не используй как обычную базу сравнения;',
    '- фактор считай только возможной связью и сравнивай с днями без него;',
    '- неполный текущий месяц не сравнивай с полным без поправки;',
    '',
    summaryText ? `Локальная сводка приложения: ${summaryText}` : '',
    '',
    'Данные JSON:',
    JSON.stringify(payload, null, 2),
  ].filter(Boolean).join('\n');
}
