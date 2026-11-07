'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { failoverPermissions, payoutCapabilities } from '@/lib/payout-failover';
import { Card, Alert, useFailoverError } from '@/components/payout-failover/Common';
import { initialFailoverView } from '@/lib/failover-presentation';
import { FailoverIntro, FailoverNavigation, FailoverOverview } from '@/components/failover/Experience';
import PolicyPanel from '@/components/payout-failover/PolicyPanel';
import OperationsPanel from '@/components/payout-failover/OperationsPanel';
import HistoryPanel from '@/components/payout-failover/HistoryPanel';
import ManualRetryPanel from '@/components/payout-failover/ManualRetryPanel';

export default function PayoutFailoverPage() {
  const { session, enableRegulatorMode } = useAuth();
  const { canRead, canPublish } = failoverPermissions(session);
  const search = useSearchParams();
  const [tab, setTab] = useState(() => initialFailoverView(search));
  const [capabilities, setCapabilities] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  const [snapshot, setSnapshot] = useState(null);
  const [capabilitiesReady, setCapabilitiesReady] = useState(false);
  const [revision, setRevision] = useState(null), [historyRevision, setHistoryRevision] = useState(search.get('revision'));
  const fail = useFailoverError(setError);
  const visible = canRead && enableRegulatorMode === false;
  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    setLoading(true); setError(''); setCapabilitiesReady(false);
    api.payoutFailover.capabilities().then((response) => {
      const supported = payoutCapabilities(response);
      if (active) { setCapabilities(supported); setCapabilitiesReady(true); }
    }).catch((err) => { if (active) void fail(err); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, reload, fail]);
  const showHistory = useCallback((value) => { setHistoryRevision(value); setTab('history'); }, []);
  if (!canRead) return <Card title="Payout failover"><Alert>Permission denied. Admin or Super Admin access is required.</Alert></Card>;
  if (enableRegulatorMode !== false) return <Card title="Payout failover">This area is unavailable in the current dashboard presentation.</Card>;
  return <div className="payout-failover failover-workspace">
    <FailoverIntro kind="payout" capabilities={capabilities} canPublish={canPublish} loading={loading} onRefresh={() => setReload((value) => value + 1)}><Alert>{error}</Alert></FailoverIntro>
    {capabilities ? <>
      <FailoverNavigation kind="payout" view={tab} onChange={setTab} />
      <div hidden={tab !== 'overview'}><FailoverOverview kind="payout" snapshot={snapshot} canPublish={canPublish} onSetup={() => setTab('setup')} onActivation={() => setTab('activation')} onActivity={() => setTab('operations')} /></div>
      {capabilities.allowsManualResubmit === true ? <div hidden={tab !== 'operations'}><ManualRetryPanel key={`${session?.tokens?.accessToken?.payload?.sub || session?.tokens?.idToken?.payload?.sub || ''}:${search.get('transactionId') || ''}`} initialTransactionId={search.get('transactionId')} enabled={capabilitiesReady} active={tab === 'operations'} /></div> : null}
      <div hidden={!['overview', 'operations'].includes(tab)}><OperationsPanel view={tab === 'overview' ? 'overview' : 'operations'} capabilities={capabilities} onHistory={showHistory} initialTransactionId={search.get('transactionId')} /></div>
      <div hidden={!['setup', 'activation'].includes(tab)}><PolicyPanel view={tab === 'activation' ? 'activation' : 'setup'} capabilities={capabilities} capabilitiesReady={capabilitiesReady} canPublish={canPublish} onRevision={setRevision} onPolicy={setSnapshot} active={['setup', 'activation'].includes(tab)} /></div>
      <div hidden={tab !== 'history'}><HistoryPanel active={tab === 'history'} latestRevision={revision} focusRevision={historyRevision} /></div>
    </> : loading ? <Card><span role="status">Loading supported payout providers…</span></Card> : null}
  </div>;
}
