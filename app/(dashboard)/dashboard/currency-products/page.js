'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import COUNTRIES from '@/data/countries';

const currencyOptions = ['USD', 'CDF', 'EUR', 'KES', 'UGX', 'GHS', 'XAF'];
const rateProviderOptions = ['MANUAL', 'MAPLERAD'];
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
  'BUY_CRYPTO',
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
const countryByCode = new Map(countryOptions.map((country) => [country.cca2, country]));

const emptyDraft = {
  currency: '',
  displayName: '',
  logoUrl: '',
  active: true,
  walletEnabled: true,
  legacyBalanceBacked: false,
  baseCurrency: 'USD',
  rate: '',
  collectionMarginPercent: '',
  payoutMarginPercent: '',
  rateProvider: 'MANUAL',
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

const formatCountryLabel = (code) => {
  const country = countryByCode.get(code);
  return country ? `${code} - ${country.name}` : code;
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
  const [countryPopup, setCountryPopup] = useState(null);
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

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
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
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const collectionMarginPercent = nullableNumber(draft.collectionMarginPercent);
    const payoutMarginPercent = nullableNumber(draft.payoutMarginPercent);
    const countryCodes = normalizeCountryCodes(draft.countryCodes);
    const defaultCountryCodes = normalizeCountryCodes(draft.defaultCountryCodes);
    if (!currency) return 'Currency is required.';
    if (!draft.displayName.trim()) return 'Display name is required.';
    if (!baseCurrency) return 'Base currency is required.';
    if (!Number.isFinite(rate) || rate <= 0) return 'Rate must be a positive number.';
    if (draft.collectionMarginPercent !== '' && (collectionMarginPercent === null || collectionMarginPercent < 0)) return 'Collection margin must be zero or a positive number.';
    if (draft.payoutMarginPercent !== '' && (payoutMarginPercent === null || payoutMarginPercent < 0)) return 'Payout margin must be zero or a positive number.';
    if (!upperTrim(draft.rateProvider)) return 'Rate provider is required.';
    if (draft.rateFetchedAt && !toIsoOrNull(draft.rateFetchedAt)) return 'Rate fetched at must be a valid date and time.';
    if (defaultCountryCodes.some((code) => !countryCodes.includes(code))) return 'Default countries must also be included in country availability.';
    return null;
  };

  const buildPayload = () => {
    const defaultCountryCodes = normalizeCountryCodes(draft.defaultCountryCodes);
    const countryCodes = mergeCountryCodes(draft.countryCodes, defaultCountryCodes);
    return {
      currency: upperTrim(draft.currency),
      displayName: draft.displayName.trim(),
      logoUrl: draft.logoUrl.trim() || null,
      active: Boolean(draft.active),
      walletEnabled: Boolean(draft.walletEnabled),
      legacyBalanceBacked: Boolean(draft.legacyBalanceBacked),
      baseCurrency: upperTrim(draft.baseCurrency),
      rate: Number(draft.rate),
      collectionMarginPercent: nullableNumber(draft.collectionMarginPercent),
      payoutMarginPercent: nullableNumber(draft.payoutMarginPercent),
      rateProvider: upperTrim(draft.rateProvider),
      rateFetchedAt: toIsoOrNull(draft.rateFetchedAt),
      countryCodes,
      defaultCountryCodes
    };
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
      legacyBalanceBacked: row.legacyBalanceBacked ?? false,
      baseCurrency: row.baseCurrency ?? 'USD',
      rate: row.rate ?? '',
      collectionMarginPercent: row.collectionMarginPercent ?? '',
      payoutMarginPercent: row.payoutMarginPercent ?? '',
      rateProvider: row.rateProvider ?? 'MANUAL',
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

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size : page + 1 < pageMeta.totalPages;

  const renderCountryTrigger = (row, field, label) => {
    const codes = normalizeCountryCodes(row[field]);
    if (!codes.length) return '-';
    return (
      <button
        type="button"
        className="btn-neutral btn-sm"
        onClick={() => setCountryPopup({
          title: `${label} - ${row.currency || `Product ${row.id}`}`,
          codes
        })}
      >
        View {codes.length}
      </button>
    );
  };

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
    { key: 'rate', label: 'Rate' },
    { key: 'baseCurrency', label: 'Base' },
    { key: 'countryCodes', label: 'Countries', render: (row) => renderCountryTrigger(row, 'countryCodes', 'Country availability') },
    { key: 'defaultCountryCodes', label: 'Defaults', render: (row) => renderCountryTrigger(row, 'defaultCountryCodes', 'Default in countries') },
    { key: 'collectionMarginPercent', label: 'Collection margin', render: (row) => formatPercent(row.collectionMarginPercent) },
    { key: 'payoutMarginPercent', label: 'Payout margin', render: (row) => formatPercent(row.payoutMarginPercent) },
    { key: 'walletEnabled', label: 'Wallet', render: (row) => formatBool(row.walletEnabled) },
    { key: 'active', label: 'Active', render: (row) => formatBool(row.active) },
    { key: 'rateProvider', label: 'Provider', hideOnMobile: true },
    { key: 'rateFetchedAt', label: 'Rate fetched', hideOnMobile: true, render: (row) => formatDateTime(row.rateFetchedAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openPreview(row)} className="btn-neutral" disabled={actionLoading || previewLoading}>Simulate Exchange</button>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral" disabled={actionLoading}>View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral" disabled={actionLoading}>Edit</button>
          {row.active ? <button type="button" onClick={() => handleDeactivate(row)} className="btn-neutral" disabled={actionLoading}>Deactivate</button> : null}
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
        <label htmlFor="rate">Rate</label>
        <input id="rate" type="number" min="0" step="0.000001" value={draft.rate} onChange={(e) => setDraft((p) => ({ ...p, rate: e.target.value }))} />
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
    const providerErrors = Array.isArray(previewResult.providerErrors) ? previewResult.providerErrors : [];
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <DetailGrid
          rows={[
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
        <DetailGrid
          rows={[
            { label: 'Action', value: previewResult.action || '-' },
            { label: 'Action flow', value: previewResult.actionMarginFlow || '-' },
            { label: 'Action margin', value: formatPercent(previewResult.actionMarginPercent) },
            { label: 'Action margin amount', value: formatMoney(previewResult.actionMarginAmount, previewResult.targetCurrency) },
            { label: 'Action rate', value: formatRate(previewResult.actionRate) },
            { label: 'Action converted', value: formatMoney(previewResult.actionConvertedAmount, previewResult.targetCurrency) },
            { label: 'Fee-adjusted source', value: formatMoney(previewResult.feeAdjustedSourceAmount, previewResult.feeAdjustedSourceCurrency) },
            { label: 'Fee-adjusted converted', value: formatMoney(previewResult.feeAdjustedConvertedAmount, previewResult.targetCurrency) }
          ]}
        />
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
          <div style={{ fontWeight: 700 }}>Products</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="page">Page</label>
            <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="size">Size</label>
            <input id="size" type="number" min={1} max={200} value={size} onChange={(e) => { setSize(Math.max(1, Number(e.target.value) || 1)); setPage(0); }} />
          </div>
        </div>

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
              { label: 'Legacy balance backed', value: formatBool(selected?.legacyBalanceBacked) },
              { label: 'Base currency', value: selected?.baseCurrency },
              { label: 'Country availability', value: formatCountryCodes(selected?.countryCodes) },
              { label: 'Default in countries', value: formatCountryCodes(selected?.defaultCountryCodes) },
              { label: 'Rate', value: selected?.rate },
              { label: 'Collection margin', value: formatPercent(selected?.collectionMarginPercent) },
              { label: 'Payout margin', value: formatPercent(selected?.payoutMarginPercent) },
              { label: 'Rate provider', value: selected?.rateProvider },
              { label: 'Rate fetched at', value: formatDateTime(selected?.rateFetchedAt) },
              { label: 'Created at', value: formatDateTime(selected?.createdAt) },
              { label: 'Updated at', value: formatDateTime(selected?.updatedAt) }
            ]}
          />
        </Modal>
      )}

      {showPreview && (
        <Modal title="Simulate Exchange" onClose={() => (!previewLoading ? setShowPreview(false) : null)}>
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              QA preview only. This does not create transactions, debit wallets, credit balances, or call payment providers.
            </div>
            {previewOptionsLoading ? <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Loading backend options...</div> : null}
            {previewOptionsError ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{previewOptionsError}</div> : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
              {renderPreviewInput('amount', 'Amount', { type: 'number', min: '0', step: '0.000001' })}
              {renderPreviewSelect('sourceCurrency', 'Source currency', previewCurrencyOptions, { emptyLabel: 'Select source currency' })}
              {renderPreviewSelect('targetCurrency', 'Target currency', previewCurrencyOptions, { emptyLabel: 'Select target currency' })}
            </div>
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Optional context</summary>
              <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
                {renderPreviewSelect('action', 'Action', previewActionOptions, { emptyLabel: 'No action' })}
                {renderPreviewSelect('paymentMethodId', 'Payment method', paymentMethodOptions, {
                  emptyLabel: 'No payment method',
                  getValue: (item) => item.id,
                  getLabel: (item) => optionLabel(item, 'Payment method')
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

      {countryPopup && (
        <Modal title={countryPopup.title} onClose={() => setCountryPopup(null)}>
          <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '60vh', overflow: 'auto' }}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              {countryPopup.codes.length} {countryPopup.codes.length === 1 ? 'country' : 'countries'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
              {countryPopup.codes.map((code) => (
                <div key={code} style={{ padding: '0.55rem 0.65rem', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 700 }}>
                  {formatCountryLabel(code)}
                </div>
              ))}
            </div>
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
