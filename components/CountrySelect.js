'use client';

import { forwardRef, useEffect, useState } from 'react';
import { CatalogSelect } from '@/components/CatalogSelect';
import COUNTRIES from '@/data/countries';
import { api } from '@/lib/api';

// Keep callers' existing option values and native change/selectedOptions contract.
export const CountrySelect = forwardRef(function CountrySelect({ children, records, valueType = 'code', emptyLabel = 'Select country', loading = false, disabled = false, ...props }, ref) {
  const auto = children == null;
  const loadIds = auto && !records && valueType === 'id';
  const [loaded, setLoaded] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!loadIds) return undefined;
    let active = true;
    setBusy(true); setError('');
    api.countries.options().then((rows) => { if (active) setLoaded(rows); }).catch((err) => { if (active) setError(err.message || 'Countries could not be loaded.'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [loadIds, retry]);
  const choices = records || (loadIds ? loaded : auto ? COUNTRIES : []);
  const key = (country) => String(valueType === 'id' ? country.id : country.alpha2Code || country.cca2 || country.countryCode || country.code || '');
  const selected = (Array.isArray(props.value) ? props.value : props.value == null || props.value === '' ? [] : [props.value]).map(String);
  return <>
    <CatalogSelect {...props} disabled={disabled || Boolean(loadIds && !loaded.length && error)} loading={loading || busy} records={choices} kind="country" ref={ref}>
      {auto ? <><option value="">{emptyLabel}</option>{choices.filter((country) => key(country)).map((country) => <option key={key(country)} value={key(country)}>{country.name || country.label || key(country)}</option>)}{selected.filter((value) => !choices.some((country) => key(country) === value)).map((value) => <option key={value} value={value}>{value}</option>)}</> : children}
    </CatalogSelect>
    {error ? <div role="alert" style={{ color: 'var(--muted)' }}>{error} <button type="button" className="btn-neutral btn-sm" disabled={disabled || busy} onClick={() => setRetry((value) => value + 1)}>Retry countries</button></div> : null}
  </>;
});

export function CountryListField({ value, onChange, valueType = 'code', ...props }) {
  const selected = Array.isArray(value) ? value.map(String) : String(value || '').split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);
  return <CountrySelect {...props} multiple valueType={valueType} emptyLabel="All countries" value={selected} onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value).join(', '))} />;
}
