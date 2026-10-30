'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { livePaymentMode, livePaymentSettingsAvailable } from '@/lib/business-live-payments';

const normalizeGroups = (value) => Array.isArray(value) ? value.map((item) => String(item).trim().toUpperCase()).filter(Boolean) : typeof value === 'string' ? value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean) : [];
const formatDateTime = (value) => value ? new Date(value).toLocaleString() : '—';
const formatEnum = (value) => String(value || '—').toLowerCase().split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
const Modal = ({ title, onClose, children }) => <div className="modal-backdrop"><div className="modal-surface"><div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}><strong>{title}</strong><button type="button" className="btn-neutral" onClick={onClose}>×</button></div>{children}</div></div>;

export default function BusinessDetailPage() {
  const params = useParams();
  const businessId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  return <BusinessDetails key={businessId} businessId={businessId} />;
}

function BusinessDetails({ businessId }) {
  const router = useRouter();
  const { session, refreshSession } = useAuth();
  const [business, setBusiness] = useState(null);
  const [keys, setKeys] = useState([]);
  const [revokeKey, setRevokeKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [liveMode, setLiveMode] = useState('inherit');
  const [liveReason, setLiveReason] = useState('');
  const [liveSaving, setLiveSaving] = useState(false);
  const [liveRefreshRequired, setLiveRefreshRequired] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const savedLiveMode = livePaymentMode(business);
  const liveSettingsAvailable = livePaymentSettingsAvailable(business);
  const liveEditingDisabled = loading || liveSaving || !liveSettingsAvailable || liveRefreshRequired || notFound;

  useEffect(() => {
    setLiveMode(savedLiveMode);
    setLiveReason('');
  }, [business, savedLiveMode]);

  const canManageBusiness = useMemo(() => {
    const access = session?.tokens?.accessToken?.payload || {};
    const id = session?.tokens?.idToken?.payload || {};
    const groups = [...normalizeGroups(access?.['cognito:groups'] || access?.groups), ...normalizeGroups(id?.['cognito:groups'] || id?.groups)];
    return groups.includes('ADMIN') || groups.includes('SUPER_ADMIN');
  }, [session]);

  const showBusinessError = useCallback(async (err, fallback) => {
    const message = err?.message || fallback;
    if (err?.status === 404) {
      setNotFound(true);
      setError(`Business not found. ${message}`);
    } else if (err?.status === 409) {
      setLiveRefreshRequired(true);
      setError(`The Business changed concurrently. Refresh the Business before retrying. ${message}`);
    } else if (err?.status === 401) {
      await refreshSession(true);
      setError(`Your session has been renewed. Please retry. ${message}`);
    } else {
      setError(err?.status === 403 ? `Permission denied. ${message}` : message);
    }
  }, [refreshSession]);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true); setError(null); setInfo(null);
    try {
      const [businessResult, keysResult] = await Promise.allSettled([
        api.businesses.get(businessId), api.businesses.apiKeys.list(businessId)
      ]);
      if (keysResult.status === 'fulfilled') {
        const response = keysResult.value;
        setKeys(Array.isArray(response) ? response : response?.content || []);
      }
      if (businessResult.status === 'rejected') throw businessResult.reason;
      setBusiness(businessResult.value);
      setNotFound(false);
      setLiveRefreshRequired(false);
      if (keysResult.status === 'rejected') setError(keysResult.reason?.message || 'Failed to load Business API credentials.');
    } catch (err) { await showBusinessError(err, 'Failed to load Business details.'); }
    finally { setLoading(false); }
  }, [businessId, showBusinessError]);

  useEffect(() => { load(); }, [load]);

  const revoke = async () => {
    if (!revokeKey?.id) return;
    setSaving(true); setError(null); setInfo(null);
    try {
      await api.businesses.apiKeys.revoke(businessId, revokeKey.id);
      setRevokeKey(null);
      setInfo('Credential revoked. Accepted transaction and delivery history were preserved.');
      const list = await api.businesses.apiKeys.list(businessId);
      setKeys(Array.isArray(list) ? list : list?.content || []);
    } catch (err) { setError(err?.message || 'Failed to revoke Business API credential.'); }
    finally { setSaving(false); }
  };

  const saveLivePayments = async () => {
    if (!canManageBusiness || liveEditingDisabled || liveMode === savedLiveMode) return;
    if (liveReason.trim().length > 1000) {
      setError('Reason must be 1,000 characters or fewer.');
      return;
    }
    setLiveSaving(true); setError(null); setInfo(null);
    try {
      const updated = liveMode === 'inherit'
        ? await api.businesses.resetApiLivePayments(businessId)
        : await api.businesses.updateApiLivePayments(businessId, {
          enabled: liveMode === 'enabled',
          ...(liveReason.trim() ? { reason: liveReason.trim() } : {})
        });
      setBusiness(updated);
      router.refresh();
      setInfo(livePaymentSettingsAvailable(updated)
        ? `Business LIVE payment setting saved. New LIVE payments are ${updated.apiLivePaymentsEnabled ? 'enabled' : 'disabled'}.`
        : 'Business LIVE payment setting saved. Status unavailable; refresh to check the saved setting.');
    } catch (err) {
      await showBusinessError(err, 'Failed to save the Business LIVE payment setting. Please retry.');
    } finally {
      setLiveSaving(false);
    }
  };

  return <div style={{ display: 'grid', gap: '1rem' }}>
    <div className="card" style={{ display: 'grid', gap: '0.6rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}><div><h1 style={{ margin: 0 }}>{business?.name || `Business ${businessId}`}</h1><p style={{ margin: '0.35rem 0 0', color: 'var(--muted)' }}>Business identity, owner access and API credentials are separate controls.</p></div><div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}><Link href="/dashboard/businesses" className="btn-neutral" style={{ textDecoration: 'none' }}>← Businesses</Link>{business?.ownerAccountId ? <Link href={`/dashboard/accounts/accounts/${encodeURIComponent(business.ownerAccountId)}#business-tools-access`} className="btn-primary" style={{ textDecoration: 'none' }}>Owner access and payments</Link> : null}<button type="button" className="btn-neutral" onClick={load} disabled={loading || liveSaving}>{loading ? 'Refreshing…' : 'Refresh'}</button></div></div><div style={{ padding: '0.7rem', background: 'var(--accent-soft)', borderRadius: '10px', fontSize: '13px' }}>An enabled credential does not prove paid access or readiness to transact. Business operational/KYB status, owner entitlement, credential state and enforcement are independent.</div></div>
    {error ? <div className="alert alert-error" role="alert">{error}</div> : null}{info ? <div className="alert alert-success" role="status">{info}</div> : null}
    {notFound ? <div className="card"><strong>Business not found</strong><p>This Business is no longer available.</p><Link href="/dashboard/businesses">Return to the Business directory</Link></div> : null}
    {business && !notFound ? <section className="card" aria-labelledby="business-live-payments-title" style={{ display: 'grid', gap: '0.85rem', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 id="business-live-payments-title" style={{ margin: 0, fontSize: '1.1rem' }}>LIVE API payments</h2>
        <strong data-testid="business-live-payment-status" role="status" style={{ color: !liveSettingsAvailable ? 'var(--muted)' : business.apiLivePaymentsEnabled ? '#15803d' : '#b45309' }}>
          {liveSettingsAvailable ? business.apiLivePaymentsEnabled ? 'Enabled for new payments' : 'Disabled for new payments' : 'Status unavailable'}
        </strong>
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
        Global default: <strong>{liveSettingsAvailable ? business.apiLivePaymentsGlobalEnabled ? 'LIVE enabled' : 'LIVE disabled' : 'Unavailable'}</strong>.{' '}
        {liveSettingsAvailable ? savedLiveMode === 'inherit' ? 'This business follows the global default.' : 'This business has an explicit override.' : 'Refresh the Business to check its settings.'}{' '}
        <Link href="/dashboard/feature-flags">View global settings</Link>
      </div>
      {canManageBusiness ? <>
        <label htmlFor="business-live-payment-mode" style={{ display: 'grid', gap: '0.35rem', maxWidth: '460px', minWidth: 0 }}>
          <span style={{ fontWeight: 700 }}>New LIVE payments for this business</span>
          <select id="business-live-payment-mode" value={liveMode} onChange={(event) => setLiveMode(event.target.value)} disabled={liveEditingDisabled} style={{ width: '100%', minWidth: 0 }}>
            <option value="inherit">Follow global default</option>
            <option value="enabled">Enable LIVE for this business</option>
            <option value="disabled">Disable LIVE for this business</option>
          </select>
        </label>
        {liveMode === 'inherit' && savedLiveMode !== 'inherit' ? <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Restoring inheritance can immediately enable or disable new LIVE payments according to the current global default.</div> : null}
        {liveMode !== 'inherit' ? <label htmlFor="business-live-payment-reason" style={{ display: 'grid', gap: '0.35rem', maxWidth: '600px' }}>
          <span>Reason (optional)</span>
          <textarea id="business-live-payment-reason" value={liveReason} maxLength={1000} rows={2} onChange={(event) => setLiveReason(event.target.value)} disabled={liveEditingDisabled} />
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{liveReason.length}/1000 · Recorded in the admin audit log.</span>
        </label> : null}
        <div><button type="button" className="btn-primary" onClick={saveLivePayments} disabled={liveEditingDisabled || liveMode === savedLiveMode}>
          {liveSaving ? 'Saving…' : 'Save LIVE payment setting'}
        </button></div>
      </> : <div style={{ color: 'var(--muted)', fontSize: '13px' }}>An administrator can change this setting.</div>}
      <div style={{ padding: '0.7rem', background: 'var(--accent-soft)', borderRadius: '10px', fontSize: '13px' }}>
        Controls new LIVE payments. Accepted payments continue processing. Sandbox remains available. A Business override takes priority over the global default. Business Tools paid access, account restrictions and payment-route availability still apply. Operational and KYB statuses are metadata only.
      </div>
    </section> : null}
    {business && !notFound ? <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.65rem' }}>{[['Business ID', business.id], ['Name', business.name], ['Legal name', business.legalName], ['Owner account', business.ownerAccountReference || business.ownerAccountId], ['Owner email', business.ownerAccountEmail], ['Country', business.countryCode], ['Registration number', business.registrationNumber], ['Operational status', formatEnum(business.status)], ['KYB status', formatEnum(business.kybStatus)], ['Default Business', business.defaultBusiness ? 'Yes' : 'No'], ['Created', formatDateTime(business.createdAt)], ['Updated', formatDateTime(business.updatedAt)]].map(([label, value]) => <div key={label} style={{ padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}><div style={{ color: 'var(--muted)', fontSize: '12px' }}>{label}</div><strong>{value || '—'}</strong></div>)}</div> : null}
    {!notFound ? <div className="card" style={{ display: 'grid', gap: '0.75rem' }}><div><strong>Business API credentials</strong><div style={{ color: 'var(--muted)', fontSize: '13px' }}>Active and revoked LIVE/SANDBOX credential metadata. Full API keys and webhook signing secrets are available only to the Business owner once, when generated in the customer portal.</div></div>{keys.length === 0 ? <div style={{ color: 'var(--muted)' }}>No credentials.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}><thead><tr>{['Masked key', 'Name', 'Environment', 'Status', 'Webhook URL', 'Created', ''].map((label) => <th key={label} style={{ padding: '0.45rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{label}</th>)}</tr></thead><tbody>{keys.map((key) => { const revoked = key.enabled === false; return <tr key={key.id} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '0.45rem' }}><code>{key.maskedKey || key.keyPrefix || '—'}</code></td><td style={{ padding: '0.45rem' }}>{key.name || '—'}</td><td style={{ padding: '0.45rem' }}>{formatEnum(key.environment)}</td><td style={{ padding: '0.45rem' }}>{revoked ? 'Revoked' : 'Enabled'}</td><td style={{ padding: '0.45rem', overflowWrap: 'anywhere' }}>{key.webhookUrl || '—'}</td><td style={{ padding: '0.45rem' }}>{formatDateTime(key.createdAt)}</td><td style={{ padding: '0.45rem' }}>{canManageBusiness && !revoked ? <button type="button" className="btn-danger btn-sm" onClick={() => setRevokeKey(key)}>Revoke</button> : null}</td></tr>; })}</tbody></table></div>}<div style={{ color: 'var(--muted)', fontSize: '12px' }}>Credential generation is owner-only and must be completed in the customer portal. Administrators can inspect masked metadata and revoke active credentials, but cannot generate or reveal secrets.</div></div> : null}
    {revokeKey ? <Modal title="Revoke API credential?" onClose={() => saving ? null : setRevokeKey(null)}><div style={{ display: 'grid', gap: '0.75rem' }}><div>Revoke <strong>{revokeKey.name || revokeKey.keyPrefix}</strong>? This does not delete history or stop delivery for already accepted transactions.</div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}><button type="button" className="btn-neutral" onClick={() => setRevokeKey(null)}>Cancel</button><button type="button" className="btn-danger" disabled={saving} onClick={revoke}>{saving ? 'Revoking…' : 'Revoke credential'}</button></div></div></Modal> : null}
  </div>;
}
