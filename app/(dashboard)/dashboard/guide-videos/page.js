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
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsEnabled, setSettingsEnabled] = useState(true);
  const [excludedKeys, setExcludedKeys] = useState([]);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideAccountId, setOverrideAccountId] = useState('');
  const [overrideEmail, setOverrideEmail] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideLoaded, setOverrideLoaded] = useState(false);
  const [overrideCustomized, setOverrideCustomized] = useState(false);
  const [overrideEnabled, setOverrideEnabled] = useState(true);
  const [overrideExcludedKeys, setOverrideExcludedKeys] = useState([]);
  const [overrideError, setOverrideError] = useState(null);
  const [overrideInfo, setOverrideInfo] = useState(null);
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

  const loadSettings = async () => {
    setSettingsLoading(true);
    setError(null);
    try {
      const res = await api.guideVideos.getSettings();
      setSettingsEnabled(res?.enabled !== false);
      setExcludedKeys(Array.isArray(res?.excludedKeys) ? res.excludedKeys.map((key) => String(key || '').trim().toUpperCase()).filter(Boolean) : []);
    } catch (err) {
      setError(err?.message || 'Failed to load guide video settings.');
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    loadRegistry();
    loadSettings();
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

  const availableKeys = useMemo(() => {
    const normalized = rows.map((row) => String(row.key || '').trim().toUpperCase()).filter(Boolean);
    return [...new Set(normalized)].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.guideVideos.updateSettings({
        enabled: settingsEnabled,
        excludedKeys: [...new Set(excludedKeys.map((key) => String(key || '').trim().toUpperCase()).filter(Boolean))]
      });
      setInfo('Guide video settings saved.');
      await loadSettings();
    } catch (err) {
      setError(err?.message || 'Failed to save guide video settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const resetOverrideDialog = () => {
    setOverrideAccountId('');
    setOverrideEmail('');
    setOverrideLoaded(false);
    setOverrideCustomized(false);
    setOverrideEnabled(true);
    setOverrideExcludedKeys([]);
    setOverrideError(null);
    setOverrideInfo(null);
  };

  const loadOverride = async () => {
    const accountId = String(overrideAccountId || '').trim();
    const email = String(overrideEmail || '').trim();
    if (!accountId) {
      setOverrideError('Account ID is required.');
      return;
    }
    setOverrideLoading(true);
    setOverrideError(null);
    setOverrideInfo(null);
    try {
      const res = email
        ? await api.accounts.guideVideoSettings.getByEmail(accountId, email)
        : await api.accounts.guideVideoSettings.get(accountId);
      setOverrideLoaded(true);
      setOverrideCustomized(Boolean(res?.customized));
      setOverrideEnabled(res?.enabled !== false);
      setOverrideExcludedKeys(Array.isArray(res?.excludedKeys) ? res.excludedKeys.map((key) => String(key || '').trim().toUpperCase()).filter(Boolean) : []);
      setOverrideInfo(Boolean(res?.customized) ? 'Loaded account-specific override.' : 'This account is currently using global settings.');
    } catch (err) {
      setOverrideLoaded(false);
      setOverrideCustomized(false);
      setOverrideEnabled(true);
      setOverrideExcludedKeys([]);
      setOverrideError(err?.message || 'Failed to load guide video override.');
    } finally {
      setOverrideLoading(false);
    }
  };

  const saveOverride = async () => {
    const accountId = String(overrideAccountId || '').trim();
    const email = String(overrideEmail || '').trim();
    if (!accountId) {
      setOverrideError('Account ID is required.');
      return;
    }
    setOverrideSaving(true);
    setOverrideError(null);
    setOverrideInfo(null);
    try {
      const payload = {
        enabled: overrideEnabled,
        excludedKeys: [...new Set(overrideExcludedKeys.map((key) => String(key || '').trim().toUpperCase()).filter(Boolean))]
      };
      const res = email
        ? await api.accounts.guideVideoSettings.updateByEmail(accountId, email, payload)
        : await api.accounts.guideVideoSettings.update(accountId, payload);
      setOverrideLoaded(true);
      setOverrideCustomized(Boolean(res?.customized ?? true));
      setOverrideEnabled(res?.enabled !== false);
      setOverrideExcludedKeys(Array.isArray(res?.excludedKeys) ? res.excludedKeys.map((key) => String(key || '').trim().toUpperCase()).filter(Boolean) : payload.excludedKeys);
      setOverrideInfo('Guide video override saved.');
    } catch (err) {
      setOverrideError(err?.message || 'Failed to save guide video override.');
    } finally {
      setOverrideSaving(false);
    }
  };

  const deleteOverride = async () => {
    const accountId = String(overrideAccountId || '').trim();
    const email = String(overrideEmail || '').trim();
    if (!accountId) {
      setOverrideError('Account ID is required.');
      return;
    }
    setOverrideSaving(true);
    setOverrideError(null);
    setOverrideInfo(null);
    try {
      if (email) {
        await api.accounts.guideVideoSettings.removeByEmail(accountId, email);
      } else {
        await api.accounts.guideVideoSettings.remove(accountId);
      }
      setOverrideLoaded(true);
      setOverrideCustomized(false);
      setOverrideEnabled(true);
      setOverrideExcludedKeys([]);
      setOverrideInfo('Override cleared. Global settings now apply.');
    } catch (err) {
      setOverrideError(err?.message || 'Failed to clear guide video override.');
    } finally {
      setOverrideSaving(false);
    }
  };

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
            <div style={{ fontWeight: 800 }}>Guide Video Settings</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              When disabled, no guide videos are returned to the client app. Excluded keys stay configured in the registry but are hidden from users.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral" onClick={loadSettings} disabled={settingsLoading || settingsSaving}>
              {settingsLoading ? 'Refreshing…' : 'Reload settings'}
            </button>
            <button
              type="button"
              className="btn-neutral"
              onClick={() => {
                resetOverrideDialog();
                setOverrideDialogOpen(true);
              }}
              disabled={settingsSaving}
            >
              Overrides
            </button>
            <button type="button" className="btn-success" onClick={handleSaveSettings} disabled={settingsLoading || settingsSaving}>
              {settingsSaving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={settingsEnabled}
            onChange={(e) => setSettingsEnabled(e.target.checked)}
            disabled={settingsLoading || settingsSaving}
          />
          Enable guide videos
        </label>

        <div style={{ display: 'grid', gap: '0.45rem' }}>
          <div style={{ fontWeight: 700 }}>Excluded guide keys</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Available keys come from the registry below. Excluded keys remain configured but are removed from the customer response.
          </div>
          {settingsLoading ? (
            <div style={{ color: 'var(--muted)' }}>Loading guide video settings…</div>
          ) : availableKeys.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>No configured guide keys yet. Add registry entries first.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
              {availableKeys.map((key) => {
                const checked = excludedKeys.includes(key);
                return (
                  <label key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.75rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setExcludedKeys((prev) =>
                          e.target.checked ? [...prev, key] : prev.filter((item) => item !== key)
                        )
                      }
                      disabled={settingsSaving}
                    />
                    <span style={{ fontWeight: 600 }}>{key}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {overrideDialogOpen ? (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ width: 'min(860px, 96vw)', display: 'grid', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800 }}>Guide Video Overrides</div>
              <button
                type="button"
                onClick={() => {
                  if (overrideLoading || overrideSaving) return;
                  setOverrideDialogOpen(false);
                }}
                style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}
              >
                ×
              </button>
            </div>

            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Enter an account ID and optionally an email. If email is provided, the override is resolved through the account email lookup flow before applying guide-video settings.
            </div>

            {overrideError ? <div style={{ color: '#b91c1c', fontWeight: 700 }}>{overrideError}</div> : null}
            {overrideInfo ? <div style={{ color: '#15803d', fontWeight: 700 }}>{overrideInfo}</div> : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span>Account ID</span>
                <input value={overrideAccountId} onChange={(e) => setOverrideAccountId(e.target.value)} placeholder="123" />
              </label>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span>Email</span>
                <input value={overrideEmail} onChange={(e) => setOverrideEmail(e.target.value)} placeholder="qa@fondeka.test" />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn-neutral" onClick={loadOverride} disabled={overrideLoading || overrideSaving}>
                {overrideLoading ? 'Loading…' : 'Load override'}
              </button>
              <button type="button" className="btn-success" onClick={saveOverride} disabled={overrideLoading || overrideSaving || !overrideAccountId.trim()}>
                {overrideSaving ? 'Saving…' : 'Save override'}
              </button>
              <button type="button" className="btn-danger" onClick={deleteOverride} disabled={overrideLoading || overrideSaving || !overrideAccountId.trim()}>
                Use global settings
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <input type="checkbox" checked={overrideCustomized} readOnly />
                {overrideCustomized ? 'Customized for this target' : 'Using global settings'}
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <input type="checkbox" checked={overrideEnabled} onChange={(e) => setOverrideEnabled(e.target.checked)} disabled={overrideLoading || overrideSaving} />
                {overrideEnabled ? 'Guide videos enabled' : 'Guide videos disabled'}
              </label>
            </div>

            <div style={{ display: 'grid', gap: '0.45rem' }}>
              <div style={{ fontWeight: 700 }}>Excluded guide keys</div>
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                Check only the guide keys you want hidden for this account override.
              </div>
              {availableKeys.length === 0 ? (
                <div style={{ color: 'var(--muted)' }}>No configured guide keys yet. Add registry entries first.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                  {availableKeys.map((key) => {
                    const checked = overrideExcludedKeys.includes(key);
                    return (
                      <label key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.75rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setOverrideExcludedKeys((prev) =>
                              e.target.checked ? [...prev, key] : prev.filter((item) => item !== key)
                            )
                          }
                          disabled={overrideLoading || overrideSaving}
                        />
                        <span style={{ fontWeight: 600 }}>{key}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

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
