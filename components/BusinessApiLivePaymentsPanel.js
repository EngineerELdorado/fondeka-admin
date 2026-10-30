'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const FLAG_KEY = 'business_api.live_payments.enabled';
const FALLBACK_EN = 'Live API payments are not available at the moment. Please use sandbox for testing.';
const FALLBACK_FR = 'Les paiements API en mode réel ne sont pas disponibles pour le moment. Veuillez utiliser le mode sandbox pour vos tests.';
const normalizeGroups = (value) => Array.isArray(value)
  ? value.map((group) => String(group).trim().toUpperCase())
  : typeof value === 'string' ? value.split(',').map((group) => group.trim().toUpperCase()) : [];

export default function BusinessApiLivePaymentsPanel() {
  const router = useRouter();
  const { session, refreshSession } = useAuth();
  const [flag, setFlag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messageEn, setMessageEn] = useState('');
  const [messageFr, setMessageFr] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const available = typeof flag?.enabled === 'boolean';
  const canManage = useMemo(() => {
    const access = session?.tokens?.accessToken?.payload || {};
    const id = session?.tokens?.idToken?.payload || {};
    const groups = [access['cognito:groups'], access.groups, id['cognito:groups'], id.groups].flatMap(normalizeGroups);
    return groups.includes('ADMIN') || groups.includes('SUPER_ADMIN');
  }, [session]);

  const showError = useCallback(async (err) => {
    const message = err?.message || 'Failed to load or save the LIVE payment default. Please retry.';
    if (err?.status === 401) {
      await refreshSession(true);
      setError(`Your session has been renewed. Please retry. ${message}`);
    } else {
      setError(err?.status === 403 ? `Permission denied. ${message}` : message);
    }
  }, [refreshSession]);

  const applySavedFlag = (response) => {
    setFlag(response);
    setMessageEn(response?.disabledMessageEn ?? '');
    setMessageFr(response?.disabledMessageFr ?? '');
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      applySavedFlag(await api.featureFlags.get(FLAG_KEY));
    } catch (err) {
      await showError(err);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { void load(); }, [load]);

  const save = async (enabled, includeMessages = false) => {
    if (!canManage || !available || loading || saving) return;
    if (enabled !== flag.enabled) {
      const prompt = enabled
        ? 'Enable new LIVE API collections and payouts by default? Explicit Business overrides remain in effect.'
        : 'Disable new LIVE API collections and payouts by default? Explicit Business overrides remain in effect. Accepted payments continue processing. Sandbox remains available.';
      if (!window.confirm(prompt)) return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const response = await api.featureFlags.update(FLAG_KEY, {
        enabled,
        ...(includeMessages ? { disabledMessageEn: messageEn, disabledMessageFr: messageFr } : {})
      });
      applySavedFlag(response);
      router.refresh();
      setInfo(typeof response?.enabled === 'boolean'
        ? `Default saved: LIVE ${response.enabled ? 'enabled' : 'disabled'} by default. Explicit Business overrides remain in effect.`
        : 'Default saved. Status unavailable; refresh to check the saved setting.');
    } catch (err) {
      await showError(err);
    } finally {
      setSaving(false);
    }
  };

  const messagesUnchanged = messageEn === (flag?.disabledMessageEn ?? '') && messageFr === (flag?.disabledMessageFr ?? '');
  return <section className="card" aria-labelledby="live-payment-default-title" style={{ display: 'grid', gap: '0.85rem', borderLeft: '4px solid #7c3aed', minWidth: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <div>
        <h2 id="live-payment-default-title" style={{ margin: 0, fontSize: '1.1rem' }}>Business API live payments</h2>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '13px' }}>Global default for new LIVE API collections and payouts.</p>
      </div>
      <button type="button" className="btn-neutral btn-sm" disabled={loading || saving} onClick={load}>{loading ? 'Refreshing…' : 'Refresh LIVE default'}</button>
    </div>
    {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
    {info ? <div className="alert alert-success" role="status">{info}</div> : null}
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <strong>Default for live API payments</strong>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <strong data-testid="business-live-default-status" role="status" style={{ color: !available ? 'var(--muted)' : flag.enabled ? '#15803d' : '#b45309' }}>
          {available ? flag.enabled ? 'LIVE enabled by default' : 'LIVE disabled by default' : 'Status unavailable'}
        </strong>
        {canManage ? <input type="checkbox" role="switch" aria-label="Default for live API payments" checked={flag?.enabled === true} disabled={!available || loading || saving} onChange={(event) => void save(event.target.checked)} style={{ width: '20px', height: '20px', margin: 0 }} /> : null}
      </div>
    </div>
    <div style={{ padding: '0.7rem', background: 'var(--accent-soft)', borderRadius: '10px', fontSize: '13px' }}>
      Controls new LIVE payments. Accepted payments continue processing. Sandbox remains available.
    </div>
    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
      Explicit Business overrides take priority and remain in effect when this default changes. Manage each override in <Link href="/dashboard/businesses">Businesses → Details &amp; credentials → LIVE API payments</Link>.
    </div>
    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
      Business Tools paid access, account restrictions and payment-route availability still apply. Business operational and KYB statuses are metadata only. Pausing does not revoke credentials, cancel or refund payments, or affect customer-app payments or Commerce.
    </div>
    {canManage ? <details style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Customize paused-payment messages</summary>
      <div style={{ display: 'grid', gap: '0.7rem', marginTop: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem', minWidth: 0 }}>
          <span>Disabled message (English)</span>
          <textarea rows={3} value={messageEn} disabled={!available || loading || saving} placeholder={FALLBACK_EN} onChange={(event) => setMessageEn(event.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem', minWidth: 0 }}>
          <span>Disabled message (French)</span>
          <textarea rows={3} value={messageFr} disabled={!available || loading || saving} placeholder={FALLBACK_FR} onChange={(event) => setMessageFr(event.target.value)} />
        </label>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Blank values use the backend localized fallbacks. Changing the default alone preserves the saved messages.</div>
        <div><button type="button" className="btn-neutral" disabled={!available || loading || saving || messagesUnchanged} onClick={() => void save(flag.enabled, true)}>{saving ? 'Saving…' : 'Save rejection messages'}</button></div>
      </div>
    </details> : <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Read only. An administrator can change this setting.</div>}
    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Account/country overrides, queue controls and client-presentation settings do not apply to this policy.</div>
  </section>;
}
