import type { ContextFactorId, DailyEntry, LifeAreaId, LifeEventRecord, Option, ResultRecord } from '../types';
import { actionDirectionOptions, activityOptions, careerOptions, contextFactorOptions, externalCareerStates, lifeAreaOptions, specialDayOptions } from '../types';
import { buildCoverageSeries, dataCoverageLevel, type DataCoverageLevel } from '../features/analytics/coverage';
import { buildObservations, factorComparisonText, factorSummaries } from '../features/analytics/observations';
import { careerStatesForEntry, summarize, type PeriodSummary } from '../features/analytics/periodSummary';
import { dateRange, endOfMonth, endOfWeek, formatMinutes, startOfMonth, startOfWeek } from './dates';

export { buildCoverageSeries, dataCoverageLevel, type DataCoverageLevel } from '../features/analytics/coverage';
export { buildEventComparison, type EventComparison, type EventComparisonMetric } from '../features/analytics/eventComparison';
export { buildObservations, factorSummaries, type FactorSummary, type Observation } from '../features/analytics/observations';
export { careerStatesForEntry, entriesForMonth, entriesForPeriod, entriesForWeek, hasMovement, resultsForPeriod, summarize, type PeriodSummary } from '../features/analytics/periodSummary';

export type ReviewCue = {
  id: string;
  title: string;
  text: string;
  tone: 'good' | 'warning' | 'neutral';
};


export function weekSummaryText(summary: PeriodSummary, activeAreas: LifeAreaId[], areaOptions: Option[] = lifeAreaOptions): string {
  if (!summary.coveredEntriesCount) return 'Пока нет заполненных записей за эту неделю. Здесь появится краткая сводка фактов.';

  const labels = new Map(areaOptions.map((item) => [item.id, item.label]));
  const present = activeAreas.filter((area) => summary.areaCounts[area] > 0).map((area) => (labels.get(area) ?? area).toLowerCase());
  const absent = summary.lifeAreaSamples > 0
    ? activeAreas.filter((area) => (summary.areaCounts[area] ?? 0) === 0).map((area) => (labels.get(area) ?? area).toLowerCase())
    : [];
  const parts = [
    `${summary.careerDays} карьерных ${plural(summary.careerDays, 'день', 'дня', 'дней')}`,
    `${summary.externalSteps} ${plural(summary.externalSteps, 'день', 'дня', 'дней')} с откликом, разговором или итогом`,
    `${summary.movementDays} ${plural(summary.movementDays, 'день с активностью', 'дня с активностью', 'дней с активностью')}`
  ];
  if (summary.nutritionSupportDays || summary.nutritionBlockDays) {
    parts.push(`питание поддержало ${summary.nutritionSupportDays}, мешало ${summary.nutritionBlockDays}`);
  }
  if (summary.externalActionDays || summary.preparationDays || summary.driftDays) {
    parts.push(`действия по цели: конкретные действия ${summary.externalActionDays}, подготовка ${summary.preparationDays}, занимался другим ${summary.driftDays}`);
  }
  if (summary.averageSleep !== null) parts.push(`средний сон ${formatMinutes(Math.round(summary.averageSleep))}`);
  if (summary.averageTimeInBed !== null && summary.averageSleep !== null && summary.averageTimeInBed - summary.averageSleep >= 45) {
    parts.push(`в кровати ${formatMinutes(Math.round(summary.averageTimeInBed))}`);
  }
  let text = `За неделю: ${parts.join(', ')}.`;
  if (present.length) text += ` Присутствовали: ${present.join(', ')}.`;
  if (absent.length) text += ` Не отмечались: ${absent.join(', ')}.`;
  return text;
}

export function hasArea(entry: DailyEntry | undefined, area: string): boolean {
  if (!entry) return false;
  if (area === 'career') return careerStatesForEntry(entry).length > 0;
  if (area === 'sport') return entry.activities.some((activity) => activity !== 'recovery');
  return entry.lifeAreas.includes(area as LifeAreaId);
}

export function buildReviewCues(period: 'week' | 'month', entries: DailyEntry[], results: ResultRecord[], lifeEvents: LifeEventRecord[], externalCareerIds: string[] = externalCareerStates, factorOptions: Option<ContextFactorId>[] = contextFactorOptions): ReviewCue[] {
  const summary = summarize(entries, externalCareerIds);
  const factors = factorSummaries(entries, factorOptions);
  const cues: ReviewCue[] = [];
  const enoughEntries = period === 'week'
    ? summary.ordinaryCoveredEntriesCount >= 4 && summary.ordinaryCoreEntriesCount >= 2
    : summary.ordinaryCoveredEntriesCount >= 12 && summary.ordinaryCoreEntriesCount >= 6;
  const minTarget = period === 'week' ? '4 заполненных дня, из них 2 с основными полями' : '12 заполненных дней, из них 6 с основными полями';

  cues.push({
    id: 'coverage',
    title: enoughEntries ? 'Данных достаточно для обзора' : 'Данных пока мало',
    text: enoughEntries
      ? `${summary.ordinaryCoveredEntriesCount} заполненных дней, из них ${summary.ordinaryCoreEntriesCount} с основными полями, уже дают рабочую картину периода.`
      : `Для рабочего обзора лучше иметь хотя бы ${minTarget} без отметки «особый день». Сейчас: ${summary.ordinaryCoveredEntriesCount} и ${summary.ordinaryCoreEntriesCount}.`,
    tone: enoughEntries ? 'good' : 'warning',
  });

  const shortSleepDays = entries.filter((entry) => entry.specialDay === null && entry.sleepMinutes !== null && entry.sleepMinutes < 420).length;
  if (shortSleepDays >= 2) {
    cues.push({
      id: 'short-sleep',
      title: 'Сон проседал несколько раз',
      text: `${shortSleepDays} ${plural(shortSleepDays, 'день был', 'дня были', 'дней были')} со сном меньше 7 часов. Это стоит проверить перед выводами про действия и состояние.`,
      tone: 'warning',
    });
  } else if (summary.averageSleep !== null) {
    cues.push({
      id: 'sleep-baseline',
      title: 'База сна',
      text: sleepContextText(summary),
      tone: 'neutral',
    });
  }

  const timingVariation = Math.max(summary.bedtimeVariationMinutes ?? 0, summary.wakeTimeVariationMinutes ?? 0);
  if (summary.sleepTimingSamples >= 4 && timingVariation >= 90) {
    cues.push({
      id: 'sleep-regularity',
      title: 'Время сна заметно менялось',
      text: `Разброс времени отхода ко сну или подъёма около ${Math.round(timingVariation)} мин. Это отдельный контекст помимо длительности сна.`,
      tone: 'neutral',
    });
  }

  const leadingFactor = factors[0];
  if (leadingFactor && leadingFactor.count >= 2) {
    const comparison = factorComparisonText(leadingFactor);
    cues.push({
      id: 'factor',
      title: 'Повторяющийся фактор',
      text: `${leadingFactor.label} отмечался ${leadingFactor.count} ${plural(leadingFactor.count, 'раз', 'раза', 'раз')}.${comparison ? ` ${comparison}` : ' Сравнительных данных пока мало.'}`,
      tone: 'warning',
    });
  }

  if (summary.externalSteps > 0 || summary.careerDays > 0) {
    cues.push({
      id: 'career',
      title: summary.externalSteps > 0 ? 'Были отклики, разговоры или итоги по карьере' : 'Карьера появлялась',
      text: `${summary.careerDays} карьерных ${plural(summary.careerDays, 'день', 'дня', 'дней')}, из них ${summary.externalSteps} с откликом, разговором или итогом. Так проще сверить ощущение с фактами.`,
      tone: summary.externalSteps > 0 ? 'good' : 'neutral',
    });
  }

  if (summary.preparationDays >= 3 && summary.externalActionDays <= 1) {
    cues.push({
      id: 'direction-preparation',
      title: 'Много подготовки, мало конкретных действий',
      text: `${summary.preparationDays} ${plural(summary.preparationDays, 'день', 'дня', 'дней')} отмечены как подготовка, конкретных действий — ${summary.externalActionDays}. Проверь, приводит ли подготовка к заметному результату.`,
      tone: 'warning',
    });
  } else if (summary.externalActionDays >= 2) {
    cues.push({
      id: 'direction-external',
      title: 'Были конкретные действия по цели',
      text: `${summary.externalActionDays} ${plural(summary.externalActionDays, 'день', 'дня', 'дней')} с действиями, после которых мог появиться заметный результат или обратная связь.`,
      tone: 'good',
    });
  }

  if (summary.driftDays >= 2) {
    cues.push({
      id: 'direction-drift',
      title: 'Другие дела занимали день',
      text: `${summary.driftDays} ${plural(summary.driftDays, 'день', 'дня', 'дней')} были заняты другими делами. В разборе лучше искать повторяющееся условие, а не обвинять себя.`,
      tone: 'warning',
    });
  }

  if (results.length) {
    cues.push({
      id: 'results',
      title: 'Есть завершённые вещи',
      text: `${results.length} ${plural(results.length, 'итог', 'итога', 'итогов')} за период. Это отдельный слой прогресса, даже если состояние было неровным.`,
      tone: 'good',
    });
  }

  if (summary.nutritionBlockDays >= 2 || summary.nutritionSupportDays >= 3) {
    cues.push({
      id: 'nutrition',
      title: summary.nutritionBlockDays >= 2 ? 'Питание мешало цели' : 'Питание поддерживало цель',
      text: summary.nutritionBlockDays >= 2
        ? `${summary.nutritionBlockDays} ${plural(summary.nutritionBlockDays, 'день', 'дня', 'дней')} питание отмечено как мешающее цели. Лучше искать один повторяющийся сценарий, а не менять всё сразу.`
        : `${summary.nutritionSupportDays} ${plural(summary.nutritionSupportDays, 'день', 'дня', 'дней')} питание поддерживало цель. Это стоит сохранить как рабочее условие.`,
      tone: summary.nutritionBlockDays >= 2 ? 'warning' : 'good',
    });
  }

  if (summary.experimentMarkedDays >= 2) {
    cues.push({
      id: 'experiment',
      title: 'Есть данные эксперимента',
      text: `Условие выполнено в ${summary.experimentCompletedDays} из ${summary.experimentMarkedDays} отмеченных дней. Сначала оцени соблюдение, затем сравни выбранный показатель до и во время эксперимента.`,
      tone: 'neutral',
    });
  }

  if (summary.specialDays || lifeEvents.length) {
    cues.push({
      id: 'context',
      title: 'Есть поправка на контекст',
      text: `${summary.specialDays} особых ${plural(summary.specialDays, 'день', 'дня', 'дней')} и ${lifeEvents.length} ${plural(lifeEvents.length, 'важное событие', 'важных события', 'важных событий')}. Такой период лучше не сравнивать с обычным ритмом напрямую.`,
      tone: 'neutral',
    });
  }

  return limitCues(cues, ['coverage', 'results', 'context']);
}

export function buildRangeReviewCues(rangeMonths: number, entries: DailyEntry[], results: ResultRecord[], lifeEvents: LifeEventRecord[], externalCareerIds: string[] = externalCareerStates, factorOptions: Option<ContextFactorId>[] = contextFactorOptions): ReviewCue[] {
  const summary = summarize(entries, externalCareerIds);
  const cues: ReviewCue[] = [];
  const coveredEntries = entries.filter((entry) => dataCoverageLevel(entry) > 0);
  const monthsWithData = new Set(coveredEntries.map((entry) => entry.date.slice(0, 7))).size;
  const enoughEntries = summary.ordinaryCoveredEntriesCount >= rangeMonths * 8
    && summary.ordinaryCoreEntriesCount >= rangeMonths * 4
    && monthsWithData >= Math.max(2, rangeMonths - 1);

  cues.push({
    id: 'coverage',
    title: enoughEntries ? 'Период покрыт достаточно ровно' : 'Покрытие периода неровное',
    text: `${summary.coveredEntriesCount} заполненных дней, из них ${summary.ordinaryCoreEntriesCount} с основными полями, в ${monthsWithData} из ${rangeMonths} мес.`,
    tone: enoughEntries ? 'good' : 'warning',
  });

  const factor = factorSummaries(entries, factorOptions).find((item) => item.count >= Math.max(3, rangeMonths));
  if (factor) {
    const comparison = factorComparisonText(factor);
    cues.push({
      id: 'factor',
      title: 'Устойчивый фактор дня',
      text: `${factor.label} отмечался ${factor.count} ${plural(factor.count, 'раз', 'раза', 'раз')}.${comparison ? ` ${comparison}` : ' Сравнительных данных пока мало.'}`,
      tone: 'neutral',
    });
  }

  if (summary.actionDirectionSamples >= Math.max(6, rangeMonths * 2)) {
    const externalRate = ratioPercent(summary.externalActionDays, summary.actionDirectionSamples) ?? 0;
    const preparationRate = ratioPercent(summary.preparationDays, summary.actionDirectionSamples) ?? 0;
    const driftRate = ratioPercent(summary.driftDays, summary.actionDirectionSamples) ?? 0;
    if (preparationRate >= 60 && externalRate <= 20) {
      cues.push({ id: 'direction-preparation', title: 'Подготовка редко переходила в конкретные действия', text: `Подготовка — ${preparationRate}% отмеченных дней, конкретные действия — ${externalRate}%. Проверь, что может привести к заметному результату.`, tone: 'warning' });
    } else if (externalRate >= 35) {
      cues.push({ id: 'direction-external', title: 'Конкретные действия сохранялись', text: `Конкретные действия появлялись в ${externalRate}% дней с отметкой по текущей цели. Сверь это с итогами периода.`, tone: 'good' });
    }
    if (driftRate >= 30) {
      cues.push({ id: 'direction-drift', title: 'Другие занятия часто вытесняли цель', text: `${driftRate}% дней с отметкой по текущей цели были заняты другим. Ищи повторяющееся условие, а не одну причину всего периода.`, tone: 'warning' });
    }
  }

  if (results.length) {
    cues.push({ id: 'results', title: 'Есть завершённые итоги', text: `${results.length} ${plural(results.length, 'итог', 'итога', 'итогов')} за период. Сопоставь их с реальными шагами, а не только с занятостью.`, tone: 'good' });
  }

  if (summary.specialDays || lifeEvents.length) {
    cues.push({ id: 'context', title: 'Динамика менялась вместе с контекстом', text: `${summary.specialDays} особых ${plural(summary.specialDays, 'день', 'дня', 'дней')} и ${lifeEvents.length} ${plural(lifeEvents.length, 'важное событие', 'важных события', 'важных событий')}. Они исключены из базовых средних состояния.`, tone: 'neutral' });
  }

  return limitCues(cues, ['coverage', 'results', 'context']);
}

export function ratioPercent(value: number, total: number): number | null {
  return total > 0 ? Math.round((value / total) * 100) : null;
}

function limitCues(cues: ReviewCue[], requiredIds: string[]): ReviewCue[] {
  const selected = cues.slice(0, 6);
  for (const id of requiredIds) {
    const required = cues.find((cue) => cue.id === id);
    if (!required || selected.some((cue) => cue.id === id)) continue;
    let replaceIndex = -1;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (!requiredIds.includes(selected[index].id)) {
        replaceIndex = index;
        break;
      }
    }
    if (replaceIndex >= 0) selected[replaceIndex] = required;
  }
  return selected.sort((a, b) => cues.indexOf(a) - cues.indexOf(b));
}

function sleepContextText(summary: PeriodSummary): string {
  const sleep = summary.averageSleep === null ? '—' : formatMinutes(Math.round(summary.averageSleep));
  const inBed = summary.averageTimeInBed === null ? '' : `, в кровати ${formatMinutes(Math.round(summary.averageTimeInBed))}`;
  const efficiency = summary.averageSleepEfficiency === null ? '' : `, доля сна около ${Math.round(summary.averageSleepEfficiency)}%`;
  return `Средний сон за период: ${sleep}${inBed}${efficiency}. Это первый контекст для оценки энергии и действий.`;
}

export function buildReviewQuestions(period: 'week' | 'month'): string[] {
  const label = period === 'week' ? 'неделе' : 'месяце';
  return [
    `Что в этой ${label} повторялось чаще всего и могло влиять на состояние?`,
    'Какие действия привели к заметному результату или обратной связи?',
    'Какой один фактор стоит уменьшить в следующем периоде?',
    'Какое одно действие или условие стоит сохранить, потому что оно помогало?',
  ];
}

export function periodDays(anchor: string, period: 'week' | 'month'): string[] {
  return period === 'week'
    ? dateRange(startOfWeek(anchor), endOfWeek(anchor))
    : dateRange(startOfMonth(anchor), endOfMonth(anchor));
}

export function careerLabel(value: string | null): string {
  return careerOptions.find((option) => option.id === value)?.label ?? 'Нет';
}

export function activityLabel(value: string): string {
  return activityOptions.find((option) => option.id === value)?.label ?? value;
}

export function specialDayLabel(value: string | null): string {
  return specialDayOptions.find((option) => option.id === value)?.label ?? 'Особый день';
}

export function contextFactorLabel(value: string, factorOptions: Option<ContextFactorId>[] = contextFactorOptions): string {
  if (value === 'porn') return 'Другое';
  return factorOptions.find((option) => option.id === value)?.label ?? value;
}

export function actionDirectionLabel(value: string | null): string {
  return actionDirectionOptions.find((option) => option.id === value)?.label ?? 'Не отмечено';
}

function plural(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
