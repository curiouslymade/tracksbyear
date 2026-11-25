/**
 * Share links. The whole shared timeline travels inside the link, after `#share=`.
 * Browsers never send that part to the server, so nothing is stored anywhere.
 * The data is JSON, compressed with deflate and written as base64url.
 *
 * A link can come from anyone, so `decodeShare` checks every field and size
 * before the app uses it.
 */
import { parsePartialDate } from './dates';
import type { SongWithEstimate } from './estimate';
import { GENRES, type GenreFamily } from './genres';
import { songGenre } from './road';
import type { Hint, HintKind, LifePeriod, Song } from './types';

export const SHARE_PREFIX = '#share=';
const MAX_SONGS = 1000;
const MAX_PERIODS = 100;
const MAX_TEXT = 200;
const MAX_LINK_CHARS = 200_000;

interface SharedPeriod {
  n: string;
  pl?: string;
  s: string;
  e: string;
}

interface SharedSong {
  t: string;
  a: string;
  r?: string;
  /** Hint: kind, plus the year or the index of the period. */
  h: [HintKind] | [HintKind, number];
  g?: GenreFamily;
  u?: string;
}

interface SharedTimeline {
  v: 1;
  periods: SharedPeriod[];
  songs: SharedSong[];
}

interface ShareOptions {
  periods: boolean;
  places: boolean;
}

/**
 * The data to share. Leaves out places, and life periods, if the user chooses.
 * A song placed "during" a period that is left out keeps its place as a year.
 */
export function buildShare(items: SongWithEstimate[], periods: LifePeriod[], options: ShareOptions): SharedTimeline {
  const shared = options.periods ? periods : [];
  const index = new Map(shared.map((p, i) => [p.id, i]));
  return {
    v: 1,
    periods: shared.map((p) => ({ n: p.name, ...(options.places && p.place ? { pl: p.place } : {}), s: p.start, e: p.end })),
    songs: items.map(({ song, estimate }) => {
      let h: SharedSong['h'];
      const { hint } = song;
      if (hint.kind === 'period') {
        const i = index.get(hint.periodId);
        h = i !== undefined ? ['period', i] : ['year', estimate.likely.getUTCFullYear()];
      } else if (hint.kind === 'year' && hint.year) h = ['year', hint.year];
      else h = [hint.kind];
      const g = songGenre(song);
      return {
        t: song.title,
        a: song.artist,
        ...(song.releaseDate ? { r: song.releaseDate } : {}),
        h,
        ...(g ? { g } : {}),
        ...(song.spotifyUri ? { u: song.spotifyUri } : {}),
      };
    }),
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeShare(data: SharedTimeline): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(data));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

const HINT_KINDS: HintKind[] = ['onRelease', 'period', 'year'];
/** Answers that older versions wrote. A link that holds one reads it as "When it came out". */
const OLD_HINT_KINDS = ['unknown', 'later'];
const FAMILIES = new Set(GENRES.map((g) => g.id));

const isText = (v: unknown, max = MAX_TEXT): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(v) && !!parsePartialDate(v);

/** Reads a share link. Throws if the data is broken, too large or not what the app writes. */
export async function decodeShare(text: string): Promise<SharedTimeline> {
  if (text.length > MAX_LINK_CHARS || !/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('This share link is not valid.');
  const bytes = await pipe(fromBase64Url(text), new DecompressionStream('deflate-raw'));
  if (bytes.length > 2_000_000) throw new Error('This share link is too large.');
  const data = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SharedTimeline>;

  const periods = Array.isArray(data.periods) ? data.periods : null;
  const songs = Array.isArray(data.songs) ? data.songs : null;
  if (data.v !== 1 || !periods || !songs || periods.length > MAX_PERIODS || songs.length > MAX_SONGS) {
    throw new Error('This share link is not valid.');
  }
  const cleanPeriods: SharedPeriod[] = periods.map((p) => {
    if (!isText(p?.n) || !isDate(p.s) || !isDate(p.e) || (p.pl !== undefined && !isText(p.pl))) throw new Error('This share link is not valid.');
    return { n: p.n, ...(p.pl ? { pl: p.pl } : {}), s: p.s, e: p.e };
  });
  const cleanSongs: SharedSong[] = songs.map((s) => {
    const h = Array.isArray(s?.h) && OLD_HINT_KINDS.includes(s.h[0] as string) ? (['onRelease'] as SharedSong['h']) : s?.h;
    const kindOk = Array.isArray(h) && HINT_KINDS.includes(h[0]);
    const arg = Array.isArray(h) ? h[1] : undefined;
    const argOk =
      !kindOk ||
      (h[0] === 'year' ? Number.isInteger(arg) && arg! >= 1900 && arg! <= 2100 : true) &&
        (h[0] === 'period' ? Number.isInteger(arg) && arg! >= 0 && arg! < cleanPeriods.length : true);
    if (!isText(s?.t) || !isText(s.a) || !kindOk || !argOk) throw new Error('This share link is not valid.');
    if (s.r !== undefined && !isDate(s.r)) throw new Error('This share link is not valid.');
    if (s.g !== undefined && !FAMILIES.has(s.g)) throw new Error('This share link is not valid.');
    if (s.u !== undefined && !/^spotify:track:[A-Za-z0-9]{1,40}$/.test(s.u)) throw new Error('This share link is not valid.');
    return {
      t: s.t,
      a: s.a,
      ...(s.r ? { r: s.r } : {}),
      h: arg === undefined ? [h[0]] : [h[0], arg],
      ...(s.g ? { g: s.g } : {}),
      ...(s.u ? { u: s.u } : {}),
    };
  });
  return { v: 1, periods: cleanPeriods, songs: cleanSongs };
}

/** Turns shared data into songs and life periods for the timeline. They stay in memory only. */
export function fromShare(data: SharedTimeline): { songs: Song[]; periods: LifePeriod[] } {
  const periods: LifePeriod[] = data.periods.map((p, i) => ({ id: i + 1, name: p.n, place: p.pl, start: p.s, end: p.e }));
  const songs: Song[] = data.songs.map((s, i) => {
    const [kind, arg] = s.h;
    const hint: Hint = kind === 'period' ? { kind, periodId: (arg ?? 0) + 1 } : kind === 'year' ? { kind, year: arg } : { kind };
    return {
      id: i + 1,
      title: s.t,
      artist: s.a,
      releaseDate: s.r,
      releaseSource: s.r ? 'musicbrainz' : undefined,
      genreOverride: s.g,
      genreLookup: 'done',
      spotifyUri: s.u,
      hint,
      addedAt: '',
    };
  });
  return { songs, periods };
}

/** The share data in the current address, if there is any. */
export function shareInLocation(hash = typeof location !== 'undefined' ? location.hash : ''): string | undefined {
  return hash.startsWith(SHARE_PREFIX) ? hash.slice(SHARE_PREFIX.length) : undefined;
}
