/**
 * MusicBrainz lookups for the original release date of a song.
 * MusicBrainz allows 1 request each second, so all calls go through one queue.
 *
 * Search scores do not rank the original recording first, so the lookup reads
 * up to MAX_RESULTS matches, keeps those whose title and artist agree, and
 * takes the earliest first-release date.
 */

const API = 'https://musicbrainz.org/ws/2';
const MIN_GAP_MS = 1100;
const PAGE_SIZE = 100;
const MAX_RESULTS = 300;
const MAX_RETRIES = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One queue for all calls, with a fast lane. A search the user waits for goes
// ahead of the background lookups, but still keeps the 1 request each second.
const fastLane: (() => void)[] = [];
const slowLane: (() => void)[] = [];
let lastCall = 0;
let pumping = false;

async function pump() {
  if (pumping) return;
  pumping = true;
  while (fastLane.length || slowLane.length) {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    const job = fastLane.shift() ?? slowLane.shift()!;
    lastCall = Date.now();
    job();
  }
  pumping = false;
}

function throttled<T>(task: () => Promise<T>, urgent = false): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    (urgent ? fastLane : slowLane).push(() => void task().then(resolve, reject));
    void pump();
  });
}

interface MbRecording {
  id: string;
  title: string;
  'first-release-date'?: string;
  'artist-credit'?: { name: string; joinphrase?: string }[];
  releases?: { title: string; status?: string; date?: string }[];
}

/** GET a MusicBrainz URL through the queue. Retries when MusicBrainz is busy. */
async function getJson<T>(path: string, urgent = false): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await throttled(() => fetch(`${API}${path}`, { headers: { Accept: 'application/json' } }), urgent);
    // 503 means "too busy" or "too fast". Wait and try again.
    if (res.status === 503 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('Retry-After'));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 1500 * 2 ** attempt);
      continue;
    }
    if (!res.ok) throw new Error(`MusicBrainz returned ${res.status}`);
    return (await res.json()) as T;
  }
}

async function fetchPage(query: string, offset: number): Promise<{ count: number; recordings: MbRecording[] }> {
  const body = await getJson<{ count?: number; recordings?: MbRecording[] }>(
    `/recording?fmt=json&limit=${PAGE_SIZE}&offset=${offset}&query=${encodeURIComponent(query)}`,
  );
  return { count: body.count ?? 0, recordings: body.recordings ?? [] };
}

interface MbTag {
  name: string;
  count?: number;
}

interface MbArtist {
  id: string;
  name: string;
  score?: number;
  tags?: MbTag[];
  genres?: MbTag[];
}

/**
 * The genres of an artist, with their vote counts. Uses the first artist if
 * the song has several. Falls back to the artist's tags if it has no genres.
 */
export async function lookupArtistGenres(artist: string): Promise<MbTag[]> {
  const name = artist.split(',')[0].trim();
  const search = await getJson<{ artists?: MbArtist[] }>(
    `/artist?fmt=json&limit=10&query=${encodeURIComponent(`artist:"${lucene(name)}"`)}`,
  );
  const match = (search.artists ?? []).find((a) => normalise(a.name) === normalise(name));
  if (!match) return [];
  const full = await getJson<MbArtist>(`/artist/${match.id}?fmt=json&inc=genres`);
  if (full.genres?.length) return full.genres.map((g) => ({ name: g.name, count: g.count }));
  return (match.tags ?? []).map((t) => ({ name: t.name, count: t.count }));
}

async function searchRecordings(query: string): Promise<MbRecording[]> {
  const all: MbRecording[] = [];
  let count = Infinity;
  for (let offset = 0; offset < Math.min(count, MAX_RESULTS); offset += PAGE_SIZE) {
    const page = await fetchPage(query, offset);
    count = page.count;
    all.push(...page.recordings);
    if (page.recordings.length < PAGE_SIZE) break;
  }
  return all;
}

/** Removes the parts that streaming services add to titles, such as "- Remastered 2011". */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s+-\s+.*\b(remaster(ed)?|mono|stereo|single|radio edit|version|edit|mix|live)\b.*$/i, '')
    .replace(/\s*[([][^)\]]*\b(remaster(ed)?|mono|stereo|deluxe|bonus|single version|radio edit)\b[^)\]]*[)\]]/gi, '')
    .trim();
}

/** Lower case, plain apostrophes, no punctuation: for comparing names. */
export function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/&/g, 'and')
    .replace(/[^\p{L}\p{N}' ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escapes Lucene special characters for a MusicBrainz query. */
function lucene(value: string): string {
  return value.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1');
}

/**
 * The earliest date in a list of `yyyy[-mm[-dd]]` strings. If the earliest is
 * only a year or month, and a full date in that year or month exists, the full
 * date is returned, because it is more precise.
 */
export function earliest(dates: (string | undefined)[]): string | undefined {
  const sorted = dates.filter((d): d is string => !!d && /^\d{4}/.test(d)).sort();
  const first = sorted[0];
  if (!first) return undefined;
  return sorted.find((d) => d.startsWith(first) && d.length > first.length) ?? first;
}

/** True if the recording has the same title and an artist credit that agrees with the artist. */
export function isMatch(rec: MbRecording, title: string, artist: string): boolean {
  if (normalise(rec.title) !== normalise(title)) return false;
  // Several artists can be joined with ", ". Any one of them can agree.
  const wanted = artist.split(',').map(normalise).filter(Boolean);
  return (rec['artist-credit'] ?? []).some((c) => {
    const name = normalise(c.name);
    return wanted.some((w) => name.includes(w) || w.includes(name));
  });
}

interface ReleaseLookup {
  date?: string;
  /** How the date was found. */
  matchedBy?: 'isrc' | 'title';
}

/**
 * Finds the first release date of a song from the title and artist, then from
 * the ISRC if that gives nothing. A song often appears again on compilations
 * and remasters, so the lookup takes the earliest date of all matches.
 */
export async function lookupReleaseDate(args: {
  title: string;
  artist: string;
  isrc?: string;
}): Promise<ReleaseLookup> {
  const byTitle = await lookupByTitle(args.title, args.artist);
  if (byTitle) return { date: byTitle, matchedBy: 'title' };
  if (args.isrc) {
    const recs = await searchRecordings(`isrc:${lucene(args.isrc)}`);
    const date = earliest(recs.map((r) => r['first-release-date']));
    if (date) return { date, matchedBy: 'isrc' };
  }
  return {};
}

async function lookupByTitle(title: string, artist: string): Promise<string | undefined> {
  const t = cleanTitle(title);
  const firstArtist = artist.split(',')[0].trim();
  const base = `recording:"${lucene(t)}" AND artist:"${lucene(firstArtist)}"`;
  // Official releases first. Bootlegs and unofficial uploads add noise.
  for (const query of [`${base} AND status:official`, base]) {
    const recs = await searchRecordings(query);
    const date = earliest(recs.filter((r) => isMatch(r, t, artist)).map((r) => r['first-release-date']));
    if (date) return date;
  }
  return undefined;
}

export interface SongResult {
  title: string;
  artist: string;
  /** The title of an official release that holds the song, if MusicBrainz gives one. */
  release?: string;
  /** The earliest first-release date of the matches, `yyyy[-mm[-dd]]`. */
  firstReleaseDate?: string;
}

/** The artist credit as one name, for example "Jay-Z feat. Beyoncé". */
function creditName(rec: MbRecording): string {
  return (rec['artist-credit'] ?? []).map((c) => c.name + (c.joinphrase ?? '')).join('').trim();
}

/**
 * Turns search hits into one row for each song. MusicBrainz lists each
 * recording (single, album, remaster, live) separately, so hits with the same
 * title and artist become one row with the earliest date. The search order stays.
 */
export function groupSongResults(recs: MbRecording[], max = 8): SongResult[] {
  const rows = new Map<string, SongResult>();
  for (const rec of recs) {
    const artist = creditName(rec);
    if (!artist) continue;
    const key = `${normalise(cleanTitle(rec.title))}|${normalise(artist)}`;
    const row = rows.get(key);
    // Use official releases only, when MusicBrainz lists them. Bootlegs and promos often carry wrong, early dates.
    const official = (rec.releases ?? []).filter((r) => r.status === 'Official');
    const date = rec.releases?.length ? earliest(official.map((r) => r.date)) : rec['first-release-date'] || undefined;
    const release = official.find((r) => r.date === date)?.title ?? official[0]?.title;
    if (!row) {
      if (rows.size >= max) continue;
      rows.set(key, { title: cleanTitle(rec.title), artist, release, firstReleaseDate: date });
    } else {
      const first = earliest([row.firstReleaseDate, date]);
      // Show the release that holds the earliest date, which is usually the original.
      if (date && first === date && first !== row.firstReleaseDate) row.release = release ?? row.release;
      else row.release ??= release;
      row.firstReleaseDate = first;
    }
  }
  return [...rows.values()];
}

/**
 * Searches MusicBrainz for a song, for the "Add a song" search. Needs no
 * sign-in. Goes in the fast lane of the queue, ahead of background lookups.
 */
export async function searchSongs(title: string, artist?: string): Promise<SongResult[]> {
  const parts = [`recording:"${lucene(title.trim())}"`];
  if (artist?.trim()) parts.push(`artist:"${lucene(artist.trim())}"`);
  const body = await getJson<{ recordings?: MbRecording[] }>(
    `/recording?fmt=json&limit=50&query=${encodeURIComponent(parts.join(' AND '))}`,
    true,
  );
  return groupSongResults(body.recordings ?? []);
}
