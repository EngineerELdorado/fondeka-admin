'use client';

import { cloneElement, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import HelpTip from '@/components/failover/HelpTip';

export const formatInstant = (value) => !value ? '—' : Number.isNaN(new Date(value).getTime()) ? String(value) : `${new Date(value).toISOString().replace('T', ' ').replace('Z', '')} UTC`;
export function Field({ label, children, help, tip }) {
  return <div className={`failover-field${tip ? ' failover-field--help' : ''}`}><label className="failover-field"><span>{label}</span>{cloneElement(children, { 'aria-label': label })}{help ? <small>{help}</small> : null}</label>{tip ? <HelpTip label={label}>{tip}</HelpTip> : null}</div>;
}
export function Card({ title, children, ...props }) {
  return <section className="card failover-card" {...props}>{title ? <h2>{title}</h2> : null}{children}</section>;
}
export function Alert({ children, success = false }) {
  return children ? <div className={`alert ${success ? 'alert-success' : 'alert-error'}`} role={success ? 'status' : 'alert'}>{children}</div> : null;
}
export function useFailoverError(setError) {
  const { refreshSession } = useAuth();
  return useCallback(async (error) => {
    if (error?.status === 401) await refreshSession(true);
    setError(`${error?.status === 403 ? 'Permission denied. ' : error?.status === 401 ? 'Session renewed; retry the request. ' : ''}${error?.message || 'The request failed. Please retry.'}`);
  }, [refreshSession, setError]);
}
export function ValidationReport({ report, title = 'Validation report' }) {
  if (!report) return null;
  return <div className="failover-card" aria-label={title}>
    <strong>{title}: {report.valid ? 'Checks passed' : 'Needs changes'}</strong>
    <ul className="failover-issues">{report.issues.map((issue, index) => <li key={index}><strong>{issue.severity === 'ERROR' ? 'Fix required' : 'Review'}</strong><span>{issue.message}</span><details className="failover-technical"><summary>Technical details</summary><code>{issue.code} · {issue.path || 'configuration'}</code></details></li>)}</ul>
    {report.routes.length ? <details className="failover-technical"><summary>Checked provider routes ({report.routes.length})</summary><div className="failover-grid">{report.routes.map((route, index) => <div className="failover-rule-summary" key={`${route.ruleId}-${index}`}>
      <strong>{route.order}. {route.paymentMethod || 'Route'} · {route.countryCode || '—'} · {route.currency || '—'}</strong>
      <span>Rule {route.ruleId} · {route.enabled ? 'Enabled' : 'Disabled'}</span>
      <span>#{route.sourceRouteId} ({route.sourceActive ? 'active' : 'inactive'}) → #{route.targetRouteId} ({route.targetActive ? 'active' : 'inactive'})</span>
      {route.destinationCheckRequired ? <span>Recipient funding eligibility must be checked at execution.</span> : null}
    </div>)}</div></details> : null}
    <small>These are local configuration checks. They do not guarantee provider funds, availability or commercial fees.</small>
  </div>;
}
export function Pager({ page, totalPages, totalElements, busy, onChange }) {
  return <div className="failover-actions"><button type="button" className="btn-neutral btn-sm" disabled={busy || page === 0} onClick={() => onChange(page - 1)}>Previous page</button><span>Page {page + 1} of {Math.max(1, totalPages || 0)} · {totalElements ?? 0} records</span><button type="button" className="btn-neutral btn-sm" disabled={busy || page + 1 >= (totalPages || 0)} onClick={() => onChange(page + 1)}>Next page</button></div>;
}
