'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const orderStatusOptions = ['MANUAL_INTERVENTION_REQUIRED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED'];

const emptyFilters = {
  status: 'MANUAL_INTERVENTION_REQUIRED',
  currency: '',
  accountId: '',
  email: ''
};

const emptyCompleteDraft = {
  note: '',
  externalReference: '',
  providerReference: '',
  holderName: '',
  bankName: '',
  internationalAccountNumber: '',
  accountNumber: '',
  swiftBic: '',
  routingNumber: '',
  bankAddress: '',
  instructionsEn: '',
  instructionsFr: ''
};

const field = (row, keys, fallback = '—') => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return fallback;
};

const toList = (res) => (Array.isArray(res) ? res : res?.content || []);

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatBool = (value) => (value ? 'Yes' : 'No');

const formatAmount = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
};

const formatMoney = (amount, currency) => {
  if (amount === null || amount === undefined || amount === '') return '—';
  return `${formatAmount(amount)} ${String(currency || '').trim()}`.trim();
};

const compactPayload = (payload) => {
  const next = {};
  Object.entries(payload).forEach(([key, value]) => {
    const normalized = String(value ?? '').trim();
    if (normalized) next[key] = normalized;
  });
  return next;
};

const StatusBadge = ({ value }) => {
  const status = String(value || '—').toUpperCase();
  const tone =
    status === 'COMPLETED' || status === 'ACTIVE'
      ? { bg: '#ECFDF3', fg: '#15803D' }
      : status === 'MANUAL_INTERVENTION_REQUIRED'
        ? { bg: '#FEF3C7', fg: '#92400E' }
        : status === 'PROCESSING'
          ? { bg: '#EFF6FF', fg: '#1D4ED8' }
          : status === 'FAILED' || status === 'CANCELED'
            ? { bg: '#FEF2F2', fg: '#B91C1C' }
            : { bg: '#E5E7EB', fg: '#374151' };
  return (
    <span style={{ display: 'inline-flex', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: tone.bg, color: tone.fg }}>
      {status}
    </span>
  );
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          x
        </button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

export default function BankAccountOrdersPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [selected, setSelected] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeDraft, setCompleteDraft] = useState(emptyCompleteDraft);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelNote, setCancelNote] = useState('');

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) params.set(key, String(value).trim());
      });
      const res = await api.bankAccounts.listOrders(params);
      setRows(toList(res));
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message || 'Failed to load bank account orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (row) => {
    const transactionId = field(row, ['orderTransactionId', 'transactionId', 'id'], '');
    if (!transactionId) return;
    setActionLoading(true);
    setError(null);
    try {
      const detail = await api.bankAccounts.getOrder(transactionId);
      setSelected({ ...row, ...(detail || {}) });
    } catch (err) {
      setError(err.message || `Failed to load bank account order ${transactionId}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const openComplete = (row) => {
    setCompleteTarget(row);
    setCompleteDraft(emptyCompleteDraft);
    setError(null);
    setInfo(null);
  };

  const openCancel = (row) => {
    setCancelTarget(row);
    setCancelNote('');
    setError(null);
    setInfo(null);
  };

  const submitComplete = async () => {
    const transactionId = field(completeTarget, ['orderTransactionId', 'transactionId', 'id'], '');
    if (!transactionId) return;
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.bankAccounts.completeOrder(transactionId, compactPayload(completeDraft));
      setInfo(`Bank account order ${transactionId} completed.`);
      setCompleteTarget(null);
      setSelected(null);
      await fetchRows();
    } catch (err) {
      setError(err.message || `Failed to complete bank account order ${transactionId}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const submitCancel = async () => {
    const transactionId = field(cancelTarget, ['orderTransactionId', 'transactionId', 'id'], '');
    if (!transactionId) return;
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.bankAccounts.cancelOrder(transactionId, compactPayload({ note: cancelNote }));
      setInfo(`Bank account order ${transactionId} canceled.`);
      setCancelTarget(null);
      setSelected(null);
      await fetchRows();
    } catch (err) {
      setError(err.message || `Failed to cancel bank account order ${transactionId}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size : page + 1 < pageMeta.totalPages;

  const columns = useMemo(() => [
    { key: 'orderTransactionId', label: 'Transaction ID', render: (row) => field(row, ['orderTransactionId', 'transactionId', 'id']) },
    { key: 'orderTransactionStatus', label: 'Order status', render: (row) => <StatusBadge value={field(row, ['orderTransactionStatus', 'transactionStatus', 'status'])} /> },
    { key: 'account', label: 'Account', render: (row) => field(row, ['accountReference', 'accountId']) },
    { key: 'email', label: 'Email', render: (row) => field(row, ['email', 'accountEmail', 'userEmail']) },
    { key: 'currency', label: 'Currency', render: (row) => field(row, ['currency']) },
    { key: 'bankStatus', label: 'Bank account', render: (row) => <StatusBadge value={field(row, ['status', 'bankAccountStatus', 'eligibilityStatus'])} /> },
    { key: 'payment', label: 'Payment', render: (row) => formatMoney(field(row, ['paymentAmount'], ''), field(row, ['paymentCurrency', 'currency'], '')) },
    { key: 'createdAt', label: 'Created', hideOnMobile: true, render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={() => openDetail(row)} disabled={actionLoading}>View</button>
          <button type="button" className="btn-success" onClick={() => openComplete(row)} disabled={actionLoading}>Complete</button>
          <button type="button" className="btn-danger" onClick={() => openCancel(row)} disabled={actionLoading}>Cancel</button>
        </div>
      )
    }
  ], [actionLoading]);

  const detailRows = (row) => [
    { label: 'Order transaction ID', value: field(row, ['orderTransactionId', 'transactionId', 'id']) },
    { label: 'Order transaction status', value: <StatusBadge value={field(row, ['orderTransactionStatus', 'transactionStatus'])} /> },
    { label: 'Bank account ID', value: field(row, ['bankAccountId']) },
    { label: 'Fiat wallet ID', value: field(row, ['fiatWalletId']) },
    { label: 'Account ID', value: field(row, ['accountId']) },
    { label: 'Account reference', value: field(row, ['accountReference']) },
    { label: 'Email', value: field(row, ['email', 'accountEmail', 'userEmail']) },
    { label: 'Currency', value: field(row, ['currency']) },
    { label: 'Bank account status', value: <StatusBadge value={field(row, ['status', 'bankAccountStatus'])} /> },
    { label: 'Eligibility status', value: field(row, ['eligibilityStatus']) },
    { label: 'Provider', value: field(row, ['providerName']) },
    { label: 'Provider reference', value: field(row, ['providerReference']) },
    { label: 'Payment amount', value: formatMoney(field(row, ['paymentAmount'], ''), field(row, ['paymentCurrency'], '')) },
    { label: 'Fees', value: formatMoney(field(row, ['fees'], ''), field(row, ['paymentCurrency'], '')) },
    { label: 'User owned', value: formatBool(row?.userOwned) },
    { label: 'Default account', value: formatBool(row?.defaultAccount) },
    { label: 'Created', value: formatDateTime(row?.createdAt) },
    { label: 'Updated', value: formatDateTime(row?.updatedAt) }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Bank account orders</div>
          <div style={{ color: 'var(--muted)' }}>Review customer bank account orders and complete or cancel provider fulfillment.</div>
        </div>
        <button type="button" className="btn-neutral" onClick={fetchRows} disabled={loading || actionLoading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>Filters</div>
          <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
            {showFilters ? 'Hide filters' : 'Show filters'}
          </button>
        </div>
        {showFilters ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="status">Status</label>
                <select id="status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                  <option value="">All</option>
                  {orderStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="currency">Currency</label>
                <input id="currency" value={filters.currency} onChange={(e) => setFilters((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} placeholder="KES" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="accountId">Account ID</label>
                <input id="accountId" type="number" min={1} value={filters.accountId} onChange={(e) => setFilters((p) => ({ ...p, accountId: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="email">Email</label>
                <input id="email" type="email" value={filters.email} onChange={(e) => setFilters((p) => ({ ...p, email: e.target.value }))} placeholder="customer@example.com" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="page">Page</label>
                <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Math.max(0, Number(e.target.value) || 0))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="size">Size</label>
                <input id="size" type="number" min={1} max={200} value={size} onChange={(e) => { setSize(Math.max(1, Number(e.target.value) || 20)); setPage(0); }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn-neutral btn-sm" onClick={() => { setFilters(emptyFilters); setAppliedFilters(emptyFilters); setPage(0); }}>Reset</button>
              <button type="button" className="btn-primary btn-sm" onClick={() => { setAppliedFilters(filters); setPage(0); }}>Apply</button>
            </div>
          </>
        ) : null}
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        totalPages={pageMeta.totalPages}
        totalElements={pageMeta.totalElements}
        onPageChange={setPage}
        canPrev={canPrev}
        canNext={canNext}
        emptyLabel={loading ? 'Loading bank account orders...' : 'No bank account orders found'}
        showAccountQuickNav={false}
      />

      {selected && (
        <Modal title={`Bank account order ${field(selected, ['orderTransactionId', 'transactionId', 'id'])}`} onClose={() => setSelected(null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <DetailGrid rows={detailRows(selected)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn-success" onClick={() => openComplete(selected)} disabled={actionLoading}>Complete</button>
              <button type="button" className="btn-danger" onClick={() => openCancel(selected)} disabled={actionLoading}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {completeTarget && (
        <Modal title={`Complete bank account order ${field(completeTarget, ['orderTransactionId', 'transactionId', 'id'])}`} onClose={() => (!actionLoading ? setCompleteTarget(null) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {[
                ['note', 'Note'],
                ['externalReference', 'External reference'],
                ['providerReference', 'Provider reference'],
                ['holderName', 'Holder name'],
                ['bankName', 'Bank name'],
                ['internationalAccountNumber', 'International account number'],
                ['accountNumber', 'Account number'],
                ['swiftBic', 'SWIFT/BIC'],
                ['routingNumber', 'Routing number'],
                ['bankAddress', 'Bank address'],
                ['instructionsEn', 'Instructions EN'],
                ['instructionsFr', 'Instructions FR']
              ].map(([key, label]) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor={`complete-${key}`}>{label}</label>
                  <input id={`complete-${key}`} value={completeDraft[key]} onChange={(e) => setCompleteDraft((p) => ({ ...p, [key]: e.target.value }))} disabled={actionLoading} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn-neutral" onClick={() => setCompleteTarget(null)} disabled={actionLoading}>Cancel</button>
              <button type="button" className="btn-success" onClick={submitComplete} disabled={actionLoading}>{actionLoading ? 'Completing...' : 'Complete order'}</button>
            </div>
          </div>
        </Modal>
      )}

      {cancelTarget && (
        <Modal title={`Cancel bank account order ${field(cancelTarget, ['orderTransactionId', 'transactionId', 'id'])}`} onClose={() => (!actionLoading ? setCancelTarget(null) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="cancelNote">Note</label>
              <textarea id="cancelNote" rows={4} value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} disabled={actionLoading} placeholder="Provider rejected the request" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn-neutral" onClick={() => setCancelTarget(null)} disabled={actionLoading}>Close</button>
              <button type="button" className="btn-danger" onClick={submitCancel} disabled={actionLoading}>{actionLoading ? 'Canceling...' : 'Cancel order'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
