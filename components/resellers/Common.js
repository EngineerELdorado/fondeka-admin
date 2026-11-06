'use client';

import { CountrySelect } from '@/components/CountrySelect';

import { isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { CatalogSelect } from '@/components/CatalogSelect';
import { resellerLabel, resellerWalletCurrencies, resellerMarkets, RESELLER_POLICY_FIELDS } from '@/lib/resellers';
import { regulatorVisibleFields } from '@/lib/regulator-presentation';

export const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '0.8rem' };
export const actionStyle = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' };
export function Card({ title, children, ...props }) { return <section className="card" style={{ display: 'grid', gap: '0.8rem', minWidth: 0 }} {...props}>{title ? <h2 style={{ margin: 0 }}>{title}</h2> : null}{children}</section>; }
export function Alert({ children, success = false }) { return children ? <div role={success ? 'status' : 'alert'} className={`alert ${success ? 'alert-success' : 'alert-error'}`}>{children}</div> : null; }
export function Field({ label, help, children }) { return <label style={{ display: 'grid', gap: '0.3rem' }}><span>{label}</span>{children}{help ? <small style={{ color: 'var(--muted)' }}>{help}</small> : null}</label>; }
export function Badge({ enabled, yes = 'Enabled', no = 'Disabled' }) { return <span style={{ display: 'inline-block', width: 'fit-content', borderRadius: 20, padding: '.2rem .55rem', fontWeight: 700, background: enabled ? '#ECFDF3' : '#F1F5F9', color: enabled ? '#15803D' : '#475569' }}>{enabled ? yes : no}</span>; }
export function Facts({ rows }) {
  const { enableRegulatorMode } = useAuth();
  const visible = regulatorVisibleFields(rows.map(([label, value]) => ({ key: label, label, value })), enableRegulatorMode);
  return <dl style={{ ...gridStyle, margin: 0 }}>{visible.map(({ label, value }) => <div key={label} style={{ minWidth: 0 }}><dt style={{ color: 'var(--muted)' }}>{label}</dt><dd style={{ margin: '.25rem 0 0', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{value == null ? '—' : typeof value === 'boolean' ? resellerLabel(value) : typeof value === 'object' && !isValidElement(value) ? JSON.stringify(value) : value}</dd></div>)}</dl>;
}
export function BehaviorFacts({ values }) { return <Facts rows={RESELLER_POLICY_FIELDS.map(([key, label]) => [label, values ? resellerLabel(values[key]) : 'Unavailable'])} />; }
export function useResellerError() {
  const { refreshSession } = useAuth();
  return useCallback(async (err) => {
    if (err?.status === 401) { try { await refreshSession(true); } catch { /* Existing session flow handles reauthentication. */ } }
    return `${err?.status === 403 ? 'Permission denied. ' : err?.status === 401 ? 'Session renewed; retry. ' : ''}${err?.message || 'Request failed. Please retry.'}`;
  }, [refreshSession]);
}
export function useResellerResource(load, enabled = true) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [ready, setReady] = useState(false), [revision, setRevision] = useState(0);
  const fail = useResellerError();
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    setLoading(true); setReady(false); setError('');
    Promise.resolve().then(load).then((next) => { if (active) { setData(next); setReady(true); } }).catch(async (err) => { const message = await fail(err); if (active) setError(message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, enabled, revision, fail]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const accept = useCallback((value) => { setData(value); setReady(true); setError(''); }, []);
  return { data, loading, error, ready: ready && !loading, reload, accept };
}
export function ResourceStatus({ resource }) { return <>{resource.loading ? <div role="status">Loading…</div> : null}<Alert>{resource.error}</Alert>{resource.error ? <button type="button" className="btn-neutral" style={{ width: 'fit-content' }} disabled={resource.loading} onClick={resource.reload}>Refresh / retry</button> : null}</>; }
export function ProductPicker({ value, onChange, disabled, optionalLabel = 'All bill products' }) {
  const load = useCallback(() => api.billProducts.options(), []);
  const resource = useResellerResource(load);
  return <div style={{ display: 'grid', gap: '.4rem' }}><CatalogSelect kind="bill-product" aria-label="Bill product" records={resource.data || []} value={value} loading={resource.loading} disabled={disabled || !resource.ready} onChange={(event) => onChange(event.target.value)}><option value="">{optionalLabel}</option>{(resource.data || []).map((row) => <option key={row.id} value={row.id}>{row.displayName || row.name || row.code || `Product ${row.id}`}</option>)}</CatalogSelect><ResourceStatus resource={{ ...resource, loading: false }} /></div>;
}
export function PrefundingCurrencyPicker({ value, onChange, disabled }) {
  const load = useCallback(async () => resellerWalletCurrencies(await api.currencyProducts.walletOptions()), []);
  const resource = useResellerResource(load);
  const selected = String(value || '').toUpperCase();
  const known = resource.data?.some((row) => row.currency === selected);
  return <div style={{ display: 'grid', gap: '.4rem' }}>
    <select aria-label="Prefunding currency" value={selected} disabled={disabled || !resource.ready} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose a currency</option>
      {selected && !known ? <option value={selected} disabled>{selected} · {resource.loading ? 'loading' : 'unavailable'}</option> : null}
      {(resource.data || []).map((row) => <option key={row.currency} value={row.currency}>{row.currency}{row.displayName ? ` · ${row.displayName}` : ''}</option>)}
    </select>
    <ResourceStatus resource={resource} />
    {resource.ready && !resource.data.length ? <small>No active wallet-enabled currencies are available.</small> : resource.ready && selected && !known ? <small>Choose an available currency before saving. The backend rechecks currency availability.</small> : null}
  </div>;
}
export function ProductMarketPicker({ value, onChange }) {
  const load = useCallback(async () => resellerMarkets(await api.countries.options()), []);
  const resource = useResellerResource(load);
  return <div style={{ display: 'grid', gap: '.4rem', maxWidth: '28rem' }}>
    <Field label="Product market"><CountrySelect records={resource.data || []} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Account country (default)</option>
      {value && !resource.data?.some((row) => row.code === value) ? <option value={value}>{value}</option> : null}
      {(resource.data || []).map((row) => <option key={row.code} value={row.code}>{row.name} ({row.code})</option>)}
    </CountrySelect></Field>
    <small>{value ? 'Viewing products for the selected country.' : 'Uses this account’s country, or all markets when no country is set.'} Balances cover all markets.</small>
    <ResourceStatus resource={resource} />
  </div>;
}
export function useMounted() { const mounted = useRef(true); useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []); return mounted; }
