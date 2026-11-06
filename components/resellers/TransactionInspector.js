'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PresentationLink as Link } from '@/components/RegulatorPresentation';
import { api } from '@/lib/api';
import { resellerId, resellerPermissions, resellerLabel, resellerDate, resellerNumber } from '@/lib/resellers';
import { Card, Field, Alert, Facts, BehaviorFacts, actionStyle, useMounted, useResellerError } from './Common';

export function TransactionInspector({ transactionId, canWrite, onReconciled }) {
  const [input, setInput] = useState(transactionId == null ? '' : String(transactionId)), [target, setTarget] = useState(transactionId ?? null), [decision, setDecision] = useState(null), [reward, setReward] = useState(null), [busy, setBusy] = useState(false), [ack, setAck] = useState(false), [denied, setDenied] = useState(false), [error, setError] = useState(''), [notCaptured, setNotCaptured] = useState(false);
  const lock = useRef(false), mounted = useMounted(), fail = useResellerError();
  const inspect = async () => {
    if (lock.current) return;
    let id; try { id = resellerId(input, 'Numeric transaction ID'); } catch (err) { setError(err.message); return; }
    lock.current = true; setBusy(true); setError(''); setNotCaptured(false); setDecision(null); setReward(null); setTarget(id); setAck(false);
    try {
      const next = await api.resellers.decision(id);
      if (!next || next.sourceTransactionId !== id || !next.policy || !Array.isArray(next.policySources)) throw new Error('The captured decision is unavailable.');
      if (mounted.current) setDecision(next);
    } catch (err) { if (mounted.current) { if (err.status === 404) setNotCaptured(true); else setError(await fail(err)); } }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const reconcile = async () => {
    if (lock.current || !target || !canWrite || denied || !ack) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const next = await api.resellers.reconcile(target);
      if (!next || next.sourceTransactionId !== target || !next.status) throw new Error('Reconciliation response unavailable. Refresh the reward history before retrying.');
      if (mounted.current) { setReward(next); setAck(false); onReconciled?.(); }
    } catch (err) { if (mounted.current) { if (err.status === 403) setDenied(true); setError(await fail(err)); } }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return <div style={{ display: 'grid', gap: '.8rem' }}>
    <div style={{ ...actionStyle, alignItems: 'end' }}><Field label="Numeric transaction ID"><input inputMode="numeric" value={input} readOnly={transactionId != null} disabled={busy} onChange={(event) => { setInput(event.target.value); setTarget(null); setDecision(null); setReward(null); setNotCaptured(false); setAck(false); }} /></Field><button type="button" className="btn-neutral" disabled={busy} onClick={() => void inspect()}>{busy ? 'Working…' : 'Read captured decision'}</button></div>
    <Alert>{error}</Alert>
    {notCaptured ? <div role="status">No reseller-related decision was captured. Older purchases and ordinary referrals may have no record; this does not mean the payment failed.</div> : null}
    {decision ? <>
      <Facts rows={[
        ['Transaction', decision.sourceTransactionId], ['Reward path', resellerLabel(decision.mode)], ['Reason', decision.reason], ['Origin', resellerLabel(decision.origin)],
        ['Buyer', decision.purchasingAccountId], ['Beneficiary', decision.beneficiaryAccountId], ['Cancelled by enrollment', decision.cancelledByEnrollment ? 'Yes' : 'No'],
        ['Buyer enrollment marker', decision.buyerEnrollmentEpoch], ['Captured at', resellerDate(decision.createdAt)], ['Record version', decision.version]
      ]} />
      <details open><summary>Frozen behavior at purchase creation</summary><div style={{ marginTop: '.6rem' }}><BehaviorFacts values={decision.policy} /></div></details>
      <details><summary>Captured policy versions</summary>{decision.policySources.map((source, index) => <div key={`${source.id}-${index}`}>Policy {source.id} · version {source.version}</div>)}</details>
      {decision.mode === 'REFERRAL' ? <small>A referral route reserves that program only. Check referral history to confirm an actual campaign grant.</small> : null}
    </> : null}
    {target && canWrite && !denied ? <details><summary>Reconcile reward bookkeeping</summary><div style={{ display: 'grid', gap: '.65rem', marginTop: '.65rem' }}>
      <p style={{ margin: 0 }}>Checks an existing purchase snapshot against the current transaction. It cannot create historical eligibility, retry a purchase or call a provider.</p>
      <label style={actionStyle}><input type="checkbox" style={{ width: 'auto' }} disabled={busy} checked={ack} onChange={(event) => setAck(event.target.checked)} />Reconcile the captured reward for transaction {target}.</label>
      <button type="button" className="btn-primary" disabled={busy || !ack} onClick={() => void reconcile()}>Reconcile reward</button>
    </div></details> : null}
    {reward ? <Alert success>Reward status: {reward.status} · {resellerNumber(reward.points)} {reward.currency}. Refresh account history for the latest ledger and balances.</Alert> : null}
    <small>Posting is asynchronous. Inspect <Link href="/dashboard/outbox">outbox jobs</Link> for <code>RESELLER_REWARD_SYNC</code> when a completed purchase still has a pending reward.</small>
  </div>;
}

export default function ResellerTransactionPanel({ transaction }) {
  const { session } = useAuth();
  const { canRead, canWrite } = resellerPermissions(session);
  const [expanded, setExpanded] = useState(false);
  if (!canRead || !transaction?.id) return null;
  return <details onToggle={(event) => setExpanded(event.currentTarget.open)}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Reseller reward decision & cost</summary>{expanded ? <div style={{ display: 'grid', gap: '.8rem', marginTop: '.8rem' }}>
    <Facts rows={[
      ['Recorded reseller cost', transaction.resellerCostAmount == null ? 'Not returned' : `${resellerNumber(transaction.resellerCostAmount)} ${transaction.resellerCostCurrency || transaction.currency || ''}`]
    ]} />
    <small>Reseller cost is separate from referral incentives. Redemption settles an existing liability; it is not another commission expense.</small>
    <TransactionInspector key={transaction.id} transactionId={transaction.id} canWrite={canWrite} />
  </div> : null}</details>;
}

export function RecoveryPanel({ canWrite }) { return <Card title="Inspect a captured purchase"><TransactionInspector canWrite={canWrite} /></Card>; }
