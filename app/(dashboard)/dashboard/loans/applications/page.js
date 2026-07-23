'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const statusOptions = ['PENDING', 'APPROVED', 'REJECTED', 'FAILED', 'CANCELLED', 'OPEN', 'CLOSED'];
const unpaidInstallmentMessage = 'Borrower has unpaid installments; cannot approve';

const emptyFilters = {
  loanType: '',
  applicationStatus: '',
  repaymentStatus: '',
  fromDate: '',
  toDate: '',
  loanReference: '',
  transactionReference: '',
  externalTransactionReference: '',
  accountReference: '',
  userEmailOrUsername: '',
  userPhoneNumber: '',
  minAmount: '',
  maxAmount: ''
};

const repaymentStatusOptions = ['PAID', 'LATE', 'ACTIVE', 'PARTIALLY_PAID', 'NONE'];

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

const StatusBadge = ({ value }) => {
  if (!value) return '—';
  const val = String(value).toUpperCase();
  const tone =
    val === 'APPROVED'
      ? { bg: '#ECFDF3', fg: '#15803D' }
      : val === 'PENDING'
        ? { bg: '#EFF6FF', fg: '#1D4ED8' }
        : val === 'REJECTED'
          ? { bg: '#FEF2F2', fg: '#B91C1C' }
          : val === 'CANCELLED' || val === 'CANCELED'
            ? { bg: '#FFF7ED', fg: '#C2410C' }
            : { bg: '#E5E7EB', fg: '#374151' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.5rem',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 700,
        background: tone.bg,
        color: tone.fg
      }}
    >
      {val}
    </span>
  );
};

const RepaymentBadge = ({ value }) => {
  if (!value) return '—';
  const val = String(value).toUpperCase();
  const tone =
    val === 'PAID'
      ? { bg: '#ECFDF3', fg: '#15803D' }
      : val === 'ACTIVE'
        ? { bg: '#EFF6FF', fg: '#1D4ED8' }
        : val === 'PARTIALLY_PAID'
          ? { bg: '#FFF7ED', fg: '#9A3412' }
          : val === 'LATE'
            ? { bg: '#FEF2F2', fg: '#B91C1C' }
            : { bg: '#E5E7EB', fg: '#374151' }; // NONE or fallback
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.5rem',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 700,
        background: tone.bg,
        color: tone.fg
      }}
    >
      {val}
    </span>
  );
};

export default function LoanApplicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { row, action }
  const [decisionComments, setDecisionComments] = useState('');
  const [confirmBlacklist, setConfirmBlacklist] = useState(null);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [blacklistError, setBlacklistError] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);

  const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatAmount = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const normalizeCurrency = (value) => String(value || '').trim().toUpperCase();

  const hasAmount = (value) => value !== null && value !== undefined && value !== '';

  const isUsableUsdReference = (row, usdField, localField) => {
    if (!hasAmount(row?.[usdField])) return false;
    const usdNumber = Number(row?.[usdField]);
    const localNumber = Number(row?.[localField]);
    return !(usdNumber === 0 && normalizeCurrency(row?.currency) !== 'USD' && Number.isFinite(localNumber) && localNumber !== 0);
  };

  const formatMoney = (amount, currency) => {
    if (!hasAmount(amount)) return '—';
    return `${formatAmount(amount)} ${normalizeCurrency(currency)}`.trim();
  };

  const formatUsdReference = (row, usdField, localField) => {
    if (isUsableUsdReference(row, usdField, localField)) return formatMoney(row?.[usdField], row?.referenceCurrency || 'USD');
    if (normalizeCurrency(row?.currency) === 'USD') return formatMoney(row?.[localField], 'USD');
    return formatMoney(row?.[localField], row?.currency);
  };

  const formatLocalAndUsdReference = (row, localField, usdField) => {
    const local = formatMoney(row?.[localField], row?.currency);
    if (local === '—' || normalizeCurrency(row?.currency) === 'USD' || !isUsableUsdReference(row, usdField, localField)) return local;
    return (
      <span>
        <span>{local}</span>
        <span style={{ color: 'var(--muted)' }}> ({formatMoney(row?.[usdField], row?.referenceCurrency || 'USD')})</span>
      </span>
    );
  };

  const getInstallmentPayments = (installment) => {
    const payments = installment?.loanInstallmentPayments || installment?.installmentPayments || installment?.payments || [];
    return Array.isArray(payments) ? payments : [];
  };

  const resolvePaymentFxRate = (payment) => payment?.fxRate ?? payment?.exchangeRate ?? payment?.billingFxRate ?? payment?.appliedFxRate;

  const hasPaymentCurrencyMismatch = (payment) => {
    const paidCurrency = normalizeCurrency(payment?.currency);
    const billingCurrency = normalizeCurrency(payment?.billingCurrency);
    return Boolean(paidCurrency && billingCurrency && paidCurrency !== billingCurrency);
  };

  const renderRepaymentBreakdown = (payments) => {
    if (!payments.length) return '—';
    return (
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        {payments.map((payment, index) => (
          <div key={payment?.id || payment?.transactionId || index} style={{ display: 'grid', gap: '0.15rem' }}>
            <div>Paid: {formatMoney(payment?.amount, payment?.currency)}</div>
            <div>Applied: {formatMoney(payment?.billingAmount ?? payment?.amount, payment?.billingCurrency || payment?.currency)}</div>
            {(payment?.requestAmount !== null && payment?.requestAmount !== undefined) || payment?.requestCurrency ? (
              <div>Requested: {formatMoney(payment?.requestAmount, payment?.requestCurrency)}</div>
            ) : null}
            {hasPaymentCurrencyMismatch(payment) ? <div>FX: {resolvePaymentFxRate(payment) ?? '—'}</div> : null}
          </div>
        ))}
      </div>
    );
  };

  const hasUnpaidNextDueInstallment = (row) => {
    const status = String(row?.nextDueInstallment?.repaymentStatus || row?.nextDueInstallment?.status || '').toUpperCase();
    return row?.nextDueInstallment && status !== 'PAID';
  };

  const hasLateRepayment = (row) => {
    const repaymentStatus = String(row?.repaymentStatus || '').toUpperCase();
    const nextDueStatus = String(row?.nextDueInstallment?.repaymentStatus || row?.nextDueInstallment?.status || '').toUpperCase();
    if (repaymentStatus === 'LATE' || nextDueStatus === 'LATE') return true;
    return Array.isArray(row?.loanInstallments) && row.loanInstallments.some((inst) => String(inst?.repaymentStatus || inst?.status || '').toUpperCase() === 'LATE');
  };

  const isBlacklisted = (row) => Boolean(row?.blacklisted ?? row?.accountBlacklisted ?? row?.account?.blacklisted);

  const isFullyPaid = (row) => {
    const remaining = Number(row?.remainingBalance);
    if (!Number.isNaN(remaining) && remaining <= 0) return true;
    const amount = Number(row?.amount);
    const paid = Number(row?.paidAmount);
    if (!Number.isNaN(amount) && !Number.isNaN(paid) && paid >= amount) return true;
    const status = String(row?.repaymentStatus || row?.applicationStatus || '').toUpperCase();
    return status === 'PAID' || status === 'FULLY_PAID';
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        if (['minAmount', 'maxAmount'].includes(key)) {
          const num = Number(value);
          if (!Number.isNaN(num)) params.set(key, String(num));
        } else if (['fromDate', 'toDate'].includes(key)) {
          const ts = Date.parse(value);
          if (!Number.isNaN(ts)) params.set(key, String(ts));
        } else {
          params.set(key, String(value));
        }
      });
      const res = await api.loans.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      const normalized = (list || []).map((item) => ({
        ...item,
        loanInstallments: (item?.loan?.loanInstallments || item.loanInstallments || []).map((inst) => ({
          ...inst,
          installmentDate: inst.installmentDate || inst.dueDate,
          installmentAmount: inst.installmentAmount ?? inst.amount,
          installmentFineAmount: inst.installmentFineAmount ?? inst.fine,
          repaymentStatus: inst.repaymentStatus || inst.status,
          currency: inst.currency || item?.loan?.currency || item?.currency
        })),
        nextDueInstallment: (() => {
          const inst = item?.loan?.nextDueInstallment || item.nextDueInstallment || null;
          if (!inst) return null;
          return {
            ...inst,
            installmentDate: inst.installmentDate || inst.dueDate,
            installmentAmount: inst.installmentAmount ?? inst.amount,
            installmentFineAmount: inst.installmentFineAmount ?? inst.fine,
            repaymentStatus: inst.repaymentStatus || inst.status,
            currency: inst.currency || item?.loan?.currency || item?.currency
          };
        })(),
        id: item.loan?.id ?? item.id,
        loanReference: item.loan?.reference || item.loanReference,
        loanType: item.loan?.loanType || item.loanType,
        applicationStatus: item.loan?.applicationStatus || item.applicationStatus,
        amount: item.loan?.amount ?? item.amount,
        usdAmount: item.loan?.usdAmount ?? item.usdAmount,
        paidAmount: item.loan?.paidAmount ?? item.paidAmount,
        remainingBalance: item.loan?.remainingBalance ?? item.remainingBalance,
        usdRemainingBalance: item.loan?.usdRemainingBalance ?? item.usdRemainingBalance,
        repaymentStatus: item.loan?.repaymentStatus ?? item.repaymentStatus,
        fineAmount: item.loan?.fineAmount ?? item.fineAmount,
        outstandingFineAmount: item.loan?.outstandingFineAmount ?? item.outstandingFineAmount,
        givenAmount: item.loan?.givenAmount ?? item.givenAmount,
        usdGivenAmount: item.loan?.usdGivenAmount ?? item.usdGivenAmount,
        interestAmount: item.loan?.interestAmount ?? item.interestAmount,
        usdInterestAmount: item.loan?.usdInterestAmount ?? item.usdInterestAmount,
        usdFxRate: item.loan?.usdFxRate ?? item.usdFxRate,
        referenceCurrency: item.loan?.referenceCurrency ?? item.referenceCurrency,
        currency: item.loan?.currency || item.currency,
        createdAt: item.loan?.createdAt || item.createdAt,
        accountId: item.accountId ?? item.loan?.accountId ?? item.account?.id,
        accountReference: item.accountReference,
        blacklisted: Boolean(item.account?.blacklisted ?? item.blacklisted ?? item.loan?.accountBlacklisted ?? item.accountBlacklisted ?? false),
        userEmailOrUsername: item.username || item.email || item.userEmailOrUsername,
        userPhoneNumber: item.phoneNumber || item.userPhoneNumber,
        transactionReference: item.transactionReference,
        transactionExternalReference: item.transactionExternalReference,
        customer: item.customer
      }));
      setRows(normalized);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const next = { ...emptyFilters };
    const allowedKeys = ['loanReference', 'transactionReference', 'accountReference', 'userEmailOrUsername', 'userPhoneNumber', 'applicationStatus'];
    let hasAny = false;
    allowedKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (!value) return;
      next[key] = value;
      hasAny = true;
    });
    if (!hasAny) return;
    setFilters((prev) => ({ ...prev, ...next }));
    setAppliedFilters((prev) => ({ ...prev, ...next }));
    setShowFilters(true);
    setPage(0);
  }, [searchParams]);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    const add = (label, key) => chips.push({ label, key });
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      switch (key) {
        case 'loanType':
          add(`Loan type: ${value}`, key);
          break;
        case 'applicationStatus':
          add(`Status: ${value}`, key);
          break;
        case 'repaymentStatus':
          add(`Repayment: ${value}`, key);
          break;
        case 'accountReference':
          add(`Account ref: ${value}`, key);
          break;
        case 'userEmailOrUsername':
          add(`User: ${value}`, key);
          break;
        case 'userPhoneNumber':
          add(`Phone: ${value}`, key);
          break;
        case 'loanReference':
          add(`Loan ref: ${value}`, key);
          break;
        case 'transactionReference':
          add(`Txn ref: ${value}`, key);
          break;
        case 'externalTransactionReference':
          add(`Txn external: ${value}`, key);
          break;
        case 'minAmount':
          add(`Min amount: ${value}`, key);
          break;
        case 'maxAmount':
          add(`Max amount: ${value}`, key);
          break;
        case 'fromDate':
          add(`From: ${value}`, key);
          break;
        case 'toDate':
          add(`To: ${value}`, key);
          break;
        default:
          break;
      }
    });
    return chips;
  }, [appliedFilters]);

  const resolveLoanOwnerAccountId = useCallback(async (row) => {
    const directAccountId = row?.accountId ?? row?.account?.id;
    if (directAccountId !== null && directAccountId !== undefined && String(directAccountId).trim() !== '') {
      return String(directAccountId).trim();
    }
    const accountReference = String(row?.accountReference || '').trim();
    if (!accountReference) return null;
    try {
      const params = new URLSearchParams({ page: '0', size: '1', accountReference });
      const res = await api.accounts.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      const match = list?.[0];
      const resolvedAccountId = match?.accountId ?? match?.id;
      if (resolvedAccountId === null || resolvedAccountId === undefined || String(resolvedAccountId).trim() === '') return null;
      return String(resolvedAccountId).trim();
    } catch {
      return null;
    }
  }, []);

  const openLoanOwnerAccount = useCallback(async (row) => {
    const accountId = await resolveLoanOwnerAccountId(row);
    if (!accountId) return;
    router.push(`/dashboard/accounts/accounts/${encodeURIComponent(accountId)}`);
  }, [resolveLoanOwnerAccountId, router]);

  const openBlacklistModal = (row) => {
    setBlacklistError(null);
    setBlacklistReason(`Late loan repayment${row?.loanReference ? ` for loan ${row.loanReference}` : ''}`);
    setConfirmBlacklist(row);
  };

  const submitBlacklistAction = async () => {
    if (!confirmBlacklist) return;
    const reason = blacklistReason.trim();
    if (!reason) {
      setBlacklistError('Reason is required');
      return;
    }
    setBlacklistLoading(true);
    setBlacklistError(null);
    setError(null);
    setInfo(null);
    try {
      const accountId = await resolveLoanOwnerAccountId(confirmBlacklist);
      if (!accountId) {
        throw new Error('Could not resolve the borrower account for this loan.');
      }
      await api.accounts.blacklist(accountId, { reason });
      setInfo(`Blacklisted account ${accountId} for late loan repayment.`);
      setConfirmBlacklist(null);
      setBlacklistReason('');
      fetchRows();
    } catch (err) {
      setBlacklistError(err?.message || 'Failed to blacklist account');
    } finally {
      setBlacklistLoading(false);
    }
  };

  const columns = [
      { key: 'id', label: 'ID' },
      { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
      { key: 'loanReference', label: 'Loan ref' },
      {
        key: 'applicationStatus',
        label: 'Status',
        render: (row) => <StatusBadge value={row.applicationStatus} />
      },
      {
        key: 'customer',
        label: 'Customer',
        render: (row) => {
          const customerLabel = row.customer || '—';
          const hasAccountShortcut = Boolean(
            (row?.accountId !== null && row?.accountId !== undefined && String(row.accountId).trim() !== '') ||
              String(row?.accountReference || '').trim()
          );
          if (!hasAccountShortcut) return customerLabel;
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
              <span>{customerLabel}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openLoanOwnerAccount(row);
                }}
                aria-label={`Open account for ${customerLabel}`}
                title={`Open account for ${customerLabel}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '999px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer'
                }}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21a8 8 0 1 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
            </span>
          );
        }
      },
      {
        key: 'givenAmount',
        label: 'Principal',
        render: (row) => formatUsdReference(row, 'usdGivenAmount', 'givenAmount')
      },
      {
        key: 'interestAmount',
        label: 'Interest',
        render: (row) => formatUsdReference(row, 'usdInterestAmount', 'interestAmount')
      },
      {
        key: 'amount',
        label: 'Due',
        render: (row) => formatUsdReference(row, 'usdAmount', 'amount')
      },
      {
        key: 'paidAmount',
        label: 'Paid',
        render: (row) => formatMoney(row.paidAmount, row.currency)
      },
      {
        key: 'remainingBalance',
        label: 'Remaining',
        render: (row) => formatUsdReference(row, 'usdRemainingBalance', 'remainingBalance')
      },
      {
        key: 'fineAmount',
        label: 'Total Fines',
        render: (row) => formatMoney(row.fineAmount, row.currency)
      },
      {
        key: 'outstandingFineAmount',
        label: 'Outstanding Fines',
        render: (row) => formatMoney(row.outstandingFineAmount, row.currency)
      },
      {
        key: 'nextDueInstallment',
        label: 'Next due',
        render: (row) => {
          const inst = row.nextDueInstallment;
          if (!inst) {
            if (isFullyPaid(row)) {
              return <RepaymentBadge value="PAID" />;
            }
            return '—';
          }
          const status = String(inst.repaymentStatus || '').toUpperCase();
          return (
            <div style={{ display: 'grid', gap: '0.15rem' }}>
              <div style={{ fontWeight: 700 }}>{formatDateTime(inst.installmentDate)}</div>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <RepaymentBadge value={status} />
                {status !== 'PAID' && (
                  <span style={{ background: '#FFF7ED', color: '#9A3412', padding: '0.15rem 0.4rem', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
                    Next due
                  </span>
                )}
              </div>
            </div>
          );
        }
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => { setSelected(row); setShowDetail(true); }} className="btn-neutral">
              View
            </button>
            {hasLateRepayment(row) && (
              <>
                {isBlacklisted(row) ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.25rem 0.55rem',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: '#FEE2E2',
                      color: '#991B1B'
                    }}
                  >
                    Blacklisted
                  </span>
                ) : (
                  <button type="button" onClick={() => openBlacklistModal(row)} className="btn-danger">
                    Blacklist
                  </button>
                )}
              </>
            )}
            {String(row.applicationStatus || '').toUpperCase() === 'PENDING' && (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmAction({ row, action: 'approve' })}
                  className="btn-success"
                  disabled={hasUnpaidNextDueInstallment(row)}
                  title={hasUnpaidNextDueInstallment(row) ? unpaidInstallmentMessage : undefined}
                >
                  Approve
                </button>
                <button type="button" onClick={() => setConfirmAction({ row, action: 'reject' })} className="btn-danger">
                  Reject
                </button>
              </>
            )}
          </div>
        )
      }
  ];

  const handleAction = async () => {
    if (!confirmAction?.row?.id) return;
    const { row, action } = confirmAction;
    if (action === 'approve' && hasUnpaidNextDueInstallment(row)) {
      setError(unpaidInstallmentMessage);
      setConfirmAction(null);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      const payload = { decisionComments: decisionComments || undefined };
      if (action === 'approve') {
        await api.loans.approve(row.id, payload);
        setInfo(`Approved loan ${row.id}.`);
      } else {
        await api.loans.reject(row.id, payload);
        setInfo(`Rejected loan ${row.id}.`);
      }
      setConfirmAction(null);
      setDecisionComments('');
      fetchRows();
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('unpaid installment')) {
        setError(unpaidInstallmentMessage);
      } else {
        setError(err.message);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Loans</div>
          <div style={{ color: 'var(--muted)' }}>Filter, review, and approve/reject loans.</div>
        </div>
        <Link href="/dashboard/loans" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Loans
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Filters</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
            <button type="button" onClick={fetchRows} disabled={loading} className="btn-neutral btn-sm">
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        {showFilters && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="loanType">Loan type</label>
                <input id="loanType" value={filters.loanType} onChange={(e) => setFilters((p) => ({ ...p, loanType: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="applicationStatus">Status</label>
                <select id="applicationStatus" value={filters.applicationStatus} onChange={(e) => setFilters((p) => ({ ...p, applicationStatus: e.target.value }))}>
                  <option value="">All</option>
                  {statusOptions.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="repaymentStatus">Repayment status</label>
                <select id="repaymentStatus" value={filters.repaymentStatus} onChange={(e) => setFilters((p) => ({ ...p, repaymentStatus: e.target.value }))}>
                  <option value="">All</option>
                  {repaymentStatusOptions.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="loanReference">Loan reference</label>
                <input id="loanReference" value={filters.loanReference} onChange={(e) => setFilters((p) => ({ ...p, loanReference: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="transactionReference">Transaction ref</label>
                <input id="transactionReference" value={filters.transactionReference} onChange={(e) => setFilters((p) => ({ ...p, transactionReference: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="externalTransactionReference">External tx ref</label>
                <input
                  id="externalTransactionReference"
                  value={filters.externalTransactionReference}
                  onChange={(e) => setFilters((p) => ({ ...p, externalTransactionReference: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="accountReference">Account ref</label>
                <input id="accountReference" value={filters.accountReference} onChange={(e) => setFilters((p) => ({ ...p, accountReference: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="userEmailOrUsername">Email/Username</label>
                <input id="userEmailOrUsername" value={filters.userEmailOrUsername} onChange={(e) => setFilters((p) => ({ ...p, userEmailOrUsername: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="userPhoneNumber">Phone</label>
                <input id="userPhoneNumber" value={filters.userPhoneNumber} onChange={(e) => setFilters((p) => ({ ...p, userPhoneNumber: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="minAmount">Min amount</label>
                  <input id="minAmount" type="number" value={filters.minAmount} onChange={(e) => setFilters((p) => ({ ...p, minAmount: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="maxAmount">Max amount</label>
                  <input id="maxAmount" type="number" value={filters.maxAmount} onChange={(e) => setFilters((p) => ({ ...p, maxAmount: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="fromDate">Created from</label>
                <input id="fromDate" type="datetime-local" value={filters.fromDate} onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="toDate">Created to</label>
                <input id="toDate" type="datetime-local" value={filters.toDate} onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="page">Page</label>
                  <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="size">Size</label>
                  <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setPage(0);
                  setAppliedFilters(filters);
                }}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Applying…' : 'Apply filters'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters(emptyFilters);
                  setAppliedFilters(emptyFilters);
                  setPage(0);
                }}
                disabled={loading}
                className="btn-neutral"
              >
                Reset
              </button>
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Only applied filters are sent to the API.</span>
            </div>
          </>
        )}

        {activeFilterChips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {activeFilterChips.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                onClear={() => {
                  const next = { ...appliedFilters, [chip.key]: '' };
                  setAppliedFilters(next);
                  setFilters((p) => ({ ...p, [chip.key]: '' }));
                }}
              />
            ))}
          </div>
        )}
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        onPageChange={setPage}
        emptyLabel="No loans found"
        showAccountQuickNav={false}
        rowStyle={(row) => (isBlacklisted(row) ? { background: 'rgba(239, 68, 68, 0.08)' } : undefined)}
      />

      {showDetail && (
        <Modal title={`Loan ${selected?.loanReference || selected?.id}`} onClose={() => { setShowDetail(false); setSelected(null); }}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Reference', value: selected?.loanReference },
              { label: 'Customer', value: selected?.customer },
              { label: 'Given amount', value: formatLocalAndUsdReference(selected, 'givenAmount', 'usdGivenAmount') },
              { label: 'Interest amount', value: formatLocalAndUsdReference(selected, 'interestAmount', 'usdInterestAmount') },
              { label: 'Due amount', value: formatLocalAndUsdReference(selected, 'amount', 'usdAmount') },
              { label: 'Paid amount', value: formatMoney(selected?.paidAmount, selected?.currency) },
              { label: 'Remaining balance', value: formatLocalAndUsdReference(selected, 'remainingBalance', 'usdRemainingBalance') },
              { label: 'USD FX rate', value: selected?.usdFxRate ?? '—' },
              { label: 'Total Fines', value: formatMoney(selected?.fineAmount, selected?.currency) },
              { label: 'Outstanding Fines', value: formatMoney(selected?.outstandingFineAmount, selected?.currency) },
              { label: 'Type', value: selected?.loanType },
              { label: 'Status', value: selected?.applicationStatus },
              {
                label: 'Next due installment',
                value: selected?.nextDueInstallment
                  ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span>{formatDateTime(selected?.nextDueInstallment?.installmentDate)}</span>
                      <RepaymentBadge value={selected?.nextDueInstallment?.repaymentStatus || '—'} />
                    </div>
                    )
                  : isFullyPaid(selected)
                    ? <RepaymentBadge value="PAID" />
                    : '—'
              },
              { label: 'Account ref', value: selected?.accountReference },
              { label: 'User', value: selected?.userEmailOrUsername },
              { label: 'Phone', value: selected?.userPhoneNumber },
              { label: 'Txn ref', value: selected?.transactionReference },
              { label: 'Txn external ref', value: selected?.transactionExternalReference },
              { label: 'Created', value: formatDateTime(selected?.createdAt) }
            ]}
          />
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontWeight: 800, marginBottom: '0.35rem' }}>Installments</div>
            {selected?.loanInstallments?.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: `1px solid var(--border)` }}>
                      <th style={{ padding: '0.4rem' }}>Due date</th>
                      <th style={{ padding: '0.4rem' }}>Amount</th>
                      <th style={{ padding: '0.4rem' }}>Fine</th>
                      <th style={{ padding: '0.4rem' }}>Status</th>
                      <th style={{ padding: '0.4rem' }}>Repayments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.loanInstallments.map((inst) => {
                      const isNext = selected?.nextDueInstallment && inst.id === selected.nextDueInstallment.id;
                      const status = String(inst.repaymentStatus || '').toUpperCase();
                      const highlight = isNext && status !== 'PAID';
                      return (
                        <tr key={inst.id || `${inst.dueDate}-${inst.amount}`} style={{ borderBottom: `1px solid var(--border)` }}>
                          <td style={{ padding: '0.45rem', fontWeight: isNext ? 700 : 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span>{formatDateTime(inst.installmentDate)}</span>
                              {isNext && (
                                <span
                                  style={{
                                    background: highlight ? '#FFF7ED' : '#EFF6FF',
                                    color: highlight ? '#9A3412' : '#1D4ED8',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '999px',
                                    fontSize: '11px',
                                    fontWeight: 800
                                  }}
                                >
                                  Next due
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.45rem' }}>{formatMoney(inst.installmentAmount, inst.currency || selected?.currency)}</td>
                          <td style={{ padding: '0.45rem' }}>{formatMoney(inst.installmentFineAmount, inst.currency || selected?.currency)}</td>
                          <td style={{ padding: '0.45rem' }}>
                            <RepaymentBadge value={inst.repaymentStatus || '—'} />
                          </td>
                          <td style={{ padding: '0.45rem' }}>{renderRepaymentBreakdown(getInstallmentPayments(inst))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: 'var(--muted)' }}>Installments will appear after approval.</div>
            )}
          </div>
        </Modal>
      )}

      {confirmBlacklist && (
        <Modal
          title={`Blacklist account for loan ${confirmBlacklist.loanReference || confirmBlacklist.id}`}
          onClose={() => (!blacklistLoading ? setConfirmBlacklist(null) : null)}
        >
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            Add <strong>{confirmBlacklist.customer || confirmBlacklist.userEmailOrUsername || 'this borrower'}</strong> to the blacklist without leaving this page.
          </div>
          <DetailGrid
            rows={[
              { label: 'Loan', value: confirmBlacklist.loanReference || confirmBlacklist.id },
              { label: 'Customer', value: confirmBlacklist.customer },
              { label: 'Account ref', value: confirmBlacklist.accountReference },
              { label: 'Blacklist', value: isBlacklisted(confirmBlacklist) ? 'Blacklisted' : 'Not blacklisted' },
              { label: 'Repayment', value: <RepaymentBadge value={confirmBlacklist.repaymentStatus || confirmBlacklist.nextDueInstallment?.repaymentStatus || 'LATE'} /> },
              { label: 'Remaining', value: formatLocalAndUsdReference(confirmBlacklist, 'remainingBalance', 'usdRemainingBalance') },
              { label: 'Outstanding fines', value: formatMoney(confirmBlacklist.outstandingFineAmount, confirmBlacklist.currency) }
            ]}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
            <label htmlFor="loanBlacklistReason">Reason (required)</label>
            <textarea
              id="loanBlacklistReason"
              rows={3}
              value={blacklistReason}
              onChange={(e) => setBlacklistReason(e.target.value)}
              placeholder="Reason for blacklisting this account"
              disabled={blacklistLoading}
            />
          </div>
          {blacklistError && <div style={{ color: '#b91c1c', fontWeight: 700, marginTop: '0.75rem' }}>{blacklistError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" onClick={() => setConfirmBlacklist(null)} className="btn-neutral" disabled={blacklistLoading}>
              Cancel
            </button>
            <button
              type="button"
              onClick={submitBlacklistAction}
              className="btn-danger"
              disabled={blacklistLoading}
            >
              {blacklistLoading ? 'Blacklisting…' : 'Confirm blacklist'}
            </button>
          </div>
        </Modal>
      )}

      {confirmAction && (
        <Modal title={`${confirmAction.action === 'approve' ? 'Approve' : 'Reject'} loan ${confirmAction.row.id}`} onClose={() => setConfirmAction(null)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            Are you sure you want to {confirmAction.action} loan <strong>{confirmAction.row.id}</strong> for{' '}
            <strong>{confirmAction.row.borrowerName || confirmAction.row.customer || 'this user'}</strong>?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <label htmlFor="decisionComments">Comments (optional)</label>
            <textarea
              id="decisionComments"
              rows={3}
              value={decisionComments}
              onChange={(e) => setDecisionComments(e.target.value)}
              placeholder="Add a brief note about your decision"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmAction(null)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleAction} className={confirmAction.action === 'approve' ? 'btn-success' : 'btn-danger'}>
              {confirmAction.action === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
