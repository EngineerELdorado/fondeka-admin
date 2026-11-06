'use client';

import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { ContentModal } from '@/components/ContentModal';
import { resellerList, resellerPayload, resellerSameScope, resellerRootPolicy, resellerScope, resellerLabel, resellerNumber } from '@/lib/resellers';
import ResellerEditor from './Editor';
import EffectivePolicy from './EffectivePolicy';
import { Card, Alert, Badge, BehaviorFacts, Facts, ResourceStatus, actionStyle, useResellerResource, useResellerError, useMounted } from './Common';
import styles from './resellers.module.css';

export default function ConfigurationPanel({ kind, accountId = null, canWrite, onChanged }) {
  const name = kind === 'rule' ? 'rules' : 'policies';
  const load = useCallback(async () => resellerList(await api.resellers[name].list(accountId), kind), [accountId, kind, name]);
  const resource = useResellerResource(load);
  const [editing, setEditing] = useState(null), [deleting, setDeleting] = useState(null), [inspecting, setInspecting] = useState(null);
  const [notice, setNotice] = useState('');
  const reloadRecord = async (base, draft) => {
    if (kind === 'policy' && base.id != null) return api.resellers.policies.get(base.id);
    const rows = resellerList(await api.resellers[name].list(accountId), kind);
    return base.id != null ? rows.find((row) => row.id === base.id) : rows.find((row) => resellerSameScope(row, resellerPayload(kind, draft, {})));
  };
  const changed = () => { resource.reload(); setNotice('Saved configuration updated. Existing purchase snapshots keep their original terms.'); onChanged?.(); };
  const columns = [
    { key: 'scope', label: 'Applies to', priority: 0, render: (row) => row.billProductId != null ? row.billProductCode || `Product ${row.billProductId}` : row.service === 'BILL_PAYMENTS' ? 'All bill products' : row.service ? resellerLabel(row.service) : 'All services' },
    ...(kind === 'rule' ? [
      { key: 'enabled', label: 'Status', render: (row) => <Badge enabled={row.enabled} no="Excluded" /> },
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
      <p className={styles.scope}>{kind === 'rule' ? accountId == null ? 'Set a percentage for each product, or a default for all bill products.' : 'Custom rates for this account. Without an override, global rates apply.' : 'Choose how own purchases and direct invitee purchases earn rewards.'}</p>
      <details className={styles.help}><summary>{kind === 'rule' ? 'How rates are applied' : 'How reward settings are inherited'}</summary>
        <p>{kind === 'rule' ? 'The first matching rate wins, including disabled or zero rates. Delete an override to use the next matching rate. Changes apply to future purchases.' : 'Each field inherits separately. Inherit uses the next matching setting; Disabled explicitly stops that field. Delete an override to restore inheritance.'}</p>
        <ol>{(kind === 'rule' ? ['Account + product', 'Account default for the service', 'Global + product', 'Global default for the service'] : ['Account + product', 'Account + service', 'Account default', 'Global + product', 'Global + service', 'Global default']).map((scope) => <li key={scope}>{scope}</li>)}</ol>
        <p>{kind === 'rule' ? 'A points cap is in the purchase currency. A cap of 10 means 10 USD on a USD purchase and 10 CDF on a CDF purchase.' : 'Previously earned points means the unredeemed points earned from an invitee before they became a reseller. Changing this setting can hold or release those points immediately in both reward programs; wallet credits remain intact. Other reward choices apply to future purchases.'}</p>
      </details>
      <ResourceStatus resource={resource} /><Alert success>{notice}</Alert>
    </Card>
    {resource.data ? <DataTable columns={columns} rows={resource.data} showAccountQuickNav={false} showIndex={false} emptyLabel={`No ${accountId == null ? 'global settings' : 'overrides'} saved.`} /> : null}
    {kind === 'policy' ? <details className={`card ${styles.help}`}><summary>Check which settings apply</summary><div style={{ marginTop: '.8rem' }}><EffectivePolicy accountId={accountId} /></div></details> : null}
    {editing ? <ResellerEditor kind={kind} record={editing} accountId={accountId} canWrite={canWrite} onClose={() => setEditing(null)} onReload={reloadRecord} onSave={(payload, base) => base.id == null ? api.resellers[name].create(payload) : api.resellers[name].update(base.id, payload)} onSaved={changed} /> : null}
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
    <p>{retention ? 'Deleting this retention override can immediately hold or release unredeemed pre-enrollment points in both reward programs. Existing wallet credits and ledger entries remain intact.' : 'This scope will use the next matching rule or inherited behavior. Existing earning snapshots retain their terms.'}</p>
    <label style={actionStyle}><input type="checkbox" style={{ width: 'auto' }} checked={ack} disabled={busy || denied} onChange={(event) => setAck(event.target.checked)} />I reviewed the scope and inheritance change.</label>
    {stale ? <><button type="button" className="btn-neutral" disabled={busy} onClick={() => void refresh()}>Refresh before retrying</button>{latest ? <><Facts rows={Object.entries(latest).map(([key, value]) => [key, typeof value === 'boolean' ? resellerLabel(value) : value])} /><button type="button" className="btn-neutral" disabled={busy || denied} onClick={() => { setBase(latest); setLatest(null); setStale(false); setAck(false); }}>I reviewed version {latest.version}</button></> : null}</> : null}
    <div style={{ ...actionStyle, justifyContent: 'flex-end' }}><button type="button" className="btn-neutral" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="btn-danger" disabled={busy || stale || denied || !ack} onClick={() => void remove()}>Delete and inherit</button></div>
  </ContentModal>;
}
