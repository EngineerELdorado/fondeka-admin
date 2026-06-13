'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const SECONDARY_DELIVERY_MODE_OPTIONS = [
  { value: 'PUSH_ONLY', label: 'Push only' },
  { value: 'EMAIL_ONLY', label: 'Email only' },
  { value: 'WHATSAPP_ONLY', label: 'WhatsApp only' },
  { value: 'EMAIL_AND_WHATSAPP', label: 'Email and WhatsApp' },
  { value: 'EMAIL_THEN_WHATSAPP', label: 'Email then WhatsApp' },
  { value: 'WHATSAPP_THEN_EMAIL', label: 'WhatsApp then Email' }
];
const SECONDARY_DELIVERY_MODES = new Set(SECONDARY_DELIVERY_MODE_OPTIONS.map((option) => option.value));
const CHANNEL_OPTIONS = ['PUSH', 'EMAIL', 'SMS', 'WHATSAPP'];
const CATEGORY_OPTIONS = ['TRANSACTIONAL', 'SECURITY', 'INFORMATIONAL'];
const EVENT_OPTIONS = [
  'ACCOUNT_PHONE_UPDATED',
  'ADMIN_CRYPTO_WALLET_CREDIT',
  'ADMIN_WALLET_CREDIT',
  'ADMIN_WALLET_DEBIT',
  'AIRTIME_COMPLETED',
  'AIRTIME_PROVIDER_CALLBACK',
  'AIRTIME_PURCHASED',
  'AML_BLACKLIST_REMOVED',
  'AML_BLACKLISTED',
  'BANK_DEPOSIT_CREDITED',
  'BILL_PAYMENT_COMPLETED',
  'BILL_PAYMENT_MARKETING_REMINDER',
  'BILL_TV_EXPIRY_REMINDER',
  'CARD_BLOCKED_BY_ADMIN',
  'CARD_FUND_COMPLETED',
  'CARD_FUND_DELAYED',
  'CARD_ORDER_COMPLETED',
  'CARD_UNBLOCKED_BY_ADMIN',
  'CARD_WITHDRAW_COMPLETED',
  'CARD_WITHDRAW_DELAYED',
  'CARD_WITHDRAW_FAILED',
  'CRYPTO_BUY_COMPLETED',
  'CRYPTO_COLLECTION_BELOW_MINIMUM',
  'CRYPTO_NOTIFICATION',
  'CRYPTO_SELL_COMPLETED',
  'DEVICE_REPLACEMENT_PENDING',
  'ESIM_COMPLETED',
  'ESIM_INSTALLATION_GUIDE',
  'ESIM_PAYMENT_RECEIVED',
  'ESIM_USAGE',
  'FEATURE_FLAG_ENABLED',
  'GROUP_SAVING_BENEFICIARY_CONTRIBUTION_OPTIONAL_UPDATED',
  'GROUP_SAVING_CONTRIBUTION_PAID',
  'GROUP_SAVING_CONTRIBUTION_REMINDER',
  'GROUP_SAVING_CUSTOM_MESSAGE',
  'GROUP_SAVING_CYCLE_FUNDED',
  'GROUP_SAVING_DELETED',
  'GROUP_SAVING_INVITATION_ACCEPTED',
  'GROUP_SAVING_JOIN_REQUEST_APPROVED',
  'GROUP_SAVING_JOIN_REQUEST_CREATED',
  'GROUP_SAVING_JOIN_REQUEST_REJECTED',
  'GROUP_SAVING_LOAN_APPROVED',
  'GROUP_SAVING_LOAN_ELIGIBILITY_BOOSTED',
  'GROUP_SAVING_LOAN_REJECTED',
  'GROUP_SAVING_LOAN_REQUESTED',
  'GROUP_SAVING_MEMBER_REMOVED',
  'GROUP_SAVING_PAYOUT_COMPLETED',
  'GROUP_SAVING_POLICY_CHANGE_REQUESTED',
  'GROUP_SAVING_ROUND_DISTRIBUTION_COMPLETED',
  'GROUP_SAVING_TREASURY_CONTRIBUTION_PAID',
  'GROUP_SAVING_TREASURY_WITHDRAWAL_PAID',
  'INTER_TRANSFER_RECEIVED',
  'INTER_TRANSFER_SENT',
  'KYC_LEVEL_UPDATE',
  'KYC_STATUS_UPDATE',
  'LOAN_APPROVED',
  'LOAN_DISBURSED',
  'LOAN_DUE_REMINDER',
  'LOAN_GRANTED',
  'LOAN_OVERDUE_RESTRICTION_APPLIED',
  'LOAN_PENALTY_APPLIED',
  'LOAN_REJECTED',
  'LOAN_REPAYMENT_COMPLETED',
  'MANUAL_INTERVENTION_REQUIRED',
  'PAYMENT_REQUEST_APPROVED',
  'PAYMENT_REQUEST_COMPLETED',
  'PAYMENT_REQUEST_PENDING_APPROVAL',
  'PERSONAL_SAVING_DEPOSIT_COMPLETED',
  'PERSONAL_SAVING_INTEREST_PAYOUT_COMPLETED',
  'PERSONAL_SAVING_WITHDRAWAL_COMPLETED',
  'REFERRAL_INVITEE_LINKED',
  'REFERRAL_INVITEE_REMINDER',
  'REFERRAL_POINTS_EARNED',
  'REFERRAL_POINTS_REDEEMED',
  'SETTLEMENT_COMPLETED',
  'TRANSACTION_CANCELED',
  'TRANSACTION_FAILED',
  'TRANSACTION_REFUND',
  'WALLET_DEPOSIT',
  'WALLET_PAYOUT_COMPLETED'
].sort();
const ACTION_OPTIONS = [
  'BONUS',
  'BUY_CARD',
  'BUY_CRYPTO',
  'BUY_GIFT_CARD',
  'CARD_MAINTENANCE',
  'CARD_ONLINE_PAYMENT',
  'CARD_PAYMENT_REVERSAL',
  'E_SIM_PURCHASE',
  'E_SIM_TOPUP',
  'FUND_CARD',
  'FUND_WALLET',
  'GROUP_SAVING_CONTRIBUTION',
  'GROUP_SAVING_PAYOUT',
  'GROUP_SAVING_ROUND_DISTRIBUTION',
  'GROUP_SAVING_TREASURY_CONTRIBUTION',
  'GROUP_SAVING_TREASURY_WITHDRAWAL',
  'INTER_TRANSFER',
  'LOAN_DISBURSEMENT',
  'LOAN_REQUEST',
  'MANUAL_ADJUSTMENT',
  'OTHER',
  'PAY_ELECTRICITY_BILL',
  'PAY_INTERNET_BILL',
  'PAY_NETFLIX',
  'PAY_REQUEST',
  'PAY_TV_SUBSCRIPTION',
  'PAY_WATER_BILL',
  'PERSONAL_SAVING_DEPOSIT',
  'PERSONAL_SAVING_INTEREST_PAYOUT',
  'PERSONAL_SAVING_WITHDRAWAL',
  'RECEIVE_CRYPTO',
  'REPAY_LOAN',
  'REQUEST_PAYMENT',
  'REFUND_TO_WALLET',
  'SELL_CRYPTO',
  'SEND_AIRTIME',
  'SEND_CRYPTO',
  'SEND_DATA_BUNDLES',
  'SETTLEMENT',
  'SWAP_CRYPTO',
  'WITHDRAW_FROM_CARD',
  'WITHDRAW_FROM_WALLET'
].sort();

const normalizeEnum = (value) => String(value || '').trim().toUpperCase();
const normalizeSecondaryDeliveryMode = (value) => {
  const normalized = normalizeEnum(value);
  return SECONDARY_DELIVERY_MODES.has(normalized) ? normalized : 'EMAIL_ONLY';
};
const uniqueSortedUppercase = (values, allowedValues) => {
  const allowed = allowedValues ? new Set(allowedValues) : null;
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeEnum(value))
        .filter((value) => value && (!allowed || allowed.has(value)))
    )
  ).sort();
};
const createDefaultChannelRule = (channel) => ({
  channel,
  enabled: true,
  excludedCategories: [],
  excludedEvents: [],
  excludedTransactionActions: []
});
const normalizeChannelRule = (rule, channel) => ({
  channel,
  enabled: rule?.enabled !== false,
  excludedCategories: uniqueSortedUppercase(rule?.excludedCategories, CATEGORY_OPTIONS),
  excludedEvents: uniqueSortedUppercase(rule?.excludedEvents, EVENT_OPTIONS),
  excludedTransactionActions: uniqueSortedUppercase(rule?.excludedTransactionActions, ACTION_OPTIONS)
});
const normalizeChannelRules = (rules) => {
  const byChannel = new Map();
  for (const rule of Array.isArray(rules) ? rules : []) {
    const channel = normalizeEnum(rule?.channel);
    if (CHANNEL_OPTIONS.includes(channel)) byChannel.set(channel, rule);
  }
  return CHANNEL_OPTIONS.map((channel) => normalizeChannelRule(byChannel.get(channel) || createDefaultChannelRule(channel), channel));
};
const normalizePolicy = (policy) => ({
  secondaryDeliveryMode: normalizeSecondaryDeliveryMode(policy?.secondaryDeliveryMode),
  channelRules: normalizeChannelRules(policy?.channelRules)
});
const stableJson = (value) => JSON.stringify(value);

function MultiSelect({ id, label, value, options, disabled, onChange, minHeight = '130px' }) {
  return (
    <label style={{ display: 'grid', gap: '0.35rem' }}>
      <span>{label}</span>
      <select
        id={id}
        multiple
        value={value}
        onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((option) => option.value))}
        disabled={disabled}
        style={{ minHeight }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function NotificationDeliveryPolicyPage() {
  const { pushToast } = useToast();
  const [policy, setPolicy] = useState(() => normalizePolicy({}));
  const [savedPolicy, setSavedPolicy] = useState(() => normalizePolicy({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const hasChanges = stableJson(policy) !== stableJson(savedPolicy);

  const applyPolicy = (res) => {
    const nextPolicy = normalizePolicy(res || {});
    setPolicy(nextPolicy);
    setSavedPolicy(nextPolicy);
  };

  const loadPolicy = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const policyRes = await api.notificationDeliveryPolicy.get();
      applyPolicy(policyRes || {});
    } catch (err) {
      setError(err?.message || 'Failed to load notification delivery policy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRule = (channel, updater) => {
    setInfo(null);
    setError(null);
    setPolicy((prev) => ({
      ...prev,
      channelRules: normalizeChannelRules(prev.channelRules).map((rule) => (rule.channel === channel ? normalizeChannelRule(updater(rule), channel) : rule))
    }));
  };

  const savePolicy = async () => {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const payload = normalizePolicy(policy);
      const res = await api.notificationDeliveryPolicy.update(payload);
      if (res && typeof res === 'object') applyPolicy(res);
      else await loadPolicy();
      const message = 'Notification delivery policy updated.';
      setInfo(message);
      pushToast({ tone: 'success', message });
    } catch (err) {
      const message = err?.message || 'Failed to update notification delivery policy';
      setError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Notification Delivery Policy</div>
          <div style={{ color: 'var(--muted)' }}>
            Manage secondary delivery mode and per-channel delivery exclusions. Provider/channel defaults and email suppression rules still apply as guardrails.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard/notification-default-channels" className="btn-neutral">
            Notification defaults
          </Link>
          <button type="button" className="btn-neutral" onClick={loadPolicy} disabled={loading || saving}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div> : null}
      {info ? <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div> : null}

      <div className="card" style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'grid', gap: '0.35rem', maxWidth: '420px' }}>
          <label htmlFor="secondaryDeliveryMode">Secondary delivery mode</label>
          <select
            id="secondaryDeliveryMode"
            value={policy.secondaryDeliveryMode}
            onChange={(e) => {
              setInfo(null);
              setError(null);
              setPolicy((prev) => ({ ...prev, secondaryDeliveryMode: normalizeSecondaryDeliveryMode(e.target.value) }));
            }}
            disabled={loading || saving}
          >
            {SECONDARY_DELIVERY_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Default is Email only. Push is controlled by the channel rule below and existing backend/provider guardrails.
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.4rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <div style={{ fontWeight: 700 }}>Policy rules</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Default channel rules are all channels enabled with no exclusions. Exclusions prevent a channel for matching notification categories, notification events, or transaction actions.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            WhatsApp policy can allow WhatsApp, but if WhatsApp is globally disabled it still will not send. Existing email suppression rules still apply.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.85rem' }}>
        {normalizeChannelRules(policy.channelRules).map((rule) => (
          <div key={rule.channel} className="card" style={{ display: 'grid', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: '0.2rem' }}>
                <div style={{ fontWeight: 800 }}>{rule.channel}</div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  {rule.enabled ? 'Channel allowed by this policy' : 'Channel disabled by this policy'}
                </div>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) => updateRule(rule.channel, (current) => ({ ...current, enabled: e.target.checked }))}
                  disabled={loading || saving}
                />
                Enabled
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
              <MultiSelect
                id={`excludedCategories-${rule.channel}`}
                label="Excluded categories"
                value={rule.excludedCategories}
                options={CATEGORY_OPTIONS}
                disabled={loading || saving}
                onChange={(values) => updateRule(rule.channel, (current) => ({ ...current, excludedCategories: values }))}
              />
              <MultiSelect
                id={`excludedTransactionActions-${rule.channel}`}
                label="Excluded transaction actions"
                value={rule.excludedTransactionActions}
                options={ACTION_OPTIONS}
                disabled={loading || saving}
                onChange={(values) => updateRule(rule.channel, (current) => ({ ...current, excludedTransactionActions: values }))}
              />
              <MultiSelect
                id={`excludedEvents-${rule.channel}`}
                label="Excluded events"
                value={rule.excludedEvents}
                options={EVENT_OPTIONS}
                disabled={loading || saving}
                onChange={(values) => updateRule(rule.channel, (current) => ({ ...current, excludedEvents: values }))}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-neutral"
          onClick={() => {
            setInfo(null);
            setError(null);
            setPolicy(savedPolicy);
          }}
          disabled={loading || saving || !hasChanges}
        >
          Reset
        </button>
        <button type="button" className="btn-primary" onClick={savePolicy} disabled={loading || saving || !hasChanges}>
          {saving ? 'Saving...' : 'Save policy'}
        </button>
      </div>
    </div>
  );
}
