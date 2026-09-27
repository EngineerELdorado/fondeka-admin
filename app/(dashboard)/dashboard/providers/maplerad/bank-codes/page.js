'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const defaultFilters = { country: 'KE', type: 'MOMO', context: 'PAYOUT' };

const RawJson = ({ title, data }) => (
  <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
    <div style={{ fontWeight: 800 }}>{title}</div>
    <pre
      style={{
        margin: 0,
        padding: '0.85rem',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'auto',
        maxHeight: '420px',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontSize: '12px',
        lineHeight: 1.45
      }}
    >
      {data === null || data === undefined ? 'No response yet.' : JSON.stringify(data, null, 2)}
    </pre>
  </div>
);

const extractBankCodes = (response) => {
  const data = response?.providerResponse?.data || response?.data || [];
  return Array.isArray(data) ? data : [];
};

const extractProviderResponse = (response) => response?.providerResponse || response || {};
const extractUpdatedRoutes = (response) => {
  const providerResponse = extractProviderResponse(response);
  return Array.isArray(providerResponse?.updatedRoutes) ? providerResponse.updatedRoutes : [];
};
const extractUnmatchedRoutes = (response) => {
  const providerResponse = extractProviderResponse(response);
  return Array.isArray(providerResponse?.unmatchedRoutes) ? providerResponse.unmatchedRoutes : [];
};

export default function MapleradBankCodesPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [response, setResponse] = useState(null);
  const [syncResponse, setSyncResponse] = useState(null);
  const [syncPreview, setSyncPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const bankCodes = useMemo(() => extractBankCodes(response), [response]);
  const updatedRoutes = useMemo(() => extractUpdatedRoutes(syncResponse || syncPreview), [syncResponse, syncPreview]);
  const unmatchedRoutes = useMemo(() => extractUnmatchedRoutes(syncResponse || syncPreview), [syncResponse, syncPreview]);

  const buildSyncParams = (dryRun) => {
    const country = String(filters.country || '').trim().toUpperCase();
    const type = String(filters.type || '').trim().toUpperCase();
    const context = String(filters.context || '').trim().toUpperCase();
    return {
      country,
      type,
      context,
      dryRun: String(Boolean(dryRun))
    };
  };

  const validateSyncFilters = () => {
    const country = String(filters.country || '').trim().toUpperCase();
    const type = String(filters.type || '').trim().toUpperCase();
    const context = String(filters.context || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) return 'Country must be a 2-letter uppercase ISO country code.';
    if (!type) return 'Type is required.';
    if (!context) return 'Context is required.';
    return null;
  };

  const refreshBankCodes = async () => {
    const country = String(filters.country || '').trim().toUpperCase();
    if (country && !/^[A-Z]{2}$/.test(country)) {
      setError('Country must be a 2-letter uppercase ISO country code.');
      setInfo(null);
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const type = String(filters.type || '').trim().toUpperCase();
      const params = country || type ? new URLSearchParams({ ...(country ? { country } : {}), ...(type ? { type } : {}) }) : undefined;
      const res = await api.maplerad.bankCodes(params);
      setResponse(res);
      setFilters((prev) => ({ ...prev, country, type }));
      setInfo(`Loaded Maplerad bank codes preview${country ? ` for ${country}` : ''}${type ? ` / ${type}` : ''}.`);
    } catch (err) {
      setResponse(err?.data || null);
      setError(err?.message || 'Failed to load Maplerad bank codes.');
    } finally {
      setLoading(false);
    }
  };

  const previewSync = async () => {
    const validationError = validateSyncFilters();
    if (validationError) {
      setError(validationError);
      setInfo(null);
      return;
    }
    setSyncLoading(true);
    setError(null);
    setInfo(null);
    setSyncResponse(null);
    try {
      const res = await api.maplerad.syncBankCodes(new URLSearchParams(buildSyncParams(true)));
      setSyncPreview(res);
      const changedCount = extractUpdatedRoutes(res).filter((route) => route.changed).length;
      const unmatchedCount = extractUnmatchedRoutes(res).length;
      setInfo(`Dry-run complete. ${changedCount} route changes previewed. ${unmatchedCount} unmatched route warning${unmatchedCount === 1 ? '' : 's'}.`);
    } catch (err) {
      setSyncPreview(err?.data || null);
      setError(err?.message || 'Failed to preview Maplerad bank-code sync.');
    } finally {
      setSyncLoading(false);
    }
  };

  const confirmSync = async () => {
    const validationError = validateSyncFilters();
    if (validationError) {
      setError(validationError);
      setInfo(null);
      return;
    }
    if (!syncPreview) {
      setError('Run dry-run preview before syncing provider codes.');
      setInfo(null);
      return;
    }
    setSyncLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.maplerad.syncBankCodes(new URLSearchParams(buildSyncParams(false)));
      setSyncResponse(res);
      const updatedCount = extractUpdatedRoutes(res).filter((route) => route.changed).length;
      const unmatchedCount = extractUnmatchedRoutes(res).length;
      setInfo(`Maplerad bank-code sync complete. ${updatedCount} route${updatedCount === 1 ? '' : 's'} changed. ${unmatchedCount} unmatched warning${unmatchedCount === 1 ? '' : 's'}.`);
    } catch (err) {
      setSyncResponse(err?.data || null);
      setError(err?.message || 'Failed to sync Maplerad bank codes.');
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Providers &gt; Maplerad &gt; Bank codes</div>
          <div style={{ color: 'var(--muted)' }}>Fetch Maplerad institution codes for configuring method/provider relations.</div>
        </div>
        <Link href="/dashboard" className="btn-neutral">
          {'<- Dashboard'}
        </Link>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Bank codes / institutions</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>GET preview only. Use the sync panel below to persist provider codes to local payment routes.</div>
          </div>
          <button type="button" onClick={refreshBankCodes} disabled={loading} className="btn-primary">
            {loading ? 'Refreshing...' : 'Preview bank codes'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="country">Country</label>
            <input
              id="country"
              value={filters.country}
              onChange={(e) => {
                setSyncPreview(null);
                setSyncResponse(null);
                setFilters((prev) => ({ ...prev, country: e.target.value.toUpperCase() }));
              }}
              placeholder="KE"
              maxLength={2}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="type">Type</label>
            <select
              id="type"
              value={filters.type}
              onChange={(e) => {
                setSyncPreview(null);
                setSyncResponse(null);
                setFilters((prev) => ({ ...prev, type: e.target.value }));
              }}
            >
              <option value="MOMO">MOMO</option>
              <option value="BANK">BANK</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="context">Sync context</label>
            <select
              id="context"
              value={filters.context}
              onChange={(e) => {
                setSyncPreview(null);
                setSyncResponse(null);
                setFilters((prev) => ({ ...prev, context: e.target.value }));
              }}
            >
              <option value="PAYOUT">PAYOUT</option>
              <option value="COLLECTION">COLLECTION</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Sync Maplerad bank codes</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Persists Maplerad codes into payment method/provider route provider codes. For Kenya mobile money use KE / MOMO / PAYOUT.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={previewSync} disabled={syncLoading} className="btn-neutral">
              {syncLoading ? 'Working...' : 'Dry-run sync preview'}
            </button>
            <button type="button" onClick={confirmSync} disabled={syncLoading || !syncPreview} className="btn-danger">
              {syncLoading ? 'Syncing...' : 'Confirm sync codes'}
            </button>
          </div>
        </div>
        <div style={{ color: '#92400e', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '10px', padding: '0.75rem', fontSize: '13px', fontWeight: 700 }}>
          Run dry-run first. Confirm sync uses dryRun=false and writes matching codes to local Maplerad payout routes.
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Expected Kenya MOMO payout codes: MPESA_KENYA {'->'} 1271, AIRTEL_MONEY_KENYA {'->'} 664.
        </div>
      </div>

      <div className="card table-scroll" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Code</th>
              <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Country</th>
            </tr>
          </thead>
          <tbody>
            {bankCodes.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '1rem', color: 'var(--muted)', textAlign: 'center' }}>
                  No bank codes loaded.
                </td>
              </tr>
            )}
            {bankCodes.map((bankCode, index) => (
              <tr key={`${bankCode.code || index}-${bankCode.country || ''}`} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.75rem', fontWeight: 700 }}>{bankCode.code || '-'}</td>
                <td style={{ padding: '0.75rem' }}>{bankCode.name || '-'}</td>
                <td style={{ padding: '0.75rem' }}>{bankCode.country || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(syncPreview || syncResponse) && (
        <>
          <div className="card table-scroll" style={{ overflowX: 'auto' }}>
            <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Updated routes {syncResponse ? '(synced)' : '(dry-run)'}</div>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Payment method</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Route ID</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Previous code</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Provider code</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Changed</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Dry run</th>
                </tr>
              </thead>
              <tbody>
                {updatedRoutes.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '1rem', color: 'var(--muted)', textAlign: 'center' }}>
                      No route changes returned.
                    </td>
                  </tr>
                )}
                {updatedRoutes.map((route, index) => (
                  <tr key={`${route.routeId || index}-${route.paymentMethod || ''}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>{route.paymentMethod || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{route.routeId || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{route.previousProviderCode || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>{route.providerCode || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>{route.changed ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '0.75rem' }}>{route.dryRun ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card table-scroll" style={{ overflowX: 'auto' }}>
            <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Unmatched routes / warnings</div>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Payment method</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Provider code</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {unmatchedRoutes.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: '1rem', color: 'var(--muted)', textAlign: 'center' }}>
                      No unmatched routes.
                    </td>
                  </tr>
                )}
                {unmatchedRoutes.map((route, index) => (
                  <tr key={`${route.providerCode || index}-${route.paymentMethod || ''}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>{route.paymentMethod || route.name || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{route.providerCode || route.code || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>{route.reason || route.message || 'No matching local MAPLERAD route'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <RawJson title="Bank codes provider response" data={response} />
      <RawJson title="Bank code sync response" data={syncResponse || syncPreview} />
    </div>
  );
}
