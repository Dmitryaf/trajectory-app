import { actionDirectionOptions, dailyBlockOptions, knownActivityOptions, nutritionOptions, specialDayOptions } from './options';
import { removedDemoCareerOptionId, removedDemoContextFactorId, validDate } from './normalization';
import { currentDailyEntrySchemaVersion } from './schema';
import type {
  ActionDirectionId,
  ActivityId,
  CareerState,
  ContextFactorId,
  DailyBlockId,
  DailyEntry,
  DailyRecordedFieldId,
  LifeAreaId,
  NutritionState,
  SpecialDayId,
} from './schema';

const dailyRecordedFieldIds: DailyRecordedFieldId[] = [
  'bedtime',
  'wakeTime',
  'sleepMinutes',
  'timeInBedMinutes',
  'sleepQuality',
  'energy',
  'contextFactors',
  'contextNote',
  'specialDay',
  'careerStates',
  'activities',
  'nutritionState',
  'nutritionNote',
  'weightKg',
  'actionDirection',
  'actionNote',
  'lifeAreas',
  'importantFact',
  'experimentCompleted',
  'experimentNote',
];

function isNutritionState(value: unknown): value is NutritionState {
  return typeof value === 'string' && nutritionOptions.some((option) => option.id === value);
}

function isActionDirection(value: unknown): value is ActionDirectionId {
  return typeof value === 'string' && actionDirectionOptions.some((option) => option.id === value);
}

function nullableNumber(value: unknown, min: number, max: number, integer = false): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return null;
  return integer && !Number.isInteger(value) ? null : value;
}

function validTime(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return '';
  const [hours, minutes] = value.split(':').map(Number);
  return hours! <= 23 && minutes! <= 59 ? value : '';
}

export function emptyDailyEntry(date: string): DailyEntry {
  return {
    date,
    entrySchemaVersion: currentDailyEntrySchemaVersion,
    activeDailyBlocksSnapshot: null,
    recordedFields: [],
    bedtime: '',
    wakeTime: '',
    sleepMinutes: null,
    timeInBedMinutes: null,
    sleepQuality: null,
    energy: null,
    contextFactors: [],
    contextFactorsRecorded: false,
    contextNote: '',
    specialDay: null,
    specialDayNote: '',
    careerState: null,
    careerStates: [],
    activities: [],
    activitiesRecorded: false,
    nutritionState: null,
    nutritionNote: '',
    nutritionCriterion: '',
    weightKg: null,
    actionDirection: null,
    actionNote: '',
    focusTitle: '',
    focusOutcomeCriterion: '',
    focusReviewDate: '',
    externalEvidenceCriterion: '',
    lifeAreas: [],
    lifeAreasRecorded: false,
    importantFact: '',
    experimentId: null,
    experimentCompleted: null,
    experimentNote: '',
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
    ? Array.from(new Set(entry.careerStates.filter((state): state is CareerState => typeof state === 'string')))
    : typeof entry.careerState === 'string'
      ? [entry.careerState]
      : [];
  const careerStates = Array.from(new Set(sourceCareerStates.map((state) => (state === removedDemoCareerOptionId ? 'external' : state))));
  const activities = Array.isArray(entry.activities)
    ? Array.from(
        new Set(
          entry.activities.filter(
            (activity): activity is ActivityId =>
              typeof activity === 'string' &&
              (knownActivityOptions.some((option) => option.id === activity) || activity.startsWith('custom:activity:')),
          ),
        ),
      )
    : [];
  const sourceContextFactors = Array.isArray(entry.contextFactors)
    ? entry.contextFactors
    : Array.isArray(entry.eveningFactors)
      ? entry.eveningFactors
      : [];
  const contextFactors = sourceContextFactors.filter(
    (factor): factor is ContextFactorId => typeof factor === 'string' && factor !== removedDemoContextFactorId,
  );
  const contextNote =
    typeof entry.contextNote === 'string'
      ? entry.contextNote
      : [entry.stateContext, entry.eveningFactorNote]
          .filter((note): note is string => typeof note === 'string' && note.trim().length > 0)
          .join('\n');
  const specialDay =
    typeof entry.specialDay === 'string' && specialDayOptions.some((option) => option.id === entry.specialDay)
      ? (entry.specialDay as SpecialDayId)
      : null;
  const bedtime = validTime(entry.bedtime);
  const wakeTime = validTime(entry.wakeTime);
  const sleepMinutes = nullableNumber(entry.sleepMinutes, 0, 24 * 60, true);
  const timeInBedMinutes = nullableNumber(entry.timeInBedMinutes, 0, 18 * 60, true);
  const sleepQuality = nullableNumber(entry.sleepQuality, 1, 5, true);
  const energy = nullableNumber(entry.energy, 1, 5, true);
  const weightKg = nullableNumber(entry.weightKg, 30, 250);
  const nutritionState = isNutritionState(entry.nutritionState) ? entry.nutritionState : null;
  const nutritionNote = typeof entry.nutritionNote === 'string' ? entry.nutritionNote : '';
  const actionDirection = isActionDirection(entry.actionDirection) ? entry.actionDirection : null;
  const actionNote = typeof entry.actionNote === 'string' ? entry.actionNote : '';
  const lifeAreas = Array.isArray(entry.lifeAreas) ? entry.lifeAreas.filter((area): area is LifeAreaId => typeof area === 'string') : [];
  const importantFact = typeof entry.importantFact === 'string' ? entry.importantFact : '';
  const experimentId = typeof entry.experimentId === 'string' && entry.experimentId.trim() ? entry.experimentId.trim() : null;
  const experimentCompleted = typeof entry.experimentCompleted === 'boolean' ? entry.experimentCompleted : null;
  const experimentNote = typeof entry.experimentNote === 'string' ? entry.experimentNote : '';
  const activitiesRecorded = typeof entry.activitiesRecorded === 'boolean' ? entry.activitiesRecorded : activities.length > 0;
  const lifeAreasRecorded = typeof entry.lifeAreasRecorded === 'boolean' ? entry.lifeAreasRecorded : lifeAreas.length > 0;
  const contextFactorsRecorded =
    typeof entry.contextFactorsRecorded === 'boolean'
      ? entry.contextFactorsRecorded
      : typeof entry.eveningFactorsRecorded === 'boolean'
        ? entry.eveningFactorsRecorded
        : sourceContextFactors.length > 0;
  const recordedFields = new Set<DailyRecordedFieldId>(
    Array.isArray(entry.recordedFields)
      ? entry.recordedFields.filter((field): field is DailyRecordedFieldId => dailyRecordedFieldIds.includes(field as DailyRecordedFieldId))
      : [],
  );
  if (bedtime) recordedFields.add('bedtime');
  if (wakeTime) recordedFields.add('wakeTime');
  if (sleepMinutes !== null) recordedFields.add('sleepMinutes');
  if (timeInBedMinutes !== null) recordedFields.add('timeInBedMinutes');
  if (sleepQuality !== null) recordedFields.add('sleepQuality');
  if (energy !== null) recordedFields.add('energy');
  if (contextFactorsRecorded) recordedFields.add('contextFactors');
  if (contextNote.trim()) recordedFields.add('contextNote');
  if (specialDay) recordedFields.add('specialDay');
  if (careerStates.length) recordedFields.add('careerStates');
  if (activitiesRecorded) recordedFields.add('activities');
  if (nutritionState !== null) recordedFields.add('nutritionState');
  if (nutritionNote.trim()) recordedFields.add('nutritionNote');
  if (weightKg !== null) recordedFields.add('weightKg');
  if (actionDirection !== null) recordedFields.add('actionDirection');
  if (actionNote.trim()) recordedFields.add('actionNote');
  if (lifeAreasRecorded) recordedFields.add('lifeAreas');
  if (importantFact.trim()) recordedFields.add('importantFact');
  if (experimentCompleted !== null) recordedFields.add('experimentCompleted');
  if (experimentNote.trim()) recordedFields.add('experimentNote');
  const activeDailyBlocksSnapshot = Array.isArray(entry.activeDailyBlocksSnapshot)
    ? Array.from(
        new Set(
          entry.activeDailyBlocksSnapshot.filter((block): block is DailyBlockId => dailyBlockOptions.some((option) => option.id === block)),
        ),
      )
    : null;

  return {
    ...emptyDailyEntry(entry.date),
    entrySchemaVersion:
      typeof entry.entrySchemaVersion === 'number' && Number.isInteger(entry.entrySchemaVersion) && entry.entrySchemaVersion > 0
        ? entry.entrySchemaVersion
        : null,
    activeDailyBlocksSnapshot,
    recordedFields: Array.from(recordedFields),
    bedtime,
    wakeTime,
    sleepMinutes,
    timeInBedMinutes,
    sleepQuality,
    energy,
    careerState: careerStates[0] ?? null,
    careerStates,
    weightKg,
    activities,
    activitiesRecorded: recordedFields.has('activities'),
    nutritionState,
    nutritionNote,
    nutritionCriterion: typeof entry.nutritionCriterion === 'string' ? entry.nutritionCriterion : '',
    actionDirection,
    actionNote,
    focusTitle: typeof entry.focusTitle === 'string' ? entry.focusTitle : '',
    focusOutcomeCriterion: typeof entry.focusOutcomeCriterion === 'string' ? entry.focusOutcomeCriterion : '',
    focusReviewDate: validDate(entry.focusReviewDate),
    externalEvidenceCriterion: typeof entry.externalEvidenceCriterion === 'string' ? entry.externalEvidenceCriterion : '',
    lifeAreas,
    lifeAreasRecorded: recordedFields.has('lifeAreas'),
    contextFactors,
    contextFactorsRecorded: recordedFields.has('contextFactors'),
    contextNote,
    specialDay,
    specialDayNote: typeof entry.specialDayNote === 'string' ? entry.specialDayNote : '',
    importantFact,
    experimentId,
    experimentCompleted,
    experimentNote,
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
  };
}

export function dailyFieldWasRecorded(entry: DailyEntry, field: DailyRecordedFieldId): boolean {
  if (entry.recordedFields.includes(field)) return true;
  switch (field) {
    case 'bedtime':
      return Boolean(entry.bedtime);
    case 'wakeTime':
      return Boolean(entry.wakeTime);
    case 'sleepMinutes':
      return entry.sleepMinutes !== null;
    case 'timeInBedMinutes':
      return entry.timeInBedMinutes !== null;
    case 'sleepQuality':
      return entry.sleepQuality !== null;
    case 'energy':
      return entry.energy !== null;
    case 'contextFactors':
      return entry.contextFactorsRecorded;
    case 'contextNote':
      return Boolean(entry.contextNote.trim());
    case 'specialDay':
      return entry.specialDay !== null;
    case 'careerStates':
      return entry.careerStates.length > 0 || entry.careerState !== null;
    case 'activities':
      return entry.activitiesRecorded;
    case 'nutritionState':
      return entry.nutritionState !== null;
    case 'nutritionNote':
      return Boolean(entry.nutritionNote.trim());
    case 'weightKg':
      return entry.weightKg !== null;
    case 'actionDirection':
      return entry.actionDirection !== null;
    case 'actionNote':
      return Boolean(entry.actionNote.trim());
    case 'lifeAreas':
      return entry.lifeAreasRecorded;
    case 'importantFact':
      return Boolean(entry.importantFact.trim());
    case 'experimentCompleted':
      return entry.experimentCompleted !== null;
    case 'experimentNote':
      return Boolean(entry.experimentNote.trim());
  }
}
