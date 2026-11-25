import type { GenreFamily } from './genres';

/** A date range the user defines, such as "University, Leeds". Dates are ISO `yyyy-mm-dd`. */
export interface LifePeriod {
  id?: number;
  name: string;
  place?: string;
  start: string;
  end: string;
}

/**
 * What the user remembers about when they first heard a song.
 * - unknown: no memory, so the app guesses from the release date.
 * - onRelease: heard it when it was new.
 * - period: heard it first during a given life period.
 * - later: an older song, heard some time after release.
 * - year: the user knows the year.
 */
/** When the user first heard a song: when it came out, during a life period, or in a year. */
export type HintKind = 'onRelease' | 'period' | 'year';

export interface Hint {
  kind: HintKind;
  periodId?: number;
  year?: number;
}

type ReleaseSource = 'musicbrainz' | 'spotify' | 'manual';

export interface Song {
  id?: number;
  title: string;
  artist: string;
  album?: string;
  spotifyUri?: string;
  isrc?: string;
  /** `yyyy`, `yyyy-mm` or `yyyy-mm-dd`. */
  releaseDate?: string;
  releaseSource?: ReleaseSource;
  /** State of the MusicBrainz release date lookup. */
  lookup?: 'pending' | 'found' | 'notFound' | 'failed';
  /** Genres of the artist from MusicBrainz, with vote counts. */
  genres?: { name: string; count?: number }[];
  /** State of the MusicBrainz genre lookup. */
  genreLookup?: 'pending' | 'done' | 'failed';
  /** A genre family the user chose. It wins over the MusicBrainz genres. */
  genreOverride?: GenreFamily;
  hint: Hint;
  addedAt: string;
}

export type ConfidenceLabel = 'High' | 'Medium' | 'Low';

/** The likely date range in which the user first heard a song. */
export interface HearingEstimate {
  from: Date;
  to: Date;
  likely: Date;
  confidence: number;
  label: ConfidenceLabel;
  reason: string;
  conflict?: string;
}
