'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const accountModes = [
  { value: 'accountId', label: 'Account ID', placeholder: '123' },
  { value: 'accountReference', label: 'Account Reference', placeholder: 'FDK123456789012' },
  { value: 'accountEmail', label: 'Account Email', placeholder: 'user@example.com' }
];

const emptyForm = {
  accountMode: 'accountId',
  accountValue: '',
  loanProductId: '',
  amount: '',
  decisionComments: ''
};

const pickLoanProductName = (item) =>
  item?.title || item?.name || item?.displayName || item?.code || `Loan product #${item?.id}`;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

export default function DirectLoanCreditPage() {
  const [form, setForm] = useState(emptyForm);
  const [loanProducts, setLoanProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [result, setResult] = useState(null);

  const loadLoanProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await api.loanProducts.list(new URLSearchParams({ page: '0', size: '200' }));
      const list = Array.isArray(res) ? res : res?.content || [];
      setLoanProducts(list || []);
    } catch {
      setLoanProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadLoanProducts();
  }, []);

  const currentMode = useMemo(
    () => accountModes.find((mode) => mode.value === form.accountMode) || accountModes[0],
    [form.accountMode]
  );

  const transactionId = result?.transactionId;
  const loanReference = result?.loanDetails?.loanReference || result?.loanDetails?.reference || result?.loanDetails?.loanRef || '';
  const loanId = result?.loanDetails?.loanId || result?.loanDetails?.id || '';

  const submit = async () => {
    setError(null);
    setInfo(null);
    setResult(null);

    const mode = form.accountMode;
    const rawAccountValue = String(form.accountValue || '').trim();
    if (!rawAccountValue) {
      setError(`${currentMode.label} is required`);
      return;
    }

    const loanProductId = Number(form.loanProductId);
    if (!Number.isInteger(loanProductId) || loanProductId <= 0) {
      setError('Loan product is required');
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    const payload = {
      loanProductId,
      amount
    };
    if (mode === 'accountId') {
      const accountId = Number(rawAccountValue);
      if (!Number.isInteger(accountId) || accountId <= 0) {
        setError('Account ID must be a positive integer');
        return;
      }
      payload.accountId = accountId;
    } else if (mode === 'accountReference') {
      payload.accountReference = rawAccountValue;
    } else {
      payload.accountEmail = normalizeEmail(rawAccountValue);
    }

    const comments = String(form.decisionComments || '').trim();
    if (comments) {
      payload.decisionComments = comments;
    }

    setSubmitting(true);
    try {
      const res = await api.loans.directCredit(payload);
      setResult(res || null);
      setInfo('Direct loan credit completed successfully.');
      setForm((prev) => ({ ...prev, amount: '', decisionComments: '' }));
    } catch (err) {
      setError(err?.message || 'Failed to run direct loan credit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Direct Loan Credit</div>
          <div style={{ color: 'var(--muted)' }}>Create and auto-approve a loan, then credit the wallet immediately.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={loadLoanProducts} disabled={loadingProducts}>
            {loadingProducts ? 'Refreshing products…' : 'Refresh products'}
          </button>
          <Link href="/dashboard/loans" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
            ← Loans
          </Link>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ fontWeight: 700 }}>Account selector</div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {accountModes.map((mode) => (
            <label key={mode.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="radio"
                name="accountMode"
                value={mode.value}
                checked={form.accountMode === mode.value}
                onChange={(e) => setForm((prev) => ({ ...prev, accountMode: e.target.value, accountValue: '' }))}
                disabled={submitting}
              />
              {mode.label}
            </label>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="accountValue">{currentMode.label}</label>
            <input
              id="accountValue"
              value={form.accountValue}
              placeholder={currentMode.placeholder}
              onChange={(e) => setForm((prev) => ({ ...prev, accountValue: e.target.value }))}
              disabled={submitting}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="loanProductId">Loan product</label>
            <select
              id="loanProductId"
              value={form.loanProductId}
              onChange={(e) => setForm((prev) => ({ ...prev, loanProductId: e.target.value }))}
              disabled={submitting || loadingProducts}
            >
              <option value="">Select loan product</option>
              {loanProducts.map((item) => (
                <option key={item.id} value={item.id}>
                  {pickLoanProductName(item)} ({item.id})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              placeholder="100"
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              disabled={submitting}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="decisionComments">Decision comments (optional)</label>
          <textarea
            id="decisionComments"
            rows={3}
            value={form.decisionComments}
            placeholder="Approved by support"
            onChange={(e) => setForm((prev) => ({ ...prev, decisionComments: e.target.value }))}
            disabled={submitting}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-success" onClick={submit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Credit loan now'}
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      {result && (
        <div className="card" style={{ display: 'grid', gap: '0.7rem' }}>
          <div style={{ fontWeight: 800 }}>Direct credit result</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
            <div><strong>Transaction ID:</strong> {transactionId ?? '—'}</div>
            <div><strong>Status:</strong> {result?.status ?? '—'}</div>
            <div><strong>Loan reference:</strong> {loanReference || '—'}</div>
            <div><strong>Loan ID:</strong> {loanId || '—'}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {transactionId ? (
              <Link
                href={`/dashboard/transactions?transactionId=${encodeURIComponent(String(transactionId))}`}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}
              >
                View transaction
              </Link>
            ) : null}
            {loanReference ? (
              <Link
                href={`/dashboard/loans/applications?loanReference=${encodeURIComponent(String(loanReference))}`}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}
              >
                View loan
              </Link>
            ) : (
              <Link
                href="/dashboard/loans/applications"
                style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}
              >
                Open loans
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
