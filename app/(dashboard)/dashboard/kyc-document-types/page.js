'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const DOCUMENT_CODES = [
  'PASSPORT',
  'NATIONAL_ID',
  'VOTER_ID',
  'DRIVERS_LICENSE',
  'RESIDENCE_CARD',
  'ALIEN_CARD',
  'BUSINESS_PERMIT',
  'REFUGEE_ID',
  'TRAVEL_DOCUMENT',
  'TAX_ID',
  'SOCIAL_SECURITY_CARD',
  'BIRTH_CERTIFICATE'
];

const emptyDraft = {
  countryCode: '',
  code: 'PASSPORT',
  displayNameEn: '',
  displayNameFr: '',
  requiresBack: false,
  active: true,
  rank: '10'
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          x
        </button>
      </div>
      {children}
    </div>
  </div>
);

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatScope = (row) => (row?.countryCode ? `Country ${String(row.countryCode).toUpperCase()}` : 'Global fallback');

const buildPayload = (draft) => {
  const countryCode = String(draft.countryCode || '').trim().toUpperCase();
  return {
    countryCode: countryCode || null,
    code: String(draft.code || '').trim().toUpperCase(),
    displayNameEn: String(draft.displayNameEn || '').trim(),
    displayNameFr: String(draft.displayNameFr || '').trim(),
    requiresBack: Boolean(draft.requiresBack),
    active: Boolean(draft.active),
    rank: Number(draft.rank || 0)
  };
};

const validateDraft = (draft) => {
  const payload = buildPayload(draft);
  if (!payload.code) return 'Code is required.';
  if (!payload.displayNameEn) return 'English display name is required.';
  if (!payload.displayNameFr) return 'French display name is required.';
  if (payload.countryCode && payload.countryCode.length !== 2) return 'Country code must be ISO alpha-2.';
  if (!Number.isFinite(payload.rank)) return 'Rank must be a number.';
  return null;
};

export default function KycDocumentTypesPage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ countryCode: '', active: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.countryCode.trim()) params.set('countryCode', filters.countryCode.trim().toUpperCase());
      if (filters.active) params.set('active', filters.active);
      const res = await api.kycDocumentTypes.list(params);
      setRows(Array.isArray(res) ? res : res?.content || []);
    } catch (err) {
      setError(err.message || 'Failed to load KYC document types.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDraft = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));

  const openCreate = () => {
    setSelected(null);
    setDraft(emptyDraft);
    setShowForm(true);
    setError(null);
    setInfo(null);
  };

  const openEdit = async (row) => {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const data = row?.id ? await api.kycDocumentTypes.get(row.id) : row;
      setSelected(data || row);
      setDraft({
        countryCode: data?.countryCode || '',
        code: data?.code || '',
        displayNameEn: data?.displayNameEn || '',
        displayNameFr: data?.displayNameFr || '',
        requiresBack: Boolean(data?.requiresBack),
        active: Boolean(data?.active ?? true),
        rank: String(data?.rank ?? 0)
      });
      setShowForm(true);
    } catch (err) {
      setError(err.message || `Failed to load document type ${row.id}.`);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (row) => {
    setSaving(true);
    setError(null);
    try {
      const data = row?.id ? await api.kycDocumentTypes.get(row.id) : row;
      setSelected(data || row);
      setShowDetail(true);
    } catch (err) {
      setError(err.message || `Failed to load document type ${row.id}.`);
    } finally {
      setSaving(false);
    }
  };

  const saveDocumentType = async () => {
    const message = validateDraft(draft);
    if (message) {
      setError(message);
      return;
    }
    const payload = buildPayload(draft);
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      if (selected?.id) {
        await api.kycDocumentTypes.update(selected.id, payload);
        setInfo(`Updated document type ${selected.id}.`);
      } else {
        await api.kycDocumentTypes.create(payload);
        setInfo('Created KYC document type.');
      }
      setShowForm(false);
      setSelected(null);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to save KYC document type.');
    } finally {
      setSaving(false);
    }
  };

  const deleteDocumentType = async () => {
    if (!deleteTarget?.id) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.kycDocumentTypes.remove(deleteTarget.id);
      setInfo(`Deleted document type ${deleteTarget.id}.`);
      setDeleteTarget(null);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to delete document type ${deleteTarget.id}.`);
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'scope', label: 'Scope', render: formatScope },
      { key: 'code', label: 'Code' },
      { key: 'displayNameEn', label: 'Name EN' },
      { key: 'displayNameFr', label: 'Name FR' },
      { key: 'requiresBack', label: 'Requires back', render: (row) => (row.requiresBack ? 'Yes' : 'No') },
      { key: 'active', label: 'Active', render: (row) => (row.active ? 'Yes' : 'No') },
      { key: 'rank', label: 'Rank' },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => openDetail(row)} disabled={saving}>
              View
            </button>
            <button type="button" className="btn-neutral btn-sm" onClick={() => openEdit(row)} disabled={saving}>
              Edit
            </button>
            <button type="button" className="btn-danger btn-sm" onClick={() => setDeleteTarget(row)} disabled={saving}>
              Delete
            </button>
          </div>
        )
      }
    ],
    [saving]
  );

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>KYC document types</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)' }}>
            Manage the document selector shown to customers per country.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          Add document type
        </button>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.55rem' }}>
        <div style={{ fontWeight: 800 }}>Context</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px', display: 'grid', gap: '0.25rem' }}>
          <div>If a country has active document type rows, the customer app receives only those rows for that country.</div>
          <div>If a country has no active rows, the customer app falls back to global rows where country is empty.</div>
          <div>Requires back means the app asks for front and back. This is currently client guidance, not a hard backend block on KYC submission.</div>
        </div>
      </div>

      {(error || info) && (
        <div className="card" style={{ borderColor: error ? '#fecaca' : '#bbf7d0', color: error ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
          {error || info}
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Filters</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Country</span>
            <input value={filters.countryCode} onChange={(e) => setFilters((prev) => ({ ...prev, countryCode: e.target.value }))} placeholder="CD" />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Active</span>
            <select value={filters.active} onChange={(e) => setFilters((prev) => ({ ...prev, active: e.target.value }))}>
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <button type="button" className="btn-primary btn-sm" onClick={fetchRows} disabled={loading}>
            {loading ? 'Loading...' : 'Apply'}
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        emptyLabel={loading ? 'Loading document types...' : 'No KYC document types found.'}
        showAccountQuickNav={false}
      />

      {showForm && (
        <Modal title={selected?.id ? `Edit document type ${selected.id}` : 'Add KYC document type'} onClose={() => (!saving ? setShowForm(false) : null)}>
          <DocumentTypeForm draft={draft} updateDraft={updateDraft} saving={saving} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
            <button type="button" className="btn-primary" onClick={saveDocumentType} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}

      {showDetail && selected && (
        <Modal title={`Document type ${selected.id}`} onClose={() => setShowDetail(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
            {[
              ['Scope', formatScope(selected)],
              ['Country ID', selected.countryId],
              ['Code', selected.code],
              ['Name EN', selected.displayNameEn],
              ['Name FR', selected.displayNameFr],
              ['Requires back', selected.requiresBack ? 'Yes' : 'No'],
              ['Active', selected.active ? 'Yes' : 'No'],
              ['Rank', selected.rank],
              ['Created', formatDateTime(selected.createdAt)],
              ['Updated', formatDateTime(selected.updatedAt)]
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'grid', gap: '0.15rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
                <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{value ?? '-'}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete document type" onClose={() => (!saving ? setDeleteTarget(null) : null)}>
          <p>Delete {deleteTarget.code} for {formatScope(deleteTarget)}?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral" onClick={() => setDeleteTarget(null)} disabled={saving}>Cancel</button>
            <button type="button" className="btn-danger" onClick={deleteDocumentType} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DocumentTypeForm({ draft, updateDraft, saving }) {
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Country</span>
          <input value={draft.countryCode} onChange={(e) => updateDraft('countryCode', e.target.value)} placeholder="Leave empty for global" disabled={saving} />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Code</span>
          <select
            value={DOCUMENT_CODES.includes(draft.code) ? draft.code : '__CUSTOM__'}
            onChange={(e) => updateDraft('code', e.target.value === '__CUSTOM__' ? '' : e.target.value)}
            disabled={saving}
          >
            {DOCUMENT_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
            <option value="__CUSTOM__">Custom code</option>
          </select>
          {!DOCUMENT_CODES.includes(draft.code) ? (
            <input value={draft.code} onChange={(e) => updateDraft('code', e.target.value)} placeholder="CUSTOM_DOCUMENT_CODE" disabled={saving} />
          ) : null}
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Rank</span>
          <input type="number" value={draft.rank} onChange={(e) => updateDraft('rank', e.target.value)} disabled={saving} />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Display name EN</span>
          <input value={draft.displayNameEn} onChange={(e) => updateDraft('displayNameEn', e.target.value)} disabled={saving} />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Display name FR</span>
          <input value={draft.displayNameFr} onChange={(e) => updateDraft('displayNameFr', e.target.value)} disabled={saving} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
          <input type="checkbox" checked={draft.requiresBack} onChange={(e) => updateDraft('requiresBack', e.target.checked)} disabled={saving} />
          Requires back
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
          <input type="checkbox" checked={draft.active} onChange={(e) => updateDraft('active', e.target.checked)} disabled={saving} />
          Active
        </label>
      </div>
    </div>
  );
}
