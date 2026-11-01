'use client';

import ResponsiveTable from '@/components/ResponsiveTable';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { payoutDefaultsResource } from '@/lib/payout-failover';
import { explainFailoverReason } from '@/lib/failover-presentation';
import { Alert, Field, ValidationReport, useFailoverError } from './Common';

export default function DefaultsPanel({ active, canImport, onImport }) {
  const [resource, setResource] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [blocked, setBlocked] = useState(false), [page, setPage] = useState(0);
  const sequence = useRef(0), fail = useFailoverError(setError);
  const load = useCallback(async () => {
    const token = ++sequence.current; setLoading(true); setError('');
    try { const result = payoutDefaultsResource(await api.payoutFailover.defaults()); if (token === sequence.current) { setResource(result); setPage(0); } }
    catch (err) { if (token === sequence.current) await fail(err); }
    finally { if (token === sequence.current) setLoading(false); }
  }, [fail]);
  useEffect(() => { if (active) void load(); return () => { sequence.current += 1; }; }, [active, load]);
  const rows = useMemo(() => (resource?.coverage || []).filter((row) => (!blocked || !row.executable || row.blockers.length > 0 || row.routes.some((route) => route.routeId == null || !route.active)) && (!query.trim() || [row.paymentMethod, row.countryCode, row.currency, row.action, row.scopeId, ...row.providers, ...row.blockers].join(' ').toLowerCase().includes(query.trim().toLowerCase()))), [resource, query, blocked]);
  return <details className="card failover-technical"><summary>Review environment defaults and coverage</summary><div className="failover-card">
    <p>These are backend-generated presets for this environment. They are a disabled draft, separate from your saved setup. Reading them does not contact providers or send payouts.</p>
    <div className="failover-actions"><button type="button" className="btn-neutral" disabled={loading} onClick={() => void load()}>{loading ? 'Checking environment…' : 'Refresh environment defaults'}</button>{resource && onImport ? <button type="button" className="btn-neutral" disabled={!canImport || loading || !!error || resource.truncated} onClick={() => onImport(resource.configuration)}>Replace draft rules with disabled defaults</button> : null}</div>
    <Alert>{error}</Alert>
    {error && resource ? <small>The previous assessment is retained. Refresh successfully before importing it.</small> : null}
    {resource ? <>
      <div className="failover-notice"><strong>Draft only · global switch off.</strong> Import replaces both rule lists in your local draft, keeps its customer account IDs and turns the draft off. It does not save or activate anything.</div>
      <p>{resource.coverage ? `${resource.coverage.filter((row) => row.executable).length} locally executable of ${resource.coverage.length} method/action combinations. ${resource.skippedSources} not executable.` : 'This backend did not supply method/action coverage.'} Locally executable means at least one reviewed source/alternate path passes local checks. Missing optional providers remain visible and do not necessarily block another alternate in the same winning scope. Provider balance, uptime, entitlement and recipient eligibility are not guaranteed.</p>
      {resource.truncated ? <Alert>The backend reported incomplete defaults. Review the full setup before relying on this assessment.</Alert> : null}
      {resource.coverage ? <>
        <div className="failover-grid"><Field label="Search default coverage" help="Filter locally by method, country, currency, provider or blocker."><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Country, method or currency…" /></Field><label className="failover-check"><input type="checkbox" checked={blocked} onChange={(event) => { setBlocked(event.target.checked); setPage(0); }} />Show only combinations with unavailable routes or blockers</label></div>
        <div className="failover-table"><ResponsiveTable><thead><tr>{['Payment destination / action', 'Winning preset / provider order', 'Resolved routes', 'Local readiness'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.slice(page * 20, (page + 1) * 20).map((row, index) => <tr key={`${row.paymentMethod}-${row.action}-${index}`}><td><strong>{row.paymentMethod}</strong><div>{row.countryCode || 'Country unavailable'} · {row.currency || 'Currency unavailable'}</div><small>{row.action === 'BUSINESS_API_PAYOUT' ? 'Business API payout' : row.action === 'WITHDRAW_FROM_WALLET' ? 'Wallet withdrawal' : row.action}</small></td><td>{row.scopeId || 'No matching preset'}<div>{row.enabled ? 'Scope allows backups' : 'Scope blocks backups'}</div><small>{row.providers.join(' → ')}</small></td><td>{row.routes.map((route, at) => <div key={at}>{route.provider}: {route.routeId == null ? 'mapping missing' : `route #${route.routeId} · ${route.active ? 'active' : 'inactive'}`}<small style={{ display: 'block' }}>Operator code: {route.providerCode || 'not configured'}</small></div>)}</td><td><strong>{row.executable ? 'Locally executable · not live' : 'Not executable'}</strong>{row.executable && row.routes.some((route) => route.routeId == null || !route.active) ? <small style={{ display: 'block' }}>At least one path is ready; some alternatives are unavailable.</small> : null}{row.blockers.length ? <ul className="failover-coverage-blockers">{row.blockers.map((code) => <li key={code}>{explainFailoverReason(code).title}<small style={{ display: 'block' }}>{code}</small></li>)}</ul> : null}</td></tr>)}</tbody></ResponsiveTable></div>
        {!rows.length ? <p>No matching coverage rows.</p> : null}
        <div className="failover-actions"><button type="button" className="btn-neutral btn-sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous coverage page</button><span>{rows.length} matching combinations · page {page + 1} of {Math.max(1, Math.ceil(rows.length / 20))}</span><button type="button" className="btn-neutral btn-sm" disabled={(page + 1) * 20 >= rows.length} onClick={() => setPage((value) => value + 1)}>Next coverage page</button></div>
      </> : null}
      <details className="failover-technical"><summary>Preset validation and concrete route pairs</summary><ValidationReport report={resource.readiness} title="Environment preset checks" /></details>
    </> : null}
  </div></details>;
}
