'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const statusOptions = ['', 'ACTIVE', 'DRAFT', 'PAUSED', 'ARCHIVED'];
const moderationActions = ['approve', 'reject', 'reverse', 'reissue'];
const auditPrefixOptions = ['REFERRAL_CAMPAIGN_', 'REFERRAL_REWARD_'];
const rewardModeOptions = ['FIXED', 'REVENUE_SHARE', 'NET_AMOUNT_SHARE'];
const getRewardId = (row) =>
  row?.rewardId ||
  row?.id ||
  row?.rewardID ||
  row?.reward_id ||
  row?.referralRewardId ||
  row?.referral_reward_id ||
  null;

const now = new Date();
const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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

const formatDateTime = (value) => {
  if (!value && value !== 0) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const toInputDateTime = (value) => {
  if (!value && value !== 0) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toIntegerOrZero = (value) => {
  const num = Number(value);
  return Number.isInteger(num) ? num : 0;
};

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const isBlank = (value) => String(value ?? '').trim() === '';
const toStringOrEmpty = (value) => (value === null || value === undefined ? '' : String(value));

const addMonths = (value, months) => {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date;
};

const createEmptyDraft = () => ({
  name: 'Fondeka Campaign',
  description: 'Referral campaign',
  startsAt: toInputDateTime(new Date()),
  endsAt: toInputDateTime(addMonths(new Date(), 22)),
  targetActions: '3',
  baseRewardPoints: '20',
  activationRewardPoints: '0',
  passportBonusPoints: '0',
  markSuspiciousAsPending: true,
  rewardMode: 'FIXED',
  revenueSharePct: '',
  netAmountSharePct: '',
  maxTransactions: '3',
  minPoints: '',
  maxPoints: '',
  includeOtherFeesInRevenue: false,
  inviterOverridesSnapshot: {},
  milestoneRules: '{}'
});

const createInviterRuleDraft = () => ({
  inviterAccountId: '',
  rewardMode: 'FIXED',
  baseRewardPoints: '',
  revenueSharePct: '',
  netAmountSharePct: '',
  maxTransactions: '1',
  minPoints: '',
  maxPoints: '',
  includeOtherFeesInRevenue: false
});

const parseInviterRule = (inviterAccountId, rawRule) => {
  const rule = isObject(rawRule) ? rawRule : {};
  return {
    inviterAccountId: String(inviterAccountId || ''),
    rewardMode: rewardModeOptions.includes(rule.rewardMode) ? rule.rewardMode : 'FIXED',
    baseRewardPoints: toStringOrEmpty(rule.baseRewardPoints),
    revenueSharePct: toStringOrEmpty(rule.revenueSharePct ?? rule.sharePct),
    netAmountSharePct: toStringOrEmpty(rule.netAmountSharePct ?? rule.sharePct),
    maxTransactions: toStringOrEmpty(rule.maxTransactions || 1),
    minPoints: toStringOrEmpty(rule.minPoints),
    maxPoints: toStringOrEmpty(rule.maxPoints),
    includeOtherFeesInRevenue: Boolean(rule.includeOtherFeesInRevenue)
  };
};

const buildInviterRulePayload = (draft) => {
  const rule = {
    rewardMode: draft.rewardMode,
    maxTransactions: Number(draft.maxTransactions),
    includeOtherFeesInRevenue: Boolean(draft.includeOtherFeesInRevenue)
  };
  if (!isBlank(draft.minPoints)) rule.minPoints = Number(draft.minPoints);
  if (!isBlank(draft.maxPoints)) rule.maxPoints = Number(draft.maxPoints);
  if (!isBlank(draft.baseRewardPoints)) rule.baseRewardPoints = Number(draft.baseRewardPoints);
  if (draft.rewardMode === 'REVENUE_SHARE') rule.revenueSharePct = Number(draft.revenueSharePct);
  if (draft.rewardMode === 'NET_AMOUNT_SHARE') rule.netAmountSharePct = Number(draft.netAmountSharePct);
  return { rule };
};

const validateInviterRuleDraft = (draft) => {
  const errors = {};
  const inviterAccountId = String(draft.inviterAccountId || '').trim();
  const maxTransactions = Number(draft.maxTransactions);
  const baseRewardPoints = Number(draft.baseRewardPoints);
  const revenueSharePct = Number(draft.revenueSharePct);
  const netAmountSharePct = Number(draft.netAmountSharePct);
  const minPoints = Number(draft.minPoints);
  const maxPoints = Number(draft.maxPoints);

  if (!inviterAccountId) errors.inviterAccountId = 'Inviter account ID is required.';
  if (!rewardModeOptions.includes(draft.rewardMode)) errors.rewardMode = 'Invalid reward mode.';
  if (!Number.isInteger(maxTransactions) || maxTransactions < 1) errors.maxTransactions = 'Max transactions must be an integer greater than 0.';
  if (!isBlank(draft.baseRewardPoints) && (!Number.isFinite(baseRewardPoints) || baseRewardPoints < 0)) {
    errors.baseRewardPoints = 'Base points must be a number greater than or equal to 0.';
  }
  if (draft.rewardMode === 'REVENUE_SHARE' && (!Number.isFinite(revenueSharePct) || revenueSharePct <= 0)) {
    errors.revenueSharePct = 'Revenue share percent must be greater than 0.';
  }
  if (draft.rewardMode === 'NET_AMOUNT_SHARE' && (!Number.isFinite(netAmountSharePct) || netAmountSharePct <= 0)) {
    errors.netAmountSharePct = 'Net amount share percent must be greater than 0.';
  }
  if (!isBlank(draft.minPoints) && (!Number.isFinite(minPoints) || minPoints < 0)) {
    errors.minPoints = 'Min points must be a number greater than or equal to 0.';
  }
  if (!isBlank(draft.maxPoints) && (!Number.isFinite(maxPoints) || maxPoints < 0)) {
    errors.maxPoints = 'Max points must be a number greater than or equal to 0.';
  }
  if (!isBlank(draft.minPoints) && !isBlank(draft.maxPoints) && Number.isFinite(minPoints) && Number.isFinite(maxPoints) && minPoints > maxPoints) {
    errors.pointsRange = 'Min points must be less than or equal to max points.';
  }
  return errors;
};

const parseEligibilityRulesForDraft = (eligibilityRules) => {
  const defaults = isObject(eligibilityRules?.defaults) ? eligibilityRules.defaults : {};
  const inviterOverridesSnapshot = isObject(eligibilityRules?.inviterOverrides) ? eligibilityRules.inviterOverrides : {};

  return {
    rewardMode: rewardModeOptions.includes(defaults.rewardMode) ? defaults.rewardMode : 'FIXED',
    revenueSharePct: toStringOrEmpty(defaults.revenueSharePct),
    netAmountSharePct: toStringOrEmpty(defaults.netAmountSharePct),
    maxTransactions: toStringOrEmpty(defaults.maxTransactions || 3),
    minPoints: toStringOrEmpty(defaults.minPoints),
    maxPoints: toStringOrEmpty(defaults.maxPoints),
    includeOtherFeesInRevenue: Boolean(defaults.includeOtherFeesInRevenue),
    inviterOverridesSnapshot
  };
};

const buildEligibilityRulesFromDraft = (draft) => {
  const defaults = {
    rewardMode: rewardModeOptions.includes(draft.rewardMode) ? draft.rewardMode : 'FIXED',
    maxTransactions: toIntegerOrZero(draft.maxTransactions),
    includeOtherFeesInRevenue: Boolean(draft.includeOtherFeesInRevenue)
  };

  if (!isBlank(draft.revenueSharePct)) defaults.revenueSharePct = Number(draft.revenueSharePct);
  if (!isBlank(draft.netAmountSharePct)) defaults.netAmountSharePct = Number(draft.netAmountSharePct);
  if (!isBlank(draft.minPoints)) defaults.minPoints = Number(draft.minPoints);
  if (!isBlank(draft.maxPoints)) defaults.maxPoints = Number(draft.maxPoints);

  return {
    defaults,
    inviterOverrides: isObject(draft.inviterOverridesSnapshot) ? draft.inviterOverridesSnapshot : {}
  };
};

const getCampaignValidationErrors = (draft) => {
  const errors = {};
  const name = String(draft?.name || '').trim();
  const description = String(draft?.description || '');
  const startsAt = toIsoOrNull(draft?.startsAt);
  const endsAt = toIsoOrNull(draft?.endsAt);
  const targetActions = Number(draft?.targetActions);
  const baseRewardPoints = Number(draft?.baseRewardPoints);
  const activationRewardPoints = Number(draft?.activationRewardPoints);
  const passportBonusPoints = Number(draft?.passportBonusPoints);
  const maxTransactions = Number(draft?.maxTransactions);
  const minPoints = Number(draft?.minPoints);
  const maxPoints = Number(draft?.maxPoints);
  const revenueSharePct = Number(draft?.revenueSharePct);
  const netAmountSharePct = Number(draft?.netAmountSharePct);

  if (!name) errors.name = 'Campaign name is required.';
  if (name.length > 120) errors.name = 'Campaign name must be 120 characters or fewer.';
  if (description.length > 500) errors.description = 'Description must be 500 characters or fewer.';

  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    errors.endsAt = 'End date/time must be after start date/time.';
  }

  if (!Number.isInteger(targetActions) || targetActions < 0 || targetActions > 100) {
    errors.targetActions = 'Referral goal must be an integer between 0 and 100.';
  }
  if (isBlank(draft?.baseRewardPoints)) {
    errors.baseRewardPoints = 'Base reward points is required.';
  } else if (!Number.isInteger(baseRewardPoints) || baseRewardPoints < 0) {
    errors.baseRewardPoints = 'Points must be an integer greater than or equal to 0.';
  }
  if (!Number.isInteger(activationRewardPoints) || activationRewardPoints < 0) {
    errors.activationRewardPoints = 'Activation bonus points must be an integer greater than or equal to 0.';
  }
  if (!Number.isInteger(passportBonusPoints) || passportBonusPoints < 0) {
    errors.passportBonusPoints = 'Passport bonus points must be an integer greater than or equal to 0.';
  }
  if (!rewardModeOptions.includes(draft?.rewardMode)) {
    errors.rewardMode = 'Reward mode must be FIXED, REVENUE_SHARE, or NET_AMOUNT_SHARE.';
  }
  if (!Number.isInteger(maxTransactions) || maxTransactions < 1) {
    errors.maxTransactions = 'Max transactions must be an integer greater than or equal to 1.';
  }
  if (!isBlank(draft?.revenueSharePct) && (!Number.isFinite(revenueSharePct) || revenueSharePct <= 0)) {
    errors.revenueSharePct = 'Revenue share percent must be a number greater than 0.';
  }
  if (draft?.rewardMode === 'REVENUE_SHARE' && (isBlank(draft?.revenueSharePct) || !Number.isFinite(revenueSharePct) || revenueSharePct <= 0)) {
    errors.revenueSharePct = 'Revenue share percent is required for REVENUE_SHARE mode.';
  }
  if (!isBlank(draft?.netAmountSharePct) && (!Number.isFinite(netAmountSharePct) || netAmountSharePct <= 0)) {
    errors.netAmountSharePct = 'Net amount share percent must be a number greater than 0.';
  }
  if (draft?.rewardMode === 'NET_AMOUNT_SHARE' && (isBlank(draft?.netAmountSharePct) || !Number.isFinite(netAmountSharePct) || netAmountSharePct <= 0)) {
    errors.netAmountSharePct = 'Net amount share percent is required for NET_AMOUNT_SHARE mode.';
  }
  if (!isBlank(draft?.minPoints) && (!Number.isFinite(minPoints) || minPoints < 0)) {
    errors.minPoints = 'Min points must be a number greater than or equal to 0.';
  }
  if (!isBlank(draft?.maxPoints) && (!Number.isFinite(maxPoints) || maxPoints < 0)) {
    errors.maxPoints = 'Max points must be a number greater than or equal to 0.';
  }
  if (!isBlank(draft?.minPoints) && !isBlank(draft?.maxPoints) && Number.isFinite(minPoints) && Number.isFinite(maxPoints) && minPoints > maxPoints) {
    errors.pointsRange = 'Min points must be less than or equal to max points.';
  }

  if (draft?.milestoneRules?.trim()) {
    try {
      const parsed = JSON.parse(draft.milestoneRules);
      if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
        errors.milestoneRules = 'Milestone rules must be a JSON object.';
      }
    } catch {
      errors.milestoneRules = 'Milestone rules must be valid JSON.';
    }
  }

  return errors;
};

const campaignStepFields = {
  1: ['name', 'description', 'startsAt', 'endsAt'],
  2: [
    'targetActions',
    'baseRewardPoints',
    'activationRewardPoints',
    'passportBonusPoints',
    'rewardMode',
    'revenueSharePct',
    'netAmountSharePct',
    'maxTransactions',
    'minPoints',
    'maxPoints',
    'pointsRange',
    'milestoneRules'
  ],
  3: []
};

const getStepValidationErrors = (draft, step) => {
  const allErrors = getCampaignValidationErrors(draft);
  if (step === 3) return allErrors;
  const allowedFields = campaignStepFields[step] || [];
  return Object.fromEntries(Object.entries(allErrors).filter(([key]) => allowedFields.includes(key)));
};

const toPayload = (draft) => {
  const eligibilityRules = buildEligibilityRulesFromDraft(draft);
  const milestoneRules = draft.milestoneRules?.trim() ? JSON.parse(draft.milestoneRules) : {};

  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    startsAt: toIsoOrNull(draft.startsAt),
    endsAt: toIsoOrNull(draft.endsAt),
    targetActions: toIntegerOrZero(draft.targetActions),
    baseRewardPoints: toIntegerOrZero(draft.baseRewardPoints),
    activationRewardPoints: toIntegerOrZero(draft.activationRewardPoints),
    passportBonusPoints: toIntegerOrZero(draft.passportBonusPoints),
    markSuspiciousAsPending: Boolean(draft.markSuspiciousAsPending),
    eligibilityRules,
    milestoneRules
  };
};

const downloadText = (content, filename, contentType = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content || ''], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export default function ReferralCampaignsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(createEmptyDraft());
  const [campaignStep, setCampaignStep] = useState(1);
  const [showRewardOptions, setShowRewardOptions] = useState(false);
  const [showAdvancedRules, setShowAdvancedRules] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [analyticsFrom, setAnalyticsFrom] = useState(toInputDateTime(monthAgo));
  const [analyticsTo, setAnalyticsTo] = useState(toInputDateTime(now));
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [reviewRows, setReviewRows] = useState([]);
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewSize, setReviewSize] = useState(20);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
  const [reviewTotalElements, setReviewTotalElements] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(false);

  const [moderationModal, setModerationModal] = useState(null);
  const [moderationReason, setModerationReason] = useState('');
  const [recomputePoints, setRecomputePoints] = useState('');
  const [moderating, setModerating] = useState(false);

  const [inspectAccountId, setInspectAccountId] = useState('');
  const [inspectEmail, setInspectEmail] = useState('');
  const [inspectRewardPage, setInspectRewardPage] = useState(0);
  const [inspectRewardSize, setInspectRewardSize] = useState(50);
  const [inspectData, setInspectData] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const [ruleCampaigns, setRuleCampaigns] = useState([]);
  const [selectedRuleCampaignId, setSelectedRuleCampaignId] = useState('');
  const [inviterRulesRows, setInviterRulesRows] = useState([]);
  const [inviterRulesLoading, setInviterRulesLoading] = useState(false);
  const [ruleCampaignLoading, setRuleCampaignLoading] = useState(false);
  const [ruleConflictWarning, setRuleConflictWarning] = useState('');
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false);
  const [ruleEditorDraft, setRuleEditorDraft] = useState(createInviterRuleDraft());
  const [ruleEditorErrors, setRuleEditorErrors] = useState({});
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleLookupEmail, setRuleLookupEmail] = useState('');
  const [ruleLookupLoading, setRuleLookupLoading] = useState(false);
  const [deleteRuleTarget, setDeleteRuleTarget] = useState(null);

  const [auditPrefix, setAuditPrefix] = useState('REFERRAL_CAMPAIGN_');
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      if (status) params.set('status', status);
      const res = await api.referralCampaigns.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list);
      setTotalPages(Number(res?.totalPages) || 1);
      setTotalElements(Number(res?.totalElements) || list.length);
    } catch (err) {
      setRows([]);
      setError(err?.message || 'Failed to load referral campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchRuleCampaigns = async () => {
    setRuleCampaignLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: '0', size: '200' });
      const res = await api.referralCampaigns.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRuleCampaigns(list);
      setSelectedRuleCampaignId((prev) => {
        if (prev && list.some((row) => String(row?.id) === String(prev))) return prev;
        const active = list.find((row) => row?.status === 'ACTIVE');
        return String(active?.id || list[0]?.id || '');
      });
    } catch (err) {
      setRuleCampaigns([]);
      setSelectedRuleCampaignId('');
      setError(err?.message || 'Failed to load campaigns for inviter rules');
    } finally {
      setRuleCampaignLoading(false);
    }
  };

  const fetchInviterRules = async (campaignIdInput) => {
    const campaignId = String(campaignIdInput || '').trim();
    if (!campaignId) {
      setInviterRulesRows([]);
      return;
    }
    setInviterRulesLoading(true);
    setError(null);
    try {
      const res = await api.referralCampaigns.inviterRules(campaignId);
      let list = [];
      if (Array.isArray(res)) {
        list = res;
      } else if (Array.isArray(res?.content)) {
        list = res.content;
      } else if (Array.isArray(res?.items)) {
        list = res.items;
      } else if (isObject(res)) {
        const map = isObject(res?.inviterRules) ? res.inviterRules : res;
        list = Object.entries(map)
          .filter(([, value]) => isObject(value))
          .map(([inviterAccountId, value]) => ({ inviterAccountId, ...value, rule: value }));
      }
      setInviterRulesRows(list);
    } catch (err) {
      setInviterRulesRows([]);
      setError(err?.message || 'Failed to load inviter rules');
    } finally {
      setInviterRulesLoading(false);
    }
  };

  const fetchRuleConflictWarning = async (campaignIdInput) => {
    const campaignId = String(campaignIdInput || '').trim();
    if (!campaignId) {
      setRuleConflictWarning('');
      return;
    }
    try {
      const detail = await api.referralCampaigns.get(campaignId);
      const hasEligibilityOverrides = isObject(detail?.eligibilityRules?.inviterOverrides) && Object.keys(detail.eligibilityRules.inviterOverrides).length > 0;
      const hasMilestoneOverrides = isObject(detail?.milestoneRules?.inviterOverrides) && Object.keys(detail.milestoneRules.inviterOverrides).length > 0;
      if (hasEligibilityOverrides && hasMilestoneOverrides) {
        setRuleConflictWarning(
          'Both eligibilityRules.inviterOverrides (legacy) and milestoneRules.inviterOverrides are present. Legacy location is read first; reconcile to avoid ambiguity.'
        );
      } else {
        setRuleConflictWarning('');
      }
    } catch {
      setRuleConflictWarning('');
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const fromIso = toIsoOrNull(analyticsFrom);
      const toIso = toIsoOrNull(analyticsTo);
      if (fromIso) params.set('from', fromIso);
      if (toIso) params.set('to', toIso);
      const res = await api.referrals.analytics(params);
      setAnalytics(res || null);
    } catch (err) {
      setAnalytics(null);
      setError(err?.message || 'Failed to load referral analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchReviewQueue = async () => {
    setReviewLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(reviewPage), size: String(reviewSize) });
      const res = await api.referrals.reviewQueue(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setReviewRows(list);
      setReviewTotalPages(Number(res?.totalPages) || 1);
      setReviewTotalElements(Number(res?.totalElements) || list.length);
    } catch (err) {
      setReviewRows([]);
      setError(err?.message || 'Failed to load fraud review queue');
    } finally {
      setReviewLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: '0', size: '200' });
      const res = await api.auditLogs.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      const filtered = list.filter((row) => String(row?.action || '').startsWith(auditPrefix));
      setAuditLogs(filtered.slice(0, 50));
    } catch (err) {
      setAuditLogs([]);
      setError(err?.message || 'Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  const getInspectParams = () => ({ rewardPage: String(inspectRewardPage), rewardSize: String(inspectRewardSize) });

  const fetchAccountReferralById = async (accountIdInput) => {
    const accountId = String(accountIdInput || '').trim();
    if (!accountId) return false;
    setInspectLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(getInspectParams());
      const res = await api.referrals.account(accountId, params);
      setInspectData(res || null);
      return true;
    } catch (err) {
      setInspectData(null);
      setError(err?.message || 'Failed to load account referral data');
      return false;
    } finally {
      setInspectLoading(false);
    }
  };

  const fetchAccountReferralByEmail = async (emailInput) => {
    const email = String(emailInput || '').trim();
    if (!email) {
      setError('Enter an email address.');
      setInspectData(null);
      return false;
    }
    setInspectLoading(true);
    setError(null);
    try {
      const res = await api.referrals.accountByEmail(email, getInspectParams());
      setInspectData(res || null);
      return true;
    } catch (err) {
      setInspectData(null);
      if (err?.status === 400) {
        setError('Invalid or blank email.');
      } else if (err?.status === 404) {
        setError('No account mapped to that email.');
      } else {
        setError(err?.message || 'Failed to load account referral data by email');
      }
      return false;
    } finally {
      setInspectLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchReviewQueue();
  }, [reviewPage, reviewSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAnalytics();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAuditLogs();
  }, [auditPrefix]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchRuleCampaigns();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedRuleCampaignId) {
      setInviterRulesRows([]);
      setRuleConflictWarning('');
      return;
    }
    fetchInviterRules(selectedRuleCampaignId);
    fetchRuleConflictWarning(selectedRuleCampaignId);
  }, [selectedRuleCampaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setSelected(null);
    setDraft(createEmptyDraft());
    setCampaignStep(1);
    setShowRewardOptions(false);
    setShowAdvancedRules(false);
    setFieldErrors({});
    setShowActivateConfirm(false);
    setShowForm(true);
    setError(null);
    setInfo(null);
  };

  const openEdit = (row) => {
    const eligibilityDraft = parseEligibilityRulesForDraft(row?.eligibilityRules);
    setSelected(row);
    setDraft({
      name: row?.name || '',
      description: row?.description || '',
      startsAt: toInputDateTime(row?.startsAt),
      endsAt: toInputDateTime(row?.endsAt),
      targetActions: Array.isArray(row?.targetActions)
        ? String(row.targetActions.length)
        : row?.targetActions != null
          ? String(row.targetActions)
          : '3',
      baseRewardPoints: toStringOrEmpty(row?.baseRewardPoints ?? 0),
      activationRewardPoints: toStringOrEmpty(row?.activationRewardPoints ?? 0),
      passportBonusPoints: toStringOrEmpty(row?.passportBonusPoints ?? 0),
      markSuspiciousAsPending: Boolean(row?.markSuspiciousAsPending),
      ...eligibilityDraft,
      milestoneRules: JSON.stringify(row?.milestoneRules ?? {}, null, 2)
    });
    setCampaignStep(1);
    setShowRewardOptions(false);
    setShowAdvancedRules(false);
    setFieldErrors({});
    setShowActivateConfirm(false);
    setShowForm(true);
    setError(null);
    setInfo(null);
  };

  const openDetail = async (row) => {
    setError(null);
    try {
      const detail = await api.referralCampaigns.get(row.id);
      setSelected(detail || row);
      setShowDetail(true);
    } catch (err) {
      setError(err?.message || 'Failed to load campaign detail');
    }
  };

  const save = async ({ activateAfterSave = false } = {}) => {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const validationErrors = getCampaignValidationErrors(draft);
      setFieldErrors(validationErrors);
      if (Object.keys(validationErrors).length) {
        setError('Please fix the highlighted fields.');
        return;
      }

      const payload = toPayload(draft);
      if (selected?.id) {
        await api.referralCampaigns.update(selected.id, payload);
        setInfo(`Updated campaign ${selected.id}.`);
      } else {
        const created = await api.referralCampaigns.create(payload);
        if (activateAfterSave) {
          if (created?.id) {
            await api.referralCampaigns.activate(created.id);
            setInfo(`Created and activated campaign ${created.id}.`);
          } else {
            setInfo('Created campaign as draft. Activate it from the campaign table.');
          }
        } else {
          setInfo('Created referral campaign as draft.');
        }
      }
      setShowForm(false);
      setShowActivateConfirm(false);
      await fetchRows();
    } catch (err) {
      setError(err?.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const runStatusAction = async (row, action) => {
    if (!row?.id) return;
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (action === 'activate') await api.referralCampaigns.activate(row.id);
      if (action === 'pause') await api.referralCampaigns.pause(row.id);
      if (action === 'archive') await api.referralCampaigns.archive(row.id);
      setInfo(`${action[0].toUpperCase()}${action.slice(1)}d campaign ${row.id}.`);
      await fetchRows();
    } catch (err) {
      setError(err?.message || `Failed to ${action} campaign`);
    } finally {
      setActionLoading(false);
    }
  };

  const openModeration = (rewardId, action) => {
    setModerationModal({ rewardId, action });
    setModerationReason('');
    setRecomputePoints('');
  };

  const submitModeration = async () => {
    if (!moderationModal?.rewardId) return;
    if (!moderationReason.trim()) {
      setError('Reason is required.');
      return;
    }
    setModerating(true);
    setError(null);
    setInfo(null);
    try {
      const rewardId = moderationModal.rewardId;
      const payload = { reason: moderationReason.trim() };

      if (moderationModal.action === 'approve') await api.referrals.approveReward(rewardId, payload);
      if (moderationModal.action === 'reject') await api.referrals.rejectReward(rewardId, payload);
      if (moderationModal.action === 'reverse') await api.referrals.reverseReward(rewardId, payload);
      if (moderationModal.action === 'reissue') await api.referrals.reissueReward(rewardId, payload);
      if (moderationModal.action === 'recompute') {
        const points = Number(recomputePoints);
        if (!Number.isFinite(points)) {
          setError('Points are required for recompute.');
          return;
        }
        await api.referrals.recomputeReward(rewardId, { points, reason: moderationReason.trim() });
      }

      setInfo(`${moderationModal.action} succeeded for reward ${rewardId}.`);
      setModerationModal(null);
      await fetchReviewQueue();
      if (inspectData) {
        const email = String(inspectEmail || '').trim();
        const accountId = String(inspectAccountId || '').trim();
        if (email) {
          await fetchAccountReferralByEmail(email);
        } else if (accountId) {
          await fetchAccountReferralById(accountId);
        }
      }
    } catch (err) {
      setError(err?.message || 'Moderation action failed');
    } finally {
      setModerating(false);
    }
  };

  const exportCsv = async () => {
    setError(null);
    setInfo(null);
    try {
      const params = new URLSearchParams();
      const fromIso = toIsoOrNull(analyticsFrom);
      const toIso = toIsoOrNull(analyticsTo);
      if (fromIso) params.set('from', fromIso);
      if (toIso) params.set('to', toIso);
      const csv = await api.referrals.exportRewardLedgerCsv(params);
      const filename = `referral-reward-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadText(csv, filename, 'text/csv;charset=utf-8');
      setInfo('CSV export downloaded.');
    } catch (err) {
      setError(err?.message || 'Failed to export CSV');
    }
  };

  const campaignColumns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status' },
    { key: 'startsAt', label: 'Starts', render: (row) => formatDateTime(row.startsAt) },
    { key: 'endsAt', label: 'Ends', render: (row) => formatDateTime(row.endsAt) },
    { key: 'baseRewardPoints', label: 'Base Pts' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral btn-sm" onClick={() => openDetail(row)} disabled={actionLoading}>
            View
          </button>
          <button type="button" className="btn-neutral btn-sm" onClick={() => openEdit(row)} disabled={actionLoading}>
            Edit
          </button>
          {(row.status === 'DRAFT' || row.status === 'PAUSED') && (
            <button type="button" className="btn-success btn-sm" onClick={() => runStatusAction(row, 'activate')} disabled={actionLoading}>
              Activate
            </button>
          )}
          {row.status === 'ACTIVE' && (
            <button type="button" className="btn-neutral btn-sm" onClick={() => runStatusAction(row, 'pause')} disabled={actionLoading}>
              Pause
            </button>
          )}
          {row.status !== 'ARCHIVED' && (
            <button type="button" className="btn-danger btn-sm" onClick={() => runStatusAction(row, 'archive')} disabled={actionLoading}>
              Archive
            </button>
          )}
        </div>
      )
    }
  ];

  const reviewColumns = useMemo(
    () => [
      { key: 'rewardId', label: 'Reward ID', render: (row) => getRewardId(row) || '—' },
      { key: 'accountId', label: 'Account ID', render: (row) => row.accountId || '—' },
      { key: 'status', label: 'Status', render: (row) => row.status || '—' },
      { key: 'points', label: 'Points', render: (row) => row.points ?? '—' },
      { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
      {
        key: 'actions',
        label: 'Moderation',
        render: (row) => {
          const rewardId = getRewardId(row);
          return (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {moderationActions.map((action) => (
                <button key={action} type="button" className="btn-neutral btn-sm" onClick={() => openModeration(rewardId, action)} disabled={!rewardId || moderating}>
                  {action.charAt(0).toUpperCase() + action.slice(1)}
                </button>
              ))}
              <button type="button" className="btn-danger btn-sm" onClick={() => openModeration(rewardId, 'recompute')} disabled={!rewardId || moderating}>
                Recompute
              </button>
            </div>
          );
        }
      }
    ],
    [moderating]
  );

  const inspectRewardColumns = useMemo(
    () => [
      { key: 'rewardId', label: 'Reward ID', render: (row) => getRewardId(row) || '—' },
      { key: 'status', label: 'Status' },
      { key: 'points', label: 'Points' },
      { key: 'action', label: 'Action' },
      { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
      {
        key: 'moderation',
        label: 'Approve Action',
        render: (row) => {
          const rewardId = getRewardId(row);
          return (
            <button
              type="button"
              className="btn-success btn-sm"
              onClick={() => openModeration(rewardId, 'approve')}
              disabled={!rewardId || moderating}
            >
              Approve
            </button>
          );
        }
      }
    ],
    [moderating]
  );

  const inviterRulesColumns = [
      { key: 'inviterAccountId', label: 'Inviter Account ID', render: (row) => row?.inviterAccountId || row?.accountId || row?.id || '—' },
      { key: 'rewardMode', label: 'Reward Mode', render: (row) => row?.rewardMode || row?.rule?.rewardMode || '—' },
      {
        key: 'pct',
        label: 'Pct',
        render: (row) => {
          const mode = row?.rewardMode || row?.rule?.rewardMode;
          const value = mode === 'REVENUE_SHARE'
            ? row?.pct ?? row?.rule?.revenueSharePct ?? row?.rule?.sharePct
            : mode === 'NET_AMOUNT_SHARE'
              ? row?.pct ?? row?.rule?.netAmountSharePct ?? row?.rule?.sharePct
              : null;
          return value === null || value === undefined || value === '' ? '—' : `${value}%`;
        }
      },
      { key: 'maxTransactions', label: 'Max Tx', render: (row) => row?.maxTransactions ?? row?.rule?.maxTransactions ?? '—' },
      {
        key: 'minMaxPoints',
        label: 'Min/Max Points',
        render: (row) => `${row?.minPoints ?? row?.rule?.minPoints ?? '—'} / ${row?.maxPoints ?? row?.rule?.maxPoints ?? '—'}`
      },
      { key: 'updatedAt', label: 'Updated', render: (row) => formatDateTime(row?.updatedAt || row?.updated_at || row?.lastModifiedAt) },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => openEditInviterRule(row)} disabled={ruleSaving}>
              Edit
            </button>
            <button type="button" className="btn-danger btn-sm" onClick={() => requestDeleteInviterRule(row)} disabled={ruleSaving}>
              Delete
            </button>
          </div>
        )
      }
    ];

  const analyticsCampaignRows = Array.isArray(analytics?.campaigns) ? analytics.campaigns : [];
  const inspectInvitees = Array.isArray(inspectData?.invitees) ? inspectData.invitees : [];
  const inspectRewards = Array.isArray(inspectData?.rewards) ? inspectData.rewards : [];
  const selectedRuleCampaign = ruleCampaigns.find((item) => String(item?.id) === String(selectedRuleCampaignId)) || null;
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local timezone';
  const payloadPreview = useMemo(() => {
    try {
      return JSON.stringify(toPayload(draft), null, 2);
    } catch {
      return 'Invalid payload: fix validation errors to generate preview.';
    }
  }, [draft]);
  const previewMathText = useMemo(() => {
    const sampleRevenue = 120;
    const sampleNet = 100;
    const mode = ruleEditorDraft.rewardMode;
    if (mode === 'FIXED') {
      const points = isBlank(ruleEditorDraft.baseRewardPoints) ? 'campaign base points' : Number(ruleEditorDraft.baseRewardPoints).toFixed(2);
      return `Preview: FIXED uses ${points} per qualifying transaction, subject to limits.`;
    }
    if (mode === 'REVENUE_SHARE') {
      const pct = Number(ruleEditorDraft.revenueSharePct || 0);
      const points = Math.ceil((sampleRevenue * pct) / 100 * 100) / 100;
      return `Preview: ${sampleRevenue} * ${pct}% = ${points.toFixed(2)} points (2-decimal rounded up).`;
    }
    const pct = Number(ruleEditorDraft.netAmountSharePct || 0);
    const points = Math.ceil((sampleNet * pct) / 100 * 100) / 100;
    return `Preview: ${sampleNet} * ${pct}% = ${points.toFixed(2)} points (only when tx revenue > 0).`;
  }, [ruleEditorDraft]);

  const goToNextCampaignStep = () => {
    const errors = getStepValidationErrors(draft, campaignStep);
    setFieldErrors((prev) => ({ ...prev, ...errors }));
    if (Object.keys(errors).length) {
      setError('Please fix the highlighted fields before continuing.');
      return;
    }
    setError(null);
    setCampaignStep((prev) => Math.min(prev + 1, 3));
  };

  const goToPreviousCampaignStep = () => {
    setError(null);
    setCampaignStep((prev) => Math.max(prev - 1, 1));
  };

  const tryActivateCampaign = () => {
    const errors = getCampaignValidationErrors(draft);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError('Please fix the highlighted fields before activating.');
      return;
    }
    setError(null);
    setShowActivateConfirm(true);
  };

  const normalizeInviterRuleRow = (inviterAccountId, rule, existing = {}) => {
    const parsed = parseInviterRule(inviterAccountId, rule);
    const pctValue =
      parsed.rewardMode === 'REVENUE_SHARE'
        ? parsed.revenueSharePct
        : parsed.rewardMode === 'NET_AMOUNT_SHARE'
          ? parsed.netAmountSharePct
          : '';
    return {
      ...existing,
      inviterAccountId: String(parsed.inviterAccountId || existing?.inviterAccountId || ''),
      rewardMode: parsed.rewardMode,
      pct: pctValue,
      maxTransactions: parsed.maxTransactions,
      minPoints: parsed.minPoints,
      maxPoints: parsed.maxPoints,
      includeOtherFeesInRevenue: parsed.includeOtherFeesInRevenue,
      updatedAt: existing?.updatedAt || new Date().toISOString(),
      rule: {
        ...(isObject(existing?.rule) ? existing.rule : {}),
        ...rule
      }
    };
  };

  const openCreateInviterRule = () => {
    if (!selectedRuleCampaignId) {
      setError('Select a campaign first.');
      return;
    }
    const selectedCampaign = ruleCampaigns.find((item) => String(item?.id) === String(selectedRuleCampaignId));
    setRuleEditorDraft({
      ...createInviterRuleDraft(),
      baseRewardPoints: toStringOrEmpty(selectedCampaign?.baseRewardPoints ?? '')
    });
    setRuleEditorErrors({});
    setRuleLookupEmail('');
    setRuleEditorOpen(true);
  };

  const openEditInviterRule = async (row) => {
    const campaignId = String(selectedRuleCampaignId || '').trim();
    const inviterAccountId = String(row?.inviterAccountId || row?.accountId || row?.id || '').trim();
    if (!campaignId || !inviterAccountId) return;
    setRuleSaving(true);
    setError(null);
    try {
      const res = await api.referralCampaigns.getInviterRule(campaignId, inviterAccountId);
      const rule = isObject(res?.rule) ? res.rule : (isObject(res) ? res : row?.rule);
      setRuleEditorDraft(parseInviterRule(inviterAccountId, rule));
      setRuleEditorErrors({});
      setRuleLookupEmail('');
      setRuleEditorOpen(true);
    } catch (err) {
      setError(err?.message || 'Failed to load inviter rule');
    } finally {
      setRuleSaving(false);
    }
  };

  const lookupInviterAccountIdByEmail = async () => {
    const email = String(ruleLookupEmail || '').trim();
    if (!email) {
      setError('Enter an email address to look up inviter account ID.');
      return;
    }
    setRuleLookupLoading(true);
    setError(null);
    try {
      const res = await api.referrals.accountByEmail(email);
      const accountId = String(res?.accountId || res?.id || res?.account?.id || '').trim();
      if (!accountId) {
        setError('Lookup succeeded but no account ID was returned.');
        return;
      }
      setRuleEditorDraft((prev) => ({ ...prev, inviterAccountId: accountId }));
      setRuleEditorErrors((prev) => ({ ...prev, inviterAccountId: undefined }));
      setInfo(`Resolved ${email} to inviter account ID ${accountId}.`);
    } catch (err) {
      if (err?.status === 400) setError('Invalid email.');
      else if (err?.status === 404) setError('No account mapped to that email.');
      else if (err?.status === 401 || err?.status === 403) setError('Not authorized to look up account by email.');
      else setError(err?.message || 'Failed to resolve inviter account ID by email');
    } finally {
      setRuleLookupLoading(false);
    }
  };

  const saveInviterRule = async () => {
    const campaignId = String(selectedRuleCampaignId || '').trim();
    if (!campaignId) {
      setError('Select a campaign first.');
      return;
    }
    const errors = validateInviterRuleDraft(ruleEditorDraft);
    setRuleEditorErrors(errors);
    if (Object.keys(errors).length) {
      setError('Please fix rule validation errors.');
      return;
    }

    const inviterAccountId = String(ruleEditorDraft.inviterAccountId || '').trim();
    const payload = buildInviterRulePayload(ruleEditorDraft);
    setRuleSaving(true);
    setError(null);
    try {
      await api.referralCampaigns.upsertInviterRule(campaignId, inviterAccountId, payload);
      setInviterRulesRows((prev) => {
        const existingIndex = prev.findIndex(
          (item) => String(item?.inviterAccountId || item?.accountId || item?.id || '') === inviterAccountId
        );
        const nextRow = normalizeInviterRuleRow(inviterAccountId, payload.rule, prev[existingIndex] || {});
        if (existingIndex >= 0) {
          return prev.map((item, idx) => (idx === existingIndex ? nextRow : item));
        }
        return [nextRow, ...prev];
      });
      setInfo(`Saved inviter rule for ${inviterAccountId}.`);
      setRuleEditorOpen(false);
      fetchRuleConflictWarning(campaignId);
    } catch (err) {
      if (err?.status === 400) setError('Invalid inviter account ID or rule payload.');
      else if (err?.status === 404) setError('Campaign or inviter rule was not found.');
      else if (err?.status === 401 || err?.status === 403) setError('You are not authorized to modify inviter rules.');
      else setError(err?.message || 'Failed to save inviter rule');
    } finally {
      setRuleSaving(false);
    }
  };

  const requestDeleteInviterRule = (row) => {
    const inviterAccountId = String(row?.inviterAccountId || row?.accountId || row?.id || '').trim();
    if (!inviterAccountId) return;
    setDeleteRuleTarget(inviterAccountId);
  };

  const confirmDeleteInviterRule = async () => {
    const campaignId = String(selectedRuleCampaignId || '').trim();
    const inviterAccountId = String(deleteRuleTarget || '').trim();
    if (!campaignId || !inviterAccountId) return;
    setRuleSaving(true);
    setError(null);
    try {
      await api.referralCampaigns.deleteInviterRule(campaignId, inviterAccountId);
      setInviterRulesRows((prev) =>
        prev.filter((item) => String(item?.inviterAccountId || item?.accountId || item?.id || '') !== inviterAccountId)
      );
      setDeleteRuleTarget(null);
      setInfo(`Deleted inviter rule for ${inviterAccountId}.`);
      fetchRuleConflictWarning(campaignId);
    } catch (err) {
      if (err?.status === 404) setError('Campaign or inviter rule was not found.');
      else if (err?.status === 401 || err?.status === 403) setError('You are not authorized to delete inviter rules.');
      else setError(err?.message || 'Failed to delete inviter rule');
    } finally {
      setRuleSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Referral Programs</div>
          <div style={{ color: 'var(--muted)' }}>Campaigns, analytics, moderation, account inspection, and exports.</div>
        </div>
        <Link href="/dashboard/accounts/accounts" className="btn-neutral">Accounts</Link>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Referral Campaign Management</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Lifecycle: create as DRAFT, then Activate, Pause, or Archive. Only ACTIVE campaigns within start/end date are used for runtime rewarding.
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="status">Status</label>
            <select id="status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
              {statusOptions.map((item) => (
                <option key={item || 'ALL'} value={item}>
                  {item || 'ALL'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="size">Size</label>
            <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value) || 20)} />
          </div>
          <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button type="button" onClick={openCreate} className="btn-success">
            New campaign
          </button>
        </div>
        <DataTable
          columns={campaignColumns}
          rows={rows}
          page={page}
          pageSize={size}
          onPageChange={setPage}
          totalPages={totalPages}
          totalElements={totalElements}
          canPrev={page > 0}
          canNext={page + 1 < totalPages}
          emptyLabel="No referral campaigns found"
        />
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Campaign Inviter Rules</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Manage per-referrer overrides without editing campaign JSON. Inviter override beats campaign defaults.
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '260px' }}>
            <label htmlFor="ruleCampaignId">Campaign</label>
            <select
              id="ruleCampaignId"
              value={selectedRuleCampaignId}
              onChange={(e) => setSelectedRuleCampaignId(e.target.value)}
              disabled={ruleCampaignLoading}
            >
              {!ruleCampaigns.length && <option value="">No campaigns</option>}
              {ruleCampaigns.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name || `Campaign ${item.id}`} ({item.status || 'UNKNOWN'})
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn-neutral" onClick={fetchRuleCampaigns} disabled={ruleCampaignLoading}>
            {ruleCampaignLoading ? 'Loading…' : 'Reload campaigns'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => fetchInviterRules(selectedRuleCampaignId)}
            disabled={!selectedRuleCampaignId || inviterRulesLoading}
          >
            {inviterRulesLoading ? 'Loading…' : 'Refresh rules'}
          </button>
          <button type="button" className="btn-success" onClick={openCreateInviterRule} disabled={!selectedRuleCampaignId || ruleSaving}>
            Add inviter rule
          </button>
        </div>
        {selectedRuleCampaign && (
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Selected campaign: <strong>{selectedRuleCampaign.name || selectedRuleCampaign.id}</strong> ({selectedRuleCampaign.status || 'UNKNOWN'})
          </div>
        )}
        {ruleConflictWarning && (
          <div className="card" style={{ color: '#b45309', fontWeight: 700 }}>{ruleConflictWarning}</div>
        )}
        <DataTable
          columns={inviterRulesColumns}
          rows={inviterRulesRows}
          pageSize={50}
          showIndex={false}
          emptyLabel="No custom rule, campaign defaults apply."
        />
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Referral Analytics</div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="analyticsFrom">From</label>
            <input id="analyticsFrom" type="datetime-local" value={analyticsFrom} onChange={(e) => setAnalyticsFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="analyticsTo">To</label>
            <input id="analyticsTo" type="datetime-local" value={analyticsTo} onChange={(e) => setAnalyticsTo(e.target.value)} />
          </div>
          <button type="button" className="btn-primary" onClick={fetchAnalytics} disabled={analyticsLoading}>
            {analyticsLoading ? 'Loading…' : 'Refresh analytics'}
          </button>
          <button type="button" className="btn-neutral" onClick={exportCsv}>
            Export reward ledger CSV
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
          <div className="card"><strong>Invites:</strong> {analytics?.funnel?.invites ?? '—'}</div>
          <div className="card"><strong>Signups:</strong> {analytics?.funnel?.signups ?? '—'}</div>
          <div className="card"><strong>Qualified:</strong> {analytics?.funnel?.qualifiedReferrals ?? '—'}</div>
          <div className="card"><strong>Issued points:</strong> {analytics?.points?.issuedPoints ?? '—'}</div>
          <div className="card"><strong>Pending points:</strong> {analytics?.points?.pendingPoints ?? '—'}</div>
        </div>
        <DataTable
          columns={[
            { key: 'campaignId', label: 'Campaign ID' },
            { key: 'campaignName', label: 'Campaign' },
            { key: 'invites', label: 'Invites' },
            { key: 'signups', label: 'Signups' },
            { key: 'qualifiedReferrals', label: 'Qualified' },
            { key: 'issuedPoints', label: 'Issued Points' },
            { key: 'pendingPoints', label: 'Pending Points' }
          ]}
          rows={analyticsCampaignRows}
          emptyLabel="No campaign performance rows"
          showIndex={false}
          pageSize={50}
        />
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Fraud Review Queue & Reward Moderation</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Approve flow: fetch pending rewards from review queue, open moderation on a reward ID, then submit approve with a reason.
          Approved rewards move inviter points from pending to available for redemption.
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="reviewSize">Size</label>
            <input id="reviewSize" type="number" min={1} value={reviewSize} onChange={(e) => setReviewSize(Number(e.target.value) || 20)} />
          </div>
          <button type="button" className="btn-primary" onClick={fetchReviewQueue} disabled={reviewLoading}>
            {reviewLoading ? 'Loading…' : 'Refresh queue'}
          </button>
        </div>
        <DataTable
          columns={reviewColumns}
          rows={reviewRows}
          page={reviewPage}
          pageSize={reviewSize}
          onPageChange={setReviewPage}
          totalPages={reviewTotalPages}
          totalElements={reviewTotalElements}
          canPrev={reviewPage > 0}
          canNext={reviewPage + 1 < reviewTotalPages}
          emptyLabel="No suspicious pending rewards"
        />
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>User-level Referral Inspection</div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="inspectAccountId">Account ID</label>
            <input id="inspectAccountId" value={inspectAccountId} onChange={(e) => setInspectAccountId(e.target.value)} placeholder="123" />
          </div>
          <button
            type="button"
            className="btn-neutral"
            onClick={() => fetchAccountReferralById(inspectAccountId)}
            disabled={inspectLoading || !String(inspectAccountId).trim()}
          >
            Search by account ID
          </button>
          <div>
            <label htmlFor="inspectEmail">Search by email</label>
            <input id="inspectEmail" value={inspectEmail} onChange={(e) => setInspectEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => fetchAccountReferralByEmail(inspectEmail)}
            disabled={inspectLoading || !String(inspectEmail).trim()}
          >
            Search by email
          </button>
          <div>
            <label htmlFor="inspectRewardPage">Reward page</label>
            <input id="inspectRewardPage" type="number" min={0} value={inspectRewardPage} onChange={(e) => setInspectRewardPage(Number(e.target.value) || 0)} />
          </div>
          <div>
            <label htmlFor="inspectRewardSize">Reward size</label>
            <input id="inspectRewardSize" type="number" min={1} value={inspectRewardSize} onChange={(e) => setInspectRewardSize(Number(e.target.value) || 50)} />
          </div>
        </div>
        {inspectData && (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <div><strong>Invited by:</strong> {inspectData?.invitedBy || '—'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Invitees</div>
                <DataTable
                  columns={[
                    { key: 'accountId', label: 'Account ID' },
                    { key: 'username', label: 'Username' },
                    { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) }
                  ]}
                  rows={inspectInvitees}
                  pageSize={20}
                  showIndex={false}
                  emptyLabel="No invitees"
                />
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Rewards</div>
                <DataTable
                  columns={inspectRewardColumns}
                  rows={inspectRewards}
                  pageSize={20}
                  showIndex={false}
                  emptyLabel="No rewards"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Referral Audit Logs</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Quick filtered view. For broader audit searches, use transaction/account audit tooling.
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="auditPrefix">Action prefix</label>
            <select id="auditPrefix" value={auditPrefix} onChange={(e) => setAuditPrefix(e.target.value)}>
              {auditPrefixOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <button type="button" className="btn-primary" onClick={fetchAuditLogs} disabled={auditLoading}>
            {auditLoading ? 'Loading…' : 'Refresh audit logs'}
          </button>
        </div>
        <DataTable
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'action', label: 'Action' },
            { key: 'targetType', label: 'Target Type' },
            { key: 'targetId', label: 'Target ID' },
            { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) }
          ]}
          rows={auditLogs}
          showIndex={false}
          pageSize={50}
          emptyLabel="No audit logs for selected prefix"
        />
      </div>

      {showForm && (
        <Modal title={`${selected?.id ? 'Edit' : 'Create'} referral campaign`} onClose={() => (!saving ? setShowForm(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  style={{
                    padding: '0.3rem 0.55rem',
                    borderRadius: '999px',
                    fontSize: '12px',
                    border: '1px solid var(--line)',
                    background: campaignStep === step ? 'var(--line)' : 'transparent',
                    fontWeight: 700
                  }}
                >
                  {step === 1 ? 'Step 1: Basics' : step === 2 ? 'Step 2: Rewards' : 'Step 3: Review'}
                </div>
              ))}
            </div>

            {campaignStep === 1 && (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div className="card" style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  Campaign identity and timing. Only ACTIVE campaigns within the start/end window are used for runtime rewarding.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="name">Campaign name *</label>
                  <input
                    id="name"
                    maxLength={120}
                    value={draft.name}
                    onChange={(e) => {
                      setDraft((p) => ({ ...p, name: e.target.value }));
                      setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                  />
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Internal name shown in reports and admin lists.</div>
                  {fieldErrors.name && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.name}</div>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    rows={2}
                    maxLength={500}
                    value={draft.description}
                    onChange={(e) => {
                      setDraft((p) => ({ ...p, description: e.target.value }));
                      setFieldErrors((prev) => ({ ...prev, description: undefined }));
                    }}
                  />
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Optional notes about the campaign.</div>
                  {fieldErrors.description && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.description}</div>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor="startsAt">Start date/time</label>
                    <input
                      id="startsAt"
                      type="datetime-local"
                      value={draft.startsAt}
                      onChange={(e) => {
                        setDraft((p) => ({ ...p, startsAt: e.target.value }));
                        setFieldErrors((prev) => ({ ...prev, startsAt: undefined, endsAt: undefined }));
                      }}
                    />
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                      When rewards can start being granted. Local timezone: <strong>{localTimezone}</strong> (stored as UTC).
                    </div>
                    {fieldErrors.startsAt && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.startsAt}</div>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor="endsAt">End date/time</label>
                    <input
                      id="endsAt"
                      type="datetime-local"
                      value={draft.endsAt}
                      onChange={(e) => {
                        setDraft((p) => ({ ...p, endsAt: e.target.value }));
                        setFieldErrors((prev) => ({ ...prev, endsAt: undefined }));
                      }}
                    />
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>When rewards stop being granted.</div>
                    {fieldErrors.endsAt && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.endsAt}</div>}
                  </div>
                </div>
              </div>
            )}

            {campaignStep === 2 && (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor="baseRewardPoints">Points per qualified invitee *</label>
                    <input
                      id="baseRewardPoints"
                      type="number"
                      min={0}
                      step={1}
                      value={draft.baseRewardPoints}
                      onChange={(e) => {
                        setDraft((p) => ({ ...p, baseRewardPoints: e.target.value }));
                        setFieldErrors((prev) => ({ ...prev, baseRewardPoints: undefined }));
                      }}
                    />
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Main reward amount for each invitee milestone.</div>
                    {Number(draft.baseRewardPoints) === 0 && (
                      <div style={{ color: '#b45309', fontSize: '12px' }}>This campaign will grant zero points.</div>
                    )}
                    {fieldErrors.baseRewardPoints && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.baseRewardPoints}</div>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor="targetActions">Referral goal *</label>
                    <input
                      id="targetActions"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={draft.targetActions}
                      onChange={(e) => {
                        setDraft((p) => ({ ...p, targetActions: e.target.value }));
                        setFieldErrors((prev) => ({ ...prev, targetActions: undefined }));
                      }}
                    />
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                      Used for user progress tracking only (does not change reward amount).
                    </div>
                    {fieldErrors.targetActions && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.targetActions}</div>}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <div style={{ fontWeight: 700 }}>Require manual approval</div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    If ON, new rewards are PENDING until admin approves. If OFF, rewards auto-approve.
                  </div>
                  <label htmlFor="markSuspiciousAsPending" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      id="markSuspiciousAsPending"
                      type="checkbox"
                      checked={draft.markSuspiciousAsPending}
                      onChange={(e) => setDraft((p) => ({ ...p, markSuspiciousAsPending: e.target.checked }))}
                    />
                    <span style={{ fontWeight: 700 }}>{draft.markSuspiciousAsPending ? 'ON: Manual approval required' : 'OFF: Automatic approval'}</span>
                  </label>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    markSuspiciousAsPending ON = points start pending; OFF = points available immediately.
                  </div>
                </div>

                <details open={showRewardOptions} onToggle={(e) => setShowRewardOptions(e.currentTarget.open)}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>More options</summary>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.65rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label htmlFor="activationRewardPoints">Activation bonus points</label>
                      <input
                        id="activationRewardPoints"
                        type="number"
                        min={0}
                        step={1}
                        value={draft.activationRewardPoints}
                        onChange={(e) => {
                          setDraft((p) => ({ ...p, activationRewardPoints: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, activationRewardPoints: undefined }));
                        }}
                      />
                      <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Reserved for future logic; safe to keep 0 for now.</div>
                      {fieldErrors.activationRewardPoints && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.activationRewardPoints}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label htmlFor="passportBonusPoints">Passport bonus points</label>
                      <input
                        id="passportBonusPoints"
                        type="number"
                        min={0}
                        step={1}
                        value={draft.passportBonusPoints}
                        onChange={(e) => {
                          setDraft((p) => ({ ...p, passportBonusPoints: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, passportBonusPoints: undefined }));
                        }}
                      />
                      <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Reserved for future logic; safe to keep 0 for now.</div>
                      {fieldErrors.passportBonusPoints && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.passportBonusPoints}</div>}
                    </div>
                  </div>
                </details>

                <div className="card" style={{ display: 'grid', gap: '0.65rem' }}>
                  <div style={{ fontWeight: 700 }}>Reward Rules</div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    Rewards are granted per invitee transaction up to maxTransactions.
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    Revenue share uses: internal fee + commission (+ optional other fees).
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    FIXED formula: points = baseRewardPoints. REVENUE_SHARE and NET_AMOUNT_SHARE use percentage rules.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label htmlFor="rewardMode">Reward mode</label>
                      <select
                        id="rewardMode"
                        value={draft.rewardMode}
                        onChange={(e) => {
                          setDraft((p) => ({ ...p, rewardMode: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, rewardMode: undefined, revenueSharePct: undefined, netAmountSharePct: undefined }));
                        }}
                      >
                        {rewardModeOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      {fieldErrors.rewardMode && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.rewardMode}</div>}
                    </div>

                    {draft.rewardMode === 'REVENUE_SHARE' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label htmlFor="revenueSharePct">Revenue share %</label>
                        <input
                          id="revenueSharePct"
                          type="number"
                          min={0}
                          step={0.01}
                          value={draft.revenueSharePct}
                          onChange={(e) => {
                            setDraft((p) => ({ ...p, revenueSharePct: e.target.value }));
                            setFieldErrors((prev) => ({ ...prev, revenueSharePct: undefined }));
                          }}
                        />
                        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                          Example: revenue 150 at 10% gives floor(15) = 15 points.
                        </div>
                        {fieldErrors.revenueSharePct && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.revenueSharePct}</div>}
                      </div>
                    )}
                    {draft.rewardMode === 'NET_AMOUNT_SHARE' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label htmlFor="netAmountSharePct">Net Amount Share %</label>
                        <input
                          id="netAmountSharePct"
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={draft.netAmountSharePct}
                          onChange={(e) => {
                            setDraft((p) => ({ ...p, netAmountSharePct: e.target.value }));
                            setFieldErrors((prev) => ({ ...prev, netAmountSharePct: undefined }));
                          }}
                        />
                        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                          Applies only when (internal fee + commission + other fees) &gt; 0.
                        </div>
                        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                          Percentage supports 2 decimals. Rounding note: computed points are rounded up per reward engine policy.
                        </div>
                        {fieldErrors.netAmountSharePct && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.netAmountSharePct}</div>}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label htmlFor="maxTransactions">Max transactions</label>
                      <input
                        id="maxTransactions"
                        type="number"
                        min={1}
                        step={1}
                        value={draft.maxTransactions}
                        onChange={(e) => {
                          setDraft((p) => ({ ...p, maxTransactions: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, maxTransactions: undefined }));
                        }}
                      />
                      {fieldErrors.maxTransactions && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.maxTransactions}</div>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label htmlFor="minPoints">Min points (optional)</label>
                      <input
                        id="minPoints"
                        type="number"
                        min={0}
                        step={0.01}
                        value={draft.minPoints}
                        onChange={(e) => {
                          setDraft((p) => ({ ...p, minPoints: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, minPoints: undefined, pointsRange: undefined }));
                        }}
                      />
                      {fieldErrors.minPoints && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.minPoints}</div>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label htmlFor="maxPoints">Max points (optional)</label>
                      <input
                        id="maxPoints"
                        type="number"
                        min={0}
                        step={0.01}
                        value={draft.maxPoints}
                        onChange={(e) => {
                          setDraft((p) => ({ ...p, maxPoints: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, maxPoints: undefined, pointsRange: undefined }));
                        }}
                      />
                      {fieldErrors.maxPoints && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.maxPoints}</div>}
                    </div>
                  </div>
                  {fieldErrors.pointsRange && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.pointsRange}</div>}
                  <label htmlFor="includeOtherFeesInRevenue" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      id="includeOtherFeesInRevenue"
                      type="checkbox"
                      checked={draft.includeOtherFeesInRevenue}
                      onChange={(e) => setDraft((p) => ({ ...p, includeOtherFeesInRevenue: e.target.checked }))}
                    />
                    <span>Include other fees in revenue share</span>
                  </label>
                  {draft.rewardMode === 'REVENUE_SHARE' && (
                    <div style={{ color: '#b45309', fontSize: '12px' }}>
                      In REVENUE_SHARE mode, baseRewardPoints is ignored for payout math.
                    </div>
                  )}
                  {draft.rewardMode === 'NET_AMOUNT_SHARE' && (
                    <div style={{ color: '#b45309', fontSize: '12px' }}>
                      In NET_AMOUNT_SHARE mode, baseRewardPoints is ignored. No reward row is created if transaction revenue is not positive.
                    </div>
                  )}
                </div>

                <details open={showAdvancedRules} onToggle={(e) => setShowAdvancedRules(e.currentTarget.open)}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Advanced rules (JSON)</summary>
                  <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '0.5rem' }}>
                    Optional advanced config; leave empty unless needed.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label htmlFor="milestoneRules">Milestone rules (JSON)</label>
                      <textarea
                        id="milestoneRules"
                        rows={6}
                        value={draft.milestoneRules}
                        onChange={(e) => {
                          setDraft((p) => ({ ...p, milestoneRules: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, milestoneRules: undefined }));
                        }}
                      />
                      <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Example: {`{"inviteeMilestones":[{"count":3,"points":20}]}`}</div>
                      {fieldErrors.milestoneRules && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{fieldErrors.milestoneRules}</div>}
                    </div>
                  </div>
                </details>
              </div>
            )}

            {campaignStep === 3 && (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  Activating this campaign enables live reward granting.
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  Only ACTIVE campaigns in their active date window are used for runtime rewarding.
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  Status behavior: PENDING rewards are not redeemable; APPROVED rewards are available immediately.
                </div>
                <div><strong>Active window:</strong> {formatDateTime(draft.startsAt)} to {formatDateTime(draft.endsAt)}</div>
                <div><strong>Reward:</strong> {toIntegerOrZero(draft.baseRewardPoints)} points per qualified invitee</div>
                <div><strong>Moderation:</strong> {draft.markSuspiciousAsPending ? 'Manual' : 'Automatic'}</div>
                <div><strong>Progress goal:</strong> {toIntegerOrZero(draft.targetActions)} referrals</div>
                <div><strong>Reward mode:</strong> {draft.rewardMode}</div>
                {draft.rewardMode === 'REVENUE_SHARE' && <div><strong>Revenue share:</strong> {draft.revenueSharePct || 0}%</div>}
                {draft.rewardMode === 'NET_AMOUNT_SHARE' && <div><strong>Net amount share:</strong> {draft.netAmountSharePct || 0}%</div>}
                <div style={{ fontWeight: 700 }}>Payload preview</div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px' }}>{payloadPreview}</pre>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </button>
              {campaignStep > 1 && (
                <button type="button" className="btn-neutral" onClick={goToPreviousCampaignStep} disabled={saving}>
                  Back
                </button>
              )}
              {campaignStep < 3 && (
                <button type="button" className="btn-primary" onClick={goToNextCampaignStep} disabled={saving}>
                  Next
                </button>
              )}
              {campaignStep === 3 && selected?.id && (
                <button type="button" className="btn-primary" onClick={() => save({ activateAfterSave: false })} disabled={saving}>
                  {saving ? 'Saving…' : 'Update'}
                </button>
              )}
              {campaignStep === 3 && !selected?.id && (
                <>
                  <button type="button" className="btn-neutral" onClick={() => save({ activateAfterSave: false })} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Draft'}
                  </button>
                  <button type="button" className="btn-success" onClick={tryActivateCampaign} disabled={saving}>
                    Activate
                  </button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {ruleEditorOpen && (
        <Modal title="Inviter Rule Editor" onClose={() => (!ruleSaving ? setRuleEditorOpen(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Campaign: <strong>{selectedRuleCampaign?.name || selectedRuleCampaignId || '—'}</strong>
            </div>
            <div className="card" style={{ display: 'grid', gap: '0.35rem' }}>
              <label htmlFor="ruleInviterEmailLookup">Find inviter by email</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="ruleInviterEmailLookup"
                  type="email"
                  value={ruleLookupEmail}
                  placeholder="user@example.com"
                  onChange={(e) => setRuleLookupEmail(e.target.value)}
                />
                <button type="button" className="btn-neutral" onClick={lookupInviterAccountIdByEmail} disabled={ruleLookupLoading || ruleSaving}>
                  <span style={{ whiteSpace: 'nowrap' }}>{ruleLookupLoading ? 'Searching…' : 'Search ID'}</span>
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="ruleInviterAccountId">Inviter account ID *</label>
                <input
                  id="ruleInviterAccountId"
                  value={ruleEditorDraft.inviterAccountId}
                  onChange={(e) => {
                    setRuleEditorDraft((prev) => ({ ...prev, inviterAccountId: e.target.value }));
                    setRuleEditorErrors((prev) => ({ ...prev, inviterAccountId: undefined }));
                  }}
                />
                {ruleEditorErrors.inviterAccountId && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{ruleEditorErrors.inviterAccountId}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="ruleRewardMode">Reward mode *</label>
                <select
                  id="ruleRewardMode"
                  value={ruleEditorDraft.rewardMode}
                  onChange={(e) => {
                    setRuleEditorDraft((prev) => ({ ...prev, rewardMode: e.target.value }));
                    setRuleEditorErrors((prev) => ({
                      ...prev,
                      rewardMode: undefined,
                      revenueSharePct: undefined,
                      netAmountSharePct: undefined
                    }));
                  }}
                >
                  {rewardModeOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                {ruleEditorErrors.rewardMode && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{ruleEditorErrors.rewardMode}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="ruleMaxTransactions">Max transactions *</label>
                <input
                  id="ruleMaxTransactions"
                  type="number"
                  min={1}
                  step={1}
                  value={ruleEditorDraft.maxTransactions}
                  onChange={(e) => {
                    setRuleEditorDraft((prev) => ({ ...prev, maxTransactions: e.target.value }));
                    setRuleEditorErrors((prev) => ({ ...prev, maxTransactions: undefined }));
                  }}
                />
                {ruleEditorErrors.maxTransactions && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{ruleEditorErrors.maxTransactions}</div>}
              </div>
            </div>

            {ruleEditorDraft.rewardMode === 'REVENUE_SHARE' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="ruleRevenueSharePct">Revenue Share % *</label>
                <input
                  id="ruleRevenueSharePct"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={ruleEditorDraft.revenueSharePct}
                  onChange={(e) => {
                    setRuleEditorDraft((prev) => ({ ...prev, revenueSharePct: e.target.value }));
                    setRuleEditorErrors((prev) => ({ ...prev, revenueSharePct: undefined }));
                  }}
                />
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  Reward = % * (internalFee + commission [+ otherFees if enabled]).
                </div>
                {ruleEditorErrors.revenueSharePct && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{ruleEditorErrors.revenueSharePct}</div>}
              </div>
            )}

            {ruleEditorDraft.rewardMode === 'NET_AMOUNT_SHARE' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="ruleNetAmountSharePct">Net Amount Share % *</label>
                <input
                  id="ruleNetAmountSharePct"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={ruleEditorDraft.netAmountSharePct}
                  onChange={(e) => {
                    setRuleEditorDraft((prev) => ({ ...prev, netAmountSharePct: e.target.value }));
                    setRuleEditorErrors((prev) => ({ ...prev, netAmountSharePct: undefined }));
                  }}
                />
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  Applies to net amount (settlementNet fallback to amount) only when revenue is positive.
                </div>
                {ruleEditorErrors.netAmountSharePct && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{ruleEditorErrors.netAmountSharePct}</div>}
              </div>
            )}

            {ruleEditorDraft.rewardMode === 'FIXED' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="ruleBaseRewardPoints">Base points (FIXED)</label>
                <input
                  id="ruleBaseRewardPoints"
                  type="number"
                  min={0}
                  step={0.01}
                  value={ruleEditorDraft.baseRewardPoints}
                  onChange={(e) => {
                    setRuleEditorDraft((prev) => ({ ...prev, baseRewardPoints: e.target.value }));
                    setRuleEditorErrors((prev) => ({ ...prev, baseRewardPoints: undefined }));
                  }}
                />
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  Override fixed payout points for this inviter. Leave empty to use campaign base points.
                </div>
                {ruleEditorErrors.baseRewardPoints && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{ruleEditorErrors.baseRewardPoints}</div>}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="ruleMinPoints">Min points</label>
                <input
                  id="ruleMinPoints"
                  type="number"
                  min={0}
                  step={0.01}
                  value={ruleEditorDraft.minPoints}
                  onChange={(e) => {
                    setRuleEditorDraft((prev) => ({ ...prev, minPoints: e.target.value }));
                    setRuleEditorErrors((prev) => ({ ...prev, minPoints: undefined, pointsRange: undefined }));
                  }}
                />
                {ruleEditorErrors.minPoints && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{ruleEditorErrors.minPoints}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="ruleMaxPoints">Max points</label>
                <input
                  id="ruleMaxPoints"
                  type="number"
                  min={0}
                  step={0.01}
                  value={ruleEditorDraft.maxPoints}
                  onChange={(e) => {
                    setRuleEditorDraft((prev) => ({ ...prev, maxPoints: e.target.value }));
                    setRuleEditorErrors((prev) => ({ ...prev, maxPoints: undefined, pointsRange: undefined }));
                  }}
                />
                {ruleEditorErrors.maxPoints && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{ruleEditorErrors.maxPoints}</div>}
              </div>
            </div>
            {ruleEditorErrors.pointsRange && <div style={{ color: '#b91c1c', fontSize: '12px' }}>{ruleEditorErrors.pointsRange}</div>}

            <label htmlFor="ruleIncludeOtherFees" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                id="ruleIncludeOtherFees"
                type="checkbox"
                checked={ruleEditorDraft.includeOtherFeesInRevenue}
                onChange={(e) => setRuleEditorDraft((prev) => ({ ...prev, includeOtherFeesInRevenue: e.target.checked }))}
              />
              <span>Include other fees in revenue basis</span>
            </label>

            <div className="card" style={{ color: 'var(--muted)', fontSize: '12px' }}>
              {previewMathText}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Engine alias `sharePct` is supported, but this UI saves explicit keys (`revenueSharePct` / `netAmountSharePct`).
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setRuleEditorOpen(false)} disabled={ruleSaving}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={saveInviterRule} disabled={ruleSaving}>
                {ruleSaving ? 'Saving…' : 'Save rule'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDetail && selected && (
        <Modal title={`Referral campaign ${selected.id || ''}`} onClose={() => setShowDetail(false)}>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <div><strong>Name:</strong> {selected.name || '—'}</div>
            <div><strong>Status:</strong> {selected.status || '—'}</div>
            <div><strong>Description:</strong> {selected.description || '—'}</div>
            <div><strong>Starts at:</strong> {formatDateTime(selected.startsAt)}</div>
            <div><strong>Ends at:</strong> {formatDateTime(selected.endsAt)}</div>
            <div><strong>Referral goal:</strong> {Array.isArray(selected.targetActions) ? selected.targetActions.length : (selected.targetActions ?? '—')}</div>
            <div><strong>Base reward points:</strong> {selected.baseRewardPoints ?? '—'}</div>
            <div><strong>Activation reward points:</strong> {selected.activationRewardPoints ?? '—'}</div>
            <div><strong>Passport bonus points:</strong> {selected.passportBonusPoints ?? '—'}</div>
            <div><strong>Mark suspicious as pending:</strong> {String(Boolean(selected.markSuspiciousAsPending))}</div>
            <div><strong>Eligibility rules:</strong></div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px' }}>
              {JSON.stringify(selected.eligibilityRules ?? {}, null, 2)}
            </pre>
            <div><strong>Milestone rules:</strong></div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px' }}>
              {JSON.stringify(selected.milestoneRules ?? {}, null, 2)}
            </pre>
          </div>
        </Modal>
      )}

      {showActivateConfirm && (
        <Modal title="Activate campaign" onClose={() => (!saving ? setShowActivateConfirm(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>Activating this campaign enables live reward granting.</div>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowActivateConfirm(false)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn-success" onClick={() => save({ activateAfterSave: true })} disabled={saving}>
                {saving ? 'Activating…' : 'Confirm activate'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteRuleTarget && (
        <Modal title="Delete inviter rule" onClose={() => (!ruleSaving ? setDeleteRuleTarget(null) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              Delete inviter rule for <strong>{deleteRuleTarget}</strong>?
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If deleted, campaign default rules will apply for this inviter.
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setDeleteRuleTarget(null)} disabled={ruleSaving}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={confirmDeleteInviterRule} disabled={ruleSaving}>
                {ruleSaving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {moderationModal && (
        <Modal title={`${moderationModal.action.toUpperCase()} reward ${moderationModal.rewardId}`} onClose={() => (!moderating ? setModerationModal(null) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              Reward ID: <strong>{moderationModal.rewardId}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="moderationReason">Reason *</label>
              <textarea id="moderationReason" rows={3} value={moderationReason} onChange={(e) => setModerationReason(e.target.value)} />
            </div>
            {moderationModal.action === 'recompute' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="recomputePoints">Points *</label>
                <input id="recomputePoints" type="number" value={recomputePoints} onChange={(e) => setRecomputePoints(e.target.value)} />
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setModerationModal(null)} disabled={moderating}>Cancel</button>
              <button type="button" className="btn-primary" onClick={submitModeration} disabled={moderating}>
                {moderating ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
