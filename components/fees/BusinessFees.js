'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { PresentationLink as Link, PresentationSelect } from '@/components/RegulatorPresentation';
import { isRegulatorRestrictedRecord, isRegulatorRestrictedService } from '@/lib/regulator-presentation';
import { DataTable } from '@/components/DataTable';
import { ContentModal } from '@/components/ContentModal';
import { CatalogSelect } from '@/components/CatalogSelect';
import { serviceFeeActions, serviceFeeScopes, feePermissions, feeLabel, humanBusinessPercent, emptyServiceFee, serviceFeeDraft, serviceFeePayload, feePage, businessFeeSnapshot } from '@/lib/service-fees';
import styles from './fees.module.css';

const Field = ({ label, children }) => <label className={styles.field}><span>{label}</span>{children}</label>;
const emptyFilters = { service: '', action: '', productType: '', productKey: '', active: 'true' };
const name = (row) => [row.__catalogEntity?.displayName || row.displayName || row.cardBrandName || row.billProductName || row.__catalogEntity?.name || row.name || row.currency || row.code || row.id, row.cardProviderName || row.billProviderName].filter(Boolean).join(' · ');
export const feeTerms = (row) => `${humanBusinessPercent(row.percentage)}% + ${row.flatAmount} ${row.currency}; min ${row.minimumAmount}${row.maximumAmount == null ? ', no cap' : `, max ${row.maximumAmount}`}`;

export function FeeProductPicker({ type, value, onChange, disabled, filter = false }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(false), [error, setError] = useState(''), [manual, setManual] = useState(false), [reload, setReload] = useState(0);
  useEffect(() => {
    if (!type || type === 'RECHARGE_OPERATOR') return undefined;
    let active = true; setLoading(true); setRows([]); setError('');
    api.serviceFeeProducts.options(type).then((items) => { if (active) setRows(items.map((row) => ({ ...row, displayName: name(row) }))); }).catch((err) => { if (active) setError(err.message || 'Could not load product options.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [type, reload]);
  if (!type && !filter) return null;
  const pair = type?.endsWith('_PAIR'), parts = String(value || '').split(':');
  const select = (label, selected, change) => <Field label={label}><CatalogSelect kind={type === 'BILL_PRODUCT_PROVIDER' ? 'bill-route' : type === 'BILL_PRODUCT' ? 'bill-product' : 'product'} aria-label={label} records={rows} value={selected || ''} loading={loading} disabled={disabled || loading || !type} onChange={(event) => change(event.target.value)}>
    <option value="">{!type ? 'Choose a product scope first' : filter ? 'All products' : 'Choose a product'}</option>{selected && !rows.some((row) => String(row.id) === selected) && <option value={selected}>Saved ID #{selected}</option>}
    {rows.map((row) => <option key={row.id} value={String(row.id)}>{row.displayName} · #{row.id}</option>)}
  </CatalogSelect></Field>;
  return <div className={styles.section}>
    {manual || type === 'RECHARGE_OPERATOR' ? <Field label={filter ? 'Product key filter' : pair ? 'Product pair IDs' : 'Product ID'}><input value={value} maxLength={128} disabled={disabled} placeholder={pair ? 'fromId:toId' : 'Catalogue record ID'} onChange={(event) => onChange(event.target.value)} /></Field> : pair ? <div className={styles.grid}>{select(filter ? 'From product filter' : 'From product', parts[0], (from) => onChange(from || parts[1] ? `${from}:${parts[1] || ''}` : ''))}{select(filter ? 'To product filter' : 'To product', parts[1], (to) => onChange(parts[0] || to ? `${parts[0] || ''}:${to}` : ''))}</div> : select(filter ? 'Product filter' : 'Product', value, onChange)}
    {(type || filter) && type !== 'RECHARGE_OPERATOR' && <button type="button" className="btn-neutral btn-sm" disabled={disabled} onClick={() => setManual((state) => !state)}>{manual ? 'Choose from catalogue' : 'Enter catalogue IDs directly'}</button>}
    {!type && filter && <small>Select a product scope to search products by name, code or ID.</small>}
    {type === 'RECHARGE_OPERATOR' && <small>Use the stored recharge operator ID, not a provider&apos;s external operator code.</small>}
    {error && <div role="alert">{error} <button type="button" className="btn-neutral btn-sm" disabled={disabled} onClick={() => setReload((number) => number + 1)}>Reload products</button></div>}
  </div>;
}

export function BusinessFeesWorkspace({ initialFilters = {} }) {
  const { session, refreshSession, enableRegulatorMode } = useAuth(), { canRead, canWrite } = feePermissions(session);
  const [filters, setFilters] = useState(() => ({ ...emptyFilters, ...initialFilters })), [applied, setApplied] = useState(() => ({ ...emptyFilters, ...initialFilters }));
  const [filterError, setFilterError] = useState('');
  const [page, setPage] = useState(0), [size, setSize] = useState(20), [reload, setReload] = useState(0), [data, setData] = useState(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [info, setInfo] = useState(''), [dialog, setDialog] = useState(null), [draft, setDraft] = useState(emptyServiceFee), [busy, setBusy] = useState(false), [formError, setFormError] = useState(''), [needsReload, setNeedsReload] = useState(false), [uncertain, setUncertain] = useState(false), [denied, setDenied] = useState(false);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!canRead) return undefined;
    let active = true; setLoading(true); setData(null); setError('');
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    for (const [key, value] of Object.entries(applied)) if (String(value).trim()) params.set(key, String(value).trim());
    api.serviceFeeConfigs.list(params).then((response) => {
      const next = feePage(response);
      if (!active) return;
      if (!next.rows.length && page > 0) { setPage(Math.max(0, Math.min(page - 1, next.totalPages - 1))); return; }
      setData(next);
    }).catch(async (err) => {
      if (err.status === 401) { try { await refreshSession?.(true); } catch { /* Show the original read failure. */ } }
      if (active) { setError(err.status === 404 ? 'Business fees are unavailable on this backend. Deploy the rail/service fee backend and both migrations first.' : err.message || 'Could not load business fees.'); if (err.status === 403) setDenied(true); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applied, page, size, reload, canRead, refreshSession]);
  const refresh = () => { if (!lock.current) setReload((value) => value + 1); };
  const applyFilters = () => {
    if (lock.current) return;
    if (filters.productType.endsWith('_PAIR') && filters.productKey && !/^[1-9]\d*:[1-9]\d*$/.test(filters.productKey.trim())) { setFilterError('Choose both products in the pair, or clear both to show all pairs.'); return; }
    setFilterError(''); setPage(0); setApplied({ ...filters });
  };
  const open = async (row) => {
    if (lock.current || !canRead || !data) return;
    lock.current = true; setBusy(true); setFormError(''); setNeedsReload(false); setUncertain(false);
    try {
      const current = row ? await api.serviceFeeConfigs.get(row.id) : null;
      if (current) businessFeeSnapshot(current);
      if (alive.current) {
        const service = applied.service || serviceFeeScopes.find((scope) => scope.value === applied.productType)?.service || 'BILL_PAYMENTS';
        setDialog({ row: current }); setDraft(current ? serviceFeeDraft(current) : { ...emptyServiceFee(), service, action: (serviceFeeActions[service] || []).includes(applied.action) ? applied.action : '', ...(applied.productType ? { productType: applied.productType, productKey: applied.productKey } : {}) });
      }
    } catch (err) { if (alive.current) setError(err.message || 'Could not load this business rule.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const close = () => { if (!lock.current) { setDialog(null); setFormError(''); } };
  const save = async (remove = false) => {
    if (!dialog || !canWrite || denied || lock.current || uncertain || needsReload) return;
    let payload;
    try { if (!remove) payload = serviceFeePayload(draft); } catch (err) { setFormError(err.message); return; }
    lock.current = true; setBusy(true); setFormError(''); setInfo('');
    let writeStarted = false;
    try {
      if (dialog.row) {
        const current = await api.serviceFeeConfigs.get(dialog.row.id);
        if (businessFeeSnapshot(current) !== businessFeeSnapshot(dialog.row)) { setNeedsReload(true); throw new Error('This rule changed on the server. Reload and review the saved rule before saving again. Your draft is still shown.'); }
      }
      writeStarted = true;
      if (remove) await api.serviceFeeConfigs.remove(dialog.row.id);
      else {
        const result = dialog.row ? await api.serviceFeeConfigs.update(dialog.row.id, payload) : await api.serviceFeeConfigs.create(payload);
        if (!result?.id || businessFeeSnapshot(result) !== JSON.stringify(payload)) throw new Error('The backend did not confirm the requested business rule.');
      }
      if (alive.current) { setDialog(null); setInfo(remove ? 'Business fee deleted. Broader active settings may now apply.' : 'Business fee saved for new quotes and payments.'); setReload((value) => value + 1); }
    } catch (err) {
      if (err.status === 401) { try { await refreshSession?.(true); } catch { /* Preserve the policy error. */ } }
      if (alive.current) {
        const unknown = writeStarted && (!err.status || err.status >= 500);
        setFormError(`${err.message || 'Could not save business fees.'}${unknown ? ' The outcome is unconfirmed. Review saved records before another submission.' : ''}`);
        if (unknown) { setUncertain(true); setData(null); }
        if (err.status === 403) setDenied(true);
      }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const reloadEditor = async () => {
    if (lock.current || !dialog?.row) return;
    lock.current = true; setBusy(true);
    try { const row = await api.serviceFeeConfigs.get(dialog.row.id); businessFeeSnapshot(row); if (alive.current) { setDialog({ row }); setDraft(serviceFeeDraft(row)); setNeedsReload(false); setUncertain(false); setFormError(''); } }
    catch (err) { if (alive.current) setFormError(err.message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  if (!canRead) return <div className="card" role="alert">Admin, Super Admin or Assistant access is required to inspect fees.</div>;
  const disabled = !canWrite || denied || busy;
  const allowedScopes = serviceFeeScopes.filter((scope) => scope.service === draft.service);
  const columns = [
    { key: 'scope', label: 'Scope', width: '18rem', minWidth: '15rem', render: (row) => <div className={styles.scope}>
      <strong>{feeLabel(row.service)}</strong>
      <span>{row.action ? feeLabel(row.action) : 'All actions'}</span>
      <small>{row.productType ? `${serviceFeeScopes.find((scope) => scope.value === row.productType)?.label || row.productType} #${row.productKey}` : 'Service / action default'}</small>
    </div> },
    { key: 'charge', label: 'Business charge', render: (row) => <span>{feeTerms(row)}</span> },
    { key: 'cost', label: 'Additional product cost', render: (row) => `${humanBusinessPercent(row.costPercentage)}% + ${row.costFlatAmount} ${row.currency}; min ${row.costMinimumAmount}` },
    { key: 'active', label: 'Status', render: (row) => row.active ? 'Active' : 'Inactive' },
    { key: 'actions', label: 'Actions', render: (row) => <button className="btn-neutral btn-sm" disabled={busy || loading} onClick={() => void open(row)}>Review</button> }
  ];
  const amountFields = [['percentage', 'Percentage (%)', true], ['flatAmount', 'Flat charge'], ['minimumAmount', 'Minimum charge'], ['maximumAmount', 'Maximum charge (optional)']];
  const numberInput = ([key, label, percent]) => <Field key={key} label={label}><input type="number" min="0" max={percent ? '100' : undefined} step={percent ? '0.00000001' : '0.01'} value={draft[key]} disabled={disabled} onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))} /></Field>;
  return <div className={styles.workspace}>
    <header className={`card ${styles.toolbar}`}><div><h1>Business fees</h1><p>One service, action or product charge, added to the payment rail tariff.</p></div><div className={styles.actions}><Link className="btn-neutral" href="/dashboard/fees/fee-configs">Rail pricing</Link><button className="btn-neutral" disabled={loading || busy} onClick={refresh}>Refresh</button>{canWrite && !denied && <button className="btn-primary" disabled={loading || busy || !data} onClick={() => void open(null)}>New business rule</button>}</div></header>
    {!canWrite || denied ? <div className="card">Read only. Admin or Super Admin access is required to change fees.</div> : null}
    {info && <div className="card" role="status">{info}</div>}
    <section className="card"><div className={`${styles.grid} ${styles.filters}`}>
      <Field label="Service filter"><PresentationSelect value={filters.service} onChange={(event) => { setFilterError(''); setFilters((value) => ({ ...value, service: event.target.value, action: '', productType: '', productKey: '' })); }}><option value="">All services</option>{Object.keys(serviceFeeActions).map((service) => <option key={service} value={service}>{feeLabel(service)}</option>)}</PresentationSelect></Field>
      <Field label="Action filter"><PresentationSelect value={filters.action} onChange={(event) => setFilters((value) => ({ ...value, action: event.target.value }))}><option value="">All actions</option>{(filters.service ? serviceFeeActions[filters.service] || [] : Object.values(serviceFeeActions).flat()).map((action) => <option key={action} value={action}>{feeLabel(action)}</option>)}</PresentationSelect></Field>
      <Field label="Product scope filter"><PresentationSelect value={filters.productType} onChange={(event) => { setFilterError(''); setFilters((value) => ({ ...value, productType: event.target.value, productKey: '' })); }}><option value="">All scopes</option>{serviceFeeScopes.filter((scope) => !filters.service || scope.service === filters.service).map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}</PresentationSelect></Field>
      <FeeProductPicker key={filters.productType} filter type={filters.productType} value={filters.productKey} disabled={busy} onChange={(productKey) => { setFilterError(''); setFilters((value) => ({ ...value, productKey })); }} />
      <Field label="Status filter"><select value={filters.active} onChange={(event) => setFilters((value) => ({ ...value, active: event.target.value }))}><option value="true">Active</option><option value="false">Inactive</option><option value="">All records</option></select></Field>
    </div>{filterError && <p role="alert">{filterError}</p>}<div className={styles.actions}><button className="btn-primary" disabled={busy} onClick={applyFilters}>Apply filters</button><button className="btn-neutral" disabled={busy} onClick={() => { setFilterError(''); setFilters({ ...emptyFilters, active: '' }); setApplied({ ...emptyFilters, active: '' }); setPage(0); }}>Clear filters</button><Field label="Rows per page"><select value={size} disabled={busy} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>{[20, 50, 100].map((value) => <option key={value}>{value}</option>)}</select></Field></div></section>
    <section className="card">{loading ? <p role="status">Loading business fees…</p> : error ? <div role="alert">{error} <button className="btn-neutral" onClick={refresh}>Refresh fees</button></div> : data ? <><small>{data.totalElements} matching rules</small>{data.rows.length ? <DataTable rows={data.rows} columns={columns} page={data.number} pageSize={data.size} totalElements={data.totalElements} totalPages={data.totalPages} canPrev={!busy && data.number > 0} canNext={!busy && data.number + 1 < data.totalPages} onPageChange={setPage} showIndex={false} showAccountQuickNav={false} /> : <p>No business fees match these filters.</p>}</> : <p>Refresh saved records before making another change.</p>}</section>
    <details className="card"><summary>How these fees apply</summary><div className={styles.section}><p>Product + action → product → action → service. One active business rule wins; explicit zero also replaces broader charges. Within bill scopes, product/provider mapping takes priority over bill product, then bill provider.</p><p>Charge = amount × percentage + flat, then minimum and optional maximum. Fixed amounts use this rule&apos;s currency and are converted by the backend. Missing required FX fails the quote. Additional product costs are separate and are not capped by the business-charge maximum.</p><p>Card funding and withdrawal settings already count as product + action rules. Only an explicit new product/action rule replaces them. Clear both existing operation fields to inherit; zero is a configured setting.</p><p>Changes affect new quotes and transactions. Account-specific conversion contracts retain priority. Amount-specific quotes remain authoritative for inclusive fees, conversion and the final total.</p></div></details>
    {dialog && <ContentModal title={dialog.row ? `Business fee #${dialog.row.id}` : 'New business fee'} onClose={close}><div className={styles.section}>
      {formError && <div role="alert">{formError}</div>}
      {(needsReload || uncertain) && (dialog.row ? <button className="btn-neutral" disabled={busy} onClick={() => void reloadEditor()}>Reload saved rule (replace draft)</button> : <button className="btn-neutral" disabled={busy} onClick={() => { close(); setFilters({ service: draft.service, action: draft.action, productType: draft.productType, productKey: draft.productKey, active: '' }); setApplied({ service: draft.service, action: draft.action, productType: draft.productType, productKey: draft.productKey, active: '' }); setPage(0); setReload((value) => value + 1); }}>Review saved records</button>)}
      <div className={styles.grid}><Field label="Service"><PresentationSelect value={draft.service} disabled={disabled} onChange={(event) => setDraft((value) => ({ ...value, service: event.target.value, action: '', productType: '', productKey: '' }))}>{Object.keys(serviceFeeActions).map((service) => <option key={service}>{service}</option>)}</PresentationSelect></Field>
        <Field label="Action"><PresentationSelect value={draft.action} disabled={disabled} onChange={(event) => setDraft((value) => ({ ...value, action: event.target.value }))}><option value="">All actions in this service</option>{(serviceFeeActions[draft.service] || []).map((action) => <option key={action}>{action}</option>)}</PresentationSelect></Field>
        <Field label="Product scope"><PresentationSelect value={draft.productType} disabled={disabled} onChange={(event) => setDraft((value) => ({ ...value, productType: event.target.value, productKey: '' }))}><option value="">Service / action default</option>{allowedScopes.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}</PresentationSelect></Field>
        <Field label="Rule status"><select value={String(draft.active)} disabled={disabled} onChange={(event) => setDraft((value) => ({ ...value, active: event.target.value === 'true' }))}><option value="true">Active</option><option value="false">Inactive</option></select></Field>
      </div>
      <FeeProductPicker key={draft.productType} type={draft.productType} value={draft.productKey} disabled={disabled} onChange={(productKey) => setDraft((value) => ({ ...value, productKey }))} />
      <h3>Business charge</h3><small>Enter 2 for 2%. The API receives 0.02. Zero explicitly replaces broader charges.</small>
      <div className={styles.grid}>{amountFields.map(numberInput)}<Field label="Rule currency"><input maxLength={3} value={draft.currency} disabled={disabled} onChange={(event) => setDraft((value) => ({ ...value, currency: event.target.value.toUpperCase() }))} /></Field></div>
      {draft.productType === 'CARD_PRODUCT_PROVIDER' && ['FUND_CARD', 'WITHDRAW_FROM_CARD'].includes(draft.action) && <div className={styles.notice}>This rule replaces the card mapping&apos;s {draft.action === 'FUND_CARD' ? 'funding' : 'withdrawal'} percentage and minimum, including when this rule is zero.</div>}
      <details><summary>Additional downstream product cost</summary><p>Leave zero when existing product accounting already includes this cost. This is passed through once as other fees, separately from rail provider costs.</p><div className={styles.grid}>{[['costPercentage', 'Cost percentage (%)', true], ['costFlatAmount', 'Cost flat amount'], ['costMinimumAmount', 'Cost minimum amount']].map(numberInput)}</div></details>
      {enableRegulatorMode !== false && isRegulatorRestrictedRecord(draft) ? <p>These service settings are unavailable in the current dashboard presentation.</p> : null}
      {canWrite && !denied && <div className={styles.actions}><button className="btn-primary" disabled={busy || needsReload || uncertain || (enableRegulatorMode !== false && isRegulatorRestrictedService(draft.service))} onClick={() => void save()}>{busy ? 'Saving…' : 'Save business fee'}</button>{dialog.row && <button className="btn-neutral" disabled={disabled} onClick={() => setDraft((value) => ({ ...value, active: false }))}>Set inactive</button>}{dialog.row && <details><summary>Delete rule</summary><p>Deleting allows the next matching setting to apply. Prefer setting the rule inactive to retain it.</p><button className="btn-danger" disabled={busy || needsReload || uncertain} onClick={() => void save(true)}>Confirm delete business fee</button></details>}</div>}
    </div></ContentModal>}
  </div>;
}
function WorkspaceRoute() {
  const search = useSearchParams(), { session } = useAuth();
  const initial = Object.fromEntries(Object.keys(emptyFilters).filter((key) => search.has(key)).map((key) => [key, search.get(key)]));
  const identity = session?.tokens?.accessToken?.payload?.sub || session?.tokens?.idToken?.payload?.sub || session?.tokens?.accessToken?.toString() || 'anonymous';
  return <BusinessFeesWorkspace key={identity} initialFilters={initial} />;
}
export default function BusinessFeesPage() { return <Suspense fallback={<div className="card">Loading business fees…</div>}><WorkspaceRoute /></Suspense>; }
