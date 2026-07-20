import { describe, expect, it } from 'vitest';
import { inputHoursToMinutes, minutesToInputHours } from '../src/services/numbers';

describe('numeric input formatting', () => {
  it('shows minute durations without floating-point tails', () => {
    expect(minutesToInputHours(390)).toBe(6.5);
    expect(minutesToInputHours(415)).toBe(6.92);
  });

  it('stores edited decimal hours as whole minutes', () => {
    expect(inputHoursToMinutes(6.5)).toBe(390);
    expect(inputHoursToMinutes(6.92)).toBe(415);
  });

  it('preserves empty values', () => {
    expect(minutesToInputHours(null)).toBeNull();
    expect(inputHoursToMinutes(null)).toBeNull();
  });
});
