import { db } from './db';
import type { GenreFamily } from './genres';
import { earliest, lookupArtistGenres, lookupReleaseDate, normalise } from './musicbrainz';
import type { Hint, LifePeriod, Song } from './types';

export async function addPeriod(period: Omit<LifePeriod, 'id'>): Promise<void> {
  await db.periods.add(period);
}

/** Changes the name, place or dates of a life period. Songs placed in it move with it. */
export async function updatePeriod(id: number, changes: Omit<LifePeriod, 'id'>): Promise<void> {
  await db.periods.update(id, { ...changes, place: changes.place || undefined });
}

/**
 * Deletes a life period. Songs placed "during" it keep their place: they change
 * to "In a year", with the middle year of the period.
 */
export async function deletePeriod(id: number): Promise<void> {
  await db.transaction('rw', db.periods, db.songs, async () => {
    const period = await db.periods.get(id);
    await db.periods.delete(id);
    const start = Number(period?.start.slice(0, 4));
    const end = Number(period?.end.slice(0, 4));
    const year = Number.isFinite(start) && Number.isFinite(end) ? Math.round((start + end) / 2) : undefined;
    await db.songs
      .filter((s) => s.hint.kind === 'period' && s.hint.periodId === id)
      .modify((s) => {
        s.hint = year ? { kind: 'year', year } : { kind: 'onRelease' };
      });
  });
}

/**
 * Adds a song. Looks up its genres on MusicBrainz in the background, and its
 * release date too if the user did not type one.
 */
export async function addSong(
  song: Omit<Song, 'id' | 'addedAt' | 'lookup' | 'genreLookup'>,
): Promise<number> {
  const needsDate = song.releaseSource !== 'manual';
  const id = (await db.songs.add({
    ...song,
    addedAt: new Date().toISOString(),
    lookup: needsDate ? 'pending' : undefined,
    genreLookup: 'pending',
  })) as number;
  void (async () => {
    if (needsDate) await lookUp(id);
    await lookUpGenres(id);
  })();
  return id;
}

/** Gets the original release date from MusicBrainz. Keeps the Spotify date if MusicBrainz has none. */
export async function lookUp(id: number): Promise<void> {
  const song = await db.songs.get(id);
  if (!song) return;
  await db.songs.update(id, { lookup: 'pending' });
  try {
    const result = await lookupReleaseDate(song);
    const current = await db.songs.get(id);
    // The user may have typed a date while the lookup ran. Their date wins.
    if (!current || current.releaseSource === 'manual') {
      if (current) await db.songs.update(id, { lookup: undefined });
      return;
    }
    if (result.date) {
      // Keep a Spotify date if it is earlier: MusicBrainz data can be incomplete.
      // A date from the search is only a first guess, so the full lookup replaces it.
      const date = current.releaseSource === 'spotify' ? earliest([result.date, current.releaseDate]) : result.date;
      const source = date === current.releaseDate && date !== result.date ? current.releaseSource : 'musicbrainz';
      await db.songs.update(id, { releaseDate: date, releaseSource: source, lookup: 'found' });
    } else {
      await db.songs.update(id, { lookup: 'notFound' });
    }
  } catch {
    await db.songs.update(id, { lookup: 'failed' });
  }
}

/** Gets the artist's genres from MusicBrainz. Reuses the genres of another song by the same artist. */
async function lookUpGenres(id: number): Promise<void> {
  const song = await db.songs.get(id);
  if (!song) return;
  await db.songs.update(id, { genreLookup: 'pending' });
  try {
    const key = normalise(song.artist);
    const known = await db.songs
      .filter((s) => s.id !== id && s.genreLookup === 'done' && normalise(s.artist) === key)
      .first();
    const genres = known?.genres ?? (await lookupArtistGenres(song.artist));
    await db.songs.update(id, { genres, genreLookup: 'done' });
  } catch {
    await db.songs.update(id, { genreLookup: 'failed' });
  }
}

/** Restarts lookups that a page reload stopped, and gets genres for songs added before genres existed. */
export async function resumeLookups(): Promise<void> {
  const songs = await db.songs.toArray();
  void (async () => {
    for (const s of songs) {
      if (s.lookup === 'pending') await lookUp(s.id!);
      if (s.genreLookup === undefined || s.genreLookup === 'pending') await lookUpGenres(s.id!);
    }
  })();
}

export async function setHint(id: number, hint: Hint): Promise<void> {
  await db.songs.update(id, { hint });
}

export async function setGenreOverride(id: number, genre: GenreFamily | undefined): Promise<void> {
  await db.songs.update(id, { genreOverride: genre });
}

export async function setReleaseDate(id: number, releaseDate: string | undefined): Promise<void> {
  await db.songs.update(id, {
    releaseDate,
    releaseSource: releaseDate ? 'manual' : undefined,
    lookup: undefined,
  });
}


export async function deleteSong(id: number): Promise<void> {
  await db.songs.delete(id);
}
