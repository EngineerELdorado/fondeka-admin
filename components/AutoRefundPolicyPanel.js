'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { ContentModal } from '@/components/ContentModal';
import { REFUND_ACTIONS, REFUND_CONTEXTS, REFUND_PAYMENT_PROVIDERS, REFUND_BILL_PROVIDERS, REFUND_SELECTORS, refundPermissions, refundLabel, refundAccountIds, normalizeRefundRules, readRefundPolicy, refundPolicyDraft, refundPolicyPayload, refundPolicyPatch, refundFingerprint, refundRuleSummary, globalRefundRule, invalidStoredRefundRules } from '@/lib/auto-refund-policy';

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '.8rem' };
const actions = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.5rem' };
const clone = (value) => JSON.parse(JSON.stringify(value));
const blank = () => refundPolicyDraft(readRefundPolicy({ autoRefundRules: [] }));
function Field({ label, children }) { return <label style={{ display: 'grid', gap: '.3rem', minWidth: 0 }}><span>{label}</span>{children}</label>; }
function Notice({ children, success }) { return children ? <div className={`alert ${success ? 'alert-success' : 'alert-error'}`} role={success ? 'status' : 'alert'}>{children}</div> : null; }

function Selector({ label, values, options, onChange, disabled, emptyLabel = 'Any' }) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase().replaceAll('_', ' ');
  return <details style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '.65rem', minWidth: 0 }}>
    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{label} · {values.length ? `${values.length} selected` : emptyLabel}</summary>
    <div style={{ display: 'grid', gap: '.5rem', marginTop: '.65rem' }}>
      <input type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div style={{ maxHeight: '15rem', overflowY: 'auto', display: 'grid', gap: '.45rem' }}>{options.filter((value) => refundLabel(value).toLowerCase().includes(query)).map((value) => <label key={value} style={{ ...actions, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={values.includes(value)} disabled={disabled} style={{ width: 'auto', marginTop: '.2rem' }} onChange={(event) => onChange(event.target.checked ? [...values, value] : values.filter((item) => item !== value))} /><span style={{ overflowWrap: 'anywhere' }}>{refundLabel(value)} <small style={{ color: 'var(--muted)' }}>({value})</small></span>
      </label>)}</div>
      {values.length ? <button type="button" className="btn-neutral btn-sm" disabled={disabled} onClick={() => onChange([])}>Clear {label.toLowerCase()}</button> : null}
    </div>
  </details>;
}

export function RefundRuleEditor({ rule, rules, index, onApply, onClose }) {
  const [draft, setDraft] = useState(() => ({ name: '', decision: 'BLOCK', contexts: [], paymentProviders: [], billProviders: [], actions: [], ...clone(rule || {}), accountIds: (rule?.accountIds || []).join(', ') }));
  const [scope, setScope] = useState(rule && globalRefundRule(rule) ? 'ALL' : 'FILTERED');
  const [error, setError] = useState('');
  const update = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));
  const apply = () => {
    try {
      const next = scope === 'ALL' ? { ...draft, ...Object.fromEntries(REFUND_SELECTORS.map((key) => [key, []])) } : { ...draft, accountIds: refundAccountIds(draft.accountIds) };
      const normalized = normalizeRefundRules([next])[0];
      if (scope === 'FILTERED' && globalRefundRule(normalized)) throw new Error('Select at least one filter, or explicitly choose All automatic refunds.');
      normalizeRefundRules(index == null ? [...rules, normalized] : rules.map((row, at) => at === index ? normalized : row));
      onApply(normalized); onClose();
    } catch (err) { setError(err.message); }
  };
  return <ContentModal title={index == null ? 'Add refund rule' : 'Edit refund rule'} onClose={onClose} width="min(860px, 95vw)">
    <Notice>{error}</Notice>
    <div style={grid}>
      <Field label="Rule name"><input value={draft.name} maxLength={100} onChange={(event) => update('name', event.target.value)} /></Field>
      <Field label="Decision"><select value={draft.decision} onChange={(event) => update('decision', event.target.value)}><option value="BLOCK">BLOCK · Require manual refund</option><option value="ALLOW">ALLOW · Permit automatic refund</option></select></Field>
      <Field label="Applies to"><select value={scope} onChange={(event) => setScope(event.target.value)}><option value="FILTERED">Transactions matching filters</option><option value="ALL">All automatic refunds</option></select></Field>
    </div>
    {scope === 'FILTERED' ? <>
      <small>Leave a selector empty for Any. All selected dimensions must match; values within one selector use OR.</small>
      <div style={grid}>{[['contexts', 'Contexts', REFUND_CONTEXTS], ['paymentProviders', 'Payment providers', REFUND_PAYMENT_PROVIDERS], ['billProviders', 'Bill providers', REFUND_BILL_PROVIDERS], ['actions', 'Actions', REFUND_ACTIONS]].map(([key, label, options]) => <Selector key={key} label={label} options={options} values={draft[key]} onChange={(value) => update(key, value)} />)}</div>
      <Field label="Account IDs (optional)"><textarea rows={2} value={draft.accountIds} placeholder="123, 456" onChange={(event) => update('accountIds', event.target.value)} /></Field>
      <small>Payment provider uses the current payment route, including after failover. Bill provider identifies the bill fulfiller. Neither selector identifies a virtual-card issuer.</small>
    </> : <p>This rule matches every automatic refund when reached. Place narrower exceptions before it.</p>}
    <div style={{ ...actions, justifyContent: 'flex-end' }}><button type="button" className="btn-neutral" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" onClick={apply}>{index == null ? 'Add to draft' : 'Apply to draft'}</button></div>
  </ContentModal>;
}

export default function AutoRefundPolicyPanel({ onRecovered }) {
  const { session, refreshSession } = useAuth();
  const { canRead, canWrite } = refundPermissions(session);
  const [saved, setSaved] = useState(null), [draft, setDraft] = useState(null), [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(''), [info, setInfo] = useState('');
  const [flag, setFlag] = useState(null), [flagError, setFlagError] = useState(''), [denied, setDenied] = useState(false), [recoveryAvailable, setRecoveryAvailable] = useState(false), [recovering, setRecovering] = useState(false), [reviewNeeded, setReviewNeeded] = useState(false), [editing, setEditing] = useState(null);
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const report = useCallback(async (err) => {
    if (err.status === 401) { try { await refreshSession(true); } catch { /* Session recovery handles sign-in. */ } }
    if (err.status === 403) setDenied(true);
    return `${err.status === 403 ? 'Permission denied. ' : ''}${err.message || 'Unable to read or save the refund policy.'}`;
  }, [refreshSession]);
  const load = useCallback(async (keepDraft = false) => {
    if (lock.current || !canRead) return;
    lock.current = true; setLoading(true); setError(''); setInfo('');
    try {
      const [policy, global] = await Promise.allSettled([api.walletPolicyConfig.get(), api.featureFlags.get('auto_refund')]);
      if (!mounted.current) return;
      setFlag(global.status === 'fulfilled' && typeof global.value?.enabled === 'boolean' ? global.value.enabled : null);
      setFlagError(global.status === 'rejected' ? 'Global switch unavailable. Refresh before relying on its status.' : '');
      if (policy.status === 'rejected') { setRecoveryAvailable(invalidStoredRefundRules(policy.reason)); throw policy.reason; }
      const next = readRefundPolicy(policy.value);
      setRecoveryAvailable(false);
      if (keepDraft) { setLatest(next); setReviewNeeded(true); }
      else { setSaved(next); setDraft(refundPolicyDraft(next)); setLatest(null); setReviewNeeded(false); setRecovering(false); }
    } catch (err) { if (mounted.current) setError(await report(err)); }
    finally { lock.current = false; if (mounted.current) setLoading(false); }
  }, [canRead, report]);
  useEffect(() => { void load(); }, [load]);
  const validation = useMemo(() => {
    if (!draft) return { payload: null, error: '' };
    try { return { payload: recovering ? { autoRefundRules: normalizeRefundRules(draft.rules) } : refundPolicyPayload(draft), error: '' }; }
    catch (err) { return { payload: null, error: err.message }; }
  }, [draft, recovering]);
  const dirty = Boolean(draft && (recovering || (validation.payload ? Object.keys(refundPolicyPatch(saved, validation.payload)).length > 0 : refundFingerprint(draft) !== refundFingerprint(refundPolicyDraft(saved)))));
  const disabled = !canWrite || denied || loading || saving;
  const change = (key, value) => { setDraft((previous) => ({ ...previous, [key]: value })); setInfo(''); };
  const move = (index, offset) => {
    const rules = [...draft.rules]; [rules[index], rules[index + offset]] = [rules[index + offset], rules[index]]; change('rules', rules);
  };
  const save = async () => {
    if (lock.current || disabled || !dirty || reviewNeeded || !validation.payload) return;
    const patch = recovering ? validation.payload : refundPolicyPatch(saved, validation.payload);
    if (!Object.keys(patch).length) return;
    lock.current = true; setSaving(true); setError(''); setInfo('');
    let attempted = false;
    try {
      let current;
      try { current = readRefundPolicy(await api.walletPolicyConfig.get()); }
      catch (err) { if (!recovering || !invalidStoredRefundRules(err)) throw err; }
      if (current && (recovering || Object.keys(patch).some((key) => refundFingerprint(saved[key]) !== refundFingerprint(current[key])))) {
        if (mounted.current) { setRecoveryAvailable(false); setLatest(current); setReviewNeeded(true); setError('Saved refund settings changed. Review the current policy before applying your draft.'); }
        return;
      }
      attempted = true;
      const response = readRefundPolicy(await api.walletPolicyConfig.update(patch));
      if (Object.keys(patch).some((key) => refundFingerprint(patch[key]) !== refundFingerprint(response[key]))) throw new Error('The backend did not confirm the complete saved refund settings. Refresh and review before retrying.');
      if (!mounted.current) return;
      setSaved(response); setDraft(refundPolicyDraft(response)); setLatest(null); setReviewNeeded(false); setRecoveryAvailable(false); setRecovering(false);
      setInfo('Refund policy saved. The policy is checked when a refund is attempted.');
      if (recovering) onRecovered?.();
    } catch (err) {
      if (mounted.current) { if (attempted && (!err.status || err.status >= 500 || err.status === 409)) setReviewNeeded(true); setError(await report(err)); }
    } finally { lock.current = false; if (mounted.current) setSaving(false); }
  };
  if (!canRead) return <Notice>Admin access is required to inspect refund policy.</Notice>;
  return <section style={{ display: 'grid', gap: '1rem', minWidth: 0 }} aria-label="Automatic refund policy">
    <div style={{ ...actions, justifyContent: 'space-between' }}><h2 style={{ margin: 0 }}>Automatic refunds</h2><button type="button" className="btn-neutral" disabled={loading || saving} onClick={() => void load(Boolean(draft && (dirty || reviewNeeded)))}>Refresh refund policy</button></div>
    <div style={actions}><strong>Global auto_refund: {flag == null ? 'Unavailable' : flag ? 'On' : 'Off'}</strong><a href="/dashboard/feature-flags" target="_blank" rel="noopener noreferrer">Open feature flags ↗</a></div>
    <small>{flag === false ? 'Automatic refunds are off. ALLOW rules and account exceptions cannot override the global switch.' : 'The global switch must be on. A matching policy permits a refund only after eligibility and provider safeguards pass.'}</small>
    {flagError ? <div role="status">{flagError}</div> : null}
    <Notice>{error}</Notice><Notice success>{info}</Notice>
    {loading ? <div role="status">Loading refund settings…</div> : null}
    {!canWrite || denied ? <small>Read only · Admin or Super Admin access is required to save.</small> : null}
    {recoveryAvailable && !recovering && canWrite && !denied ? <div><p>Stored scoped rules cannot be read and automatic refunds are blocked. Replace them with a reviewed rule list; an empty list restores the existing action fallback.</p><button type="button" className="btn-neutral" disabled={loading || saving} onClick={() => { setDraft(blank()); setRecovering(true); setSaved(null); setLatest(null); setReviewNeeded(false); setError(''); }}>Prepare replacement rules</button></div> : null}
    {draft ? <>
      <div style={{ ...actions, justifyContent: 'space-between' }}><div><strong>Ordered rule draft</strong><small style={{ display: 'block', color: 'var(--muted)' }}>First matching rule wins. No match uses action defaults.</small></div><div style={actions}><button type="button" className="btn-neutral" disabled={disabled || !draft.rules.length} onClick={() => change('rules', [])}>Clear scoped rules</button><button type="button" className="btn-primary" disabled={disabled || draft.rules.length >= 100} onClick={() => setEditing({ index: null, rule: null })}>Add rule</button></div></div>
      <DataTable columns={[
        { key: 'order', label: 'Order', render: (row) => draft.rules.indexOf(row) + 1 },
        { key: 'name', label: 'Rule', priority: 0 },
        { key: 'decision', label: 'Decision', render: (row) => <strong>{row.decision === 'ALLOW' ? 'Allow automatic' : 'Manual refund'}</strong> },
        { key: 'match', label: 'Matches', render: refundRuleSummary },
        { key: 'actions', label: 'Actions', render: (row) => <>
          <button type="button" className="btn-neutral btn-sm" disabled={disabled} onClick={() => setEditing({ index: draft.rules.indexOf(row), rule: row })}>Edit</button>
          <button type="button" className="btn-neutral btn-sm" disabled={disabled || draft.rules.indexOf(row) === 0} onClick={() => move(draft.rules.indexOf(row), -1)}>Move up</button>
          <button type="button" className="btn-neutral btn-sm" disabled={disabled || draft.rules.indexOf(row) === draft.rules.length - 1} onClick={() => move(draft.rules.indexOf(row), 1)}>Move down</button>
          <button type="button" className="btn-danger btn-sm" disabled={disabled} onClick={() => change('rules', draft.rules.filter((rule) => rule !== row))}>Remove from draft</button>
        </> }
      ]} rows={draft.rules} showIndex={false} showAccountQuickNav={false} emptyLabel={dirty ? 'No scoped rules in this draft. Action defaults apply after saving.' : 'No scoped rules. The action defaults apply when the global switch is on.'} />
      {!recovering ? <details><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Action defaults & account exceptions</summary><div style={{ display: 'grid', gap: '.8rem', marginTop: '.8rem' }}>
        <small>Used only when no scoped rule matches. Block withdrawals with WITHDRAW_FROM_WALLET; account exceptions can bypass that default, but cannot bypass a scoped BLOCK or the global switch.</small>
        <Selector label="Blocked actions" options={REFUND_ACTIONS} values={draft.blockedActions} emptyLabel="None blocked" disabled={disabled} onChange={(value) => change('blockedActions', value)} />
        <strong>Account exceptions by action</strong>
        {draft.exceptions.map((row, index) => <div key={index} style={{ ...grid, alignItems: 'end' }}>
          <Field label="Action"><select value={row.action} disabled={disabled} onChange={(event) => change('exceptions', draft.exceptions.map((item, at) => at === index ? { ...item, action: event.target.value } : item))}><option value="">Choose action</option>{REFUND_ACTIONS.map((action) => <option key={action} value={action}>{refundLabel(action)}</option>)}</select></Field>
          <Field label="Allowed account IDs"><input value={row.accountIds} disabled={disabled} onChange={(event) => change('exceptions', draft.exceptions.map((item, at) => at === index ? { ...item, accountIds: event.target.value } : item))} placeholder="123, 456" /></Field>
          <button type="button" className="btn-neutral" disabled={disabled} onClick={() => change('exceptions', draft.exceptions.filter((_, at) => at !== index))}>Remove exception</button>
        </div>)}
        <button type="button" className="btn-neutral" style={{ width: 'fit-content' }} disabled={disabled} onClick={() => change('exceptions', [...draft.exceptions, { action: '', accountIds: '' }])}>Add account exception</button>
        <details><summary style={{ cursor: 'pointer' }}>Provider timeout exceptions</summary><p>Provider-specific timeout handling remains separate. It never overrides the global switch or a scoped BLOCK. Withdrawal workers and callbacks still apply the withdrawal action policy.</p><Selector label="Timeout actions" options={REFUND_ACTIONS} values={draft.timeoutActions} disabled={disabled} emptyLabel="No timeout exceptions" onChange={(value) => change('timeoutActions', value)} /></details>
      </div></details> : <p>Recovery saves only the replacement scoped rules. Existing action defaults, account exceptions and timeout settings are preserved.</p>}
      <details><summary style={{ cursor: 'pointer', fontWeight: 600 }}>How refund decisions are resolved</summary><ol><li>Global auto_refund off always blocks automatic refunds.</li><li>With the global switch on, the first matching scoped ALLOW or BLOCK decides the policy.</li><li>Without a matching rule, blocked actions and their account exceptions apply.</li></ol><p>A provider-specific rule needs known matching provider metadata. Put a broad BLOCK after ALLOW exceptions to cover unknown providers. No rule bypasses debit proof, duplicate protection or failover evidence. LIVE Business API payouts use this policy; sandbox refunds are separate.</p></details>
      <Notice>{validation.error}</Notice>
      {reviewNeeded ? <div role="status" style={{ display: 'grid', gap: '.65rem' }}><strong>Your draft is retained. Review the current saved policy before retrying.</strong>{latest ? <>
        <details open><summary>Current saved refund settings</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '20rem', overflowY: 'auto' }}>{JSON.stringify(latest, null, 2)}</pre></details>
        <button type="button" className="btn-neutral" disabled={disabled} onClick={() => { setSaved(latest); setDraft(refundPolicyDraft(latest)); setLatest(null); setReviewNeeded(false); setRecovering(false); setRecoveryAvailable(false); setError(''); setInfo('Current saved refund policy loaded. Local edits discarded.'); if (recovering) onRecovered?.(); }}>Use current saved policy</button>
        <button type="button" className="btn-neutral" disabled={disabled} onClick={() => {
          const next = refundPolicyDraft(latest), before = saved ? refundPolicyDraft(saved) : null;
          for (const key of Object.keys(next)) if (recovering ? key === 'rules' : refundFingerprint(draft[key]) !== refundFingerprint(before[key])) next[key] = draft[key];
          setSaved(latest); setDraft(next); setLatest(null); setReviewNeeded(false); setRecovering(false); setRecoveryAvailable(false); setError(''); setInfo('Current settings reviewed. Check the draft before saving.'); if (recovering) onRecovered?.();
        }}>I reviewed the current policy · keep my edits</button>
      </> : <button type="button" className="btn-neutral" disabled={loading || saving} onClick={() => void load(true)}>Load current saved policy</button>}</div> : null}
      <div style={{ ...actions, justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '.8rem' }}><span>{dirty ? 'Unsaved refund changes' : 'No unsaved refund changes'}</span><div style={actions}><button type="button" className="btn-neutral" disabled={disabled || !dirty || !saved || reviewNeeded} onClick={() => { setDraft(refundPolicyDraft(saved)); setLatest(null); setReviewNeeded(false); setError(''); }}>Discard refund changes</button><button type="button" className="btn-primary" disabled={disabled || !dirty || reviewNeeded || !validation.payload} onClick={() => void save()}>{saving ? 'Saving refund policy…' : 'Save refund policy'}</button></div></div>
    </> : null}
    {editing && !disabled ? <RefundRuleEditor {...editing} rules={draft.rules} onClose={() => setEditing(null)} onApply={(rule) => change('rules', editing.index == null ? [...draft.rules, rule] : draft.rules.map((row, index) => index === editing.index ? rule : row))} /> : null}
  </section>;
}
