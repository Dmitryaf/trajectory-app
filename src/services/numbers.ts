export function minutesToInputHours(minutes: number | null): number | null {
  if (minutes === null || !Number.isFinite(minutes)) return null;
  return Math.round((minutes / 60) * 100) / 100;
}

export function inputHoursToMinutes(hours: number | null): number | null {
  if (hours === null || !Number.isFinite(hours)) return null;
  return Math.round(hours * 60);
}
