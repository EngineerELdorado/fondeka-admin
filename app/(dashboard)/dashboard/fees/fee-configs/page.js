'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { paymentMethodAdminLabel, paymentMethodRouteAdminLabel } from '@/lib/payment-method-labels';

const serviceOptions = ['WALLET', 'BILL_PAYMENTS', 'LENDING', 'CARD', 'CRYPTO', 'PAYMENT_REQUEST', 'E_SIM', 'AIRTIME_AND_DATA', 'OTHER'];
const paymentMethodTypeOptions = ['MOBILE_MONEY', 'CRYPTO', 'BALANCE', 'CREDIT', 'AIRTIME', 'BANK'];
const scopeTypeOptions = [
  { value: 'specific_route', label: 'Specific route' },
  { value: 'provider_fallback', label: 'Provider fallback' },
  { value: 'bill_provider_fallback', label: 'Bill provider fallback' },
  { value: 'global_action_fallback', label: 'Global action/context fallback' },
  { value: 'payment_method_type_action', label: 'Payment method type + action/context' },
  { value: 'payment_method_type_fallback', label: 'Pure payment method type fallback' },
  { value: 'global_default', label: 'Global default' }
];
const feeApplicationModeOptions = [
  { value: '', label: 'Use global default' },
  { value: 'EXCLUSIVE', label: 'Sender pays fees (EXCLUSIVE)' },
  { value: 'INCLUSIVE', label: 'Recipient pays fees (INCLUSIVE)' }
];
const feeContextOptions = ['COLLECTION', 'PAYOUT'];

const actionOptions = [
  'BUY_CARD',
  'BUY_CRYPTO',
  'CONVERT_FIAT',
  'BUY_GIFT_CARD',
  'E_SIM_PURCHASE',
  'E_SIM_TOPUP',
  'FUND_CARD',
  'FUND_WALLET',
  'INTER_TRANSFER',
  'LOAN_DISBURSEMENT',
  'LOAN_REQUEST',
  'ORDER_BANK_ACCOUNT',
  'PAY_ELECTRICITY_BILL',
  'PAY_INTERNET_BILL',
  'PAY_REQUEST',
  'PAY_TV_SUBSCRIPTION',
  'PAY_WATER_BILL',
  'CARD_PAYMENT_REVERSAL',
  'RECEIVE_CRYPTO',
  'REPAY_LOAN',
  'SELL_CRYPTO',
  'SEND_AIRTIME',
  'SEND_DATA_BUNDLES',
  'SEND_CRYPTO',
  'SETTLEMENT',
  'SWAP_CRYPTO',
  'WITHDRAW_FROM_CARD',
  'PERSONAL_SAVING_DEPOSIT',
  'PERSONAL_SAVING_WITHDRAWAL',
  'PERSONAL_SAVING_INTEREST_PAYOUT',
  'GROUP_SAVING_CONTRIBUTION',
  'GROUP_SAVING_PAYOUT',
  'GROUP_SAVING_ROUND_DISTRIBUTION',
  'WITHDRAW_FROM_WALLET'
].sort();

const initialFilters = {
  paymentMethodType: '',
  action: '',
  feeContext: '',
  service: '',
  countryId: '',
  paymentMethodPaymentProviderId: '',
  billProductBillProviderId: '',
  billProductId: '',
  billProviderId: '',
  paymentMethodId: '',
  paymentProviderId: '',
  fromCryptoProductId: '',
  toCryptoProductId: ''
};

const emptyState = {
  scopeType: 'specific_route',
  paymentMethodType: '',
  paymentProviderId: '',
  billProviderId: '',
  paymentMethodPaymentProviderId: '',
  billProductBillProviderId: '',
  countryId: '',
  service: '',
  action: '',
  customAction: '',
  feeContext: '',
  overrideSpecificFees: false,
  providerFeePercentage: '',
  providerFlatFee: '',
  providerFlatFeeCurrency: '',
  providerMinFee: '',
  providerMinFeeCurrency: 'USD',
  ourFeePercentage: '',
  ourFlatFee: '',
  minAmount: '',
  maxAmount: '',
  amountRangeCurrency: '',
  feeApplicationMode: '',
  fromCryptoProductId: '',
  toCryptoProductId: ''
};

const emptyPawapaySyncDraft = {
  defaultOurFeePercentage: '2',
  defaultOurFlatFee: '0',
  feeApplicationMode: 'EXCLUSIVE',
  replaceExistingRows: true,
  feesJson: JSON.stringify([
    {
      paymentMethodName: 'MPESA_KENYA',
      action: null,
      feeContext: 'COLLECTION',
      minAmount: 101,
      maxAmount: 500.99,
      amountRangeCurrency: 'KES',
      providerFeePercentage: 1,
      providerFlatFee: 5,
      providerFlatFeeCurrency: 'KES',
      ourFeePercentage: 2,
      ourFlatFee: 0
    },
    {
      paymentMethodName: 'TIGO_PESA_TANZANIA',
      action: null,
      feeContext: 'COLLECTION',
      minAmount: 1000,
      maxAmount: 2999.99,
      amountRangeCurrency: 'TZS',
      providerFeeConfigEnabled: false,
      customerPaidProviderFeeAmount: 400,
      customerPaidProviderFeeCurrency: 'TZS',
      customerPaidProviderFeePercentage: 0,
      customerPaidProviderFeeChargedBy: 'MOBILE_OPERATOR',
      customerPaidProviderFeeIncludedInTotal: false,
      customerPaidProviderFeeMessageEn: 'Your mobile money provider may charge an additional %s %s. This is charged by the provider and is not collected by Fondeka.',
      customerPaidProviderFeeMessageFr: "Votre opérateur mobile money peut facturer %s %s supplémentaires. Ces frais sont facturés par l'opérateur et ne sont pas collectés par Fondeka."
    }
  ], null, 2)
};

const formatAmountRange = (minAmount, maxAmount) => {
  const hasMin = minAmount !== null && minAmount !== undefined && minAmount !== '';
  const hasMax = maxAmount !== null && maxAmount !== undefined && maxAmount !== '';
  if (!hasMin && !hasMax) return 'Default';
  if (hasMin && hasMax) return `${Number(minAmount).toFixed(2)} - ${Number(maxAmount).toFixed(2)}`;
  if (hasMin) return `>= ${Number(minAmount).toFixed(2)}`;
  return `<= ${Number(maxAmount).toFixed(2)}`;
};

const resolveAction = (state) => (state.action === '__custom' ? state.customAction : state.action);
const isPaymentMethodTypeScope = (state) => state.scopeType === 'payment_method_type_action' || state.scopeType === 'payment_method_type_fallback';
const normalizeFeeContext = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return feeContextOptions.includes(normalized) ? normalized : '';
};
const normalizePawapayFeeRows = (fees) => fees.map((fee) => {
  const actionValue = String(fee?.action || '').trim().toUpperCase();
  const context = normalizeFeeContext(fee?.feeContext || actionValue);
  return {
    ...fee,
    action: context ? null : (fee?.action ?? null),
    feeContext: context || null
  };
});
const normalizeOptionalIdForForm = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num) || num <= 0) return '';
  return String(num);
};

const toPayload = (state) => {
  const paymentMethodTypeScope = isPaymentMethodTypeScope(state);
  const fees = {
    overrideSpecificFees: Boolean(state.overrideSpecificFees),
    providerFeePercentage: state.providerFeePercentage === '' ? null : Number(state.providerFeePercentage),
    providerFlatFee: state.providerFlatFee === '' ? null : Number(state.providerFlatFee),
    providerFlatFeeCurrency: state.providerFlatFeeCurrency ? String(state.providerFlatFeeCurrency).trim().toUpperCase() : null,
    providerMinFee: state.providerMinFee === '' ? null : Number(state.providerMinFee),
    providerMinFeeCurrency: state.providerMinFeeCurrency ? String(state.providerMinFeeCurrency).trim().toUpperCase() : null,
    ourFeePercentage: state.ourFeePercentage === '' ? null : Number(state.ourFeePercentage),
    ourFlatFee: state.ourFlatFee === '' ? null : Number(state.ourFlatFee),
    minAmount: state.minAmount === '' ? null : Number(state.minAmount),
    maxAmount: state.maxAmount === '' ? null : Number(state.maxAmount),
    amountRangeCurrency: state.amountRangeCurrency ? String(state.amountRangeCurrency).trim().toUpperCase() : null,
    feeApplicationMode: state.feeApplicationMode || null
  };
  if (paymentMethodTypeScope) {
    return {
      paymentMethodType: state.paymentMethodType || null,
      ...(state.scopeType === 'payment_method_type_action' ? { action: resolveAction(state) || null } : {}),
      feeContext: state.feeContext || null,
      ...fees
    };
  }
  return {
    paymentMethodType: null,
    paymentProviderId: state.paymentProviderId === '' ? null : Number(state.paymentProviderId),
    billProviderId: state.billProviderId === '' ? null : Number(state.billProviderId),
    paymentMethodPaymentProviderId: state.paymentMethodPaymentProviderId === '' ? null : Number(state.paymentMethodPaymentProviderId),
    billProductBillProviderId: state.billProductBillProviderId === '' ? null : Number(state.billProductBillProviderId),
    countryId: state.countryId === '' ? null : Number(state.countryId),
    service: state.service || null,
    action: resolveAction(state) || null,
    feeContext: state.feeContext || null,
    fromCryptoProductId: state.fromCryptoProductId === '' ? null : Number(state.fromCryptoProductId),
    toCryptoProductId: state.toCryptoProductId === '' ? null : Number(state.toCryptoProductId),
    ...fees
  };
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button
          type="button"
          onClick={onClose}
          style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}
        >
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
      <div
        key={row.label}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}
      >
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

const resolveScopeType = (row) => {
  if (row?.paymentMethodType && row?.action) return 'payment_method_type_action';
  if (row?.paymentMethodType) return 'payment_method_type_fallback';
  if (row?.paymentMethodPaymentProviderId || row?.billProductBillProviderId || row?.fromCryptoProductId || row?.toCryptoProductId) return 'specific_route';
  if (row?.paymentProviderId) return 'provider_fallback';
  if (row?.billProviderId) return 'bill_provider_fallback';
  if (row?.action || row?.feeContext || row?.service || row?.countryId) return 'global_action_fallback';
  return 'global_default';
};

const scopeTypeLabel = (value) => scopeTypeOptions.find((option) => option.value === value)?.label || 'Specific route';

export default function FeeConfigsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [countries, setCountries] = useState([]);
  const [pmps, setPmps] = useState([]);
  const [bpbps, setBpbps] = useState([]);
  const [billProducts, setBillProducts] = useState([]);
  const [billProviders, setBillProviders] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentProviders, setPaymentProviders] = useState([]);
  const [cryptoProducts, setCryptoProducts] = useState([]);
  const [arrangeBy, setArrangeBy] = useState('action');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showPawapaySync, setShowPawapaySync] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [pawapaySyncDraft, setPawapaySyncDraft] = useState(emptyPawapaySyncDraft);
  const [pawapaySyncResult, setPawapaySyncResult] = useState(null);
  const [pawapaySyncLoading, setPawapaySyncLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const resolvedDraftAction = resolveAction(draft);
  const isDraftGiftCardAction = String(resolvedDraftAction || '').toUpperCase() === 'BUY_GIFT_CARD';

  const getCryptoProductLabel = useCallback((value) => {
    if (!value) return '—';
    const match = cryptoProducts.find((item) => Number(item.id) === Number(value));
    if (!match) return `Crypto #${value}`;
    return match.displayName || match.name || match.code || `Crypto #${value}`;
  }, [cryptoProducts]);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    const add = (label, key) => chips.push({ label, key });
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      switch (key) {
        case 'paymentMethodType':
          add(`Payment method type: ${value}`, key);
          break;
        case 'service':
          add(`Service: ${value}`, key);
          break;
        case 'action':
          add(`Action: ${value}`, key);
          break;
        case 'feeContext':
          add(`Context: ${value}`, key);
          break;
        case 'countryId':
          add(`Country ID: ${value}`, key);
          break;
        case 'paymentMethodPaymentProviderId':
          add(`PMPP: ${value}`, key);
          break;
        case 'billProductBillProviderId':
          add(`BPBP: ${value}`, key);
          break;
        case 'billProductId':
          add(`Bill Product: ${value}`, key);
          break;
        case 'billProviderId':
          add(`Bill Provider: ${value}`, key);
          break;
        case 'paymentMethodId':
          add(`Method: ${value}`, key);
          break;
        case 'paymentProviderId':
          add(`Provider: ${value}`, key);
          break;
        case 'fromCryptoProductId':
          add(`From crypto: ${getCryptoProductLabel(value)}`, key);
          break;
        case 'toCryptoProductId':
          add(`To crypto: ${getCryptoProductLabel(value)}`, key);
          break;
        default:
          break;
      }
    });
    return chips;
  }, [appliedFilters, getCryptoProductLabel]);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        const numericKeys = [
          'countryId',
          'paymentMethodPaymentProviderId',
          'billProductBillProviderId',
          'billProductId',
          'billProviderId',
          'paymentMethodId',
          'paymentProviderId',
          'fromCryptoProductId',
          'toCryptoProductId'
        ];
        if (numericKeys.includes(key)) {
          const num = Number(value);
          if (!Number.isNaN(num)) params.set(key, String(num));
        } else {
          params.set(key, String(value));
        }
      });
      const res = await api.feeConfigs.list(params);
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
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [pmpRes, countryRes, pmRes, provRes, bpbpRes, billProductRes, billProviderRes, cryptoProductRes] = await Promise.all([
          api.paymentMethodPaymentProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.countries.list(new URLSearchParams({ page: '0', size: '200' })),
          api.paymentMethods.list(new URLSearchParams({ page: '0', size: '200' })),
          api.paymentProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.billProductBillProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.billProducts.list(new URLSearchParams({ page: '0', size: '200' })),
          api.billProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.cryptoProducts.list(new URLSearchParams({ page: '0', size: '200' }))
        ]);
        const toList = (res) => (Array.isArray(res) ? res : res?.content || []);
        setPmps(toList(pmpRes));
        setCountries(toList(countryRes));
        setPaymentMethods(toList(pmRes));
        setPaymentProviders(toList(provRes));
        setBpbps(toList(bpbpRes));
        setBillProducts(toList(billProductRes));
        setBillProviders(toList(billProviderRes));
        setCryptoProducts(toList(cryptoProductRes));
      } catch {
        // soft fail for options
      }
    };
    fetchOptions();
  }, []);

  const getCountryLabel = useCallback((row) => row.countryName || row.country || row.countryCode || 'GLOBAL', []);

  const getPmpLabel = useCallback((row) => {
    if (!row?.paymentMethodPaymentProviderId) return 'GLOBAL';
    const match = pmps.find((p) => Number(p.id) === Number(row.paymentMethodPaymentProviderId));
    if (match) {
      const method = paymentMethodRouteAdminLabel(match);
      const provider = match.paymentProviderName || 'Provider';
      return `${method} → ${provider}`;
    }
    const fallbackLabel = [paymentMethodAdminLabel(row, ''), row.paymentProviderName].filter(Boolean).join(' → ');
    return fallbackLabel ? `${fallbackLabel} (#${row.paymentMethodPaymentProviderId})` : `PMPP #${row.paymentMethodPaymentProviderId}`;
  }, [pmps]);

  const getPaymentProviderLabel = useCallback((row) => {
    if (!row?.paymentProviderId) return 'ALL';
    const match = paymentProviders.find((item) => Number(item.id) === Number(row.paymentProviderId));
    if (match) return match.displayName || match.name || `Provider #${row.paymentProviderId}`;
    return row.paymentProviderName ? `${row.paymentProviderName} (#${row.paymentProviderId})` : `Provider #${row.paymentProviderId}`;
  }, [paymentProviders]);

  const getBillProviderLabel = useCallback((row) => {
    if (!row?.billProviderId) return 'ALL';
    const match = billProviders.find((item) => Number(item.id) === Number(row.billProviderId));
    if (match) return match.displayName || match.name || `Bill Provider #${row.billProviderId}`;
    return row.billProviderName ? `${row.billProviderName} (#${row.billProviderId})` : `Bill Provider #${row.billProviderId}`;
  }, [billProviders]);

  const getBpbpLabel = useCallback((row) => {
    if (!row?.billProductBillProviderId) return 'GLOBAL';
    const match = bpbps.find((item) => Number(item.id) === Number(row.billProductBillProviderId));
    if (match) {
      return `${match.billProductName || 'Bill Product'} — ${match.billProviderName || 'Bill Provider'}`;
    }
    const fallbackLabel = [row.billProductName, row.billProviderName].filter(Boolean).join(' — ');
    return fallbackLabel ? `${fallbackLabel} (#${row.billProductBillProviderId})` : `BPBP #${row.billProductBillProviderId}`;
  }, [bpbps]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const compare = (a, b) => {
      const aVal = a?.toUpperCase?.() ? a.toUpperCase() : a || '';
      const bVal = b?.toUpperCase?.() ? b.toUpperCase() : b || '';
      return String(aVal).localeCompare(String(bVal));
    };
    if (arrangeBy === 'action') {
      arr.sort((a, b) => compare(a.action || a.feeContext, b.action || b.feeContext));
    } else if (arrangeBy === 'service') {
      arr.sort((a, b) => compare(a.service || 'ALL', b.service || 'ALL'));
    } else if (arrangeBy === 'country') {
      arr.sort((a, b) => compare(getCountryLabel(a), getCountryLabel(b)));
    } else if (arrangeBy === 'pmp') {
      arr.sort((a, b) => compare(getPmpLabel(a), getPmpLabel(b)));
    } else if (arrangeBy === 'bpbp') {
      arr.sort((a, b) => compare(getBpbpLabel(a), getBpbpLabel(b)));
    } else if (arrangeBy === 'scope') {
      arr.sort((a, b) => compare(scopeTypeLabel(resolveScopeType(a)), scopeTypeLabel(resolveScopeType(b))));
    } else if (arrangeBy === 'paymentMethodType') {
      arr.sort((a, b) => compare(a.paymentMethodType || '', b.paymentMethodType || ''));
    }
    return arr;
  }, [arrangeBy, rows, getCountryLabel, getPmpLabel, getBpbpLabel]);

  const filteredRows = useMemo(() => {
    return sortedRows.filter((row) => {
      if (appliedFilters.fromCryptoProductId && String(row?.fromCryptoProductId || '') !== String(appliedFilters.fromCryptoProductId)) {
        return false;
      }
      if (appliedFilters.toCryptoProductId && String(row?.toCryptoProductId || '') !== String(appliedFilters.toCryptoProductId)) {
        return false;
      }
      return true;
    });
  }, [sortedRows, appliedFilters.fromCryptoProductId, appliedFilters.toCryptoProductId]);

  const giftCardMappingIds = useMemo(() => {
    const giftProductIds = new Set(
      billProducts
        .filter((product) => Boolean(product?.giftCard))
        .map((product) => Number(product.id))
        .filter((id) => !Number.isNaN(id))
    );
    return new Set(
      bpbps
        .filter((mapping) => giftProductIds.has(Number(mapping?.billProductId)))
        .map((mapping) => Number(mapping.id))
        .filter((id) => !Number.isNaN(id))
    );
  }, [billProducts, bpbps]);

  const requiredGiftCardStatus = useMemo(() => {
    const requiredKeys = ['NETFLIX', 'SPOTIFY', 'APP_STORE', 'GOOGLE_PLAY', 'AIRBNB', 'UBER'];
    return requiredKeys.map((key) => {
      const product = billProducts.find((p) => String(p?.name || '').toUpperCase() === key || String(p?.code || '').toUpperCase() === key);
      const productId = Number(product?.id);
      const productMappings = bpbps.filter((mapping) => Number(mapping?.billProductId) === productId);
      const activeReloadlyMappings = productMappings.filter((mapping) => {
        if (mapping?.active === false) return false;
        const providerName = String(mapping?.billProviderName || '').toUpperCase();
        return providerName.includes('RELOADLY');
      });
      const feeRows = rows.filter((row) => {
        if (String(row?.action || '').toUpperCase() !== 'BUY_GIFT_CARD') return false;
        return activeReloadlyMappings.some((mapping) => Number(mapping?.id) === Number(row?.billProductBillProviderId));
      });
      return {
        key,
        displayName: product?.displayName || key,
        hasProduct: Boolean(product),
        hasActiveReloadlyMapping: activeReloadlyMappings.length > 0,
        activeReloadlyMappingIds: activeReloadlyMappings.map((mapping) => mapping.id),
        feeConfigCount: feeRows.length
      };
    });
  }, [billProducts, bpbps, rows]);

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      {
        key: 'scopeType',
        label: 'Scope',
        render: (row) => scopeTypeLabel(resolveScopeType(row))
      },
      {
        key: 'paymentMethodType',
        label: 'Payment method type',
        render: (row) => row.paymentMethodType || '—'
      },
      {
        key: 'service',
        label: 'Service',
        render: (row) => row.service || 'ALL'
      },
      { key: 'action', label: 'Action' },
      { key: 'feeContext', label: 'Fee context', render: (row) => row.feeContext || '—' },
      {
        key: 'country',
        label: 'Country',
        render: (row) => getCountryLabel(row)
      },
      {
        key: 'paymentProviderId',
        label: 'Payment Provider',
        render: (row) => getPaymentProviderLabel(row)
      },
      {
        key: 'billProviderId',
        label: 'Bill Provider',
        render: (row) => getBillProviderLabel(row)
      },
      {
        key: 'paymentMethodPaymentProviderId',
        label: 'PMPP scope',
        render: (row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div>{getPmpLabel(row)}</div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', fontSize: '12px', color: 'var(--muted)' }}>
              {row.paymentMethodName && <span>Method: {paymentMethodAdminLabel(row)}</span>}
              {row.paymentProviderName && <span>Provider: {row.paymentProviderName}</span>}
            </div>
          </div>
        )
      },
      {
        key: 'billProductBillProviderId',
        label: 'BPBP scope',
        render: (row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div>{getBpbpLabel(row)}</div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', fontSize: '12px', color: 'var(--muted)' }}>
              {row.billProductName && <span>Product: {row.billProductName}</span>}
              {row.billProviderName && <span>Provider: {row.billProviderName}</span>}
            </div>
          </div>
        )
      },
      {
        key: 'fromCryptoProductId',
        label: 'From',
        render: (row) => (row?.fromCryptoProductId ? getCryptoProductLabel(row.fromCryptoProductId) : 'Fallback/global')
      },
      {
        key: 'toCryptoProductId',
        label: 'To',
        render: (row) => (row?.toCryptoProductId ? getCryptoProductLabel(row.toCryptoProductId) : 'Fallback/global')
      },
      { key: 'providerFeePercentage', label: 'Provider %' },
      { key: 'providerFlatFee', label: 'Provider flat' },
      { key: 'providerFlatFeeCurrency', label: 'Provider flat currency', render: (row) => row.providerFlatFeeCurrency || '—' },
      { key: 'providerMinFee', label: 'Provider min fee' },
      { key: 'providerMinFeeCurrency', label: 'Provider min currency', render: (row) => row.providerMinFeeCurrency || '—' },
      { key: 'ourFeePercentage', label: 'Our %' },
      { key: 'ourFlatFee', label: 'Our flat' },
      {
        key: 'amountRange',
        label: 'Amount range',
        render: (row) => `${formatAmountRange(row?.minAmount, row?.maxAmount)}${row?.amountRangeCurrency ? ` ${row.amountRangeCurrency}` : ''}`
      },
      {
        key: 'feeApplicationMode',
        label: 'Fee mode',
        render: (row) => {
          const mode = String(row?.feeApplicationMode || '').toUpperCase();
          if (mode === 'INCLUSIVE') return 'Recipient pays';
          if (mode === 'EXCLUSIVE') return 'Sender pays';
          return 'Use global default';
        }
      },
      {
        key: 'overrideSpecificFees',
        label: 'Override Specific',
        render: (row) => (row.overrideSpecificFees ? 'Yes' : 'No')
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral">
              View
            </button>
            <button type="button" onClick={() => openEdit(row)} className="btn-neutral">
              Edit
            </button>
            <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger">
              Delete
            </button>
          </div>
        )
      }
    ],
    [getCountryLabel, getPaymentProviderLabel, getBillProviderLabel, getPmpLabel, getBpbpLabel, getCryptoProductLabel]
  );

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    const actionChoice = actionOptions.includes(row.action) ? row.action : row.action ? '__custom' : '';
    setSelected(row);
    setDraft({
      scopeType: resolveScopeType(row),
      paymentMethodType: row.paymentMethodType ?? '',
      paymentProviderId: normalizeOptionalIdForForm(row.paymentProviderId),
      billProviderId: normalizeOptionalIdForForm(row.billProviderId),
      paymentMethodPaymentProviderId: normalizeOptionalIdForForm(row.paymentMethodPaymentProviderId),
      billProductBillProviderId: normalizeOptionalIdForForm(row.billProductBillProviderId),
      countryId: row.countryId ?? '',
      service: row.service ?? '',
      action: actionChoice,
      customAction: actionChoice === '__custom' ? row.action || '' : '',
      feeContext: row.feeContext || '',
      overrideSpecificFees: Boolean(row.overrideSpecificFees),
      providerFeePercentage: row.providerFeePercentage ?? '',
      providerFlatFee: row.providerFlatFee ?? '',
      providerFlatFeeCurrency: row.providerFlatFeeCurrency || '',
      providerMinFee: row.providerMinFee ?? '',
      providerMinFeeCurrency: row.providerMinFeeCurrency || 'USD',
      ourFeePercentage: row.ourFeePercentage ?? '',
      ourFlatFee: row.ourFlatFee ?? '',
      minAmount: row.minAmount ?? '',
      maxAmount: row.maxAmount ?? '',
      amountRangeCurrency: row.amountRangeCurrency || '',
      feeApplicationMode: row.feeApplicationMode || '',
      fromCryptoProductId: normalizeOptionalIdForForm(row.fromCryptoProductId),
      toCryptoProductId: normalizeOptionalIdForForm(row.toCryptoProductId)
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

  const validateDraft = (state, currentId = null) => {
    const resolved = resolveAction(state);
    const paymentMethodTypeScope = isPaymentMethodTypeScope(state);
    const normalizedPaymentMethodType = String(state.paymentMethodType || '').trim().toUpperCase();
    if (paymentMethodTypeScope && !paymentMethodTypeOptions.includes(normalizedPaymentMethodType)) {
      return 'Payment method type is required for payment method type fallback scope.';
    }
    if (state.scopeType === 'payment_method_type_action' && !String(resolved || '').trim() && !String(state.feeContext || '').trim()) {
      return 'Action or fee context is required for payment method type + action/context scope.';
    }
    if (String(resolved || '').trim() && String(state.feeContext || '').trim()) {
      return 'Choose either action or fee context, not both.';
    }
    if (state.feeContext && !feeContextOptions.includes(String(state.feeContext).toUpperCase())) {
      return 'Fee context must be COLLECTION or PAYOUT.';
    }
    if (state.paymentProviderId !== '' && Number(state.paymentProviderId) < 0) return 'Payment provider must be non-negative.';
    if (state.billProviderId !== '' && Number(state.billProviderId) < 0) return 'Bill provider must be non-negative.';
    if (state.paymentMethodPaymentProviderId !== '' && Number(state.paymentMethodPaymentProviderId) < 0) return 'PMPP ID must be non-negative.';
    if (state.billProductBillProviderId !== '' && Number(state.billProductBillProviderId) < 0) return 'BPBP ID must be non-negative.';
    if (state.countryId !== '' && Number(state.countryId) < 0) return 'Country ID must be non-negative.';
    if (state.service === '__custom') return 'Service value is invalid.';
    const numericFields = [
      { key: 'providerFeePercentage', value: state.providerFeePercentage },
      { key: 'providerFlatFee', value: state.providerFlatFee },
      { key: 'providerMinFee', value: state.providerMinFee },
      { key: 'ourFeePercentage', value: state.ourFeePercentage },
      { key: 'ourFlatFee', value: state.ourFlatFee },
      { key: 'minAmount', value: state.minAmount },
      { key: 'maxAmount', value: state.maxAmount }
    ];
    const invalid = numericFields.find((item) => item.value !== '' && Number(item.value) < 0);
    if (invalid) return 'Fee values cannot be negative.';
    if (state.minAmount !== '' && state.maxAmount !== '' && Number(state.minAmount) > Number(state.maxAmount)) {
      return 'Minimum amount cannot be greater than maximum amount.';
    }
    if (state.providerFlatFee !== '' && !String(state.providerFlatFeeCurrency || '').trim()) {
      return 'Provider flat fee currency is required when provider flat fee is set.';
    }
    if ((state.minAmount !== '' || state.maxAmount !== '') && !String(state.amountRangeCurrency || '').trim()) {
      return 'Amount range currency is required when amount range is set.';
    }
    const normalizedAction = state.scopeType === 'payment_method_type_fallback' ? '' : String(resolved || '').toUpperCase();
    const normalizedFeeContext = String(state.feeContext || '').toUpperCase();
    const normalizedService = paymentMethodTypeScope ? '' : String(state.service || '').toUpperCase();
    const normalizedPaymentProvider = paymentMethodTypeScope || state.paymentProviderId === '' ? null : Number(state.paymentProviderId);
    const normalizedBillProvider = paymentMethodTypeScope || state.billProviderId === '' ? null : Number(state.billProviderId);
    const normalizedPmp = paymentMethodTypeScope || state.paymentMethodPaymentProviderId === '' ? null : Number(state.paymentMethodPaymentProviderId);
    const normalizedBpbp = paymentMethodTypeScope || state.billProductBillProviderId === '' ? null : Number(state.billProductBillProviderId);
    const normalizedFromCrypto = paymentMethodTypeScope || state.fromCryptoProductId === '' ? null : Number(state.fromCryptoProductId);
    const normalizedToCrypto = paymentMethodTypeScope || state.toCryptoProductId === '' ? null : Number(state.toCryptoProductId);
    const normalizedMinAmount = state.minAmount === '' ? null : Number(state.minAmount);
    const normalizedMaxAmount = state.maxAmount === '' ? null : Number(state.maxAmount);
    if (normalizedPmp !== null && normalizedPaymentProvider !== null) {
      return 'Choose either Payment Provider or the exact Payment Method Route. Do not set both on the same fee config.';
    }
    if (normalizedBpbp !== null && normalizedBillProvider !== null) {
      return 'Choose either Bill Provider or the exact Bill Product Route. Do not set both on the same fee config.';
    }
    if (normalizedAction === 'BUY_GIFT_CARD' && normalizedBpbp !== null && !giftCardMappingIds.has(Number(normalizedBpbp))) {
      return 'Selected BPBP does not appear to be a gift-card mapping. Use a mapping where bill product has giftCard=true.';
    }
    if ((normalizedFromCrypto === null) !== (normalizedToCrypto === null)) {
      return 'Set both From crypto and To crypto together for pair-specific swap pricing.';
    }
    if (normalizedFromCrypto !== null && normalizedToCrypto !== null && normalizedFromCrypto === normalizedToCrypto) {
      return 'From crypto and To crypto cannot be the same product.';
    }
    if (normalizedAction === 'SWAP_CRYPTO') {
      if (normalizedService !== 'CRYPTO') {
        return 'SWAP_CRYPTO fee rules must use service = CRYPTO.';
      }
      if (normalizedFromCrypto === null || normalizedToCrypto === null) {
        return 'SWAP_CRYPTO fee rules require both From crypto and To crypto.';
      }
    }
    const duplicate = rows.find((row) => {
      if (currentId && Number(row?.id) === Number(currentId)) return false;
      const rowAction = String(row?.action || '').toUpperCase();
      if (rowAction !== normalizedAction) return false;
      const rowFeeContext = String(row?.feeContext || '').toUpperCase();
      if (rowFeeContext !== normalizedFeeContext) return false;
      const rowPaymentMethodType = String(row?.paymentMethodType || '').toUpperCase();
      if (rowPaymentMethodType !== (paymentMethodTypeScope ? normalizedPaymentMethodType : '')) return false;
      const rowPaymentProvider = row?.paymentProviderId === null || row?.paymentProviderId === undefined ? null : Number(row.paymentProviderId);
      const rowBillProvider = row?.billProviderId === null || row?.billProviderId === undefined ? null : Number(row.billProviderId);
      const rowBpbp = row?.billProductBillProviderId === null || row?.billProductBillProviderId === undefined ? null : Number(row.billProductBillProviderId);
      const rowPmp = row?.paymentMethodPaymentProviderId === null || row?.paymentMethodPaymentProviderId === undefined ? null : Number(row.paymentMethodPaymentProviderId);
      const rowFromCrypto = row?.fromCryptoProductId === null || row?.fromCryptoProductId === undefined ? null : Number(row.fromCryptoProductId);
      const rowToCrypto = row?.toCryptoProductId === null || row?.toCryptoProductId === undefined ? null : Number(row.toCryptoProductId);
      const rowMinAmount = row?.minAmount === null || row?.minAmount === undefined || row?.minAmount === '' ? null : Number(row.minAmount);
      const rowMaxAmount = row?.maxAmount === null || row?.maxAmount === undefined || row?.maxAmount === '' ? null : Number(row.maxAmount);
      const rowAmountRangeCurrency = String(row?.amountRangeCurrency || '').toUpperCase();
      return rowPaymentProvider === normalizedPaymentProvider
        && rowBillProvider === normalizedBillProvider
        && rowBpbp === normalizedBpbp
        && rowPmp === normalizedPmp
        && rowFromCrypto === normalizedFromCrypto
        && rowToCrypto === normalizedToCrypto
        && rowMinAmount === normalizedMinAmount
        && rowMaxAmount === normalizedMaxAmount
        && rowAmountRangeCurrency === String(state.amountRangeCurrency || '').toUpperCase();
    });
    if (duplicate) {
      return `Duplicate scope detected with fee config #${duplicate.id}. Keep one row per layered scope for the same action or actionless default.`;
    }
    return null;
  };

  const handleCreate = async () => {
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.feeConfigs.create(toPayload(draft));
      setInfo('Created fee config.');
      setDraft((p) => ({
        ...p,
        providerFeePercentage: '',
        providerFlatFee: '',
        providerFlatFeeCurrency: '',
        providerMinFee: '',
        ourFeePercentage: '',
        ourFlatFee: '',
        amountRangeCurrency: '',
        feeApplicationMode: ''
      }));
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    const validationError = validateDraft(draft, selected.id);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.feeConfigs.update(selected.id, toPayload(draft));
      setInfo(`Updated fee config ${selected.id}.`);
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
      await api.feeConfigs.remove(id);
      setInfo(`Deleted fee config ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePawapaySync = async () => {
    setError(null);
    setInfo(null);
    setPawapaySyncResult(null);
    let fees;
    try {
      fees = JSON.parse(pawapaySyncDraft.feesJson || '[]');
    } catch (err) {
      setError(`PawaPay fees JSON is invalid: ${err.message}`);
      return;
    }
    if (!Array.isArray(fees)) {
      setError('PawaPay fees JSON must be an array.');
      return;
    }
    if (fees.length === 0) {
      setError('Add at least one PawaPay fee row.');
      return;
    }
    const defaultOurFeePercentage = Number(pawapaySyncDraft.defaultOurFeePercentage);
    const defaultOurFlatFee = Number(pawapaySyncDraft.defaultOurFlatFee);
    if (!Number.isFinite(defaultOurFeePercentage) || defaultOurFeePercentage < 0) {
      setError('Default Fondeka fee percentage must be zero or positive.');
      return;
    }
    if (!Number.isFinite(defaultOurFlatFee) || defaultOurFlatFee < 0) {
      setError('Default Fondeka flat fee must be zero or positive.');
      return;
    }
    setPawapaySyncLoading(true);
    try {
      const result = await api.feeConfigs.syncPawapay({
        defaultOurFeePercentage,
        defaultOurFlatFee,
        feeApplicationMode: pawapaySyncDraft.feeApplicationMode || 'EXCLUSIVE',
        replaceExistingRows: Boolean(pawapaySyncDraft.replaceExistingRows),
        fees: normalizePawapayFeeRows(fees)
      });
      setPawapaySyncResult(result || {});
      setInfo(
        `PawaPay sync complete. Fee configs: created ${result?.created ?? 0}, updated ${result?.updated ?? 0}, removed ${result?.removed ?? 0}. ` +
        `Customer-paid charges: created ${result?.customerPaidCreated ?? 0}, updated ${result?.customerPaidUpdated ?? 0}, removed ${result?.customerPaidRemoved ?? 0}.`
      );
      fetchRows();
    } catch (err) {
      setError(err.message || 'PawaPay sync failed.');
    } finally {
      setPawapaySyncLoading(false);
    }
  };

  const updateScopeType = (scopeType) => {
    setDraft((previous) => ({
      ...previous,
      scopeType,
      ...(scopeType === 'payment_method_type_action' || scopeType === 'payment_method_type_fallback'
        ? {
            paymentProviderId: '',
            billProviderId: '',
            paymentMethodPaymentProviderId: '',
            billProductBillProviderId: '',
            countryId: '',
            service: '',
            ...(scopeType === 'payment_method_type_fallback' ? { action: '', customAction: '' } : {}),
            fromCryptoProductId: '',
            toCryptoProductId: ''
          }
        : {
            paymentMethodType: ''
          })
    }));
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="scopeType">Scope type</label>
        <select id="scopeType" value={draft.scopeType} onChange={(e) => updateScopeType(e.target.value)}>
          {scopeTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {isPaymentMethodTypeScope(draft) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="paymentMethodType">Payment method type</label>
          <select id="paymentMethodType" value={draft.paymentMethodType} onChange={(e) => setDraft((p) => ({ ...p, paymentMethodType: e.target.value }))}>
            <option value="">Select payment method type</option>
            {paymentMethodTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      )}
      {draft.scopeType === 'payment_method_type_action' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="action">Action</label>
          <select
            id="action"
            value={draft.action}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                action: e.target.value,
                customAction: e.target.value === '__custom' ? p.customAction : '',
                feeContext: e.target.value ? '' : p.feeContext
              }))
            }
          >
            <option value="">Select action</option>
            {actionOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value="__custom">Other (custom)</option>
          </select>
          {draft.action === '__custom' && (
            <input
              style={{ marginTop: '0.25rem' }}
              placeholder="Enter custom action"
              value={draft.customAction}
              onChange={(e) => setDraft((p) => ({ ...p, customAction: e.target.value }))}
            />
          )}
        </div>
      )}
      {isPaymentMethodTypeScope(draft) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="feeContextTypeScope">Fee context</label>
          <select
            id="feeContextTypeScope"
            value={draft.feeContext}
            onChange={(e) => setDraft((p) => ({ ...p, feeContext: e.target.value, ...(e.target.value ? { action: '', customAction: '' } : {}) }))}
          >
            <option value="">No context</option>
            {feeContextOptions.map((context) => (
              <option key={context} value={context}>{context}</option>
            ))}
          </select>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Use COLLECTION/PAYOUT for flow fallback fees. Do not store COLLECTION or PAYOUT as actions.
          </div>
        </div>
      )}
      {!isPaymentMethodTypeScope(draft) && (
        <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="paymentProviderId">Payment Provider</label>
        <select id="paymentProviderId" value={draft.paymentProviderId} onChange={(e) => setDraft((p) => ({ ...p, paymentProviderId: e.target.value }))}>
          <option value="">All payment providers</option>
          {paymentProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name || provider.displayName || provider.id}
              {provider.id ? ` #${provider.id}` : ''}
            </option>
          ))}
        </select>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Choose the provider by name. Use this for broad defaults across routes handled by that provider.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="billProviderId">Bill Provider</label>
        <select id="billProviderId" value={draft.billProviderId} onChange={(e) => setDraft((p) => ({ ...p, billProviderId: e.target.value }))}>
          <option value="">All bill providers</option>
          {billProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name || provider.displayName || provider.id}
              {provider.id ? ` #${provider.id}` : ''}
            </option>
          ))}
        </select>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Choose the bill provider by name. Use this for broad defaults across bill products under that provider.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="service">Service</label>
        <select id="service" value={draft.service} onChange={(e) => setDraft((p) => ({ ...p, service: e.target.value }))}>
          <option value="">All services</option>
          {serviceOptions.map((svc) => (
            <option key={svc} value={svc}>
              {svc}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="action">Action</label>
        <select
          id="action"
          value={draft.action}
          onChange={(e) =>
            setDraft((p) => ({
              ...p,
              action: e.target.value,
              customAction: e.target.value === '__custom' ? p.customAction : '',
              feeContext: e.target.value ? '' : p.feeContext,
              ...(e.target.value === 'SWAP_CRYPTO' ? { service: 'CRYPTO' } : {})
            }))
          }
        >
          <option value="">All actions / no action default</option>
          {actionOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
          <option value="__custom">Other (custom)</option>
        </select>
        {draft.action === '__custom' && (
          <input
            style={{ marginTop: '0.25rem' }}
            placeholder="Enter custom action"
            value={draft.customAction}
            onChange={(e) => setDraft((p) => ({ ...p, customAction: e.target.value }))}
          />
        )}
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Use action for exact transaction-action fees. Leave it blank when using fee context.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="feeContext">Fee context</label>
        <select
          id="feeContext"
          value={draft.feeContext}
          onChange={(e) => setDraft((p) => ({ ...p, feeContext: e.target.value, ...(e.target.value ? { action: '', customAction: '' } : {}) }))}
        >
          <option value="">No context</option>
          {feeContextOptions.map((context) => (
            <option key={context} value={context}>{context}</option>
          ))}
        </select>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Use COLLECTION/PAYOUT for flow fallback fees such as PawaPay. Do not store COLLECTION or PAYOUT as actions.
        </div>
      </div>
      {String(resolvedDraftAction || '').toUpperCase() === 'SWAP_CRYPTO' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="fromCryptoProductId">From Crypto Product</label>
            <select
              id="fromCryptoProductId"
              value={draft.fromCryptoProductId}
              onChange={(e) => setDraft((p) => ({ ...p, fromCryptoProductId: e.target.value, service: 'CRYPTO' }))}
            >
              <option value="">Select source crypto</option>
              {cryptoProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.displayName || product.name || product.code || product.id}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="toCryptoProductId">To Crypto Product</label>
            <select
              id="toCryptoProductId"
              value={draft.toCryptoProductId}
              onChange={(e) => setDraft((p) => ({ ...p, toCryptoProductId: e.target.value, service: 'CRYPTO' }))}
            >
              <option value="">Select destination crypto</option>
              {cryptoProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.displayName || product.name || product.code || product.id}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Swap fees are applied once on the source value before conversion to the destination asset.
            </div>
          </div>
        </>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="countryId">Country</label>
        <select id="countryId" value={draft.countryId} onChange={(e) => setDraft((p) => ({ ...p, countryId: e.target.value }))}>
          <option value="">All countries (global)</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.alpha2Code}) #{c.id}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="paymentMethodPaymentProviderId">Payment Method Route</label>
        <select
          id="paymentMethodPaymentProviderId"
          value={draft.paymentMethodPaymentProviderId}
          onChange={(e) => setDraft((p) => ({ ...p, paymentMethodPaymentProviderId: e.target.value }))}
        >
          <option value="">Global (no PMPP)</option>
          {pmps.map((pmp) => (
            <option key={pmp.id} value={pmp.id}>
              {paymentMethodRouteAdminLabel(pmp)} → {pmp.paymentProviderName || 'Provider'}
              {pmp.countryName ? ` (${pmp.countryName})` : ''} #{pmp.id}
            </option>
          ))}
        </select>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Use this only when the fee must target one exact payment method route.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="billProductBillProviderId">Bill Product Route</label>
        <select
          id="billProductBillProviderId"
          value={draft.billProductBillProviderId}
          onChange={(e) => setDraft((p) => ({ ...p, billProductBillProviderId: e.target.value }))}
        >
          <option value="">{isDraftGiftCardAction ? 'Select gift-card BPBP' : 'Global (no BPBP)'}</option>
          {(isDraftGiftCardAction ? bpbps.filter((bpbp) => giftCardMappingIds.has(Number(bpbp.id))) : bpbps).map((bpbp) => (
            <option key={bpbp.id} value={bpbp.id}>
              {(bpbp.billProductName || 'Bill Product')} — {(bpbp.billProviderName || 'Bill Provider')}
              {bpbp.id ? ` #${bpbp.id}` : ''}
            </option>
          ))}
        </select>
        {isDraftGiftCardAction && (
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Use product/provider scope for BUY_GIFT_CARD (Netflix, Spotify, App Store, Google Play, Airbnb, Uber) to keep separate pricing.
          </div>
        )}
        {!isDraftGiftCardAction && (
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Use this only when the fee must target one exact bill product mapping.
          </div>
        )}
      </div>
        </>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerFeePercentage">Provider %</label>
        <input
          id="providerFeePercentage"
          type="number"
          min={0}
          value={draft.providerFeePercentage}
          onChange={(e) => setDraft((p) => ({ ...p, providerFeePercentage: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerFlatFee">Provider flat</label>
        <input
          id="providerFlatFee"
          type="number"
          min={0}
          value={draft.providerFlatFee}
          onChange={(e) => setDraft((p) => ({ ...p, providerFlatFee: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerFlatFeeCurrency">Provider flat fee currency</label>
        <input
          id="providerFlatFeeCurrency"
          value={draft.providerFlatFeeCurrency}
          onChange={(e) => setDraft((p) => ({ ...p, providerFlatFeeCurrency: e.target.value.toUpperCase() }))}
          placeholder="KES"
        />
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Currency for provider/external flat fees. For Kenya M-Pesa tiers, use KES.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerMinFee">Provider minimum fee</label>
        <input
          id="providerMinFee"
          type="number"
          min={0}
          step="0.01"
          value={draft.providerMinFee}
          onChange={(e) => setDraft((p) => ({ ...p, providerMinFee: e.target.value }))}
        />
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Provider fee floor. This is separate from Minimum amount below.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerMinFeeCurrency">Provider minimum fee currency</label>
        <input
          id="providerMinFeeCurrency"
          value={draft.providerMinFeeCurrency}
          onChange={(e) => setDraft((p) => ({ ...p, providerMinFeeCurrency: e.target.value.toUpperCase() }))}
          placeholder="USD"
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="ourFeePercentage">Our %</label>
        <input id="ourFeePercentage" type="number" min={0} value={draft.ourFeePercentage} onChange={(e) => setDraft((p) => ({ ...p, ourFeePercentage: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="ourFlatFee">Our flat</label>
        <input id="ourFlatFee" type="number" min={0} value={draft.ourFlatFee} onChange={(e) => setDraft((p) => ({ ...p, ourFlatFee: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="minAmount">Transaction minimum amount</label>
        <input id="minAmount" type="number" min={0} step="0.01" value={draft.minAmount} onChange={(e) => setDraft((p) => ({ ...p, minAmount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="maxAmount">Transaction maximum amount</label>
        <input id="maxAmount" type="number" min={0} step="0.01" value={draft.maxAmount} onChange={(e) => setDraft((p) => ({ ...p, maxAmount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="amountRangeCurrency">Amount range currency</label>
        <input id="amountRangeCurrency" value={draft.amountRangeCurrency} onChange={(e) => setDraft((p) => ({ ...p, amountRangeCurrency: e.target.value.toUpperCase() }))} placeholder="KES" />
      </div>
      <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: 'var(--muted)' }}>
        Transaction amount range only. Leave both empty to make this the default fee for the scope. Set only minimum for transaction amounts at or above that value. Set only maximum for transaction amounts at or below that value. Set both to apply only within that range.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="feeApplicationMode">Fee application mode</label>
        <select id="feeApplicationMode" value={draft.feeApplicationMode} onChange={(e) => setDraft((p) => ({ ...p, feeApplicationMode: e.target.value }))}>
          {feeApplicationModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Choose how fees apply for this action.
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Used when the app does not explicitly choose how fees should be applied.
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          EXCLUSIVE: fees are added on top of the entered amount. INCLUSIVE: fees are deducted from the entered amount.
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          This rule is action-specific. Different actions can use different fee modes.
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Choose <strong>Use global default</strong> to inherit from the master global fee mode.
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          id="overrideSpecificFees"
          type="checkbox"
          checked={draft.overrideSpecificFees}
          onChange={(e) => setDraft((p) => ({ ...p, overrideSpecificFees: e.target.checked }))}
        />
        <label htmlFor="overrideSpecificFees">Override Specific Fees</label>
      </div>
      <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.65rem' }}>
        If enabled, a broader matching fee can intentionally beat narrower system fee configs. Use this only for explicit business exceptions, temporary campaigns, or fast top-down rollouts.
      </div>
      {isDraftGiftCardAction && (
        <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.65rem' }}>
          Amount model: amount is net gift-card value, fees are added on top, and gross = net + all fees.
        </div>
      )}
      {String(resolvedDraftAction || '').toUpperCase() === 'SWAP_CRYPTO' && (
        <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem 0.65rem' }}>
          Pair-specific swap rules override broad swap defaults. Stablecoin-to-stablecoin pairs are seeded at 0% by default, while other seeded pairs start at 5%.
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Fee Configs</div>
          <div style={{ color: 'var(--muted)' }}>Configure layered fees and the default fee charging policy across withdrawals, funding, purchases, bill payments, airtime, crypto, eSIM, and payment requests.</div>
        </div>
        <Link href="/dashboard/payments" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Payments hub
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
        <button type="button" onClick={openCreate} className="btn-success">
          Add fee config
        </button>
        <button
          type="button"
          onClick={() => {
            setPawapaySyncDraft(emptyPawapaySyncDraft);
            setPawapaySyncResult(null);
            setShowPawapaySync(true);
            setError(null);
            setInfo(null);
          }}
          className="btn-neutral"
        >
          Sync PawaPay fees
        </button>
        <div>
          <label htmlFor="arrangeBy">Arrange by</label>
          <select id="arrangeBy" value={arrangeBy} onChange={(e) => setArrangeBy(e.target.value)}>
            <option value="action">Action/context</option>
            <option value="service">Service</option>
            <option value="country">Country</option>
            <option value="scope">Scope</option>
            <option value="paymentMethodType">Payment method type</option>
            <option value="pmp">PMPP</option>
            <option value="bpbp">BPBP</option>
          </select>
        </div>
      </div>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Fee configuration guidance</summary>
        <div style={{ display: 'grid', gap: '0.45rem', color: 'var(--muted)', fontSize: '13px', marginTop: '0.75rem' }}>
          <div>Configure fees using provider and product names in the UI. The system sends IDs underneath, but names are the source of truth for admin decisions.</div>
          <div>Fee application mode is now a cross-app pricing policy, not just a payout setting. It affects fee-bearing flows such as withdrawals, funding, purchases, bill payments, airtime, eSIM, crypto, and public payment requests.</div>
          <div>
            Available scopes, from most specific to most general: <strong>Exact Route</strong> (Payment Method Route + Bill Product Route), <strong>Payment Route Only</strong>, <strong>Bill Route Only</strong>, <strong>Provider Pair</strong> (Payment Provider + Bill Provider), <strong>Bill Provider Default</strong>, <strong>Payment Provider Default</strong>, <strong>Payment Method Type + Action</strong>, <strong>Global Action Default</strong>, <strong>Pure Payment Method Type Fallback</strong>, and <strong>Global Default</strong>.
          </div>
          <div>
            Fee resolution at each matching scope is: <strong>exact action</strong>, then <strong>fee context</strong> (COLLECTION or PAYOUT), then older blank/default rows where applicable.
          </div>
          <div>
            Precedence: account custom fees win first, then exact provider/payment-method/product/action fees, then context fallback fees, then payment-method-type action/context fees, existing global action fees, fallback configs, pure payment-method-type fallback, OTHER, and global default. If <strong>Override Specific Fees</strong> is on, a broader matching fee can intentionally beat ordinary narrower system configs.
          </div>
          <div>
            Best mental model: <strong>master global fee mode = platform default</strong>, <strong>wallet policy action mode = default for one action</strong>, <strong>each fee row = more specific action override</strong>, <strong>account override = customer-specific exception for that action</strong>, and <strong>app request = explicit per-transaction choice</strong>.
          </div>
          <div>
            Fee application precedence: <strong>app request</strong>, then <strong>account fee override for that action</strong>, then <strong>global fee config for that action</strong>, then <strong>action-level wallet policy fee mode</strong>, then <strong>master global fee mode</strong>, then <strong>EXCLUSIVE</strong>.
          </div>
          <div>
            If the mobile app does not specify a fee mode, the configured rule for that action will be used. If the action row leaves fee mode unset, it inherits from the wallet policy action-level mode for that action, then from the master global fee mode. Older app versions rely on these admin-configured defaults by design.
          </div>
          <div>
            Operational impact: changing fee mode can change the effective credited or serviced amount for users who enter the same amount, especially on collection flows like bill payments, airtime, wallet funding, and payment requests.
          </div>
          <div>
            Recommended workflow: create fee-context provider defaults first for collection/payout provider costs, then add action-specific or exact-route exceptions only where needed. Avoid multiple active fee configs at the same exact scope for the same action/context state.
          </div>
          <div>
            Example: set <strong>Bill Provider = ZENDIT</strong> with blank action for a default Zendit fee, then add <strong>Bill Product Route = SONABEL</strong> with <strong>PAY_ELECTRICITY_BILL</strong> for a targeted exception. The specific action fee wins automatically unless a broader config is marked <strong>Override Specific Fees</strong>.
          </div>
        </div>
      </details>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Gift card pricing guidance</summary>
        <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '0.75rem' }}>
          Gift cards best practice: keep action as <strong>BUY_GIFT_CARD</strong>. Use <strong>Bill Product Route</strong> for product-specific pricing, optionally add <strong>Payment Method Route</strong> for channel pricing, or create broader global/provider/payment-method-type fallbacks when the backend should fill gaps. Legacy <strong>PAY_NETFLIX</strong> rows are not the new pricing path. Preview check: <code>/customer-api/fees?action=BUY_GIFT_CARD&amp;paymentMethodId=...&amp;billProductId=...&amp;amount=...</code>.
        </div>
      </details>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Gift Card Pricing Readiness</summary>
        <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.75rem' }}>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Product-specific BUY_GIFT_CARD rows are recommended for exact pricing, but broader fallbacks are allowed. Ensure each required gift card has an active Reloadly mapping and review whether it needs a specific BUY_GIFT_CARD fee row.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border)' }}>Product</th>
                  <th style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border)' }}>Active Reloadly Mapping</th>
                  <th style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border)' }}>BUY_GIFT_CARD Fee Rows</th>
                </tr>
              </thead>
              <tbody>
                {requiredGiftCardStatus.map((item) => (
                  <tr key={item.key}>
                    <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--border)' }}>{item.displayName}</td>
                    <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--border)' }}>
                      {item.hasActiveReloadlyMapping ? `Yes (${item.activeReloadlyMappingIds.join(', ')})` : 'Missing'}
                    </td>
                    <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--border)' }}>
                      {item.feeConfigCount > 0 ? item.feeConfigCount : 'Missing'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      {activeFilterChips.length > 0 && (
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
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

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Filters</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
            <button type="button" onClick={fetchRows} disabled={loading} className="btn-neutral btn-sm">
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
        {showFilters && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterPaymentMethodType">Payment method type</label>
            <select id="filterPaymentMethodType" value={filters.paymentMethodType} onChange={(e) => setFilters((p) => ({ ...p, paymentMethodType: e.target.value }))}>
              <option value="">All</option>
              {paymentMethodTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterService">Service</label>
            <select id="filterService" value={filters.service} onChange={(e) => setFilters((p) => ({ ...p, service: e.target.value }))}>
              <option value="">All</option>
              {serviceOptions.map((svc) => (
                <option key={svc} value={svc}>
                  {svc}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterAction">Action</label>
            <select id="filterAction" value={filters.action} onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value }))}>
              <option value="">All</option>
              {actionOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterFeeContext">Fee context</label>
            <select id="filterFeeContext" value={filters.feeContext} onChange={(e) => setFilters((p) => ({ ...p, feeContext: e.target.value }))}>
              <option value="">All</option>
              {feeContextOptions.map((context) => (
                <option key={context} value={context}>
                  {context}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterCountry">Country</label>
            <select id="filterCountry" value={filters.countryId} onChange={(e) => setFilters((p) => ({ ...p, countryId: e.target.value }))}>
              <option value="">All</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.alpha2Code})
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterPaymentMethod">Payment Method</label>
            <select id="filterPaymentMethod" value={filters.paymentMethodId} onChange={(e) => setFilters((p) => ({ ...p, paymentMethodId: e.target.value }))}>
              <option value="">All</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {paymentMethodAdminLabel(pm)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterBillProduct">Bill Product</label>
            <select id="filterBillProduct" value={filters.billProductId} onChange={(e) => setFilters((p) => ({ ...p, billProductId: e.target.value }))}>
              <option value="">All</option>
              {billProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.displayName || product.name || product.id}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterPaymentProvider">Payment Provider</label>
            <select id="filterPaymentProvider" value={filters.paymentProviderId} onChange={(e) => setFilters((p) => ({ ...p, paymentProviderId: e.target.value }))}>
              <option value="">All</option>
              {paymentProviders.map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.name || prov.displayName || prov.id}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterBillProvider">Bill Provider</label>
            <select id="filterBillProvider" value={filters.billProviderId} onChange={(e) => setFilters((p) => ({ ...p, billProviderId: e.target.value }))}>
              <option value="">All</option>
              {billProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name || provider.displayName || provider.id}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterPmp">PMPP</label>
            <select
              id="filterPmp"
              value={filters.paymentMethodPaymentProviderId}
              onChange={(e) => setFilters((p) => ({ ...p, paymentMethodPaymentProviderId: e.target.value }))}
            >
              <option value="">All</option>
              {pmps.map((pmp) => (
                <option key={pmp.id} value={pmp.id}>
                  {paymentMethodRouteAdminLabel(pmp)} → {pmp.paymentProviderName || 'Provider'}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterBpbp">Bill Product Bill Provider</label>
            <select
              id="filterBpbp"
              value={filters.billProductBillProviderId}
              onChange={(e) => setFilters((p) => ({ ...p, billProductBillProviderId: e.target.value }))}
            >
              <option value="">All</option>
              {bpbps.map((bpbp) => (
                <option key={bpbp.id} value={bpbp.id}>
                  {(bpbp.billProductName || 'Bill Product')} — {(bpbp.billProviderName || 'Bill Provider')}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterFromCrypto">From Crypto</label>
            <select id="filterFromCrypto" value={filters.fromCryptoProductId} onChange={(e) => setFilters((p) => ({ ...p, fromCryptoProductId: e.target.value }))}>
              <option value="">All</option>
              {cryptoProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.displayName || product.name || product.code || product.id}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterToCrypto">To Crypto</label>
            <select id="filterToCrypto" value={filters.toCryptoProductId} onChange={(e) => setFilters((p) => ({ ...p, toCryptoProductId: e.target.value }))}>
              <option value="">All</option>
              {cryptoProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.displayName || product.name || product.code || product.id}
                </option>
              ))}
            </select>
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
              setFilters(initialFilters);
              setAppliedFilters(initialFilters);
              setPage(0);
            }}
            disabled={loading}
            className="btn-neutral"
          >
            Reset
          </button>
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Crypto pair filters are applied in the dashboard when the API does not expose dedicated pair query params.</span>
            </div>
          </>
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

      <DataTable columns={columns} rows={filteredRows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No fee configs found" />

      {showCreate && (
        <Modal title="Add fee config" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleCreate} className="btn-success">
              Create
            </button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit fee config ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleUpdate} className="btn-primary">
              Save
            </button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Scope type', value: scopeTypeLabel(resolveScopeType(selected || {})) },
              { label: 'Payment method type', value: selected?.paymentMethodType || '—' },
              { label: 'Payment provider', value: getPaymentProviderLabel(selected || {}) },
              { label: 'Bill provider', value: getBillProviderLabel(selected || {}) },
              { label: 'Method/Provider', value: getPmpLabel(selected || {}) },
              { label: 'Bill Product/Provider', value: getBpbpLabel(selected || {}) },
              { label: 'Country', value: getCountryLabel(selected || {}) },
              { label: 'Service', value: selected?.service || 'ALL' },
              { label: 'Action', value: selected?.action },
              { label: 'Fee context', value: selected?.feeContext || '—' },
              { label: 'From crypto', value: selected?.fromCryptoProductId ? getCryptoProductLabel(selected?.fromCryptoProductId) : 'Fallback/global rule' },
              { label: 'To crypto', value: selected?.toCryptoProductId ? getCryptoProductLabel(selected?.toCryptoProductId) : 'Fallback/global rule' },
              { label: 'Override specific fees', value: selected?.overrideSpecificFees ? 'Yes' : 'No' },
              { label: 'Provider %', value: selected?.providerFeePercentage },
              { label: 'Provider flat', value: selected?.providerFlatFee },
              { label: 'Provider flat fee currency', value: selected?.providerFlatFeeCurrency || '—' },
              { label: 'Provider minimum fee', value: selected?.providerMinFee },
              { label: 'Provider minimum fee currency', value: selected?.providerMinFeeCurrency || '—' },
              { label: 'Our %', value: selected?.ourFeePercentage },
              { label: 'Our flat', value: selected?.ourFlatFee },
              { label: 'Amount range', value: `${formatAmountRange(selected?.minAmount, selected?.maxAmount)}${selected?.amountRangeCurrency ? ` ${selected.amountRangeCurrency}` : ''}` },
              { label: 'Amount range currency', value: selected?.amountRangeCurrency || '—' },
              { label: 'Transaction minimum amount', value: selected?.minAmount ?? '—' },
              { label: 'Transaction maximum amount', value: selected?.maxAmount ?? '—' },
              {
                label: 'Fee application mode',
                value:
                  String(selected?.feeApplicationMode || '').toUpperCase() === 'INCLUSIVE'
                    ? 'Recipient pays (INCLUSIVE)'
                    : String(selected?.feeApplicationMode || '').toUpperCase() === 'EXCLUSIVE'
                      ? 'Sender pays (EXCLUSIVE)'
                      : 'Use global default'
              },
              { label: 'Created', value: selected?.createdAt },
              { label: 'Updated', value: selected?.updatedAt }
            ]}
          />
        </Modal>
      )}

      {showPawapaySync && (
        <Modal title="Sync PawaPay fees" onClose={() => (!pawapaySyncLoading ? setShowPawapaySync(false) : null)}>
          <div style={{ display: 'grid', gap: '0.9rem' }}>
            <div style={{ padding: '0.75rem', border: '1px solid #FDE68A', borderRadius: '10px', background: '#FFFBEB', color: '#92400E', fontSize: '13px', fontWeight: 700 }}>
              PawaPay/MMO fees must be entered as provider/external fees and should use feeContext COLLECTION or PAYOUT, not transaction actions. Keep Fondeka internal fee at 2% unless business explicitly changes it. For Kenya M-Pesa tiers, use KES for amountRangeCurrency and providerFlatFeeCurrency.
            </div>
            <div style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--panel, transparent)', color: 'var(--muted)', fontSize: '13px' }}>
              <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: '0.25rem' }}>Customer-paid provider charges</div>
              <div>
                Charged directly by customer&apos;s mobile-money provider. Not collected by Fondeka. For disclosure-only rows, set providerFeeConfigEnabled to false so the backend does not create a normal fee config.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="pawapayDefaultOurFeePercentage">Default Fondeka fee %</label>
                <input
                  id="pawapayDefaultOurFeePercentage"
                  type="number"
                  min={0}
                  step="0.01"
                  value={pawapaySyncDraft.defaultOurFeePercentage}
                  onChange={(e) => setPawapaySyncDraft((p) => ({ ...p, defaultOurFeePercentage: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="pawapayDefaultOurFlatFee">Default Fondeka flat fee</label>
                <input
                  id="pawapayDefaultOurFlatFee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={pawapaySyncDraft.defaultOurFlatFee}
                  onChange={(e) => setPawapaySyncDraft((p) => ({ ...p, defaultOurFlatFee: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="pawapayFeeApplicationMode">Fee application mode</label>
                <select
                  id="pawapayFeeApplicationMode"
                  value={pawapaySyncDraft.feeApplicationMode}
                  onChange={(e) => setPawapaySyncDraft((p) => ({ ...p, feeApplicationMode: e.target.value }))}
                >
                  <option value="EXCLUSIVE">EXCLUSIVE</option>
                  <option value="INCLUSIVE">INCLUSIVE</option>
                </select>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={Boolean(pawapaySyncDraft.replaceExistingRows)}
                  onChange={(e) => setPawapaySyncDraft((p) => ({ ...p, replaceExistingRows: e.target.checked }))}
                />
                Replace existing rows
              </label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="pawapayFeesJson">PawaPay fee rows JSON</label>
              <textarea
                id="pawapayFeesJson"
                value={pawapaySyncDraft.feesJson}
                onChange={(e) => setPawapaySyncDraft((p) => ({ ...p, feesJson: e.target.value }))}
                rows={16}
                style={{ fontFamily: 'monospace', minHeight: '280px' }}
              />
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Paste an array of normal fee rows or customer-paid provider charge rows. Customer-paid rows can include providerFeeConfigEnabled, customerPaidProviderFeeAmount/Currency/Percentage, chargedBy, includedInTotal, EN/FR messages, source, and sourceDate. If pasted rows use action COLLECTION or PAYOUT, the dashboard converts that to feeContext before sending.
              </div>
            </div>
            {pawapaySyncResult ? (
              <DetailGrid
                rows={[
                  { label: 'Created', value: pawapaySyncResult.created ?? 0 },
                  { label: 'Updated', value: pawapaySyncResult.updated ?? 0 },
                  { label: 'Removed', value: pawapaySyncResult.removed ?? 0 },
                  { label: 'Customer-paid created', value: pawapaySyncResult.customerPaidCreated ?? 0 },
                  { label: 'Customer-paid updated', value: pawapaySyncResult.customerPaidUpdated ?? 0 },
                  { label: 'Customer-paid removed', value: pawapaySyncResult.customerPaidRemoved ?? 0 },
                  { label: 'Returned configs', value: Array.isArray(pawapaySyncResult.feeConfigs) ? pawapaySyncResult.feeConfigs.length : 0 }
                ]}
              />
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setShowPawapaySync(false)} className="btn-neutral" disabled={pawapaySyncLoading}>
                Close
              </button>
              <button type="button" onClick={handlePawapaySync} className="btn-primary" disabled={pawapaySyncLoading}>
                {pawapaySyncLoading ? 'Syncing...' : 'Sync PawaPay fees'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete fee config <strong>{confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleDelete} className="btn-danger">
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
