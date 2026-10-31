'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { useAuth } from '@/contexts/AuthContext';

const emptyState = { firstName: '', lastName: '', email: '', phoneNumber: '', role: '' };
const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Full access' },
  { value: 'ADMIN', label: 'Admin', description: 'Standard read/write admin access' },
  { value: 'ASSISTANT', label: 'Assistant', description: 'Read-only access' },
  { value: 'STAFF', label: 'Staff', description: 'Stored role, limited by current backend rules' }
];

const formatRoleLabel = (value) => ROLE_OPTIONS.find((item) => item.value === value)?.label || value || '—';

const toPayload = (state) => ({
  firstName: state.firstName,
  lastName: state.lastName,
  email: state.email,
  phoneNumber: state.phoneNumber,
  role: state.role
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

export default function AdminsPage() {
  const { session, refreshAdminProfile } = useAuth();
  const access = session?.tokens?.accessToken?.payload || {};
  const id = session?.tokens?.idToken?.payload || {};
  const groups = [access['cognito:groups'], access.groups, id['cognito:groups'], id.groups].flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((value) => String(value).trim().toUpperCase());
  const canManageRegulatorMode = groups.includes('SUPER_ADMIN');
  const [modeTarget, setModeTarget] = useState(null);
  const [modeChoice, setModeChoice] = useState('inherit');
  const [modeSaving, setModeSaving] = useState(false);
  const [modeError, setModeError] = useState(null);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
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
      const res = await api.admins.list(params);
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
    { key: 'id', label: 'ID' },
    { key: 'firstName', label: 'First name' },
    { key: 'lastName', label: 'Last name' },
    { key: 'email', label: 'Email' },
    { key: 'phoneNumber', label: 'Phone' },
    { key: 'role', label: 'Role', render: (row) => formatRoleLabel(row.role) },
    { key: 'enableRegulatorMode', label: 'Regulator mode', render: (row) => typeof row.enableRegulatorMode === 'boolean' ? `${row.enableRegulatorMode ? 'Enabled' : 'Disabled'} (${row.regulatorModeOverride == null ? 'global' : 'override'})` : 'Unavailable' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral">Edit</button>
          {canManageRegulatorMode && <button type="button" onClick={() => openRegulatorMode(row)} disabled={typeof row.enableRegulatorMode !== 'boolean'} className="btn-neutral">Regulator mode</button>}
          <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger">Delete</button>
        </div>
      )
    }
  ], [canManageRegulatorMode]);

  const openRegulatorMode = (row) => {
    setModeTarget(row || { email: '' });
    setModeChoice(row?.regulatorModeOverride == null ? 'inherit' : row.regulatorModeOverride ? 'enabled' : 'disabled');
    setModeError(null);
  };

  const saveRegulatorMode = async () => {
    if (!canManageRegulatorMode || !modeTarget || modeSaving) return;
    setModeSaving(true);
    setModeError(null);
    try {
      let updated = null;
      if (modeTarget.id != null) {
        if (modeChoice === 'inherit') await api.admins.resetRegulatorMode(modeTarget.id);
        else updated = await api.admins.setRegulatorMode(modeTarget.id, modeChoice === 'enabled');
      } else {
        if (modeChoice === 'inherit') await api.admins.resetRegulatorModeByEmail(modeTarget.email);
        else updated = await api.admins.setRegulatorModeByEmail(modeTarget.email, modeChoice === 'enabled');
      }
      if (updated?.id != null && typeof updated.enableRegulatorMode === 'boolean') {
        setRows((previous) => previous.map((row) => String(row.id) === String(updated.id) ? updated : row));
        setSelected((previous) => String(previous?.id) === String(updated.id) ? updated : previous);
      } else {
        setRows((previous) => previous.map((row) => (modeTarget.id != null ? String(row.id) === String(modeTarget.id) : row.email?.trim().toLowerCase() === modeTarget.email.trim().toLowerCase()) ? { ...row, enableRegulatorMode: undefined } : row));
      }
      setModeTarget(null);
      setInfo('Admin Regulator mode saved.');
      await Promise.all([fetchRows(), refreshAdminProfile()]);
    } catch (err) {
      setModeError(err.message || 'Unable to save admin Regulator mode.');
    } finally {
      setModeSaving(false);
    }
  };

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      firstName: row.firstName ?? '',
      lastName: row.lastName ?? '',
      email: row.email ?? '',
      phoneNumber: row.phoneNumber ?? '',
      role: row.role ?? ''
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

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.admins.create(toPayload(draft));
      setInfo('Created admin.');
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
      await api.admins.update(selected.id, toPayload(draft));
      setInfo(`Updated admin ${selected.id}.`);
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
      await api.admins.remove(id);
      setInfo(`Deleted admin ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="firstName">First name</label>
        <input id="firstName" value={draft.firstName} onChange={(e) => setDraft((p) => ({ ...p, firstName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="lastName">Last name</label>
        <input id="lastName" value={draft.lastName} onChange={(e) => setDraft((p) => ({ ...p, lastName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={draft.email} onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="phoneNumber">Phone number</label>
        <input id="phoneNumber" value={draft.phoneNumber} onChange={(e) => setDraft((p) => ({ ...p, phoneNumber: e.target.value }))} placeholder="+243..." />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="role">Role</label>
        <select id="role" value={draft.role} onChange={(e) => setDraft((p) => ({ ...p, role: e.target.value }))}>
          <option value="">Select role</option>
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          {ROLE_OPTIONS.find((option) => option.value === draft.role)?.description || 'Choose the admin access level.'}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Admins</div>
          <div style={{ color: 'var(--muted)' }}>Manage admin users (name, email, role).</div>
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
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button type="button" onClick={openCreate} className="btn-success">
          Add admin
        </button>
        {canManageRegulatorMode && <button type="button" onClick={() => openRegulatorMode(null)} className="btn-neutral">Regulator mode by email</button>}
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No admins found" />

      {modeTarget && (
        <Modal title="Admin Regulator mode" onClose={() => { if (!modeSaving) setModeTarget(null); }}>
          {modeError && <div role="alert" className="alert alert-error">{modeError}</div>}
          {modeTarget.id != null ? <div>{modeTarget.email || `Admin ${modeTarget.id}`}</div> : (
            <label style={{ display: 'grid', gap: '0.35rem' }}>Admin email
              <input type="email" value={modeTarget.email} disabled={modeSaving} onChange={(event) => setModeTarget({ email: event.target.value })} />
            </label>
          )}
          <label style={{ display: 'grid', gap: '0.35rem' }}>Regulator mode for this admin
            <select aria-label="Regulator mode for this admin" value={modeChoice} onChange={(event) => setModeChoice(event.target.value)} disabled={modeSaving}>
              <option value="inherit">Follow global setting</option>
              <option value="enabled">Enable</option>
              <option value="disabled">Disable</option>
            </select>
          </label>
          <div style={{ color: 'var(--muted)' }}>Enable and Disable override the global setting for this admin. Follow global setting removes the override.</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setModeTarget(null)} disabled={modeSaving} className="btn-neutral">Cancel</button>
            <button type="button" onClick={saveRegulatorMode} disabled={modeSaving || (modeTarget.id == null ? !modeTarget.email.trim() : modeChoice === (modeTarget.regulatorModeOverride == null ? 'inherit' : modeTarget.regulatorModeOverride ? 'enabled' : 'disabled'))} className="btn-primary">{modeSaving ? 'Saving…' : 'Save Regulator mode'}</button>
          </div>
        </Modal>
      )}

      {showCreate && (
        <Modal title="Add admin" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit admin ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'First name', value: selected?.firstName },
              { label: 'Last name', value: selected?.lastName },
              { label: 'Email', value: selected?.email },
              { label: 'Phone', value: selected?.phoneNumber },
              { label: 'Role', value: formatRoleLabel(selected?.role) }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete admin <strong>{confirmDelete.email || confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </Modal>
      )}

    </div>
  );
}
