'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  profileKey: '',
  username: '',
  password: '',
  distributorNumber: '',
  codePays: '',
  active: true
};

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

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

export default function CegawebProfilesPage() {
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

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.cegawebProfiles.list(params);
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

  const columns = useMemo(() => [
    { key: 'profileKey', label: 'Profile key' },
    { key: 'username', label: 'Username' },
    { key: 'distributorNumber', label: 'Distributor #' },
    { key: 'codePays', label: 'Code pays' },
    { key: 'active', label: 'Active', render: (row) => (row.active ? 'Yes' : 'No') },
    { key: 'createdAt', label: 'Created' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral">Edit</button>
          <button type="button" onClick={() => toggleActive(row)} className="btn-neutral">{row.active ? 'Disable' : 'Enable'}</button>
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
      profileKey: row.profileKey ?? '',
      username: row.username ?? '',
      password: '',
      distributorNumber: row.distributorNumber ?? '',
      codePays: row.codePays ?? '',
      active: Boolean(row.active)
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

  const validateDraft = ({ isEdit }) => {
    if (!draft.profileKey.trim()) return 'Profile key is required.';
    if (!draft.username.trim()) return 'Username is required.';
    if (!isEdit && !draft.password.trim()) return 'Password is required for new profiles.';
    if (!draft.distributorNumber.toString().trim()) return 'Distributor number is required.';
    if (!draft.codePays.toString().trim()) return 'Code pays is required.';

    const existingKey = rows.find((row) => row.profileKey === draft.profileKey.trim());
    if (existingKey && (!isEdit || existingKey.id !== selected?.id)) {
      return 'Profile key must be unique.';
    }

    return null;
  };

  const buildPayload = ({ includePassword }) => {
    const payload = {
      profileKey: draft.profileKey.trim(),
      username: draft.username.trim(),
      distributorNumber: draft.distributorNumber,
      codePays: draft.codePays,
      active: Boolean(draft.active)
    };
    if (includePassword) {
      payload.password = draft.password;
    }
    return payload;
  };

  const handleCreate = async () => {
    const message = validateDraft({ isEdit: false });
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.cegawebProfiles.create(buildPayload({ includePassword: true }));
      setInfo('Created CegaWeb profile.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    const message = validateDraft({ isEdit: true });
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      const includePassword = Boolean(draft.password && draft.password.trim());
      await api.cegawebProfiles.update(selected.id, buildPayload({ includePassword }));
      setInfo(`Updated CegaWeb profile ${selected.id}.`);
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
      await api.cegawebProfiles.remove(id);
      setInfo(`Deleted CegaWeb profile ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (row) => {
    if (!row?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.cegawebProfiles.update(row.id, {
        profileKey: row.profileKey,
        username: row.username,
        distributorNumber: row.distributorNumber,
        codePays: row.codePays,
        active: !row.active
      });
      setInfo(`${row.active ? 'Disabled' : 'Enabled'} ${row.profileKey}.`);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = ({ isEdit }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="profileKey">Profile key</label>
        <input
          id="profileKey"
          value={draft.profileKey}
          onChange={(e) => setDraft((p) => ({ ...p, profileKey: e.target.value }))}
          placeholder="CGA_RW"
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={draft.username}
          onChange={(e) => setDraft((p) => ({ ...p, username: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="password">Password{isEdit ? ' (leave blank to keep)' : ''}</label>
        <input
          id="password"
          type="password"
          value={draft.password}
          onChange={(e) => setDraft((p) => ({ ...p, password: e.target.value }))}
          placeholder={isEdit ? '••••••' : ''}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="distributorNumber">Distributor number</label>
        <input
          id="distributorNumber"
          value={draft.distributorNumber}
          onChange={(e) => setDraft((p) => ({ ...p, distributorNumber: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="codePays">Code pays</label>
        <input
          id="codePays"
          value={draft.codePays}
          onChange={(e) => setDraft((p) => ({ ...p, codePays: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          id="active"
          type="checkbox"
          checked={draft.active}
          onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))}
        />
        <label htmlFor="active">Active</label>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>CegaWeb Profiles</div>
          <div style={{ color: 'var(--muted)' }}>Manage Canal+ credentials per country.</div>
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
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button type="button" onClick={openCreate} className="btn-success">
          Add profile
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No CegaWeb profiles found" />

      {showCreate && (
        <Modal title="Add CegaWeb profile" onClose={() => setShowCreate(false)}>
          {renderForm({ isEdit: false })}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              Cancel
            </button>
            <button type="button" onClick={handleCreate} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#22c55e', color: '#fff' }}>
              Create
            </button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit CegaWeb profile ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm({ isEdit: true })}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
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
              { label: 'Profile key', value: selected?.profileKey },
              { label: 'Username', value: selected?.username },
              { label: 'Distributor #', value: selected?.distributorNumber },
              { label: 'Code pays', value: selected?.codePays },
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
            Delete CegaWeb profile <strong>{confirmDelete.profileKey || confirmDelete.id}</strong>? This cannot be undone.
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
