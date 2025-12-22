'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  cardProductId: '',
  cardProviderId: '',
  currency: '',
  purchaseCost: '',
  price: '',
  monthlyMaintenanceCost: '',
  transactionFeePercentage: '',
  rank: '',
  maxDailyLimit: '',
  minFirstTopup: '',
  minTransactionFeeAmount: '',
  validityLength: '',
  validityType: '',
  active: true
};

const toPayload = (state) => ({
  cardProductId: Number(state.cardProductId) || 0,
  cardProviderId: Number(state.cardProviderId) || 0,
  currency: state.currency,
  purchaseCost: state.purchaseCost === '' ? null : Number(state.purchaseCost),
  price: state.price === '' ? null : Number(state.price),
  monthlyMaintenanceCost: state.monthlyMaintenanceCost === '' ? null : Number(state.monthlyMaintenanceCost),
  transactionFeePercentage: state.transactionFeePercentage === '' ? null : Number(state.transactionFeePercentage),
  rank: state.rank === '' ? null : Number(state.rank),
  maxDailyLimit: state.maxDailyLimit === '' ? null : Number(state.maxDailyLimit),
  minFirstTopup: state.minFirstTopup === '' ? null : Number(state.minFirstTopup),
  minTransactionFeeAmount: state.minTransactionFeeAmount === '' ? null : Number(state.minTransactionFeeAmount),
  validityLength: state.validityLength === '' ? null : Number(state.validityLength),
  validityType: state.validityType || null,
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

export default function CardProductProvidersPage() {
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
  const [cardProducts, setCardProducts] = useState([]);
  const [cardProviders, setCardProviders] = useState([]);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.cardProductCardProviders.list(params);
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
    const loadOptions = async () => {
      try {
        const [productsRes, providersRes] = await Promise.all([
          api.cardProducts.list(new URLSearchParams({ page: '0', size: '200' })),
          api.cardProviders.list(new URLSearchParams({ page: '0', size: '200' }))
        ]);
        const toList = (res) => (Array.isArray(res) ? res : res?.content || []);
        setCardProducts(toList(productsRes));
        setCardProviders(toList(providersRes));
      } catch {
        // ignore option fetch errors
      }
    };
    loadOptions();
  }, []);

  const fmtAmount = (row, key) => {
    const val = row[key];
    if (val === null || val === undefined || val === '') return '—';
    return `${val}${row.currency ? ` ${row.currency}` : ''}`;
  };

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'cardBrandName', label: 'Product' },
      { key: 'cardProviderName', label: 'Provider' },
      {
        key: 'price',
        label: 'Price',
        render: (row) => fmtAmount(row, 'price')
      },
      {
        key: 'purchaseCost',
        label: 'Cost',
        render: (row) => fmtAmount(row, 'purchaseCost')
      },
      {
        key: 'maxDailyLimit',
        label: 'Max daily limit',
        render: (row) => fmtAmount(row, 'maxDailyLimit')
      },
      {
        key: 'minFirstTopup',
        label: 'Min first top-up',
        render: (row) => fmtAmount(row, 'minFirstTopup')
      },
      {
        key: 'minTransactionFeeAmount',
        label: 'Min txn fee',
        render: (row) => fmtAmount(row, 'minTransactionFeeAmount')
      },
      {
        key: 'transactionFeePercentage',
        label: 'Txn fee %',
        render: (row) =>
          row.transactionFeePercentage === null || row.transactionFeePercentage === undefined ? '—' : row.transactionFeePercentage
      },
      {
        key: 'rank',
        label: 'Rank',
        render: (row) => (row.rank === null || row.rank === undefined ? '—' : row.rank)
      },
      {
        key: 'duration',
        label: 'Duration',
        render: (row) =>
          row.validityLength && row.validityType ? `${row.validityLength} ${row.validityType}` : '—'
      },
      {
        key: 'active',
        label: 'Active',
        render: (row) => (row.active === null || row.active === undefined ? '—' : String(row.active))
      },
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
      cardProductId: row.cardProductId ?? '',
      cardProviderId: row.cardProviderId ?? '',
      currency: row.currency ?? '',
      purchaseCost: row.purchaseCost ?? '',
      price: row.price ?? '',
      monthlyMaintenanceCost: row.monthlyMaintenanceCost ?? '',
      transactionFeePercentage: row.transactionFeePercentage ?? '',
      rank: row.rank ?? '',
      maxDailyLimit: row.maxDailyLimit ?? '',
      minFirstTopup: row.minFirstTopup ?? '',
      minTransactionFeeAmount: row.minTransactionFeeAmount ?? '',
      validityLength: row.validityLength ?? '',
      validityType: row.validityType ?? '',
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
      await api.cardProductCardProviders.create(toPayload(draft));
      setInfo('Created product/provider mapping.');
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
      await api.cardProductCardProviders.update(selected.id, toPayload(draft));
      setInfo(`Updated mapping ${selected.id}.`);
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
      await api.cardProductCardProviders.remove(id);
      setInfo(`Deleted mapping ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="cardProductId">Card product</label>
        <select id="cardProductId" value={draft.cardProductId} onChange={(e) => setDraft((p) => ({ ...p, cardProductId: e.target.value }))}>
          <option value="">Select product</option>
          {cardProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.cardBrandName || `Product ${p.id}`}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="cardProviderId">Card provider</label>
        <select id="cardProviderId" value={draft.cardProviderId} onChange={(e) => setDraft((p) => ({ ...p, cardProviderId: e.target.value }))}>
          <option value="">Select provider</option>
          {cardProviders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.cardProviderName || p.name || `Provider ${p.id}`}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="currency">Currency</label>
        <input id="currency" value={draft.currency} onChange={(e) => setDraft((p) => ({ ...p, currency: e.target.value }))} placeholder="e.g. USD" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="price">Price</label>
        <input id="price" type="number" value={draft.price} onChange={(e) => setDraft((p) => ({ ...p, price: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="purchaseCost">Purchase cost</label>
        <input id="purchaseCost" type="number" value={draft.purchaseCost} onChange={(e) => setDraft((p) => ({ ...p, purchaseCost: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="monthlyMaintenanceCost">Monthly maintenance</label>
        <input
          id="monthlyMaintenanceCost"
          type="number"
          value={draft.monthlyMaintenanceCost}
          onChange={(e) => setDraft((p) => ({ ...p, monthlyMaintenanceCost: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="transactionFeePercentage">Transaction fee %</label>
        <input
          id="transactionFeePercentage"
          type="number"
          value={draft.transactionFeePercentage}
          onChange={(e) => setDraft((p) => ({ ...p, transactionFeePercentage: e.target.value }))}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="validityLength">Validity length</label>
          <input
            id="validityLength"
            type="number"
            value={draft.validityLength}
            onChange={(e) => setDraft((p) => ({ ...p, validityLength: e.target.value }))}
            placeholder="12"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="validityType">Validity type</label>
          <select
            id="validityType"
            value={draft.validityType}
            onChange={(e) => setDraft((p) => ({ ...p, validityType: e.target.value }))}
          >
            <option value="">Select</option>
            {['DAYS', 'MONTHS', 'YEARS'].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rank">Rank</label>
        <input id="rank" type="number" value={draft.rank} onChange={(e) => setDraft((p) => ({ ...p, rank: e.target.value }))} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="maxDailyLimit">Max daily limit</label>
          <input
            id="maxDailyLimit"
            type="number"
            value={draft.maxDailyLimit}
            onChange={(e) => setDraft((p) => ({ ...p, maxDailyLimit: e.target.value }))}
            placeholder="500.00"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="minFirstTopup">Min first top-up</label>
          <input
            id="minFirstTopup"
            type="number"
            value={draft.minFirstTopup}
            onChange={(e) => setDraft((p) => ({ ...p, minFirstTopup: e.target.value }))}
            placeholder="50.00"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="minTransactionFeeAmount">Min txn fee</label>
          <input
            id="minTransactionFeeAmount"
            type="number"
            value={draft.minTransactionFeeAmount}
            onChange={(e) => setDraft((p) => ({ ...p, minTransactionFeeAmount: e.target.value }))}
            placeholder="0.50"
          />
        </div>
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
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Product ↔ Provider</div>
          <div style={{ color: 'var(--muted)' }}>Map card products to providers with pricing and fees.</div>
        </div>
        <Link href="/dashboard/cards" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Cards hub
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
          Add mapping
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No mappings found" />

      {showCreate && (
        <Modal title="Add product/provider mapping" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit mapping ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'Card product ID', value: selected?.cardProductId },
              { label: 'Card product', value: selected?.cardBrandName },
              { label: 'Card provider ID', value: selected?.cardProviderId },
              { label: 'Card provider', value: selected?.cardProviderName },
              { label: 'Currency', value: selected?.currency || '—' },
              { label: 'Price', value: selected?.price ?? '—' },
              { label: 'Purchase cost', value: selected?.purchaseCost ?? '—' },
              { label: 'Monthly maintenance', value: selected?.monthlyMaintenanceCost ?? '—' },
              { label: 'Max daily limit', value: selected?.maxDailyLimit ?? '—' },
              { label: 'Min first top-up', value: selected?.minFirstTopup ?? '—' },
              { label: 'Min txn fee', value: selected?.minTransactionFeeAmount ?? '—' },
              { label: 'Transaction fee %', value: selected?.transactionFeePercentage ?? '—' },
              { label: 'Validity length', value: selected?.validityLength ?? '—' },
              { label: 'Validity type', value: selected?.validityType ?? '—' },
              { label: 'Rank', value: selected?.rank ?? '—' },
              { label: 'Active', value: selected?.active === undefined || selected?.active === null ? '—' : String(selected?.active) }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete mapping <strong>{confirmDelete.cardBrandName || confirmDelete.id}</strong>? This cannot be undone.
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
