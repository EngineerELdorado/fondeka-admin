'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

const MIN_COOLDOWN = 1;
const MAX_COOLDOWN = 1440;
const MIN_REVIEW_PROMPT_THRESHOLD = 1;
const DEFAULT_CRYPTO_CURRENCY_OPTIONS = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'EURC'];
const DEFAULT_CRYPTO_NETWORK_OPTIONS = ['LIGHTNING', 'BTC', 'ERC20', 'BEP20', 'TRC20', 'SOLANA', 'POLYGON', 'BASE', 'ARBITRUM', 'AVALANCHE'];
const ALLOWED_PAYOUT_ACTIONS = ['WITHDRAW_FROM_WALLET', 'WITHDRAW_FROM_CARD', 'SELL_CRYPTO'];
const PAYMENT_METHOD_TYPE_OPTIONS = ['MOBILE_MONEY', 'CRYPTO', 'BALANCE', 'CREDIT', 'AIRTIME', 'BANK'];
const COLLECTION_SOURCE_RISK_CONSEQUENCE_OPTIONS = ['WARNING', 'BLACKLIST'];
const ACTION_OPTIONS = [
  'FUND_WALLET',
  'WITHDRAW_FROM_WALLET',
  'PERSONAL_SAVING_DEPOSIT',
  'PERSONAL_SAVING_WITHDRAWAL',
  'PERSONAL_SAVING_INTEREST_PAYOUT',
  'GROUP_SAVING_CONTRIBUTION',
  'GROUP_SAVING_PAYOUT',
  'GROUP_SAVING_ROUND_DISTRIBUTION',
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
  'CARD_PAYMENT_REVERSAL',
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
const feeApplicationModeOptions = [
  { value: 'EXCLUSIVE', label: 'Sender pays fees (EXCLUSIVE)' },
  { value: 'INCLUSIVE', label: 'Recipient pays fees (INCLUSIVE)' }
];
const TAB_ITEMS = [
  { key: 'overview', label: 'Overview' },
  { key: 'fees', label: 'Fees & Actions' },
  { key: 'operations', label: 'Operations' },
  { key: 'crypto', label: 'Crypto & Payouts' },
  { key: 'app', label: 'App, KYC & Loans' }
];
const FEE_APPLICATION_MODES = new Set(feeApplicationModeOptions.map((option) => option.value));
const formatUsdValue = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : String(value);
};
const normalizeList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.content)) return response.content;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.results)) return response.results;
  return [];
};
const normalizeRailKeyPart = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
const normalizeRailMap = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, enabled]) => [String(key || '').trim().toUpperCase(), enabled === true])
      .filter(([key]) => key.includes(':'))
      .sort(([left], [right]) => left.localeCompare(right))
  );
};
const humanizeEnum = (value) =>
  String(value || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
const normalizePositiveIntegerString = (value) => String(value ?? '').trim();
const createEmptyCollectionSourceRiskThreshold = () => ({
  maxDistinctSources: '',
  windowMinutes: '',
  consequence: 'WARNING'
});
const createEmptyCollectionSourceRiskRule = () => ({
  action: '',
  paymentMethodType: '',
  paymentMethodId: '',
  thresholds: [createEmptyCollectionSourceRiskThreshold()]
});
const normalizeCollectionSourceRiskThresholdDraft = (threshold) => {
  if (!threshold || typeof threshold !== 'object') return null;
  const maxDistinctSources = normalizePositiveIntegerString(threshold.maxDistinctSources);
  const windowMinutes = normalizePositiveIntegerString(threshold.windowMinutes);
  const consequence = String(threshold.consequence || '').trim().toUpperCase();
  if (!maxDistinctSources || !windowMinutes) return null;
  return {
    maxDistinctSources,
    windowMinutes,
    consequence: COLLECTION_SOURCE_RISK_CONSEQUENCE_OPTIONS.includes(consequence) ? consequence : 'BLACKLIST'
  };
};
const compareCollectionSourceRiskThresholds = (left, right) => {
  const maxDelta = Number(left?.maxDistinctSources || 0) - Number(right?.maxDistinctSources || 0);
  if (maxDelta !== 0) return maxDelta;
  const windowDelta = Number(left?.windowMinutes || 0) - Number(right?.windowMinutes || 0);
  if (windowDelta !== 0) return windowDelta;
  return String(left?.consequence || '').localeCompare(String(right?.consequence || ''));
};
const normalizeCollectionSourceRiskRuleDraft = (rule) => {
  if (!rule || typeof rule !== 'object') return null;
  const action = String(rule.action || '').trim();
  const paymentMethodType = String(rule.paymentMethodType || '').trim().toUpperCase();
  const paymentMethodIdRaw = String(rule.paymentMethodId ?? '').trim();
  const thresholdsSource = Array.isArray(rule.thresholds) && rule.thresholds.length
    ? rule.thresholds
    : rule.maxDistinctSources !== null && rule.maxDistinctSources !== undefined && rule.windowMinutes !== null && rule.windowMinutes !== undefined
      ? [{
          maxDistinctSources: rule.maxDistinctSources,
          windowMinutes: rule.windowMinutes,
          consequence: rule.consequence || 'BLACKLIST'
        }]
      : [];
  const thresholds = thresholdsSource
    .map((threshold) => normalizeCollectionSourceRiskThresholdDraft(threshold))
    .filter(Boolean)
    .sort(compareCollectionSourceRiskThresholds);
  return {
    action,
    paymentMethodType: PAYMENT_METHOD_TYPE_OPTIONS.includes(paymentMethodType) ? paymentMethodType : '',
    paymentMethodId: paymentMethodIdRaw,
    thresholds: thresholds.length ? thresholds : [createEmptyCollectionSourceRiskThreshold()]
  };
};
const normalizeCollectionSourceRiskRulesFromResponse = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((rule) => normalizeCollectionSourceRiskRuleDraft(rule))
    .filter((rule) => rule && (rule.action || rule.paymentMethodType || rule.paymentMethodId || rule.thresholds.length));
};

const autoRefundChipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.35rem 0.65rem',
  borderRadius: '999px',
  border: '1px solid color-mix(in srgb, var(--accent) 22%, var(--border))',
  background: 'var(--accent-soft)',
  color: 'var(--text)',
  fontSize: '12px',
  fontWeight: 700
};

export default function WalletPolicyConfigPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [cooldown, setCooldown] = useState('');
  const [payoutRateLimitActions, setPayoutRateLimitActions] = useState([]);
  const [cryptoProviderCollectionMinimumUsd, setCryptoProviderCollectionMinimumUsd] = useState('');
  const [cryptoProviderCollectionMaximumUsd, setCryptoProviderCollectionMaximumUsd] = useState('');
  const [sendAirtimeMinimumUsd, setSendAirtimeMinimumUsd] = useState('');
  const [paypalMinimumPayoutUsd, setPaypalMinimumPayoutUsd] = useState('');
  const [payoutKycThresholdUsd, setPayoutKycThresholdUsd] = useState('');
  const [forcePayoutKycUnlessApproved, setForcePayoutKycUnlessApproved] = useState(false);
  const [forceKycBeforeAppUse, setForceKycBeforeAppUse] = useState(false);
  const [sendCryptoExternalProviderEnabled, setSendCryptoExternalProviderEnabled] = useState(false);
  const [sendCryptoAutoPayoutRails, setSendCryptoAutoPayoutRails] = useState({});
  const [cryptoProducts, setCryptoProducts] = useState([]);
  const [cryptoNetworks, setCryptoNetworks] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [railDraftCurrency, setRailDraftCurrency] = useState('');
  const [railDraftNetwork, setRailDraftNetwork] = useState('');
  const [railDraftEnabled, setRailDraftEnabled] = useState(true);
  const [reviewPromptCompletedTransactionsThreshold, setReviewPromptCompletedTransactionsThreshold] = useState('');
  const [depositPromptThresholdAmount, setDepositPromptThresholdAmount] = useState('');
  const [transactionsEligibleForLoanEligibility, setTransactionsEligibleForLoanEligibility] = useState(true);
  const [autoRefundBlockedActions, setAutoRefundBlockedActions] = useState([]);
  const [autoRefundActionSearch, setAutoRefundActionSearch] = useState('');
  const [globalFeeApplicationMode, setGlobalFeeApplicationMode] = useState('EXCLUSIVE');
  const [actionFeeApplicationModes, setActionFeeApplicationModes] = useState({});
  const [actionMinimumAmounts, setActionMinimumAmounts] = useState({});
  const [actionMaximumAmounts, setActionMaximumAmounts] = useState({});
  const [collectionSourceRiskRules, setCollectionSourceRiskRules] = useState([]);
  const [configSnapshot, setConfigSnapshot] = useState(null);

  const autoRefundActionOptions = useMemo(() => {
    const known = new Set(ACTION_OPTIONS);
    for (const action of autoRefundBlockedActions) {
      if (action) known.add(String(action));
    }
    return Array.from(known).sort();
  }, [autoRefundBlockedActions]);

  const filteredAutoRefundActionOptions = useMemo(() => {
    const query = autoRefundActionSearch.trim().toLowerCase();
    if (!query) return autoRefundActionOptions;
    return autoRefundActionOptions.filter((action) => {
      const raw = String(action);
      return raw.toLowerCase().includes(query) || humanizeEnum(raw).toLowerCase().includes(query);
    });
  }, [autoRefundActionOptions, autoRefundActionSearch]);

  const selectedAutoRefundBlockedActions = useMemo(
    () =>
      Array.from(new Set((Array.isArray(autoRefundBlockedActions) ? autoRefundBlockedActions : []).map((action) => String(action)).filter(Boolean))).sort(),
    [autoRefundBlockedActions]
  );

  const actionFeeModeEntries = useMemo(
    () =>
      Object.entries(actionFeeApplicationModes || {})
        .filter(([action, mode]) => action && FEE_APPLICATION_MODES.has(String(mode || '').toUpperCase()))
        .sort(([left], [right]) => String(left).localeCompare(String(right))),
    [actionFeeApplicationModes]
  );

  const availableActionFeeModeActions = useMemo(() => {
    const configured = new Set(actionFeeModeEntries.map(([action]) => String(action)));
    return ACTION_OPTIONS.filter((action) => !configured.has(action));
  }, [actionFeeModeEntries]);

  const actionMinimumAmountEntries = useMemo(
    () =>
      Object.entries(actionMinimumAmounts || {})
        .map(([action, amount]) => [String(action || '').trim(), String(amount ?? '').trim()])
        .filter(([action, amount]) => action && amount !== '')
        .sort(([left], [right]) => left.localeCompare(right)),
    [actionMinimumAmounts]
  );

  const actionMaximumAmountEntries = useMemo(
    () =>
      Object.entries(actionMaximumAmounts || {})
        .map(([action, amount]) => [String(action || '').trim(), String(amount ?? '').trim()])
        .filter(([action, amount]) => action && amount !== '')
        .sort(([left], [right]) => left.localeCompare(right)),
    [actionMaximumAmounts]
  );

  const actionAmountLimitEntries = useMemo(() => {
    const actions = new Set([
      ...actionMinimumAmountEntries.map(([action]) => String(action)),
      ...actionMaximumAmountEntries.map(([action]) => String(action))
    ]);
    return Array.from(actions)
      .sort((left, right) => left.localeCompare(right))
      .map((action) => [
        action,
        {
          minimum: String(actionMinimumAmounts?.[action] ?? '').trim(),
          maximum: String(actionMaximumAmounts?.[action] ?? '').trim()
        }
      ]);
  }, [actionMaximumAmountEntries, actionMaximumAmounts, actionMinimumAmountEntries, actionMinimumAmounts]);

  const availableActionAmountLimitActions = useMemo(() => {
    const configured = new Set(actionAmountLimitEntries.map(([action]) => String(action)));
    return ACTION_OPTIONS.filter((action) => !configured.has(action));
  }, [actionAmountLimitEntries]);

  const cryptoCurrencyOptions = useMemo(() => {
    const known = new Set(DEFAULT_CRYPTO_CURRENCY_OPTIONS);
    for (const item of cryptoProducts) {
      const key = normalizeRailKeyPart(item?.code || item?.currency || item?.name || item?.displayName);
      if (key) known.add(key);
    }
    for (const railKey of Object.keys(sendCryptoAutoPayoutRails || {})) {
      const [currency] = String(railKey).split(':');
      if (currency) known.add(currency);
    }
    return Array.from(known).sort();
  }, [cryptoProducts, sendCryptoAutoPayoutRails]);

  const cryptoNetworkOptions = useMemo(() => {
    const known = new Set(DEFAULT_CRYPTO_NETWORK_OPTIONS);
    for (const item of cryptoNetworks) {
      const key = normalizeRailKeyPart(item?.cryptoNetworkName || item?.cryptoNetworkCode || item?.name || item?.displayName);
      if (key) known.add(key);
    }
    for (const railKey of Object.keys(sendCryptoAutoPayoutRails || {})) {
      const parts = String(railKey).split(':');
      if (parts[1]) known.add(parts[1]);
    }
    return Array.from(known).sort();
  }, [cryptoNetworks, sendCryptoAutoPayoutRails]);

  const railEntries = useMemo(
    () =>
      Object.entries(sendCryptoAutoPayoutRails || {})
        .filter(([key]) => key && key.includes(':'))
        .sort(([left], [right]) => left.localeCompare(right)),
    [sendCryptoAutoPayoutRails]
  );

  const paymentMethodOptions = useMemo(
    () =>
      normalizeList(paymentMethods)
        .map((method) => {
          const id = method?.id;
          if (id === null || id === undefined) return null;
          const type = String(method?.type || '').trim().toUpperCase();
          const name = String(method?.displayName || method?.name || '').trim();
          return {
            value: String(id),
            type,
            label: name ? `${name} (#${id}${type ? ` · ${humanizeEnum(type)}` : ''})` : `#${id}${type ? ` · ${humanizeEnum(type)}` : ''}`
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.label.localeCompare(right.label)),
    [paymentMethods]
  );

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const params = new URLSearchParams({ page: '0', size: '250' });
      const [res, cryptoProductsRes, cryptoNetworksRes, paymentMethodsRes] = await Promise.all([
        api.walletPolicyConfig.get(),
        api.cryptoProducts.list(params),
        api.cryptoNetworks.list(params),
        api.paymentMethods.list(params)
      ]);
      setConfigSnapshot(res || {});
      setCryptoProducts(normalizeList(cryptoProductsRes));
      setCryptoNetworks(normalizeList(cryptoNetworksRes));
      setPaymentMethods(normalizeList(paymentMethodsRes));
      const value = res?.interTransferCooldownMinutes;
      setCooldown(value === null || value === undefined ? '' : String(value));
      const incomingActions = Array.isArray(res?.payoutRateLimitActions) ? res.payoutRateLimitActions : [];
      setPayoutRateLimitActions(incomingActions.filter((action) => ALLOWED_PAYOUT_ACTIONS.includes(String(action))));
      setAutoRefundBlockedActions(Array.isArray(res?.autoRefundBlockedActions) ? res.autoRefundBlockedActions.map((action) => String(action)).filter(Boolean) : []);
      setCryptoProviderCollectionMinimumUsd(formatUsdValue(res?.cryptoProviderCollectionMinimumUsd));
      setCryptoProviderCollectionMaximumUsd(formatUsdValue(res?.cryptoProviderCollectionMaximumUsd));
      setSendAirtimeMinimumUsd(formatUsdValue(res?.sendAirtimeMinimumUsd));
      setPaypalMinimumPayoutUsd(formatUsdValue(res?.paypalMinimumPayoutUsd));
      setPayoutKycThresholdUsd(formatUsdValue(res?.payoutKycThresholdUsd));
      setForcePayoutKycUnlessApproved(Boolean(res?.forcePayoutKycUnlessApproved));
      setForceKycBeforeAppUse(Boolean(res?.forceKycBeforeAppUse));
      setSendCryptoExternalProviderEnabled(Boolean(res?.sendCryptoExternalProviderEnabled));
      setSendCryptoAutoPayoutRails(normalizeRailMap(res?.sendCryptoAutoPayoutRails));
      setDepositPromptThresholdAmount(formatUsdValue(res?.depositPromptThresholdAmount));
      setTransactionsEligibleForLoanEligibility(res?.transactionsEligibleForLoanEligibility !== false);
      const reviewPromptThreshold = res?.reviewPromptCompletedTransactionsThreshold;
      setReviewPromptCompletedTransactionsThreshold(
        reviewPromptThreshold === null || reviewPromptThreshold === undefined ? '' : String(reviewPromptThreshold)
      );
      setGlobalFeeApplicationMode(String(res?.globalFeeApplicationMode || 'EXCLUSIVE').toUpperCase());
      const incomingActionFeeModes =
        res?.actionFeeApplicationModes && typeof res.actionFeeApplicationModes === 'object' ? res.actionFeeApplicationModes : {};
      const normalizedActionFeeModes = Object.fromEntries(
        Object.entries(incomingActionFeeModes)
          .map(([action, mode]) => [String(action || '').trim(), String(mode || '').toUpperCase()])
          .filter(([action, mode]) => action && FEE_APPLICATION_MODES.has(mode))
      );
      setActionFeeApplicationModes(normalizedActionFeeModes);
      const incomingActionMinimumAmounts =
        res?.actionMinimumAmounts && typeof res.actionMinimumAmounts === 'object' ? res.actionMinimumAmounts : {};
      const normalizedActionMinimumAmounts = Object.fromEntries(
        Object.entries(incomingActionMinimumAmounts)
          .map(([action, amount]) => [String(action || '').trim(), formatUsdValue(amount)])
          .filter(([action, amount]) => action && amount !== '')
      );
      setActionMinimumAmounts(normalizedActionMinimumAmounts);
      const incomingActionMaximumAmounts =
        res?.actionMaximumAmounts && typeof res.actionMaximumAmounts === 'object' ? res.actionMaximumAmounts : {};
      const normalizedActionMaximumAmounts = Object.fromEntries(
        Object.entries(incomingActionMaximumAmounts)
          .map(([action, amount]) => [String(action || '').trim(), formatUsdValue(amount)])
          .filter(([action, amount]) => action && amount !== '')
      );
      setActionMaximumAmounts(normalizedActionMaximumAmounts);
      setCollectionSourceRiskRules(normalizeCollectionSourceRiskRulesFromResponse(res?.collectionSourceRiskRules));
    } catch (err) {
      setError(err?.message || 'Failed to load wallet policy config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const parsed = Number(cooldown);
    if (!Number.isInteger(parsed) || parsed < MIN_COOLDOWN || parsed > MAX_COOLDOWN) {
      setError(`Inter-transfer cooldown must be an integer between ${MIN_COOLDOWN} and ${MAX_COOLDOWN}.`);
      return;
    }
    const normalizedActions = Array.from(
      new Set(
        (Array.isArray(payoutRateLimitActions) ? payoutRateLimitActions : [])
          .map((action) => String(action || '').trim())
          .filter((action) => ALLOWED_PAYOUT_ACTIONS.includes(action))
      )
    );
    const normalizedAutoRefundBlockedActions = Array.from(
      new Set(
        (Array.isArray(autoRefundBlockedActions) ? autoRefundBlockedActions : [])
          .map((action) => String(action || '').trim())
          .filter(Boolean)
      )
    );
    const normalizedActionFeeModes = Object.fromEntries(
      Object.entries(actionFeeApplicationModes || {})
        .map(([action, mode]) => [String(action || '').trim(), String(mode || '').toUpperCase()])
        .filter(([action, mode]) => action && FEE_APPLICATION_MODES.has(mode))
    );
    const normalizedActionMinimumAmounts = {};
    for (const [action, amount] of Object.entries(actionMinimumAmounts || {})) {
      const normalizedAction = String(action || '').trim();
      const rawAmount = String(amount ?? '').trim();
      if (!normalizedAction || rawAmount === '') continue;
      if (!ACTION_OPTIONS.includes(normalizedAction)) {
        setError(`Unknown action key in minimum amounts: ${normalizedAction}.`);
        return;
      }
      const parsedAmount = Number(rawAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setError(`Minimum amount for ${humanizeEnum(normalizedAction)} must be a positive amount.`);
        return;
      }
      normalizedActionMinimumAmounts[normalizedAction] = parsedAmount.toFixed(2);
    }
    const normalizedActionMaximumAmounts = {};
    for (const [action, amount] of Object.entries(actionMaximumAmounts || {})) {
      const normalizedAction = String(action || '').trim();
      const rawAmount = String(amount ?? '').trim();
      if (!normalizedAction || rawAmount === '') continue;
      if (!ACTION_OPTIONS.includes(normalizedAction)) {
        setError(`Unknown action key in maximum amounts: ${normalizedAction}.`);
        return;
      }
      const parsedAmount = Number(rawAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setError(`Maximum amount for ${humanizeEnum(normalizedAction)} must be a positive amount.`);
        return;
      }
      normalizedActionMaximumAmounts[normalizedAction] = parsedAmount.toFixed(2);
    }
    for (const action of ACTION_OPTIONS) {
      const minimumAmount = normalizedActionMinimumAmounts[action];
      const maximumAmount = normalizedActionMaximumAmounts[action];
      if (minimumAmount === undefined || maximumAmount === undefined) continue;
      if (Number(minimumAmount) > Number(maximumAmount)) {
        setError(`Minimum amount for ${humanizeEnum(action)} must be less than or equal to the maximum amount.`);
        return;
      }
    }
    const minRaw = String(cryptoProviderCollectionMinimumUsd || '').trim();
    const maxRaw = String(cryptoProviderCollectionMaximumUsd || '').trim();
    const sendAirtimeMinimumRaw = String(sendAirtimeMinimumUsd || '').trim();
    const paypalMinimumPayoutRaw = String(paypalMinimumPayoutUsd || '').trim();
    const payoutKycThresholdRaw = String(payoutKycThresholdUsd || '').trim();
    const reviewPromptThresholdRaw = String(reviewPromptCompletedTransactionsThreshold || '').trim();
    const depositPromptThresholdRaw = String(depositPromptThresholdAmount || '').trim();
    const normalizedSendCryptoAutoPayoutRails = normalizeRailMap(sendCryptoAutoPayoutRails);
    const minParsed = minRaw === '' ? null : Number(minRaw);
    const maxParsed = maxRaw === '' ? null : Number(maxRaw);
    const sendAirtimeMinimumParsed = sendAirtimeMinimumRaw === '' ? null : Number(sendAirtimeMinimumRaw);
    const paypalMinimumPayoutParsed = paypalMinimumPayoutRaw === '' ? null : Number(paypalMinimumPayoutRaw);
    const payoutKycThresholdParsed = payoutKycThresholdRaw === '' ? null : Number(payoutKycThresholdRaw);
    const reviewPromptThresholdParsed = reviewPromptThresholdRaw === '' ? null : Number(reviewPromptThresholdRaw);
    const depositPromptThresholdParsed = depositPromptThresholdRaw === '' ? null : Number(depositPromptThresholdRaw);
    if (minRaw !== '' && (!Number.isFinite(minParsed) || minParsed <= 0)) {
      setError('Minimum amount must be greater than 0.');
      return;
    }
    if (maxRaw !== '' && (!Number.isFinite(maxParsed) || maxParsed <= 0)) {
      setError('Maximum amount must be greater than 0.');
      return;
    }
    if (minParsed !== null && maxParsed !== null && minParsed > maxParsed) {
      setError('Minimum amount must be less than or equal to maximum amount.');
      return;
    }
    if (sendAirtimeMinimumRaw !== '' && (!Number.isFinite(sendAirtimeMinimumParsed) || sendAirtimeMinimumParsed <= 0)) {
      setError('Minimum send airtime amount must be a positive amount.');
      return;
    }
    if (paypalMinimumPayoutRaw !== '' && (!Number.isFinite(paypalMinimumPayoutParsed) || paypalMinimumPayoutParsed <= 0)) {
      setError('Minimum PayPal payout amount must be a positive amount.');
      return;
    }
    if (payoutKycThresholdRaw !== '' && (!Number.isFinite(payoutKycThresholdParsed) || payoutKycThresholdParsed <= 0)) {
      setError('Payout KYC threshold must be a positive amount.');
      return;
    }
    if (
      reviewPromptThresholdRaw !== '' &&
      (!Number.isInteger(reviewPromptThresholdParsed) || reviewPromptThresholdParsed < MIN_REVIEW_PROMPT_THRESHOLD)
    ) {
      setError(`Review prompt completed transactions threshold must be a positive integer greater than or equal to ${MIN_REVIEW_PROMPT_THRESHOLD}.`);
      return;
    }
    if (depositPromptThresholdRaw !== '' && (!Number.isFinite(depositPromptThresholdParsed) || depositPromptThresholdParsed <= 0)) {
      setError('Deposit prompt threshold amount must be a positive amount.');
      return;
    }
    const normalizedCollectionSourceRiskRules = [];
    const collectionSourceRiskRuleKeys = new Set();
    for (const [ruleIndex, rawRule] of (Array.isArray(collectionSourceRiskRules) ? collectionSourceRiskRules : []).entries()) {
      const rule = normalizeCollectionSourceRiskRuleDraft(rawRule) || createEmptyCollectionSourceRiskRule();
      if (!rule.action) {
        setError(`Collection source risk rule ${ruleIndex + 1} must include an action.`);
        return;
      }
      if (!ACTION_OPTIONS.includes(rule.action)) {
        setError(`Collection source risk rule ${ruleIndex + 1} uses an unknown action: ${rule.action}.`);
        return;
      }
      const normalizedPaymentMethodType = rule.paymentMethodType ? String(rule.paymentMethodType).trim().toUpperCase() : null;
      if (normalizedPaymentMethodType && !PAYMENT_METHOD_TYPE_OPTIONS.includes(normalizedPaymentMethodType)) {
        setError(`Collection source risk rule ${ruleIndex + 1} uses an unknown payment method type: ${normalizedPaymentMethodType}.`);
        return;
      }
      const paymentMethodIdRaw = String(rule.paymentMethodId ?? '').trim();
      const normalizedPaymentMethodId = paymentMethodIdRaw === '' ? null : Number(paymentMethodIdRaw);
      if (paymentMethodIdRaw !== '' && (!Number.isInteger(normalizedPaymentMethodId) || normalizedPaymentMethodId <= 0)) {
        setError(`Collection source risk rule ${ruleIndex + 1} must use a valid payment method.`);
        return;
      }
      const scopeKey = [rule.action, normalizedPaymentMethodType || '', normalizedPaymentMethodId || ''].join('|');
      if (collectionSourceRiskRuleKeys.has(scopeKey)) {
        setError(`Collection source risk rule ${ruleIndex + 1} duplicates another rule with the same action and scope.`);
        return;
      }
      collectionSourceRiskRuleKeys.add(scopeKey);
      if (!Array.isArray(rule.thresholds) || rule.thresholds.length === 0) {
        setError(`Collection source risk rule ${ruleIndex + 1} must include at least one threshold.`);
        return;
      }
      const thresholdKeys = new Set();
      const normalizedThresholds = [];
      for (const [thresholdIndex, threshold] of rule.thresholds.entries()) {
        const maxDistinctSourcesRaw = normalizePositiveIntegerString(threshold?.maxDistinctSources);
        const windowMinutesRaw = normalizePositiveIntegerString(threshold?.windowMinutes);
        const consequence = String(threshold?.consequence || '').trim().toUpperCase();
        const maxDistinctSources = Number(maxDistinctSourcesRaw);
        const windowMinutes = Number(windowMinutesRaw);
        if (!Number.isInteger(maxDistinctSources) || maxDistinctSources <= 0) {
          setError(`Collection source risk rule ${ruleIndex + 1}, threshold ${thresholdIndex + 1}: max distinct sources must be a positive integer.`);
          return;
        }
        if (!Number.isInteger(windowMinutes) || windowMinutes <= 0) {
          setError(`Collection source risk rule ${ruleIndex + 1}, threshold ${thresholdIndex + 1}: window minutes must be a positive integer.`);
          return;
        }
        if (!COLLECTION_SOURCE_RISK_CONSEQUENCE_OPTIONS.includes(consequence)) {
          setError(`Collection source risk rule ${ruleIndex + 1}, threshold ${thresholdIndex + 1}: consequence must be WARNING or BLACKLIST.`);
          return;
        }
        const thresholdKey = [maxDistinctSources, windowMinutes, consequence].join('|');
        if (thresholdKeys.has(thresholdKey)) {
          setError(`Collection source risk rule ${ruleIndex + 1} contains a duplicate threshold row.`);
          return;
        }
        thresholdKeys.add(thresholdKey);
        normalizedThresholds.push({ maxDistinctSources, windowMinutes, consequence });
      }
      normalizedThresholds.sort(compareCollectionSourceRiskThresholds);
      normalizedCollectionSourceRiskRules.push({
        action: rule.action,
        paymentMethodType: normalizedPaymentMethodType,
        paymentMethodId: normalizedPaymentMethodId,
        thresholds: normalizedThresholds
      });
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.walletPolicyConfig.update({
        ...(configSnapshot && typeof configSnapshot === 'object' ? configSnapshot : {}),
        interTransferCooldownMinutes: parsed,
        payoutRateLimitActions: normalizedActions,
        cryptoProviderCollectionMinimumUsd: minRaw === '' ? '' : minParsed.toFixed(2),
        cryptoProviderCollectionMaximumUsd: maxRaw === '' ? '' : maxParsed.toFixed(2),
        sendAirtimeMinimumUsd: sendAirtimeMinimumRaw === '' ? '' : sendAirtimeMinimumParsed.toFixed(2),
        paypalMinimumPayoutUsd: paypalMinimumPayoutRaw === '' ? '' : paypalMinimumPayoutParsed.toFixed(2),
        payoutKycThresholdUsd: payoutKycThresholdRaw === '' ? '' : payoutKycThresholdParsed.toFixed(2),
        forcePayoutKycUnlessApproved: Boolean(forcePayoutKycUnlessApproved),
        forceKycBeforeAppUse: Boolean(forceKycBeforeAppUse),
        sendCryptoExternalProviderEnabled: Boolean(sendCryptoExternalProviderEnabled),
        sendCryptoAutoPayoutRails: normalizedSendCryptoAutoPayoutRails,
        depositPromptThresholdAmount: depositPromptThresholdRaw === '' ? null : depositPromptThresholdParsed.toFixed(2),
        transactionsEligibleForLoanEligibility: Boolean(transactionsEligibleForLoanEligibility),
        reviewPromptCompletedTransactionsThreshold:
          reviewPromptThresholdRaw === '' ? null : reviewPromptThresholdParsed,
        autoRefundBlockedActions: normalizedAutoRefundBlockedActions,
        globalFeeApplicationMode: globalFeeApplicationMode || 'EXCLUSIVE',
        actionFeeApplicationModes: normalizedActionFeeModes,
        actionMinimumAmounts: normalizedActionMinimumAmounts,
        actionMaximumAmounts: normalizedActionMaximumAmounts,
        collectionSourceRiskRules: normalizedCollectionSourceRiskRules
      });
      setInfo('Wallet policy config updated.');
      await loadConfig();
    } catch (err) {
      setError(err?.message || 'Failed to save wallet policy config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '100%' }}>
      <div className="card" style={{ display: 'grid', gap: '0.3rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Wallet Policy Config</div>
        <div style={{ color: 'var(--muted)' }}>
          Controls INTER_TRANSFER protection: same sender cannot transfer again to the same recipient until cooldown expires.
        </div>
        <div style={{ color: 'var(--muted)' }}>
          Also controls payout anti-fraud gate for repeated payouts to the same recipient within the cooldown window.
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div className="config-tabs-shell">
        <div className="config-tabs" role="tablist" aria-label="Wallet policy sections">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              id={`wallet-policy-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`wallet-policy-panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              className={`config-tab${activeTab === tab.key ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              disabled={loading || saving}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          id={`wallet-policy-panel-${activeTab}`}
          className="card config-tab-panel"
          role="tabpanel"
          aria-labelledby={`wallet-policy-tab-${activeTab}`}
          style={{ display: 'grid', gap: '0.75rem' }}
        >
        {activeTab === 'overview' && (
          <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="interTransferCooldownMinutes">Inter-transfer cooldown (minutes)</label>
          <input
            id="interTransferCooldownMinutes"
            type="number"
            min={MIN_COOLDOWN}
            max={MAX_COOLDOWN}
            step={1}
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
            placeholder="10"
            disabled={loading || saving}
          />
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Allowed range: {MIN_COOLDOWN} to {MAX_COOLDOWN} minutes.
          </div>
        </div>
          </>
        )}

        {activeTab === 'fees' && (
          <>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Global Fee Mode</div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Default-of-defaults for fee application across the platform.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '360px' }}>
            <label htmlFor="globalFeeApplicationMode">Default fee mode for all actions</label>
            <select
              id="globalFeeApplicationMode"
              value={globalFeeApplicationMode}
              onChange={(e) => setGlobalFeeApplicationMode(e.target.value)}
              disabled={loading || saving}
            >
              {feeApplicationModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Used only when no action-level wallet policy default, fee-config row mode, or account override is configured.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              App-requested mode, account overrides, fee-config row modes, and action-level wallet policy defaults all win over this master default.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: '0.2rem' }}>
              <div style={{ fontWeight: 700 }}>Action-specific fee mode defaults</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                These defaults apply to a specific action without requiring a fee-config row mode.
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                If a fee-config row or account override sets a fee mode, that more specific rule wins.
              </div>
            </div>

            <button
              type="button"
              className="btn-neutral"
              disabled={loading || saving || availableActionFeeModeActions.length === 0}
              onClick={() => {
                const nextAction = availableActionFeeModeActions[0];
                if (!nextAction) return;
                setError(null);
                setActionFeeApplicationModes((prev) => ({
                  ...(prev && typeof prev === 'object' ? prev : {}),
                  [nextAction]: 'EXCLUSIVE'
                }));
              }}
            >
              Add action override
            </button>
          </div>

          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Remove an action from this list to let it inherit from the master global fee mode.
          </div>

          {actionFeeModeEntries.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {actionFeeModeEntries.map(([action, mode], index) => (
                <div
                  key={action}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(220px, 1.3fr) minmax(220px, 1fr) auto',
                    gap: '0.6rem',
                    alignItems: 'end',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ display: 'grid', gap: '0.25rem' }}>
                    <label htmlFor={`actionFeeApplicationModes-action-${index}`}>Action</label>
                    <select
                      id={`actionFeeApplicationModes-action-${index}`}
                      value={action}
                      onChange={(e) => {
                        const nextAction = String(e.target.value || '').trim();
                        if (!nextAction || nextAction === action) return;
                        if (actionFeeApplicationModes[nextAction]) {
                          setError(`Fee mode for ${nextAction} is already configured in wallet policy.`);
                          return;
                        }
                        setError(null);
                        setActionFeeApplicationModes((prev) => {
                          const next = { ...(prev && typeof prev === 'object' ? prev : {}) };
                          const currentMode = next[action] || mode;
                          delete next[action];
                          next[nextAction] = currentMode;
                          return next;
                        });
                      }}
                      disabled={loading || saving}
                    >
                      {[action, ...availableActionFeeModeActions].map((option) => (
                        <option key={option} value={option}>
                          {humanizeEnum(option)} ({option})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gap: '0.25rem' }}>
                    <label htmlFor={`actionFeeApplicationModes-mode-${index}`}>Fee mode</label>
                    <select
                      id={`actionFeeApplicationModes-mode-${index}`}
                      value={mode}
                      onChange={(e) => {
                        const nextMode = String(e.target.value || '').toUpperCase();
                        setError(null);
                        setActionFeeApplicationModes((prev) => ({
                          ...(prev && typeof prev === 'object' ? prev : {}),
                          [action]: FEE_APPLICATION_MODES.has(nextMode) ? nextMode : 'EXCLUSIVE'
                        }));
                      }}
                      disabled={loading || saving}
                    >
                      {feeApplicationModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => {
                      setError(null);
                      setActionFeeApplicationModes((prev) => {
                        const next = { ...(prev && typeof prev === 'object' ? prev : {}) };
                        delete next[action];
                        return next;
                      });
                    }}
                    disabled={loading || saving}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '0.85rem',
                border: '1px dashed var(--border)',
                borderRadius: '12px',
                color: 'var(--muted)',
                fontSize: '13px'
              }}
            >
              No action-level fee mode defaults configured. All actions currently inherit from the master global fee mode unless a more specific rule exists.
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: '0.2rem' }}>
              <div style={{ fontWeight: 700 }}>Amount Limits Per Action</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Configure minimum and maximum USD amounts per action. Leave either field blank to keep no wallet-policy override for that bound.
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                These are generic wallet-policy limits. Stricter provider or product limits can still reject later.
              </div>
            </div>

            <button
              type="button"
              className="btn-neutral"
              disabled={loading || saving || availableActionAmountLimitActions.length === 0}
              onClick={() => {
                const nextAction = availableActionAmountLimitActions[0];
                if (!nextAction) return;
                setError(null);
                setActionMinimumAmounts((prev) => ({
                  ...(prev && typeof prev === 'object' ? prev : {}),
                  [nextAction]: ''
                }));
                setActionMaximumAmounts((prev) => ({
                  ...(prev && typeof prev === 'object' ? prev : {}),
                  [nextAction]: ''
                }));
              }}
            >
              Add action limit
            </button>
          </div>

          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Values must be positive USD amounts like `5.00` or `10.00`. If both values are set for one action, minimum must be less than or equal to maximum.
          </div>

          {actionAmountLimitEntries.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {actionAmountLimitEntries.map(([action, limits], index) => (
                  <div
                    key={action}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(220px, 1.3fr) minmax(180px, 1fr) minmax(180px, 1fr) auto',
                      gap: '0.6rem',
                      alignItems: 'end',
                      padding: '0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      <label htmlFor={`actionMinimumAmounts-action-${index}`}>Action</label>
                      <select
                        id={`actionMinimumAmounts-action-${index}`}
                        value={action}
                        onChange={(e) => {
                          const nextAction = String(e.target.value || '').trim();
                          if (!nextAction || nextAction === action) return;
                          if (actionMinimumAmounts[nextAction] !== undefined || actionMaximumAmounts[nextAction] !== undefined) {
                            setError(`Amount limits for ${nextAction} are already configured in wallet policy.`);
                            return;
                          }
                          setError(null);
                          setActionMinimumAmounts((prev) => {
                            const next = { ...(prev && typeof prev === 'object' ? prev : {}) };
                            const currentAmount = next[action] ?? '';
                            delete next[action];
                            next[nextAction] = currentAmount;
                            return next;
                          });
                          setActionMaximumAmounts((prev) => {
                            const next = { ...(prev && typeof prev === 'object' ? prev : {}) };
                            const currentAmount = next[action] ?? '';
                            delete next[action];
                            next[nextAction] = currentAmount;
                            return next;
                          });
                        }}
                        disabled={loading || saving}
                      >
                        {[action, ...availableActionAmountLimitActions].map((option) => (
                          <option key={option} value={option}>
                            {humanizeEnum(option)} ({option})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      <label htmlFor={`actionMinimumAmounts-value-${index}`}>Minimum amount (USD)</label>
                      <input
                        id={`actionMinimumAmounts-value-${index}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        value={limits.minimum}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setError(null);
                          setActionMinimumAmounts((prev) => ({
                            ...(prev && typeof prev === 'object' ? prev : {}),
                            [action]: nextValue
                          }));
                        }}
                        onBlur={() => {
                          setActionMinimumAmounts((prev) => ({
                            ...(prev && typeof prev === 'object' ? prev : {}),
                            [action]: formatUsdValue(String((prev && prev[action]) || '').trim())
                          }));
                        }}
                        placeholder="5.00"
                        disabled={loading || saving}
                      />
                    </div>

                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      <label htmlFor={`actionMaximumAmounts-value-${index}`}>Maximum amount (USD)</label>
                      <input
                        id={`actionMaximumAmounts-value-${index}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        value={limits.maximum}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setError(null);
                          setActionMaximumAmounts((prev) => ({
                            ...(prev && typeof prev === 'object' ? prev : {}),
                            [action]: nextValue
                          }));
                        }}
                        onBlur={() => {
                          setActionMaximumAmounts((prev) => ({
                            ...(prev && typeof prev === 'object' ? prev : {}),
                            [action]: formatUsdValue(String((prev && prev[action]) || '').trim())
                          }));
                        }}
                        placeholder="500.00"
                        disabled={loading || saving}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => {
                        setError(null);
                        setActionMinimumAmounts((prev) => {
                          const next = { ...(prev && typeof prev === 'object' ? prev : {}) };
                          delete next[action];
                          return next;
                        });
                        setActionMaximumAmounts((prev) => {
                          const next = { ...(prev && typeof prev === 'object' ? prev : {}) };
                          delete next[action];
                          return next;
                        });
                      }}
                      disabled={loading || saving}
                    >
                      Remove
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <div
              style={{
                padding: '0.85rem',
                border: '1px dashed var(--border)',
                borderRadius: '12px',
                color: 'var(--muted)',
                fontSize: '13px'
              }}
            >
              No action-specific amount limits configured.
            </div>
          )}
        </div>
          </>
        )}

        {activeTab === 'operations' && (
          <>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Payout rate limit actions</div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Select payout actions gated by cooldown. Empty selection disables payout gate for all actions.
          </div>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            {ALLOWED_PAYOUT_ACTIONS.map((action) => {
              const checked = payoutRateLimitActions.includes(action);
              return (
                <label key={action} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.45rem' }}>
                  <span>{action}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setPayoutRateLimitActions((prev) => {
                        const set = new Set(prev);
                        if (isChecked) set.add(action);
                        else set.delete(action);
                        return Array.from(set);
                      });
                    }}
                    disabled={loading || saving}
                    style={{ margin: 0 }}
                  />
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Block Auto Refund For Actions</div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            If an action is selected here, failed transactions for that action will not be auto-refunded. They will be marked for manual refund instead.
          </div>
          <div style={{ display: 'grid', gap: '0.6rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                {selectedAutoRefundBlockedActions.length > 0
                  ? `${selectedAutoRefundBlockedActions.length} action${selectedAutoRefundBlockedActions.length === 1 ? '' : 's'} blocked from auto-refund`
                  : 'No actions blocked from auto-refund'}
              </div>
              {selectedAutoRefundBlockedActions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAutoRefundBlockedActions([])}
                  disabled={loading || saving}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    padding: 0
                  }}
                >
                  Clear all
                </button>
              )}
            </div>

            {selectedAutoRefundBlockedActions.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {selectedAutoRefundBlockedActions.map((action) => (
                  <span key={action} style={autoRefundChipStyle}>
                    <span>{humanizeEnum(action)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAutoRefundBlockedActions((prev) => prev.filter((item) => String(item) !== action))
                      }
                      disabled={loading || saving}
                      aria-label={`Remove ${humanizeEnum(action)}`}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: 0,
                        fontWeight: 900,
                        lineHeight: 1
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--accent)' }}>
                Add or remove actions
              </summary>
              <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.65rem' }}>
                <input
                  type="search"
                  value={autoRefundActionSearch}
                  onChange={(e) => setAutoRefundActionSearch(e.target.value)}
                  placeholder="Search actions"
                  disabled={loading || saving}
                />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    gap: 0,
                    maxHeight: '220px',
                    overflow: 'auto',
                    padding: 0,
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    background: 'color-mix(in srgb, var(--surface) 96%, var(--bg) 4%)'
                  }}
                >
                  {filteredAutoRefundActionOptions.map((action) => {
                    const checked = selectedAutoRefundBlockedActions.includes(action);
                    return (
                      <label
                        key={action}
                        style={{
                          display: 'grid',
                          gap: 0,
                          minWidth: 0,
                          padding: 0,
                          borderRadius: '6px',
                          background: checked ? 'var(--accent-soft)' : 'transparent'
                        }}
                      >
                        <span style={{ overflowWrap: 'anywhere', lineHeight: 1 }}>
                          {humanizeEnum(action)} <span style={{ color: 'var(--muted)' }}>({action})</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setAutoRefundBlockedActions((prev) => {
                              const set = new Set(prev.map((item) => String(item)));
                              if (isChecked) set.add(action);
                              else set.delete(action);
                              return Array.from(set);
                            });
                          }}
                          disabled={loading || saving}
                          style={{ margin: 0 }}
                        />
                      </label>
                    );
                  })}
                  {filteredAutoRefundActionOptions.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No matching actions.</div>
                  ) : null}
                </div>
              </div>
            </details>

            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Empty selection means no actions are blocked from auto-refund.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: '0.2rem' }}>
              <div style={{ fontWeight: 700 }}>Collection Source Risk Rules</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Distinct-source protection for recent non-completed collection attempts. Use a lower WARNING threshold for cooldown behavior, then a higher BLACKLIST threshold for stronger enforcement.
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Resolution order is exact payment method, then payment method type, then action-only.
              </div>
            </div>

            <button
              type="button"
              className="btn-neutral"
              disabled={loading || saving}
              onClick={() => {
                setError(null);
                setCollectionSourceRiskRules((prev) => [...(Array.isArray(prev) ? prev : []), createEmptyCollectionSourceRiskRule()]);
              }}
            >
              Add rule
            </button>
          </div>

          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Recommended default: `3 in 5 min → WARNING`, then `5 in 5 min → BLACKLIST`.
          </div>

          {collectionSourceRiskRules.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {collectionSourceRiskRules.map((rule, ruleIndex) => (
                <div
                  key={`collection-source-risk-rule-${ruleIndex}`}
                  style={{
                    display: 'grid',
                    gap: '0.75rem',
                    padding: '0.85rem',
                    border: '1px solid var(--border)',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700 }}>Rule {ruleIndex + 1}</div>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => {
                        setError(null);
                        setCollectionSourceRiskRules((prev) => prev.filter((_, index) => index !== ruleIndex));
                      }}
                      disabled={loading || saving}
                    >
                      Remove rule
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      <label htmlFor={`collectionSourceRiskRules-action-${ruleIndex}`}>Action</label>
                      <select
                        id={`collectionSourceRiskRules-action-${ruleIndex}`}
                        value={rule.action}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setError(null);
                          setCollectionSourceRiskRules((prev) =>
                            prev.map((item, index) => (index === ruleIndex ? { ...item, action: nextValue } : item))
                          );
                        }}
                        disabled={loading || saving}
                      >
                        <option value="">Select action</option>
                        {ACTION_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {humanizeEnum(option)} ({option})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      <label htmlFor={`collectionSourceRiskRules-type-${ruleIndex}`}>Payment method type</label>
                      <select
                        id={`collectionSourceRiskRules-type-${ruleIndex}`}
                        value={rule.paymentMethodType}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setError(null);
                          setCollectionSourceRiskRules((prev) =>
                            prev.map((item, index) => (index === ruleIndex ? { ...item, paymentMethodType: nextValue } : item))
                          );
                        }}
                        disabled={loading || saving}
                      >
                        <option value="">Any type</option>
                        {PAYMENT_METHOD_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {humanizeEnum(option)} ({option})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      <label htmlFor={`collectionSourceRiskRules-method-${ruleIndex}`}>Exact payment method</label>
                      <select
                        id={`collectionSourceRiskRules-method-${ruleIndex}`}
                        value={rule.paymentMethodId}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setError(null);
                          setCollectionSourceRiskRules((prev) =>
                            prev.map((item, index) => (index === ruleIndex ? { ...item, paymentMethodId: nextValue } : item))
                          );
                        }}
                        disabled={loading || saving}
                      >
                        <option value="">Any method</option>
                        {paymentMethodOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                        If set, this rule becomes the most specific match for that method.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'grid', gap: '0.2rem' }}>
                        <div style={{ fontWeight: 700 }}>Thresholds</div>
                        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                          Thresholds are shown from lowest to highest. Each rule needs at least one threshold.
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-neutral"
                        disabled={loading || saving}
                        onClick={() => {
                          setError(null);
                          setCollectionSourceRiskRules((prev) =>
                            prev.map((item, index) =>
                              index === ruleIndex
                                ? {
                                    ...item,
                                    thresholds: [...(Array.isArray(item.thresholds) ? item.thresholds : []), createEmptyCollectionSourceRiskThreshold()]
                                      .sort(compareCollectionSourceRiskThresholds)
                                  }
                                : item
                            )
                          );
                        }}
                      >
                        Add threshold
                      </button>
                    </div>

                    {(Array.isArray(rule.thresholds) ? rule.thresholds : []).map((threshold, thresholdIndex) => (
                      <div
                        key={`collection-source-risk-threshold-${ruleIndex}-${thresholdIndex}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) auto',
                          gap: '0.6rem',
                          alignItems: 'end',
                          padding: '0.75rem',
                          border: '1px solid var(--border)',
                          borderRadius: '12px'
                        }}
                      >
                        <div style={{ display: 'grid', gap: '0.25rem' }}>
                          <label htmlFor={`collectionSourceRiskRules-maxDistinctSources-${ruleIndex}-${thresholdIndex}`}>Max distinct sources</label>
                          <input
                            id={`collectionSourceRiskRules-maxDistinctSources-${ruleIndex}-${thresholdIndex}`}
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={threshold.maxDistinctSources}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              setError(null);
                              setCollectionSourceRiskRules((prev) =>
                                prev.map((item, index) =>
                                  index === ruleIndex
                                    ? {
                                        ...item,
                                        thresholds: (item.thresholds || []).map((entry, entryIndex) =>
                                          entryIndex === thresholdIndex ? { ...entry, maxDistinctSources: nextValue } : entry
                                        )
                                      }
                                    : item
                                )
                              );
                            }}
                            disabled={loading || saving}
                          />
                        </div>

                        <div style={{ display: 'grid', gap: '0.25rem' }}>
                          <label htmlFor={`collectionSourceRiskRules-windowMinutes-${ruleIndex}-${thresholdIndex}`}>Window (minutes)</label>
                          <input
                            id={`collectionSourceRiskRules-windowMinutes-${ruleIndex}-${thresholdIndex}`}
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={threshold.windowMinutes}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              setError(null);
                              setCollectionSourceRiskRules((prev) =>
                                prev.map((item, index) =>
                                  index === ruleIndex
                                    ? {
                                        ...item,
                                        thresholds: (item.thresholds || []).map((entry, entryIndex) =>
                                          entryIndex === thresholdIndex ? { ...entry, windowMinutes: nextValue } : entry
                                        )
                                      }
                                    : item
                                )
                              );
                            }}
                            disabled={loading || saving}
                          />
                        </div>

                        <div style={{ display: 'grid', gap: '0.25rem' }}>
                          <label htmlFor={`collectionSourceRiskRules-consequence-${ruleIndex}-${thresholdIndex}`}>Consequence</label>
                          <select
                            id={`collectionSourceRiskRules-consequence-${ruleIndex}-${thresholdIndex}`}
                            value={threshold.consequence}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              setError(null);
                              setCollectionSourceRiskRules((prev) =>
                                prev.map((item, index) =>
                                  index === ruleIndex
                                    ? {
                                        ...item,
                                        thresholds: (item.thresholds || [])
                                          .map((entry, entryIndex) =>
                                            entryIndex === thresholdIndex ? { ...entry, consequence: nextValue } : entry
                                          )
                                          .sort(compareCollectionSourceRiskThresholds)
                                      }
                                    : item
                                )
                              );
                            }}
                            disabled={loading || saving}
                          >
                            {COLLECTION_SOURCE_RISK_CONSEQUENCE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {humanizeEnum(option)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => {
                            setError(null);
                            setCollectionSourceRiskRules((prev) =>
                              prev.map((item, index) =>
                                index === ruleIndex
                                  ? {
                                      ...item,
                                      thresholds: (item.thresholds || []).filter((_, entryIndex) => entryIndex !== thresholdIndex)
                                    }
                                  : item
                              )
                            );
                          }}
                          disabled={loading || saving}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '0.85rem',
                border: '1px dashed var(--border)',
                borderRadius: '12px',
                color: 'var(--muted)',
                fontSize: '13px'
              }}
            >
              No collection source risk rules configured. Add a rule to define warning and blacklist thresholds per action, payment method type, or exact payment method.
            </div>
          )}
        </div>
          </>
        )}

        {activeTab === 'crypto' && (
          <>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Crypto Provider Collection Limits</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              These limits apply only when we create or submit an external crypto provider collection. Internal wallet-funded crypto flows are not affected.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Applies only when the flow sends the user to an external crypto provider. Leave blank for no minimum. Leave blank for no maximum.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="cryptoProviderCollectionMinimumUsd">Minimum amount (USD)</label>
              <input
                id="cryptoProviderCollectionMinimumUsd"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={cryptoProviderCollectionMinimumUsd}
                onChange={(e) => setCryptoProviderCollectionMinimumUsd(e.target.value)}
                onBlur={() => setCryptoProviderCollectionMinimumUsd((prev) => formatUsdValue(String(prev || '').trim()))}
                placeholder="10.00"
                disabled={loading || saving}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="cryptoProviderCollectionMaximumUsd">Maximum amount (USD)</label>
              <input
                id="cryptoProviderCollectionMaximumUsd"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={cryptoProviderCollectionMaximumUsd}
                onChange={(e) => setCryptoProviderCollectionMaximumUsd(e.target.value)}
                onBlur={() => setCryptoProviderCollectionMaximumUsd((prev) => formatUsdValue(String(prev || '').trim()))}
                placeholder="500.00"
                disabled={loading || saving}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Payout Limits</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Applies to all PayPal payout flows.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Leave blank to use the default minimum of 100.00 USD.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '280px' }}>
            <label htmlFor="paypalMinimumPayoutUsd">Minimum PayPal payout amount (USD)</label>
            <input
              id="paypalMinimumPayoutUsd"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={paypalMinimumPayoutUsd}
              onChange={(e) => setPaypalMinimumPayoutUsd(e.target.value)}
              onBlur={() => setPaypalMinimumPayoutUsd((prev) => formatUsdValue(String(prev || '').trim()))}
              placeholder="100.00"
              disabled={loading || saving}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Send crypto via external provider</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              The global flag is now the fallback. Exact crypto rails can override it below.
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.75rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={sendCryptoExternalProviderEnabled}
                onChange={(e) => setSendCryptoExternalProviderEnabled(e.target.checked)}
                disabled={loading || saving}
              />
              Enable external provider for send crypto
            </label>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If disabled, send crypto transactions will not be sent through the provider.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              They will remain in manual intervention for ops to fulfill manually.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If later failed or canceled, the customer&apos;s crypto wallet is refunded.
            </div>

            <div
              style={{
                display: 'grid',
                gap: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', gap: '0.2rem' }}>
                  <div style={{ fontWeight: 700 }}>Rail-specific overrides</div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    Exact `CURRENCY:NETWORK` rules win first. Unlisted rails fall back to the global flag above.
                  </div>
                </div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: railEntries.length ? '#dbeafe' : '#f3f4f6',
                    color: railEntries.length ? '#1d4ed8' : '#374151'
                  }}
                >
                  {railEntries.length} rail rule{railEntries.length === 1 ? '' : 's'}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(160px, 1fr) minmax(160px, 1fr) minmax(180px, 1fr) auto',
                  gap: '0.6rem',
                  alignItems: 'end'
                }}
              >
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <label htmlFor="railDraftCurrency">Crypto</label>
                  <select
                    id="railDraftCurrency"
                    value={railDraftCurrency}
                    onChange={(e) => setRailDraftCurrency(e.target.value)}
                    disabled={loading || saving}
                  >
                    <option value="">Select crypto</option>
                    {cryptoCurrencyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <label htmlFor="railDraftNetwork">Network</label>
                  <select
                    id="railDraftNetwork"
                    value={railDraftNetwork}
                    onChange={(e) => setRailDraftNetwork(e.target.value)}
                    disabled={loading || saving}
                  >
                    <option value="">Select network</option>
                    {cryptoNetworkOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <label htmlFor="railDraftEnabled">Behavior</label>
                  <select
                    id="railDraftEnabled"
                    value={railDraftEnabled ? 'AUTO' : 'MANUAL'}
                    onChange={(e) => setRailDraftEnabled(e.target.value === 'AUTO')}
                    disabled={loading || saving}
                  >
                    <option value="AUTO">Automatic payout</option>
                    <option value="MANUAL">Manual intervention</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn-neutral"
                  disabled={loading || saving}
                  onClick={() => {
                    const currency = normalizeRailKeyPart(railDraftCurrency);
                    const network = normalizeRailKeyPart(railDraftNetwork);
                    if (!currency || !network) {
                      setError('Choose both a crypto and a network before adding a rail rule.');
                      return;
                    }
                    const nextKey = `${currency}:${network}`;
                    setError(null);
                    setSendCryptoAutoPayoutRails((prev) => ({
                      ...(prev && typeof prev === 'object' ? prev : {}),
                      [nextKey]: Boolean(railDraftEnabled)
                    }));
                    setRailDraftCurrency('');
                    setRailDraftNetwork('');
                    setRailDraftEnabled(true);
                  }}
                >
                  Add rail rule
                </button>
              </div>

              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Example keys: `BTC:LIGHTNING`, `BTC:BTC`, `USDT:ERC20`, `USDT:TRC20`, `ETH:ERC20`.
              </div>

              {railEntries.length > 0 ? (
                <div style={{ display: 'grid', gap: '0.6rem' }}>
                  {railEntries.map(([railKey, enabled]) => {
                    const [currency, network] = String(railKey).split(':');
                    return (
                      <div
                        key={railKey}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(160px, 0.9fr) minmax(160px, 0.9fr) minmax(160px, 1fr) auto',
                          gap: '0.6rem',
                          alignItems: 'center',
                          padding: '0.75rem',
                          border: '1px solid var(--border)',
                          borderRadius: '12px'
                        }}
                      >
                        <div style={{ display: 'grid', gap: '0.15rem' }}>
                          <div style={{ fontWeight: 700 }}>Crypto</div>
                          <div>{currency || '—'}</div>
                        </div>
                        <div style={{ display: 'grid', gap: '0.15rem' }}>
                          <div style={{ fontWeight: 700 }}>Network</div>
                          <div>{network || '—'}</div>
                        </div>
                        <div style={{ display: 'grid', gap: '0.2rem' }}>
                          <div style={{ fontWeight: 700 }}>Effective behavior</div>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              width: 'fit-content',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '999px',
                              fontSize: '12px',
                              fontWeight: 700,
                              background: enabled ? '#dcfce7' : '#fee2e2',
                              color: enabled ? '#166534' : '#b91c1c'
                            }}
                          >
                            {enabled ? 'Automatic payout' : 'Manual intervention'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => {
                            setError(null);
                            setSendCryptoAutoPayoutRails((prev) => {
                              const next = { ...(prev && typeof prev === 'object' ? prev : {}) };
                              delete next[railKey];
                              return next;
                            });
                          }}
                          disabled={loading || saving}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    padding: '0.85rem',
                    border: '1px dashed var(--border)',
                    borderRadius: '12px',
                    color: 'var(--muted)',
                    fontSize: '13px'
                  }}
                >
                  No rail-specific overrides configured. All send-crypto rails currently inherit from the global external-provider flag.
                </div>
              )}
            </div>
          </div>
        </div>
          </>
        )}

        {activeTab === 'app' && (
          <>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>App &amp; Engagement Behavior</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Controls product behavior that the mobile app reads from `/customer-api/accounts/my-account`.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '320px' }}>
            <label htmlFor="reviewPromptCompletedTransactionsThreshold">Review prompt completed transactions threshold</label>
            <input
              id="reviewPromptCompletedTransactionsThreshold"
              type="number"
              min={MIN_REVIEW_PROMPT_THRESHOLD}
              step={1}
              inputMode="numeric"
              value={reviewPromptCompletedTransactionsThreshold}
              onChange={(e) => setReviewPromptCompletedTransactionsThreshold(e.target.value)}
              placeholder="5"
              disabled={loading || saving}
            />
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Minimum number of completed transactions before the mobile app may ask the user for an app review.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Leave blank to let backend fallback apply.
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.5rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700 }}>Home Deposit Prompt Threshold</div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: depositPromptThresholdAmount ? '#ecfccb' : '#f3f4f6',
                  color: depositPromptThresholdAmount ? '#3f6212' : '#374151'
                }}
              >
                {depositPromptThresholdAmount ? 'Threshold-based' : 'Client fallback'}
              </span>
            </div>

            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Visibility is managed by `wallet.deposit_prompt`.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '320px' }}>
              <label htmlFor="depositPromptThresholdAmount">Deposit Prompt Threshold Amount</label>
              <input
                id="depositPromptThresholdAmount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={depositPromptThresholdAmount}
                onChange={(e) => setDepositPromptThresholdAmount(e.target.value)}
                onBlur={() => setDepositPromptThresholdAmount((prev) => formatUsdValue(String(prev || '').trim()))}
                placeholder="5.00"
                disabled={loading || saving}
              />
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Show the prompt when balance is below this amount. Leave empty for client fallback.
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Loan Eligibility Defaults</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Master control for whether new transactions may count toward loan eligibility before account or transaction-level rules apply.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={transactionsEligibleForLoanEligibility}
                onChange={(e) => setTransactionsEligibleForLoanEligibility(e.target.checked)}
                disabled={loading || saving}
              />
              Transactions count toward loan eligibility
            </label>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If disabled, all transactions are treated as ineligible for loan-eligibility calculations regardless of account or bill-product settings.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Global KYC Gate</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Controls whether the mobile app should force KYC before normal app usage.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              When enabled, `/customer-api/accounts/my-account` returns `forceKycBeforeAppUse = true` and the app should send the user into KYC before they continue.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              This is a global switch for now. It does not yet vary by country, account, or route.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={forceKycBeforeAppUse}
                onChange={(e) => setForceKycBeforeAppUse(e.target.checked)}
                disabled={loading || saving}
              />
              Force KYC before app use
            </label>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Enable this when business or compliance wants KYC required before the user can access the app normally.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Leave it off to continue using only the existing action-based KYC enforcement.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Payout KYC</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Users with KYC status NONE must complete KYC when their payout amount or completed transaction volume exceeds this threshold.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Applies only when the user&apos;s current KYC status is NONE.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              KYC is required when the payout amount or total completed transaction volume exceeds this threshold. Leave blank to use the system default.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If force KYC is enabled, the threshold is ignored for users whose KYC status is NONE.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={forcePayoutKycUnlessApproved}
                onChange={(e) => setForcePayoutKycUnlessApproved(e.target.checked)}
                disabled={loading || saving}
              />
              Force KYC for payouts when KYC status is NONE
            </label>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If enabled, users with KYC status NONE must complete KYC before any covered payout, regardless of payout amount or completed transaction volume.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Use this for regulatory or audit controls when no payout should be allowed before KYC is completed.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '280px' }}>
            <label htmlFor="payoutKycThresholdUsd">Payout KYC threshold (USD)</label>
            <input
              id="payoutKycThresholdUsd"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={payoutKycThresholdUsd}
              onChange={(e) => setPayoutKycThresholdUsd(e.target.value)}
              onBlur={() => setPayoutKycThresholdUsd((prev) => formatUsdValue(String(prev || '').trim()))}
              placeholder="75.00"
              disabled={loading || saving}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Airtime Limits</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Applies to airtime purchases sent by users. Leave blank for no minimum.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If this field is empty, users can send airtime for any allowed amount.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If this field is set, airtime below this amount will be rejected.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '280px' }}>
            <label htmlFor="sendAirtimeMinimumUsd">Minimum send airtime amount (USD)</label>
            <input
              id="sendAirtimeMinimumUsd"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={sendAirtimeMinimumUsd}
              onChange={(e) => setSendAirtimeMinimumUsd(e.target.value)}
              onBlur={() => setSendAirtimeMinimumUsd((prev) => formatUsdValue(String(prev || '').trim()))}
              placeholder="2.00"
              disabled={loading || saving}
            />
          </div>
        </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={loadConfig} disabled={loading || saving}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={loading || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
