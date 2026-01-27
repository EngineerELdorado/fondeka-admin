'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DataTable } from '@/components/DataTable';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';

const serviceOptions = ['WALLET', 'BILL_PAYMENTS', 'LENDING', 'CARD', 'CRYPTO', 'PAYMENT_REQUEST', 'E_SIM', 'AIRTIME_AND_DATA', 'OTHER'];
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
const balanceEffectOptions = ['CREDIT', 'DEBIT', 'NONE'];
const statusOptions = ['COMPLETED', 'PROCESSING', 'FAILED', 'PENDING', 'CANCELLED', 'REFUNDED', 'REVERSED', 'FUNDED', 'SUBMITTED', 'UNKNOWN'];
const receiptTypes = [
  'GENERIC',
  'BILL_PAYMENT',
  'GIFT_CARD',
  'CARD_PURCHASE',
  'CRYPTO_PAYOUT',
  'CRYPTO_COLLECTION',
  'LOAN_DISBURSEMENT',
  'LOAN_REPAYMENT',
  'WALLET_TRANSFER',
  'AIRTIME',
  'ESIM',
  'PAYMENT_REQUEST'
];
const receiptStatusOptions = ['PROCESSING', 'COMPLETED', 'FAILED'];
const receiptPayloadTemplates = {
  BILL_PAYMENT: { providerReference: '', token: '', meterNumber: '', billerName: '', valueReceived: '', metadata: {} },
  GIFT_CARD: {
    giftCard: { cardNumber: '', pinCode: '', shortInstructions: '', longInstructions: '' },
    providerReference: '',
    value: ''
  },
  CARD_PURCHASE: { last4: '', cardholderName: '', providerCardRef: '', activationStatus: '', deliveryInfo: '' },
  CRYPTO_PAYOUT: { txHash: '', network: '', explorerUrl: '', amount: '', address: '' },
  CRYPTO_COLLECTION: { invoiceUrl: '', address: '', network: '', amountRequested: '', amountReceived: '', txHash: '' },
  LOAN_REPAYMENT: { amountApplied: '', remainingDue: '', nextDueDate: '', loanRef: '' },
  LOAN_DISBURSEMENT: { disbursedAmount: '', destination: '', dueDate: '', loanRef: '' },
  WALLET_TRANSFER: { destination: '', providerReference: '', fees: '', netAmount: '' },
  AIRTIME: { providerReference: '', token: '', destination: '', valueReceived: '' },
  ESIM: { providerReference: '', qr: '', pin: '', puk: '', instructions: '' },
  PAYMENT_REQUEST: { payer: '', requestReference: '', providerReference: '', note: '' },
  GENERIC: { reference: '', note: '' }
};

const serviceLabels = {
  WALLET: 'Wallet',
  BILL_PAYMENTS: 'Bill payments',
  LENDING: 'Lending',
  CARD: 'Card',
  CRYPTO: 'Crypto',
  PAYMENT_REQUEST: 'Payment request',
  E_SIM: 'eSIM',
  AIRTIME_AND_DATA: 'Airtime & data',
  OTHER: 'Other'
};

const actionLabels = {
  FUND_WALLET: 'Fund wallet',
  WITHDRAW_FROM_WALLET: 'Withdraw from wallet',
  REFUND_TO_WALLET: 'Refund to wallet',
  BONUS: 'Bonus',
  PAY_INTERNET_BILL: 'Pay internet bill',
  PAY_TV_SUBSCRIPTION: 'TV subscription',
  PAY_ELECTRICITY_BILL: 'Electricity payment',
  PAY_WATER_BILL: 'Pay water bill',
  LOAN_REQUEST: 'Loan request',
  LOAN_DISBURSEMENT: 'Loan disbursement',
  REPAY_LOAN: 'Repay loan',
  FUND_CARD: 'Fund card',
  WITHDRAW_FROM_CARD: 'Withdraw from card',
  BUY_CARD: 'Buy card',
  CARD_ONLINE_PAYMENT: 'Card online payment',
  BUY_CRYPTO: 'Buy crypto',
  SELL_CRYPTO: 'Sell crypto',
  RECEIVE_CRYPTO: 'Receive crypto',
  SEND_CRYPTO: 'Send crypto',
  SWAP_CRYPTO: 'Swap crypto',
  REQUEST_PAYMENT: 'Request payment',
  PAY_REQUEST: 'Pay request',
  E_SIM_PURCHASE: 'eSIM purchase',
  E_SIM_TOPUP: 'eSIM top up',
  SEND_AIRTIME: 'Send airtime',
  SEND_DATA_BUNDLES: 'Send data bundles',
  BUY_GIFT_CARD: 'Buy gift card',
  PAY_NETFLIX: 'Pay Netflix',
  INTER_TRANSFER: 'Inter transfer',
  OTHER: 'Other'
};

const initialFilters = {
  transactionId: '',
  reference: '',
  externalReference: '',
  operatorReference: '',
  action: '',
  service: '',
  balanceEffect: '',
  status: '',
  paymentMethodName: '',
  paymentMethodId: '',
  paymentProviderId: '',
  paymentMethodPaymentProviderId: '',
  userNameContains: '',
  refunded: '',
  needsManualRefund: '',
  startDate: '',
  endDate: ''
};

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

const normalizeEnumKey = (value) => String(value || '').trim().replace(/\s+/g, '_').toUpperCase();

const formatEnumLabel = (value, overrides = {}) => {
  const normalized = normalizeEnumKey(value);
  if (!normalized) return '—';
  if (overrides[normalized]) return overrides[normalized];
  const words = normalized
    .split('_')
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (lower === 'id') return 'ID';
      if (!lower) return '';
      if (index === 0) return lower.charAt(0).toUpperCase() + lower.slice(1);
      return lower;
    })
    .filter(Boolean)
    .join(' ');
  return words || '—';
};

const formatWebhookPayload = (payload) => {
  if (payload === null || payload === undefined) return '';
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
};

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const queryFilters = useMemo(() => {
    const transactionId = searchParams.get('transactionId');
    const statusParam = searchParams.get('status');
    const next = {};
    if (transactionId) next.transactionId = transactionId;
    if (statusParam) {
      const normalized = normalizeEnumKey(statusParam);
      if (statusOptions.includes(normalized)) next.status = normalized;
    }
    return next;
  }, [searchParams]);
  const hasQueryFilters = Object.keys(queryFilters).length > 0;
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [filters, setFilters] = useState(() => ({ ...initialFilters, ...queryFilters }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...initialFilters, ...queryFilters }));
  const [showFilters, setShowFilters] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentProviders, setPaymentProviders] = useState([]);
  const [pmps, setPmps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [accountSummary, setAccountSummary] = useState(null);
  const [accountLoading, setAccountLoading] = useState(false);

  const [receipt, setReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptDeleteLoading, setReceiptDeleteLoading] = useState(false);
  const [showReceiptDelete, setShowReceiptDelete] = useState(false);
  const [receiptType, setReceiptType] = useState('');
  const [receiptStatus, setReceiptStatus] = useState('');
  const [receiptHumanMessage, setReceiptHumanMessage] = useState('');
  const [receiptPayload, setReceiptPayload] = useState('{}');
  const [receiptTemplateKey, setReceiptTemplateKey] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [billStatusAuditLogs, setBillStatusAuditLogs] = useState([]);
  const [billStatusAuditLoading, setBillStatusAuditLoading] = useState(false);
  const [billStatusAuditError, setBillStatusAuditError] = useState(null);

  const [showRefund, setShowRefund] = useState(false);
  const [refundNote, setRefundNote] = useState('');
  const [refundError, setRefundError] = useState(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundLookupInternalRef, setRefundLookupInternalRef] = useState('');
  const [refundLookupTransactionId, setRefundLookupTransactionId] = useState('');
  const [refundLookupResult, setRefundLookupResult] = useState(null);
  const [refundLookupError, setRefundLookupError] = useState(null);
  const [refundLookupLoading, setRefundLookupLoading] = useState(null);
  const [showReplayConfirm, setShowReplayConfirm] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState(null);
  const [refetchBillStatusLoading, setRefetchBillStatusLoading] = useState(false);
  const [showBankPayoutComplete, setShowBankPayoutComplete] = useState(false);
  const [bankPayoutMessage, setBankPayoutMessage] = useState('');
  const [bankPayoutError, setBankPayoutError] = useState(null);
  const [bankPayoutLoading, setBankPayoutLoading] = useState(false);
  const webhookEvents = Array.isArray(selected?.webhookEvents) ? selected.webhookEvents : [];
  const normalizedStatus = selected?.status?.toUpperCase?.() || '';
  const showErrorMessage = ['FAILED', 'CANCELED', 'CANCELLED'].includes(normalizedStatus);

  const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const fetchRowsFor = async ({ targetPage, targetSize, targetFilters }) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(targetPage), size: String(targetSize) });
      const addIf = (key, value) => {
        if (value !== '' && value !== null && value !== undefined) params.set(key, String(value));
      };
      Object.entries(targetFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        if (['paymentMethodId', 'paymentProviderId', 'paymentMethodPaymentProviderId'].includes(key)) {
          const num = Number(value);
          if (!Number.isNaN(num)) addIf(key, num);
        } else if (key === 'transactionId') {
          addIf(key, value);
        } else if (['startDate', 'endDate'].includes(key)) {
          const ts = Date.parse(value);
          if (!Number.isNaN(ts)) addIf(key, ts);
        } else if (key === 'refunded') {
          addIf(key, value);
        } else {
          addIf(key, value);
        }
      });
      const res = await api.transactions.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      return list || [];
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchRows = async () => fetchRowsFor({ targetPage: page, targetSize: size, targetFilters: appliedFilters });

  const manualRefundViewActive = appliedFilters.needsManualRefund === 'true';
  const equityMethod = useMemo(
    () =>
      paymentMethods.find((pm) => {
        const name = normalizeEnumKey(pm?.name || pm?.displayName);
        return name === 'EQUITY_DRC';
      }),
    [paymentMethods]
  );
  const bankPayoutViewActive = useMemo(() => {
    const status = normalizeEnumKey(appliedFilters.status);
    const action = normalizeEnumKey(appliedFilters.action);
    const name = normalizeEnumKey(appliedFilters.paymentMethodName);
    const idMatch = equityMethod?.id && String(appliedFilters.paymentMethodId) === String(equityMethod.id);
    return status === 'FUNDED' && action === 'WITHDRAW_FROM_WALLET' && (name === 'EQUITY_DRC' || idMatch);
  }, [appliedFilters, equityMethod]);
  const showAllTransactions = () => {
    setPage(0);
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
  };
  const showManualRefunds = () => {
    const next = { ...initialFilters, needsManualRefund: 'true' };
    setPage(0);
    setFilters(next);
    setAppliedFilters(next);
  };
  const showBankPayouts = () => {
    const next = {
      ...initialFilters,
      status: 'FUNDED',
      action: 'WITHDRAW_FROM_WALLET',
      paymentMethodName: 'EQUITY_DRC'
    };
    if (equityMethod?.id) {
      next.paymentMethodId = String(equityMethod.id);
    }
    setPage(0);
    setFilters(next);
    setAppliedFilters(next);
  };

  const renderStatusBadge = (value) => {
    if (!value) return '—';
    const val = String(value).toUpperCase();
    const tone =
      val === 'COMPLETED'
        ? { bg: '#ECFDF3', fg: '#15803D' }
        : val === 'PROCESSING'
          ? { bg: '#EFF6FF', fg: '#1D4ED8' }
          : val === 'FAILED'
            ? { bg: '#FEF2F2', fg: '#B91C1C' }
            : val === 'CANCELED' || val === 'CANCELLED'
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

  const loadReceipt = async (transactionId) => {
    if (!transactionId) return;
    setReceiptLoading(true);
    setReceiptError(null);
    try {
      const res = await api.transactions.getReceipt(transactionId);
      setReceipt(res || null);
    } catch (err) {
      setReceipt(null);
      if (err?.status !== 404) {
        const message = err?.message || 'Failed to load receipt';
        setReceiptError(message);
        pushToast({ tone: 'error', message });
      }
    } finally {
      setReceiptLoading(false);
    }
  };

  const loadReceiptAuditLogs = async (transactionId) => {
    if (!transactionId) return;
    setAuditLoading(true);
    setAuditError(null);
    try {
      const params = new URLSearchParams({
        action: 'RECEIPT_BACKFILL',
        targetType: 'transaction',
        targetId: String(transactionId),
        page: '0',
        size: '20'
      });
      const res = await api.auditLogs.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setAuditLogs(list || []);
    } catch (err) {
      setAuditLogs([]);
      setAuditError(err?.message || 'Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  const loadBillStatusAuditLogs = async (transactionId) => {
    if (!transactionId) return;
    setBillStatusAuditLoading(true);
    setBillStatusAuditError(null);
    try {
      const params = new URLSearchParams({
        action: 'BILL_STATUS_REFETCH',
        targetType: 'transaction',
        targetId: String(transactionId),
        page: '0',
        size: '20'
      });
      const res = await api.auditLogs.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setBillStatusAuditLogs(list || []);
    } catch (err) {
      setBillStatusAuditLogs([]);
      setBillStatusAuditError(err?.message || 'Failed to load audit logs');
    } finally {
      setBillStatusAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hasQueryFilters) return;
    setPage(0);
    setFilters((prev) => ({ ...prev, ...queryFilters }));
    setAppliedFilters((prev) => ({ ...prev, ...queryFilters }));
  }, [hasQueryFilters, queryFilters]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [pmRes, provRes, pmpRes] = await Promise.all([
          api.paymentMethods.list(new URLSearchParams({ page: '0', size: '200' })),
          api.paymentProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.paymentMethodPaymentProviders.list(new URLSearchParams({ page: '0', size: '200' }))
        ]);
        const toList = (res) => (Array.isArray(res) ? res : res?.content || []);
        setPaymentMethods(toList(pmRes));
        setPaymentProviders(toList(provRes));
        setPmps(toList(pmpRes));
      } catch {
        // soft fail on options fetch
      }
    };
    fetchOptions();
  }, []);

  const applyFilters = () => {
    setPage(0);
    setAppliedFilters(filters);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(0);
  };

  const clearQueryFilters = () => {
    router.replace('/dashboard/transactions');
    resetFilters();
  };

  const activeFilterChips = useMemo(() => {
    const entries = [];
    const add = (label, key) => {
      entries.push({
        label,
        key
      });
    };
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
        switch (key) {
        case 'transactionId':
          add(`Transaction ID: ${value}`, key);
          break;
        case 'reference':
          add(`Reference: ${value}`, key);
          break;
        case 'externalReference':
          add(`External: ${value}`, key);
          break;
        case 'operatorReference':
          add(`Operator ref: ${value}`, key);
          break;
        case 'action':
          add(`Action: ${formatEnumLabel(value, actionLabels)}`, key);
          break;
        case 'service':
          add(`Service: ${formatEnumLabel(value, serviceLabels)}`, key);
          break;
        case 'balanceEffect':
          add(`Effect: ${value}`, key);
          break;
        case 'status':
          add(`Status: ${formatEnumLabel(value, { CANCELLED: 'Canceled' })}`, key);
          break;
        case 'paymentMethodId':
          add(`Payment method #${value}`, key);
          break;
        case 'paymentMethodName':
          add(`Payment method: ${value}`, key);
          break;
        case 'paymentProviderId':
          add(`Payment provider #${value}`, key);
          break;
        case 'paymentMethodPaymentProviderId':
          add(`PMPP #${value}`, key);
          break;
        case 'userNameContains':
          add(`Username contains: ${value}`, key);
          break;
        case 'refunded':
          add(`Refunded: ${value}`, key);
          break;
        case 'needsManualRefund':
          add(`Needs manual refund: ${value}`, key);
          break;
        case 'startDate':
          add(`From: ${value}`, key);
          break;
        case 'endDate':
          add(`To: ${value}`, key);
          break;
        default:
          break;
      }
    });
    return entries;
  }, [appliedFilters]);

  const columns = useMemo(
    () => [
      {
        key: 'id',
        label: 'ID',
        render: (row) => row.transactionId || row.id
      },
      {
        key: 'createdAt',
        label: 'Created',
        render: (row) => formatDateTime(row.createdAt)
      },
      { key: 'reference', label: 'Reference' },
      {
        key: 'action',
        label: 'Action',
        render: (row) => formatEnumLabel(row.action, actionLabels)
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => renderStatusBadge(row.status)
      },
      {
        key: 'amount',
        label: 'Amount',
        render: (row) => `${row.amount ?? '—'} ${row.currency || ''}`.trim()
      },
      {
        key: 'paymentMethodName',
        label: 'Method',
        render: (row) => row.paymentMethodName || row.paymentMethodId || '—'
      },
      {
        key: 'paymentProviderName',
        label: 'Provider',
        render: (row) => row.paymentProviderName || row.paymentProviderId || '—'
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral">
              View
            </button>
          </div>
        )
      }
    ],
    []
  );

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
    setShowRefund(false);
    setRefundNote('');
    setRefundError(null);
    setRefundLookupResult(null);
    setRefundLookupError(null);
    setRefundLookupLoading(null);
    setRefundLookupInternalRef(row?.internalReference || row?.reference || '');
    setRefundLookupTransactionId(String(row?.transactionId || row?.id || ''));
    setAccountSummary(null);
    setReceipt(null);
    setReceiptError(null);
    setShowReceiptForm(false);
    setReceiptPayload('{}');
    setShowReceiptDelete(false);
    setReceiptTemplateKey('');
    setBillStatusAuditLogs([]);
    setBillStatusAuditError(null);
    setShowBankPayoutComplete(false);
    setBankPayoutMessage('');
    setBankPayoutError(null);
  };

  const showRefundTransaction = async ({ refundReference, refundTransactionId }) => {
    if (!refundReference && !refundTransactionId) return;

    const next = { ...initialFilters, reference: refundReference ? String(refundReference) : '' };
    setPage(0);
    setFilters(next);
    setAppliedFilters(next);
    setShowRefund(false);
    setShowDetail(false);

    if (refundReference) {
      pushToast({ tone: 'success', message: `Showing refund transaction: ${refundReference}` });
    }

    const list = await fetchRowsFor({ targetPage: 0, targetSize: size, targetFilters: next });
    if (!list || list.length === 0) return;

    const match = refundTransactionId
      ? list.find((t) => String(t.transactionId || t.id) === String(refundTransactionId)) || list[0]
      : list[0];
    if (match) openDetail(match);
  };

  const loadAccountSummary = async (txn) => {
    if (!txn) return;
    setAccountLoading(true);
    try {
      if (txn.accountId !== undefined && txn.accountId !== null && txn.accountId !== '') {
        const acc = await api.accounts.get(txn.accountId);
        setAccountSummary(acc || null);
        return;
      }
      if (txn.accountReference) {
        const params = new URLSearchParams({ page: '0', size: '1', accountReference: String(txn.accountReference) });
        const res = await api.accounts.list(params);
        const list = Array.isArray(res) ? res : res?.content || [];
        setAccountSummary(list?.[0] || null);
      }
    } catch (err) {
      setAccountSummary(null);
      pushToast({ tone: 'error', message: err.message || 'Failed to load account balance' });
    } finally {
      setAccountLoading(false);
    }
  };

  useEffect(() => {
    if (!showDetail || !selected) return;
    loadAccountSummary(selected);
    const transactionId = selected?.transactionId || selected?.id;
    loadReceipt(transactionId);
    loadReceiptAuditLogs(transactionId);
    const service = String(selected?.service || '').toUpperCase();
    if (service === 'BILL_PAYMENTS') {
      loadBillStatusAuditLogs(transactionId);
    }
  }, [showDetail, selected?.transactionId, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canRefundSelected = useMemo(() => {
    if (!selected) return false;
    const effect = String(selected.balanceEffect || '').toUpperCase();
    const status = String(selected.status || '').toUpperCase();
    const refunded = Boolean(selected.refunded) || Boolean(selected.refundedAt);
    return effect === 'DEBIT' && (status === 'FAILED' || status === 'PROCESSING') && !refunded;
  }, [selected]);

  const canReplayFulfillment = useMemo(() => {
    if (!selected) return false;
    const status = String(selected.status || '').toUpperCase();
    const action = String(selected.action || '').toUpperCase();
    if (action === 'LOAN_REQUEST') return false;
    return status !== 'FAILED' && status !== 'CANCELED' && status !== 'CANCELLED';
  }, [selected]);

  const canRefetchBillStatus = useMemo(() => {
    if (!selected) return false;
    const service = String(selected.service || '').toUpperCase();
    const status = String(selected.status || '').toUpperCase();
    if (service !== 'BILL_PAYMENTS') return false;
    return status !== 'FAILED' && status !== 'CANCELED' && status !== 'CANCELLED';
  }, [selected]);

  const bankPayoutMeta = useMemo(() => {
    if (!selected) {
      return { eligible: false, methodName: '', methodType: '', status: '', action: '' };
    }
    const status = normalizeEnumKey(selected?.status);
    const action = normalizeEnumKey(selected?.action);
    const selectedMethodName = normalizeEnumKey(selected?.paymentMethodName);
    const selectedMethodId = selected?.paymentMethodId;
    const methodMatch = paymentMethods.find((pm) => {
      if (selectedMethodId && String(pm.id) === String(selectedMethodId)) return true;
      const name = normalizeEnumKey(pm?.name || pm?.displayName);
      return name && name === selectedMethodName;
    });
    const methodName = normalizeEnumKey(selected?.paymentMethodName || methodMatch?.name || methodMatch?.displayName);
    const methodType = normalizeEnumKey(selected?.paymentMethodType || methodMatch?.type);
    const meetsName = methodName === 'EQUITY_DRC';
    const meetsType = !methodType || methodType === 'BANK';
    const eligible = status === 'FUNDED' && action === 'WITHDRAW_FROM_WALLET' && meetsName && meetsType;
    return { eligible, methodName, methodType, status, action };
  }, [paymentMethods, selected]);

  const handleCompleteBankPayout = async () => {
    const transactionId = selected?.transactionId || selected?.id;
    if (!transactionId) {
      setBankPayoutError('Missing transaction id');
      return;
    }
    setBankPayoutLoading(true);
    setBankPayoutError(null);
    try {
      const payload = bankPayoutMessage?.trim() ? { message: bankPayoutMessage.trim() } : undefined;
      const res = await api.transactions.completeBankPayout(transactionId, payload);
      pushToast({ tone: 'success', message: 'Bank payout marked as completed.' });
      setShowBankPayoutComplete(false);
      setBankPayoutMessage('');
      setSelected((prev) => ({ ...(prev || {}), ...(res || {}), status: res?.status || 'COMPLETED' }));
      await fetchRows();
      await loadReceipt(transactionId);
    } catch (err) {
      const message = err?.message || 'Failed to complete bank payout';
      setBankPayoutError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setBankPayoutLoading(false);
    }
  };

  const handleReplayFulfillment = async () => {
    const transactionId = selected?.transactionId || selected?.id;
    if (!transactionId) {
      setReplayError('Missing transaction id');
      return;
    }
    setReplayLoading(true);
    setReplayError(null);
    try {
      await api.transactions.replayLoanFulfillment(transactionId, 'CREDIT');
      pushToast({ tone: 'success', message: 'Loan fulfillment replay started.' });
      setShowReplayConfirm(false);
      await fetchRows();
      await loadReceipt(transactionId);
    } catch (err) {
      const message = err?.message || 'Failed to replay loan fulfillment';
      setReplayError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setReplayLoading(false);
    }
  };

  const handleRefetchBillStatus = async () => {
    const transactionId = selected?.transactionId || selected?.id;
    if (!transactionId) {
      pushToast({ tone: 'error', message: 'Missing transaction id' });
      return;
    }
    setRefetchBillStatusLoading(true);
    try {
      await api.transactions.refetchBillStatus(transactionId);
      pushToast({ tone: 'success', message: 'Bill status refetch requested.' });
      await loadBillStatusAuditLogs(transactionId);
    } catch (err) {
      const message = err?.message || 'Failed to refetch bill status';
      pushToast({ tone: 'error', message });
    } finally {
      setRefetchBillStatusLoading(false);
    }
  };

  const openReceiptForm = () => {
    setReceiptError(null);
    setReceiptSaving(false);
    setReceiptDeleteLoading(false);
    setShowReceiptForm(true);
    setReceiptType(receipt?.type || selected?.service || '');
    setReceiptStatus(receipt?.status || selected?.status || '');
    setReceiptHumanMessage(receipt?.humanMessage || '');
    const payloadText = receipt?.payload ? JSON.stringify(receipt.payload, null, 2) : '{}';
    setReceiptPayload(payloadText);
    setReceiptTemplateKey('');
  };

  const submitReceipt = async () => {
    setReceiptError(null);
    const transactionId = selected?.transactionId || selected?.id;
    if (!transactionId) {
      setReceiptError('Missing transaction id');
      return;
    }

    let parsedPayload = undefined;
    if (receiptPayload && receiptPayload.trim()) {
      try {
        parsedPayload = JSON.parse(receiptPayload);
      } catch (err) {
        setReceiptError(`Payload must be valid JSON: ${err.message}`);
        return;
      }
    }

    const body = {
      ...(receiptType ? { type: receiptType } : {}),
      ...(receiptStatus ? { status: receiptStatus } : {}),
      ...(receiptHumanMessage?.trim() ? { humanMessage: receiptHumanMessage.trim() } : {}),
      ...(parsedPayload !== undefined ? { payload: parsedPayload } : {})
    };

    setReceiptSaving(true);
    try {
      const res = await api.transactions.upsertReceipt(transactionId, body);
      setReceipt(res || body || {});
      setShowReceiptForm(false);
      pushToast({ tone: 'success', message: 'Receipt saved' });
      await loadReceipt(transactionId);
    } catch (err) {
      const message = err?.message || 'Failed to save receipt';
      setReceiptError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setReceiptSaving(false);
    }
  };

  const applyReceiptTemplate = (key) => {
    setReceiptTemplateKey(key);
    if (!key) return;
    const template = receiptPayloadTemplates[key];
    if (!template) return;
    setReceiptPayload(JSON.stringify(template, null, 2));
    if (!receiptType) setReceiptType(key);
  };

  const deleteReceipt = async () => {
    setReceiptError(null);
    const transactionId = selected?.transactionId || selected?.id;
    if (!transactionId) {
      setReceiptError('Missing transaction id');
      return;
    }
    setReceiptDeleteLoading(true);
    try {
      await api.transactions.deleteReceipt(transactionId);
      setReceipt(null);
      setShowReceiptForm(false);
      setShowReceiptDelete(false);
      pushToast({ tone: 'success', message: 'Receipt removed' });
    } catch (err) {
      const message = err?.message || 'Failed to delete receipt';
      setReceiptError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setReceiptDeleteLoading(false);
    }
  };

  const submitRefund = async () => {
    setRefundError(null);
    const transactionId = selected?.transactionId || selected?.id;
    if (!transactionId) {
      setRefundError('Missing transaction id');
      return;
    }

    setRefundLoading(true);
    try {
      const payload = refundNote?.trim() ? { note: refundNote.trim() } : undefined;
      const res = await api.transactions.refundToWallet(transactionId, payload);
      pushToast({ tone: 'success', message: `Refund created: ${res?.refundReference || '—'}` });
      setShowRefund(false);
      setRefundNote('');

      setSelected((prev) => ({
        ...(prev || {}),
        refunded: true,
        refundedAt: res?.refundedAt || prev?.refundedAt,
        refundReference: res?.refundReference,
        refundTransactionId: res?.refundTransactionId,
        needsManualRefund: false
      }));

      await fetchRows();
      await loadAccountSummary(selected);
      await showRefundTransaction({ refundReference: res?.refundReference, refundTransactionId: res?.refundTransactionId });
    } catch (err) {
      const message = err?.message || 'Refund failed';
      setRefundError(message);
      pushToast({ tone: 'error', message });
      if (String(message).toLowerCase().includes('already refunded')) {
        setSelected((prev) => ({ ...(prev || {}), refunded: true }));
      }
    } finally {
      setRefundLoading(false);
    }
  };

  const lookupRefundByInternalReference = async () => {
    const trimmed = refundLookupInternalRef.trim();
    if (!trimmed) {
      setRefundLookupError('Enter an internal reference to look up.');
      return;
    }
    setRefundLookupError(null);
    setRefundLookupResult(null);
    setRefundLookupLoading('internal');
    try {
      const res = await api.transactions.refundLookupByInternalReference(trimmed);
      setRefundLookupResult(res);
    } catch (err) {
      setRefundLookupError(err?.message || 'Refund lookup failed.');
    } finally {
      setRefundLookupLoading(null);
    }
  };

  const lookupRefundByTransactionId = async () => {
    const trimmed = String(refundLookupTransactionId || '').trim();
    if (!trimmed) {
      setRefundLookupError('Enter a transaction id to look up.');
      return;
    }
    setRefundLookupError(null);
    setRefundLookupResult(null);
    setRefundLookupLoading('transaction');
    try {
      const res = await api.transactions.refundLookupByTransactionId(trimmed);
      setRefundLookupResult(res);
    } catch (err) {
      setRefundLookupError(err?.message || 'Refund lookup failed.');
    } finally {
      setRefundLookupLoading(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Transactions</div>
          <div style={{ color: 'var(--muted)' }}>Trace transactions with deep filters and quick drill-down.</div>
        </div>
        <Link href="/dashboard" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Dashboard
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
              {loading ? 'Refreshing…' : 'Refresh data'}
            </button>
          </div>
        </div>
        {showFilters && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>View</span>
              <button type="button" onClick={showAllTransactions} className={manualRefundViewActive || bankPayoutViewActive ? 'btn-neutral btn-sm' : 'btn-primary btn-sm'}>
                All transactions
              </button>
              <button type="button" onClick={showManualRefunds} className={manualRefundViewActive ? 'btn-primary btn-sm' : 'btn-neutral btn-sm'}>
                Manual refunds
              </button>
              <button type="button" onClick={showBankPayouts} className={bankPayoutViewActive ? 'btn-primary btn-sm' : 'btn-neutral btn-sm'}>
                Bank payouts (Equity DRC)
              </button>
              {manualRefundViewActive && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Showing needsManualRefund=true</span>}
              {bankPayoutViewActive && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Showing FUNDED + WITHDRAW_FROM_WALLET + EQUITY_DRC</span>}
            </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="transactionId">Transaction ID</label>
            <input id="transactionId" value={filters.transactionId} onChange={(e) => setFilters((p) => ({ ...p, transactionId: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="reference">Reference</label>
            <input id="reference" value={filters.reference} onChange={(e) => setFilters((p) => ({ ...p, reference: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="externalReference">External ref</label>
            <input id="externalReference" value={filters.externalReference} onChange={(e) => setFilters((p) => ({ ...p, externalReference: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="operatorReference">Operator ref</label>
            <input id="operatorReference" value={filters.operatorReference} onChange={(e) => setFilters((p) => ({ ...p, operatorReference: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="userNameContains">Email or Phone</label>
            <input id="userNameContains" value={filters.userNameContains} onChange={(e) => setFilters((p) => ({ ...p, userNameContains: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="service">Service</label>
            <select id="service" value={filters.service} onChange={(e) => setFilters((p) => ({ ...p, service: e.target.value }))}>
              <option value="">All</option>
              {serviceOptions.map((svc) => (
                <option key={svc} value={svc}>
                  {formatEnumLabel(svc, serviceLabels)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="action">Action</label>
            <select id="action" value={filters.action} onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value }))}>
              <option value="">All</option>
              {actionOptions.map((act) => (
                <option key={act} value={act}>
                  {formatEnumLabel(act, actionLabels)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="balanceEffect">Effect</label>
            <select id="balanceEffect" value={filters.balanceEffect} onChange={(e) => setFilters((p) => ({ ...p, balanceEffect: e.target.value }))}>
              <option value="">Any</option>
              {balanceEffectOptions.map((be) => (
                <option key={be} value={be}>
                  {be}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="status">Status</label>
            <select id="status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Any</option>
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="paymentMethodName">Payment method name</label>
            <input
              id="paymentMethodName"
              value={filters.paymentMethodName}
              onChange={(e) => setFilters((p) => ({ ...p, paymentMethodName: e.target.value }))}
              placeholder="EQUITY_DRC"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="paymentMethodId">Payment method</label>
            <select id="paymentMethodId" value={filters.paymentMethodId} onChange={(e) => setFilters((p) => ({ ...p, paymentMethodId: e.target.value }))}>
              <option value="">Any</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name || pm.displayName || pm.id}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="paymentProviderId">Payment provider</label>
            <select id="paymentProviderId" value={filters.paymentProviderId} onChange={(e) => setFilters((p) => ({ ...p, paymentProviderId: e.target.value }))}>
              <option value="">Any</option>
              {paymentProviders.map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.name || prov.displayName || prov.id}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="paymentMethodPaymentProviderId">PMPP</label>
            <select
              id="paymentMethodPaymentProviderId"
              value={filters.paymentMethodPaymentProviderId}
              onChange={(e) => setFilters((p) => ({ ...p, paymentMethodPaymentProviderId: e.target.value }))}
            >
              <option value="">Any</option>
              {pmps.map((pmp) => (
                <option key={pmp.id} value={pmp.id}>
                  {(pmp.paymentMethodName || pmp.paymentMethodDisplayName || 'Method') + ' → ' + (pmp.paymentProviderName || 'Provider')}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="refunded">Refunded</label>
            <select id="refunded" value={filters.refunded} onChange={(e) => setFilters((p) => ({ ...p, refunded: e.target.value }))}>
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="needsManualRefund">Needs manual refund</label>
            <select
              id="needsManualRefund"
              value={filters.needsManualRefund}
              onChange={(e) => setFilters((p) => ({ ...p, needsManualRefund: e.target.value }))}
            >
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="startDate">Start date</label>
            <input id="startDate" type="datetime-local" value={filters.startDate} onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="endDate">End date</label>
            <input id="endDate" type="datetime-local" value={filters.endDate} onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))} />
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
          <button type="button" onClick={applyFilters} disabled={loading} className="btn-primary">
            {loading ? 'Applying…' : 'Apply filters'}
          </button>
          <button type="button" onClick={resetFilters} disabled={loading} className="btn-neutral">
            Reset
          </button>
          {hasQueryFilters && (
            <button type="button" onClick={clearQueryFilters} disabled={loading} className="btn-neutral">
              Clear query filters
            </button>
          )}
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Set filters then apply to query.</span>
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

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}
      {info && (
        <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>
          {info}
        </div>
      )}

      <DataTable columns={columns} rows={rows} emptyLabel="No transactions found" />

      {showDetail && (
        <Modal title={`Transaction ${selected?.reference || selected?.id}`} onClose={() => setShowDetail(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <DetailGrid
              rows={[
                { label: 'Transaction ID', value: selected?.transactionId || selected?.id },
                { label: 'Created', value: formatDateTime(selected?.createdAt) },
                { label: 'Reference', value: selected?.reference },
                { label: 'External ref', value: selected?.externalReference },
                { label: 'Operator ref', value: selected?.operatorReference },
                { label: 'Internal ref', value: selected?.internalReference || '—' },
                { label: 'Service', value: formatEnumLabel(selected?.service, serviceLabels) },
                { label: 'Action', value: formatEnumLabel(selected?.action, actionLabels) },
                { label: 'Effect', value: selected?.balanceEffect },
                { label: 'Status', value: selected?.status },
                { label: 'Amount', value: `${selected?.amount ?? '—'} ${selected?.currency || ''}`.trim() },
                { label: 'Account ref', value: selected?.accountReference || '—' },
                { label: 'Account balance', value: accountLoading ? 'Loading…' : accountSummary?.balance ?? '—' },
                { label: 'Gross amount', value: selected?.grossAmount },
                { label: 'External fee', value: selected?.externalFeeAmount },
                { label: 'Internal fee', value: selected?.internalFeeAmount },
                { label: 'Other fees', value: selected?.otherFeesAmount },
                { label: 'All fees', value: selected?.allFees },
                { label: 'Commission amount', value: selected?.commissionAmount },
                { label: 'Recipient', value: selected?.recipient },
                { label: 'Payment method', value: selected?.paymentMethodName || selected?.paymentMethodId },
                ...(selected?.paymentMethodType ? [{ label: 'Payment method type', value: selected?.paymentMethodType }] : []),
                { label: 'Payment provider', value: selected?.paymentProviderName || selected?.paymentProviderId },
                { label: 'Refunded', value: selected?.refunded || selected?.refundedAt ? 'Yes' : 'No' },
                { label: 'Refunded at', value: formatDateTime(selected?.refundedAt) },
                { label: 'Needs manual refund', value: selected?.needsManualRefund ? 'Yes' : 'No' },
                { label: 'Refund ref', value: selected?.refundReference || '—' },
                { label: 'Refund txn ID', value: selected?.refundTransactionId || '—' },
                ...(showErrorMessage ? [{ label: 'Error message', value: selected?.errorMessage || '—' }] : [])
              ]}
            />

            {normalizeEnumKey(selected?.action) === 'WITHDRAW_FROM_WALLET' && (
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <div style={{ fontWeight: 800 }}>Bank payout completion</div>
                    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                      Mark FUNDED Equity DRC bank payouts as completed after manual transfer.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-success btn-sm"
                    onClick={() => {
                      setBankPayoutError(null);
                      setShowBankPayoutComplete(true);
                    }}
                    disabled={!bankPayoutMeta.eligible}
                  >
                    Complete payout
                  </button>
                </div>
                <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.6rem' }}>
                  <DetailGrid
                    rows={[
                      { label: 'Status', value: selected?.status || '—' },
                      { label: 'Action', value: formatEnumLabel(selected?.action, actionLabels) },
                      { label: 'Method name', value: selected?.paymentMethodName || '—' },
                      { label: 'Method type', value: selected?.paymentMethodType || '—' }
                    ]}
                  />
                  {!bankPayoutMeta.eligible && (
                    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                      Requires status FUNDED, action WITHDRAW_FROM_WALLET, and payment method EQUITY_DRC (BANK).
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <div style={{ fontWeight: 800 }}>Refund lookup</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Verify whether a refund transaction exists.</div>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor="refundLookupInternal">Internal reference</label>
                    <input
                      id="refundLookupInternal"
                      value={refundLookupInternalRef}
                      onChange={(e) => setRefundLookupInternalRef(e.target.value)}
                      placeholder="TX915714962162"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="btn-neutral btn-sm" onClick={lookupRefundByInternalReference} disabled={refundLookupLoading === 'internal'}>
                      {refundLookupLoading === 'internal' ? 'Looking up...' : 'Lookup by reference'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor="refundLookupTransaction">Transaction id</label>
                    <input
                      id="refundLookupTransaction"
                      value={refundLookupTransactionId}
                      onChange={(e) => setRefundLookupTransactionId(e.target.value)}
                      placeholder="12345"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="btn-neutral btn-sm" onClick={lookupRefundByTransactionId} disabled={refundLookupLoading === 'transaction'}>
                      {refundLookupLoading === 'transaction' ? 'Looking up...' : 'Lookup by transaction'}
                    </button>
                  </div>
                </div>

                {refundLookupError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{refundLookupError}</div>}
                {!refundLookupError && refundLookupResult && (
                  <DetailGrid
                    rows={[
                      { label: 'Refund exists', value: refundLookupResult.refundExists ? 'Yes' : 'No' },
                      { label: 'Internal ref', value: refundLookupResult.internalReference || '-' },
                      { label: 'Original txn ID', value: refundLookupResult.originalTransactionId || '-' },
                      { label: 'Refund txn ID', value: refundLookupResult.refundTransactionId || '-' },
                      { label: 'Refund ref', value: refundLookupResult.refundReference || '-' },
                      { label: 'Refunded at', value: formatDateTime(refundLookupResult.refundedAt) }
                    ]}
                  />
                )}
              </div>
            </div>

            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <div style={{ fontWeight: 800 }}>Webhook events</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                    {webhookEvents.length > 0 ? `${webhookEvents.length} event${webhookEvents.length === 1 ? '' : 's'} linked.` : 'No webhook events linked.'}
                  </div>
                </div>
              </div>

              {webhookEvents.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem' }}>
                  {webhookEvents.map((event) => (
                    <div key={event.id ?? `${event.provider}-${event.createdAt}`} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700 }}>Event {event.id ?? '—'}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{formatDateTime(event.createdAt)}</div>
                      </div>
                      <div style={{ marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Provider</div>
                          <div style={{ fontWeight: 700 }}>{event.provider ?? '—'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Event type</div>
                          <div style={{ fontWeight: 700 }}>{event.eventType ?? '—'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Transaction ID</div>
                          <div style={{ fontWeight: 700 }}>{event.transactionId ?? '—'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Retries</div>
                          <div style={{ fontWeight: 700 }}>{event.retries ?? 0}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Processed at</div>
                          <div style={{ fontWeight: 700 }}>{formatDateTime(event.processedAt)}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Last error</div>
                          <div style={{ fontWeight: 700, color: event.lastError ? '#b91c1c' : 'inherit' }}>{event.lastError || '—'}</div>
                        </div>
                      </div>
                      <details style={{ marginTop: '0.6rem' }}>
                        <summary style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}>Payload</summary>
                        <pre
                          style={{
                            marginTop: '0.5rem',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            fontSize: '12px',
                            overflowX: 'auto'
                          }}
                        >
                          {formatWebhookPayload(event.payload) || 'No payload.'}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <div style={{ fontWeight: 800 }}>Receipt</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>View or edit transaction receipt details.</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-neutral btn-sm" onClick={() => loadReceipt(selected?.transactionId || selected?.id)} disabled={receiptLoading}>
                    {receiptLoading ? 'Loading…' : 'Reload'}
                  </button>
                  <button type="button" className="btn-primary btn-sm" onClick={openReceiptForm} disabled={receiptLoading}>
                    {receipt ? 'Edit receipt' : 'Add receipt'}
                  </button>
                  {receipt && (
                    <button type="button" className="btn-danger btn-sm" onClick={() => setShowReceiptDelete(true)} disabled={receiptDeleteLoading}>
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.6rem' }}>
                {receiptError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{receiptError}</div>}
                {receiptLoading && <div style={{ color: 'var(--muted)' }}>Loading receipt…</div>}
                {!receiptLoading && !receipt && <div style={{ color: 'var(--muted)' }}>No receipt on file.</div>}
                {!receiptLoading && receipt && (
                  <>
                    <DetailGrid
                      rows={[
                        { label: 'Type', value: receipt.type || '—' },
                        { label: 'Status', value: receipt.status || '—' },
                        { label: 'Message', value: receipt.humanMessage || '—' },
                        { label: 'Updated', value: formatDateTime(receipt.updatedAt) }
                      ]}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ fontWeight: 700 }}>Payload</div>
                      {receipt.payload ? (
                        <pre
                          style={{
                            background: '#f8fafc',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            fontSize: '12px',
                            overflowX: 'auto'
                          }}
                        >
                          {JSON.stringify(receipt.payload, null, 2)}
                        </pre>
                      ) : (
                        <div style={{ color: 'var(--muted)' }}>No payload</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <div style={{ fontWeight: 800 }}>Receipt backfill audit</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                    Receipt backfill activity for this transaction.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-neutral btn-sm"
                  onClick={() => loadReceiptAuditLogs(selected?.transactionId || selected?.id)}
                  disabled={auditLoading}
                >
                  {auditLoading ? 'Loading…' : 'Refresh'}
                </button>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                {auditError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{auditError}</div>}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Time', 'Action', 'Admin', 'Target'].map((label) => (
                          <th key={label} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(!auditLogs || auditLogs.length === 0) && (
                        <tr>
                          <td colSpan={4} style={{ padding: '0.75rem', color: 'var(--muted)' }}>
                            {auditLoading ? 'Loading…' : 'No audit logs found.'}
                          </td>
                        </tr>
                      )}
                      {auditLogs.map((row, idx) => {
                        const targetType = row.targetType || row.target_type;
                        const targetId = row.targetId || row.target_id;
                        return (
                          <tr key={row.id || idx} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.5rem' }}>{formatDateTime(row.createdAt || row.timestamp || row.time || row.loggedAt || row.updatedAt)}</td>
                            <td style={{ padding: '0.5rem', fontWeight: 600 }}>{row.action || '—'}</td>
                            <td style={{ padding: '0.5rem' }}>{row.adminName || row.adminEmail || row.adminId || row.actor || '—'}</td>
                            <td style={{ padding: '0.5rem' }}>
                              {targetType || targetId ? `${targetType || 'target'} ${targetId ?? ''}`.trim() : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {String(selected?.service || '').toUpperCase() === 'BILL_PAYMENTS' && (
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <div style={{ fontWeight: 800 }}>Bill status refetch audit</div>
                    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                      Refetch activity for this bill payment transaction.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-neutral btn-sm"
                    onClick={() => loadBillStatusAuditLogs(selected?.transactionId || selected?.id)}
                    disabled={billStatusAuditLoading}
                  >
                    {billStatusAuditLoading ? 'Loading…' : 'Refresh'}
                  </button>
                </div>

                <div style={{ marginTop: '0.75rem' }}>
                  {billStatusAuditError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{billStatusAuditError}</div>}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Time', 'Action', 'Admin', 'Target'].map((label) => (
                            <th key={label} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(!billStatusAuditLogs || billStatusAuditLogs.length === 0) && (
                          <tr>
                            <td colSpan={4} style={{ padding: '0.75rem', color: 'var(--muted)' }}>
                              {billStatusAuditLoading ? 'Loading…' : 'No audit logs found.'}
                            </td>
                          </tr>
                        )}
                        {billStatusAuditLogs.map((row, idx) => {
                          const targetType = row.targetType || row.target_type;
                          const targetId = row.targetId || row.target_id;
                          return (
                            <tr key={row.id || idx} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '0.5rem' }}>{formatDateTime(row.createdAt || row.timestamp || row.time || row.loggedAt || row.updatedAt)}</td>
                              <td style={{ padding: '0.5rem', fontWeight: 600 }}>{row.action || '—'}</td>
                              <td style={{ padding: '0.5rem' }}>{row.adminName || row.adminEmail || row.adminId || row.actor || '—'}</td>
                              <td style={{ padding: '0.5rem' }}>
                                {targetType || targetId ? `${targetType || 'target'} ${targetId ?? ''}`.trim() : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" onClick={() => loadAccountSummary(selected)} className="btn-neutral" disabled={accountLoading}>
                {accountLoading ? 'Refreshing…' : 'Refresh balance'}
              </button>
              {canRefetchBillStatus && (
                <button type="button" onClick={handleRefetchBillStatus} className="btn-primary" disabled={refetchBillStatusLoading}>
                  {refetchBillStatusLoading ? 'Refetching…' : 'Refetch bill status'}
                </button>
              )}
              {canReplayFulfillment && (
                <button type="button" onClick={() => setShowReplayConfirm(true)} className="btn-primary">
                  Replay loan fulfillment
                </button>
              )}
              {canRefundSelected && (
                <button type="button" onClick={() => setShowRefund(true)} className="btn-danger">
                  Refund to wallet
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {showReplayConfirm && (
        <Modal title="Replay loan fulfillment" onClose={() => (!replayLoading ? setShowReplayConfirm(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              This will resume fulfillment for this PAY_LATER purchase and may update the transaction to FUNDED.
            </div>
            {replayError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{replayError}</div>}
            <DetailGrid
              rows={[
                { label: 'Transaction ID', value: selected?.transactionId || selected?.id },
                { label: 'Reference', value: selected?.reference },
                { label: 'Action', value: formatEnumLabel(selected?.action, actionLabels) },
                { label: 'Status', value: selected?.status }
              ]}
            />
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowReplayConfirm(false)} disabled={replayLoading}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleReplayFulfillment} disabled={replayLoading}>
                {replayLoading ? 'Replaying…' : 'Confirm replay'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showBankPayoutComplete && (
        <Modal title="Complete bank payout" onClose={() => (!bankPayoutLoading ? setShowBankPayoutComplete(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              Confirm that the manual bank transfer is done. This will mark the payout as completed and notify the user.
            </div>
            <DetailGrid
              rows={[
                { label: 'Transaction ID', value: selected?.transactionId || selected?.id },
                { label: 'Reference', value: selected?.reference },
                { label: 'Status', value: selected?.status },
                { label: 'Amount', value: `${selected?.amount ?? '—'} ${selected?.currency || ''}`.trim() },
                { label: 'Method', value: selected?.paymentMethodName || '—' }
              ]}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="bankPayoutMessage">Message (optional)</label>
              <input
                id="bankPayoutMessage"
                value={bankPayoutMessage}
                onChange={(e) => setBankPayoutMessage(e.target.value)}
                placeholder="Transfer completed via Equity Bank DRC"
              />
            </div>
            {bankPayoutError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{bankPayoutError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowBankPayoutComplete(false)} disabled={bankPayoutLoading}>
                Cancel
              </button>
              <button type="button" className="btn-success" onClick={handleCompleteBankPayout} disabled={bankPayoutLoading}>
                {bankPayoutLoading ? 'Completing…' : 'Confirm completion'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showReceiptForm && (
        <Modal title={`${receipt ? 'Edit' : 'Add'} receipt`} onClose={() => (!receiptSaving ? setShowReceiptForm(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="receiptType">Type</label>
                <select id="receiptType" value={receiptType} onChange={(e) => setReceiptType(e.target.value)}>
                  <option value="">Infer from transaction</option>
                  {receiptTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="receiptStatus">Status</label>
                <select id="receiptStatus" value={receiptStatus} onChange={(e) => setReceiptStatus(e.target.value)}>
                  <option value="">Use transaction status</option>
                  {receiptStatusOptions.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="receiptMessage">Message</label>
              <input
                id="receiptMessage"
                value={receiptHumanMessage}
                onChange={(e) => setReceiptHumanMessage(e.target.value)}
                placeholder="e.g. Token delivered to email"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="receiptTemplate">Payload template (optional)</label>
              <select id="receiptTemplate" value={receiptTemplateKey} onChange={(e) => applyReceiptTemplate(e.target.value)}>
                <option value="">Choose a template</option>
                {Object.keys(receiptPayloadTemplates).map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Prefill common payload shapes (gift card codes, bill tokens, crypto hashes, loan data, etc.).
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="receiptPayload">Payload (JSON)</label>
              <textarea
                id="receiptPayload"
                value={receiptPayload}
                onChange={(e) => setReceiptPayload(e.target.value)}
                rows={8}
                spellCheck="false"
                style={{ fontFamily: 'monospace' }}
              />
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Include keys like codes, tokens, hashes, last4, receipt numbers, or instructions. Leave empty to keep existing payload.
              </div>
            </div>

            {receiptError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{receiptError}</div>}

            <div className="modal-actions">
              <button type="button" className="btn-neutral" disabled={receiptSaving} onClick={() => setShowReceiptForm(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={receiptSaving} onClick={submitReceipt}>
                {receiptSaving ? 'Saving…' : 'Save receipt'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showReceiptDelete && (
        <Modal title="Delete receipt" onClose={() => (!receiptDeleteLoading ? setShowReceiptDelete(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontWeight: 700 }}>
              Remove the receipt for <span style={{ fontWeight: 900 }}>{selected?.reference || selected?.transactionId || selected?.id}</span>?
            </div>
            <div style={{ color: 'var(--muted)' }}>This will delete receipt metadata and payload.</div>
            {receiptError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{receiptError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" disabled={receiptDeleteLoading} onClick={() => setShowReceiptDelete(false)}>
                Cancel
              </button>
              <button type="button" className="btn-danger" disabled={receiptDeleteLoading} onClick={deleteReceipt}>
                {receiptDeleteLoading ? 'Deleting…' : 'Confirm delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showRefund && (
        <Modal title="Refund to wallet" onClose={() => (!refundLoading ? setShowRefund(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <div>
                <span style={{ color: 'var(--muted)' }}>Original:</span>{' '}
                <span style={{ fontWeight: 800 }}>{selected?.reference || selected?.transactionId || selected?.id}</span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)' }}>Amount:</span>{' '}
                <span style={{ fontWeight: 800 }}>{`${selected?.amount ?? '—'} ${selected?.currency || ''}`.trim()}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="refundNote">Note (optional)</label>
              <input id="refundNote" value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="Provider failed, refunding customer" />
            </div>

            {refundError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{refundError}</div>}

            <div className="modal-actions">
              <button type="button" onClick={() => setShowRefund(false)} className="btn-neutral" disabled={refundLoading}>
                Cancel
              </button>
              <button type="button" onClick={submitRefund} className="btn-danger" disabled={refundLoading}>
                {refundLoading ? 'Creating refund…' : 'Confirm refund'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
