'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const PERCENT_FIELDS = [
  {
    key: 'baseEligibilityPercent',
    label: 'Base eligibility %',
    help: 'Normal users base eligibility percent of realized profit.'
  },
  {
    key: 'untrustedEligibilityPercent',
    label: 'Untrusted eligibility %',
    help: 'Base eligibility percent for users on the untrusted borrowers list.'
  },
  {
    key: 'dailyPenaltyPercent',
    label: 'Daily penalty %',
    help: 'Daily overdue penalty percent (unpaid + accrued penalties).'
  }
];

const toFormValue = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (Number.isNaN(Number(value))) return '';
  return String(value);
};

const toNumberOrNull = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

export default function LoanPolicyConfigPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningPenalties, setRunningPenalties] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [batchSize, setBatchSize] = useState('');
  const [runResult, setRunResult] = useState(null);
  const [initial, setInitial] = useState({
    baseEligibilityPercent: '',
    untrustedEligibilityPercent: '',
    dailyPenaltyPercent: ''
  });
  const [draft, setDraft] = useState({
    baseEligibilityPercent: '',
    untrustedEligibilityPercent: '',
    dailyPenaltyPercent: ''
  });

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.loans.policyConfig.get();
      const next = {
        baseEligibilityPercent: toFormValue(res?.baseEligibilityPercent),
        untrustedEligibilityPercent: toFormValue(res?.untrustedEligibilityPercent),
        dailyPenaltyPercent: toFormValue(res?.dailyPenaltyPercent)
      };
      setInitial(next);
      setDraft(next);
    } catch (err) {
      setError(err?.message || 'Failed to load loan policy config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changedPayload = useMemo(() => {
    const payload = {};
    for (const field of PERCENT_FIELDS) {
      const current = toNumberOrNull(draft[field.key]);
      const original = toNumberOrNull(initial[field.key]);
      if (current === null) continue;
      if (original === null || current !== original) {
        payload[field.key] = current;
      }
    }
    return payload;
  }, [draft, initial]);

  const changedCount = Object.keys(changedPayload).length;

  const handleSave = async () => {
    if (!changedCount) {
      setInfo('No changes to save.');
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.loans.policyConfig.update(changedPayload);
      setInfo('Loan policy config updated.');
      await loadConfig();
    } catch (err) {
      setError(err?.message || 'Failed to update loan policy config');
    } finally {
      setSaving(false);
    }
  };

  const handleRunDailyPenalties = async () => {
    setRunningPenalties(true);
    setError(null);
    setInfo(null);
    setRunResult(null);
    try {
      const params = {};
      const trimmedBatchSize = String(batchSize || '').trim();
      if (trimmedBatchSize) {
        const parsed = Number(trimmedBatchSize);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          setError('Batch size must be a positive integer');
          setRunningPenalties(false);
          return;
        }
        params.batchSize = String(parsed);
      }
      const res = await api.loans.policyConfig.runDailyPenalties(params);
      setRunResult(res || null);
      setInfo('Daily penalties run triggered successfully.');
    } catch (err) {
      setError(err?.message || 'Failed to run daily penalties');
    } finally {
      setRunningPenalties(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>Loan Policy Config</div>
          <div style={{ color: 'var(--muted)' }}>Manage global loan eligibility and overdue penalty percentages.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button type="button" className="btn-neutral" onClick={loadConfig} disabled={loading || saving}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link href="/dashboard/loans" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
            ← Loans
          </Link>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.8rem' }}>
        {PERCENT_FIELDS.map((field) => (
          <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label htmlFor={field.key}>{field.label}</label>
            <input
              id={field.key}
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={draft[field.key]}
              onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
              disabled={loading || saving}
            />
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{field.help}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
        <div style={{ color: 'var(--muted)' }}>
          Percent values are human values (for example <strong>12.5</strong> means <strong>12.5%</strong>).
        </div>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={saving || loading || changedCount === 0}>
          {saving ? 'Saving…' : `Save ${changedCount ? `(${changedCount} field${changedCount > 1 ? 's' : ''})` : ''}`}
        </button>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Run daily loan penalties</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Manually triggers the same overdue installment penalty flow used by cron.
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '220px' }}>
            <label htmlFor="batchSize">Batch size (optional)</label>
            <input
              id="batchSize"
              type="number"
              min="1"
              step="1"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              placeholder="500"
              disabled={runningPenalties}
            />
          </div>
          <button type="button" className="btn-danger" onClick={handleRunDailyPenalties} disabled={runningPenalties}>
            {runningPenalties ? 'Running…' : 'Run daily penalties now'}
          </button>
        </div>
        {runResult && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
            <div><strong>Processed installments:</strong> {runResult?.processedInstallments ?? '—'}</div>
            <div><strong>Batch size used:</strong> {runResult?.batchSizeUsed ?? '—'}</div>
            <div><strong>Triggered at:</strong> {runResult?.triggeredAt || '—'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
