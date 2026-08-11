import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const demoFilePath = 'demo/generated/trajectory-full.json';

type DemoPayload = {
  exportedAt: string;
  dailyEntries: Array<{ date: string }>;
};

export function readDemoPayload(): DemoPayload {
  return JSON.parse(readFileSync(resolve(process.cwd(), demoFilePath), 'utf8')) as DemoPayload;
}

export function demoAnchor(): string {
  return readDemoPayload().exportedAt.slice(0, 10);
}

export function completedCrossMonthRange(): { start: string; end: string } {
  const anchor = parseDate(demoAnchor());
  const boundary = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1));
  return { start: addDays(boundary, -5), end: addDays(boundary, 2) };
}

export function emptyPeriodDate(): string {
  const firstEntry = readDemoPayload()
    .dailyEntries.map((entry) => entry.date)
    .sort()[0];
  if (!firstEntry) throw new Error('Demo fixture must contain daily entries');
  return addDays(parseDate(firstEntry), -60);
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function addDays(date: Date, amount: number): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
}
