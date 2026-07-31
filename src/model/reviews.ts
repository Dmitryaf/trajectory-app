import { lifeEventTypeOptions } from './options';
import type { LifeEventRecord, LifeEventType, MonthlyReview, WeeklyReview } from './schema';

export function normalizeLifeEvent(event: Partial<LifeEventRecord> & { date: string; title: string }): LifeEventRecord {
  let type: LifeEventType = 'other';
  if (event.type === 'milestone') type = 'change';
  else if (lifeEventTypeOptions.some((option) => option.id === event.type)) type = event.type as LifeEventType;
  return {
    date: event.date,
    type,
    title: typeof event.title === 'string' ? event.title : '',
    note: typeof event.note === 'string' ? event.note : '',
    createdAt: typeof event.createdAt === 'string' ? event.createdAt : '',
    ...(typeof event.id === 'number' ? { id: event.id } : {}),
  };
}

export function emptyWeeklyReview(weekStart: string): WeeklyReview {
  return {
    weekStart,
    updatedAt: '',
    previousPlanOutcome: '',
    results: ['', '', ''],
    support: '',
    obstacle: '',
    nextLever: '',
    ifThenPlan: '',
  };
}

export function normalizeWeeklyReview(review: Partial<WeeklyReview> & { weekStart: string }): WeeklyReview {
  return {
    ...emptyWeeklyReview(review.weekStart),
    ...review,
    previousPlanOutcome: typeof review.previousPlanOutcome === 'string' ? review.previousPlanOutcome : '',
    updatedAt: typeof review.updatedAt === 'string' ? review.updatedAt : '',
    results: Array.isArray(review.results) ? review.results.filter((result): result is string => typeof result === 'string') : ['', '', ''],
    support: typeof review.support === 'string' ? review.support : '',
    obstacle: typeof review.obstacle === 'string' ? review.obstacle : '',
    nextLever: typeof review.nextLever === 'string' ? review.nextLever : '',
    ifThenPlan: typeof review.ifThenPlan === 'string' ? review.ifThenPlan : '',
  };
}

export function emptyMonthlyReview(monthStart: string): MonthlyReview {
  return {
    monthStart,
    updatedAt: '',
    mainPattern: '',
    support: '',
    obstacle: '',
    courseChange: '',
    nextFocus: '',
    ifThenPlan: '',
  };
}

export function normalizeMonthlyReview(review: Partial<MonthlyReview> & { monthStart: string }): MonthlyReview {
  return {
    ...emptyMonthlyReview(review.monthStart),
    ...review,
    mainPattern: typeof review.mainPattern === 'string' ? review.mainPattern : '',
    updatedAt: typeof review.updatedAt === 'string' ? review.updatedAt : '',
    support: typeof review.support === 'string' ? review.support : '',
    obstacle: typeof review.obstacle === 'string' ? review.obstacle : '',
    courseChange: typeof review.courseChange === 'string' ? review.courseChange : '',
    nextFocus: typeof review.nextFocus === 'string' ? review.nextFocus : '',
    ifThenPlan: typeof review.ifThenPlan === 'string' ? review.ifThenPlan : '',
  };
}
