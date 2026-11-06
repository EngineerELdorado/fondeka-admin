'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { RecoveryAccountDialog, RecoveryMoney } from '@/components/RefundRecoveryDialog';
import { canReadRefundAudit } from '@/lib/payout-refund-audit';
import styles from '../page.module.css';

export default function RestrictedAccountsPage() {
  const { session, enableRegulatorMode } = useAuth();
  const visible = canReadRefundAudit(session) && enableRegulatorMode === false;
  const identity = session?.tokens?.accessToken?.payload?.sub || session?.tokens?.idToken?.payload?.sub || '';
  const [query, setQuery] = useState(''), [draft, setDraft] = useState(''), [page, setPage] = useState(0), [reload, setReload] = useState(0);
  const [result, setResult] = useState(null), [error, setError] = useState(''), [selected, setSelected] = useState(null), [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!visible) return undefined;
    let current = true; setLoading(true); setError(''); setResult(null);
    api.payoutRefundAudits.restrictedAccounts({ query, page, size: 20 }).then((value) => { if (current) setResult(value); }).catch((err) => { if (current) setError(err.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [visible, identity, query, page, reload]);
  if (!visible) return <div className={styles.empty}>Refund restrictions are available to Admin and Super Admin accounts outside regulator presentation.</div>;
  return <div className={styles.workspace}>
    <header className={styles.heading}><div><div className={styles.eyebrow}>PAYMENTS / RECOVERY</div><h1>Restricted accounts</h1><p>Accounts awaiting repayment of a confirmed payout refund.</p></div><Link className={styles.button} href="/dashboard/payout-refund-audits">Back to payout audit</Link></header>
    {error && <div className={styles.error} role="alert">{error}</div>}
    <div className={styles.notice}>Deposits and admin wallet debits remain available. After recovering the money through an admin wallet debit, open the account below and use Lift restriction. Separate loan and security restrictions are preserved.</div>
    <section className={styles.results}>
      <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); setQuery(draft.trim()); setPage(0); setReload((value) => value + 1); }}><label className={styles.search}><span>Account ID or reference</span><input value={draft} maxLength={200} onChange={(event) => setDraft(event.target.value)} /></label><button className={styles.button}>Search</button><button type="button" className={styles.button} onClick={() => setReload((value) => value + 1)}>Refresh</button></form>
      {loading ? <p role="status">Loading restricted accounts…</p> : <DataTable columns={[
        { key: 'account', label: 'Account', render: (row) => <Link href={`/dashboard/accounts/accounts/${row.accountId}`}>{row.accountReference || `Account #${row.accountId}`}</Link> },
        { key: 'amount', label: 'Still owed', render: (row) => <RecoveryMoney totals={row.totalOwed} /> },
        { key: 'recovery', label: 'Recovery', render: (row) => <button className={styles.textButton} onClick={() => setSelected(row.accountId)}>Review and lift restriction</button> }
      ]} rows={result?.content || []} page={page} pageSize={20} totalPages={result?.totalPages || 0} totalElements={result?.totalElements || 0} onPageChange={setPage} showIndex={false} showAccountQuickNav={false} emptyLabel="No accounts currently have an active refund recovery restriction." />}
    </section>
    {selected != null && <RecoveryAccountDialog key={`${identity}-${selected}`} accountId={selected} onClose={() => setSelected(null)} onChanged={() => setReload((value) => value + 1)} />}
  </div>;
}
