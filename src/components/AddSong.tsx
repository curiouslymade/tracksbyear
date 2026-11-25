import { useState, type FormEvent } from 'react';
import { addSong } from '../actions';
import { checkReleaseDate, formatUkDate, readUkDate } from '../dates';
import { DateWheels, useTouchScreen } from './DateWheels';
import { searchSongs, type SongResult } from '../musicbrainz';
import type { Hint, LifePeriod } from '../types';
import { HintPicker } from './HintPicker';

export function AddSong({ periods }: { periods: LifePeriod[] }) {
  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [hint, setHint] = useState<Hint>({ kind: 'onRelease' });

  return (
    <div className="stack-6">
      <HintPicker hint={hint} periods={periods} onChange={setHint} />

      <div className="switch" role="tablist" aria-label="How to add a song">
        <button role="tab" aria-selected={mode === 'search'} onClick={() => setMode('search')}>
          Search
        </button>
        <button role="tab" aria-selected={mode === 'manual'} onClick={() => setMode('manual')}>
          Type it in
        </button>
      </div>

      {mode === 'search' ? <SongSearch hint={hint} /> : <ManualEntry hint={hint} />}
      <p className="modal__fine">The app gets the original release date and the genre from MusicBrainz.</p>
    </div>
  );
}

const yearOf = (date?: string) => date?.slice(0, 4);

/** Searches MusicBrainz. Works for everyone, with no sign-in. */
function SongSearch({ hint }: { hint: Hint }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [results, setResults] = useState<SongResult[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const keyOf = (r: SongResult) => `${r.title}|${r.artist}`;

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Enter the name of the song.');
    setBusy(true);
    setError(undefined);
    try {
      setResults(await searchSongs(title, artist));
    } catch {
      setError('MusicBrainz did not answer. It can be busy, so try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const add = async (r: SongResult) => {
    await addSong({
      title: r.title,
      artist: r.artist,
      album: r.release,
      releaseDate: r.firstReleaseDate,
      releaseSource: r.firstReleaseDate ? 'musicbrainz' : undefined,
      hint,
    });
    setAdded((s) => new Set(s).add(keyOf(r)));
  };

  return (
    <div className="stack-4">
      <form onSubmit={search} className="stack-4">
        <div className="row">
          <label className="tm-field">
            <span className="tm-field__label">Song</span>
            <input className="tm-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wonderwall" />
          </label>
          <label className="tm-field">
            <span className="tm-field__label">Artist (optional)</span>
            <input className="tm-input" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Oasis" />
          </label>
        </div>
        <div>
          <button type="submit" className="tm-btn tm-btn--primary" disabled={busy}>
            {busy ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>
      {error && <p className="tm-field__error">{error}</p>}
      {results && results.length === 0 && (
        <p className="modal__fine">No matches. Check the spelling, add the artist, or type the song in.</p>
      )}
      {results && results.length > 0 && (
        <ul className="ruled-list">
          {results.map((r) => (
            <li key={keyOf(r)}>
              <div className="grow">
                <div className="ruled-list__title">{r.title}</div>
                <div className="ruled-list__muted">
                  {[r.artist, yearOf(r.firstReleaseDate), r.release].filter(Boolean).join(' · ')}
                </div>
              </div>
              <button className="tm-btn tm-btn--sm" onClick={() => void add(r)} disabled={added.has(keyOf(r))}>
                {added.has(keyOf(r)) ? 'Added' : 'Add'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ManualEntry({ hint }: { hint: Hint }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [released, setReleased] = useState('');
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const touch = useTouchScreen();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) return setError('Enter a title and an artist.');
    const { iso: date, error: dateError } = checkReleaseDate(released, new Date());
    if (dateError) return setError(dateError);
    await addSong({
      title: title.trim(),
      artist: artist.trim(),
      releaseDate: date,
      releaseSource: date ? 'manual' : undefined,
      hint,
    });
    setDone(`Added "${title.trim()}".`);
    setTitle('');
    setArtist('');
    setReleased('');
    setError(undefined);
  };

  return (
    <form onSubmit={submit} className="stack-4">
      <label className="tm-field">
        <span className="tm-field__label">Title</span>
        <input className="tm-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="tm-field">
        <span className="tm-field__label">Artist</span>
        <input className="tm-input" value={artist} onChange={(e) => setArtist(e.target.value)} />
      </label>
      {touch ? (
        <DateWheels
          label="Release date (optional)"
          mode="partial"
          value={readUkDate(released) ?? ''}
          onChange={(iso) => setReleased(iso ? formatUkDate(iso) : '')}
          fromYear={1900}
          toYear={new Date().getUTCFullYear()}
        />
      ) : (
        <label className="tm-field">
          <span className="tm-field__label">Release date (optional)</span>
          <input
            className="tm-input"
            value={released}
            onChange={(e) => setReleased(e.target.value)}
            placeholder="dd/mm/yyyy, or leave empty to look it up"
          />
        </label>
      )}
      {error && <p className="tm-field__error">{error}</p>}
      {done && !error && <p className="modal__fine" role="status">{done}</p>}
      <div>
        <button type="submit" className="tm-btn tm-btn--primary">
          Add song
        </button>
      </div>
    </form>
  );
}
