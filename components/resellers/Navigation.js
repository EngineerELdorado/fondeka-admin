'use client';

import styles from './resellers.module.css';

export default function Navigation({ label, items, value, onChange }) {
  return <nav className={styles.navigation} aria-label={label}>
    {items.map(([key, text]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>{text}</button>)}
  </nav>;
}
