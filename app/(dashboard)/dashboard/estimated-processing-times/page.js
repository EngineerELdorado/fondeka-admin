'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const actionOptions = [
  'FUND_WALLET',
  'WITHDRAW_FROM_WALLET',
  'REFUND_TO_WALLET',
  'BONUS',
  'PAY_INTERNET_BILL',
  'PAY_TV_SUBSCRIPTION',
  'PAY_ELECTRICITY_BILL',
  'PAY_WATER_BILL',
  'LOAN_REQUEST',
  'LOAN_DISBURSEMENT',
  'REPAY_LOAN',
  'FUND_CARD',
  'WITHDRAW_FROM_CARD',
  'BUY_CARD',
  'CARD_ONLINE_PAYMENT',
  'BUY_CRYPTO',
  'SELL_CRYPTO',
  'RECEIVE_CRYPTO',
  'SEND_CRYPTO',
  'SWAP_CRYPTO',
  'REQUEST_PAYMENT',
  'PAY_REQUEST',
  'E_SIM_PURCHASE',
  'E_SIM_TOPUP',
  'SEND_AIRTIME',
  'SEND_DATA_BUNDLES',
  'BUY_GIFT_CARD',
  'PAY_NETFLIX',
  'INTER_TRANSFER',
  'OTHER'
].sort();

const paymentMethodTypeOptions = ['MOBILE_MONEY', 'CRYPTO', 'BALANCE', 'CREDIT', 'AIRTIME'];
const paymentProviderNameOptions = [
  'FONDEKA',
  'AVADAPAY',
  'COINBASE',
  'STRIPE',
  'PAYPAL',
  'BTCPAY_SERVER',
  'CUSTOMIZED_BANK_PROVIDER',
  'RELOADLY',
  'UNIPAYMENT',
  'ARAKAPAY',
  'CGAWEB',
  'ARAKA_PAY',
  'UMEME',
  'BRIDGECARD',
  'SHEEKEEPER',
  'AIRALO',
  'E_SIM_GO',
  'ZEND_IT',
  'LIMIT_FLEX'
];
const cryptoNetworkNameOptions = ['BTC', 'ERC20', 'BEP20', 'TRC20', 'POLYGON', 'BSC', 'ARBITRUM', 'BASE', 'AVALANCHE', 'SOLANA'];

const initialFilters = {
  action: '',
  paymentMethodType: '',
  paymentProviderName: '',
  cryptoNetworkName: '',
  active: ''
};

const emptyState = {
  action: '',
  paymentMethodType: '',
  paymentProviderName: '',
  cryptoNetworkName: '',
  minSeconds: '',
  maxSeconds: '',
  active: true,
  rank: '',
  notesEn: '',
  notesFr: ''
};

const toPayload = (state) => ({
  action: state.action || null,
  paymentMethodType: state.paymentMethodType || null,
  paymentProviderName: state.paymentProviderName || null,
  cryptoNetworkName: state.cryptoNetworkName || null,
  minSeconds: state.minSeconds === '' ? null : Number(state.minSeconds),
  maxSeconds: state.maxSeconds === '' ? null : Number(state.maxSeconds),
  active: Boolean(state.active),
  rank: state.rank === '' ? 0 : Number(state.rank),
  notesEn: state.notesEn === '' ? null : state.notesEn,
  notesFr: state.notesFr === '' ? null : state.notesFr
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

export default function EstimatedProcessingTimesPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);

  const sortedPaymentMethodTypeOptions = useMemo(() => [...paymentMethodTypeOptions].sort(), []);
  const sortedPaymentProviderNameOptions = useMemo(() => [...paymentProviderNameOptions].sort(), []);
  const sortedCryptoNetworkNameOptions = useMemo(() => [...cryptoNetworkNameOptions].sort(), []);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    const add = (label, key) => chips.push({ label, key });
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      switch (key) {
        case 'action':
          add(`Action: ${value}`, key);
          break;
        case 'paymentMethodType':
          add(`Method type: ${value}`, key);
          break;
        case 'paymentProviderName':
          add(`Provider: ${value}`, key);
          break;
        case 'cryptoNetworkName':
          add(`Network: ${value}`, key);
          break;
        case 'active':
          add(`Active: ${value === 'true' ? 'Yes' : 'No'}`, key);
          break;
        default:
          break;
      }
    });
    return chips;
  }, [appliedFilters]);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        params.set(key, String(value));
      });
      const res = await api.estimatedProcessingTimes.list(params);
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

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'action', label: 'Action' },
    { key: 'paymentMethodType', label: 'Method type' },
    { key: 'paymentProviderName', label: 'Provider', hideOnMobile: true },
    { key: 'cryptoNetworkName', label: 'Network', hideOnMobile: true },
    { key: 'minSeconds', label: 'Min (s)' },
    { key: 'maxSeconds', label: 'Max (s)' },
    { key: 'rank', label: 'Rank', hideOnMobile: true },
    { key: 'active', label: 'Active', render: (row) => (row.active ? 'Yes' : 'No') },
    { key: 'notes', label: 'Notes', hideOnMobile: true, render: (row) => row.notes || '—' },
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
      action: row.action ?? '',
      paymentMethodType: row.paymentMethodType ?? '',
      paymentProviderName: row.paymentProviderName ?? '',
      cryptoNetworkName: row.cryptoNetworkName ?? '',
      minSeconds: row.minSeconds ?? '',
      maxSeconds: row.maxSeconds ?? '',
      active: Boolean(row.active),
      rank: row.rank ?? '',
      notesEn: row.notesEn ?? '',
      notesFr: row.notesFr ?? ''
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

  const validateDraft = () => {
    if (!draft.paymentProviderName) return 'Payment provider is required.';
    if (draft.minSeconds === '' || draft.maxSeconds === '') return 'Min and max seconds are required.';
    const minValue = Number(draft.minSeconds);
    const maxValue = Number(draft.maxSeconds);
    if (Number.isNaN(minValue) || Number.isNaN(maxValue)) return 'Min and max seconds must be numbers.';
    if (minValue < 0 || maxValue < 0) return 'Min and max seconds must be 0 or greater.';
    if (maxValue < minValue) return 'Max seconds must be greater than or equal to min seconds.';
    return null;
  };

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    const validation = validateDraft();
    if (validation) {
      setError(validation);
      return;
    }
    try {
      await api.estimatedProcessingTimes.create(toPayload(draft));
      setInfo('Created estimated processing time.');
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
    const validation = validateDraft();
    if (validation) {
      setError(validation);
      return;
    }
    try {
      await api.estimatedProcessingTimes.update(selected.id, toPayload(draft));
      setInfo('Updated estimated processing time.');
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.estimatedProcessingTimes.remove(confirmDelete.id);
      setInfo('Deleted estimated processing time.');
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
    setPage(0);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(0);
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="action">Action</label>
        <select id="action" value={draft.action} onChange={(e) => setDraft((prev) => ({ ...prev, action: e.target.value }))}>
          <option value="">Select action</option>
          {actionOptions.map((action) => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="paymentMethodType">Payment method type</label>
        <select
          id="paymentMethodType"
          value={draft.paymentMethodType}
          onChange={(e) => setDraft((prev) => ({ ...prev, paymentMethodType: e.target.value }))}
        >
          <option value="">Any</option>
          {sortedPaymentMethodTypeOptions.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="paymentProviderName">Payment provider</label>
        <select
          id="paymentProviderName"
          value={draft.paymentProviderName}
          onChange={(e) => setDraft((prev) => ({ ...prev, paymentProviderName: e.target.value }))}
        >
          <option value="">Any</option>
          {sortedPaymentProviderNameOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="cryptoNetworkName">Crypto network</label>
        <select
          id="cryptoNetworkName"
          value={draft.cryptoNetworkName}
          onChange={(e) => setDraft((prev) => ({ ...prev, cryptoNetworkName: e.target.value }))}
        >
          <option value="">Any</option>
          {sortedCryptoNetworkNameOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="minSeconds">Min seconds</label>
        <input
          id="minSeconds"
          type="number"
          min={0}
          value={draft.minSeconds}
          onChange={(e) => setDraft((prev) => ({ ...prev, minSeconds: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="maxSeconds">Max seconds</label>
        <input
          id="maxSeconds"
          type="number"
          min={0}
          value={draft.maxSeconds}
          onChange={(e) => setDraft((prev) => ({ ...prev, maxSeconds: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rank">Rank</label>
        <input
          id="rank"
          type="number"
          min={0}
          value={draft.rank}
          onChange={(e) => setDraft((prev) => ({ ...prev, rank: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="active">Active</label>
        <input
          id="active"
          type="checkbox"
          checked={draft.active}
          onChange={(e) => setDraft((prev) => ({ ...prev, active: e.target.checked }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: '1 / -1' }}>
        <label htmlFor="notesEn">Notes (English)</label>
        <textarea
          id="notesEn"
          rows={3}
          value={draft.notesEn}
          onChange={(e) => setDraft((prev) => ({ ...prev, notesEn: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: '1 / -1' }}>
        <label htmlFor="notesFr">Notes (French)</label>
        <textarea
          id="notesFr"
          rows={3}
          value={draft.notesFr}
          onChange={(e) => setDraft((prev) => ({ ...prev, notesFr: e.target.value }))}
        />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Estimated processing times</div>
          <div style={{ color: 'var(--muted)' }}>Configure estimated processing time windows for transactions.</div>
        </div>
        <Link href="/dashboard/transactions" className="btn-ghost btn-sm">
          ← Transactions
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="dashboard-filters-wide-grid">
          <div>
            <label htmlFor="filter-action">Action</label>
            <select
              id="filter-action"
              value={filters.action}
              onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
            >
              <option value="">All</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-method-type">Method type</label>
            <select
              id="filter-method-type"
              value={filters.paymentMethodType}
              onChange={(e) => setFilters((prev) => ({ ...prev, paymentMethodType: e.target.value }))}
            >
              <option value="">All</option>
          {sortedPaymentMethodTypeOptions.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
          <div>
            <label htmlFor="filter-provider">Provider</label>
            <select
              id="filter-provider"
              value={filters.paymentProviderName}
              onChange={(e) => setFilters((prev) => ({ ...prev, paymentProviderName: e.target.value }))}
            >
              <option value="">All</option>
          {sortedPaymentProviderNameOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
          <div>
            <label htmlFor="filter-network">Crypto network</label>
            <select
              id="filter-network"
              value={filters.cryptoNetworkName}
              onChange={(e) => setFilters((prev) => ({ ...prev, cryptoNetworkName: e.target.value }))}
            >
              <option value="">All</option>
          {sortedCryptoNetworkNameOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
          <div>
            <label htmlFor="filter-active">Active</label>
            <select
              id="filter-active"
              value={filters.active}
              onChange={(e) => setFilters((prev) => ({ ...prev, active: e.target.value }))}
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div>
            <label htmlFor="page">Page</label>
            <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
          </div>
          <div>
            <label htmlFor="size">Size</label>
            <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={applyFilters} className="btn-primary">Apply filters</button>
          <button type="button" onClick={clearFilters} className="btn-neutral">Clear</button>
          <button type="button" onClick={fetchRows} disabled={loading} className="btn-ghost">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button type="button" onClick={openCreate} className="btn-success">Add config</button>
        </div>
        {activeFilterChips.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {activeFilterChips.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                onClear={() => {
                  const next = { ...appliedFilters, [chip.key]: '' };
                  setFilters(next);
                  setAppliedFilters(next);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel={loading ? 'Loading…' : 'No configs found'} />

      {showCreate && (
        <Modal title="Add estimated processing time" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'Action', value: selected?.action },
              { label: 'Payment method type', value: selected?.paymentMethodType || 'Any' },
              { label: 'Payment provider', value: selected?.paymentProviderName || 'Any' },
              { label: 'Crypto network', value: selected?.cryptoNetworkName || 'Any' },
              { label: 'Min seconds', value: selected?.minSeconds },
              { label: 'Max seconds', value: selected?.maxSeconds },
              { label: 'Active', value: selected?.active ? 'Yes' : 'No' },
              { label: 'Rank', value: selected?.rank ?? '—' },
              { label: 'Notes (localized)', value: selected?.notes || '—' },
              { label: 'Notes (EN)', value: selected?.notesEn || '—' },
              { label: 'Notes (FR)', value: selected?.notesFr || '—' },
              { label: 'Created', value: selected?.createdAt },
              { label: 'Updated', value: selected?.updatedAt }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete processing time config <strong>{confirmDelete.id}</strong>? This cannot be undone.
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
