'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { useLocale } from '@/contexts/LocaleContext';
import {
  AdminModal,
  DetailGrid,
  MetricStrip,
  SavingsPageHeader,
  SavingsSubnav,
  SectionCard,
  StatusBadge,
  TypeBadge,
  formatCount,
  formatDate,
  formatDateTime,
  formatMoney,
  humanizeEnum,
  pickFirst
} from '@/components/SavingsAdmin';
import { api } from '@/lib/api';

const tabStyle = (active) => ({
  border: '1px solid var(--border)',
  background: active ? 'var(--accent-soft)' : 'var(--surface)',
  color: active ? 'var(--accent)' : 'var(--text)',
  borderRadius: '999px',
  padding: '0.45rem 0.8rem',
  cursor: 'pointer',
  fontWeight: 700
});

const emptyPolicyForm = {
  loanApprovalThresholdPercent: '',
  treasuryWithdrawalApprovalThresholdPercent: '',
  loanInterestPercentage: '',
  allowMultipleActiveLoans: false,
  defaultRulesText: '',
  defaultAfterDays: ''
};
const emptyInviteForm = {
  accountId: '',
  accountReference: '',
  email: '',
  phone: '',
  rotationOrder: ''
};
const emptyMessageForm = {
  message: ''
};
const emptyInterventionDraft = {
  reason: '',
  note: '',
  externalReference: '',
  completionNote: ''
};

const getType = (group) => String(pickFirst(group?.type, group?.groupType, 'UNKNOWN')).toUpperCase();
const getStatus = (group) => pickFirst(group?.status, group?.groupStatus, 'UNKNOWN');
const getReference = (group) => pickFirst(group?.reference, group?.internalReference);
const getName = (group) => pickFirst(group?.name, group?.groupName);
const getCreator = (group) => pickFirst(group?.createdByAccountId, group?.creatorAccountId, group?.creator?.accountId);
const getCreatedAt = (group) => pickFirst(group?.createdAt, group?.createdDate);
const getTreasuryBalance = (group) => pickFirst(group?.treasuryBalance, group?.currentTreasuryBalance);
const getCurrentCycleNumber = (group) => pickFirst(group?.currentCycleNumber, group?.cycleNumber);
const getCurrentRoundNumber = (group) => pickFirst(group?.currentRoundNumber, group?.roundNumber);
const getMembersCount = (group) => pickFirst(group?.activeMemberCount, group?.memberCount);
const getDeletedAt = (group) => pickFirst(group?.deletedAt);
const getRoundNumber = (row) => pickFirst(row?.roundNumber, row?.round?.number);
const getCycleNumber = (row) => pickFirst(row?.cycleNumber, row?.cycle?.cycleNumber);
const getCycleId = (row) => pickFirst(row?.cycleId, row?.cycle?.id);
const getContributionId = (row) => pickFirst(row?.contributionId, row?.id);
const getPayoutId = (row) => pickFirst(row?.payoutId, row?.id);
const getLoanId = (row) => pickFirst(row?.loanId, row?.id);
const getRepaymentId = (row) => pickFirst(row?.repaymentId, row?.id);
const getTreasuryWithdrawalId = (row) => pickFirst(row?.withdrawalId, row?.id);
const getMemberId = (row) => pickFirst(row?.memberId, row?.groupMemberId, row?.member?.id);
const getContributionStatus = (row) => String(pickFirst(row?.status, 'UNKNOWN')).toUpperCase();
const isPendingContribution = (row) => getContributionStatus(row) === 'PENDING';
const getCycleReminderKey = (row) => {
  const cycleId = getCycleId(row);
  if (cycleId !== null && cycleId !== undefined && cycleId !== '') return `id:${cycleId}`;
  return `rc:${pickFirst(getRoundNumber(row), 'x')}:${pickFirst(getCycleNumber(row), 'x')}`;
};
const formatRoundCycleLabel = (row, fallbackRound, fallbackCycle) => {
  const round = pickFirst(getRoundNumber(row), fallbackRound);
  const cycle = pickFirst(getCycleNumber(row), fallbackCycle);
  if ((round === null || round === undefined || round === '') && (cycle === null || cycle === undefined || cycle === '')) return '—';
  return `Round ${formatCount(round)} · Cycle ${formatCount(cycle)}`;
};

export default function GroupSavingDetailPage() {
  const { t } = useLocale();
  const params = useParams();
  const groupId = params?.id;
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loans, setLoans] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [treasuryWithdrawals, setTreasuryWithdrawals] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [policyChanges, setPolicyChanges] = useState([]);
  const [policyDraft, setPolicyDraft] = useState(emptyPolicyForm);
  const [inviteDraft, setInviteDraft] = useState(emptyInviteForm);
  const [messageDraft, setMessageDraft] = useState(emptyMessageForm);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [savingAction, setSavingAction] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [interventionConfig, setInterventionConfig] = useState(null);
  const [interventionDraft, setInterventionDraft] = useState(emptyInterventionDraft);
  const [selectedReminderCycleKey, setSelectedReminderCycleKey] = useState('');
  const [selectedReminderMemberIds, setSelectedReminderMemberIds] = useState([]);

  const isAvec = getType(group) === 'AVEC';
  const isLikelemba = getType(group) === 'LIKELEMBA';
  const canRestore = Boolean(getDeletedAt(group));

  const tabs = useMemo(() => {
    const base = [
      { key: 'overview', label: 'Overview' },
      { key: 'members', label: 'Members' },
      { key: 'cycles', label: 'Cycles' },
      { key: 'contributions', label: 'Contributions' },
      { key: 'payouts', label: 'Payouts' },
      { key: 'invitations', label: 'Invitations' }
    ];
    if (isAvec) {
      base.push({ key: 'loans', label: 'Loans' });
      base.push({ key: 'repayments', label: 'Repayments' });
      base.push({ key: 'treasury', label: 'Treasury Withdrawals' });
      base.push({ key: 'policy', label: 'Policy' });
    }
    base.push({ key: 'messages', label: 'Messages' });
    base.push({ key: 'audit', label: 'Audit' });
    return base;
  }, [isAvec]);

  const loadGroup = async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        api.groupSavings.get(groupId),
        api.groupSavings.members.list(groupId),
        api.groupSavings.cycles.list(groupId),
        api.groupSavings.contributions.list(groupId),
        api.groupSavings.payouts.list(groupId),
        api.groupSavings.loans.list(groupId),
        api.groupSavings.repayments.list(groupId),
        api.groupSavings.treasuryWithdrawals.list(groupId),
        api.groupSavings.auditEvents.list(groupId),
        api.groupSavings.policy.get(groupId),
        api.groupSavings.policyChanges.list(groupId),
        api.groupSavings.invitations.list(groupId),
        api.groupSavings.joinRequests.list(groupId),
        api.groupSavings.messages.list(groupId)
      ]);

      const readList = (index) => {
        const value = results[index];
        if (value?.status !== 'fulfilled') return [];
        const data = value.value;
        return Array.isArray(data) ? data : data?.content || [];
      };

      const groupValue = results[0];
      if (groupValue?.status !== 'fulfilled') {
        throw groupValue.reason || new Error('Failed to load group saving detail');
      }

      setGroup(groupValue.value || null);
      setMembers(readList(1));
      setCycles(readList(2));
      setContributions(readList(3));
      setPayouts(readList(4));
      setLoans(readList(5));
      setRepayments(readList(6));
      setTreasuryWithdrawals(readList(7));
      setAuditEvents(readList(8));
      setPolicyChanges(readList(10));
      setInvitations(readList(11));
      setJoinRequests(readList(12));
      setMessages(readList(13));

      const policyValue = results[9];
      const nextPolicy = policyValue?.status === 'fulfilled' ? policyValue.value : null;
      setPolicy(nextPolicy);
      setPolicyDraft({
        loanApprovalThresholdPercent: String(pickFirst(nextPolicy?.loanApprovalThresholdPercent, nextPolicy?.loanApprovalThreshold, '')),
        treasuryWithdrawalApprovalThresholdPercent: String(
          pickFirst(nextPolicy?.treasuryWithdrawalApprovalThresholdPercent, nextPolicy?.treasuryWithdrawalApprovalThreshold, '')
        ),
        loanInterestPercentage: String(pickFirst(nextPolicy?.loanInterestPercentage, nextPolicy?.loanInterestPercent, '')),
        allowMultipleActiveLoans: Boolean(pickFirst(nextPolicy?.allowMultipleActiveLoans, false)),
        defaultRulesText: String(pickFirst(nextPolicy?.defaultRulesText, nextPolicy?.defaultRules, '')),
        defaultAfterDays: String(pickFirst(nextPolicy?.defaultAfterDays, ''))
      });
    } catch (err) {
      setError(err?.message || 'Failed to load group saving detail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroup();
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!error && !info) return;
    const timer = setTimeout(() => {
      setError(null);
      setInfo(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [error, info]);

  useEffect(() => {
    setSelectedReminderMemberIds((prev) => {
      if (!selectedReminderCycleKey) return [];
      const validMemberIds = new Set(
        contributions
          .filter((row) => isPendingContribution(row) && getCycleReminderKey(row) === selectedReminderCycleKey)
          .map((row) => String(getMemberId(row)))
          .filter(Boolean)
      );
      return prev.filter((memberId) => validMemberIds.has(String(memberId)));
    });
  }, [contributions, selectedReminderCycleKey]);

  const currentCycle = useMemo(() => {
    return (
      cycles.find((cycle) => String(pickFirst(cycle?.status, '')).toUpperCase() === 'ACTIVE') ||
      cycles.find(
        (cycle) =>
          Number(pickFirst(cycle?.roundNumber, -1)) === Number(getCurrentRoundNumber(group)) &&
          Number(pickFirst(cycle?.cycleNumber, -1)) === Number(getCurrentCycleNumber(group))
      ) ||
      cycles[0] ||
      null
    );
  }, [cycles, group]);

  const pendingContributionCycleOptions = useMemo(() => {
    const map = new Map();
    contributions.forEach((row) => {
      if (!isPendingContribution(row)) return;
      const key = getCycleReminderKey(row);
      const memberId = getMemberId(row);
      const cycleId = getCycleId(row);
      const existing = map.get(key) || {
        key,
        cycleId,
        roundNumber: getRoundNumber(row),
        cycleNumber: getCycleNumber(row),
        label: formatRoundCycleLabel(row, pickFirst(row?.groupRoundNumber, row?.currentRoundNumber), pickFirst(row?.groupCycleNumber, row?.currentCycleNumber)),
        pendingCount: 0,
        memberIds: []
      };
      existing.pendingCount += 1;
      if (memberId !== null && memberId !== undefined && memberId !== '') {
        const normalizedMemberId = String(memberId);
        if (!existing.memberIds.includes(normalizedMemberId)) existing.memberIds.push(normalizedMemberId);
      }
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => {
      const roundDiff = Number(b.roundNumber || 0) - Number(a.roundNumber || 0);
      if (roundDiff !== 0) return roundDiff;
      return Number(b.cycleNumber || 0) - Number(a.cycleNumber || 0);
    });
  }, [contributions]);

  useEffect(() => {
    if (!pendingContributionCycleOptions.length) {
      setSelectedReminderCycleKey('');
      return;
    }
    if (!selectedReminderCycleKey || !pendingContributionCycleOptions.some((option) => option.key === selectedReminderCycleKey)) {
      setSelectedReminderCycleKey(pendingContributionCycleOptions[0].key);
      setSelectedReminderMemberIds([]);
    }
  }, [pendingContributionCycleOptions, selectedReminderCycleKey]);

  const selectedReminderCycle = useMemo(
    () => pendingContributionCycleOptions.find((option) => option.key === selectedReminderCycleKey) || null,
    [pendingContributionCycleOptions, selectedReminderCycleKey]
  );

  const pendingMembersForSelectedCycle = useMemo(
    () =>
      new Set(
        contributions
          .filter((row) => isPendingContribution(row) && getCycleReminderKey(row) === selectedReminderCycleKey)
          .map((row) => String(getMemberId(row)))
          .filter(Boolean)
      ),
    [contributions, selectedReminderCycleKey]
  );

  const toggleReminderMemberSelection = (row) => {
    const memberId = getMemberId(row);
    const cycleKey = getCycleReminderKey(row);
    if (!memberId || !isPendingContribution(row)) return;
    const normalizedMemberId = String(memberId);
    setSelectedReminderCycleKey(cycleKey);
    setSelectedReminderMemberIds((prev) => {
      const filtered = prev.filter((item) => pendingMembersForSelectedCycle.has(String(item)));
      return filtered.includes(normalizedMemberId)
        ? filtered.filter((item) => item !== normalizedMemberId)
        : [...filtered, normalizedMemberId];
    });
  };

  const openInterventionModal = (config) => {
    setInterventionDraft(emptyInterventionDraft);
    setInterventionConfig(config);
    setError(null);
    setInfo(null);
  };

  const runIntervention = async () => {
    if (!groupId || !interventionConfig) return;
    const reason = interventionDraft.reason.trim();
    if (!reason) {
      setError('Reason is required.');
      return;
    }
    const payload = {
      reason,
      ...(interventionDraft.note.trim() ? { note: interventionDraft.note.trim() } : {}),
      ...(interventionDraft.externalReference.trim() ? { externalReference: interventionDraft.externalReference.trim() } : {}),
      ...(interventionDraft.completionNote.trim() ? { completionNote: interventionDraft.completionNote.trim() } : {})
    };
    const actionKey = interventionConfig.actionKey;
    setSavingAction(actionKey);
    setError(null);
    setInfo(null);
    try {
      await interventionConfig.run(payload);
      setInfo(interventionConfig.successMessage || 'Action completed.');
      setInterventionConfig(null);
      setInterventionDraft(emptyInterventionDraft);
      await loadGroup();
    } catch (err) {
      setError(err?.message || 'Failed to complete admin action');
    } finally {
      setSavingAction('');
    }
  };

  const runDirectAction = async (actionKey, request, successMessage, fallbackError) => {
    setSavingAction(actionKey);
    setError(null);
    setInfo(null);
    try {
      await request();
      setInfo(successMessage);
      await loadGroup();
    } catch (err) {
      setError(err?.message || fallbackError);
    } finally {
      setSavingAction('');
    }
  };

  const handleLifecycleAction = async (action) => {
    if (!groupId) return;
    setSavingAction(action);
    setError(null);
    setInfo(null);
    try {
      if (action === 'activate') {
        await api.groupSavings.activate(groupId);
        setInfo('Group activated.');
      } else if (action === 'restart') {
        await api.groupSavings.restart(groupId);
        setInfo('Group restarted.');
      } else if (action === 'delete-group') {
        await api.groupSavings.remove(groupId);
        setInfo('Group deleted.');
      }
      await loadGroup();
    } catch (err) {
      setError(err?.message || `Failed to ${action.replace('-group', '')} group`);
    } finally {
      setSavingAction('');
      setConfirmAction(null);
    }
  };

  const handlePauseResume = async (action) => {
    if (!groupId) return;
    setSavingAction(action);
    setError(null);
    setInfo(null);
    try {
      if (action === 'pause') {
        await api.groupSavings.pause(groupId);
        setInfo('Group paused.');
      } else {
        await api.groupSavings.resume(groupId);
        setInfo('Group resumed.');
      }
      await loadGroup();
    } catch (err) {
      setError(err?.message || `Failed to ${action} group`);
    } finally {
      setSavingAction('');
      setConfirmAction(null);
    }
  };

  const handleRestoreGroup = async () => {
    if (!groupId) return;
    setSavingAction('restore-group');
    setError(null);
    setInfo(null);
    try {
      const restored = await api.groupSavings.restore(groupId);
      setGroup(restored || null);
      setInfo('Group restored');
    } catch (err) {
      if (err?.status === 400) setError('This group is not deleted.');
      else if (err?.status === 404) setError('Group not found.');
      else setError('Could not restore group. Please refresh and try again.');
    } finally {
      setSavingAction('');
      setConfirmAction(null);
    }
  };

  const handleRemoveMember = async (member) => {
    setSavingAction(`remove-member-${member.id}`);
    setError(null);
    setInfo(null);
    try {
      await api.groupSavings.members.remove(groupId, member.id);
      setInfo('Member removed.');
      await loadGroup();
    } catch (err) {
      setError(err?.message || 'Failed to remove member');
    } finally {
      setSavingAction('');
      setConfirmAction(null);
    }
  };

  const handleSavePolicy = async () => {
    setSavingAction('save-policy');
    setError(null);
    setInfo(null);
    try {
      const payload = {
        loanApprovalThresholdPercent:
          policyDraft.loanApprovalThresholdPercent === '' ? null : Number(policyDraft.loanApprovalThresholdPercent),
        treasuryWithdrawalApprovalThresholdPercent:
          policyDraft.treasuryWithdrawalApprovalThresholdPercent === ''
            ? null
            : Number(policyDraft.treasuryWithdrawalApprovalThresholdPercent),
        loanInterestPercentage: policyDraft.loanInterestPercentage === '' ? null : Number(policyDraft.loanInterestPercentage),
        allowMultipleActiveLoans: Boolean(policyDraft.allowMultipleActiveLoans),
        defaultRulesText: policyDraft.defaultRulesText || null,
        defaultAfterDays: policyDraft.defaultAfterDays === '' ? null : Number(policyDraft.defaultAfterDays)
      };
      await api.groupSavings.policy.update(groupId, payload);
      setInfo('AVEC policy updated.');
      await loadGroup();
    } catch (err) {
      setError(err?.message || 'Failed to update AVEC policy');
    } finally {
      setSavingAction('');
    }
  };

  const handleRemindMember = async (row) => {
    const cycleId = getCycleId(row);
    const memberId = getMemberId(row);
    if (!groupId || !cycleId || !memberId) return;
    const actionKey = `remind-member-${cycleId}-${memberId}`;
    setSavingAction(actionKey);
    setError(null);
    setInfo(null);
    try {
      const res = await api.groupSavings.cycles.remindMember(groupId, cycleId, memberId);
      const queuedCount = Number(res?.queuedCount);
      setInfo(`Queued ${Number.isFinite(queuedCount) ? queuedCount : 1} reminder${queuedCount === 1 ? '' : 's'} for this member.`);
    } catch (err) {
      setError(err?.message || 'Failed to queue reminder');
    } finally {
      setSavingAction('');
    }
  };

  const handleRemindUnpaid = async ({ memberIds } = {}) => {
    if (!groupId || !selectedReminderCycle?.cycleId) return;
    const actionKey = memberIds?.length ? 'remind-selected-unpaid' : 'remind-all-unpaid';
    setSavingAction(actionKey);
    setError(null);
    setInfo(null);
    try {
      const payload = memberIds?.length ? { memberIds } : undefined;
      const res = await api.groupSavings.cycles.remindUnpaid(groupId, selectedReminderCycle.cycleId, payload);
      const queuedCount = Number(res?.queuedCount) || 0;
      setInfo(`Queued ${queuedCount} reminder${queuedCount === 1 ? '' : 's'} for ${selectedReminderCycle.label}.`);
      if (memberIds?.length) setSelectedReminderMemberIds([]);
    } catch (err) {
      setError(err?.message || 'Failed to queue reminders');
    } finally {
      setSavingAction('');
    }
  };

  const handleCreateInvitation = async () => {
    if (!groupId) return;
    const payload = {};
    const accountId = inviteDraft.accountId.trim();
    const accountReference = inviteDraft.accountReference.trim();
    const email = inviteDraft.email.trim();
    const phone = inviteDraft.phone.trim();
    const identifiers = [accountId, accountReference, email, phone].filter(Boolean);
    if (identifiers.length !== 1) {
      setError('Provide exactly one invitation target: account ID, account reference, email, or phone.');
      return;
    }
    if (accountId) payload.accountId = Number(accountId);
    if (accountReference) payload.accountReference = accountReference;
    if (email) payload.email = email;
    if (phone) payload.phone = phone;
    if (inviteDraft.rotationOrder.trim()) payload.rotationOrder = Number(inviteDraft.rotationOrder.trim());

    setSavingAction('create-invitation');
    setError(null);
    setInfo(null);
    try {
      await api.groupSavings.invitations.create(groupId, payload);
      setInviteDraft(emptyInviteForm);
      setInfo('Invitation created.');
      await loadGroup();
    } catch (err) {
      setError(err?.message || 'Failed to create invitation');
    } finally {
      setSavingAction('');
    }
  };

  const handleApproveInvitation = async (invitationId) => {
    if (!groupId || !invitationId) return;
    const actionKey = `approve-invitation-${invitationId}`;
    setSavingAction(actionKey);
    setError(null);
    setInfo(null);
    try {
      await api.groupSavings.invitations.approve(groupId, invitationId);
      setInfo('Invitation approved.');
      await loadGroup();
    } catch (err) {
      setError(err?.message || 'Failed to approve invitation');
    } finally {
      setSavingAction('');
    }
  };

  const handleJoinRequestAction = async (invitationId, action) => {
    if (!groupId || !invitationId) return;
    const actionKey = `${action}-join-request-${invitationId}`;
    setSavingAction(actionKey);
    setError(null);
    setInfo(null);
    try {
      if (action === 'approve') {
        await api.groupSavings.joinRequests.approve(groupId, invitationId);
        setInfo('Join request approved.');
      } else {
        await api.groupSavings.joinRequests.reject(groupId, invitationId);
        setInfo('Join request rejected.');
      }
      await loadGroup();
    } catch (err) {
      setError(err?.message || `Failed to ${action} join request`);
    } finally {
      setSavingAction('');
      setConfirmAction(null);
    }
  };

  const handleCreateMessage = async () => {
    if (!groupId || !messageDraft.message.trim()) {
      setError('Message is required.');
      return;
    }
    setSavingAction('create-message');
    setError(null);
    setInfo(null);
    try {
      await api.groupSavings.messages.create(groupId, { message: messageDraft.message.trim() });
      setMessageDraft(emptyMessageForm);
      setInfo('Message sent.');
      await loadGroup();
    } catch (err) {
      setError(err?.message || 'Failed to send message');
    } finally {
      setSavingAction('');
    }
  };

  const handleDeleteMessage = async (eventId) => {
    if (!groupId || !eventId) return;
    const actionKey = `delete-message-${eventId}`;
    setSavingAction(actionKey);
    setError(null);
    setInfo(null);
    try {
      await api.groupSavings.messages.remove(groupId, eventId);
      setInfo('Message deleted.');
      await loadGroup();
    } catch (err) {
      setError(err?.message || 'Failed to delete message');
    } finally {
      setSavingAction('');
      setConfirmAction(null);
    }
  };

  const policyWarnings = useMemo(() => {
    const warnings = [];
    const loanThreshold = Number(policyDraft.loanApprovalThresholdPercent);
    const withdrawalThreshold = Number(policyDraft.treasuryWithdrawalApprovalThresholdPercent);
    if (Number.isFinite(loanThreshold) && loanThreshold < 25) warnings.push('Loan approval threshold is low. Small voting blocks may approve loans quickly.');
    if (Number.isFinite(loanThreshold) && loanThreshold > 90) warnings.push('Loan approval threshold is high. Loan approvals may become difficult to reach.');
    if (Number.isFinite(withdrawalThreshold) && withdrawalThreshold < 25) warnings.push('Treasury withdrawal threshold is low. Treasury funds may move with limited group consensus.');
    if (Number.isFinite(withdrawalThreshold) && withdrawalThreshold > 90) warnings.push('Treasury withdrawal threshold is high. Treasury withdrawals may stall waiting for approvals.');
    return warnings;
  }, [policyDraft]);

  const membersColumns = [
    { key: 'account', label: 'Account', render: (row) => pickFirst(row?.accountReference, row?.account?.reference, row?.accountId, '—') },
    { key: 'role', label: 'Role', render: (row) => humanizeEnum(pickFirst(row?.role, '—')) },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge value={pickFirst(row?.status, 'UNKNOWN')} /> },
    { key: 'rotation', label: 'Rotation Order', render: (row) => (isLikelemba ? pickFirst(row?.rotationOrder, '—') : '—') },
    {
      key: 'debtBlock',
      label: 'Exit Blocked By Debt',
      render: (row) => (Boolean(row?.exitBlockedByDebt) ? 'Yes' : 'No')
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        const blocked = Boolean(row?.exitBlockedByDebt) || String(pickFirst(row?.status, '')).toUpperCase() !== 'ACTIVE';
        const reason = Boolean(row?.exitBlockedByDebt)
          ? 'Member cannot be removed because they still have unresolved AVEC debt.'
          : String(pickFirst(row?.status, '')).toUpperCase() !== 'ACTIVE'
            ? 'Only active members can be removed.'
            : '';
        return (
          <button
            type="button"
            className="btn-danger"
            disabled={blocked}
            title={reason}
            onClick={() => setConfirmAction({ type: 'remove-member', member: row })}
          >
            {isAvec ? 'Admin Override Remove' : 'Remove'}
          </button>
        );
      }
    }
  ];

  if (!groupId) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SavingsSubnav />
      <SavingsPageHeader
        title={loading ? 'Loading group saving…' : getName(group) || `Group ${groupId}`}
        description="Main operations screen for group savings. Visibility comes first; pause/resume, member removal, and AVEC policy updates are limited corrective actions."
        actions={
          <>
            <Link href="/dashboard/savings/groups" className="btn-neutral" style={{ textDecoration: 'none' }}>
              Back to Groups
            </Link>
            <button type="button" className="btn-primary" onClick={loadGroup} disabled={loading || Boolean(savingAction)}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </>
        }
      />

      {error ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div> : null}
      {info ? <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div> : null}

      <SectionCard
        title="Header"
        description="Identity, ownership, and lifecycle status."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <TypeBadge value={getType(group)} />
            <StatusBadge value={getStatus(group)} />
            {canRestore ? <StatusBadge value="DELETED" /> : null}
            {!canRestore && String(getStatus(group)).toUpperCase() === 'DRAFT' ? (
              <button type="button" className="btn-primary" disabled={savingAction === 'activate'} onClick={() => setConfirmAction({ type: 'activate' })}>
                {savingAction === 'activate' ? 'Activating…' : 'Activate'}
              </button>
            ) : null}
            {!canRestore && String(getStatus(group)).toUpperCase() === 'COMPLETED' ? (
              <button type="button" className="btn-primary" disabled={savingAction === 'restart'} onClick={() => setConfirmAction({ type: 'restart' })}>
                {savingAction === 'restart' ? 'Restarting…' : 'Restart'}
              </button>
            ) : null}
            {!canRestore ? (
              <button type="button" className="btn-danger" disabled={savingAction === 'delete-group'} onClick={() => setConfirmAction({ type: 'delete-group' })}>
                {savingAction === 'delete-group' ? 'Deleting…' : 'Delete'}
              </button>
            ) : null}
            {canRestore ? (
              <button type="button" className="btn-primary" disabled={savingAction === 'restore-group'} onClick={() => setConfirmAction({ type: 'restore-group' })}>
                {savingAction === 'restore-group' ? 'Restoring…' : 'Restore'}
              </button>
            ) : null}
          </div>
        }
      >
        <DetailGrid
          rows={[
            { label: 'Reference', value: getReference(group) || '—' },
            { label: 'Group Name', value: getName(group) || '—' },
            { label: 'Creator', value: getCreator(group) || '—' },
            { label: 'Created Date', value: formatDateTime(getCreatedAt(group)) },
            { label: 'Current Round Number', value: formatCount(getCurrentRoundNumber(group)) },
            { label: 'Deleted At', value: formatDateTime(getDeletedAt(group)) }
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Summary Strip"
        description={isAvec ? 'Treasury and loan signals matter most for AVEC.' : 'Cycle and contribution signals matter most for LIKELEMBA.'}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {String(getStatus(group)).toUpperCase() === 'ACTIVE' ? (
              <button type="button" className="btn-danger" disabled={Boolean(savingAction)} onClick={() => setConfirmAction({ type: 'pause' })}>
                Pause
              </button>
            ) : null}
            {String(getStatus(group)).toUpperCase() === 'PAUSED' ? (
              <button type="button" className="btn-primary" disabled={Boolean(savingAction)} onClick={() => setConfirmAction({ type: 'resume' })}>
                Resume
              </button>
            ) : null}
          </div>
        }
      >
        <MetricStrip
          items={[
            { label: 'Active Members', value: formatCount(getMembersCount(group)) },
            { label: 'Current Round Number', value: formatCount(getCurrentRoundNumber(group)) },
            { label: 'Current Cycle Number', value: formatCount(getCurrentCycleNumber(group)) },
            { label: 'Pending Contributions', value: formatCount(group?.pendingContributionCount) },
            { label: 'Overdue Contributions', value: formatCount(group?.overdueContributionCount), valueTone: '#b91c1c' },
            {
              label: 'Treasury Balance',
              value: isAvec ? formatMoney(getTreasuryBalance(group)) : '—',
              hint: isAvec ? 'AVEC only' : 'Not applicable'
            },
            {
              label: 'Blocked / Paused',
              value: Boolean(pickFirst(group?.blockedByOverdue, group?.hasOverdueContributions, false)) || String(getStatus(group)).toUpperCase() === 'PAUSED' ? 'Yes' : 'No',
              hint:
                String(getStatus(group)).toUpperCase() === 'PAUSED'
                  ? 'Group is manually paused'
                  : Boolean(group?.blockedByOverdue)
                    ? 'Group is blocked by overdue contributions'
                    : 'Operating normally'
            }
          ]}
        />
      </SectionCard>

      <div className="card" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} style={tabStyle(activeTab === tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {isLikelemba ? (
            <SectionCard title="Current Cycle Card" description="Use this first when support asks why a LIKELEMBA group is stuck.">
              <DetailGrid
                rows={[
                  { label: 'Round / Cycle', value: formatRoundCycleLabel(currentCycle, getCurrentRoundNumber(group), getCurrentCycleNumber(group)) },
                  { label: 'Beneficiary', value: pickFirst(currentCycle?.beneficiaryAccountReference, currentCycle?.beneficiary?.accountReference, currentCycle?.beneficiaryAccountId, '—') },
                  { label: 'Due Date', value: formatDateTime(pickFirst(currentCycle?.dueDate, currentCycle?.expectedDueDate)) },
                  { label: 'Status', value: <StatusBadge value={pickFirst(currentCycle?.status, 'UNKNOWN')} /> },
                  { label: 'Paid', value: formatCount(pickFirst(currentCycle?.paidContributionCount, group?.paidContributionCount)) },
                  { label: 'Pending', value: formatCount(pickFirst(currentCycle?.pendingContributionCount, group?.pendingContributionCount)) },
                  { label: 'Overdue', value: formatCount(pickFirst(currentCycle?.overdueContributionCount, group?.overdueContributionCount)) },
                  {
                    label: 'Blocked By Overdue',
                    value: Boolean(pickFirst(currentCycle?.blockedByOverdue, group?.blockedByOverdue, false)) ? 'Yes' : 'No',
                    hint: Boolean(pickFirst(currentCycle?.oldestOverdueDays, group?.oldestOverdueDays))
                      ? `Oldest overdue: ${pickFirst(currentCycle?.oldestOverdueDays, group?.oldestOverdueDays)} days`
                      : ''
                  }
                ]}
              />
            </SectionCard>
          ) : null}

          {isAvec ? (
            <SectionCard title="Treasury Summary" description="AVEC groups are treasury and governance driven.">
              <MetricStrip
                items={[
                  { label: 'Current Treasury Balance', value: formatMoney(getTreasuryBalance(group)), valueTone: '#0369a1' },
                  { label: 'Pending Withdrawal Requests', value: formatCount(treasuryWithdrawals.filter((item) => String(pickFirst(item?.status, '')).toUpperCase().includes('PENDING')).length) },
                  { label: 'Active Loans', value: formatCount(loans.filter((item) => String(pickFirst(item?.status, '')).toUpperCase() === 'ACTIVE').length) },
                  {
                    label: 'Overdue / Defaulted Loans',
                    value: formatCount(loans.filter((item) => ['OVERDUE', 'DEFAULTED'].includes(String(pickFirst(item?.status, '')).toUpperCase())).length),
                    valueTone: '#b91c1c'
                  }
                ]}
              />
            </SectionCard>
          ) : null}

          <SectionCard title="Operational Notes" description="Admin does not bypass customer flows. Use these views to inspect state and apply only supported corrective actions.">
            <div style={{ display: 'grid', gap: '0.35rem', color: 'var(--muted)', fontSize: '13px' }}>
              <div>Pause or resume is a group-level operational control and writes audit events.</div>
              <div>LIKELEMBA member removal stays simpler and setup-oriented. AVEC member removal is a governed workflow on the customer side.</div>
              <div>For AVEC, check member-removal policy, vote progress, and unresolved debt before describing a removal as complete.</div>
              <div>Admin override removal is separate from the owner governance flow and should be treated as an operational override.</div>
              <div>After every admin action, the page refreshes group detail and subresource state.</div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === 'members' ? (
        <SectionCard
          title="Members"
          description={
            isAvec
              ? 'AVEC owner removal is governance-based. This table keeps the admin override separate and still blocks removal when unresolved AVEC debt prevents exit.'
              : 'LIKELEMBA removal remains the simpler direct flow during allowed setup stages.'
          }
        >
          <DataTable showIndex={false} columns={membersColumns} rows={members} pageSize={100} emptyLabel="No members found" />
        </SectionCard>
      ) : null}

      {activeTab === 'cycles' ? (
        <SectionCard title="Cycles" description="LIKELEMBA is cycle-driven. Track beneficiary rotation and overdue blockers here.">
          <DataTable
            showIndex={false}
            pageSize={100}
            columns={[
              { key: 'cycleNumber', label: 'Round / Cycle', render: (row) => formatRoundCycleLabel(row) },
              { key: 'beneficiary', label: 'Beneficiary', render: (row) => pickFirst(row?.beneficiaryAccountReference, row?.beneficiary?.accountReference, row?.beneficiaryAccountId, '—') },
              { key: 'dueDate', label: 'Due Date', render: (row) => formatDateTime(pickFirst(row?.dueDate, row?.expectedDueDate)) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={pickFirst(row?.status, 'UNKNOWN')} /> },
              { key: 'paid', label: 'Paid', render: (row) => formatCount(row?.paidContributionCount) },
              { key: 'pending', label: 'Pending', render: (row) => formatCount(row?.pendingContributionCount) },
              { key: 'overdue', label: 'Overdue', render: (row) => formatCount(row?.overdueContributionCount) },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => {
                  const cycleId = getCycleId(row);
                  if (!cycleId) return '—';
                  return (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-neutral"
                        onClick={() =>
                          openInterventionModal({
                            actionKey: `reconcile-funding-${cycleId}`,
                            title: `Reconcile funding for ${formatRoundCycleLabel(row)}`,
                            successMessage: 'Cycle funding reconciled.',
                            run: (payload) => api.groupSavings.cycles.reconcileFunding(groupId, cycleId, payload)
                          })
                        }
                        disabled={Boolean(savingAction)}
                      >
                        Reconcile Funding
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() =>
                          openInterventionModal({
                            actionKey: `force-mark-funded-${cycleId}`,
                            title: `Force mark funded for ${formatRoundCycleLabel(row)}`,
                            successMessage: 'Cycle marked funded.',
                            run: (payload) => api.groupSavings.cycles.forceMarkFunded(groupId, cycleId, payload)
                          })
                        }
                        disabled={Boolean(savingAction)}
                      >
                        Force Mark Funded
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() =>
                          openInterventionModal({
                            actionKey: `release-payout-${cycleId}`,
                            title: `Release payout for ${formatRoundCycleLabel(row)}`,
                            successMessage: 'Payout release triggered.',
                            run: () => api.groupSavings.cycles.releasePayout(groupId, cycleId)
                          })
                        }
                        disabled={Boolean(savingAction)}
                      >
                        Release Payout
                      </button>
                      <button
                        type="button"
                        className="btn-neutral"
                        onClick={() =>
                          openInterventionModal({
                            actionKey: `repair-release-payout-${cycleId}`,
                            title: `Repair payout release for ${formatRoundCycleLabel(row)}`,
                            successMessage: 'Payout repair triggered.',
                            run: (payload) => api.groupSavings.cycles.repairReleasePayout(groupId, cycleId, payload)
                          })
                        }
                        disabled={Boolean(savingAction)}
                      >
                        Repair Payout
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() =>
                          openInterventionModal({
                            actionKey: `force-release-payout-${cycleId}`,
                            title: `Force release payout for ${formatRoundCycleLabel(row)}`,
                            successMessage: 'Force payout release triggered.',
                            run: (payload) => api.groupSavings.cycles.forceReleasePayout(groupId, cycleId, payload)
                          })
                        }
                        disabled={Boolean(savingAction)}
                      >
                        Force Release
                      </button>
                    </div>
                  );
                }
              }
            ]}
            rows={cycles}
            emptyLabel="No cycles found"
          />
        </SectionCard>
      ) : null}

      {activeTab === 'contributions' ? (
        <SectionCard title="Contributions" description="Use this table to answer why a group is stuck and who is overdue.">
          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Manual reminders only target unpaid members with <strong>PENDING</strong> contributions. Automatic reminders continue to run from the backend.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) auto auto', gap: '0.65rem', alignItems: 'end' }}>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="reminderCycle">Reminder cycle</label>
                <select
                  id="reminderCycle"
                  value={selectedReminderCycleKey}
                  onChange={(e) => {
                    setSelectedReminderCycleKey(e.target.value);
                    setSelectedReminderMemberIds([]);
                  }}
                  disabled={pendingContributionCycleOptions.length === 0}
                >
                  {pendingContributionCycleOptions.length === 0 ? <option value="">No unpaid contributions</option> : null}
                  {pendingContributionCycleOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label} · {option.pendingCount} unpaid
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn-neutral"
                onClick={() => handleRemindUnpaid()}
                disabled={!selectedReminderCycle?.cycleId || savingAction === 'remind-all-unpaid'}
              >
                {savingAction === 'remind-all-unpaid' ? 'Queueing…' : 'Remind All Unpaid'}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleRemindUnpaid({ memberIds: selectedReminderMemberIds })}
                disabled={!selectedReminderCycle?.cycleId || selectedReminderMemberIds.length === 0 || savingAction === 'remind-selected-unpaid'}
              >
                {savingAction === 'remind-selected-unpaid' ? 'Queueing…' : `Remind Selected (${selectedReminderMemberIds.length})`}
              </button>
            </div>
          </div>
          <DataTable
            showIndex={false}
            pageSize={100}
            columns={[
              {
                key: 'select',
                label: 'Select',
                render: (row) => {
                  const pending = isPendingContribution(row);
                  const cycleKey = getCycleReminderKey(row);
                  const memberId = String(getMemberId(row) || '');
                  const checked = pending && selectedReminderCycleKey === cycleKey && selectedReminderMemberIds.includes(memberId);
                  const disabled = !pending || (Boolean(selectedReminderCycleKey) && selectedReminderCycleKey !== cycleKey);
                  return (
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleReminderMemberSelection(row)}
                      aria-label={`Select ${pickFirst(row?.memberAccountReference, row?.accountReference, row?.memberAccountId, 'member')} for reminder`}
                    />
                  );
                }
              },
              { key: 'roundNumber', label: 'Round / Cycle', render: (row) => formatRoundCycleLabel(row, pickFirst(row?.groupRoundNumber, row?.currentRoundNumber), pickFirst(row?.groupCycleNumber, row?.currentCycleNumber)) },
              { key: 'member', label: 'Member / Account', render: (row) => pickFirst(row?.memberAccountReference, row?.accountReference, row?.member?.accountReference, row?.memberAccountId, '—') },
              { key: 'amountDue', label: 'Amount Due', render: (row) => formatMoney(pickFirst(row?.amountDue, row?.dueAmount)) },
              { key: 'amountPaid', label: 'Amount Paid', render: (row) => formatMoney(pickFirst(row?.amountPaid, row?.paidAmount)) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={pickFirst(row?.status, 'UNKNOWN')} /> },
              { key: 'dueDate', label: 'Due Date', render: (row) => formatDateTime(row?.dueDate) },
              { key: 'overdue', label: 'Overdue', render: (row) => (Boolean(pickFirst(row?.overdue, row?.isOverdue, false)) ? 'Yes' : 'No') },
              { key: 'daysOverdue', label: 'Days Overdue', render: (row) => formatCount(row?.daysOverdue) },
              { key: 'transactionId', label: 'Transaction ID', render: (row) => pickFirst(row?.transactionId, row?.transaction?.id, '—') },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => {
                  const pending = isPendingContribution(row);
                  const cycleId = getCycleId(row);
                  const memberId = getMemberId(row);
                  const contributionId = getContributionId(row);
                  const actionKey = `remind-member-${cycleId}-${memberId}`;
                  return (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {pending && cycleId && memberId ? (
                        <button
                          type="button"
                          className="btn-neutral"
                          onClick={() => handleRemindMember(row)}
                          disabled={savingAction === actionKey}
                        >
                          {savingAction === actionKey ? 'Queueing…' : 'Remind'}
                        </button>
                      ) : null}
                      {contributionId ? (
                        <>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() =>
                              openInterventionModal({
                                actionKey: `complete-contribution-${contributionId}`,
                                title: `Complete contribution ${contributionId}`,
                                successMessage: 'Contribution payment completed.',
                                run: (payload) => api.groupSavings.contributions.completePayment(groupId, contributionId, payload)
                              })
                            }
                            disabled={Boolean(savingAction)}
                          >
                            Complete Payment
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() =>
                              openInterventionModal({
                                actionKey: `force-fail-contribution-${contributionId}`,
                                title: `Force fail contribution ${contributionId}`,
                                successMessage: 'Contribution forced to failed.',
                                run: (payload) => api.groupSavings.contributions.forceFail(groupId, contributionId, payload)
                              })
                            }
                            disabled={Boolean(savingAction)}
                          >
                            Force Fail
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() =>
                              openInterventionModal({
                                actionKey: `force-cancel-contribution-${contributionId}`,
                                title: `Force cancel contribution ${contributionId}`,
                                successMessage: 'Contribution canceled.',
                                run: (payload) => api.groupSavings.contributions.forceCancel(groupId, contributionId, payload)
                              })
                            }
                            disabled={Boolean(savingAction)}
                          >
                            Force Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-neutral"
                            onClick={() =>
                              openInterventionModal({
                                actionKey: `reopen-contribution-${contributionId}`,
                                title: `Reopen contribution ${contributionId} for retry`,
                                successMessage: 'Contribution reopened for retry.',
                                run: (payload) => api.groupSavings.contributions.reopenForRetry(groupId, contributionId, payload)
                              })
                            }
                            disabled={Boolean(savingAction)}
                          >
                            Reopen Retry
                          </button>
                        </>
                      ) : !pending ? '—' : null}
                    </div>
                  );
                }
              }
            ]}
            rows={contributions}
            emptyLabel="No contributions found"
          />
        </SectionCard>
      ) : null}

      {activeTab === 'payouts' ? (
        <SectionCard title="Payouts" description="Payout history shows beneficiary, amount, status, and transaction linkage.">
          <DataTable
            showIndex={false}
            pageSize={100}
            columns={[
              {
                key: 'cycle',
                label: 'Round / Cycle',
                render: (row) => formatRoundCycleLabel(row, pickFirst(row?.cycle?.roundNumber), pickFirst(row?.cycle?.cycleNumber))
              },
              { key: 'beneficiary', label: 'Beneficiary', render: (row) => pickFirst(row?.beneficiaryAccountReference, row?.beneficiary?.accountReference, row?.beneficiaryAccountId, '—') },
              { key: 'amount', label: 'Amount', render: (row) => formatMoney(pickFirst(row?.amount, row?.payoutAmount)) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={pickFirst(row?.status, 'UNKNOWN')} /> },
              { key: 'transactionId', label: 'Transaction ID', render: (row) => pickFirst(row?.transactionId, row?.transaction?.id, '—') },
              { key: 'paidAt', label: 'Paid Date', render: (row) => formatDateTime(pickFirst(row?.paidAt, row?.createdAt)) },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => {
                  const payoutId = getPayoutId(row);
                  if (!payoutId) return '—';
                  return (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn-primary" onClick={() => openInterventionModal({
                        actionKey: `force-complete-payout-${payoutId}`,
                        title: `Force complete payout ${payoutId}`,
                        successMessage: 'Payout force-completed.',
                        run: (payload) => api.groupSavings.payouts.forceComplete(groupId, payoutId, payload)
                      })} disabled={Boolean(savingAction)}>Force Complete</button>
                      <button type="button" className="btn-danger" onClick={() => openInterventionModal({
                        actionKey: `force-fail-payout-${payoutId}`,
                        title: `Force fail payout ${payoutId}`,
                        successMessage: 'Payout force-failed.',
                        run: (payload) => api.groupSavings.payouts.forceFail(groupId, payoutId, payload)
                      })} disabled={Boolean(savingAction)}>Force Fail</button>
                      <button type="button" className="btn-danger" onClick={() => openInterventionModal({
                        actionKey: `force-cancel-payout-${payoutId}`,
                        title: `Force cancel payout ${payoutId}`,
                        successMessage: 'Payout force-canceled.',
                        run: (payload) => api.groupSavings.payouts.forceCancel(groupId, payoutId, payload)
                      })} disabled={Boolean(savingAction)}>Force Cancel</button>
                    </div>
                  );
                }
              }
            ]}
            rows={payouts}
            emptyLabel="No payouts found"
          />
        </SectionCard>
      ) : null}

      {activeTab === 'invitations' ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <SectionCard title="Create Invitation" description="Send a group invitation using one identifier only: account ID, account reference, email, or phone.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="inviteAccountId">Account ID</label>
                <input id="inviteAccountId" value={inviteDraft.accountId} onChange={(e) => setInviteDraft((prev) => ({ ...prev, accountId: e.target.value }))} placeholder="123" />
              </div>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="inviteAccountReference">Account reference</label>
                <input id="inviteAccountReference" value={inviteDraft.accountReference} onChange={(e) => setInviteDraft((prev) => ({ ...prev, accountReference: e.target.value }))} placeholder="ACC-12345" />
              </div>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="inviteEmail">Email</label>
                <input id="inviteEmail" value={inviteDraft.email} onChange={(e) => setInviteDraft((prev) => ({ ...prev, email: e.target.value }))} placeholder="user@example.com" />
              </div>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="invitePhone">Phone</label>
                <input id="invitePhone" value={inviteDraft.phone} onChange={(e) => setInviteDraft((prev) => ({ ...prev, phone: e.target.value }))} placeholder="+243..." />
              </div>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="inviteRotationOrder">Rotation order</label>
                <input id="inviteRotationOrder" type="number" value={inviteDraft.rotationOrder} onChange={(e) => setInviteDraft((prev) => ({ ...prev, rotationOrder: e.target.value }))} placeholder="4" />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-primary" onClick={handleCreateInvitation} disabled={savingAction === 'create-invitation'}>
                {savingAction === 'create-invitation' ? 'Sending…' : 'Create Invitation'}
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Invitations" description="Approve or inspect pending invitations from the admin owner-equivalent surface.">
            <DataTable
              showIndex={false}
              pageSize={100}
              columns={[
                { key: 'target', label: 'Target', render: (row) => pickFirst(row?.accountReference, row?.email, row?.phone, row?.accountId, '—') },
                { key: 'rotationOrder', label: 'Rotation Order', render: (row) => formatCount(row?.rotationOrder) },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={pickFirst(row?.status, 'UNKNOWN')} /> },
                { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row?.createdAt) },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => {
                    const invitationId = pickFirst(row?.id, row?.invitationId);
                    const isPending = String(pickFirst(row?.status, '')).toUpperCase() === 'PENDING';
                    const actionKey = `approve-invitation-${invitationId}`;
                    return isPending && invitationId ? (
                      <button type="button" className="btn-primary" onClick={() => handleApproveInvitation(invitationId)} disabled={savingAction === actionKey}>
                        {savingAction === actionKey ? 'Approving…' : 'Approve'}
                      </button>
                    ) : (
                      '—'
                    );
                  }
                }
              ]}
              rows={invitations}
              emptyLabel="No invitations found"
            />
          </SectionCard>

          <SectionCard title="Join Requests" description="Approve or reject incoming join requests with confirmation on reject.">
            <DataTable
              showIndex={false}
              pageSize={100}
              columns={[
                { key: 'requester', label: 'Requester', render: (row) => pickFirst(row?.accountReference, row?.email, row?.phone, row?.accountId, '—') },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={pickFirst(row?.status, 'UNKNOWN')} /> },
                { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row?.createdAt) },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => {
                    const requestId = pickFirst(row?.id, row?.invitationId);
                    const isPending = String(pickFirst(row?.status, '')).toUpperCase() === 'PENDING';
                    const approveKey = `approve-join-request-${requestId}`;
                    return isPending && requestId ? (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn-primary" onClick={() => handleJoinRequestAction(requestId, 'approve')} disabled={savingAction === approveKey}>
                          {savingAction === approveKey ? 'Approving…' : 'Approve'}
                        </button>
                        <button type="button" className="btn-danger" onClick={() => setConfirmAction({ type: 'reject-join-request', requestId })}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      '—'
                    );
                  }
                }
              ]}
              rows={joinRequests}
              emptyLabel="No join requests found"
            />
          </SectionCard>
        </div>
      ) : null}

      {activeTab === 'loans' && isAvec ? (
        <SectionCard title="Loans" description="Borrower debt, overdue state, and vote-sensitive AVEC lending visibility.">
          <DataTable
            showIndex={false}
            pageSize={100}
            columns={[
              { key: 'borrower', label: 'Borrower', render: (row) => pickFirst(row?.borrowerAccountReference, row?.borrower?.accountReference, row?.borrowerAccountId, '—') },
              { key: 'principal', label: 'Principal', render: (row) => formatMoney(pickFirst(row?.principal, row?.principalAmount)) },
              { key: 'interest', label: 'Interest', render: (row) => formatMoney(pickFirst(row?.interest, row?.interestAmount)) },
              { key: 'totalDue', label: 'Total Due', render: (row) => formatMoney(pickFirst(row?.totalDue, row?.amountDue)) },
              { key: 'dueDate', label: 'Due Date', render: (row) => formatDateTime(row?.dueDate) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={pickFirst(row?.status, 'UNKNOWN')} /> },
              { key: 'scheduled', label: 'Scheduled Repayments', render: (row) => formatCount(row?.scheduledRepaymentCount) },
              { key: 'paid', label: 'Paid Repayments', render: (row) => formatCount(row?.paidRepaymentCount) },
              { key: 'overdue', label: 'Overdue Repayments', render: (row) => formatCount(row?.overdueRepaymentCount) },
              { key: 'oldestOverdueDays', label: 'Oldest Overdue Days', render: (row) => formatCount(row?.oldestOverdueDays) },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => {
                  const loanId = getLoanId(row);
                  if (!loanId) return '—';
                  return (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => runDirectAction(`approve-loan-${loanId}`, () => api.groupSavings.loans.approve(groupId, loanId), 'Loan approved.', 'Failed to approve loan')}
                        disabled={Boolean(savingAction)}
                      >
                        {savingAction === `approve-loan-${loanId}` ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => runDirectAction(`disburse-loan-${loanId}`, () => api.groupSavings.loans.disburse(groupId, loanId), 'Loan disbursement triggered.', 'Failed to disburse loan')}
                        disabled={Boolean(savingAction)}
                      >
                        {savingAction === `disburse-loan-${loanId}` ? 'Disbursing…' : 'Disburse'}
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => runDirectAction(`reject-loan-${loanId}`, () => api.groupSavings.loans.reject(groupId, loanId), 'Loan rejected.', 'Failed to reject loan')}
                        disabled={Boolean(savingAction)}
                      >
                        {savingAction === `reject-loan-${loanId}` ? 'Rejecting…' : 'Reject'}
                      </button>
                      <button type="button" className="btn-neutral" onClick={() => openInterventionModal({
                        actionKey: `force-approve-loan-${loanId}`,
                        title: `Force approve loan ${loanId}`,
                        successMessage: 'Loan force-approved.',
                        run: (payload) => api.groupSavings.loans.forceApprove(groupId, loanId, payload)
                      })} disabled={Boolean(savingAction)}>Force Approve</button>
                      <button type="button" className="btn-neutral" onClick={() => openInterventionModal({
                        actionKey: `force-reject-loan-${loanId}`,
                        title: `Force reject loan ${loanId}`,
                        successMessage: 'Loan force-rejected.',
                        run: (payload) => api.groupSavings.loans.forceReject(groupId, loanId, payload)
                      })} disabled={Boolean(savingAction)}>Force Reject</button>
                      <button type="button" className="btn-neutral" onClick={() => openInterventionModal({
                        actionKey: `force-disburse-loan-${loanId}`,
                        title: `Force disburse loan ${loanId}`,
                        successMessage: 'Loan force-disbursed.',
                        run: (payload) => api.groupSavings.loans.forceDisburse(groupId, loanId, payload)
                      })} disabled={Boolean(savingAction)}>Force Disburse</button>
                    </div>
                  );
                }
              }
            ]}
            rows={loans}
            emptyLabel="No loans found"
          />
        </SectionCard>
      ) : null}

      {activeTab === 'repayments' && isAvec ? (
        <SectionCard title="Repayments" description="Review due dates, paid amounts, and overdue repayment state.">
          <DataTable
            showIndex={false}
            pageSize={100}
            columns={[
              { key: 'loan', label: 'Loan', render: (row) => pickFirst(row?.loanReference, row?.loanId, '—') },
              { key: 'borrower', label: 'Borrower', render: (row) => pickFirst(row?.borrowerAccountReference, row?.borrower?.accountReference, row?.borrowerAccountId, '—') },
              { key: 'sequence', label: 'Installment', render: (row) => pickFirst(row?.installmentSequence, row?.sequenceNumber, '—') },
              { key: 'dueDate', label: 'Due Date', render: (row) => formatDateTime(row?.dueDate) },
              { key: 'amountDue', label: 'Amount Due', render: (row) => formatMoney(pickFirst(row?.amountDue, row?.dueAmount)) },
              { key: 'amountPaid', label: 'Amount Paid', render: (row) => formatMoney(pickFirst(row?.amountPaid, row?.paidAmount)) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={pickFirst(row?.status, 'UNKNOWN')} /> },
              { key: 'overdue', label: 'Overdue', render: (row) => (Boolean(pickFirst(row?.overdue, row?.isOverdue, false)) ? 'Yes' : 'No') },
              { key: 'daysOverdue', label: 'Days Overdue', render: (row) => formatCount(row?.daysOverdue) },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => {
                  const loanId = getLoanId(row);
                  const repaymentId = getRepaymentId(row);
                  if (!loanId || !repaymentId) return '—';
                  return (
                    <button type="button" className="btn-primary" onClick={() => openInterventionModal({
                      actionKey: `complete-repayment-${repaymentId}`,
                      title: `Complete repayment ${repaymentId}`,
                      successMessage: 'Repayment payment completed.',
                      run: (payload) => api.groupSavings.loans.completeRepaymentPayment(groupId, loanId, repaymentId, payload)
                    })} disabled={Boolean(savingAction)}>
                      Complete Payment
                    </button>
                  );
                }
              }
            ]}
            rows={repayments}
            emptyLabel="No repayments found"
          />
        </SectionCard>
      ) : null}

      {activeTab === 'treasury' && isAvec ? (
        <SectionCard title="Treasury Withdrawals" description="Track requester, governance progress, and payout completion state.">
          <DataTable
            showIndex={false}
            pageSize={100}
            columns={[
              { key: 'requester', label: 'Requester', render: (row) => pickFirst(row?.requesterAccountReference, row?.requester?.accountReference, row?.requesterAccountId, '—') },
              { key: 'amount', label: 'Amount', render: (row) => formatMoney(pickFirst(row?.amount, row?.withdrawalAmount)) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={pickFirst(row?.status, 'UNKNOWN')} /> },
              { key: 'approvalCount', label: 'Approvals', render: (row) => `${formatCount(row?.approvalCount)} / ${formatCount(row?.requiredApprovals)}` },
              { key: 'paidAt', label: 'Paid Date', render: (row) => formatDateTime(pickFirst(row?.paidAt, row?.completedAt)) },
              { key: 'transactionReference', label: 'Transaction Ref', render: (row) => pickFirst(row?.transactionReference, row?.transactionId, '—') },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => {
                  const withdrawalId = getTreasuryWithdrawalId(row);
                  if (!withdrawalId) return '—';
                  return (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() =>
                          runDirectAction(
                            `approve-withdrawal-${withdrawalId}`,
                            () => api.groupSavings.treasuryWithdrawals.approve(groupId, withdrawalId),
                            'Treasury withdrawal approved.',
                            'Failed to approve withdrawal'
                          )
                        }
                        disabled={Boolean(savingAction)}
                      >
                        {savingAction === `approve-withdrawal-${withdrawalId}` ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() =>
                          runDirectAction(
                            `disburse-withdrawal-${withdrawalId}`,
                            () => api.groupSavings.treasuryWithdrawals.disburse(groupId, withdrawalId),
                            'Treasury withdrawal disbursement triggered.',
                            'Failed to disburse withdrawal'
                          )
                        }
                        disabled={Boolean(savingAction)}
                      >
                        {savingAction === `disburse-withdrawal-${withdrawalId}` ? 'Disbursing…' : 'Disburse'}
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() =>
                          runDirectAction(
                            `reject-withdrawal-${withdrawalId}`,
                            () => api.groupSavings.treasuryWithdrawals.reject(groupId, withdrawalId),
                            'Treasury withdrawal rejected.',
                            'Failed to reject withdrawal'
                          )
                        }
                        disabled={Boolean(savingAction)}
                      >
                        {savingAction === `reject-withdrawal-${withdrawalId}` ? 'Rejecting…' : 'Reject'}
                      </button>
                      <button type="button" className="btn-neutral" onClick={() => openInterventionModal({
                        actionKey: `force-approve-withdrawal-${withdrawalId}`,
                        title: `Force approve treasury withdrawal ${withdrawalId}`,
                        successMessage: 'Treasury withdrawal force-approved.',
                        run: (payload) => api.groupSavings.treasuryWithdrawals.forceApprove(groupId, withdrawalId, payload)
                      })} disabled={Boolean(savingAction)}>Force Approve</button>
                      <button type="button" className="btn-neutral" onClick={() => openInterventionModal({
                        actionKey: `force-reject-withdrawal-${withdrawalId}`,
                        title: `Force reject treasury withdrawal ${withdrawalId}`,
                        successMessage: 'Treasury withdrawal force-rejected.',
                        run: (payload) => api.groupSavings.treasuryWithdrawals.forceReject(groupId, withdrawalId, payload)
                      })} disabled={Boolean(savingAction)}>Force Reject</button>
                      <button type="button" className="btn-neutral" onClick={() => openInterventionModal({
                        actionKey: `force-disburse-withdrawal-${withdrawalId}`,
                        title: `Force disburse treasury withdrawal ${withdrawalId}`,
                        successMessage: 'Treasury withdrawal force-disbursed.',
                        run: (payload) => api.groupSavings.treasuryWithdrawals.forceDisburse(groupId, withdrawalId, payload)
                      })} disabled={Boolean(savingAction)}>Force Disburse</button>
                      <button type="button" className="btn-neutral" onClick={() => openInterventionModal({
                        actionKey: `repair-disbursement-withdrawal-${withdrawalId}`,
                        title: `Repair treasury disbursement ${withdrawalId}`,
                        successMessage: 'Treasury disbursement repair triggered.',
                        run: (payload) => api.groupSavings.treasuryWithdrawals.repairDisbursement(groupId, withdrawalId, payload)
                      })} disabled={Boolean(savingAction)}>Repair Disbursement</button>
                    </div>
                  );
                }
              }
            ]}
            rows={treasuryWithdrawals}
            emptyLabel="No treasury withdrawals found"
          />
        </SectionCard>
      ) : null}

      {activeTab === 'policy' && isAvec ? (
        <SectionCard title="AVEC Policy" description="Dedicated form for policy management. AVEC behavior depends heavily on these thresholds and rules.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="loanApprovalThresholdPercent">Loan approval threshold (%)</label>
              <input id="loanApprovalThresholdPercent" type="number" value={policyDraft.loanApprovalThresholdPercent} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, loanApprovalThresholdPercent: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="treasuryWithdrawalApprovalThresholdPercent">Treasury withdrawal threshold (%)</label>
              <input id="treasuryWithdrawalApprovalThresholdPercent" type="number" value={policyDraft.treasuryWithdrawalApprovalThresholdPercent} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, treasuryWithdrawalApprovalThresholdPercent: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="loanInterestPercentage">Loan interest percentage</label>
              <input id="loanInterestPercentage" type="number" value={policyDraft.loanInterestPercentage} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, loanInterestPercentage: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="defaultAfterDays">Default after days</label>
              <input id="defaultAfterDays" type="number" value={policyDraft.defaultAfterDays} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, defaultAfterDays: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gap: '0.25rem', gridColumn: '1 / -1' }}>
              <label htmlFor="defaultRulesText">Default rules text</label>
              <textarea id="defaultRulesText" rows={4} value={policyDraft.defaultRulesText} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, defaultRulesText: e.target.value }))} />
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input type="checkbox" checked={policyDraft.allowMultipleActiveLoans} onChange={(e) => setPolicyDraft((prev) => ({ ...prev, allowMultipleActiveLoans: e.target.checked }))} />
              Allow multiple active loans
            </label>
          </div>

          {policyWarnings.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              {policyWarnings.map((warning) => (
                <div key={warning} style={{ color: '#b45309', fontWeight: 600 }}>
                  {warning}
                </div>
              ))}
            </div>
          ) : null}

          <DetailGrid
            rows={[
              { label: 'Current Loan Approval Threshold', value: pickFirst(policy?.loanApprovalThresholdPercent, policy?.loanApprovalThreshold, '—') },
              {
                label: 'Current Treasury Withdrawal Threshold',
                value: pickFirst(policy?.treasuryWithdrawalApprovalThresholdPercent, policy?.treasuryWithdrawalApprovalThreshold, '—')
              },
              { label: 'Current Loan Interest', value: pickFirst(policy?.loanInterestPercentage, policy?.loanInterestPercent, '—') },
              { label: 'Current Default After Days', value: pickFirst(policy?.defaultAfterDays, '—') }
            ]}
          />

          <SectionCard
            title="Member Removal Governance"
            description="AVEC member removal is not an immediate owner delete. Use these settings to understand whether removal needs votes or owner approval."
          >
            <DetailGrid
              rows={[
                {
                  label: 'Member Removal Approval Threshold',
                  value: pickFirst(policy?.memberRemovalApprovalThresholdPercent, '—')
                },
                {
                  label: 'Member Removal Approval Mode',
                  value: humanizeEnum(pickFirst(policy?.memberRemovalApprovalMode, '—'))
                },
                {
                  label: 'Enable Member Removal Vote Deadline',
                  value: pickFirst(policy?.memberRemovalVoteWindowEnabled, null) === null ? '—' : (policy?.memberRemovalVoteWindowEnabled ? 'Yes' : 'No')
                },
                {
                  label: 'Member Removal Vote Window',
                  value:
                    pickFirst(policy?.memberRemovalVoteWindowHours, null) === null
                      ? '—'
                      : `${pickFirst(policy?.memberRemovalVoteWindowHours, 0)} hours`
                },
                {
                  label: 'Member Removal Voter Scope',
                  value: humanizeEnum(pickFirst(policy?.memberRemovalVoteEligibilityScope, '—'))
                }
              ]}
            />
            <div style={{ display: 'grid', gap: '0.35rem', color: 'var(--muted)', fontSize: '13px' }}>
              <div>Threshold: percentage of eligible approvals required to remove a member.</div>
              <div>Approval mode: whether removal is decided by voting or direct owner approval.</div>
              <div>Vote window: how long members have to vote before the request expires or is rejected.</div>
            </div>
          </SectionCard>

          <SectionCard
            title="Policy Change Requests"
            description="Requested AVEC policy changes can be canceled here when ops needs to stop a pending governance change."
          >
            <DataTable
              showIndex={false}
              pageSize={100}
              columns={[
                { key: 'id', label: 'Change ID', render: (row) => pickFirst(row?.id, row?.policyChangeId, '—') },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={pickFirst(row?.status, 'UNKNOWN')} /> },
                { key: 'requestedAt', label: 'Requested', render: (row) => formatDateTime(pickFirst(row?.requestedAt, row?.createdAt)) },
                { key: 'summary', label: 'Summary', render: (row) => pickFirst(row?.summary, row?.description, humanizeEnum(pickFirst(row?.changeType, row?.type, 'POLICY_CHANGE'))) },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => {
                    const policyChangeId = pickFirst(row?.id, row?.policyChangeId);
                    const status = String(pickFirst(row?.status, '')).toUpperCase();
                    if (!policyChangeId || !status.includes('REQUEST')) return '—';
                    return (
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => openInterventionModal({
                          actionKey: `cancel-policy-change-${policyChangeId}`,
                          title: `Cancel policy change ${policyChangeId}`,
                          successMessage: 'Policy change canceled.',
                          run: (payload) => api.groupSavings.policyChanges.cancel(groupId, policyChangeId, payload)
                        })}
                        disabled={Boolean(savingAction)}
                      >
                        Cancel Change
                      </button>
                    );
                  }
                }
              ]}
              rows={policyChanges}
              emptyLabel="No policy changes found"
            />
          </SectionCard>

          <SectionCard
            title="Settlement Controls"
            description="Use these only for end-of-round repair or deficit handling. Every action requires an operator reason."
          >
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn-primary" onClick={() => openInterventionModal({
                actionKey: 'settlement-distribute',
                title: 'Distribute settlement',
                successMessage: 'Settlement distribution triggered.',
                run: (payload) => api.groupSavings.settlements.distribute(groupId, payload)
              })} disabled={Boolean(savingAction)}>Distribute</button>
              <button type="button" className="btn-neutral" onClick={() => openInterventionModal({
                actionKey: 'settlement-force-distribute',
                title: 'Force distribute settlement',
                successMessage: 'Force settlement distribution triggered.',
                run: (payload) => api.groupSavings.settlements.forceDistribute(groupId, payload)
              })} disabled={Boolean(savingAction)}>Force Distribute</button>
              <button type="button" className="btn-danger" onClick={() => openInterventionModal({
                actionKey: 'settlement-close-deficit',
                title: 'Close settlement with deficit',
                successMessage: 'Settlement close-with-deficit triggered.',
                run: (payload) => api.groupSavings.settlements.closeWithDeficit(groupId, payload)
              })} disabled={Boolean(savingAction)}>Close With Deficit</button>
              <button type="button" className="btn-danger" onClick={() => openInterventionModal({
                actionKey: 'settlement-force-close-deficit',
                title: 'Force close settlement with deficit',
                successMessage: 'Force close-with-deficit triggered.',
                run: (payload) => api.groupSavings.settlements.forceCloseWithDeficit(groupId, payload)
              })} disabled={Boolean(savingAction)}>Force Close Deficit</button>
            </div>
          </SectionCard>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-primary" onClick={handleSavePolicy} disabled={savingAction === 'save-policy'}>
              {savingAction === 'save-policy' ? 'Saving…' : 'Save Policy'}
            </button>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === 'messages' ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <SectionCard title="Send Message" description="Admin can send an operational group message through the owner-equivalent group message surface.">
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="groupMessage">Message</label>
                <textarea id="groupMessage" rows={4} value={messageDraft.message} onChange={(e) => setMessageDraft({ message: e.target.value })} placeholder="Please complete your contributions this week." />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-primary" onClick={handleCreateMessage} disabled={savingAction === 'create-message'}>
                  {savingAction === 'create-message' ? 'Sending…' : 'Send Message'}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Messages" description="Latest group messages. Delete remains behind confirmation because it removes a live event resource.">
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {messages.length === 0 ? <div style={{ color: 'var(--muted)' }}>No messages found.</div> : null}
              {messages.map((message, index) => {
                const eventId = pickFirst(message?.id, message?.eventId, `${index}`);
                const actionKey = `delete-message-${eventId}`;
                return (
                  <div key={eventId} className="card" style={{ padding: '0.8rem', display: 'grid', gap: '0.45rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{formatDateTime(pickFirst(message?.createdAt, message?.timestamp))}</div>
                      <button type="button" className="btn-danger" onClick={() => setConfirmAction({ type: 'delete-message', eventId })} disabled={savingAction === actionKey}>
                        {savingAction === actionKey ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                    <div style={{ fontWeight: 700 }}>{pickFirst(message?.message, message?.body, message?.content, '—')}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                      {pickFirst(message?.actorAccountReference, message?.actor, message?.createdByAccountId, 'System')}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === 'audit' ? (
        <SectionCard title="Audit Timeline" description="Reverse chronological event history for disputes, stuck groups, and support explanations.">
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {auditEvents.length === 0 ? <div style={{ color: 'var(--muted)' }}>No audit events found.</div> : null}
            {auditEvents
              .slice()
              .sort((a, b) => new Date(pickFirst(b?.createdAt, b?.timestamp, 0)).getTime() - new Date(pickFirst(a?.createdAt, a?.timestamp, 0)).getTime())
              .map((event, index) => (
                <div key={pickFirst(event?.id, `${pickFirst(event?.eventType, 'event')}-${index}`)} className="card" style={{ padding: '0.8rem', display: 'grid', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <StatusBadge value={pickFirst(event?.eventType, event?.type, 'EVENT')} />
                      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{formatDateTime(pickFirst(event?.createdAt, event?.timestamp))}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                        Round {formatCount(getRoundNumber(event))}
                      </div>
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{pickFirst(event?.actorAccountReference, event?.actorAccountId, event?.actor, 'System')}</div>
                  </div>
                  <div style={{ fontWeight: 700 }}>{pickFirst(event?.summary, event?.description, humanizeEnum(pickFirst(event?.eventType, event?.type, '')))}</div>
                  <details>
                    <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 700 }}>View payload</summary>
                    <pre style={{ margin: '0.65rem 0 0', overflow: 'auto', background: 'color-mix(in srgb, var(--surface) 96%, var(--bg) 4%)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      {JSON.stringify(pickFirst(event?.payload, event?.metadata, event), null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
          </div>
        </SectionCard>
      ) : null}

      {interventionConfig ? (
        <AdminModal
          title={interventionConfig.title || 'Group saving intervention'}
          onClose={() => {
            if (Boolean(savingAction)) return;
            setInterventionConfig(null);
            setInterventionDraft(emptyInterventionDraft);
          }}
          width={720}
        >
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Reason is required for all admin overrides, repairs, and reconciliation actions. Add provider evidence in the optional fields when you are completing or reconciling linked transactions.
            </div>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="groupInterventionReason">Reason</label>
              <input
                id="groupInterventionReason"
                value={interventionDraft.reason}
                onChange={(e) => setInterventionDraft((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Manual reconciliation"
              />
            </div>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="groupInterventionNote">Note</label>
              <textarea
                id="groupInterventionNote"
                rows={3}
                value={interventionDraft.note}
                onChange={(e) => setInterventionDraft((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Ops override after provider investigation"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="groupInterventionExternalReference">External reference</label>
                <input
                  id="groupInterventionExternalReference"
                  value={interventionDraft.externalReference}
                  onChange={(e) => setInterventionDraft((prev) => ({ ...prev, externalReference: e.target.value }))}
                  placeholder="PROVIDER-123"
                />
              </div>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="groupInterventionCompletionNote">Completion note</label>
                <input
                  id="groupInterventionCompletionNote"
                  value={interventionDraft.completionNote}
                  onChange={(e) => setInterventionDraft((prev) => ({ ...prev, completionNote: e.target.value }))}
                  placeholder="Marked complete from provider dashboard"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn-neutral" onClick={() => setInterventionConfig(null)} disabled={Boolean(savingAction)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={runIntervention} disabled={Boolean(savingAction)}>
                {Boolean(savingAction) ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </AdminModal>
      ) : null}

      {confirmAction ? (
        <AdminModal
          title={
            confirmAction.type === 'activate'
              ? 'Activate group saving?'
              : confirmAction.type === 'pause'
              ? 'Pause group saving?'
              : confirmAction.type === 'restart'
                ? 'Restart group saving?'
              : confirmAction.type === 'resume'
                ? 'Resume group saving?'
                : confirmAction.type === 'delete-group'
                  ? 'Delete group?'
                  : confirmAction.type === 'reject-join-request'
                    ? 'Reject join request?'
                    : confirmAction.type === 'delete-message'
                      ? 'Delete message?'
                : confirmAction.type === 'restore-group'
                  ? 'Restore group?'
                  : 'Remove member?'
          }
          onClose={() => setConfirmAction(null)}
          width={560}
        >
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              {confirmAction.type === 'activate'
                ? 'Activate this draft group so it can start operating under the normal customer lifecycle rules.'
                : confirmAction.type === 'pause'
                ? 'Pausing blocks contribution payment until the group is resumed. The backend writes an audit event for traceability.'
                : confirmAction.type === 'restart'
                  ? 'Restarting creates a new round for this completed group. Historical rounds remain in place.'
                  : confirmAction.type === 'resume'
                  ? 'Resuming re-enables normal group activity and contribution payment. The backend writes an audit event for traceability.'
                  : confirmAction.type === 'delete-group'
                    ? 'Delete the group from the active admin view. This uses the group-savings lifecycle delete surface, so keep it behind explicit confirmation.'
                    : confirmAction.type === 'reject-join-request'
                      ? 'Reject this join request? The requester will not be added to the group.'
                      : confirmAction.type === 'delete-message'
                        ? 'Delete this group message event? This removes it from the admin-visible message history.'
                    : confirmAction.type === 'restore-group'
                    ? 'This will make the soft-deleted group visible again.'
                    : isAvec
                      ? 'This is an admin override removal. The owner-governed AVEC member-removal flow is separate and policy-based.'
                      : 'Remove this member from the group if allowed by policy and debt state?'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn-neutral" onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
              {confirmAction.type === 'activate' ? (
                <button type="button" className="btn-primary" onClick={() => handleLifecycleAction('activate')} disabled={savingAction === 'activate'}>
                  {savingAction === 'activate' ? 'Activating…' : 'Activate Group'}
                </button>
              ) : null}
              {confirmAction.type === 'pause' ? (
                <button type="button" className="btn-danger" onClick={() => handlePauseResume('pause')} disabled={savingAction === 'pause'}>
                  {savingAction === 'pause' ? 'Pausing…' : 'Pause'}
                </button>
              ) : null}
              {confirmAction.type === 'restart' ? (
                <button type="button" className="btn-primary" onClick={() => handleLifecycleAction('restart')} disabled={savingAction === 'restart'}>
                  {savingAction === 'restart' ? 'Restarting…' : 'Restart Group'}
                </button>
              ) : null}
              {confirmAction.type === 'resume' ? (
                <button type="button" className="btn-primary" onClick={() => handlePauseResume('resume')} disabled={savingAction === 'resume'}>
                  {savingAction === 'resume' ? 'Resuming…' : 'Resume'}
                </button>
              ) : null}
              {confirmAction.type === 'remove-member' ? (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => handleRemoveMember(confirmAction.member)}
                  disabled={savingAction === `remove-member-${confirmAction.member?.id}`}
                >
                  {savingAction === `remove-member-${confirmAction.member?.id}` ? 'Removing…' : isAvec ? 'Admin Override Remove' : 'Remove Member'}
                </button>
              ) : null}
              {confirmAction.type === 'restore-group' ? (
                <button type="button" className="btn-primary" onClick={handleRestoreGroup} disabled={savingAction === 'restore-group'}>
                  {savingAction === 'restore-group' ? 'Restoring…' : 'Restore'}
                </button>
              ) : null}
              {confirmAction.type === 'reject-join-request' ? (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => handleJoinRequestAction(confirmAction.requestId, 'reject')}
                  disabled={savingAction === `reject-join-request-${confirmAction.requestId}`}
                >
                  {savingAction === `reject-join-request-${confirmAction.requestId}` ? 'Rejecting…' : 'Reject Join Request'}
                </button>
              ) : null}
              {confirmAction.type === 'delete-message' ? (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => handleDeleteMessage(confirmAction.eventId)}
                  disabled={savingAction === `delete-message-${confirmAction.eventId}`}
                >
                  {savingAction === `delete-message-${confirmAction.eventId}` ? 'Deleting…' : 'Delete Message'}
                </button>
              ) : null}
              {confirmAction.type === 'delete-group' ? (
                <button type="button" className="btn-danger" onClick={() => handleLifecycleAction('delete-group')} disabled={savingAction === 'delete-group'}>
                  {savingAction === 'delete-group' ? 'Deleting…' : 'Delete Group'}
                </button>
              ) : null}
            </div>
          </div>
        </AdminModal>
      ) : null}
    </div>
  );
}
