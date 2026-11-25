import { useState } from 'react';
import { deleteSong, lookUp, setGenreOverride, setHint, setReleaseDate } from '../actions';
import { checkReleaseDate, formatUkDate } from '../dates';
import type { SongWithEstimate } from '../estimate';
import { familyFromGenres, GENRES, genreInfo, type GenreFamily } from '../genres';
import type { LifePeriod, Song } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { HintPicker } from './HintPicker';
import { listenLink, playerName, type Player } from '../listen';
import { PencilIcon, PlayIcon, TrashIcon } from './Icons';

/** The song details, in this order: genre, release date, when the user first heard it. */
export function SongDetails({ item, periods }: { item: SongWithEstimate; periods: LifePeriod[] }) {
  const { song } = item;
  const id = song.id!;

  return (
    <div className="stack-5">
      <GenrePicker song={song} />
      <ReleaseDate song={song} />
      <HintPicker hint={song.hint} periods={periods} releaseDate={song.releaseDate} onChange={(h) => void setHint(id, h)} />
    </div>
  );
}

/** A play button for the modal header, beside the title. */
export function PlaySongButton({ song, player }: { song: Song; player: Player }) {
  return (
    <a
      className="card__play modal__play"
      href={listenLink(song, player)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Play ${song.title} in ${playerName(player)}`}
      title={`Play in ${playerName(player)}`}
    >
      <PlayIcon />
    </a>
  );
}

/** A bin icon for the modal header. It asks before it deletes. */
export function DeleteSongButton({ song, onDeleted }: { song: Song; onDeleted: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <button className="modal__close" aria-label={`Delete ${song.title}`} title="Delete this song" onClick={() => setAsking(true)}>
        <TrashIcon />
      </button>
      {asking && (
        <ConfirmDialog
          title={`Delete "${song.title}"?`}
          message="It goes from your timeline. You cannot undo this."
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            void deleteSong(song.id!);
            onDeleted();
          }}
        />
      )}
    </>
  );
}

function ReleaseDate({ song }: { song: Song }) {
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);
  // The message shows after the user leaves the field or tries to save, then follows each key.
  const [touched, setTouched] = useState(false);
  const id = song.id!;
  const { iso, error } = checkReleaseDate(value, new Date());
  const showError = touched && !!error;

  let shown: string;
  if (song.lookup === 'pending') shown = 'Looking it up…';
  else if (song.releaseDate) shown = formatUkDate(song.releaseDate);
  else shown = 'Not known';

  return (
    <div className="tm-field">
      <span className="tm-field__label">Release date</span>
      {editing ? (
        <form
          className="row row--center"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (error) return;
            void setReleaseDate(id, iso);
            setEditing(false);
          }}
        >
          <input
            className="tm-input grow"
            aria-label="Release date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="dd/mm/yyyy"
            inputMode="numeric"
            maxLength={10}
            aria-invalid={showError}
            aria-describedby={showError ? 'release-date-error' : undefined}
            onBlur={() => setTouched(true)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setEditing(false);
              }
            }}
          />
          <button className="tm-btn tm-btn--primary" type="submit">
            Save
          </button>
          <button
            className="tm-btn"
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="value-row">
          <span>{shown}</span>
          <button
            className="icon-chip"
            aria-label="Change the release date"
            title="Change"
            onClick={() => {
              setValue(song.releaseDate ? formatUkDate(song.releaseDate) : '');
              setTouched(false);
              setEditing(true);
            }}
          >
            <PencilIcon />
          </button>
          {(song.lookup === 'failed' || song.lookup === 'notFound') && (
            <button className="tm-btn tm-btn--quiet tm-btn--sm" onClick={() => void lookUp(id)}>
              Look it up again
            </button>
          )}
        </div>
      )}
      {editing && showError && (
        <p id="release-date-error" className="tm-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function GenrePicker({ song }: { song: Song }) {
  const id = song.id!;
  const found = familyFromGenres(song.genres);
  const auto =
    song.genreLookup === 'pending' ? 'Looking it up…' : found ? `${genreInfo(found)!.label} (automatic)` : 'Not known';

  return (
    <label className="tm-field">
      <span className="tm-field__label">Genre</span>
      <select
        className="tm-input"
        value={song.genreOverride ?? ''}
        onChange={(e) => void setGenreOverride(id, (e.target.value || undefined) as GenreFamily | undefined)}
      >
        <option value="">{auto}</option>
        {GENRES.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
          </option>
        ))}
      </select>
    </label>
  );
}
