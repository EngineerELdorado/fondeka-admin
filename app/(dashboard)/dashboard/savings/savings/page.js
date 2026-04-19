'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  name: '',
  description: '',
  internalReference: '',
  startsAt: '',
  endsAt: '',
  accountId: '',
  savingProductId: '',
  balance: '',
  status: ''
};

const SAVING_PRODUCT_CODE_OPEN = 'OPEN_SAVING';
const SAVING_PRODUCT_CODE_LOCKED = 'LOCKED_SAVING';

const toInputDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toIsoString = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const formatProductLabel = (product) => {
  if (!product) return '—';
  const name = product.title || product.name || product.code || `Product ${product.id}`;
  const code = product.code ? ` (${product.code})` : '';
  return `${name}${code}`;
};

const getMinimumLockDurationDays = (product) =>
  Number(product?.minimumLockDurationDays ?? product?.minimum_lock_duration_days ?? 0);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
        {row.hint ? <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.hint}</div> : null}
      </div>
    ))}
  </div>
);

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

export default function SavingsPage() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const selectedProduct = useMemo(
    () => products.find((product) => String(product?.id) === String(draft.savingProductId)),
    [products, draft.savingProductId]
  );

  const isLockedSavingDraft = String(selectedProduct?.code || '').toUpperCase() === SAVING_PRODUCT_CODE_LOCKED;
  const minimumLockDurationDays = getMinimumLockDurationDays(selectedProduct);

  const toPayload = (state) => {
    const payload = {
      name: state.name.trim() || null,
      description: state.description.trim() || null,
      internalReference: state.internalReference.trim() || null,
      startsAt: toIsoString(state.startsAt),
      endsAt: isLockedSavingDraft ? toIsoString(state.endsAt) : null,
      accountId: Number(state.accountId) || 0,
      savingProductId: Number(state.savingProductId) || 0,
      balance: state.balance === '' ? null : Number(state.balance),
      status: state.status || null
    };
    return payload;
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.savings.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '0');
      params.set('size', '100');
      const res = await api.savingProducts.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setProducts(list || []);
    } catch (err) {
      setError((prev) => prev || err.message || 'Failed to load saving products.');
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchProducts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLockedSavingDraft && draft.endsAt !== '') {
      setDraft((prev) => ({ ...prev, endsAt: '' }));
    }
  }, [isLockedSavingDraft, draft.endsAt]);

  const validateDraft = () => {
    const startsAt = new Date(draft.startsAt);
    if (!draft.startsAt || Number.isNaN(startsAt.getTime())) {
      return 'Start date is required.';
    }

    if (!draft.savingProductId) {
      return 'Saving product is required.';
    }

    if (isLockedSavingDraft) {
      const endsAt = new Date(draft.endsAt);
      if (!draft.endsAt || Number.isNaN(endsAt.getTime())) {
        return 'Locked savings require an end date.';
      }
      if (endsAt <= new Date()) {
        return 'Locked savings require a future maturity date.';
      }
      const durationMs = endsAt.getTime() - startsAt.getTime();
      const durationDays = durationMs / (1000 * 60 * 60 * 24);
      if (durationDays < minimumLockDurationDays) {
        return `Locked savings must respect the product minimum lock duration of ${minimumLockDurationDays} day${minimumLockDurationDays === 1 ? '' : 's'}.`;
      }
    }

    return null;
  };

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    {
      key: 'name',
      label: 'Saving',
      render: (row) => (
        <div style={{ display: 'grid', gap: '0.15rem' }}>
          <div style={{ fontWeight: 700 }}>{row?.name || row?.internalReference || `Saving ${row?.id}`}</div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{row?.internalReference || '—'}</div>
        </div>
      )
    },
    { key: 'accountId', label: 'Account ID' },
    {
      key: 'savingProductId',
      label: 'Product',
      render: (row) => {
        const product = products.find((item) => String(item?.id) === String(row?.savingProductId));
        return formatProductLabel(product || { id: row?.savingProductId, code: row?.savingProductCode, title: row?.savingProductTitle });
      }
    },
    { key: 'startsAt', label: 'Start Date', render: (row) => formatDateTime(row?.startsAt) },
    { key: 'endsAt', label: 'End Date', render: (row) => formatDateTime(row?.endsAt) },
    { key: 'balance', label: 'Balance' },
    { key: 'status', label: 'Status' },
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
  ], [products]);

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = async (row) => {
    setInfo(null);
    setError(null);
    try {
      const full = row?.id ? await api.savings.get(row.id) : row;
      setSelected(full || row);
      setDraft({
        name: full?.name ?? '',
        description: full?.description ?? '',
        internalReference: full?.internalReference ?? '',
        startsAt: toInputDateTime(full?.startsAt),
        endsAt: toInputDateTime(full?.endsAt),
        accountId: full?.accountId ?? '',
        savingProductId: full?.savingProductId ?? '',
        balance: full?.balance ?? '',
        status: full?.status ?? ''
      });
      setShowEdit(true);
    } catch (err) {
      setError(err.message || 'Failed to load saving.');
    }
  };

  const openDetail = async (row) => {
    setInfo(null);
    setError(null);
    try {
      const full = row?.id ? await api.savings.get(row.id) : row;
      setSelected(full || row);
      setShowDetail(true);
    } catch (err) {
      setError(err.message || 'Failed to load saving.');
    }
  };

  const handleCreate = async () => {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.savings.create(toPayload(draft));
      setInfo('Created saving.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.savings.update(selected.id, toPayload(draft));
      setInfo(`Updated saving ${selected.id}.`);
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
      await api.savings.remove(id);
      setInfo(`Deleted saving ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
        Changing the savings product changes the saving mode. Switching to <strong>LOCKED_SAVING</strong> requires a future end date that respects the product minimum lock duration. Locked savings accrue daily interest, but that interest is payable only at maturity. Early withdrawal is full-break only in v1 and forfeits accrued interest. Switching to <strong>OPEN_SAVING</strong> clears the end date.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="name">Name</label>
          <input id="name" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="internalReference">Internal reference</label>
          <input id="internalReference" value={draft.internalReference} onChange={(e) => setDraft((p) => ({ ...p, internalReference: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="accountId">Account ID</label>
          <input id="accountId" type="number" value={draft.accountId} onChange={(e) => setDraft((p) => ({ ...p, accountId: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="savingProductId">Saving product</label>
          <select id="savingProductId" value={draft.savingProductId} onChange={(e) => setDraft((p) => ({ ...p, savingProductId: e.target.value }))} disabled={productsLoading}>
            <option value="">Select product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {formatProductLabel(product)}
              </option>
            ))}
          </select>
          {selectedProduct ? (
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              {String(selectedProduct?.code).toUpperCase() === SAVING_PRODUCT_CODE_LOCKED
                ? `Minimum lock duration: ${minimumLockDurationDays} day${minimumLockDurationDays === 1 ? '' : 's'}. Early breaks pay principal only.`
                : 'Open savings do not keep an end date and are normally non-interest-bearing.'}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="startsAt">Start date</label>
          <input id="startsAt" type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft((p) => ({ ...p, startsAt: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="endsAt">End date</label>
          <input
            id="endsAt"
            type="datetime-local"
            value={draft.endsAt}
            onChange={(e) => setDraft((p) => ({ ...p, endsAt: e.target.value }))}
            disabled={!isLockedSavingDraft}
          />
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            {isLockedSavingDraft
              ? 'Required for locked savings. Early withdrawal before maturity is full-break only.'
              : 'Disabled for open savings. It will be cleared on update.'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="balance">Balance</label>
          <input id="balance" type="number" value={draft.balance} onChange={(e) => setDraft((p) => ({ ...p, balance: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="status">Status</label>
          <input id="status" value={draft.status} onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: '1 / -1' }}>
          <label htmlFor="description">Description</label>
          <textarea id="description" rows={4} value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} />
        </div>
      </div>
    </div>
  );

  const selectedProductForDetail = products.find((product) => String(product?.id) === String(selected?.savingProductId));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 800, fontSize: '20px' }}>Savings</div>
          <div style={{ color: 'var(--muted)' }}>Manage individual savings accounts, including safe mode switches between flexible open savings and maturity-based locked savings.</div>
        </div>
        <Link href="/dashboard/savings" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Savings hub
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
        <button type="button" onClick={openCreate} className="btn-success" disabled={productsLoading}>
          Add saving
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No savings found" />

      {showCreate && (
        <Modal title="Add saving" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit saving ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'Name', value: selected?.name || '—' },
              { label: 'Description', value: selected?.description || '—' },
              { label: 'Internal Reference', value: selected?.internalReference || '—' },
              { label: 'Account ID', value: selected?.accountId },
              { label: 'Saving Product', value: formatProductLabel(selectedProductForDetail || { id: selected?.savingProductId, code: selected?.savingProductCode, title: selected?.savingProductTitle }) },
              { label: 'Start Date', value: formatDateTime(selected?.startsAt) },
              {
                label: 'End Date',
                value: formatDateTime(selected?.endsAt),
                hint: String(selectedProductForDetail?.code || selected?.savingProductCode || '').toUpperCase() === SAVING_PRODUCT_CODE_LOCKED
                  ? 'Locked savings require a future maturity date. Early break pays principal only and forfeits accrued interest.'
                  : 'Open savings should not retain an end date.'
              },
              { label: 'Balance', value: selected?.balance },
              { label: 'Status', value: selected?.status }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete saving <strong>{confirmDelete.id}</strong>? This cannot be undone.
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
