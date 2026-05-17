'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

let nextRegistryRowId = 1;
let nextLocaleRowId = 1;

const createLocaleRow = (locale = 'en', url = '') => ({
  id: `locale-${nextLocaleRowId++}`,
  locale,
  url
});

const createRegistryRow = (key = '', locales = [createLocaleRow()]) => ({
  id: `registry-${nextRegistryRowId++}`,
  key,
  locales
});

const suggestedKeys = ['PERSONAL', 'LIKELEMBA', 'AVEC', 'CARDS', 'LOANS', 'CRYPTO'];
const suggestedLocales = ['en', 'fr', 'default'];

const updateRowLocaleValue = (rows, rowIndex, localeIndex, locale) =>
  rows.map((item, index) =>
    index === rowIndex
      ? {
          ...item,
          locales: item.locales.map((localeItem, currentLocaleIndex) =>
            currentLocaleIndex === localeIndex ? { ...localeItem, locale } : localeItem
          )
        }
      : item
  );

const normalizeRegistry = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value)
    .map(([key, locales]) => {
      const localeRows =
        locales && typeof locales === 'object' && !Array.isArray(locales)
          ? Object.entries(locales)
              .map(([locale, url]) => createLocaleRow(String(locale || '').trim().toLowerCase(), String(url || '').trim()))
              .filter((row) => row.locale || row.url)
          : [];
      return createRegistryRow(String(key || '').trim().toUpperCase(), localeRows.length ? localeRows : [createLocaleRow()]);
    })
    .filter((row) => row.key || row.locales.some((entry) => entry.locale || entry.url))
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
      setRows(normalizeRegistry(res));
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

  const duplicateLocalesByRow = useMemo(
    () =>
      rows.map((row) => {
        const counts = new Map();
        row.locales.forEach((entry) => {
          const normalizedLocale = String(entry.locale || '').trim().toLowerCase();
          if (!normalizedLocale) return;
          counts.set(normalizedLocale, (counts.get(normalizedLocale) || 0) + 1);
        });
        return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([locale]) => locale));
      }),
    [rows]
  );

  const handleSave = async () => {
    const payload = {};

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const key = String(row.key || '').trim().toUpperCase();
      if (!key) {
        setError('Key must not be blank.');
        return;
      }
      if (payload[key]) {
        setError(`Duplicate key detected: ${key}.`);
        return;
      }

      const localeMap = {};
      for (let localeIndex = 0; localeIndex < row.locales.length; localeIndex += 1) {
        const entry = row.locales[localeIndex];
        const locale = String(entry.locale || '').trim().toLowerCase();
        const url = String(entry.url || '').trim();

        if (!locale) {
          setError(`Locale must not be blank for ${key}.`);
          return;
        }
        if (!url) {
          setError(`Video URL must not be blank for ${key} (${locale}).`);
          return;
        }
        if (!isValidHttpUrl(url)) {
          setError(`Video URL must be a valid http or https link for ${key} (${locale}).`);
          return;
        }
        if (localeMap[locale]) {
          setError(`Duplicate locale detected for ${key}: ${locale}.`);
          return;
        }
        localeMap[locale] = url;
      }

      payload[key] = localeMap;
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
          Manage the locale-specific key-to-video registry used by the mobile app. Saving replaces the full registry, so this screen always sends the complete nested map.
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Customer fallback order is `exact locale` → `default` → `en` → `first available URL`.
        </div>
      </div>

      {error ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div> : null}
      {info ? <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div> : null}

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Registry</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Keys are free-form. Each key can define multiple locale URLs like `en`, `fr`, or `default`.
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
                setRows((prev) => [...prev, createRegistryRow()]);
                setError(null);
                setInfo(null);
              }}
              disabled={loading || saving}
            >
              Add key
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
                setRows((prev) => [...prev, createRegistryRow(key)]);
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
        ) : rows.length === 0 ? (
          <div style={{ color: 'var(--muted)' }}>No guide videos configured yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {rows.map((row, rowIndex) => {
              const normalizedKey = String(row.key || '').trim().toUpperCase();
              const hasDuplicateKey = normalizedKey && duplicateKeys.has(normalizedKey);
              const duplicateLocales = duplicateLocalesByRow[rowIndex] || new Set();

              return (
                <div key={row.id} className="card" style={{ padding: '0.9rem', display: 'grid', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ display: 'grid', gap: '0.25rem', minWidth: '240px', flex: '1 1 260px' }}>
                      <label>Key</label>
                      <input
                        value={row.key}
                        placeholder="PERSONAL"
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((item, index) => (index === rowIndex ? { ...item, key: e.target.value.toUpperCase() } : item))
                          )
                        }
                      />
                      {hasDuplicateKey ? <div style={{ color: '#b91c1c', fontSize: '12px' }}>Duplicate key</div> : null}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-neutral btn-sm"
                        onClick={() =>
                          setRows((prev) =>
                            prev.map((item, index) =>
                              index === rowIndex ? { ...item, locales: [...item.locales, createLocaleRow()] } : item
                            )
                          )
                        }
                        disabled={saving}
                      >
                        Add locale
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        onClick={() => {
                          setRows((prev) => prev.filter((_, index) => index !== rowIndex));
                          setError(null);
                          setInfo(null);
                        }}
                        disabled={saving}
                      >
                        Delete key
                      </button>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '0.6rem' }}>Locale</th>
                          <th style={{ padding: '0.6rem' }}>Video URL</th>
                          <th style={{ padding: '0.6rem' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.locales.map((entry, localeIndex) => {
                          const normalizedLocale = String(entry.locale || '').trim().toLowerCase();
                          const hasDuplicateLocale = normalizedLocale && duplicateLocales.has(normalizedLocale);
                          return (
                            <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '0.6rem', verticalAlign: 'top' }}>
                                <div style={{ display: 'grid', gap: '0.25rem' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 132px', gap: '0.35rem' }}>
                                    <input
                                      value={entry.locale}
                                      placeholder="Type locale, e.g. en"
                                      onChange={(e) => setRows((prev) => updateRowLocaleValue(prev, rowIndex, localeIndex, e.target.value.toLowerCase()))}
                                    />
                                    <select
                                      value={suggestedLocales.includes(normalizedLocale) ? normalizedLocale : ''}
                                      onChange={(e) => {
                                        if (!e.target.value) return;
                                        setRows((prev) => updateRowLocaleValue(prev, rowIndex, localeIndex, e.target.value));
                                      }}
                                    >
                                      <option value="">Quick pick…</option>
                                      {suggestedLocales.map((locale) => (
                                        <option key={locale} value={locale}>
                                          {locale}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  {hasDuplicateLocale ? <div style={{ color: '#b91c1c', fontSize: '12px' }}>Duplicate locale</div> : null}
                                </div>
                              </td>
                              <td style={{ padding: '0.6rem', verticalAlign: 'top' }}>
                                <div style={{ display: 'grid', gap: '0.25rem' }}>
                                  <input
                                    value={entry.url}
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    onChange={(e) =>
                                      setRows((prev) =>
                                        prev.map((item, index) =>
                                          index === rowIndex
                                            ? {
                                                ...item,
                                                locales: item.locales.map((localeItem, currentLocaleIndex) =>
                                                  currentLocaleIndex === localeIndex ? { ...localeItem, url: e.target.value } : localeItem
                                                )
                                              }
                                            : item
                                        )
                                      )
                                    }
                                  />
                                  {entry.url && !isValidHttpUrl(entry.url) ? (
                                    <div style={{ color: '#b91c1c', fontSize: '12px' }}>Use a valid http or https URL</div>
                                  ) : null}
                                </div>
                              </td>
                              <td style={{ padding: '0.6rem', verticalAlign: 'top' }}>
                                <button
                                  type="button"
                                  className="btn-danger"
                                  onClick={() =>
                                    setRows((prev) =>
                                      prev.map((item, index) =>
                                        index === rowIndex
                                          ? {
                                              ...item,
                                              locales:
                                                item.locales.length === 1
                                                  ? [createLocaleRow()]
                                                  : item.locales.filter((_, currentLocaleIndex) => currentLocaleIndex !== localeIndex)
                                            }
                                          : item
                                      )
                                    )
                                  }
                                  disabled={saving}
                                >
                                  Delete locale
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
