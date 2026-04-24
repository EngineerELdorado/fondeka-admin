'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/DataTable';
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
const getRoundNumber = (row) => pickFirst(row?.roundNumber, row?.round?.number);
const getCycleNumber = (row) => pickFirst(row?.cycleNumber, row?.cycle?.cycleNumber);
const formatRoundCycleLabel = (row, fallbackRound, fallbackCycle) => {
  const round = pickFirst(getRoundNumber(row), fallbackRound);
  const cycle = pickFirst(getCycleNumber(row), fallbackCycle);
  if ((round === null || round === undefined || round === '') && (cycle === null || cycle === undefined || cycle === '')) return '—';
  return `Round ${formatCount(round)} · Cycle ${formatCount(cycle)}`;
};

export default function GroupSavingDetailPage() {
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
  const [policy, setPolicy] = useState(null);
  const [policyDraft, setPolicyDraft] = useState(emptyPolicyForm);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [savingAction, setSavingAction] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const isAvec = getType(group) === 'AVEC';
  const isLikelemba = getType(group) === 'LIKELEMBA';

  const tabs = useMemo(() => {
    const base = [
      { key: 'overview', label: 'Overview' },
      { key: 'members', label: 'Members' },
      { key: 'cycles', label: 'Cycles' },
      { key: 'contributions', label: 'Contributions' },
      { key: 'payouts', label: 'Payouts' }
    ];
    if (isAvec) {
      base.push({ key: 'loans', label: 'Loans' });
      base.push({ key: 'repayments', label: 'Repayments' });
      base.push({ key: 'treasury', label: 'Treasury Withdrawals' });
      base.push({ key: 'policy', label: 'Policy' });
    }
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
        api.groupSavings.policy.get(groupId)
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
            Remove
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
          </div>
        }
      >
        <DetailGrid
          rows={[
            { label: 'Reference', value: getReference(group) || '—' },
            { label: 'Group Name', value: getName(group) || '—' },
            { label: 'Creator', value: getCreator(group) || '—' },
            { label: 'Created Date', value: formatDateTime(getCreatedAt(group)) },
            { label: 'Current Round Number', value: formatCount(getCurrentRoundNumber(group)) }
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
              <div>Member removal is allowed only when the member is active and not blocked by unresolved AVEC debt.</div>
              <div>After every admin action, the page refreshes group detail and subresource state.</div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === 'members' ? (
        <SectionCard title="Members" description="Removal is blocked when unresolved AVEC debt prevents exit.">
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
              { key: 'overdue', label: 'Overdue', render: (row) => formatCount(row?.overdueContributionCount) }
            ]}
            rows={cycles}
            emptyLabel="No cycles found"
          />
        </SectionCard>
      ) : null}

      {activeTab === 'contributions' ? (
        <SectionCard title="Contributions" description="Use this table to answer why a group is stuck and who is overdue.">
          <DataTable
            showIndex={false}
            pageSize={100}
            columns={[
              { key: 'roundNumber', label: 'Round / Cycle', render: (row) => formatRoundCycleLabel(row, pickFirst(row?.groupRoundNumber, row?.currentRoundNumber), pickFirst(row?.groupCycleNumber, row?.currentCycleNumber)) },
              { key: 'member', label: 'Member / Account', render: (row) => pickFirst(row?.memberAccountReference, row?.accountReference, row?.member?.accountReference, row?.memberAccountId, '—') },
              { key: 'amountDue', label: 'Amount Due', render: (row) => formatMoney(pickFirst(row?.amountDue, row?.dueAmount)) },
              { key: 'amountPaid', label: 'Amount Paid', render: (row) => formatMoney(pickFirst(row?.amountPaid, row?.paidAmount)) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={pickFirst(row?.status, 'UNKNOWN')} /> },
              { key: 'dueDate', label: 'Due Date', render: (row) => formatDateTime(row?.dueDate) },
              { key: 'overdue', label: 'Overdue', render: (row) => (Boolean(pickFirst(row?.overdue, row?.isOverdue, false)) ? 'Yes' : 'No') },
              { key: 'daysOverdue', label: 'Days Overdue', render: (row) => formatCount(row?.daysOverdue) },
              { key: 'transactionId', label: 'Transaction ID', render: (row) => pickFirst(row?.transactionId, row?.transaction?.id, '—') }
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
              { key: 'paidAt', label: 'Paid Date', render: (row) => formatDateTime(pickFirst(row?.paidAt, row?.createdAt)) }
            ]}
            rows={payouts}
            emptyLabel="No payouts found"
          />
        </SectionCard>
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
              { key: 'oldestOverdueDays', label: 'Oldest Overdue Days', render: (row) => formatCount(row?.oldestOverdueDays) }
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
              { key: 'daysOverdue', label: 'Days Overdue', render: (row) => formatCount(row?.daysOverdue) }
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
              { key: 'transactionReference', label: 'Transaction Ref', render: (row) => pickFirst(row?.transactionReference, row?.transactionId, '—') }
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

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-primary" onClick={handleSavePolicy} disabled={savingAction === 'save-policy'}>
              {savingAction === 'save-policy' ? 'Saving…' : 'Save Policy'}
            </button>
          </div>
        </SectionCard>
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

      {confirmAction ? (
        <AdminModal
          title={
            confirmAction.type === 'pause'
              ? 'Pause group saving?'
              : confirmAction.type === 'resume'
                ? 'Resume group saving?'
                : 'Remove member?'
          }
          onClose={() => setConfirmAction(null)}
          width={560}
        >
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              {confirmAction.type === 'pause'
                ? 'Pausing blocks contribution payment until the group is resumed. The backend writes an audit event for traceability.'
                : confirmAction.type === 'resume'
                  ? 'Resuming re-enables normal group activity and contribution payment. The backend writes an audit event for traceability.'
                  : 'Remove this member from the group if allowed by policy and debt state?'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn-neutral" onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
              {confirmAction.type === 'pause' ? (
                <button type="button" className="btn-danger" onClick={() => handlePauseResume('pause')} disabled={savingAction === 'pause'}>
                  {savingAction === 'pause' ? 'Pausing…' : 'Pause'}
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
                  {savingAction === `remove-member-${confirmAction.member?.id}` ? 'Removing…' : 'Remove Member'}
                </button>
              ) : null}
            </div>
          </div>
        </AdminModal>
      ) : null}
    </div>
  );
}
