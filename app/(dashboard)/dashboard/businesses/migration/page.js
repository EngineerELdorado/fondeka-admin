'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const normalizeGroups = (value) => Array.isArray(value)
  ? value.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
  : typeof value === 'string' ? value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean) : [];

const sumResults = (pages) => pages.reduce((totals, page) => ({
  scanned: totals.scanned + Number(page.scanned || 0),
  eligible: totals.eligible + Number(page.eligible || 0),
  granted: totals.granted + Number(page.granted || 0),
  skipped: totals.skipped + Number(page.skipped || 0),
  failed: totals.failed + Number(page.failed || 0),
  failedAccountIds: [...totals.failedAccountIds, ...(Array.isArray(page.failedAccountIds) ? page.failedAccountIds : [])]
}), { scanned: 0, eligible: 0, granted: 0, skipped: 0, failed: 0, failedAccountIds: [] });

const ResultSummary = ({ title, pages }) => {
  const totals = sumResults(pages);
  const finalPage = pages[pages.length - 1];
  if (!pages.length) return null;
  return (
    <div className="card" style={{ display: 'grid', gap: '0.7rem' }}>
      <div><strong>{title}</strong><div style={{ color: 'var(--muted)', fontSize: '13px' }}>Dashboard-summed totals across {pages.length} server page{pages.length === 1 ? '' : 's'}.</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.6rem' }}>
        {[
          ['Scanned', totals.scanned], ['Eligible', totals.eligible], ['Granted', totals.granted],
          ['Skipped', totals.skipped], ['Failed', totals.failed]
        ].map(([label, value]) => <div key={label} style={{ padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}><div style={{ color: 'var(--muted)', fontSize: '12px' }}>{label}</div><strong style={{ fontSize: '20px' }}>{value.toLocaleString()}</strong></div>)}
      </div>
      <div style={{ fontSize: '13px' }}>Last cursor: {finalPage.nextAfterAccountId ?? '—'} · {finalPage.hasMore ? 'More accounts remain' : 'Run complete'}</div>
      {totals.failedAccountIds.length ? <div style={{ color: '#B91C1C', overflowWrap: 'anywhere' }}><strong>Failed account IDs:</strong> {Array.from(new Set(totals.failedAccountIds)).join(', ')}</div> : null}
    </div>
  );
};

export default function BusinessToolsMigrationPage() {
  const { session } = useAuth();
  const [limit, setLimit] = useState('100');
  const [reason, setReason] = useState('');
  const [previewPages, setPreviewPages] = useState([]);
  const [applyPages, setApplyPages] = useState([]);
  const [running, setRunning] = useState('');
  const [confirmApply, setConfirmApply] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const isSuperAdmin = useMemo(() => {
    const access = session?.tokens?.accessToken?.payload || {};
    const id = session?.tokens?.idToken?.payload || {};
    return [...normalizeGroups(access?.['cognito:groups'] || access?.groups), ...normalizeGroups(id?.['cognito:groups'] || id?.groups)].includes('SUPER_ADMIN');
  }, [session]);

  const validate = () => {
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) return 'Limit must be a whole number from 1 to 500.';
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3) return 'Enter a meaningful audit reason.';
    if (normalizedReason.length > 1000) return 'Reason must be 1,000 characters or fewer.';
    return null;
  };

  const runAllPages = async (dryRun) => {
    const validationError = validate();
    if (validationError) return setError(validationError);
    if (!isSuperAdmin) return setError('Super Admin permission is required.');
    setRunning(dryRun ? 'preview' : 'apply');
    setError(null);
    setInfo(null);
    if (dryRun) setPreviewPages([]); else setApplyPages([]);
    let cursor = 0;
    const results = [];
    try {
      for (let pageNumber = 0; pageNumber < 10000; pageNumber += 1) {
        const response = await api.businessTools.migrate({
          dryRun,
          afterAccountId: cursor,
          limit: Number(limit),
          reason: reason.trim()
        });
        results.push(response);
        if (dryRun) setPreviewPages([...results]); else setApplyPages([...results]);
        if (!response?.hasMore) break;
        const nextCursor = Number(response.nextAfterAccountId);
        if (!Number.isFinite(nextCursor) || nextCursor <= cursor) throw new Error('Migration returned an invalid next cursor; processing stopped safely.');
        cursor = nextCursor;
      }
      setInfo(dryRun ? 'Full preview completed. No access was granted.' : 'Reviewed migration apply run completed. Review failures before enforcement.');
    } catch (err) {
      setError(`${dryRun ? 'Preview' : 'Apply'} stopped after ${results.length} page${results.length === 1 ? '' : 's'}: ${err?.message || 'request failed'}. It was not retried automatically.`);
    } finally {
      setRunning('');
      setConfirmApply(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="card" style={{ display: 'grid', gap: '0.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div><h1 style={{ margin: 0 }}>Business Tools migration</h1><p style={{ margin: '0.35rem 0 0', color: 'var(--muted)' }}>Review and migrate accounts with completed historical store-creation payments.</p></div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}><Link href="/dashboard/businesses" className="btn-neutral" style={{ textDecoration: 'none' }}>Businesses</Link><Link href="/dashboard/businesses/plans" className="btn-neutral" style={{ textDecoration: 'none' }}>Plans</Link></div>
        </div>
        <div style={{ padding: '0.75rem', background: '#FFF7ED', color: '#92400E', borderRadius: '10px', fontSize: '13px' }}>
          This operation never runs on page load. Complete a full preview, review failures, then explicitly apply from cursor zero. A configured price or enabled purchases are not required. Preview results are observations, not reservations.
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {info ? <div className="alert alert-success">{info}</div> : null}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 220px) minmax(260px, 1fr)', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}><span>Accounts per request</span><input type="number" min="1" max="500" value={limit} disabled={Boolean(running)} onChange={(e) => setLimit(e.target.value)} /></label>
          <label style={{ display: 'grid', gap: '0.25rem' }}><span>Audit reason</span><input maxLength={1000} value={reason} disabled={Boolean(running)} placeholder="Approved migration review run" onChange={(e) => setReason(e.target.value)} /></label>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Eligible means the account has a positive, completed, non-refunded store-creation payment and no conflicting entitlement. The server grants all tools in BUNDLE mode or Online Stores only in PER_TOOL mode. No top-up, FX conversion, refund or wallet credit is created.</div>
        {isSuperAdmin ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral" disabled={Boolean(running)} onClick={() => runAllPages(true)}>{running === 'preview' ? 'Running preview…' : 'Preview all pages'}</button>
            <button type="button" className="btn-danger" disabled={Boolean(running) || previewPages.length === 0} onClick={() => setConfirmApply(true)}>Apply reviewed migration</button>
          </div>
        ) : <div style={{ color: 'var(--muted)' }}>Read only — Super Admin permission is required to preview or apply migration.</div>}
      </div>

      <ResultSummary title="Preview results" pages={previewPages} />
      <ResultSummary title="Apply results" pages={applyPages} />

      {confirmApply ? (
        <div className="modal-backdrop"><div className="modal-surface"><div style={{ display: 'grid', gap: '0.8rem' }}>
          <strong>Apply reviewed migration from cursor zero?</strong>
          <div style={{ color: '#92400E' }}>This can grant non-expiring Business Tools access. Every account is revalidated independently. Existing or revoked entitlements are skipped, explicit payment requirements remain respected, and financial history is not rewritten.</div>
          <div>Preview pages reviewed: {previewPages.length}. The apply run will intentionally restart at <code>afterAccountId=0</code>.</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}><button type="button" className="btn-neutral" onClick={() => setConfirmApply(false)}>Cancel</button><button type="button" className="btn-danger" onClick={() => runAllPages(false)}>Confirm and apply all pages</button></div>
        </div></div></div>
      ) : null}
    </div>
  );
}
