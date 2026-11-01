'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Alert, Card, Pager, formatInstant, useFailoverError } from './Common';

export default function HistoryPanel({ active, latestRevision, focusRevision }) {
  const [page, setPage] = useState(0), [result, setResult] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [reload, setReload] = useState(0);
  const sequence = useRef(0), fail = useFailoverError(setError), focused = useRef(null);
  useEffect(() => {
    if (latestRevision == null || !Number.isSafeInteger(Number(focusRevision)) || Number(focusRevision) <= 0) return;
    setPage(Math.max(0, Math.floor((latestRevision - Number(focusRevision)) / 20)));
  }, [focusRevision, latestRevision]);
  useEffect(() => {
    if (!active) return undefined;
    const token = ++sequence.current;
    setLoading(true); setError('');
    api.payoutFailover.history({ page: String(page), size: '20' }).then((response) => {
      if (!Array.isArray(response?.content) || !Number.isInteger(response.totalPages)) throw new Error('Published history is unavailable.');
      if (token === sequence.current) setResult(response);
    }).catch((err) => { if (token === sequence.current) void fail(err); }).finally(() => { if (token === sequence.current) setLoading(false); });
    return () => { sequence.current += 1; };
  }, [active, page, reload, latestRevision, fail]);
  useEffect(() => { if (active && result) focused.current?.scrollIntoView({ block: 'nearest' }); }, [active, result]);
  return <Card title="Immutable published revisions">
    <p>History explains policy selection. To restore historical rule settings, edit the current policy and publish a new revision. Previous cutovers and attempts cannot be rewound.</p>
    <Alert>{error}</Alert><div><button type="button" className="btn-neutral btn-sm" disabled={loading} onClick={() => setReload((value) => value + 1)}>Refresh revision history</button></div>
    {loading ? <span role="status">Loading revisions…</span> : null}
    {String(focusRevision) === '0' ? <span>Revision 0 uses deployment defaults; it has no published database history entry.</span> : null}
    {focusRevision != null && String(focusRevision) !== '0' ? <span>Requested revision {focusRevision}. New publications may move it to an adjacent page.</span> : null}
    {(result?.content || []).map((entry) => <details key={entry.revision} className="failover-rule-summary" open={String(focusRevision) === String(entry.revision)} ref={String(focusRevision) === String(entry.revision) ? focused : undefined}>
      <summary style={{ cursor: 'pointer' }}><strong>Revision {entry.revision}</strong> · Admin {entry.adminId} · {formatInstant(entry.changedAt)}<div>{entry.reason}</div></summary>
      <pre style={{ marginTop: '.7rem' }}>{JSON.stringify(entry.configuration, null, 2)}</pre>
    </details>)}
    {result?.content.length === 0 && !loading ? <span>No published revisions. Deployment defaults remain in effect until the first publication.</span> : null}
    {result ? <Pager page={page} totalPages={result.totalPages} totalElements={result.totalElements} busy={loading} onChange={setPage} /> : null}
    <small>Audits: PAYOUT_FAILOVER_POLICY_UPDATED, PAYOUT_FAILOVER_ACTIVATED and PAYOUT_FAILOVER_DEACTIVATED use target PAYOUT_FAILOVER_POLICY / 1. PAYOUT_FAILOVER_STATUS_CHECKED uses transaction / transaction ID.</small>
  </Card>;
}
