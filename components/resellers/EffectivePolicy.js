'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { PresentationSelect } from '@/components/RegulatorPresentation';
import { isRegulatorRestrictedService } from '@/lib/regulator-presentation';
import { RESELLER_POLICY_FIELDS, RESELLER_SERVICES, resellerId, resellerLabel, resellerScope, resellerFieldSource } from '@/lib/resellers';
import { Card, Alert, Field, ProductPicker, gridStyle, actionStyle, useMounted, useResellerError } from './Common';

export default function EffectivePolicy({ accountId = null }) {
  const [service, setService] = useState(''), [product, setProduct] = useState(''), [result, setResult] = useState(null), [sources, setSources] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [sourceError, setSourceError] = useState('');
  const lock = useRef(false), mounted = useMounted(), fail = useResellerError();
  const preview = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setSourceError(''); setResult(null); setSources([]);
    try {
      const query = { ...(accountId == null ? {} : { accountId }), ...(service ? { service } : {}), ...(product ? { billProductId: resellerId(product, 'Bill product ID') } : {}) };
      const effective = await api.resellers.policies.effective(query);
      if (!effective?.values || !Array.isArray(effective.sources) || RESELLER_POLICY_FIELDS.some(([key]) => effective.values[key] == null)) throw new Error('Effective behavior is unavailable. Refresh to retry.');
      const responses = await Promise.allSettled(effective.sources.map((source) => api.resellers.policies.get(source.id)));
      if (!mounted.current) return;
      const rows = responses.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value);
      if (responses.some((entry) => entry.status === 'rejected') || effective.sources.some((source) => !rows.some((row) => row.id === source.id && row.version === source.version))) setSourceError('Some policy sources are unavailable or changed during this check. Refresh the preview before relying on their explanations.');
      setResult(effective); setSources(rows);
    } catch (err) { if (mounted.current) setError(await fail(err)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return <Card title="Preview effective behavior">
    <div style={{ ...gridStyle, alignItems: 'end' }}>
      <Field label="Service"><PresentationSelect value={service} disabled={busy} onChange={(event) => { setService(event.target.value); setProduct(''); setResult(null); }}><option value="">Default context</option>{RESELLER_SERVICES.map((value) => <option key={value} value={value} data-regulator-restricted={isRegulatorRestrictedService(value)}>{resellerLabel(value)}</option>)}</PresentationSelect></Field>
      {service === 'BILL_PAYMENTS' ? <Field label="Bill product"><ProductPicker value={product} disabled={busy} onChange={(value) => { setProduct(value); setResult(null); }} /></Field> : null}
      <button type="button" className="btn-neutral" disabled={busy} onClick={() => void preview()}>{busy ? 'Checking…' : 'Preview merged settings'}</button>
    </div>
    <small>Resolved for {accountId == null ? 'global defaults' : `account ${accountId}`}. Configuration preview only; an existing purchase keeps its frozen decision.</small>
    <Alert>{error || sourceError}</Alert>
    {result ? <div style={{ display: 'grid', gap: '.65rem' }}>{RESELLER_POLICY_FIELDS.map(([key, label]) => {
      const source = resellerFieldSource(key, result.sources, sources);
      return <div key={key} style={{ ...actionStyle, justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '.4rem' }}><span>{label}: <strong>{resellerLabel(result.values[key])}</strong></span><small style={{ color: 'var(--muted)' }}>{source ? `${resellerScope(source)} · ID ${source.id} · v${source.version}` : 'Source unavailable'}</small></div>;
    })}<details><summary>Applicable policies in precedence order</summary>{result.sources.map((source) => <div key={source.id}>Policy {source.id} · version {source.version}{sources.find((row) => row.id === source.id && row.version === source.version) ? ` · ${resellerScope(sources.find((row) => row.id === source.id && row.version === source.version))}` : ' · unavailable / changed'}</div>)}</details></div> : null}
  </Card>;
}
