'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { NonRegulatorContent } from '@/components/RegulatorPresentation';
import { isRegulatorRestrictedService } from '@/lib/regulator-presentation';
import { referralPromptAudienceFields, referralPromptDraft, referralPromptPayload, referralPromptResource, referralPromptFingerprint } from '@/lib/referral-prompt';

const groups = [
  ['Countries, language and KYC', ['countryCodes', 'countryIds', 'deviceLanguages', 'kycStatuses']],
  ['Account creation dates', ['accountCreatedFrom', 'accountCreatedTo']],
  ['Products owned', ['hasCryptoWallets', 'hasSavings', 'hasGroupSavings', 'hasCards', 'hasLoans', 'hasEsims', 'hasPaymentRequests']],
  ['Completed transactions and recent activity', ['hasCompletedTransactions', 'minCompletedTransactions', 'maxCompletedTransactions', 'lastTransactionOlderThanDays', 'minTransactionsThisMonth', 'maxTransactionsThisMonth']],
  ['Transaction selectors', ['billProductIds', 'paymentMethodIds', 'paymentProviderIds', 'transactionStatuses', 'transactionServices', 'transactionActions']]
];
const restrictedOwnership = new Set(['hasCryptoWallets', 'hasSavings', 'hasGroupSavings', 'hasLoans']);
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '0.8rem' };
const labelStyle = { display: 'grid', gap: '0.3rem', minWidth: 0 };

export function ReferralPromptPanel(props) {
  return <ReferralPromptSettings key={String(props.campaignId)} {...props} />;
}

function ReferralPromptSettings({ campaignId, onSaved, onBusyChange }) {
  const { session, refreshSession, enableRegulatorMode } = useAuth();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(() => referralPromptDraft(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const sequence = useRef(0), lock = useRef(false);
  const callbacks = useRef({ onSaved, onBusyChange }); callbacks.current = { onSaved, onBusyChange };
  const canManage = useMemo(() => {
    const access = session?.tokens?.accessToken?.payload || {}, id = session?.tokens?.idToken?.payload || {};
    const roles = [access['cognito:groups'], access.groups, id['cognito:groups'], id.groups].flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((value) => String(value).trim().toUpperCase());
    return roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
  }, [session]);
  const validation = useMemo(() => {
    try { return { payload: referralPromptPayload(draft), error: '' }; }
    catch (err) { return { payload: null, error: err.message }; }
  }, [draft]);
  const savedPayload = useMemo(() => saved ? referralPromptPayload(referralPromptDraft(saved.referralPrompt)) : null, [saved]);
  const changed = Boolean(saved && referralPromptFingerprint(validation.payload || draft) !== referralPromptFingerprint(savedPayload));
  const current = useRef({ draft, changed }); current.current = { draft, changed };
  const showError = useCallback(async (err, prefix = '') => {
    if (err?.status === 401) await refreshSession(true);
    setError(prefix + (err?.status === 403 ? 'Permission denied. ' : '') + (err?.message || 'Unable to load or save invitation popup settings.'));
  }, [refreshSession]);

  const load = useCallback(async (preserveDraft = false) => {
    if (lock.current) return;
    const token = ++sequence.current;
    setLoading(true); setError(''); setInfo('');
    try {
      const campaign = await api.referralCampaigns.getReferralPrompt(campaignId);
      if (sequence.current !== token) return;
      const loaded = referralPromptResource(campaign, campaignId);
      setSaved(loaded.campaign);
      if (!preserveDraft) setDraft(loaded.draft);
      setRequiresRefresh(false);
      setInfo(preserveDraft ? 'Saved settings refreshed. Your draft has been kept for review.' : '');
    } catch (err) {
      if (sequence.current === token) {
        setRequiresRefresh(true);
        await showError(err);
      }
    } finally { if (sequence.current === token) setLoading(false); }
  }, [campaignId, showError]);

  useEffect(() => {
    callbacks.current.onBusyChange?.(false);
    void load();
    return () => { sequence.current += 1; callbacks.current.onBusyChange?.(false); };
  }, [load]);

  async function save() {
    if (!canManage || lock.current || loading || !saved || requiresRefresh || !changed) return;
    setError(''); setInfo('');
    let payload;
    try { payload = referralPromptPayload(current.current.draft); }
    catch (err) { setError(err.message); return; }
    const token = ++sequence.current;
    lock.current = true; setSaving(true); callbacks.current.onBusyChange?.(true);
    let responseReceived = false;
    try {
      const response = await api.referralCampaigns.updateReferralPrompt(campaignId, payload);
      responseReceived = true;
      if (sequence.current !== token) return;
      const result = referralPromptResource(response, campaignId);
      const confirmed = referralPromptPayload(result.draft);
      if (response.referralPrompt === null || referralPromptFingerprint(confirmed) !== referralPromptFingerprint(payload)) throw new Error('The backend did not confirm the complete saved popup configuration.');
      setSaved(result.campaign); setDraft(result.draft); setRequiresRefresh(false);
      callbacks.current.onSaved?.(result.campaign);
      setInfo('Invitation popup settings saved. Eligible users receive the decision on their next successful account refresh.');
    } catch (err) {
      if (sequence.current === token) {
        if (responseReceived) setRequiresRefresh(true);
        await showError(err, responseReceived ? 'Saved state could not be confirmed. The status below is the last confirmed setting. Refresh before retrying. ' : '');
      }
    } finally {
      if (sequence.current === token) {
        lock.current = false; setSaving(false); callbacks.current.onBusyChange?.(false);
      }
    }
  }

  const disabled = !canManage || loading || saving || !saved || requiresRefresh;
  const update = (field, value) => { setDraft((previous) => ({ ...previous, [field]: value })); setInfo(''); };
  const updateFilter = (key, value) => setDraft((previous) => ({ ...previous, filters: { ...previous.filters, [key]: value } }));
  const hiddenFilters = enableRegulatorMode !== false && referralPromptAudienceFields.some(([key]) => draft.filters[key] !== '' && (restrictedOwnership.has(key) || ['transactionServices', 'transactionActions'].includes(key) && isRegulatorRestrictedService(draft.filters[key])));
  const savedStatus = !saved ? 'Status unavailable' : saved.referralPrompt === null ? 'Not configured' : savedPayload.enabled ? 'Enabled' : 'Disabled';
  return <section className="referral-prompt-editor" aria-label="Referral invitation popup" style={{ display: 'grid', gap: '0.9rem', minWidth: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <div><strong role="status" data-testid="referral-prompt-saved-status">{'Saved popup: ' + savedStatus}</strong>{savedPayload?.campaignId ? <div style={{ color: 'var(--muted)', fontSize: '12px', overflowWrap: 'anywhere' }}>{'Saved popup campaign ID: ' + savedPayload.campaignId}</div> : null}</div>
      <button type="button" className="btn-neutral btn-sm" disabled={loading || saving} onClick={() => void load(current.current.changed)}>Refresh popup settings</button>
    </div>
    {loading ? <div role="status">Loading popup settings…</div> : null}
    {error ? <div role="alert" className="alert alert-error">{error}</div> : null}
    {info ? <div role="status" className="alert alert-success">{info}</div> : null}
    {saved ? <div style={{ color: 'var(--muted)', fontSize: '13px' }}><strong>{saved.name}</strong>{' · Referral campaign #' + saved.id + ' · ' + saved.status}. Enabled popup settings still require the program switch, an unambiguous ACTIVE campaign within its dates, and an eligible account. Accounts in review mode are excluded.</div> : null}
    {!canManage ? <div>Read only. Admin or Super Admin access is required to edit invitation popups.</div> : null}
    <fieldset disabled={disabled} style={{ display: 'grid', gap: '0.8rem', border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><input type="checkbox" style={{ width: '18px', height: '18px', margin: 0 }} checked={draft.enabled} onChange={(event) => update('enabled', event.target.checked)} />Enable invitation popup</label>
      <label style={labelStyle}><span>Popup campaign ID</span><input aria-label="Popup campaign ID" value={draft.campaignId} maxLength={128} onChange={(event) => update('campaignId', event.target.value)} placeholder="invite-friends-v1" /></label>
      <div style={{ color: 'var(--muted)', fontSize: '12px' }}>This presentation ID is separate from the numeric referral campaign ID. Keep it stable across copy, language, audience and off/on changes. The app remembers it per account on each device; re-enabling the same ID does not automatically show it again.</div>
      {savedPayload?.campaignId && draft.campaignId.trim() !== savedPayload.campaignId ? <div role="note" className="alert">A new popup campaign ID intentionally starts a different invitation presentation. Changing filters alone does not reset existing viewers.</div> : null}
      <div style={grid}>
        {['En', 'Fr'].map((language) => <div key={language} style={{ display: 'grid', gap: '0.5rem', minWidth: 0 }}>
          <label style={labelStyle}><span>{'Title (' + (language === 'En' ? 'English' : 'French') + ')'}</span><textarea aria-label={'Title (' + (language === 'En' ? 'English' : 'French') + ')'} rows={2} maxLength={200} value={draft['title' + language]} onChange={(event) => update('title' + language, event.target.value)} /><small>{draft['title' + language].length}/200 characters</small></label>
          <label style={labelStyle}><span>{'Message (' + (language === 'En' ? 'English' : 'French') + ')'}</span><textarea aria-label={'Message (' + (language === 'En' ? 'English' : 'French') + ')'} rows={4} maxLength={4000} value={draft['message' + language]} onChange={(event) => update('message' + language, event.target.value)} /><small>{draft['message' + language].length}/4,000 characters</small></label>
        </div>)}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Plain text; Unicode and line breaks are preserved. Blank copy uses the app’s localized fallback. Reward claims must match the actual campaign rules. Sharing alone must not be described as earning an immediate or guaranteed reward.</div>
      <label style={labelStyle}><span>Audience</span><select aria-label="Audience" value={draft.audienceMode} onChange={(event) => update('audienceMode', event.target.value)}><option value="ALL">All eligible users</option><option value="FILTERED">Selected users / filters</option></select></label>
      {draft.audienceMode === 'FILTERED' ? <>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Specific account IDs and all audience filters intersect. Different fields use AND; values within a list use OR. Lists accept commas or line breaks, up to 1,000 entries. Any omits a Boolean filter; No preserves an explicit false. Zero counts remain meaningful.</div>
        <label style={labelStyle}><span>Account IDs (optional)</span><textarea aria-label="Account IDs (optional)" rows={2} value={draft.targetAccountIds} onChange={(event) => update('targetAccountIds', event.target.value)} placeholder="123, 456" /></label>
        {hiddenFilters ? <div>Some filters are hidden in this dashboard presentation. They are retained when saving selected users / filters.</div> : null}
        {groups.map(([heading, keys]) => <details key={heading} open><summary style={{ cursor: 'pointer', fontWeight: 700 }}>{heading}</summary><div style={{ ...grid, marginTop: '0.7rem' }}>
          {referralPromptAudienceFields.filter(([key]) => keys.includes(key)).map(([key, label, kind, placeholder]) => {
            if (enableRegulatorMode !== false && ['transactionServices', 'transactionActions'].includes(key) && isRegulatorRestrictedService(draft.filters[key])) return null;
            const control = <label style={labelStyle}><span>{label}</span>{kind === 'boolean'
              ? <select aria-label={label} value={draft.filters[key]} onChange={(event) => updateFilter(key, event.target.value)}><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select>
              : <input aria-label={label} type={kind === 'date' ? 'date' : ['number', 'positive'].includes(kind) ? 'number' : 'text'} min={kind === 'positive' ? 1 : kind === 'number' ? 0 : undefined} step={['number', 'positive'].includes(kind) ? 1 : undefined} value={draft.filters[key]} placeholder={placeholder || (kind === 'ids' ? 'Comma-separated IDs' : undefined)} onChange={(event) => updateFilter(key, event.target.value)} />}</label>;
            return restrictedOwnership.has(key) ? <NonRegulatorContent key={key}>{control}</NonRegulatorContent> : <div key={key}>{control}</div>;
          })}
        </div></details>)}
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Account creation dates include the entire selected day in UTC. Transaction selectors keep the existing push/announcement matching rules. These filters choose popup recipients and do not change referral reward eligibility.</div>
      </> : <div role="note">Saving All eligible users removes audience and specific-account restrictions. The referral program’s eligibility checks still apply.</div>}
    </fieldset>
    {canManage && changed && validation.error ? <div role="alert" className="alert alert-error">{validation.error}</div> : null}
    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>This saves only the mobile invitation popup. It does not send a push, bind referrals, issue rewards or create transactions. Changes appear on successful account refreshes, rather than an instant broadcast. No cross-device frequency guarantee or share callback is provided.</div>
    {canManage ? <div className="modal-actions" style={{ boxShadow: '0 1.1rem 0 var(--surface)', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
      <button type="button" className="btn-primary" disabled={disabled || !changed || !validation.payload} onClick={() => void save()}>{saving ? 'Saving…' : 'Save invitation popup'}</button>
      <button type="button" className="btn-neutral" disabled={loading || saving || !saved || !changed} onClick={() => { setDraft(referralPromptDraft(saved.referralPrompt)); setError(''); setInfo(''); }}>Discard popup changes</button>
      <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{changed ? 'Unsaved popup changes' : 'No unsaved popup changes'}</span>
    </div> : null}
  </section>;
}
