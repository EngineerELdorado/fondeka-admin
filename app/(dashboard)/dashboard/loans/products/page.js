'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  title: '',
  shortDescription: '',
  icon: '',
  iconColor: '',
  interestType: '',
  repaymentPlan: '',
  maxDuration: '',
  durationType: '',
  interestPercentage: '',
  minAmount: '',
  maxAmount: '',
  taxPercentage: '',
  serviceFeePercentage: '',
  finePercentage: '',
  otherFees: '',
  rank: '',
  loanType: '',
  code: '',
  active: true
};

const toPayload = (state) => ({
  title: state.title,
  shortDescription: state.shortDescription,
  icon: state.icon,
  iconColor: state.iconColor,
  interestType: state.interestType,
  repaymentPlan: state.repaymentPlan,
  maxDuration: state.maxDuration === '' ? null : Number(state.maxDuration),
  durationType: state.durationType,
  interestPercentage: state.interestPercentage === '' ? null : Number(state.interestPercentage),
  minAmount: state.minAmount === '' ? null : Number(state.minAmount),
  maxAmount: state.maxAmount === '' ? null : Number(state.maxAmount),
  taxPercentage: state.taxPercentage === '' ? null : Number(state.taxPercentage),
  serviceFeePercentage: state.serviceFeePercentage === '' ? null : Number(state.serviceFeePercentage),
  finePercentage: state.finePercentage === '' ? null : Number(state.finePercentage),
  otherFees: state.otherFees === '' ? null : Number(state.otherFees),
  rank: state.rank === '' ? null : Number(state.rank),
  loanType: state.loanType,
  code: state.code,
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

export default function LoanProductsPage() {
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
      const res = await api.loanProducts.list(params);
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
    { key: 'title', label: 'Title' },
    {
      key: 'duration',
      label: 'Duration',
      render: (row) => {
        const amount = row.maxDuration;
        const unit = row.durationType || '';
        if (amount === null || amount === undefined || amount === '') return unit || '—';
        return `${amount} ${unit}`.trim();
      }
    },
    { key: 'interestPercentage', label: 'Interest %' },
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
      title: row.title ?? '',
      shortDescription: row.shortDescription ?? '',
      icon: row.icon ?? '',
      iconColor: row.iconColor ?? '',
      interestType: row.interestType ?? '',
      repaymentPlan: row.repaymentPlan ?? '',
      maxDuration: row.maxDuration ?? '',
      durationType: row.durationType ?? '',
      interestPercentage: row.interestPercentage ?? '',
      minAmount: row.minAmount ?? '',
      maxAmount: row.maxAmount ?? '',
      taxPercentage: row.taxPercentage ?? '',
      serviceFeePercentage: row.serviceFeePercentage ?? '',
      finePercentage: row.finePercentage ?? '',
      otherFees: row.otherFees ?? '',
      rank: row.rank ?? '',
      loanType: row.loanType ?? '',
      code: row.code ?? '',
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

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.loanProducts.create(toPayload(draft));
      setInfo('Created loan product.');
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
      await api.loanProducts.update(selected.id, toPayload(draft));
      setInfo(`Updated loan product ${selected.id}.`);
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
      await api.loanProducts.remove(id);
      setInfo(`Deleted loan product ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="title">Title</label>
        <input id="title" value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="shortDescription">Short description</label>
        <input id="shortDescription" value={draft.shortDescription} onChange={(e) => setDraft((p) => ({ ...p, shortDescription: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="icon">Icon</label>
        <input id="icon" value={draft.icon} onChange={(e) => setDraft((p) => ({ ...p, icon: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="iconColor">Icon color</label>
        <input id="iconColor" value={draft.iconColor} onChange={(e) => setDraft((p) => ({ ...p, iconColor: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="interestType">Interest type</label>
        <input id="interestType" value={draft.interestType} onChange={(e) => setDraft((p) => ({ ...p, interestType: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="repaymentPlan">Repayment plan</label>
        <input id="repaymentPlan" value={draft.repaymentPlan} onChange={(e) => setDraft((p) => ({ ...p, repaymentPlan: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="maxDuration">Max duration</label>
        <input id="maxDuration" type="number" value={draft.maxDuration} onChange={(e) => setDraft((p) => ({ ...p, maxDuration: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="durationType">Duration type</label>
        <input id="durationType" value={draft.durationType} onChange={(e) => setDraft((p) => ({ ...p, durationType: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="interestPercentage">Interest %</label>
        <input id="interestPercentage" type="number" value={draft.interestPercentage} onChange={(e) => setDraft((p) => ({ ...p, interestPercentage: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="minAmount">Min amount</label>
        <input id="minAmount" type="number" value={draft.minAmount} onChange={(e) => setDraft((p) => ({ ...p, minAmount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="maxAmount">Max amount</label>
        <input id="maxAmount" type="number" value={draft.maxAmount} onChange={(e) => setDraft((p) => ({ ...p, maxAmount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="taxPercentage">Tax %</label>
        <input id="taxPercentage" type="number" value={draft.taxPercentage} onChange={(e) => setDraft((p) => ({ ...p, taxPercentage: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="serviceFeePercentage">Service fee %</label>
        <input id="serviceFeePercentage" type="number" value={draft.serviceFeePercentage} onChange={(e) => setDraft((p) => ({ ...p, serviceFeePercentage: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="finePercentage">Fine %</label>
        <input id="finePercentage" type="number" value={draft.finePercentage} onChange={(e) => setDraft((p) => ({ ...p, finePercentage: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="otherFees">Other fees</label>
        <input id="otherFees" type="number" value={draft.otherFees} onChange={(e) => setDraft((p) => ({ ...p, otherFees: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rank">Rank</label>
        <input id="rank" type="number" value={draft.rank} onChange={(e) => setDraft((p) => ({ ...p, rank: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="loanType">Loan type</label>
        <input id="loanType" value={draft.loanType} onChange={(e) => setDraft((p) => ({ ...p, loanType: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="code">Code</label>
        <input id="code" value={draft.code} onChange={(e) => setDraft((p) => ({ ...p, code: e.target.value }))} />
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
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Loan Products</div>
          <div style={{ color: 'var(--muted)' }}>Manage loan product catalog (codes, rates, durations).</div>
        </div>
        <Link href="/dashboard/loans" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Loans
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
          Add loan product
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No loan products found" />

      {showCreate && (
        <Modal title="Add loan product" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit loan product ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'Title', value: selected?.title },
              { label: 'Short description', value: selected?.shortDescription },
              { label: 'Code', value: selected?.code },
              { label: 'Loan type', value: selected?.loanType },
              { label: 'Interest %', value: selected?.interestPercentage },
              { label: 'Interest type', value: selected?.interestType },
              { label: 'Repayment plan', value: selected?.repaymentPlan },
              { label: 'Duration type', value: selected?.durationType },
              { label: 'Max duration', value: selected?.maxDuration },
              { label: 'Min amount', value: selected?.minAmount },
              { label: 'Max amount', value: selected?.maxAmount },
              { label: 'Tax %', value: selected?.taxPercentage },
              { label: 'Service fee %', value: selected?.serviceFeePercentage },
              { label: 'Fine %', value: selected?.finePercentage },
              { label: 'Other fees', value: selected?.otherFees },
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
            Delete loan product <strong>{confirmDelete.title || confirmDelete.code || confirmDelete.id}</strong>? This cannot be undone.
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
