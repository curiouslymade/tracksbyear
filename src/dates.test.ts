import { describe, expect, it } from 'vitest';
import { checkReleaseDate, formatUkDate, readUkDate } from './dates';

describe('formatUkDate', () => {
  it('shows day, month and year in UK order', () => {
    expect(formatUkDate('1995-10-02')).toBe('02/10/1995');
    expect(formatUkDate('1995-10')).toBe('10/1995');
    expect(formatUkDate('1995')).toBe('1995');
  });
});

describe('readUkDate', () => {
  it('reads UK dates and ISO dates', () => {
    expect(readUkDate('2/10/1995')).toBe('1995-10-02');
    expect(readUkDate('02/10/1995')).toBe('1995-10-02');
    expect(readUkDate('10/1995')).toBe('1995-10');
    expect(readUkDate(' 1995 ')).toBe('1995');
    expect(readUkDate('1995-10-02')).toBe('1995-10-02');
  });
  it('rejects dates that do not exist', () => {
    expect(readUkDate('31/02/1995')).toBeUndefined();
    expect(readUkDate('13/1995')).toBeUndefined();
    expect(readUkDate('soon')).toBeUndefined();
    expect(readUkDate('')).toBeUndefined();
  });
});

describe('checkReleaseDate', () => {
  const today = new Date(Date.UTC(2026, 10, 25));
  it('accepts real past dates in UK or ISO form, and an empty field', () => {
    expect(checkReleaseDate('29/03/2005', today)).toEqual({ iso: '2005-03-29' });
    expect(checkReleaseDate('3/2005', today)).toEqual({ iso: '2005-03' });
    expect(checkReleaseDate('2005', today)).toEqual({ iso: '2005' });
    expect(checkReleaseDate('  ', today)).toEqual({});
  });
  it('says what is wrong', () => {
    expect(checkReleaseDate('March 2005', today).error).toMatch(/dd\/mm\/yyyy/);
    expect(checkReleaseDate('31/02/2005', today).error).toMatch(/does not exist/);
    expect(checkReleaseDate('12/13/2005', today).error).toMatch(/does not exist/);
    expect(checkReleaseDate('1850', today).error).toMatch(/from 1900/);
    expect(checkReleaseDate('01/01/2027', today).error).toMatch(/future/);
  });
});
