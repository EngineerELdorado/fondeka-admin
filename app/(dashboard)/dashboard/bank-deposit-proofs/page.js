'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const statusOptions = ['CREDITED', 'PENDING', 'REJECTED'];

const emptyState = {
  accountId: '',
  paymentMethodId: '',
  bankRef: '',
  amount: '',
  currency: '',
  bankName: '',
  note: '',
  creditTarget: 'WALLET',
  cryptoProductId: '',
  cryptoNetworkId: ''
};

const normalizeEnumKey = (value) => String(value || '').trim().replace(/\s+/g, '_').toUpperCase();

const toPayload = (state) => ({
  accountId: Number(state.accountId),
  paymentMethodId: Number(state.paymentMethodId),
  bankRef: state.bankRef.trim(),
  amount: Number(state.amount),
  currency: state.currency.trim(),
  ...(state.creditTarget ? { creditTarget: state.creditTarget } : {}),
  ...(state.creditTarget === 'CRYPTO' && state.cryptoProductId ? { cryptoProductId: Number(state.cryptoProductId) } : {}),
  ...(state.creditTarget === 'CRYPTO' && state.cryptoNetworkId ? { cryptoNetworkId: Number(state.cryptoNetworkId) } : {}),
  ...(state.bankName.trim() ? { bankName: state.bankName.trim() } : {}),
  ...(state.note.trim() ? { note: state.note.trim() } : {})
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

export default function BankDepositProofsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');
  const [totalElements, setTotalElements] = useState(null);
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [warning, setWarning] = useState(null);
  const [duplicateTransactionId, setDuplicateTransactionId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [receiptFile, setReceiptFile] = useState(null);
  const [selected, setSelected] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [cryptoProducts, setCryptoProducts] = useState([]);
  const [cryptoNetworks, setCryptoNetworks] = useState([]);
  const [cryptoProductNetworks, setCryptoProductNetworks] = useState([]);
  const [cryptoLookupError, setCryptoLookupError] = useState(null);

  const bankMethods = useMemo(
    () => paymentMethods.filter((pm) => normalizeEnumKey(pm.type).includes('BANK')),
    [paymentMethods]
  );

  const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.bankDepositProofs.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setTotalElements(res?.totalElements ?? null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await api.paymentMethods.list(new URLSearchParams({ page: '0', size: '200' }));
      const list = Array.isArray(res) ? res : res?.content || [];
      setPaymentMethods(list || []);
    } catch (err) {
      setError(err.message || 'Failed to load payment methods');
    }
  };

  const fetchCryptoLookups = async () => {
    try {
      setCryptoLookupError(null);
      const params = new URLSearchParams({ page: '0', size: '200' });
      const [productsRes, networksRes, productNetworksRes] = await Promise.all([
        api.cryptoProducts.list(params),
        api.cryptoNetworks.list(params),
        api.cryptoProductCryptoNetworks.list(params)
      ]);
      const toList = (res) => (Array.isArray(res) ? res : res?.content || []);
      setCryptoProducts(toList(productsRes));
      setCryptoNetworks(toList(networksRes));
      setCryptoProductNetworks(toList(productNetworksRes));
    } catch (err) {
      setCryptoLookupError(err.message || 'Failed to load crypto lookups');
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchPaymentMethods();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchCryptoLookups();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    { key: 'accountId', label: 'Account' },
    { key: 'amount', label: 'Amount' },
    { key: 'currency', label: 'Currency' },
    { key: 'bankRef', label: 'Bank Ref' },
    { key: 'bankName', label: 'Bank Name' },
    { key: 'status', label: 'Status' },
    {
      key: 'createdAt',
      label: 'Created / Completed',
      render: (row) => `${formatDateTime(row.createdAt)}${row.creditedAt ? ` • ${formatDateTime(row.creditedAt)}` : ''}`
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
          {row.transactionId && (
            <Link
              href={`/dashboard/transactions?transactionId=${row.transactionId}`}
              className="btn-neutral"
            >
              Transaction
            </Link>
          )}
        </div>
      )
    }
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setDraft(emptyState);
    setReceiptFile(null);
    setShowCreate(true);
    setInfo(null);
    setError(null);
    setWarning(null);
    setDuplicateTransactionId(null);
  };

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
    setWarning(null);
    setDuplicateTransactionId(null);
  };

  const getReceiptReference = (res) => {
    return res?.receiptReference || res?.receiptRef || res?.receipt?.reference || res?.receipt?.id || null;
  };

  const getTransactionId = (res) => {
    return res?.transactionId || res?.transaction?.transactionId || res?.transaction?.id || null;
  };

  const getErrorCode = (err) => err?.data?.code || err?.data?.errorCode || err?.data?.name || '';

  const findExistingProofByBankRef = async (bankRef) => {
    if (!bankRef) return null;
    const match = rows.find((row) => row.bankRef === bankRef);
    if (match) return match;
    try {
      const res = await api.bankDepositProofs.list(new URLSearchParams({ page: '0', size: '100' }));
      const list = Array.isArray(res) ? res : res?.content || [];
      return list.find((row) => row.bankRef === bankRef) || null;
    } catch {
      return null;
    }
  };

  const handleDuplicate = async (err, bankRef) => {
    const code = getErrorCode(err);
    if (code !== 'BANK_DEPOSIT_PROOF_DUPLICATE') return false;
    const proofId = err?.data?.id || err?.data?.proofId || err?.data?.bankDepositProofId || err?.data?.bankProofId;
    const transactionId = err?.data?.transactionId || null;
    setDuplicateTransactionId(transactionId);
    setWarning(`Duplicate bank ref ${bankRef}. Open the existing proof/transaction instead of retrying.`);
    let match = null;
    if (proofId) {
      match = rows.find((row) => String(row.id) === String(proofId)) || null;
    }
    if (!match) {
      match = await findExistingProofByBankRef(bankRef);
    }
    if (match) {
      setSelected(match);
      setShowDetail(true);
    }
    return true;
  };

  const validateDraft = () => {
    if (!draft.accountId) return 'Account ID is required.';
    if (!draft.paymentMethodId) return 'Payment method ID is required.';
    if (!draft.bankRef.trim()) return 'Bank ref is required.';
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be greater than zero.';
    if (!draft.currency.trim()) return 'Currency is required.';
    if (draft.creditTarget === 'CRYPTO') {
      if (!draft.cryptoProductId) return 'Crypto product is required.';
      if (!draft.cryptoNetworkId) return 'Crypto network is required.';
      const currency = draft.currency.trim().toUpperCase();
      if (currency !== 'USD') return 'Crypto credit requires USD currency.';
      const pairActive = cryptoProductNetworks.some(
        (item) => String(item?.cryptoProductId ?? item?.productId ?? '') === String(draft.cryptoProductId)
          && String(item?.cryptoNetworkId ?? item?.networkId ?? '') === String(draft.cryptoNetworkId)
          && (item?.active === undefined || item?.active === null || item?.active === true)
      );
      if (!pairActive) return 'Selected crypto product/network is not active.';
    }
    return null;
  };

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    setWarning(null);
    setDuplicateTransactionId(null);

    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }

    setCreateLoading(true);
    try {
      const payload = toPayload(draft);
      const res = receiptFile
        ? await api.bankDepositProofs.createMultipart({ data: payload, file: receiptFile })
        : await api.bankDepositProofs.create(payload);
      const transactionId = getTransactionId(res);
      const receiptRef = getReceiptReference(res);
      const details = [
        transactionId ? `Transaction ID: ${transactionId}` : null,
        receiptRef ? `Receipt ref: ${receiptRef}` : null
      ].filter(Boolean);
      setInfo(`Bank deposit proof created.${details.length ? ` ${details.join(' • ')}` : ''}`);
      setShowCreate(false);
      setDraft(emptyState);
      fetchRows();
      if (res) {
        setSelected(res);
        setShowDetail(true);
      }
    } catch (err) {
      const handled = await handleDuplicate(err, draft.bankRef.trim());
      if (!handled) {
        const code = getErrorCode(err);
        setError(code ? `${code}: ${err.message}` : err.message);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="accountId">Account ID</label>
        <input id="accountId" type="number" value={draft.accountId} onChange={(e) => setDraft((p) => ({ ...p, accountId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="paymentMethodId">Payment method</label>
        <select id="paymentMethodId" value={draft.paymentMethodId} onChange={(e) => setDraft((p) => ({ ...p, paymentMethodId: e.target.value }))}>
          <option value="">Select BANK method</option>
          {bankMethods.map((pm) => (
            <option key={pm.id} value={pm.id}>
              {pm.name || pm.displayName || pm.bankName || pm.id}
            </option>
          ))}
        </select>
        {bankMethods.length === 0 && (
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
            No bank payment methods available.
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="bankRef">Bank ref</label>
        <input id="bankRef" value={draft.bankRef} onChange={(e) => setDraft((p) => ({ ...p, bankRef: e.target.value }))} placeholder="TRX-2026-01-27-ABC123" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="amount">Amount</label>
        <input id="amount" type="number" step="0.01" value={draft.amount} onChange={(e) => setDraft((p) => ({ ...p, amount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="currency">Currency</label>
        <input
          id="currency"
          value={draft.currency}
          onChange={(e) => setDraft((p) => ({ ...p, currency: e.target.value }))}
          placeholder="USD"
        />
        {draft.creditTarget === 'CRYPTO' && (
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Crypto credit requires USD.
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="bankName">Bank name</label>
        <input id="bankName" value={draft.bankName} onChange={(e) => setDraft((p) => ({ ...p, bankName: e.target.value }))} placeholder="Equity DRC" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="receiptFile">Receipt file (optional)</label>
        <input
          id="receiptFile"
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
        />
        <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Upload runs in the background; proof still credits even if upload fails.
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="note">Note from sender</label>
        <input id="note" value={draft.note} onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))} placeholder="Confirmed by bank statement" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="creditTarget">Credit target</label>
        <select
          id="creditTarget"
          value={draft.creditTarget}
          onChange={(e) => {
            const next = e.target.value;
            setDraft((p) => ({
              ...p,
              creditTarget: next,
              ...(next === 'CRYPTO' && !p.currency ? { currency: 'USD' } : {})
            }));
          }}
        >
          <option value="WALLET">Wallet</option>
          <option value="CRYPTO">Crypto</option>
        </select>
      </div>
      {draft.creditTarget === 'CRYPTO' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="cryptoProductId">Crypto product</label>
            <select
              id="cryptoProductId"
              value={draft.cryptoProductId}
              onChange={(e) => {
                const nextProductId = e.target.value;
                const eligibleNetworks = cryptoNetworks.filter((network) => {
                  if (!nextProductId) return true;
                  return cryptoProductNetworks.some(
                    (item) => String(item?.cryptoProductId ?? item?.productId ?? '') === String(nextProductId)
                      && String(item?.cryptoNetworkId ?? item?.networkId ?? '') === String(network?.id ?? '')
                      && (item?.active === undefined || item?.active === null || item?.active === true)
                  );
                });
                setDraft((p) => ({
                  ...p,
                  cryptoProductId: nextProductId,
                  cryptoNetworkId: eligibleNetworks.length === 1 && eligibleNetworks[0]?.id ? String(eligibleNetworks[0].id) : ''
                }));
              }}
            >
              <option value="">Select product</option>
              {cryptoProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.displayName || product.name || product.code || product.symbol || product.id}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="cryptoNetworkId">Crypto network</label>
            <select id="cryptoNetworkId" value={draft.cryptoNetworkId} onChange={(e) => setDraft((p) => ({ ...p, cryptoNetworkId: e.target.value }))}>
              <option value="">Select network</option>
              {cryptoNetworks
                .filter((network) => {
                  if (!draft.cryptoProductId) return true;
                  return cryptoProductNetworks.some(
                    (item) => String(item?.cryptoProductId ?? item?.productId ?? '') === String(draft.cryptoProductId)
                      && String(item?.cryptoNetworkId ?? item?.networkId ?? '') === String(network?.id ?? '')
                      && (item?.active === undefined || item?.active === null || item?.active === true)
                  );
                })
                .map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.displayName || network.name || network.code || network.symbol || network.id}
                  </option>
                ))}
            </select>
            {draft.cryptoProductId && cryptoProductNetworks.length > 0 && cryptoNetworks.filter((network) => {
              return cryptoProductNetworks.some(
                (item) => String(item?.cryptoProductId ?? item?.productId ?? '') === String(draft.cryptoProductId)
                  && String(item?.cryptoNetworkId ?? item?.networkId ?? '') === String(network?.id ?? '')
                  && (item?.active === undefined || item?.active === null || item?.active === true)
              );
            }).length === 0 && (
              <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
                No active networks for this product.
              </span>
            )}
          </div>
          {cryptoLookupError && (
            <div style={{ gridColumn: '1 / -1', color: '#b91c1c', fontWeight: 600 }}>
              {cryptoLookupError}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Bank Deposit Proofs</div>
          <div style={{ color: 'var(--muted)' }}>Create and audit bank deposit proofs that credit wallets immediately.</div>
        </div>
        <Link href="/dashboard/transactions" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Transactions
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="status">Status</label>
          <select id="status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
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
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button type="button" onClick={openCreate} className="btn-success">
          Create proof
        </button>
        {totalElements !== null && <span style={{ color: 'var(--muted)' }}>Total: {totalElements}</span>}
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {warning && (
        <div className="card" style={{ color: '#92400e', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <span>{warning}</span>
          {duplicateTransactionId && (
            <Link href={`/dashboard/transactions?transactionId=${duplicateTransactionId}`} className="btn-neutral">
              Open transaction
            </Link>
          )}
        </div>
      )}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No bank deposit proofs found" />

      {showCreate && (
        <Modal title="Create bank deposit proof" onClose={() => (!createLoading ? setShowCreate(false) : null)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral" disabled={createLoading}>
              Cancel
            </button>
            <button type="button" onClick={handleCreate} className="btn-success" disabled={createLoading}>
              {createLoading ? 'Creating…' : 'Create & credit'}
            </button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Bank deposit proof ${selected?.id || ''}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'Proof ID', value: selected?.id },
              { label: 'Account ID', value: selected?.accountId },
              { label: 'Transaction ID', value: selected?.transactionId || '—' },
              { label: 'Bank ref', value: selected?.bankRef },
              { label: 'Amount', value: `${selected?.amount ?? '—'} ${selected?.currency || ''}`.trim() },
              { label: 'Bank name', value: selected?.bankName || '—' },
              {
                label: 'Proof link',
                value: selected?.proofUrl ? (
                  <a href={selected.proofUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                    Open proof
                  </a>
                ) : selected?.status ? (
                  'Pending upload'
                ) : (
                  '—'
                )
              },
              { label: 'Status', value: selected?.status },
              { label: 'Created', value: formatDateTime(selected?.createdAt) },
              { label: 'Credited', value: formatDateTime(selected?.creditedAt) },
              { label: 'Credited by', value: selected?.creditedByAdminId || '—' },
              { label: 'Credit target', value: selected?.creditTarget || 'WALLET' },
              { label: 'Crypto product', value: selected?.cryptoProductName || selected?.cryptoProductCode || selected?.cryptoProductId || '—' },
              { label: 'Crypto network', value: selected?.cryptoNetworkName || selected?.cryptoNetworkCode || selected?.cryptoNetworkId || '—' }
            ]}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            {selected?.transactionId && (
              <Link href={`/dashboard/transactions?transactionId=${selected.transactionId}`} className="btn-neutral">
                View transaction
              </Link>
            )}
            <button type="button" onClick={() => setShowDetail(false)} className="btn-primary">Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
