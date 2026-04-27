'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { useLocale } from '@/contexts/LocaleContext';
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
  const { t } = useLocale();
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
        label: t('savings.groups.group'),
        render: (row) => (
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <div style={{ fontWeight: 700 }}>{getGroupReference(row) || `Group ${getGroupId(row)}`}</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{getGroupName(row) || '—'}</div>
          </div>
        )
      },
      { key: 'type', label: t('savings.groups.type'), render: (row) => <TypeBadge value={getGroupType(row)} /> },
      { key: 'status', label: t('common.status'), render: (row) => <StatusBadge value={getGroupStatus(row)} /> },
      { key: 'creator', label: t('savings.groups.creatorAccount'), render: (row) => getCreatorAccount(row) || '—' },
      { key: 'activeMembers', label: t('savings.groups.activeMembers'), render: (row) => formatCount(pickFirst(row?.activeMemberCount, row?.memberCount)) },
      {
        key: 'cycle',
        label: t('savings.groups.currentRoundCycle'),
        render: (row) => {
          const round = getCurrentRoundNumber(row);
          const cycle = pickFirst(row?.currentCycleNumber, row?.cycleNumber);
          if ((round === null || round === undefined || round === '') && (cycle === null || cycle === undefined || cycle === '')) return '—';
          return t('savings.groups.roundCycleValue', { round: formatCount(round), cycle: formatCount(cycle) });
        }
      },
      { key: 'pending', label: t('savings.groups.pendingContributions'), render: (row) => formatCount(row?.pendingContributionCount) },
      { key: 'paid', label: t('savings.groups.paidContributions'), render: (row) => formatCount(row?.paidContributionCount) },
      { key: 'overdue', label: t('savings.groups.overdueContributions'), render: (row) => formatCount(row?.overdueContributionCount) },
      { key: 'treasuryBalance', label: t('savings.groups.treasuryBalance'), render: (row) => (getGroupType(row) === 'AVEC' ? formatMoney(getTreasuryBalance(row)) : '—') },
      { key: 'createdAt', label: t('savings.groups.created'), render: (row) => formatDate(pickFirst(row?.createdAt, row?.createdDate)) },
      {
        key: 'actions',
        label: t('savings.groups.actions'),
        render: (row) => (
          <Link href={`/dashboard/savings/groups/${encodeURIComponent(getGroupId(row))}`} className="btn-neutral" style={{ textDecoration: 'none' }}>
            {t('savings.groups.open')}
          </Link>
        )
      }
    ],
    [t]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SavingsSubnav />
      <SavingsPageHeader
        title={t('savings.groups.title')}
        description={t('savings.groups.description')}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <button type="button" className="card" onClick={() => { setFilters((prev) => ({ ...prev, type: 'LIKELEMBA' })); setAppliedFilters((prev) => ({ ...prev, type: 'LIKELEMBA' })); setPage(0); }} style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <TypeBadge value="LIKELEMBA" />
            <div style={{ fontWeight: 800 }}>{t('savings.groups.visibleGroups', { count: visibleCounts.likelemba })}</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{t('savings.groups.likelembaBlurb')}</div>
          </div>
        </button>
        <button type="button" className="card" onClick={() => { setFilters((prev) => ({ ...prev, type: 'AVEC' })); setAppliedFilters((prev) => ({ ...prev, type: 'AVEC' })); setPage(0); }} style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <TypeBadge value="AVEC" />
            <div style={{ fontWeight: 800 }}>{t('savings.groups.visibleGroups', { count: visibleCounts.avec })}</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{t('savings.groups.avecBlurb')}</div>
          </div>
        </button>
      </div>

      <SectionCard title={t('savings.groups.searchTitle')} description={t('savings.groups.searchDescription')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="group-reference">{t('savings.groups.reference')}</label>
            <input id="group-reference" value={filters.reference} onChange={(e) => setFilters((prev) => ({ ...prev, reference: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="group-status">{t('common.status')}</label>
            <input id="group-status" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="group-type">{t('savings.groups.type')}</label>
            <select id="group-type" value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}>
              <option value="">{t('common.all')}</option>
              <option value="LIKELEMBA">LIKELEMBA</option>
              <option value="AVEC">AVEC</option>
            </select>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="group-creator">{t('savings.groups.creatorAccountId')}</label>
            <input id="group-creator" value={filters.createdByAccountId} onChange={(e) => setFilters((prev) => ({ ...prev, createdByAccountId: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="group-member">{t('savings.groups.memberAccountId')}</label>
            <input id="group-member" value={filters.memberAccountId} onChange={(e) => setFilters((prev) => ({ ...prev, memberAccountId: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => { setPage(0); setAppliedFilters(filters); }} disabled={loading}>
            {loading ? t('common.refreshing') : t('savings.groups.search')}
          </button>
          <button type="button" className="btn-neutral" onClick={() => { setFilters(emptyFilters); setAppliedFilters(emptyFilters); setPage(0); }}>
            {t('savings.groups.reset')}
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
        emptyLabel={t('savings.groups.noGroups')}
      />
    </div>
  );
}
