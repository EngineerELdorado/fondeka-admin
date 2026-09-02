'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import COUNTRIES from '@/data/countries';
import { paymentMethodAdminLabel } from '@/lib/payment-method-labels';

const currencyOptions = ['USD', 'CDF', 'EUR', 'KES', 'UGX', 'GHS', 'XAF'];
const rateProviderOptions = ['ADMIN', 'EXCHANGERATE_API', 'MANUAL', 'MAPLERAD'];
const fallbackActionOptions = [
  'FUND_WALLET',
  'WITHDRAW_FROM_WALLET',
  'REPAY_LOAN',
  'LOAN_DISBURSEMENT',
  'PERSONAL_SAVING_DEPOSIT',
  'PERSONAL_SAVING_WITHDRAWAL',
  'GROUP_SAVING_CONTRIBUTION',
  'GROUP_SAVING_PAYOUT',
  'PAY_ELECTRICITY_BILL',
  'PAY_INTERNET_BILL',
  'PAY_TV_SUBSCRIPTION',
  'PAY_WATER_BILL',
  'SEND_AIRTIME',
  'SEND_DATA_BUNDLES',
  'FUND_CARD',
  'WITHDRAW_FROM_CARD',
  'BUY_CARD',
  'ORDER_BANK_ACCOUNT',
  'BUY_CRYPTO',
  'CONVERT_FIAT',
  'SELL_CRYPTO',
  'SEND_CRYPTO',
  'RECEIVE_CRYPTO',
  'PAY_REQUEST',
  'SETTLEMENT'
].sort();
const fallbackFeeApplicationModeOptions = ['EXCLUSIVE', 'INCLUSIVE'];
const priorityCountryCodes = ['CD', 'KE', 'UG'];
const countryOptions = [
  ...priorityCountryCodes
    .map((code) => COUNTRIES.find((country) => country.cca2 === code))
    .filter(Boolean),
  ...COUNTRIES.filter((country, index, list) => (
    !priorityCountryCodes.includes(country.cca2)
    && list.findIndex((candidate) => candidate.cca2 === country.cca2) === index
  ))
];
const emptyDraft = {
  currency: '',
  displayName: '',
  logoUrl: '',
  active: true,
  walletEnabled: true,
  bankAccountEnabled: false,
  bankAccountApplicationEnabled: false,
  bankAccountAutoCreateEnabled: false,
  bankAccountOrderPriceAmount: '0',
  bankAccountOrderPriceCurrency: '',
  bankAccountOrderCostAmount: '0',
  bankAccountOrderCostCurrency: '',
  legacyBalanceBacked: false,
  baseCurrency: 'USD',
  rate: '',
  collectionRate: '',
  payoutRate: '',
  clearCollectionRate: false,
  clearPayoutRate: false,
  manualFxRate: false,
  collectionMarginPercent: '',
  payoutMarginPercent: '',
  rateProvider: 'EXCHANGERATE_API',
  rateFetchedAt: '',
  countryCodes: [],
  defaultCountryCodes: []
};

const emptyPreviewDraft = {
  amount: '10',
  sourceCurrency: 'USD',
  targetCurrency: 'CDF',
  action: '',
  paymentMethodId: '',
  billProductId: '',
  providerName: '',
  feeApplicationMode: '',
  fiatWalletId: '',
  savingId: '',
  groupSavingId: ''
};

const emptyFilters = {
  id: '',
  q: '',
  currency: '',
  displayName: '',
  active: '',
  walletEnabled: '',
  bankAccountEnabled: '',
  bankAccountApplicationEnabled: '',
  bankAccountAutoCreateEnabled: '',
  legacyBalanceBacked: '',
  manualFxRate: '',
  baseCurrency: '',
  rateProvider: '',
  countryCode: '',
  defaultCountryCode: '',
  hasCountryMapping: '',
  hasLogo: '',
  minRate: '',
  maxRate: '',
  minCollectionMarginPercent: '',
  maxCollectionMarginPercent: '',
  minPayoutMarginPercent: '',
  maxPayoutMarginPercent: '',
  rateFetchedFrom: '',
  rateFetchedTo: ''
};

const emptyDefaultBankAccountDraft = {
  internationalAccountNumber: '',
  accountNumber: '',
  swiftBic: '',
  routingNumber: ''
};

const emptyCreateBankAccountDraft = {
  targetType: 'accountId',
  accountId: '',
  email: '',
  currency: ''
};

const emptyBankAccountOrderDraft = {
  note: '',
  externalReference: '',
  providerReference: '',
  holderName: '',
  bankName: '',
  internationalAccountNumber: '',
  accountNumber: '',
  swiftBic: '',
  routingNumber: '',
  bankAddress: '',
  instructionsEn: '',
  instructionsFr: ''
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ gap: '0.75rem' }}>
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
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{row.value ?? '-'}</div>
      </div>
    ))}
  </div>
);

const FilterChip = ({ label, onClear }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'var(--muted-bg, #f3f4f6)', borderRadius: '999px', fontSize: '13px', color: 'var(--text)' }}>
    {label}
    <button type="button" onClick={onClear} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }} aria-label={`Clear ${label}`}>
      x
    </button>
  </span>
);

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatBool = (value) => (value ? 'Yes' : 'No');

const formatPercent = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  return `${value}%`;
};

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const upperTrim = (value) => String(value || '').trim().toUpperCase();

const normalizeCountryCodes = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(upperTrim).filter(Boolean))];
};

const mergeCountryCodes = (...values) => normalizeCountryCodes(values.flat());

const formatCountryCodes = (value) => {
  const codes = normalizeCountryCodes(value);
  return codes.length ? codes.join(', ') : '-';
};

const nullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const nullableInteger = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
};

const appendParam = (params, key, value) => {
  const normalized = String(value ?? '').trim();
  if (normalized) params.set(key, normalized);
};

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const formatAmount = (value) => {
  if (!hasValue(value)) return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
};

const formatMoney = (amount, currency) => {
  if (!hasValue(amount)) return '-';
  return `${formatAmount(amount)} ${upperTrim(currency)}`.trim();
};

const formatRate = (value) => {
  if (!hasValue(value)) return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 18 });
};

const rateDisplay = (row, displayField, valueField) => {
  if (hasValue(row?.[displayField])) return row[displayField];
  return formatRate(row?.[valueField]);
};

const flowRateDisplay = (row, displayField, valueField) => {
  if (hasValue(row?.[displayField]) || hasValue(row?.[valueField])) return rateDisplay(row, displayField, valueField);
  return rateDisplay(row, 'rateDisplay', 'rate');
};

const rateSourceLabel = (value) => {
  if (value === 'MARKET_RATE') return 'Market rate';
  if (value === 'COLLECTION_RATE_OVERRIDE') return 'Collection override';
  if (value === 'PAYOUT_RATE_OVERRIDE') return 'Payout override';
  return value || '-';
};

const formatJson = (value) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const toList = (res) => (Array.isArray(res) ? res : res?.content || []);

const uniqueSorted = (values) => [...new Set(values.map(upperTrim).filter(Boolean))].sort();

const getBankAccountEnabled = (row) => Boolean(row?.bankAccountEnabled);

const getBankAccountApplicationEnabled = (row) => Boolean(row?.bankAccountApplicationEnabled);

const getBankAccountOrderCurrency = (draft) => upperTrim(draft.bankAccountOrderPriceCurrency) || upperTrim(draft.currency);

const getBankAccountCostCurrency = (draft) => upperTrim(draft.bankAccountOrderCostCurrency) || upperTrim(draft.currency);

const formatEstimatedCommission = (draft) => {
  const priceAmount = nullableNumber(draft.bankAccountOrderPriceAmount) ?? 0;
  const costAmount = nullableNumber(draft.bankAccountOrderCostAmount) ?? 0;
  const priceCurrency = getBankAccountOrderCurrency(draft);
  const costCurrency = getBankAccountCostCurrency(draft);
  if (!priceCurrency || !costCurrency) return '-';
  if (priceCurrency !== costCurrency) return 'Select matching currencies to estimate here.';
  return formatMoney(priceAmount - costAmount, priceCurrency);
};

const optionLabel = (item, fallbackPrefix) => {
  const name = item?.displayName || item?.name || item?.code || item?.currency || item?.reference;
  const suffix = item?.active === false ? ' (inactive)' : '';
  return `${name || `${fallbackPrefix} #${item?.id ?? '-'}`}${item?.id !== null && item?.id !== undefined ? ` (#${item.id})` : ''}${suffix}`;
};

export default function CurrencyProductsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [defaultBankAccountTarget, setDefaultBankAccountTarget] = useState(null);
  const [defaultBankAccountDraft, setDefaultBankAccountDraft] = useState(emptyDefaultBankAccountDraft);
  const [showDefaultBankAccount, setShowDefaultBankAccount] = useState(false);
  const [createBankAccountTarget, setCreateBankAccountTarget] = useState(null);
  const [createBankAccountDraft, setCreateBankAccountDraft] = useState(emptyCreateBankAccountDraft);
  const [createBankAccountResult, setCreateBankAccountResult] = useState(null);
  const [completeBankAccountOrderDraft, setCompleteBankAccountOrderDraft] = useState(emptyBankAccountOrderDraft);
  const [cancelBankAccountOrderNote, setCancelBankAccountOrderNote] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewDraft, setPreviewDraft] = useState(emptyPreviewDraft);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [previewOptionsLoading, setPreviewOptionsLoading] = useState(false);
  const [previewOptionsError, setPreviewOptionsError] = useState(null);
  const [currencyProductOptions, setCurrencyProductOptions] = useState([]);
  const [paymentMethodOptions, setPaymentMethodOptions] = useState([]);
  const [billProductOptions, setBillProductOptions] = useState([]);
  const [paymentProviderOptions, setPaymentProviderOptions] = useState([]);
  const [feeConfigOptions, setFeeConfigOptions] = useState([]);
  const [paymentMethodActionConfigOptions, setPaymentMethodActionConfigOptions] = useState([]);
  const [filterDraft, setFilterDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);

  const previewCurrencyOptions = useMemo(
    () => uniqueSorted([
      ...currencyProductOptions.map((item) => item?.currency),
      ...currencyProductOptions.map((item) => item?.baseCurrency),
      ...currencyOptions
    ]),
    [currencyProductOptions]
  );

  const previewActionOptions = useMemo(
    () => uniqueSorted([
      ...feeConfigOptions.map((item) => item?.action),
      ...paymentMethodActionConfigOptions.map((item) => item?.action),
      ...fallbackActionOptions
    ]),
    [feeConfigOptions, paymentMethodActionConfigOptions]
  );

  const previewFeeModeOptions = useMemo(
    () => uniqueSorted([
      ...feeConfigOptions.map((item) => item?.feeApplicationMode),
      ...fallbackFeeApplicationModeOptions
    ]),
    [feeConfigOptions]
  );

  const previewProviderOptions = useMemo(
    () => uniqueSorted([
      ...paymentProviderOptions.map((item) => item?.name),
      ...paymentProviderOptions.map((item) => item?.displayName)
    ]),
    [paymentProviderOptions]
  );

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => String(value ?? '').trim()).length,
    [filters]
  );

  const activeFilterChips = useMemo(() => (
    Object.entries(filters)
      .filter(([, value]) => String(value ?? '').trim())
      .map(([key, value]) => ({ key, label: `${key}: ${value}` }))
  ), [filters]);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      Object.entries(filters).forEach(([key, value]) => appendParam(params, key, value));
      const res = await api.currencyProducts.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message || 'Failed to load currency products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadPreviewOptions = async () => {
      setPreviewOptionsLoading(true);
      setPreviewOptionsError(null);
      const params = new URLSearchParams({ page: '0', size: '500' });
      try {
        const [
          currenciesRes,
          paymentMethodsRes,
          billProductsRes,
          paymentProvidersRes,
          feeConfigsRes,
          actionConfigsRes
        ] = await Promise.all([
          api.currencyProducts.list(params),
          api.paymentMethods.list(params),
          api.billProducts.list(params),
          api.paymentProviders.list(params),
          api.feeConfigs.list(params),
          api.paymentMethodActionConfigs.list(params)
        ]);
        setCurrencyProductOptions(toList(currenciesRes));
        setPaymentMethodOptions(toList(paymentMethodsRes));
        setBillProductOptions(toList(billProductsRes));
        setPaymentProviderOptions(toList(paymentProvidersRes));
        setFeeConfigOptions(toList(feeConfigsRes));
        setPaymentMethodActionConfigOptions(toList(actionConfigsRes));
      } catch (err) {
        setPreviewOptionsError(err.message || 'Failed to load simulator dropdown options.');
      } finally {
        setPreviewOptionsLoading(false);
      }
    };
    loadPreviewOptions();
  }, []);

  const validateDraft = () => {
    const currency = upperTrim(draft.currency);
    const baseCurrency = upperTrim(draft.baseCurrency);
    const rate = Number(draft.rate);
    const collectionRate = nullableNumber(draft.collectionRate);
    const payoutRate = nullableNumber(draft.payoutRate);
    const collectionMarginPercent = nullableNumber(draft.collectionMarginPercent);
    const payoutMarginPercent = nullableNumber(draft.payoutMarginPercent);
    const bankAccountOrderPriceAmount = nullableNumber(draft.bankAccountOrderPriceAmount);
    const bankAccountOrderCostAmount = nullableNumber(draft.bankAccountOrderCostAmount);
    const countryCodes = normalizeCountryCodes(draft.countryCodes);
    const defaultCountryCodes = normalizeCountryCodes(draft.defaultCountryCodes);
    if (!currency) return 'Currency is required.';
    if (!draft.displayName.trim()) return 'Display name is required.';
    if (!baseCurrency) return 'Base currency is required.';
    if (!Number.isFinite(rate) || rate <= 0) return 'Rate must be a positive number.';
    if (draft.collectionRate !== '' && (collectionRate === null || collectionRate <= 0)) return 'Collection base rate override must be a positive number.';
    if (draft.payoutRate !== '' && (payoutRate === null || payoutRate <= 0)) return 'Payout base rate override must be a positive number.';
    if (draft.collectionMarginPercent !== '' && (collectionMarginPercent === null || collectionMarginPercent < 0)) return 'Collection margin must be zero or a positive number.';
    if (draft.payoutMarginPercent !== '' && (payoutMarginPercent === null || payoutMarginPercent < 0)) return 'Payout margin must be zero or a positive number.';
    if (draft.bankAccountOrderPriceAmount !== '' && (bankAccountOrderPriceAmount === null || bankAccountOrderPriceAmount < 0)) return 'Bank account order price must be zero or a positive number.';
    if (draft.bankAccountOrderCostAmount !== '' && (bankAccountOrderCostAmount === null || bankAccountOrderCostAmount < 0)) return 'Bank account order cost must be zero or a positive number.';
    if (!upperTrim(draft.rateProvider)) return 'Rate provider is required.';
    if (draft.rateFetchedAt && !toIsoOrNull(draft.rateFetchedAt)) return 'Rate fetched at must be a valid date and time.';
    if (defaultCountryCodes.some((code) => !countryCodes.includes(code))) return 'Default countries must also be included in country availability.';
    return null;
  };

  const buildPayload = () => {
    const defaultCountryCodes = normalizeCountryCodes(draft.defaultCountryCodes);
    const countryCodes = mergeCountryCodes(draft.countryCodes, defaultCountryCodes);
    const payload = {
      currency: upperTrim(draft.currency),
      displayName: draft.displayName.trim(),
      logoUrl: draft.logoUrl.trim() || null,
      active: Boolean(draft.active),
      walletEnabled: Boolean(draft.walletEnabled),
      bankAccountEnabled: Boolean(draft.bankAccountEnabled),
      bankAccountApplicationEnabled: Boolean(draft.bankAccountApplicationEnabled),
      bankAccountAutoCreateEnabled: Boolean(draft.bankAccountAutoCreateEnabled),
      bankAccountOrderPriceAmount: nullableNumber(draft.bankAccountOrderPriceAmount) ?? 0,
      bankAccountOrderPriceCurrency: getBankAccountOrderCurrency(draft),
      bankAccountOrderCostAmount: nullableNumber(draft.bankAccountOrderCostAmount) ?? 0,
      bankAccountOrderCostCurrency: getBankAccountCostCurrency(draft),
      legacyBalanceBacked: Boolean(draft.legacyBalanceBacked),
      baseCurrency: upperTrim(draft.baseCurrency),
      rate: Number(draft.rate),
      manualFxRate: Boolean(draft.manualFxRate),
      collectionMarginPercent: nullableNumber(draft.collectionMarginPercent),
      payoutMarginPercent: nullableNumber(draft.payoutMarginPercent),
      rateProvider: upperTrim(draft.rateProvider),
      rateFetchedAt: toIsoOrNull(draft.rateFetchedAt),
      countryCodes,
      defaultCountryCodes
    };
    if (draft.collectionRate !== '') payload.collectionRate = nullableNumber(draft.collectionRate);
    if (draft.payoutRate !== '') payload.payoutRate = nullableNumber(draft.payoutRate);
    if (draft.clearCollectionRate) payload.clearCollectionRate = true;
    if (draft.clearPayoutRate) payload.clearPayoutRate = true;
    return payload;
  };

  const openCreate = () => {
    setDraft({ ...emptyDraft, rateFetchedAt: toDateTimeLocal(new Date().toISOString()) });
    setSelected(null);
    setShowCreate(true);
    setError(null);
    setInfo(null);
  };

  const openPreview = (row = null) => {
    setPreviewDraft({
      ...emptyPreviewDraft,
      sourceCurrency: row?.baseCurrency || emptyPreviewDraft.sourceCurrency,
      targetCurrency: row?.currency || emptyPreviewDraft.targetCurrency
    });
    setPreviewResult(null);
    setPreviewError(null);
    setShowPreview(true);
    setError(null);
    setInfo(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      currency: row.currency ?? '',
      displayName: row.displayName ?? '',
      logoUrl: row.logoUrl ?? '',
      active: row.active ?? true,
      walletEnabled: row.walletEnabled ?? true,
      bankAccountEnabled: getBankAccountEnabled(row),
      bankAccountApplicationEnabled: getBankAccountApplicationEnabled(row),
      bankAccountAutoCreateEnabled: Boolean(row.bankAccountAutoCreateEnabled),
      bankAccountOrderPriceAmount: row.bankAccountOrderPriceAmount ?? '0',
      bankAccountOrderPriceCurrency: row.bankAccountOrderPriceCurrency ?? row.currency ?? '',
      bankAccountOrderCostAmount: row.bankAccountOrderCostAmount ?? '0',
      bankAccountOrderCostCurrency: row.bankAccountOrderCostCurrency ?? row.currency ?? '',
      legacyBalanceBacked: row.legacyBalanceBacked ?? false,
      baseCurrency: row.baseCurrency ?? 'USD',
      rate: row.rate ?? '',
      collectionRate: row.collectionRate ?? '',
      payoutRate: row.payoutRate ?? '',
      clearCollectionRate: false,
      clearPayoutRate: false,
      manualFxRate: Boolean(row.manualFxRate),
      collectionMarginPercent: row.collectionMarginPercent ?? '',
      payoutMarginPercent: row.payoutMarginPercent ?? '',
      rateProvider: row.rateProvider ?? (row.manualFxRate ? 'ADMIN' : 'EXCHANGERATE_API'),
      rateFetchedAt: toDateTimeLocal(row.rateFetchedAt),
      countryCodes: normalizeCountryCodes(row.countryCodes),
      defaultCountryCodes: normalizeCountryCodes(row.defaultCountryCodes)
    });
    setShowEdit(true);
    setError(null);
    setInfo(null);
  };

  const openDetail = async (row) => {
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      const data = await api.currencyProducts.get(row.id);
      setSelected(data || row);
      setShowDetail(true);
    } catch (err) {
      setError(err.message || `Failed to load currency product ${row.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async () => {
    const message = validateDraft();
    if (message) {
      setError(message);
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.currencyProducts.create(buildPayload());
      setInfo('Created currency product.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to create currency product.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    const message = validateDraft();
    if (message) {
      setError(message);
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.currencyProducts.update(selected.id, buildPayload());
      setInfo(`Updated currency product ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to update currency product ${selected.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    const id = confirmDelete.id;
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.currencyProducts.remove(id);
      setInfo(`Deleted currency product ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to delete currency product ${id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async (row) => {
    if (!row?.id) return;
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.currencyProducts.update(row.id, {
        currency: row.currency,
        displayName: row.displayName,
        active: false,
        bankAccountEnabled: getBankAccountEnabled(row),
        bankAccountApplicationEnabled: getBankAccountApplicationEnabled(row),
        bankAccountAutoCreateEnabled: Boolean(row.bankAccountAutoCreateEnabled),
        bankAccountOrderPriceAmount: row.bankAccountOrderPriceAmount ?? 0,
        bankAccountOrderPriceCurrency: upperTrim(row.bankAccountOrderPriceCurrency) || upperTrim(row.currency),
        bankAccountOrderCostAmount: row.bankAccountOrderCostAmount ?? 0,
        bankAccountOrderCostCurrency: upperTrim(row.bankAccountOrderCostCurrency) || upperTrim(row.currency),
        countryCodes: normalizeCountryCodes(row.countryCodes),
        defaultCountryCodes: normalizeCountryCodes(row.defaultCountryCodes)
      });
      setInfo(`Deactivated currency product ${row.currency || row.id}.`);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to deactivate currency product ${row.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const openDefaultBankAccount = async (row) => {
    if (!row?.id) return;
    setDefaultBankAccountTarget(row);
    setDefaultBankAccountDraft(emptyDefaultBankAccountDraft);
    setShowDefaultBankAccount(true);
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      const data = await api.currencyProducts.getDefaultBankAccount(row.id);
      setDefaultBankAccountDraft({
        internationalAccountNumber: data?.internationalAccountNumber ?? '',
        accountNumber: data?.accountNumber ?? '',
        swiftBic: data?.swiftBic ?? '',
        routingNumber: data?.routingNumber ?? ''
      });
    } catch (err) {
      if (err.status !== 404) {
        setError(err.message || `Failed to load default bank account for ${row.currency || row.id}.`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const buildDefaultBankAccountPayload = () => ({
    internationalAccountNumber: defaultBankAccountDraft.internationalAccountNumber.trim() || null,
    accountNumber: defaultBankAccountDraft.accountNumber.trim() || null,
    swiftBic: defaultBankAccountDraft.swiftBic.trim() || null,
    routingNumber: defaultBankAccountDraft.routingNumber.trim() || null
  });

  const handleSaveDefaultBankAccount = async () => {
    if (!defaultBankAccountTarget?.id) return;
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.currencyProducts.updateDefaultBankAccount(defaultBankAccountTarget.id, buildDefaultBankAccountPayload());
      setInfo(`Saved default bank account for ${defaultBankAccountTarget.currency || defaultBankAccountTarget.id}.`);
      setShowDefaultBankAccount(false);
    } catch (err) {
      setError(err.message || `Failed to save default bank account for ${defaultBankAccountTarget.currency || defaultBankAccountTarget.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDefaultBankAccount = async () => {
    if (!defaultBankAccountTarget?.id) return;
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.currencyProducts.removeDefaultBankAccount(defaultBankAccountTarget.id);
      setInfo(`Deleted default bank account for ${defaultBankAccountTarget.currency || defaultBankAccountTarget.id}.`);
      setShowDefaultBankAccount(false);
      setDefaultBankAccountDraft(emptyDefaultBankAccountDraft);
    } catch (err) {
      setError(err.message || `Failed to delete default bank account for ${defaultBankAccountTarget.currency || defaultBankAccountTarget.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const openCreateBankAccount = (row) => {
    if (!getBankAccountEnabled(row)) return;
    setCreateBankAccountTarget(row);
    setCreateBankAccountDraft({
      ...emptyCreateBankAccountDraft,
      currency: upperTrim(row.currency)
    });
    setCreateBankAccountResult(null);
    setCompleteBankAccountOrderDraft(emptyBankAccountOrderDraft);
    setCancelBankAccountOrderNote('');
    setError(null);
    setInfo(null);
  };

  const buildCreateBankAccountPayload = () => {
    const targetType = createBankAccountDraft.targetType === 'email' ? 'email' : 'accountId';
    const payload = {
      currency: upperTrim(createBankAccountDraft.currency)
    };
    if (targetType === 'email') {
      payload.email = createBankAccountDraft.email.trim();
    } else {
      payload.accountId = Number(createBankAccountDraft.accountId);
    }
    return payload;
  };

  const handleCreateBankAccount = async () => {
    const targetType = createBankAccountDraft.targetType === 'email' ? 'email' : 'accountId';
    const accountId = String(createBankAccountDraft.accountId || '').trim();
    const email = createBankAccountDraft.email.trim();
    const currency = upperTrim(createBankAccountDraft.currency);
    if (!currency) {
      setError('Currency is required.');
      return;
    }
    if (targetType === 'email' && !email) {
      setError('Email is required.');
      return;
    }
    if (targetType === 'accountId' && (!accountId || !Number.isInteger(Number(accountId)))) {
      setError('Account ID must be a whole number.');
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    setCreateBankAccountResult(null);
    try {
      const result = await api.bankAccounts.create(buildCreateBankAccountPayload());
      setCreateBankAccountResult(result || null);
      const status = String(result?.status || result?.eligibilityStatus || '').toUpperCase();
      if (status === 'PROCESSING') {
        setInfo('Bank account request created and is being processed.');
      } else {
        setInfo('Bank account returned.');
      }
    } catch (err) {
      setError(err.message || 'Failed to create bank account.');
    } finally {
      setActionLoading(false);
    }
  };

  const compactPayload = (payload) => {
    const next = {};
    Object.entries(payload).forEach(([key, value]) => {
      const normalized = String(value ?? '').trim();
      if (normalized) next[key] = normalized;
    });
    return next;
  };

  const handleCompleteBankAccountOrder = async () => {
    const transactionId = createBankAccountResult?.orderTransactionId;
    if (!transactionId) {
      setError('Order transaction ID is required.');
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      const result = await api.bankAccounts.completeOrder(transactionId, compactPayload(completeBankAccountOrderDraft));
      setCreateBankAccountResult(result || { ...createBankAccountResult, status: 'ACTIVE', orderTransactionStatus: 'COMPLETED' });
      setInfo('Bank account order completed.');
    } catch (err) {
      setError(err.message || `Failed to complete bank account order ${transactionId}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBankAccountOrder = async () => {
    const transactionId = createBankAccountResult?.orderTransactionId;
    if (!transactionId) {
      setError('Order transaction ID is required.');
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      const payload = compactPayload({ note: cancelBankAccountOrderNote });
      const result = await api.bankAccounts.cancelOrder(transactionId, payload);
      setCreateBankAccountResult(result || { ...createBankAccountResult, orderTransactionStatus: 'CANCELED' });
      setInfo('Bank account order canceled.');
    } catch (err) {
      setError(err.message || `Failed to cancel bank account order ${transactionId}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const buildPreviewPayload = () => {
    const payload = {
      amount: nullableNumber(previewDraft.amount),
      sourceCurrency: upperTrim(previewDraft.sourceCurrency),
      targetCurrency: upperTrim(previewDraft.targetCurrency)
    };
    [
      'action',
      'providerName',
      'feeApplicationMode'
    ].forEach((key) => {
      const value = String(previewDraft[key] || '').trim();
      if (value) payload[key] = value.toUpperCase();
    });
    [
      'paymentMethodId',
      'billProductId',
      'fiatWalletId',
      'savingId',
      'groupSavingId'
    ].forEach((key) => {
      const value = nullableInteger(previewDraft[key]);
      if (value !== null) payload[key] = value;
    });
    return payload;
  };

  const handlePreviewConversion = async () => {
    const amount = nullableNumber(previewDraft.amount);
    if (amount === null || amount < 0) {
      setPreviewError('Amount must be zero or positive.');
      return;
    }
    if (!upperTrim(previewDraft.sourceCurrency)) {
      setPreviewError('Source currency is required.');
      return;
    }
    if (!upperTrim(previewDraft.targetCurrency)) {
      setPreviewError('Target currency is required.');
      return;
    }
    const idFields = ['paymentMethodId', 'billProductId', 'fiatWalletId', 'savingId', 'groupSavingId'];
    const invalidIdField = idFields.find((field) => String(previewDraft[field] || '').trim() && nullableInteger(previewDraft[field]) === null);
    if (invalidIdField) {
      setPreviewError(`${invalidIdField} must be a whole number.`);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewResult(null);
    try {
      const res = await api.fiatExchangeRates.previewConversion(buildPreviewPayload());
      setPreviewResult(res || null);
    } catch (err) {
      setPreviewError(err.message || 'Failed to preview conversion.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    setFilterDraft((previous) => ({ ...previous, [key]: value }));
  };

  const applyFilters = () => {
    setFilters({ ...filterDraft });
    setPage(0);
  };

  const resetFilters = () => {
    setFilterDraft(emptyFilters);
    setFilters(emptyFilters);
    setPage(0);
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size : page + 1 < pageMeta.totalPages;

  const columns = [
    {
      key: 'currency',
      label: 'Currency',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {row.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.logoUrl} alt="" width={28} height={28} style={{ borderRadius: '999px', objectFit: 'cover', border: '1px solid var(--border)' }} />
          ) : null}
          <strong>{row.currency || '-'}</strong>
        </div>
      )
    },
    { key: 'displayName', label: 'Display name' },
    {
      key: 'rate',
      label: 'Market rate',
      render: (row) => rateDisplay(row, 'rateDisplay', 'rate')
    },
    {
      key: 'collectionRate',
      label: 'Collection rate',
      render: (row) => flowRateDisplay(row, 'collectionRateDisplay', 'collectionRate')
    },
    {
      key: 'collectionMarginPercent',
      label: 'Collection margin',
      render: (row) => {
        return (
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <div style={{ fontWeight: 700 }}>{formatPercent(row.collectionMarginPercent)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Effective <strong style={{ color: 'var(--text)', fontSize: '14px' }}>{rateDisplay(row, 'collectionEffectiveRateDisplay', 'collectionEffectiveRate')}</strong>
            </div>
          </div>
        );
      }
    },
    {
      key: 'payoutRate',
      label: 'Payout rate',
      render: (row) => flowRateDisplay(row, 'payoutRateDisplay', 'payoutRate')
    },
    {
      key: 'payoutMarginPercent',
      label: 'Payout margin',
      render: (row) => {
        return (
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <div style={{ fontWeight: 700 }}>{formatPercent(row.payoutMarginPercent)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Effective <strong style={{ color: 'var(--text)', fontSize: '14px' }}>{rateDisplay(row, 'payoutEffectiveRateDisplay', 'payoutEffectiveRate')}</strong>
            </div>
          </div>
        );
      }
    },
    { key: 'manualFxRate', label: 'Manual FX', render: (row) => formatBool(row.manualFxRate) },
    { key: 'walletEnabled', label: 'Wallet', render: (row) => formatBool(row.walletEnabled) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral" disabled={actionLoading}>View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral" disabled={actionLoading}>Edit</button>
          <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger" disabled={actionLoading}>Delete</button>
        </div>
      )
    }
  ];

  const renderCurrencyInput = (id, label, value, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label htmlFor={id}>{label}</label>
      <input id={id} list="currencyProductCurrencyOptions" value={value} onChange={onChange} onBlur={onChange} />
    </div>
  );

  const renderCheckbox = (id, label, checked, onChange) => (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '38px' }}>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );

  const renderFilterInput = (id, label, options = {}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={options.type || 'text'}
        min={options.min}
        step={options.step}
        list={options.list}
        value={filterDraft[id]}
        placeholder={options.placeholder}
        onChange={(e) => updateFilter(id, options.uppercase ? e.target.value.toUpperCase() : e.target.value)}
      />
    </div>
  );

  const renderBooleanFilter = (id, label) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={filterDraft[id]} onChange={(e) => updateFilter(id, e.target.value)}>
        <option value="">Any</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </div>
  );

  const renderCountryMultiSelect = (id, label, value, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        multiple
        value={normalizeCountryCodes(value)}
        onChange={(e) => onChange(Array.from(e.target.selectedOptions, (option) => option.value))}
        style={{ minHeight: '132px' }}
      >
        {countryOptions.map((country) => (
          <option key={country.cca2} value={country.cca2}>
            {country.cca2} - {country.name}
          </option>
        ))}
      </select>
    </div>
  );

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      {renderCurrencyInput('currency', 'Currency', draft.currency, (e) => setDraft((p) => ({ ...p, currency: e.target.value.toUpperCase() })))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="displayName">Display name</label>
        <input id="displayName" value={draft.displayName} onChange={(e) => setDraft((p) => ({ ...p, displayName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="logoUrl">Logo URL</label>
        <input id="logoUrl" type="url" value={draft.logoUrl} onChange={(e) => setDraft((p) => ({ ...p, logoUrl: e.target.value }))} placeholder="https://..." />
      </div>
      {renderCurrencyInput('baseCurrency', 'Base currency', draft.baseCurrency, (e) => setDraft((p) => ({ ...p, baseCurrency: e.target.value.toUpperCase() })))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rate">Synced/default market rate</label>
        <input id="rate" type="number" min="0" step="0.000001" value={draft.rate} onChange={(e) => setDraft((p) => ({ ...p, rate: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="collectionRate">Collection base rate override</label>
        <input
          id="collectionRate"
          type="number"
          min="0"
          step="0.000001"
          value={draft.collectionRate}
          onChange={(e) => setDraft((p) => ({ ...p, collectionRate: e.target.value, clearCollectionRate: e.target.value ? false : p.clearCollectionRate }))}
          placeholder="Use synced/default market rate"
        />
        {selected?.id ? renderCheckbox('clearCollectionRate', 'Clear collection override on save', draft.clearCollectionRate, (e) => setDraft((p) => ({
          ...p,
          clearCollectionRate: e.target.checked,
          collectionRate: e.target.checked ? '' : p.collectionRate
        }))) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="payoutRate">Payout base rate override</label>
        <input
          id="payoutRate"
          type="number"
          min="0"
          step="0.000001"
          value={draft.payoutRate}
          onChange={(e) => setDraft((p) => ({ ...p, payoutRate: e.target.value, clearPayoutRate: e.target.value ? false : p.clearPayoutRate }))}
          placeholder="Use synced/default market rate"
        />
        {selected?.id ? renderCheckbox('clearPayoutRate', 'Clear payout override on save', draft.clearPayoutRate, (e) => setDraft((p) => ({
          ...p,
          clearPayoutRate: e.target.checked,
          payoutRate: e.target.checked ? '' : p.payoutRate
        }))) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
        {renderCheckbox('manualFxRate', 'Manually manage FX rate', draft.manualFxRate, (e) => setDraft((p) => ({
          ...p,
          manualFxRate: e.target.checked,
          rateProvider: e.target.checked ? 'ADMIN' : (p.rateProvider === 'ADMIN' ? 'EXCHANGERATE_API' : p.rateProvider)
        })))}
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          {draft.manualFxRate
            ? 'Automatic FX updates will not change this currency rate.'
            : 'The next automatic FX sync may update this rate.'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="collectionMarginPercent">Collection margin %</label>
        <input id="collectionMarginPercent" type="number" min="0" step="0.01" value={draft.collectionMarginPercent} onChange={(e) => setDraft((p) => ({ ...p, collectionMarginPercent: e.target.value }))} placeholder="0" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="payoutMarginPercent">Payout margin %</label>
        <input id="payoutMarginPercent" type="number" min="0" step="0.01" value={draft.payoutMarginPercent} onChange={(e) => setDraft((p) => ({ ...p, payoutMarginPercent: e.target.value }))} placeholder="0" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="bankAccountOrderPriceAmount">Customer order price</label>
        <input
          id="bankAccountOrderPriceAmount"
          type="number"
          min="0"
          step="0.01"
          value={draft.bankAccountOrderPriceAmount}
          onChange={(e) => setDraft((p) => ({ ...p, bankAccountOrderPriceAmount: e.target.value }))}
          placeholder="0"
        />
      </div>
      {renderCurrencyInput('bankAccountOrderPriceCurrency', 'Order price currency', draft.bankAccountOrderPriceCurrency, (e) => setDraft((p) => ({ ...p, bankAccountOrderPriceCurrency: e.target.value.toUpperCase() })))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="bankAccountOrderCostAmount">Internal provider cost</label>
        <input
          id="bankAccountOrderCostAmount"
          type="number"
          min="0"
          step="0.01"
          value={draft.bankAccountOrderCostAmount}
          onChange={(e) => setDraft((p) => ({ ...p, bankAccountOrderCostAmount: e.target.value }))}
          placeholder="0"
        />
      </div>
      {renderCurrencyInput('bankAccountOrderCostCurrency', 'Cost currency', draft.bankAccountOrderCostCurrency, (e) => setDraft((p) => ({ ...p, bankAccountOrderCostCurrency: e.target.value.toUpperCase() })))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rateProvider">Rate provider</label>
        <input id="rateProvider" list="currencyProductRateProviderOptions" value={draft.rateProvider} onChange={(e) => setDraft((p) => ({ ...p, rateProvider: e.target.value.toUpperCase() }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rateFetchedAt">Rate fetched at</label>
        <input id="rateFetchedAt" type="datetime-local" value={draft.rateFetchedAt} onChange={(e) => setDraft((p) => ({ ...p, rateFetchedAt: e.target.value }))} />
      </div>
      {renderCountryMultiSelect('countryCodes', 'Country availability', draft.countryCodes, (countryCodes) => setDraft((p) => ({
        ...p,
        countryCodes: mergeCountryCodes(countryCodes, p.defaultCountryCodes)
      })))}
      {renderCountryMultiSelect('defaultCountryCodes', 'Default in countries', draft.defaultCountryCodes, (defaultCountryCodes) => setDraft((p) => ({
        ...p,
        defaultCountryCodes: normalizeCountryCodes(defaultCountryCodes),
        countryCodes: mergeCountryCodes(p.countryCodes, defaultCountryCodes)
      })))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {renderCheckbox('active', 'Active', draft.active, (e) => setDraft((p) => ({ ...p, active: e.target.checked })))}
        {renderCheckbox('walletEnabled', 'Wallet enabled', draft.walletEnabled, (e) => setDraft((p) => ({ ...p, walletEnabled: e.target.checked })))}
        {renderCheckbox('bankAccountEnabled', 'Bank account available', draft.bankAccountEnabled, (e) => setDraft((p) => ({ ...p, bankAccountEnabled: e.target.checked })))}
        {renderCheckbox('bankAccountApplicationEnabled', 'Bank account application enabled', draft.bankAccountApplicationEnabled, (e) => setDraft((p) => ({ ...p, bankAccountApplicationEnabled: e.target.checked })))}
        {renderCheckbox('bankAccountAutoCreateEnabled', 'Auto-create bank account when eligible', draft.bankAccountAutoCreateEnabled, (e) => setDraft((p) => ({ ...p, bankAccountAutoCreateEnabled: e.target.checked })))}
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Bank account available returns bank-transfer details. Bank account application enabled only opens the enhanced verification/application flow.
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          When enabled, eligible users with approved enhanced verification will automatically get a bank account request when they view bank account details for this currency. Use only for currencies/providers where account creation is free or does not need explicit payment.
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Order price is used only for ORDER_BANK_ACCOUNT. Leave currency empty to use the product currency.
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Estimated commission = customer price - provider cost: <strong>{formatEstimatedCommission(draft)}</strong>. This is only an estimate in the currency product currency. The final transaction commission is computed by backend in the actual payment currency at order time.
        </div>
        {renderCheckbox('legacyBalanceBacked', 'Legacy balance backed', draft.legacyBalanceBacked, (e) => setDraft((p) => ({ ...p, legacyBalanceBacked: e.target.checked })))}
      </div>
    </div>
  );

  const renderPreviewInput = (id, label, options = {}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={options.type || 'text'}
        min={options.min}
        step={options.step}
        list={options.list}
        value={previewDraft[id]}
        placeholder={options.placeholder}
        onChange={(e) => setPreviewDraft((p) => ({ ...p, [id]: options.uppercase ? e.target.value.toUpperCase() : e.target.value }))}
      />
    </div>
  );

  const renderPreviewSelect = (id, label, options, config = {}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={previewDraft[id]}
        disabled={config.disabled}
        onChange={(e) => setPreviewDraft((p) => ({ ...p, [id]: e.target.value }))}
      >
        <option value="">{config.emptyLabel || 'None'}</option>
        {options.map((option) => {
          const value = config.getValue ? config.getValue(option) : option;
          const labelText = config.getLabel ? config.getLabel(option) : option;
          return (
            <option key={String(value)} value={String(value)}>
              {labelText}
            </option>
          );
        })}
      </select>
    </div>
  );

  const renderPreviewResult = () => {
    if (!previewResult) return null;
    const fee = previewResult.feePreview;
    const previewMetadata = previewResult.metadata && typeof previewResult.metadata === 'object' && !Array.isArray(previewResult.metadata)
      ? previewResult.metadata
      : {};
    const hasFlowRateMetadata =
      hasValue(previewMetadata.rawFxRate) ||
      hasValue(previewMetadata.marketFxRate) ||
      hasValue(previewMetadata.fxEffectiveRate) ||
      hasValue(previewMetadata.fxMarginPercent);
    const customerPaidProviderFeeSource = fee || previewResult;
    const hasCustomerPaidProviderFee =
      hasValue(customerPaidProviderFeeSource.customerPaidProviderFeeAmount) ||
      hasValue(customerPaidProviderFeeSource.customerPaidProviderFeePercentage) ||
      hasValue(customerPaidProviderFeeSource.customerPaidProviderFeeCurrency) ||
      hasValue(customerPaidProviderFeeSource.customerPaidProviderFeeChargedBy) ||
      hasValue(customerPaidProviderFeeSource.customerPaidProviderFeeMessage);
    const providerErrors = Array.isArray(previewResult.providerErrors) ? previewResult.providerErrors : [];
    const hasActionContext =
      previewResult.previewMode === 'ACTION_FEE_AND_EXECUTION_PREVIEW' ||
      Boolean(previewResult.action) ||
      Boolean(fee) ||
      hasValue(previewResult.feeAdjustedSourceAmount) ||
      hasValue(previewResult.feeAdjustedConvertedAmount) ||
      hasValue(previewResult.actionConvertedAmount) ||
      hasValue(previewResult.executionSourceAmount) ||
      hasValue(previewResult.executionTargetAmount) ||
      hasValue(previewResult.executionRate) ||
      hasValue(previewResult.executionMarginAmount);
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <DetailGrid
          rows={[
            { label: 'Preview mode', value: previewResult.previewMode || '-' },
            { label: 'Source amount', value: formatMoney(previewResult.sourceAmount, previewResult.sourceCurrency) },
            { label: 'Target currency', value: previewResult.targetCurrency || '-' },
            { label: 'Provider', value: previewResult.provider || '-' },
            { label: 'Reference', value: previewResult.reference || '-' },
            { label: 'Fetched at', value: formatDateTime(previewResult.fetchedAt) }
          ]}
        />
        <DetailGrid
          rows={[
            { label: 'Raw rate', value: formatRate(previewResult.rawRate) },
            { label: 'Raw converted', value: formatMoney(previewResult.rawConvertedAmount, previewResult.targetCurrency) },
            { label: 'Collection margin', value: formatPercent(previewResult.collectionMarginPercent) },
            { label: 'Collection margin amount', value: formatMoney(previewResult.collectionMarginAmount, previewResult.targetCurrency) },
            { label: 'Collection rate', value: formatRate(previewResult.collectionRate) },
            { label: 'Collection converted', value: formatMoney(previewResult.collectionConvertedAmount, previewResult.targetCurrency) },
            { label: 'Payout margin', value: formatPercent(previewResult.payoutMarginPercent) },
            { label: 'Payout margin amount', value: formatMoney(previewResult.payoutMarginAmount, previewResult.targetCurrency) },
            { label: 'Payout rate', value: formatRate(previewResult.payoutRate) },
            { label: 'Payout converted', value: formatMoney(previewResult.payoutConvertedAmount, previewResult.targetCurrency) }
          ]}
        />
        {hasActionContext ? (
          <DetailGrid
            rows={[
              { label: 'Action', value: previewResult.action || '-' },
              { label: 'Action converted', value: formatMoney(previewResult.actionConvertedAmount, previewResult.targetCurrency) },
              { label: 'Fee-adjusted source', value: formatMoney(previewResult.feeAdjustedSourceAmount, previewResult.feeAdjustedSourceCurrency || previewResult.sourceCurrency) },
              { label: 'Fee-adjusted converted', value: formatMoney(previewResult.feeAdjustedConvertedAmount, previewResult.targetCurrency) },
              { label: 'Execution source', value: formatMoney(previewResult.executionSourceAmount, previewResult.sourceCurrency) },
              { label: 'Execution target', value: formatMoney(previewResult.executionTargetAmount, previewResult.targetCurrency) },
              { label: 'Execution rate', value: formatRate(previewResult.executionRate) },
              { label: 'Execution margin', value: formatMoney(previewResult.executionMarginAmount, previewResult.targetCurrency) },
              { label: 'Execution margin flow', value: previewResult.executionMarginFlow || '-' }
            ]}
          />
        ) : (
          <div className="card" style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Generic rate preview. Add an action to include fee lookup and estimated execution conversion context.
          </div>
        )}
        {fee ? (
          <DetailGrid
            rows={[
              { label: 'Requested amount', value: formatMoney(fee.requestedAmount, fee.requestedCurrency) },
              { label: 'Requested fee mode', value: fee.requestedFeeApplicationMode || '-' },
              { label: 'Applied fee mode', value: fee.appliedFeeApplicationMode || '-' },
              { label: 'Fees', value: formatMoney(fee.fees, fee.requestedCurrency) },
              { label: 'Net amount', value: formatMoney(fee.netAmount, fee.requestedCurrency) },
              { label: 'Gross amount', value: formatMoney(fee.grossAmount, fee.requestedCurrency) },
              { label: 'Payment amount', value: formatMoney(fee.paymentAmount, fee.paymentCurrency) },
              { label: 'Billing amount', value: formatMoney(fee.billingAmount, fee.billingCurrency) },
              { label: 'Billing FX rate', value: formatRate(fee.billingFxRate) },
              { label: 'Billing FX provider', value: fee.billingFxProvider || '-' },
              { label: 'Total to pay', value: formatMoney(fee.totalToPay, fee.requestedCurrency) },
              { label: 'Fees percentage', value: formatPercent(fee.feesPercentage) }
            ]}
          />
        ) : null}
        {hasFlowRateMetadata ? (
          <DetailGrid
            rows={[
              { label: 'Flow base rate', value: formatRate(previewMetadata.rawFxRate) },
              { label: 'Market/default rate', value: formatRate(previewMetadata.marketFxRate) },
              { label: 'Effective FX rate', value: formatRate(previewMetadata.fxEffectiveRate) },
              { label: 'FX margin percent', value: formatPercent(previewMetadata.fxMarginPercent) }
            ]}
          />
        ) : null}
        {hasCustomerPaidProviderFee ? (
          <div className="card" style={{ display: 'grid', gap: '0.6rem' }}>
            <div>
              <div style={{ fontWeight: 800 }}>Customer-paid provider charge</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '0.2rem' }}>
                Charged directly by customer&apos;s mobile-money provider. Not collected by Fondeka.
              </div>
            </div>
            <DetailGrid
              rows={[
                {
                  label: 'Flat fee',
                  value: formatMoney(
                    customerPaidProviderFeeSource.customerPaidProviderFeeAmount,
                    customerPaidProviderFeeSource.customerPaidProviderFeeCurrency || fee?.requestedCurrency || previewResult.sourceCurrency
                  )
                },
                { label: 'Percentage fee', value: formatPercent(customerPaidProviderFeeSource.customerPaidProviderFeePercentage) },
                { label: 'Charged by', value: customerPaidProviderFeeSource.customerPaidProviderFeeChargedBy || '-' },
                {
                  label: 'Included in total',
                  value: hasValue(customerPaidProviderFeeSource.customerPaidProviderFeeIncludedInTotal)
                    ? formatBool(
                      customerPaidProviderFeeSource.customerPaidProviderFeeIncludedInTotal === true ||
                      String(customerPaidProviderFeeSource.customerPaidProviderFeeIncludedInTotal).toLowerCase() === 'true'
                    )
                    : 'No'
                },
                { label: 'Message', value: customerPaidProviderFeeSource.customerPaidProviderFeeMessage || '-' }
              ]}
            />
          </div>
        ) : null}
        <details className="card" style={{ padding: '0.75rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Metadata</summary>
          <pre style={{ margin: '0.75rem 0 0', whiteSpace: 'pre-wrap', overflow: 'auto' }}>{formatJson(previewResult.metadata)}</pre>
        </details>
        <details className="card" style={{ padding: '0.75rem' }} open={providerErrors.length > 0}>
          <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Provider errors ({providerErrors.length})</summary>
          <pre style={{ margin: '0.75rem 0 0', whiteSpace: 'pre-wrap', overflow: 'auto' }}>{formatJson(providerErrors)}</pre>
        </details>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <datalist id="currencyProductCurrencyOptions">
        {currencyOptions.map((currency) => <option key={currency} value={currency} />)}
      </datalist>
      <datalist id="currencyProductRateProviderOptions">
        {rateProviderOptions.map((provider) => <option key={provider} value={provider} />)}
      </datalist>
      <datalist id="currencyProductCountryOptions">
        {countryOptions.map((country) => <option key={country.cca2} value={country.cca2}>{country.name}</option>)}
      </datalist>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Currency Products</div>
          <div style={{ color: 'var(--muted)' }}>Manage fiat currency products, wallet availability, and manual rates.</div>
        </div>
        <Link href="/dashboard" className="btn-neutral">
          {'<- Dashboard'}
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>Filters</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
            <button type="button" onClick={fetchRows} disabled={loading || actionLoading} className="btn-neutral btn-sm">
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button type="button" onClick={() => openPreview()} disabled={previewLoading} className="btn-neutral btn-sm">
              Simulate Exchange
            </button>
            <button type="button" onClick={openCreate} disabled={actionLoading} className="btn-success btn-sm">
              Create product
            </button>
          </div>
        </div>

        {activeFilterChips.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {activeFilterChips.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                onClear={() => {
                  const next = { ...filters, [chip.key]: '' };
                  setFilters(next);
                  setFilterDraft(next);
                  setPage(0);
                }}
              />
            ))}
          </div>
        )}

        {showFilters && (
          <>
            {activeFilterCount ? (
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}</div>
            ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
            {renderFilterInput('q', 'Search', { placeholder: 'cdf, dollar, franc' })}
            {renderFilterInput('id', 'ID', { type: 'number', min: '1', step: '1', placeholder: '12' })}
            {renderFilterInput('currency', 'Currency', { list: 'currencyProductCurrencyOptions', uppercase: true, placeholder: 'CDF' })}
            {renderFilterInput('displayName', 'Display name', { placeholder: 'Congolese Franc' })}
            {renderBooleanFilter('active', 'Active')}
            {renderBooleanFilter('walletEnabled', 'Wallet enabled')}
            {renderBooleanFilter('bankAccountEnabled', 'Bank account available')}
            {renderBooleanFilter('bankAccountApplicationEnabled', 'Bank account application enabled')}
            {renderBooleanFilter('bankAccountAutoCreateEnabled', 'Auto-create bank account')}
            {renderBooleanFilter('legacyBalanceBacked', 'Legacy backed')}
            {renderBooleanFilter('manualFxRate', 'Manual FX rate')}
            {renderFilterInput('baseCurrency', 'Base currency', { list: 'currencyProductCurrencyOptions', uppercase: true, placeholder: 'USD' })}
            {renderFilterInput('rateProvider', 'Rate provider', { list: 'currencyProductRateProviderOptions', uppercase: true, placeholder: 'ADMIN' })}
            {renderFilterInput('countryCode', 'Country', { list: 'currencyProductCountryOptions', uppercase: true, placeholder: 'CD' })}
            {renderFilterInput('defaultCountryCode', 'Default country', { list: 'currencyProductCountryOptions', uppercase: true, placeholder: 'CD' })}
            {renderBooleanFilter('hasCountryMapping', 'Has country mapping')}
            {renderBooleanFilter('hasLogo', 'Has logo')}
            {renderFilterInput('minRate', 'Min rate', { type: 'number', min: '0', step: '0.000001' })}
            {renderFilterInput('maxRate', 'Max rate', { type: 'number', min: '0', step: '0.000001' })}
            {renderFilterInput('minCollectionMarginPercent', 'Min collection margin %', { type: 'number', min: '0', step: '0.01' })}
            {renderFilterInput('maxCollectionMarginPercent', 'Max collection margin %', { type: 'number', min: '0', step: '0.01' })}
            {renderFilterInput('minPayoutMarginPercent', 'Min payout margin %', { type: 'number', min: '0', step: '0.01' })}
            {renderFilterInput('maxPayoutMarginPercent', 'Max payout margin %', { type: 'number', min: '0', step: '0.01' })}
            {renderFilterInput('rateFetchedFrom', 'Rate fetched from', { type: 'datetime-local' })}
            {renderFilterInput('rateFetchedTo', 'Rate fetched to', { type: 'datetime-local' })}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="page">Page</label>
              <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Math.max(0, Number(e.target.value) || 0))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="size">Size</label>
              <input id="size" type="number" min={1} max={200} value={size} onChange={(e) => { setSize(Math.max(1, Number(e.target.value) || 1)); setPage(0); }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            <button type="button" onClick={resetFilters} disabled={loading || actionLoading} className="btn-neutral btn-sm">
              Reset filters
            </button>
            <button type="button" onClick={applyFilters} disabled={loading || actionLoading} className="btn-primary btn-sm">
              Apply filters
            </button>
          </div>
          </>
        )}

        {pageMeta.totalElements !== null && (
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {pageMeta.totalElements} products total{pageMeta.totalPages !== null && pageMeta.totalPages > 0 ? ` | page ${page + 1}/${pageMeta.totalPages}` : ''}
          </span>
        )}
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        totalPages={pageMeta.totalPages}
        totalElements={pageMeta.totalElements}
        onPageChange={setPage}
        canPrev={canPrev}
        canNext={canNext}
        emptyLabel="No currency products found"
        showAccountQuickNav={false}
      />

      {showCreate && (
        <Modal title="Create currency product" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral" disabled={actionLoading}>Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success" disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Create'}</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit currency product ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral" disabled={actionLoading}>Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary" disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Currency product ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Currency', value: selected?.currency },
              { label: 'Display name', value: selected?.displayName },
              { label: 'Logo URL', value: selected?.logoUrl },
              { label: 'Active', value: formatBool(selected?.active) },
              { label: 'Wallet enabled', value: formatBool(selected?.walletEnabled) },
              {
                label: 'Bank account status',
                value: getBankAccountEnabled(selected)
                  ? 'Bank account-ready'
                  : getBankAccountApplicationEnabled(selected)
                    ? 'Application open'
                    : 'Coming soon'
              },
              { label: 'Bank account available', value: formatBool(getBankAccountEnabled(selected)) },
              { label: 'Bank account application enabled', value: formatBool(getBankAccountApplicationEnabled(selected)) },
              { label: 'Auto-create bank account when eligible', value: formatBool(selected?.bankAccountAutoCreateEnabled) },
              { label: 'Bank account order price', value: formatMoney(selected?.bankAccountOrderPriceAmount ?? 0, selected?.bankAccountOrderPriceCurrency || selected?.currency) },
              { label: 'Bank account order cost', value: formatMoney(selected?.bankAccountOrderCostAmount ?? 0, selected?.bankAccountOrderCostCurrency || selected?.currency) },
              { label: 'Legacy balance backed', value: formatBool(selected?.legacyBalanceBacked) },
              { label: 'Manual FX rate', value: formatBool(selected?.manualFxRate) },
              { label: 'Base currency', value: selected?.baseCurrency },
              { label: 'Country availability', value: formatCountryCodes(selected?.countryCodes) },
              { label: 'Default in countries', value: formatCountryCodes(selected?.defaultCountryCodes) },
              { label: 'Synced/default market rate', value: rateDisplay(selected, 'rateDisplay', 'rate') },
              { label: 'Collection base rate', value: flowRateDisplay(selected, 'collectionRateDisplay', 'collectionRate') },
              { label: 'Collection effective rate', value: rateDisplay(selected, 'collectionEffectiveRateDisplay', 'collectionEffectiveRate') },
              { label: 'Collection effective source', value: rateSourceLabel(selected?.collectionEffectiveRateSource) },
              { label: 'Payout base rate', value: flowRateDisplay(selected, 'payoutRateDisplay', 'payoutRate') },
              { label: 'Payout effective rate', value: rateDisplay(selected, 'payoutEffectiveRateDisplay', 'payoutEffectiveRate') },
              { label: 'Payout effective source', value: rateSourceLabel(selected?.payoutEffectiveRateSource) },
              { label: 'Collection margin', value: formatPercent(selected?.collectionMarginPercent) },
              { label: 'Payout margin', value: formatPercent(selected?.payoutMarginPercent) },
              { label: 'Rate provider', value: selected?.rateProvider },
              { label: 'Rate fetched at', value: formatDateTime(selected?.rateFetchedAt) },
              { label: 'Created at', value: formatDateTime(selected?.createdAt) },
              { label: 'Updated at', value: formatDateTime(selected?.updatedAt) }
            ]}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openPreview(selected)} className="btn-neutral" disabled={actionLoading || previewLoading}>
              Simulate Exchange
            </button>
            <button type="button" onClick={() => openDefaultBankAccount(selected)} className="btn-neutral" disabled={actionLoading}>
              Default bank account
            </button>
            {getBankAccountEnabled(selected) ? (
              <button type="button" onClick={() => openCreateBankAccount(selected)} className="btn-success" disabled={actionLoading}>
                Create bank account
              </button>
            ) : null}
            {selected?.active ? (
              <button type="button" onClick={() => handleDeactivate(selected)} className="btn-neutral" disabled={actionLoading}>
                Deactivate
              </button>
            ) : null}
          </div>
        </Modal>
      )}

      {showDefaultBankAccount && (
        <Modal title={`Default bank account - ${defaultBankAccountTarget?.currency || defaultBankAccountTarget?.id || ''}`} onClose={() => (!actionLoading ? setShowDefaultBankAccount(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Default receiving details for this currency product. These fields are saved through the currency product bank-account default endpoint.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {[
                ['internationalAccountNumber', 'International account number'],
                ['accountNumber', 'Account number'],
                ['swiftBic', 'SWIFT/BIC'],
                ['routingNumber', 'Routing number']
              ].map(([key, label]) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor={`defaultBankAccount-${key}`}>{label}</label>
                  <input
                    id={`defaultBankAccount-${key}`}
                    value={defaultBankAccountDraft[key]}
                    onChange={(e) => setDefaultBankAccountDraft((p) => ({ ...p, [key]: e.target.value }))}
                    disabled={actionLoading}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setShowDefaultBankAccount(false)} className="btn-neutral" disabled={actionLoading}>Cancel</button>
              <button type="button" onClick={handleDeleteDefaultBankAccount} className="btn-danger" disabled={actionLoading}>
                {actionLoading ? 'Deleting...' : 'Delete default'}
              </button>
              <button type="button" onClick={handleSaveDefaultBankAccount} className="btn-primary" disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Save default'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {createBankAccountTarget && (
        <Modal title={`Create bank account - ${createBankAccountTarget.currency || createBankAccountDraft.currency}`} onClose={() => (!actionLoading ? setCreateBankAccountTarget(null) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Creates a customer fiat wallet if needed and starts a user-owned bank account request without charging customer payment. Use for customers with approved normal KYC and approved enhanced bank account verification.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="createBankAccountTargetType">Customer</label>
                <select
                  id="createBankAccountTargetType"
                  value={createBankAccountDraft.targetType}
                  onChange={(e) => setCreateBankAccountDraft((p) => ({ ...p, targetType: e.target.value }))}
                  disabled={actionLoading}
                >
                  <option value="accountId">Account ID</option>
                  <option value="email">Email</option>
                </select>
              </div>
              {createBankAccountDraft.targetType === 'email' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="createBankAccountEmail">Email</label>
                  <input
                    id="createBankAccountEmail"
                    type="email"
                    value={createBankAccountDraft.email}
                    onChange={(e) => setCreateBankAccountDraft((p) => ({ ...p, email: e.target.value }))}
                    disabled={actionLoading}
                    placeholder="customer@example.com"
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="createBankAccountAccountId">Account ID</label>
                  <input
                    id="createBankAccountAccountId"
                    type="number"
                    min="1"
                    step="1"
                    value={createBankAccountDraft.accountId}
                    onChange={(e) => setCreateBankAccountDraft((p) => ({ ...p, accountId: e.target.value }))}
                    disabled={actionLoading}
                    placeholder="7"
                  />
                </div>
              )}
              {renderCurrencyInput('createBankAccountCurrency', 'Currency', createBankAccountDraft.currency, (e) => setCreateBankAccountDraft((p) => ({ ...p, currency: e.target.value.toUpperCase() })))}
            </div>
            {createBankAccountResult ? (
              <DetailGrid
                rows={[
                  { label: 'Fiat wallet ID', value: createBankAccountResult.fiatWalletId },
                  { label: 'Currency', value: createBankAccountResult.currency },
                  { label: 'Status', value: createBankAccountResult.status },
                  { label: 'Eligibility status', value: createBankAccountResult.eligibilityStatus },
                  { label: 'Order transaction ID', value: createBankAccountResult.orderTransactionId },
                  { label: 'Order transaction status', value: createBankAccountResult.orderTransactionStatus },
                  { label: 'Payment amount', value: formatMoney(createBankAccountResult.paymentAmount, createBankAccountResult.paymentCurrency) },
                  { label: 'Payment fees', value: formatMoney(createBankAccountResult.fees, createBankAccountResult.paymentCurrency) },
                  { label: 'Total to pay', value: formatMoney(createBankAccountResult.totalToPay, createBankAccountResult.paymentCurrency) },
                  { label: 'Provider', value: createBankAccountResult.providerName },
                  { label: 'Provider reference', value: createBankAccountResult.providerReference },
                  { label: 'User owned', value: formatBool(createBankAccountResult.userOwned) },
                  { label: 'Default account', value: formatBool(createBankAccountResult.defaultAccount) }
                ]}
              />
            ) : null}
            {createBankAccountResult?.orderTransactionId ? (
              <details className="card" style={{ padding: '0.75rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Manage linked order</summary>
                <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                    Complete marks the bank account active and completes transaction {createBankAccountResult.orderTransactionId}. Cancel stops the linked order transaction.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    {[
                      ['note', 'Note'],
                      ['externalReference', 'External reference'],
                      ['providerReference', 'Provider reference'],
                      ['holderName', 'Holder name'],
                      ['bankName', 'Bank name'],
                      ['internationalAccountNumber', 'International account number'],
                      ['accountNumber', 'Account number'],
                      ['swiftBic', 'SWIFT/BIC'],
                      ['routingNumber', 'Routing number'],
                      ['bankAddress', 'Bank address'],
                      ['instructionsEn', 'Instructions EN'],
                      ['instructionsFr', 'Instructions FR']
                    ].map(([key, label]) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label htmlFor={`completeBankAccountOrder-${key}`}>{label}</label>
                        <input
                          id={`completeBankAccountOrder-${key}`}
                          value={completeBankAccountOrderDraft[key]}
                          onChange={(e) => setCompleteBankAccountOrderDraft((p) => ({ ...p, [key]: e.target.value }))}
                          disabled={actionLoading}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor="cancelBankAccountOrderNote">Cancel note</label>
                    <textarea
                      id="cancelBankAccountOrderNote"
                      rows={3}
                      value={cancelBankAccountOrderNote}
                      onChange={(e) => setCancelBankAccountOrderNote(e.target.value)}
                      disabled={actionLoading}
                      placeholder="Provider rejected the request"
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-danger" onClick={handleCancelBankAccountOrder} disabled={actionLoading}>
                      {actionLoading ? 'Canceling...' : 'Cancel order'}
                    </button>
                    <button type="button" className="btn-success" onClick={handleCompleteBankAccountOrder} disabled={actionLoading}>
                      {actionLoading ? 'Completing...' : 'Complete order'}
                    </button>
                  </div>
                </div>
              </details>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setCreateBankAccountTarget(null)} className="btn-neutral" disabled={actionLoading}>Close</button>
              <button type="button" onClick={handleCreateBankAccount} className="btn-success" disabled={actionLoading}>
                {actionLoading ? 'Creating...' : 'Create bank account'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showPreview && (
        <Modal title="Simulate Exchange" onClose={() => (!previewLoading ? setShowPreview(false) : null)}>
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              QA preview only. This does not create transactions, debit wallets, credit balances, or call payment providers.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Leave action empty for a generic currency/margin simulation. Add an action such as CONVERT_FIAT to include fee lookup and estimated execution fields; currency product IDs are resolved by backend from the selected currencies.
            </div>
            {previewOptionsLoading ? <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Loading backend options...</div> : null}
            {previewOptionsError ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{previewOptionsError}</div> : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
              {renderPreviewInput('amount', 'Amount', { type: 'number', min: '0', step: '0.000001' })}
              {renderPreviewSelect('sourceCurrency', 'Source currency', previewCurrencyOptions, { emptyLabel: 'Select source currency' })}
              {renderPreviewSelect('targetCurrency', 'Target currency', previewCurrencyOptions, { emptyLabel: 'Select target currency' })}
            </div>
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Optional action context</summary>
              <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
                {renderPreviewSelect('action', 'Action', previewActionOptions, { emptyLabel: 'No action' })}
                {renderPreviewSelect('paymentMethodId', 'Payment method', paymentMethodOptions, {
                  emptyLabel: 'No payment method',
                  getValue: (item) => item.id,
                  getLabel: (item) => paymentMethodAdminLabel(item, `Payment method #${item?.id ?? '-'}`)
                })}
                {renderPreviewSelect('billProductId', 'Bill product', billProductOptions, {
                  emptyLabel: 'No bill product',
                  getValue: (item) => item.id,
                  getLabel: (item) => optionLabel(item, 'Bill product')
                })}
                {renderPreviewSelect('providerName', 'Provider', previewProviderOptions, { emptyLabel: 'No provider' })}
                {renderPreviewSelect('feeApplicationMode', 'Fee application mode', previewFeeModeOptions, { emptyLabel: 'Backend default' })}
                {renderPreviewInput('fiatWalletId', 'Fiat wallet ID', { type: 'number', min: '1', step: '1' })}
                {renderPreviewInput('savingId', 'Saving ID', { type: 'number', min: '1', step: '1' })}
                {renderPreviewInput('groupSavingId', 'Group saving ID', { type: 'number', min: '1', step: '1' })}
              </div>
            </details>
            {previewError ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{previewError}</div> : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setShowPreview(false)} className="btn-neutral" disabled={previewLoading}>Close</button>
              <button type="button" onClick={handlePreviewConversion} className="btn-primary" disabled={previewLoading}>
                {previewLoading ? 'Simulating...' : 'Run preview'}
              </button>
            </div>
            {renderPreviewResult()}
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete currency product <strong>{confirmDelete.currency || confirmDelete.id}</strong>? This cannot be undone and may fail when wallets or fee configs reference it. Deactivate the product when you only need to hide it from clients.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral" disabled={actionLoading}>Cancel</button>
            {confirmDelete.active ? <button type="button" onClick={() => { handleDeactivate(confirmDelete); setConfirmDelete(null); }} className="btn-neutral" disabled={actionLoading}>Deactivate instead</button> : null}
            <button type="button" onClick={handleDelete} className="btn-danger" disabled={actionLoading}>{actionLoading ? 'Deleting...' : 'Delete'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
