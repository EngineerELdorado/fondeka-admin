'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useLocale } from '@/contexts/LocaleContext';
import { api } from '@/lib/api';

const LABELS = {
  trusted_device_enforcement: 'Enforce Trusted Device',
  auto_refund: 'Auto Refunds',
  'crypto.external.collection.verified_only': 'Restrict crypto collection to verified users',
  'crypto.external.collection.allow_public_endpoints': 'Allow public crypto payment links',
  'kyc.allow_gallery_upload': 'Allow KYC gallery upload',
  avecLoanRequestReasonEnabled: 'AVEC loan request reason',
  'customer_service.enabled': 'Customer service FAB'
};

const WARNINGS = {
  trusted_device_enforcement: 'Warning: Disabling trusted device enforcement reduces security for customer endpoints.',
  auto_refund: 'Warning: Disabling auto refunds will route failed refunds to manual review.',
  'kyc.allow_gallery_upload': 'If disabled, customers must capture KYC documents directly instead of uploading from their gallery.',
  avecLoanRequestReasonEnabled: 'If disabled, the client app hides the AVEC loan request reason field and does not send notes in loan request payloads.',
  'customer_service.enabled': 'If disabled, the client app hides the customer service floating action button.'
};

const ACTION_LIMIT_PREFIX = 'limit.check.action.';
const ACTION_LIMIT_WARNING = 'Disabling limit checks may allow transactions above regulatory or internal limits.';
const ACTION_LIMIT_EXPLANATION = 'If disabled, amount limits (KYC caps or custom limits) are not enforced for this action.';
const CRYPTO_SPREAD_GLOBAL_KEY = 'crypto.spread.enabled';
const CRYPTO_SPREAD_ACTION_PREFIX = 'crypto.spread.action.';
const SHOW_CRYPTO_SPREAD_SECTION = false;
const INTER_TRANSFER_FLAG_KEY = 'wallet.inter_transfer.enabled';
const TRUSTED_DEVICE_GLOBAL_KEY = 'trusted_device_enforcement';
const TRUSTED_DEVICE_ANDROID_KEY = 'trusted_device_enforcement.android';
const TRUSTED_DEVICE_IOS_KEY = 'trusted_device_enforcement.ios';
const TRANSACTION_AUTH_GLOBAL_KEY = 'transaction_auth_enforcement';
const TRANSACTION_AUTH_ANDROID_KEY = 'transaction_auth_enforcement.android';
const TRANSACTION_AUTH_IOS_KEY = 'transaction_auth_enforcement.ios';
const APP_OPEN_AUTH_GLOBAL_KEY = 'app_open_auth_enforcement';
const APP_OPEN_AUTH_ANDROID_KEY = 'app_open_auth_enforcement.android';
const APP_OPEN_AUTH_IOS_KEY = 'app_open_auth_enforcement.ios';
const CUSTOMER_SERVICE_ENABLED_KEY = 'customer_service.enabled';
const SAVINGS_ENABLED_KEY = 'savings.enabled';
const AVEC_LOAN_REQUEST_REASON_KEY = 'avecLoanRequestReasonEnabled';
const HIDDEN_FEATURE_FLAG_KEYS = new Set([
  'requesting_loan.enabled',
  'personal_saving.interest_payout.open.enabled',
  'personal_saving.interest_payout.locked.enabled'
]);
const HIDDEN_FEATURE_FLAG_GROUP_KEYS = new Set(['country', 'province', 'municipality', 'town', 'relograde', 'payment_method_network']);

const ACTION_LABELS = {
  fund_wallet: 'Wallet Deposit',
  withdraw_from_wallet: 'Wallet Payout',
  refund_to_wallet: 'Refund To Wallet',
  bonus: 'Bonus',
  manual_adjustment: 'Manual Adjustment',
  pay_internet_bill: 'Internet',
  pay_tv_subscription: 'TV Subscription',
  pay_electricity_bill: 'Electricity',
  pay_water_bill: 'Water',
  loan_request: 'Loan Request',
  loan_disbursement: 'Loan Disbursement',
  group_saving_round_distribution: 'Group Saving Round Distribution',
  repay_loan: 'Loan Repayment',
  fund_card: 'Card Funding',
  withdraw_from_card: 'Card Withdrawal',
  buy_card: 'Card Purchase',
  card_online_payment: 'Card Online Payment',
  card_maintenance: 'Card Maintenance',
  buy_crypto: 'Crypto Buy',
  sell_crypto: 'Crypto Sell',
  receive_crypto: 'Crypto Receive',
  send_crypto: 'Crypto Send',
  swap_crypto: 'Crypto Swap',
  request_payment: 'Request Payment',
  pay_request: 'Pay Request',
  settlement: 'Settlement',
  e_sim_purchase: 'eSIM Purchase',
  e_sim_topup: 'eSIM Top-up',
  send_airtime: 'Send Airtime',
  send_data_bundles: 'Send Data Bundles',
  buy_gift_card: 'Gift Card Purchase',
  pay_netflix: 'Netflix',
  inter_transfer: 'Inter Transfer',
  other: 'Other'
};

const SUPPORTED_KEYS = [
  'wallet',
  'bill_payments',
  'lending',
  'card',
  'crypto',
  'payment_request',
  'e_sim',
  'airtime',
  'beneficiary',
  'kyc',
  'device',
  'fees',
  'geo',
  'transactions',
  'payment_methods',
  'support',
  'storage',
  'gift_cards'
];

const CRYPTO_COLLECTION_GATE_KEY = 'crypto.external.collection.verified_only';
const CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY = 'crypto.external.collection.allow_public_endpoints';
const NOTIFICATION_PERMISSION_WELCOME_KEY = 'notification.permission.request_on_welcome_screen';
const CRYPTO_COLLECTION_GATE_KYC_STATUSES = ['APPROVED', 'PROVISIONALLY_APPROVED'];
const GENERIC_DISABLED_MESSAGE_HELP =
  'Optional. Shown to users when this feature is disabled. If left empty, the app will use the default maintenance message.';
const SAVINGS_DISABLED_MESSAGE_HELP =
  'Optional. Shown to users in accountData.savingsAccess.message when savings is globally disabled. If left empty, the app will receive the default savings unavailable message.';

const formatKeyPart = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatLabel = (key) => {
  if (LABELS[key]) return LABELS[key];
  const raw = String(key || '');
  if (!raw.includes('.')) return formatKeyPart(raw);
  return raw
    .split('.')
    .map((part) => formatKeyPart(part))
    .join(' · ');
};

const isActionLimitKey = (key) => String(key || '').startsWith(ACTION_LIMIT_PREFIX);

const actionFromLimitKey = (key) => String(key || '').replace(ACTION_LIMIT_PREFIX, '');

const formatActionLabel = (key) => {
  const action = actionFromLimitKey(key);
  return ACTION_LABELS[action] || formatKeyPart(action);
};

const getDisabledMessagePlaceholder = (key) =>
  key === SAVINGS_ENABLED_KEY
    ? 'Optional. Shown to users when savings is globally disabled.'
    : 'Optional. Shown to users when this feature is disabled.';

const getDisabledMessageHelp = (key) => (key === SAVINGS_ENABLED_KEY ? SAVINGS_DISABLED_MESSAGE_HELP : GENERIC_DISABLED_MESSAGE_HELP);

const isCryptoSpreadActionKey = (key) => String(key || '').startsWith(CRYPTO_SPREAD_ACTION_PREFIX);
const actionFromCryptoSpreadKey = (key) => String(key || '').replace(CRYPTO_SPREAD_ACTION_PREFIX, '');
const formatCryptoSpreadActionLabel = (key) => {
  const action = actionFromCryptoSpreadKey(key);
  return ACTION_LABELS[action] || formatKeyPart(action);
};
const normalizeActionToken = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
const isSavingsRelatedKey = (key) => {
  const raw = String(key || '');
  return raw === SAVINGS_ENABLED_KEY || raw === AVEC_LOAN_REQUEST_REASON_KEY || raw.startsWith('personal_saving.') || raw.startsWith('group_saving.') || raw.startsWith('savings.');
};
const isHiddenFeatureFlag = (key) => {
  const raw = String(key || '');
  return HIDDEN_FEATURE_FLAG_KEYS.has(raw) || raw.startsWith('payment.method.');
};

const normalizeOverride = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const accountId = entry.accountId ?? entry.account_id ?? entry.id ?? entry?.account?.id ?? '';
  const email = entry.email ?? entry.emailAddress ?? entry.accountEmail ?? entry?.account?.email ?? '';
  const firstName = entry.firstName ?? entry.accountFirstName ?? entry?.account?.firstName ?? '';
  const lastName = entry.lastName ?? entry.accountLastName ?? entry?.account?.lastName ?? '';
  const username = entry.username ?? entry.accountUsername ?? entry?.account?.username ?? '';
  const accountReference = entry.accountReference ?? entry?.account?.accountReference ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if ((accountId === null || accountId === undefined || accountId === '') && !email) return null;
  const hasAccount = accountId !== null && accountId !== undefined && accountId !== '';
  const normalizedTarget = hasAccount ? String(accountId) : String(email);
  const targetType = hasAccount ? 'account' : 'email';
  return {
    id: `${targetType}:${normalizedTarget}`,
    accountId: hasAccount ? String(accountId) : '',
    email: hasAccount ? '' : String(email),
    targetType,
    targetLabel: hasAccount ? `Account ${accountId}` : `Email ${email}`,
    displayName: fullName || username || '',
    displayEmail: hasAccount ? String(email || '') : String(email || ''),
    username: String(username || ''),
    accountReference: String(accountReference || ''),
    enabled: Boolean(entry.enabled)
  };
};

const normalizeCountryOverride = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const countryCode = String(entry.countryCode ?? entry.country_code ?? entry.code ?? '').trim().toUpperCase();
  if (!countryCode) return null;
  return {
    id: `country:${countryCode}`,
    accountId: '',
    email: '',
    countryCode,
    targetType: 'country',
    targetLabel: `Country ${countryCode}`,
    enabled: Boolean(entry.enabled)
  };
};

function CollapsibleSection({ title, subtitle = null, count = null, borderColor = null, children, defaultOpen = false }) {
  return (
    <details
      open={defaultOpen}
      className="card"
      style={{
        maxWidth: '720px',
        display: 'grid',
        gap: '0.75rem',
        borderColor: borderColor || 'var(--border)'
      }}
    >
      <summary
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          cursor: 'pointer',
          listStyle: 'none'
        }}
      >
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          <div style={{ fontWeight: 800 }}>{title}</div>
          {subtitle ? <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{subtitle}</div> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)', fontSize: '12px' }}>
          {count !== null ? <span>{count}</span> : null}
          <span>Expand</span>
        </div>
      </summary>
      <div style={{ display: 'grid', gap: '0.75rem' }}>{children}</div>
    </details>
  );
}

const getOverrideErrorMessage = (err, fallback) => {
  if (err?.status === 404) return 'Account or email not found';
  return err?.message || fallback;
};

const withOverrideIdentity = async (entry) => {
  if (!entry || entry.targetType !== 'account' || !entry.accountId) return entry;
  if (entry.displayName || entry.displayEmail) return entry;
  try {
    const account = await api.accounts.get(entry.accountId);
    const fullName = [account?.firstName, account?.lastName].filter(Boolean).join(' ').trim();
    return {
      ...entry,
      displayName: fullName || account?.username || '',
      displayEmail: account?.email || '',
      username: account?.username || '',
      accountReference: entry.accountReference || account?.accountReference || ''
    };
  } catch {
    return entry;
  }
};

export default function FeatureFlagsPage() {
  const { t } = useLocale();
  const [flags, setFlags] = useState([]);
  const [cryptoProductNamesById, setCryptoProductNamesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [draftKey, setDraftKey] = useState('');
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [draftDisabledMessageEn, setDraftDisabledMessageEn] = useState('');
  const [draftDisabledMessageFr, setDraftDisabledMessageFr] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editDialog, setEditDialog] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editDraftEnabled, setEditDraftEnabled] = useState(true);
  const [editDraftDisabledMessageEn, setEditDraftDisabledMessageEn] = useState('');
  const [editDraftDisabledMessageFr, setEditDraftDisabledMessageFr] = useState('');
  const [overrideDialog, setOverrideDialog] = useState(null);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [overridesSaving, setOverridesSaving] = useState(false);
  const [overrideAccountId, setOverrideAccountId] = useState('');
  const [overrideEnabled, setOverrideEnabled] = useState(true);
  const [overrideEmail, setOverrideEmail] = useState('');
  const [overrideEmailEnabled, setOverrideEmailEnabled] = useState(true);
  const [overrideCountryCode, setOverrideCountryCode] = useState('');
  const [overrideCountryEnabled, setOverrideCountryEnabled] = useState(true);
  const [overrides, setOverrides] = useState([]);
  const [spreadActionDraft, setSpreadActionDraft] = useState('');
  const [spreadActionEnabled, setSpreadActionEnabled] = useState(true);

  const cryptoCollectionGateFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === CRYPTO_COLLECTION_GATE_KEY),
    [flags]
  );

  const cryptoCollectionPublicEndpointsFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY),
    [flags]
  );

  const notificationPermissionWelcomeFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === NOTIFICATION_PERMISSION_WELCOME_KEY),
    [flags]
  );

  const cryptoSpreadGlobalFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === CRYPTO_SPREAD_GLOBAL_KEY),
    [flags]
  );
  const trustedDeviceGlobalFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === TRUSTED_DEVICE_GLOBAL_KEY),
    [flags]
  );
  const trustedDeviceAndroidFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === TRUSTED_DEVICE_ANDROID_KEY),
    [flags]
  );
  const trustedDeviceIosFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === TRUSTED_DEVICE_IOS_KEY),
    [flags]
  );
  const transactionAuthGlobalFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === TRANSACTION_AUTH_GLOBAL_KEY),
    [flags]
  );
  const transactionAuthAndroidFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === TRANSACTION_AUTH_ANDROID_KEY),
    [flags]
  );
  const transactionAuthIosFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === TRANSACTION_AUTH_IOS_KEY),
    [flags]
  );
  const appOpenAuthGlobalFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === APP_OPEN_AUTH_GLOBAL_KEY),
    [flags]
  );
  const appOpenAuthAndroidFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === APP_OPEN_AUTH_ANDROID_KEY),
    [flags]
  );
  const appOpenAuthIosFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === APP_OPEN_AUTH_IOS_KEY),
    [flags]
  );

  const interTransferFlag = useMemo(
    () => flags.find((flag) => String(flag.key) === INTER_TRANSFER_FLAG_KEY),
    [flags]
  );

  const cryptoSpreadActionFlags = useMemo(
    () =>
      flags
        .filter((flag) => isCryptoSpreadActionKey(flag.key))
        .sort((a, b) => actionFromCryptoSpreadKey(a.key).localeCompare(actionFromCryptoSpreadKey(b.key))),
    [flags]
  );

  const otherFlags = useMemo(
    () =>
      flags.filter(
        (flag) =>
          !isHiddenFeatureFlag(flag.key) &&
          String(flag.key) !== CRYPTO_COLLECTION_GATE_KEY &&
          String(flag.key) !== CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY &&
          String(flag.key) !== NOTIFICATION_PERMISSION_WELCOME_KEY &&
          String(flag.key) !== CRYPTO_SPREAD_GLOBAL_KEY &&
          String(flag.key) !== INTER_TRANSFER_FLAG_KEY &&
          String(flag.key) !== TRUSTED_DEVICE_GLOBAL_KEY &&
          String(flag.key) !== TRUSTED_DEVICE_ANDROID_KEY &&
          String(flag.key) !== TRUSTED_DEVICE_IOS_KEY &&
          String(flag.key) !== TRANSACTION_AUTH_GLOBAL_KEY &&
          String(flag.key) !== TRANSACTION_AUTH_ANDROID_KEY &&
          String(flag.key) !== TRANSACTION_AUTH_IOS_KEY &&
          String(flag.key) !== APP_OPEN_AUTH_GLOBAL_KEY &&
          String(flag.key) !== APP_OPEN_AUTH_ANDROID_KEY &&
          String(flag.key) !== APP_OPEN_AUTH_IOS_KEY &&
          !isSavingsRelatedKey(flag.key) &&
          !isCryptoSpreadActionKey(flag.key)
      ),
    [flags]
  );

  const savingsFlags = useMemo(
    () =>
      flags
        .filter((flag) => !isHiddenFeatureFlag(flag.key))
        .filter((flag) => !isActionLimitKey(flag.key))
        .filter((flag) => isSavingsRelatedKey(flag.key))
        .sort((a, b) => String(a.key || '').localeCompare(String(b.key || ''))),
    [flags]
  );

  const actionLimitFlags = useMemo(
    () =>
      flags
        .filter((flag) => String(flag.key) !== CRYPTO_COLLECTION_GATE_KEY)
        .filter((flag) => String(flag.key) !== CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY)
        .filter((flag) => isActionLimitKey(flag.key))
        .sort((a, b) => actionFromLimitKey(a.key).localeCompare(actionFromLimitKey(b.key))),
    [flags]
  );

  const groupedFlags = useMemo(() => {
    const groups = new Map();
    otherFlags
      .filter((flag) => !isActionLimitKey(flag.key))
      .forEach((flag) => {
        const rawKey = String(flag.key || '');
        const groupKey = rawKey.includes('.') ? rawKey.split('.')[0] : 'modules';
        if (HIDDEN_FEATURE_FLAG_GROUP_KEYS.has(groupKey)) return;
        const list = groups.get(groupKey) || [];
        list.push(flag);
        groups.set(groupKey, list);
      });
    const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'modules') return -1;
      if (b === 'modules') return 1;
      return a.localeCompare(b);
    });
    return sortedGroups.map(([groupKey, list]) => ({
      key: groupKey,
      label: groupKey === 'modules' ? 'Module flags' : formatKeyPart(groupKey),
      flags: list.sort((a, b) => String(a.key || '').localeCompare(String(b.key || '')))
    }));
  }, [otherFlags]);

  const formatResolvedLabel = (key) => {
    const raw = String(key || '');
    const cryptoProductMatch = raw.match(/^crypto\.product\.([^.]+)\.(collection|payout)\.enabled$/);
    if (cryptoProductMatch) {
      const [, cryptoProductId, flow] = cryptoProductMatch;
      const productName = cryptoProductNamesById[String(cryptoProductId)] || `#${cryptoProductId}`;
      return `Crypto Product · ${productName} · ${formatKeyPart(flow)} · Enabled`;
    }
    return formatLabel(raw);
  };

  const formatResolvedDisplayLabel = (key) => (isActionLimitKey(key) ? formatActionLabel(key) : formatResolvedLabel(key));

  const syncFlagInState = (key, payload) => {
    setFlags((prev) => {
      const nextFlag = {
        key,
        enabled: Boolean(payload?.enabled),
        disabledMessageEn: payload?.disabledMessageEn ?? '',
        disabledMessageFr: payload?.disabledMessageFr ?? ''
      };
      const exists = prev.some((flag) => flag.key === key);
      if (exists) {
        return prev.map((flag) => (flag.key === key ? { ...flag, ...nextFlag } : flag));
      }
      return [nextFlag, ...prev];
    });
  };

  const loadFlagDetail = async (key, fallbackFlag = null) => {
    try {
      const res = await api.featureFlags.get(key);
      return {
        key,
        enabled: Boolean(res?.enabled),
        disabledMessageEn: res?.disabledMessageEn ?? '',
        disabledMessageFr: res?.disabledMessageFr ?? ''
      };
    } catch (err) {
      if (err?.status === 404) {
        return {
          key,
          enabled: Boolean(fallbackFlag?.enabled),
          disabledMessageEn: fallbackFlag?.disabledMessageEn ?? '',
          disabledMessageFr: fallbackFlag?.disabledMessageFr ?? ''
        };
      }
      throw err;
    }
  };

  const loadFlags = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.featureFlags.list();
      const list = Array.isArray(res) ? res : [];
      const hasCryptoCollectionGate = list.some((flag) => String(flag?.key) === CRYPTO_COLLECTION_GATE_KEY);
      const hasPublicEndpointsFlag = list.some((flag) => String(flag?.key) === CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY);
      const hasNotificationPermissionWelcomeFlag = list.some((flag) => String(flag?.key) === NOTIFICATION_PERMISSION_WELCOME_KEY);
      const hasCryptoSpreadGlobal = list.some((flag) => String(flag?.key) === CRYPTO_SPREAD_GLOBAL_KEY);
      const hasInterTransferFlag = list.some((flag) => String(flag?.key) === INTER_TRANSFER_FLAG_KEY);
      const hasTrustedGlobalFlag = list.some((flag) => String(flag?.key) === TRUSTED_DEVICE_GLOBAL_KEY);
      const hasTrustedAndroidFlag = list.some((flag) => String(flag?.key) === TRUSTED_DEVICE_ANDROID_KEY);
      const hasTrustedIosFlag = list.some((flag) => String(flag?.key) === TRUSTED_DEVICE_IOS_KEY);
      const hasTransactionAuthGlobalFlag = list.some((flag) => String(flag?.key) === TRANSACTION_AUTH_GLOBAL_KEY);
      const hasTransactionAuthAndroidFlag = list.some((flag) => String(flag?.key) === TRANSACTION_AUTH_ANDROID_KEY);
      const hasTransactionAuthIosFlag = list.some((flag) => String(flag?.key) === TRANSACTION_AUTH_IOS_KEY);
      const hasCustomerServiceEnabledFlag = list.some((flag) => String(flag?.key) === CUSTOMER_SERVICE_ENABLED_KEY);
      const defaults = [];
      if (!hasCryptoCollectionGate) defaults.push({ key: CRYPTO_COLLECTION_GATE_KEY, enabled: true, isDefault: true });
      if (!hasPublicEndpointsFlag) defaults.push({ key: CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY, enabled: true, isDefault: true });
      if (!hasNotificationPermissionWelcomeFlag) defaults.push({ key: NOTIFICATION_PERMISSION_WELCOME_KEY, enabled: true, isDefault: true });
      if (!hasCryptoSpreadGlobal) defaults.push({ key: CRYPTO_SPREAD_GLOBAL_KEY, enabled: true, isDefault: true });
      if (!hasInterTransferFlag) defaults.push({ key: INTER_TRANSFER_FLAG_KEY, enabled: true, isDefault: true });
      if (!hasTrustedGlobalFlag) defaults.push({ key: TRUSTED_DEVICE_GLOBAL_KEY, enabled: true, isDefault: true });
      if (!hasTrustedAndroidFlag) defaults.push({ key: TRUSTED_DEVICE_ANDROID_KEY, enabled: true, isDefault: true });
      if (!hasTrustedIosFlag) defaults.push({ key: TRUSTED_DEVICE_IOS_KEY, enabled: true, isDefault: true });
      if (!hasTransactionAuthGlobalFlag) defaults.push({ key: TRANSACTION_AUTH_GLOBAL_KEY, enabled: true, isDefault: true });
      if (!hasTransactionAuthAndroidFlag) defaults.push({ key: TRANSACTION_AUTH_ANDROID_KEY, enabled: true, isDefault: true });
      if (!hasTransactionAuthIosFlag) defaults.push({ key: TRANSACTION_AUTH_IOS_KEY, enabled: true, isDefault: true });
      if (!hasCustomerServiceEnabledFlag) defaults.push({ key: CUSTOMER_SERVICE_ENABLED_KEY, enabled: true, isDefault: true });
      setFlags([...defaults, ...list]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  useEffect(() => {
    const loadCryptoProductNames = async () => {
      try {
        const res = await api.cryptoProducts.list(new URLSearchParams({ page: '0', size: '500' }));
        const list = Array.isArray(res) ? res : res?.content || [];
        const next = {};
        list.forEach((item) => {
          if (item?.id === null || item?.id === undefined) return;
          next[String(item.id)] = item?.displayName || item?.currency || String(item.id);
        });
        setCryptoProductNamesById(next);
      } catch {
        setCryptoProductNamesById({});
      }
    };
    loadCryptoProductNames();
  }, []);

  useEffect(() => {
    if (!info && !error) return;
    const t = setTimeout(() => {
      setInfo(null);
      setError(null);
    }, 3000);
    return () => clearTimeout(t);
  }, [info, error]);

  const handleToggle = async (key) => {
    if (!key || savingKey === key) return;
    const current = flags.find((flag) => flag.key === key);
    const nextEnabled = !current?.enabled;
    if (!nextEnabled) {
      setConfirm({ key });
      return;
    }
    setSavingKey(key);
    setError(null);
    setInfo(null);
    try {
      const detail = await loadFlagDetail(key, current);
      const payload = {
        enabled: nextEnabled,
        disabledMessageEn: detail.disabledMessageEn ?? '',
        disabledMessageFr: detail.disabledMessageFr ?? ''
      };
      const res = await api.featureFlags.update(key, payload);
      syncFlagInState(key, {
        enabled: Boolean(res?.enabled),
        disabledMessageEn: res?.disabledMessageEn ?? payload.disabledMessageEn,
        disabledMessageFr: res?.disabledMessageFr ?? payload.disabledMessageFr
      });
      setInfo(`${formatResolvedDisplayLabel(key)} ${res?.enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey('');
    }
  };

  const handleConfirmDisable = async () => {
    if (!confirm?.key) return;
    const key = confirm.key;
    const current = flags.find((flag) => flag.key === key);
    if (!current?.enabled) {
      setConfirm(null);
      return;
    }
    setSavingKey(key);
    setError(null);
    setInfo(null);
    try {
      const detail = await loadFlagDetail(key, current);
      const payload = {
        enabled: false,
        disabledMessageEn: detail.disabledMessageEn ?? '',
        disabledMessageFr: detail.disabledMessageFr ?? ''
      };
      const res = await api.featureFlags.update(key, payload);
      syncFlagInState(key, {
        enabled: Boolean(res?.enabled),
        disabledMessageEn: res?.disabledMessageEn ?? payload.disabledMessageEn,
        disabledMessageFr: res?.disabledMessageFr ?? payload.disabledMessageFr
      });
      setInfo(`${formatResolvedDisplayLabel(key)} disabled.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey('');
      setConfirm(null);
    }
  };

  const handleDeleteFlag = async () => {
    if (!deleteConfirm?.key) return;
    const key = deleteConfirm.key;
    setSavingKey(key);
    setError(null);
    setInfo(null);
    try {
      await api.featureFlags.remove(key);
      await loadFlags();
      setInfo(`${formatResolvedDisplayLabel(key)} reset to default.`);
    } catch (err) {
      setError(err.message || 'Failed to delete feature flag');
    } finally {
      setSavingKey('');
      setDeleteConfirm(null);
    }
  };

  const handleCreateFlag = async () => {
    const key = draftKey.trim();
    if (!key) {
      setError('Enter a feature flag key.');
      return;
    }
    if (savingKey) return;
    setSavingKey(key);
    setError(null);
    setInfo(null);
    try {
      const payload = {
        enabled: draftEnabled,
        disabledMessageEn: draftDisabledMessageEn,
        disabledMessageFr: draftDisabledMessageFr
      };
      const res = await api.featureFlags.update(key, payload);
      syncFlagInState(key, {
        enabled: Boolean(res?.enabled),
        disabledMessageEn: res?.disabledMessageEn ?? payload.disabledMessageEn,
        disabledMessageFr: res?.disabledMessageFr ?? payload.disabledMessageFr
      });
      setInfo(`${formatResolvedDisplayLabel(key)} ${res?.enabled ? 'enabled' : 'disabled'}.`);
      setDraftKey('');
      setDraftEnabled(true);
      setDraftDisabledMessageEn('');
      setDraftDisabledMessageFr('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey('');
    }
  };

  const handleSaveCryptoSpreadAction = async () => {
    const action = normalizeActionToken(spreadActionDraft);
    if (!action) {
      setError('Enter an action, for example fund_card.');
      return;
    }
    const key = `${CRYPTO_SPREAD_ACTION_PREFIX}${action}`;
    if (savingKey) return;
    setSavingKey(key);
    setError(null);
    setInfo(null);
    try {
      const res = await api.featureFlags.update(key, { enabled: spreadActionEnabled });
      setFlags((prev) => {
        const exists = prev.some((flag) => flag.key === key);
        if (exists) {
          return prev.map((flag) => (flag.key === key ? { ...flag, enabled: Boolean(res?.enabled) } : flag));
        }
        return [{ key, enabled: Boolean(res?.enabled) }, ...prev];
      });
      setInfo(`${formatCryptoSpreadActionLabel(key)} spread ${res?.enabled ? 'enabled' : 'disabled'}.`);
      setSpreadActionDraft('');
      setSpreadActionEnabled(true);
    } catch (err) {
      setError(err?.message || 'Failed to save crypto spread action flag.');
    } finally {
      setSavingKey('');
    }
  };

  const openEditDialog = async (flag) => {
    if (!flag?.key) return;
    setEditDialog({ key: flag.key });
    setEditLoading(true);
    setError(null);
    setInfo(null);
    try {
      const detail = await loadFlagDetail(flag.key, flag);
      setEditDraftEnabled(Boolean(detail.enabled));
      setEditDraftDisabledMessageEn(detail.disabledMessageEn ?? '');
      setEditDraftDisabledMessageFr(detail.disabledMessageFr ?? '');
    } catch (err) {
      setEditDialog(null);
      setError(err?.message || 'Failed to load feature flag details.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEditDialog = async () => {
    const key = editDialog?.key;
    if (!key || savingKey === key) return;
    const payload = {
      enabled: Boolean(editDraftEnabled),
      disabledMessageEn: editDraftDisabledMessageEn,
      disabledMessageFr: editDraftDisabledMessageFr
    };
    setSavingKey(key);
    setError(null);
    setInfo(null);
    try {
      const res = await api.featureFlags.update(key, payload);
      syncFlagInState(key, {
        enabled: Boolean(res?.enabled),
        disabledMessageEn: res?.disabledMessageEn ?? payload.disabledMessageEn,
        disabledMessageFr: res?.disabledMessageFr ?? payload.disabledMessageFr
      });
      setInfo(`${formatResolvedDisplayLabel(key)} saved.`);
      setEditDialog(null);
    } catch (err) {
      setError(err?.message || 'Failed to save feature flag.');
    } finally {
      setSavingKey('');
    }
  };

  const openOverridesDialog = async (key) => {
    if (!key) return;
    setOverrideDialog({ key });
    setOverrideAccountId('');
    setOverrideEnabled(true);
    setOverrideEmail('');
    setOverrideEmailEnabled(true);
    setOverrideCountryCode('');
    setOverrideCountryEnabled(true);
    setOverrides([]);
    setOverridesLoading(true);
    setError(null);
    try {
      const list = await loadOverrideEntries(key);
      setOverrides(list);
    } catch (err) {
      setError(err.message || 'Failed to load overrides');
    } finally {
      setOverridesLoading(false);
    }
  };

  const handleSaveOverride = async (forcedEnabled) => {
    const key = overrideDialog?.key;
    const accountId = overrideAccountId.trim();
    if (!key || !accountId || overridesSaving) return;
    const enabled = typeof forcedEnabled === 'boolean' ? forcedEnabled : overrideEnabled;
    setOverridesSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.featureFlags.upsertOverride(key, accountId, { enabled });
      const list = await loadOverrideEntries(key);
      setOverrides(list);
      setOverrideAccountId('');
      setOverrideEnabled(true);
      if (key === CRYPTO_COLLECTION_GATE_KEY) {
        setInfo(`Override set for account ${accountId}: ${enabled ? 'gate enforced (verified only)' : 'crypto collection allowed'}.`);
      } else {
        setInfo(`Override set for account ${accountId}: ${enabled ? 'forced ON' : 'forced OFF'}.`);
      }
    } catch (err) {
      setError(err.message || 'Failed to save override');
    } finally {
      setOverridesSaving(false);
    }
  };

  const handleSaveCountryOverride = async (forcedEnabled) => {
    const key = overrideDialog?.key;
    const countryCode = overrideCountryCode.trim().toUpperCase();
    if (!key || !countryCode || overridesSaving) return;
    const enabled = typeof forcedEnabled === 'boolean' ? forcedEnabled : overrideCountryEnabled;
    setOverridesSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.featureFlags.upsertCountryOverride(key, countryCode, { enabled });
      const list = await loadOverrideEntries(key);
      setOverrides(list);
      setOverrideCountryCode('');
      setOverrideCountryEnabled(true);
      setInfo(`Country override set for ${countryCode}: ${enabled ? 'forced ON' : 'forced OFF'}.`);
    } catch (err) {
      setError(err?.message || 'Failed to save country override');
    } finally {
      setOverridesSaving(false);
    }
  };

  const handleSaveOverrideByEmail = async (forcedEnabled) => {
    const key = overrideDialog?.key;
    const email = overrideEmail.trim();
    if (!key || !email || overridesSaving) return;
    const enabled = typeof forcedEnabled === 'boolean' ? forcedEnabled : overrideEmailEnabled;
    setOverridesSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.featureFlags.upsertOverrideByEmail(key, email, { enabled });
      const list = await loadOverrideEntries(key);
      setOverrides(list);
      setOverrideEmail('');
      setOverrideEmailEnabled(true);
      if (key === CRYPTO_COLLECTION_GATE_KEY) {
        setInfo(`Override set for ${email}: ${enabled ? 'gate enforced (verified only)' : 'crypto collection allowed'}.`);
      } else {
        setInfo(`Override set for ${email}: ${enabled ? 'forced ON' : 'forced OFF'}.`);
      }
    } catch (err) {
      setError(getOverrideErrorMessage(err, 'Failed to save override'));
    } finally {
      setOverridesSaving(false);
    }
  };

  const handleDeleteOverrideByEmail = async () => {
    const key = overrideDialog?.key;
    const email = overrideEmail.trim();
    if (!key || !email || overridesSaving) return;
    setOverridesSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.featureFlags.removeOverrideByEmail(key, email);
      const list = await loadOverrideEntries(key);
      setOverrides(list);
      setOverrideEmail('');
      setInfo(`Override removed for ${email}.`);
    } catch (err) {
      setError(getOverrideErrorMessage(err, 'Failed to remove override'));
    } finally {
      setOverridesSaving(false);
    }
  };

  const handleDeleteOverride = async (entry) => {
    const key = overrideDialog?.key;
    const accountId = entry?.accountId || '';
    const email = entry?.email || '';
    const countryCode = entry?.countryCode || '';
    if (!key || (!accountId && !email && !countryCode) || overridesSaving) return;
    setOverridesSaving(true);
    setError(null);
    setInfo(null);
    try {
      if (countryCode) {
        await api.featureFlags.removeCountryOverride(key, countryCode);
        setInfo(`Override removed for country ${countryCode}.`);
      } else if (accountId) {
        await api.featureFlags.removeOverride(key, accountId);
        setInfo(`Override removed for account ${accountId}.`);
      } else {
        await api.featureFlags.removeOverrideByEmail(key, email);
        setInfo(`Override removed for ${email}.`);
      }
      setOverrides((prev) => prev.filter((row) => row.id !== entry.id));
    } catch (err) {
      setError(err.message || 'Failed to remove override');
    } finally {
      setOverridesSaving(false);
    }
  };

  const renderCryptoSpreadSection = () => {
    if (!cryptoSpreadGlobalFlag) return null;
    return (
      <div className="card" style={{ maxWidth: '720px', display: 'grid', gap: '0.75rem', borderColor: '#0ea5e9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Crypto spread</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{CRYPTO_SPREAD_GLOBAL_KEY}</div>
          </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => openEditDialog(cryptoSpreadGlobalFlag)}
                disabled={savingKey === CRYPTO_SPREAD_GLOBAL_KEY}
                style={{
                  border: `1px solid var(--border)`,
                  background: 'var(--surface)',
                  padding: '0.45rem 0.7rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: 'var(--text)'
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => openOverridesDialog(CRYPTO_SPREAD_GLOBAL_KEY)}
              disabled={savingKey === CRYPTO_SPREAD_GLOBAL_KEY}
              style={{
                border: `1px solid var(--border)`,
                background: 'var(--surface)',
                padding: '0.45rem 0.7rem',
                borderRadius: '10px',
                cursor: 'pointer',
                color: 'var(--text)'
              }}
            >
              {t('featureFlags.overrides')}
            </button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={Boolean(cryptoSpreadGlobalFlag.enabled)}
                onChange={() => handleToggle(CRYPTO_SPREAD_GLOBAL_KEY)}
                disabled={loading || savingKey === CRYPTO_SPREAD_GLOBAL_KEY}
              />
              {cryptoSpreadGlobalFlag.enabled ? t('featureFlags.enabledGlobally') : t('featureFlags.disabledGlobally')}
            </label>
          </div>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          {t('featureFlags.cryptoSpreadResolution')}
        </div>

        <div className="card" style={{ display: 'grid', gap: '0.65rem' }}>
          <div style={{ fontWeight: 700 }}>{t('featureFlags.createOrUpdateActionKey')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.65rem', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="spreadActionDraft">{t('featureFlags.actionLowercaseEnum')}</label>
              <input
                id="spreadActionDraft"
                placeholder="fund_card"
                value={spreadActionDraft}
                onChange={(e) => setSpreadActionDraft(e.target.value)}
              />
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <input type="checkbox" checked={spreadActionEnabled} onChange={(e) => setSpreadActionEnabled(e.target.checked)} />
              {spreadActionEnabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
            </label>
            <button
              type="button"
              onClick={handleSaveCryptoSpreadAction}
              disabled={savingKey === `${CRYPTO_SPREAD_ACTION_PREFIX}${normalizeActionToken(spreadActionDraft)}`}
              style={{
                border: `1px solid var(--border)`,
                background: 'var(--surface)',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                cursor: 'pointer',
                color: 'var(--text)',
                fontWeight: 600
              }}
            >
              {t('featureFlags.saveAction')}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.7rem' }}>
          <div style={{ fontWeight: 700 }}>{t('featureFlags.actionSpreadFlags')}</div>
          {cryptoSpreadActionFlags.length === 0 && <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{t('featureFlags.noActionKeys')}</div>}
          {cryptoSpreadActionFlags.map((flag) => (
            <div key={flag.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.6rem 0.7rem' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{formatCryptoSpreadActionLabel(flag.key)}</div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{flag.key}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => openEditDialog(flag)}
                  disabled={savingKey === flag.key}
                  style={{
                    border: `1px solid var(--border)`,
                    background: 'var(--surface)',
                    padding: '0.45rem 0.7rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    color: 'var(--text)'
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => openOverridesDialog(flag.key)}
                  disabled={savingKey === flag.key}
                  style={{
                    border: `1px solid var(--border)`,
                    background: 'var(--surface)',
                    padding: '0.45rem 0.7rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    color: 'var(--text)'
                  }}
                >
                  Overrides
                </button>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  <input type="checkbox" checked={Boolean(flag.enabled)} onChange={() => handleToggle(flag.key)} disabled={loading || savingKey === flag.key} />
                  {flag.enabled ? 'Enabled' : 'Disabled'}
                </label>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ key: flag.key })}
                  disabled={savingKey === flag.key}
                  style={{
                    border: `1px solid var(--border)`,
                    background: 'var(--surface)',
                    padding: '0.45rem 0.7rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    color: 'var(--text)'
                  }}
                >
                  {t('featureFlags.reset')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 800 }}>{t('featureFlags.title')}</div>
        <div style={{ color: 'var(--muted)' }}>{t('featureFlags.description')}</div>
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

      <CollapsibleSection title={t('featureFlags.createUpdate')}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.65rem', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="flagKey">{t('featureFlags.key')}</label>
            <input id="flagKey" placeholder="trusted_device_enforcement" value={draftKey} onChange={(e) => setDraftKey(e.target.value)} />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <input type="checkbox" checked={draftEnabled} onChange={(e) => setDraftEnabled(e.target.checked)} />
            {draftEnabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
          </label>
          <button
            type="button"
            onClick={handleCreateFlag}
            disabled={loading || savingKey === draftKey.trim()}
            style={{
              border: `1px solid var(--border)`,
              background: 'var(--surface)',
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              cursor: 'pointer',
              color: 'var(--text)',
              fontWeight: 600
            }}
          >
            {t('featureFlags.save')}
          </button>
        </div>
        <div style={{ display: 'grid', gap: '0.65rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="draftDisabledMessageEn">Disabled message (English)</label>
            <textarea
              id="draftDisabledMessageEn"
              rows={3}
              value={draftDisabledMessageEn}
              onChange={(e) => setDraftDisabledMessageEn(e.target.value)}
              placeholder={getDisabledMessagePlaceholder(draftKey.trim())}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="draftDisabledMessageFr">Disabled message (French)</label>
            <textarea
              id="draftDisabledMessageFr"
              rows={3}
              value={draftDisabledMessageFr}
              onChange={(e) => setDraftDisabledMessageFr(e.target.value)}
              placeholder={getDisabledMessagePlaceholder(draftKey.trim())}
            />
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            {getDisabledMessageHelp(draftKey.trim())}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setDraftKey(AVEC_LOAN_REQUEST_REASON_KEY);
              setDraftEnabled(true);
              setDraftDisabledMessageEn('');
              setDraftDisabledMessageFr('');
            }}
            style={{
              border: '1px solid rgba(22, 163, 74, 0.28)',
              background: 'rgba(22, 163, 74, 0.08)',
              color: '#166534',
              padding: '0.45rem 0.7rem',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Use AVEC loan reason flag
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftKey(CUSTOMER_SERVICE_ENABLED_KEY);
              setDraftEnabled(true);
              setDraftDisabledMessageEn('');
              setDraftDisabledMessageFr('');
            }}
            style={{
              border: '1px solid rgba(14, 165, 233, 0.28)',
              background: 'rgba(14, 165, 233, 0.08)',
              color: '#0369a1',
              padding: '0.45rem 0.7rem',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Use customer service flag
          </button>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Supported keys: {SUPPORTED_KEYS.join(', ')}
        </div>
      </CollapsibleSection>

      {cryptoCollectionGateFlag && (
        <CollapsibleSection
          title={t('featureFlags.cryptoVerifiedTitle')}
          subtitle={CRYPTO_COLLECTION_GATE_KEY}
          borderColor="#f59e0b"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => openEditDialog(cryptoCollectionGateFlag)}
              disabled={savingKey === CRYPTO_COLLECTION_GATE_KEY}
              style={{
                border: `1px solid var(--border)`,
                background: 'var(--surface)',
                padding: '0.45rem 0.7rem',
                borderRadius: '10px',
                cursor: 'pointer',
                color: 'var(--text)'
              }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => openOverridesDialog(CRYPTO_COLLECTION_GATE_KEY)}
              disabled={savingKey === CRYPTO_COLLECTION_GATE_KEY}
              style={{
                border: `1px solid var(--border)`,
                background: 'var(--surface)',
                padding: '0.45rem 0.7rem',
                borderRadius: '10px',
                cursor: 'pointer',
                color: 'var(--text)'
              }}
            >
              {t('featureFlags.overrides')}
            </button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={Boolean(cryptoCollectionGateFlag.enabled)}
                onChange={() => handleToggle(CRYPTO_COLLECTION_GATE_KEY)}
                disabled={loading || savingKey === CRYPTO_COLLECTION_GATE_KEY}
              />
              {cryptoCollectionGateFlag.enabled ? `ON · ${t('featureFlags.enabled')}` : `OFF · ${t('featureFlags.disabled')}`}
            </label>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {t('featureFlags.cryptoVerifiedHelp', { statuses: CRYPTO_COLLECTION_GATE_KYC_STATUSES.join(' or ') })}
          </div>
          <div style={{ display: 'grid', gap: '0.25rem', color: 'var(--muted)', fontSize: '13px' }}>
            <div>`enabled=true` globally enforces the gate for everyone by default.</div>
            <div>Override `enabled=false` for an account/email to allow collection while global gate is ON.</div>
            <div>Override `enabled=true` for an account/email to enforce the gate for that target.</div>
          </div>
        </CollapsibleSection>
      )}

      {cryptoCollectionPublicEndpointsFlag && (
        <CollapsibleSection
          title={t('featureFlags.cryptoPublicTitle')}
          subtitle={CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY}
          borderColor="#0284c7"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => openEditDialog(cryptoCollectionPublicEndpointsFlag)}
              disabled={savingKey === CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY}
              style={{
                border: `1px solid var(--border)`,
                background: 'var(--surface)',
                padding: '0.45rem 0.7rem',
                borderRadius: '10px',
                cursor: 'pointer',
                color: 'var(--text)'
              }}
            >
              Edit
            </button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={Boolean(cryptoCollectionPublicEndpointsFlag.enabled)}
                onChange={() => handleToggle(CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY)}
                disabled={loading || savingKey === CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY}
              />
              {cryptoCollectionPublicEndpointsFlag.enabled ? t('featureFlags.publicLinksBypassGate') : t('featureFlags.publicLinksEnforceGate')}
            </label>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {t('featureFlags.cryptoPublicHelp')}
          </div>
        </CollapsibleSection>
      )}

      {notificationPermissionWelcomeFlag && (
        <CollapsibleSection
          title="Request notification permission on Welcome screen"
          subtitle={NOTIFICATION_PERMISSION_WELCOME_KEY}
          borderColor="#2563eb"
        >
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            When enabled, the app asks for notification permission before signup/login on the Welcome screen.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            When disabled, the app skips the early prompt and asks later after the user is authenticated.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={Boolean(notificationPermissionWelcomeFlag.enabled)}
                onChange={() => handleToggle(NOTIFICATION_PERMISSION_WELCOME_KEY)}
                disabled={loading || savingKey === NOTIFICATION_PERMISSION_WELCOME_KEY}
              />
              {notificationPermissionWelcomeFlag.enabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
            </label>
          </div>
        </CollapsibleSection>
      )}

      {interTransferFlag && (
        <CollapsibleSection
          title={t('featureFlags.internalTransferTitle')}
          subtitle={INTER_TRANSFER_FLAG_KEY}
          borderColor="#14b8a6"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => openEditDialog(interTransferFlag)}
                disabled={savingKey === INTER_TRANSFER_FLAG_KEY}
                style={{
                  border: `1px solid var(--border)`,
                  background: 'var(--surface)',
                  padding: '0.45rem 0.7rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: 'var(--text)'
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => openOverridesDialog(INTER_TRANSFER_FLAG_KEY)}
                disabled={savingKey === INTER_TRANSFER_FLAG_KEY}
                style={{
                  border: `1px solid var(--border)`,
                  background: 'var(--surface)',
                  padding: '0.45rem 0.7rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: 'var(--text)'
                }}
              >
                {t('featureFlags.overrides')}
              </button>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={Boolean(interTransferFlag.enabled)}
                  onChange={() => handleToggle(INTER_TRANSFER_FLAG_KEY)}
                  disabled={loading || savingKey === INTER_TRANSFER_FLAG_KEY}
                />
                {interTransferFlag.enabled ? t('featureFlags.transfersAllowed') : t('featureFlags.transfersBlocked')}
              </label>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {t('featureFlags.internalTransferHelp')}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            {t('featureFlags.internalTransferOverridesHelp')}
          </div>
        </CollapsibleSection>
      )}

      {transactionAuthGlobalFlag && transactionAuthAndroidFlag && transactionAuthIosFlag && (
        <CollapsibleSection title={t('featureFlags.payoutAuthTitle')} borderColor="#f97316">
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {t('featureFlags.payoutAuthHelp')}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {t('featureFlags.globalOffIgnored')}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {t('featureFlags.platformOffBypass')}
          </div>

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {[
              { key: TRANSACTION_AUTH_GLOBAL_KEY, label: t('featureFlags.globalEnforcement'), flag: transactionAuthGlobalFlag },
              { key: TRANSACTION_AUTH_ANDROID_KEY, label: t('featureFlags.androidEnforcement'), flag: transactionAuthAndroidFlag },
              { key: TRANSACTION_AUTH_IOS_KEY, label: t('featureFlags.iosEnforcement'), flag: transactionAuthIosFlag }
            ].map((item) => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.55rem 0.7rem'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{item.label}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{item.key}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => openEditDialog(item.flag)}
                    disabled={savingKey === item.key}
                    style={{
                      border: `1px solid var(--border)`,
                      background: 'var(--surface)',
                      padding: '0.45rem 0.7rem',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      color: 'var(--text)'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => openOverridesDialog(item.key)}
                    disabled={savingKey === item.key}
                    style={{
                      border: `1px solid var(--border)`,
                      background: 'var(--surface)',
                      padding: '0.45rem 0.7rem',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      color: 'var(--text)'
                    }}
                  >
                    {t('featureFlags.overrides')}
                  </button>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(item.flag?.enabled)}
                      onChange={() => handleToggle(item.key)}
                      disabled={loading || savingKey === item.key}
                    />
                    {item.flag?.enabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: '0.25rem', color: 'var(--muted)', fontSize: '12px' }}>
            <div>{t('featureFlags.androidIssue')}</div>
            <div>{t('featureFlags.fullOutage')}</div>
            <div>{t('featureFlags.platformOverridesHelp')}</div>
            <div>{t('featureFlags.recoveryHelp')}</div>
          </div>
        </CollapsibleSection>
      )}

      {appOpenAuthGlobalFlag && appOpenAuthAndroidFlag && appOpenAuthIosFlag && (
        <CollapsibleSection title={t('featureFlags.appOpenTitle')} borderColor="#0ea5e9">
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {t('featureFlags.appOpenHelp')}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {t('featureFlags.independentFromPayoutAuth')}
          </div>

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {[
              { key: APP_OPEN_AUTH_GLOBAL_KEY, label: t('featureFlags.globalEnforcement'), flag: appOpenAuthGlobalFlag },
              { key: APP_OPEN_AUTH_ANDROID_KEY, label: t('featureFlags.androidEnforcement'), flag: appOpenAuthAndroidFlag },
              { key: APP_OPEN_AUTH_IOS_KEY, label: t('featureFlags.iosEnforcement'), flag: appOpenAuthIosFlag }
            ].map((item) => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.55rem 0.7rem'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{item.label}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{item.key}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => openEditDialog(item.flag)}
                    disabled={savingKey === item.key}
                    style={{
                      border: `1px solid var(--border)`,
                      background: 'var(--surface)',
                      padding: '0.45rem 0.7rem',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      color: 'var(--text)'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => openOverridesDialog(item.key)}
                    disabled={savingKey === item.key}
                    style={{
                      border: `1px solid var(--border)`,
                      background: 'var(--surface)',
                      padding: '0.45rem 0.7rem',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      color: 'var(--text)'
                    }}
                  >
                    {t('featureFlags.overrides')}
                  </button>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(item.flag?.enabled)}
                      onChange={() => handleToggle(item.key)}
                      disabled={loading || savingKey === item.key}
                    />
                    {item.flag?.enabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: '0.25rem', color: 'var(--muted)', fontSize: '12px' }}>
            <div>{t('featureFlags.appOpenGlobalOff')}</div>
            <div>{t('featureFlags.appOpenExample')}</div>
            <div>{t('featureFlags.appOpenOverrides')}</div>
            <div>{t('featureFlags.appOpenRollout')}</div>
          </div>
        </CollapsibleSection>
      )}

      {trustedDeviceGlobalFlag && trustedDeviceAndroidFlag && trustedDeviceIosFlag && (
        <CollapsibleSection title={t('featureFlags.trustedDeviceTitle')} borderColor="#f59e0b">
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {t('featureFlags.globalOffIgnored')}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {t('featureFlags.platformOffBypass')}
          </div>

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {[
              { key: TRUSTED_DEVICE_GLOBAL_KEY, label: t('featureFlags.globalEnforcement'), flag: trustedDeviceGlobalFlag },
              { key: TRUSTED_DEVICE_ANDROID_KEY, label: t('featureFlags.androidEnforcement'), flag: trustedDeviceAndroidFlag },
              { key: TRUSTED_DEVICE_IOS_KEY, label: t('featureFlags.iosEnforcement'), flag: trustedDeviceIosFlag }
            ].map((item) => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.55rem 0.7rem'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{item.label}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{item.key}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => openEditDialog(item.flag)}
                    disabled={savingKey === item.key}
                    style={{
                      border: `1px solid var(--border)`,
                      background: 'var(--surface)',
                      padding: '0.45rem 0.7rem',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      color: 'var(--text)'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => openOverridesDialog(item.key)}
                    disabled={savingKey === item.key}
                    style={{
                      border: `1px solid var(--border)`,
                      background: 'var(--surface)',
                      padding: '0.45rem 0.7rem',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      color: 'var(--text)'
                    }}
                  >
                    {t('featureFlags.overrides')}
                  </button>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(item.flag?.enabled)}
                      onChange={() => handleToggle(item.key)}
                      disabled={loading || savingKey === item.key}
                    />
                    {item.flag?.enabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: '0.25rem', color: 'var(--muted)', fontSize: '12px' }}>
            <div>{t('featureFlags.androidIssue')}</div>
            <div>{t('featureFlags.fullOutage')}</div>
            <div>{t('featureFlags.platformOverridesHelp')}</div>
            <div>{t('featureFlags.recoveryHelp')}</div>
          </div>
        </CollapsibleSection>
      )}

      {!loading && savingsFlags.length > 0 && (
        <CollapsibleSection
          title={t('featureFlags.savings')}
          subtitle={t('featureFlags.savingsDescription')}
          count={`${savingsFlags.length} flags`}
          borderColor="#16a34a"
        >
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {savingsFlags.map((flag) => {
              const label = formatResolvedLabel(flag.key);
              return (
                <div key={flag.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{label}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{flag.key}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => openEditDialog(flag)}
                        disabled={savingKey === flag.key}
                        style={{
                          border: `1px solid var(--border)`,
                          background: 'var(--surface)',
                          padding: '0.45rem 0.7rem',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          color: 'var(--text)'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openOverridesDialog(flag.key)}
                        disabled={savingKey === flag.key}
                        style={{
                          border: `1px solid var(--border)`,
                          background: 'var(--surface)',
                          padding: '0.45rem 0.7rem',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          color: 'var(--text)'
                        }}
                      >
                        {t('featureFlags.overrides')}
                      </button>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(flag.enabled)}
                          onChange={() => handleToggle(flag.key)}
                          disabled={loading || savingKey === flag.key}
                        />
                        {flag.enabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ key: flag.key })}
                        disabled={savingKey === flag.key}
                        style={{
                          border: `1px solid var(--border)`,
                          background: 'var(--surface)',
                          padding: '0.45rem 0.7rem',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          color: 'var(--text)'
                        }}
                      >
                        {t('featureFlags.delete')}
                      </button>
                    </div>
                  </div>
                  {flag.key === SAVINGS_ENABLED_KEY && (
                    <div style={{ display: 'grid', gap: '0.25rem', color: 'var(--muted)', fontSize: '12px' }}>
                      <div>{t('featureFlags.savingsResolution')}</div>
                      <div>{SAVINGS_DISABLED_MESSAGE_HELP}</div>
                    </div>
                  )}
                  {flag.key === AVEC_LOAN_REQUEST_REASON_KEY && (
                    <div style={{ display: 'grid', gap: '0.25rem', color: 'var(--muted)', fontSize: '12px' }}>
                      <div>Default is enabled when the flag is missing or null.</div>
                      <div>When disabled, the client app hides the AVEC loan request reason field and does not send notes.</div>
                      <div>{t('featureFlags.savingsResolution')}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      <div style={{ display: 'grid', gap: '0.85rem', maxWidth: '720px' }}>
        {loading && <div className="card">{t('featureFlags.loading')}</div>}
        {!loading && otherFlags.length === 0 && <div className="card">{t('featureFlags.none')}</div>}
        {groupedFlags.map((group) => (
          <Fragment key={group.key}>
            <CollapsibleSection title={group.label} count={`${group.flags.length} flags`}>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {group.flags.map((flag) => {
                  const label = formatResolvedLabel(flag.key);
                  const warning = WARNINGS[flag.key];
                  return (
                    <div key={flag.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{label}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{flag.key}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => openEditDialog(flag)}
                            disabled={savingKey === flag.key}
                            style={{
                              border: `1px solid var(--border)`,
                              background: 'var(--surface)',
                              padding: '0.45rem 0.7rem',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              color: 'var(--text)'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openOverridesDialog(flag.key)}
                            disabled={savingKey === flag.key}
                            style={{
                              border: `1px solid var(--border)`,
                              background: 'var(--surface)',
                              padding: '0.45rem 0.7rem',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              color: 'var(--text)'
                            }}
                          >
                            {t('featureFlags.overrides')}
                          </button>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                            <input type="checkbox" checked={Boolean(flag.enabled)} onChange={() => handleToggle(flag.key)} disabled={loading || savingKey === flag.key} />
                            {flag.enabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
                          </label>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm({ key: flag.key })}
                            disabled={savingKey === flag.key}
                            style={{
                              border: `1px solid var(--border)`,
                              background: 'var(--surface)',
                              padding: '0.45rem 0.7rem',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              color: 'var(--text)'
                            }}
                          >
                            {t('featureFlags.delete')}
                          </button>
                        </div>
                      </div>
                      {!flag.enabled && warning && <div style={{ color: '#b45309', fontWeight: 600 }}>{warning}</div>}
                      {flag.key === CUSTOMER_SERVICE_ENABLED_KEY && (
                        <div style={{ display: 'grid', gap: '0.25rem', color: 'var(--muted)', fontSize: '12px' }}>
                          <div>Default is enabled when the flag is missing or null.</div>
                          <div>Account overrides can hide the customer service FAB for specific users.</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
            {SHOW_CRYPTO_SPREAD_SECTION && group.key === 'crypto' && renderCryptoSpreadSection()}
          </Fragment>
        ))}

        {!loading && actionLimitFlags.length > 0 && (
          <CollapsibleSection title="Action Limit Settings" count={`${actionLimitFlags.length} actions`}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{ACTION_LIMIT_EXPLANATION}</div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {actionLimitFlags.map((flag) => (
                <div key={flag.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{formatActionLabel(flag.key)}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{flag.key}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => openEditDialog(flag)}
                        disabled={savingKey === flag.key}
                        style={{
                          border: `1px solid var(--border)`,
                          background: 'var(--surface)',
                          padding: '0.45rem 0.7rem',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          color: 'var(--text)'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openOverridesDialog(flag.key)}
                        disabled={savingKey === flag.key}
                        style={{
                          border: `1px solid var(--border)`,
                          background: 'var(--surface)',
                          padding: '0.45rem 0.7rem',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          color: 'var(--text)'
                        }}
                      >
                        {t('featureFlags.overrides')}
                      </button>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                        <input type="checkbox" checked={Boolean(flag.enabled)} onChange={() => handleToggle(flag.key)} disabled={loading || savingKey === flag.key} />
                        {flag.enabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ key: flag.key })}
                        disabled={savingKey === flag.key}
                        style={{
                          border: `1px solid var(--border)`,
                          background: 'var(--surface)',
                          padding: '0.45rem 0.7rem',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          color: 'var(--text)'
                        }}
                      >
                        {t('featureFlags.reset')}
                      </button>
                    </div>
                  </div>
                  {!flag.enabled && <div style={{ color: '#b45309', fontWeight: 600 }}>{ACTION_LIMIT_WARNING}</div>}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>

      {confirm && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ width: 'min(520px, 92vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800 }}>{t('featureFlags.disableFlagTitle')}</div>
              <button type="button" onClick={() => setConfirm(null)} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
                ×
              </button>
            </div>
            <div style={{ color: 'var(--muted)' }}>
              {t('featureFlags.disableConfirmHelp', { label: formatResolvedDisplayLabel(confirm.key) })}
            </div>
            {isActionLimitKey(confirm.key) && <div style={{ color: '#b45309', fontWeight: 600 }}>{ACTION_LIMIT_WARNING}</div>}
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                style={{ border: `1px solid var(--border)`, background: 'var(--surface)', padding: '0.6rem 0.85rem', borderRadius: '10px', cursor: 'pointer' }}
              >
                {t('featureFlags.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDisable}
                style={{ border: `1px solid #b91c1c`, background: '#b91c1c', color: '#fff', padding: '0.6rem 0.85rem', borderRadius: '10px', cursor: 'pointer' }}
              >
                {t('featureFlags.disable')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editDialog && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ width: 'min(760px, 96vw)', display: 'grid', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800 }}>Edit feature flag</div>
              <button
                type="button"
                onClick={() => {
                  if (savingKey === editDialog.key) return;
                  setEditDialog(null);
                }}
                style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}
              >
                ×
              </button>
            </div>
            {editLoading ? (
              <div style={{ color: 'var(--muted)' }}>Loading feature flag details…</div>
            ) : (
              <>
                <div style={{ color: 'var(--muted)' }}>
                  Feature: <strong>{editDialog.key}</strong>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={editDraftEnabled}
                    onChange={(e) => setEditDraftEnabled(e.target.checked)}
                    disabled={savingKey === editDialog.key}
                  />
                  {editDraftEnabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
                </label>
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  Messages are stored independently from the toggle and are used only when the feature is disabled.
                </div>
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor="editDisabledMessageEn">Disabled message (English)</label>
                    <textarea
                      id="editDisabledMessageEn"
                      rows={4}
                      value={editDraftDisabledMessageEn}
                      onChange={(e) => setEditDraftDisabledMessageEn(e.target.value)}
                      disabled={savingKey === editDialog.key}
                      placeholder={getDisabledMessagePlaceholder(editDialog.key)}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor="editDisabledMessageFr">Disabled message (French)</label>
                    <textarea
                      id="editDisabledMessageFr"
                      rows={4}
                      value={editDraftDisabledMessageFr}
                      onChange={(e) => setEditDraftDisabledMessageFr(e.target.value)}
                      disabled={savingKey === editDialog.key}
                      placeholder={getDisabledMessagePlaceholder(editDialog.key)}
                    />
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    {getDisabledMessageHelp(editDialog.key)}
                  </div>
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setEditDialog(null)}
                    disabled={savingKey === editDialog.key}
                    style={{ border: `1px solid var(--border)`, background: 'var(--surface)', padding: '0.6rem 0.85rem', borderRadius: '10px', cursor: 'pointer' }}
                  >
                    {t('featureFlags.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditDialog}
                    disabled={savingKey === editDialog.key}
                    style={{ border: `1px solid var(--border)`, background: 'var(--surface)', padding: '0.6rem 0.85rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {savingKey === editDialog.key ? t('common.refreshing') : t('featureFlags.save')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {overrideDialog && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ width: 'min(920px, 96vw)', display: 'grid', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800 }}>{overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY ? t('featureFlags.cryptoVerifiedTitle') : t('featureFlags.overrideModal')}</div>
              <button
                type="button"
                onClick={() => setOverrideDialog(null)}
                style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}
              >
                ×
              </button>
            </div>

            <div style={{ color: 'var(--muted)' }}>
              Feature: <strong>{overrideDialog.key}</strong>.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              {overrideDialog.key === SAVINGS_ENABLED_KEY ? (
                <>{t('featureFlags.savingsResolution')}</>
              ) : overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY ? (
                t('featureFlags.overridesPrecedence')
              ) : (
                <>{t('featureFlags.overridesPrecedence')}</>
              )}
            </div>
            {overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY && (
              <div style={{ display: 'grid', gap: '0.25rem', color: '#b45309', fontWeight: 600 }}>
                <div>{t('featureFlags.overrideEnabledFalseHelp')}</div>
                <div>{t('featureFlags.overrideEnabledTrueHelp')}</div>
              </div>
            )}
            {overrideDialog.key === SAVINGS_ENABLED_KEY && (
              <div style={{ display: 'grid', gap: '0.25rem', color: 'var(--muted)', fontSize: '13px' }}>
                <div>{t('featureFlags.countryOverridesHelp')}</div>
                <div>{t('featureFlags.accountOverridesStillWin')}</div>
              </div>
            )}

            {overrideDialog.key === SAVINGS_ENABLED_KEY && (
              <div className="card" style={{ display: 'grid', gap: '0.65rem' }}>
                <div style={{ fontWeight: 700 }}>{t('featureFlags.overrideByCountry')}</div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label htmlFor="overrideCountryCode">{t('featureFlags.countryCode')}</label>
                  <input
                    id="overrideCountryCode"
                    placeholder="CD"
                    value={overrideCountryCode}
                    onChange={(e) => setOverrideCountryCode(e.target.value.toUpperCase())}
                    disabled={overridesSaving}
                    style={{ width: '100%' }}
                  />
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  <input type="checkbox" checked={overrideCountryEnabled} onChange={(e) => setOverrideCountryEnabled(e.target.checked)} disabled={overridesSaving} />
                  {overrideCountryEnabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleSaveCountryOverride}
                    disabled={!overrideCountryCode.trim() || overridesSaving}
                    style={{
                      border: `1px solid var(--border)`,
                      background: 'var(--surface)',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      color: 'var(--text)'
                    }}
                  >
                    {t('featureFlags.saveCountryOverride')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveCountryOverride(false)}
                    disabled={!overrideCountryCode.trim() || overridesSaving}
                    style={{
                      border: `1px solid #b91c1c`,
                      background: '#fff',
                      color: '#b91c1c',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: 700
                    }}
                  >
                    {t('featureFlags.disableForCountry')}
                  </button>
                </div>
              </div>
            )}

            <div className="card" style={{ display: 'grid', gap: '0.65rem' }}>
              <div style={{ fontWeight: 700 }}>{t('featureFlags.overrideByAccount')}</div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor="overrideAccountId">{t('featureFlags.accountId')}</label>
                <input
                  id="overrideAccountId"
                  placeholder="123"
                  value={overrideAccountId}
                  onChange={(e) => setOverrideAccountId(e.target.value)}
                  disabled={overridesSaving}
                  style={{ width: '100%' }}
                />
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <input type="checkbox" checked={overrideEnabled} onChange={(e) => setOverrideEnabled(e.target.checked)} disabled={overridesSaving} />
                {overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY ? (overrideEnabled ? 'Enforce gate (verified only)' : 'Allow crypto collection') : overrideEnabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleSaveOverride}
                  disabled={!overrideAccountId.trim() || overridesSaving}
                  style={{
                    border: `1px solid var(--border)`,
                    background: 'var(--surface)',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    color: 'var(--text)'
                  }}
                >
                  {t('featureFlags.saveAccountOverride')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOverride(false)}
                  disabled={!overrideAccountId.trim() || overridesSaving}
                  style={{
                    border: `1px solid #b91c1c`,
                    background: '#fff',
                    color: '#b91c1c',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  {overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY ? t('featureFlags.allowCryptoCollectionForUser') : t('featureFlags.blockAccount')}
                </button>
              </div>
            </div>

            <div className="card" style={{ display: 'grid', gap: '0.65rem' }}>
              <div style={{ fontWeight: 700 }}>{t('featureFlags.overrideByEmail')}</div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor="overrideEmail">{t('featureFlags.email')}</label>
                <input
                  id="overrideEmail"
                  placeholder="qa@example.com"
                  value={overrideEmail}
                  onChange={(e) => setOverrideEmail(e.target.value)}
                  disabled={overridesSaving}
                  style={{ width: '100%' }}
                />
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <input type="checkbox" checked={overrideEmailEnabled} onChange={(e) => setOverrideEmailEnabled(e.target.checked)} disabled={overridesSaving} />
                {overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY ? (overrideEmailEnabled ? 'Enforce gate (verified only)' : 'Allow crypto collection') : overrideEmailEnabled ? t('featureFlags.enabled') : t('featureFlags.disabled')}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleSaveOverrideByEmail}
                  disabled={!overrideEmail.trim() || overridesSaving}
                  style={{
                    border: `1px solid var(--border)`,
                    background: 'var(--surface)',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    color: 'var(--text)'
                  }}
                >
                  {t('featureFlags.saveEmailOverride')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOverrideByEmail(false)}
                  disabled={!overrideEmail.trim() || overridesSaving}
                  style={{
                    border: `1px solid #b91c1c`,
                    background: '#fff',
                    color: '#b91c1c',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  {overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY ? t('featureFlags.allowCryptoCollectionForUser') : t('featureFlags.blockEmail')}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteOverrideByEmail}
                  disabled={!overrideEmail.trim() || overridesSaving}
                  style={{
                    border: `1px solid #b91c1c`,
                    background: '#fff',
                    color: '#b91c1c',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                >
                  {t('featureFlags.deleteEmailOverride')}
                </button>
              </div>
            </div>

            <div className="card" style={{ display: 'grid', gap: '0.65rem' }}>
              <div style={{ fontWeight: 700 }}>{t('featureFlags.currentOverrides')}</div>
              {overridesLoading && <div style={{ color: 'var(--muted)' }}>{t('featureFlags.loadingOverrides')}</div>}
              {!overridesLoading && overrides.length === 0 && <div style={{ color: 'var(--muted)' }}>{t('featureFlags.noOverrides')}</div>}
              {!overridesLoading &&
                overrides.map((entry) => (
                  <div
                    key={entry.id}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.55rem 0.65rem' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {entry.displayName || entry.displayEmail ? `${entry.displayName || entry.displayEmail}` : entry.targetLabel}
                      </div>
                      {entry.targetType === 'account' && (entry.displayEmail || entry.username || entry.accountReference || entry.accountId) ? (
                        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                          {[entry.displayEmail, entry.username ? `@${entry.username}` : '', entry.accountReference, entry.accountId ? `Account ${entry.accountId}` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      ) : null}
                      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                        {overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY ? (entry.enabled ? t('featureFlags.overrideGateEnforced') : t('featureFlags.overrideAllowCollection')) : entry.enabled ? t('featureFlags.forcedOn') : t('featureFlags.forcedOff')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteOverride(entry)}
                      disabled={overridesSaving}
                      style={{
                        border: `1px solid #b91c1c`,
                        background: '#fff',
                        color: '#b91c1c',
                        padding: '0.45rem 0.7rem',
                        borderRadius: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      {t('featureFlags.delete')}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ width: 'min(520px, 92vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800 }}>Delete feature flag?</div>
              <button type="button" onClick={() => setDeleteConfirm(null)} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
                ×
              </button>
            </div>
            <div style={{ color: 'var(--muted)' }}>
              Deleting <strong>{formatResolvedDisplayLabel(deleteConfirm.key)}</strong> resets it to the default behavior.
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                style={{ border: `1px solid var(--border)`, background: 'var(--surface)', padding: '0.6rem 0.85rem', borderRadius: '10px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFlag}
                style={{ border: `1px solid #b91c1c`, background: '#b91c1c', color: '#fff', padding: '0.6rem 0.85rem', borderRadius: '10px', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
  const loadOverrideEntries = async (key) => {
  const [accountRes, countryRes] = await Promise.all([
      api.featureFlags.listOverrides(key),
      api.featureFlags.listCountryOverrides(key).catch((err) => {
        if (err?.status === 404) return [];
        throw err;
      })
    ]);
    const normalized = [
      ...(Array.isArray(accountRes) ? accountRes : []).map(normalizeOverride),
      ...(Array.isArray(countryRes) ? countryRes : []).map(normalizeCountryOverride)
    ].filter(Boolean);
    const enriched = await Promise.all(normalized.map(withOverrideIdentity));
    return enriched
      .filter(Boolean)
      .sort((a, b) => a.targetLabel.localeCompare(b.targetLabel));
  };
