import { useState, type FormEvent } from 'react';
import { addPeriod, deletePeriod, updatePeriod } from '../actions';
import { formatRange, parsePartialDate } from '../dates';
import type { LifePeriod } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { DateWheels, useTouchScreen } from './DateWheels';
import { PencilIcon, TrashIcon } from './Icons';

/** The life periods: a list with edit and delete, and one form to add or edit a period. */
export function LifePeriods({ periods }: { periods: LifePeriod[] }) {
  const [editing, setEditing] = useState<number>();
  const [deleting, setDeleting] = useState<LifePeriod>();
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string>();
  const touch = useTouchScreen();
  const lastYear = new Date().getUTCFullYear() + 10;

  const fill = (p?: LifePeriod) => {
    setEditing(p?.id);
    setName(p?.name ?? '');
    setPlace(p?.place ?? '');
    // The date fields need yyyy-mm-dd. Shorter dates get the first day.
    setStart(p ? fullDate(p.start, 'start') : '');
    setEnd(p ? fullDate(p.end, 'end') : '');
    setError(undefined);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !start || !end) return setError('Enter a name, a start date and an end date.');
    if (end < start) return setError('The end date must be after the start date.');
    const period = { name: name.trim(), place: place.trim() || undefined, start, end };
    if (editing !== undefined) await updatePeriod(editing, period);
    else await addPeriod(period);
    fill(undefined);
  };

  return (
    <div className="stack-6">
      <p className="modal__lead">
        Times of your life, such as school, university or a city you lived in. They show as coloured lines on the timeline. Periods can
        overlap.
      </p>

      {periods.length > 0 && (
        <ul className="ruled-list">
          {periods.map((p) => (
            <li key={p.id} className={editing === p.id ? 'ruled-list__row--editing' : undefined}>
              <div>
                <span className="ruled-list__title">{p.name}</span>
                {p.place && <span className="ruled-list__muted"> · {p.place}</span>}
                <div className="ruled-list__muted">
                  {formatRange(parsePartialDate(p.start)!, parsePartialDate(p.end)!)}
                </div>
              </div>
              <button className="icon-chip" aria-label={`Edit ${p.name}`} title="Edit" onClick={() => fill(p)}>
                <PencilIcon />
              </button>
              <button
                className="icon-chip"
                aria-label={`Delete ${p.name}`}
                title="Delete"
                onClick={() => setDeleting(p)}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete "${deleting.name}"?`}
          message="Songs you placed in it keep their year."
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => {
            if (editing === deleting.id) fill(undefined);
            void deletePeriod(deleting.id!);
            setDeleting(undefined);
          }}
        />
      )}

      <form onSubmit={submit} className="stack-4">
        <h3 className="modal__subhead">{editing !== undefined ? 'Edit life period' : 'Add a life period'}</h3>
        <label className="tm-field">
          <span className="tm-field__label">Name</span>
          <input className="tm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="University" />
        </label>
        <label className="tm-field">
          <span className="tm-field__label">Place (optional)</span>
          <input className="tm-input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Leeds" />
        </label>
        {touch ? (
          <>
            <DateWheels label="Start" mode="full" value={start} onChange={setStart} fromYear={1900} toYear={lastYear} />
            <DateWheels label="End" mode="full" value={end} onChange={setEnd} fromYear={1900} toYear={lastYear} />
          </>
        ) : (
          <div className="row">
            <label className="tm-field">
              <span className="tm-field__label">Start</span>
              <input className="tm-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="tm-field">
              <span className="tm-field__label">End</span>
              <input className="tm-input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
        )}
        {error && <p className="tm-field__error">{error}</p>}
        <div className="row row--center">
          <button type="submit" className="tm-btn tm-btn--primary">
            {editing !== undefined ? 'Save changes' : 'Add period'}
          </button>
          {editing !== undefined && (
            <button type="button" className="tm-btn" onClick={() => fill(undefined)}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/** A `yyyy`, `yyyy-mm` or `yyyy-mm-dd` date as `yyyy-mm-dd`, for a date field. */
function fullDate(value: string, side: 'start' | 'end'): string {
  if (value.length === 10) return value;
  if (value.length === 7) {
    if (side === 'start') return `${value}-01`;
    const [y, m] = value.split('-').map(Number);
    return `${value}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  }
  return side === 'start' ? `${value}-01-01` : `${value}-12-31`;
}
