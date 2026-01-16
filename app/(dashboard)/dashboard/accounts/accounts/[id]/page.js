'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

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

const fadeInStyle = (ready) => ({
  opacity: ready ? 1 : 0,
  transform: ready ? 'translateY(0px)' : 'translateY(6px)',
  transition: 'opacity 0.35s ease, transform 0.35s ease'
});

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
const [showCredit, setShowCredit] = useState(false);
const [creditAmount, setCreditAmount] = useState('');
const [creditNote, setCreditNote] = useState('');
const [creditError, setCreditError] = useState(null);
const [creditLoading, setCreditLoading] = useState(false);
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

  useEffect(() => {
    loadAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    if (account?.enforceTrustedDevice === undefined) return;
    setTrustedDeviceOverride(Boolean(account.enforceTrustedDevice));
  }, [account?.enforceTrustedDevice]);

  useEffect(() => {
    setAppVersionOverride(account?.customAppVersion ?? '');
  }, [account?.customAppVersion]);

  const openCredit = () => {
    setCreditAmount('');
    setCreditNote('');
    setCreditError(null);
    setShowCredit(true);
  };

  const openNotification = () => {
    setNotificationSubject('');
    setNotificationMessage('');
    setNotificationChannels(['PUSH']);
    setNotificationError(null);
    setNotificationResult(null);
    setShowNotification(true);
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
      const payload = { amount: amountNum, ...(creditNote?.trim() ? { note: creditNote.trim() } : {}) };
      const res = await api.accounts.creditWalletBonus(resolvedAccountId, payload);
      pushToast({
        tone: 'success',
        message: `Bonus credited: ${res?.amount ?? amountNum}${res?.reference ? ` (ref ${res.reference})` : ''}`
      });
      setShowCredit(false);
      await loadAccount();
    } catch (err) {
      const message = err.message || 'Failed to credit account';
      setCreditError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setCreditLoading(false);
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
              <span style={{ color: 'var(--muted)' }}>Detailed view with custom KYC caps and fee overrides.</span>
              {accountView?.id !== undefined && (
                <Badge>Account ID: {accountView.id}</Badge>
              )}
              {accountView?.kycLevel !== undefined && accountView?.kycLevel !== null && (
                <Badge>KYC Level: {accountView.kycLevel}</Badge>
              )}
              {accountView?.countryCode && <Badge>Country: {accountView.countryCode}</Badge>}
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
                  {['ID', 'Product', 'Network', 'Balance'].map((label) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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

      {showCredit && (
        <Modal title="Credit wallet (Bonus)" onClose={() => (!creditLoading ? setShowCredit(false) : null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
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
                  placeholder="Manual bonus for customer"
                />
              </div>
            </div>
            {creditError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{creditError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowCredit(false)} disabled={creditLoading}>
                Cancel
              </button>
              <button type="button" className="btn-success" onClick={submitCredit} disabled={creditLoading}>
                {creditLoading ? 'Crediting…' : 'Credit bonus'}
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
