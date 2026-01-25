'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  level: '',
  levelDescription: '',
  maxLoanAmount: '',
  maxCollectionAmount: '',
  maxPayoutAmount: ''
};

const emptyFilters = {
  level: '',
  minLoan: '',
  maxLoan: '',
  minCollection: '',
  maxCollection: '',
  minPayout: '',
  maxPayout: ''
};

const toPayload = (state) => ({
  level: state.level === '' ? null : Number(state.level),
  levelDescription: state.levelDescription || null,
  maxLoanAmount: state.maxLoanAmount === '' ? null : Number(state.maxLoanAmount),
  maxCollectionAmount: state.maxCollectionAmount === '' ? null : Number(state.maxCollectionAmount),
  maxPayoutAmount: state.maxPayoutAmount === '' ? null : Number(state.maxPayoutAmount)
});

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          ×
        </button>
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

const FilterChip = ({ label, onClear }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      padding: '0.35rem 0.6rem',
      background: 'var(--muted-bg, #f3f4f6)',
      borderRadius: '999px',
      fontSize: '13px',
      color: 'var(--text)'
    }}
  >
    {label}
    <button
      type="button"
      onClick={onClear}
      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}
      aria-label={`Clear ${label}`}
    >
      ×
    </button>
  </span>
);

export default function KycCapsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        const num = Number(value);
        if (!Number.isNaN(num)) params.set(key, String(num));
      });
      const res = await api.kycCaps.list(params);
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
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilterChips = useMemo(() => {
    const chips = [];
    const add = (label, key) => chips.push({ label, key });
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      switch (key) {
        case 'level':
          add(`Level: ${value}`, key);
          break;
        case 'minCap':
          add(`Min cap: ${value}`, key);
          break;
        case 'maxCap':
          add(`Max cap: ${value}`, key);
          break;
        case 'minLoan':
          add(`Min loan: ${value}`, key);
          break;
        case 'maxLoan':
          add(`Max loan: ${value}`, key);
          break;
        case 'minCollection':
          add(`Min collection: ${value}`, key);
          break;
        case 'maxCollection':
          add(`Max collection: ${value}`, key);
          break;
        case 'minPayout':
          add(`Min payout: ${value}`, key);
          break;
        case 'maxPayout':
          add(`Max payout: ${value}`, key);
          break;
        default:
          break;
      }
    });
    return chips;
  }, [appliedFilters]);

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      {
        key: 'level',
        label: 'Level',
        render: (row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div>{row.level}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{row.levelDescription || '—'}</div>
          </div>
        )
      },
      { key: 'maxLoanAmount', label: 'Max loan' },
      { key: 'maxCollectionAmount', label: 'Max collection' },
      { key: 'maxPayoutAmount', label: 'Max payout' },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral">
              View
            </button>
            <button type="button" onClick={() => openEdit(row)} className="btn-neutral">
              Edit
            </button>
            <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger">
              Delete
            </button>
          </div>
        )
      }
    ],
    []
  );

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      level: row.level ?? '',
      levelDescription: row.levelDescription ?? '',
      maxLoanAmount: row.maxLoanAmount ?? '',
      maxCollectionAmount: row.maxCollectionAmount ?? '',
      maxPayoutAmount: row.maxPayoutAmount ?? ''
    });
    setShowEdit(true);
    setInfo(null);
    setError(null);
  };

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
  };

  const validateDraft = (state) => {
    if (state.level === '' || Number(state.level) < 0) return 'Level is required and must be non-negative.';
    const numFields = ['maxLoanAmount', 'maxCollectionAmount', 'maxPayoutAmount'];
    const invalid = numFields.find((key) => state[key] !== '' && Number(state[key]) < 0);
    if (invalid) return 'Amounts cannot be negative.';
    return null;
  };

  const handleCreate = async () => {
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.kycCaps.create(toPayload(draft));
      setInfo('Created KYC cap.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.kycCaps.update(selected.id, toPayload(draft));
      setInfo(`Updated KYC cap ${selected.id}.`);
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
      await api.kycCaps.remove(id);
      setInfo(`Deleted KYC cap ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="level">Level</label>
        <input id="level" type="number" min={0} max={5} value={draft.level} onChange={(e) => setDraft((p) => ({ ...p, level: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="levelDescription">Level description</label>
        <input id="levelDescription" value={draft.levelDescription} onChange={(e) => setDraft((p) => ({ ...p, levelDescription: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="maxLoanAmount">Max loan</label>
        <input id="maxLoanAmount" type="number" min={0} value={draft.maxLoanAmount} onChange={(e) => setDraft((p) => ({ ...p, maxLoanAmount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="maxCollectionAmount">Max collection</label>
        <input id="maxCollectionAmount" type="number" min={0} value={draft.maxCollectionAmount} onChange={(e) => setDraft((p) => ({ ...p, maxCollectionAmount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="maxPayoutAmount">Max payout</label>
        <input id="maxPayoutAmount" type="number" min={0} value={draft.maxPayoutAmount} onChange={(e) => setDraft((p) => ({ ...p, maxPayoutAmount: e.target.value }))} />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>KYC Caps</div>
          <div style={{ color: 'var(--muted)' }}>Manage per-level caps for loans, collections, and payouts.</div>
        </div>
        <Link href="/dashboard" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Dashboard
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
        <button type="button" onClick={openCreate} className="btn-success">
          Add cap
        </button>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Filters</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
            <button type="button" onClick={fetchRows} disabled={loading} className="btn-neutral btn-sm">
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
        {showFilters && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterLevel">Level</label>
                <input id="filterLevel" type="number" min={0} max={5} value={filters.level} onChange={(e) => setFilters((p) => ({ ...p, level: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="minCap">Min cap</label>
                <input id="minCap" type="number" min={0} value={filters.minCap} onChange={(e) => setFilters((p) => ({ ...p, minCap: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="maxCap">Max cap</label>
                <input id="maxCap" type="number" min={0} value={filters.maxCap} onChange={(e) => setFilters((p) => ({ ...p, maxCap: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="minLoan">Min loan</label>
                <input id="minLoan" type="number" min={0} value={filters.minLoan} onChange={(e) => setFilters((p) => ({ ...p, minLoan: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="maxLoan">Max loan</label>
                <input id="maxLoan" type="number" min={0} value={filters.maxLoan} onChange={(e) => setFilters((p) => ({ ...p, maxLoan: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="minCollection">Min collection</label>
                <input id="minCollection" type="number" min={0} value={filters.minCollection} onChange={(e) => setFilters((p) => ({ ...p, minCollection: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="maxCollection">Max collection</label>
                <input id="maxCollection" type="number" min={0} value={filters.maxCollection} onChange={(e) => setFilters((p) => ({ ...p, maxCollection: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="minPayout">Min payout</label>
                <input id="minPayout" type="number" min={0} value={filters.minPayout} onChange={(e) => setFilters((p) => ({ ...p, minPayout: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="maxPayout">Max payout</label>
                <input id="maxPayout" type="number" min={0} value={filters.maxPayout} onChange={(e) => setFilters((p) => ({ ...p, maxPayout: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setPage(0);
                  setAppliedFilters(filters);
                }}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Applying…' : 'Apply filters'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters(emptyFilters);
                  setAppliedFilters(emptyFilters);
                  setPage(0);
                }}
                disabled={loading}
                className="btn-neutral"
              >
                Reset
              </button>
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Only applied filters are sent to the API.</span>
            </div>
          </>
        )}

        {activeFilterChips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {activeFilterChips.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                onClear={() => {
                  const next = { ...appliedFilters, [chip.key]: '' };
                  setAppliedFilters(next);
                  setFilters((p) => ({ ...p, [chip.key]: '' }));
                }}
              />
            ))}
          </div>
        )}
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

      <DataTable columns={columns} rows={rows} emptyLabel="No KYC caps found" />

      {showCreate && (
        <Modal title="Add KYC cap" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleCreate} className="btn-success">
              Create
            </button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit cap level ${selected?.level}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleUpdate} className="btn-primary">
              Save
            </button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Cap level ${selected?.level}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Level', value: selected?.level },
              { label: 'Description', value: selected?.levelDescription },
              { label: 'Max loan', value: selected?.maxLoanAmount },
              { label: 'Max collection', value: selected?.maxCollectionAmount },
              { label: 'Max payout', value: selected?.maxPayoutAmount },
              { label: 'Created', value: selected?.createdAt },
              { label: 'Updated', value: selected?.updatedAt }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete KYC cap <strong>{confirmDelete.level ?? confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleDelete} className="btn-danger">
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
