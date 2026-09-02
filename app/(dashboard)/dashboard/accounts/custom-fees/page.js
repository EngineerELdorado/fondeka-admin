'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { paymentMethodAdminLabel } from '@/lib/payment-method-labels';

const initialFilters = {
  accountReference: '',
  email: ''
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const formatName = (row) => {
  const name = [row?.firstName, row?.lastName].filter(Boolean).join(' ').trim();
  return name || '—';
};

const feeLabel = (fee) =>
  [
    fee?.service,
    fee?.action,
    paymentMethodAdminLabel(fee, fee?.paymentMethod || ''),
    fee?.paymentProviderName || fee?.paymentProvider
  ].filter(Boolean).join(' / ') || `Custom fee #${fee?.id}`;

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ maxWidth: '980px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

export default function AccountsWithCustomFeesPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [totalPages, setTotalPages] = useState(undefined);
  const [totalElements, setTotalElements] = useState(undefined);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [selected, setSelected] = useState(null);
  const [customFees, setCustomFees] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      if (appliedFilters.accountReference.trim()) params.set('accountReference', appliedFilters.accountReference.trim());
      if (appliedFilters.email.trim()) params.set('email', appliedFilters.email.trim());
      const res = await api.accounts.listWithCustomFees(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setTotalPages(typeof res?.totalPages === 'number' ? res.totalPages : undefined);
      setTotalElements(typeof res?.totalElements === 'number' ? res.totalElements : undefined);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCustomFees = async (row) => {
    if (!row?.accountId) return;
    setSelected(row);
    setCustomFees([]);
    setConfirmDelete(null);
    setDetailLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.accounts.feeConfigs.list(row.accountId);
      setCustomFees(Array.isArray(res) ? res : res?.content || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteFee = async () => {
    if (!selected?.accountId || !confirmDelete?.id) return;
    const feeId = confirmDelete.id;
    setDeletingId(feeId);
    setError(null);
    setInfo(null);
    try {
      await api.accounts.feeConfigs.remove(selected.accountId, feeId);
      setCustomFees((prev) => prev.filter((fee) => Number(fee?.id) !== Number(feeId)));
      setRows((prev) =>
        prev.map((row) =>
          Number(row?.accountId) === Number(selected.accountId)
            ? { ...row, customFeeConfigCount: Math.max(0, Number(row.customFeeConfigCount || 0) - 1) }
            : row
        )
      );
      setInfo(`Removed custom fee config ${feeId}.`);
      setConfirmDelete(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const applyFilters = () => {
    setPage(0);
    setAppliedFilters({ ...filters });
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(0);
  };

  const columns = useMemo(() => [
    {
      key: 'accountReference',
      label: 'Account',
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <Link href={`/dashboard/accounts/accounts/${row.accountId}`} style={{ color: 'var(--accent)', fontWeight: 800 }}>
            {row.accountReference || `Account #${row.accountId}`}
          </Link>
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>ID {row.accountId}</span>
        </div>
      )
    },
    { key: 'name', label: 'Name', render: (row) => formatName(row) },
    { key: 'email', label: 'Email', render: (row) => row.email || row.username || '—' },
    { key: 'countryCode', label: 'Country' },
    { key: 'customFeeConfigCount', label: 'Custom fees' },
    { key: 'lastCustomFeeConfigUpdatedAt', label: 'Last updated', render: (row) => formatDate(row.lastCustomFeeConfigUpdatedAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={() => openCustomFees(row)}>View fees</button>
          <Link href={`/dashboard/accounts/accounts/${row.accountId}`} className="btn-neutral" style={{ textDecoration: 'none' }}>Account</Link>
        </div>
      )
    }
  ], []);

  const canNext = totalPages === undefined ? rows.length === size && rows.length > 0 : page + 1 < totalPages;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Accounts with Custom Fees</div>
          <div style={{ color: 'var(--muted)' }}>Find accounts with per-account fee overrides and remove configs that should no longer apply.</div>
        </div>
        <Link href="/dashboard/accounts" className="btn-neutral" style={{ textDecoration: 'none' }}>
          Accounts hub
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="accountReference">Account reference</label>
          <input id="accountReference" placeholder="FDK" value={filters.accountReference} onChange={(e) => setFilters((p) => ({ ...p, accountReference: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" placeholder="user@example.com" value={filters.email} onChange={(e) => setFilters((p) => ({ ...p, email: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="size">Size</label>
          <input id="size" type="number" min={1} value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={applyFilters} disabled={loading}>{loading ? 'Loading…' : 'Apply'}</button>
          <button type="button" className="btn-neutral" onClick={clearFilters} disabled={loading}>Clear</button>
          <button type="button" className="btn-neutral" onClick={fetchRows} disabled={loading}>Refresh</button>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        totalPages={totalPages}
        totalElements={totalElements}
        canNext={canNext}
        onPageChange={setPage}
        emptyLabel={loading ? 'Loading accounts…' : 'No accounts with custom fees found'}
      />

      {selected && (
        <Modal title={`Custom fees for ${selected.accountReference || selected.email || selected.accountId}`} onClose={() => { setSelected(null); setConfirmDelete(null); }}>
          <DetailGrid
            rows={[
              { label: 'Account ID', value: selected.accountId },
              { label: 'Reference', value: selected.accountReference },
              { label: 'Email', value: selected.email || selected.username },
              { label: 'Name', value: formatName(selected) },
              { label: 'Country', value: selected.countryCode },
              { label: 'Custom fees', value: customFees.length }
            ]}
          />

          <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
            {detailLoading ? (
              <div style={{ color: 'var(--muted)' }}>Loading custom fees…</div>
            ) : customFees.length === 0 ? (
              <div style={{ color: 'var(--muted)' }}>No custom fee configs remain for this account.</div>
            ) : (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['ID', 'Scope', 'Fee', 'Active', 'Updated', 'Actions'].map((header) => (
                      <th key={header} style={{ textAlign: 'left', padding: '0.65rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customFees.map((fee) => (
                    <tr key={fee.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.65rem' }}>{fee.id}</td>
                      <td style={{ padding: '0.65rem' }}>{feeLabel(fee)}</td>
                      <td style={{ padding: '0.65rem' }}>{[fee.feeType, fee.feeAmount, fee.feeCurrency].filter(Boolean).join(' ') || '—'}</td>
                      <td style={{ padding: '0.65rem' }}>{fee.active === false ? 'No' : 'Yes'}</td>
                      <td style={{ padding: '0.65rem' }}>{formatDate(fee.updatedAt || fee.createdAt)}</td>
                      <td style={{ padding: '0.65rem' }}>
                        <button type="button" className="btn-danger" onClick={() => setConfirmDelete(fee)} disabled={deletingId === fee.id}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {confirmDelete && (
            <div style={{ marginTop: '1rem', padding: '0.85rem', border: '1px solid #fecaca', borderRadius: '12px', background: '#fff7f7', display: 'grid', gap: '0.65rem' }}>
              <div style={{ fontWeight: 800, color: '#991b1b' }}>Delete custom fee config {confirmDelete.id}?</div>
              <div style={{ color: '#7f1d1d' }}>{feeLabel(confirmDelete)}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-neutral" onClick={() => setConfirmDelete(null)} disabled={deletingId === confirmDelete.id}>Cancel</button>
                <button type="button" className="btn-danger" onClick={handleDeleteFee} disabled={deletingId === confirmDelete.id}>
                  {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
