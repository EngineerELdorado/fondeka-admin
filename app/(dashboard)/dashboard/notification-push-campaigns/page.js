'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const DEFAULT_ACCOUNT_PAGE_SIZE = 500;
const DEFAULT_BATCH_SIZE = 150;
const DEFAULT_BATCH_DELAY_SECONDS = 20;
const DEFAULT_INITIAL_DELAY_SECONDS = 5;
const POLL_INTERVAL_MS = 10000;

const emptyDataRow = { key: '', value: '' };

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

export default function NotificationPushCampaignsPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [dataRows, setDataRows] = useState([emptyDataRow]);

  const [accountPageSize, setAccountPageSize] = useState(String(DEFAULT_ACCOUNT_PAGE_SIZE));
  const [batchSize, setBatchSize] = useState(String(DEFAULT_BATCH_SIZE));
  const [batchDelaySeconds, setBatchDelaySeconds] = useState(String(DEFAULT_BATCH_DELAY_SECONDS));
  const [initialDelaySeconds, setInitialDelaySeconds] = useState(String(DEFAULT_INITIAL_DELAY_SECONDS));

  const [countries, setCountries] = useState([]);
  const [countryLoading, setCountryLoading] = useState(false);
  const [selectedCountryIds, setSelectedCountryIds] = useState([]);
  const [countryCodesOverride, setCountryCodesOverride] = useState('');
  const [deviceLanguagesInput, setDeviceLanguagesInput] = useState('');
  const [hasCompletedTransactions, setHasCompletedTransactions] = useState('ANY');
  const [minCompletedTransactions, setMinCompletedTransactions] = useState('');
  const [maxCompletedTransactions, setMaxCompletedTransactions] = useState('');
  const [lastTransactionOlderThanDays, setLastTransactionOlderThanDays] = useState('');
  const [minTransactionsThisMonth, setMinTransactionsThisMonth] = useState('');
  const [maxTransactionsThisMonth, setMaxTransactionsThisMonth] = useState('');

  const [launchLoading, setLaunchLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [createResult, setCreateResult] = useState(null);
  const [campaignIdInput, setCampaignIdInput] = useState('');
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  const countryById = useMemo(() => {
    const map = new Map();
    (countries || []).forEach((country) => {
      map.set(String(country.id), country);
    });
    return map;
  }, [countries]);

  useEffect(() => {
    let cancelled = false;
    const loadCountries = async () => {
      setCountryLoading(true);
      try {
        const res = await api.countries.list(new URLSearchParams({ page: '0', size: '400' }));
        const list = Array.isArray(res) ? res : res?.content || [];
        if (!cancelled) setCountries(list || []);
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

  const buildAudiencePayload = useCallback(() => {
    const selectedCountries = selectedCountryIds
      .map((id) => countryById.get(String(id)))
      .filter(Boolean);
    const countryIds = selectedCountries
      .map((country) => Number(country.id))
      .filter((id) => Number.isInteger(id));
    const selectedCodes = selectedCountries
      .map((country) => String(country.code || country.countryCode || '').trim().toLowerCase())
      .filter(Boolean);
    const overrideCodes = String(countryCodesOverride || '')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const mergedCountryCodes = Array.from(new Set([...selectedCodes, ...overrideCodes]));
    const deviceLanguages = String(deviceLanguagesInput || '')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);

    const audience = {};
    if (countryIds.length) audience.countryIds = countryIds;
    if (mergedCountryCodes.length) audience.countryCodes = mergedCountryCodes;
    if (deviceLanguages.length) audience.deviceLanguages = Array.from(new Set(deviceLanguages));
    if (hasCompletedTransactions === 'TRUE') audience.hasCompletedTransactions = true;
    if (hasCompletedTransactions === 'FALSE') audience.hasCompletedTransactions = false;

    const minCompleted = toOptionalInteger(minCompletedTransactions, { min: 0, label: 'Min completed transactions' });
    const maxCompleted = toOptionalInteger(maxCompletedTransactions, { min: 0, label: 'Max completed transactions' });
    const olderThanDays = toOptionalInteger(lastTransactionOlderThanDays, { min: 0, label: 'Last transaction older-than days' });
    const minThisMonth = toOptionalInteger(minTransactionsThisMonth, { min: 0, label: 'Min transactions this month' });
    const maxThisMonth = toOptionalInteger(maxTransactionsThisMonth, { min: 0, label: 'Max transactions this month' });

    if (minCompleted !== undefined) audience.minCompletedTransactions = minCompleted;
    if (maxCompleted !== undefined) audience.maxCompletedTransactions = maxCompleted;
    if (olderThanDays !== undefined) audience.lastTransactionOlderThanDays = olderThanDays;
    if (minThisMonth !== undefined) audience.minTransactionsThisMonth = minThisMonth;
    if (maxThisMonth !== undefined) audience.maxTransactionsThisMonth = maxThisMonth;

    if (Object.keys(audience).length === 0) return undefined;
    return audience;
  }, [
    selectedCountryIds,
    countryById,
    countryCodesOverride,
    deviceLanguagesInput,
    hasCompletedTransactions,
    minCompletedTransactions,
    maxCompletedTransactions,
    lastTransactionOlderThanDays,
    minTransactionsThisMonth,
    maxTransactionsThisMonth
  ]);

  const payloadPreview = useMemo(() => {
    try {
      const dataPairs = normalizeDataRows(dataRows);
      const data = dataPairs.length ? Object.fromEntries(dataPairs.map((row) => [row.key, row.value])) : undefined;
      const audience = buildAudiencePayload();
      return {
        subject: subject.trim(),
        message: message.trim(),
        ...(data ? { data } : {}),
        accountPageSize: toOptionalInteger(accountPageSize, { min: 1, label: 'Account page size' }) ?? DEFAULT_ACCOUNT_PAGE_SIZE,
        batchSize: toOptionalInteger(batchSize, { min: 1, label: 'Batch size' }) ?? DEFAULT_BATCH_SIZE,
        batchDelaySeconds: toOptionalInteger(batchDelaySeconds, { min: 0, label: 'Batch delay seconds' }) ?? DEFAULT_BATCH_DELAY_SECONDS,
        initialDelaySeconds: toOptionalInteger(initialDelaySeconds, { min: 0, label: 'Initial delay seconds' }) ?? DEFAULT_INITIAL_DELAY_SECONDS,
        ...(audience ? { audience } : {})
      };
    } catch (previewError) {
      return { invalid: previewError.message };
    }
  }, [
    subject,
    message,
    dataRows,
    accountPageSize,
    batchSize,
    batchDelaySeconds,
    initialDelaySeconds,
    buildAudiencePayload
  ]);

  const progress = useMemo(() => {
    const totalJobs = Number(campaignStatus?.totalJobs) || 0;
    const processed = Number(campaignStatus?.processedJobs) || 0;
    const failed = Number(campaignStatus?.failedJobs) || 0;
    const done = processed + failed;
    const percent = totalJobs > 0 ? Math.min(100, Math.round((done / totalJobs) * 100)) : 0;
    return { totalJobs, processed, failed, done, percent };
  }, [campaignStatus]);

  const fetchCampaignStatus = async (inputCampaignId) => {
    const campaignId = String(inputCampaignId || campaignIdInput || '').trim();
    if (!campaignId) return;
    setStatusLoading(true);
    setError(null);
    try {
      const res = await api.notifications.getPushCampaign(campaignId);
      setCampaignStatus(res || null);
      return res || null;
    } catch (err) {
      setCampaignStatus(null);
      setError(err?.message || 'Failed to fetch campaign status');
      return null;
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    const campaignId = String(campaignIdInput || '').trim();
    if (!campaignId || !pollingEnabled) return undefined;
    if (campaignStatus?.completed) return undefined;
    const timer = setInterval(() => {
      fetchCampaignStatus(campaignId);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [campaignIdInput, pollingEnabled, campaignStatus?.completed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLaunchCampaign = async () => {
    setLaunchLoading(true);
    setError(null);
    setInfo(null);
    setCreateResult(null);
    try {
      const subjectValue = subject.trim();
      const messageValue = message.trim();
      if (!subjectValue) throw new Error('Subject is required.');
      if (!messageValue) throw new Error('Message is required.');
      if (payloadPreview?.invalid) throw new Error(payloadPreview.invalid);

      const dataPairs = normalizeDataRows(dataRows);
      const data = dataPairs.length ? Object.fromEntries(dataPairs.map((row) => [row.key, row.value])) : undefined;
      const audience = buildAudiencePayload();
      const payload = {
        subject: subjectValue,
        message: messageValue,
        ...(data ? { data } : {}),
        accountPageSize: toOptionalInteger(accountPageSize, { min: 1, label: 'Account page size' }) ?? DEFAULT_ACCOUNT_PAGE_SIZE,
        batchSize: toOptionalInteger(batchSize, { min: 1, label: 'Batch size' }) ?? DEFAULT_BATCH_SIZE,
        batchDelaySeconds: toOptionalInteger(batchDelaySeconds, { min: 0, label: 'Batch delay seconds' }) ?? DEFAULT_BATCH_DELAY_SECONDS,
        initialDelaySeconds: toOptionalInteger(initialDelaySeconds, { min: 0, label: 'Initial delay seconds' }) ?? DEFAULT_INITIAL_DELAY_SECONDS,
        ...(audience ? { audience } : {})
      };

      const res = await api.notifications.createPushCampaign(payload);
      setCreateResult(res || null);
      const nextCampaignId = String(res?.campaignId || '').trim();
      if (nextCampaignId) {
        setCampaignIdInput(nextCampaignId);
        setPollingEnabled(true);
        await fetchCampaignStatus(nextCampaignId);
      }
      setInfo('Push campaign launched.');
    } catch (err) {
      setError(err?.message || 'Failed to launch campaign');
    } finally {
      setLaunchLoading(false);
    }
  };

  const selectedCountryCodes = useMemo(() => {
    return selectedCountryIds
      .map((id) => countryById.get(String(id)))
      .filter(Boolean)
      .map((country) => String(country.code || country.countryCode || '').trim().toLowerCase())
      .filter(Boolean);
  }, [selectedCountryIds, countryById]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Push Campaigns</div>
          <div style={{ color: 'var(--muted)' }}>Launch targeted campaigns with defaults, then monitor progress in real time.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/notification-push-campaign-history" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
            Campaign history
          </Link>
          <Link href="/dashboard/notification-providers" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
            ← Notification providers
          </Link>
        </div>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
            <div style={{ fontWeight: 800 }}>1. Campaign content</div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Subject</span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="We miss you" />
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Message</span>
                <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Come back to Fondeka" />
              </label>
            </div>

            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Optional data key/value</summary>
              <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-neutral btn-sm" onClick={() => setDataRows((prev) => [...prev, emptyDataRow])}>
                    Add data row
                  </button>
                </div>
                {dataRows.map((row, index) => (
                  <div key={`data-row-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                      <span>Key</span>
                      <input
                        value={row.key}
                        onChange={(e) => setDataRows((prev) => prev.map((item, i) => (i === index ? { ...item, key: e.target.value } : item)))}
                        placeholder="screen"
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                      <span>Value</span>
                      <input
                        value={row.value}
                        onChange={(e) => setDataRows((prev) => prev.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)))}
                        placeholder="offers"
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-neutral btn-sm"
                      onClick={() =>
                        setDataRows((prev) => {
                          if (prev.length <= 1) return [emptyDataRow];
                          return prev.filter((_, i) => i !== index);
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </div>

          <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
            <div style={{ fontWeight: 800 }}>2. Audience</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              AND across fields, OR inside list fields. Leave empty to target all accounts.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Countries ({countryLoading ? 'loading...' : `${countries.length} available`})</span>
                <select
                  multiple
                  value={selectedCountryIds}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                    setSelectedCountryIds(values);
                  }}
                  style={{ minHeight: '130px' }}
                >
                  {countries.map((country) => {
                    const id = String(country.id);
                    const code = String(country.code || country.countryCode || '').toUpperCase();
                    const name = country.name || country.label || `Country ${id}`;
                    return (
                      <option key={id} value={id}>
                        {name} ({code || '—'}) • ID {id}
                      </option>
                    );
                  })}
                </select>
              </label>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span>Country codes override</span>
                  <input value={countryCodesOverride} onChange={(e) => setCountryCodesOverride(e.target.value)} placeholder="cd, rw" />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span>Device languages</span>
                  <input value={deviceLanguagesInput} onChange={(e) => setDeviceLanguagesInput(e.target.value)} placeholder="fr, en" />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span>Has completed transactions</span>
                  <select value={hasCompletedTransactions} onChange={(e) => setHasCompletedTransactions(e.target.value)}>
                    <option value="ANY">Any</option>
                    <option value="TRUE">Yes</option>
                    <option value="FALSE">No (zero completed)</option>
                  </select>
                </label>
              </div>
            </div>
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Advanced transaction ranges</summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.65rem' }}>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span>Min completed</span>
                  <input type="number" min={0} value={minCompletedTransactions} onChange={(e) => setMinCompletedTransactions(e.target.value)} placeholder="0" />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span>Max completed</span>
                  <input type="number" min={0} value={maxCompletedTransactions} onChange={(e) => setMaxCompletedTransactions(e.target.value)} placeholder="2" />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span>Last tx older than (days)</span>
                  <input type="number" min={0} value={lastTransactionOlderThanDays} onChange={(e) => setLastTransactionOlderThanDays(e.target.value)} placeholder="30" />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span>Min this month</span>
                  <input type="number" min={0} value={minTransactionsThisMonth} onChange={(e) => setMinTransactionsThisMonth(e.target.value)} placeholder="0" />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span>Max this month</span>
                  <input type="number" min={0} value={maxTransactionsThisMonth} onChange={(e) => setMaxTransactionsThisMonth(e.target.value)} placeholder="1" />
                </label>
              </div>
            </details>
            {(selectedCountryIds.length > 0 || selectedCountryCodes.length > 0) && (
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Selected countries: IDs [{selectedCountryIds.join(', ')}] • Codes [{selectedCountryCodes.join(', ')}]
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
          <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
            <div style={{ fontWeight: 800 }}>3. Delivery controls</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>accountPageSize</span>
                <input type="number" min={1} value={accountPageSize} onChange={(e) => setAccountPageSize(e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>batchSize</span>
                <input type="number" min={1} value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>batchDelaySeconds</span>
                <input type="number" min={0} value={batchDelaySeconds} onChange={(e) => setBatchDelaySeconds(e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>initialDelaySeconds</span>
                <input type="number" min={0} value={initialDelaySeconds} onChange={(e) => setInitialDelaySeconds(e.target.value)} />
              </label>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Defaults: {DEFAULT_ACCOUNT_PAGE_SIZE} / {DEFAULT_BATCH_SIZE} / {DEFAULT_BATCH_DELAY_SECONDS}s / {DEFAULT_INITIAL_DELAY_SECONDS}s
            </div>
          </div>

          <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ fontWeight: 800 }}>4. Preview</div>
            <pre style={{ margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap', background: 'color-mix(in srgb, var(--surface) 86%, var(--accent-soft) 14%)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem', maxHeight: '260px' }}>
              {JSON.stringify(payloadPreview, null, 2)}
            </pre>
            <button type="button" className="btn-primary" onClick={handleLaunchCampaign} disabled={launchLoading}>
              {launchLoading ? 'Launching...' : 'Launch campaign'}
            </button>
          </div>
        </div>
      </div>

      {createResult && (
        <div className="card" style={{ display: 'grid', gap: '0.55rem' }}>
          <div style={{ fontWeight: 800 }}>Campaign submitted</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
            <div><strong>Campaign ID:</strong> {createResult.campaignId || '—'}</div>
            <div><strong>Scanned:</strong> {createResult.scannedAccounts ?? '—'}</div>
            <div><strong>Enqueued:</strong> {createResult.enqueuedJobs ?? '—'}</div>
            <div><strong>Skipped:</strong> {createResult.skippedJobs ?? '—'}</div>
            <div><strong>accountPageSize:</strong> {createResult.accountPageSize ?? '—'}</div>
            <div><strong>batchSize:</strong> {createResult.batchSize ?? '—'}</div>
            <div><strong>batchDelaySeconds:</strong> {createResult.batchDelaySeconds ?? '—'}</div>
            <div><strong>initialDelaySeconds:</strong> {createResult.initialDelaySeconds ?? '—'}</div>
          </div>
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800 }}>Campaign status</div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '13px' }}>
            <input type="checkbox" checked={pollingEnabled} onChange={(e) => setPollingEnabled(e.target.checked)} />
            Auto-poll every 10s
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', alignItems: 'center' }}>
          <input value={campaignIdInput} onChange={(e) => setCampaignIdInput(e.target.value)} placeholder="CMP-..." />
          <button type="button" className="btn-neutral btn-sm" onClick={() => fetchCampaignStatus(campaignIdInput)} disabled={statusLoading || !campaignIdInput.trim()}>
            {statusLoading ? 'Refreshing...' : 'Refresh status'}
          </button>
        </div>
        {!campaignStatus ? (
          <div style={{ color: 'var(--muted)' }}>Enter a campaign ID or launch a new campaign to start tracking.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem' }}>
              <div><strong>Campaign ID:</strong> {campaignStatus.campaignId || '—'}</div>
              <div><strong>Found:</strong> {String(Boolean(campaignStatus.found))}</div>
              <div><strong>Completed:</strong> {String(Boolean(campaignStatus.completed))}</div>
              <div><strong>Total jobs:</strong> {campaignStatus.totalJobs ?? '—'}</div>
              <div><strong>Pending:</strong> {campaignStatus.pendingJobs ?? '—'}</div>
              <div><strong>Processing:</strong> {campaignStatus.processingJobs ?? '—'}</div>
              <div><strong>Processed:</strong> {campaignStatus.processedJobs ?? '—'}</div>
              <div><strong>Failed:</strong> {campaignStatus.failedJobs ?? '—'}</div>
            </div>
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)' }}>
                <span>Progress ({progress.done}/{progress.totalJobs || 0})</span>
                <span>{progress.percent}%</span>
              </div>
              <div style={{ width: '100%', height: '10px', borderRadius: '999px', background: 'color-mix(in srgb, var(--surface) 78%, var(--border) 22%)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progress.percent}%`,
                    background: progress.percent >= 100 ? '#16a34a' : '#0ea5e9',
                    transition: 'width 0.2s ease'
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
