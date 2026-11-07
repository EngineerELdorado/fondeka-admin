'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { manualRetryPreview, manualRetryReceipt, manualRetryRequest, manualRetryStorageKey, pendingManualRetry, savedManualRetry } from '@/lib/payout-manual-retry';
import { Alert, Card, Field, formatInstant, useFailoverError } from './Common';

export default function ManualRetryPanel({ initialTransactionId = '', enabled = false, active = true }) {
  const { session } = useAuth();
  const actor = session?.tokens?.accessToken?.payload?.sub || session?.tokens?.idToken?.payload?.sub || '';
  const [transactionId, setTransactionId] = useState(String(initialTransactionId || ''));
  const [preview, setPreview] = useState(null), [selectedRoute, setSelectedRoute] = useState('');
  const [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false), [submitting, setSubmitting] = useState(false), [denied, setDenied] = useState(false);
  const [receipt, setReceipt] = useState(null), [receiptReviewed, setReceiptReviewed] = useState(false), [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(''), [info, setInfo] = useState('');
  const sequence = useRef(0), locked = useRef(false), intent = useRef(null), mounted = useRef(true);
  const fail = useFailoverError(setError), allowed = enabled && active && !denied;
  const deactivate = useCallback(() => { mounted.current = false; sequence.current++; }, []);
  useEffect(() => { mounted.current = true; return deactivate; }, [deactivate]);
  useEffect(() => { if (!enabled || !active) setConfirmed(false); }, [enabled, active]);

  function remember(payload, id) {
    const key = manualRetryStorageKey(actor, id);
    if (!key || typeof window === 'undefined') return;
    try { if (payload) window.sessionStorage.setItem(key, JSON.stringify({ transactionId: id, payload })); else window.sessionStorage.removeItem(key); }
    catch { /* Backend idempotency still protects the in-memory approval. */ }
  }
  function restore(id) {
    const key = manualRetryStorageKey(actor, id);
    if (!key || typeof window === 'undefined') return null;
    try { return savedManualRetry(JSON.parse(window.sessionStorage.getItem(key)), id); } catch { return null; }
  }
  async function report(err) {
    if (err.status === 403) setDenied(true);
    try { await fail(err); } catch { if (mounted.current) setError('Your session could not be renewed. Sign in again before continuing.'); }
  }
  async function review(event) {
    event?.preventDefault();
    if (!allowed || locked.current) return;
    if (!/^[1-9][0-9]*$/.test(transactionId) || !Number.isSafeInteger(Number(transactionId))) { setError('Enter a valid transaction ID.'); return; }
    const token = ++sequence.current, id = Number(transactionId), pendingIntent = intent.current || restore(id);
    intent.current = pendingIntent;
    setLoading(true); setError(''); setInfo(''); setConfirmed(false); setPreview(null); setReceiptReviewed(false);
    try {
      const value = manualRetryPreview(await api.payoutFailover.manualRetryPreview(id), id);
      if (!mounted.current || token !== sequence.current) return;
      setPreview(value); setSelectedRoute('');
      const recovered = pendingIntent && value.retries.find((item) => item.idempotencyKey === pendingIntent.idempotencyKey);
      const queued = pendingManualRetry(value);
      if (recovered || queued) {
        setReceipt(manualRetryReceipt(recovered || queued, id, recovered ? pendingIntent.idempotencyKey : null));
        setReceiptReviewed(true); setUncertain(false); setInfo('A recorded approval was found. Inspect its status before considering another attempt.');
      } else if (pendingIntent) {
        setReceipt(null); setUncertain(true); setReason(pendingIntent.reason);
        setSelectedRoute(pendingIntent.targetRouteId == null ? '' : String(pendingIntent.targetRouteId));
        setInfo('No matching receipt is visible yet. Check again or resend the identical approval using its original ID.');
      } else { setReceipt(null); setUncertain(false); }
    } catch (err) { if (mounted.current && token === sequence.current) await report(err); }
    finally { if (mounted.current && token === sequence.current) setLoading(false); }
  }
  async function send(payload) {
    locked.current = true; intent.current = payload; remember(payload, preview.transactionId);
    setSubmitting(true); setError(''); setInfo(''); setConfirmed(false); setReceiptReviewed(false);
    try {
      const result = manualRetryReceipt(await api.payoutFailover.manualRetry(preview.transactionId, payload), preview.transactionId, payload.idempotencyKey);
      if (!mounted.current) return;
      setReceipt(result); setUncertain(false);
      setInfo('One approval was recorded. The worker will check the payout again before sending it. This is not payment confirmation.');
    } catch (err) {
      if (!mounted.current) return;
      if ([400, 401, 403, 404, 409, 422, 429].includes(err.status)) {
        remember(null, preview.transactionId); intent.current = null; setPreview(null); setReceipt(null); setUncertain(false);
      } else { setUncertain(true); setPreview(null); setInfo('The approval outcome is unclear. Check payout status to recover its receipt before doing anything else.'); }
      await report(err);
    } finally { locked.current = false; if (mounted.current) setSubmitting(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (!allowed || locked.current || loading || uncertain || receipt || !preview) return;
    let payload;
    try { payload = manualRetryRequest(preview, selectedRoute, reason, confirmed, globalThis.crypto.randomUUID()); }
    catch (err) { setError(err.message); return; }
    await send(payload);
  }
  async function resend() {
    if (!allowed || locked.current || loading || !uncertain || !preview || !intent.current || !confirmed) return;
    await send(intent.current);
  }
  async function refreshReceipt() {
    if (!allowed || !receipt || locked.current || loading) return;
    const token = ++sequence.current, expected = receipt;
    setLoading(true); setError(''); setConfirmed(false); setReceiptReviewed(false);
    try {
      const result = manualRetryReceipt(await api.payoutFailover.manualRetryStatus(expected.id), expected.transactionId, expected.idempotencyKey);
      if (mounted.current && token === sequence.current) setReceipt(result);
    } catch (err) { if (mounted.current && token === sequence.current) await report(err); }
    finally { if (mounted.current && token === sequence.current) setLoading(false); }
  }
  function startAnother() {
    if (!allowed || !receiptReviewed || !preview?.canRetry || !preview.evidence.confirmedNonPayment || pendingManualRetry(preview) || loading || locked.current) return;
    remember(null, preview.transactionId); intent.current = null; setReceipt(null); setUncertain(false); setConfirmed(false); setSelectedRoute('');
    setInfo('Review the current saved payment and provider before approving a new attempt.');
  }

  const busy = loading || submitting, pending = receipt && ['QUEUED', 'DISPATCHED'].includes(receipt.state);
  const chosen = preview?.routes.find((route) => route.routeId === Number(selectedRoute || preview.defaultRouteId));
  const original = preview?.routes.find((route) => route.routeId === preview.defaultRouteId);
  return <Card title="Retry a payout" id="manual-payout-retry">
    <p>Approve one attempt with the original provider, or deliberately select another eligible provider. The saved beneficiary, quote and original debit stay fixed.</p>
    <Alert>{error}</Alert><Alert success>{info}</Alert>
    {!enabled ? <p>Refresh supported providers before approving a retry.</p> : denied ? <p>Admin access is required. Approval is unavailable for this session.</p> : null}
    <form onSubmit={review} className="failover-actions">
      <Field label="Payout transaction ID"><input inputMode="numeric" value={transactionId} disabled={busy || !allowed} onChange={(event) => {
        sequence.current++; setTransactionId(event.target.value); setPreview(null); setReceipt(null); setUncertain(false); setReceiptReviewed(false);
        setConfirmed(false); setSelectedRoute(''); setReason(''); setError(''); setInfo(''); intent.current = null;
      }} /></Field>
      <button type="submit" className="btn-neutral" disabled={busy || !allowed}>{loading ? 'Checking payout…' : 'Check payout status'}</button>
    </form>
    {receipt ? <div className="failover-notice" role="status">
      <strong>Approval #{receipt.id} · {receipt.state}</strong>
      <p>{receipt.state === 'REFUSED' ? `No payout was sent. ${receipt.outcome || 'Refresh the payment before reviewing again.'}`
        : receipt.state === 'UNCERTAIN' ? 'The provider outcome is unknown. Funds remain reserved while it is reconciled.'
        : receipt.state === 'RETURNED' ? `Provider submission returned ${receipt.outcome || 'a response'}. This is not settlement confirmation.`
        : receipt.state === 'DISPATCHED' ? 'A provider request was claimed. Its response may still be outstanding; do not submit another approval.'
        : 'The approval is queued. The worker has not claimed a provider request yet.'}</p>
      <button type="button" className="btn-neutral btn-sm" disabled={busy || !allowed} onClick={refreshReceipt}>Refresh retry status</button>
      {!pending ? <p>Check payout status for fresh provider evidence before considering a new attempt.</p> : null}
    </div> : null}
    {preview ? <>
      <div className="failover-grid"><span>Reference: {preview.reference || '—'} · #{preview.transactionId}</span><span>Beneficiary: {preview.destination || 'Unavailable'}</span>
        <span>Payout: {preview.amount ?? 'Unavailable'} {preview.currency}</span><span>Original debit: {preview.grossAmount ?? 'Unavailable'} {preview.currency}</span>
        <span>Current provider: {preview.currentProvider || 'Unavailable'}</span><span>Status: {preview.transactionStatus}</span><span>Recorded attempts: {preview.currentAttempt} / {preview.maximumAttempts ?? 3}</span></div>
      <p>{preview.evidence.explanation}</p>
      {preview.blockers.length ? <Alert>{preview.blockers.join(' ')}</Alert> : null}
      {receipt && receiptReviewed && !pending && preview.canRetry && preview.evidence.confirmedNonPayment && !pendingManualRetry(preview) ? <button type="button" className="btn-neutral" disabled={busy || !allowed} onClick={startAnother}>Review a new approval</button> : null}
      {!receipt ? <form onSubmit={submit}>
        <Field label="Payout provider"><select value={selectedRoute} disabled={busy || uncertain || !allowed} onChange={(event) => { setSelectedRoute(event.target.value); setConfirmed(false); }}>
          <option value="">{original?.provider || 'Original provider'} · original provider (default){!original?.available ? ' · unavailable' : ''}</option>
          {preview.routes.filter((route) => route.routeId !== preview.defaultRouteId).map((route) => <option key={route.routeId} value={String(route.routeId)} disabled={!route.available}>{route.provider}{route.available ? '' : ' · unavailable'}</option>)}
        </select></Field>
        {!chosen?.available ? <Alert>{chosen?.unavailableReason || 'The original provider route is unavailable. Select another eligible provider explicitly.'}</Alert> : null}
        <Field label="Reason for retry"><textarea value={reason} minLength={3} maxLength={1000} required disabled={busy || uncertain || !allowed} onChange={(event) => { setReason(event.target.value); setConfirmed(false); }} /></Field>
        <label className="failover-actions" style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '.6rem', margin: '.75rem 0' }}><input type="checkbox" style={{ width: 'auto', flex: '0 0 auto' }} checked={confirmed} disabled={busy || !allowed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{uncertain ? 'I confirm resending the identical approval with its original ID; this does not authorize a second attempt.' : 'I confirm the saved beneficiary, amount and selected provider, and authorize one payout retry.'}</span></label>
        {uncertain ? <button type="button" className="btn-neutral" disabled={busy || !allowed || !confirmed} onClick={() => void resend()}>Resend same approval</button>
          : <button type="submit" className="btn-primary" disabled={busy || !allowed || !preview.canRetry || preview.evidence.confirmedNonPayment !== true || !chosen?.available || !confirmed || reason.trim().length < 3 || Boolean(pendingManualRetry(preview))}>{submitting ? 'Recording approval…' : 'Approve one retry'}</button>}
      </form> : null}
      {preview.retries.length ? <details className="failover-technical"><summary>Previous manual approvals ({preview.retries.length})</summary>{preview.retries.map((retry) => <p key={retry.id}>#{retry.id} · Admin {retry.adminId} · {retry.state} · {formatInstant(retry.createdAt)}<br />{retry.reason}{retry.outcome ? ` · ${retry.outcome}` : ''}</p>)}</details> : null}
    </> : null}
  </Card>;
}
