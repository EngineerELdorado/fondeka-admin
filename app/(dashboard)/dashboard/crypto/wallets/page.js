'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = { accountId: '', productNetworkId: '', balance: '' };

const toPayload = (state) => ({
  accountId: Number(state.accountId) || 0,
  productNetworkId: Number(state.productNetworkId) || 0,
  balance: state.balance === '' ? null : Number(state.balance)
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

export default function CryptoWalletsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [accountReference, setAccountReference] = useState('');
  const [email, setEmail] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showCredit, setShowCredit] = useState(false);
  const [creditWallet, setCreditWallet] = useState(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [creditAction, setCreditAction] = useState('MANUAL_ADJUSTMENT');
  const [creditError, setCreditError] = useState(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [quoteFrom, setQuoteFrom] = useState('USDT');
  const [quoteTo, setQuoteTo] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteResult, setQuoteResult] = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const [accounts, setAccounts] = useState([]);
  const [productNetworks, setProductNetworks] = useState([]);
  const [lookupsError, setLookupsError] = useState(null);
  const [accountFilter, setAccountFilter] = useState('');

  const formatBalance = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    const abs = Math.abs(num);
    return abs >= 1 ? num.toFixed(2) : num.toFixed(6);
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const accountRefValue = accountReference.trim();
      const emailValue = email.trim();
      if (accountRefValue) params.set('accountReference', accountRefValue);
      if (emailValue) params.set('email', emailValue);
      const res = await api.cryptoWallets.list(params);
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
  }, [page, size, accountReference, email]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadLookups = async () => {
      try {
        setLookupsError(null);
        const params = new URLSearchParams({ page: '0', size: '200' });
        const [accountsRes, networksRes] = await Promise.all([
          api.accounts.list(params),
          api.cryptoProductCryptoNetworks.list(params)
        ]);
        const toList = (res) => (Array.isArray(res) ? res : res?.content || []);
        setAccounts(toList(accountsRes));
        setProductNetworks(toList(networksRes));
      } catch (err) {
        setLookupsError(err.message || 'Failed to load lookup options');
      }
    };
    loadLookups();
  }, []);

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'accountReference', label: 'Account Ref' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'productNetworkCode', label: 'Product.Network' },
    { key: 'balance', label: 'Balance', render: (row) => formatBalance(row?.balance) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral">Edit</button>
          <button type="button" onClick={() => openCredit(row)} className="btn-success">Credit</button>
          <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger">Delete</button>
        </div>
      )
    }
  ], []);

  const groupedRows = useMemo(() => {
    const groups = new Map();
    rows.forEach((row) => {
      const key = row?.accountReference ? String(row.accountReference) : 'No account reference';
      if (!groups.has(key)) {
        groups.set(key, { key, rows: [], name: row?.name || null, email: row?.email || null });
      }
      const group = groups.get(key);
      group.rows.push(row);
      if (!group.name && row?.name) group.name = row.name;
      if (!group.email && row?.email) group.email = row.email;
    });
    return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [rows]);

  const toggleGroup = (key) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
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
      accountId: row.accountId !== null && row.accountId !== undefined ? String(row.accountId) : '',
      productNetworkId: row.productNetworkId !== null && row.productNetworkId !== undefined ? String(row.productNetworkId) : '',
      balance: row.balance ?? ''
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

  const openCredit = (row) => {
    setCreditWallet(row);
    setCreditAmount('');
    setCreditNote('');
    setCreditAction('MANUAL_ADJUSTMENT');
    setCreditError(null);
    setQuoteFrom('USDT');
    setQuoteTo(row?.currency || '');
    setQuoteAmount('');
    setQuoteResult(null);
    setQuoteError(null);
    setQuoteLoading(false);
    setShowCredit(true);
    setInfo(null);
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.cryptoWallets.create(toPayload(draft));
      setInfo('Created crypto wallet.');
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
      await api.cryptoWallets.update(selected.id, toPayload(draft));
      setInfo(`Updated crypto wallet ${selected.id}.`);
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
      await api.cryptoWallets.remove(id);
      setInfo(`Deleted wallet ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const submitCredit = async () => {
    if (!creditWallet?.id) {
      setCreditError('No wallet selected');
      return;
    }
    const rawAmount = String(creditAmount).trim();
    const amountNum = Number(rawAmount);
    if (!rawAmount || !Number.isFinite(amountNum) || amountNum <= 0) {
      setCreditError('Amount must be greater than 0');
      return;
    }
    setCreditLoading(true);
    setCreditError(null);
    setInfo(null);
    setError(null);
    try {
      const payload = {
        amount: rawAmount,
        ...(creditAction ? { action: creditAction } : {}),
        ...(creditNote?.trim() ? { note: creditNote.trim() } : {})
      };
      const res = await api.cryptoWallets.credit(creditWallet.id, payload);
      const amountLabel = res?.cryptoAmount ?? rawAmount;
      const currencyLabel = res?.cryptoCurrency || creditWallet?.currency || '';
      const refLabel = res?.reference ? ` (ref ${res.reference})` : '';
      const statusLabel = res?.status ? ` • ${res.status}` : '';
      setInfo(`Credited wallet ${creditWallet.id}: ${amountLabel} ${currencyLabel}${refLabel}${statusLabel}`);
      setShowCredit(false);
      setCreditWallet(null);
      setCreditAmount('');
      setCreditNote('');
      setCreditAction('MANUAL_ADJUSTMENT');
      await fetchRows();
    } catch (err) {
      setCreditError(err.message || 'Failed to credit wallet');
    } finally {
      setCreditLoading(false);
    }
  };

  const submitQuote = async () => {
    const from = quoteFrom.trim();
    const to = quoteTo.trim();
    const rawAmount = String(quoteAmount).trim();
    if (!from || !to || !rawAmount) {
      setQuoteError('Enter from/to currency and amount');
      return;
    }
    const amountNum = Number(rawAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setQuoteError('Amount must be greater than 0');
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const res = await api.cryptoQuotes.quote({ fromCurrency: from, toCurrency: to, amount: rawAmount });
      setQuoteResult(res || null);
    } catch (err) {
      setQuoteError(err.message || 'Failed to fetch quote');
    } finally {
      setQuoteLoading(false);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="accountFilter">Account filter</label>
        <input
          id="accountFilter"
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          placeholder="Search by reference, email, name, ID"
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="accountId">Account</label>
        <select id="accountId" value={draft.accountId} onChange={(e) => setDraft((p) => ({ ...p, accountId: e.target.value }))}>
          <option value="">Select account</option>
          {accounts.filter((account) => {
            const term = accountFilter.trim().toLowerCase();
            if (!term) return true;
            const id = account?.accountId ?? account?.id ?? '';
            const reference = account?.accountReference ?? account?.accountNumber ?? account?.accountId ?? account?.id;
            const name = [account?.userFirstName, account?.userMiddleName, account?.userLastName].filter(Boolean).join(' ') || account?.username || account?.name;
            const emailLabel = account?.email;
            const searchBlob = [id, reference, name, emailLabel, account?.username].filter(Boolean).join(' ').toLowerCase();
            return searchBlob.includes(term);
          }).map((account) => {
            const id = account?.accountId ?? account?.id ?? '';
            const reference = account?.accountReference ?? account?.accountNumber ?? account?.accountId ?? account?.id;
            const name = [account?.userFirstName, account?.userMiddleName, account?.userLastName].filter(Boolean).join(' ') || account?.username || account?.name;
            const emailLabel = account?.email;
            const label = [reference, name, emailLabel].filter(Boolean).join(' · ') || `Account ${id}`;
            return (
              <option key={id} value={String(id)}>
                {label}
              </option>
            );
          })}
          {draft.accountId && !accounts.some((account) => String(account?.accountId ?? account?.id ?? '') === String(draft.accountId)) && (
            <option value={draft.accountId}>Account {draft.accountId}</option>
          )}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="productNetworkId">Product/Network ID</label>
        <select id="productNetworkId" value={draft.productNetworkId} onChange={(e) => setDraft((p) => ({ ...p, productNetworkId: e.target.value }))}>
          <option value="">Select product/network</option>
          {productNetworks.map((item) => {
            const id = item?.id ?? '';
            const productName = item?.cryptoProductName || item?.productName || item?.cryptoProductCode;
            const networkName = item?.cryptoNetworkName || item?.networkName || item?.cryptoNetworkCode;
            const code = item?.productNetworkCode || item?.code;
            const baseLabel = [productName, networkName].filter(Boolean).join(' / ') || code || `Product/Network ${id}`;
            const label = code && baseLabel !== code ? `${baseLabel} · ${code}` : baseLabel;
            return (
              <option key={id} value={String(id)}>
                {label}
              </option>
            );
          })}
          {draft.productNetworkId && !productNetworks.some((item) => String(item?.id ?? '') === String(draft.productNetworkId)) && (
            <option value={draft.productNetworkId}>Product/Network {draft.productNetworkId}</option>
          )}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="balance">Balance</label>
        <input id="balance" type="number" value={draft.balance} onChange={(e) => setDraft((p) => ({ ...p, balance: e.target.value }))} />
      </div>
      {lookupsError && (
        <div style={{ gridColumn: '1 / -1', color: '#b91c1c', fontWeight: 600 }}>
          {lookupsError}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Crypto Wallets</div>
          <div style={{ color: 'var(--muted)' }}>Wallets per account and product/network.</div>
        </div>
        <Link href="/dashboard/crypto" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Crypto hub
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
        <div style={{ minWidth: '180px' }}>
          <label htmlFor="accountReference">Account reference</label>
          <input
            id="accountReference"
            value={accountReference}
            onChange={(e) => {
              setPage(0);
              setAccountReference(e.target.value);
            }}
            placeholder="ACC-123"
          />
        </div>
        <div style={{ minWidth: '200px' }}>
          <label htmlFor="email">User email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setPage(0);
              setEmail(e.target.value);
            }}
            placeholder="user@example.com"
          />
        </div>
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAccountReference('');
            setEmail('');
            setPage(0);
          }}
          className="btn-neutral"
        >
          Clear filters
        </button>
        <button type="button" onClick={openCreate} className="btn-success">
          Add wallet
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      {groupedRows.length === 0 ? (
        <DataTable columns={columns} rows={[]} emptyLabel="No crypto wallets found" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {groupedRows.map((group) => {
            const isOpen = openGroups.has(group.key);
            return (
              <div key={group.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="btn-neutral"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    border: 'none',
                    borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                    borderRadius: 0
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', textAlign: 'left' }}>
                    <div style={{ fontWeight: 800 }}>{group.key}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                      {group.name || '—'} {group.email ? `· ${group.email}` : ''} · {group.rows.length} wallet{group.rows.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700 }}>{isOpen ? '−' : '+'}</div>
                </button>
                {isOpen && (
                  <div style={{ padding: '0.75rem 1rem' }}>
                    <DataTable columns={columns} rows={group.rows} emptyLabel="No crypto wallets found" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal title="Add crypto wallet" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit wallet ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {showCredit && (
        <Modal title={`Credit wallet ${creditWallet?.id ?? ''}`} onClose={() => (!creditLoading ? setShowCredit(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              Account {creditWallet?.accountId ?? '—'} · {creditWallet?.currency || 'Crypto'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.6rem', border: '1px dashed var(--border)', borderRadius: '10px' }}>
              <div style={{ fontWeight: 700 }}>Get quote</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="quoteFrom">From currency</label>
                  <input id="quoteFrom" value={quoteFrom} onChange={(e) => setQuoteFrom(e.target.value)} placeholder="USDT" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="quoteTo">To currency</label>
                  <input id="quoteTo" value={quoteTo} onChange={(e) => setQuoteTo(e.target.value)} placeholder={creditWallet?.currency || 'BTC'} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="quoteAmount">Amount (from currency)</label>
                  <input
                    id="quoteAmount"
                    type="number"
                    min="0"
                    step="0.00000001"
                    value={quoteAmount}
                    onChange={(e) => setQuoteAmount(e.target.value)}
                    placeholder="100.00"
                  />
                </div>
                <button type="button" onClick={submitQuote} className="btn-neutral" disabled={quoteLoading}>
                  {quoteLoading ? 'Quoting…' : 'Get quote'}
                </button>
              </div>
              {quoteError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{quoteError}</div>}
              {quoteResult && (
                <DetailGrid
                  rows={[
                    { label: 'Requested amount', value: quoteResult?.requestedAmount },
                    { label: 'Net amount (send)', value: quoteResult?.netAmount },
                    { label: 'Exchange rate', value: quoteResult?.exchangeRate },
                    { label: 'Valid until', value: quoteResult?.validUntil },
                    { label: 'Quote ID', value: quoteResult?.quoteId }
                  ]}
                />
              )}
              {quoteResult?.netAmount && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-primary" onClick={() => setCreditAmount(String(quoteResult.netAmount))}>
                    Use net amount
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="creditAction">Action</label>
                <select id="creditAction" value={creditAction} onChange={(e) => setCreditAction(e.target.value)}>
                  <option value="MANUAL_ADJUSTMENT">Manual adjustment</option>
                  <option value="BONUS">Bonus</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="creditAmount">Amount</label>
                <input
                  id="creditAmount"
                  type="number"
                  min="0"
                  step="0.00000001"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="0.00050000"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="creditNote">Note (optional)</label>
                <input
                  id="creditNote"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder="Optional note shown on receipt"
                />
              </div>
            </div>
            {creditError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{creditError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setShowCredit(false)} className="btn-neutral" disabled={creditLoading}>Cancel</button>
              <button type="button" onClick={submitCredit} className="btn-success" disabled={creditLoading}>
                {creditLoading ? 'Crediting…' : 'Credit wallet'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Account ID', value: selected?.accountId },
              { label: 'Account Ref', value: selected?.accountReference },
              { label: 'Name', value: selected?.name },
              { label: 'Email', value: selected?.email },
              { label: 'Phone', value: selected?.phone },
              { label: 'Product/Network ID', value: selected?.productNetworkId },
              { label: 'Product', value: selected?.productName },
              { label: 'Network', value: selected?.networkName },
              { label: 'Product.Network', value: selected?.productNetworkCode },
              { label: 'Balance', value: selected?.balance }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete wallet <strong>{confirmDelete.id}</strong>? This cannot be undone.
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
