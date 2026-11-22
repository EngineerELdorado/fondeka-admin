'use client';

import { useState } from 'react';
import styles from './MonthPicker.module.css';

const validMonth = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export default function MonthPicker({ value, onChange, label, locale = 'en', disabled = false, min = '2000-01', max = '9999-12', required = true }) {
  const fr = locale.toLowerCase().startsWith('fr');
  const text = (en, french) => fr ? french : en;
  const today = new Date();
  const currentMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const selected = validMonth(value) ? value : '';
  const fallback = currentMonth < min ? min : currentMonth > max ? max : currentMonth;
  const [emptyYear, setEmptyYear] = useState('');
  const year = selected ? selected.slice(0, 4) : emptyYear || fallback.slice(0, 4);
  const month = selected.slice(5, 7);
  const base = selected || `${year}-${fallback.slice(5, 7)}`;
  const firstYear = Number(min.slice(0, 4)), lastYear = Number(max.slice(0, 4));
  // Keep future planning available without rendering thousands of year options.
  const horizon = Math.min(lastYear, Math.max(firstYear, today.getUTCFullYear() + 10));
  const years = [...new Set([
    ...Array.from({ length: horizon - firstYear + 1 }, (_, index) => firstYear + index),
    Number(year) - 1, Number(year), Number(year) + 1
  ])].filter(value => value >= firstYear && value <= lastYear).sort((a, b) => b - a);
  const formatter = new Intl.DateTimeFormat(fr ? 'fr-FR' : 'en-US', { month: 'long', timeZone: 'UTC' });
  const choose = next => {
    if (!disabled && validMonth(next)) onChange(next < min ? min : next > max ? max : next);
  };
  const step = delta => {
    const date = new Date(`${base}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + delta);
    const next = date.toISOString().slice(0, 7);
    if (validMonth(next) && next >= min && next <= max) choose(next);
  };

  return <div className={styles.picker} role="group" aria-label={label}>
    {label && <span className={styles.caption}>{label}</span>}
    <div className={styles.controls}>
      <button type="button" className={`btn-neutral btn-sm ${styles.step}`} disabled={disabled || base <= min} aria-label={text('Previous month', 'Mois précédent')} title={text('Previous month', 'Mois précédent')} onClick={() => step(-1)}><span aria-hidden="true">←</span><span className={styles.stepText}>{text('Previous', 'Précédent')}</span></button>
      <label>{text('Month', 'Mois')}<select required={required} disabled={disabled} value={month} onChange={event => choose(`${year}-${event.target.value}`)}>
        {!selected && <option value="">{text('Choose a month', 'Choisir un mois')}</option>}
        {Array.from({ length: 12 }, (_, index) => {
          const value = String(index + 1).padStart(2, '0');
          return <option key={value} value={value} disabled={`${year}-${value}` < min || `${year}-${value}` > max}>{formatter.format(new Date(Date.UTC(2000, index, 1)))}</option>;
        })}
      </select></label>
      <label>{text('Year', 'Année')}<select required={required} disabled={disabled} value={year} onChange={event => {
        if (disabled) return;
        if (selected) choose(`${event.target.value}-${month}`);
        else setEmptyYear(event.target.value);
      }}>
        {years.map(value => <option key={value} value={String(value)}>{value}</option>)}
      </select></label>
      <button type="button" className={`btn-neutral btn-sm ${styles.step}`} disabled={disabled || base >= max} aria-label={text('Next month', 'Mois suivant')} title={text('Next month', 'Mois suivant')} onClick={() => step(1)}><span aria-hidden="true">→</span><span className={styles.stepText}>{text('Next', 'Suivant')}</span></button>
    </div>
  </div>;
}
