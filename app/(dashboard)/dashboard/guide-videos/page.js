'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

const emptyRow = { key: '', url: '' };
const suggestedKeys = ['PERSONAL', 'LIKELEMBA', 'AVEC', 'CARDS', 'LOANS', 'CRYPTO'];

const normalizeRows = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value)
    .map(([key, url]) => ({ key: String(key || '').trim(), url: String(url || '').trim() }))
    .filter((row) => row.key || row.url)
    .sort((a, b) => a.key.localeCompare(b.key));
};

const isValidHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export default function GuideVideosPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const loadRegistry = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.guideVideos.get();
      setRows(normalizeRows(res));
    } catch (err) {
      setError(err?.message || 'Failed to load guide videos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegistry();
  }, []);

  const duplicateKeys = useMemo(() => {
    const counts = new Map();
    rows.forEach((row) => {
      const normalizedKey = String(row.key || '').trim().toUpperCase();
      if (!normalizedKey) return;
      counts.set(normalizedKey, (counts.get(normalizedKey) || 0) + 1);
    });
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [rows]);

  const handleSave = async () => {
    const payload = {};
    for (const row of rows) {
      const key = String(row.key || '').trim().toUpperCase();
      const url = String(row.url || '').trim();
      if (!key) {
        setError('Key must not be blank.');
        return;
      }
      if (!url) {
        setError(`Video URL must not be blank for ${key}.`);
        return;
      }
      if (!isValidHttpUrl(url)) {
        setError(`Video URL must be a valid http or https link for ${key}.`);
        return;
      }
      if (payload[key]) {
        setError(`Duplicate key detected: ${key}.`);
        return;
      }
      payload[key] = url;
    }

    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.guideVideos.update(payload);
      setInfo('Guide video registry saved.');
      await loadRegistry();
    } catch (err) {
      setError(err?.message || 'Failed to save guide videos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Guide Videos</div>
        <div style={{ color: 'var(--muted)' }}>
          Manage the key-to-video-URL registry used by the mobile app. Saving replaces the full registry, so this screen always sends the complete map.
        </div>
      </div>

      {error ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div> : null}
      {info ? <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div> : null}

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Registry</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Keys are free-form, but URLs must be valid `http` or `https` links.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral" onClick={loadRegistry} disabled={loading || saving}>
              {loading ? 'Refreshing…' : 'Reload'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setRows((prev) => [...prev, emptyRow]);
                setError(null);
                setInfo(null);
              }}
              disabled={loading || saving}
            >
              Add row
            </button>
            <button type="button" className="btn-success" onClick={handleSave} disabled={loading || saving}>
              {saving ? 'Saving…' : 'Save all'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {suggestedKeys.map((key) => (
            <button
              key={key}
              type="button"
              className="btn-neutral btn-sm"
              onClick={() => {
                setRows((prev) => [...prev, { key, url: '' }]);
                setError(null);
                setInfo(null);
              }}
              disabled={loading || saving}
            >
              Add {key}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: 'var(--muted)' }}>Loading guide videos…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.6rem' }}>Key</th>
                  <th style={{ padding: '0.6rem' }}>Video URL</th>
                  <th style={{ padding: '0.6rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '0.9rem', color: 'var(--muted)' }}>
                      No guide videos configured yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const normalizedKey = String(row.key || '').trim().toUpperCase();
                    const hasDuplicate = normalizedKey && duplicateKeys.has(normalizedKey);
                    return (
                      <tr key={`${normalizedKey || 'row'}-${index}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.6rem', verticalAlign: 'top' }}>
                          <div style={{ display: 'grid', gap: '0.25rem' }}>
                            <input
                              value={row.key}
                              placeholder="PERSONAL"
                              onChange={(e) =>
                                setRows((prev) => prev.map((item, rowIndex) => (rowIndex === index ? { ...item, key: e.target.value.toUpperCase() } : item)))
                              }
                            />
                            {hasDuplicate ? <div style={{ color: '#b91c1c', fontSize: '12px' }}>Duplicate key</div> : null}
                          </div>
                        </td>
                        <td style={{ padding: '0.6rem', verticalAlign: 'top' }}>
                          <div style={{ display: 'grid', gap: '0.25rem' }}>
                            <input
                              value={row.url}
                              placeholder="https://www.youtube.com/watch?v=..."
                              onChange={(e) =>
                                setRows((prev) => prev.map((item, rowIndex) => (rowIndex === index ? { ...item, url: e.target.value } : item)))
                              }
                            />
                            {row.url && !isValidHttpUrl(row.url) ? (
                              <div style={{ color: '#b91c1c', fontSize: '12px' }}>Use a valid http or https URL</div>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ padding: '0.6rem', verticalAlign: 'top' }}>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => {
                              setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
                              setError(null);
                              setInfo(null);
                            }}
                            disabled={saving}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
