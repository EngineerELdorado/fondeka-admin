'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CatalogSelect } from '@/components/CatalogSelect';
import { CountryListField } from '@/components/CountrySelect';
import { useAuth } from '@/contexts/AuthContext';
import { isRegulatorRestrictedRecord, isRegulatorRestrictedService } from '@/lib/regulator-presentation';
import { contactAudienceGroups } from '@/lib/contact-exports';

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '0.8rem' };
const list = (value) => Array.isArray(value) ? value : value?.content || [];

export function ContactExportAudience({ filters, onChange, disabled, groups = contactAudienceGroups, options = {}, help = {}, initiallyOpen }) {
  const { enableRegulatorMode } = useAuth();
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [catalogs, setCatalogs] = useState({ countries: [], methods: [], products: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!transactionOpen) return undefined;
    let cancelled = false;
    setLoading(true); setError('');
    Promise.all([api.countries.options(), api.paymentMethods.options(), api.billProducts.options()])
      .then(([countries, methods, products]) => { if (!cancelled) setCatalogs({ countries: list(countries), methods: list(methods), products: list(products) }); })
      .catch(() => { if (!cancelled) setError('Catalog options could not be loaded. Retry, or enter exact IDs below.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [transactionOpen, retry]);

  const renderField = ([key, label, kind, placeholder]) => {
    if (enableRegulatorMode !== false && isRegulatorRestrictedService(key)) return null;
    const input = filters[key] ?? '';
    if (key === 'countryIds' || key === 'countryCodes') return <label key={key} style={{ display: 'grid', gap: '.3rem', minWidth: 0 }}><span>{label}</span><CountryListField aria-label={label} valueType={key === 'countryIds' ? 'id' : 'code'} value={input} disabled={disabled} onChange={(value) => onChange(key, value)} /></label>;
    if (['paymentMethodIds', 'billProductIds'].includes(key)) {
      const records = key === 'paymentMethodIds' ? catalogs.methods : catalogs.products;
      const values = Array.isArray(input) ? input.map(String) : String(input).split(',').map((value) => value.trim()).filter(Boolean);
      return <div key={key} style={{ display: 'grid', gap: '0.35rem', minWidth: 0 }}>
        <label style={{ display: 'grid', gap: '0.3rem' }}><span>{label}</span><CatalogSelect aria-label={label} multiple kind={key === 'paymentMethodIds' ? 'payment-method' : 'bill-product'} records={records} countries={catalogs.countries} value={values} disabled={disabled} loading={loading} onChange={(event) => onChange(key, Array.from(event.target.selectedOptions).map((option) => option.value))}>
          {records.map((record) => <option key={record.id} value={String(record.id)} data-regulator-restricted={isRegulatorRestrictedRecord(record)}>{record.displayName || record.name || `#${record.id}`}</option>)}
        </CatalogSelect></label>
        <details><summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>Enter exact IDs</summary><input aria-label={`${label} IDs`} value={Array.isArray(input) ? input.join(', ') : input} disabled={disabled} placeholder="123, 456" onChange={(event) => onChange(key, event.target.value)} /></details>
      </div>;
    }
    const hiddenValue = enableRegulatorMode !== false && ['transactionServices', 'transactionActions'].includes(key) && isRegulatorRestrictedService(input);
    if (options[key] && !hiddenValue) {
      const selected = Array.isArray(input) ? input.map(String) : String(input).split(',').map((value) => value.trim()).filter(Boolean);
      const choices = [...new Set([...options[key], ...selected])];
      return <label key={key} style={{ display: 'grid', gap: '.3rem', minWidth: 0 }}><span>{label}</span><CatalogSelect aria-label={label} kind="product" multiple records={choices.map((value) => ({ id: value, name: value.replaceAll('_', ' ') }))} value={selected} disabled={disabled} onChange={(event) => onChange(key, Array.from(event.target.selectedOptions, (option) => option.value))}>{choices.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</CatalogSelect></label>;
    }
    return <label key={key} style={{ display: 'grid', gap: '0.3rem', minWidth: 0 }}><span>{label}</span>
      {hiddenValue ? <span>Filter hidden in this presentation. Clear filters to remove it.</span> : kind === 'boolean'
        ? <select value={input} disabled={disabled} onChange={(event) => onChange(key, event.target.value)}><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select>
        : <input type={kind === 'date' ? 'date' : ['number', 'decimal'].includes(kind) ? 'number' : 'text'} min={kind === 'date' ? '0001-01-01' : ['number', 'decimal'].includes(kind) ? '0' : undefined} max={kind === 'date' ? '9999-12-31' : undefined} step={kind === 'number' ? '1' : kind === 'decimal' ? 'any' : undefined} placeholder={placeholder || (kind === 'ids' ? '123, 456' : undefined)} value={Array.isArray(input) ? input.join(', ') : input} disabled={disabled} onChange={(event) => onChange(key, event.target.value)} />}
    </label>;
  };
  return <div style={{ display: 'grid', gap: '0.8rem' }}>
    {groups.map(([title, fields], index) => <details key={title} open={(initiallyOpen ? initiallyOpen.includes(title) : index === 0) ? true : undefined} onToggle={fields.some(([key]) => key === 'billProductIds') ? (event) => setTransactionOpen(event.currentTarget.open) : undefined}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{title}</summary>
      <div style={{ ...grid, marginTop: '0.65rem' }}>{fields.map(renderField)}</div>
      {fields.some(([key]) => key === 'billProductIds') ? <><p style={{ color: 'var(--muted)' }}>{help[title] || 'Attributes must match the same transaction. Without selected statuses, these filters require a completed transaction.'}</p>{error ? <div role="alert">{error} <button type="button" className="btn-neutral btn-sm" disabled={disabled || loading} onClick={() => setRetry((value) => value + 1)}>Retry options</button></div> : null}</> : help[title] ? <p style={{ color: 'var(--muted)' }}>{help[title]}</p> : null}
      {groups === contactAudienceGroups && index === 3 ? <p style={{ color: 'var(--muted)' }}>Monthly and inactivity filters use the job’s creation time. Zero days disables the inactivity selector; accounts without transactions are included.</p> : null}
    </details>)}
    <div style={{ color: 'var(--muted)' }}>Filters combine with AND; values in a list combine with OR. Separate list values with commas. Dates include the whole UTC day.</div>
  </div>;
}
