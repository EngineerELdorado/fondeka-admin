'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import {
  SavingsPageHeader,
  SavingsSubnav,
  SectionCard,
  StatusBadge,
  TypeBadge,
  formatCount,
  formatDate,
  formatMoney,
  pickFirst
} from '@/components/SavingsAdmin';
import { api } from '@/lib/api';

const emptyFilters = {
  reference: '',
  status: '',
  type: '',
  createdByAccountId: '',
  memberAccountId: ''
};

const getGroupId = (row) => pickFirst(row?.id, row?.groupSavingId);
const getGroupReference = (row) => pickFirst(row?.reference, row?.internalReference);
const getGroupName = (row) => pickFirst(row?.name, row?.groupName);
const getGroupType = (row) => String(pickFirst(row?.type, row?.groupType, 'UNKNOWN')).toUpperCase();
const getGroupStatus = (row) => pickFirst(row?.status, row?.groupStatus, 'UNKNOWN');
const getCreatorAccount = (row) => pickFirst(row?.createdByAccountId, row?.creatorAccountId, row?.creator?.accountId);
const getTreasuryBalance = (row) => pickFirst(row?.treasuryBalance, row?.currentTreasuryBalance);
const getCurrentRoundNumber = (row) => pickFirst(row?.currentRoundNumber, row?.roundNumber);

export default function GroupSavingsPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (String(value || '').trim()) params.set(key, String(value).trim());
      });
      const res = await api.groupSavings.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list);
      setTotalPages(Math.max(1, Number(res?.totalPages) || 1));
      setTotalElements(Number(res?.totalElements) || list.length);
    } catch (err) {
      setError(err?.message || 'Failed to load group savings');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleCounts = useMemo(() => {
    const likelemba = rows.filter((row) => getGroupType(row) === 'LIKELEMBA').length;
    const avec = rows.filter((row) => getGroupType(row) === 'AVEC').length;
    return { likelemba, avec };
  }, [rows]);

  const columns = useMemo(
    () => [
      {
        key: 'reference',
        label: 'Group',
        render: (row) => (
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <div style={{ fontWeight: 700 }}>{getGroupReference(row) || `Group ${getGroupId(row)}`}</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{getGroupName(row) || '—'}</div>
          </div>
        )
      },
      { key: 'type', label: 'Type', render: (row) => <TypeBadge value={getGroupType(row)} /> },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge value={getGroupStatus(row)} /> },
      { key: 'creator', label: 'Creator Account', render: (row) => getCreatorAccount(row) || '—' },
      { key: 'activeMembers', label: 'Active Members', render: (row) => formatCount(pickFirst(row?.activeMemberCount, row?.memberCount)) },
      {
        key: 'cycle',
        label: 'Current Round / Cycle',
        render: (row) => {
          const round = getCurrentRoundNumber(row);
          const cycle = pickFirst(row?.currentCycleNumber, row?.cycleNumber);
          if ((round === null || round === undefined || round === '') && (cycle === null || cycle === undefined || cycle === '')) return '—';
          return `Round ${formatCount(round)} · Cycle ${formatCount(cycle)}`;
        }
      },
      { key: 'pending', label: 'Pending Contributions', render: (row) => formatCount(row?.pendingContributionCount) },
      { key: 'paid', label: 'Paid Contributions', render: (row) => formatCount(row?.paidContributionCount) },
      { key: 'overdue', label: 'Overdue Contributions', render: (row) => formatCount(row?.overdueContributionCount) },
      { key: 'treasuryBalance', label: 'Treasury Balance', render: (row) => (getGroupType(row) === 'AVEC' ? formatMoney(getTreasuryBalance(row)) : '—') },
      { key: 'createdAt', label: 'Created', render: (row) => formatDate(pickFirst(row?.createdAt, row?.createdDate)) },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <Link href={`/dashboard/savings/groups/${encodeURIComponent(getGroupId(row))}`} className="btn-neutral" style={{ textDecoration: 'none' }}>
            Open
          </Link>
        )
      }
    ],
    []
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SavingsSubnav />
      <SavingsPageHeader
        title="Group Savings"
        description="Search and inspect group savings with clear separation between LIKELEMBA and AVEC. Group detail is the main operations screen for members, cycles, contributions, payouts, loans, policy, and audit."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <button type="button" className="card" onClick={() => { setFilters((prev) => ({ ...prev, type: 'LIKELEMBA' })); setAppliedFilters((prev) => ({ ...prev, type: 'LIKELEMBA' })); setPage(0); }} style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <TypeBadge value="LIKELEMBA" />
            <div style={{ fontWeight: 800 }}>{visibleCounts.likelemba} visible groups</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Cycle-first support flow with contributions, beneficiary rotation, and payout tracking.</div>
          </div>
        </button>
        <button type="button" className="card" onClick={() => { setFilters((prev) => ({ ...prev, type: 'AVEC' })); setAppliedFilters((prev) => ({ ...prev, type: 'AVEC' })); setPage(0); }} style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <TypeBadge value="AVEC" />
            <div style={{ fontWeight: 800 }}>{visibleCounts.avec} visible groups</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Treasury-first support flow with policy, loans, repayments, and withdrawal governance.</div>
          </div>
        </button>
      </div>

      <SectionCard title="Search" description="Filter by status, group type, creator, member, or reference.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="group-reference">Reference</label>
            <input id="group-reference" value={filters.reference} onChange={(e) => setFilters((prev) => ({ ...prev, reference: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="group-status">Status</label>
            <input id="group-status" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="group-type">Type</label>
            <select id="group-type" value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}>
              <option value="">All</option>
              <option value="LIKELEMBA">LIKELEMBA</option>
              <option value="AVEC">AVEC</option>
            </select>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="group-creator">Creator account ID</label>
            <input id="group-creator" value={filters.createdByAccountId} onChange={(e) => setFilters((prev) => ({ ...prev, createdByAccountId: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="group-member">Member account ID</label>
            <input id="group-member" value={filters.memberAccountId} onChange={(e) => setFilters((prev) => ({ ...prev, memberAccountId: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => { setPage(0); setAppliedFilters(filters); }} disabled={loading}>
            {loading ? 'Loading…' : 'Search'}
          </button>
          <button type="button" className="btn-neutral" onClick={() => { setFilters(emptyFilters); setAppliedFilters(emptyFilters); setPage(0); }}>
            Reset
          </button>
        </div>
      </SectionCard>

      {error ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div> : null}

      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        totalPages={totalPages}
        totalElements={totalElements}
        canPrev={page > 0}
        canNext={page + 1 < totalPages}
        onPageChange={setPage}
        emptyLabel="No group savings found"
      />
    </div>
  );
}
