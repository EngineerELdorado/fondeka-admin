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
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          {url ? 'Image failed to load.' : 'No image.'}
          {url ? <div style={{ fontSize: '11px', wordBreak: 'break-all', marginTop: '0.35rem' }}>{url}</div> : null}
        </div>
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

  const payload = useMemo(() => result?.KycResult || result?.kycResult || result?.data || result, [result]);

  const summaryRows = useMemo(() => {
    if (!payload) return [];
    return [
      { label: 'Result', value: pickSmileValue(payload.ResultText, payload.ResultCode) },
      {
        label: 'Full name',
        value: pickSmileValue(
          payload.FullName,
          [payload.FirstName, payload.OtherName || payload.OtherNames, payload.LastName].filter(Boolean).join(' ').trim()
        )
      },
      { label: 'Document type', value: pickSmileValue(payload.IDType, payload.IdType, payload.DocumentType) },
      { label: 'Document number', value: pickSmileValue(payload.IDNumber, payload.IdNumber, payload.DocumentNumber) },
      { label: 'DOB', value: pickSmileValue(formatDate(payload.DOB), formatDate(payload.DateOfBirth)) },
      { label: 'Gender', value: pickSmileValue(payload.Gender) },
      { label: 'Issuance date', value: pickSmileValue(formatDate(payload.IssuanceDate)) },
      { label: 'Expiration date', value: pickSmileValue(formatDate(payload.ExpirationDate), formatDate(payload.ExpiryDate)) },
      { label: 'Country', value: pickSmileValue(payload.Country) },
      { label: 'Address', value: pickSmileValue(payload.Address) },
      { label: 'Phone', value: pickSmileValue(payload.PhoneNumber, payload.PhoneNumber2) },
      { label: 'Smile Job ID', value: pickSmileValue(payload.SmileJobID) },
      { label: 'Job reference', value: pickSmileValue(payload.PartnerParams?.job_id) },
      { label: 'User reference', value: pickSmileValue(payload.PartnerParams?.user_id) },
      { label: 'Timestamp', value: pickSmileValue(payload.timestamp) }
    ];
  }, [payload]);

  const actionRows = useMemo(() => {
    const entries = Object.entries(payload?.Actions || {});
    return entries.slice(0, 8).map(([label, value]) => ({
      label: label.replace(/_/g, ' '),
      value
    }));
  }, [payload]);

  const imageLinks = payload?.ImageLinks || payload?.imageLinks || payload?.image_links || payload?.Image_Links || {};

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

      {payload && (
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
              <ImageTile
                label="Selfie"
                url={pickSmileValue(
                  imageLinks.selfie_image,
                  imageLinks.selfieImage,
                  imageLinks.selfie,
                  payload.SelfieImageLink,
                  payload.SelfieImage
                )}
              />
              <ImageTile
                label="Document front"
                url={pickSmileValue(
                  imageLinks.id_card_image,
                  imageLinks.idCardImage,
                  imageLinks.id_front,
                  imageLinks.document_front,
                  payload.IdCardImage,
                  payload.DocumentFrontImage
                )}
              />
              <ImageTile
                label="Document back"
                url={pickSmileValue(
                  imageLinks.id_card_back,
                  imageLinks.idCardBack,
                  imageLinks.id_back,
                  imageLinks.document_back,
                  payload.IdCardBack,
                  payload.DocumentBackImage
                )}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
