'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  paymentMethodPaymentProviderId: '',
  action: '',
  providerFeePercentage: '',
  providerFlatFee: '',
  ourFeePercentage: '',
  ourFlatFee: ''
};

const toPayload = (state) => ({
  paymentMethodPaymentProviderId: state.paymentMethodPaymentProviderId === '' ? null : Number(state.paymentMethodPaymentProviderId),
  action: state.action,
  providerFeePercentage: state.providerFeePercentage === '' ? null : Number(state.providerFeePercentage),
  providerFlatFee: state.providerFlatFee === '' ? null : Number(state.providerFlatFee),
  ourFeePercentage: state.ourFeePercentage === '' ? null : Number(state.ourFeePercentage),
  ourFlatFee: state.ourFlatFee === '' ? null : Number(state.ourFlatFee)
});

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button
          type="button"
          onClick={onClose}
          style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}
        >
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
      <div
        key={row.label}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}
      >
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

export default function FeeConfigsPage() {
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
      const res = await api.feeConfigs.list(params);
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

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'paymentMethodPaymentProviderId', label: 'Method/Provider ID' },
      { key: 'action', label: 'Action' },
      { key: 'providerFeePercentage', label: 'Provider %' },
      { key: 'providerFlatFee', label: 'Provider flat' },
      { key: 'ourFeePercentage', label: 'Our %' },
      { key: 'ourFlatFee', label: 'Our flat' },
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
      paymentMethodPaymentProviderId: row.paymentMethodPaymentProviderId ?? '',
      action: row.action ?? '',
      providerFeePercentage: row.providerFeePercentage ?? '',
      providerFlatFee: row.providerFlatFee ?? '',
      ourFeePercentage: row.ourFeePercentage ?? '',
      ourFlatFee: row.ourFlatFee ?? ''
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
      await api.feeConfigs.create(toPayload(draft));
      setInfo('Created fee config.');
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
      await api.feeConfigs.update(selected.id, toPayload(draft));
      setInfo(`Updated fee config ${selected.id}.`);
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
      await api.feeConfigs.remove(id);
      setInfo(`Deleted fee config ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="paymentMethodPaymentProviderId">Method/Provider ID</label>
        <input
          id="paymentMethodPaymentProviderId"
          type="number"
          value={draft.paymentMethodPaymentProviderId}
          onChange={(e) => setDraft((p) => ({ ...p, paymentMethodPaymentProviderId: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="action">Action</label>
        <input id="action" value={draft.action} onChange={(e) => setDraft((p) => ({ ...p, action: e.target.value }))} placeholder="FUND_WALLET / PAY_REQUEST ..." />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerFeePercentage">Provider %</label>
        <input
          id="providerFeePercentage"
          type="number"
          value={draft.providerFeePercentage}
          onChange={(e) => setDraft((p) => ({ ...p, providerFeePercentage: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerFlatFee">Provider flat</label>
        <input id="providerFlatFee" type="number" value={draft.providerFlatFee} onChange={(e) => setDraft((p) => ({ ...p, providerFlatFee: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="ourFeePercentage">Our %</label>
        <input id="ourFeePercentage" type="number" value={draft.ourFeePercentage} onChange={(e) => setDraft((p) => ({ ...p, ourFeePercentage: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="ourFlatFee">Our flat</label>
        <input id="ourFlatFee" type="number" value={draft.ourFlatFee} onChange={(e) => setDraft((p) => ({ ...p, ourFlatFee: e.target.value }))} />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Fee Configs</div>
          <div style={{ color: 'var(--muted)' }}>Configure fees per action and method/provider mapping.</div>
        </div>
        <Link href="/dashboard/payments" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Payments hub
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
          Add fee config
        </button>
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

      <DataTable columns={columns} rows={rows} emptyLabel="No fee configs found" />

      {showCreate && (
        <Modal title="Add fee config" onClose={() => setShowCreate(false)}>
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
        <Modal title={`Edit fee config ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Method/Provider ID', value: selected?.paymentMethodPaymentProviderId },
              { label: 'Action', value: selected?.action },
              { label: 'Provider %', value: selected?.providerFeePercentage },
              { label: 'Provider flat', value: selected?.providerFlatFee },
              { label: 'Our %', value: selected?.ourFeePercentage },
              { label: 'Our flat', value: selected?.ourFlatFee },
              { label: 'Created', value: selected?.createdAt },
              { label: 'Updated', value: selected?.updatedAt }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete fee config <strong>{confirmDelete.id}</strong>? This cannot be undone.
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
