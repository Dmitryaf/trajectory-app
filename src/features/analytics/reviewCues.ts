import type { ContextFactorId, DailyEntry, LifeEventRecord, Option, ResultRecord } from '../../types';
import { contextFactorOptions, externalCareerStates } from '../../types';
import { formatMinutes } from '../../services/dates';
import { dataCoverageLevel } from './coverage';
import { factorComparisonText, factorSummaries } from './observations';
import { summarize, type PeriodSummary } from './periodSummary';

export type ReviewCue = {
  id: string;
  title: string;
  text: string;
  tone: 'good' | 'warning' | 'neutral';
};

export function buildReviewCues(
  period: 'week' | 'month',
  entries: DailyEntry[],
  results: ResultRecord[],
  lifeEvents: LifeEventRecord[],
  externalCareerIds: string[] = externalCareerStates,
  factorOptions: Option<ContextFactorId>[] = contextFactorOptions,
): ReviewCue[] {
  const summary = summarize(entries, externalCareerIds);
  const factors = factorSummaries(entries, factorOptions);
  const cues: ReviewCue[] = [];
  const enoughEntries =
    period === 'week'
      ? summary.ordinaryCoveredEntriesCount >= 4 && summary.ordinaryCoreEntriesCount >= 2
      : summary.ordinaryCoveredEntriesCount >= 12 && summary.ordinaryCoreEntriesCount >= 6;
  const minTarget =
    period === 'week' ? '4 заполненных дня, из них 2 с основными полями' : '12 заполненных дней, из них 6 с основными полями';

  cues.push({
    id: 'coverage',
    title: enoughEntries ? 'Данных достаточно для обзора' : 'Данных пока мало',
    text: enoughEntries
      ? `${summary.ordinaryCoveredEntriesCount} заполненных дней, из них ${summary.ordinaryCoreEntriesCount} с основными полями, уже дают рабочую картину периода.`
      : `Для рабочего обзора лучше иметь хотя бы ${minTarget} без отметки «особый день». Сейчас: ${summary.ordinaryCoveredEntriesCount} и ${summary.ordinaryCoreEntriesCount}.`,
    tone: enoughEntries ? 'good' : 'warning',
  });

  const shortSleepDays = entries.filter(
    (entry) => entry.specialDay === null && entry.sleepMinutes !== null && entry.sleepMinutes < 420,
  ).length;
  if (shortSleepDays >= 2) {
    cues.push({
      id: 'short-sleep',
      title: 'Сон проседал несколько раз',
      text: `${shortSleepDays} ${plural(shortSleepDays, 'день был', 'дня были', 'дней были')} со сном меньше 7 часов. Это стоит проверить перед выводами про действия и состояние.`,
      tone: 'warning',
    });
  } else if (summary.averageSleep !== null) {
    cues.push({ id: 'sleep-baseline', title: 'База сна', text: sleepContextText(summary), tone: 'neutral' });
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
      title: 'Работа была частью этого периода',
      text: `Работа отмечена в ${summary.careerDays} из ${summary.careerSamples} заполненных дней этого блока. Сравните эти дни с состоянием и другими условиями, не считая совпадение причиной.`,
      tone: 'neutral',
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
      text:
        summary.nutritionBlockDays >= 2
          ? `${summary.nutritionBlockDays} ${plural(summary.nutritionBlockDays, 'день', 'дня', 'дней')} питание отмечено как мешающее цели. Лучше искать один повторяющийся сценарий, а не менять всё сразу.`
          : `${summary.nutritionSupportDays} ${plural(summary.nutritionSupportDays, 'день', 'дня', 'дней')} питание поддерживало цель. Это стоит сохранить как рабочее условие.`,
      tone: summary.nutritionBlockDays >= 2 ? 'warning' : 'good',
    });
  }

  if (summary.experimentMarkedDays >= 2) {
    cues.push({
      id: 'experiment',
      title: 'Есть данные эксперимента',
      text: `Получилось сделать выбранное изменение в ${summary.experimentCompletedDays} из ${summary.experimentMarkedDays} отмеченных дней. Посмотрите, что ещё менялось до и во время эксперимента.`,
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

export function buildRangeReviewCues(
  rangeMonths: number,
  entries: DailyEntry[],
  results: ResultRecord[],
  lifeEvents: LifeEventRecord[],
  externalCareerIds: string[] = externalCareerStates,
  factorOptions: Option<ContextFactorId>[] = contextFactorOptions,
): ReviewCue[] {
  const summary = summarize(entries, externalCareerIds);
  const cues: ReviewCue[] = [];
  const coveredEntries = entries.filter((entry) => dataCoverageLevel(entry) > 0);
  const monthsWithData = new Set(coveredEntries.map((entry) => entry.date.slice(0, 7))).size;
  const enoughEntries =
    summary.ordinaryCoveredEntriesCount >= rangeMonths * 8 &&
    summary.ordinaryCoreEntriesCount >= rangeMonths * 4 &&
    monthsWithData >= Math.max(2, rangeMonths - 1);

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
      cues.push({
        id: 'direction-preparation',
        title: 'Подготовка редко переходила в шаги к цели',
        text: `Подготовка — ${preparationRate}% отмеченных дней, шаги к цели — ${externalRate}%. Проверьте, что может привести к заметному результату.`,
        tone: 'warning',
      });
    } else if (externalRate >= 35) {
      cues.push({
        id: 'direction-external',
        title: 'Конкретные действия сохранялись',
        text: `Конкретные действия появлялись в ${externalRate}% дней с отметкой по текущей цели. Сверь это с итогами периода.`,
        tone: 'good',
      });
    }
    if (driftRate >= 30) {
      cues.push({
        id: 'direction-drift',
        title: 'Другие занятия часто вытесняли цель',
        text: `${driftRate}% дней с отметкой по текущей цели были заняты другим. Ищи повторяющееся условие, а не одну причину всего периода.`,
        tone: 'warning',
      });
    }
  }

  if (results.length) {
    cues.push({
      id: 'results',
      title: 'Есть завершённые итоги',
      text: `${results.length} ${plural(results.length, 'итог', 'итога', 'итогов')} за период. Сопоставь их с реальными шагами, а не только с занятостью.`,
      tone: 'good',
    });
  }

  if (summary.specialDays || lifeEvents.length) {
    cues.push({
      id: 'context',
      title: 'Динамика менялась вместе с контекстом',
      text: `${summary.specialDays} особых ${plural(summary.specialDays, 'день', 'дня', 'дней')} и ${lifeEvents.length} ${plural(lifeEvents.length, 'важное событие', 'важных события', 'важных событий')}. Они исключены из базовых средних состояния.`,
      tone: 'neutral',
    });
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

function plural(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
