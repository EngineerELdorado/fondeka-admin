'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  name: '',
  code: '',
  displayName: '',
  type: '',
  logoUrl: '',
  rank: '',
  countryIds: [],
  active: true
};

const typeOptions = ['TELEVISION', 'ELECTRICITY', 'INTERNET', 'WATER', 'STREAMING', 'AIRTIME', 'OTHERS'];
const nameOptions = ['CANAL_PLUS', 'CANAL_BOX', 'STARLINK', 'LIQUID', 'SOCODEE', 'VIRUNGA', 'SNEL', 'DSTV', 'STARTIMES', 'REGIDESO', 'NETFLIX', 'AIRTIME'];
const codeOptions = [
  'CANAL_PLUS_RWANDA',
  'CANAL_PLUS_DRC',
  'CANAL_PLUS_BURUNDI',
  'CANAL_BOX',
  'STARLINK',
  'SOCODEE',
  'VIRUNGA',
  'SNEL',
  'LIQUID',
  'DSTV',
  'STARTIMES',
  'REGIDESO',
  'NETFLIX',
  'AIRTIME'
];

const toPayload = (state) => ({
  name: state.name,
  code: state.code,
  displayName: state.displayName,
  type: state.type,
  logoUrl: state.logoUrl || null,
  countryIds: Array.isArray(state.countryIds) ? state.countryIds.map((id) => Number(id)).filter((n) => !Number.isNaN(n)) : [],
  rank: state.rank === '' ? null : Number(state.rank),
  active: Boolean(state.active)
});

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

export default function BillProductsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countriesError, setCountriesError] = useState(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.billProducts.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadCountries = async () => {
      setCountriesError(null);
      setCountriesLoading(true);
      try {
        const res = await api.countries.list(new URLSearchParams({ page: '0', size: '200' }));
        const list = Array.isArray(res) ? res : res?.content || [];
        setCountries(list || []);
      } catch (err) {
        setCountries([]);
        setCountriesError(err.message || 'Failed to load countries');
      }
      setCountriesLoading(false);
    };
    loadCountries();
  }, []);

  const columns = useMemo(() => [
    { key: 'displayName', label: 'Display' },
    { key: 'type', label: 'Type' },
    {
      key: 'country',
      label: 'Countries',
      render: (row) => {
        const names = row.countryNames || row.countryName || [];
        const codes = row.countryCodes || row.countryCode || [];
        const ids = row.countryIds || row.countryId || [];
        const list = Array.isArray(names) && names.length > 0
          ? names
          : Array.isArray(codes) && codes.length > 0
            ? codes
            : Array.isArray(ids) && ids.length > 0
              ? ids
              : [];
        if (list.length === 0) return 'Global';
        return list.join(', ');
      }
    },
    { key: 'rank', label: 'Rank' },
    { key: 'active', label: 'Active' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral">Edit</button>
          <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger">Delete</button>
        </div>
      )
    }
  ], []);

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      name: row.name ?? '',
      code: row.code ?? '',
      displayName: row.displayName ?? '',
      type: row.type ?? '',
      logoUrl: row.logoUrl ?? '',
      countryIds: row.countryIds || [],
      rank: row.rank ?? '',
      active: Boolean(row.active)
    });
    setShowEdit(true);
    setInfo(null);
    setError(null);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setDraft(emptyState);
    setCountrySearch('');
    setShowCountryPicker(false);
  };

  const closeEdit = () => {
    setShowEdit(false);
    setDraft(emptyState);
    setSelected(null);
    setCountrySearch('');
    setShowCountryPicker(false);
  };

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.billProducts.create(toPayload(draft));
      setInfo('Created bill product.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.billProducts.update(selected.id, toPayload(draft));
      setInfo(`Updated bill product ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    const id = confirmDelete.id;
    setError(null);
    setInfo(null);
    try {
      await api.billProducts.remove(id);
      setInfo(`Deleted bill product ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="name">Name</label>
        <select id="name" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}>
          <option value="">Select name</option>
          {nameOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="code">Code</label>
        <select id="code" value={draft.code} onChange={(e) => setDraft((p) => ({ ...p, code: e.target.value }))}>
          <option value="">Select code</option>
          {codeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="displayName">Display name</label>
        <input id="displayName" value={draft.displayName} onChange={(e) => setDraft((p) => ({ ...p, displayName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="type">Type</label>
        <select id="type" value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}>
          <option value="">Select type</option>
          {typeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', position: 'relative' }}>
        <label htmlFor="countryIds">Countries (optional)</label>
        <button
          type="button"
          id="countryIds"
          className="btn-neutral"
          style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}
          onClick={() => {
            if (!showCountryPicker && countries.length === 0 && !countriesLoading) {
              // retry fetch if nothing loaded yet
              setCountriesError(null);
              (async () => {
                setCountriesLoading(true);
                try {
                  const res = await api.countries.list(new URLSearchParams({ page: '0', size: '200' }));
                  const list = Array.isArray(res) ? res : res?.content || [];
                  setCountries(list || []);
                } catch (err) {
                  setCountries([]);
                  setCountriesError(err.message || 'Failed to load countries');
                }
                setCountriesLoading(false);
              })();
            }
            setShowCountryPicker((v) => !v);
          }}
        >
          {draft.countryIds.length === 0
            ? 'Global (no countries selected)'
            : `${draft.countryIds.length} selected`}
          <span style={{ marginLeft: '0.5rem' }}>{showCountryPicker ? '▲' : '▼'}</span>
        </button>
        {showCountryPicker && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 10,
              background: 'var(--surface)',
              border: `1px solid var(--border)`,
              borderRadius: '10px',
              padding: '0.5rem',
              marginTop: '0.25rem',
          boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
          minWidth: '240px',
          maxHeight: '220px',
          overflowY: 'auto',
          display: 'grid',
          gap: '0.35rem'
        }}
      >
        <input
          type="text"
          placeholder="Search country"
          value={countrySearch}
          onChange={(e) => setCountrySearch(e.target.value)}
          style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: '8px' }}
        />
        {countriesLoading && <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Loading countries…</div>}
        {countriesError && <div style={{ color: '#b91c1c', fontSize: '13px' }}>{countriesError}</div>}
        {!countriesLoading && !countriesError && countries.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>No countries found.</div>
        )}
        {countries
          .filter((c) => {
            const term = countrySearch.trim().toLowerCase();
            if (!term) return true;
            return (
              c.name?.toLowerCase().includes(term) ||
              c.alpha2Code?.toLowerCase().includes(term) ||
              String(c.id).includes(term)
            );
          })
          .map((c) => {
          const checked = draft.countryIds.includes(String(c.id)) || draft.countryIds.includes(Number(c.id));
          return (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', justifyContent: 'space-between' }}>
              <span>
                {c.name} {c.alpha2Code ? `(${c.alpha2Code})` : ''}
              </span>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  const value = String(c.id);
                  setDraft((p) => {
                    const set = new Set(p.countryIds.map(String));
                    if (e.target.checked) set.add(value);
                    else set.delete(value);
                    return { ...p, countryIds: Array.from(set) };
                  });
                }}
              />
            </label>
          );
        })}
      </div>
    )}
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Leave empty for a global product.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="logoUrl">Logo URL (optional)</label>
        <input id="logoUrl" value={draft.logoUrl} onChange={(e) => setDraft((p) => ({ ...p, logoUrl: e.target.value }))} placeholder="https://..." />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rank">Rank</label>
        <input id="rank" type="number" value={draft.rank} onChange={(e) => setDraft((p) => ({ ...p, rank: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="active" type="checkbox" checked={draft.active} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
        <label htmlFor="active">Active</label>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Bill Products</div>
          <div style={{ color: 'var(--muted)' }}>Manage billable products (code/name/rank).</div>
        </div>
        <Link href="/dashboard/bills" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Bills hub
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="size">Size</label>
          <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
        <button
          type="button"
          onClick={fetchRows}
          disabled={loading}
          style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--accent)', color: '#fff' }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button
          type="button"
          onClick={openCreate}
          style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#22c55e', color: '#fff' }}
        >
          Add product
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No bill products found" />

      {showCreate && (
        <Modal title="Add bill product" onClose={closeCreate}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={closeCreate} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              Cancel
            </button>
            <button type="button" onClick={handleCreate} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#22c55e', color: '#fff' }}>
              Create
            </button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit bill product ${selected?.id}`} onClose={closeEdit}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={closeEdit} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              Cancel
            </button>
            <button type="button" onClick={handleUpdate} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#f97316', color: '#fff' }}>
              Save
            </button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Code', value: selected?.code },
              { label: 'Name', value: selected?.name },
              { label: 'Display', value: selected?.displayName },
              { label: 'Type', value: selected?.type },
              {
                label: 'Countries',
                value:
                  (selected?.countryNames && selected.countryNames.join(', ')) ||
                  (selected?.countryCodes && selected.countryCodes.join(', ')) ||
                  (selected?.countryIds && selected.countryIds.join(', ')) ||
                  'Global'
              },
              { label: 'Rank', value: selected?.rank },
              { label: 'Active', value: selected?.active ? 'Yes' : 'No' },
              { label: 'Created', value: selected?.createdAt },
              { label: 'Updated', value: selected?.updatedAt }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete bill product <strong>{confirmDelete.displayName || confirmDelete.name || confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              Cancel
            </button>
            <button type="button" onClick={handleDelete} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#b91c1c', color: '#fff' }}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
