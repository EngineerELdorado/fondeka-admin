'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

const LABELS = {
  trusted_device_enforcement: 'Enforce Trusted Device',
  auto_refund: 'Auto Refunds',
  'crypto.external.collection.verified_only': 'Restrict crypto collection to verified users',
  'crypto.external.collection.allow_public_endpoints': 'Allow public crypto payment links'
};

const WARNINGS = {
  trusted_device_enforcement: 'Warning: Disabling trusted device enforcement reduces security for customer endpoints.',
  auto_refund: 'Warning: Disabling auto refunds will route failed refunds to manual review.'
};

const ACTION_LIMIT_PREFIX = 'limit.check.action.';
const ACTION_LIMIT_WARNING = 'Disabling limit checks may allow transactions above regulatory or internal limits.';
const ACTION_LIMIT_EXPLANATION = 'If disabled, amount limits (KYC caps or custom limits) are not enforced for this action.';
const CRYPTO_SPREAD_GLOBAL_KEY = 'crypto.spread.enabled';
const CRYPTO_SPREAD_ACTION_PREFIX = 'crypto.spread.action.';
const INTER_TRANSFER_FLAG_KEY = 'wallet.inter_transfer.enabled';
const TRUSTED_DEVICE_GLOBAL_KEY = 'trusted_device_enforcement';
const TRUSTED_DEVICE_ANDROID_KEY = 'trusted_device_enforcement.android';
const TRUSTED_DEVICE_IOS_KEY = 'trusted_device_enforcement.ios';
const TRANSACTION_AUTH_GLOBAL_KEY = 'transaction_auth_enforcement';
const TRANSACTION_AUTH_ANDROID_KEY = 'transaction_auth_enforcement.android';
const TRANSACTION_AUTH_IOS_KEY = 'transaction_auth_enforcement.ios';

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
const CRYPTO_COLLECTION_GATE_KYC_STATUSES = ['APPROVED', 'PROVISIONALLY_APPROVED'];

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

const formatDisplayLabel = (key) => (isActionLimitKey(key) ? formatActionLabel(key) : formatLabel(key));
const isCryptoSpreadActionKey = (key) => String(key || '').startsWith(CRYPTO_SPREAD_ACTION_PREFIX);
const actionFromCryptoSpreadKey = (key) => String(key || '').replace(CRYPTO_SPREAD_ACTION_PREFIX, '');
const formatCryptoSpreadActionLabel = (key) => {
  const action = actionFromCryptoSpreadKey(key);
  return ACTION_LABELS[action] || formatKeyPart(action);
};
const normalizeActionToken = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');

const normalizeOverride = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const accountId = entry.accountId ?? entry.account_id ?? entry.id ?? entry?.account?.id ?? '';
  const email = entry.email ?? entry.emailAddress ?? entry.accountEmail ?? entry?.account?.email ?? '';
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
    enabled: Boolean(entry.enabled)
  };
};

const getOverrideErrorMessage = (err, fallback) => {
  if (err?.status === 404) return 'Account or email not found';
  return err?.message || fallback;
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [draftKey, setDraftKey] = useState('');
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [overrideDialog, setOverrideDialog] = useState(null);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [overridesSaving, setOverridesSaving] = useState(false);
  const [overrideAccountId, setOverrideAccountId] = useState('');
  const [overrideEnabled, setOverrideEnabled] = useState(true);
  const [overrideEmail, setOverrideEmail] = useState('');
  const [overrideEmailEnabled, setOverrideEmailEnabled] = useState(true);
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
          String(flag.key) !== CRYPTO_COLLECTION_GATE_KEY &&
          String(flag.key) !== CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY &&
          String(flag.key) !== CRYPTO_SPREAD_GLOBAL_KEY &&
          String(flag.key) !== INTER_TRANSFER_FLAG_KEY &&
          String(flag.key) !== TRUSTED_DEVICE_GLOBAL_KEY &&
          String(flag.key) !== TRUSTED_DEVICE_ANDROID_KEY &&
          String(flag.key) !== TRUSTED_DEVICE_IOS_KEY &&
          String(flag.key) !== TRANSACTION_AUTH_GLOBAL_KEY &&
          String(flag.key) !== TRANSACTION_AUTH_ANDROID_KEY &&
          String(flag.key) !== TRANSACTION_AUTH_IOS_KEY &&
          !isCryptoSpreadActionKey(flag.key)
      ),
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

  const loadFlags = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.featureFlags.list();
      const list = Array.isArray(res) ? res : [];
      const hasCryptoCollectionGate = list.some((flag) => String(flag?.key) === CRYPTO_COLLECTION_GATE_KEY);
      const hasPublicEndpointsFlag = list.some((flag) => String(flag?.key) === CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY);
      const hasCryptoSpreadGlobal = list.some((flag) => String(flag?.key) === CRYPTO_SPREAD_GLOBAL_KEY);
      const hasInterTransferFlag = list.some((flag) => String(flag?.key) === INTER_TRANSFER_FLAG_KEY);
      const hasTrustedGlobalFlag = list.some((flag) => String(flag?.key) === TRUSTED_DEVICE_GLOBAL_KEY);
      const hasTrustedAndroidFlag = list.some((flag) => String(flag?.key) === TRUSTED_DEVICE_ANDROID_KEY);
      const hasTrustedIosFlag = list.some((flag) => String(flag?.key) === TRUSTED_DEVICE_IOS_KEY);
      const hasTransactionAuthGlobalFlag = list.some((flag) => String(flag?.key) === TRANSACTION_AUTH_GLOBAL_KEY);
      const hasTransactionAuthAndroidFlag = list.some((flag) => String(flag?.key) === TRANSACTION_AUTH_ANDROID_KEY);
      const hasTransactionAuthIosFlag = list.some((flag) => String(flag?.key) === TRANSACTION_AUTH_IOS_KEY);
      const defaults = [];
      if (!hasCryptoCollectionGate) defaults.push({ key: CRYPTO_COLLECTION_GATE_KEY, enabled: true, isDefault: true });
      if (!hasPublicEndpointsFlag) defaults.push({ key: CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY, enabled: true, isDefault: true });
      if (!hasCryptoSpreadGlobal) defaults.push({ key: CRYPTO_SPREAD_GLOBAL_KEY, enabled: true, isDefault: true });
      if (!hasInterTransferFlag) defaults.push({ key: INTER_TRANSFER_FLAG_KEY, enabled: true, isDefault: true });
      if (!hasTrustedGlobalFlag) defaults.push({ key: TRUSTED_DEVICE_GLOBAL_KEY, enabled: true, isDefault: true });
      if (!hasTrustedAndroidFlag) defaults.push({ key: TRUSTED_DEVICE_ANDROID_KEY, enabled: true, isDefault: true });
      if (!hasTrustedIosFlag) defaults.push({ key: TRUSTED_DEVICE_IOS_KEY, enabled: true, isDefault: true });
      if (!hasTransactionAuthGlobalFlag) defaults.push({ key: TRANSACTION_AUTH_GLOBAL_KEY, enabled: true, isDefault: true });
      if (!hasTransactionAuthAndroidFlag) defaults.push({ key: TRANSACTION_AUTH_ANDROID_KEY, enabled: true, isDefault: true });
      if (!hasTransactionAuthIosFlag) defaults.push({ key: TRANSACTION_AUTH_IOS_KEY, enabled: true, isDefault: true });
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
      const res = await api.featureFlags.update(key, { enabled: nextEnabled });
      setFlags((prev) => prev.map((flag) => (flag.key === key ? { ...flag, enabled: Boolean(res?.enabled) } : flag)));
      setInfo(`${formatDisplayLabel(key)} ${res?.enabled ? 'enabled' : 'disabled'}.`);
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
      const res = await api.featureFlags.update(key, { enabled: false });
      setFlags((prev) => prev.map((flag) => (flag.key === key ? { ...flag, enabled: Boolean(res?.enabled) } : flag)));
      setInfo(`${formatDisplayLabel(key)} disabled.`);
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
      setInfo(`${formatDisplayLabel(key)} reset to default.`);
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
      const res = await api.featureFlags.update(key, { enabled: draftEnabled });
      setFlags((prev) => {
        const exists = prev.some((flag) => flag.key === key);
        if (exists) {
          return prev.map((flag) => (flag.key === key ? { ...flag, enabled: Boolean(res?.enabled) } : flag));
        }
        return [{ key, enabled: Boolean(res?.enabled) }, ...prev];
      });
      setInfo(`${formatDisplayLabel(key)} ${res?.enabled ? 'enabled' : 'disabled'}.`);
      setDraftKey('');
      setDraftEnabled(true);
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

  const openOverridesDialog = async (key) => {
    if (!key) return;
    setOverrideDialog({ key });
    setOverrideAccountId('');
    setOverrideEnabled(true);
    setOverrideEmail('');
    setOverrideEmailEnabled(true);
    setOverrides([]);
    setOverridesLoading(true);
    setError(null);
    try {
      const res = await api.featureFlags.listOverrides(key);
      const list = (Array.isArray(res) ? res : [])
        .map(normalizeOverride)
        .filter(Boolean)
        .sort((a, b) => a.targetLabel.localeCompare(b.targetLabel));
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
      const res = await api.featureFlags.listOverrides(key);
      const list = (Array.isArray(res) ? res : [])
        .map(normalizeOverride)
        .filter(Boolean)
        .sort((a, b) => a.targetLabel.localeCompare(b.targetLabel));
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
      const res = await api.featureFlags.listOverrides(key);
      const list = (Array.isArray(res) ? res : [])
        .map(normalizeOverride)
        .filter(Boolean)
        .sort((a, b) => a.targetLabel.localeCompare(b.targetLabel));
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
      const res = await api.featureFlags.listOverrides(key);
      const list = (Array.isArray(res) ? res : [])
        .map(normalizeOverride)
        .filter(Boolean)
        .sort((a, b) => a.targetLabel.localeCompare(b.targetLabel));
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
    if (!key || (!accountId && !email) || overridesSaving) return;
    setOverridesSaving(true);
    setError(null);
    setInfo(null);
    try {
      if (accountId) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 800 }}>Feature Flags</div>
        <div style={{ color: 'var(--muted)' }}>Toggle admin-controlled runtime features.</div>
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

      <div className="card" style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontWeight: 700 }}>Create / Update Flag</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.65rem', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="flagKey">Key</label>
            <input id="flagKey" placeholder="trusted_device_enforcement" value={draftKey} onChange={(e) => setDraftKey(e.target.value)} />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <input type="checkbox" checked={draftEnabled} onChange={(e) => setDraftEnabled(e.target.checked)} />
            {draftEnabled ? 'Enabled' : 'Disabled'}
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
            Save
          </button>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Supported keys: {SUPPORTED_KEYS.join(', ')}
        </div>
      </div>

      {cryptoCollectionGateFlag && (
        <div className="card" style={{ maxWidth: '720px', display: 'grid', gap: '0.75rem', borderColor: '#f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800 }}>Restrict crypto collection to verified users</div>
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{CRYPTO_COLLECTION_GATE_KEY}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                Manage Overrides
              </button>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={Boolean(cryptoCollectionGateFlag.enabled)}
                  onChange={() => handleToggle(CRYPTO_COLLECTION_GATE_KEY)}
                  disabled={loading || savingKey === CRYPTO_COLLECTION_GATE_KEY}
                />
                {cryptoCollectionGateFlag.enabled ? 'ON · Gate enforced' : 'OFF · Gate removed'}
              </label>
            </div>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Access is allowed only when KYC status is <strong>{CRYPTO_COLLECTION_GATE_KYC_STATUSES.join(' or ')}</strong> and KYC level is <strong>2 or above</strong>, unless an override is set.
          </div>
          <div style={{ display: 'grid', gap: '0.25rem', color: 'var(--muted)', fontSize: '13px' }}>
            <div>`enabled=true` globally enforces the gate for everyone by default.</div>
            <div>Override `enabled=false` for an account/email to allow collection while global gate is ON.</div>
            <div>Override `enabled=true` for an account/email to enforce the gate for that target.</div>
          </div>
        </div>
      )}

      {cryptoCollectionPublicEndpointsFlag && (
        <div className="card" style={{ maxWidth: '720px', display: 'grid', gap: '0.75rem', borderColor: '#0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800 }}>Allow public crypto payment links</div>
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY}</div>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={Boolean(cryptoCollectionPublicEndpointsFlag.enabled)}
                onChange={() => handleToggle(CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY)}
                disabled={loading || savingKey === CRYPTO_COLLECTION_PUBLIC_ENDPOINTS_KEY}
              />
              {cryptoCollectionPublicEndpointsFlag.enabled ? 'ON · Public links bypass gate' : 'OFF · Public links enforce gate'}
            </label>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Controls crypto collection behavior for payment-request pay links and other public endpoints.
          </div>
        </div>
      )}

      {cryptoSpreadGlobalFlag && (
        <div className="card" style={{ maxWidth: '720px', display: 'grid', gap: '0.75rem', borderColor: '#0ea5e9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800 }}>Crypto spread</div>
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{CRYPTO_SPREAD_GLOBAL_KEY}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                Manage Overrides
              </button>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={Boolean(cryptoSpreadGlobalFlag.enabled)}
                  onChange={() => handleToggle(CRYPTO_SPREAD_GLOBAL_KEY)}
                  disabled={loading || savingKey === CRYPTO_SPREAD_GLOBAL_KEY}
                />
                {cryptoSpreadGlobalFlag.enabled ? 'ON · enabled globally' : 'OFF · disabled globally'}
              </label>
            </div>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Resolution order: action override → action global → global override → global `crypto.spread.enabled` (default true).
          </div>

          <div className="card" style={{ display: 'grid', gap: '0.65rem' }}>
            <div style={{ fontWeight: 700 }}>Create or update action key</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.65rem', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="spreadActionDraft">Action (lowercase enum)</label>
                <input
                  id="spreadActionDraft"
                  placeholder="fund_card"
                  value={spreadActionDraft}
                  onChange={(e) => setSpreadActionDraft(e.target.value)}
                />
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <input type="checkbox" checked={spreadActionEnabled} onChange={(e) => setSpreadActionEnabled(e.target.checked)} />
                {spreadActionEnabled ? 'Enabled' : 'Disabled'}
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
                Save action
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.7rem' }}>
            <div style={{ fontWeight: 700 }}>Action spread flags</div>
            {cryptoSpreadActionFlags.length === 0 && <div style={{ color: 'var(--muted)', fontSize: '13px' }}>No action keys yet.</div>}
            {cryptoSpreadActionFlags.map((flag) => (
              <div key={flag.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.6rem 0.7rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{formatCryptoSpreadActionLabel(flag.key)}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{flag.key}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
                    Reset
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {interTransferFlag && (
        <div className="card" style={{ maxWidth: '720px', display: 'grid', gap: '0.75rem', borderColor: '#14b8a6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800 }}>Internal wallet transfer</div>
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{INTER_TRANSFER_FLAG_KEY}</div>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={Boolean(interTransferFlag.enabled)}
                onChange={() => handleToggle(INTER_TRANSFER_FLAG_KEY)}
                disabled={loading || savingKey === INTER_TRANSFER_FLAG_KEY}
              />
              {interTransferFlag.enabled ? 'ON · transfers allowed' : 'OFF · transfers blocked'}
            </label>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Default is <strong>enabled</strong> when no value exists. Disable this flag to block all <code>INTER_TRANSFER</code> requests before transaction creation.
          </div>
        </div>
      )}

      {transactionAuthGlobalFlag && transactionAuthAndroidFlag && transactionAuthIosFlag && (
        <div className="card" style={{ maxWidth: '720px', display: 'grid', gap: '0.75rem', borderColor: '#f97316' }}>
          <div style={{ fontWeight: 800 }}>Transaction Auth Enforcement</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            If Global is OFF, platform/account settings are ignored.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Platform OFF is emergency bypass for that platform.
          </div>

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {[
              { key: TRANSACTION_AUTH_GLOBAL_KEY, label: 'Global enforcement', flag: transactionAuthGlobalFlag },
              { key: TRANSACTION_AUTH_ANDROID_KEY, label: 'Android enforcement', flag: transactionAuthAndroidFlag },
              { key: TRANSACTION_AUTH_IOS_KEY, label: 'iOS enforcement', flag: transactionAuthIosFlag }
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
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(item.flag?.enabled)}
                    onChange={() => handleToggle(item.key)}
                    disabled={loading || savingKey === item.key}
                  />
                  {item.flag?.enabled ? 'Enabled' : 'Disabled'}
                </label>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: '0.25rem', color: 'var(--muted)', fontSize: '12px' }}>
            <div>Android issue: keep Global ON, set Android OFF, keep iOS ON.</div>
            <div>Full outage: set Global OFF.</div>
            <div>Recovery: re-enable platform/global toggles progressively and monitor failures.</div>
          </div>
        </div>
      )}

      {trustedDeviceGlobalFlag && trustedDeviceAndroidFlag && trustedDeviceIosFlag && (
        <div className="card" style={{ maxWidth: '720px', display: 'grid', gap: '0.75rem', borderColor: '#f59e0b' }}>
          <div style={{ fontWeight: 800 }}>Trusted Device Enforcement</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            If Global is OFF, platform/account settings are ignored.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Platform OFF is emergency bypass for that platform.
          </div>

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {[
              { key: TRUSTED_DEVICE_GLOBAL_KEY, label: 'Global enforcement', flag: trustedDeviceGlobalFlag },
              { key: TRUSTED_DEVICE_ANDROID_KEY, label: 'Android enforcement', flag: trustedDeviceAndroidFlag },
              { key: TRUSTED_DEVICE_IOS_KEY, label: 'iOS enforcement', flag: trustedDeviceIosFlag }
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
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(item.flag?.enabled)}
                    onChange={() => handleToggle(item.key)}
                    disabled={loading || savingKey === item.key}
                  />
                  {item.flag?.enabled ? 'Enabled' : 'Disabled'}
                </label>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: '0.25rem', color: 'var(--muted)', fontSize: '12px' }}>
            <div>Android biometric issue: keep Global ON, set Android OFF, keep iOS ON.</div>
            <div>Full outage: set Global OFF.</div>
            <div>Recovery: re-enable platform/global toggles progressively and monitor failures.</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.85rem', maxWidth: '720px' }}>
        {loading && <div className="card">Loading feature flags…</div>}
        {!loading && otherFlags.length === 0 && <div className="card">No feature flags available.</div>}
        {groupedFlags.map((group) => (
          <div key={group.key} className="card" style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800 }}>{group.label}</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{group.flags.length} flags</div>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {group.flags.map((flag) => {
                const label = formatLabel(flag.key);
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
                          Delete
                        </button>
                      </div>
                    </div>
                    {!flag.enabled && warning && <div style={{ color: '#b45309', fontWeight: 600 }}>{warning}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {!loading && actionLimitFlags.length > 0 && (
          <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800 }}>Action Limit Settings</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{actionLimitFlags.length} actions</div>
            </div>
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
                        Reset
                      </button>
                    </div>
                  </div>
                  {!flag.enabled && <div style={{ color: '#b45309', fontWeight: 600 }}>{ACTION_LIMIT_WARNING}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {confirm && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ width: 'min(520px, 92vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800 }}>Disable feature flag?</div>
              <button type="button" onClick={() => setConfirm(null)} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
                ×
              </button>
            </div>
            <div style={{ color: 'var(--muted)' }}>
              This will disable <strong>{formatDisplayLabel(confirm.key)}</strong> and may reduce security or change system behavior.
            </div>
            {isActionLimitKey(confirm.key) && <div style={{ color: '#b45309', fontWeight: 600 }}>{ACTION_LIMIT_WARNING}</div>}
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                style={{ border: `1px solid var(--border)`, background: 'var(--surface)', padding: '0.6rem 0.85rem', borderRadius: '10px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisable}
                style={{ border: `1px solid #b91c1c`, background: '#b91c1c', color: '#fff', padding: '0.6rem 0.85rem', borderRadius: '10px', cursor: 'pointer' }}
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {overrideDialog && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ width: 'min(920px, 96vw)', display: 'grid', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800 }}>{overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY ? 'Account crypto collection override' : 'Feature Overrides'}</div>
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
              {overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY
                ? 'Per-account/per-email overrides take precedence over the global flag.'
                : <>Per-account/per-email overrides take precedence over the global flag. Use <strong>forced OFF</strong> to block an individual even when the feature is globally ON.</>}
            </div>
            {overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY && (
              <div style={{ display: 'grid', gap: '0.25rem', color: '#b45309', fontWeight: 600 }}>
                <div>Use override `enabled=false` to allow crypto collection for a specific account/email even when global gate is ON.</div>
                <div>Use override `enabled=true` to explicitly enforce the gate for that account/email.</div>
              </div>
            )}

            <div className="card" style={{ display: 'grid', gap: '0.65rem' }}>
              <div style={{ fontWeight: 700 }}>Override by account</div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor="overrideAccountId">Account ID</label>
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
                {overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY ? (overrideEnabled ? 'Enforce gate (verified only)' : 'Allow crypto collection') : overrideEnabled ? 'Enabled' : 'Disabled'}
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
                  Save account override
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
                  {overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY ? 'Allow crypto collection for this user' : 'Block account'}
                </button>
              </div>
            </div>

            <div className="card" style={{ display: 'grid', gap: '0.65rem' }}>
              <div style={{ fontWeight: 700 }}>Override by email</div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor="overrideEmail">Email</label>
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
                {overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY ? (overrideEmailEnabled ? 'Enforce gate (verified only)' : 'Allow crypto collection') : overrideEmailEnabled ? 'Enabled' : 'Disabled'}
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
                  Save email override
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
                  {overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY ? 'Allow crypto collection for this user' : 'Block email'}
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
                  Delete email override
                </button>
              </div>
            </div>

            <div className="card" style={{ display: 'grid', gap: '0.65rem' }}>
              <div style={{ fontWeight: 700 }}>Current Overrides</div>
              {overridesLoading && <div style={{ color: 'var(--muted)' }}>Loading overrides…</div>}
              {!overridesLoading && overrides.length === 0 && <div style={{ color: 'var(--muted)' }}>No overrides for this feature.</div>}
              {!overridesLoading &&
                overrides.map((entry) => (
                  <div
                    key={entry.id}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.55rem 0.65rem' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{entry.targetLabel}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                        {overrideDialog.key === CRYPTO_COLLECTION_GATE_KEY ? (entry.enabled ? 'Enforce gate' : 'Allow collection') : entry.enabled ? 'Forced ON' : 'Forced OFF'}
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
                      Delete
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
              Deleting <strong>{formatDisplayLabel(deleteConfirm.key)}</strong> resets it to the default behavior.
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
