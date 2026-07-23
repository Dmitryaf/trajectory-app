import { buildObservations, entriesForPeriod, factorSummaries, resultsForPeriod, summarize, weekSummaryText } from '../../services/analytics';
import { buildExperimentSummary, type ExperimentSummary } from '../analytics/experimentComparison';
import { experimentDecisionLabel } from '../experiments/model';
import { addDays, addMonths, endOfMonth, endOfWeek, formatDate, formatMinutes, startOfMonth, startOfWeek, todayKey } from '../../services/dates';
import {
  actionDirectionOptions,
  activityOptions,
  careerOptions,
  dailyFieldWasRecorded,
  dailyBlockOptions,
  contextFactorOptions,
  lifeAreaOptions,
  legacyActivityOptions,
  legacyContextFactorOptions,
  lifeEventTypeOptions,
  nutritionOptions,
  resultAreaOptions,
  specialDayOptions,
  type AppSettings,
  type DailyEntry,
  type ExperimentMetricId,
  type ExperimentRecord,
  type LifeEventRecord,
  type MonthlyReview,
  type ResultRecord,
  type WeeklyReview,
} from '../../types';

export type AiReportPeriod = 'week' | 'month' | 'range';
export const AI_PROMPT_CHARACTER_LIMIT = 48_000;

export type AiReportPayload = {
  app: 'trajectory';
  version: 9;
  period: AiReportPeriod;
  rangeMonths?: number;
  start: string;
  end: string;
  dataThrough: string;
  generatedAt: string;
  summary: ReturnType<typeof summarize>;
  observations: ReturnType<typeof buildObservations>;
  factorSummaries: ReturnType<typeof factorSummaries>;
  experimentSummary: ExperimentSummary | null;
  experimentHistory: Array<{ record: ExperimentRecord; summary: ExperimentSummary | null }>;
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
    activeDailyBlocks: AppSettings['activeDailyBlocks'];
    activeLifeAreas: string[];
    activeFocusTitle: string;
    focusOutcomeCriterion: string;
    focusReviewDate: string;
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
  const factorItems = [...contextFactorOptions, ...source.settings.customContextFactorOptions];
  const externalCareerIds = careerItems.filter((option) => option.countsAsExternal || ['external', 'interview', 'result'].includes(option.id)).map((option) => option.id);

  return {
    app: 'trajectory',
    version: 9,
    period,
    start,
    end,
    dataThrough,
    generatedAt: new Date().toISOString(),
    summary: summarize(entries, externalCareerIds),
    observations: buildObservations(entries, factorItems),
    factorSummaries: factorSummaries(entries, factorItems),
    experimentSummary: buildExperimentSummary(source.entries, source.settings.experiment),
    experimentHistory: source.settings.experimentHistory
      .filter((record) => record.endDate >= start && record.endDate <= dataThrough)
      .map((record) => ({ record: { ...record }, summary: buildExperimentSummary(source.entries, record) })),
    entries,
    results: dataThrough >= start ? resultsForPeriod(source.results, start, dataThrough) : [],
    lifeEvents: source.lifeEvents.filter((event) => event.date >= start && event.date <= dataThrough).sort((a, b) => b.date.localeCompare(a.date)),
    labels: buildLabelDictionary(source.settings),
    settingsSnapshot: {
      activeDailyBlocks: source.settings.activeDailyBlocks,
      activeLifeAreas: source.settings.activeLifeAreas,
      activeFocusTitle: source.settings.activeFocusTitle,
      focusOutcomeCriterion: source.settings.focusOutcomeCriterion,
      focusReviewDate: source.settings.focusReviewDate,
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
    contextFactors: copyOptions([...contextFactorOptions, ...legacyContextFactorOptions, ...settings.customContextFactorOptions]),
    activities: copyOptions([...activityOptions, ...legacyActivityOptions, ...settings.customActivityOptions]),
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

  const sections = buildReadableSections(payload);

  const prompt = [
    `Проанализируй данные личного трекера «Траектория» за ${periodTitle}. Фактические данные доступны по ${formatDate(payload.dataThrough, { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    '',
    'Роль: спокойный аналитик поведения. Не морализируй, не ставь диагнозы, не оценивай личность и не считай общий балл.',
    'Цель: показать факты, повторяющиеся условия, осторожные гипотезы и 1–3 практических изменения на следующий период.',
    '',
    'Формат ответа:',
    '1. Короткая фактическая сводка с числом наблюдений.',
    '2. Что помогало сохранять состояние и выполнять намеченные действия.',
    '3. Что могло мешать; называй это связью, а не причиной.',
    '4. Какие действия привели к заметному результату или обратной связи, а где преобладала подготовка.',
    '5. Одно главное изменение и короткий план «если — то».',
    '6. Ограничения данных: пропуски, малая выборка, особые дни и неполный период.',
    '7. Если есть прошлый обзор, сопоставь его решение с последующими фактами.',
    '',
    'Правила:',
    '- пропуск не считай нулём или ответом «нет»;',
    '- особые дни не используй как обычную базу сравнения;',
    '- фактор дня сравнивай с отмеченными днями без него;',
    '- не обсуждай карьеру, вес или эксперимент, если соответствующих данных нет;',
    '- не продолжай данные в будущее и не выдавай сглаживание за прогноз;',
    '',
    summaryText ? `Локальная сводка приложения: ${summaryText}` : '',
    '',
    'ДАННЫЕ ДЛЯ АНАЛИЗА',
    ...sections,
  ].filter(Boolean).join('\n');

  return constrainPrompt(prompt);
}

function buildReadableSections(payload: AiReportPayload): string[] {
  const lines: string[] = [];
  const summary = payload.summary;

  appendSection(lines, 'Сводка', [
    `Записей с данными: ${summary.coveredEntriesCount}; обычных дней: ${summary.ordinaryCoveredEntriesCount}; необычных дней: ${summary.specialDays}.`,
    metricLine('Сон', summary.averageSleep === null ? null : formatMinutes(Math.round(summary.averageSleep)), summary.sleepSamples),
    metricLine('Время в кровати', summary.averageTimeInBed === null ? null : formatMinutes(Math.round(summary.averageTimeInBed)), summary.timeInBedSamples),
    metricLine('Энергия', formatDecimal(summary.averageEnergy), summary.energySamples, '/ 5'),
    metricLine('Качество сна', formatDecimal(summary.averageSleepQuality), summary.sleepQualitySamples, '/ 5'),
    schemaCoverageLine(payload.entries),
    `Карьера: действия были в ${summary.careerDays} из ${summary.careerSamples} отмеченных дней; отклик, разговор или результат — в ${summary.externalSteps} дн.`,
    `Физическая активность: ${summary.movementDays} из ${summary.movementSamples} отмеченных дней.`,
    `Питание: соответствовало правилам — ${summary.nutritionSupportDays}, мешало — ${summary.nutritionBlockDays}, всего отметок — ${summary.nutritionSamples}.`,
    `Действия по цели: конкретное действие — ${summary.externalActionDays}, подготовка — ${summary.preparationDays}, занимался другим — ${summary.driftDays}; всего отметок — ${summary.actionDirectionSamples}.`,
    metricLine('Вес', formatDecimal(summary.averageWeightKg), summary.weightSamples, 'кг'),
  ]);

  appendSection(lines, 'Текущие определения', [
    `Блоки, доступные в ежедневной записи: ${payload.settingsSnapshot.activeDailyBlocks.length ? payload.settingsSnapshot.activeDailyBlocks.map((id) => labelFor(dailyBlockOptions, id)).join(', ') : 'все необязательные блоки скрыты'}.`,
    payload.settingsSnapshot.activeFocusTitle ? `Текущая цель: ${cleanText(payload.settingsSnapshot.activeFocusTitle)}.` : '',
    payload.settingsSnapshot.focusOutcomeCriterion ? `Наблюдаемый результат цели: ${cleanText(payload.settingsSnapshot.focusOutcomeCriterion)}.` : '',
    payload.settingsSnapshot.focusReviewDate ? `Цель нужно пересмотреть ${payload.settingsSnapshot.focusReviewDate}.` : '',
    payload.settingsSnapshot.externalEvidenceCriterion ? `Что считается конкретным действием: ${cleanText(payload.settingsSnapshot.externalEvidenceCriterion)}.` : '',
    payload.settingsSnapshot.nutritionGoalCriterion ? `Правила питания: ${cleanText(payload.settingsSnapshot.nutritionGoalCriterion)}.` : '',
    formatExperiment(payload.settingsSnapshot.experiment),
    formatExperimentSummary(payload.experimentSummary),
  ]);

  appendSection(lines, 'Автоматические наблюдения приложения', payload.observations.map((item) => `${item.title}: ${item.text}`));
  appendSection(lines, 'Повторяющиеся факторы дня', payload.factorSummaries.map(formatFactorSummary));
  appendSection(lines, 'Сохранённые обзоры', limitedValues(reviewLines(payload), 18, 1_600));
  appendSection(
    lines,
    payload.period === 'range' ? 'Покрытие по месяцам' : 'Записи по дням',
    payload.period === 'range'
      ? monthlyEntryLines(payload)
      : limitedValues(payload.entries.map((entry) => formatEntry(entry, payload)), payload.period === 'week' ? 7 : 31, 1_600),
  );
  appendSection(lines, 'Завершённые итоги', limitedValues(payload.results.map((result) => {
    return `${result.date} — ${labelFor(payload.labels.resultAreas, result.area)}: ${cleanText(result.title)}`;
  }), payload.period === 'range' ? 80 : 60, payload.period === 'range' ? 400 : 800));
  appendSection(lines, 'События и инсайты', limitedValues(payload.lifeEvents.map((event) => {
    const note = cleanText(event.note);
    return `${event.date} — ${labelFor(payload.labels.eventTypes, event.type)}: ${cleanText(event.title)}${note ? `; ${note}` : ''}`;
  }), payload.period === 'range' ? 60 : 60, payload.period === 'range' ? 600 : 1_000));
  appendSection(lines, 'Завершённые эксперименты', limitedValues(payload.experimentHistory.map(({ record, summary }) => formatCompletedExperiment(record, summary)), 24, 1_600));

  return lines;
}

function monthlyEntryLines(payload: AiReportPayload): string[] {
  const byMonth = new Map<string, DailyEntry[]>();
  for (const entry of payload.entries) {
    const month = entry.date.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), entry]);
  }

  return [...byMonth.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([month, entries]) => {
    const summary = summarize(entries);
    const values = [
      `${summary.coveredEntriesCount} записей`,
      summary.averageSleep === null ? '' : `сон ${formatMinutes(Math.round(summary.averageSleep))} (${summary.sleepSamples})`,
      summary.averageEnergy === null ? '' : `энергия ${formatDecimal(summary.averageEnergy)}/5 (${summary.energySamples})`,
      summary.averageSleepQuality === null ? '' : `качество сна ${formatDecimal(summary.averageSleepQuality)}/5 (${summary.sleepQualitySamples})`,
      summary.averageWeightKg === null ? '' : `вес ${formatDecimal(summary.averageWeightKg)} кг (${summary.weightSamples})`,
      `действия по цели ${summary.externalActionDays}/${summary.actionDirectionSamples}`,
    ].filter(Boolean);
    return `${formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}: ${values.join('; ')}.`;
  });
}

function limitedValues(values: string[], maxItems: number, maxLineLength: number): string[] {
  const limited = values.slice(0, maxItems).map((value) => clipText(value, maxLineLength));
  if (values.length > maxItems) limited.push(`Не включено подробностей: ${values.length - maxItems}. Они остаются в полном JSON-экспорте.`);
  return limited;
}

function clipText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 34)).trimEnd()}… [подробности сокращены]`;
}

function constrainPrompt(prompt: string): string {
  if (prompt.length <= AI_PROMPT_CHARACTER_LIMIT) return prompt;
  const notice = '\n\n[Пакет сокращён до безопасного объёма. Остальные подробности доступны в полном JSON-экспорте.]';
  const boundary = AI_PROMPT_CHARACTER_LIMIT - notice.length;
  const lastLineBreak = prompt.lastIndexOf('\n', boundary);
  return `${prompt.slice(0, lastLineBreak > 0 ? lastLineBreak : boundary).trimEnd()}${notice}`;
}

function appendSection(target: string[], title: string, values: string[]) {
  const present = values.filter(Boolean);
  target.push('', `${title}:`);
  target.push(...(present.length ? present.map((value) => `- ${value}`) : ['- Нет данных.']));
}

function metricLine(label: string, value: string | null, samples: number, suffix = ''): string {
  if (value === null || samples === 0) return '';
  return `${label}: ${value}${suffix ? ` ${suffix}` : ''} (${samples} ${sampleWord(samples)}).`;
}

function schemaCoverageLine(entries: DailyEntry[]): string {
  const known = entries.filter((entry) => entry.entrySchemaVersion !== null && entry.activeDailyBlocksSnapshot !== null);
  const legacyCount = entries.length - known.length;
  const parts = [`состав показанных блоков сохранён для ${known.length} из ${entries.length} записей`];
  if (legacyCount) parts.push(`для ${legacyCount} старых записей он неизвестен`);
  return `Контекст формы: ${parts.join('; ')}.`;
}

function sampleWord(value: number): string {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'измерений';
  if (mod10 === 1) return 'измерение';
  if (mod10 >= 2 && mod10 <= 4) return 'измерения';
  return 'измерений';
}

function formatDecimal(value: number | null): string | null {
  return value === null ? null : value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function labelFor(options: Array<{ id: string; label: string }>, id: string): string {
  return options.find((option) => option.id === id)?.label ?? 'Неизвестное значение';
}

function formatEntry(entry: DailyEntry, payload: AiReportPayload): string {
  const values: string[] = [];
  if (entry.focusTitle && entry.focusTitle !== payload.settingsSnapshot.activeFocusTitle) {
    values.push(`цель на эту дату: ${cleanText(entry.focusTitle)}`);
  }
  if (entry.focusOutcomeCriterion && entry.focusOutcomeCriterion !== payload.settingsSnapshot.focusOutcomeCriterion) {
    values.push(`ожидаемый результат на эту дату: ${cleanText(entry.focusOutcomeCriterion)}`);
  }
  if (entry.focusReviewDate && entry.focusReviewDate !== payload.settingsSnapshot.focusReviewDate) {
    values.push(`дата пересмотра цели на эту дату: ${entry.focusReviewDate}`);
  }
  if (entry.bedtime) values.push(`лёг ${entry.bedtime}`);
  if (entry.wakeTime) values.push(`встал ${entry.wakeTime}`);
  if (entry.sleepMinutes !== null) values.push(`сон ${formatMinutes(entry.sleepMinutes)}`);
  if (entry.timeInBedMinutes !== null) values.push(`в кровати ${formatMinutes(entry.timeInBedMinutes)}`);
  if (entry.sleepQuality !== null) values.push(`качество сна ${entry.sleepQuality}/5`);
  if (entry.energy !== null) values.push(`энергия ${entry.energy}/5`);
  if (dailyFieldWasRecorded(entry, 'contextFactors')) {
    const factors = entry.contextFactors.map((id) => labelFor(payload.labels.contextFactors, id));
    values.push(`условия дня: ${factors.length ? factors.join(', ') : 'ничего из списка'}`);
  }
  if (cleanText(entry.contextNote)) values.push(`контекст: ${cleanText(entry.contextNote)}`);
  if (entry.specialDay) values.push(`необычный день: ${labelFor(payload.labels.specialDays, entry.specialDay)}${entry.specialDayNote ? ` (${cleanText(entry.specialDayNote)})` : ''}`);
  const careerStates = entry.careerStates.length ? entry.careerStates : entry.careerState ? [entry.careerState] : [];
  if (dailyFieldWasRecorded(entry, 'careerStates')) values.push(`карьера: ${careerStates.length ? careerStates.map((id) => labelFor(payload.labels.career, id)).join(', ') : 'действий не было'}`);
  if (dailyFieldWasRecorded(entry, 'actionDirection')) values.push(entry.actionDirection
    ? `по цели: ${labelFor(payload.labels.actionDirections, entry.actionDirection)}${entry.actionNote ? ` (${cleanText(entry.actionNote)})` : ''}`
    : 'по цели: действий не было');
  if (dailyFieldWasRecorded(entry, 'activities')) {
    const activities = entry.activities.map((id) => labelFor(payload.labels.activities, id));
    values.push(`активность: ${activities.length ? activities.join(', ') : 'не было'}`);
  }
  if (entry.nutritionState) values.push(`питание: ${labelFor(payload.labels.nutrition, entry.nutritionState)}${entry.nutritionNote ? ` (${cleanText(entry.nutritionNote)})` : ''}`);
  if (entry.weightKg !== null) values.push(`вес ${formatDecimal(entry.weightKg)} кг`);
  if (dailyFieldWasRecorded(entry, 'lifeAreas')) {
    const areas = entry.lifeAreas.map((id) => labelFor(payload.labels.lifeAreas, id));
    values.push(`области жизни: ${areas.length ? areas.join(', ') : 'ничего не отмечено'}`);
  }
  if (cleanText(entry.importantFact)) values.push(`факт дня: ${cleanText(entry.importantFact)}`);
  if (entry.experimentCompleted !== null) values.push(`условие эксперимента: ${entry.experimentCompleted ? 'выполнено' : 'не выполнено'}`);
  return `${entry.date} — ${values.length ? values.join('; ') : 'есть запись без заполненных показателей'}.`;
}

function formatFactorSummary(factor: AiReportPayload['factorSummaries'][number]): string {
  const values = [`${factor.label}: ${factor.count} дн.`];
  if (factor.sleepSamples || factor.sleepSamplesWithout) {
    values.push(`сон с фактором ${factor.averageSleep === null ? 'нет данных' : formatMinutes(Math.round(factor.averageSleep))} (${factor.sleepSamples}), без него ${factor.averageSleepWithout === null ? 'нет данных' : formatMinutes(Math.round(factor.averageSleepWithout))} (${factor.sleepSamplesWithout})`);
  }
  if (factor.energySamples || factor.energySamplesWithout) {
    values.push(`энергия с фактором ${formatDecimal(factor.averageEnergy) ?? 'нет данных'} (${factor.energySamples}), без него ${formatDecimal(factor.averageEnergyWithout) ?? 'нет данных'} (${factor.energySamplesWithout})`);
  }
  return values.join('; ');
}

function formatExperiment(experiment: AppSettings['experiment']): string {
  if (!experiment.active && !cleanText(experiment.title)) return '';
  const values = [cleanText(experiment.title) || 'без названия'];
  if (cleanText(experiment.hypothesis)) values.push(`что пользователь хочет проверить: ${cleanText(experiment.hypothesis)}`);
  if (experiment.startDate || experiment.endDate) values.push(`даты: ${experiment.startDate || 'не указано'} — ${experiment.endDate || 'не указано'}`);
  if (cleanText(experiment.conclusion)) values.push(`итог: ${cleanText(experiment.conclusion)}`);
  return `Эксперимент: ${values.join('; ')}.`;
}

function formatExperimentSummary(summary: ExperimentSummary | null): string {
  if (!summary) return '';
  const metrics = summary.metrics.map((metric) => `${metric.label}: до ${formatExperimentMetricValue(metric.baselineAverage, metric.id)} (${metric.baselineSamples}), во время ${formatExperimentMetricValue(metric.experimentAverage, metric.id)} (${metric.experimentSamples})`);
  return `Сводка эксперимента: условие выполнено в ${summary.adherenceCompletedDays} из ${summary.adherenceMarkedDays} отмеченных дней, не выполнено в ${summary.adherenceNotCompletedDays}, без отметки — ${summary.adherenceUnmarkedDays}; ${metrics.length ? metrics.join('; ') : 'сопоставимых числовых данных нет'}. Это фактическая сводка, а не автоматический вывод о результате или причине.`;
}

function formatExperimentMetricValue(value: number | null, metricId: ExperimentMetricId): string {
  if (value === null) return 'нет данных';
  if (metricId === 'sleepMinutes' || metricId === 'timeInBedMinutes') return formatMinutes(Math.round(value));
  if (metricId === 'sleepQuality' || metricId === 'energy') return `${formatDecimal(value)}/5`;
  return `${formatDecimal(value)} кг`;
}

function formatCompletedExperiment(record: ExperimentRecord, summary: ExperimentSummary | null): string {
  const values = [
    `${record.startDate} — ${record.endDate}: ${cleanText(record.title)}`,
    record.hypothesis && `проверял: ${cleanText(record.hypothesis)}`,
    `вывод пользователя: ${cleanText(record.conclusion)}`,
    record.decision && `решение: ${experimentDecisionLabel(record.decision).toLocaleLowerCase('ru-RU')}`,
    formatExperimentSummary(summary),
  ].filter(Boolean);
  return values.join('; ');
}

function reviewLines(payload: AiReportPayload): string[] {
  const lines: string[] = [];
  if (payload.previousWeeklyReview) lines.push(formatWeeklyReview('Предыдущая неделя', payload.previousWeeklyReview));
  if (payload.weeklyReview) lines.push(formatWeeklyReview('Текущая неделя', payload.weeklyReview));
  if (payload.previousMonthlyReview) lines.push(formatMonthlyReview('Предыдущий месяц', payload.previousMonthlyReview));
  if (payload.monthlyReview) lines.push(formatMonthlyReview('Текущий месяц', payload.monthlyReview));
  for (const review of payload.monthlyReviews ?? []) lines.push(formatMonthlyReview(review.monthStart, review));
  return lines;
}

function formatWeeklyReview(label: string, review: WeeklyReview): string {
  const values = [
    review.previousPlanOutcome && `проверка прошлого решения: ${cleanText(review.previousPlanOutcome)}`,
    review.results.filter(Boolean).length && `итоги: ${review.results.filter(Boolean).map(cleanText).join('; ')}`,
    review.support && `помогало: ${cleanText(review.support)}`,
    review.obstacle && `мешало: ${cleanText(review.obstacle)}`,
    review.nextLever && `следующее изменение: ${cleanText(review.nextLever)}`,
    review.ifThenPlan && `план если-то: ${cleanText(review.ifThenPlan)}`,
  ].filter(Boolean);
  return `${label} (${review.weekStart}): ${values.length ? values.join('; ') : 'обзор сохранён без текста'}.`;
}

function formatMonthlyReview(label: string, review: MonthlyReview): string {
  const values = [
    review.mainPattern && `повторялось: ${cleanText(review.mainPattern)}`,
    review.support && `помогало: ${cleanText(review.support)}`,
    review.obstacle && `мешало: ${cleanText(review.obstacle)}`,
    review.courseChange && `изменило месяц: ${cleanText(review.courseChange)}`,
    review.nextFocus && `следующая цель: ${cleanText(review.nextFocus)}`,
    review.ifThenPlan && `план если-то: ${cleanText(review.ifThenPlan)}`,
  ].filter(Boolean);
  return `${label} (${review.monthStart}): ${values.length ? values.join('; ') : 'обзор сохранён без текста'}.`;
}
