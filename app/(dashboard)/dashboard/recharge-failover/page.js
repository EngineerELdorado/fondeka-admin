'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { failoverPermissions } from '@/lib/payout-failover';
import { rechargeCapabilities } from '@/lib/recharge-failover';
import { Alert, Card, useFailoverError } from '@/components/payout-failover/Common';
import { initialFailoverView } from '@/lib/failover-presentation';
import { FailoverIntro, FailoverNavigation, FailoverOverview } from '@/components/failover/Experience';
import ProductsPanel from '@/components/recharge-failover/ProductsPanel';
import PolicyPanel from '@/components/recharge-failover/PolicyPanel';
import OperationsPanel from '@/components/recharge-failover/OperationsPanel';
import HistoryPanel from '@/components/recharge-failover/HistoryPanel';

export default function RechargeFailoverPage() {
  const { session, enableRegulatorMode } = useAuth();
  const { canRead, canPublish } = failoverPermissions(session);
  const search = useSearchParams();
  const [tab, setTab] = useState(() => initialFailoverView(search));
  const [capabilities, setCapabilities] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [reload, setReload] = useState(0);
  const [saved, setSaved] = useState(null), [selection, setSelection] = useState({ token: 0, rule: null }), [incoming, setIncoming] = useState(null), [historyRevision, setHistoryRevision] = useState(search.get('revision'));
  const [setupStep, setSetupStep] = useState(search.get('tab') === 'policy' ? 'rules' : 'products');
  const [policyBusy, setPolicyBusy] = useState(false);
  const sequence = useRef(0), fail = useFailoverError(setError), visible = canRead && enableRegulatorMode === false;
  useEffect(() => {
    if (!visible) return undefined;
    let active = true; setLoading(true); setError('');
    api.rechargeFailover.capabilities().then((response) => { const value = rechargeCapabilities(response); if (active) setCapabilities(value); }).catch((err) => { if (active) void fail(err); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, reload, fail]);
  const inspect = useCallback((rule) => { setSelection({ token: ++sequence.current, rule: rule ? JSON.parse(JSON.stringify(rule)) : null }); setSetupStep('products'); setTab('setup'); }, []);
  const useMapping = useCallback((rule) => { if (policyBusy) return; setIncoming({ token: ++sequence.current, rule }); setSetupStep('rules'); setTab('setup'); }, [policyBusy]);
  const showHistory = useCallback((revision) => { setHistoryRevision(revision); setTab('history'); }, []);
  if (!canRead) return <Card title="Recharge failover"><Alert>Permission denied. Admin or Super Admin access is required.</Alert></Card>;
  if (enableRegulatorMode !== false) return <Card title="Recharge failover">This wallet-funded area is unavailable in the current dashboard presentation.</Card>;
  return <div className="recharge-failover failover-workspace">
    <FailoverIntro kind="recharge" canPublish={canPublish} loading={loading} onRefresh={() => setReload((value) => value + 1)}><Alert>{error}</Alert></FailoverIntro>
    {capabilities ? <>
      <FailoverNavigation kind="recharge" view={tab} onChange={setTab} />
      <div hidden={tab !== 'overview'}><FailoverOverview kind="recharge" snapshot={saved} canPublish={canPublish} onSetup={() => { setSetupStep(saved?.configuration.rules.length ? 'rules' : 'products'); setTab('setup'); }} onActivation={() => setTab('activation')} onActivity={() => setTab('operations')} /></div>
      <div hidden={!['overview', 'operations'].includes(tab)}><OperationsPanel view={tab === 'overview' ? 'overview' : 'operations'} onHistory={showHistory} initialTransactionId={search.get('transactionId')} /></div>
      <div hidden={tab !== 'setup'}>
        <nav className="failover-setup-navigation" aria-label="Recharge backup setup steps"><button type="button" aria-pressed={setupStep === 'products'} onClick={() => setSetupStep('products')}>1. Review product pair</button><span aria-hidden="true">→</span><button type="button" aria-pressed={setupStep === 'rules'} onClick={() => setSetupStep('rules')}>2. Save pairs & accounts</button></nav>
        <div hidden={setupStep !== 'products'}><ProductsPanel key={selection.token} selectedRule={selection.rule} capabilities={capabilities} canPublish={canPublish} ready={Boolean(saved) && !policyBusy} onUse={useMapping} /></div>
      </div>
      <div hidden={tab !== 'activation' && !(tab === 'setup' && setupStep === 'rules')}><PolicyPanel view={tab === 'activation' ? 'activation' : 'setup'} capabilities={capabilities} canPublish={canPublish} onPolicy={setSaved} onBusyChange={setPolicyBusy} onInspect={inspect} incoming={incoming} onSetup={() => { setSetupStep('rules'); setTab('setup'); }} /></div>
      <div hidden={tab !== 'history'}><HistoryPanel active={tab === 'history'} revision={saved?.revision} focusRevision={historyRevision} /></div>
    </> : loading ? <Card><span role="status">Loading supported recharge providers…</span></Card> : null}
  </div>;
}
