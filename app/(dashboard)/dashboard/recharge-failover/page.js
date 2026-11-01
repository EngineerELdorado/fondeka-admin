'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { failoverPermissions } from '@/lib/payout-failover';
import { rechargeCapabilities } from '@/lib/recharge-failover';
import { Alert, Card, useFailoverError } from '@/components/payout-failover/Common';
import ProductsPanel from '@/components/recharge-failover/ProductsPanel';
import PolicyPanel from '@/components/recharge-failover/PolicyPanel';
import OperationsPanel from '@/components/recharge-failover/OperationsPanel';
import HistoryPanel from '@/components/recharge-failover/HistoryPanel';

export default function RechargeFailoverPage() {
  const { session, enableRegulatorMode } = useAuth();
  const { canRead, canPublish } = failoverPermissions(session);
  const search = useSearchParams();
  const [tab, setTab] = useState(() => ['policy', 'products', 'history'].includes(search.get('tab')) ? search.get('tab') : 'operations');
  const [capabilities, setCapabilities] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [reload, setReload] = useState(0);
  const [saved, setSaved] = useState(null), [selection, setSelection] = useState({ token: 0, rule: null }), [incoming, setIncoming] = useState(null), [historyRevision, setHistoryRevision] = useState(search.get('revision'));
  const [policyBusy, setPolicyBusy] = useState(false);
  const sequence = useRef(0), fail = useFailoverError(setError), visible = canRead && enableRegulatorMode === false;
  useEffect(() => {
    if (!visible) return undefined;
    let active = true; setLoading(true); setError('');
    api.rechargeFailover.capabilities().then((response) => { const value = rechargeCapabilities(response); if (active) setCapabilities(value); }).catch((err) => { if (active) void fail(err); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, reload, fail]);
  const inspect = useCallback((rule) => { setSelection({ token: ++sequence.current, rule: rule ? JSON.parse(JSON.stringify(rule)) : null }); setTab('products'); }, []);
  const useMapping = useCallback((rule) => { if (policyBusy) return; setIncoming({ token: ++sequence.current, rule }); setTab('policy'); }, [policyBusy]);
  const showHistory = useCallback((revision) => { setHistoryRevision(revision); setTab('history'); }, []);
  if (!canRead) return <Card title="Recharge failover"><Alert>Permission denied. Admin or Super Admin access is required.</Alert></Card>;
  if (enableRegulatorMode !== false) return <Card title="Recharge failover">This wallet-funded area is unavailable in the current dashboard presentation.</Card>;
  return <div className="recharge-failover">
    <Card><div className="failover-heading"><div><h1>Airtime, data & bundle failover</h1><p>Inspect equivalent fixed products, publish reviewed mappings and investigate managed purchases.</p></div><button type="button" className="btn-neutral" disabled={loading} onClick={() => setReload((value) => value + 1)}>{loading ? 'Loading…' : 'Refresh recharge capabilities'}</button></div>
      <strong data-testid="recharge-header-status">{saved ? 'Saved recharge revision ' + saved.revision + ' · Effective switch ' + (saved.configuration.enabled && !saved.emergencyDisabled ? 'ON' : 'OFF') : 'Loading saved recharge state…'}</strong>
      <p>This separate policy starts disabled. Payout failover settings do not enable it. A maximum of two distinct providers preserves the original debit, transaction and quote.</p>
      <small>Only FIXED direct-delivery products funded by an existing legacy-account or fiat-wallet debit are eligible. External collections, loans, crypto-wallet funding, RANGE and PIN/redemption products keep their existing path.</small>
      {!canPublish ? <small>You can inspect, prepare local preview drafts and investigate. Publishing and activation require Super Admin access.</small> : null}
      <Alert>{error}</Alert>
    </Card>
    {capabilities ? <>
      <nav className="failover-actions" aria-label="Recharge failover views">{[['operations', 'Recharge overview & operations'], ['products', 'Product inspections & approvals'], ['policy', 'Recharge policy & rollout'], ['history', 'Recharge revision history']].map(([key, label]) => <button type="button" key={key} aria-pressed={tab === key} className={tab === key ? 'btn-primary' : 'btn-neutral'} onClick={() => setTab(key)}>{label}</button>)}</nav>
      <div hidden={tab !== 'operations'}><OperationsPanel onHistory={showHistory} initialTransactionId={search.get('transactionId')} /></div>
      <div hidden={tab !== 'products'}><ProductsPanel key={selection.token} selectedRule={selection.rule} capabilities={capabilities} canPublish={canPublish} ready={Boolean(saved) && !policyBusy} onUse={useMapping} /></div>
      <div hidden={tab !== 'policy'}><PolicyPanel capabilities={capabilities} canPublish={canPublish} onPolicy={setSaved} onBusyChange={setPolicyBusy} onInspect={inspect} incoming={incoming} /></div>
      <div hidden={tab !== 'history'}><HistoryPanel active={tab === 'history'} revision={saved?.revision} focusRevision={historyRevision} /></div>
      <Card title="Fixed safeguards">
        <p>{capabilities.maximumAttempts} attempts maximum · {capabilities.priceTypes.join(', ')} products · Existing wallet/account debit only. No loops, cycling, parallel purchase or second customer debit.</p>
        <p>Accepted, missing, timed-out and queued requests never authorize another purchase. Zendit IN_PROGRESS can be queued for provider retries. Provider errors alone and names/prices that look similar are not approval evidence.</p>
        <p>Pausing prevents new claims and retains refund protection and status recovery. An already claimed attempt may still be sent. Refund reservations are not proof of credit; consult the original transaction and every attempt.</p>
      </Card>
    </> : loading ? <Card><span role="status">Loading recharge capabilities…</span></Card> : null}
  </div>;
}
