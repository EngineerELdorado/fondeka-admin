'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function KycDefaultLevelsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [draftLevel, setDraftLevel] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const loadGlobalLevel = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.kycDefaultLevels.getGlobal();
      const level = res?.level ?? null;
      setCurrentLevel(level);
      setDraftLevel(level === null ? '' : String(level));
    } catch (err) {
      setError(err.message || 'Failed to load global default KYC level');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGlobalLevel();
  }, []);

  useEffect(() => {
    if (!info && !error) return;
    const timer = setTimeout(() => {
      setInfo(null);
      setError(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [info, error]);

  const handleUpdate = async () => {
    const trimmed = String(draftLevel).trim();
    if (!trimmed) {
      setError('Enter a default KYC level.');
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('Default KYC level must be an integer >= 0.');
      return;
    }
    if (saving) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.kycDefaultLevels.setGlobal({ level: parsed });
      const nextLevel = res?.level ?? parsed;
      setCurrentLevel(nextLevel);
      setDraftLevel(String(nextLevel));
      setInfo(`Global default KYC level set to ${nextLevel}.`);
    } catch (err) {
      setError(err.message || 'Failed to update global default KYC level');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>KYC Defaults</div>
          <div style={{ color: 'var(--muted)' }}>
            Sets the fallback KYC level when a country has no default override.
          </div>
        </div>
        <Link href="/dashboard/kycs" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          &larr; KYCs
        </Link>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div className="card" style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Global default</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          {loading ? 'Loading global default...' : currentLevel === null ? 'No global default set.' : `Current: ${currentLevel}`}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: '200px' }}>
            <span>Default level</span>
            <input
              type="number"
              min={0}
              step={1}
              value={draftLevel}
              onChange={(e) => setDraftLevel(e.target.value)}
              placeholder="0"
            />
          </label>
          <button type="button" className="btn-primary" onClick={handleUpdate} disabled={loading || saving}>
            {saving ? 'Saving...' : 'Update default'}
          </button>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          If no global default is set, the system falls back to app.kyc.default-level.
        </div>
      </div>
    </div>
  );
}
