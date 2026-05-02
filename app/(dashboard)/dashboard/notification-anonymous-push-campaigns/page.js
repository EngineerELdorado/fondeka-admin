'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_BATCH_DELAY_SECONDS = 60;
const DEFAULT_INITIAL_DELAY_SECONDS = 5;
const emptyDataRow = { key: '', value: '' };
const audienceTypeOptions = [
  { value: 'PRE_SIGNUP', label: 'Pre-signup' },
  { value: 'SIGNED_OUT_REENGAGEMENT', label: 'Signed-out re-engagement' }
];
const platformOptions = [
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' }
];
const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' }
];

const toOptionalInteger = (value, { min = 0, label = 'Value' } = {}) => {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const num = Number(raw);
  if (!Number.isInteger(num) || num < min) {
    throw new Error(`${label} must be an integer >= ${min}.`);
  }
  return num;
};

const normalizeDataRows = (rows) =>
  rows
    .map((row) => ({
      key: String(row.key || '').trim(),
      value: String(row.value || '').trim()
    }))
    .filter((row) => row.key && row.value);

const toList = (res) => (Array.isArray(res) ? res : res?.content || []);

export default function NotificationAnonymousPushCampaignsPage() {
  const searchParams = useSearchParams();
  const initialPlatform = String(searchParams?.get('platform') || '').trim().toLowerCase();
  const initialLanguage = String(searchParams?.get('preferredLanguage') || '').trim().toLowerCase();
  const initialCountry = String(searchParams?.get('country') || '').trim().toUpperCase();
  const initialAudienceType = String(searchParams?.get('audienceType') || '').trim().toUpperCase();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [dataRows, setDataRows] = useState([emptyDataRow]);
  const [countries, setCountries] = useState([]);
  const [countryLoading, setCountryLoading] = useState(false);
  const [selectedAudienceTypes, setSelectedAudienceTypes] = useState(initialAudienceType ? [initialAudienceType] : []);
  const [selectedPlatforms, setSelectedPlatforms] = useState(initialPlatform ? [initialPlatform] : []);
  const [selectedDeviceLanguages, setSelectedDeviceLanguages] = useState(initialLanguage ? [initialLanguage] : []);
  const [selectedCountryCodes, setSelectedCountryCodes] = useState(initialCountry ? [initialCountry] : []);
  const [seenWithinDays, setSeenWithinDays] = useState('');
  const [batchSize, setBatchSize] = useState(String(DEFAULT_BATCH_SIZE));
  const [batchDelaySeconds, setBatchDelaySeconds] = useState(String(DEFAULT_BATCH_DELAY_SECONDS));
  const [initialDelaySeconds, setInitialDelaySeconds] = useState(String(DEFAULT_INITIAL_DELAY_SECONDS));
  const [launchLoading, setLaunchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [createResult, setCreateResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadCountries = async () => {
      setCountryLoading(true);
      try {
        const res = await api.countries.list(new URLSearchParams({ page: '0', size: '400' }));
        if (!cancelled) setCountries(toList(res));
      } catch {
        if (!cancelled) setCountries([]);
      } finally {
        if (!cancelled) setCountryLoading(false);
      }
    };
    loadCountries();
    return () => {
      cancelled = true;
    };
  }, []);

  const audiencePreview = useMemo(() => {
    try {
      const audience = {};
      const audienceTypes = selectedAudienceTypes.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean);
      const platforms = selectedPlatforms.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
      const deviceLanguages = selectedDeviceLanguages.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
      const countryCodes = selectedCountryCodes.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean);
      const seenDays = toOptionalInteger(seenWithinDays, { min: 1, label: 'Seen within days' });
      if (audienceTypes.length) audience.audienceTypes = Array.from(new Set(audienceTypes));
      if (platforms.length) audience.platforms = Array.from(new Set(platforms));
      if (deviceLanguages.length) audience.deviceLanguages = Array.from(new Set(deviceLanguages));
      if (countryCodes.length) audience.countryCodes = Array.from(new Set(countryCodes));
      if (seenDays !== undefined) audience.seenWithinDays = seenDays;
      return Object.keys(audience).length ? audience : undefined;
    } catch (previewError) {
      return { invalid: previewError.message };
    }
  }, [selectedAudienceTypes, selectedPlatforms, selectedDeviceLanguages, selectedCountryCodes, seenWithinDays]);

  const payloadPreview = useMemo(() => {
    try {
      const dataPairs = normalizeDataRows(dataRows);
      const data = dataPairs.length ? Object.fromEntries(dataPairs.map((row) => [row.key, row.value])) : undefined;
      return {
        subject: subject.trim(),
        message: message.trim(),
        ...(data ? { data } : {}),
        batchSize: toOptionalInteger(batchSize, { min: 1, label: 'Batch size' }) ?? DEFAULT_BATCH_SIZE,
        batchDelaySeconds: toOptionalInteger(batchDelaySeconds, { min: 0, label: 'Batch delay seconds' }) ?? DEFAULT_BATCH_DELAY_SECONDS,
        initialDelaySeconds: toOptionalInteger(initialDelaySeconds, { min: 0, label: 'Initial delay seconds' }) ?? DEFAULT_INITIAL_DELAY_SECONDS,
        ...(audiencePreview && !audiencePreview.invalid ? { audience: audiencePreview } : {})
      };
    } catch (previewError) {
      return { invalid: previewError.message };
    }
  }, [subject, message, dataRows, batchSize, batchDelaySeconds, initialDelaySeconds, audiencePreview]);

  const handleLaunchCampaign = async () => {
    setLaunchLoading(true);
    setError(null);
    setInfo(null);
    setCreateResult(null);
    try {
      if (!subject.trim()) throw new Error('Subject is required.');
      if (!message.trim()) throw new Error('Message is required.');
      if (payloadPreview?.invalid) throw new Error(payloadPreview.invalid);
      const res = await api.notifications.createAnonymousPushCampaign(payloadPreview);
      setCreateResult(res || null);
      setInfo('Anonymous push campaign launched.');
    } catch (err) {
      setError(err?.message || 'Failed to launch anonymous push campaign');
    } finally {
      setLaunchLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Anonymous Push Campaigns</div>
          <div style={{ color: 'var(--muted)' }}>
            This form sends only through the anonymous install pipeline and does not target account-bound devices.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/notification-anonymous-installs" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
            Anonymous installs
          </Link>
          <Link href="/dashboard/notification-push-campaigns" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
            Standard push campaigns
          </Link>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Campaign</div>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="subject">Subject</label>
            <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Finish setting up your account" />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="message">Message</label>
            <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Create your Fondeka account to start sending and saving money." />
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Audience</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Backend still limits delivery to unclaimed installs with usable push tokens. These filters only narrow that anonymous audience further.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="audienceTypes">Audience types</label>
            <select
              id="audienceTypes"
              multiple
              value={selectedAudienceTypes}
              onChange={(e) => setSelectedAudienceTypes(Array.from(e.target.selectedOptions).map((opt) => opt.value))}
              style={{ minHeight: '110px' }}
            >
              {audienceTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="platforms">Platforms</label>
            <select
              id="platforms"
              multiple
              value={selectedPlatforms}
              onChange={(e) => setSelectedPlatforms(Array.from(e.target.selectedOptions).map((opt) => opt.value))}
              style={{ minHeight: '110px' }}
            >
              {platformOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="languages">Device languages</label>
            <select
              id="languages"
              multiple
              value={selectedDeviceLanguages}
              onChange={(e) => setSelectedDeviceLanguages(Array.from(e.target.selectedOptions).map((opt) => opt.value))}
              style={{ minHeight: '110px' }}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="countries">Country codes</label>
            <select
              id="countries"
              multiple
              value={selectedCountryCodes}
              onChange={(e) => setSelectedCountryCodes(Array.from(e.target.selectedOptions).map((opt) => opt.value))}
              style={{ minHeight: '110px' }}
            >
              {countries.map((country) => {
                const code = String(country.code || country.countryCode || '').trim().toUpperCase();
                const name = country.name || country.label || code || 'Country';
                return (
                  <option key={code || String(country.id)} value={code}>
                    {name} ({code || '—'})
                  </option>
                );
              })}
            </select>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              {countryLoading ? 'Loading countries…' : 'Leave empty to target all countries.'}
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="seenWithinDays">Seen within days</label>
            <input id="seenWithinDays" type="number" min={1} value={seenWithinDays} onChange={(e) => setSeenWithinDays(e.target.value)} placeholder="30" />
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Payload data</div>
        {dataRows.map((row, index) => (
          <div key={`${index}-${row.key}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(220px, 2fr) auto', gap: '0.5rem', alignItems: 'end' }}>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor={`data-key-${index}`}>Key</label>
              <input
                id={`data-key-${index}`}
                value={row.key}
                onChange={(e) =>
                  setDataRows((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, key: e.target.value } : item)))
                }
                placeholder="screen"
              />
            </div>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor={`data-value-${index}`}>Value</label>
              <input
                id={`data-value-${index}`}
                value={row.value}
                onChange={(e) =>
                  setDataRows((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, value: e.target.value } : item)))
                }
                placeholder="SignupScreen"
              />
            </div>
            <button
              type="button"
              className="btn-neutral"
              onClick={() => setDataRows((prev) => (prev.length === 1 ? [emptyDataRow] : prev.filter((_, itemIndex) => itemIndex !== index)))}
            >
              Remove
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="btn-neutral" onClick={() => setDataRows((prev) => [...prev, emptyDataRow])}>
            Add data row
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Queue settings</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="batchSize">Batch size</label>
            <input id="batchSize" type="number" min={1} value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="batchDelaySeconds">Batch delay seconds</label>
            <input id="batchDelaySeconds" type="number" min={0} value={batchDelaySeconds} onChange={(e) => setBatchDelaySeconds(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="initialDelaySeconds">Initial delay seconds</label>
            <input id="initialDelaySeconds" type="number" min={0} value={initialDelaySeconds} onChange={(e) => setInitialDelaySeconds(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#166534', fontWeight: 700 }}>{info}</div>}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Preview</div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px', background: '#0f172a', color: '#e2e8f0', padding: '0.85rem', borderRadius: '10px' }}>
          {JSON.stringify(payloadPreview, null, 2)}
        </pre>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={handleLaunchCampaign} disabled={launchLoading}>
            {launchLoading ? 'Launching…' : 'Launch anonymous push campaign'}
          </button>
        </div>
      </div>

      {createResult && (
        <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 800 }}>Launch result</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px', background: '#0f172a', color: '#e2e8f0', padding: '0.85rem', borderRadius: '10px' }}>
            {JSON.stringify(createResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
