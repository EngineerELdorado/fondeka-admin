'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const formatUsd = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
};

const formatNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString() : '—';
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const cents = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
};

const getHealth = (audit) => {
  if (!audit) {
    return {
      tone: 'empty',
      label: 'Not run',
      message: 'Migration has not run in this environment.'
    };
  }

  const totalsMatch = cents(audit.legacyAccountBalanceTotal) === cents(audit.postUsdWalletTotal);
  const critical = audit.reconciled === false || Number(audit.accountMismatchCount || 0) > 0 || !totalsMatch;
  if (critical) {
    return {
      tone: 'critical',
      label: 'Critical',
      message: 'Migration reconciliation failed. Do not proceed with USD wallet cutover until backend review is complete.'
    };
  }

  if (audit.reconciled === true && Number(audit.overwrittenWalletCount || 0) > 0) {
    return {
      tone: 'warning',
      label: 'Warning',
      message: 'Migration reconciled, but some pre-existing USD wallet balances were overwritten. Review the override list.'
    };
  }

  return {
    tone: 'healthy',
    label: 'Healthy',
    message: 'Migration reconciled and legacy USD totals match final USD wallet totals.'
  };
};

const badgeStyle = (tone) => {
  if (tone === 'healthy') return { background: '#ECFDF3', color: '#15803D', borderColor: '#BBF7D0' };
  if (tone === 'warning') return { background: '#FFFBEB', color: '#B45309', borderColor: '#FDE68A' };
  if (tone === 'critical') return { background: '#FEF2F2', color: '#B91C1C', borderColor: '#FECACA' };
  return { background: '#F8FAFC', color: '#475569', borderColor: '#CBD5E1' };
};

const StatusBadge = ({ health }) => {
  const style = badgeStyle(health.tone);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '999px',
        border: `1px solid ${style.borderColor}`,
        background: style.background,
        color: style.color,
        padding: '0.25rem 0.65rem',
        fontSize: '12px',
        fontWeight: 900,
        textTransform: 'uppercase'
      }}
    >
      {health.label}
    </span>
  );
};

const MetricCard = ({ label, value, tone }) => {
  const accent = tone === 'critical' ? '#B91C1C' : tone === 'warning' ? '#B45309' : 'var(--text)';
  return (
    <div className="card" style={{ padding: '0.85rem', display: 'grid', gap: '0.25rem' }}>
      <div style={{ color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ color: accent, fontSize: '20px', fontWeight: 900 }}>{value}</div>
    </div>
  );
};

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 800, wordBreak: 'break-word' }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

export default function LegacyUsdWalletMigrationPage() {
  const [audit, setAudit] = useState(null);
  const [latestLoading, setLatestLoading] = useState(false);
  const [latestError, setLatestError] = useState(null);
  const [notRun, setNotRun] = useState(false);
  const [overrides, setOverrides] = useState([]);
  const [overridesPage, setOverridesPage] = useState(0);
  const [overridesSize, setOverridesSize] = useState(20);
  const [overridesTotalPages, setOverridesTotalPages] = useState(1);
  const [overridesTotalElements, setOverridesTotalElements] = useState(0);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [overridesError, setOverridesError] = useState(null);

  const health = useMemo(() => getHealth(audit), [audit]);
  const shouldLoadOverrides = Number(audit?.overwrittenWalletCount || 0) > 0;

  const loadLatest = async () => {
    setLatestLoading(true);
    setLatestError(null);
    setNotRun(false);
    try {
      const res = await api.walletMigrations.legacyUsdLatest();
      setAudit(res || null);
    } catch (err) {
      if (err?.status === 404) {
        setAudit(null);
        setNotRun(true);
        return;
      }
      setLatestError(err.message || 'Failed to load legacy USD wallet migration audit.');
    } finally {
      setLatestLoading(false);
    }
  };

  const loadOverrides = async () => {
    if (!shouldLoadOverrides) return;
    setOverridesLoading(true);
    setOverridesError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(overridesPage));
      params.set('size', String(overridesSize));
      const res = await api.walletMigrations.legacyUsdOverrides(params);
      setOverrides(Array.isArray(res) ? res : res?.content || []);
      setOverridesTotalPages(Number(res?.totalPages || 1));
      setOverridesTotalElements(Number(res?.totalElements || 0));
    } catch (err) {
      setOverrides([]);
      setOverridesError(err.message || 'Failed to load USD wallet override records.');
    } finally {
      setOverridesLoading(false);
    }
  };

  useEffect(() => {
    loadLatest();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shouldLoadOverrides) {
      setOverrides([]);
      setOverridesTotalPages(1);
      setOverridesTotalElements(0);
      return;
    }
    loadOverrides();
  }, [shouldLoadOverrides, overridesPage, overridesSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const overrideColumns = useMemo(() => [
    { key: 'accountId', label: 'Account ID' },
    { key: 'accountBalanceId', label: 'Account Balance ID' },
    { key: 'fiatWalletId', label: 'USD Fiat Wallet ID' },
    { key: 'legacyBalance', label: 'Legacy Balance', render: (row) => formatUsd(row.legacyBalance) },
    { key: 'previousWalletBalance', label: 'Previous Wallet Balance', render: (row) => formatUsd(row.previousWalletBalance) },
    {
      key: 'balanceDelta',
      label: 'Delta',
      render: (row) => {
        const amount = Number(row.balanceDelta);
        const color = amount > 0 ? '#15803D' : amount < 0 ? '#B91C1C' : 'var(--text)';
        return <span style={{ color, fontWeight: 800 }}>{formatUsd(row.balanceDelta)}</span>;
      }
    },
    { key: 'createdAt', label: 'Migrated At', render: (row) => formatDateTime(row.createdAt) }
  ], []);

  const summaryRows = [
    { label: 'Migration key', value: audit?.migrationKey || (notRun ? '—' : audit?.migrationKey) },
    { label: 'Migration timestamp', value: formatDateTime(audit?.createdAt) },
    { label: 'Reconciled', value: audit ? (audit.reconciled ? 'Yes' : 'No') : '—' },
    { label: 'Legacy balances', value: formatNumber(audit?.legacyAccountBalanceCount) },
    { label: 'Legacy total', value: formatUsd(audit?.legacyAccountBalanceTotal) },
    { label: 'Existing USD wallets before migration', value: formatNumber(audit?.existingUsdWalletCount) },
    { label: 'Existing USD wallet total before migration', value: formatUsd(audit?.existingUsdWalletTotal) },
    { label: 'Created USD wallets', value: formatNumber(audit?.insertedWalletCount) },
    { label: 'Overwritten USD wallets', value: formatNumber(audit?.overwrittenWalletCount) },
    { label: 'Final USD wallets', value: formatNumber(audit?.postUsdWalletCount) },
    { label: 'Final USD wallet total', value: formatUsd(audit?.postUsdWalletTotal) },
    { label: 'Account mismatches', value: formatNumber(audit?.accountMismatchCount) }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Legacy USD Wallet Migration</div>
          <div style={{ color: 'var(--muted)' }}>Read-only audit for legacy account_balances migration into USD fiat wallets.</div>
        </div>
        <button type="button" className="btn-primary" onClick={loadLatest} disabled={latestLoading}>
          {latestLoading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {latestError ? <div className="card" style={{ color: '#B91C1C', fontWeight: 800 }}>{latestError}</div> : null}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <div style={{ fontWeight: 900 }}>Reconciliation summary</div>
            <div style={{ color: health.tone === 'critical' ? '#B91C1C' : 'var(--muted)', fontSize: '13px', fontWeight: health.tone === 'critical' ? 800 : 500 }}>
              {health.message}
            </div>
          </div>
          <StatusBadge health={health} />
        </div>
        {latestLoading ? <div style={{ color: 'var(--muted)' }}>Loading latest migration audit…</div> : <DetailGrid rows={summaryRows} />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <MetricCard label="Legacy balance count" value={formatNumber(audit?.legacyAccountBalanceCount)} />
        <MetricCard label="Legacy balance total" value={formatUsd(audit?.legacyAccountBalanceTotal)} />
        <MetricCard label="Final wallet count" value={formatNumber(audit?.postUsdWalletCount)} />
        <MetricCard label="Final wallet total" value={formatUsd(audit?.postUsdWalletTotal)} />
        <MetricCard label="Mismatches" value={formatNumber(audit?.accountMismatchCount)} tone={Number(audit?.accountMismatchCount || 0) > 0 ? 'critical' : null} />
        <MetricCard label="Overwrites" value={formatNumber(audit?.overwrittenWalletCount)} tone={Number(audit?.overwrittenWalletCount || 0) > 0 ? 'warning' : null} />
      </div>

      {shouldLoadOverrides ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 900 }}>Pre-existing USD wallet conflicts</div>
            <div>
              <label htmlFor="overridesPage">Page</label>
              <input id="overridesPage" type="number" min={0} value={overridesPage} onChange={(e) => setOverridesPage(Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor="overridesSize">Size</label>
              <input id="overridesSize" type="number" min={1} max={500} value={overridesSize} onChange={(e) => setOverridesSize(Number(e.target.value))} />
            </div>
            <button type="button" className="btn-neutral" onClick={loadOverrides} disabled={overridesLoading}>
              {overridesLoading ? 'Loading…' : 'Refresh overrides'}
            </button>
          </div>
          <div className="card" style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Positive delta means the USD wallet was increased. Negative delta means it was reduced. Zero should normally not appear in overrides.
          </div>
          {overridesError ? <div className="card" style={{ color: '#B91C1C', fontWeight: 800 }}>{overridesError}</div> : null}
          <DataTable
            columns={overrideColumns}
            rows={overrides}
            page={overridesPage}
            pageSize={overridesSize}
            totalPages={overridesTotalPages}
            totalElements={overridesTotalElements}
            onPageChange={setOverridesPage}
            emptyLabel={overridesLoading ? 'Loading overrides…' : 'No override records found'}
          />
        </div>
      ) : (
        <div className="card" style={{ color: 'var(--muted)', fontWeight: 700 }}>
          {audit ? 'No pre-existing USD wallet conflicts found.' : 'Overrides will appear here if the migration overwrote pre-existing USD wallet balances.'}
        </div>
      )}
    </div>
  );
}
