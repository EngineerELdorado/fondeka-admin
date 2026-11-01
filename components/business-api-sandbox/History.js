'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { PresentationLink as Link, PresentationSelect } from '@/components/RegulatorPresentation';
import { isRegulatorRestrictedRecord, isRegulatorRestrictedService } from '@/lib/regulator-presentation';
import {
  SANDBOX_HISTORY_PATH, SANDBOX_ACTIONS, SANDBOX_STATUSES, SANDBOX_SCENARIOS,
  emptySandboxFilters, sandboxFiltersFromSearch, sandboxHistoryQuery, sandboxHistoryPage,
  sandboxDateInput, sandboxDateValue, sandboxPaymentHref
} from '@/lib/business-api-sandbox';
import { SandboxAlert, SandboxField, SandboxHeader, SandboxStatus, formatSandboxTime, sandboxAmount, sandboxReadError } from '@/components/business-api-sandbox/Common';

export default function SandboxHistory({ initialSearch }) {
  const router = useRouter();
  const { enableRegulatorMode, refreshSession } = useAuth();
  const params = useMemo(() => new URLSearchParams(initialSearch), [initialSearch]);
  const [filters, setFilters] = useState(() => sandboxFiltersFromSearch(initialSearch));
  const [size, setSize] = useState(params.get('size') ?? '20');
  const [result, setResult] = useState(null), [loading, setLoading] = useState(false);
  const [error, setError] = useState(''), [filterError, setFilterError] = useState(''), [reload, setReload] = useState(0);
  const request = useRef(0);
  const page = params.get('page') ?? '0';
  const applied = useMemo(() => {
    try { return { query: sandboxHistoryQuery(sandboxFiltersFromSearch(initialSearch), { page, size: params.get('size') ?? '20' }).toString() }; }
    catch (err) { return { error: err.message }; }
  }, [initialSearch, page, params]);

  useEffect(() => {
    if (!applied.query) return undefined;
    const token = ++request.current;
    setLoading(true); setError('');
    api.businessApiSandbox.list(new URLSearchParams(applied.query)).then((response) => {
      const saved = sandboxHistoryPage(response, page, params.get('size') ?? '20');
      if (request.current === token) setResult(saved);
    }).catch((err) => {
      if (request.current !== token) return;
      setError(sandboxReadError(err));
      if (err.status === 401) void refreshSession(true);
    }).finally(() => { if (request.current === token) setLoading(false); });
    return () => { request.current += 1; };
  }, [applied.query, reload, page, params, refreshSession]);

  function navigate(next, nextPage = 0, nextSize = size) {
    try {
      const query = sandboxHistoryQuery(next, { page: nextPage, size: nextSize });
      setFilterError('');
      router.replace(`${SANDBOX_HISTORY_PATH}?${query}`, { scroll: false });
      if (query.toString() === initialSearch) setReload((value) => value + 1);
    } catch (err) { setFilterError(err.message); }
  }
  const change = (key, value) => setFilters((previous) => ({ ...previous, [key]: value }));
  function changeDate(key, value) {
    try { change(key, sandboxDateValue(value)); setFilterError(''); }
    catch (err) { setFilterError(err.message); }
  }
  const columns = [
    { key: 'payment', label: 'Payment / order reference', render: (row) => <div className="sandbox-cell"><Link href={sandboxPaymentHref(row.transaction.fondekaReference)}>{row.transaction.fondekaReference}</Link><span>{row.transaction.orderReference ?? 'No order reference'}</span><small>API request #{row.requestId}</small></div> },
    { key: 'business', label: 'Business / owner', render: (row) => <div className="sandbox-cell"><Link href={`/dashboard/businesses/${encodeURIComponent(row.businessId)}`}>{row.businessName || `Business ${row.businessId}`}</Link><small>Business #{row.businessId}</small><Link href={`/dashboard/accounts/accounts/${encodeURIComponent(row.ownerAccountId)}`}>Account #{row.ownerAccountId}</Link></div> },
    { key: 'credential', label: 'Credential', render: (row) => <div className="sandbox-cell"><span>{row.apiKeyName || 'Unnamed credential'}</span><small>ID {row.apiKeyId}</small></div> },
    { key: 'action', label: 'Action / scenario', render: (row) => <div className="sandbox-cell"><span>{row.transaction.action === 'BUSINESS_API_COLLECTION' ? 'Collection' : 'Payout'}</span><small>{row.scenario || '—'}</small><small>{row.paymentMethodName || '—'}{row.networkName ? ` · ${row.networkName}` : ''}</small></div> },
    { key: 'amount', label: 'Test amount / fee / gross', render: (row) => <div className="sandbox-cell"><strong>{sandboxAmount(row.transaction.amount, row.transaction.currency)}</strong><small>Fee: {sandboxAmount(row.transaction.fee, row.transaction.currency)}</small><small>Gross: {sandboxAmount(row.transaction.grossAmount, row.transaction.currency)}</small></div> },
    { key: 'status', label: 'API status', render: (row) => <SandboxStatus status={row.transaction.status} /> },
    { key: 'createdAt', label: 'Request created / payment updated (UTC)', render: (row) => <div className="sandbox-cell"><span>{formatSandboxTime(row.createdAt)}</span><small>Updated: {formatSandboxTime(row.updatedAt)}</small></div> }
  ];
  const hiddenRecords = enableRegulatorMode !== false && result?.content.some((row) => isRegulatorRestrictedRecord(row));
  return <div className="sandbox-history">
    <SandboxHeader><Link href="/dashboard/businesses" className="btn-neutral">Businesses</Link><button type="button" className="btn-primary" disabled={loading || !applied.query} onClick={() => setReload((value) => value + 1)}>{loading ? 'Refreshing…' : 'Refresh history'}</button></SandboxHeader>
    <form className="card sandbox-card" onSubmit={(event) => { event.preventDefault(); navigate(filters); }} aria-label="Sandbox history filters">
      <h2>Filter history</h2><div className="sandbox-grid">
        {[['businessId', 'Business ID'], ['accountId', 'Owner account ID'], ['apiKeyId', 'Credential ID (including revoked)']].map(([key, label]) => <SandboxField key={key} label={label}><input inputMode="numeric" value={filters[key]} onChange={(event) => change(key, event.target.value)} /></SandboxField>)}
        <SandboxField label="Action"><select value={filters.action} onChange={(event) => change('action', event.target.value)}><option value="">All actions</option>{SANDBOX_ACTIONS.map((value) => <option key={value} value={value}>{value === 'BUSINESS_API_COLLECTION' ? 'Collection' : 'Payout'}</option>)}</select></SandboxField>
        <SandboxField label="API status"><select value={filters.status} onChange={(event) => change('status', event.target.value)}><option value="">All statuses</option>{SANDBOX_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></SandboxField>
        <SandboxField label="Sandbox scenario"><PresentationSelect value={filters.scenario} onChange={(event) => change('scenario', event.target.value)}><option value="">All scenarios</option>{SANDBOX_SCENARIOS.filter((value) => enableRegulatorMode === false || !isRegulatorRestrictedService(value)).map((value) => <option key={value}>{value}</option>)}</PresentationSelect></SandboxField>
        <SandboxField label="Fiat currency"><input value={filters.currency} maxLength={3} placeholder="USD" onChange={(event) => change('currency', event.target.value)} /></SandboxField>
        <SandboxField label="Exact Fondeka reference"><input value={filters.reference} maxLength={128} onChange={(event) => change('reference', event.target.value)} /></SandboxField>
        <SandboxField label="Exact merchant order reference"><input value={filters.orderReference} maxLength={128} onChange={(event) => change('orderReference', event.target.value)} /></SandboxField>
        {[['fromDate', 'Created from (UTC, inclusive)'], ['toDate', 'Created through (UTC, inclusive)']].map(([key, label]) => <SandboxField key={key} label={label}><input type="datetime-local" min="1970-01-01T00:00" max="9999-12-31T23:59:59.999" step="0.001" value={sandboxDateInput(filters[key])} onChange={(event) => changeDate(key, event.target.value)} /></SandboxField>)}
        <SandboxField label="Payments per page"><select value={size} onChange={(event) => setSize(event.target.value)}>{[10, 20, 50, 100].map((value) => <option key={value}>{value}</option>)}</select></SandboxField>
      </div>
      <small>Filters combine with AND. References match exactly; % and _ are literal characters. Blank dates include all creation times.</small>
      <SandboxAlert>{filterError || applied.error}</SandboxAlert>
      <div className="sandbox-actions"><button type="submit" className="btn-primary" disabled={loading}>Apply filters</button><button type="button" className="btn-neutral" disabled={loading} onClick={() => { setFilters({ ...emptySandboxFilters }); navigate(emptySandboxFilters); }}>Clear filters</button></div>
    </form>
    <section className="card sandbox-card" aria-label="Saved sandbox payments" aria-busy={loading}>
      <h2>Accepted sandbox payments</h2><p>ACCEPTED: queued. PROCESSING: execution started or confirmation is pending. Canceled and expired outcomes appear as FAILED.</p>
      <SandboxAlert>{error}</SandboxAlert>
      {loading ? <div role="status">Loading stored sandbox payments…</div> : null}
      {error && result ? <small>Showing the last successful result. Refresh to retry.</small> : null}
      {hiddenRecords ? <small>Some payments are hidden in the current dashboard presentation. Pagination counts include all matching payments.</small> : null}
      {result ? <DataTable columns={columns} rows={result.content} page={result.number} pageSize={result.size} totalElements={result.totalElements} totalPages={result.totalPages} showTotals showIndex={false} showAccountQuickNav={false} canPrev={!loading && result.number > 0} canNext={!loading && result.number + 1 < result.totalPages} onPageChange={(nextPage) => navigate(sandboxFiltersFromSearch(initialSearch), nextPage, result.size)} emptyLabel={hiddenRecords ? 'No payments are visible in the current dashboard presentation.' : 'No accepted sandbox payments match these filters.'} /> : null}
    </section>
  </div>;
}
