'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

const normalizeSmileValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && (value.trim() === '' || value.trim().toLowerCase() === 'not available')) return null;
  return value;
};

const pickSmileValue = (...values) => {
  for (const value of values) {
    const normalized = normalizeSmileValue(value);
    if (normalized !== null) return normalized;
  }
  return null;
};

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

const ImageTile = ({ label, url }) => {
  const [failed, setFailed] = useState(false);
  const hasImage = Boolean(url) && !failed;

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '0.6rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        minHeight: '220px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--text)' }}>
            Open
          </a>
        ) : null}
      </div>
      {hasImage ? (
        <img
          src={url}
          alt={`${label} image`}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '10px' }}
        />
      ) : (
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{url ? 'Image failed to load.' : 'No image.'}</div>
      )}
    </div>
  );
};

export default function SmileIdResultPage() {
  const params = useParams();
  const kycId = params?.id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const formatDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fetchResult = async () => {
    if (!kycId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.kycs.refreshSmileIdResult(kycId);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Failed to load SmileID result.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResult();
  }, [kycId]); // eslint-disable-line react-hooks/exhaustive-deps

  const summaryRows = useMemo(() => {
    if (!result) return [];
    return [
      { label: 'Result', value: pickSmileValue(result.ResultText, result.ResultCode) },
      {
        label: 'Full name',
        value: pickSmileValue(
          result.FullName,
          [result.FirstName, result.OtherName || result.OtherNames, result.LastName].filter(Boolean).join(' ').trim()
        )
      },
      { label: 'Document type', value: pickSmileValue(result.IDType, result.IdType, result.DocumentType) },
      { label: 'Document number', value: pickSmileValue(result.IDNumber, result.IdNumber, result.DocumentNumber) },
      { label: 'DOB', value: pickSmileValue(formatDate(result.DOB), formatDate(result.DateOfBirth)) },
      { label: 'Gender', value: pickSmileValue(result.Gender) },
      { label: 'Issuance date', value: pickSmileValue(formatDate(result.IssuanceDate)) },
      { label: 'Expiration date', value: pickSmileValue(formatDate(result.ExpirationDate), formatDate(result.ExpiryDate)) },
      { label: 'Country', value: pickSmileValue(result.Country) },
      { label: 'Address', value: pickSmileValue(result.Address) },
      { label: 'Phone', value: pickSmileValue(result.PhoneNumber, result.PhoneNumber2) },
      { label: 'Smile Job ID', value: pickSmileValue(result.SmileJobID) },
      { label: 'Job reference', value: pickSmileValue(result.PartnerParams?.job_id) },
      { label: 'User reference', value: pickSmileValue(result.PartnerParams?.user_id) },
      { label: 'Timestamp', value: pickSmileValue(result.timestamp) }
    ];
  }, [result]);

  const actionRows = useMemo(() => {
    const entries = Object.entries(result?.Actions || {});
    return entries.slice(0, 8).map(([label, value]) => ({
      label: label.replace(/_/g, ' '),
      value
    }));
  }, [result]);

  const imageLinks = result?.ImageLinks || result?.imageLinks || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>SmileID Result</div>
          <div style={{ color: 'var(--muted)' }}>KYC {kycId}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/kycs" className="btn-neutral">
            ← Back to KYCs
          </Link>
          <button type="button" onClick={fetchResult} className="btn-primary" disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh result'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}

      {loading && !result && (
        <div className="card" style={{ color: 'var(--muted)' }}>
          Loading SmileID result…
        </div>
      )}

      {result && (
        <>
          <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ fontWeight: 700 }}>Key details</div>
            <DetailGrid rows={summaryRows} />
          </div>

          {actionRows.length > 0 && (
            <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ fontWeight: 700 }}>Checks (top {Math.min(actionRows.length, 8)})</div>
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Showing a focused subset of SmileID checks.</div>
              </div>
              <DetailGrid rows={actionRows} />
            </div>
          )}

          <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ fontWeight: 700 }}>Images</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.8rem' }}>
              <ImageTile label="Selfie" url={pickSmileValue(imageLinks.selfie_image)} />
              <ImageTile label="Document front" url={pickSmileValue(imageLinks.id_card_image)} />
              <ImageTile label="Document back" url={pickSmileValue(imageLinks.id_card_back)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
