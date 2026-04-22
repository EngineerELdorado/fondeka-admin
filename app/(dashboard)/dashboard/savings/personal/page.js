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

const emptyEditDraft = {
  name: '',
  description: '',
  internalReference: '',
  startsAt: '',
  endsAt: '',
  accountId: '',
  savingProductId: '',
  balance: '',
  status: ''
};

const SAVING_PRODUCT_CODE_LOCKED = 'LOCKED_SAVING';

const getSavingId = (row) => pickFirst(row?.id, row?.savingId);
const getReference = (row) => pickFirst(row?.internalReference, row?.reference, row?.savingReference);
const getAccountReference = (row) => pickFirst(row?.accountReference, row?.account?.reference, row?.account?.accountReference, row?.accountId);
const getProductTitle = (row) => pickFirst(row?.savingProductTitle, row?.savingProductName, row?.savingProduct?.title, row?.savingProduct?.name);
const getProductCode = (row) => pickFirst(row?.savingProductCode, row?.savingProduct?.code, row?.productCode);
const getStatus = (row) => pickFirst(row?.status, row?.savingStatus, 'UNKNOWN');
const getDeletedAt = (row) => pickFirst(row?.deletedAt);
const isDeletedSaving = (row) => Boolean(getDeletedAt(row));
const getPrincipalBalance = (row) => pickFirst(row?.principalBalance, row?.currentPrincipalBalance, row?.balance);
const getEstimatedInterest = (row) => pickFirst(row?.estimatedInterestAmount, row?.estimatedInterest, row?.interestEstimate);
const getPayableInterest = (row) => pickFirst(row?.payableInterestAmount, row?.payableInterest);
const getForfeitableInterest = (row) => pickFirst(row?.forfeitableInterestAmount, row?.forfeitableInterest);
const getProjectedTotal = (row) => pickFirst(row?.totalEstimatedValue, row?.projectedTotalValue, row?.estimatedTotalValue);
const getWithdrawableAmount = (row) => pickFirst(row?.withdrawableAmount, row?.availableWithdrawalAmount);
const getWithdrawablePrincipalAmount = (row) => pickFirst(row?.withdrawablePrincipalAmount, row?.withdrawablePrincipal, row?.availablePrincipalAmount);
const getAppliedInterestPercentage = (row) => pickFirst(row?.interestPercentage, row?.appliedInterestPercentage, row?.savingInterestPercentage);
const getAppliedInterestType = (row) => pickFirst(row?.interestType, row?.appliedInterestType, row?.savingInterestType);
const getAppliedLockDurationDays = (row) => pickFirst(row?.appliedLockDurationDays, row?.lockDurationDays);
const getAppliedInterestTierId = (row) => pickFirst(row?.appliedInterestTierId, row?.interestTierId);
const getAppliedAt = (row) => pickFirst(row?.appliedAt, row?.termsAppliedAt);
const getEarlyWithdrawalApprovedAt = (row) => pickFirst(row?.earlyWithdrawalApprovedAt);
const getStartDate = (row) => pickFirst(row?.startDate, row?.createdAt, row?.createdDate);
const getEndDate = (row) => pickFirst(row?.endDate, row?.lockedUntil, row?.maturityDate);
const isInterestInformationalOnly = (row) => Boolean(pickFirst(row?.interestInformationalOnly, row?.estimatedInterestInformationalOnly, false));
const getProductType = (row) => {
  const raw = String(pickFirst(row?.savingType, row?.productType, row?.savingProductType, '')).toUpperCase();
  if (raw.includes('LOCK')) return 'Locked';
  if (raw.includes('OPEN')) return 'Open';
  return raw ? raw : '—';
};
const getProductBehaviorSummary = (row) => {
  const code = String(getProductCode(row) || '').toUpperCase();
  if (code === SAVING_PRODUCT_CODE_LOCKED) {
    return 'Locked savings accrue daily interest. It becomes payable only at maturity, and an early full break forfeits accrued interest.';
  }
  if (code === 'OPEN_SAVING') {
    return 'Open savings is flexible and normally non-interest-bearing. Admin can still configure a non-zero rate as a negotiated exception.';
  }
  return 'Review the product configuration to confirm the current commercial rule.';
};
const getActivityType = (row) => pickFirst(row?.activityType, row?.type, row?.action);
const getActivityAmount = (row) => pickFirst(row?.amount, row?.principalAmount, row?.value);
const getActivityTransactionReference = (row) =>
  pickFirst(row?.transactionReference, row?.transaction?.reference, row?.internalTransactionReference, row?.transactionId);
const getMinimumLockDurationDays = (product) =>
  Number(product?.minimumLockDurationDays ?? product?.minimum_lock_duration_days ?? 0);
const isLockedSavingProduct = (value) => String(value || '').trim().toUpperCase() === SAVING_PRODUCT_CODE_LOCKED;
const isMaturedSaving = (row) => {
  const endDate = getEndDate(row);
  if (!endDate) return false;
  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
};
const formatProductLabel = (product) => {
  if (!product) return '—';
  const name = product.title || product.name || product.code || `Product ${product.id}`;
  const code = product.code ? ` (${product.code})` : '';
  return `${name}${code}`;
};
const toInputDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const toIsoString = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const BottomSheetNotice = ({ title, message, onClose }) => (
  <div
    style={{
      position: 'fixed',
      inset: 'auto 0 0 0',
      display: 'flex',
      justifyContent: 'center',
      padding: '0 1rem 1rem',
      zIndex: 1200,
      pointerEvents: 'none'
    }}
  >
    <div
      style={{
        width: 'min(680px, 100%)',
        display: 'grid',
        gap: '0.45rem',
        padding: '0.95rem 1rem 1rem',
        borderRadius: '18px 18px 0 0',
        border: '1px solid rgba(239, 68, 68, 0.22)',
        background: '#fff7f7',
        color: '#7f1d1d',
        boxShadow: '0 -18px 48px rgba(15, 23, 42, 0.18)',
        pointerEvents: 'auto'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: '0.15rem' }}>
          <div style={{ fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: '13px', color: '#991b1b' }}>{message}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ border: 'none', background: 'transparent', color: '#991b1b', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}
          aria-label="Close personal saving edit error"
        >
          ×
        </button>
      </div>
    </div>
  </div>
);

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
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [editDraft, setEditDraft] = useState(emptyEditDraft);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [restoreSaving, setRestoreSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  const selectedProduct = useMemo(
    () => products.find((product) => String(product?.id) === String(editDraft.savingProductId)),
    [products, editDraft.savingProductId]
  );
  const isLockedSavingDraft = isLockedSavingProduct(selectedProduct?.code);
  const minimumLockDurationDays = getMinimumLockDurationDays(selectedProduct);
  const detailProduct = useMemo(
    () => products.find((product) => String(product?.id) === String(pickFirst(detail?.savingProductId, detail?.savingProduct?.id))),
    [products, detail]
  );
  const earlyWithdrawalAllowedByProduct = Boolean(
    pickFirst(detail?.allowEarlyWithdrawalWithoutApproval, detail?.savingProduct?.allowEarlyWithdrawalWithoutApproval, detailProduct?.allowEarlyWithdrawalWithoutApproval, false)
  );

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

  useEffect(() => {
    const fetchProducts = async () => {
      setProductsLoading(true);
      try {
        const res = await api.savingProducts.list(new URLSearchParams({ page: '0', size: '100' }));
        const list = Array.isArray(res) ? res : res?.content || [];
        setProducts(list);
      } catch (err) {
        setError((prev) => prev || err?.message || 'Failed to load saving products');
      } finally {
        setProductsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!isLockedSavingDraft && editDraft.endsAt !== '') {
      setEditDraft((prev) => ({ ...prev, endsAt: '' }));
    }
  }, [isLockedSavingDraft, editDraft.endsAt]);

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

  const openEdit = (saving) => {
    setEditDraft({
      name: saving?.name ?? '',
      description: saving?.description ?? '',
      internalReference: saving?.internalReference ?? getReference(saving) ?? '',
      startsAt: toInputDateTime(pickFirst(saving?.startsAt, saving?.startDate, saving?.createdAt, saving?.createdDate)),
      endsAt: toInputDateTime(pickFirst(saving?.endsAt, saving?.endDate, saving?.lockedUntil, saving?.maturityDate)),
      accountId: pickFirst(saving?.accountId, '') ?? '',
      savingProductId: pickFirst(saving?.savingProductId, saving?.savingProduct?.id, '') ?? '',
      balance: pickFirst(saving?.balance, saving?.principalBalance, '') ?? '',
      status: saving?.status ?? ''
    });
    setEditError(null);
    setEditing(true);
  };

  const validateEditDraft = () => {
    const startsAt = new Date(editDraft.startsAt);
    if (!editDraft.startsAt || Number.isNaN(startsAt.getTime())) return 'Start date is required.';
    if (!editDraft.savingProductId) return 'Saving product is required.';
    if (isLockedSavingDraft) {
      const endsAt = new Date(editDraft.endsAt);
      if (!editDraft.endsAt || Number.isNaN(endsAt.getTime())) return 'Locked savings require an end date.';
      if (endsAt <= new Date()) return 'Locked savings require a future maturity date.';
      const durationDays = (endsAt.getTime() - startsAt.getTime()) / (1000 * 60 * 60 * 24);
      if (durationDays < minimumLockDurationDays) {
        return `Locked savings must respect the product minimum lock duration of ${minimumLockDurationDays} day${minimumLockDurationDays === 1 ? '' : 's'}.`;
      }
    }
    return null;
  };

  const handleSaveEdit = async () => {
    if (!detail?.id && !detail?.savingId) return;
    const validationError = validateEditDraft();
    if (validationError) {
      setEditError(validationError);
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    setError(null);
    try {
      const savingId = getSavingId(detail);
      await api.savings.update(savingId, {
        name: editDraft.name.trim() || null,
        description: editDraft.description.trim() || null,
        internalReference: editDraft.internalReference.trim() || null,
        startsAt: toIsoString(editDraft.startsAt),
        endsAt: isLockedSavingDraft ? toIsoString(editDraft.endsAt) : null,
        accountId: Number(editDraft.accountId) || 0,
        savingProductId: Number(editDraft.savingProductId) || 0,
        balance: editDraft.balance === '' ? null : Number(editDraft.balance),
        status: editDraft.status || null
      });
      const [savingRes, activityRes] = await Promise.all([
        api.savings.get(savingId),
        api.savingActivities.list(new URLSearchParams({ page: '0', size: '100', savingId: String(savingId) }))
      ]);
      setDetail(savingRes);
      setActivities(Array.isArray(activityRes) ? activityRes : activityRes?.content || []);
      setEditing(false);
      setEditError(null);
      await fetchRows();
    } catch (err) {
      setEditError(err?.message || 'Failed to update saving');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSetEarlyWithdrawalApproval = async (approved) => {
    if (!detail) return;
    setApprovalSaving(true);
    setError(null);
    try {
      const savingId = getSavingId(detail);
      await api.savings.update(savingId, {
        name: detail?.name ?? null,
        description: detail?.description ?? null,
        internalReference: detail?.internalReference ?? getReference(detail) ?? null,
        startsAt: toIsoString(pickFirst(detail?.startsAt, detail?.startDate, detail?.createdAt, detail?.createdDate)),
        endsAt: isLockedSavingProduct(pickFirst(detail?.savingProduct?.code, getProductCode(detail)))
          ? toIsoString(pickFirst(detail?.endsAt, detail?.endDate, detail?.lockedUntil, detail?.maturityDate))
          : null,
        accountId: Number(pickFirst(detail?.accountId, 0)) || 0,
        savingProductId: Number(pickFirst(detail?.savingProductId, detail?.savingProduct?.id, 0)) || 0,
        balance: pickFirst(detail?.balance, detail?.principalBalance, null),
        status: detail?.status ?? null,
        earlyWithdrawalApproved: approved
      });
      const [savingRes, activityRes] = await Promise.all([
        api.savings.get(savingId),
        api.savingActivities.list(new URLSearchParams({ page: '0', size: '100', savingId: String(savingId) }))
      ]);
      setDetail(savingRes);
      setActivities(Array.isArray(activityRes) ? activityRes : activityRes?.content || []);
      await fetchRows();
    } catch (err) {
      setError(err?.message || `Failed to ${approved ? 'approve' : 'revoke'} early withdrawal`);
    } finally {
      setApprovalSaving(false);
    }
  };

  const handleRestoreSaving = async (saving) => {
    if (!saving) return;
    setRestoreSaving(true);
    setError(null);
    try {
      const savingId = getSavingId(saving);
      await api.savings.update(savingId, {
        name: saving?.name ?? null,
        description: saving?.description ?? null,
        internalReference: saving?.internalReference ?? getReference(saving) ?? null,
        startsAt: toIsoString(pickFirst(saving?.startsAt, saving?.startDate, saving?.createdAt, saving?.createdDate)),
        endsAt: isLockedSavingProduct(pickFirst(saving?.savingProduct?.code, getProductCode(saving)))
          ? toIsoString(pickFirst(saving?.endsAt, saving?.endDate, saving?.lockedUntil, saving?.maturityDate))
          : null,
        accountId: Number(pickFirst(saving?.accountId, 0)) || 0,
        savingProductId: Number(pickFirst(saving?.savingProductId, saving?.savingProduct?.id, 0)) || 0,
        balance: pickFirst(saving?.balance, saving?.principalBalance, null),
        status: saving?.status ?? null,
        deleted: false
      });
      const [savingRes, activityRes] = await Promise.all([
        api.savings.get(savingId),
        api.savingActivities.list(new URLSearchParams({ page: '0', size: '100', savingId: String(savingId) }))
      ]);
      setDetail(savingRes);
      setActivities(Array.isArray(activityRes) ? activityRes : activityRes?.content || []);
      await fetchRows();
    } catch (err) {
      setError(err?.message || 'Failed to restore saving');
    } finally {
      setRestoreSaving(false);
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
      {
        key: 'status',
        label: 'Status',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <StatusBadge value={getStatus(row)} />
            {isDeletedSaving(row) ? <StatusBadge value="DELETED" /> : null}
          </div>
        )
      },
      { key: 'principalBalance', label: 'Principal', render: (row) => formatMoney(getPrincipalBalance(row)) },
      { key: 'estimatedInterest', label: 'Estimated Interest', render: (row) => formatMoney(getEstimatedInterest(row)) },
      { key: 'projectedTotal', label: 'Projected Total', render: (row) => formatMoney(getProjectedTotal(row)) },
      { key: 'withdrawableAmount', label: 'Withdrawable', render: (row) => formatMoney(getWithdrawableAmount(row)) },
      { key: 'createdAt', label: 'Created / Start', render: (row) => formatDate(getStartDate(row)) },
      { key: 'endDate', label: 'End Date', render: (row) => formatDate(getEndDate(row)) },
      { key: 'deletedAt', label: 'Deleted At', render: (row) => formatDateTime(getDeletedAt(row)) },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral">
              Inspect
            </button>
            <button
              type="button"
              onClick={async () => {
                await openDetail(row);
                const id = getSavingId(row);
                const base = row;
                if (id) {
                  try {
                    const full = await api.savings.get(id);
                    setDetail(full || base);
                    openEdit(full || base);
                  } catch {
                    openEdit(base);
                  }
                } else {
                  openEdit(base);
                }
              }}
              className="btn-primary"
            >
              Change Product
            </button>
            {isDeletedSaving(row) ? (
              <button
                type="button"
                onClick={async () => {
                  const id = getSavingId(row);
                  if (!id) return;
                  try {
                    const full = await api.savings.get(id);
                    await handleRestoreSaving(full || row);
                  } catch {
                    await handleRestoreSaving(row);
                  }
                }}
                className="btn-success"
                disabled={restoreSaving}
              >
                {restoreSaving ? 'Restoring…' : 'Restore'}
              </button>
            ) : null}
          </div>
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
        description="Visibility-first admin view for personal savings. Actual withdrawable value is separated from estimated, payable, and forfeitable interest so support can explain maturity and early-break outcomes correctly."
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
                actions={
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <StatusBadge value={getStatus(detail)} />
                    {isDeletedSaving(detail) ? <StatusBadge value="DELETED" /> : null}
                    {String(getProductCode(detail) || '').toUpperCase() === SAVING_PRODUCT_CODE_LOCKED ? (
                      <StatusBadge
                        value={
                          getEarlyWithdrawalApprovedAt(detail)
                            ? 'EARLY_WITHDRAWAL_APPROVED'
                            : earlyWithdrawalAllowedByProduct
                              ? 'EARLY_WITHDRAWAL_ALLOWED'
                              : 'EARLY_WITHDRAWAL_BLOCKED'
                        }
                      />
                    ) : null}
                    <StatusBadge value={isMaturedSaving(detail) ? 'MATURED' : 'PRE_MATURITY'} />
                    {isDeletedSaving(detail) ? (
                      <button type="button" className="btn-success" onClick={() => handleRestoreSaving(detail)} disabled={restoreSaving}>
                        {restoreSaving ? 'Restoring…' : 'Restore Saving'}
                      </button>
                    ) : null}
                    {String(getProductCode(detail) || '').toUpperCase() === SAVING_PRODUCT_CODE_LOCKED && !earlyWithdrawalAllowedByProduct && !getEarlyWithdrawalApprovedAt(detail) ? (
                      <button type="button" className="btn-primary" onClick={() => handleSetEarlyWithdrawalApproval(true)} disabled={approvalSaving}>
                        {approvalSaving ? 'Saving…' : 'Approve Early Withdrawal'}
                      </button>
                    ) : null}
                    {String(getProductCode(detail) || '').toUpperCase() === SAVING_PRODUCT_CODE_LOCKED && getEarlyWithdrawalApprovedAt(detail) ? (
                      <button type="button" className="btn-neutral" onClick={() => handleSetEarlyWithdrawalApproval(false)} disabled={approvalSaving}>
                        {approvalSaving ? 'Saving…' : 'Revoke Approval'}
                      </button>
                    ) : null}
                    <button type="button" className="btn-primary" onClick={() => openEdit(detail)}>
                      Change Product
                    </button>
                  </div>
                }
              >
                <DetailGrid
                  rows={[
                    { label: 'Saving name', value: getProductTitle(detail) || '—' },
                    { label: 'Internal reference', value: getReference(detail) || '—' },
                    { label: 'Product type', value: getProductType(detail) },
                    { label: 'Account reference', value: getAccountReference(detail) || '—' },
                    { label: 'Deleted At', value: formatDateTime(getDeletedAt(detail)) }
                  ]}
                />
              </SectionCard>

              <SectionCard title="Product Info" description="Current product identity. This is the current offer label, not the contract truth for an existing saving.">
                <DetailGrid
                  rows={[
                    { label: 'Saving Product Code', value: getProductCode(detail) || '—' },
                    { label: 'Saving Product Title', value: getProductTitle(detail) || '—' },
                    { label: 'Product Type', value: getProductType(detail) },
                    {
                      label: 'Early Withdrawal Product Policy',
                      value: String(getProductCode(detail) || '').toUpperCase() === SAVING_PRODUCT_CODE_LOCKED
                        ? earlyWithdrawalAllowedByProduct
                          ? 'Allowed without support approval'
                          : 'Support approval required'
                        : 'Not applicable'
                    },
                    {
                      label: 'Support Rule',
                      value: String(getProductCode(detail) || '').toUpperCase() === SAVING_PRODUCT_CODE_LOCKED
                        ? 'Locked savings rate depends on chosen lock duration.'
                        : 'Open savings is normally non-interest-bearing.'
                    }
                  ]}
                />
              </SectionCard>

              <SectionCard title="Applied Terms" description="These are the terms fixed when this saving was created. Use these fields as contract truth when support asks why a saving is on a given rate.">
                <DetailGrid
                  rows={[
                    { label: 'Applied Interest %', value: getAppliedInterestPercentage(detail) !== undefined ? `${getAppliedInterestPercentage(detail)}%` : '—' },
                    { label: 'Applied Interest Type', value: getAppliedInterestType(detail) || '—' },
                    { label: 'Applied Lock Duration Days', value: getAppliedLockDurationDays(detail) ?? '—' },
                    { label: 'Applied Tier ID', value: getAppliedInterestTierId(detail) ?? '—' },
                    { label: 'Applied At', value: formatDateTime(getAppliedAt(detail)) },
                    { label: 'Early Withdrawal Approved At', value: formatDateTime(getEarlyWithdrawalApprovedAt(detail)) },
                    {
                      label: 'Contract Rule',
                      value: String(getProductCode(detail) || '').toUpperCase() === SAVING_PRODUCT_CODE_LOCKED
                        ? 'Rate is fixed at creation. Early withdrawal forfeits accrued interest.'
                        : 'Open savings may still carry interest if that product was configured as an exception.'
                    }
                  ]}
                />
              </SectionCard>

              <SectionCard title="Value State" description="Withdrawable principal and payable interest are what the customer can receive now. Estimated and forfeitable interest explain projected accrual and what would be lost on an early locked-saving break.">
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
                      hint: 'Accrued or projected interest so far',
                      valueTone: '#92400e'
                    },
                    {
                      label: 'Payable Interest Now',
                      value: formatMoney(getPayableInterest(detail)),
                      hint: 'Interest actually payable at this moment',
                      valueTone: '#15803d'
                    },
                    {
                      label: 'Forfeitable Interest',
                      value: formatMoney(getForfeitableInterest(detail)),
                      hint: 'Interest lost on an early locked-saving break before maturity',
                      valueTone: '#b45309'
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

              <SectionCard title="Operational Rules" description="How to explain maturity, early withdrawal, and the difference between the current product offer and the saving’s fixed applied terms.">
                <DetailGrid
                  rows={[
                    { label: 'Start Date', value: formatDateTime(getStartDate(detail)) },
                    { label: 'End Date', value: formatDateTime(getEndDate(detail)) },
                    { label: 'Current Maturity Status', value: isMaturedSaving(detail) ? 'Matured' : 'Pre-maturity' },
                    {
                      label: 'Interest Policy',
                      value: isInterestInformationalOnly(detail) ? 'Informational only' : 'Payable amount controlled by product state',
                      hint: getProductBehaviorSummary(detail)
                    },
                    { label: 'Withdrawable Principal', value: formatMoney(getWithdrawablePrincipalAmount(detail)) },
                    {
                      label: 'Early Withdrawal Status',
                      value: String(getProductCode(detail) || '').toUpperCase() === SAVING_PRODUCT_CODE_LOCKED
                        ? getEarlyWithdrawalApprovedAt(detail)
                          ? 'Approved for this saving'
                          : earlyWithdrawalAllowedByProduct
                            ? 'Allowed by product policy'
                            : 'Blocked until support approval'
                        : 'Flexible by product design'
                    },
                    {
                      label: 'Support Note',
                      value: String(getProductCode(detail) || '').toUpperCase() === SAVING_PRODUCT_CODE_LOCKED
                        ? 'Early withdrawal is full-break only in v1.'
                        : 'Open savings withdrawals remain flexible.'
                    }
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

      {editing && (
        <AdminModal
          title={`Edit Saving ${getReference(detail) || getSavingId(detail)}`}
          onClose={() => {
            setEditing(false);
            setEditError(null);
          }}
        >
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Changing the saving product changes the saving mode. Switching to <strong>LOCKED_SAVING</strong> requires a future end date that respects the product minimum lock duration. Locked savings accrue daily interest, but it is payable only at maturity. Early withdrawal is full-break only in v1 and forfeits accrued interest. Switching to <strong>OPEN_SAVING</strong> clears the end date.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="edit-name">Name</label>
                <input id="edit-name" value={editDraft.name} onChange={(e) => setEditDraft((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="edit-internal-reference">Internal reference</label>
                <input id="edit-internal-reference" value={editDraft.internalReference} onChange={(e) => setEditDraft((prev) => ({ ...prev, internalReference: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="edit-account-id">Account ID</label>
                <input id="edit-account-id" type="number" value={editDraft.accountId} onChange={(e) => setEditDraft((prev) => ({ ...prev, accountId: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="edit-saving-product-id">Saving product</label>
                <select
                  id="edit-saving-product-id"
                  value={editDraft.savingProductId}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, savingProductId: e.target.value }))}
                  disabled={productsLoading}
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {formatProductLabel(product)}
                    </option>
                  ))}
                </select>
                {selectedProduct ? (
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    {isLockedSavingDraft
                      ? `Minimum lock duration: ${minimumLockDurationDays} day${minimumLockDurationDays === 1 ? '' : 's'}. Early breaks pay principal only.`
                      : 'Open savings do not keep an end date and are normally non-interest-bearing.'}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="edit-starts-at">Start date</label>
                <input id="edit-starts-at" type="datetime-local" value={editDraft.startsAt} onChange={(e) => setEditDraft((prev) => ({ ...prev, startsAt: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="edit-ends-at">End date</label>
                <input
                  id="edit-ends-at"
                  type="datetime-local"
                  value={editDraft.endsAt}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, endsAt: e.target.value }))}
                  disabled={!isLockedSavingDraft}
                />
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  {isLockedSavingDraft ? 'Required for locked savings. Early withdrawal before maturity is full-break only.' : 'Disabled for open savings. It will be cleared on save.'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="edit-balance">Balance</label>
                <input id="edit-balance" type="number" value={editDraft.balance} onChange={(e) => setEditDraft((prev) => ({ ...prev, balance: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="edit-status">Status</label>
                <input id="edit-status" value={editDraft.status} onChange={(e) => setEditDraft((prev) => ({ ...prev, status: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: '1 / -1' }}>
                <label htmlFor="edit-description">Description</label>
                <textarea id="edit-description" rows={4} value={editDraft.description} onChange={(e) => setEditDraft((prev) => ({ ...prev, description: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-neutral"
                onClick={() => {
                  setEditing(false);
                  setEditError(null);
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {editing && editError ? <BottomSheetNotice title="Could not update saving" message={editError} onClose={() => setEditError(null)} /> : null}
    </div>
  );
}
