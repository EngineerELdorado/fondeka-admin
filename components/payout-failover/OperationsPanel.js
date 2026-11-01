'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { failoverQuery, failoverUtcInput, failoverUtcValue } from '@/lib/payout-failover';
import { Alert, Card, Field, Pager, formatInstant, useFailoverError } from './Common';
import OperationDetail from './OperationDetail';

const emptyFilters = { from: null, to: null, staleMinutes: '15', transactionId: '', reference: '', accountId: '', provider: '', state: '', sourceRouteId: '', targetRouteId: '', conflicted: '', unresolved: '' };
const metricsLabels = [['managedPayouts', 'Managed payouts'], ['alternateClaims', 'Alternate claims'], ['completedViaAlternate', 'Completed via alternate'], ['finalFailures', 'Final failures'], ['unresolved', 'Unresolved'], ['conflicts', 'Conflicts'], ['staleUnresolved', 'Aged unresolved']];
export default function OperationsPanel({ capabilities, onHistory, initialTransactionId }) {
  const [filters, setFilters] = useState(() => ({ ...emptyFilters, transactionId: initialTransactionId || '' }));
  const [applied, setApplied] = useState(() => ({ ...emptyFilters, transactionId: initialTransactionId || '' })), [page, setPage] = useState(0), [size, setSize] = useState(20), [reload, setReload] = useState(0);
  const [result, setResult] = useState(null), [metrics, setMetrics] = useState(null), [loading, setLoading] = useState(true), [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState(''), [metricsError, setMetricsError] = useState(''), [filterError, setFilterError] = useState('');
  const [selected, setSelected] = useState(() => /^[1-9]\d*$/.test(initialTransactionId || '') ? initialTransactionId : null);
  const fail = useFailoverError(setError), metricFail = useFailoverError(setMetricsError);
  const request = useRef(0), metricsRequest = useRef(0);
  const query = useMemo(() => {
    try { return failoverQuery(applied, { page, size }).toString(); } catch { return null; }
  }, [applied, page, size]);
  const metricsQuery = useMemo(() => {
    try { return failoverQuery(applied, { metrics: true }).toString(); } catch { return null; }
  }, [applied]);
  useEffect(() => {
    if (query === null) { setLoading(false); setError('Invalid operation filters. Apply a valid query.'); return undefined; }
    const token = ++request.current;
    setLoading(true); setError('');
    api.payoutFailover.operations(new URLSearchParams(query)).then((response) => {
      if (!Array.isArray(response?.content) || !Number.isInteger(response.totalPages)) throw new Error('The operations page is unavailable.');
      if (token === request.current) setResult(response);
    }).catch((err) => { if (token === request.current) void fail(err); }).finally(() => { if (token === request.current) setLoading(false); });
    return () => { request.current += 1; };
  }, [query, reload, fail]);
  useEffect(() => {
    if (metricsQuery === null) { setMetricsLoading(false); setMetricsError('Invalid metrics window.'); return undefined; }
    const token = ++metricsRequest.current;
    setMetricsLoading(true); setMetricsError('');
    api.payoutFailover.metrics(new URLSearchParams(metricsQuery)).then((response) => {
      if (!response || !metricsLabels.every(([key]) => typeof response[key] === 'number') || !response.byCurrentProvider) throw new Error('The metrics response is unavailable.');
      if (token === metricsRequest.current) setMetrics(response);
    }).catch((err) => { if (token === metricsRequest.current) void metricFail(err); }).finally(() => { if (token === metricsRequest.current) setMetricsLoading(false); });
    return () => { metricsRequest.current += 1; };
  }, [metricsQuery, reload, metricFail]);
  function apply(next = filters) {
    try {
      failoverQuery(next, { size }); failoverQuery(next, { metrics: true });
      setApplied({ ...next }); setFilters({ ...next }); setPage(0); setFilterError(''); setReload((value) => value + 1);
    } catch (err) { setFilterError(err.message); }
  }
  const change = (key, value) => setFilters((previous) => ({ ...previous, [key]: value }));
  return <div className="failover-card">
    <Card title="Window & work queue">
      <form className="failover-card" onSubmit={(event) => { event.preventDefault(); apply(); }}>
        <div className="failover-grid">
          {['from', 'to'].map((key) => <Field key={key} label={key === 'from' ? 'From (UTC, inclusive)' : 'To (UTC, exclusive)'}><input type="datetime-local" step="1" value={failoverUtcInput(filters[key])} onChange={(event) => change(key, failoverUtcValue(event.target.value))} /></Field>)}
          <Field label="Aged unresolved threshold (minutes)"><input type="number" min="1" max="1440" value={filters.staleMinutes} onChange={(event) => change('staleMinutes', event.target.value)} /></Field>
          {['transactionId', 'reference', 'accountId', 'sourceRouteId', 'targetRouteId'].map((key) => <Field key={key} label={{ transactionId: 'Transaction ID', reference: 'Exact internal reference', accountId: 'Account ID', sourceRouteId: 'Source route ID', targetRouteId: 'Target route ID' }[key]}><input inputMode={key === 'reference' ? undefined : 'numeric'} value={filters[key]} onChange={(event) => change(key, event.target.value)} /></Field>)}
          <Field label="Current provider"><select value={filters.provider} onChange={(event) => change('provider', event.target.value)}><option value="">All providers</option>{capabilities.providers.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.provider}</option>)}</select></Field>
          <Field label="Current submit state"><select value={filters.state} onChange={(event) => change('state', event.target.value)}><option value="">All states</option>{['STARTED', 'REJECTED', 'RETURNED', 'UNCERTAIN'].map((state) => <option key={state} value={state}>{state}</option>)}</select></Field>
          {['conflicted', 'unresolved'].map((key) => <Field key={key} label={key === 'conflicted' ? 'Conflicted' : 'Unresolved'}><select value={filters[key]} onChange={(event) => change(key, event.target.value)}><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select></Field>)}
          <Field label="Operations per page"><select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>{[20, 50, 100].map((value) => <option key={value}>{value}</option>)}</select></Field>
        </div>
        <small>Blank dates use the last seven days. Windows may cover at most 90 days. Metrics use the date window and aged threshold; other filters apply to the operations list.</small>
        <Alert>{filterError}</Alert><div className="failover-actions"><button type="submit" className="btn-primary" disabled={loading}>Apply filters</button><button type="button" className="btn-neutral" disabled={loading} onClick={() => apply({ ...filters, unresolved: 'true' })}>Unresolved queue</button><button type="button" className="btn-neutral" disabled={loading} onClick={() => apply({ ...filters, conflicted: 'true' })}>Conflicted queue</button><button type="button" className="btn-neutral" disabled={loading} onClick={() => apply({ ...emptyFilters })}>Reset filters</button></div>
      </form>
    </Card>
    <Card title="Overview counts">
      {metricsLoading ? <span role="status">Refreshing counts…</span> : null}<Alert>{metricsError}</Alert>
      {metrics ? <><small>{formatInstant(metrics.from)} → {formatInstant(metrics.to)}{metricsError ? ' · Last confirmed counts; refresh failed.' : ''}</small><div className="failover-metrics">{metricsLabels.map(([key, label]) => <div key={key} className="failover-metric"><span>{label}</span><strong>{metrics[key].toLocaleString()}</strong></div>)}</div><div className="failover-actions">{Object.entries(metrics.byCurrentProvider).map(([provider, count]) => <span key={provider}>{provider}: {count}</span>)}</div></> : !metricsLoading ? <span>Counts unavailable.</span> : null}
      <small>Counts, not money totals; payouts may use different currencies. Final failures and unresolved cases can overlap when a manual refund remains outstanding.</small>
      <button type="button" className="btn-neutral btn-sm" disabled={loading || metricsLoading} onClick={() => setReload((value) => value + 1)}>Refresh operations & counts</button>
    </Card>
    {selected ? <OperationDetail key={String(selected)} transactionId={selected} capabilities={capabilities} onHistory={onHistory} onClose={() => setSelected(null)} /> : null}
    <Card title="Recorded operations">
      {loading ? <span role="status">Loading operations…</span> : null}<Alert>{error}</Alert>
      {error && result ? <small>The previous result set is retained. Retry or apply filters to refresh it.</small> : null}
      <div className="failover-table"><table><thead><tr>{['Transaction / account', 'Amount / gross', 'Current attempt', 'Flags', ''].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>
        {(result?.content || []).map((operation) => {
          const current = operation.attempts?.find((attempt) => attempt.number === operation.currentAttempt);
          return <tr key={operation.transactionId}><td><strong>#{operation.transactionId} · {operation.internalReference || '—'}</strong><div>Account {operation.accountId ?? '—'} · {operation.transactionStatus || 'Missing transaction'}</div><small>{formatInstant(operation.createdAt)}</small></td><td>{operation.amount ?? '—'} {operation.currency}<div>Gross: {operation.grossAmount ?? '—'} {operation.currency}</div></td><td>#{operation.currentAttempt} · {current?.provider || '—'}<div>{current?.state || '—'} · route #{current?.routeId ?? '—'}</div></td><td>{operation.conflicted ? <strong>Conflicted</strong> : null}<div>{operation.unresolved ? 'Unresolved' : 'Resolved'}</div></td><td><button type="button" className="btn-neutral btn-sm" aria-label={'Investigate transaction ' + operation.transactionId} onClick={() => setSelected(operation.transactionId)}>Investigate</button></td></tr>;
        })}
      </tbody></table></div>
      {result?.content.length === 0 && !loading ? <span>No recorded failover operations match these filters.</span> : null}
      {result ? <Pager page={page} totalPages={result.totalPages} totalElements={result.totalElements} busy={loading} onChange={setPage} /> : null}
      <small>One original customer transaction is retained across attempts. RETURNED is submit evidence, not settlement confirmation.</small>
    </Card>
  </div>;
}
