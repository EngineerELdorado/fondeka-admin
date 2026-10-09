'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import COUNTRIES, { codeToFlag } from '@/data/countries';

const COUNTRY_OPTIONS = COUNTRIES.filter((country, index, list) => (
  country?.cca2 && list.findIndex((item) => item.cca2 === country.cca2) === index
));

const CountrySelect = ({ value, onChange, disabled, emptyLabel = 'Select country' }) => (
  <select value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
    <option value="">{emptyLabel}</option>
    {COUNTRY_OPTIONS.map((country) => (
      <option key={country.cca2} value={country.cca2}>
        {codeToFlag(country.cca2)} {country.name} ({country.cca2})
      </option>
    ))}
  </select>
);

const emptyDraft = {
  countryCode: '',
  code: '',
  displayNameEn: '',
  displayNameFr: '',
  requiresBack: false,
  active: true,
  rank: '10'
};

const TypeCardSkeleton = () => (
  <div className="card" style={{ display: 'grid', gap: '0.75rem', padding: '1rem', minHeight: '156px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
      <div style={{ width: '42%', height: '16px', borderRadius: '999px', background: 'var(--border)' }} />
      <div style={{ width: '64px', height: '24px', borderRadius: '999px', background: 'var(--border)' }} />
    </div>
    <div style={{ display: 'grid', gap: '0.45rem' }}>
      <div style={{ width: '78%', height: '12px', borderRadius: '999px', background: 'var(--border)' }} />
      <div style={{ width: '62%', height: '12px', borderRadius: '999px', background: 'var(--border)' }} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: 'auto' }}>
      <div style={{ height: '34px', borderRadius: '8px', background: 'var(--border)' }} />
      <div style={{ height: '34px', borderRadius: '8px', background: 'var(--border)' }} />
      <div style={{ height: '34px', borderRadius: '8px', background: 'var(--border)' }} />
    </div>
  </div>
);

const TypeCardSkeletonGrid = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
    {Array.from({ length: 6 }).map((_, index) => (
      <TypeCardSkeleton key={index} />
    ))}
  </div>
);

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
    displayNameFr: String(draft.displayNameFr || '').trim() || null,
    requiresBack: Boolean(draft.requiresBack),
    active: Boolean(draft.active),
    rank: Number(draft.rank || 0)
  };
};

const validateDraft = (draft) => {
  const payload = buildPayload(draft);
  if (!payload.code) return 'Code is required.';
  if (!payload.displayNameEn) return 'English display name is required.';
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
  const [smileSyncCountryCode, setSmileSyncCountryCode] = useState('');
  const [smileSyncActive, setSmileSyncActive] = useState(true);
  const [smileSyncDeactivateMissing, setSmileSyncDeactivateMissing] = useState(false);
  const [smileSyncPreview, setSmileSyncPreview] = useState(null);
  const [smileSyncLoading, setSmileSyncLoading] = useState(false);
  const [smileSyncSaving, setSmileSyncSaving] = useState(false);
  const [smileSyncError, setSmileSyncError] = useState(null);

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

  const previewSmileIdDocumentTypes = async () => {
    const countryCode = String(smileSyncCountryCode || '').trim().toUpperCase();
    if (countryCode.length !== 2) {
      setSmileSyncError('Country code must be ISO alpha-2.');
      return;
    }
    setSmileSyncLoading(true);
    setSmileSyncError(null);
    setInfo(null);
    try {
      const res = await api.kycDocumentTypes.smileIdPreview(new URLSearchParams({ countryCode }));
      setSmileSyncPreview(res || null);
    } catch (err) {
      setSmileSyncPreview(null);
      setSmileSyncError(err.message || 'Failed to preview SmileID document types.');
    } finally {
      setSmileSyncLoading(false);
    }
  };

  const syncSmileIdDocumentTypes = async () => {
    const countryCode = String(smileSyncCountryCode || '').trim().toUpperCase();
    if (countryCode.length !== 2) {
      setSmileSyncError('Country code must be ISO alpha-2.');
      return;
    }
    const confirmed = window.confirm(
      smileSyncDeactivateMissing
        ? `Sync SmileID document types for ${countryCode} and deactivate missing local rows?`
        : `Sync SmileID document types for ${countryCode}? Missing local rows will stay unchanged.`
    );
    if (!confirmed) return;
    setSmileSyncSaving(true);
    setSmileSyncError(null);
    setInfo(null);
    try {
      const res = await api.kycDocumentTypes.smileIdSync({
        countryCode,
        active: Boolean(smileSyncActive),
        deactivateMissing: Boolean(smileSyncDeactivateMissing)
      });
      setSmileSyncPreview(res || null);
      setInfo(`SmileID sync complete for ${countryCode}: ${res?.created ?? 0} created, ${res?.updated ?? 0} updated, ${res?.unchanged ?? 0} unchanged, ${res?.deactivated ?? 0} deactivated.`);
      setFilters((prev) => ({ ...prev, countryCode }));
      await fetchRows();
    } catch (err) {
      setSmileSyncError(err.message || 'Failed to sync SmileID document types.');
    } finally {
      setSmileSyncSaving(false);
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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a
            href="https://legacy-docs.usesmileid.com/supported-id-types/for-individuals-kyc/using-document-image/regions/africa"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neutral"
            style={{ textDecoration: 'none' }}
          >
            SmileID supported IDs
          </a>
          <button type="button" className="btn-primary" onClick={openCreate}>
            Add document type
          </button>
        </div>
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

      <details className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800 }}>SmileID document type sync</div>
              <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '0.2rem' }}>
                Preview SmileID supported ID types for a country, then sync them into the local document type list.
              </div>
            </div>
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Expand</span>
          </div>
        </summary>

        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-neutral btn-sm" onClick={previewSmileIdDocumentTypes} disabled={smileSyncLoading || smileSyncSaving}>
                {smileSyncLoading ? 'Previewing...' : 'Preview SmileID'}
              </button>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={syncSmileIdDocumentTypes}
                disabled={smileSyncLoading || smileSyncSaving || !smileSyncPreview}
              >
                {smileSyncSaving ? 'Syncing...' : 'Sync SmileID'}
              </button>
            </div>

          {smileSyncError ? <div style={{ color: '#b91c1c', fontWeight: 700 }}>{smileSyncError}</div> : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Country</span>
              <CountrySelect
                value={smileSyncCountryCode}
                onChange={(value) => setSmileSyncCountryCode(value)}
                emptyLabel="Select country"
                disabled={smileSyncLoading || smileSyncSaving}
              />
            </label>
            <label style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={smileSyncActive}
                onChange={(e) => setSmileSyncActive(e.target.checked)}
                disabled={smileSyncLoading || smileSyncSaving}
              />
              <span>Set synced rows active</span>
            </label>
            <label style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={smileSyncDeactivateMissing}
                onChange={(e) => setSmileSyncDeactivateMissing(e.target.checked)}
                disabled={smileSyncLoading || smileSyncSaving}
              />
              <span>Deactivate missing local rows</span>
            </label>
          </div>

          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Leave deactivate missing off for the safest sync. Turning it on disables local document types for the country when SmileID no longer returns them.
          </div>

          {smileSyncPreview ? (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', color: 'var(--muted)', fontSize: '13px' }}>
                <span>Country: <strong>{smileSyncPreview.countryCode || '-'}</strong></span>
                <span>Fetched: <strong>{smileSyncPreview.fetched ?? '-'}</strong></span>
                <span>Created: <strong>{smileSyncPreview.created ?? 0}</strong></span>
                <span>Updated: <strong>{smileSyncPreview.updated ?? 0}</strong></span>
                <span>Unchanged: <strong>{smileSyncPreview.unchanged ?? 0}</strong></span>
                <span>Deactivated: <strong>{smileSyncPreview.deactivated ?? 0}</strong></span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                      {['Code', 'Name EN', 'Name FR', 'Requires back', 'Active', 'Rank', 'Exists', 'Changed'].map((label) => (
                        <th key={label} style={{ padding: '0.45rem' }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(smileSyncPreview.documentTypes || []).map((row) => (
                      <tr key={`${row.countryCode || smileSyncPreview.countryCode}-${row.code}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.45rem', fontWeight: 700 }}>{row.code}</td>
                        <td style={{ padding: '0.45rem' }}>{row.displayNameEn || '-'}</td>
                        <td style={{ padding: '0.45rem' }}>{row.displayNameFr || '-'}</td>
                        <td style={{ padding: '0.45rem' }}>{row.requiresBack ? 'Yes' : 'No'}</td>
                        <td style={{ padding: '0.45rem' }}>{row.active ? 'Yes' : 'No'}</td>
                        <td style={{ padding: '0.45rem' }}>{row.rank ?? '-'}</td>
                        <td style={{ padding: '0.45rem' }}>{row.exists ? 'Yes' : 'No'}</td>
                        <td style={{ padding: '0.45rem' }}>{row.changed ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </details>

      <details className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <summary style={{ cursor: 'pointer', listStyle: 'none', fontWeight: 800 }}>Filters</summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Country</span>
            <CountrySelect
              value={filters.countryCode}
              onChange={(value) => setFilters((prev) => ({ ...prev, countryCode: value }))}
              emptyLabel="All countries"
            />
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
      </details>

      {loading ? (
        <TypeCardSkeletonGrid />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          emptyLabel="No KYC document types found."
          showAccountQuickNav={false}
        />
      )}

      {showForm && (
        <Modal title={selected?.id ? `Edit document type ${selected.id}` : 'Add KYC document type'} onClose={() => (!saving ? setShowForm(false) : null)}>
          {error ? <div style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div> : null}
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
          <CountrySelect
            value={draft.countryCode}
            onChange={(value) => updateDraft('countryCode', value)}
            disabled={saving}
            emptyLabel="Global fallback"
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Code</span>
          <input value={draft.code} onChange={(e) => updateDraft('code', e.target.value.toUpperCase())} placeholder="VOTER_ID" disabled={saving} />
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
