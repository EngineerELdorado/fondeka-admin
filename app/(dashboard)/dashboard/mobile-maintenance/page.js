'use client';

import { cloneElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { NonRegulatorContent, PresentationSelect } from '@/components/RegulatorPresentation';
import { isRegulatorRestrictedService } from '@/lib/regulator-presentation';
import {
  MAINTENANCE_AUDIENCE_LISTS, MAINTENANCE_AUDIENCE_BOOLEANS, MAINTENANCE_AUDIENCE_COUNTS,
  MAINTENANCE_TRANSACTION_SERVICES, MAINTENANCE_TRANSACTION_ACTIONS,
  maintenancePolicyPayload, maintenancePolicyFingerprint, newMaintenanceRule, maintenanceListText, maintenanceUtcInput
} from '@/lib/mobile-maintenance';

const clone = (value) => JSON.parse(JSON.stringify(value));
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '0.8rem' };
const field = { display: 'grid', gap: '0.3rem', minWidth: 0, alignContent: 'start' };
const checkbox = { width: '18px', height: '18px', margin: 0 };
const tokens = (value) => Array.isArray(value) ? value : String(value || '').split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
const restrictedRule = (rule) => [rule.name, rule.titleEn, rule.messageEn, rule.titleFr, rule.messageFr].some(isRegulatorRestrictedService)
  || MAINTENANCE_AUDIENCE_BOOLEANS.some(([key, , restricted]) => restricted && rule.audience?.[key] !== undefined)
  || ['transactionServices', 'transactionActions'].some((key) => tokens(rule.audience?.[key]).some(isRegulatorRestrictedService));

function TextField({ label, children }) {
  return <label style={field}><span>{label}</span>{cloneElement(children, { 'aria-label': label })}</label>;
}

export default function MobileMaintenancePage() {
  const { session, refreshSession, enableRegulatorMode } = useAuth();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const version = useRef(0);
  const canManage = useMemo(() => {
    const access = session?.tokens?.accessToken?.payload || {};
    const id = session?.tokens?.idToken?.payload || {};
    const groups = [access['cognito:groups'], access.groups, id['cognito:groups'], id.groups].flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((value) => String(value).trim().toUpperCase());
    return groups.includes('ADMIN') || groups.includes('SUPER_ADMIN');
  }, [session]);

  const applySaved = useCallback((policy) => {
    let normalized;
    try { normalized = maintenancePolicyPayload(policy, { draft: false }); }
    catch (err) { err.code = 'MAINTENANCE_POLICY_UNAVAILABLE'; throw err; }
    setSaved(normalized);
    setDraft(clone(normalized));
  }, []);
  const showError = useCallback(async (err, prefix = '') => {
    if (err?.status === 401) await refreshSession(true);
    setError(`${prefix}${err?.status === 403 ? 'Permission denied. ' : ''}${err?.message || 'Unable to load or save the maintenance policy. Please retry.'}`);
  }, [refreshSession]);

  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true); setError(null); setInfo(null);
    try {
      const policy = await api.mobileMaintenance.get();
      if (current === version.current) applySaved(policy);
    } catch (err) {
      if (current === version.current) {
        if (err.code === 'MAINTENANCE_POLICY_UNAVAILABLE') setSaved(null);
        await showError(err);
      }
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [applySaved, showError]);
  useEffect(() => { void load(); return () => { version.current += 1; }; }, [load]);

  const validation = useMemo(() => {
    if (!draft) return { payload: null, message: null };
    try { return { payload: maintenancePolicyPayload(draft), message: null }; }
    catch (err) { return { payload: null, message: err.message }; }
  }, [draft]);
  const changed = Boolean(saved && draft && maintenancePolicyFingerprint(validation.payload || draft) !== maintenancePolicyFingerprint(saved));
  const disabled = !canManage || loading || saving || !saved;
  const updateRule = (index, key, value) => setDraft((previous) => ({ ...previous, rules: previous.rules.map((rule, at) => at === index ? { ...rule, [key]: value } : rule) }));
  const updateAudience = (index, key, value) => setDraft((previous) => ({
    ...previous,
    rules: previous.rules.map((rule, at) => {
      if (at !== index) return rule;
      const audience = { ...rule.audience };
      if (value === '') delete audience[key]; else audience[key] = value;
      const result = { ...rule };
      if (Object.keys(audience).length) result.audience = audience; else delete result.audience;
      return result;
    })
  }));
  const moveRule = (index, offset) => setDraft((previous) => {
    const rules = [...previous.rules];
    [rules[index], rules[index + offset]] = [rules[index + offset], rules[index]];
    return { ...previous, rules };
  });

  const persist = async (turnOff = false) => {
    if (!canManage || loading || saving || !saved || (!turnOff && (!changed || !validation.payload))) return;
    setSaving(true); setError(null); setInfo(null);
    let committed = false;
    try {
      // PUT replaces the policy. A quick recovery starts with the latest saved rules.
      const payload = turnOff ? { ...maintenancePolicyPayload(await api.mobileMaintenance.get(), { draft: false }), enabled: false } : validation.payload;
      const response = await api.mobileMaintenance.update(payload);
      committed = true;
      try { applySaved(response); }
      catch { setSaved(null); applySaved(await api.mobileMaintenance.get()); }
      setInfo(turnOff ? 'Maintenance policy turned off. Saved rules were retained.' : 'Maintenance policy saved. Clients receive changes on their next status check or account refresh.');
    } catch (err) {
      await showError(err, committed ? 'The policy was saved, but its saved state is unavailable. Refresh before editing again. ' : '');
    } finally { setSaving(false); }
  };

  const hiddenRules = draft?.rules.filter((rule) => enableRegulatorMode !== false && restrictedRule(rule)).length || 0;
  const hasUnrestrictedRule = validation.payload?.rules.some((rule) => rule.enabled && !rule.audience && !rule.targetAccountIds);
  return <div className="mobile-maintenance" style={{ display: 'grid', gap: '1rem', minWidth: 0 }}>
    <section className="card" style={{ display: 'grid', gap: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div><h1 style={{ margin: 0, fontSize: '1.5rem' }}>Mobile maintenance</h1><p style={{ margin: '0.35rem 0 0', color: 'var(--muted)' }}>Manage the availability message shown in the mobile app.</p></div>
        <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong role="status" data-testid="mobile-maintenance-status">{saved ? saved.enabled ? 'Saved policy: Enabled' : 'Saved policy: Disabled' : 'Status unavailable'}</strong>
          <button type="button" className="btn-neutral" disabled={loading || saving} onClick={load}>{loading ? 'Refreshing…' : 'Refresh policy'}</button>
        </div>
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>An enabled policy requires at least one matching enabled rule. Rules run by descending priority; ties keep the order below. The first match supplies the message. Disabled rules do not exempt clients from another match.</div>
      {saved && !saved.rules.some((rule) => rule.enabled) ? <div>No enabled rules. Maintenance is off.</div> : null}
      {canManage ? <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn-neutral" disabled={disabled || !saved?.enabled} onClick={() => void persist(true)}>Turn off maintenance</button>
        <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Turns off the saved policy and keeps its latest rules.</span>
      </div> : <div>Read only. An administrator can update this policy.</div>}
    </section>
    {error ? <div role="alert" className="card alert alert-error">{error}</div> : null}
    {info ? <div role="status" className="card alert alert-success">{info}</div> : null}
    {draft ? <>
      <section className="card" style={{ display: 'grid', gap: '0.8rem' }}>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><input type="checkbox" style={checkbox} checked={draft.enabled} disabled={disabled} onChange={(event) => setDraft((previous) => ({ ...previous, enabled: event.target.checked }))} />Enable mobile maintenance</label>
        {canManage ? <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" disabled={disabled || draft.rules.length >= 50} onClick={() => setDraft((previous) => ({ ...previous, rules: [...previous.rules, newMaintenanceRule()] }))}>Add rule</button>
          <button type="button" className="btn-neutral" disabled={disabled || draft.rules.length === 0} onClick={() => setDraft({ enabled: false, rules: [] })}>Disable and remove all rules</button>
          <span style={{ color: 'var(--muted)', alignSelf: 'center' }}>{draft.rules.length}/50 rules</span>
        </div> : null}
        {hasUnrestrictedRule ? <div style={{ padding: '0.7rem', background: 'var(--accent-soft)', borderRadius: '10px', fontSize: '13px' }}>An enabled rule has no account filters. It can match any client within its platform, version, and schedule limits, even when other rules target selected accounts.</div> : null}
        {hiddenRules ? <div>{hiddenRules} saved rule(s) are hidden in this presentation. They are preserved unless you remove all rules.</div> : null}
      </section>
      {draft.rules.map((rule, index) => enableRegulatorMode !== false && restrictedRule(rule) ? null : <section className="card" key={index} aria-label={`Maintenance rule ${index + 1}`} style={{ display: 'grid', gap: '0.9rem', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Rule {index + 1}</h2>
          {canManage ? <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" aria-label={`Move rule ${index + 1} up`} disabled={disabled || index === 0} onClick={() => moveRule(index, -1)}>Move up</button>
            <button type="button" className="btn-neutral btn-sm" aria-label={`Move rule ${index + 1} down`} disabled={disabled || index === draft.rules.length - 1} onClick={() => moveRule(index, 1)}>Move down</button>
            <button type="button" className="btn-danger btn-sm" aria-label={`Remove rule ${index + 1}`} disabled={disabled} onClick={() => setDraft((previous) => ({ ...previous, rules: previous.rules.filter((_, at) => at !== index) }))}>Remove</button>
          </div> : null}
        </div>
        <div style={grid}>
          <TextField label="Rule name"><input value={rule.name ?? ''} disabled={disabled} onChange={(event) => updateRule(index, 'name', event.target.value)} /></TextField>
          <TextField label="Priority"><input type="number" step="1" value={rule.priority ?? 0} disabled={disabled} onChange={(event) => updateRule(index, 'priority', event.target.value)} /></TextField>
        </div>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><input type="checkbox" style={checkbox} checked={rule.enabled} disabled={disabled} onChange={(event) => updateRule(index, 'enabled', event.target.checked)} />Rule enabled</label>
        <div style={grid}>
          {['En', 'Fr'].map((language) => <div key={language} style={{ display: 'grid', gap: '0.65rem', minWidth: 0 }}>
            <TextField label={`Title (${language === 'En' ? 'English' : 'French'})`}><input value={rule[`title${language}`] ?? ''} maxLength={200} disabled={disabled} onChange={(event) => updateRule(index, `title${language}`, event.target.value)} /></TextField>
            <TextField label={`Message (${language === 'En' ? 'English' : 'French'})`}><textarea rows={4} value={rule[`message${language}`] ?? ''} maxLength={4000} disabled={disabled} onChange={(event) => updateRule(index, `message${language}`, event.target.value)} /></TextField>
            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{(rule[`message${language}`] || '').length}/4,000 message characters</span>
          </div>)}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Plain text only. Line breaks are preserved. Empty localized copy lets the mobile app use its fallback.</div>
        <details><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Target accounts and audience</summary>
          <div style={{ display: 'grid', gap: '0.85rem', marginTop: '0.75rem' }}>
            <TextField label="Target account IDs"><textarea rows={2} value={maintenanceListText(rule.targetAccountIds)} disabled={disabled} placeholder="123, 456 — leave blank for all accounts" onChange={(event) => updateRule(index, 'targetAccountIds', event.target.value)} /></TextField>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>IDs and audience selectors are combined with AND. Lists accept commas or line breaks, up to 1,000 entries. Leave a selector blank to impose no condition. Dates include the entire selected day in UTC.</div>
            <div style={grid}>
              {MAINTENANCE_AUDIENCE_LISTS.map(([key, label]) => {
                const choices = key === 'transactionServices' ? MAINTENANCE_TRANSACTION_SERVICES : key === 'transactionActions' ? MAINTENANCE_TRANSACTION_ACTIONS : null;
                return <TextField key={key} label={label}>{choices ? <PresentationSelect multiple size={5} value={tokens(rule.audience?.[key])} disabled={disabled} onChange={(event) => updateAudience(index, key, Array.from(event.target.selectedOptions, (option) => option.value).length ? Array.from(event.target.selectedOptions, (option) => option.value) : '')}>
                  {[...new Set([...choices, ...tokens(rule.audience?.[key])])].map((value) => <option key={value} value={value}>{value}</option>)}
                </PresentationSelect> : <input value={maintenanceListText(rule.audience?.[key])} disabled={disabled} onChange={(event) => updateAudience(index, key, event.target.value)} />}</TextField>;
              })}
              {['accountCreatedFrom', 'accountCreatedTo'].map((key) => <TextField key={key} label={key.endsWith('From') ? 'Account created from (UTC date)' : 'Account created through (UTC date)'}><input type="date" value={rule.audience?.[key] || ''} disabled={disabled} onChange={(event) => updateAudience(index, key, event.target.value)} /></TextField>)}
              {MAINTENANCE_AUDIENCE_BOOLEANS.map(([key, label, restricted]) => {
                const control = <TextField label={label}><select value={rule.audience?.[key] === true ? 'true' : rule.audience?.[key] === false ? 'false' : ''} disabled={disabled} onChange={(event) => updateAudience(index, key, event.target.value === '' ? '' : event.target.value === 'true')}><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select></TextField>;
                return restricted ? <NonRegulatorContent key={key}>{control}</NonRegulatorContent> : <div key={key}>{control}</div>;
              })}
              {MAINTENANCE_AUDIENCE_COUNTS.map(([key, label]) => <TextField key={key} label={label}><input type="number" min="0" step="1" value={rule.audience?.[key] ?? ''} disabled={disabled} onChange={(event) => updateAudience(index, key, event.target.value)} /></TextField>)}
            </div>
          </div>
        </details>
        <details><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Platforms, versions, and schedule</summary>
          <div style={{ display: 'grid', gap: '0.8rem', marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>{['ios', 'android'].map((platform) => <label key={platform} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}><input type="checkbox" style={checkbox} checked={rule.platforms?.includes(platform) || false} disabled={disabled} onChange={(event) => updateRule(index, 'platforms', event.target.checked ? [...(rule.platforms || []), platform] : (rule.platforms || []).filter((value) => value !== platform))} />{platform === 'ios' ? 'iOS' : 'Android'}</label>)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No platform selected means all platforms. Version matching uses request headers, not a stored account version.</div>
            <div style={grid}>
              <TextField label="Minimum app version (inclusive)"><input value={rule.appVersionAtLeast || ''} placeholder="1.2.3" disabled={disabled} onChange={(event) => updateRule(index, 'appVersionAtLeast', event.target.value)} /></TextField>
              <TextField label="Maximum app version (exclusive)"><input value={rule.appVersionLessThan || ''} placeholder="2.0.0" disabled={disabled} onChange={(event) => updateRule(index, 'appVersionLessThan', event.target.value)} /></TextField>
              <TextField label="Start (UTC, inclusive)"><input type="datetime-local" step="1" value={maintenanceUtcInput(rule.startAt)} disabled={disabled} onChange={(event) => updateRule(index, 'startAt', event.target.value)} /></TextField>
              <TextField label="End (UTC, exclusive)"><input type="datetime-local" step="1" value={maintenanceUtcInput(rule.endAt)} disabled={disabled} onChange={(event) => updateRule(index, 'endAt', event.target.value)} /></TextField>
            </div>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><input type="checkbox" style={checkbox} checked={rule.includeMissingAppVersion === true} disabled={disabled} onChange={(event) => updateRule(index, 'includeMissingAppVersion', event.target.checked)} />Include clients with missing or invalid app versions when version bounds apply</label>
          </div>
        </details>
      </section>)}
      {validation.message ? <div role="alert" className="card alert alert-error">{validation.message}</div> : null}
      {canManage ? <section className="card" style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn-primary" disabled={disabled || !changed || !validation.payload} onClick={() => void persist(false)}>{saving ? 'Saving…' : 'Save maintenance policy'}</button>
        <button type="button" className="btn-neutral" disabled={disabled || !changed} onClick={() => { setDraft(clone(saved)); setError(null); }}>Discard changes</button>
        <span style={{ color: 'var(--muted)' }}>{!saved ? 'Refresh to verify saved state' : changed ? 'Unsaved changes' : 'All changes saved'}</span>
      </section> : null}
      <NonRegulatorContent><details className="card"><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Policy preview</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '12px' }}>{JSON.stringify(validation.payload || draft, null, 2)}</pre></details></NonRegulatorContent>
    </> : null}
    <section className="card" style={{ color: 'var(--muted)', fontSize: '13px', display: 'grid', gap: '0.5rem' }}>
      <div>Account targeting requires the coordinated backend and mobile release with maintenance contexts. Older clients receive only rules that do not require an account identity. Signed-out clients without a context cannot match account filters.</div>
      <div>Maintenance changes appear on the next status check or account refresh. Active maintenance is rechecked every 30 seconds; there is no push activation. Forced updates keep priority. This policy does not change orders, payments, callbacks, or idempotency.</div>
    </section>
  </div>;
}
