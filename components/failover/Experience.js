'use client';

import { useEffect, useState } from 'react';
import { failoverSummary, failoverViews } from '@/lib/failover-presentation';
import { payoutScopeLabel } from '@/lib/payout-failover';
import ProviderContracts from '@/components/payout-failover/ProviderContracts';
import { Card, formatInstant } from '@/components/payout-failover/Common';

export { default as HelpTip } from './HelpTip';

export function FailoverIntro({ kind, canPublish, loading, onRefresh, capabilities, children }) {
  const payout = kind === 'payout';
  return <header className="card failover-intro">
    <div className="failover-heading"><div><h1>{payout ? 'Payout failover' : 'Recharge failover'}</h1><p>{payout ? 'Manage backup providers for payouts.' : 'Manage backup products for airtime, data and bundles.'}</p></div>
      <button type="button" className="btn-neutral btn-sm" disabled={loading} onClick={onRefresh} title="Reload supported providers, failure conditions and fixed limits. This does not save or enable anything.">{loading ? 'Loading provider information…' : 'Refresh provider information'}</button>
    </div>
    <details className="failover-learn"><summary>How does failover work?</summary><div className="failover-card">
      <div className="failover-provider-flow" aria-label="Supported backup direction"><span>{payout ? 'Original provider' : 'RELOADLY'}</span><span aria-hidden="true">{payout ? '→' : '⇄'}</span><span>{payout ? 'Next eligible alternate' : 'ZENDIT'}</span><small>{payout ? 'Same payment method and payout currency · provider order does not change primary ranks' : 'A separate reviewed product pair is needed for each direction'}</small></div>
      <p>One customer transaction, quote and debit. {payout ? capabilities ? `At most ${capabilities.maximumProviders} distinct providers, including the original.` : 'Provider limits load from backend capabilities.' : 'At most one backup attempt.'}</p>
      <p>A backup requires confirmed non-payment and matching saved rules. Pending, accepted or uncertain requests cannot simply be sent again.</p><p>{payout ? 'Each switch needs its source provider’s reviewed evidence. Timeouts, generic HTTP errors and customer insufficient balance cannot trigger a switch. An accepted payout can continue only after a qualifying final failure.' : 'Products must deliver equivalent benefits. Similar names or prices are not enough.'}</p><p>Turning off stops new backup attempts. Existing attempts and recovery continue. It does not cancel or refund payments.</p>{payout && capabilities ? <ProviderContracts capabilities={capabilities} /> : null}<p>{payout ? 'Payout and recharge failover are separate policies.' : 'Only FIXED direct-delivery products with an existing account or fiat-wallet debit are supported. External collections, loans, crypto-wallet funding, RANGE and PIN products retain their existing path.'}</p></div></details>
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
    ['Review defaults and exceptions', 'Inspect environment coverage. Use scoped defaults or explicit route pairs; blocked overrides stop inheritance.'],
    ['Save rules and covered accounts', 'Start with selected customer accounts. Saving an off setup does not turn backups on.'],
    ['Turn on for new payments', 'Use the automatic safe start or choose a future UTC time. Earlier payments stay excluded.']
  ] : [
    ['Review an equivalent product pair', 'Inspect both provider products and confirm benefits, network, cost limits and approval expiry.'],
    ['Save pairs and covered accounts', 'Add reviewed pairs to the draft and choose customer accounts. Save before enabling.'],
    ['Turn on for new purchases', 'Choose a future UTC start time. Old or already-legacy purchases cannot be adopted.']
  ];
  return <div className="failover-card">
    <Card title="Automatic failover">
      <div className="failover-status-heading"><span className={`failover-state failover-state--${status.state}`}>{status.label}</span><small>Saved version {status.revision ?? '—'}</small><button type="button" className="btn-primary" onClick={onActivation}>{canPublish ? 'Manage on / off' : 'View settings'}</button></div>
      {status.state !== 'unavailable' ? <>
        <dl className="failover-status-grid"><div><dt>{payout ? 'Rules & overrides' : 'Product pairs'}</dt><dd>{status.enabledRules} enabled <small>/ {status.ruleCount} total</small></dd>{payout ? <small>{status.routeRuleCount} route pairs · {status.scopedRuleCount} scopes</small> : null}</div><div><dt>Customer accounts</dt><dd>{status.coverage}</dd></div><div><dt>Start time (UTC)</dt><dd>{status.createdAfter ? formatInstant(status.createdAfter) : 'Set when turning on'}</dd></div></dl>
        {status.enabledRules === 0 ? <div className="failover-notice">{payout ? status.ruleCount === 0 ? 'Both rule lists are empty. Activation can discover validated environment defaults. Review coverage in Backup setup first.' : 'No saved rules or scopes are enabled. Activation preserves blocked overrides; it does not replace them with defaults.' : 'No enabled backup rules are saved. No payment can switch provider until a matching rule is configured and enabled.'}</div> : null}
        <details className="failover-technical"><summary>Status details</summary><p>{status.description}</p><p>Saved version {status.revision ?? '—'}{status.source ? ` · Source: ${status.source}` : ''}.{payout ? ` ${status.blockedScopes} blocked scopes.` : ''} A new saved version records who changed the setup and why.</p><p>The infrastructure emergency switch can block backups even when the configured switch is on. Provider funds and each recipient&apos;s eligibility still need to pass at execution.</p></details>
      </> : null}
      <div className="failover-actions"><button type="button" className="btn-neutral" onClick={onSetup}>{canPublish ? status.ruleCount ? 'Edit backup setup' : 'Set up a backup' : 'Review saved setup'}</button><button type="button" className="btn-neutral" onClick={onActivity}>Find a payment</button></div>
    </Card>
    <details className="card failover-technical"><summary>Setup guide</summary><ol className="failover-getting-started">{steps.map(([title, description], index) => <li key={title}><span className="failover-step-number">{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ol></details>
  </div>;
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
  const scopes = kind === 'payout' ? configuration.routingRules || [] : [];
  return <div className="failover-card" style={{ marginTop: '.8rem' }}><dl className="failover-status-grid"><div><dt>Configured switch</dt><dd>{configuration.enabled ? 'On' : 'Off'}</dd></div><div><dt>Accounts covered</dt><dd>{configuration.accountIds?.length ? configuration.accountIds.join(', ') : 'All eligible accounts'}</dd></div><div><dt>Payments created after</dt><dd>{formatInstant(configuration.createdAfter)}</dd></div></dl><strong>{rules.length} saved {kind === 'payout' ? 'route-pair' : 'backup'} rule{rules.length === 1 ? '' : 's'}</strong><ul>{rules.map((rule) => <li key={rule.id}>{kind === 'payout' ? `${rule.name || rule.id}: route #${rule.sourceRouteId} → route #${rule.targetRouteId}` : `${rule.country} · ${rule.type} · ${rule.networkIdentity}: ${rule.source?.provider} → ${rule.target?.provider}`} · {rule.enabled ? 'Enabled' : 'Disabled'}</li>)}</ul>{scopes.length ? <><strong>{scopes.length} scoped default{scopes.length === 1 ? '' : 's'} / overrides</strong><ul>{scopes.map((rule) => <li key={rule.id}>{rule.name || rule.id} · {payoutScopeLabel(rule)} · {rule.providers.join(' → ')} · {rule.enabled ? 'Allows backups' : 'Blocks backups; no inheritance'}</li>)}</ul></> : null}</div>;
}
