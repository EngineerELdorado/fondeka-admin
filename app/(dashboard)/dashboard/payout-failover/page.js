'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { failoverPermissions } from '@/lib/payout-failover';
import { Card, Alert, useFailoverError } from '@/components/payout-failover/Common';
import PolicyPanel from '@/components/payout-failover/PolicyPanel';
import OperationsPanel from '@/components/payout-failover/OperationsPanel';
import HistoryPanel from '@/components/payout-failover/HistoryPanel';

export default function PayoutFailoverPage() {
  const { session, enableRegulatorMode } = useAuth();
  const { canRead, canPublish } = failoverPermissions(session);
  const search = useSearchParams();
  const [tab, setTab] = useState(() => ['policy', 'history'].includes(search.get('tab')) ? search.get('tab') : 'operations');
  const [capabilities, setCapabilities] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  const [revision, setRevision] = useState(null), [historyRevision, setHistoryRevision] = useState(search.get('revision'));
  const fail = useFailoverError(setError);
  const visible = canRead && enableRegulatorMode === false;
  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    setLoading(true); setError('');
    api.payoutFailover.capabilities().then((response) => {
      if (!response || !Array.isArray(response.providers) || !Array.isArray(response.errorCodes) || !Array.isArray(response.actions) || !Number.isInteger(response.maximumProviders)) throw new Error('Payout failover capabilities are unavailable. Deploy the backend and refresh.');
      if (active) setCapabilities(response);
    }).catch((err) => { if (active) void fail(err); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, reload, fail]);
  const showHistory = useCallback((value) => { setHistoryRevision(value); setTab('history'); }, []);
  if (!canRead) return <Card title="Payout failover"><Alert>Permission denied. Admin or Super Admin access is required.</Alert></Card>;
  if (enableRegulatorMode !== false) return <Card title="Payout failover">This area is unavailable in the current dashboard presentation.</Card>;
  return <div className="payout-failover">
    <Card><div className="failover-heading"><div><h1>Payout failover</h1><p>Publish routing rules, review eligibility and investigate recorded payout attempts.</p></div><button type="button" className="btn-neutral" disabled={loading} onClick={() => setReload((value) => value + 1)}>{loading ? 'Loading…' : 'Refresh capabilities'}</button></div>
      <p>Automatic failover starts off. Pausing blocks new alternate claims; an alternate already claimed can continue. Policy changes do not cancel, refund or resend payments.</p>
      {!canPublish ? <small>Policy publishing and activation require Super Admin access. You can preview and investigate.</small> : null}
      <Alert>{error}</Alert>
    </Card>
    {capabilities ? <>
      <nav className="failover-actions" aria-label="Payout failover views">{[['operations', 'Overview & operations'], ['policy', 'Policy & rollout'], ['history', 'Revision history']].map(([key, label]) => <button type="button" key={key} className={tab === key ? 'btn-primary' : 'btn-neutral'} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</nav>
      <div hidden={tab !== 'operations'}><OperationsPanel capabilities={capabilities} onHistory={showHistory} initialTransactionId={search.get('transactionId')} /></div>
      <div hidden={tab !== 'policy'}><PolicyPanel capabilities={capabilities} canPublish={canPublish} onRevision={setRevision} /></div>
      <div hidden={tab !== 'history'}><HistoryPanel active={tab === 'history'} latestRevision={revision} focusRevision={historyRevision} /></div>
    </> : loading ? <Card><span role="status">Loading payout failover capabilities…</span></Card> : null}
  </div>;
}
