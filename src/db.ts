import Dexie, { type EntityTable } from 'dexie';
import type { LifePeriod, Song } from './types';

// The database keeps its first name, so saved songs stay when the app name changes.
export const db = new Dexie('music-timeline') as Dexie & {
  periods: EntityTable<LifePeriod, 'id'>;
  songs: EntityTable<Song, 'id'>;
};

db.version(1).stores({
  periods: '++id, start, end',
  songs: '++id, artist, title, spotifyUri, addedAt',
});

// Version 2: the old answers "Not sure" and "Years later" become "When it came out".
db.version(2)
  .stores({
    periods: '++id, start, end',
    songs: '++id, artist, title, spotifyUri, addedAt',
  })
  .upgrade((tx) =>
    tx
      .table('songs')
      .toCollection()
      .modify((song: { hint: { kind: string } }) => {
        if (song.hint.kind === 'unknown' || song.hint.kind === 'later') song.hint = { kind: 'onRelease' };
      }),
  );
