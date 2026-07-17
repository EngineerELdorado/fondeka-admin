'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const defaultFilters = { country: '' };

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

export default function MapleradBankCodesPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const bankCodes = useMemo(() => extractBankCodes(response), [response]);

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
      const params = country ? new URLSearchParams({ country }) : undefined;
      const res = await api.maplerad.bankCodes(params);
      setResponse(res);
      setFilters((prev) => ({ ...prev, country }));
      setInfo(`Loaded Maplerad bank codes${country ? ` for ${country}` : ''}.`);
    } catch (err) {
      setResponse(err?.data || null);
      setError(err?.message || 'Failed to load Maplerad bank codes.');
    } finally {
      setLoading(false);
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
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Country is optional. Leave it empty to fetch all provider-supported institutions.</div>
          </div>
          <button type="button" onClick={refreshBankCodes} disabled={loading} className="btn-primary">
            {loading ? 'Refreshing...' : 'Refresh bank codes'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="country">Country</label>
            <input
              id="country"
              value={filters.country}
              onChange={(e) => setFilters((prev) => ({ ...prev, country: e.target.value.toUpperCase() }))}
              placeholder="KE"
              maxLength={2}
            />
          </div>
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

      <RawJson title="Bank codes provider response" data={response} />
    </div>
  );
}
