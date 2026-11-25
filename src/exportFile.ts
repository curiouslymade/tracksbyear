/**
 * Playlist files for the export. Pure functions:
 * a CSV with every detail, and a plain text list that playlist-transfer tools
 * such as TuneMyMusic and Soundiiz can read.
 */
import { formatRange, formatUkDate } from './dates';
import type { TimelineGroup } from './estimate';
import { spotifyLink } from './listen';
import type { Song } from './types';

interface FilePlaylist {
  name: string;
  items: TimelineGroup['items'];
}

/** The playlists to write: one for each life period, or one for the whole timeline. */
export function filePlaylists(groups: TimelineGroup[], mode: 'perPeriod' | 'whole', includeOther: boolean): FilePlaylist[] {
  const chosen = groups.filter((g) => g.items.length > 0 && (includeOther || g.period));
  if (mode === 'whole') return [{ name: 'Tracks by Year', items: chosen.flatMap((g) => g.items) }];
  return chosen.map((g) => ({ name: `Tracks by Year: ${g.period ? g.period.name : 'Other'}`, items: g.items }));
}

/**
 * One CSV cell. Quotes cells with commas, quotes or line breaks. A cell that
 * starts with = + - @ gets a leading apostrophe, so a spreadsheet does not run it as a formula.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const HEADER = ['Playlist', 'Position', 'Title', 'Artist', 'Album', 'Release date', 'First heard', 'Spotify'];

export function toCsv(playlists: FilePlaylist[]): string {
  const rows = [HEADER];
  for (const p of playlists) {
    p.items.forEach(({ song, estimate }, i) => {
      rows.push([
        p.name,
        String(i + 1),
        song.title,
        song.artist,
        song.album ?? '',
        song.releaseDate ? formatUkDate(song.releaseDate) : '',
        formatRange(estimate.from, estimate.to),
        spotifyLink(song),
      ]);
    });
  }
  // The byte order mark lets Excel read accents, such as the é in Beyoncé, correctly.
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const line = (s: Song) => `${s.artist} - ${s.title}`;

/** "Artist - Title" on each line, with a heading for each playlist. */
export function toText(playlists: FilePlaylist[]): string {
  return playlists.map((p) => [p.name, ...p.items.map((i) => line(i.song))].join('\n')).join('\n\n') + '\n';
}

/** Starts a download of the text or file in the browser. */
export function download(filename: string, content: string | Blob, type: string): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: `${type};charset=utf-8` }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
