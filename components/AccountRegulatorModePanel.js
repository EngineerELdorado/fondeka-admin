'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { REGULATOR_MODE_KEY, accountRegulatorModeChoice, accountRegulatorModeSettings } from '@/lib/regulator-mode';

export function AccountRegulatorModePanel(props) {
  return <AccountRegulatorModeSettings key={String(props.accountId)} {...props} />;
}

function AccountRegulatorModeSettings({ accountId, refreshKey, accountLoading = false }) {
  const { session, refreshSession } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState('inherit');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const readVersion = useRef(0);
  const savingRef = useRef(false);
  const canManage = useMemo(() => {
    const access = session?.tokens?.accessToken?.payload || {};
    const id = session?.tokens?.idToken?.payload || {};
    const groups = [access['cognito:groups'], access.groups, id['cognito:groups'], id.groups].flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((group) => String(group).trim().toUpperCase());
    return groups.includes('ADMIN') || groups.includes('SUPER_ADMIN');
  }, [session]);

  const showError = useCallback(async (err, prefix = '') => {
    if (err?.status === 401) await refreshSession(true);
    const message = err?.message || 'Unable to load or save Regulator mode. Please retry.';
    setError(`${prefix}${err?.status === 403 ? 'Permission denied. ' : ''}${message}`);
  }, [refreshSession]);

  const readSettings = useCallback(async () => {
    const [flag, overrides] = await Promise.all([
      api.featureFlags.get(REGULATOR_MODE_KEY),
      api.featureFlags.listOverrides(REGULATOR_MODE_KEY)
    ]);
    const settings = accountRegulatorModeSettings(flag, overrides, accountId);
    if (!settings) {
      const unavailable = new Error('Status unavailable. Refresh Regulator mode to check the saved settings.');
      unavailable.code = 'REGULATOR_MODE_SETTINGS_UNAVAILABLE';
      throw unavailable;
    }
    return settings;
  }, [accountId]);

  const applySaved = (settings) => {
    setSaved(settings);
    setDraft(accountRegulatorModeChoice(settings));
  };

  const load = useCallback(async () => {
    if (accountId == null || accountId === '' || savingRef.current) return;
    const version = ++readVersion.current;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const settings = await readSettings();
      if (version === readVersion.current) applySaved(settings);
    } catch (err) {
      if (version === readVersion.current) {
        if (err?.code === 'REGULATOR_MODE_SETTINGS_UNAVAILABLE') setSaved(null);
        await showError(err);
      }
    } finally {
      if (version === readVersion.current) setLoading(false);
    }
  }, [accountId, readSettings, showError]);

  useEffect(() => {
    void load();
    return () => { readVersion.current += 1; };
  }, [load, refreshKey]);

  const savedChoice = accountRegulatorModeChoice(saved);
  const disabled = loading || saving || accountLoading || !saved;
  const save = async () => {
    if (!canManage || disabled || draft === savedChoice || savingRef.current) return;
    savingRef.current = true;
    readVersion.current += 1;
    setSaving(true);
    setError(null);
    setInfo(null);
    let committed = false;
    try {
      if (draft === 'inherit') {
        await api.featureFlags.removeOverride(REGULATOR_MODE_KEY, accountId);
        committed = true;
        // DELETE returns no resource. Read the current global value before showing inheritance.
        setSaved(null);
        setDraft('inherit');
      } else {
        const response = await api.featureFlags.upsertOverride(REGULATOR_MODE_KEY, accountId, { enabled: draft === 'enabled' });
        committed = true;
        if (String(response?.accountId) !== String(accountId) || typeof response?.enabled !== 'boolean') {
          setSaved(null);
          throw new Error('Status unavailable. Refresh Regulator mode to check the saved override.');
        }
        applySaved({ ...saved, overrideEnabled: response.enabled, enabled: response.enabled });
      }
      setInfo(draft === 'inherit' ? 'Override removed. This account follows the global setting.' : 'Account Regulator mode override saved.');
      router.refresh();
      applySaved(await readSettings());
    } catch (err) {
      await showError(err, committed ? 'The change was saved, but its current settings could not be refreshed. ' : '');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return <section id="regulator-mode" className="card" aria-labelledby="account-regulator-mode-title" style={{ display: 'grid', gap: '0.85rem', minWidth: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <h2 id="account-regulator-mode-title" style={{ margin: 0, fontSize: '1.1rem' }}>Regulator mode</h2>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <strong data-testid="account-regulator-mode-status" role="status" style={{ color: !saved ? 'var(--muted)' : saved.enabled ? '#15803d' : '#b45309' }}>
          {saved ? saved.enabled ? 'Enabled' : 'Disabled' : 'Status unavailable'}
        </strong>
        <button type="button" className="btn-neutral btn-sm" onClick={load} disabled={loading || saving || accountLoading}>{loading ? 'Refreshing…' : 'Refresh Regulator mode'}</button>
      </div>
    </div>
    {error ? <div role="alert" className="alert alert-error">{error}</div> : null}
    {info ? <div role="status" className="alert alert-success">{info}</div> : null}
    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
      Global setting: <strong>{saved ? saved.globalEnabled ? 'Enabled' : 'Disabled' : 'Unavailable'}</strong>.{' '}
      {saved ? saved.overrideEnabled == null ? 'This account follows the global setting.' : 'This account has an explicit override.' : 'Refresh to check this account’s saved setting.'}{' '}
      <Link href="/dashboard/feature-flags">View Feature flags</Link>
    </div>
    {canManage ? <>
      <label htmlFor="account-regulator-mode-choice" style={{ display: 'grid', gap: '0.35rem', maxWidth: '460px', minWidth: 0 }}>
        <span>Regulator mode for this account</span>
        <select id="account-regulator-mode-choice" aria-label="Regulator mode for this account" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={disabled} style={{ width: '100%', minWidth: 0 }}>
          <option value="inherit">Follow global setting</option>
          <option value="enabled">Enable</option>
          <option value="disabled">Disable</option>
        </select>
      </label>
      {draft === 'inherit' && savedChoice !== 'inherit' ? <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Saving removes the override. The account adopts the current global setting.</div> : null}
      <div><button type="button" className="btn-primary" onClick={save} disabled={disabled || draft === savedChoice}>{saving ? 'Saving…' : 'Save Regulator mode'}</button></div>
    </> : <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Read only. An administrator can change this account’s Regulator mode.</div>}
    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Enabled and disabled are explicit account overrides and remain in effect when the global setting changes. This is the same override managed by account ID or email in Feature flags.</div>
    <div style={{ padding: '0.7rem', background: 'var(--accent-soft)', borderRadius: '10px', fontSize: '13px' }}>Controls presentation in compatible clients. Backend payment authorization and service eligibility are unchanged. Allow up to 30 seconds for caches to refresh, then refresh account data in the client.</div>
  </section>;
}
