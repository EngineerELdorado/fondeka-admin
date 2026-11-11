'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { DataTable } from '@/components/DataTable';
import { RESELLER_CARD_FLAG, resellerCardPermissions, resellerCardSettings, resellerCardTarget, resellerCardAccount, resellerCardPayload } from '@/lib/reseller-card-visibility';
import { Card, Field, Alert, actionStyle, gridStyle, useMounted, useResellerError } from './Common';

export default function CardVisibilityPanel() {
  const { session } = useAuth();
  const { canWrite } = resellerCardPermissions(session);
  const [settings, setSettings] = useState(null), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [denied, setDenied] = useState(false);
  const [error, setError] = useState(''), [info, setInfo] = useState(''), [globalDraft, setGlobalDraft] = useState(null);
  const [selector, setSelector] = useState('accountId'), [target, setTarget] = useState(''), [choice, setChoice] = useState('inherit'), [page, setPage] = useState(0);
  const lock = useRef(false), mounted = useMounted(), fail = useResellerError();
  const read = useCallback(async () => {
    const [flags, overrides] = await Promise.all([api.featureFlags.list(), api.featureFlags.listOverrides(RESELLER_CARD_FLAG)]);
    return resellerCardSettings(flags, overrides);
  }, []);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setReady(false); setError(''); setInfo('');
    try { const next = await read(); if (mounted.current) { setSettings(next); setReady(true); setPage(0); } }
    catch (err) { const message = await fail(err); if (mounted.current) { setError(message); if (err.status === 403) setDenied(true); } }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }, [read, fail, mounted]);
  useEffect(() => { void refresh(); }, [refresh]);
  const disabled = busy || !ready || !canWrite || denied;
  const save = async (scope) => {
    if (lock.current || disabled) return;
    let selected, payload;
    try {
      if (scope === 'global') { if (globalDraft == null || globalDraft === settings.enabled) return; payload = { enabled: globalDraft }; }
      else { selected = resellerCardTarget(selector, target); payload = resellerCardPayload(choice); }
    } catch (err) { setError(err.message); return; }
    lock.current = true; setBusy(true); setError(''); setInfo('');
    let accepted = false;
    try {
      if (scope === 'global') await api.featureFlags.update(RESELLER_CARD_FLAG, payload);
      else if (selected.type === 'email') {
        if (payload === null) await api.featureFlags.removeOverrideByEmail(RESELLER_CARD_FLAG, selected.value);
        else await api.featureFlags.upsertOverrideByEmail(RESELLER_CARD_FLAG, selected.value, payload);
      } else if (payload === null) await api.featureFlags.removeOverride(RESELLER_CARD_FLAG, selected.value);
      else await api.featureFlags.upsertOverride(RESELLER_CARD_FLAG, selected.value, payload);
      accepted = true;
      const next = await read();
      if (mounted.current) {
        setSettings(next); setReady(true); setPage(0);
        if (scope === 'global') { setGlobalDraft(null); setInfo(`Global reseller card visibility saved: ${next.enabled ? 'Shown' : 'Hidden'}. Account overrides are preserved.`); }
        else setInfo(payload === null ? `Override removed for ${selected.value}. The account follows the global setting.` : `Reseller card ${payload.enabled ? 'shown' : 'hidden'} for ${selected.value}.`);
      }
    } catch (err) {
      const message = await fail(err);
      if (mounted.current) { setError(`${accepted ? 'The update was accepted, but its saved state could not be refreshed. ' : ''}${message}`); if (err.status === 403) setDenied(true); if (accepted || !err.status || err.status >= 500 || err.status === 409) setReady(false); }
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const account = ready && selector === 'accountId' && /^[1-9]\d*$/.test(target.trim()) ? resellerCardAccount(settings, Number(target.trim())) : null;
  return <Card title="Reseller card on Business Tools">
    <div style={{ ...actionStyle, justifyContent: 'space-between' }}><p style={{ margin: 0, color: 'var(--muted)' }}>Show or hide the complete reseller card, including its Free / Gratuit badge.</p><button type="button" className="btn-neutral btn-sm" disabled={busy} onClick={() => void refresh()}>Refresh visibility</button></div>
    <Alert>{error}</Alert><Alert success>{info}</Alert>
    {busy ? <div role="status">Loading or saving visibility…</div> : null}
    {!canWrite || denied ? <small>Read only. Admin or Super Admin access is required to save feature flags.</small> : null}
    <div style={{ ...actionStyle, justifyContent: 'space-between' }}><strong>Global default: {ready ? settings.enabled ? 'Shown' : 'Hidden' : 'Unavailable'}</strong>
      {canWrite && !denied ? <div style={actionStyle}><Field label="Default card visibility"><select value={String(globalDraft ?? (ready ? settings.enabled : ''))} disabled={disabled} onChange={(event) => { if (!lock.current) setGlobalDraft(event.target.value === 'true'); }}><option value="" disabled>Unavailable</option><option value="false">Hidden</option><option value="true">Shown</option></select></Field><button type="button" className="btn-primary" disabled={disabled || globalDraft == null || globalDraft === settings?.enabled} onClick={() => void save('global')}>Save global visibility</button></div> : null}
    </div>
    <small>The default is hidden. Enrollment, earning and the Profile entry are managed separately. Regulator mode still hides the card in the native app.</small>
    <fieldset disabled={disabled} style={{ border: 0, borderTop: '1px solid var(--border)', margin: 0, padding: '.8rem 0 0', display: 'grid', gap: '.7rem', minWidth: 0 }}>
      <legend style={{ fontWeight: 700 }}>Account override</legend>
      <div style={gridStyle}>
        <Field label="Find account by"><select value={selector} onChange={(event) => { if (!lock.current) { setSelector(event.target.value); setTarget(''); setChoice('inherit'); } }}><option value="accountId">Account ID</option><option value="email">Email</option></select></Field>
        <Field label={selector === 'email' ? 'Account email' : 'Account ID'}><input value={target} inputMode={selector === 'accountId' ? 'numeric' : 'email'} placeholder={selector === 'email' ? 'customer@example.com' : '35418'} onChange={(event) => { if (!lock.current) setTarget(event.target.value); }} /></Field>
        <Field label="Card visibility"><select value={choice} onChange={(event) => { if (!lock.current) setChoice(event.target.value); }}><option value="inherit">Inherit global setting</option><option value="show">Show card</option><option value="hide">Hide card</option></select></Field>
      </div>
      {account ? <small>Saved choice: {account.choice === 'inherit' ? 'Inherit' : account.choice === 'show' ? 'Show' : 'Hide'} · Effective card visibility: {account.enabled ? 'Shown' : 'Hidden'}</small> : null}
      <small>Show and Hide override the global setting. Inherit removes the account override.</small>
      {canWrite && !denied ? <div><button type="button" className="btn-primary" disabled={disabled || !target.trim()} onClick={() => void save('account')}>Save account visibility</button></div> : null}
    </fieldset>
    {ready ? <details><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Existing account overrides ({settings.overrides.length})</summary><DataTable columns={[
      { key: 'accountId', label: 'Account', render: (row) => `Account ${row.accountId}` },
      { key: 'enabled', label: 'Reseller card', render: (row) => row.enabled ? 'Shown' : 'Hidden' },
      ...(canWrite && !denied ? [{ key: 'actions', label: 'Actions', render: (row) => <button type="button" className="btn-neutral btn-sm" disabled={busy} onClick={() => { if (!lock.current) { setSelector('accountId'); setTarget(String(row.accountId)); setChoice(row.enabled ? 'show' : 'hide'); } }}>Edit</button> }] : [])
    ]} rows={settings.overrides.slice(page * 10, page * 10 + 10)} page={page} pageSize={10} totalElements={settings.overrides.length} totalPages={Math.ceil(settings.overrides.length / 10)} onPageChange={setPage} canPrev={page > 0} canNext={(page + 1) * 10 < settings.overrides.length} showAccountQuickNav={false} showIndex={false} emptyLabel="No account overrides. Every account follows the global setting." /></details> : null}
  </Card>;
}
