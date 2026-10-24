'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const normalizeGroups = (value) => Array.isArray(value) ? value.map((item) => String(item).trim().toUpperCase()).filter(Boolean) : typeof value === 'string' ? value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean) : [];
const formatDateTime = (value) => value ? new Date(value).toLocaleString() : '—';
const formatEnum = (value) => String(value || '—').toLowerCase().split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
const Modal = ({ title, onClose, children }) => <div className="modal-backdrop"><div className="modal-surface"><div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}><strong>{title}</strong><button type="button" className="btn-neutral" onClick={onClose}>×</button></div>{children}</div></div>;

export default function BusinessDetailPage() {
  const params = useParams();
  const businessId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { session } = useAuth();
  const [business, setBusiness] = useState(null);
  const [keys, setKeys] = useState([]);
  const [revokeKey, setRevokeKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const canManageKeys = useMemo(() => {
    const access = session?.tokens?.accessToken?.payload || {};
    const id = session?.tokens?.idToken?.payload || {};
    const groups = [...normalizeGroups(access?.['cognito:groups'] || access?.groups), ...normalizeGroups(id?.['cognito:groups'] || id?.groups)];
    return groups.includes('ADMIN') || groups.includes('SUPER_ADMIN');
  }, [session]);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true); setError(null);
    try {
      const [businessResponse, keyResponse] = await Promise.all([api.businesses.get(businessId), api.businesses.apiKeys.list(businessId)]);
      setBusiness(businessResponse);
      setKeys(Array.isArray(keyResponse) ? keyResponse : keyResponse?.content || []);
    } catch (err) { setError(err?.message || 'Failed to load Business details.'); }
    finally { setLoading(false); }
  }, [businessId]);

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

  return <div style={{ display: 'grid', gap: '1rem' }}>
    <div className="card" style={{ display: 'grid', gap: '0.6rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}><div><h1 style={{ margin: 0 }}>{business?.name || `Business ${businessId}`}</h1><p style={{ margin: '0.35rem 0 0', color: 'var(--muted)' }}>Business identity, owner access and API credentials are separate controls.</p></div><div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}><Link href="/dashboard/businesses" className="btn-neutral" style={{ textDecoration: 'none' }}>← Businesses</Link>{business?.ownerAccountId ? <Link href={`/dashboard/accounts/accounts/${encodeURIComponent(business.ownerAccountId)}#business-tools-access`} className="btn-primary" style={{ textDecoration: 'none' }}>Owner access and payments</Link> : null}<button type="button" className="btn-neutral" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div></div><div style={{ padding: '0.7rem', background: 'var(--accent-soft)', borderRadius: '10px', fontSize: '13px' }}>An enabled credential does not prove paid access or readiness to transact. Business operational/KYB status, owner entitlement, credential state and enforcement are independent.</div></div>
    {error ? <div className="alert alert-error">{error}</div> : null}{info ? <div className="alert alert-success">{info}</div> : null}
    {business ? <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.65rem' }}>{[['Business ID', business.id], ['Name', business.name], ['Legal name', business.legalName], ['Owner account', business.ownerAccountReference || business.ownerAccountId], ['Owner email', business.ownerAccountEmail], ['Country', business.countryCode], ['Registration number', business.registrationNumber], ['Operational status', formatEnum(business.status)], ['KYB status', formatEnum(business.kybStatus)], ['Default Business', business.defaultBusiness ? 'Yes' : 'No'], ['Created', formatDateTime(business.createdAt)], ['Updated', formatDateTime(business.updatedAt)]].map(([label, value]) => <div key={label} style={{ padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}><div style={{ color: 'var(--muted)', fontSize: '12px' }}>{label}</div><strong>{value || '—'}</strong></div>)}</div> : null}
    <div className="card" style={{ display: 'grid', gap: '0.75rem' }}><div><strong>Business API credentials</strong><div style={{ color: 'var(--muted)', fontSize: '13px' }}>Active and revoked LIVE/SANDBOX credential metadata. Full API keys and webhook signing secrets are available only to the Business owner once, when generated in the customer portal.</div></div>{keys.length === 0 ? <div style={{ color: 'var(--muted)' }}>No credentials.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}><thead><tr>{['Masked key', 'Name', 'Environment', 'Status', 'Webhook URL', 'Created', ''].map((label) => <th key={label} style={{ padding: '0.45rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{label}</th>)}</tr></thead><tbody>{keys.map((key) => { const revoked = key.enabled === false; return <tr key={key.id} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '0.45rem' }}><code>{key.maskedKey || key.keyPrefix || '—'}</code></td><td style={{ padding: '0.45rem' }}>{key.name || '—'}</td><td style={{ padding: '0.45rem' }}>{formatEnum(key.environment)}</td><td style={{ padding: '0.45rem' }}>{revoked ? 'Revoked' : 'Enabled'}</td><td style={{ padding: '0.45rem', overflowWrap: 'anywhere' }}>{key.webhookUrl || '—'}</td><td style={{ padding: '0.45rem' }}>{formatDateTime(key.createdAt)}</td><td style={{ padding: '0.45rem' }}>{canManageKeys && !revoked ? <button type="button" className="btn-danger btn-sm" onClick={() => setRevokeKey(key)}>Revoke</button> : null}</td></tr>; })}</tbody></table></div>}<div style={{ color: 'var(--muted)', fontSize: '12px' }}>Credential generation is owner-only and must be completed in the customer portal. Administrators can inspect masked metadata and revoke active credentials, but cannot generate or reveal secrets.</div></div>
    {revokeKey ? <Modal title="Revoke API credential?" onClose={() => saving ? null : setRevokeKey(null)}><div style={{ display: 'grid', gap: '0.75rem' }}><div>Revoke <strong>{revokeKey.name || revokeKey.keyPrefix}</strong>? This does not delete history or stop delivery for already accepted transactions.</div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}><button type="button" className="btn-neutral" onClick={() => setRevokeKey(null)}>Cancel</button><button type="button" className="btn-danger" disabled={saving} onClick={revoke}>{saving ? 'Revoking…' : 'Revoke credential'}</button></div></div></Modal> : null}
  </div>;
}
