'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { rechargeOperationResource } from '@/lib/recharge-failover';
import { Alert, Card, formatInstant, useFailoverError } from '@/components/payout-failover/Common';
import ProductSummary from './ProductSummary';

export default function OperationDetail({ transactionId, onHistory, onClose }) {
  const [detail, setDetail] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const sequence = useRef(0), fail = useFailoverError(setError);
  const load = useCallback(async () => {
    const token = ++sequence.current; setLoading(true); setError('');
    try {
      const response = await api.rechargeFailover.operation(transactionId);
      if (String(response?.operation?.transactionId) !== String(transactionId) || !Array.isArray(response.operation.attempts) || !response.operation.purchase || !Array.isArray(response.observations)) throw new Error('The recharge operation timeline is unavailable.');
      rechargeOperationResource(response.operation);
      if (token === sequence.current) setDetail(response);
    } catch (err) { if (token === sequence.current) await fail(err.status === 404 ? new Error('No managed recharge journal was found. This does not mean the original transaction failed or can be retried.') : err); }
    finally { if (token === sequence.current) setLoading(false); }
  }, [transactionId, fail]);
  useEffect(() => { void load(); return () => { sequence.current += 1; }; }, [load]);
  const operation = detail?.operation, purchase = operation?.purchase, quote = purchase?.quote;
  return <Card aria-label={'Recharge transaction ' + transactionId + ' timeline'}>
    <div className="failover-heading"><h2>Recharge transaction #{transactionId}</h2><div className="failover-actions"><button type="button" className="btn-neutral btn-sm" disabled={loading} onClick={() => void load()}>Refresh recharge observations</button><button type="button" className="btn-neutral btn-sm" onClick={onClose}>Close recharge timeline</button></div></div>
    <Alert>{error}</Alert>{loading ? <span role="status">Loading recharge evidence…</span> : null}
    {operation ? <>
      <div className="failover-grid"><span>Account {purchase.accountId} · {purchase.country} · {purchase.type}</span><span>Recipient: {purchase.recipient}</span><span>Original purchase: {formatInstant(purchase.createdAt)}</span><strong>{operation.conflicted ? 'CONFLICTED — investigate all attempts' : 'No conflict recorded'}</strong><span>Refund reserved: {operation.refundReserved ? 'Yes — reservation is not proof of credit' : 'No'}</span></div>
      <div className="failover-actions"><Link href={'/dashboard/transactions?transactionId=' + encodeURIComponent(transactionId)}>Open original transaction investigation</Link><button type="button" className="btn-neutral btn-sm" onClick={() => onHistory(purchase.policyRevision)}>Recharge policy revision {purchase.policyRevision}</button><span>Rule {purchase.rule?.id || '—'}</span></div>
      <details className="failover-rule-summary" open><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Original authoritative quote / funding snapshot</summary>
        {quote ? <div className="failover-grid">{Object.entries({ amount: 'Amount', currency: 'Currency', grossAmount: 'Gross amount', fees: 'Fees', requestAmount: 'Request amount', requestCurrency: 'Request currency', billingAmount: 'Billing amount', billingCurrency: 'Billing currency', fiatWalletId: 'Fiat wallet ID', balanceEffect: 'Account balance effect', fiatWalletBalanceEffect: 'Fiat wallet balance effect' }).map(([key, label]) => <span key={key}>{label}: {quote[key] ?? '—'}</span>)}</div> : <span>Quote snapshot unavailable. Consult the original transaction.</span>}
      </details>
      <ol className="failover-timeline">{operation.attempts.map((attempt) => <li key={attempt.number}><article className="failover-rule-summary"><strong>Attempt {attempt.number} · {attempt.provider} · {attempt.outcome}{attempt.number === operation.currentAttempt ? ' · Current' : ''}</strong><span>Code: {attempt.code || '—'} · Scheduled reads: {attempt.queryCount ?? '—'} / 128</span><span>Stable request reference: {attempt.requestReference || '—'}</span><span>Provider reference: {attempt.providerReference || '—'}</span>
        {attempt.queryCount >= 128 && ['UNKNOWN', 'IN_PROGRESS'].includes(attempt.outcome) ? <Alert>Query budget exhausted. Funds remain held for manual review; this does not authorize resend or refund.</Alert> : null}
        <ProductSummary title="Recorded fixed product" product={attempt.product} />
      </article></li>)}</ol>
      <div className="failover-card"><h3>Sanitized provider observations</h3>
        {detail.observations.length ? <div className="failover-table"><table><thead><tr>{['Observed (UTC)', 'Attempt', 'Outcome / code', 'Provider reference'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{detail.observations.map((observation, index) => <tr key={index}><td>{formatInstant(observation.observed_at)}</td><td>#{observation.attempt_number}</td><td>{observation.outcome}<div>{observation.code || '—'}</div></td><td>{observation.provider_reference || '—'}</td></tr>)}</tbody></table></div> : <span>No recorded observations.</span>}
        <small>Refresh reads the journal only. Background queries use backoff from 5 seconds to 15 minutes, up to 128 scheduled reads per attempt. No manual submit, force-query, reset or unsafe refund action is exposed here.</small>
      </div>
      <p>Delivery proof is separate from financial settlement. A submit response or provider transaction ID is not proof of delivery. All attempts need confirmed non-delivery before final failure/refund; unknown, pending, successful or conflicting evidence blocks it. Check the original transaction and refundedAt before treating a reservation as a wallet credit.</p>
    </> : null}
  </Card>;
}
