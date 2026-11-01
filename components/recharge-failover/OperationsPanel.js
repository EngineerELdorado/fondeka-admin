'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { rechargeQuery, rechargeOperationResource } from '@/lib/recharge-failover';
import { Alert, Card, Field, useFailoverError } from '@/components/payout-failover/Common';
import ArrayPager from './ArrayPager';
import OperationDetail from './OperationDetail';

const metricLabels = [['operations', 'Managed operations'], ['alternate_claims', 'Alternate claims'], ['conflicts', 'Conflicts'], ['unresolved', 'Unresolved'], ['refund_reserved', 'Refund reservations']];
export default function OperationsPanel({ onHistory, initialTransactionId }) {
  const [filters, setFilters] = useState({ transactionId: initialTransactionId || '', conflicted: '' }), [applied, setApplied] = useState({ transactionId: initialTransactionId || '', conflicted: '' });
  const [page, setPage] = useState(0), [size, setSize] = useState(20), [reload, setReload] = useState(0), [selected, setSelected] = useState(() => /^[1-9]\d*$/.test(initialTransactionId || '') ? initialTransactionId : null);
  const [rows, setRows] = useState(null), [metrics, setMetrics] = useState(null), [loading, setLoading] = useState(true), [metricsLoading, setMetricsLoading] = useState(true), [error, setError] = useState(''), [metricsError, setMetricsError] = useState(''), [filterError, setFilterError] = useState('');
  const sequence = useRef(0), metricSequence = useRef(0), fail = useFailoverError(setError), metricFail = useFailoverError(setMetricsError);
  const query = useMemo(() => { try { return rechargeQuery(applied, page, size).toString(); } catch { return null; } }, [applied, page, size]);
  useEffect(() => {
    if (query === null) { setLoading(false); setError('Invalid recharge filters. Apply a valid transaction ID.'); return undefined; }
    const token = ++sequence.current; setLoading(true); setError('');
    api.rechargeFailover.operations(new URLSearchParams(query)).then((response) => {
      if (!Array.isArray(response)) throw new Error('Recharge operations must be returned as an array.');
      response.forEach(rechargeOperationResource);
      if (token === sequence.current) setRows(response);
    }).catch((err) => { if (token === sequence.current) void fail(err); }).finally(() => { if (token === sequence.current) setLoading(false); });
    return () => { sequence.current += 1; };
  }, [query, reload, fail]);
  useEffect(() => {
    const token = ++metricSequence.current; setMetricsLoading(true); setMetricsError('');
    api.rechargeFailover.metrics().then((response) => {
      if (!response || !metricLabels.every(([key]) => typeof response[key] === 'number')) throw new Error('Recharge metrics are unavailable.');
      if (token === metricSequence.current) setMetrics(response);
    }).catch((err) => { if (token === metricSequence.current) void metricFail(err); }).finally(() => { if (token === metricSequence.current) setMetricsLoading(false); });
    return () => { metricSequence.current += 1; };
  }, [reload, metricFail]);
  function apply(next = filters) {
    try { rechargeQuery(next, 0, size); setApplied({ ...next }); setFilters({ ...next }); setPage(0); setReload((value) => value + 1); setFilterError(''); }
    catch (err) { setFilterError(err.message); }
  }
  return <div className="failover-card">
    <Card title="Recharge overview · last 30 days">
      {metricsLoading ? <span role="status">Loading recharge counts…</span> : null}<Alert>{metricsError}</Alert>
      {metrics ? <div className="failover-metrics">{metricLabels.map(([key, label]) => <div className="failover-metric" key={key}><span>{label}</span><strong>{metrics[key].toLocaleString()}</strong></div>)}</div> : null}
      <small>Counts, not monetary totals. Unresolved means no recorded financial settlement. Refund reserved is not proof of wallet credit. Inspect the operation and original transaction together. Metrics do not use the operation filters below.</small>
      <button type="button" className="btn-neutral" disabled={loading || metricsLoading} onClick={() => setReload((value) => value + 1)}>Refresh recharge operations & counts</button>
    </Card>
    <Card title="Recharge operation filters"><form className="failover-card" onSubmit={(event) => { event.preventDefault(); apply(); }}>
      <div className="failover-grid"><Field label="Recharge operation transaction ID"><input inputMode="numeric" value={filters.transactionId} onChange={(event) => setFilters({ ...filters, transactionId: event.target.value })} /></Field><Field label="Recharge conflicted"><select value={filters.conflicted} onChange={(event) => setFilters({ ...filters, conflicted: event.target.value })}><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select></Field><Field label="Recharge operations per page"><select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>{[20, 50, 100].map((entry) => <option key={entry}>{entry}</option>)}</select></Field></div>
      <Alert>{filterError}</Alert><div className="failover-actions"><button type="submit" className="btn-primary" disabled={loading}>Apply recharge filters</button><button type="button" className="btn-neutral" disabled={loading} onClick={() => apply({ ...filters, conflicted: 'true' })}>Recharge conflict queue</button><button type="button" className="btn-neutral" disabled={loading} onClick={() => apply({ transactionId: '', conflicted: '' })}>Reset recharge filters</button></div>
    </form></Card>
    {selected ? <OperationDetail key={String(selected)} transactionId={selected} onHistory={onHistory} onClose={() => setSelected(null)} /> : null}
    <Card title="Managed recharge operations">
      {loading ? <span role="status">Loading managed purchases…</span> : null}<Alert>{error}</Alert>{error && rows ? <small>Previous results are retained; refresh to retry.</small> : null}
      <div className="failover-table"><table><thead><tr>{['Original purchase', 'Quote', 'Current attempt', 'Protection flags', ''].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{(rows || []).map((operation) => {
        const purchase = operation.purchase, attempt = operation.attempts?.find((entry) => entry.number === operation.currentAttempt);
        return <tr key={operation.transactionId}><td>#{operation.transactionId}<div>Account {purchase?.accountId ?? '—'} · {purchase?.country} · {purchase?.type}</div><small>Rule {purchase?.rule?.id} · revision {purchase?.policyRevision}</small></td><td>{purchase?.quote?.amount ?? '—'} {purchase?.quote?.currency}<div>Gross {purchase?.quote?.grossAmount ?? '—'} {purchase?.quote?.currency}</div></td><td>#{operation.currentAttempt} · {attempt?.provider}<div>{attempt?.outcome || 'Unavailable'}</div><small>{attempt?.code || '—'} · {attempt?.queryCount ?? '—'} scheduled reads</small></td><td>{operation.conflicted ? <strong>CONFLICTED</strong> : 'No conflict'}<div>{operation.refundReserved ? 'Refund reserved — verify original transaction' : 'No refund reservation'}</div></td><td><button type="button" className="btn-neutral btn-sm" aria-label={'Investigate recharge transaction ' + operation.transactionId} onClick={() => setSelected(operation.transactionId)}>Investigate recharge</button></td></tr>;
      })}</tbody></table></div>
      {rows?.length === 0 && !loading ? <span>No managed recharge operations on this page.</span> : null}
      {rows ? <ArrayPager page={page} size={size} length={rows.length} busy={loading} onChange={setPage} /> : null}
    </Card>
  </div>;
}
