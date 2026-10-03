import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isoWeekOf, shiftWeek, weekRange } from './dates';

describe('dates', () => {
  it('computes ISO weeks, also around the turn of the year', () => {
    expect(isoWeekOf('2026-09-28')).toBe('2026-W40');
    expect(isoWeekOf('2026-10-04')).toBe('2026-W40');
    expect(isoWeekOf('2026-12-31')).toBe('2026-W53');
    expect(isoWeekOf('2027-01-03')).toBe('2026-W53');
    expect(isoWeekOf('2027-01-04')).toBe('2027-W01');
    expect(isoWeekOf('2024-12-30')).toBe('2025-W01');
  });

  it('gives Monday to Sunday of a week', () => {
    expect(weekRange('2026-W40')).toEqual({ start: '2026-09-28', end: '2026-10-04' });
    expect(weekRange('2025-W01')).toEqual({ start: '2024-12-30', end: '2025-01-05' });
    expect(shiftWeek('2026-W53', 1)).toBe('2027-W01');
    expect(shiftWeek('2026-W40', -1)).toBe('2026-W39');
  });

  it('adds and counts days across month and DST changes', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-03', '2026-12-31')).toBe(89);
  });
});
