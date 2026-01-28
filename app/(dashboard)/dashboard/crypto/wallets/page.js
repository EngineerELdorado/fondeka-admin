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
  const [size, setSize] = useState(25);
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

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'accountId', label: 'Account ID' },
    { key: 'productNetworkId', label: 'Product/Network ID' },
    { key: 'balance', label: 'Balance' },
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

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      accountId: row.accountId ?? '',
      productNetworkId: row.productNetworkId ?? '',
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

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="accountId">Account ID</label>
        <input id="accountId" type="number" value={draft.accountId} onChange={(e) => setDraft((p) => ({ ...p, accountId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="productNetworkId">Product/Network ID</label>
        <input id="productNetworkId" type="number" value={draft.productNetworkId} onChange={(e) => setDraft((p) => ({ ...p, productNetworkId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="balance">Balance</label>
        <input id="balance" type="number" value={draft.balance} onChange={(e) => setDraft((p) => ({ ...p, balance: e.target.value }))} />
      </div>
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

      <DataTable columns={columns} rows={rows} emptyLabel="No crypto wallets found" />

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
              { label: 'Product/Network ID', value: selected?.productNetworkId },
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
