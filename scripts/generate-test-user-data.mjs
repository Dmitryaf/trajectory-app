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
  for (const cursor = new Date(`${from}T00:00:00Z`); cursor <= new Date(`${through}T00:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
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
  ['reading', 'custom:life:personal-projects'],
  ['family', 'rest'],
  ['english', 'friends'],
  ['creativity', 'custom:life:personal-projects'],
];
const factorCycles = [
  [],
  ['screen'],
  ['work_code', 'late_bedtime'],
  ['custom:evening:shower'],
  ['late_food', 'screen'],
];
const activityCycles = [['walk'], ['workout'], [], ['boxing'], ['recovery']];
const factCycles = [
  'Отправил отклик и записал следующий шаг',
  'Разобрал одну сложную тему без спешки',
  'Закрыл небольшой этап личного проекта',
  'Оставил вечер свободным и восстановился',
  'Созвонился с близкими',
  'Провёл тренировку по плану',
];

const dailyEntries = trackedDates.map((date, index) => {
  const factors = factorCycles[index % factorCycles.length];
  const special = specialDays[date] ?? null;
  const careerStates = index % 4 === 0
    ? ['preparation', 'custom:career:responses']
    : index % 5 === 0
      ? ['project', 'external']
      : [index % 3 === 0 ? 'project' : 'preparation'];
  const late = factors.includes('late_bedtime');
  const sleepMinutes = special?.[0] === 'travel' ? 365 : late ? 390 : 440 + (index % 4) * 10;
  const experimentCompleted = date >= '2026-07-13' && date <= dataThrough
    ? !['2026-07-15', '2026-07-19'].includes(date)
    : null;

  return {
    date,
    bedtime: late ? '00:35' : ['23:10', '23:30', '23:50'][index % 3],
    wakeTime: special?.[0] === 'travel' ? '06:20' : ['07:20', '07:35', '07:50'][index % 3],
    sleepMinutes,
    timeInBedMinutes: sleepMinutes + 25,
    sleepQuality: special ? 2 : late ? 3 : 4 + (index % 2),
    energy: special?.[0] === 'overload' ? 2 : late ? 3 : 4 + (index % 2),
    stateContext: special ? special[1] : index % 6 === 0 ? 'День с большим количеством встреч' : '',
    eveningFactors: factors,
    eveningFactorsRecorded: true,
    eveningFactorNote: factors.includes('custom:evening:shower') ? 'После душа было проще переключиться на сон' : '',
    specialDay: special?.[0] ?? null,
    specialDayNote: special?.[1] ?? '',
    careerState: careerStates[0],
    careerStates,
    activities: activityCycles[index % activityCycles.length],
    activitiesRecorded: true,
    nutritionState: index % 7 === 0 ? 'blocks_goal' : index % 3 === 0 ? 'neutral' : 'supports_goal',
    nutritionNote: index % 7 === 0 ? 'Поздний ужин после насыщенного дня' : '',
    nutritionCriterion: 'Регулярные приёмы пищи без позднего переедания',
    weightKg: new Date(`${date}T00:00:00Z`).getUTCDay() === 1 ? Number((89.3 - index * 0.055).toFixed(1)) : null,
    actionDirection: careerStates.some((state) => ['external', 'custom:career:responses'].includes(state)) ? 'external' : index % 6 === 0 ? 'recovery' : 'preparation',
    actionNote: careerStates.includes('custom:career:responses') ? 'Выбрал вакансию и адаптировал сопроводительное письмо' : '',
    focusTitle: 'Найти устойчивый ритм поиска работы и личного проекта',
    externalEvidenceCriterion: 'Отправленный отклик, назначенный разговор или опубликованный результат',
    lifeAreas: lifeAreaCycles[index % lifeAreaCycles.length],
    lifeAreasRecorded: true,
    importantFact: factCycles[index % factCycles.length],
    experimentCompleted,
    updatedAt: isoAt(date, 21),
  };
});

const resultTitles = [
  ['career', 'Обновил блок опыта в резюме'],
  ['career', 'Отправил адресный отклик'],
  ['custom:life:personal-projects', 'Собрал новый экран проекта'],
  ['reading', 'Закончил главу и выписал идеи'],
  ['sport', 'Провёл тренировку по плану'],
  ['family', 'Устроил спокойный семейный вечер'],
  ['english', 'Провёл разговорную практику'],
  ['sleep', 'Три вечера подряд завершил работу заранее'],
  ['career', 'Получил обратную связь по резюме'],
  ['rest', 'Оставил выходной без рабочих задач'],
  ['career', 'Подготовил разбор проекта для интервью'],
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
  ['2026-05-06', 'decision', 'Ограничил число параллельных задач', 'Оставил один карьерный и один личный фокус.'],
  ['2026-05-18', 'insight', 'Короткий внешний шаг легче сделать утром', 'После обеда чаще откладывал отклики на следующий день.'],
  ['2026-05-29', 'event', 'Получил подробную обратную связь', 'Зафиксировал конкретные правки для резюме и рассказа о проекте.'],
  ['2026-06-12', 'change', 'Поездка изменила режим недели', 'Не сравниваю эту неделю с обычными по сну и нагрузке.'],
  ['2026-06-24', 'decision', 'Добавил отдельный вечер восстановления', 'По средам не планирую работу над проектом после 20:00.'],
  ['2026-07-03', 'insight', 'Экран перед сном связан с более поздним засыпанием', 'Это наблюдение по нескольким дням, а не доказанная причина.'],
  ['2026-07-10', 'event', 'Провёл пробное интервью', 'Собрал вопросы, на которых ответ получился неструктурированным.'],
  ['2026-07-13', 'decision', 'Начал эксперимент со спокойным вечером', 'На две недели отмечаю завершение работы и экрана до 22:30.'],
  ['2026-07-17', 'change', 'Перенёс отклики на первую половину дня', 'Проверяю, станет ли внешний шаг регулярнее.'],
  ['2026-07-20', 'other', 'Обновил тестовый набор данных', 'Снимок учитывает новые поля и сценарии интерфейса.'],
];
const lifeEvents = eventSpecs.map(([date, type, title, note], index) => ({ id: index + 1, date, type, title, note, createdAt: isoAt(date, 18) }));

const weekStarts = eachDate('2026-05-04', '2026-07-13').filter((date) => new Date(`${date}T00:00:00Z`).getUTCDay() === 1);
const weeklyReviews = weekStarts.map((weekStart, index) => ({
  weekStart,
  updatedAt: isoAt(eachDate(weekStart, dataThrough)[Math.min(6, eachDate(weekStart, dataThrough).length - 1)], 17),
  previousPlanOutcome: index === 0 ? 'Первый обзор в наборе данных' : index % 3 === 0 ? 'План сработал частично: внешний шаг сделал, вечер перегрузил' : 'Основной следующий шаг выполнен',
  results: [
    resultTitles[(index * 2) % resultTitles.length][1],
    resultTitles[(index * 2 + 1) % resultTitles.length][1],
    index % 2 === 0 ? 'Сохранил время на восстановление' : '',
  ],
  support: index % 2 === 0 ? 'Один небольшой приоритет на день' : 'Заранее определённый первый шаг',
  obstacle: index % 3 === 0 ? 'Позднее завершение работы' : 'Слишком широкий список задач',
  nextLever: index % 2 === 0 ? 'Сделать внешний шаг до обеда' : 'Закрывать рабочий день коротким итогом',
  ifThenPlan: index % 2 === 0 ? 'Если начинаю откладывать отклик, открываю одну выбранную вакансию на 15 минут' : 'Если после 22:30 остаётся задача, переношу её в план следующего дня',
}));

const monthlyReviews = [
  {
    monthStart: '2026-05-01',
    updatedAt: '2026-05-31T18:00:00.000Z',
    mainPattern: 'Небольшие заранее выбранные шаги выполнялись устойчивее больших списков.',
    support: 'Утренний блок без сообщений и один понятный критерий результата.',
    obstacle: 'Попытка одновременно улучшать слишком много направлений.',
    courseChange: 'Оставить один карьерный и один личный приоритет на неделю.',
    nextFocus: 'Регулярный внешний шаг без увеличения вечерней нагрузки.',
    ifThenPlan: 'Если неделя перегружена, сокращаю объём шага, но не добавляю новые направления.',
  },
  {
    monthStart: '2026-06-01',
    updatedAt: '2026-06-30T18:00:00.000Z',
    mainPattern: 'После поздней работы сон и энергия чаще были ниже обычного.',
    support: 'Свободный вечер в середине недели и прогулки.',
    obstacle: 'Работа над проектом продолжалась дольше запланированного.',
    courseChange: 'Завершать активную работу до 22:30 и отдельно отмечать исключения.',
    nextFocus: 'Проверить спокойный вечер как практический эксперимент.',
    ifThenPlan: 'Если хочется продолжить после 22:30, записываю следующий шаг и закрываю ноутбук.',
  },
];

const payload = {
  version: 3,
  exportedAt: '2026-07-20T18:00:00.000Z',
  dailyEntries,
  results,
  lifeEvents,
  weeklyReviews,
  monthlyReviews,
  settings: {
    id: 'main',
    settingsVersion: 3,
    activeDailyBlocks: ['sleep', 'career', 'movement', 'nutrition'],
    activeLifeAreas: ['family', 'reading', 'creativity', 'rest', 'friends', 'english', 'custom:life:personal-projects'],
    customCareerOptions: [
      { id: 'custom:career:responses', label: 'Адресные отклики', icon: '+', custom: true, countsAsExternal: true, archived: false },
      { id: 'custom:career:course', label: 'Учебный курс', icon: '+', custom: true, countsAsExternal: false, archived: true },
    ],
    customLifeAreaOptions: [
      { id: 'custom:life:personal-projects', label: 'Личные проекты', icon: '+', custom: true, archived: false },
    ],
    customEveningFactorOptions: [
      { id: 'custom:evening:shower', label: 'Спокойный душ', icon: '+', custom: true, archived: false },
      { id: 'custom:evening:music', label: 'Музыка перед сном', icon: '+', custom: true, archived: true },
    ],
    activeFocusTitle: 'Найти устойчивый ритм поиска работы и личного проекта',
    externalEvidenceCriterion: 'Отправленный отклик, назначенный разговор или опубликованный результат',
    nutritionGoalCriterion: 'Регулярные приёмы пищи без позднего переедания',
    experiment: {
      active: true,
      title: 'Спокойное завершение вечера',
      hypothesis: 'Если завершать работу и экран до 22:30, засыпание станет стабильнее.',
      targetMetric: 'Время отхода ко сну, качество сна и энергия утром',
      startDate: '2026-07-13',
      endDate: '2026-07-26',
      conclusion: '',
    },
  },
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Generated ${path.relative(projectRoot, outputPath)}: ${dailyEntries.length} days, ${results.length} results, ${lifeEvents.length} events.`);
