'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ContentModal } from '@/components/ContentModal';
import { PresentationLink as Link } from '@/components/RegulatorPresentation';
import { api } from '@/lib/api';
import { MANUAL_TV_OUTCOMES, manualTvIntent, manualTvBlocker, manualTvFingerprint, manualTvOutcomePayload, manualTvProviderAmount } from '@/lib/manual-tv';

export default function ManualTvReview({ item, canReconcile, fail, onClose, onResolved }) {
  const [data, setData] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [stale, setStale] = useState(false), [denied, setDenied] = useState(false);
  const [action, setAction] = useState(''), [note, setNote] = useState(''), [confirmed, setConfirmed] = useState(false);
  const lock = useRef(false), submitting = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const read = useCallback(async () => {
    const intent = manualTvIntent(await api.billPaymentIntents.get(item.id), item.id);
    if (intent.transactionId !== item.transactionId) throw new Error('The work item’s transaction changed. Close this view and refresh the queue.');
    const eligibility = await api.transactions.manualReconciliationEligibility(intent.transactionId);
    return { intent, eligibility };
  }, [item.id, item.transactionId]);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setConfirmed(false); setStale(true);
    try { const latest = await read(); if (mounted.current) { setData(latest); setStale(false); } }
    catch (err) { const message = await fail(err); if (mounted.current) { setError(message); if (err.status === 403) setDenied(true); } }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }, [read, fail]);
  useEffect(() => { void refresh(); }, [refresh]);
  const blocker = data ? manualTvBlocker(data.intent, data.eligibility) : 'Refresh the work item before recording an outcome.';
  const disabled = busy || !canReconcile || denied;
  const submit = async () => {
    if (lock.current || disabled || stale || blocker || !data) return;
    let payload;
    try { payload = manualTvOutcomePayload(action, note, confirmed); } catch (err) { setError(err.message); return; }
    lock.current = true; submitting.current = true; setBusy(true); setError('');
    try {
      const latest = await read();
      if (!mounted.current) return;
      const changed = manualTvFingerprint(latest.intent) !== manualTvFingerprint(data.intent) || latest.eligibility.status !== data.eligibility.status;
      const latestBlocker = manualTvBlocker(latest.intent, latest.eligibility);
      if (changed || latestBlocker) { setData(latest); setConfirmed(false); setError(latestBlocker || 'The stored selection changed. Review the updated details and confirm again.'); return; }
      const method = { complete: 'completeManualReconciliation', fail: 'failManualReconciliation', cancel: 'cancelManualReconciliation' }[action];
      await api.transactions[method](latest.intent.transactionId, payload);
      if (mounted.current) onResolved(action);
    } catch (err) {
      const message = await fail(err);
      if (mounted.current) { setError(message); setStale(true); setConfirmed(false); if (err.status === 403) setDenied(true); }
    } finally { lock.current = false; submitting.current = false; if (mounted.current) setBusy(false); }
  };
  const intent = data?.intent;
  return <ContentModal title={`Review manual TV · ${item.transactionReference || item.transactionId}`} onClose={() => { if (!submitting.current) onClose(); }} width="min(850px, 95vw)">
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '.5rem' }}><Link href={`/dashboard/transactions?transactionId=${encodeURIComponent(item.transactionId)}`} target="_blank" rel="noopener noreferrer">Open transaction ↗</Link><button type="button" className="btn-neutral btn-sm" disabled={busy} onClick={() => void refresh()}>Refresh latest state</button></div>
    {busy ? <div role="status">Checking or recording the outcome…</div> : null}
    {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
    {stale && data ? <div role="status">The note is kept. Refresh latest state and review the outcome before another submission. A missing response does not prove that the previous action failed.</div> : null}
    {intent ? <>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '.9rem', margin: 0 }}>{[
        ['Product', intent.billProductDisplayName || intent.billCode || intent.billProductId], ['Decoder', intent.subscriberId || intent.accountNumber],
        ['Offer', intent.offerName], ['Offer code', intent.offerCode], ['Option', intent.optionName], ['Option code', intent.optionCode],
        ['Provider amount', manualTvProviderAmount(intent)], ['Transaction status', data.eligibility?.status], ['Work item', intent.status === 'AWAITING_MANUAL_FULFILLMENT' ? 'Awaiting fulfillment' : intent.status]
      ].map(([label, value]) => <div key={label} style={{ minWidth: 0 }}><dt style={{ color: 'var(--muted)' }}>{label}</dt><dd style={{ margin: '.25rem 0 0', fontWeight: 600, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{value ?? 'Unavailable'}</dd></div>)}</dl>
      {intent.promotionNote || intent.promotionTargetOfferDisplayName ? <div className="card"><strong>Captured promotion</strong>{intent.promotionNote ? <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{intent.promotionNote}</p> : null}{intent.promotionTargetOfferDisplayName ? <p>Target offer: {intent.promotionTargetOfferDisplayName}</p> : null}</div> : null}
      {blocker ? <div className="alert alert-error" role="alert">{blocker}</div> : null}
      {!canReconcile || denied ? <div>Read only. Admin or Super Admin access is required to record an outcome.</div> : <fieldset disabled={disabled || stale || Boolean(blocker)} style={{ display: 'grid', gap: '.8rem', border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <legend className="sr-only">Record fulfillment outcome</legend>
        <label style={{ display: 'grid', gap: '.3rem' }}><span>Outcome</span><select aria-label="Outcome" value={action} onChange={(event) => { if (!lock.current) { setAction(event.target.value); setConfirmed(false); } }}><option value="">Choose an outcome</option>{Object.entries(MANUAL_TV_OUTCOMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {action ? <p style={{ margin: 0, color: 'var(--muted)' }}>{action === 'complete' ? 'Confirm only after the selected offer and option have been activated. This records fulfillment without contacting the provider or adding an expiry date.' : 'This closes the bill through reconciliation. Verified external collection returns net funds to the customer’s wallet; wallet and internal crypto debits follow their original refund paths.'}</p> : null}
        <label style={{ display: 'grid', gap: '.3rem' }}><span>Operational note</span><textarea aria-label="Operational note" rows={3} maxLength={1000} value={note} onChange={(event) => { if (!lock.current) { setNote(event.target.value); setConfirmed(false); } }} placeholder="Record activation confirmation or why fulfillment is impossible" /></label>
        <label style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start' }}><input type="checkbox" style={{ width: 'auto', flexShrink: 0 }} checked={confirmed} onChange={(event) => { if (!lock.current) setConfirmed(event.target.checked); }} /><span>{action === 'complete' ? 'I verified activation of this offer and option for this decoder.' : 'I reviewed this outcome and the applicable refund.'}</span></label>
        <button type="button" className={action === 'complete' ? 'btn-success' : 'btn-danger'} disabled={disabled || stale || Boolean(blocker) || !action || !note.trim() || !confirmed} onClick={() => void submit()}>{MANUAL_TV_OUTCOMES[action] || 'Choose an outcome'}</button>
      </fieldset>}
    </> : null}
  </ContentModal>;
}
