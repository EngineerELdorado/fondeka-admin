'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import COUNTRIES, { codeToFlag } from '@/data/countries';

const COUNTRY_OPTIONS = COUNTRIES.filter((country, index, list) => (
  country?.cca2 && list.findIndex((item) => item.cca2 === country.cca2) === index
));

const emptyDraft = {
  countryCode: '',
  cardHolderCreationEnabled: true,
  disabledMessageEn: '',
  disabledMessageFr: ''
};

const countryLabel = (code) => {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return '-';
  const country = COUNTRY_OPTIONS.find((item) => item.cca2 === normalized);
  return country ? `${codeToFlag(normalized)} ${country.name} (${normalized})` : normalized;
};

const normalizeRows = (res) => {
  if (Array.isArray(res)) return res;
  return res?.content || res?.policies || res?.items || [];
};

const toDraft = (row) => ({
  countryCode: String(row?.countryCode || '').toUpperCase(),
  cardHolderCreationEnabled: row?.cardHolderCreationEnabled !== false,
  disabledMessageEn: row?.disabledMessageEn || '',
  disabledMessageFr: row?.disabledMessageFr || ''
});

const toPayload = (draft) => ({
  cardHolderCreationEnabled: Boolean(draft.cardHolderCreationEnabled),
  disabledMessageEn: String(draft.disabledMessageEn || '').trim() || null,
  disabledMessageFr: String(draft.disabledMessageFr || '').trim() || null
});

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          x
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default function CardHolderCountryPoliciesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [confirmReset, setConfirmReset] = useState(null);

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.cardHolderCountryPolicies.list();
      setRows(normalizeRows(res));
    } catch (err) {
      setError(err?.message || 'Failed to load card-holder country policies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setDraft(emptyDraft);
    setShowEdit(true);
    setError(null);
    setInfo(null);
  };

  const openEdit = (row) => {
    setDraft(toDraft(row));
    setShowEdit(true);
    setError(null);
    setInfo(null);
  };

  const save = async () => {
    const countryCode = String(draft.countryCode || '').trim().toUpperCase();
    if (!countryCode) {
      setError('Country is required.');
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.cardHolderCountryPolicies.update(countryCode, toPayload(draft));
      setInfo(`Saved card-holder policy for ${countryCode}.`);
      setShowEdit(false);
      await loadRows();
    } catch (err) {
      setError(err?.message || 'Failed to save card-holder country policy.');
    } finally {
      setSaving(false);
    }
  };

  const resetPolicy = async () => {
    const countryCode = String(confirmReset?.countryCode || '').trim().toUpperCase();
    if (!countryCode) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.cardHolderCountryPolicies.remove(countryCode);
      setConfirmReset(null);
      setInfo(`Reset ${countryCode} to default permissive behavior.`);
      await loadRows();
    } catch (err) {
      setError(err?.message || 'Failed to reset card-holder country policy.');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => [
    {
      key: 'countryCode',
      label: 'Country',
      render: (row) => countryLabel(row.countryCode)
    },
    {
      key: 'cardHolderCreationEnabled',
      label: 'Card-holder creation',
      render: (row) => (
        <span
          style={{
            display: 'inline-flex',
            padding: '0.2rem 0.55rem',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 800,
            background: row.cardHolderCreationEnabled === false ? '#FEF2F2' : '#ECFDF3',
            color: row.cardHolderCreationEnabled === false ? '#B91C1C' : '#15803D'
          }}
        >
          {row.cardHolderCreationEnabled === false ? 'Disabled' : 'Enabled'}
        </span>
      )
    },
    {
      key: 'disabledMessageEn',
      label: 'Disabled message EN',
      render: (row) => row.disabledMessageEn || '-'
    },
    {
      key: 'disabledMessageFr',
      label: 'Disabled message FR',
      render: (row) => row.disabledMessageFr || '-'
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={() => openEdit(row)}>
            Edit
          </button>
          <button type="button" className="btn-danger" onClick={() => setConfirmReset(row)}>
            Reset
          </button>
        </div>
      )
    }
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>Card Holder Country Policies</div>
          <div style={{ color: 'var(--muted)' }}>
            Control whether users in a country can create card holders. Countries without a policy are allowed by default.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/cards" className="btn-neutral" style={{ textDecoration: 'none' }}>
            Cards
          </Link>
          <button type="button" className="btn-primary" onClick={openCreate}>
            Add policy
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      {loading ? (
        <div className="card" style={{ color: 'var(--muted)' }}>Loading policies...</div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          emptyLabel="No country policies configured. Card-holder creation is allowed by default."
          showAccountQuickNav={false}
        />
      )}

      {showEdit && (
        <Modal title={draft.countryCode ? `Edit policy for ${draft.countryCode}` : 'Add country policy'} onClose={() => (!saving ? setShowEdit(false) : null)}>
          <div style={{ display: 'grid', gap: '0.85rem', marginTop: '0.75rem' }}>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="countryCode">Country</label>
              <select
                id="countryCode"
                value={draft.countryCode}
                onChange={(e) => setDraft((prev) => ({ ...prev, countryCode: e.target.value }))}
                disabled={saving || Boolean(draft.countryCode && rows.some((row) => String(row.countryCode).toUpperCase() === draft.countryCode))}
              >
                <option value="">Select country</option>
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country.cca2} value={country.cca2}>
                    {codeToFlag(country.cca2)} {country.name} ({country.cca2})
                  </option>
                ))}
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={draft.cardHolderCreationEnabled}
                onChange={(e) => setDraft((prev) => ({ ...prev, cardHolderCreationEnabled: e.target.checked }))}
                disabled={saving}
              />
              Card-holder creation enabled
            </label>

            {!draft.cardHolderCreationEnabled && (
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                These messages are returned when card-holder creation is blocked for this country.
              </div>
            )}

            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="disabledMessageEn">Disabled message (English)</label>
              <textarea
                id="disabledMessageEn"
                rows={3}
                value={draft.disabledMessageEn}
                onChange={(e) => setDraft((prev) => ({ ...prev, disabledMessageEn: e.target.value }))}
                disabled={saving}
              />
            </div>

            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="disabledMessageFr">Disabled message (French)</label>
              <textarea
                id="disabledMessageFr"
                rows={3}
                value={draft.disabledMessageFr}
                onChange={(e) => setDraft((prev) => ({ ...prev, disabledMessageFr: e.target.value }))}
                disabled={saving}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn-neutral" onClick={() => setShowEdit(false)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save policy'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmReset && (
        <Modal title="Reset country policy" onClose={() => (!saving ? setConfirmReset(null) : null)}>
          <div style={{ display: 'grid', gap: '0.85rem', marginTop: '0.75rem' }}>
            <div>
              Reset <strong>{countryLabel(confirmReset.countryCode)}</strong> to default behavior? This deletes the explicit policy and card-holder creation becomes allowed unless backend defaults change.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn-neutral" onClick={() => setConfirmReset(null)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={resetPolicy} disabled={saving}>
                {saving ? 'Resetting...' : 'Reset policy'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
