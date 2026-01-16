'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AppVersionPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('');
  const [draftVersion, setDraftVersion] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const loadVersion = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.appVersion.get();
      const value = res?.appVersion ?? '';
      setCurrentVersion(value);
      setDraftVersion(value);
    } catch (err) {
      setError(err.message || 'Failed to load global app version');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersion();
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
    const nextVersion = draftVersion.trim();
    if (!nextVersion) {
      setError('Enter an app version.');
      return;
    }
    if (saving) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.appVersion.update({ appVersion: nextVersion });
      const value = res?.appVersion ?? nextVersion;
      setCurrentVersion(value);
      setDraftVersion(value);
      setInfo(`Global app version updated to ${value}.`);
    } catch (err) {
      setError(err.message || 'Failed to update app version');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 800 }}>App Version</div>
        <div style={{ color: 'var(--muted)' }}>Update the default app version for all accounts.</div>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}
      {info && (
        <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>
          {info}
        </div>
      )}

      <div className="card" style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Global version</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          {loading ? 'Loading global version...' : currentVersion ? `Current: ${currentVersion}` : 'No global version set.'}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: '200px' }}>
            <span>Version</span>
            <input value={draftVersion} onChange={(e) => setDraftVersion(e.target.value)} placeholder="1.2" />
          </label>
          <button type="button" className="btn-primary" onClick={handleUpdate} disabled={loading || saving}>
            {saving ? 'Saving...' : 'Update version'}
          </button>
        </div>
      </div>
    </div>
  );
}
