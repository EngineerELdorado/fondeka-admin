'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { ContentModal } from '@/components/ContentModal';
import { resellerList, resellerPayload, resellerSameScope, resellerRootPolicy, resellerScope, resellerLabel, resellerNumber, filterResellerRules } from '@/lib/resellers';
import ResellerEditor from './Editor';
import EffectivePolicy from './EffectivePolicy';
import { Card, Alert, Badge, BehaviorFacts, Facts, Field, ResourceStatus, actionStyle, gridStyle, useResellerResource, useResellerError, useMounted } from './Common';
import styles from './resellers.module.css';

export default function ConfigurationPanel({ kind, accountId = null, canWrite, onChanged }) {
  const name = kind === 'rule' ? 'rules' : 'policies';
  const matchesScope = useCallback((row) => String(row.accountId ?? '') === String(accountId ?? ''), [accountId]);
  const load = useCallback(async () => {
    const rows = resellerList(await api.resellers[name].list(accountId), kind);
    if (!rows.every(matchesScope)) throw new Error('The returned configuration does not match this account/global scope. Refresh before editing.');
    return rows;
  }, [accountId, kind, name, matchesScope]);
  const resource = useResellerResource(load);
  const [editing, setEditing] = useState(null), [deleting, setDeleting] = useState(null), [inspecting, setInspecting] = useState(null);
  const [notice, setNotice] = useState('');
  const [filters, setFilters] = useState({ search: '', status: '' });
  const rows = useMemo(() => kind === 'rule' ? filterResellerRules(resource.data || [], filters) : resource.data, [resource.data, kind, filters]);
  const reloadRecord = async (base, draft) => {
    if (kind === 'policy' && base.id != null) {
      const next = await api.resellers.policies.get(base.id);
      if (!matchesScope(next)) throw new Error('This policy moved to another account/global scope. Close and refresh the list.');
      return next;
    }
    const rows = await load();
    return base.id != null ? rows.find((row) => row.id === base.id) : rows.find((row) => resellerSameScope(row, resellerPayload(kind, draft, {})));
  };
  const changed = () => { resource.reload(); setNotice('Saved configuration updated. Existing purchase snapshots keep their original terms.'); onChanged?.(); };
  const columns = [
    { key: 'scope', label: 'Applies to', priority: 0, render: (row) => row.billProductId != null ? row.billProductCode || `Product ${row.billProductId}` : row.service === 'BILL_PAYMENTS' ? 'All bill products' : row.service ? resellerLabel(row.service) : 'All services' },
    ...(kind === 'rule' ? [
      { key: 'enabled', label: 'Rule', render: (row) => <Badge enabled={row.enabled} yes={row.percentage === 0 ? 'Enabled · no reward (0%)' : 'Enabled'} no="Disabled" /> },
      { key: 'percentage', label: 'Rate', render: (row) => `${resellerNumber(row.percentage)}%` },
      { key: 'basis', label: 'Basis', render: (row) => resellerLabel(row.basis) },
      { key: 'maxPoints', label: 'Points cap', render: (row) => row.maxPoints == null ? 'No cap' : `${resellerNumber(row.maxPoints)} per currency` }
    ] : [
      { key: 'eligibleInviteeRewardMode', label: 'Qualified invitees', render: (row) => resellerLabel(row.eligibleInviteeRewardMode) },
      { key: 'ownPurchaseRewardsEnabled', label: 'Own purchases', render: (row) => resellerLabel(row.ownPurchaseRewardsEnabled) },
      { key: 'preEnrollmentPointsRedeemable', label: 'Previously earned points', render: (row) => row.preEnrollmentPointsRedeemable == null ? 'Inherit' : row.preEnrollmentPointsRedeemable ? 'Redeemable' : 'Hold unredeemed' }
    ]),
    { key: 'actions', label: 'Actions', render: (row) => <>
      <button type="button" className="btn-neutral btn-sm" onClick={() => setInspecting(row)}>Details</button>
      {canWrite ? <><button type="button" className="btn-neutral btn-sm" disabled={!resource.ready} onClick={() => setEditing(row)}>Edit</button>{kind !== 'policy' || !resellerRootPolicy(row) ? <button type="button" className="btn-danger btn-sm" disabled={!resource.ready} onClick={() => setDeleting(row)}>Delete / inherit</button> : null}</> : null}
    </> }
  ];
  return <div style={{ display: 'grid', gap: '1rem' }}>
    <Card title={kind === 'rule' ? 'Commission rates' : 'Reward behavior'}>
      <div style={{ ...actionStyle, justifyContent: 'space-between' }}><strong>{accountId == null ? 'Global defaults' : `Overrides for account ${accountId}`}</strong><div style={actionStyle}><button type="button" className="btn-neutral" disabled={resource.loading} onClick={resource.reload}>Refresh</button>{canWrite ? <button type="button" className="btn-primary" disabled={!resource.ready} onClick={() => setEditing(kind === 'policy' && accountId == null ? { service: 'BILL_PAYMENTS' } : {})}>New {kind === 'rule' ? 'rule' : 'override'}</button> : <span>Read only — Super Admin required.</span>}</div></div>
      <p className={styles.scope}>{kind === 'rule' ? accountId == null ? 'Configure each product once. New and existing enrolled resellers automatically inherit these defaults; no product assignment is needed.' : 'Optional negotiated exceptions for this account. Leave overrides empty to inherit global product rates.' : 'Choose how own purchases and direct invitee purchases earn rewards.'}</p>
      {kind === 'rule' ? <div style={gridStyle}>
        <Field label="Find a product"><input type="search" placeholder="Product name, code or ID" value={filters.search} onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))} /></Field>
        <Field label="Rule status"><select value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}><option value="">All rules</option><option value="enabled">Enabled with a positive rate</option><option value="disabled">Disabled</option><option value="zero">Enabled at 0% (no reward)</option></select></Field>
      </div> : null}
      <details className={styles.help}><summary>{kind === 'rule' ? 'How rates are applied' : 'How reward settings are inherited'}</summary>
        <p>{kind === 'rule' ? 'Use specific product rules to offer selected products and leave the service-wide default disabled. The first matching rate wins, including disabled or zero rates. Account overrides take priority, even over a disabled global product rule. Delete an override to restore inheritance. Changes apply to future purchases.' : 'Each field inherits separately. Inherit uses the next matching setting; Disabled explicitly stops that field. Delete an override to restore inheritance.'}</p>
        <ol>{(kind === 'rule' ? ['Account + product', 'Account default for the service', 'Global + product', 'Global default for the service'] : ['Account + product', 'Account + service', 'Account default', 'Global + product', 'Global + service', 'Global default']).map((scope) => <li key={scope}>{scope}</li>)}</ol>
        <p>{kind === 'rule' ? 'A points cap is in the purchase currency. A cap of 10 means 10 USD on a USD purchase and 10 CDF on a CDF purchase.' : 'Previously earned points means the unredeemed points earned from an invitee before they became a reseller. Changing this setting can hold or release those points immediately in both reward programs; wallet credits remain intact. Other reward choices apply to future purchases.'}</p>
        {kind === 'rule' ? <p>A positive enabled rule still requires a supported, active, available product, the account’s catalogue access, enrollment, and earning settings. Enrollment does not copy rates into account overrides. Existing purchase snapshots keep their terms.</p> : null}
      </details>
      <ResourceStatus resource={resource} /><Alert success>{notice}</Alert>
    </Card>
    {resource.data ? <>{kind === 'rule' ? <div style={{ ...actionStyle, justifyContent: 'space-between' }}><small>{rows.length} of {resource.data.length} rules</small>{filters.search || filters.status ? <button type="button" className="btn-neutral btn-sm" onClick={() => setFilters({ search: '', status: '' })}>Clear rate filters</button> : null}</div> : null}<DataTable key={kind === 'rule' ? JSON.stringify(filters) : 'policies'} columns={columns} rows={rows} showAccountQuickNav={false} showIndex={false} emptyLabel={kind === 'policy' ? `No ${accountId == null ? 'global behavior settings' : 'behavior overrides'} saved.` : resource.data.length ? 'No rules match these filters.' : accountId == null ? 'No global settings saved. Add a rule for a specific bill product.' : 'No overrides saved. This account inherits global rates.'} /></> : null}
    {kind === 'policy' ? <details className={`card ${styles.help}`}><summary>Check which settings apply</summary><div style={{ marginTop: '.8rem' }}><EffectivePolicy accountId={accountId} /></div></details> : null}
    {editing ? <ResellerEditor kind={kind} record={editing} accountId={accountId} canWrite={canWrite} onClose={() => setEditing(null)} onReload={reloadRecord} onSave={async (payload, base) => {
      if (!matchesScope(payload)) throw new Error('The account/global scope changed. Close and reopen the editor.');
      const next = await (base.id == null ? api.resellers[name].create(payload) : api.resellers[name].update(base.id, payload));
      if (!next || !matchesScope(next)) throw new Error('The saved account/global scope could not be confirmed. Refresh before retrying.');
      return next;
    }} onSaved={changed} /> : null}
    {inspecting ? <ContentModal title={`${kind === 'rule' ? 'Commission rule' : 'Behavior policy'} · ${resellerScope(inspecting)}`} onClose={() => setInspecting(null)}>{kind === 'policy' ? <BehaviorFacts values={inspecting} /> : <Facts rows={Object.entries(inspecting).map(([key, value]) => [key, typeof value === 'boolean' ? resellerLabel(value) : value])} />}{kind === 'policy' ? <Facts rows={['id', 'version', 'notes'].map((key) => [key, inspecting[key]])} /> : null}</ContentModal> : null}
    {deleting ? <DeleteConfiguration kind={kind} record={deleting} onClose={() => setDeleting(null)} reload={async (base) => reloadRecord(base)} onDeleted={() => { setDeleting(null); changed(); }} /> : null}
  </div>;
}

function DeleteConfiguration({ kind, record, reload, onClose, onDeleted }) {
  const [base, setBase] = useState(record), [latest, setLatest] = useState(null), [busy, setBusy] = useState(false), [stale, setStale] = useState(false), [denied, setDenied] = useState(false), [ack, setAck] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), fail = useResellerError(), mounted = useMounted();
  const retention = kind === 'policy' && record.preEnrollmentPointsRedeemable != null;
  const remove = async () => {
    if (lock.current || stale || denied || !ack) return;
    lock.current = true; setBusy(true); setError('');
    try { await api.resellers[kind === 'rule' ? 'rules' : 'policies'].remove(base.id, base.version); if (mounted.current) onDeleted(); }
    catch (err) { if (mounted.current) { setError(await fail(err)); if (err.status === 403) setDenied(true); if (err.status === 409 || !err.status || err.status >= 500) setStale(true); } }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const refresh = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { const next = await reload(base); if (mounted.current) { if (!next) setError('Record no longer exists. Close and refresh the list.'); else setLatest(next); } }
    catch (err) { if (mounted.current) setError(await fail(err)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return <ContentModal title="Delete configuration and restore inheritance" onClose={() => { if (!lock.current) onClose(); }}>
    <strong>{resellerScope(base)} · version {base.version}</strong>
    <Alert>{error}</Alert>
    <p>{retention ? 'Deleting this retention override can immediately hold or release unredeemed pre-enrollment points in both reward programs. Existing wallet credits and ledger entries remain intact.' : kind === 'rule' ? 'Deleting restores the next matching rule and can enable earning if a broader default is enabled. Disable the rule to exclude the product at this scope instead. Existing purchase snapshots keep their terms.' : 'This scope will use inherited behavior. Existing earning snapshots retain their terms.'}</p>
    <label style={actionStyle}><input type="checkbox" style={{ width: 'auto' }} checked={ack} disabled={busy || denied} onChange={(event) => setAck(event.target.checked)} />I reviewed the scope and inheritance change.</label>
    {stale ? <><button type="button" className="btn-neutral" disabled={busy} onClick={() => void refresh()}>Refresh before retrying</button>{latest ? <><Facts rows={Object.entries(latest).map(([key, value]) => [key, typeof value === 'boolean' ? resellerLabel(value) : value])} /><button type="button" className="btn-neutral" disabled={busy || denied} onClick={() => { setBase(latest); setLatest(null); setStale(false); setAck(false); }}>I reviewed version {latest.version}</button></> : null}</> : null}
    <div style={{ ...actionStyle, justifyContent: 'flex-end' }}><button type="button" className="btn-neutral" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="btn-danger" disabled={busy || stale || denied || !ack} onClick={() => void remove()}>Delete and inherit</button></div>
  </ContentModal>;
}
