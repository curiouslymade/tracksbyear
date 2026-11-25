import { describe, expect, it } from 'vitest';
import { daysIn, joinParts, splitIso, yearsDown } from './dateParts';

describe('daysIn', () => {
  it('knows short months and leap years', () => {
    expect(daysIn(2023, 2)).toBe(28);
    expect(daysIn(2024, 2)).toBe(29);
    expect(daysIn(1999, 4)).toBe(30);
    expect(daysIn(undefined, undefined)).toBe(31);
  });
});

describe('splitIso', () => {
  it('reads full and partial dates', () => {
    expect(splitIso('1995-10-02')).toEqual({ year: 1995, month: 10, day: 2 });
    expect(splitIso('1995-10')).toEqual({ year: 1995, month: 10, day: undefined });
    expect(splitIso('1995')).toEqual({ year: 1995, month: undefined, day: undefined });
    expect(splitIso('')).toEqual({});
    expect(splitIso('02/10/1995')).toEqual({});
  });
});

describe('joinParts', () => {
  it('needs all three parts in full mode', () => {
    expect(joinParts({ year: 1995, month: 10, day: 2 }, 'full')).toBe('1995-10-02');
    expect(joinParts({ year: 1995, month: 10 }, 'full')).toBe('');
  });
  it('allows a year, or a month and a year, in partial mode', () => {
    expect(joinParts({ year: 1995 }, 'partial')).toBe('1995');
    expect(joinParts({ year: 1995, month: 3 }, 'partial')).toBe('1995-03');
    expect(joinParts({ year: 1995, day: 3 }, 'partial')).toBe('1995');
    expect(joinParts({ month: 3, day: 3 }, 'partial')).toBe('');
  });
  it('moves a day past the end of the month back to the last day', () => {
    expect(joinParts({ year: 2023, month: 2, day: 31 }, 'full')).toBe('2023-02-28');
  });
});

describe('yearsDown', () => {
  it('lists the years newest first', () => {
    expect(yearsDown(2020, 2023)).toEqual([2023, 2022, 2021, 2020]);
  });
});
