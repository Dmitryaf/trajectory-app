import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(projectRoot, 'demo', 'trajectory-test-user-2026-07-20.json');
const dataThrough = '2026-07-20';

function isoAt(date, hour = 20) {
  return `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}

function eachDate(from, through) {
  const dates = [];
  for (
    const cursor = new Date(`${from}T00:00:00Z`);
    cursor <= new Date(`${through}T00:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

const trackedDates = eachDate('2026-05-04', dataThrough).filter((date) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 1 || day === 3 || day === 5 || date >= '2026-07-13';
});

const specialDays = {
  '2026-05-25': ['overload', 'Срочная задача заняла большую часть дня'],
  '2026-06-12': ['travel', 'Дорога и смена привычного режима'],
  '2026-07-05': ['recovery', 'Сознательно оставил день без рабочих задач'],
};

const lifeAreaCycles = [
  ['reading', 'custom:life:music'],
  ['family', 'rest'],
  ['friends', 'rest'],
  ['creativity', 'custom:life:music'],
];
const factorCycles = [[], ['screen'], ['work_code', 'late_bedtime'], ['anxiety_overload'], ['late_food', 'screen']];
const activityCycles = [['walk'], ['workout'], [], ['walk', 'recovery'], ['recovery']];
const factCycles = [
  'Отправил черновик организатору встречи',
  'Подобрал примеры для одного раздела доклада',
  'Завершил несколько слайдов презентации',
  'Оставил вечер без рабочих дел',
  'Приготовил ужин вместе с семьёй',
  'Прошёл запланированный маршрут пешком',
];

const dailyEntries = trackedDates.map((date, index) => {
  const factors = factorCycles[index % factorCycles.length];
  const special = specialDays[date] ?? null;
  const careerStates =
    index % 4 === 0
      ? ['preparation', 'external']
      : index % 5 === 0
        ? ['project', 'external']
        : [index % 3 === 0 ? 'project' : 'preparation'];
  const late = factors.includes('late_bedtime');
  const sleepMinutes = special?.[0] === 'travel' ? 365 : late ? 390 : 440 + (index % 4) * 10;
  const experimentCompleted =
    date >= '2026-07-13' && date <= dataThrough
      ? !['2026-07-15', '2026-07-19'].includes(date)
      : date >= '2026-06-10' && date <= '2026-06-16'
        ? date !== '2026-06-12'
        : null;

  return {
    date,
    entrySchemaVersion: 2,
    activeDailyBlocksSnapshot: ['sleep', 'context', 'career', 'movement', 'nutrition'],
    recordedFields: [
      'bedtime',
      'wakeTime',
      'sleepMinutes',
      'timeInBedMinutes',
      'sleepQuality',
      'energy',
      'contextFactors',
      'careerStates',
      'activities',
      'nutritionState',
      'actionDirection',
      'lifeAreas',
      'importantFact',
      ...(special ? ['specialDay'] : []),
      ...(factors.includes('anxiety_overload') || (!special && index % 6 === 0) ? ['contextNote'] : []),
      ...(index % 7 === 0 ? ['nutritionNote'] : []),
      ...(new Date(`${date}T00:00:00Z`).getUTCDay() === 1 ? ['weightKg'] : []),
      ...(careerStates.includes('external') ? ['actionNote'] : []),
      ...(experimentCompleted !== null ? ['experimentCompleted'] : []),
    ],
    bedtime: late ? '00:35' : ['23:10', '23:30', '23:50'][index % 3],
    wakeTime: special?.[0] === 'travel' ? '06:20' : ['07:20', '07:35', '07:50'][index % 3],
    sleepMinutes,
    timeInBedMinutes: sleepMinutes + 25,
    sleepQuality: special ? 2 : late ? 3 : 4 + (index % 2),
    energy: special?.[0] === 'overload' ? 2 : late ? 3 : 4 + (index % 2),
    contextFactors: factors,
    contextFactorsRecorded: true,
    contextNote: factors.includes('anxiety_overload')
      ? 'Было сложно переключиться после насыщенного дня'
      : !special && index % 6 === 0
        ? 'День с большим количеством встреч'
        : '',
    specialDay: special?.[0] ?? null,
    specialDayNote: special?.[1] ?? '',
    careerState: careerStates[0],
    careerStates,
    activities: activityCycles[index % activityCycles.length],
    activitiesRecorded: true,
    nutritionState: index % 7 === 0 ? 'blocks_goal' : index % 3 === 0 ? 'neutral' : 'supports_goal',
    nutritionNote: index % 7 === 0 ? 'Поздний ужин после насыщенного дня' : '',
    nutritionCriterion: 'Регулярные приёмы пищи без позднего переедания',
    weightKg: new Date(`${date}T00:00:00Z`).getUTCDay() === 1 ? Number((72.4 + Math.sin(index / 3) * 0.35).toFixed(1)) : null,
    actionDirection: careerStates.includes('external') ? 'external' : index % 6 === 0 ? 'recovery' : 'preparation',
    actionNote: careerStates.includes('external') ? 'Отправил материал и запросил конкретный комментарий' : '',
    focusTitle: 'Подготовить короткий доклад для профессиональной встречи',
    focusOutcomeCriterion: 'Готовая версия доклада и проведённая репетиция',
    focusReviewDate: '2026-08-15',
    externalEvidenceCriterion: 'Отправленный черновик, полученный комментарий или назначенная репетиция',
    lifeAreas: lifeAreaCycles[index % lifeAreaCycles.length],
    lifeAreasRecorded: true,
    importantFact: factCycles[index % factCycles.length],
    experimentCompleted,
    updatedAt: isoAt(date, 21),
  };
});

const resultTitles = [
  ['career', 'Согласовал тему доклада'],
  ['career', 'Отправил организатору первый черновик'],
  ['custom:life:music', 'Разучил небольшую музыкальную композицию'],
  ['reading', 'Закончил книгу и выписал основные идеи'],
  ['sport', 'Прошёл длинный маршрут пешком'],
  ['family', 'Приготовил семейный ужин'],
  ['creativity', 'Собрал небольшой фотоальбом'],
  ['sleep', 'Три вечера подряд лёг спать вовремя'],
  ['career', 'Получил комментарии к структуре доклада'],
  ['rest', 'Провёл выходной за городом'],
  ['career', 'Провёл первую репетицию выступления'],
  ['friends', 'Встретился с друзьями'],
  ['nutrition', 'Заранее подготовил еду на два дня'],
  ['creativity', 'Сделал визуальный набросок'],
];

const resultDates = trackedDates.slice(-28);
const results = resultDates.map((date, index) => ({
  id: index + 1,
  date,
  area: resultTitles[index % resultTitles.length][0],
  title: resultTitles[index % resultTitles.length][1],
  createdAt: isoAt(date, 19),
}));

const eventSpecs = [
  ['2026-05-06', 'decision', 'Сократил число параллельных задач', 'Оставил подготовку доклада и обычные домашние дела.'],
  ['2026-05-18', 'insight', 'Черновик проще отправить в первой половине дня', 'После обеда чаще хотелось ещё раз перепроверить материал.'],
  ['2026-05-29', 'event', 'Организатор прислал подробные комментарии', 'Зафиксировал правки к структуре и примерам в докладе.'],
  ['2026-06-12', 'change', 'Поездка изменила режим недели', 'Не сравниваю эту неделю с обычными по сну и нагрузке.'],
  ['2026-06-24', 'decision', 'Оставил один вечер без подготовки', 'По средам не открываю материалы доклада после 20:00.'],
  [
    '2026-07-03',
    'insight',
    'Экран перед сном связан с более поздним засыпанием',
    'Это наблюдение по нескольким дням, а не доказанная причина.',
  ],
  ['2026-07-10', 'event', 'Провёл пробную репетицию', 'Отметил места, где объяснение получилось слишком длинным.'],
  [
    '2026-07-13',
    'decision',
    'Начал эксперимент с первым часом без уведомлений',
    'На две недели отмечаю, удалось ли начать запланированную задачу без переключений.',
  ],
  ['2026-07-17', 'change', 'Перенёс переписку на первую половину дня', 'Проверяю, станет ли получение обратной связи регулярнее.'],
  ['2026-07-20', 'other', 'Скорректировал план последней недели', 'Оставил одну репетицию и финальную проверку материалов.'],
];
const lifeEvents = eventSpecs.map(([date, type, title, note], index) => ({
  id: index + 1,
  date,
  type,
  title,
  note,
  createdAt: isoAt(date, 18),
}));

const weekStarts = eachDate('2026-05-04', '2026-07-13').filter((date) => new Date(`${date}T00:00:00Z`).getUTCDay() === 1);
const weeklyReviews = weekStarts.map((weekStart, index) => ({
  weekStart,
  updatedAt: isoAt(eachDate(weekStart, dataThrough)[Math.min(6, eachDate(weekStart, dataThrough).length - 1)], 17),
  previousPlanOutcome:
    index === 0
      ? 'Первый обзор в наборе данных'
      : index % 3 === 0
        ? 'План сработал частично: материал отправил, вечер перегрузил'
        : 'Основной следующий шаг выполнен',
  results: [
    resultTitles[(index * 2) % resultTitles.length][1],
    resultTitles[(index * 2 + 1) % resultTitles.length][1],
    index % 2 === 0 ? 'Сохранил время на восстановление' : '',
  ],
  highlights: [
    index % 2 === 0
      ? 'Заметил, что короткие завершённые шаги легче вспомнить при обзоре'
      : 'Пересмотрел порядок дел после изменения недели',
    index % 3 === 0 ? 'Усталость сильнее влияла на оценку недели к вечеру' : '',
    '',
  ],
  stateContext: index % 3 === 0 ? 'Неделя была неровной из-за позднего завершения работы.' : 'Состояние в целом было устойчивым.',
  support: index % 2 === 0 ? 'Один небольшой раздел на день' : 'Заранее определённый первый шаг',
  obstacle: index % 3 === 0 ? 'Позднее завершение работы' : 'Слишком широкий список задач',
  nextLever: index % 2 === 0 ? 'Отправлять готовый фрагмент до обеда' : 'Закрывать подготовку коротким итогом',
  ifThenPlan:
    index % 2 === 0
      ? 'Если начинаю снова перепроверять готовый фрагмент, отправляю его организатору на комментарий'
      : 'Если после 22:30 остаётся задача, переношу её в план следующего дня',
}));

const monthlyReviews = [
  {
    monthStart: '2026-05-01',
    updatedAt: '2026-05-31T18:00:00.000Z',
    mainPattern: 'Небольшие заранее выбранные шаги выполнялись устойчивее больших списков.',
    support: 'Утренний блок без сообщений и один понятный раздел доклада.',
    obstacle: 'Попытка одновременно улучшать слишком много направлений.',
    courseChange: 'Оставить один основной раздел доклада на неделю.',
    nextFocus: 'Регулярно получать комментарии без увеличения вечерней нагрузки.',
    ifThenPlan: 'Если неделя перегружена, сокращаю объём шага, но не добавляю новые направления.',
  },
  {
    monthStart: '2026-06-01',
    updatedAt: '2026-06-30T18:00:00.000Z',
    mainPattern: 'После поздней работы сон и энергия чаще были ниже обычного.',
    support: 'Свободный вечер в середине недели и прогулки.',
    obstacle: 'Подготовка материалов продолжалась дольше запланированного.',
    courseChange: 'Завершать активную работу до 22:30 и отдельно отмечать исключения.',
    nextFocus: 'Проверить первый час без уведомлений как практический эксперимент.',
    ifThenPlan: 'Если хочется продолжить после 22:30, записываю следующий шаг и закрываю ноутбук.',
  },
];

const payload = {
  version: 7,
  exportedAt: '2026-07-20T18:00:00.000Z',
  dailyEntries,
  results,
  lifeEvents,
  weeklyReviews,
  monthlyReviews,
  settings: {
    id: 'main',
    settingsVersion: 10,
    activeDailyBlocks: ['sleep', 'context', 'career', 'movement', 'nutrition'],
    activeLifeAreas: ['family', 'reading', 'creativity', 'rest', 'friends', 'custom:life:music'],
    customActivityOptions: [{ id: 'custom:activity:swimming', label: 'Плавание', icon: '+', custom: true, archived: false }],
    hiddenActivityIds: [],
    customCareerOptions: [
      { id: 'custom:career:research', label: 'Исследование материалов', icon: '+', custom: true, countsAsExternal: false, archived: true },
    ],
    customLifeAreaOptions: [{ id: 'custom:life:music', label: 'Музыка', icon: '+', custom: true, archived: false }],
    customContextFactorOptions: [
      { id: 'custom:context:renovation-noise', label: 'Ремонт у соседей', icon: '+', custom: true, archived: true },
    ],
    hiddenContextFactorIds: [],
    activeFocusTitle: 'Подготовить короткий доклад для профессиональной встречи',
    focusOutcomeCriterion: 'Готовая версия доклада и проведённая репетиция',
    focusReviewDate: '2026-08-15',
    externalEvidenceCriterion: 'Отправленный черновик, полученный комментарий или назначенная репетиция',
    nutritionGoalCriterion: 'Регулярные приёмы пищи без позднего переедания',
    experiment: {
      active: true,
      title: 'Первый час без уведомлений',
      hypothesis: 'Станет ли проще начать запланированную задачу без переключений.',
      targetMetricId: null,
      targetMetric: '',
      targetDirection: 'increase',
      minimumMeaningfulChange: null,
      startDate: '2026-07-13',
      endDate: '2026-07-26',
      conclusion: '',
      decision: null,
    },
    experimentHistory: [
      {
        id: 'experiment-2026-06-walk',
        title: 'Короткая прогулка после обеда',
        hypothesis: 'Поможет ли прогулка легче переключаться между задачами.',
        targetMetricId: null,
        targetMetric: '',
        targetDirection: 'increase',
        minimumMeaningfulChange: null,
        startDate: '2026-06-10',
        endDate: '2026-06-16',
        conclusion: 'После прогулки переключаться было проще, но отметок пока мало для уверенного решения.',
        decision: 'more_data',
        completedAt: '2026-06-16T20:00:00.000Z',
      },
    ],
  },
};

await mkdir(path.dirname(outputPath), { recursive: true });
let serialized = JSON.stringify(payload, null, 2);
for (const property of ['activeDailyBlocksSnapshot', 'recordedFields']) {
  serialized = compactStringArrayProperty(serialized, property);
}
await writeFile(outputPath, `${serialized}\n`, 'utf8');
console.log(
  `Generated ${path.relative(projectRoot, outputPath)}: ${dailyEntries.length} days, ${results.length} results, ${lifeEvents.length} events.`,
);

function compactStringArrayProperty(json, property) {
  const pattern = new RegExp(`("${property}": \\[)\\n((?:\\s+"[^"]+",?\\n)+)(\\s*\\])`, 'g');
  return json.replace(pattern, (_, start, body) => {
    const values = body
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .join(' ');
    return `${start}${values}]`;
  });
}
