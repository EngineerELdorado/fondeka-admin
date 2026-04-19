'use client';

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
  formatDate,
  formatDateTime,
  formatMoney,
  pickFirst
} from '@/components/SavingsAdmin';
import { api } from '@/lib/api';

const emptyFilters = {
  reference: '',
  accountReference: '',
  savingProductCode: '',
  status: ''
};

const getSavingId = (row) => pickFirst(row?.id, row?.savingId);
const getReference = (row) => pickFirst(row?.internalReference, row?.reference, row?.savingReference);
const getAccountReference = (row) => pickFirst(row?.accountReference, row?.account?.reference, row?.account?.accountReference, row?.accountId);
const getProductTitle = (row) => pickFirst(row?.savingProductTitle, row?.savingProductName, row?.savingProduct?.title, row?.savingProduct?.name);
const getProductCode = (row) => pickFirst(row?.savingProductCode, row?.savingProduct?.code, row?.productCode);
const getStatus = (row) => pickFirst(row?.status, row?.savingStatus, 'UNKNOWN');
const getPrincipalBalance = (row) => pickFirst(row?.principalBalance, row?.currentPrincipalBalance, row?.balance);
const getEstimatedInterest = (row) => pickFirst(row?.estimatedInterestAmount, row?.estimatedInterest, row?.interestEstimate);
const getProjectedTotal = (row) => pickFirst(row?.totalEstimatedValue, row?.projectedTotalValue, row?.estimatedTotalValue);
const getWithdrawableAmount = (row) => pickFirst(row?.withdrawableAmount, row?.availableWithdrawalAmount);
const getWithdrawablePrincipalAmount = (row) => pickFirst(row?.withdrawablePrincipalAmount, row?.withdrawablePrincipal, row?.availablePrincipalAmount);
const getStartDate = (row) => pickFirst(row?.startDate, row?.createdAt, row?.createdDate);
const getEndDate = (row) => pickFirst(row?.endDate, row?.lockedUntil, row?.maturityDate);
const isInterestInformationalOnly = (row) => Boolean(pickFirst(row?.interestInformationalOnly, row?.estimatedInterestInformationalOnly, false));
const getProductType = (row) => {
  const raw = String(pickFirst(row?.savingType, row?.productType, row?.savingProductType, '')).toUpperCase();
  if (raw.includes('LOCK')) return 'Locked';
  if (raw.includes('OPEN')) return 'Open';
  return raw ? raw : '—';
};
const getActivityType = (row) => pickFirst(row?.activityType, row?.type, row?.action);
const getActivityAmount = (row) => pickFirst(row?.amount, row?.principalAmount, row?.value);
const getActivityTransactionReference = (row) =>
  pickFirst(row?.transactionReference, row?.transaction?.reference, row?.internalTransactionReference, row?.transactionId);

export default function PersonalSavingsPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activities, setActivities] = useState([]);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(size)
      });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (String(value || '').trim()) params.set(key, String(value).trim());
      });
      const res = await api.savings.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list);
      setTotalPages(Math.max(1, Number(res?.totalPages) || 1));
      setTotalElements(Number(res?.totalElements) || list.length);
    } catch (err) {
      setError(err?.message || 'Failed to load personal savings');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (row) => {
    const id = getSavingId(row);
    if (!id) return;
    setSelectedId(id);
    setDetailLoading(true);
    setError(null);
    try {
      const [savingRes, activityRes] = await Promise.all([
        api.savings.get(id),
        api.savingActivities.list(new URLSearchParams({ page: '0', size: '100', savingId: String(id) }))
      ]);
      setDetail(savingRes || row);
      setActivities(Array.isArray(activityRes) ? activityRes : activityRes?.content || []);
    } catch (err) {
      setError(err?.message || 'Failed to load saving detail');
      setDetail(row);
      setActivities([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const savingColumns = useMemo(
    () => [
      {
        key: 'reference',
        label: 'Saving',
        render: (row) => (
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <div style={{ fontWeight: 700 }}>{getReference(row) || `Saving ${getSavingId(row)}`}</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>ID {getSavingId(row) ?? '—'}</div>
          </div>
        )
      },
      { key: 'accountReference', label: 'Account', render: (row) => getAccountReference(row) || '—' },
      {
        key: 'product',
        label: 'Product',
        render: (row) => (
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <div>{getProductTitle(row) || '—'}</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{getProductCode(row) || '—'}</div>
          </div>
        )
      },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge value={getStatus(row)} /> },
      { key: 'principalBalance', label: 'Principal', render: (row) => formatMoney(getPrincipalBalance(row)) },
      { key: 'estimatedInterest', label: 'Estimated Interest', render: (row) => formatMoney(getEstimatedInterest(row)) },
      { key: 'projectedTotal', label: 'Projected Total', render: (row) => formatMoney(getProjectedTotal(row)) },
      { key: 'withdrawableAmount', label: 'Withdrawable', render: (row) => formatMoney(getWithdrawableAmount(row)) },
      { key: 'createdAt', label: 'Created / Start', render: (row) => formatDate(getStartDate(row)) },
      { key: 'endDate', label: 'End Date', render: (row) => formatDate(getEndDate(row)) },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">
            Inspect
          </button>
        )
      }
    ],
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SavingsSubnav />
      <SavingsPageHeader
        title="Personal Savings"
        description="Visibility-first admin view for personal savings. Estimated interest is shown distinctly from actual withdrawable value, and operational review centers on balances, dates, and activity history."
      />

      <SectionCard title="Search" description="Search by saving reference, account reference, product code, or status.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="personal-reference">Saving reference</label>
            <input id="personal-reference" value={filters.reference} onChange={(e) => setFilters((prev) => ({ ...prev, reference: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="personal-account-reference">Account reference</label>
            <input id="personal-account-reference" value={filters.accountReference} onChange={(e) => setFilters((prev) => ({ ...prev, accountReference: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="personal-product-code">Product code</label>
            <input id="personal-product-code" value={filters.savingProductCode} onChange={(e) => setFilters((prev) => ({ ...prev, savingProductCode: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="personal-status">Status</label>
            <input id="personal-status" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => { setPage(0); setAppliedFilters(filters); }} disabled={loading}>
            {loading ? 'Loading…' : 'Search'}
          </button>
          <button type="button" className="btn-neutral" onClick={() => { setFilters(emptyFilters); setAppliedFilters(emptyFilters); setPage(0); }} disabled={loading}>
            Reset
          </button>
        </div>
      </SectionCard>

      {error ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div> : null}

      <DataTable
        columns={savingColumns}
        rows={rows}
        page={page}
        pageSize={size}
        totalPages={totalPages}
        totalElements={totalElements}
        canPrev={page > 0}
        canNext={page + 1 < totalPages}
        onPageChange={setPage}
        emptyLabel="No personal savings found"
      />

      {selectedId !== null && (
        <AdminModal title={`Personal Saving ${getReference(detail) || selectedId}`} onClose={() => { setSelectedId(null); setDetail(null); setActivities([]); }}>
          {detailLoading ? (
            <div style={{ padding: '1rem 0' }}>Loading saving detail…</div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <SectionCard
                title="Header"
                description="High-level identity for the saving."
                actions={<StatusBadge value={getStatus(detail)} />}
              >
                <DetailGrid
                  rows={[
                    { label: 'Saving name', value: getProductTitle(detail) || '—' },
                    { label: 'Internal reference', value: getReference(detail) || '—' },
                    { label: 'Product type', value: getProductType(detail) },
                    { label: 'Account reference', value: getAccountReference(detail) || '—' }
                  ]}
                />
              </SectionCard>

              <SectionCard title="Value Summary" description="Withdrawable values are actual; estimated values are informational unless interest payout is enabled.">
                <MetricStrip
                  items={[
                    { label: 'Principal Balance', value: formatMoney(getPrincipalBalance(detail)), hint: 'Tracked principal value' },
                    {
                      label: 'Withdrawable Amount',
                      value: formatMoney(getWithdrawableAmount(detail)),
                      hint: 'Actual amount available to withdraw',
                      valueTone: '#15803d'
                    },
                    {
                      label: 'Estimated Interest',
                      value: formatMoney(getEstimatedInterest(detail)),
                      hint: isInterestInformationalOnly(detail) ? 'Informational only' : 'May be included based on payout flags',
                      valueTone: '#92400e'
                    },
                    {
                      label: 'Projected Total Value',
                      value: formatMoney(getProjectedTotal(detail)),
                      hint: 'Projected, not wallet-available value',
                      valueTone: '#475569'
                    }
                  ]}
                />
              </SectionCard>

              <SectionCard title="Product / Rules" description="Open vs locked rules and whether interest is informational only.">
                <DetailGrid
                  rows={[
                    { label: 'Product Type', value: getProductType(detail) },
                    { label: 'Start Date', value: formatDateTime(getStartDate(detail)) },
                    { label: 'End Date', value: formatDateTime(getEndDate(detail)) },
                    {
                      label: 'Interest Policy',
                      value: isInterestInformationalOnly(detail) ? 'Informational only' : 'Interest payout may apply',
                      hint: isInterestInformationalOnly(detail)
                        ? 'Do not present estimated interest as withdrawable cash.'
                        : 'Feature flags may allow estimated interest to be paid out.'
                    },
                    { label: 'Withdrawable Principal', value: formatMoney(getWithdrawablePrincipalAmount(detail)) }
                  ]}
                />
              </SectionCard>

              <SectionCard title="Activity History" description="Deposits, withdrawals, and related transaction references.">
                <DataTable
                  showIndex={false}
                  showAccountQuickNav={false}
                  pageSize={100}
                  columns={[
                    { key: 'activityType', label: 'Type', render: (row) => getActivityType(row) || '—' },
                    { key: 'amount', label: 'Amount', render: (row) => formatMoney(getActivityAmount(row)) },
                    {
                      key: 'estimatedInterest',
                      label: 'Estimated Interest',
                      render: (row) => formatMoney(pickFirst(row?.estimatedInterestAmount, row?.estimatedInterest))
                    },
                    { key: 'transactionReference', label: 'Transaction Ref', render: (row) => getActivityTransactionReference(row) || '—' },
                    { key: 'createdAt', label: 'Timestamp', render: (row) => formatDateTime(pickFirst(row?.createdAt, row?.timestamp, row?.activityDate)) }
                  ]}
                  rows={activities}
                  emptyLabel="No saving activities found"
                />
              </SectionCard>
            </div>
          )}
        </AdminModal>
      )}
    </div>
  );
}
