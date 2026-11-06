'use client';

import { useRef, useState } from 'react';
import { ContentModal } from '@/components/ContentModal';
import { PresentationSelect } from '@/components/RegulatorPresentation';
import { isRegulatorRestrictedService } from '@/lib/regulator-presentation';
import { resellerDraft, resellerPayload, resellerRecord, resellerScope, resellerRootPolicy, resellerRetentionChanged, resellerLabel, resellerNumber, RESELLER_SERVICES, RESELLER_POLICY_FIELDS } from '@/lib/resellers';
import { Alert, Field, Facts, BehaviorFacts, ProductPicker, PrefundingCurrencyPicker, actionStyle, gridStyle, useResellerError, useMounted } from './Common';

const behaviorHelp = {
  ownPurchaseRewardsEnabled: 'Reseller points on the reseller’s own qualifying purchases.',
  eligibleInviteeRewardMode: 'Choose one reward program for a direct invitee’s qualifying purchase.',
  otherInviteeReferralRewardsEnabled: 'Normal referral rewards on other eligible invitee activity.',
  inviteeResellerCutoff: 'When an invitee becomes a reseller, choose how long their inviter stops earning from them.',
  preEnrollmentPointsRedeemable: 'Allow redemption of unredeemed invitee points earned before that invitee became a reseller.'
};

export default function ResellerEditor({ kind, record = {}, accountId = null, fixedProduct = null, canWrite, onClose, onSave, onReload, onSaved }) {
  const [base, setBase] = useState(record), [draft, setDraft] = useState(() => resellerDraft(kind, record, accountId));
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [denied, setDenied] = useState(false), [stale, setStale] = useState(false), [latest, setLatest] = useState(null), [missing, setMissing] = useState(false), [acknowledged, setAcknowledged] = useState(false);
  const lock = useRef(false), mounted = useMounted(), fail = useResellerError();
  const disabled = saving || !canWrite || denied;
  const changed = base.id == null && ['rule', 'policy'].includes(kind) || JSON.stringify(draft) !== JSON.stringify(resellerDraft(kind, base, accountId));
  const impact = kind === 'policy' && resellerRetentionChanged(draft, base) ? 'Retention changes affect existing spendability in BOTH reseller and referral balances. Only the unredeemed pre-enrollment portion is held or released; existing wallet credits stay intact.'
    : kind === 'enrollment' && draft.enabled && !base.enabledSince ? 'First activation stops the direct inviter earning from this account. The default cutoff is permanent, including after suspension. Manual enrollment bypasses self-service prefunding. Product/service policies can change the cutoff for future purchases.'
      : kind === 'requirements' && draft.selfServiceEnabled && !base.selfServiceEnabled ? 'Allow eligible customers to enroll themselves once global earning is also enabled. Review available products, positive commission rates and prefunding before opening enrollment.'
      : kind === 'program' && draft.enabled && !base.enabled ? `Enable earning for new eligible purchases. Confirm that commercial rates, migrations and all web/worker nodes have been reviewed.${base.selfServiceEnabled === true ? ' Configured self-service enrollment will also open for eligible customers.' : ''}` : null;
  const title = `${base.id != null || ['enrollment', 'program', 'requirements'].includes(kind) ? 'Edit' : 'New'} ${{ program: 'reseller program', requirements: 'self-service requirements', enrollment: 'reseller enrollment', rule: 'commission rule', policy: 'behavior policy' }[kind]}`;
  const update = (key, value) => { setDraft((previous) => ({ ...previous, [key]: value })); setAcknowledged(false); };
  const save = async () => {
    if (disabled || lock.current || stale || missing || !changed || impact && !acknowledged) return;
    let payload; try { payload = resellerPayload(kind, draft, base); } catch (err) { setError(err.message); return; }
    lock.current = true; setSaving(true); setError('');
    try {
      const next = resellerRecord(kind, await onSave(payload, base));
      if (!mounted.current) return;
      if (kind === 'enrollment' && next.accountId !== base.accountId || ['rule', 'policy'].includes(kind) && base.id != null && next.id !== base.id) throw new Error('The returned saved record could not be confirmed. Refresh before retrying.');
      onSaved(next); onClose();
    } catch (err) {
      if (mounted.current) { if (err.status === 403) setDenied(true); if (err.status === 409 || !err.status || err.status >= 500) setStale(true); setError(await fail(err)); }
    } finally { lock.current = false; if (mounted.current) setSaving(false); }
  };
  const refresh = async () => {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError('');
    try {
      const next = await onReload(base, draft);
      if (!mounted.current) return;
      if (!next) { setMissing(true); setError('This record no longer exists in the selected scope. Close the editor and refresh the list. Your draft is kept here.'); return; }
      setLatest(resellerRecord(kind, next)); setStale(true);
    } catch (err) { if (mounted.current) setError(await fail(err)); }
    finally { lock.current = false; if (mounted.current) setSaving(false); }
  };
  const root = kind === 'policy' && base.id != null && resellerRootPolicy(base);
  return <ContentModal title={title} onClose={() => { if (!lock.current) onClose(); }} width="min(850px, 95vw)">
    <Alert>{error}</Alert>
    {denied || !canWrite ? <div>Read only — Super Admin required.</div> : null}
    <div style={{ color: 'var(--muted)' }}>{kind === 'program' ? 'Previously captured purchase terms and redemption remain available when earning is paused. This shares its version with self-service requirements.' : kind === 'requirements' ? 'Global customer enrollment settings. Earning must also be enabled. Prefunding is checked once at activation; it is never debited or reserved.' : kind === 'enrollment' ? `Account ${base.accountId}. Manual enrollment and reactivation bypass prefunding. Suspension stops new own earnings; history and earned points remain. Customers cannot reactivate an admin-suspended account themselves.` : kind === 'rule' ? `${draft.accountId == null ? 'Global default inherited automatically by enrolled resellers. Existing account overrides still take priority.' : 'Optional account exception. Ordinary resellers inherit global product rates without an override.'} Changes apply to future purchases. Disabled or zero rates block fallback; deleting restores inheritance.` : 'Each field inherits independently. Earning choices affect future purchases; retention is live.'}</div>
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: '.8rem', minWidth: 0 }}>
      <legend className="sr-only">{title}</legend>
      {kind === 'requirements' ? <div style={gridStyle}>
        <Field label="Customer self-enrollment"><select value={String(draft.selfServiceEnabled)} onChange={(event) => update('selfServiceEnabled', event.target.value === 'true')}><option value="true">Enabled</option><option value="false">Disabled</option></select></Field>
        <Field label="Prefunding minimum" help="Current balance in the chosen fiat wallet. Zero removes the balance minimum."><input type="number" min="0" step="0.01" value={draft.prefundingAmount} onChange={(event) => update('prefundingAmount', event.target.value)} /></Field>
        <Field label="Prefunding currency" help="Active, wallet-enabled fiat currency. No conversion or combined balances."><PrefundingCurrencyPicker value={draft.prefundingCurrency} disabled={disabled} onChange={(value) => update('prefundingCurrency', value)} /></Field>
      </div> : ['program', 'enrollment'].includes(kind) ? <Field label={kind === 'program' ? 'Program earning' : 'Reseller enrollment'}><select value={String(draft.enabled)} onChange={(event) => update('enabled', event.target.value === 'true')}><option value="true">Enabled</option><option value="false">{kind === 'program' ? 'Paused' : 'Suspended / not enabled'}</option></select></Field> : <>
        <div style={gridStyle}><Field label="Account scope"><input readOnly value={draft.accountId == null ? 'Global' : `Account ${draft.accountId}`} /></Field>
          <Field label="Service"><PresentationSelect value={draft.service} disabled={root || kind === 'rule'} onChange={(event) => { update('service', event.target.value); if (event.target.value !== 'BILL_PAYMENTS') update('billProductId', ''); }}>
            {kind === 'policy' ? <option value="" disabled={accountId == null && !root}>Default (all services)</option> : null}
            {(kind === 'rule' ? ['BILL_PAYMENTS'] : RESELLER_SERVICES).map((service) => <option key={service} value={service} data-regulator-restricted={isRegulatorRestrictedService(service)}>{resellerLabel(service)}</option>)}
          </PresentationSelect></Field>
          {kind === 'rule' && !fixedProduct ? <Field label="Product scope"><select value={draft.productScope} onChange={(event) => { update('productScope', event.target.value); update('billProductId', ''); }}><option value="PRODUCT">Specific bill product</option><option value="SERVICE">All bill products (service default)</option></select></Field> : null}
          {draft.service === 'BILL_PAYMENTS' && !(kind === 'rule' && draft.productScope === 'SERVICE') ? <Field label="Bill product">{fixedProduct ? <input readOnly value={`${fixedProduct.name} (#${fixedProduct.id})`} /> : <ProductPicker value={draft.billProductId} disabled={disabled || root} onChange={(value) => update('billProductId', value)} optionalLabel={kind === 'rule' ? 'Choose a bill product' : 'All bill products (service default)'} />}</Field> : null}
        </div>
        {kind === 'rule' && draft.productScope === 'SERVICE' ? <small>This default covers every supported bill product at this account/global scope. Keep it disabled when only selected product rules should offer rewards.</small> : null}
        {kind === 'rule' ? <div style={gridStyle}>
          <Field label="Commission rule"><select value={String(draft.enabled)} onChange={(event) => update('enabled', event.target.value === 'true')}><option value="true">Enabled</option><option value="false">Disabled — block fallback</option></select></Field>
          <Field label="Reward basis"><select value={draft.basis} onChange={(event) => update('basis', event.target.value)}><option value="NET_AMOUNT">Net purchase amount</option><option value="REVENUE">Internal fees + provider commission</option></select></Field>
          <Field label="Percentage" help="2.5 means 2.5%. Zero explicitly prevents rewards."><input type="number" min="0" max="100" step="0.0001" value={draft.percentage} onChange={(event) => update('percentage', event.target.value)} /></Field>
          <Field label="Cap per purchase (optional)" help="In the purchase currency: 10 caps USD at 10 USD and CDF at 10 CDF."><input type="number" min="0.01" step="0.01" value={draft.maxPoints} onChange={(event) => update('maxPoints', event.target.value)} /></Field>
        </div> : <div style={gridStyle}>{RESELLER_POLICY_FIELDS.map(([key, label]) => {
          const options = key === 'eligibleInviteeRewardMode' ? ['RESELLER', 'REFERRAL', 'NONE'] : key === 'inviteeResellerCutoff' ? ['PERMANENT', 'WHILE_ENABLED'] : [true, false];
          return <Field key={key} label={label} help={behaviorHelp[key]}><select value={draft[key] == null ? 'inherit' : String(draft[key])} onChange={(event) => update(key, event.target.value === 'inherit' ? null : options.includes(true) ? event.target.value === 'true' : event.target.value)}><option value="inherit" disabled={root}>Inherit</option>{options.map((value) => <option key={String(value)} value={String(value)}>{value === 'PERMANENT' ? 'After first activation (permanent)' : value === 'WHILE_ENABLED' ? 'Only while the invitee is enabled' : resellerLabel(value)}</option>)}</select></Field>;
        })}</div>}
      </>}
      {!['program', 'requirements'].includes(kind) ? <Field label="Admin notes (optional)"><textarea rows={3} maxLength={1000} value={draft.notes} onChange={(event) => update('notes', event.target.value)} /></Field> : null}
      {impact ? <label style={{ ...actionStyle, alignItems: 'flex-start', padding: '.75rem', background: 'var(--accent-soft)', borderRadius: 10 }}><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} style={{ width: 'auto' }} /><span>{impact} <strong>I reviewed this change.</strong></span></label> : null}
    </fieldset>
    {stale ? <div role="status" style={{ display: 'grid', gap: '.6rem' }}><span>The draft is kept. Refresh and review before retrying; no automatic overwrite.</span><button type="button" className="btn-neutral" disabled={saving} onClick={() => void refresh()}>Refresh latest saved settings</button>{latest ? <>
      <strong>Latest saved version {latest.version}{latest.id != null ? ` · ID ${latest.id}` : ''}</strong>
      {kind === 'policy' ? <><span>{resellerScope(latest)}</span><BehaviorFacts values={latest} /></> : ['program', 'requirements'].includes(kind) ? <Facts rows={[
        ['New purchase earning', typeof (kind === 'program' ? latest.enabled : latest.programEnabled) === 'boolean' ? resellerLabel(kind === 'program' ? latest.enabled : latest.programEnabled) : 'Unavailable'],
        ['Customer self-enrollment', typeof latest.selfServiceEnabled === 'boolean' ? resellerLabel(latest.selfServiceEnabled) : 'Unavailable'],
        ['Prefunding minimum', latest.prefundingAmount == null ? 'Unavailable' : `${resellerNumber(latest.prefundingAmount)} ${latest.prefundingCurrency}`]
      ]} /> : <Facts rows={Object.entries(latest).filter(([key]) => !['id', 'version'].includes(key)).map(([key, value]) => [key, typeof value === 'boolean' ? resellerLabel(value) : value])} />}
      <button type="button" className="btn-neutral" disabled={disabled || missing} onClick={() => { setBase(latest); setLatest(null); setStale(false); setAcknowledged(false); setError(''); }}>I reviewed version {latest.version} — apply my draft</button>
    </> : null}</div> : null}
    <div style={{ ...actionStyle, justifyContent: 'flex-end' }}><button type="button" className="btn-neutral" disabled={saving} onClick={onClose}>Cancel</button>{canWrite && !denied ? <button type="button" className="btn-primary" disabled={disabled || stale || missing || !changed || Boolean(impact && !acknowledged)} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</button> : null}</div>
  </ContentModal>;
}
