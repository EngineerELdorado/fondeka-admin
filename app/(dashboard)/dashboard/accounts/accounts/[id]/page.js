'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import COUNTRIES from '@/data/countries';

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

const MultiSelect = ({ label, options, values, onChange, helperText }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
    <div style={{ fontWeight: 600 }}>{label}</div>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.35rem',
        maxHeight: '220px',
        overflow: 'auto',
        padding: '0.4rem',
        border: `1px solid var(--border)`,
        borderRadius: '10px',
        background: 'var(--panel, transparent)'
      }}
    >
      {options.map((option) => (
        <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '13px' }}>
          <input
            type="checkbox"
            checked={values.includes(option)}
            onChange={(e) => {
              const checked = e.target.checked;
              if (checked) {
                onChange([...values, option]);
              } else {
                onChange(values.filter((value) => value !== option));
              }
            }}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
    {helperText ? <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{helperText}</div> : null}
  </div>
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

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatJsonPreview = (value, maxLen = 120) => {
  if (value === null || value === undefined) return '—';
  let text = '';
  if (typeof value === 'string') {
    text = value;
  } else {
    try {
      text = JSON.stringify(value);
    } catch (err) {
      text = String(value);
    }
  }
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 3))}...`;
};

const formatJsonFull = (value) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
};

const fadeInStyle = (ready) => ({
  opacity: ready ? 1 : 0,
  transform: ready ? 'translateY(0px)' : 'translateY(6px)',
  transition: 'opacity 0.35s ease, transform 0.35s ease'
});

const createEmptyCardholderForm = () => ({
  firstName: '',
  lastName: '',
  phone: '',
  emailAddress: '',
  address: {
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    houseNo: ''
  },
  identity: {
    idType: '',
    bvn: '',
    idNumber: '',
    selfieImage: '',
    idImage: '',
    backIdImage: '',
    gender: '',
    countryIso2: ''
  }
});

const paymentMethodActionRuleOptions = [
  'FUND_WALLET',
  'WITHDRAW_FROM_WALLET',
  'REFUND_TO_WALLET',
  'BONUS',
  'MANUAL_ADJUSTMENT',
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
  'CARD_MAINTENANCE',
  'BUY_CRYPTO',
  'SELL_CRYPTO',
  'RECEIVE_CRYPTO',
  'SEND_CRYPTO',
  'SWAP_CRYPTO',
  'REQUEST_PAYMENT',
  'PAY_REQUEST',
  'SETTLEMENT',
  'E_SIM_PURCHASE',
  'E_SIM_TOPUP',
  'SEND_AIRTIME',
  'SEND_DATA_BUNDLES',
  'BUY_GIFT_CARD',
  'PAY_NETFLIX',
  'INTER_TRANSFER',
  'OTHER'
].sort();

const paymentMethodTypeRuleOptions = ['MOBILE_MONEY', 'CRYPTO', 'BALANCE', 'CREDIT', 'AIRTIME', 'BANK'];

const paymentMethodNameRuleOptions = [
  'MPESA_DRC',
  'AIRTEL_MONEY_DRC',
  'ORANGE_MONEY_DRC',
  'AFRIMONEY_DRC',
  'BTC',
  'ETH',
  'USDT',
  'OTHER_CRYPTOS',
  'FONDEKA',
  'BANK',
  'CARD',
  'APPLE_PAY_OR_GOOGLE_PAY',
  'PAYPAL',
  'EQUITY_DRC',
  'BTC_LIGHTENING',
  'VODACOM_DRC',
  'AIRTEL_DRC',
  'ORANGE_DRC',
  'AFRICELL_DRC',
  'STABLECOINS',
  'USDC',
  'BNB',
  'SOL',
  'EURC',
  'INT_EURO_BANK_ACCOUNT',
  'INT_USD_BANK_ACCOUNT',
  'FONDEKA_BALANCE',
  'PAY_LATER',
  'AIRTIME_TOPUP'
].sort();

const providerRoutingContextOptions = ['COLLECTION', 'PAYOUT'];
const providerRoutingFilterActionOptions = [''].concat(paymentMethodActionRuleOptions);
const createEmptyProviderRoutingForm = () => ({
  id: null,
  paymentMethodPaymentProviderId: '',
  action: '',
  context: '',
  rank: 1,
  active: true
});
const normalizeEnumValue = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
const { pushToast } = useToast();
const accountId = params?.id;

const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trustedDeviceOverride, setTrustedDeviceOverride] = useState(false);
  const [trustedDeviceSaving, setTrustedDeviceSaving] = useState(false);
  const [appVersionOverride, setAppVersionOverride] = useState('');
  const [appVersionSaving, setAppVersionSaving] = useState(false);
  const [appVersionError, setAppVersionError] = useState(null);
  const [appVersionInfo, setAppVersionInfo] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [notifications, setNotifications] = useState([]);
const [notificationsLoading, setNotificationsLoading] = useState(false);
const [notificationsError, setNotificationsError] = useState(null);
const [notificationsPage, setNotificationsPage] = useState(0);
const [notificationsSize, setNotificationsSize] = useState(5);
const [notificationsMeta, setNotificationsMeta] = useState({ totalElements: null, totalPages: null, size: null, number: null });
const [notificationBodyModal, setNotificationBodyModal] = useState(null);
const [notificationDataModal, setNotificationDataModal] = useState(null);
  const [customPricing, setCustomPricing] = useState(null);
  const [customPricingLoading, setCustomPricingLoading] = useState(false);
  const [customPricingMissing, setCustomPricingMissing] = useState(false);
  const [kycCap, setKycCap] = useState(null);
  const [kycCapLoading, setKycCapLoading] = useState(false);

  const [feeConfigs, setFeeConfigs] = useState([]);
  const [feeConfigsLoading, setFeeConfigsLoading] = useState(false);
  const [feeConfigsError, setFeeConfigsError] = useState(null);
  const [pmps, setPmps] = useState([]);
  const [countries, setCountries] = useState([]);
  const [countryCodeDraft, setCountryCodeDraft] = useState('');
  const [countrySaving, setCountrySaving] = useState(false);
  const [countryError, setCountryError] = useState(null);
  const [countryInfo, setCountryInfo] = useState(null);

  const [showPricingForm, setShowPricingForm] = useState(false);
  const [pricingExtraLoan, setPricingExtraLoan] = useState('');
  const [pricingMaxCollection, setPricingMaxCollection] = useState('');
  const [pricingMaxPayout, setPricingMaxPayout] = useState('');
  const [pricingNote, setPricingNote] = useState('');
  const [pricingError, setPricingError] = useState(null);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [showPricingRemove, setShowPricingRemove] = useState(false);
  const [pricingRemoving, setPricingRemoving] = useState(false);

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
  const [paymentMethodActionConfigs, setPaymentMethodActionConfigs] = useState([]);
  const [paymentMethodActionConfigsLoading, setPaymentMethodActionConfigsLoading] = useState(false);
  const [paymentMethodActionConfigsError, setPaymentMethodActionConfigsError] = useState(null);
  const [showPaymentMethodActionForm, setShowPaymentMethodActionForm] = useState(false);
  const [paymentMethodActionFormId, setPaymentMethodActionFormId] = useState(null);
  const [paymentMethodAction, setPaymentMethodAction] = useState('');
  const [paymentMethodCountryCode, setPaymentMethodCountryCode] = useState('');
  const [paymentMethodIncludeTypes, setPaymentMethodIncludeTypes] = useState([]);
  const [paymentMethodExcludeTypes, setPaymentMethodExcludeTypes] = useState([]);
  const [paymentMethodIncludeNames, setPaymentMethodIncludeNames] = useState([]);
  const [paymentMethodExcludeNames, setPaymentMethodExcludeNames] = useState([]);
  const [paymentMethodActive, setPaymentMethodActive] = useState(true);
  const [paymentMethodRank, setPaymentMethodRank] = useState(0);
  const [paymentMethodActionSaving, setPaymentMethodActionSaving] = useState(false);
  const [providerRoutingRows, setProviderRoutingRows] = useState([]);
  const [providerRoutingLoading, setProviderRoutingLoading] = useState(false);
  const [providerRoutingError, setProviderRoutingError] = useState(null);
  const [providerRoutingFilters, setProviderRoutingFilters] = useState({ active: '', action: '', context: '' });
  const [showProviderRoutingForm, setShowProviderRoutingForm] = useState(false);
  const [providerRoutingForm, setProviderRoutingForm] = useState(() => createEmptyProviderRoutingForm());
  const [providerRoutingSaving, setProviderRoutingSaving] = useState(false);
  const [cardProductCardProviders, setCardProductCardProviders] = useState([]);
  const [showCardPriceForm, setShowCardPriceForm] = useState(false);
  const [cardPrices, setCardPrices] = useState([]);
  const [cardPricesLoading, setCardPricesLoading] = useState(false);
  const [cardPricesError, setCardPricesError] = useState(null);
  const [cardPriceFormId, setCardPriceFormId] = useState(null);
  const [cardPriceCpcpId, setCardPriceCpcpId] = useState('');
  const [cardPriceAmount, setCardPriceAmount] = useState('');
  const [cardPriceSaving, setCardPriceSaving] = useState(false);
  const [loanProducts, setLoanProducts] = useState([]);
  const [loanRates, setLoanRates] = useState([]);
  const [loanRatesLoading, setLoanRatesLoading] = useState(false);
  const [loanRatesError, setLoanRatesError] = useState(null);
  const [showLoanRateForm, setShowLoanRateForm] = useState(false);
  const [loanRateFormId, setLoanRateFormId] = useState(null);
  const [loanRateProductId, setLoanRateProductId] = useState('');
  const [loanRateInterest, setLoanRateInterest] = useState('');
  const [loanRateSaving, setLoanRateSaving] = useState(false);
  const [cryptoProducts, setCryptoProducts] = useState([]);
  const [cryptoRates, setCryptoRates] = useState([]);
  const [cryptoRatesLoading, setCryptoRatesLoading] = useState(false);
  const [cryptoRatesError, setCryptoRatesError] = useState(null);
  const [showCryptoRateForm, setShowCryptoRateForm] = useState(false);
  const [cryptoRateFormId, setCryptoRateFormId] = useState(null);
  const [cryptoRateProductId, setCryptoRateProductId] = useState('');
  const [cryptoRateAsk, setCryptoRateAsk] = useState('');
  const [cryptoRateBid, setCryptoRateBid] = useState('');
  const [cryptoRateSaving, setCryptoRateSaving] = useState(false);
  const [cryptoNetworks, setCryptoNetworks] = useState([]);
  const [cryptoLimits, setCryptoLimits] = useState([]);
  const [cryptoLimitsLoading, setCryptoLimitsLoading] = useState(false);
  const [cryptoLimitsError, setCryptoLimitsError] = useState(null);
  const [showCryptoLimitForm, setShowCryptoLimitForm] = useState(false);
  const [cryptoLimitFormId, setCryptoLimitFormId] = useState(null);
  const [cryptoLimitNetworkId, setCryptoLimitNetworkId] = useState('');
  const [cryptoLimitBuy, setCryptoLimitBuy] = useState('');
  const [cryptoLimitSell, setCryptoLimitSell] = useState('');
const [cryptoLimitSend, setCryptoLimitSend] = useState('');
const [cryptoLimitReceive, setCryptoLimitReceive] = useState('');
const [cryptoLimitSwap, setCryptoLimitSwap] = useState('');
const [cryptoLimitSaving, setCryptoLimitSaving] = useState(false);
const [confirmPrompt, setConfirmPrompt] = useState(null);
const [confirmLoading, setConfirmLoading] = useState(false);
const [confirmError, setConfirmError] = useState('');
const [showCardholderSync, setShowCardholderSync] = useState(false);
const [cardholderForm, setCardholderForm] = useState(() => createEmptyCardholderForm());
const [cardholderError, setCardholderError] = useState(null);
const [cardholderSaving, setCardholderSaving] = useState(false);
const [cardholderResult, setCardholderResult] = useState(null);

  useEffect(() => {
    const nextCode = account?.country?.alpha2Code || account?.countryCode || '';
    setCountryCodeDraft(nextCode || '');
  }, [account?.country?.alpha2Code, account?.countryCode]);
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
const [debitResult, setDebitResult] = useState(null);
const [showCryptoCredit, setShowCryptoCredit] = useState(false);
const [cryptoCreditWallet, setCryptoCreditWallet] = useState(null);
const [cryptoCreditAmount, setCryptoCreditAmount] = useState('');
const [cryptoCreditNote, setCryptoCreditNote] = useState('');
const [cryptoCreditAction, setCryptoCreditAction] = useState('MANUAL_ADJUSTMENT');
const [cryptoCreditError, setCryptoCreditError] = useState(null);
const [cryptoCreditLoading, setCryptoCreditLoading] = useState(false);
const [showNotification, setShowNotification] = useState(false);
const [notificationSubject, setNotificationSubject] = useState('');
const [notificationMessage, setNotificationMessage] = useState('');
const [notificationChannels, setNotificationChannels] = useState(['PUSH']);
const [notificationError, setNotificationError] = useState(null);
const [notificationLoading, setNotificationLoading] = useState(false);
const [notificationResult, setNotificationResult] = useState(null);
const [loanEligibility, setLoanEligibility] = useState(null);
const [loanEligibilityLoading, setLoanEligibilityLoading] = useState(false);
const [loanEligibilityError, setLoanEligibilityError] = useState(null);

  const paymentMethodTypeConflicts = useMemo(
    () => paymentMethodIncludeTypes.filter((type) => paymentMethodExcludeTypes.includes(type)),
    [paymentMethodIncludeTypes, paymentMethodExcludeTypes]
  );
  const paymentMethodNameConflicts = useMemo(
    () => paymentMethodIncludeNames.filter((name) => paymentMethodExcludeNames.includes(name)),
    [paymentMethodIncludeNames, paymentMethodExcludeNames]
  );
  const paymentMethodCountryCodeValid = useMemo(
    () => !paymentMethodCountryCode || /^[A-Z]{2,4}$/.test(paymentMethodCountryCode),
    [paymentMethodCountryCode]
  );
  const canSavePaymentMethodRule = paymentMethodTypeConflicts.length === 0 && paymentMethodNameConflicts.length === 0 && paymentMethodCountryCodeValid;
  const providerRoutingFormAction = normalizeEnumValue(providerRoutingForm.action);
  const providerRoutingFormContext = normalizeEnumValue(providerRoutingForm.context);
  const providerRoutingActionContextWarning = Boolean(providerRoutingFormAction && providerRoutingFormContext);
  const providerRoutingFilteredRows = useMemo(() => {
    return providerRoutingRows.filter((row) => {
      if (providerRoutingFilters.active !== '') {
        if (String(Boolean(row?.active)) !== providerRoutingFilters.active) return false;
      }
      const actionFilter = normalizeEnumValue(providerRoutingFilters.action);
      if (actionFilter && normalizeEnumValue(row?.action) !== actionFilter) return false;
      const contextFilter = normalizeEnumValue(providerRoutingFilters.context);
      if (contextFilter && normalizeEnumValue(row?.context) !== contextFilter) return false;
      return true;
    });
  }, [providerRoutingRows, providerRoutingFilters]);

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

  const loadAccount = async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const acc = await api.accounts.get(accountId);
      setAccount(acc || null);
      const targetId = acc?.id ?? (Number.isFinite(Number(accountId)) ? Number(accountId) : null);
      if (acc?.accountReference) {
        const txParams = new URLSearchParams({ page: '0', size: '1', accountReference: String(acc.accountReference) });
        const txRes = await api.transactions.list(txParams);
        const list = Array.isArray(txRes) ? txRes : txRes?.content || [];
        setTransactions(list || []);
      }
      await loadCustomPricing(targetId);
      await loadLoanEligibility(targetId);
      await loadKycCap(acc?.kycLevel);
      await loadFeeConfigs(targetId);
      await loadPaymentMethodActionConfigs(targetId);
      await loadProviderRouting(targetId);
      await loadCardPrices(targetId);
      await loadLoanRates(targetId);
      await loadCryptoRates(targetId);
      await loadCryptoLimits(targetId);
    } catch (err) {
      setError(err.message || 'Failed to load account');
      pushToast({ tone: 'error', message: err.message || 'Failed to load account' });
    } finally {
      setLoading(false);
    }
  };

  const saveAccountCountry = async () => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) return;
    const trimmed = String(countryCodeDraft || '').trim().toUpperCase();
    if (!trimmed) {
      setCountryError('Country code is required.');
      return;
    }
    setCountryError(null);
    setCountryInfo(null);
    setCountrySaving(true);
    try {
      const res = await api.accounts.updateCountry(resolvedAccountId, { countryCode: trimmed });
      setAccount(res || null);
      setCountryInfo(`Country updated to ${trimmed}.`);
      pushToast({ tone: 'success', message: `Account country updated to ${trimmed}.` });
    } catch (err) {
      const message = err.message || 'Failed to update account country';
      setCountryError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setCountrySaving(false);
    }
  };

  const loadCustomPricing = async (id) => {
    if (!id && id !== 0) return;
    setCustomPricingLoading(true);
    setPricingError(null);
    try {
      const res = await api.accounts.getCustomPricing(id);
      setCustomPricing(res || null);
      setCustomPricingMissing(!res);
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

  const loadFeeConfigs = async (id) => {
    if (!id && id !== 0) return;
    setFeeConfigsLoading(true);
    setFeeConfigsError(null);
    try {
      const res = await api.accounts.feeConfigs.list(id);
      const list = Array.isArray(res) ? res : res?.content || [];
      setFeeConfigs(list || []);
    } catch (err) {
      setFeeConfigs([]);
      setFeeConfigsError(err.message || 'Failed to load fee overrides');
    } finally {
      setFeeConfigsLoading(false);
    }
  };

  const loadPaymentMethodActionConfigs = async (id) => {
    if (!id && id !== 0) return;
    setPaymentMethodActionConfigsLoading(true);
    setPaymentMethodActionConfigsError(null);
    try {
      const params = new URLSearchParams({ accountId: String(id), page: '0', size: '200' });
      const res = await api.paymentMethodActionConfigs.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setPaymentMethodActionConfigs(list || []);
    } catch (err) {
      setPaymentMethodActionConfigs([]);
      setPaymentMethodActionConfigsError(err.message || 'Failed to load payment method rules');
    } finally {
      setPaymentMethodActionConfigsLoading(false);
    }
  };

  const loadProviderRouting = async (id) => {
    if (!id && id !== 0) return;
    setProviderRoutingLoading(true);
    setProviderRoutingError(null);
    try {
      const res = await api.accounts.providerRouting.list(id);
      const list = Array.isArray(res) ? res : res?.content || [];
      setProviderRoutingRows(list || []);
    } catch (err) {
      setProviderRoutingRows([]);
      setProviderRoutingError(err.message || 'Failed to load provider routing overrides');
    } finally {
      setProviderRoutingLoading(false);
    }
  };

  const loadLoanRates = async (id) => {
    if (!id && id !== 0) return;
    setLoanRatesLoading(true);
    setLoanRatesError(null);
    try {
      const res = await api.accounts.loanRates.list(id);
      const list = Array.isArray(res) ? res : res?.content || [];
      setLoanRates(list || []);
    } catch (err) {
      setLoanRates([]);
      setLoanRatesError(err.message || 'Failed to load loan rate overrides');
    } finally {
      setLoanRatesLoading(false);
    }
  };

  const loadCryptoRates = async (id) => {
    if (!id && id !== 0) return;
    setCryptoRatesLoading(true);
    setCryptoRatesError(null);
    try {
      const res = await api.accounts.cryptoRates.list(id);
      const list = Array.isArray(res) ? res : res?.content || [];
      setCryptoRates(list || []);
    } catch (err) {
      setCryptoRates([]);
      setCryptoRatesError(err.message || 'Failed to load crypto rate overrides');
    } finally {
      setCryptoRatesLoading(false);
    }
  };

  const loadCryptoLimits = async (id) => {
    if (!id && id !== 0) return;
    setCryptoLimitsLoading(true);
    setCryptoLimitsError(null);
    try {
      const res = await api.accounts.cryptoLimits.list(id);
      const list = Array.isArray(res) ? res : res?.content || [];
      setCryptoLimits(list || []);
    } catch (err) {
      setCryptoLimits([]);
      setCryptoLimitsError(err.message || 'Failed to load crypto limits');
    } finally {
      setCryptoLimitsLoading(false);
    }
  };

  const loadCardPrices = async (id) => {
    if (!id && id !== 0) return;
    setCardPricesLoading(true);
    setCardPricesError(null);
    try {
      const res = await api.accounts.cardPrices.list(id);
      const list = Array.isArray(res) ? res : res?.content || [];
      setCardPrices(list || []);
    } catch (err) {
      setCardPrices([]);
      setCardPricesError(err.message || 'Failed to load card price overrides');
    } finally {
      setCardPricesLoading(false);
    }
  };

  const loadNotifications = async (id) => {
    if (!id && id !== 0) return;
    const targetPage = Number.isFinite(Number(notificationsPage)) ? Number(notificationsPage) : 0;
    const rawSize = Number(notificationsSize);
    const targetSize = Number.isFinite(rawSize) ? Math.min(50, Math.max(1, rawSize)) : 5;
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const params = new URLSearchParams({ page: String(targetPage), size: String(targetSize) });
      const res = await api.accounts.notifications.list(id, params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setNotifications(list || []);
      setNotificationsMeta({
        totalElements: res?.totalElements ?? null,
        totalPages: res?.totalPages ?? null,
        size: res?.size ?? targetSize,
        number: res?.number ?? targetPage
      });
    } catch (err) {
      setNotifications([]);
      setNotificationsMeta({ totalElements: null, totalPages: null, size: targetSize, number: targetPage });
      setNotificationsError(err.message || 'Failed to load notifications');
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    loadAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    setNotificationsPage(0);
  }, [accountId]);

  useEffect(() => {
    if (account?.enforceTrustedDevice === undefined) return;
    setTrustedDeviceOverride(Boolean(account.enforceTrustedDevice));
  }, [account?.enforceTrustedDevice]);

  useEffect(() => {
    setAppVersionOverride(account?.customAppVersion ?? '');
  }, [account?.customAppVersion]);

  const updateCardholderField = (field, value) => {
    setCardholderForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateCardholderAddress = (field, value) => {
    setCardholderForm((prev) => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
  };

  const updateCardholderIdentity = (field, value) => {
    setCardholderForm((prev) => ({
      ...prev,
      identity: { ...prev.identity, [field]: value }
    }));
  };

  const openCardholderSync = () => {
    setCardholderForm(createEmptyCardholderForm());
    setCardholderError(null);
    setCardholderResult(null);
    setShowCardholderSync(true);
  };

  const openCredit = () => {
    setCreditAmount('');
    setCreditNote('');
    setCreditError(null);
    setShowCredit(true);
  };

  const openDebit = () => {
    setDebitAmount('');
    setDebitNote('');
    setDebitAction('MANUAL_ADJUSTMENT');
    setDebitError(null);
    setDebitResult(null);
    setShowDebit(true);
  };

  const openCryptoCredit = (wallet) => {
    setCryptoCreditWallet(wallet || null);
    setCryptoCreditAmount('');
    setCryptoCreditNote('');
    setCryptoCreditAction('MANUAL_ADJUSTMENT');
    setCryptoCreditError(null);
    setShowCryptoCredit(true);
  };

  const openNotification = () => {
    setNotificationSubject('');
    setNotificationMessage('');
    setNotificationChannels(['PUSH']);
    setNotificationError(null);
    setNotificationResult(null);
    setShowNotification(true);
  };

  const submitCardholderSync = async () => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      setCardholderError('No account loaded');
      return;
    }

    const firstName = cardholderForm.firstName.trim();
    const lastName = cardholderForm.lastName.trim();
    const phone = cardholderForm.phone.trim();
    const emailAddress = cardholderForm.emailAddress.trim();
    const address = {
      address: cardholderForm.address.address.trim(),
      city: cardholderForm.address.city.trim(),
      state: cardholderForm.address.state.trim(),
      country: cardholderForm.address.country.trim(),
      postalCode: cardholderForm.address.postalCode.trim(),
      houseNo: cardholderForm.address.houseNo.trim()
    };
    const identity = {
      idType: cardholderForm.identity.idType.trim(),
      bvn: cardholderForm.identity.bvn.trim(),
      idNumber: cardholderForm.identity.idNumber.trim(),
      selfieImage: cardholderForm.identity.selfieImage.trim(),
      idImage: cardholderForm.identity.idImage.trim(),
      backIdImage: cardholderForm.identity.backIdImage.trim(),
      gender: cardholderForm.identity.gender.trim(),
      countryIso2: cardholderForm.identity.countryIso2.trim()
    };

    if (!firstName) {
      setCardholderError('First name is required');
      return;
    }
    if (!lastName) {
      setCardholderError('Last name is required');
      return;
    }
    if (!phone) {
      setCardholderError('Phone is required');
      return;
    }
    if (!emailAddress) {
      setCardholderError('Email is required');
      return;
    }
    if (!address.address || !address.city || !address.state || !address.country) {
      setCardholderError('Address, city, state, and country are required');
      return;
    }
    if (!identity.idType) {
      setCardholderError('ID type is required');
      return;
    }
    if (!identity.selfieImage) {
      setCardholderError('Selfie image URL is required');
      return;
    }
    if (!identity.idNumber && !identity.bvn) {
      setCardholderError('Provide either an ID number or BVN');
      return;
    }

    setCardholderSaving(true);
    setCardholderError(null);
    setCardholderResult(null);
    try {
      const payload = {
        accountId: resolvedAccountId,
        firstName,
        lastName,
        phone,
        emailAddress,
        address: {
          address: address.address,
          city: address.city,
          state: address.state,
          country: address.country,
          ...(address.postalCode ? { postalCode: address.postalCode } : {}),
          ...(address.houseNo ? { houseNo: address.houseNo } : {})
        },
        identity: {
          idType: identity.idType,
          ...(identity.bvn ? { bvn: identity.bvn } : {}),
          ...(identity.idNumber ? { idNumber: identity.idNumber } : {}),
          ...(identity.gender ? { gender: identity.gender } : {}),
          ...(identity.countryIso2 ? { countryIso2: identity.countryIso2 } : {}),
          selfieImage: identity.selfieImage,
          ...(identity.idImage ? { idImage: identity.idImage } : {}),
          ...(identity.backIdImage ? { backIdImage: identity.backIdImage } : {})
        }
      };
      const res = await api.cardHolders.registerSync(payload);
      setCardholderResult(res || null);
      pushToast({
        tone: 'success',
        message: res?.externalReference ? `Cardholder created (ref ${res.externalReference})` : 'Cardholder created'
      });
    } catch (err) {
      const message = err?.name === 'AbortError'
        ? 'Request timed out. This call can take up to 45 seconds.'
        : err.message || 'Failed to create cardholder';
      setCardholderError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setCardholderSaving(false);
    }
  };

  const saveTrustedDeviceOverride = async () => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      pushToast({ tone: 'error', message: 'No account loaded' });
      return;
    }
    setTrustedDeviceSaving(true);
    setError(null);
    try {
      const res = await api.accounts.update(resolvedAccountId, { enforceTrustedDevice: trustedDeviceOverride });
      const nextValue = res?.enforceTrustedDevice ?? trustedDeviceOverride;
      setAccount((prev) => (prev ? { ...prev, enforceTrustedDevice: Boolean(nextValue) } : prev));
      pushToast({
        tone: 'success',
        message: `Trusted device override ${nextValue ? 'enabled' : 'disabled'}`
      });
    } catch (err) {
      const message = err.message || 'Failed to update trusted device override';
      setError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setTrustedDeviceSaving(false);
    }
  };

  const saveAppVersionOverride = async (nextValue) => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      pushToast({ tone: 'error', message: 'No account loaded' });
      return;
    }
    const rawValue = typeof nextValue === 'string' ? nextValue : appVersionOverride;
    const trimmed = rawValue.trim();
    setAppVersionSaving(true);
    setAppVersionError(null);
    setAppVersionInfo(null);
    try {
      await api.accounts.setAppVersionOverride(resolvedAccountId, { appVersion: trimmed ? trimmed : null });
      const refreshed = await api.accounts.get(resolvedAccountId);
      setAccount(refreshed || null);
      setAppVersionInfo(trimmed ? `Override set to ${trimmed}.` : 'Override cleared; using global version.');
      pushToast({
        tone: 'success',
        message: trimmed ? `App version override set to ${trimmed}` : 'App version override cleared'
      });
    } catch (err) {
      const message = err.message || 'Failed to update app version override';
      setAppVersionError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setAppVersionSaving(false);
    }
  };

  const submitCredit = async () => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      setCreditError('No account loaded');
      return;
    }
    const amountNum = Number(creditAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setCreditError('Amount must be greater than 0');
      return;
    }
    setCreditLoading(true);
    setCreditError(null);
    try {
      const payload = {
        amount: amountNum,
        ...(creditAction ? { action: creditAction } : {}),
        ...(creditNote?.trim() ? { note: creditNote.trim() } : {})
      };
      const res = await api.accounts.creditWallet(resolvedAccountId, payload);
      const actionLabel = creditAction === 'BONUS' ? 'Bonus' : 'Manual adjustment';
      pushToast({
        tone: 'success',
        message: `Wallet credited (${actionLabel}): ${res?.amount ?? amountNum}${res?.reference ? ` (ref ${res.reference})` : ''}`
      });
      setShowCredit(false);
      setCreditAmount('');
      setCreditNote('');
      setCreditAction('MANUAL_ADJUSTMENT');
      await loadAccount();
    } catch (err) {
      const message = err.message || 'Failed to credit account';
      setCreditError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setCreditLoading(false);
    }
  };

  const submitDebit = async () => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      setDebitError('No account loaded');
      return;
    }
    const amountNum = Number(debitAmount);
    if (!Number.isFinite(amountNum) || amountNum < 0.01) {
      setDebitError('Amount must be at least 0.01');
      return;
    }
    const confirmed = window.confirm("This will debit the user's wallet. This action is irreversible.");
    if (!confirmed) return;

    setDebitLoading(true);
    setDebitError(null);
    try {
      const payload = {
        amount: amountNum,
        ...(debitAction ? { action: debitAction } : {}),
        ...(debitNote?.trim() ? { note: debitNote.trim() } : {})
      };
      const res = await api.accounts.debitWallet(resolvedAccountId, payload);
      const actionLabel = debitAction === 'WITHDRAW_FROM_WALLET' ? 'Withdraw from wallet' : 'Manual adjustment';
      setDebitResult(res || null);
      pushToast({
        tone: 'success',
        message: `Wallet debited (${actionLabel}): ${res?.amount ?? amountNum}${res?.reference ? ` (ref ${res.reference})` : ''}`
      });
      await loadAccount();
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

  const submitCryptoCredit = async () => {
    if (!cryptoCreditWallet?.id) {
      setCryptoCreditError('No crypto wallet selected');
      return;
    }
    const rawAmount = String(cryptoCreditAmount).trim();
    const amountNum = Number(rawAmount);
    if (!rawAmount || !Number.isFinite(amountNum) || amountNum <= 0) {
      setCryptoCreditError('Amount must be greater than 0');
      return;
    }
    setCryptoCreditLoading(true);
    setCryptoCreditError(null);
    try {
      const payload = {
        amount: rawAmount,
        ...(cryptoCreditAction ? { action: cryptoCreditAction } : {}),
        ...(cryptoCreditNote?.trim() ? { note: cryptoCreditNote.trim() } : {})
      };
      const res = await api.cryptoWallets.credit(cryptoCreditWallet.id, payload);
      const amountLabel = res?.cryptoAmount ?? rawAmount;
      const currencyLabel = res?.cryptoCurrency || cryptoCreditWallet?.currency || '';
      const statusLabel = res?.status ? ` • ${res.status}` : '';
      const refLabel = res?.reference ? ` (ref ${res.reference})` : '';
      pushToast({
        tone: 'success',
        message: `Crypto wallet credited: ${amountLabel} ${currencyLabel}${refLabel}${statusLabel}`
      });
      setShowCryptoCredit(false);
      setCryptoCreditWallet(null);
      setCryptoCreditAmount('');
      setCryptoCreditNote('');
      setCryptoCreditAction('MANUAL_ADJUSTMENT');
      await loadAccount();
    } catch (err) {
      const message = err.message || 'Failed to credit crypto wallet';
      setCryptoCreditError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setCryptoCreditLoading(false);
    }
  };

  const submitNotification = async () => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      setNotificationError('No account loaded');
      return;
    }
    const subject = notificationSubject.trim();
    const messageText = notificationMessage.trim();
    if (!subject || !messageText) {
      setNotificationError('Subject and message are required');
      return;
    }
    const selectedChannels = Array.from(new Set(notificationChannels));
    if (selectedChannels.length === 0) {
      setNotificationError('Select at least one channel');
      return;
    }
    setNotificationLoading(true);
    setNotificationError(null);
    try {
      const res = await api.notifications.pushTest({
        accountId: resolvedAccountId,
        subject,
        message: messageText,
        channels: selectedChannels
      });
      if (res?.attempted) {
        pushToast({ tone: 'success', message: 'Notification sent' });
        setNotificationResult(res);
      } else {
        const reason = res?.reason || 'Notification not attempted';
        setNotificationError(reason);
        pushToast({ tone: 'error', message: reason });
        setNotificationResult(res);
      }
    } catch (err) {
      const message = err.message || 'Failed to send notification';
      setNotificationError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setNotificationLoading(false);
    }
  };

  const loadLoanEligibility = async (id) => {
    if (id === null || id === undefined) return;
    setLoanEligibilityLoading(true);
    setLoanEligibilityError(null);
    try {
      const res = await api.accounts.getLoanEligibility(id);
      setLoanEligibility(res || null);
    } catch (err) {
      setLoanEligibility(null);
      setLoanEligibilityError(err.message || 'Failed to load loan eligibility');
    } finally {
      setLoanEligibilityLoading(false);
    }
  };

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [pmpRes, countryRes, cardProductProvidersRes, loanProductsRes, cryptoProductsRes, cryptoNetworksRes] = await Promise.all([
          api.paymentMethodPaymentProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.countries.list(new URLSearchParams({ page: '0', size: '200' })),
          api.cardProductCardProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.loanProducts.list(new URLSearchParams({ page: '0', size: '200' })),
          api.cryptoProducts.list(new URLSearchParams({ page: '0', size: '200' })),
          api.cryptoProductCryptoNetworks.list(new URLSearchParams({ page: '0', size: '200' }))
        ]);
        const toList = (res) => (Array.isArray(res) ? res : res?.content || []);
        setPmps(toList(pmpRes));
        setCountries(toList(countryRes));
        setCardProductCardProviders(toList(cardProductProvidersRes));
        setLoanProducts(toList(loanProductsRes));
        setCryptoProducts(toList(cryptoProductsRes));
        setCryptoNetworks(toList(cryptoNetworksRes));
      } catch {
        // ignore
      }
    };
    fetchOptions();
  }, []);

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
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      setPricingError('No account loaded');
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
      await api.accounts.updateCustomPricing(resolvedAccountId, payload);
      pushToast({ tone: 'success', message: 'Custom KYC caps saved' });
      setShowPricingForm(false);
      await loadCustomPricing(resolvedAccountId);
      await loadAccount();
    } catch (err) {
      const message = err.message || 'Failed to save custom KYC caps';
      setPricingError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setPricingSaving(false);
    }
  };

  const removePricing = async () => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) return;
    setPricingRemoving(true);
    setPricingError(null);
    try {
      await api.accounts.removeCustomPricing(resolvedAccountId);
      pushToast({ tone: 'success', message: 'Custom KYC caps removed' });
      setShowPricingRemove(false);
      setCustomPricing(null);
      setCustomPricingMissing(true);
      await loadAccount();
    } catch (err) {
      const message = err.message || 'Failed to remove custom KYC caps';
      setPricingError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setPricingRemoving(false);
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
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      setFeeConfigsError('No account loaded');
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
        await api.accounts.feeConfigs.update(resolvedAccountId, feeFormId, payload);
        pushToast({ tone: 'success', message: 'Fee override updated' });
      } else {
        await api.accounts.feeConfigs.create(resolvedAccountId, payload);
        pushToast({ tone: 'success', message: 'Fee override added' });
      }
      resetFeeForm();
      setShowFeeForm(false);
      await loadFeeConfigs(resolvedAccountId);
    } catch (err) {
      const message = err.message || 'Failed to save fee override';
      setFeeConfigsError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setFeeSaving(false);
    }
  };

  const deleteFee = (fee) => {
    if (resolvedAccountId === null || resolvedAccountId === undefined || !fee?.id) return;
    openConfirm({
      title: 'Delete fee override',
      message: `Delete fee override ${fee.action} (${fee.id})?`,
      onConfirm: async () => {
        setFeeConfigsError(null);
        try {
          await api.accounts.feeConfigs.remove(resolvedAccountId, fee.id);
          pushToast({ tone: 'success', message: 'Fee override deleted' });
          await loadFeeConfigs(resolvedAccountId);
        } catch (err) {
          const message = err.message || 'Failed to delete fee override';
          setFeeConfigsError(message);
          pushToast({ tone: 'error', message });
          throw err;
        }
      }
    });
  };

  const openPaymentMethodActionForm = (rule) => {
    setPaymentMethodActionConfigsError(null);
    setPaymentMethodActionFormId(rule?.id || null);
    setPaymentMethodAction(rule?.action || '');
    setPaymentMethodCountryCode(rule?.countryCode || '');
    setPaymentMethodIncludeTypes(Array.isArray(rule?.includeTypes) ? rule.includeTypes : []);
    setPaymentMethodExcludeTypes(Array.isArray(rule?.excludeTypes) ? rule.excludeTypes : []);
    setPaymentMethodIncludeNames(Array.isArray(rule?.includeNames) ? rule.includeNames : []);
    setPaymentMethodExcludeNames(Array.isArray(rule?.excludeNames) ? rule.excludeNames : []);
    setPaymentMethodActive(Boolean(rule?.active ?? true));
    setPaymentMethodRank(rule?.rank ?? 0);
    setShowPaymentMethodActionForm(true);
  };

  const resetPaymentMethodActionForm = () => {
    setPaymentMethodActionFormId(null);
    setPaymentMethodAction('');
    setPaymentMethodCountryCode('');
    setPaymentMethodIncludeTypes([]);
    setPaymentMethodExcludeTypes([]);
    setPaymentMethodIncludeNames([]);
    setPaymentMethodExcludeNames([]);
    setPaymentMethodActive(true);
    setPaymentMethodRank(0);
  };

  const submitPaymentMethodActionForm = async () => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      setPaymentMethodActionConfigsError('No account loaded');
      return;
    }
    if (!canSavePaymentMethodRule) {
      setPaymentMethodActionConfigsError('Resolve include/exclude conflicts before saving');
      return;
    }
    setPaymentMethodActionSaving(true);
    setPaymentMethodActionConfigsError(null);
    const payload = {
      accountId: resolvedAccountId,
      action: paymentMethodAction || null,
      countryCode: paymentMethodCountryCode ? paymentMethodCountryCode.toUpperCase() : null,
      includeTypes: paymentMethodIncludeTypes.length ? paymentMethodIncludeTypes : null,
      excludeTypes: paymentMethodExcludeTypes.length ? paymentMethodExcludeTypes : null,
      includeNames: paymentMethodIncludeNames.length ? paymentMethodIncludeNames : null,
      excludeNames: paymentMethodExcludeNames.length ? paymentMethodExcludeNames : null,
      active: Boolean(paymentMethodActive),
      rank: paymentMethodRank === '' ? 0 : Number(paymentMethodRank)
    };
    try {
      if (paymentMethodActionFormId) {
        await api.paymentMethodActionConfigs.update(paymentMethodActionFormId, payload);
        pushToast({ tone: 'success', message: 'Payment method rule updated' });
      } else {
        await api.paymentMethodActionConfigs.create(payload);
        pushToast({ tone: 'success', message: 'Payment method rule added' });
      }
      resetPaymentMethodActionForm();
      setShowPaymentMethodActionForm(false);
      await loadPaymentMethodActionConfigs(resolvedAccountId);
    } catch (err) {
      const message = err.message || 'Failed to save payment method rule';
      setPaymentMethodActionConfigsError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setPaymentMethodActionSaving(false);
    }
  };

  const deletePaymentMethodActionRule = (rule) => {
    if (resolvedAccountId === null || resolvedAccountId === undefined || !rule?.id) return;
    openConfirm({
      title: 'Delete payment method rule',
      message: `Delete payment method rule ${rule.id}?`,
      onConfirm: async () => {
        setPaymentMethodActionConfigsError(null);
        try {
          await api.paymentMethodActionConfigs.remove(rule.id);
          pushToast({ tone: 'success', message: 'Payment method rule deleted' });
          await loadPaymentMethodActionConfigs(resolvedAccountId);
        } catch (err) {
          const message = err.message || 'Failed to delete payment method rule';
          setPaymentMethodActionConfigsError(message);
          pushToast({ tone: 'error', message });
          throw err;
        }
      }
    });
  };

  const getPmpLabel = (paymentMethodPaymentProviderId) => {
    if (!paymentMethodPaymentProviderId && paymentMethodPaymentProviderId !== 0) return '—';
    const match = pmps.find((p) => String(p.id) === String(paymentMethodPaymentProviderId));
    if (!match) return `PMPP #${paymentMethodPaymentProviderId}`;
    const method = match.paymentMethodName || match.paymentMethodDisplayName || 'Method';
    const provider = match.paymentProviderName || 'Provider';
    return `${method} -> ${provider}`;
  };

  const openProviderRoutingForm = (row = null) => {
    setProviderRoutingError(null);
    if (!row) {
      setProviderRoutingForm(createEmptyProviderRoutingForm());
    } else {
      setProviderRoutingForm({
        id: row.id || null,
        paymentMethodPaymentProviderId: row.paymentMethodPaymentProviderId ?? '',
        action: row.action || '',
        context: row.context || '',
        rank: row.rank ?? 1,
        active: Boolean(row.active ?? true)
      });
    }
    setShowProviderRoutingForm(true);
  };

  const resetProviderRoutingForm = () => {
    setProviderRoutingForm(createEmptyProviderRoutingForm());
  };

  const submitProviderRoutingForm = async () => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      setProviderRoutingError('No account loaded');
      return;
    }
    if (!providerRoutingForm.paymentMethodPaymentProviderId && providerRoutingForm.paymentMethodPaymentProviderId !== 0) {
      setProviderRoutingError('Payment method/provider is required');
      return;
    }
    const rankNum = Number(providerRoutingForm.rank);
    if (!Number.isFinite(rankNum)) {
      setProviderRoutingError('Rank must be a number');
      return;
    }

    setProviderRoutingSaving(true);
    setProviderRoutingError(null);
    const payload = {
      paymentMethodPaymentProviderId: Number(providerRoutingForm.paymentMethodPaymentProviderId),
      action: providerRoutingFormAction || null,
      context: providerRoutingFormContext || null,
      rank: rankNum,
      active: Boolean(providerRoutingForm.active)
    };
    try {
      if (providerRoutingForm.id) {
        await api.accounts.providerRouting.update(resolvedAccountId, providerRoutingForm.id, payload);
        pushToast({ tone: 'success', message: 'Provider routing override updated' });
      } else {
        await api.accounts.providerRouting.create(resolvedAccountId, payload);
        pushToast({ tone: 'success', message: 'Provider routing override created' });
      }
      resetProviderRoutingForm();
      setShowProviderRoutingForm(false);
      await loadProviderRouting(resolvedAccountId);
    } catch (err) {
      const message = err.message || 'Failed to save provider routing override';
      setProviderRoutingError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setProviderRoutingSaving(false);
    }
  };

  const disableProviderRouting = (row) => {
    if (resolvedAccountId === null || resolvedAccountId === undefined || !row?.id) return;
    openConfirm({
      title: 'Disable provider routing override',
      message: `Disable provider routing override ${row.id}?`,
      onConfirm: async () => {
        setProviderRoutingError(null);
        const payload = {
          paymentMethodPaymentProviderId: Number(row.paymentMethodPaymentProviderId),
          action: normalizeEnumValue(row.action) || null,
          context: normalizeEnumValue(row.context) || null,
          rank: Number(row.rank ?? 1),
          active: false
        };
        try {
          await api.accounts.providerRouting.update(resolvedAccountId, row.id, payload);
          pushToast({ tone: 'success', message: 'Provider routing override disabled' });
          await loadProviderRouting(resolvedAccountId);
        } catch (err) {
          const message = err.message || 'Failed to disable provider routing override';
          setProviderRoutingError(message);
          pushToast({ tone: 'error', message });
          throw err;
        }
      }
    });
  };

  const deleteProviderRouting = (row) => {
    if (resolvedAccountId === null || resolvedAccountId === undefined || !row?.id) return;
    openConfirm({
      title: 'Delete provider routing override',
      message: `Delete provider routing override ${row.id}?`,
      onConfirm: async () => {
        setProviderRoutingError(null);
        try {
          await api.accounts.providerRouting.remove(resolvedAccountId, row.id);
          pushToast({ tone: 'success', message: 'Provider routing override deleted' });
          await loadProviderRouting(resolvedAccountId);
        } catch (err) {
          const message = err.message || 'Failed to delete provider routing override';
          setProviderRoutingError(message);
          pushToast({ tone: 'error', message });
          throw err;
        }
      }
    });
  };

  const openCardPriceForm = (override) => {
    setCardPricesError(null);
    setCardPriceFormId(override?.id || null);
    setCardPriceCpcpId(override?.cardProductCardProviderId ?? '');
    setCardPriceAmount(override?.price ?? '');
    setShowCardPriceForm(true);
  };

  const openLoanRateForm = (override) => {
    setLoanRatesError(null);
    setLoanRateFormId(override?.id || null);
    setLoanRateProductId(override?.loanProductId ?? '');
    setLoanRateInterest(override?.interestPercentage ?? '');
    setShowLoanRateForm(true);
  };

  const resetLoanRateForm = () => {
    setLoanRateFormId(null);
    setLoanRateProductId('');
    setLoanRateInterest('');
  };

  const submitLoanRateForm = async () => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      setLoanRatesError('No account loaded');
      return;
    }
    if (!loanRateProductId) {
      setLoanRatesError('Loan product is required');
      return;
    }
    const rateNum = Number(loanRateInterest);
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      setLoanRatesError('Interest must be 0 or greater');
      return;
    }
    setLoanRateSaving(true);
    setLoanRatesError(null);
    const payload = { loanProductId: Number(loanRateProductId), interestPercentage: rateNum };
    try {
      if (loanRateFormId) {
        await api.accounts.loanRates.update(resolvedAccountId, loanRateFormId, payload);
        pushToast({ tone: 'success', message: 'Loan rate override updated' });
      } else {
        await api.accounts.loanRates.create(resolvedAccountId, payload);
        pushToast({ tone: 'success', message: 'Loan rate override added' });
      }
      resetLoanRateForm();
      setShowLoanRateForm(false);
      await loadLoanRates(resolvedAccountId);
    } catch (err) {
      const message = err.message || 'Failed to save loan rate override';
      setLoanRatesError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setLoanRateSaving(false);
    }
  };

  const deleteLoanRate = (override) => {
    if (resolvedAccountId === null || resolvedAccountId === undefined || !override?.id) return;
    openConfirm({
      title: 'Delete loan rate override',
      message: `Delete loan rate override ${override.id}?`,
      onConfirm: async () => {
        setLoanRatesError(null);
        try {
          await api.accounts.loanRates.remove(resolvedAccountId, override.id);
          pushToast({ tone: 'success', message: 'Loan rate override deleted' });
          await loadLoanRates(resolvedAccountId);
        } catch (err) {
          const message = err.message || 'Failed to delete loan rate override';
          setLoanRatesError(message);
          pushToast({ tone: 'error', message });
          throw err;
        }
      }
    });
  };

  const openCryptoRateForm = (override) => {
    setCryptoRatesError(null);
    setCryptoRateFormId(override?.id || null);
    setCryptoRateProductId(override?.cryptoProductId ?? '');
    setCryptoRateAsk(
      override?.ask === null || override?.ask === undefined ? '' : String(Number(override.ask) * 100)
    );
    setCryptoRateBid(
      override?.bid === null || override?.bid === undefined ? '' : String(Number(override.bid) * 100)
    );
    setShowCryptoRateForm(true);
  };

  const resetCryptoRateForm = () => {
    setCryptoRateFormId(null);
    setCryptoRateProductId('');
    setCryptoRateAsk('');
    setCryptoRateBid('');
  };

  const submitCryptoRateForm = async () => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      setCryptoRatesError('No account loaded');
      return;
    }
    if (!cryptoRateProductId) {
      setCryptoRatesError('Crypto product is required');
      return;
    }
    const askNum = cryptoRateAsk === '' ? null : Number(cryptoRateAsk);
    const bidNum = cryptoRateBid === '' ? null : Number(cryptoRateBid);
    if (askNum !== null && (!Number.isFinite(askNum) || askNum < 0)) {
      setCryptoRatesError('Ask must be 0 or more (as a percent)');
      return;
    }
    if (bidNum !== null && (!Number.isFinite(bidNum) || bidNum < 0)) {
      setCryptoRatesError('Bid must be 0 or more (as a percent)');
      return;
    }
    setCryptoRateSaving(true);
    setCryptoRatesError(null);
    const payload = { cryptoProductId: Number(cryptoRateProductId), ask: askNum, bid: bidNum };
    try {
      await api.accounts.cryptoRates.upsert(resolvedAccountId, payload);
      pushToast({ tone: 'success', message: cryptoRateFormId ? 'Crypto rate override updated' : 'Crypto rate override added' });
      resetCryptoRateForm();
      setShowCryptoRateForm(false);
      await loadCryptoRates(resolvedAccountId);
    } catch (err) {
      const message = err.message || 'Failed to save crypto rate override';
      setCryptoRatesError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setCryptoRateSaving(false);
    }
  };

  const openCryptoLimitForm = (override) => {
    setCryptoLimitsError(null);
    setCryptoLimitFormId(override?.id || null);
    setCryptoLimitNetworkId(override?.cryptoProductCryptoNetworkId ?? '');
    setCryptoLimitBuy(override?.dailyBuyLimitUsd ?? '');
    setCryptoLimitSell(override?.dailySellLimitUsd ?? '');
    setCryptoLimitSend(override?.dailySendLimitUsd ?? '');
    setCryptoLimitReceive(override?.dailyReceiveLimitUsd ?? '');
    setCryptoLimitSwap(override?.dailySwapLimitUsd ?? '');
    setShowCryptoLimitForm(true);
  };

  const resetCryptoLimitForm = () => {
    setCryptoLimitFormId(null);
    setCryptoLimitNetworkId('');
    setCryptoLimitBuy('');
    setCryptoLimitSell('');
    setCryptoLimitSend('');
    setCryptoLimitReceive('');
    setCryptoLimitSwap('');
  };

  const submitCryptoLimitForm = async () => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      setCryptoLimitsError('No account loaded');
      return;
    }
    if (!cryptoLimitNetworkId) {
      setCryptoLimitsError('Network is required');
      return;
    }
    const parseAmount = (raw) => {
      if (raw === '' || raw === null || raw === undefined) return null;
      const num = Number(raw);
      return Number.isFinite(num) ? num : NaN;
    };
    const buy = parseAmount(cryptoLimitBuy);
    const sell = parseAmount(cryptoLimitSell);
    const send = parseAmount(cryptoLimitSend);
    const receive = parseAmount(cryptoLimitReceive);
    const swap = parseAmount(cryptoLimitSwap);
    const invalid = [buy, sell, send, receive, swap].find((v) => Number.isNaN(v));
    if (invalid !== undefined) {
      setCryptoLimitsError('Limits must be numbers or blank');
      return;
    }
    setCryptoLimitSaving(true);
    setCryptoLimitsError(null);
    const payload = {
      cryptoProductCryptoNetworkId: Number(cryptoLimitNetworkId),
      dailyBuyLimitUsd: buy,
      dailySellLimitUsd: sell,
      dailySendLimitUsd: send,
      dailyReceiveLimitUsd: receive,
      dailySwapLimitUsd: swap
    };
    try {
      await api.accounts.cryptoLimits.upsert(resolvedAccountId, payload);
      pushToast({ tone: 'success', message: cryptoLimitFormId ? 'Crypto limit updated' : 'Crypto limit added' });
      resetCryptoLimitForm();
      setShowCryptoLimitForm(false);
      await loadCryptoLimits(resolvedAccountId);
    } catch (err) {
      const message = err.message || 'Failed to save crypto limit';
      setCryptoLimitsError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setCryptoLimitSaving(false);
    }
  };

  const deleteCryptoLimit = (override) => {
    if (resolvedAccountId === null || resolvedAccountId === undefined || !override?.id) return;
    openConfirm({
      title: 'Delete crypto limit override',
      message: `Delete crypto limit override ${override.id}?`,
      onConfirm: async () => {
        setCryptoLimitsError(null);
        try {
          await api.accounts.cryptoLimits.remove(resolvedAccountId, override.id);
          pushToast({ tone: 'success', message: 'Crypto limit override deleted' });
          await loadCryptoLimits(resolvedAccountId);
        } catch (err) {
          const message = err.message || 'Failed to delete crypto limit override';
          setCryptoLimitsError(message);
          pushToast({ tone: 'error', message });
          throw err;
        }
      }
    });
  };

  const deleteCryptoRate = (override) => {
    if (resolvedAccountId === null || resolvedAccountId === undefined || !override?.id) return;
    openConfirm({
      title: 'Delete crypto rate override',
      message: `Delete crypto rate override ${override.id}?`,
      onConfirm: async () => {
        setCryptoRatesError(null);
        try {
          await api.accounts.cryptoRates.remove(resolvedAccountId, override.id);
          pushToast({ tone: 'success', message: 'Crypto rate override deleted' });
          await loadCryptoRates(resolvedAccountId);
        } catch (err) {
          const message = err.message || 'Failed to delete crypto rate override';
          setCryptoRatesError(message);
          pushToast({ tone: 'error', message });
          throw err;
        }
      }
    });
  };

  const resetCardPriceForm = () => {
    setCardPriceFormId(null);
    setCardPriceCpcpId('');
    setCardPriceAmount('');
  };

  const submitCardPriceForm = async () => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) {
      setCardPricesError('No account loaded');
      return;
    }
    if (!cardPriceCpcpId) {
      setCardPricesError('Provider/product is required');
      return;
    }
    const priceNum = Number(cardPriceAmount);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setCardPricesError('Price must be 0 or greater');
      return;
    }
    setCardPriceSaving(true);
    setCardPricesError(null);
    const payload = { cardProductCardProviderId: Number(cardPriceCpcpId), price: priceNum };
    try {
      if (cardPriceFormId) {
        await api.accounts.cardPrices.update(resolvedAccountId, cardPriceFormId, payload);
        pushToast({ tone: 'success', message: 'Card price override updated' });
      } else {
        await api.accounts.cardPrices.create(resolvedAccountId, payload);
        pushToast({ tone: 'success', message: 'Card price override added' });
      }
      resetCardPriceForm();
      setShowCardPriceForm(false);
      await loadCardPrices(resolvedAccountId);
    } catch (err) {
      const message = err.message || 'Failed to save card price override';
      setCardPricesError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setCardPriceSaving(false);
    }
  };

  const deleteCardPrice = (override) => {
    if (resolvedAccountId === null || resolvedAccountId === undefined || !override?.id) return;
    openConfirm({
      title: 'Delete card price override',
      message: `Delete card price override ${override.id}?`,
      onConfirm: async () => {
        setCardPricesError(null);
        try {
          await api.accounts.cardPrices.remove(resolvedAccountId, override.id);
          pushToast({ tone: 'success', message: 'Card price override deleted' });
          await loadCardPrices(resolvedAccountId);
        } catch (err) {
          const message = err.message || 'Failed to delete card price override';
          setCardPricesError(message);
          pushToast({ tone: 'error', message });
          throw err;
        }
      }
    });
  };

  const accountView = useMemo(() => account || {}, [account]);
  const txView = transactions || [];
  const cryptoWallets = accountView?.cryptoWallets || [];
  const resolvedAccountId = useMemo(() => {
    if (account?.id !== undefined && account?.id !== null) return account.id;
    const num = Number(accountId);
    return Number.isFinite(num) ? num : null;
  }, [account, accountId]);

  useEffect(() => {
    if (resolvedAccountId === null || resolvedAccountId === undefined) return;
    loadNotifications(resolvedAccountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedAccountId, notificationsPage, notificationsSize]);

  const openConfirm = ({ title, message, onConfirm }) => {
    setConfirmPrompt({ title, message, onConfirm });
    setConfirmError('');
  };

  const handleConfirm = async () => {
    if (!confirmPrompt?.onConfirm) {
      setConfirmPrompt(null);
      return;
    }
    setConfirmLoading(true);
    setConfirmError('');
    try {
      await confirmPrompt.onConfirm();
      setConfirmPrompt(null);
    } catch (err) {
      setConfirmError(err.message || 'Failed to complete action');
    } finally {
      setConfirmLoading(false);
    }
  };

  const notificationRows = notifications || [];
  const notificationsCanPrev = notificationsPage > 0;
  const notificationsCanNext = notificationsMeta.totalPages === null ? true : notificationsPage + 1 < notificationsMeta.totalPages;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 800, fontSize: '20px' }}>
              {[accountView?.userFirstName, accountView?.userLastName].filter(Boolean).join(' ') ||
                accountView?.username ||
                accountView?.accountReference ||
                `Account ${accountId}`}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: 'var(--muted)' }}>Detailed view with custom KYC caps, fee overrides, and payment method rules.</span>
              {accountView?.id !== undefined && (
                <Badge>Account ID: {accountView.id}</Badge>
              )}
              {accountView?.kycLevel !== undefined && accountView?.kycLevel !== null && (
                <Badge>KYC Level: {accountView.kycLevel}</Badge>
              )}
              {(accountView?.country?.alpha2Code || accountView?.countryCode) && (
                <Badge>Country: {accountView?.country?.alpha2Code || accountView.countryCode}</Badge>
              )}
            </div>
          </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={() => router.back()}>
            ← Back
          </button>
          <button type="button" className="btn-neutral" onClick={loadAccount} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="btn-neutral" onClick={openNotification}>
            Send notification
          </button>
          <button type="button" className="btn-success" onClick={openCredit}>
            Credit wallet
          </button>
          <button type="button" className="btn-danger" onClick={openDebit}>
            Debit wallet
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}

      <DetailGrid
        rows={[
          { label: 'Account reference', value: accountView?.accountReference },
          { label: 'User', value: accountView?.username },
          { label: 'KYC status', value: accountView?.kycStatus },
          { label: 'Balance', value: accountView?.balance },
          { label: 'Eligible loan', value: accountView?.eligibleLoanAmount },
          {
            label: 'Trusted device override',
            value: accountView?.enforceTrustedDevice === undefined ? '—' : accountView?.enforceTrustedDevice ? 'Yes' : 'No'
          }
        ]}
      />

      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ fontWeight: 800 }}>Account country</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Current: {accountView?.country?.name || accountView?.country?.alpha2Code || accountView?.countryCode || '—'}
            </div>
          </div>
          <button type="button" className="btn-neutral btn-sm" onClick={loadAccount} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {(countryError || countryInfo) && (
          <div style={{ marginTop: '0.5rem', color: countryError ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
            {countryError || countryInfo}
          </div>
        )}

        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '240px', flex: 1 }}>
            <span>Country (ISO alpha-2)</span>
            <select value={countryCodeDraft} onChange={(e) => setCountryCodeDraft(e.target.value)}>
              <option value="">Select country</option>
              {COUNTRIES.map((country) => (
                <option key={country.cca2} value={country.cca2}>
                  {country.flag} {country.name} ({country.cca2})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={saveAccountCountry}
            disabled={countrySaving || resolvedAccountId === null || resolvedAccountId === undefined}
          >
            {countrySaving ? 'Saving…' : 'Update country'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ fontWeight: 800 }}>Manual cardholder creation</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Use this when async cardholder creation fails. Requires admin-supplied KYC data and images.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Sync call can take up to 45 seconds. Provider rate-limits retries to once per minute.
            </div>
          </div>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={openCardholderSync}
            disabled={resolvedAccountId === null || resolvedAccountId === undefined}
          >
            Create cardholder (sync)
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ fontWeight: 800 }}>App Version</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Effective version: <span style={{ fontWeight: 700 }}>{accountView?.appVersion ?? '—'}</span>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              {accountView?.customAppVersion ? `Override: ${accountView.customAppVersion}` : 'Using global version'}
            </div>
          </div>
          <button type="button" className="btn-neutral btn-sm" onClick={loadAccount} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {(appVersionError || appVersionInfo) && (
          <div style={{ marginTop: '0.5rem', color: appVersionError ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
            {appVersionError || appVersionInfo}
          </div>
        )}

        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '220px', flex: 1 }}>
            <span>Override version</span>
            <input
              value={appVersionOverride}
              onChange={(e) => setAppVersionOverride(e.target.value)}
              placeholder="Leave empty to use global version"
            />
          </label>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => saveAppVersionOverride()}
            disabled={appVersionSaving || resolvedAccountId === null || resolvedAccountId === undefined}
          >
            {appVersionSaving ? 'Saving...' : 'Save override'}
          </button>
          <button
            type="button"
            className="btn-neutral btn-sm"
            onClick={() => saveAppVersionOverride('')}
            disabled={
              appVersionSaving ||
              resolvedAccountId === null ||
              resolvedAccountId === undefined ||
              !accountView?.customAppVersion
            }
          >
            Clear override
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: 800 }}>Loan eligibility</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Based on completed, unrefunded transactions and custom overrides.
            </div>
          </div>
          <button
            type="button"
            className="btn-neutral btn-sm"
            onClick={() => loadLoanEligibility(resolvedAccountId)}
            disabled={loanEligibilityLoading || resolvedAccountId === null || resolvedAccountId === undefined}
          >
            {loanEligibilityLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div style={{ marginTop: '0.75rem' }}>
          {loanEligibilityError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{loanEligibilityError}</div>}
          {loanEligibilityLoading && <div style={{ color: 'var(--muted)' }}>Loading loan eligibility…</div>}
          {!loanEligibilityLoading && !loanEligibility && <div style={{ color: 'var(--muted)' }}>No eligibility data available.</div>}
          {!loanEligibilityLoading && loanEligibility && (
            <DetailGrid
              rows={[
                { label: 'Account ID', value: loanEligibility.accountId },
                { label: 'Has completed tx', value: loanEligibility.hasCompletedTransactions ? 'Yes' : 'No' },
                { label: 'Profit', value: loanEligibility.profit },
                { label: 'Base eligibility', value: loanEligibility.baseEligibility },
                { label: 'Extra eligibility', value: loanEligibility.extraEligibility },
                { label: 'Total eligibility', value: loanEligibility.totalEligibility }
              ]}
            />
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: 800 }}>Trusted Device Override</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Enforce trusted device checks for this account even if the global flag is off.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <input type="checkbox" checked={trustedDeviceOverride} onChange={(e) => setTrustedDeviceOverride(e.target.checked)} />
              {trustedDeviceOverride ? 'Enabled' : 'Disabled'}
            </label>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={saveTrustedDeviceOverride}
              disabled={trustedDeviceSaving || resolvedAccountId === null || resolvedAccountId === undefined}
            >
              {trustedDeviceSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '1rem', ...fadeInStyle(!customPricingLoading) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: 800 }}>Custom KYC Caps</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Per-account overrides for loan eligibility and deposit/withdrawal caps.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => loadCustomPricing(resolvedAccountId)} disabled={customPricingLoading}>
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
                KYC level: {accountView?.kycLevel ?? '—'} {kycCapLoading ? '• loading KYC caps…' : ''}
              </div>
            </div>

            {kycCap && (
              <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                  <thead>
                    <tr>
                      {['Limit', 'Base', 'Override (custom)', 'Effective'].map((label) => (
                        <th key={label} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const eligibleLoanEffective = accountView?.eligibleLoanAmount ?? null;
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

      <div className="card" style={{ padding: '1rem', ...fadeInStyle(!feeConfigsLoading) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: 800 }}>Custom Fee Overrides</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Per-account fee rules. Leave PMPP blank for account-wide action overrides.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => loadFeeConfigs(resolvedAccountId)} disabled={feeConfigsLoading}>
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

      <div className="card" style={{ padding: '1rem', ...fadeInStyle(!paymentMethodActionConfigsLoading) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: 800 }}>Custom Payment Method Rules</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Account-level overrides for payment method filtering. If none exist, global defaults apply.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => loadPaymentMethodActionConfigs(resolvedAccountId)} disabled={paymentMethodActionConfigsLoading}>
              {paymentMethodActionConfigsLoading ? 'Loading…' : 'Reload'}
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                resetPaymentMethodActionForm();
                setShowPaymentMethodActionForm(true);
              }}
            >
              Add custom rule
            </button>
          </div>
        </div>

        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem' }}>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '0.75rem',
              background: paymentMethodActionConfigs.length ? '#ecfdf3' : '#eff6ff',
              color: paymentMethodActionConfigs.length ? '#166534' : '#1d4ed8',
              fontWeight: 700
            }}
          >
            {paymentMethodActionConfigs.length ? 'Custom rules active for this account' : 'Using global defaults'}
          </div>
          {paymentMethodActionConfigsError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{paymentMethodActionConfigsError}</div>}
          {paymentMethodActionConfigsLoading && <div style={{ color: 'var(--muted)' }}>Loading payment method rules…</div>}
          {!paymentMethodActionConfigsLoading && paymentMethodActionConfigs.length === 0 && (
            <div style={{ color: 'var(--muted)' }}>No custom payment method rules.</div>
          )}
          {!paymentMethodActionConfigsLoading && paymentMethodActionConfigs.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
                <thead>
                  <tr>
                    {['Action', 'Country', 'Rank', 'Active', 'Include Types', 'Exclude Types', 'Include Names', 'Exclude Names', 'Updated', ''].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paymentMethodActionConfigs.map((rule) => (
                    <tr key={rule.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.45rem' }}>{rule.action || '—'}</td>
                      <td style={{ padding: '0.45rem' }}>{rule.countryCode || '—'}</td>
                      <td style={{ padding: '0.45rem' }}>{rule.rank ?? 0}</td>
                      <td style={{ padding: '0.45rem' }}>{rule.active ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '0.45rem' }}>{Array.isArray(rule.includeTypes) && rule.includeTypes.length ? rule.includeTypes.join(', ') : '—'}</td>
                      <td style={{ padding: '0.45rem' }}>{Array.isArray(rule.excludeTypes) && rule.excludeTypes.length ? rule.excludeTypes.join(', ') : '—'}</td>
                      <td style={{ padding: '0.45rem' }}>{Array.isArray(rule.includeNames) && rule.includeNames.length ? rule.includeNames.join(', ') : '—'}</td>
                      <td style={{ padding: '0.45rem' }}>{Array.isArray(rule.excludeNames) && rule.excludeNames.length ? rule.excludeNames.join(', ') : '—'}</td>
                      <td style={{ padding: '0.45rem' }}>{rule.updatedAt ? formatDateTime(rule.updatedAt) : '—'}</td>
                      <td style={{ padding: '0.45rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn-neutral btn-sm" onClick={() => openPaymentMethodActionForm(rule)}>
                          Edit
                        </button>
                        <button type="button" className="btn-danger btn-sm" onClick={() => deletePaymentMethodActionRule(rule)}>
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

      <div className="card" style={{ padding: '1rem', ...fadeInStyle(!providerRoutingLoading) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: 800 }}>Provider Routing Overrides</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Account-level payment method/provider routing. Resolution order: account action, account context, account default, then global rules.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => loadProviderRouting(resolvedAccountId)} disabled={providerRoutingLoading}>
              {providerRoutingLoading ? 'Loading…' : 'Reload'}
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => openProviderRoutingForm()}
            >
              Add override
            </button>
          </div>
        </div>

        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="providerRoutingFilterActive">Active</label>
              <select
                id="providerRoutingFilterActive"
                value={providerRoutingFilters.active}
                onChange={(e) => setProviderRoutingFilters((prev) => ({ ...prev, active: e.target.value }))}
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="providerRoutingFilterAction">Action</label>
              <select
                id="providerRoutingFilterAction"
                value={providerRoutingFilters.action}
                onChange={(e) => setProviderRoutingFilters((prev) => ({ ...prev, action: e.target.value }))}
              >
                {providerRoutingFilterActionOptions.map((option) => (
                  <option key={option || 'all'} value={option}>
                    {option || 'All'}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="providerRoutingFilterContext">Context</label>
              <select
                id="providerRoutingFilterContext"
                value={providerRoutingFilters.context}
                onChange={(e) => setProviderRoutingFilters((prev) => ({ ...prev, context: e.target.value }))}
              >
                <option value="">All</option>
                {providerRoutingContextOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {providerRoutingError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{providerRoutingError}</div>}
          {providerRoutingLoading && <div style={{ color: 'var(--muted)' }}>Loading provider routing overrides…</div>}
          {!providerRoutingLoading && providerRoutingRows.length === 0 && <div style={{ color: 'var(--muted)' }}>No provider routing overrides.</div>}
          {!providerRoutingLoading && providerRoutingRows.length > 0 && providerRoutingFilteredRows.length === 0 && (
            <div style={{ color: 'var(--muted)' }}>No overrides match the selected filters.</div>
          )}
          {!providerRoutingLoading && providerRoutingFilteredRows.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
                <thead>
                  <tr>
                    {['Payment method', 'Provider', 'Action', 'Context', 'Rank', 'Active', 'Updated', ''].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {providerRoutingFilteredRows.map((row) => {
                    const match = pmps.find((p) => String(p.id) === String(row.paymentMethodPaymentProviderId));
                    const methodName = row.paymentMethodName || match?.paymentMethodName || match?.paymentMethodDisplayName || '—';
                    const providerName = row.providerName || row.paymentProviderName || match?.paymentProviderName || '—';
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.45rem' }}>{methodName}</td>
                        <td style={{ padding: '0.45rem' }}>{providerName}</td>
                        <td style={{ padding: '0.45rem' }}>{row.action || '—'}</td>
                        <td style={{ padding: '0.45rem' }}>{row.context || '—'}</td>
                        <td style={{ padding: '0.45rem' }}>{row.rank ?? 1}</td>
                        <td style={{ padding: '0.45rem' }}>{row.active ? 'Yes' : 'No'}</td>
                        <td style={{ padding: '0.45rem' }}>{row.updatedAt ? formatDateTime(row.updatedAt) : '—'}</td>
                        <td style={{ padding: '0.45rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button type="button" className="btn-neutral btn-sm" onClick={() => openProviderRoutingForm(row)}>
                            Edit
                          </button>
                          {row.active && (
                            <button type="button" className="btn-neutral btn-sm" onClick={() => disableProviderRouting(row)}>
                              Disable
                            </button>
                          )}
                          <button type="button" className="btn-danger btn-sm" onClick={() => deleteProviderRouting(row)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '1rem', ...fadeInStyle(!cardPricesLoading) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: 800 }}>Custom Card Pricing</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Overrides card price per product/provider for this account.</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => loadCardPrices(resolvedAccountId)} disabled={cardPricesLoading}>
              {cardPricesLoading ? 'Loading…' : 'Reload'}
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                resetCardPriceForm();
                setShowCardPriceForm(true);
              }}
            >
              Add override
            </button>
          </div>
        </div>

        <div style={{ marginTop: '0.75rem' }}>
          {cardPricesError && <div style={{ color: '#b91c1c', fontWeight: 700, marginBottom: '0.4rem' }}>{cardPricesError}</div>}
          {cardPricesLoading && <div style={{ color: 'var(--muted)' }}>Loading card price overrides…</div>}
          {!cardPricesLoading && cardPrices.length === 0 && <div style={{ color: 'var(--muted)' }}>No card price overrides.</div>}
          {!cardPricesLoading && cardPrices.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
                <thead>
                  <tr>
                    {['Product / Provider', 'Price', 'Updated', ''].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cardPrices.map((override) => (
                    <tr key={override.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.45rem' }}>
                        {(() => {
                          const match = cardProductCardProviders.find((c) => String(c.id) === String(override.cardProductCardProviderId));
                          if (match) {
                            return `${match.cardBrandName || match.productName || 'Product'} → ${match.cardProviderName || 'Provider'}`;
                          }
                          return override.cardProductCardProviderId;
                        })()}
                      </td>
                      <td style={{ padding: '0.45rem' }}>{override.price}</td>
                      <td style={{ padding: '0.45rem' }}>{override.updatedAt ? formatDateTime(override.updatedAt) : '—'}</td>
                      <td style={{ padding: '0.45rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn-neutral btn-sm" onClick={() => openCardPriceForm(override)}>
                          Edit
                        </button>
                        <button type="button" className="btn-danger btn-sm" onClick={() => deleteCardPrice(override)}>
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

      <div className="card" style={{ padding: '1rem', ...fadeInStyle(!cryptoRatesLoading) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: 800 }}>Custom Crypto Rates</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Override ask/bid spreads per crypto product for this account.</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => loadCryptoRates(resolvedAccountId)} disabled={cryptoRatesLoading}>
              {cryptoRatesLoading ? 'Loading…' : 'Reload'}
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                resetCryptoRateForm();
                setShowCryptoRateForm(true);
              }}
            >
              Add override
            </button>
          </div>
        </div>

        <div style={{ marginTop: '0.75rem' }}>
          {cryptoRatesError && <div style={{ color: '#b91c1c', fontWeight: 700, marginBottom: '0.4rem' }}>{cryptoRatesError}</div>}
          {cryptoRatesLoading && <div style={{ color: 'var(--muted)' }}>Loading crypto rate overrides…</div>}
          {!cryptoRatesLoading && cryptoRates.length === 0 && <div style={{ color: 'var(--muted)' }}>No crypto rate overrides.</div>}
          {!cryptoRatesLoading && cryptoRates.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
                <thead>
                  <tr>
                    {['Product', 'Ask', 'Bid', 'Updated', ''].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cryptoRates.map((override) => (
                    <tr key={override.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.45rem' }}>
                        {(() => {
                          const match = cryptoProducts.find((p) => String(p.id) === String(override.cryptoProductId));
                          return match?.name || match?.displayName || match?.symbol || override.cryptoProductId;
                        })()}
                      </td>
                      <td style={{ padding: '0.45rem' }}>
                        {override.ask === null || override.ask === undefined ? '—' : `${override.ask}%`}
                      </td>
                      <td style={{ padding: '0.45rem' }}>
                        {override.bid === null || override.bid === undefined ? '—' : `${override.bid}%`}
                      </td>
                      <td style={{ padding: '0.45rem' }}>{override.updatedAt ? formatDateTime(override.updatedAt) : '—'}</td>
                      <td style={{ padding: '0.45rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn-neutral btn-sm" onClick={() => openCryptoRateForm(override)}>
                          Edit
                        </button>
                        <button type="button" className="btn-danger btn-sm" onClick={() => deleteCryptoRate(override)}>
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

      <div className="card" style={{ padding: '1rem', ...fadeInStyle(!cryptoLimitsLoading) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: 800 }}>Custom Crypto Limits</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Daily USD limits per crypto network for this account.</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => loadCryptoLimits(resolvedAccountId)} disabled={cryptoLimitsLoading}>
              {cryptoLimitsLoading ? 'Loading…' : 'Reload'}
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                resetCryptoLimitForm();
                setShowCryptoLimitForm(true);
              }}
            >
              Add override
            </button>
          </div>
        </div>

        <div style={{ marginTop: '0.75rem' }}>
          {cryptoLimitsError && <div style={{ color: '#b91c1c', fontWeight: 700, marginBottom: '0.4rem' }}>{cryptoLimitsError}</div>}
          {cryptoLimitsLoading && <div style={{ color: 'var(--muted)' }}>Loading crypto limits…</div>}
          {!cryptoLimitsLoading && cryptoLimits.length === 0 && <div style={{ color: 'var(--muted)' }}>No crypto limits.</div>}
          {!cryptoLimitsLoading && cryptoLimits.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                <thead>
                  <tr>
                    {['Network', 'Buy (USD)', 'Sell (USD)', 'Send (USD)', 'Receive (USD)', 'Swap (USD)', 'Updated', ''].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cryptoLimits.map((override) => (
                    <tr key={override.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.45rem' }}>
                        {(() => {
                          const match = cryptoNetworks.find((c) => String(c.id) === String(override.cryptoProductCryptoNetworkId));
                          if (match) {
                            const prod = match.cryptoProductName || match.cryptoProductDisplayName || match.cryptoProductSymbol || 'Product';
                            const net = match.cryptoNetworkName || match.cryptoNetworkDisplayName || 'Network';
                            return `${prod} • ${net}`;
                          }
                          return override.cryptoProductCryptoNetworkId;
                        })()}
                      </td>
                      <td style={{ padding: '0.45rem' }}>{override.dailyBuyLimitUsd ?? '—'}</td>
                      <td style={{ padding: '0.45rem' }}>{override.dailySellLimitUsd ?? '—'}</td>
                      <td style={{ padding: '0.45rem' }}>{override.dailySendLimitUsd ?? '—'}</td>
                      <td style={{ padding: '0.45rem' }}>{override.dailyReceiveLimitUsd ?? '—'}</td>
                      <td style={{ padding: '0.45rem' }}>{override.dailySwapLimitUsd ?? '—'}</td>
                      <td style={{ padding: '0.45rem' }}>{override.updatedAt ? formatDateTime(override.updatedAt) : '—'}</td>
                      <td style={{ padding: '0.45rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn-neutral btn-sm" onClick={() => openCryptoLimitForm(override)}>
                          Edit
                        </button>
                        <button type="button" className="btn-danger btn-sm" onClick={() => deleteCryptoLimit(override)}>
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

      <div className="card" style={{ padding: '1rem', ...fadeInStyle(!loanRatesLoading) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: 800 }}>Custom Loan Rates</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Override interest percentage per loan product for this account.</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => loadLoanRates(resolvedAccountId)} disabled={loanRatesLoading}>
              {loanRatesLoading ? 'Loading…' : 'Reload'}
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                resetLoanRateForm();
                setShowLoanRateForm(true);
              }}
            >
              Add override
            </button>
          </div>
        </div>

        <div style={{ marginTop: '0.75rem' }}>
          {loanRatesError && <div style={{ color: '#b91c1c', fontWeight: 700, marginBottom: '0.4rem' }}>{loanRatesError}</div>}
          {loanRatesLoading && <div style={{ color: 'var(--muted)' }}>Loading loan rate overrides…</div>}
          {!loanRatesLoading && loanRates.length === 0 && <div style={{ color: 'var(--muted)' }}>No loan rate overrides.</div>}
          {!loanRatesLoading && loanRates.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
                <thead>
                  <tr>
                    {['Loan product', 'Interest %', 'Updated', ''].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loanRates.map((override) => (
                    <tr key={override.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.45rem' }}>
                        {(() => {
                          const match = loanProducts.find((l) => String(l.id) === String(override.loanProductId));
                          return match?.title || override.loanProductId;
                        })()}
                      </td>
                      <td style={{ padding: '0.45rem' }}>{override.interestPercentage}</td>
                      <td style={{ padding: '0.45rem' }}>{override.updatedAt ? formatDateTime(override.updatedAt) : '—'}</td>
                      <td style={{ padding: '0.45rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn-neutral btn-sm" onClick={() => openLoanRateForm(override)}>
                          Edit
                        </button>
                        <button type="button" className="btn-danger btn-sm" onClick={() => deleteLoanRate(override)}>
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
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', ...fadeInStyle(!loading) }}>
          <div style={{ fontWeight: 700 }}>Last transaction</div>
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
                    <td style={{ padding: '0.5rem' }}>
                      <Badge>{txn.status}</Badge>
                    </td>
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

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', ...fadeInStyle(!notificationsLoading) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ fontWeight: 700 }}>Notification history</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Latest notifications sent to this account.</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-neutral btn-sm"
              onClick={() => loadNotifications(resolvedAccountId)}
              disabled={notificationsLoading || resolvedAccountId === null || resolvedAccountId === undefined}
            >
              {notificationsLoading ? 'Loading…' : 'Refresh'}
            </button>
            <button
              type="button"
              className="btn-neutral btn-sm"
              onClick={() => setNotificationsPage((prev) => Math.max(0, prev - 1))}
              disabled={notificationsLoading || !notificationsCanPrev}
            >
              ← Prev
            </button>
            <button
              type="button"
              className="btn-neutral btn-sm"
              onClick={() => setNotificationsPage((prev) => prev + 1)}
              disabled={notificationsLoading || !notificationsCanNext}
            >
              Next →
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '140px' }}>
            <span>Page</span>
            <input
              type="number"
              min={0}
              value={notificationsPage}
              onChange={(e) => setNotificationsPage(Math.max(0, Number(e.target.value)))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '140px' }}>
            <span>Size</span>
            <input
              type="number"
              min={1}
              max={50}
              value={notificationsSize}
              onChange={(e) => {
                const next = Math.min(50, Math.max(1, Number(e.target.value)));
                setNotificationsSize(next);
                setNotificationsPage(0);
              }}
            />
          </label>
          {notificationsMeta.totalElements !== null && (
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              {notificationsMeta.totalElements} notifications total
              {notificationsMeta.totalPages !== null && notificationsMeta.totalPages > 0 ? ` · page ${notificationsPage + 1}/${notificationsMeta.totalPages}` : ''}
            </div>
          )}
        </div>

        {notificationsError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{notificationsError}</div>}
        {resolvedAccountId === null || resolvedAccountId === undefined ? (
          <div style={{ color: 'var(--muted)' }}>No account loaded.</div>
        ) : notificationsLoading ? (
          <div style={{ color: 'var(--muted)' }}>Loading notifications…</div>
        ) : notificationRows.length === 0 ? (
          <div style={{ color: 'var(--muted)' }}>No notifications yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
              <thead>
                <tr>
                  {['Created', 'Category', 'Subject', 'Body', 'Data', 'Read', 'Archived'].map((label) => (
                    <th key={label} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notificationRows.map((note) => (
                  <tr key={note.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.5rem' }}>{formatDateTime(note.createdAt)}</td>
                    <td style={{ padding: '0.5rem' }}>{note.category || '—'}</td>
                    <td style={{ padding: '0.5rem' }}>{note.subject || '—'}</td>
                    <td style={{ padding: '0.5rem', maxWidth: '240px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.body || '—'}</span>
                        {note.body && (
                          <button
                            type="button"
                            onClick={() => setNotificationBodyModal({ subject: note.subject, body: note.body, createdAt: note.createdAt })}
                            style={{ border: 'none', padding: 0, background: 'transparent', color: '#2563eb', textAlign: 'left', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                          >
                            See more
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem', maxWidth: '220px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatJsonPreview(note.data, 120)}
                        </span>
                        {note.data !== null && note.data !== undefined && (
                          <button
                            type="button"
                            onClick={() => setNotificationDataModal({ subject: note.subject, data: note.data, createdAt: note.createdAt })}
                            style={{ border: 'none', padding: 0, background: 'transparent', color: '#2563eb', textAlign: 'left', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                          >
                            See more
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem' }}>{note.readAt ? formatDateTime(note.readAt) : 'Unread'}</td>
                    <td style={{ padding: '0.5rem' }}>{note.archivedAt ? formatDateTime(note.archivedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cryptoWallets.length > 0 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', ...fadeInStyle(!loading) }}>
          <div style={{ fontWeight: 700 }}>Crypto wallets</div>
          {(() => {
            const totals = cryptoWallets.reduce((acc, w) => {
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
                  {['ID', 'Product', 'Network', 'Balance', 'Actions'].map((label) => (
                    <th key={label} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cryptoWallets.map((wallet) => (
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
                    <td style={{ padding: '0.5rem' }}>
                      <button type="button" className="btn-success btn-sm" onClick={() => openCryptoCredit(wallet)}>
                        Credit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {notificationBodyModal && (
        <Modal title={notificationBodyModal.subject ? `Notification: ${notificationBodyModal.subject}` : 'Notification body'} onClose={() => setNotificationBodyModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {notificationBodyModal.createdAt && (
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{formatDateTime(notificationBodyModal.createdAt)}</div>
            )}
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '14px' }}>
              {notificationBodyModal.body || '—'}
            </div>
          </div>
        </Modal>
      )}

      {notificationDataModal && (
        <Modal title={notificationDataModal.subject ? `Notification data: ${notificationDataModal.subject}` : 'Notification data'} onClose={() => setNotificationDataModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {notificationDataModal.createdAt && (
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{formatDateTime(notificationDataModal.createdAt)}</div>
            )}
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px' }}>
              {formatJsonFull(notificationDataModal.data)}
            </pre>
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
              Remove custom KYC caps for account <span style={{ fontWeight: 900 }}>{accountView?.accountReference || accountView?.id}</span>?
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

      {confirmPrompt && (
        <Modal title={confirmPrompt.title || 'Confirm action'} onClose={() => (!confirmLoading ? setConfirmPrompt(null) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ color: 'var(--text)' }}>{confirmPrompt.message || 'Are you sure?'}</div>
            {confirmError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{confirmError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setConfirmPrompt(null)} disabled={confirmLoading}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={handleConfirm} disabled={confirmLoading}>
                {confirmLoading ? 'Working…' : 'Confirm'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCardholderSync && (
        <Modal title="Create cardholder (sync)" onClose={() => (!cardholderSaving ? setShowCardholderSync(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Account ID: <span style={{ fontWeight: 700 }}>{resolvedAccountId ?? '—'}</span>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Provide required fields. Sync call can take up to 45 seconds.
            </div>

            <div style={{ fontWeight: 700 }}>Identity</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-idType">ID type *</label>
                <input
                  id="cardholder-idType"
                  value={cardholderForm.identity.idType}
                  onChange={(e) => updateCardholderIdentity('idType', e.target.value)}
                  placeholder="NIGERIAN_BVN_VERIFICATION"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-idNumber">ID number</label>
                <input
                  id="cardholder-idNumber"
                  value={cardholderForm.identity.idNumber}
                  onChange={(e) => updateCardholderIdentity('idNumber', e.target.value)}
                  placeholder="OP0739797"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-bvn">BVN</label>
                <input
                  id="cardholder-bvn"
                  value={cardholderForm.identity.bvn}
                  onChange={(e) => updateCardholderIdentity('bvn', e.target.value)}
                  placeholder="22222222222222"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-gender">Gender</label>
                <input
                  id="cardholder-gender"
                  value={cardholderForm.identity.gender}
                  onChange={(e) => updateCardholderIdentity('gender', e.target.value)}
                  placeholder="M"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-countryIso2">Country ISO2</label>
                <input
                  id="cardholder-countryIso2"
                  value={cardholderForm.identity.countryIso2}
                  onChange={(e) => updateCardholderIdentity('countryIso2', e.target.value)}
                  placeholder="NG"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-selfieImage">Selfie image URL *</label>
                <input
                  id="cardholder-selfieImage"
                  value={cardholderForm.identity.selfieImage}
                  onChange={(e) => updateCardholderIdentity('selfieImage', e.target.value)}
                  placeholder="https://image.com/selfie.jpg"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-idImage">ID front image URL</label>
                <input
                  id="cardholder-idImage"
                  value={cardholderForm.identity.idImage}
                  onChange={(e) => updateCardholderIdentity('idImage', e.target.value)}
                  placeholder="https://image.com/id-front.jpg"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-backIdImage">ID back image URL</label>
                <input
                  id="cardholder-backIdImage"
                  value={cardholderForm.identity.backIdImage}
                  onChange={(e) => updateCardholderIdentity('backIdImage', e.target.value)}
                  placeholder="https://image.com/id-back.jpg"
                />
              </div>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Provide either BVN or ID number.</div>

            <div style={{ fontWeight: 700 }}>Personal details</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-firstName">First name *</label>
                <input
                  id="cardholder-firstName"
                  value={cardholderForm.firstName}
                  onChange={(e) => updateCardholderField('firstName', e.target.value)}
                  placeholder="John"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-lastName">Last name *</label>
                <input
                  id="cardholder-lastName"
                  value={cardholderForm.lastName}
                  onChange={(e) => updateCardholderField('lastName', e.target.value)}
                  placeholder="Doe"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-phone">Phone *</label>
                <input
                  id="cardholder-phone"
                  value={cardholderForm.phone}
                  onChange={(e) => updateCardholderField('phone', e.target.value)}
                  placeholder="+2348122277789"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-email">Email *</label>
                <input
                  id="cardholder-email"
                  type="email"
                  value={cardholderForm.emailAddress}
                  onChange={(e) => updateCardholderField('emailAddress', e.target.value)}
                  placeholder="testingboy@gmail.com"
                />
              </div>
            </div>

            <div style={{ fontWeight: 700 }}>Address</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-address">Address *</label>
                <input
                  id="cardholder-address"
                  value={cardholderForm.address.address}
                  onChange={(e) => updateCardholderAddress('address', e.target.value)}
                  placeholder="9 Jibowu Street"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-city">City *</label>
                <input
                  id="cardholder-city"
                  value={cardholderForm.address.city}
                  onChange={(e) => updateCardholderAddress('city', e.target.value)}
                  placeholder="Aba North"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-state">State *</label>
                <input
                  id="cardholder-state"
                  value={cardholderForm.address.state}
                  onChange={(e) => updateCardholderAddress('state', e.target.value)}
                  placeholder="Abia"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-country">Country *</label>
                <input
                  id="cardholder-country"
                  value={cardholderForm.address.country}
                  onChange={(e) => updateCardholderAddress('country', e.target.value)}
                  placeholder="Nigeria"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-postalCode">Postal code</label>
                <input
                  id="cardholder-postalCode"
                  value={cardholderForm.address.postalCode}
                  onChange={(e) => updateCardholderAddress('postalCode', e.target.value)}
                  placeholder="1000242"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardholder-houseNo">House no</label>
                <input
                  id="cardholder-houseNo"
                  value={cardholderForm.address.houseNo}
                  onChange={(e) => updateCardholderAddress('houseNo', e.target.value)}
                  placeholder="13"
                />
              </div>
            </div>

            {cardholderError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{cardholderError}</div>}
            {cardholderResult && (
              <div style={{ border: `1px solid var(--border)`, borderRadius: '12px', padding: '0.65rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Result</div>
                <div style={{ display: 'grid', gap: '0.3rem', fontSize: '12px', color: 'var(--muted)' }}>
                  <div>External reference: {cardholderResult?.externalReference ?? '—'}</div>
                  <div>Internal reference: {cardholderResult?.internalReference ?? cardholderResult?.id ?? '—'}</div>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowCardholderSync(false)} disabled={cardholderSaving}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={submitCardholderSync} disabled={cardholderSaving}>
                {cardholderSaving ? 'Creating…' : 'Create cardholder'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCredit && (
        <Modal title="Credit wallet" onClose={() => (!creditLoading ? setShowCredit(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
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
                  min="0"
                  step="0.01"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="100.00"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="creditNote">Note (optional)</label>
                <input
                  id="creditNote"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder="Optional note shown on receipt"
                />
              </div>
            </div>
            {creditError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{creditError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowCredit(false)} disabled={creditLoading}>
                Cancel
              </button>
              <button type="button" className="btn-success" onClick={submitCredit} disabled={creditLoading}>
                {creditLoading ? 'Crediting…' : 'Credit wallet'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDebit && (
        <Modal title="Debit wallet" onClose={() => (!debitLoading ? setShowDebit(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
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
                  placeholder="25.00"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="debitNote">Note (optional)</label>
                <input
                  id="debitNote"
                  value={debitNote}
                  onChange={(e) => setDebitNote(e.target.value)}
                  placeholder="Optional note shown to user"
                />
              </div>
            </div>
            {debitError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{debitError}</div>}
            {debitResult && (
              <div style={{ border: `1px solid var(--border)`, borderRadius: '12px', padding: '0.65rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Debit created</div>
                <div style={{ display: 'grid', gap: '0.3rem', fontSize: '12px', color: 'var(--muted)' }}>
                  <div>Transaction ID: {debitResult?.transactionId ?? '—'}</div>
                  <div>Reference: {debitResult?.reference ?? '—'}</div>
                </div>
                {debitResult?.transactionId && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <Link href={`/dashboard/transactions?transactionId=${debitResult.transactionId}`} className="btn-neutral">
                      View transaction
                    </Link>
                  </div>
                )}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowDebit(false)} disabled={debitLoading}>
                Close
              </button>
              <button type="button" className="btn-danger" onClick={submitDebit} disabled={debitLoading}>
                {debitLoading ? 'Debiting…' : 'Debit wallet'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCryptoCredit && (
        <Modal title={`Credit crypto wallet ${cryptoCreditWallet?.id ?? ''}`} onClose={() => (!cryptoCreditLoading ? setShowCryptoCredit(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              Account ID: <span style={{ fontWeight: 700 }}>{resolvedAccountId ?? '—'}</span>
              {cryptoCreditWallet?.currency ? ` · ${cryptoCreditWallet.currency}` : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cryptoCreditAction">Action</label>
                <select id="cryptoCreditAction" value={cryptoCreditAction} onChange={(e) => setCryptoCreditAction(e.target.value)}>
                  <option value="MANUAL_ADJUSTMENT">Manual adjustment</option>
                  <option value="BONUS">Bonus</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cryptoCreditAmount">Amount</label>
                <input
                  id="cryptoCreditAmount"
                  type="number"
                  min="0"
                  step="0.00000001"
                  value={cryptoCreditAmount}
                  onChange={(e) => setCryptoCreditAmount(e.target.value)}
                  placeholder="0.00050000"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cryptoCreditNote">Note (optional)</label>
                <input
                  id="cryptoCreditNote"
                  value={cryptoCreditNote}
                  onChange={(e) => setCryptoCreditNote(e.target.value)}
                  placeholder="Optional note shown on receipt"
                />
              </div>
            </div>
            {cryptoCreditError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{cryptoCreditError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowCryptoCredit(false)} disabled={cryptoCreditLoading}>
                Cancel
              </button>
              <button type="button" className="btn-success" onClick={submitCryptoCredit} disabled={cryptoCreditLoading}>
                {cryptoCreditLoading ? 'Crediting…' : 'Credit wallet'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showNotification && (
        <Modal title="Send notification" onClose={() => (!notificationLoading ? setShowNotification(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Select at least one channel.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="notificationSubject">Subject</label>
                <input
                  id="notificationSubject"
                  value={notificationSubject}
                  onChange={(e) => setNotificationSubject(e.target.value)}
                  placeholder="Your title"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="notificationMessage">Message</label>
                <textarea
                  id="notificationMessage"
                  rows={4}
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  placeholder="Your message"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {['PUSH', 'EMAIL', 'SMS', 'WHATSAPP'].map((channel) => (
                  <label key={channel} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={notificationChannels.includes(channel)}
                      onChange={(e) => {
                        setNotificationChannels((prev) => {
                          if (e.target.checked) return Array.from(new Set([...prev, channel]));
                          return prev.filter((item) => item !== channel);
                        });
                      }}
                    />
                    {channel}
                  </label>
                ))}
              </div>
            </div>
            {notificationError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{notificationError}</div>}
            {notificationResult?.channels?.length > 0 && (
              <div style={{ border: `1px solid var(--border)`, borderRadius: '12px', padding: '0.65rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Channel status</div>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  {notificationResult.channels.map((entry) => (
                    <div key={entry.channel} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <span style={{ fontWeight: 600 }}>{entry.channel}</span>
                      <span style={{ color: entry.attempted ? '#15803d' : '#b91c1c' }}>
                        {entry.attempted ? 'Sent' : entry.reason || 'Not attempted'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowNotification(false)} disabled={notificationLoading}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={submitNotification} disabled={notificationLoading}>
                {notificationLoading ? 'Sending…' : 'Send'}
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

      {showPaymentMethodActionForm && (
        <Modal title={`${paymentMethodActionFormId ? 'Edit' : 'Add'} payment method rule`} onClose={() => (!paymentMethodActionSaving ? setShowPaymentMethodActionForm(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {paymentMethodActionConfigsError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{paymentMethodActionConfigsError}</div>}
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Saving as account override for account <strong>#{resolvedAccountId ?? '—'}</strong>.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="paymentMethodRuleAction">Action</label>
                <select id="paymentMethodRuleAction" value={paymentMethodAction} onChange={(e) => setPaymentMethodAction(e.target.value)}>
                  <option value="">Global (all actions)</option>
                  {paymentMethodActionRuleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="paymentMethodRuleCountry">Country code</label>
                <input
                  id="paymentMethodRuleCountry"
                  value={paymentMethodCountryCode}
                  onChange={(e) => setPaymentMethodCountryCode(e.target.value.toUpperCase())}
                  placeholder="CD"
                />
                <div style={{ fontSize: '12px', color: paymentMethodCountryCodeValid ? 'var(--muted)' : '#b91c1c' }}>
                  {paymentMethodCountryCodeValid ? 'Optional. 2-4 uppercase letters.' : 'Invalid country code.'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="paymentMethodRuleRank">Rank</label>
                <input
                  id="paymentMethodRuleRank"
                  type="number"
                  value={paymentMethodRank}
                  onChange={(e) => setPaymentMethodRank(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  id="paymentMethodRuleActive"
                  type="checkbox"
                  checked={paymentMethodActive}
                  onChange={(e) => setPaymentMethodActive(e.target.checked)}
                />
                <label htmlFor="paymentMethodRuleActive">Active</label>
              </div>
            </div>

            <MultiSelect
              label="Include Types"
              options={paymentMethodTypeRuleOptions}
              values={paymentMethodIncludeTypes}
              onChange={setPaymentMethodIncludeTypes}
              helperText={paymentMethodIncludeTypes.length ? 'Only these types are allowed.' : 'Leave empty for no type restriction.'}
            />
            <MultiSelect
              label="Exclude Types"
              options={paymentMethodTypeRuleOptions}
              values={paymentMethodExcludeTypes}
              onChange={setPaymentMethodExcludeTypes}
              helperText="Excluded types are always removed."
            />
            {paymentMethodTypeConflicts.length > 0 && (
              <div style={{ color: '#b91c1c', fontSize: '12px' }}>
                Include/exclude type conflicts: {paymentMethodTypeConflicts.join(', ')}
              </div>
            )}

            <MultiSelect
              label="Include Names"
              options={paymentMethodNameRuleOptions}
              values={paymentMethodIncludeNames}
              onChange={setPaymentMethodIncludeNames}
              helperText={paymentMethodIncludeNames.length ? 'Only these names are allowed.' : 'Leave empty for no name restriction.'}
            />
            <MultiSelect
              label="Exclude Names"
              options={paymentMethodNameRuleOptions}
              values={paymentMethodExcludeNames}
              onChange={setPaymentMethodExcludeNames}
              helperText="Excluded names are always removed."
            />
            {paymentMethodNameConflicts.length > 0 && (
              <div style={{ color: '#b91c1c', fontSize: '12px' }}>
                Include/exclude name conflicts: {paymentMethodNameConflicts.join(', ')}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-neutral"
                onClick={() => {
                  if (!paymentMethodActionSaving) {
                    resetPaymentMethodActionForm();
                    setShowPaymentMethodActionForm(false);
                  }
                }}
                disabled={paymentMethodActionSaving}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={submitPaymentMethodActionForm} disabled={paymentMethodActionSaving || !canSavePaymentMethodRule}>
                {paymentMethodActionSaving ? 'Saving…' : paymentMethodActionFormId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showProviderRoutingForm && (
        <Modal
          title={`${providerRoutingForm.id ? 'Edit' : 'Add'} provider routing override`}
          onClose={() => (!providerRoutingSaving ? setShowProviderRoutingForm(false) : null)}
        >
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {providerRoutingError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{providerRoutingError}</div>}
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Saving as account override for account <strong>#{resolvedAccountId ?? '—'}</strong>.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="providerRoutingPmpId">Payment method / provider *</label>
                <select
                  id="providerRoutingPmpId"
                  value={providerRoutingForm.paymentMethodPaymentProviderId}
                  onChange={(e) => setProviderRoutingForm((prev) => ({ ...prev, paymentMethodPaymentProviderId: e.target.value }))}
                >
                  <option value="">Select</option>
                  {pmps.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getPmpLabel(p.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="providerRoutingAction">Action</label>
                <select
                  id="providerRoutingAction"
                  value={providerRoutingForm.action}
                  onChange={(e) => setProviderRoutingForm((prev) => ({ ...prev, action: e.target.value }))}
                >
                  <option value="">Any action</option>
                  {paymentMethodActionRuleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="providerRoutingContext">Context</label>
                <select
                  id="providerRoutingContext"
                  value={providerRoutingForm.context}
                  onChange={(e) => setProviderRoutingForm((prev) => ({ ...prev, context: e.target.value }))}
                >
                  <option value="">Any context</option>
                  {providerRoutingContextOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="providerRoutingRank">Rank</label>
                <input
                  id="providerRoutingRank"
                  type="number"
                  value={providerRoutingForm.rank}
                  onChange={(e) => setProviderRoutingForm((prev) => ({ ...prev, rank: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  id="providerRoutingActive"
                  type="checkbox"
                  checked={providerRoutingForm.active}
                  onChange={(e) => setProviderRoutingForm((prev) => ({ ...prev, active: e.target.checked }))}
                />
                <label htmlFor="providerRoutingActive">Active</label>
              </div>
            </div>

            {providerRoutingActionContextWarning && (
              <div
                style={{
                  border: '1px solid #facc15',
                  background: '#fef9c3',
                  color: '#854d0e',
                  borderRadius: '10px',
                  padding: '0.65rem',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Both action and context are set. This is allowed, but backend resolution prefers action.
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-neutral"
                onClick={() => {
                  if (!providerRoutingSaving) {
                    resetProviderRoutingForm();
                    setShowProviderRoutingForm(false);
                  }
                }}
                disabled={providerRoutingSaving}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={submitProviderRoutingForm} disabled={providerRoutingSaving}>
                {providerRoutingSaving ? 'Saving…' : providerRoutingForm.id ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCardPriceForm && (
        <Modal title={`${cardPriceFormId ? 'Edit' : 'Add'} card price override`} onClose={() => (!cardPriceSaving ? setShowCardPriceForm(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {cardPricesError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{cardPricesError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardPriceCpcpId">Product / Provider *</label>
                <select
                  id="cardPriceCpcpId"
                  value={cardPriceCpcpId}
                  onChange={(e) => setCardPriceCpcpId(e.target.value)}
                >
                  <option value="">Select</option>
                  {cardProductCardProviders.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.cardBrandName || c.productName || 'Product') + ' → ' + (c.cardProviderName || 'Provider')}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cardPriceAmount">Price *</label>
                <input
                  id="cardPriceAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cardPriceAmount}
                  onChange={(e) => setCardPriceAmount(e.target.value)}
                  placeholder="49.99"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => { if (!cardPriceSaving) { resetCardPriceForm(); setShowCardPriceForm(false); } }} disabled={cardPriceSaving}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={submitCardPriceForm} disabled={cardPriceSaving}>
                {cardPriceSaving ? 'Saving…' : cardPriceFormId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showLoanRateForm && (
        <Modal title={`${loanRateFormId ? 'Edit' : 'Add'} loan rate override`} onClose={() => (!loanRateSaving ? setShowLoanRateForm(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {loanRatesError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{loanRatesError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="loanRateProductId">Loan product *</label>
                <select id="loanRateProductId" value={loanRateProductId} onChange={(e) => setLoanRateProductId(e.target.value)}>
                  <option value="">Select</option>
                  {loanProducts.map((lp) => (
                    <option key={lp.id} value={lp.id}>
                      {lp.title || `Product ${lp.id}`} {lp.minAmount !== undefined && lp.maxAmount !== undefined ? `( $${lp.minAmount} - $${lp.maxAmount} )` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="loanRateInterest">Interest % *</label>
                <input
                  id="loanRateInterest"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={loanRateInterest}
                  onChange={(e) => setLoanRateInterest(e.target.value)}
                  placeholder="e.g. 3 for 3%"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-neutral"
                onClick={() => {
                  if (!loanRateSaving) {
                    resetLoanRateForm();
                    setShowLoanRateForm(false);
                  }
                }}
                disabled={loanRateSaving}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={submitLoanRateForm} disabled={loanRateSaving}>
                {loanRateSaving ? 'Saving…' : loanRateFormId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCryptoRateForm && (
        <Modal title={`${cryptoRateFormId ? 'Edit' : 'Add'} crypto rate override`} onClose={() => (!cryptoRateSaving ? setShowCryptoRateForm(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {cryptoRatesError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{cryptoRatesError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cryptoRateProductId">Crypto product *</label>
                <select
                  id="cryptoRateProductId"
                  value={cryptoRateProductId}
                  onChange={(e) => setCryptoRateProductId(e.target.value)}
                >
                  <option value="">Select</option>
                  {cryptoProducts.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name || cp.displayName || cp.symbol || `Product ${cp.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cryptoRateAsk">Ask (%)</label>
                <input
                  id="cryptoRateAsk"
                  type="number"
                  step="0.01"
                  min="0"
                  value={cryptoRateAsk}
                  onChange={(e) => setCryptoRateAsk(e.target.value)}
                  placeholder="e.g. 20 for 20%"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cryptoRateBid">Bid (%)</label>
                <input
                  id="cryptoRateBid"
                  type="number"
                  step="0.01"
                  min="0"
                  value={cryptoRateBid}
                  onChange={(e) => setCryptoRateBid(e.target.value)}
                  placeholder="e.g. 15 for 15%"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-neutral"
                onClick={() => {
                  if (!cryptoRateSaving) {
                    resetCryptoRateForm();
                    setShowCryptoRateForm(false);
                  }
                }}
                disabled={cryptoRateSaving}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={submitCryptoRateForm} disabled={cryptoRateSaving}>
                {cryptoRateSaving ? 'Saving…' : cryptoRateFormId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCryptoLimitForm && (
        <Modal title={`${cryptoLimitFormId ? 'Edit' : 'Add'} crypto limit override`} onClose={() => (!cryptoLimitSaving ? setShowCryptoLimitForm(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {cryptoLimitsError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{cryptoLimitsError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="cryptoLimitNetworkId">Network *</label>
                <select
                  id="cryptoLimitNetworkId"
                  value={cryptoLimitNetworkId}
                  onChange={(e) => setCryptoLimitNetworkId(e.target.value)}
                >
                  <option value="">Select</option>
                  {cryptoNetworks.map((net) => (
                    <option key={net.id} value={net.id}>
                      {(net.cryptoProductName || net.cryptoProductDisplayName || net.cryptoProductSymbol || 'Product') +
                        ' • ' +
                        (net.cryptoNetworkName || net.cryptoNetworkDisplayName || 'Network')}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="cryptoLimitBuy">Daily buy limit (USD)</label>
                  <input
                    id="cryptoLimitBuy"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cryptoLimitBuy}
                    onChange={(e) => setCryptoLimitBuy(e.target.value)}
                    placeholder="5000"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="cryptoLimitSell">Daily sell limit (USD)</label>
                  <input
                    id="cryptoLimitSell"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cryptoLimitSell}
                    onChange={(e) => setCryptoLimitSell(e.target.value)}
                    placeholder="3000"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="cryptoLimitSend">Daily send limit (USD)</label>
                  <input
                    id="cryptoLimitSend"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cryptoLimitSend}
                    onChange={(e) => setCryptoLimitSend(e.target.value)}
                    placeholder="2000"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="cryptoLimitReceive">Daily receive limit (USD)</label>
                  <input
                    id="cryptoLimitReceive"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cryptoLimitReceive}
                    onChange={(e) => setCryptoLimitReceive(e.target.value)}
                    placeholder="8000"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="cryptoLimitSwap">Daily swap limit (USD)</label>
                  <input
                    id="cryptoLimitSwap"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cryptoLimitSwap}
                    onChange={(e) => setCryptoLimitSwap(e.target.value)}
                    placeholder="1500"
                  />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-neutral"
                onClick={() => {
                  if (!cryptoLimitSaving) {
                    resetCryptoLimitForm();
                    setShowCryptoLimitForm(false);
                  }
                }}
                disabled={cryptoLimitSaving}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={submitCryptoLimitForm} disabled={cryptoLimitSaving}>
                {cryptoLimitSaving ? 'Saving…' : cryptoLimitFormId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
