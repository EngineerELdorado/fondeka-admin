'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Alert, Card, formatInstant, useFailoverError } from '@/components/payout-failover/Common';
import ArrayPager from './ArrayPager';

export default function HistoryPanel({ active, revision, focusRevision }) {
  const [page, setPage] = useState(0), [rows, setRows] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [reload, setReload] = useState(0);
  const sequence = useRef(0), focused = useRef(null), fail = useFailoverError(setError);
  useEffect(() => {
    const requested = Number(focusRevision);
    if (revision != null && Number.isSafeInteger(requested) && requested > 0) setPage(Math.max(0, Math.floor((revision - requested) / 20)));
  }, [revision, focusRevision]);
  useEffect(() => {
    if (!active) return undefined;
    const token = ++sequence.current; setLoading(true); setError('');
    api.rechargeFailover.history({ page: String(page), size: '20' }).then((response) => {
      if (!Array.isArray(response)) throw new Error('Recharge revision history must be an array.');
      if (token === sequence.current) setRows(response);
    }).catch((err) => { if (token === sequence.current) void fail(err); }).finally(() => { if (token === sequence.current) setLoading(false); });
    return () => { sequence.current += 1; };
  }, [active, page, reload, revision, fail]);
  useEffect(() => { if (active && rows) focused.current?.scrollIntoView({ block: 'nearest' }); }, [active, rows]);
  return <Card title="Recharge revision history">
    <p>Each publication records the complete configuration, actor, reason and timestamp. To restore historical settings, review the products and publish a new revision; never reset a journal or rewind a cutover.</p>
    <Alert>{error}</Alert><button type="button" className="btn-neutral" disabled={loading} onClick={() => setReload((value) => value + 1)}>Refresh recharge history</button>
    {loading ? <span role="status">Loading recharge revisions…</span> : null}
    {focusRevision != null ? <span>Requested recharge revision {focusRevision}.</span> : null}
    {(rows || []).map((entry) => <details className="failover-rule-summary" key={entry.revision} open={String(entry.revision) === String(focusRevision)} ref={String(entry.revision) === String(focusRevision) ? focused : undefined}><summary style={{ cursor: 'pointer' }}><strong>Recharge revision {entry.revision}</strong> · Admin {entry.adminId} · {formatInstant(entry.changedAt)}<div>{entry.reason}</div></summary><pre style={{ marginTop: '.75rem' }}>{JSON.stringify(entry.configuration, null, 2)}</pre></details>)}
    {rows?.length === 0 && !loading ? <span>No published recharge revisions on this page.</span> : null}
    {rows ? <ArrayPager page={page} size={20} length={rows.length} busy={loading} onChange={setPage} /> : null}
  </Card>;
}
