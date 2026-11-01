'use client';

import { useEffect, useState } from 'react';
import { failoverSummary, failoverViews } from '@/lib/failover-presentation';
import { Card, formatInstant } from '@/components/payout-failover/Common';

export { default as HelpTip } from './HelpTip';

export function FailoverIntro({ kind, canPublish, loading, onRefresh, children }) {
  const payout = kind === 'payout';
  return <header className="card failover-intro">
    <div className="failover-heading"><div><span className="failover-eyebrow">Automatic provider backup</span><h1>{payout ? 'Payout failover' : 'Recharge failover'}</h1><p>{payout ? 'Use Maplerad as a backup when pawaPay confirms an eligible payout rejection.' : 'Use an approved equivalent product from a second provider when an airtime, data or bundle purchase is confirmed not delivered.'}</p></div>
      <button type="button" className="btn-neutral btn-sm" disabled={loading} onClick={onRefresh} title="Reload supported providers, failure conditions and fixed limits. This does not save or enable anything.">{loading ? 'Loading provider information…' : 'Refresh provider information'}</button>
    </div>
    <div className="failover-provider-flow" aria-label="Supported backup direction"><span>{payout ? 'pawaPay' : 'RELOADLY'}</span><span aria-hidden="true">{payout ? '→' : '⇄'}</span><span>{payout ? 'Maplerad' : 'ZENDIT'}</span><small>{payout ? 'Primary → backup · same mobile-money method' : 'A separate reviewed product pair is needed for each direction'}</small></div>
    <p className="failover-core-promise">One customer transaction. One original quote and debit. At most one backup attempt.</p>
    <details className="failover-learn"><summary>How does failover work?</summary><div className="failover-card"><p>The primary provider handles the original payment. A backup is allowed only after the required failure evidence and all saved rules match. An accepted, pending or uncertain request is not permission to send another payment.</p><p>{payout ? 'This system requires a reviewed synchronous rejection. A timeout, generic HTTP error or customer insufficient balance cannot trigger the backup.' : 'This system requires verified terminal non-delivery. Similar product names or prices do not prove equivalent benefits.'}</p><p>Pausing stops new backup attempts. Existing attempts, callbacks and recovery continue; pausing does not cancel or refund payments.</p><p>{payout ? 'Payout and recharge failover are separate policies.' : 'Only FIXED direct-delivery products with an existing account or fiat-wallet debit are supported. External collections, loans, crypto-wallet funding, RANGE and PIN products retain their existing path.'}</p></div></details>
    {!canPublish ? <div className="failover-readonly">Read-only admin access: you can preview and investigate. A Super Admin must save, enable or pause a setup.</div> : null}
    {children}
  </header>;
}

export function FailoverNavigation({ kind, view, onChange }) {
  return <nav className="failover-navigation" aria-label={`${kind === 'payout' ? 'Payout' : 'Recharge'} failover sections`}>{failoverViews.map(([key, label]) => <button type="button" key={key} aria-pressed={view === key} className={view === key ? 'is-active' : ''} onClick={() => onChange(key)}>{label}</button>)}</nav>;
}

export function FailoverOverview({ snapshot, kind, canPublish, onSetup, onActivation, onActivity }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const status = failoverSummary(snapshot, kind, now), payout = kind === 'payout';
  const steps = payout ? [
    ['Choose a backup route', 'Pair a pawaPay route with a compatible Maplerad route. Choose only the supported failure conditions.'],
    ['Save rules and covered accounts', 'Start with selected customer accounts. Saving an off setup does not turn backups on.'],
    ['Turn on for new payments', 'Choose a future UTC start time. Payments created earlier stay excluded.']
  ] : [
    ['Review an equivalent product pair', 'Inspect both provider products and confirm benefits, network, cost limits and approval expiry.'],
    ['Save pairs and covered accounts', 'Add reviewed pairs to the draft and choose customer accounts. Save before enabling.'],
    ['Turn on for new purchases', 'Choose a future UTC start time. Old or already-legacy purchases cannot be adopted.']
  ];
  return <>
    <Card title="Saved status">
      <div className="failover-status-heading"><span className={`failover-state failover-state--${status.state}`}>{status.label}</span><p>{status.description}</p></div>
      {status.state !== 'unavailable' ? <>
        <dl className="failover-status-grid"><div><dt>Saved backup rules</dt><dd>{status.enabledRules} enabled / {status.ruleCount} total</dd></div><div><dt>Customer accounts covered</dt><dd>{status.coverage}</dd></div><div><dt>New payments eligible after</dt><dd>{status.createdAfter ? formatInstant(status.createdAfter) : 'Choose when turning on'}</dd></div></dl>
        {status.enabledRules === 0 ? <div className="failover-notice">No enabled backup rules are saved. No payment can switch provider until a matching rule is configured and enabled.</div> : null}
        <details className="failover-technical"><summary>Configuration details</summary><p>Saved version {status.revision ?? '—'}{status.source ? ` · Source: ${status.source}` : ''}. A new saved version records who changed the setup and why.</p><p>The infrastructure emergency switch can block backups even when the configured switch is on. Provider funds and each recipient&apos;s eligibility still need to pass at execution.</p></details>
      </> : null}
      <div className="failover-actions"><button type="button" className="btn-primary" onClick={onSetup}>{canPublish ? status.ruleCount ? 'Review backup setup' : 'Set up a backup' : 'Review saved setup'}</button><button type="button" className="btn-neutral" onClick={onActivation}>{canPublish ? 'Manage on / pause state' : 'View activation settings'}</button><button type="button" className="btn-neutral" onClick={onActivity}>Find a payment</button></div>
    </Card>
    <Card title="Set up in three steps"><ol className="failover-getting-started">{steps.map(([title, description], index) => <li key={title}><span className="failover-step-number">{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ol></Card>
  </>;
}

export function SetupStep({ number, title, children }) {
  return <div className="failover-setup-step"><span className="failover-step-number">{number}</span><div><h3>{title}</h3>{children ? <p>{children}</p> : null}</div></div>;
}

export function EmptyPayments({ kind }) {
  return <div className="failover-empty"><strong>No {kind === 'payout' ? 'payouts' : 'purchases'} tracked here yet</strong><p>This list contains payments recorded by failover. Saving rules or running a preview does not create a payment or populate this list.</p><p>{kind === 'payout' ? 'Check the dates and filters.' : 'Check the search filters.'} Ordinary transactions that were never managed by this system remain in the main transaction history.</p></div>;
}

export function ConfigurationSummary({ configuration, kind }) {
  if (!configuration) return <p>Configuration details are unavailable.</p>;
  const rules = configuration.rules || [];
  return <div className="failover-card" style={{ marginTop: '.8rem' }}><dl className="failover-status-grid"><div><dt>Configured switch</dt><dd>{configuration.enabled ? 'On' : 'Off'}</dd></div><div><dt>Accounts covered</dt><dd>{configuration.accountIds?.length ? configuration.accountIds.join(', ') : 'All eligible accounts'}</dd></div><div><dt>Payments created after</dt><dd>{formatInstant(configuration.createdAfter)}</dd></div></dl><strong>{rules.length} saved backup rule{rules.length === 1 ? '' : 's'}</strong><ul>{rules.map((rule) => <li key={rule.id}>{kind === 'payout' ? `${rule.name || rule.id}: route #${rule.sourceRouteId} → route #${rule.targetRouteId}` : `${rule.country} · ${rule.type} · ${rule.networkIdentity}: ${rule.source?.provider} → ${rule.target?.provider}`} · {rule.enabled ? 'Enabled' : 'Disabled'}</li>)}</ul></div>;
}
