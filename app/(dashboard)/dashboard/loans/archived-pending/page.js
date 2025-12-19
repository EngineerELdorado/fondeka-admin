'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { useToast } from '@/contexts/ToastContext';

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

export default function ArchivedPendingLoansPage() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phoneFilter, setPhoneFilter] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [paid, setPaid] = useState('');
  const [remaining, setRemaining] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [showUpsert, setShowUpsert] = useState(false);

  const [uploading, setUploading] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (phoneFilter.trim()) params.set('phone', phoneFilter.trim());
      const res = await api.loans.archivedPending.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
    } catch (err) {
      setError(err.message);
      pushToast({ tone: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitUpsert = async () => {
    setError(null);
    if (!phone.trim()) {
      setError('Phone is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        phone: phone.trim(),
        ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        loanAmount: loanAmount === '' ? 0 : Number(loanAmount) || 0,
        paid: paid === '' ? 0 : Number(paid) || 0,
        remaining: remaining === '' ? 0 : Number(remaining) || 0
      };
      await api.loans.archivedPending.upsert(payload);
      pushToast({ tone: 'success', message: 'Saved archived pending loan' });
      setFirstName('');
      setLastName('');
      setLoanAmount('');
      setPaid('');
      setRemaining('');
      setPhone('');
      await fetchRows();
    } catch (err) {
      setError(err.message);
      pushToast({ tone: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await api.loans.archivedPending.upload(file);
      pushToast({ tone: 'success', message: 'CSV uploaded (rows upserted by phone)' });
      await fetchRows();
    } catch (err) {
      setError(err.message);
      pushToast({ tone: 'error', message: err.message });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (row) => {
    if (!row?.id) return;
    const yes = window.confirm(`Delete archived pending loan for ${row.phone || row.id}?`);
    if (!yes) return;
    setError(null);
    try {
      await api.loans.archivedPending.remove(row.id);
      pushToast({ tone: 'success', message: 'Deleted entry' });
      await fetchRows();
    } catch (err) {
      setError(err.message);
      pushToast({ tone: 'error', message: err.message });
    }
  };

  const columns = [
    { key: 'firstName', label: 'First name' },
    { key: 'lastName', label: 'Last name' },
    { key: 'loanAmount', label: 'Loan amount' },
    { key: 'paid', label: 'Paid' },
    { key: 'remaining', label: 'Remaining' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-neutral btn-sm"
            onClick={() => {
              setFirstName(row.firstName || '');
              setLastName(row.lastName || '');
              setLoanAmount(row.loanAmount ?? '');
              setPaid(row.paid ?? '');
              setRemaining(row.remaining ?? '');
              setPhone(row.phone || '');
              setShowUpsert(true);
            }}
          >
            Update
          </button>
          <button type="button" className="btn-danger btn-sm" onClick={() => handleDelete(row)}>
            Delete
          </button>
        </div>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Archived Pending Loans</div>
          <div style={{ color: 'var(--muted)' }}>Import, upsert, and clean archived pending loans (by phone).</div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFirstName('');
              setLastName('');
              setLoanAmount('');
              setPaid('');
              setRemaining('');
              setPhone('');
              setShowUpsert(true);
            }}
          >
            Add / edit entry
          </button>
          <button type="button" className="btn-neutral" onClick={fetchRows} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link href="/dashboard/loans" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
            ← Loans hub
          </Link>
        </div>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label htmlFor="phoneFilter">Phone contains</label>
            <input id="phoneFilter" value={phoneFilter} onChange={(e) => setPhoneFilter(e.target.value)} placeholder="+24397" />
          </div>
          <button type="button" className="btn-primary" onClick={fetchRows} disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button type="button" className="btn-neutral" onClick={() => { setPhoneFilter(''); fetchRows(); }} disabled={loading}>
            Reset
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label htmlFor="csvUpload" className="btn-primary btn-sm" style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
              {uploading ? 'Uploading…' : 'Upload CSV'}
            </label>
            <input id="csvUpload" type="file" accept=".csv,text/csv" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>CSV headers: FIRSTNAME,LASTNAME,LOAN_AMOUNT,PAID,REMAINING,PHONE</span>
          </div>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} emptyLabel={loading ? 'Loading…' : 'No data'} />

      {showUpsert && (
        <Modal title="Add or edit archived pending loan" onClose={() => (!saving ? setShowUpsert(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label htmlFor="firstName">First name</label>
                <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label htmlFor="lastName">Last name</label>
                <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label htmlFor="loanAmount">Loan amount</label>
                <input id="loanAmount" type="number" step="0.01" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label htmlFor="paid">Paid</label>
                <input id="paid" type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label htmlFor="remaining">Remaining</label>
                <input id="remaining" type="number" step="0.01" value={remaining} onChange={(e) => setRemaining(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label htmlFor="phone">Phone *</label>
                <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+243…" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn-primary" onClick={submitUpsert} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="btn-neutral"
                onClick={() => {
                  setFirstName('');
                  setLastName('');
                  setLoanAmount('');
                  setPaid('');
                  setRemaining('');
                  setPhone('');
                }}
                disabled={saving}
              >
                Clear form
              </button>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Upserts by phone; numeric fields default to 0 if empty.</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
