'use client';

import { cloneElement } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PresentationLink as Link, RegulatorField } from '@/components/RegulatorPresentation';
import { canReadSandboxHistory, sandboxHistoryHref } from '@/lib/business-api-sandbox';

export function SandboxHistoryLink({ businessId, accountId, apiKeyId, children = 'Sandbox API history', className = 'btn-neutral btn-sm' }) {
  const { session } = useAuth();
  if (!canReadSandboxHistory(session)) return null;
  return <Link href={sandboxHistoryHref({ businessId, accountId, apiKeyId })} className={className} style={{ textDecoration: 'none' }}>{children}</Link>;
}

export const formatSandboxTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : `${date.toISOString().replace('T', ' ').replace('Z', '')} UTC`;
};
export const sandboxAmount = (value, currency) => value == null ? '—' : `${value} ${currency || ''}`.trim();

export function SandboxField({ label, children }) {
  return <label className="sandbox-field"><span>{label}</span>{cloneElement(children, { 'aria-label': label })}</label>;
}
export function SandboxAlert({ children }) {
  return children ? <div className="alert alert-error" role="alert">{children}</div> : null;
}
export function SandboxStatus({ status }) {
  return <span className={`sandbox-status sandbox-status--${status?.toLowerCase()}`}>{status || 'Unavailable'}</span>;
}
export function SandboxHeader({ title = 'Business API sandbox history', children }) {
  return <header className="card sandbox-card"><div className="sandbox-heading"><div><span className="sandbox-environment">SANDBOX · Test data</span><h1>{title}</h1></div><div className="sandbox-actions">{children}</div></div>
    <p>Accepted sandbox collections and payouts across Businesses. Stored separately from financial transactions; amounts are test data in their stated currency.</p>
    <small>Read-only history. Refreshing does not advance the simulator, move virtual funds, contact a provider or send webhooks.</small>
  </header>;
}
export function SandboxPermissionDenied() {
  return <section className="card"><h1>Business API sandbox history</h1><SandboxAlert>Permission denied. Admin, Super Admin or Assistant access is required.</SandboxAlert></section>;
}
export function SandboxInfo({ items }) {
  return <dl className="sandbox-grid sandbox-info">{items.map(([label, value]) => <RegulatorField key={label} field={label}><div><dt>{label}</dt><dd>{value ?? '—'}</dd></div></RegulatorField>)}</dl>;
}
export const sandboxReadError = (error) => `${error?.status === 403 ? 'Permission denied. ' : error?.status === 401 ? 'Your session needs renewal. Retry after signing in. ' : ''}${error?.message || 'Unable to load sandbox history. Please retry.'}`;
