'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const serviceOptions = ['WALLET', 'BILL_PAYMENTS', 'LENDING', 'CARD', 'CRYPTO', 'PAYMENT_REQUEST', 'E_SIM', 'AIRTIME_AND_DATA', 'OTHER'];
const feeApplicationModeOptions = [
  { value: '', label: 'Use global default' },
  { value: 'EXCLUSIVE', label: 'Sender pays fees (EXCLUSIVE)' },
  { value: 'INCLUSIVE', label: 'Recipient pays fees (INCLUSIVE)' }
];

const actionOptions = [
  'BUY_CARD',
  'BUY_CRYPTO',
  'BUY_GIFT_CARD',
  'E_SIM_PURCHASE',
  'E_SIM_TOPUP',
  'FUND_CARD',
  'FUND_WALLET',
  'INTER_TRANSFER',
  'LOAN_REQUEST',
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
  'SEND_CRYPTO',
  'SETTLEMENT',
  'SWAP_CRYPTO',
  'WITHDRAW_FROM_CARD',
  'PERSONAL_SAVING_DEPOSIT',
  'PERSONAL_SAVING_WITHDRAWAL',
  'PERSONAL_SAVING_INTEREST_PAYOUT',
  'GROUP_SAVING_CONTRIBUTION',
  'GROUP_SAVING_PAYOUT',
  'WITHDRAW_FROM_WALLET'
].sort();

const initialFilters = {
  action: '',
  service: '',
  countryId: '',
  paymentMethodPaymentProviderId: '',
  billProductBillProviderId: '',
  billProductId: '',
  billProviderId: '',
  paymentMethodId: '',
  paymentProviderId: ''
};

const emptyState = {
  paymentProviderId: '',
  billProviderId: '',
  paymentMethodPaymentProviderId: '',
  billProductBillProviderId: '',
  countryId: '',
  service: '',
  action: '',
  customAction: '',
  overrideSpecificFees: false,
  providerFeePercentage: '',
  providerFlatFee: '',
  ourFeePercentage: '',
  ourFlatFee: '',
  feeApplicationMode: ''
};

const resolveAction = (state) => (state.action === '__custom' ? state.customAction : state.action);
const normalizeOptionalIdForForm = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num) || num <= 0) return '';
  return String(num);
};

const toPayload = (state) => ({
  paymentProviderId: state.paymentProviderId === '' ? null : Number(state.paymentProviderId),
  billProviderId: state.billProviderId === '' ? null : Number(state.billProviderId),
  paymentMethodPaymentProviderId: state.paymentMethodPaymentProviderId === '' ? null : Number(state.paymentMethodPaymentProviderId),
  billProductBillProviderId: state.billProductBillProviderId === '' ? null : Number(state.billProductBillProviderId),
  countryId: state.countryId === '' ? null : Number(state.countryId),
  service: state.service || null,
  action: resolveAction(state),
  overrideSpecificFees: Boolean(state.overrideSpecificFees),
  providerFeePercentage: state.providerFeePercentage === '' ? null : Number(state.providerFeePercentage),
  providerFlatFee: state.providerFlatFee === '' ? null : Number(state.providerFlatFee),
  ourFeePercentage: state.ourFeePercentage === '' ? null : Number(state.ourFeePercentage),
  ourFlatFee: state.ourFlatFee === '' ? null : Number(state.ourFlatFee),
  feeApplicationMode: state.feeApplicationMode || null
});

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
  const [arrangeBy, setArrangeBy] = useState('action');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const resolvedDraftAction = resolveAction(draft);
  const isDraftGiftCardAction = String(resolvedDraftAction || '').toUpperCase() === 'BUY_GIFT_CARD';

  const activeFilterChips = useMemo(() => {
    const chips = [];
    const add = (label, key) => chips.push({ label, key });
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      switch (key) {
        case 'service':
          add(`Service: ${value}`, key);
          break;
        case 'action':
          add(`Action: ${value}`, key);
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
        default:
          break;
      }
    });
    return chips;
  }, [appliedFilters]);

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
          'paymentProviderId'
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
        const [pmpRes, countryRes, pmRes, provRes, bpbpRes, billProductRes, billProviderRes] = await Promise.all([
          api.paymentMethodPaymentProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.countries.list(new URLSearchParams({ page: '0', size: '200' })),
          api.paymentMethods.list(new URLSearchParams({ page: '0', size: '200' })),
          api.paymentProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.billProductBillProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.billProducts.list(new URLSearchParams({ page: '0', size: '200' })),
          api.billProviders.list(new URLSearchParams({ page: '0', size: '200' }))
        ]);
        const toList = (res) => (Array.isArray(res) ? res : res?.content || []);
        setPmps(toList(pmpRes));
        setCountries(toList(countryRes));
        setPaymentMethods(toList(pmRes));
        setPaymentProviders(toList(provRes));
        setBpbps(toList(bpbpRes));
        setBillProducts(toList(billProductRes));
        setBillProviders(toList(billProviderRes));
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
      const method = match.paymentMethodName || match.paymentMethodDisplayName || 'Method';
      const provider = match.paymentProviderName || 'Provider';
      return `${method} → ${provider}`;
    }
    const fallbackLabel = [row.paymentMethodName, row.paymentProviderName].filter(Boolean).join(' → ');
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
      arr.sort((a, b) => compare(a.action, b.action));
    } else if (arrangeBy === 'service') {
      arr.sort((a, b) => compare(a.service || 'ALL', b.service || 'ALL'));
    } else if (arrangeBy === 'country') {
      arr.sort((a, b) => compare(getCountryLabel(a), getCountryLabel(b)));
    } else if (arrangeBy === 'pmp') {
      arr.sort((a, b) => compare(getPmpLabel(a), getPmpLabel(b)));
    } else if (arrangeBy === 'bpbp') {
      arr.sort((a, b) => compare(getBpbpLabel(a), getBpbpLabel(b)));
    }
    return arr;
  }, [arrangeBy, rows, getCountryLabel, getPmpLabel, getBpbpLabel]);

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
        key: 'service',
        label: 'Service',
        render: (row) => row.service || 'ALL'
      },
      { key: 'action', label: 'Action' },
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
              {row.paymentMethodName && <span>Method: {row.paymentMethodName}</span>}
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
      { key: 'providerFeePercentage', label: 'Provider %' },
      { key: 'providerFlatFee', label: 'Provider flat' },
      { key: 'ourFeePercentage', label: 'Our %' },
      { key: 'ourFlatFee', label: 'Our flat' },
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
    [getCountryLabel, getPaymentProviderLabel, getBillProviderLabel, getPmpLabel, getBpbpLabel]
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
      paymentProviderId: normalizeOptionalIdForForm(row.paymentProviderId),
      billProviderId: normalizeOptionalIdForForm(row.billProviderId),
      paymentMethodPaymentProviderId: normalizeOptionalIdForForm(row.paymentMethodPaymentProviderId),
      billProductBillProviderId: normalizeOptionalIdForForm(row.billProductBillProviderId),
      countryId: row.countryId ?? '',
      service: row.service ?? '',
      action: actionChoice,
      customAction: actionChoice === '__custom' ? row.action || '' : '',
      overrideSpecificFees: Boolean(row.overrideSpecificFees),
      providerFeePercentage: row.providerFeePercentage ?? '',
      providerFlatFee: row.providerFlatFee ?? '',
      ourFeePercentage: row.ourFeePercentage ?? '',
      ourFlatFee: row.ourFlatFee ?? '',
      feeApplicationMode: row.feeApplicationMode || ''
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
    if (state.paymentProviderId !== '' && Number(state.paymentProviderId) < 0) return 'Payment provider must be non-negative.';
    if (state.billProviderId !== '' && Number(state.billProviderId) < 0) return 'Bill provider must be non-negative.';
    if (state.paymentMethodPaymentProviderId !== '' && Number(state.paymentMethodPaymentProviderId) < 0) return 'PMPP ID must be non-negative.';
    if (state.billProductBillProviderId !== '' && Number(state.billProductBillProviderId) < 0) return 'BPBP ID must be non-negative.';
    if (state.countryId !== '' && Number(state.countryId) < 0) return 'Country ID must be non-negative.';
    if (state.service === '__custom') return 'Service value is invalid.';
    const numericFields = [
      { key: 'providerFeePercentage', value: state.providerFeePercentage },
      { key: 'providerFlatFee', value: state.providerFlatFee },
      { key: 'ourFeePercentage', value: state.ourFeePercentage },
      { key: 'ourFlatFee', value: state.ourFlatFee }
    ];
    const invalid = numericFields.find((item) => item.value !== '' && Number(item.value) < 0);
    if (invalid) return 'Fee values cannot be negative.';
    const normalizedAction = String(resolved || '').toUpperCase();
    const normalizedPaymentProvider = state.paymentProviderId === '' ? null : Number(state.paymentProviderId);
    const normalizedBillProvider = state.billProviderId === '' ? null : Number(state.billProviderId);
    const normalizedPmp = state.paymentMethodPaymentProviderId === '' ? null : Number(state.paymentMethodPaymentProviderId);
    const normalizedBpbp = state.billProductBillProviderId === '' ? null : Number(state.billProductBillProviderId);
    if (normalizedPmp !== null && normalizedPaymentProvider !== null) {
      return 'Choose either Payment Provider or the exact Payment Method Route. Do not set both on the same fee config.';
    }
    if (normalizedBpbp !== null && normalizedBillProvider !== null) {
      return 'Choose either Bill Provider or the exact Bill Product Route. Do not set both on the same fee config.';
    }
    if (normalizedAction === 'BUY_GIFT_CARD' && (normalizedBpbp === null || Number.isNaN(normalizedBpbp))) {
      return 'For BUY_GIFT_CARD, select Bill Product Bill Provider scope (BPBP) so each product can be priced separately.';
    }
    if (normalizedAction === 'BUY_GIFT_CARD' && normalizedBpbp !== null && !giftCardMappingIds.has(Number(normalizedBpbp))) {
      return 'Selected BPBP does not appear to be a gift-card mapping. Use a mapping where bill product has giftCard=true.';
    }
    const duplicate = rows.find((row) => {
      if (currentId && Number(row?.id) === Number(currentId)) return false;
      const rowAction = String(row?.action || '').toUpperCase();
      if (rowAction !== normalizedAction) return false;
      const rowPaymentProvider = row?.paymentProviderId === null || row?.paymentProviderId === undefined ? null : Number(row.paymentProviderId);
      const rowBillProvider = row?.billProviderId === null || row?.billProviderId === undefined ? null : Number(row.billProviderId);
      const rowBpbp = row?.billProductBillProviderId === null || row?.billProductBillProviderId === undefined ? null : Number(row.billProductBillProviderId);
      const rowPmp = row?.paymentMethodPaymentProviderId === null || row?.paymentMethodPaymentProviderId === undefined ? null : Number(row.paymentMethodPaymentProviderId);
      return rowPaymentProvider === normalizedPaymentProvider
        && rowBillProvider === normalizedBillProvider
        && rowBpbp === normalizedBpbp
        && rowPmp === normalizedPmp;
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
        ourFeePercentage: '',
        ourFlatFee: '',
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

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
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
          onChange={(e) => setDraft((p) => ({ ...p, action: e.target.value, customAction: e.target.value === '__custom' ? p.customAction : '' }))}
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
          Leave action blank to create the default fee for this scope. If both exist, action-specific fees beat `OTHER`, and `OTHER` beats the blank-action default.
        </div>
      </div>
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
              {pmp.paymentMethodName || pmp.paymentMethodDisplayName || 'Method'} → {pmp.paymentProviderName || 'Provider'}
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
        <label htmlFor="ourFeePercentage">Our %</label>
        <input id="ourFeePercentage" type="number" min={0} value={draft.ourFeePercentage} onChange={(e) => setDraft((p) => ({ ...p, ourFeePercentage: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="ourFlatFee">Our flat</label>
        <input id="ourFlatFee" type="number" min={0} value={draft.ourFlatFee} onChange={(e) => setDraft((p) => ({ ...p, ourFlatFee: e.target.value }))} />
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
        <div>
          <label htmlFor="arrangeBy">Arrange by</label>
          <select id="arrangeBy" value={arrangeBy} onChange={(e) => setArrangeBy(e.target.value)}>
            <option value="action">Action</option>
            <option value="service">Service</option>
            <option value="country">Country</option>
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
            Available scopes, from most specific to most general: <strong>Exact Route</strong> (Payment Method Route + Bill Product Route), <strong>Payment Route Only</strong>, <strong>Bill Route Only</strong>, <strong>Provider Pair</strong> (Payment Provider + Bill Provider), <strong>Bill Provider Default</strong>, <strong>Payment Provider Default</strong>, and <strong>Global Action Default</strong>.
          </div>
          <div>
            Action resolution at each matching scope is: <strong>exact action</strong>, then <strong>OTHER</strong>, then <strong>blank action</strong>. Blank action is a valid default fee for that scope, not a bad request.
          </div>
          <div>
            Precedence: account custom fees win first. After that, narrower system configs normally beat broader ones, while broader configs act as fallback defaults. If <strong>Override Specific Fees</strong> is on, a broader matching fee can intentionally beat ordinary narrower system configs.
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
            Recommended workflow: create blank-action provider defaults first, then add action-specific or exact-route exceptions only where needed. Avoid multiple active fee configs at the same exact scope for the same action state.
          </div>
          <div>
            Example: set <strong>Bill Provider = ZENDIT</strong> with blank action for a default Zendit fee, then add <strong>Bill Product Route = SONABEL</strong> with <strong>PAY_ELECTRICITY_BILL</strong> for a targeted exception. The specific action fee wins automatically unless a broader config is marked <strong>Override Specific Fees</strong>.
          </div>
        </div>
      </details>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Gift card pricing guidance</summary>
        <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '0.75rem' }}>
          Gift cards best practice: keep action as <strong>BUY_GIFT_CARD</strong>, scope by <strong>Bill Product Route</strong>, optionally add <strong>Payment Method Route</strong> for channel pricing, and avoid duplicate rows with the same layered scope. Use the same pattern for Netflix, Spotify, App Store, Google Play, Airbnb, and Uber. Legacy <strong>PAY_NETFLIX</strong> rows are not the new pricing path. Preview check: <code>/customer-api/fees?action=BUY_GIFT_CARD&amp;paymentMethodId=...&amp;billProductId=...&amp;amount=...</code>.
        </div>
      </details>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Gift Card Pricing Readiness</summary>
        <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.75rem' }}>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Global BUY_GIFT_CARD fallback is unsafe. Ensure each required gift card has an active Reloadly mapping and at least one BUY_GIFT_CARD fee row.
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
                  {pm.name || pm.displayName || pm.id}
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
                  {pmp.paymentMethodName || pmp.paymentMethodDisplayName || 'Method'} → {pmp.paymentProviderName || 'Provider'}
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
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Only applied filters are sent to the API.</span>
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

      <DataTable columns={columns} rows={sortedRows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No fee configs found" />

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
              { label: 'Payment provider', value: getPaymentProviderLabel(selected || {}) },
              { label: 'Bill provider', value: getBillProviderLabel(selected || {}) },
              { label: 'Method/Provider', value: getPmpLabel(selected || {}) },
              { label: 'Bill Product/Provider', value: getBpbpLabel(selected || {}) },
              { label: 'Country', value: getCountryLabel(selected || {}) },
              { label: 'Service', value: selected?.service || 'ALL' },
              { label: 'Action', value: selected?.action },
              { label: 'Override specific fees', value: selected?.overrideSpecificFees ? 'Yes' : 'No' },
              { label: 'Provider %', value: selected?.providerFeePercentage },
              { label: 'Provider flat', value: selected?.providerFlatFee },
              { label: 'Our %', value: selected?.ourFeePercentage },
              { label: 'Our flat', value: selected?.ourFlatFee },
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
