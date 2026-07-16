import { buildObservations, entriesForMonth, entriesForWeek, factorSummaries, resultsForPeriod, summarize, weekSummaryText } from './analytics';
import { endOfMonth, endOfWeek, formatDate, startOfMonth, startOfWeek } from './dates';
import type { AppSettings, DailyEntry, LifeEventRecord, ResultRecord, WeeklyReview } from '../types';
import { lifeAreaOptions } from '../types';

export type AiReportPeriod = 'week' | 'month';

export type AiReportPayload = {
  app: 'trajectory';
  version: 2;
  period: AiReportPeriod;
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
  settingsSnapshot: {
    activeLifeAreas: string[];
    experimentActive: boolean;
    experimentTitle: string;
  };
};

type SourceData = {
  entries: DailyEntry[];
  results: ResultRecord[];
  lifeEvents: LifeEventRecord[];
  reviews: WeeklyReview[];
  settings: AppSettings;
};

export function buildAiReportPayload(period: AiReportPeriod, anchor: string, source: SourceData): AiReportPayload {
  const start = period === 'week' ? startOfWeek(anchor) : startOfMonth(anchor);
  const end = period === 'week' ? endOfWeek(anchor) : endOfMonth(anchor);
  const entries = period === 'week' ? entriesForWeek(source.entries, anchor) : entriesForMonth(source.entries, anchor);
  const externalCareerIds = ['external', 'interview', 'result', ...source.settings.customCareerOptions.filter((option) => option.countsAsExternal).map((option) => option.id)];

  return {
    app: 'trajectory',
    version: 2,
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
    settingsSnapshot: {
      activeLifeAreas: source.settings.activeLifeAreas,
      experimentActive: source.settings.experiment.active,
      experimentTitle: source.settings.experiment.title,
    },
  };
}

export function buildAiReportPrompt(payload: AiReportPayload, settings: AppSettings): string {
  const areaOptions = [...lifeAreaOptions, ...settings.customLifeAreaOptions];
  const summaryText = payload.period === 'week' ? weekSummaryText(payload.summary, settings.activeLifeAreas, areaOptions) : '';
  const periodTitle = payload.period === 'week'
    ? `неделю ${formatDate(payload.start, { day: 'numeric', month: 'short' })} — ${formatDate(payload.end, { day: 'numeric', month: 'short' })}`
    : `месяц ${formatDate(payload.start, { month: 'long', year: 'numeric' })}`;

  return [
    `Проанализируй данные приложения "Траектория" за ${periodTitle}.`,
    '',
    'Роль: спокойный аналитик поведения. Не морализируй, не ставь диагнозы, не используй стыд, оценки личности, streaks или общий балл.',
    'Цель: помочь увидеть факты, повторяющиеся факторы, возможные связи и 1-3 мягких рычага на следующий период.',
    '',
    'Формат ответа:',
    '1. Короткая фактическая сводка.',
    '2. Что поддерживало движение.',
    '3. Что, вероятно, мешало сну/энергии/карьере.',
    '4. Осторожные гипотезы, только если данных достаточно.',
    '5. Один главный рычаг на следующий период.',
    '6. Что не стоит переинтерпретировать из-за малого количества данных или особых дней.',
    '',
    summaryText ? `Локальная сводка приложения: ${summaryText}` : '',
    '',
    'Данные JSON:',
    JSON.stringify(payload, null, 2),
  ].filter(Boolean).join('\n');
}
