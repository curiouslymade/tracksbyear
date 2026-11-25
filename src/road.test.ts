import { describe, expect, it } from 'vitest';
import { estimateHearing } from './estimate';
import {
  backdropGradient,
  CARD_WIDTH,
  EDGE_PAD,
  genreSegments,
  lowestZoom,
  makeScale,
  placePeriods,
  placeSongs,
  PX_PER_YEAR,
  songGenre,
  spreadGuesses,
} from './road';
import type { SongWithEstimate } from './estimate';
import type { LifePeriod, Song } from './types';

const TODAY = new Date(Date.UTC(2026, 10, 23));

function item(title: string, year: number, genres?: string[]) {
  const song: Song = {
    title,
    artist: 'A',
    releaseDate: `${year}`,
    hint: { kind: 'year', year },
    genres: genres?.map((name) => ({ name, count: 5 })),
    addedAt: '2026-11-23',
  };
  return { song, estimate: estimateHearing(song, [], TODAY) };
}

describe('makeScale', () => {
  it('starts one year before the first song and runs to the current year', () => {
    const s = makeScale([item('a', 1995), item('b', 2004)], [], TODAY);
    expect(s.startYear).toBe(1994);
    expect(s.endYear).toBe(2027);
    expect(s.width).toBeLessThan(33 * PX_PER_YEAR + EDGE_PAD * 2);
  });
  it('stops a little after today, so nothing can sit in the future', () => {
    const s = makeScale([item('a', 1995), item('b', 2004)], [], TODAY);
    expect(s.width).toBe(Math.ceil(s.x(TODAY) + EDGE_PAD));
  });
  it('zooms: a year takes the width that the caller gives', () => {
    const s = makeScale([item('a', 1995), item('b', 2004)], [], TODAY, 60);
    expect(s.width).toBe(Math.ceil(s.x(TODAY) + EDGE_PAD));
    expect(s.x(new Date(Date.UTC(1996, 0, 1))) - s.x(new Date(Date.UTC(1995, 0, 1)))).toBeCloseTo(60);
  });
  it('never gets narrower than the screen: it fills it when zoomed out', () => {
    const s = makeScale([item('a', 1995), item('b', 2004)], [], TODAY, 60, 3000);
    expect(s.width).toBeGreaterThanOrEqual(3000);
    expect(s.pxPerYear).toBeCloseTo(s.fitPxPerYear);
    expect(lowestZoom(s.fitPxPerYear)).toBe(0);
    expect(lowestZoom(130)).toBe(1);
  });
  it('stops a life period at today, also when it ends in the future', () => {
    const s = makeScale([item('a', 1995)], [], TODAY);
    const [p] = placePeriods([{ id: 1, name: 'Now', start: '2025-01-01', end: '2030-12-31' }], s);
    expect(p.endX).toBeCloseTo(s.todayX);
  });
  it('is at least six years wide', () => {
    const s = makeScale([item('a', 2000)], [], TODAY);
    expect(s.endYear - s.startYear).toBeGreaterThanOrEqual(6);
  });
  it('maps dates to x and back', () => {
    const s = makeScale([item('a', 2000)], [], TODAY);
    const x = s.x(new Date(Date.UTC(2001, 0, 1)));
    expect(s.yearAt(x)).toBeCloseTo(2001, 5);
  });
});

describe('genreSegments', () => {
  it('changes colour with the main genre of each era', () => {
    const items = [
      item('a', 1995, ['britpop']),
      item('b', 1996, ['britpop']),
      item('c', 2003, ['house']),
      item('d', 2004, ['techno']),
    ];
    const s = makeScale(items, [], TODAY);
    const segs = genreSegments(items, s);
    const genres = segs.map((x) => x.genre);
    expect(genres).toContain('indie');
    expect(genres).toContain('electronic');
    expect(genres.indexOf('indie')).toBeLessThan(genres.indexOf('electronic'));
    expect(segs[0].startX).toBe(0);
    expect(segs.at(-1)!.endX).toBe(s.width);
  });
  it('leaves years with no songs near them without a genre', () => {
    const items = [item('a', 1990, ['rock']), item('b', 2010, ['pop'])];
    const segs = genreSegments(items, makeScale(items, [], TODAY));
    expect(segs.some((x) => x.genre === undefined)).toBe(true);
  });
  it('makes a gradient with two stops for each segment', () => {
    const items = [item('a', 1995, ['britpop'])];
    const s = makeScale(items, [], TODAY);
    const g = backdropGradient(genreSegments(items, s), s.width);
    expect(g.startsWith('linear-gradient(90deg,')).toBe(true);
  });
});

describe('songGenre', () => {
  it('uses the user choice first', () => {
    const i = item('a', 1995, ['britpop']);
    expect(songGenre(i.song)).toBe('indie');
    expect(songGenre({ ...i.song, genreOverride: 'pop' })).toBe('pop');
  });
});

describe('placeSongs', () => {
  it('never lets two cards overlap in the same lane', () => {
    const items = Array.from({ length: 12 }, (_, i) => item(`s${i}`, 2000 + (i % 3)));
    const { placed } = placeSongs(items, makeScale(items, [], TODAY));
    for (const a of placed) {
      for (const b of placed) {
        if (a === b || a.side !== b.side || a.lane !== b.lane) continue;
        expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(CARD_WIDTH);
      }
    }
  });
  it('uses the lanes nearest the road first', () => {
    const items = [item('a', 1995), item('b', 2005)];
    const { placed } = placeSongs(items, makeScale(items, [], TODAY));
    expect(placed.every((p) => p.lane === 0 && p.side === 'above')).toBe(true);
  });
});

describe('song bundles', () => {
  it('puts songs that do not fit in five rows on each side into one bundle', () => {
    const items = Array.from({ length: 25 }, (_, i) => item(`s${i}`, 2017));
    const { placed, bundles } = placeSongs(items, makeScale(items, [], TODAY));
    expect(placed).toHaveLength(10);
    expect(placed.every((p) => p.lane < 5)).toBe(true);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].items).toHaveLength(15);
    expect(bundles[0].lane).toBe(5);
  });
  it('keeps songs far apart out of the same bundle', () => {
    const items = [
      ...Array.from({ length: 14 }, (_, i) => item(`a${i}`, 2001)),
      ...Array.from({ length: 14 }, (_, i) => item(`b${i}`, 2015)),
    ];
    const { bundles } = placeSongs(items, makeScale(items, [], TODAY));
    expect(bundles.map((b) => b.items.length)).toEqual([4, 4]);
  });
});

describe('placePeriods', () => {
  it('puts overlapping periods in different lanes', () => {
    const periods: LifePeriod[] = [
      { id: 1, name: 'School', start: '1995-09-01', end: '2002-07-31' },
      { id: 2, name: 'Band', start: '2000-01-01', end: '2003-01-01' },
      { id: 3, name: 'London', start: '2005-01-01', end: '2010-01-01' },
    ];
    const placed = placePeriods(periods, makeScale([], periods, TODAY));
    const lane = (n: string) => placed.find((p) => p.period.name === n)!.lane;
    expect(lane('School')).toBe(0);
    expect(lane('Band')).toBe(1);
    expect(lane('London')).toBe(0);
  });
});

describe('spreadGuesses', () => {
  const guess = (title: string, releaseDate: string, confidence = 0.2) => {
    const from = new Date(Date.UTC(2007, 8, 1));
    const to = new Date(Date.UTC(2026, 10, 23));
    return {
      song: { id: Number(releaseDate.slice(0, 4)), title, artist: 'A', releaseDate, hint: { kind: 'onRelease' }, addedAt: '' },
      estimate: { from, to, likely: new Date(Date.UTC(2017, 3, 1)), confidence, label: 'Low', reason: '' },
    } as SongWithEstimate;
  };
  it('spreads songs with the same wide guess across the window, oldest release first', () => {
    const out = spreadGuesses([guess('C', '2004-01-01'), guess('A', '2000-01-01'), guess('B', '2002-01-01')]);
    const years = Object.fromEntries(out.map((i) => [i.song.title, i.estimate.likely.getUTCFullYear()]));
    expect(years.A).toBeLessThan(years.B);
    expect(years.B).toBeLessThan(years.C);
    expect(new Set(out.map((i) => i.estimate.likely.getTime())).size).toBe(3);
    for (const i of out) {
      expect(i.estimate.likely.getTime()).toBeGreaterThan(i.estimate.from.getTime());
      expect(i.estimate.likely.getTime()).toBeLessThan(i.estimate.to.getTime());
    }
  });
  it('leaves firm placements and single guesses alone', () => {
    const firm = [guess('A', '2000-01-01', 0.9), guess('B', '2001-01-01', 0.9)];
    expect(spreadGuesses(firm)).toBe(firm);
    const single = [guess('A', '2000-01-01')];
    expect(spreadGuesses(single)[0].estimate.likely.getUTCFullYear()).toBe(2017);
  });
});
