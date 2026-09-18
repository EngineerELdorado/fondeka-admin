'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const emptyFilters = {
  accountId: '',
  email: ''
};

const asText = (...values) => {
  const value = values.find((item) => item !== null && item !== undefined && String(item).trim() !== '');
  return value === null || value === undefined ? '-' : String(value);
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const formatAmount = (value, currency) => {
  if (value === null || value === undefined || value === '') return '-';
  const parsed = Number(value);
  const amount = Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value);
  return `${amount}${currency ? ` ${currency}` : ''}`;
};

const formatBoolean = (value) => (value ? 'Yes' : 'No');

const getLoans = (row) => (Array.isArray(row?.loans) ? row.loans : []);
const getInstallments = (loan) => (Array.isArray(loan?.installments) ? loan.installments : []);

const normalizeList = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.content)) return res.content;
  if (Array.isArray(res?.items)) return res.items;
  return [];
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ gap: '0.85rem', maxWidth: '980px' }}>
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
      <div key={row.label} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem', display: 'grid', gap: '0.15rem' }}>
        <div style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 700 }}>{row.label}</div>
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{row.value ?? '-'}</div>
      </div>
    ))}
  </div>
);

const StatusBadge = ({ restricted }) => {
  const active = Boolean(restricted);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '999px',
        padding: '0.2rem 0.55rem',
        fontSize: '12px',
        fontWeight: 800,
        color: active ? '#991b1b' : '#166534',
        background: active ? 'rgba(220, 38, 38, 0.08)' : 'rgba(22, 163, 74, 0.08)',
        border: `1px solid ${active ? 'rgba(220, 38, 38, 0.28)' : 'rgba(22, 163, 74, 0.28)'}`
      }}
    >
      {active ? 'Restricted' : 'Clear'}
    </span>
  );
};

export default function LoanServiceRestrictionsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      const accountId = String(appliedFilters.accountId || '').trim();
      const email = String(appliedFilters.email || '').trim();
      if (accountId) params.set('accountId', accountId);
      if (email) params.set('email', email);
      const res = await api.accounts.loanServiceRestrictions.list(params);
      setRows(normalizeList(res));
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setRows([]);
      setPageMeta({ totalElements: null, totalPages: null });
      setError(err?.message || 'Failed to load loan service restrictions.');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, size]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const applyFilters = () => {
    setPage(0);
    setAppliedFilters({
      accountId: String(filters.accountId || '').trim(),
      email: String(filters.email || '').trim()
    });
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(0);
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size && rows.length > 0 : page + 1 < pageMeta.totalPages;

  const columns = useMemo(
    () => [
      {
        key: 'identity',
        label: 'User',
        render: (row) => (
          <div style={{ display: 'grid', gap: '0.15rem' }}>
            <span style={{ fontWeight: 700 }}>{asText(row.email, row.username, row.userName)}</span>
            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{asText(row.phoneNumber, row.phone, row.mobileNumber)}</span>
          </div>
        )
      },
      { key: 'restricted', label: 'Status', render: (row) => <StatusBadge restricted={row.restricted} /> },
      { key: 'oldestOverdueDays', label: 'Oldest overdue', render: (row) => `${asText(row.oldestOverdueDays)} days` },
      { key: 'totalOutstandingAmount', label: 'Outstanding', render: (row) => formatAmount(row.totalOutstandingAmount, row.currency) },
      { key: 'totalOutstandingFineAmount', label: 'Fines', render: (row) => formatAmount(row.totalOutstandingFineAmount, row.currency) },
      { key: 'restrictedAt', label: 'Restricted at', render: (row) => formatDateTime(row.restrictedAt) },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <button type="button" className="btn-neutral btn-sm" onClick={() => setSelected(row)}>
            View
          </button>
        )
      }
    ],
    []
  );

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>Loan Service Restrictions</div>
          <div style={{ color: 'var(--muted)' }}>
            Accounts currently limited by the live overdue-loan service restriction rule.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            This reports dynamic restrictions from overdue loans, not old untrusted-borrower markers.
          </div>
        </div>
        <button type="button" className="btn-neutral" onClick={fetchRows} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="accountId">Account ID</label>
            <input
              id="accountId"
              value={filters.accountId}
              onChange={(event) => setFilters((prev) => ({ ...prev, accountId: event.target.value }))}
              placeholder="123"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={filters.email}
              onChange={(event) => setFilters((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="denis@example.com"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="size">Page size</label>
            <input
              id="size"
              type="number"
              min={1}
              max={100}
              value={size}
              onChange={(event) => {
                setSize(Math.max(1, Number(event.target.value) || 20));
                setPage(0);
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-primary" onClick={applyFilters} disabled={loading}>
              Apply
            </button>
            <button type="button" className="btn-neutral" onClick={clearFilters} disabled={loading}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        onPageChange={setPage}
        canPrev={canPrev}
        canNext={canNext}
        totalElements={pageMeta.totalElements}
        totalPages={pageMeta.totalPages}
        emptyLabel={loading ? 'Loading loan service restrictions...' : 'No restricted accounts found'}
      />

      {selected ? (
        <Modal title={`Loan service restriction - account ${asText(selected.accountId)}`} onClose={() => setSelected(null)}>
          <DetailGrid
            rows={[
              { label: 'Account reference', value: asText(selected.accountReference) },
              { label: 'Email', value: asText(selected.email) },
              { label: 'Reason', value: asText(selected.restrictionReason) },
              { label: 'Restricted', value: formatBoolean(selected.restricted) },
              { label: 'Threshold days', value: asText(selected.thresholdDays) },
              { label: 'Restricted at', value: formatDateTime(selected.restrictedAt) },
              { label: 'Earliest overdue due at', value: formatDateTime(selected.earliestOverdueDueAt) },
              { label: 'Oldest overdue days', value: asText(selected.oldestOverdueDays) },
              { label: 'Outstanding', value: formatAmount(selected.totalOutstandingAmount, selected.currency) },
              { label: 'Outstanding fines', value: formatAmount(selected.totalOutstandingFineAmount, selected.currency) },
              { label: 'Notification recorded', value: formatBoolean(selected.notificationRecorded) }
            ]}
          />

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ fontWeight: 800 }}>Loans</div>
            {getLoans(selected).length === 0 ? <div style={{ color: 'var(--muted)' }}>No loan details returned.</div> : null}
            {getLoans(selected).map((loan, loanIndex) => (
              <div key={loan.loanId || loan.id || loan.reference || loanIndex} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', display: 'grid', gap: '0.75rem' }}>
                <DetailGrid
                  rows={[
                    { label: 'Loan ID', value: asText(loan.loanId, loan.id) },
                    { label: 'Reference', value: asText(loan.reference, loan.loanReference) },
                    { label: 'Status', value: asText(loan.status) },
                    { label: 'Base amount', value: formatAmount(loan.baseAmount, loan.currency) },
                    { label: 'Interest', value: formatAmount(loan.interestAmount, loan.currency) },
                    { label: 'Requested', value: formatAmount(loan.requestedAmount, loan.currency) },
                    { label: 'Due amount', value: formatAmount(loan.dueAmount, loan.currency) },
                    { label: 'Paid', value: formatAmount(loan.paidAmount, loan.currency) },
                    { label: 'Remaining', value: formatAmount(loan.remainingBalance, loan.currency) },
                    { label: 'Outstanding fine', value: formatAmount(loan.outstandingFineAmount, loan.currency) },
                    { label: 'Starts at', value: formatDateTime(loan.startsAt) },
                    { label: 'Ends at', value: formatDateTime(loan.endsAt) },
                    { label: 'Deadline', value: formatDateTime(loan.deadlineAt) }
                  ]}
                />
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Installment ID', 'Due date', 'Amount', 'Fine', 'Paid', 'Remaining', 'Triggers restriction'].map((heading) => (
                          <th key={heading} style={{ textAlign: 'left', padding: '0.55rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {getInstallments(loan).length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '0.65rem', color: 'var(--muted)', textAlign: 'center' }}>
                            No installment details returned.
                          </td>
                        </tr>
                      ) : (
                        getInstallments(loan).map((installment, installmentIndex) => (
                          <tr key={installment.installmentId || installment.id || installmentIndex} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.55rem' }}>{asText(installment.installmentId, installment.id)}</td>
                            <td style={{ padding: '0.55rem' }}>{formatDateTime(installment.dueAt || installment.dueDate)}</td>
                            <td style={{ padding: '0.55rem' }}>{formatAmount(installment.amount, loan.currency)}</td>
                            <td style={{ padding: '0.55rem' }}>{formatAmount(installment.fineAmount, loan.currency)}</td>
                            <td style={{ padding: '0.55rem' }}>{formatAmount(installment.paidAmount, loan.currency)}</td>
                            <td style={{ padding: '0.55rem' }}>{formatAmount(installment.remainingBalance, loan.currency)}</td>
                            <td style={{ padding: '0.55rem' }}>{formatBoolean(installment.triggersServiceRestriction)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
