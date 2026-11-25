import { useEffect, useId, useState } from 'react';
import { daysIn, joinParts, MONTHS, splitIso, yearsDown, type DateParts } from '../dateParts';

/** True on a touch screen, where the scroll wheels replace typed dates. */
export function useTouchScreen(): boolean {
  const query = '(pointer: coarse)';
  const [touch, setTouch] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    const change = () => setTouch(list.matches);
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, []);
  return touch;
}

/**
 * A date as three lists: day, month and year. A phone shows each list as a scroll wheel.
 * "full" needs all three parts. "partial" lets the user leave out the day, or the day and the month.
 * The value is an ISO date (`yyyy`, `yyyy-mm` or `yyyy-mm-dd`), or '' when it is not complete.
 */
export function DateWheels({
  label,
  value,
  onChange,
  mode,
  fromYear,
  toYear,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  mode: 'full' | 'partial';
  fromYear: number;
  toYear: number;
}) {
  const id = useId();
  // Keep the parts here, so a part the user picked stays while the date is not complete.
  const [parts, setParts] = useState<DateParts>(() => splitIso(value));
  useEffect(() => {
    if (joinParts(parts, mode) !== value) setParts(splitIso(value));
    // Only a change from outside resets the parts.
  }, [value]);

  const set = (change: DateParts) => {
    const next = { ...parts, ...change };
    if (next.day && next.day > daysIn(next.year, next.month)) next.day = daysIn(next.year, next.month);
    setParts(next);
    onChange(joinParts(next, mode));
  };
  const num = (v: string) => (v ? Number(v) : undefined);
  const days = daysIn(parts.year, parts.month);

  return (
    <fieldset className="date-wheels" aria-labelledby={`${id}-label`}>
      <legend id={`${id}-label`} className="tm-field__label">
        {label}
      </legend>
      <div className="date-wheels__row">
        <select
          className="tm-input date-wheels__day"
          aria-label={`${label}: day`}
          value={parts.day ?? ''}
          disabled={mode === 'partial' && !parts.month}
          onChange={(e) => set({ day: num(e.target.value) })}
        >
          <option value="">Day</option>
          {Array.from({ length: days }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <select
          className="tm-input date-wheels__month"
          aria-label={`${label}: month`}
          value={parts.month ?? ''}
          onChange={(e) => set({ month: num(e.target.value), ...(e.target.value ? {} : { day: undefined }) })}
        >
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          className="tm-input date-wheels__year"
          aria-label={`${label}: year`}
          value={parts.year ?? ''}
          onChange={(e) => set({ year: num(e.target.value) })}
        >
          <option value="">Year</option>
          {yearsDown(fromYear, toYear).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {mode === 'partial' && <p className="modal__fine">Leave the day or the month empty if you are not sure.</p>}
    </fieldset>
  );
}
