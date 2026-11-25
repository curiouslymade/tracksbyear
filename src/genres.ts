/**
 * Broad genre families. Each family has a backdrop colour for the road.
 * All backdrops are dark, so Night text from Two Moons holds contrast on them.
 */

export type GenreFamily =
  | 'rock'
  | 'pop'
  | 'indie'
  | 'electronic'
  | 'hiphop'
  | 'soul'
  | 'metal'
  | 'punk'
  | 'folk'
  | 'jazz'
  | 'classical'
  | 'reggae';

interface GenreInfo {
  id: GenreFamily;
  label: string;
  /** Backdrop colour behind the road. */
  backdrop: string;
  /** Lighter tone for markers and the legend. */
  accent: string;
  /** Words that identify the family in a MusicBrainz genre name. */
  keys: string[];
}

/** In matching order: the first family with a key in a genre name wins for that name. */
export const GENRES: GenreInfo[] = [
  { id: 'metal', label: 'Metal', backdrop: '#2b2321', accent: '#b9a79c', keys: ['metal', 'metalcore', 'doom', 'thrash', 'sludge'] },
  { id: 'punk', label: 'Punk', backdrop: '#4a1f24', accent: '#e58a8f', keys: ['punk', 'hardcore', 'oi'] },
  { id: 'hiphop', label: 'Hip hop', backdrop: '#4a3d14', accent: '#e6c25a', keys: ['hip hop', 'hip-hop', 'rap', 'grime', 'trap', 'drill', 'boom bap'] },
  { id: 'soul', label: 'Soul & R&B', backdrop: '#4b2236', accent: '#e39ac0', keys: ['r&b', 'rnb', 'soul', 'funk', 'disco', 'motown', 'gospel', 'neo soul', 'contemporary r&b'] },
  { id: 'jazz', label: 'Jazz & blues', backdrop: '#1f2d48', accent: '#9fb7e6', keys: ['jazz', 'blues', 'swing', 'bebop', 'big band'] },
  { id: 'classical', label: 'Classical', backdrop: '#35304d', accent: '#c4b8f0', keys: ['classical', 'opera', 'baroque', 'orchestral', 'romantic', 'chamber', 'symphony', 'film score', 'soundtrack'] },
  { id: 'electronic', label: 'Electronic', backdrop: '#173f47', accent: '#8fd3da', keys: ['electronic', 'electronica', 'house', 'techno', 'trance', 'drum and bass', 'jungle', 'dubstep', 'edm', 'ambient', 'idm', 'electro', 'dance', 'garage', 'big beat', 'trip hop', 'synthwave', 'breakbeat', 'eurodance'] },
  { id: 'reggae', label: 'Reggae & world', backdrop: '#1f4029', accent: '#93d0a6', keys: ['reggae', 'ska', 'dub', 'dancehall', 'afrobeat', 'afrobeats', 'latin', 'salsa', 'reggaeton', 'world'] },
  { id: 'folk', label: 'Folk & country', backdrop: '#4b3820', accent: '#e3bf8a', keys: ['folk', 'country', 'americana', 'bluegrass', 'singer-songwriter', 'acoustic'] },
  { id: 'indie', label: 'Indie & alternative', backdrop: '#2e3a26', accent: '#b8cf98', keys: ['indie', 'alternative', 'britpop', 'shoegaze', 'emo', 'post-rock', 'post-punk', 'new wave', 'grunge', 'madchester', 'lo-fi'] },
  { id: 'pop', label: 'Pop', backdrop: '#552a52', accent: '#e5a9e0', keys: ['pop', 'k-pop', 'synth-pop', 'synthpop', 'dance-pop', 'teen pop', 'europop'] },
  { id: 'rock', label: 'Rock', backdrop: '#58291b', accent: '#f09a74', keys: ['rock', 'rock and roll', "rock 'n' roll", 'hard rock', 'glam', 'psychedelic'] },
];

/** The backdrop where no genre is known: the Two Moons umber. */
export const NO_GENRE_BACKDROP = '#413329';
export const NO_GENRE_ACCENT = '#edb98a';

const BY_ID = new Map(GENRES.map((g) => [g.id, g]));

export function genreInfo(id: GenreFamily | undefined): GenreInfo | undefined {
  return id ? BY_ID.get(id) : undefined;
}

function hasKey(name: string, key: string): boolean {
  // Match whole words, so "dub" does not match "dubstep" and "pop" does not match "popcorn".
  const padded = ` ${name.toLowerCase().replace(/[^a-z0-9&'+]+/g, ' ').trim()} `;
  const k = ` ${key.toLowerCase().replace(/[^a-z0-9&'+]+/g, ' ').trim()} `;
  return padded.includes(k);
}

/** The family for one genre name, such as "britpop" or "alternative rock". */
export function familyOf(name: string): GenreFamily | undefined {
  return GENRES.find((g) => g.keys.some((k) => hasKey(name, k)))?.id;
}

interface RawGenre {
  name: string;
  count?: number;
}

/** The main family of a list of genres, weighted by the number of votes each genre has. */
export function familyFromGenres(genres: RawGenre[] | undefined): GenreFamily | undefined {
  if (!genres?.length) return undefined;
  const scores = new Map<GenreFamily, number>();
  for (const g of genres) {
    const f = familyOf(g.name);
    if (f) scores.set(f, (scores.get(f) ?? 0) + Math.max(1, g.count ?? 1));
  }
  let best: GenreFamily | undefined;
  let bestScore = 0;
  // Ties go to the family that comes first in GENRES, the more specific one.
  for (const g of GENRES) {
    const s = scores.get(g.id) ?? 0;
    if (s > bestScore) {
      best = g.id;
      bestScore = s;
    }
  }
  return best;
}
