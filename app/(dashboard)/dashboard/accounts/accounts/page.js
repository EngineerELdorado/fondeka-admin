'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';

const initialFilters = {
  accountId: '',
  accountReference: '',
  userReference: '',
  usernameContains: '',
  email: '',
  phone: '',
  countryId: '',
  startDate: '',
  endDate: '',
  blacklisted: ''
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

const Badge = ({ children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.2rem 0.45rem',
      background: '#eef2ff',
      color: '#4338ca',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 600
    }}
  >
    {children}
  </span>
);

export default function AccountsListPage() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailAccount, setDetailAccount] = useState(null);
  const [detailTransactions, setDetailTransactions] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [customPricing, setCustomPricing] = useState(null);
  const [customPricingLoading, setCustomPricingLoading] = useState(false);
  const [customPricingMissing, setCustomPricingMissing] = useState(false);
  const [kycCap, setKycCap] = useState(null);
  const [kycCapLoading, setKycCapLoading] = useState(false);
  const [feeConfigs, setFeeConfigs] = useState([]);
  const [feeConfigsLoading, setFeeConfigsLoading] = useState(false);
  const [feeConfigsError, setFeeConfigsError] = useState(null);
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [feeFormId, setFeeFormId] = useState(null);
  const [feeAction, setFeeAction] = useState('');
  const [feeService, setFeeService] = useState('');
  const [feePmpId, setFeePmpId] = useState('');
  const [feeCountryId, setFeeCountryId] = useState('');
  const [feeProviderPct, setFeeProviderPct] = useState('');
  const [feeProviderFlat, setFeeProviderFlat] = useState('');
  const [feeOurPct, setFeeOurPct] = useState('');
  const [feeOurFlat, setFeeOurFlat] = useState('');
  const [feeSaving, setFeeSaving] = useState(false);
  const [pmps, setPmps] = useState([]);
  const actionOptions = [
    'BUY_CARD',
    'BUY_CRYPTO',
    'BUY_GIFT_CARD',
    'E_SIM_PURCHASE',
    'E_SIM_TOPUP',
    'FUND_CARD',
    'FUND_WALLET',
    'LOAN_DISBURSEMENT',
    'PAY_BILL',
    'PAY_ELECTRICITY_BILL',
    'PAY_INTERNET_BILL',
    'PAY_TV_SUBSCRIPTION',
    'PAY_WATER_BILL',
    'PAY_REQUEST',
    'REPAY_LOAN',
    'SELL_CRYPTO',
    'SEND_AIRTIME',
    'SEND_CRYPTO',
    'WITHDRAW_FROM_CARD',
    'WITHDRAW_FROM_WALLET'
  ].sort();

  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [showUnblacklistModal, setShowUnblacklistModal] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [blacklistError, setBlacklistError] = useState(null);
  const [blacklistLoading, setBlacklistLoading] = useState(false);

  const [showCredit, setShowCredit] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [creditAction, setCreditAction] = useState('MANUAL_ADJUSTMENT');
  const [creditError, setCreditError] = useState(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [showDebit, setShowDebit] = useState(false);
  const [debitAmount, setDebitAmount] = useState('');
  const [debitNote, setDebitNote] = useState('');
  const [debitAction, setDebitAction] = useState('MANUAL_ADJUSTMENT');
  const [debitError, setDebitError] = useState(null);
  const [debitLoading, setDebitLoading] = useState(false);

  const [showPricingForm, setShowPricingForm] = useState(false);
  const [pricingExtraLoan, setPricingExtraLoan] = useState('');
  const [pricingMaxCollection, setPricingMaxCollection] = useState('');
  const [pricingMaxPayout, setPricingMaxPayout] = useState('');
  const [pricingNote, setPricingNote] = useState('');
  const [pricingError, setPricingError] = useState(null);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [showPricingRemove, setShowPricingRemove] = useState(false);
  const [pricingRemoving, setPricingRemoving] = useState(false);

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

  const renderBlacklistBadge = (flag) => {
    if (flag === null || flag === undefined) return '—';
    const tone = flag ? { bg: '#FEF2F2', fg: '#B91C1C', label: 'Blacklisted' } : { bg: '#E5E7EB', fg: '#374151', label: 'No' };
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
        {tone.label}
      </span>
    );
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        if (['accountId', 'countryId'].includes(key)) {
          const num = Number(value);
          if (!Number.isNaN(num)) params.set(key, String(num));
        } else if (['startDate', 'endDate'].includes(key)) {
          const ts = Date.parse(value);
          if (!Number.isNaN(ts)) params.set(key, String(ts));
        } else if (key === 'blacklisted') {
          const normalized = typeof value === 'string' ? value.toLowerCase() : value;
          if (normalized === true || normalized === 'true') params.set(key, 'true');
          else if (normalized === false || normalized === 'false') params.set(key, 'false');
        } else {
          params.set(key, String(value));
        }
      });
      const res = await api.accounts.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      const flattened = (list || []).map((item) => ({
        id: item.accountId ?? item.id,
        accountReference: item.accountReference ?? item.accountNumber ?? item.accountId,
        countryName: item.countryName || item.countryCode,
        countryCode: item.countryCode,
        userName: [item.userFirstName, item.userMiddleName, item.userLastName].filter(Boolean).join(' ') || item.username,
        username: item.username,
        userReference: item.userReference,
        email: item.email,
        phone: item.phoneNumber,
        emailVerified: item.emailVerified,
        phoneVerified: item.phoneVerified,
        kycStatus: item.kycStatus,
        kycProvider: item.kycProvider,
        kycLevel: item.kycLevel,
        blacklisted: item.blacklisted,
        balance: item.balance,
        previousDebt: item.previousDebt,
        eligibleLoanAmount: item.eligibleLoanAmount,
        lastTransactions: item.lastTransactions || [],
        cryptoWallets: item.cryptoWallets || [],
        raw: item
      }));
      setRows(flattened);
      return flattened;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await api.countries.list(new URLSearchParams({ page: '0', size: '200' }));
        const list = Array.isArray(res) ? res : res?.content || [];
        setCountries(list);
      } catch {
        // ignore silently
      }
    };
    fetchCountries();
  }, []);
  useEffect(() => {
    const fetchPmps = async () => {
      try {
        const res = await api.paymentMethodPaymentProviders.list(new URLSearchParams({ page: '0', size: '200' }));
        const list = Array.isArray(res) ? res : res?.content || [];
        setPmps(list);
      } catch {
        // ignore
      }
    };
    fetchPmps();
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

  const canGoPrevious = page > 0;
  const canGoNext = rows.length === size && rows.length > 0;

  const activeFilterChips = useMemo(() => {
    const chips = [];
    const add = (label, key) => chips.push({ label, key });
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      switch (key) {
        case 'accountId':
          add(`Account ID: ${value}`, key);
          break;
        case 'accountReference':
          add(`Account ref: ${value}`, key);
          break;
        case 'userReference':
          add(`User ref: ${value}`, key);
          break;
        case 'usernameContains':
          add(`Username contains: ${value}`, key);
          break;
        case 'email':
          add(`Email: ${value}`, key);
          break;
        case 'phone':
          add(`Phone: ${value}`, key);
          break;
        case 'countryId':
          add(`Country ID: ${value}`, key);
          break;
        case 'startDate':
          add(`From: ${value}`, key);
          break;
        case 'endDate':
          add(`To: ${value}`, key);
          break;
        case 'blacklisted':
          add(`Blacklisted: ${value === true || value === 'true' ? 'Yes' : 'No'}`, key);
          break;
        default:
          break;
      }
    });
    return chips;
  }, [appliedFilters]);

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'accountReference', label: 'Account' },
      { key: 'userName', label: 'User' },
      { key: 'countryName', label: 'Country' },
      { key: 'phone', label: 'Phone' },
      { key: 'balance', label: 'Balance' },
      { key: 'eligibleLoanAmount', label: 'Eligible loan' },
      { key: 'blacklisted', label: 'Blacklisted', render: (row) => renderBlacklistBadge(row.blacklisted) },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <Link href={`/dashboard/accounts/accounts/${row.id}`} className="btn-neutral">
              View
            </Link>
            {row.blacklisted ? (
              <button
                type="button"
                onClick={() => {
                  setBlacklistError(null);
                  setSelected(row);
                  setShowUnblacklistModal(true);
                }}
                className="btn-neutral"
              >
                Remove from blacklist
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setBlacklistError(null);
                  setBlacklistReason('');
                  setSelected(row);
                  setShowBlacklistModal(true);
                }}
                className="btn-danger"
              >
                Blacklist
              </button>
            )}
          </div>
        )
      }
    ],
    []
  );

  const openDetail = (row) => {
    setSelected(row);
    setDetailAccount(null);
    setDetailTransactions(null);
    setShowDetail(true);
    setInfo(null);
    setError(null);
    setShowBlacklistModal(false);
    setShowUnblacklistModal(false);
    setBlacklistReason('');
    setBlacklistError(null);
    setShowCredit(false);
    setCreditAmount('');
    setCreditNote('');
    setCreditError(null);

    setCustomPricing(null);
    setCustomPricingMissing(false);
    setShowPricingForm(false);
    setPricingExtraLoan('');
    setPricingMaxCollection('');
    setPricingMaxPayout('');
    setPricingNote('');
    setPricingError(null);
    setShowPricingRemove(false);
    setKycCap(null);
  };

  const loadCustomPricing = async (accountId) => {
    if (!accountId && accountId !== 0) return;
    setCustomPricingLoading(true);
    setPricingError(null);
    try {
      const res = await api.accounts.getCustomPricing(accountId);
      setCustomPricing(res || null);
      setCustomPricingMissing(false);
    } catch (err) {
      if (err?.status === 404) {
        setCustomPricing(null);
        setCustomPricingMissing(true);
      } else {
        setCustomPricing(null);
        setCustomPricingMissing(false);
        setPricingError(err.message || 'Failed to load custom KYC caps');
      }
    } finally {
      setCustomPricingLoading(false);
    }
  };

  const loadKycCap = async (kycLevel) => {
    const num = Number(kycLevel);
    if (!Number.isFinite(num)) {
      setKycCap(null);
      return;
    }
    setKycCapLoading(true);
    try {
      const params = new URLSearchParams({ page: '0', size: '1', level: String(num) });
      const res = await api.kycCaps.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setKycCap(list?.[0] || null);
    } catch {
      setKycCap(null);
    } finally {
      setKycCapLoading(false);
    }
  };

  const loadFeeConfigs = async (accountId) => {
    if (!accountId && accountId !== 0) return;
    setFeeConfigsLoading(true);
    setFeeConfigsError(null);
    try {
      const res = await api.accounts.feeConfigs.list(accountId);
      const list = Array.isArray(res) ? res : res?.content || [];
      setFeeConfigs(list || []);
    } catch (err) {
      setFeeConfigs([]);
      setFeeConfigsError(err.message || 'Failed to load fee overrides');
    } finally {
      setFeeConfigsLoading(false);
    }
  };

  const loadAccountDetail = async ({ accountId, accountReference }) => {
    if (!accountId && accountId !== 0) return;
    setDetailLoading(true);
    try {
      const fresh = await api.accounts.get(accountId);
      setDetailAccount(fresh || null);

      const ref = fresh?.accountReference || accountReference;
      if (ref) {
        const txParams = new URLSearchParams({ page: '0', size: '1', accountReference: String(ref) });
        const txRes = await api.transactions.list(txParams);
        const list = Array.isArray(txRes) ? txRes : txRes?.content || [];
        setDetailTransactions(list || []);
      } else {
        setDetailTransactions(null);
      }

      await loadCustomPricing(accountId);
      await loadKycCap(fresh?.kycLevel ?? selected?.kycLevel);
      await loadFeeConfigs(accountId);
    } catch (err) {
      pushToast({ tone: 'error', message: err.message || 'Failed to load account details' });
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!showDetail || !selected?.id) return;
    loadAccountDetail({ accountId: selected.id, accountReference: selected.accountReference });
  }, [showDetail, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshSelectedRow = async () => {
    const refreshed = await fetchRows();
    const updated = refreshed?.find?.((r) => r.id === selected?.id);
    if (updated) setSelected(updated);
    return updated;
  };

  const submitBlacklist = async () => {
    setBlacklistError(null);
    const reason = blacklistReason.trim();
    if (!selected?.id) {
      setBlacklistError('No account selected');
      return;
    }
    if (!reason) {
      setBlacklistError('Reason is required');
      return;
    }

    setBlacklistLoading(true);
    try {
      await api.accounts.blacklist(selected.id, { reason });
      pushToast({ tone: 'success', message: 'Account blacklisted' });
      setShowBlacklistModal(false);
      setBlacklistReason('');
      const updated = await refreshSelectedRow();
      if (showDetail && (updated?.id || selected?.id)) {
        await loadAccountDetail({ accountId: updated?.id || selected.id, accountReference: updated?.accountReference || selected?.accountReference });
      }
    } catch (err) {
      const message = err.message || 'Failed to blacklist account';
      setBlacklistError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setBlacklistLoading(false);
    }
  };

  const submitUnblacklist = async () => {
    setBlacklistError(null);
    if (!selected?.id) {
      setBlacklistError('No account selected');
      return;
    }

    setBlacklistLoading(true);
    try {
      await api.accounts.removeFromBlacklist(selected.id);
      pushToast({ tone: 'success', message: 'Removed from blacklist' });
      setShowUnblacklistModal(false);
      const updated = await refreshSelectedRow();
      if (showDetail && (updated?.id || selected?.id)) {
        await loadAccountDetail({ accountId: updated?.id || selected.id, accountReference: updated?.accountReference || selected?.accountReference });
      }
    } catch (err) {
      const message = err.message || 'Failed to remove from blacklist';
      setBlacklistError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setBlacklistLoading(false);
    }
  };

  const submitCredit = async () => {
    setCreditError(null);
    const amountNum = Number(creditAmount);
    if (!Number.isFinite(amountNum) || amountNum < 0.01) {
      setCreditError('Amount must be at least 0.01');
      return;
    }
    if (!selected?.id) {
      setCreditError('No account selected');
      return;
    }

    setCreditLoading(true);
    try {
      const payload = {
        amount: amountNum,
        ...(creditAction ? { action: creditAction } : {}),
        ...(creditNote?.trim() ? { note: creditNote.trim() } : {})
      };
      const res = await api.accounts.creditWallet(selected.id, payload);
      const actionLabel = creditAction === 'BONUS' ? 'Bonus' : 'Manual adjustment';
      pushToast({
        tone: 'success',
        message: `Wallet credited (${actionLabel}): ${res?.amount ?? amountNum} (ref ${res?.reference || '—'})`
      });
      setShowCredit(false);
      setCreditAmount('');
      setCreditNote('');
      setCreditAction('MANUAL_ADJUSTMENT');

      await loadAccountDetail({ accountId: selected.id, accountReference: selected.accountReference });
      const refreshed = await fetchRows();
      const updated = refreshed?.find?.((r) => r.id === selected.id);
      if (updated) setSelected(updated);
    } catch (err) {
      setCreditError(err.message);
      pushToast({ tone: 'error', message: err.message });
    } finally {
      setCreditLoading(false);
    }
  };

  const submitDebit = async () => {
    setDebitError(null);
    const amountNum = Number(debitAmount);
    if (!Number.isFinite(amountNum) || amountNum < 0.01) {
      setDebitError('Amount must be at least 0.01');
      return;
    }
    if (!selected?.id) {
      setDebitError('No account selected');
      return;
    }
    const confirmed = window.confirm("This will debit the user's wallet. This action is irreversible.");
    if (!confirmed) return;

    setDebitLoading(true);
    try {
      const payload = {
        amount: amountNum,
        ...(debitAction ? { action: debitAction } : {}),
        ...(debitNote?.trim() ? { note: debitNote.trim() } : {})
      };
      const res = await api.accounts.debitWallet(selected.id, payload);
      const actionLabel = debitAction === 'WITHDRAW_FROM_WALLET' ? 'Withdraw from wallet' : 'Manual adjustment';
      const referenceLabel = res?.reference ? ` (ref ${res.reference})` : '';
      setInfo(
        <span>
          Wallet debited ({actionLabel}): {res?.amount ?? amountNum}
          {referenceLabel}
          {res?.transactionId ? (
            <>
              {' '}
              <Link href={`/dashboard/transactions?transactionId=${res.transactionId}`} className="btn-neutral" style={{ marginLeft: '0.4rem' }}>
                View transaction
              </Link>
            </>
          ) : null}
        </span>
      );
      pushToast({
        tone: 'success',
        message: `Wallet debited (${actionLabel}): ${res?.amount ?? amountNum}${referenceLabel}`
      });
      setShowDebit(false);
      setDebitAmount('');
      setDebitNote('');
      setDebitAction('MANUAL_ADJUSTMENT');

      await loadAccountDetail({ accountId: selected.id, accountReference: selected.accountReference });
      const refreshed = await fetchRows();
      const updated = refreshed?.find?.((r) => r.id === selected.id);
      if (updated) setSelected(updated);
    } catch (err) {
      let message = err.message || 'Failed to debit account';
      if (err.status === 401 || err.status === 403) {
        message = 'Not authorized';
      }
      setDebitError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setDebitLoading(false);
    }
  };

  const openFeeForm = (fee) => {
    setFeeConfigsError(null);
    setFeeFormId(fee?.id || null);
    setFeeAction(fee?.action || '');
    setFeeService(fee?.service || '');
    setFeePmpId(fee?.paymentMethodPaymentProviderId ?? '');
    setFeeCountryId(fee?.countryId ?? '');
    setFeeProviderPct(fee?.providerFeePercentage ?? '');
    setFeeProviderFlat(fee?.providerFlatFee ?? '');
    setFeeOurPct(fee?.ourFeePercentage ?? '');
    setFeeOurFlat(fee?.ourFlatFee ?? '');
    setShowFeeForm(true);
  };

  const resetFeeForm = () => {
    setFeeFormId(null);
    setFeeAction('');
    setFeeService('');
    setFeePmpId('');
    setFeeCountryId('');
    setFeeProviderPct('');
    setFeeProviderFlat('');
    setFeeOurPct('');
    setFeeOurFlat('');
  };

  const submitFeeForm = async () => {
    if (!selected?.id) {
      setFeeConfigsError('No account selected');
      return;
    }
    if (!feeAction) {
      setFeeConfigsError('Action is required');
      return;
    }
    const payload = {
      action: feeAction,
      service: feeService || null,
      paymentMethodPaymentProviderId: feePmpId === '' ? null : Number(feePmpId),
      countryId: feeCountryId === '' ? null : Number(feeCountryId),
      providerFeePercentage: feeProviderPct === '' ? 0 : Number(feeProviderPct),
      providerFlatFee: feeProviderFlat === '' ? 0 : Number(feeProviderFlat),
      ourFeePercentage: feeOurPct === '' ? 0 : Number(feeOurPct),
      ourFlatFee: feeOurFlat === '' ? 0 : Number(feeOurFlat)
    };
    setFeeSaving(true);
    setFeeConfigsError(null);
    try {
      if (feeFormId) {
        await api.accounts.feeConfigs.update(selected.id, feeFormId, payload);
        pushToast({ tone: 'success', message: 'Fee override updated' });
      } else {
        await api.accounts.feeConfigs.create(selected.id, payload);
        pushToast({ tone: 'success', message: 'Fee override added' });
      }
      resetFeeForm();
      setShowFeeForm(false);
      await loadFeeConfigs(selected.id);
    } catch (err) {
      const message = err.message || 'Failed to save fee override';
      setFeeConfigsError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setFeeSaving(false);
    }
  };

  const deleteFee = async (fee) => {
    if (!selected?.id || !fee?.id) return;
    const yes = window.confirm(`Delete fee override ${fee.action} (${fee.id})?`);
    if (!yes) return;
    setFeeConfigsError(null);
    try {
      await api.accounts.feeConfigs.remove(selected.id, fee.id);
      pushToast({ tone: 'success', message: 'Fee override deleted' });
      await loadFeeConfigs(selected.id);
    } catch (err) {
      const message = err.message || 'Failed to delete fee override';
      setFeeConfigsError(message);
      pushToast({ tone: 'error', message });
    }
  };

  const openPricingForm = (seed) => {
    setPricingError(null);
    setShowPricingRemove(false);
    setShowPricingForm(true);
    const source = seed || customPricing || {};
    setPricingExtraLoan(source?.extraLoanEligibilityAmount !== undefined && source?.extraLoanEligibilityAmount !== null ? String(source.extraLoanEligibilityAmount) : '0');
    setPricingMaxCollection(source?.maxCollectionAmount !== undefined && source?.maxCollectionAmount !== null ? String(source.maxCollectionAmount) : '');
    setPricingMaxPayout(source?.maxPayoutAmount !== undefined && source?.maxPayoutAmount !== null ? String(source.maxPayoutAmount) : '');
    setPricingNote(source?.note ? String(source.note) : '');
  };

  const submitPricing = async () => {
    setPricingError(null);
    if (!selected?.id) {
      setPricingError('No account selected');
      return;
    }

    const extraLoan = Number(pricingExtraLoan);
    if (!Number.isFinite(extraLoan) || extraLoan < 0) {
      setPricingError('Extra loan eligibility amount must be 0 or more');
      return;
    }

    const parseOptional = (raw) => {
      if (raw === '' || raw === null || raw === undefined) return null;
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) return NaN;
      return num;
    };

    const maxCollection = parseOptional(pricingMaxCollection);
    if (Number.isNaN(maxCollection)) {
      setPricingError('Max collection amount must be a number (or empty)');
      return;
    }
    const maxPayout = parseOptional(pricingMaxPayout);
    if (Number.isNaN(maxPayout)) {
      setPricingError('Max payout amount must be a number (or empty)');
      return;
    }

    setPricingSaving(true);
    try {
      const payload = {
        extraLoanEligibilityAmount: extraLoan,
        maxCollectionAmount: maxCollection,
        maxPayoutAmount: maxPayout,
        note: pricingNote?.trim() ? pricingNote.trim() : null
      };
      await api.accounts.updateCustomPricing(selected.id, payload);
      pushToast({ tone: 'success', message: 'Custom KYC caps saved' });
      setShowPricingForm(false);
      await loadCustomPricing(selected.id);
      await loadAccountDetail({ accountId: selected.id, accountReference: selected.accountReference });
    } catch (err) {
      const message = err.message || 'Failed to save custom KYC caps';
      setPricingError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setPricingSaving(false);
    }
  };

  const removePricing = async () => {
    if (!selected?.id) return;
    setPricingRemoving(true);
    setPricingError(null);
    try {
      await api.accounts.removeCustomPricing(selected.id);
      pushToast({ tone: 'success', message: 'Custom KYC caps removed' });
      setShowPricingRemove(false);
      setCustomPricing(null);
      setCustomPricingMissing(true);
      await loadAccountDetail({ accountId: selected.id, accountReference: selected.accountReference });
    } catch (err) {
      const message = err.message || 'Failed to remove custom KYC caps';
      setPricingError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setPricingRemoving(false);
    }
  };

  const accountView = detailAccount || selected;
  const txView = detailTransactions || selected?.lastTransactions || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Accounts</div>
          <div style={{ color: 'var(--muted)' }}>Find accounts quickly with deep filters and drill into recent activity.</div>
        </div>
        <Link href="/dashboard/accounts" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Accounts hub
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="accountId">Account ID</label>
                <input id="accountId" value={filters.accountId} onChange={(e) => setFilters((p) => ({ ...p, accountId: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="accountReference">Account reference/number</label>
                <input id="accountReference" value={filters.accountReference} onChange={(e) => setFilters((p) => ({ ...p, accountReference: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="userReference">User reference</label>
                <input id="userReference" value={filters.userReference} onChange={(e) => setFilters((p) => ({ ...p, userReference: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="usernameContains">Username contains</label>
                <input id="usernameContains" value={filters.usernameContains} onChange={(e) => setFilters((p) => ({ ...p, usernameContains: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="email">Email</label>
                <input id="email" value={filters.email} onChange={(e) => setFilters((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="phone">Phone</label>
                <input id="phone" value={filters.phone} onChange={(e) => setFilters((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="countryId">Country</label>
                <select id="countryId" value={filters.countryId} onChange={(e) => setFilters((p) => ({ ...p, countryId: e.target.value }))}>
                  <option value="">All</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.alpha2Code})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="blacklisted">Blacklisted</label>
                <select id="blacklisted" value={filters.blacklisted} onChange={(e) => setFilters((p) => ({ ...p, blacklisted: e.target.value }))}>
                  <option value="">All</option>
                  <option value="true">Only blacklisted</option>
                  <option value="false">Only not blacklisted</option>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label>Navigate</label>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button type="button" className="btn-neutral" disabled={loading || !canGoPrevious} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                      ←
                    </button>
                    <button type="button" className="btn-neutral" disabled={loading || !canGoNext} onClick={() => setPage((p) => p + 1)}>
                      →
                    </button>
                    <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Page {page + 1}</span>
                  </div>
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

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No accounts found" />

      {showDetail && (
        <Modal
          title={`Account ${accountView?.accountReference || accountView?.accountNumber || selected?.accountReference || selected?.id}`}
          onClose={() => setShowDetail(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={() => setShowCredit(true)} className="btn-success">
                Credit wallet
              </button>
              <button
                type="button"
                onClick={() => {
                  setDebitError(null);
                  setDebitAmount('');
                  setDebitNote('');
                  setDebitAction('MANUAL_ADJUSTMENT');
                  setShowDebit(true);
                }}
                className="btn-danger"
              >
                Debit wallet
              </button>
              {accountView?.blacklisted ? (
                <button
                  type="button"
                  onClick={() => {
                    setBlacklistError(null);
                    setShowUnblacklistModal(true);
                  }}
                  className="btn-neutral"
                >
                  Remove from blacklist
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setBlacklistError(null);
                    setBlacklistReason('');
                    setShowBlacklistModal(true);
                  }}
                  className="btn-danger"
                >
                  Blacklist
                </button>
              )}
              <button
                type="button"
                onClick={() => loadAccountDetail({ accountId: selected?.id, accountReference: selected?.accountReference })}
                className="btn-neutral"
                disabled={detailLoading}
              >
                {detailLoading ? 'Refreshing…' : 'Refresh'}
              </button>
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
                {detailLoading ? 'Loading latest account data…' : ' '}
              </span>
            </div>

            {accountView?.blacklisted && (
              <div className="card" style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontWeight: 700 }}>
                This account is currently blacklisted. They cannot transact until removed.
              </div>
            )}

            <DetailGrid
              rows={[
                { label: 'Account ID', value: selected?.id },
                { label: 'Account reference', value: accountView?.accountReference || selected?.accountReference },
                { label: 'User', value: selected?.userName || selected?.username || accountView?.username },
                { label: 'Country', value: selected?.countryName || selected?.countryCode || accountView?.countryCode || '—' },
                { label: 'KYC status', value: accountView?.kycStatus ?? selected?.kycStatus },
                { label: 'KYC level', value: accountView?.kycLevel ?? selected?.kycLevel },
                { label: 'Blacklisted', value: renderBlacklistBadge(accountView?.blacklisted ?? selected?.blacklisted) },
                { label: 'Balance', value: accountView?.balance ?? selected?.balance },
                { label: 'Eligible loan', value: accountView?.eligibleLoanAmount ?? selected?.eligibleLoanAmount }
              ]}
            />

            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <div style={{ fontWeight: 800 }}>Custom KYC Caps</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                    Per-account overrides for loan eligibility and deposit/withdrawal caps.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-neutral btn-sm" onClick={() => loadCustomPricing(selected?.id)} disabled={customPricingLoading}>
                    {customPricingLoading ? 'Loading…' : 'Reload'}
                  </button>
                  {(customPricingMissing || !customPricing) && (
                    <button type="button" className="btn-primary btn-sm" onClick={() => openPricingForm({ extraLoanEligibilityAmount: 0 })}>
                      Add custom KYC caps
                    </button>
                  )}
                  {customPricing && (
                    <>
                      <button type="button" className="btn-primary btn-sm" onClick={() => openPricingForm(customPricing)}>
                        Edit
                      </button>
                      <button type="button" className="btn-danger btn-sm" onClick={() => setShowPricingRemove(true)} disabled={pricingRemoving}>
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                {customPricingLoading && <div style={{ color: 'var(--muted)' }}>Loading custom KYC caps…</div>}
                {!customPricingLoading && (customPricingMissing || !customPricing) && (
                  <div style={{ color: 'var(--muted)' }}>No custom KYC caps configured.</div>
                )}
                {!customPricingLoading && customPricing && (
                  <DetailGrid
                    rows={[
                      { label: 'Extra loan eligibility', value: customPricing.extraLoanEligibilityAmount },
                      { label: 'Max collection', value: customPricing.maxCollectionAmount ?? 'Default' },
                      { label: 'Max payout', value: customPricing.maxPayoutAmount ?? 'Default' },
                      { label: 'Note', value: customPricing.note ?? '—' },
                      { label: 'Updated', value: customPricing.updatedAt ? formatDateTime(customPricing.updatedAt) : '—' }
                    ]}
                  />
                )}

                <div style={{ marginTop: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 800 }}>Effective caps</div>
                    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                      KYC level: {accountView?.kycLevel ?? selected?.kycLevel ?? '—'} {kycCapLoading ? '• loading KYC caps…' : ''}
                    </div>
                  </div>

                  {kycCap && (
                    <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                        <thead>
                          <tr>
                            {['Limit', 'Base (KYC)', 'Override (custom)', 'Effective'].map((label) => (
                              <th key={label} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const eligibleLoanEffective = accountView?.eligibleLoanAmount ?? selected?.eligibleLoanAmount ?? null;
                            const extraLoan = customPricing?.extraLoanEligibilityAmount ?? 0;
                            const eligibleLoanBase =
                              Number.isFinite(Number(eligibleLoanEffective)) && Number.isFinite(Number(extraLoan))
                                ? Math.max(0, Number(eligibleLoanEffective) - Number(extraLoan))
                                : null;

                            const kycCollection = kycCap?.maxCollectionAmount ?? null;
                            const overrideCollection = customPricing?.maxCollectionAmount ?? null;
                            const effectiveCollection = (customPricing?.maxCollectionAmount ?? kycCollection) ?? null;

                            const kycPayout = kycCap?.maxPayoutAmount ?? null;
                            const overridePayout = customPricing?.maxPayoutAmount ?? null;
                            const effectivePayout = (customPricing?.maxPayoutAmount ?? kycPayout) ?? null;

                            const rows = [
                              {
                                label: 'Loan eligibility (computed)',
                                base: eligibleLoanBase,
                                override: extraLoan,
                                effective: eligibleLoanEffective
                              },
                              {
                                label: 'Max collection (deposit)',
                                base: kycCollection,
                                override: overrideCollection,
                                effective: effectiveCollection
                              },
                              {
                                label: 'Max payout (withdrawal)',
                                base: kycPayout,
                                override: overridePayout,
                                effective: effectivePayout
                              }
                            ];

                            const fmt = (v, { empty = '—', defaultLabel = 'Default' } = {}) => {
                              if (v === null || v === undefined) return empty;
                              if (v === defaultLabel) return defaultLabel;
                              return String(v);
                            };

                            return rows.map((row) => (
                              <tr key={row.label} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.5rem', fontWeight: 700 }}>{row.label}</td>
                                <td style={{ padding: '0.5rem' }}>{fmt(row.base)}</td>
                                <td style={{ padding: '0.5rem' }}>{fmt(row.override, { empty: 'None' })}</td>
                                <td style={{ padding: '0.5rem' }}>{fmt(row.effective)}</td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                      <div style={{ marginTop: '0.4rem', color: 'var(--muted)', fontSize: '12px' }}>
                        Loan eligibility uses the computed `eligibleLoanAmount` from the account record; the “Override” column uses `extraLoanEligibilityAmount` from custom KYC caps when available.
                      </div>
                    </div>
                  )}

                  {!kycCapLoading && !kycCap && (
                    <div style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '13px' }}>
                      No KYC cap found for this KYC level; effective limits may be unknown.
                    </div>
                  )}
                </div>

                {pricingError && <div style={{ marginTop: '0.6rem', color: '#b91c1c', fontWeight: 700 }}>{pricingError}</div>}
              </div>
            </div>

            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <div style={{ fontWeight: 800 }}>Custom Fee Overrides</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                    Per-account fee rules. Leave PMPP blank for account-wide action overrides.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-neutral btn-sm" onClick={() => loadFeeConfigs(selected?.id)} disabled={feeConfigsLoading}>
                    {feeConfigsLoading ? 'Loading…' : 'Reload'}
                  </button>
                  <button type="button" className="btn-primary btn-sm" onClick={() => { resetFeeForm(); setShowFeeForm(true); }}>
                    Add override
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                {feeConfigsError && <div style={{ color: '#b91c1c', fontWeight: 700, marginBottom: '0.4rem' }}>{feeConfigsError}</div>}
                {feeConfigsLoading && <div style={{ color: 'var(--muted)' }}>Loading fee overrides…</div>}
                {!feeConfigsLoading && feeConfigs.length === 0 && <div style={{ color: 'var(--muted)' }}>No fee overrides.</div>}
                {!feeConfigsLoading && feeConfigs.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                      <thead>
                        <tr>
                          {['Action', 'Service', 'PMPP', 'Country', 'Provider %', 'Provider flat', 'Our %', 'Our flat', 'Updated', ''].map((h) => (
                            <th key={h} style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {feeConfigs.map((fee) => (
                          <tr key={fee.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.45rem' }}>{fee.action}</td>
                            <td style={{ padding: '0.45rem' }}>{fee.service || '—'}</td>
                            <td style={{ padding: '0.45rem' }}>
                              {fee.paymentMethodPaymentProviderId
                                ? (() => {
                                    const match = pmps.find((p) => String(p.id) === String(fee.paymentMethodPaymentProviderId));
                                    if (match) {
                                      return `${match.paymentMethodName || match.paymentMethodDisplayName || 'Method'} → ${match.paymentProviderName || 'Provider'}`;
                                    }
                                    return fee.paymentMethodPaymentProviderId;
                                  })()
                                : '—'}
                            </td>
                            <td style={{ padding: '0.45rem' }}>{fee.countryId ?? '—'}</td>
                            <td style={{ padding: '0.45rem' }}>{fee.providerFeePercentage}</td>
                            <td style={{ padding: '0.45rem' }}>{fee.providerFlatFee}</td>
                            <td style={{ padding: '0.45rem' }}>{fee.ourFeePercentage}</td>
                            <td style={{ padding: '0.45rem' }}>{fee.ourFlatFee}</td>
                            <td style={{ padding: '0.45rem' }}>{fee.updatedAt ? formatDateTime(fee.updatedAt) : '—'}</td>
                            <td style={{ padding: '0.45rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <button type="button" className="btn-neutral btn-sm" onClick={() => openFeeForm(fee)}>
                                Edit
                              </button>
                              <button type="button" className="btn-danger btn-sm" onClick={() => deleteFee(fee)}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {txView?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontWeight: 700 }}>Recent transaction (last 1)</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Created', 'Reference', 'Status', 'Service', 'Action', 'Amount'].map((label) => (
                          <th key={label} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {txView.map((txn) => (
                        <tr key={txn.transactionId || txn.id || txn.reference} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem' }}>{formatDateTime(txn.createdAt)}</td>
                          <td style={{ padding: '0.5rem' }}>{txn.reference}</td>
                          <td style={{ padding: '0.5rem' }}>{renderStatusBadge(txn.status)}</td>
                          <td style={{ padding: '0.5rem' }}>{txn.service}</td>
                          <td style={{ padding: '0.5rem' }}>{txn.action}</td>
                          <td style={{ padding: '0.5rem' }}>
                            {txn.amount} {txn.currency || ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selected?.cryptoWallets?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontWeight: 700 }}>Crypto wallets</div>
                {(() => {
                  const totals = (selected?.cryptoWallets || []).reduce((acc, w) => {
                    if (!w || w.balance === undefined || w.balance === null || !w.currency) return acc;
                    const num = Number(w.balance);
                    if (Number.isNaN(num)) return acc;
                    acc[w.currency] = (acc[w.currency] || 0) + num;
                    return acc;
                  }, {});
                  const entries = Object.entries(totals);
                  if (entries.length === 0) return null;
                  return (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Totals by currency:</span>
                      {entries.map(([cur, amt]) => (
                        <Badge key={cur}>
                          {amt} {cur}
                        </Badge>
                      ))}
                    </div>
                  );
                })()}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['ID', 'Product', 'Network', 'Balance'].map((label) => (
                          <th key={label} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selected.cryptoWallets.map((wallet) => (
                        <tr key={wallet.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem' }}>{wallet.id}</td>
                          <td style={{ padding: '0.5rem' }}>{wallet.productName}</td>
                          <td style={{ padding: '0.5rem' }}>
                            <Badge>{wallet.networkDisplayName || wallet.networkName || 'Network'}</Badge>
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span>{wallet.balance}</span>
                              {wallet.currency && <Badge>{wallet.currency}</Badge>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {showBlacklistModal && (
        <Modal title="Blacklist account" onClose={() => (!blacklistLoading ? setShowBlacklistModal(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              Add <span style={{ fontWeight: 800 }}>{selected?.userName || selected?.username || 'this user'}</span> to the blacklist. Blocked accounts cannot transact.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="blacklistReason">Reason (required)</label>
              <input
                id="blacklistReason"
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
                placeholder="e.g. Chargeback risk or fraud investigation"
              />
            </div>
            {blacklistError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{blacklistError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" disabled={blacklistLoading} onClick={() => setShowBlacklistModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn-danger" disabled={blacklistLoading} onClick={submitBlacklist}>
                {blacklistLoading ? 'Blacklisting…' : 'Confirm blacklist'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showUnblacklistModal && (
        <Modal title="Remove from blacklist" onClose={() => (!blacklistLoading ? setShowUnblacklistModal(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontWeight: 700 }}>
              Allow account <span style={{ fontWeight: 900 }}>{selected?.accountReference || selected?.id}</span> to transact again?
            </div>
            <div style={{ color: 'var(--muted)' }}>This is safe to repeat; removal is idempotent.</div>
            {blacklistError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{blacklistError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" disabled={blacklistLoading} onClick={() => setShowUnblacklistModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={blacklistLoading} onClick={submitUnblacklist}>
                {blacklistLoading ? 'Updating…' : 'Remove from blacklist'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCredit && (
        <Modal title="Credit wallet" onClose={() => (!creditLoading ? setShowCredit(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              Crediting account <span style={{ fontWeight: 800 }}>{accountView?.accountReference || selected?.accountReference || selected?.id}</span>
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
                  min="0.01"
                  step="0.01"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="25.50"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="creditNote">Note (optional)</label>
                <input id="creditNote" value={creditNote} onChange={(e) => setCreditNote(e.target.value)} placeholder="Optional note shown on receipt" />
              </div>
            </div>
            {creditError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{creditError}</div>}
            <div className="modal-actions">
              <button type="button" onClick={() => setShowCredit(false)} className="btn-neutral" disabled={creditLoading}>
                Cancel
              </button>
              <button type="button" onClick={submitCredit} className="btn-success" disabled={creditLoading}>
                {creditLoading ? 'Crediting…' : 'Credit wallet'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDebit && (
        <Modal title="Debit wallet" onClose={() => (!debitLoading ? setShowDebit(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              Debiting account <span style={{ fontWeight: 800 }}>{accountView?.accountReference || selected?.accountReference || selected?.id}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="debitAction">Action</label>
                <select id="debitAction" value={debitAction} onChange={(e) => setDebitAction(e.target.value)}>
                  <option value="MANUAL_ADJUSTMENT">Manual adjustment</option>
                  <option value="WITHDRAW_FROM_WALLET">Withdraw from wallet</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="debitAmount">Amount</label>
                <input
                  id="debitAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={debitAmount}
                  onChange={(e) => setDebitAmount(e.target.value)}
                  placeholder="25.50"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="debitNote">Note (optional)</label>
                <input id="debitNote" value={debitNote} onChange={(e) => setDebitNote(e.target.value)} placeholder="Optional note shown to user" />
              </div>
            </div>
            {debitError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{debitError}</div>}
            <div className="modal-actions">
              <button type="button" onClick={() => setShowDebit(false)} className="btn-neutral" disabled={debitLoading}>
                Cancel
              </button>
              <button type="button" onClick={submitDebit} className="btn-danger" disabled={debitLoading}>
                {debitLoading ? 'Debiting…' : 'Debit wallet'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showFeeForm && (
        <Modal title={`${feeFormId ? 'Edit' : 'Add'} fee override`} onClose={() => (!feeSaving ? setShowFeeForm(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {feeConfigsError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{feeConfigsError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="feeService">Service</label>
                <select id="feeService" value={feeService} onChange={(e) => setFeeService(e.target.value)}>
                  <option value="">None</option>
                  {['WALLET', 'BILL_PAYMENTS', 'LENDING', 'CARD', 'CRYPTO', 'PAYMENT_REQUEST', 'E_SIM', 'AIRTIME_AND_DATA', 'OTHER'].map((svc) => (
                    <option key={svc} value={svc}>
                      {svc}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="feeAction">Action *</label>
                <select id="feeAction" value={feeAction} onChange={(e) => setFeeAction(e.target.value)}>
                  <option value="">Select action</option>
                  {actionOptions.map((act) => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="feePmpId">Payment method / provider</label>
                <select id="feePmpId" value={feePmpId} onChange={(e) => setFeePmpId(e.target.value)}>
                  <option value="">Account-wide</option>
                  {pmps.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.paymentMethodName || p.paymentMethodDisplayName || 'Method') + ' → ' + (p.paymentProviderName || 'Provider')}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="feeCountryId">Country (optional)</label>
                <select id="feeCountryId" value={feeCountryId} onChange={(e) => setFeeCountryId(e.target.value)}>
                  <option value="">Any</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.alpha2Code ? `(${c.alpha2Code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="feeProviderPct">Provider fee %</label>
                <input id="feeProviderPct" type="number" step="0.01" value={feeProviderPct} onChange={(e) => setFeeProviderPct(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="feeProviderFlat">Provider flat</label>
                <input id="feeProviderFlat" type="number" step="0.01" value={feeProviderFlat} onChange={(e) => setFeeProviderFlat(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="feeOurPct">Our fee %</label>
                <input id="feeOurPct" type="number" step="0.01" value={feeOurPct} onChange={(e) => setFeeOurPct(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="feeOurFlat">Our flat</label>
                <input id="feeOurFlat" type="number" step="0.01" value={feeOurFlat} onChange={(e) => setFeeOurFlat(e.target.value)} />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => { if (!feeSaving) { resetFeeForm(); setShowFeeForm(false); } }} disabled={feeSaving}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={submitFeeForm} disabled={feeSaving}>
                {feeSaving ? 'Saving…' : feeFormId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showPricingForm && (
        <Modal title={`${customPricing ? 'Edit' : 'Add'} custom KYC caps`} onClose={() => (!pricingSaving ? setShowPricingForm(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="extraLoanEligibilityAmount">Extra loan eligibility amount</label>
                <input
                  id="extraLoanEligibilityAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingExtraLoan}
                  onChange={(e) => setPricingExtraLoan(e.target.value)}
                  placeholder="200.00"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="maxCollectionAmount">Max collection amount (optional)</label>
                <input
                  id="maxCollectionAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingMaxCollection}
                  onChange={(e) => setPricingMaxCollection(e.target.value)}
                  placeholder="500.00"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="maxPayoutAmount">Max payout amount (optional)</label>
                <input
                  id="maxPayoutAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingMaxPayout}
                  onChange={(e) => setPricingMaxPayout(e.target.value)}
                  placeholder="300.00"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="pricingNote">Note (optional)</label>
                <input id="pricingNote" value={pricingNote} onChange={(e) => setPricingNote(e.target.value)} placeholder="VIP customer" />
              </div>
            </div>
            {pricingError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{pricingError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" disabled={pricingSaving} onClick={() => setShowPricingForm(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={pricingSaving} onClick={submitPricing}>
                {pricingSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showPricingRemove && (
        <Modal title="Remove custom KYC caps" onClose={() => (!pricingRemoving ? setShowPricingRemove(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontWeight: 700 }}>
              Remove custom KYC caps for account <span style={{ fontWeight: 900 }}>{accountView?.accountReference || selected?.accountReference || selected?.id}</span>?
            </div>
            <div style={{ color: 'var(--muted)' }}>
              This will revert to standard KYC caps/scoring rules for loan eligibility and deposit/withdrawal limits.
            </div>
            {pricingError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{pricingError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" disabled={pricingRemoving} onClick={() => setShowPricingRemove(false)}>
                Cancel
              </button>
              <button type="button" className="btn-danger" disabled={pricingRemoving} onClick={removePricing}>
                {pricingRemoving ? 'Removing…' : 'Confirm remove'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};
