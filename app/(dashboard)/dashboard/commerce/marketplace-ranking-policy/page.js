'use client';

import { RegulatorRecord, PresentationLink as Link, RegulatorField } from '@/components/RegulatorPresentation';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

const FIELD_OPTIONS = [
  'MANUAL_PRIORITY',
  'HAS_VIDEO',
  'STORE_HAS_VIDEO',
  'STORE_VERIFIED',
  'COMPLETED_ORDERS',
  'RATING',
  'NAME',
  'CREATED_AT'
];

const DIRECTION_OPTIONS = ['ASC', 'DESC'];

const DEFAULT_RANKING = [
  { field: 'MANUAL_PRIORITY', direction: 'ASC', enabled: true },
  { field: 'HAS_VIDEO', direction: 'DESC', enabled: true },
  { field: 'COMPLETED_ORDERS', direction: 'DESC', enabled: true },
  { field: 'RATING', direction: 'DESC', enabled: true },
  { field: 'STORE_VERIFIED', direction: 'DESC', enabled: true },
  { field: 'NAME', direction: 'ASC', enabled: true },
  { field: 'CREATED_AT', direction: 'DESC', enabled: true }
];

const createRule = (overrides = {}) => ({
  field: FIELD_OPTIONS.includes(overrides.field) ? overrides.field : 'NAME',
  direction: DIRECTION_OPTIONS.includes(overrides.direction) ? overrides.direction : 'ASC',
  enabled: overrides.enabled !== false
});

const normalizeRanking = (value) => {
  const rows = Array.isArray(value) ? value : DEFAULT_RANKING;
  return rows.length ? rows.map((row) => createRule(row)) : DEFAULT_RANKING.map((row) => createRule(row));
};

const normalizePolicy = (policy) => ({
  productRanking: normalizeRanking(policy?.productRanking),
  storeRanking: normalizeRanking(policy?.storeRanking)
});

const buildPayload = (draft) => ({
  productRanking: normalizeRanking(draft.productRanking),
  storeRanking: normalizeRanking(draft.storeRanking)
});

const humanize = (value) =>
  String(value || '')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const RankingEditor = ({ title, subtitle, rows, onChange, disabled }) => {
  const updateRow = (index, patch) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? createRule({ ...row, ...patch }) : row)));
  };

  const moveRow = (index, offset) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= rows.length) return;
    const next = [...rows];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    onChange(next);
  };

  const removeRow = (index) => {
    onChange(rows.filter((_, rowIndex) => rowIndex !== index));
  };

  return (
    <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800 }}>{title}</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{subtitle}</div>
        </div>
        <button type="button" className="btn-neutral btn-sm" onClick={() => onChange([...rows, createRule()])} disabled={disabled}>
          Add rule
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
              {['Order', 'Enabled', 'Field', 'Direction', 'Actions'].map((label) => (
                <RegulatorField field={label} key={label}><th key={label} style={{ padding: '0.45rem' }}>{label}</th></RegulatorField>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <RegulatorRecord record={row} key={`${row.field}-${index}`}><tr key={`${row.field}-${index}`} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.45rem', fontWeight: 800 }}>{index + 1}</td>
                <td style={{ padding: '0.45rem' }}>
                  <input
                    type="checkbox"
                    checked={row.enabled !== false}
                    onChange={(event) => updateRow(index, { enabled: event.target.checked })}
                    disabled={disabled}
                    aria-label={`${title} rule ${index + 1} enabled`}
                  />
                </td>
                <td style={{ padding: '0.45rem' }}>
                  <select value={row.field} onChange={(event) => updateRow(index, { field: event.target.value })} disabled={disabled}>
                    {FIELD_OPTIONS.map((field) => (
                      <option key={field} value={field}>{humanize(field)}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '0.45rem' }}>
                  <select value={row.direction} onChange={(event) => updateRow(index, { direction: event.target.value })} disabled={disabled}>
                    {DIRECTION_OPTIONS.map((direction) => (
                      <option key={direction} value={direction}>{direction}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '0.45rem' }}>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-neutral btn-sm" onClick={() => moveRow(index, -1)} disabled={disabled || index === 0}>
                      Up
                    </button>
                    <button type="button" className="btn-neutral btn-sm" onClick={() => moveRow(index, 1)} disabled={disabled || index === rows.length - 1}>
                      Down
                    </button>
                    <button type="button" className="btn-danger btn-sm" onClick={() => removeRow(index)} disabled={disabled || rows.length <= 1}>
                      Remove
                    </button>
                  </div>
                </td>
              </tr></RegulatorRecord>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function CommerceMarketplaceRankingPolicyPage() {
  const [policy, setPolicy] = useState(() => normalizePolicy(null));
  const [draft, setDraft] = useState(() => normalizePolicy(null));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const payload = useMemo(() => buildPayload(draft), [draft]);
  const hasChanges = useMemo(() => JSON.stringify(payload) !== JSON.stringify(buildPayload(policy)), [payload, policy]);

  const applyPolicy = (nextPolicy) => {
    const normalized = normalizePolicy(nextPolicy);
    setPolicy(normalized);
    setDraft(normalized);
  };

  const showMessage = (setter, message) => {
    setter(message);
    window.setTimeout(() => setter(null), 4000);
  };

  const loadPolicy = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.commerceMarketplaceRankingPolicy.get();
      applyPolicy(res);
    } catch (err) {
      setError(err?.message || 'Failed to load marketplace ranking policy.');
      applyPolicy(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const savePolicy = async () => {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.commerceMarketplaceRankingPolicy.update(payload);
      applyPolicy(res || payload);
      showMessage(setInfo, 'Marketplace ranking policy saved.');
    } catch (err) {
      setError(err?.message || 'Failed to save marketplace ranking policy.');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setDraft(normalizePolicy(null));
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 800 }}>Commerce Marketplace Ranking Policy</div>
          <div style={{ color: 'var(--muted)' }}>
            Configure public marketplace discovery ordering for products and stores.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/commerce/stores" className="btn-neutral" style={{ textDecoration: 'none' }}>
            Stores
          </Link>
          <Link href="/dashboard/commerce/settlement-policy" className="btn-neutral" style={{ textDecoration: 'none' }}>
            Settlement policy
          </Link>
          <Link href="/dashboard/businesses/plans" className="btn-neutral" style={{ textDecoration: 'none' }}>
            Business Tools plans
          </Link>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {info ? <div className="alert alert-success">{info}</div> : null}

      <div className="card" style={{ display: 'grid', gap: '0.45rem' }}>
        <div style={{ fontWeight: 800 }}>Policy behavior</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          This policy affects marketplace/public discovery ordering only. Store and product admin listing order is unchanged.
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Rules are evaluated in the order shown. Disabled rules are sent but ignored by backend ranking.
        </div>
      </div>

      <RankingEditor
        title="Product ranking"
        subtitle="Controls product ordering in marketplace discovery. Product manual priority can inherit store priority."
        rows={draft.productRanking}
        disabled={loading || saving}
        onChange={(productRanking) => setDraft((prev) => ({ ...prev, productRanking }))}
      />

      <RankingEditor
        title="Store ranking"
        subtitle="Controls store ordering in marketplace discovery."
        rows={draft.storeRanking}
        disabled={loading || saving}
        onChange={(storeRanking) => setDraft((prev) => ({ ...prev, storeRanking }))}
      />

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          {loading ? 'Loading policy...' : hasChanges ? 'Unsaved ranking policy changes.' : 'Ranking policy is up to date.'}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={loadPolicy} disabled={loading || saving}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button type="button" className="btn-neutral" onClick={resetDefaults} disabled={loading || saving}>
            Reset to default draft
          </button>
          <button type="button" className="btn-primary" onClick={savePolicy} disabled={loading || saving || !hasChanges}>
            {saving ? 'Saving...' : 'Save policy'}
          </button>
        </div>
      </div>
    </div>
  );
}
