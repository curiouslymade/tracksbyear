import { describe, expect, it } from 'vitest';
import type { SongWithEstimate } from './estimate';
import { CARD_H, cardFooter, cardSummary, pickRows } from './shareCard';

const item = (n: number, year: number, genre?: 'indie' | 'pop') => {
  const d = new Date(Date.UTC(year, 5, 1));
  return {
    song: { id: n, title: `Song ${n}`, artist: 'A', genreOverride: genre, hint: { kind: 'onRelease' }, addedAt: '' },
    estimate: { from: d, to: d, likely: d, confidence: 0.5, label: 'Medium', reason: '' },
  } as SongWithEstimate;
};

describe('pickRows', () => {
  it('keeps every song when there are few', () => {
    expect(pickRows([item(2, 2001), item(1, 1995)]).map((i) => i.song.id)).toEqual([1, 2]);
  });
  it('picks evenly, with the first and the last, when there are many', () => {
    const many = Array.from({ length: 25 }, (_, i) => item(i, 1990 + i));
    const rows = pickRows(many, 10);
    expect(rows).toHaveLength(10);
    expect(rows[0].song.id).toBe(0);
    expect(rows.at(-1)!.song.id).toBe(24);
  });
});

describe('cardSummary', () => {
  it('gives the count, the years and the main genre', () => {
    expect(cardSummary([item(1, 1995, 'indie'), item(2, 1997, 'indie'), item(3, 2004, 'pop')])).toBe(
      '3 songs · 1995 to 2004 · mostly Indie & alternative',
    );
  });
});

describe('the card', () => {
  it('is 1080 by 1440, the 3:4 shape of an Instagram post', () => {
    expect(1080 / CARD_H).toBe(3 / 4);
  });
  it('gives the address in the footer', () => {
    expect(cardFooter('tracksbyear.curiouslymade.dev').join('')).toBe('Make your own at tracksbyear.curiouslymade.dev');
  });
});
