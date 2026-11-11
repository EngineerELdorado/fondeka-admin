'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PresentationLink as Link } from '@/components/RegulatorPresentation';
import { DataTable } from '@/components/DataTable';
import TableText, { TableCellLines } from '@/components/TableCell';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { MANUAL_TV_STATUS, manualTvPermissions, manualTvPage, manualTvProviderAmount } from '@/lib/manual-tv';
import ManualTvReview from './ManualTvReview';

export default function ManualTvQueue() {
  const { session, refreshSession } = useAuth();
  const { canRead, canReconcile } = manualTvPermissions(session);
  const [page, setPage] = useState(0), [revision, setRevision] = useState(0), [result, setResult] = useState(null), [loading, setLoading] = useState(false);
  const [error, setError] = useState(''), [info, setInfo] = useState(''), [selected, setSelected] = useState(null);
  const sequence = useRef(0);
  const fail = useCallback(async (err) => {
    if (err?.status === 401) { try { await refreshSession?.(true); } catch { /* Existing authentication recovery handles sign-in. */ } }
    return err?.status === 403 ? 'Permission denied by the backend for this admin role.' : err?.message || 'Request failed. Refresh to retry.';
  }, [refreshSession]);
  useEffect(() => {
    if (!canRead) return undefined;
    const request = ++sequence.current;
    let active = true;
    setLoading(true); setResult(null); setError('');
    api.billPaymentIntents.list({ status: MANUAL_TV_STATUS, page, size: 20 }).then(manualTvPage).then((next) => {
      if (active && request === sequence.current) setResult(next);
    }).catch(async (err) => { const message = await fail(err); if (active && request === sequence.current) setError(message); })
      .finally(() => { if (active && request === sequence.current) setLoading(false); });
    return () => { active = false; };
  }, [page, revision, canRead, fail]);
  if (!canRead) return <div className="card" role="alert">An admin account is required to view manual TV fulfillment.</div>;
  const refresh = () => setRevision((value) => value + 1);
  return <div style={{ display: 'grid', gap: '1rem', minWidth: 0 }}>
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.75rem', alignItems: 'center' }}>
      <div><h1 style={{ margin: 0 }}>Manual TV fulfillment</h1><p style={{ margin: '.4rem 0 0', color: 'var(--muted)' }}>Collected payments waiting for staff activation. Review the stored selection, activate it, then confirm fulfillment.</p></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}><Link href="/dashboard/bills/products" className="btn-neutral">Configure products</Link><button type="button" className="btn-neutral" onClick={refresh} disabled={loading}>Refresh queue</button></div>
    </div>
    {!canReconcile ? <div className="card">Read only. Recording an outcome requires Admin or Super Admin access.</div> : null}
    {error ? <div className="alert alert-error" role="alert">{error} <button type="button" className="btn-neutral btn-sm" onClick={refresh}>Retry queue</button></div> : null}
    {info ? <div className="alert alert-success" role="status">{info}</div> : null}
    {loading ? <div role="status">Loading collected manual TV payments…</div> : null}
    {result ? <DataTable columns={[
      { key: 'transaction', label: 'Transaction', render: (row) => <Link href={`/dashboard/transactions?transactionId=${encodeURIComponent(row.transactionId)}`}>{row.transactionReference || `Transaction ${row.transactionId}`}</Link> },
      { key: 'product', label: 'Product', render: (row) => <TableText value={row.billProductDisplayName || row.billCode || `Product ${row.billProductId ?? '—'}`} label="Product" /> },
      { key: 'decoder', label: 'Decoder', render: (row) => row.subscriberId || row.accountNumber || 'Unavailable' },
      { key: 'selection', label: 'Offer / option', render: (row) => <TableCellLines primary={row.offerName || row.offerCode || 'Offer unavailable'} secondary={row.optionName || row.optionCode || 'Option unavailable'} label="Stored selection" /> },
      { key: 'amount', label: 'Provider amount', render: manualTvProviderAmount },
      { key: 'actions', label: 'Actions', render: (row) => <button type="button" className="btn-neutral btn-sm" onClick={() => setSelected(row)}>Review</button> }
    ]} rows={result.content} page={page} pageSize={20} totalElements={result.totalElements} totalPages={result.totalPages} onPageChange={setPage} canPrev={page > 0} canNext={page + 1 < result.totalPages} showAccountQuickNav={false} showIndex={false} emptyLabel="No collected TV payments are awaiting manual fulfillment." /> : null}
    {selected ? <ManualTvReview key={selected.id} item={selected} canReconcile={canReconcile} fail={fail} onClose={() => setSelected(null)} onResolved={(action) => { setSelected(null); setInfo(action === 'complete' ? 'TV fulfillment confirmed. The queue is refreshing.' : 'Outcome recorded through transaction reconciliation. The queue is refreshing.'); refresh(); }} /> : null}
  </div>;
}
