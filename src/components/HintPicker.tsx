import { yearsDown } from '../dateParts';
import type { Hint, LifePeriod } from '../types';
import { useTouchScreen } from './DateWheels';

/**
 * Asks "When did you first hear it?" with three plain choices: when it came out,
 * in a year, or during a life period. The answer moves the song on the timeline.
 * "In a year" and "During" show one more field.
 */
export function HintPicker({
  hint,
  periods,
  onChange,
  label = 'When did you first hear it?',
  releaseDate,
}: {
  hint: Hint;
  periods: LifePeriod[];
  onChange: (hint: Hint) => void;
  label?: string;
  /** The release date, so "In a year" can start at the release year. */
  releaseDate?: string;
}) {
  const thisYear = new Date().getUTCFullYear();
  const touch = useTouchScreen();
  const releaseYear = releaseDate ? Number(releaseDate.slice(0, 4)) : undefined;
  const choices: { kind: Hint['kind']; text: string; pick: () => Hint }[] = [
    { kind: 'onRelease', text: 'When it came out', pick: () => ({ kind: 'onRelease' }) },
    { kind: 'year', text: 'In a year', pick: () => ({ kind: 'year', year: hint.year ?? releaseYear ?? thisYear }) },
  ];
  if (periods.length > 0) {
    choices.push({
      kind: 'period',
      text: 'During',
      pick: () => ({ kind: 'period', periodId: hint.periodId ?? periods[0].id }),
    });
  }

  return (
    <fieldset className="hint-picker">
      <legend className="tm-field__label">{label}</legend>
      <div className="chips">
        {choices.map((c) => (
          <button
            key={c.kind}
            type="button"
            className="chip"
            aria-pressed={hint.kind === c.kind}
            onClick={() => hint.kind !== c.kind && onChange(c.pick())}
          >
            {c.text}
          </button>
        ))}
      </div>
      {hint.kind === 'year' && touch && (
        <select
          className="tm-input hint-picker__more"
          aria-label="Year"
          value={hint.year ?? thisYear}
          onChange={(e) => onChange({ kind: 'year', year: Number(e.target.value) })}
        >
          {yearsDown(1900, thisYear).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      )}
      {hint.kind === 'year' && !touch && (
        <input
          className="tm-input hint-picker__more"
          type="number"
          aria-label="Year"
          min={1900}
          max={2100}
          value={hint.year ?? ''}
          onChange={(e) => {
            const year = Number(e.target.value);
            if (Number.isInteger(year) && year >= 1900 && year <= 2100) onChange({ kind: 'year', year });
          }}
        />
      )}
      {hint.kind === 'period' && (
        <select
          className="tm-input hint-picker__more"
          aria-label="Life period"
          value={hint.periodId ?? ''}
          onChange={(e) => onChange({ kind: 'period', periodId: Number(e.target.value) })}
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.place ? `, ${p.place}` : ''}
            </option>
          ))}
        </select>
      )}
    </fieldset>
  );
}
