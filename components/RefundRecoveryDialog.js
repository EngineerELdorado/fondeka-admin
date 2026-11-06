'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { auditMoney } from '@/lib/payout-refund-audit';
import { recoveryDebitIds } from '@/lib/refund-recovery';
import styles from '@/app/(dashboard)/dashboard/payout-refund-audits/page.module.css';

function Dialog({ title, children, onClose, busy }) {
  const surface = useRef(null), titleId = useId();
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    surface.current?.querySelector('button, input, textarea')?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  const keyDown = (event) => {
    if (event.key === 'Escape' && !busy) onClose();
    if (event.key !== 'Tab') return;
    const nodes = [...surface.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled)')];
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className={styles.backdrop} onKeyDown={keyDown}>
    <section className={`${styles.dialog} ${styles.wide}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={surface}>
      <header className={styles.dialogHeader}><h2 id={titleId}>{title}</h2><button className={styles.iconButton} disabled={busy} onClick={onClose} aria-label="Close dialog">×</button></header>
      {children}
    </section>
  </div>;
}

export function RecoveryMoney({ totals }) {
  return <span className={styles.money}>{Object.entries(totals || {}).map(([currency, amount]) => <span key={currency}>{auditMoney(amount, currency)}</span>)}</span>;
}

export function RestrictionPreviewDialog({ runId, onClose, onApplied }) {
  const [preview, setPreview] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    api.payoutRefundAudits.restrictionPreview(runId).then((value) => { if (current) setPreview(value); }).catch((err) => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [runId]);
  const apply = async () => {
    setBusy(true); setError('');
    try {
      const result = await api.payoutRefundAudits.applyRestrictions(runId, { fingerprint: preview.fingerprint });
      onApplied(result); onClose();
    } catch (err) { setError(err.message); if (err.status === 409) setPreview(null); }
    finally { setBusy(false); }
  };
  return <Dialog title="Restrict confirmed accounts" onClose={onClose} busy={busy}>
    <div className={styles.newAuditForm}>
      <p>This covers all eligible confirmed cases in this saved report, across all pages. Search and outcome filters on the audit table do not narrow this action.</p>
      <div className={styles.notice}>Accounts will be marked as untrusted borrowers and receive the same service restrictions as accounts past the late-loan threshold. Deposits and admin wallet debits remain available. Applying restrictions does not debit any wallet.</div>
      {error && <div role="alert" className={styles.error}>{error}</div>}
      {!preview && !error && <p role="status">Checking current refund evidence…</p>}
      {preview && <>
        <p><strong>{preview.accounts.length} accounts · {preview.refundCount} new refund cases</strong></p>
        <div>New amount to recover: <RecoveryMoney totals={preview.totals} /></div>
        {!preview.refundCount && <p>There are no new eligible cases. Existing and already recovered refunds will not be added twice.</p>}
        {preview.accounts.map((account) => <details className={styles.evidence} key={account.accountId}>
          <summary><strong>Account #{account.accountId}</strong><RecoveryMoney totals={account.customerMessage.totalOwed} /></summary>
          <p style={{ whiteSpace: 'pre-wrap' }}>{account.customerMessage.message}</p>
        </details>)}
        <div className={styles.dialogActions}><button className={styles.button} onClick={onClose} disabled={busy}>Cancel</button><button className={styles.primary} disabled={busy || !preview.refundCount} onClick={apply}>{busy ? 'Applying restrictions…' : 'Apply restrictions and notify accounts'}</button></div>
      </>}
    </div>
  </Dialog>;
}

export function RecoveryAccountDialog({ accountId, onClose, onChanged }) {
  const [account, setAccount] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [debits, setDebits] = useState(''), [note, setNote] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    api.payoutRefundAudits.recoveryAccount(accountId).then((value) => { if (current) setAccount(value); }).catch((err) => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [accountId]);
  const release = async (event) => {
    event.preventDefault(); setError(''); setNotice('');
    try {
      const debitTransactionIds = recoveryDebitIds(debits);
      setBusy(true);
      const result = await api.payoutRefundAudits.releaseRestriction(accountId, { debitTransactionIds, note: note.trim() });
      setAccount(result); setDebits(''); setNote(''); onChanged?.();
      setNotice(result.customerStatus.restricted ? 'Repayment recorded. Other amounts remain outstanding, so the account is still restricted.' : 'Recovery verified and this refund restriction lifted. Separate loan or security restrictions still apply.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <Dialog title={`Refund recovery · Account #${accountId}`} onClose={onClose} busy={busy}>
    <div className={styles.newAuditForm}>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {notice && <div className={styles.notice} role="status">{notice}</div>}
      {!account && !error && <p role="status">Loading recovery details…</p>}
      {account && <>
        <p><strong>{account.customerStatus.restricted ? 'Restricted · amount still owed' : 'No active refund restriction'}</strong></p>
        <RecoveryMoney totals={account.customerStatus.totalOwed} />
        {account.customerStatus.message && <details className={styles.evidence}><summary>Message shown to the customer</summary><p style={{ whiteSpace: 'pre-wrap' }}>{account.customerStatus.message}</p></details>}
        <div className={styles.creditList}>{account.cases.map((item) => <div key={item.id}><div><strong>{item.evidence.reference}</strong><strong>{auditMoney(item.amount, item.currency)}</strong></div><p>{item.status === 'OPEN' ? 'Outstanding' : 'Recovered'} · Refund #{item.evidence.credits?.[0]?.refundTransactionId || '—'}</p></div>)}</div>
        {account.customerStatus.restricted && <form onSubmit={release}>
          <div className={styles.notice}>First debit the deposited funds using the existing admin wallet debit action. Then enter the resulting transaction IDs below to verify recovery and lift this restriction. This action does not make another debit. A deposit, pending debit, or customer payment cannot clear it.</div>
          <p><Link href={`/dashboard/accounts/accounts/${accountId}`} target="_blank" rel="noopener noreferrer">Open account to debit wallet ↗</Link></p>
          <label><span>Completed admin debit transaction IDs</span><input required disabled={busy} value={debits} maxLength={2000} placeholder="e.g. 12345, 12346" onChange={(event) => setDebits(event.target.value)} /></label>
          <label><span>Recovery note</span><textarea required disabled={busy} value={note} maxLength={1000} rows={3} onChange={(event) => setNote(event.target.value)} /></label>
          <p className={styles.muted}>Debits must belong to this account and exactly cover the outstanding amount in each selected currency. If another currency remains unpaid, the restriction stays active.</p>
          <div className={styles.dialogActions}><button className={styles.button} type="button" disabled={busy} onClick={onClose}>Close</button><button className={styles.primary} type="submit" disabled={busy || !debits.trim() || !note.trim()}>{busy ? 'Verifying recovery…' : 'Lift restriction'}</button></div>
        </form>}
      </>}
    </div>
  </Dialog>;
}
