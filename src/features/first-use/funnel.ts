export const firstUseFunnelEventNames = [
  'first_use_presentation_viewed',
  'first_use_signup_completed',
  'first_use_recovery_started',
  'first_use_first_answer_saved',
  'first_use_journal_record_saved',
  'first_use_overview_viewed',
  'first_use_next_day_returned',
  'first_use_next_week_returned',
] as const;

export type FirstUseFunnelEventName = (typeof firstUseFunnelEventNames)[number];

export type FirstUseFunnelEvent = {
  name: FirstUseFunnelEventName;
  occurredAt: string;
};

type FunnelStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type StoredFunnel = {
  version: 1;
  events: Partial<Record<FirstUseFunnelEventName, string>>;
};

const storageKey = 'trajectory:first-use-funnel:v1';

function defaultStorage(): FunnelStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function emptyFunnel(): StoredFunnel {
  return { version: 1, events: {} };
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
}

function readStoredFunnel(storage: FunnelStorage | undefined): StoredFunnel {
  if (!storage) return emptyFunnel();
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return emptyFunnel();
    const parsed = JSON.parse(raw) as { version?: unknown; events?: unknown };
    if (parsed.version !== 1 || !parsed.events || typeof parsed.events !== 'object' || Array.isArray(parsed.events)) {
      return emptyFunnel();
    }
    const source = parsed.events as Record<string, unknown>;
    const events: StoredFunnel['events'] = {};
    for (const name of firstUseFunnelEventNames) {
      if (isValidTimestamp(source[name])) events[name] = source[name];
    }
    return { version: 1, events };
  } catch {
    return emptyFunnel();
  }
}

function writeStoredFunnel(funnel: StoredFunnel, storage: FunnelStorage | undefined) {
  if (!storage) return false;
  try {
    storage.setItem(storageKey, JSON.stringify(funnel));
    return true;
  } catch {
    return false;
  }
}

export function recordFirstUseEvent(
  name: FirstUseFunnelEventName,
  occurredAt: Date = new Date(),
  storage: FunnelStorage | undefined = defaultStorage(),
) {
  if (!Number.isFinite(occurredAt.getTime())) return false;
  const funnel = readStoredFunnel(storage);
  if (funnel.events[name]) return false;
  funnel.events[name] = occurredAt.toISOString();
  return writeStoredFunnel(funnel, storage);
}

export function readFirstUseFunnel(storage: FunnelStorage | undefined = defaultStorage()): FirstUseFunnelEvent[] {
  const funnel = readStoredFunnel(storage);
  return firstUseFunnelEventNames.flatMap((name) => {
    const occurredAt = funnel.events[name];
    return occurredAt ? [{ name, occurredAt }] : [];
  });
}

export function clearFirstUseFunnel(storage: FunnelStorage | undefined = defaultStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(storageKey);
  } catch {
    // Local diagnostics must never block deletion of the user's main data.
  }
}

function calendarDayDifference(start: Date, end: Date) {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / 86_400_000);
}

export function recordFirstUseReturnEvents(openedAt: Date = new Date(), storage: FunnelStorage | undefined = defaultStorage()) {
  if (!Number.isFinite(openedAt.getTime())) return [] as FirstUseFunnelEventName[];
  const funnel = readStoredFunnel(storage);
  const startedAt = funnel.events.first_use_recovery_started;
  if (!startedAt) return [] as FirstUseFunnelEventName[];

  const dayDifference = calendarDayDifference(new Date(startedAt), openedAt);
  const recorded: FirstUseFunnelEventName[] = [];
  if (dayDifference === 1 && recordFirstUseEvent('first_use_next_day_returned', openedAt, storage)) {
    recorded.push('first_use_next_day_returned');
  }
  if (dayDifference >= 7 && dayDifference <= 13 && recordFirstUseEvent('first_use_next_week_returned', openedAt, storage)) {
    recorded.push('first_use_next_week_returned');
  }
  return recorded;
}
