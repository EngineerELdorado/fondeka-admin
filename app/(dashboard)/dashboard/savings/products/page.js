'use client';

import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import {
  AdminModal,
  DetailGrid,
  SavingsPageHeader,
  SavingsSubnav,
  SectionCard,
  StatusBadge,
  formatCount,
  pickFirst
} from '@/components/SavingsAdmin';
import { api } from '@/lib/api';

const KNOWN_FIELDS = [
  'id',
  'code',
  'title',
  'name',
  'shortDescription',
  'description',
  'interestPercentage',
  'interestRate',
  'interestType',
  'minimumLockDurationDays',
  'allowEarlyWithdrawalWithoutApproval',
  'interestTiers',
  'icon',
  'iconColor',
  'active',
  'createdAt',
  'updatedAt'
];

const emptyDraft = {
  code: '',
  title: '',
  shortDescription: '',
  interestPercentage: '',
  interestType: '',
  minimumLockDurationDays: '',
  allowEarlyWithdrawalWithoutApproval: false,
  interestTiers: [],
  icon: '',
  iconColor: '#1F7A4D',
  active: true,
  extraJson: '{}'
};

const getProductName = (row) => pickFirst(row?.title, row?.name);
const getInterestPercentage = (row) => pickFirst(row?.interestPercentage, row?.interestRate);
const getMinimumLockDurationDays = (row) => pickFirst(row?.minimumLockDurationDays, row?.minimum_lock_duration_days);
const isLockedSavingProduct = (value) => String(value || '').trim().toUpperCase() === 'LOCKED_SAVING';
const normalizeTierDraft = (tier) => ({
  id: pickFirst(tier?.id, null),
  minLockDurationDays: String(pickFirst(tier?.minLockDurationDays, '') ?? ''),
  maxLockDurationDays: String(pickFirst(tier?.maxLockDurationDays, '') ?? ''),
  interestPercentage: String(pickFirst(tier?.interestPercentage, '') ?? '')
});

const formatInterest = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed}%` : '—';
};

const prettyJson = (value) => JSON.stringify(value ?? {}, null, 2);

const buildExtraJson = (row) => {
  const extras = Object.entries(row || {}).reduce((acc, [key, value]) => {
    if (KNOWN_FIELDS.includes(key)) return acc;
    acc[key] = value;
    return acc;
  }, {});
  return prettyJson(extras);
};

const draftFromRow = (row) => ({
  code: String(pickFirst(row?.code, '') || ''),
  title: String(getProductName(row) || ''),
  shortDescription: String(pickFirst(row?.shortDescription, row?.description, '') || ''),
  interestPercentage: String(pickFirst(getInterestPercentage(row), '') || ''),
  interestType: String(pickFirst(row?.interestType, '') || ''),
  minimumLockDurationDays: String(pickFirst(getMinimumLockDurationDays(row), '') || ''),
  allowEarlyWithdrawalWithoutApproval: Boolean(pickFirst(row?.allowEarlyWithdrawalWithoutApproval, false)),
  interestTiers: Array.isArray(row?.interestTiers) ? row.interestTiers.map(normalizeTierDraft) : [],
  icon: String(pickFirst(row?.icon, '') || ''),
  iconColor: String(pickFirst(row?.iconColor, '#1F7A4D') || '#1F7A4D'),
  active: Boolean(pickFirst(row?.active, true)),
  extraJson: buildExtraJson(row)
});

const validateInterestTiers = (draft) => {
  if (!isLockedSavingProduct(draft.code)) return [];

  if (draft.minimumLockDurationDays === '' || Number(draft.minimumLockDurationDays) <= 0) {
    throw new Error('Locked savings require a minimum lock duration greater than 0.');
  }

  const tiers = (draft.interestTiers || []).map((tier, index) => {
    const min = Number(tier.minLockDurationDays);
    const max = tier.maxLockDurationDays === '' ? null : Number(tier.maxLockDurationDays);
    const interest = Number(tier.interestPercentage);

    if (!Number.isFinite(min) || min <= 0) {
      throw new Error(`Tier ${index + 1}: From days is required and must be greater than 0.`);
    }
    if (max !== null && (!Number.isFinite(max) || max < min)) {
      throw new Error(`Tier ${index + 1}: To days must be greater than or equal to From days.`);
    }
    if (!Number.isFinite(interest) || interest < 0) {
      throw new Error(`Tier ${index + 1}: Daily interest % is required and must be 0 or greater.`);
    }

    return {
      id: tier.id ?? null,
      minLockDurationDays: min,
      maxLockDurationDays: max,
      interestPercentage: interest
    };
  });

  const sorted = [...tiers].sort((a, b) => a.minLockDurationDays - b.minLockDurationDays);
  sorted.forEach((tier, index) => {
    if (tier.maxLockDurationDays === null && index !== sorted.length - 1) {
      throw new Error('Only the last interest tier can have no To days value.');
    }
    const next = sorted[index + 1];
    if (next && tier.maxLockDurationDays !== null && tier.maxLockDurationDays >= next.minLockDurationDays) {
      throw new Error(
        `Interest tiers overlap between ${tier.minLockDurationDays}-${tier.maxLockDurationDays} days and ${next.minLockDurationDays}${next.maxLockDurationDays === null ? '+' : `-${next.maxLockDurationDays}`} days.`
      );
    }
  });

  return sorted;
};

const parseDraftPayload = (draft) => {
  let extras = {};
  try {
    extras = draft.extraJson.trim() ? JSON.parse(draft.extraJson) : {};
  } catch {
    throw new Error('Additional fields must be valid JSON.');
  }
  if (extras === null || Array.isArray(extras) || typeof extras !== 'object') {
    throw new Error('Additional fields must be a JSON object.');
  }

  const interestTiers = validateInterestTiers(draft);

  return {
    ...extras,
    code: draft.code.trim() || null,
    title: draft.title.trim() || null,
    shortDescription: draft.shortDescription.trim() || null,
    interestPercentage: draft.interestPercentage === '' ? null : Number(draft.interestPercentage),
    interestType: draft.interestType.trim() || null,
    minimumLockDurationDays:
      isLockedSavingProduct(draft.code) && draft.minimumLockDurationDays !== ''
        ? Number(draft.minimumLockDurationDays)
        : null,
    allowEarlyWithdrawalWithoutApproval: isLockedSavingProduct(draft.code)
      ? Boolean(draft.allowEarlyWithdrawalWithoutApproval)
      : false,
    interestTiers: isLockedSavingProduct(draft.code) ? interestTiers : [],
    icon: draft.icon.trim() || null,
    iconColor: draft.iconColor.trim() || null,
    active: Boolean(draft.active)
  };
};

export default function SavingProductsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filters, setFilters] = useState({ code: '', title: '', active: '' });
  const [appliedFilters, setAppliedFilters] = useState({ code: '', title: '', active: '' });
  const lockedDraft = isLockedSavingProduct(draft.code);
  const sortedDraftTiers = useMemo(
    () =>
      [...(draft.interestTiers || [])].sort(
        (a, b) => Number(a?.minLockDurationDays || 0) - Number(b?.minLockDurationDays || 0)
      ),
    [draft.interestTiers]
  );

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      if (appliedFilters.code.trim()) params.set('code', appliedFilters.code.trim());
      if (appliedFilters.title.trim()) params.set('title', appliedFilters.title.trim());
      if (appliedFilters.active !== '') params.set('active', appliedFilters.active);
      const res = await api.savingProducts.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setTotalPages(Math.max(1, Number(res?.totalPages) || 1));
      setTotalElements(Number(res?.totalElements) || list.length);
    } catch (err) {
      setError(err.message || 'Failed to load saving products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      {
        key: 'product',
        label: 'Product',
        render: (row) => (
          <div style={{ display: 'grid', gap: '0.15rem' }}>
            <div style={{ fontWeight: 700 }}>{getProductName(row) || '—'}</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{pickFirst(row?.code, '—')}</div>
          </div>
        )
      },
      { key: 'shortDescription', label: 'Short Description', render: (row) => pickFirst(row?.shortDescription, row?.description, '—') },
      { key: 'interest', label: 'Interest', render: (row) => formatInterest(getInterestPercentage(row)) },
      { key: 'interestType', label: 'Interest Type', render: (row) => pickFirst(row?.interestType, '—') },
      {
        key: 'minimumLockDurationDays',
        label: 'Minimum Lock',
        render: (row) => (isLockedSavingProduct(row?.code) ? `${pickFirst(getMinimumLockDurationDays(row), '—')} days` : '—')
      },
      {
        key: 'interestTiers',
        label: 'Default Daily Tiers',
        render: (row) => {
          const count = Array.isArray(row?.interestTiers) ? row.interestTiers.length : 0;
          return isLockedSavingProduct(row?.code) ? `${count} tier${count === 1 ? '' : 's'}` : '—';
        }
      },
      {
        key: 'allowEarlyWithdrawalWithoutApproval',
        label: 'Early Break Policy',
        render: (row) =>
          isLockedSavingProduct(row?.code)
            ? Boolean(pickFirst(row?.allowEarlyWithdrawalWithoutApproval, false))
              ? 'Self-service allowed'
              : 'Approval required'
            : '—'
      },
      {
        key: 'active',
        label: 'Status',
        render: (row) => <StatusBadge value={Boolean(pickFirst(row?.active, false)) ? 'ACTIVE' : 'INACTIVE'} />
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
            <button type="button" onClick={() => openEdit(row)} className="btn-neutral">Edit</button>
            <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger">Delete</button>
          </div>
        )
      }
    ],
    []
  );

  const openCreate = () => {
    setDraft(emptyDraft);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = async (row) => {
    setInfo(null);
    setError(null);
    try {
      const full = row?.id ? await api.savingProducts.get(row.id) : row;
      setSelected(full || row);
      setDraft(draftFromRow(full || row));
      setShowEdit(true);
    } catch (err) {
      setError(err.message || 'Failed to load saving product details.');
    }
  };

  const openDetail = async (row) => {
    setInfo(null);
    setError(null);
    try {
      const full = row?.id ? await api.savingProducts.get(row.id) : row;
      setSelected(full || row);
      setShowDetail(true);
    } catch (err) {
      setError(err.message || 'Failed to load saving product details.');
    }
  };

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.savingProducts.create(parseDraftPayload(draft));
      setInfo('Created saving product.');
      setShowCreate(false);
      await fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.savingProducts.update(selected.id, parseDraftPayload(draft));
      setInfo(`Updated saving product ${selected.id}.`);
      setShowEdit(false);
      await fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    const id = confirmDelete.id;
    setError(null);
    setInfo(null);
    try {
      await api.savingProducts.remove(id);
      setInfo(`Deleted saving product ${id}.`);
      setConfirmDelete(null);
      await fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <SectionCard title="Core Product Fields" description="These are the fields already used by the personal savings mobile flow.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="code">Product code</label>
            <input id="code" value={draft.code} onChange={(e) => setDraft((p) => ({ ...p, code: e.target.value }))} placeholder="OPEN_SAVING" />
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Set to <strong>LOCKED_SAVING</strong> to manage minimum lock duration.
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="title">Title</label>
            <input id="title" value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} placeholder="Flexible Saver" />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="interestPercentage">Interest percentage</label>
            <input
              id="interestPercentage"
              type="number"
              step="0.01"
              value={draft.interestPercentage}
              onChange={(e) => setDraft((p) => ({ ...p, interestPercentage: e.target.value }))}
              placeholder="4"
            />
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Open savings is normally zero-interest by default. Admin can still configure a non-zero rate for negotiated exceptions.
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="interestType">Interest type</label>
            <input id="interestType" value={draft.interestType} onChange={(e) => setDraft((p) => ({ ...p, interestType: e.target.value }))} placeholder="SIMPLE" />
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Locked savings accrue daily interest and that interest becomes payable only at maturity.
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="minimumLockDurationDays">Minimum lock duration (days)</label>
            <input
              id="minimumLockDurationDays"
              type="number"
              min="0"
              step="1"
              value={draft.minimumLockDurationDays}
              onChange={(e) => setDraft((p) => ({ ...p, minimumLockDurationDays: e.target.value }))}
              placeholder={isLockedSavingProduct(draft.code) ? '30' : 'Not used for open savings'}
              disabled={!isLockedSavingProduct(draft.code)}
            />
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Minimum number of days a locked saving must remain active before maturity.
            </div>
          </div>
          {lockedDraft ? (
            <label style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '0.5rem', fontWeight: 700, gridColumn: '1 / -1' }}>
              <input
                id="allowEarlyWithdrawalWithoutApproval"
                type="checkbox"
                checked={draft.allowEarlyWithdrawalWithoutApproval}
                onChange={(e) => setDraft((p) => ({ ...p, allowEarlyWithdrawalWithoutApproval: e.target.checked }))}
              />
              <span style={{ display: 'grid', gap: '0.2rem' }}>
                <span>Allow early withdrawal without support approval</span>
                <span style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 400 }}>
                  If off, customers cannot break this locked saving before maturity unless support or admin approves that specific saving.
                </span>
              </span>
            </label>
          ) : null}
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="icon">Icon</label>
            <input id="icon" value={draft.icon} onChange={(e) => setDraft((p) => ({ ...p, icon: e.target.value }))} placeholder="wallet-outline" />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="iconColor">Icon color</label>
            <input id="iconColor" value={draft.iconColor} onChange={(e) => setDraft((p) => ({ ...p, iconColor: e.target.value }))} placeholder="#1F7A4D" />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem', gridColumn: '1 / -1' }}>
            <label htmlFor="shortDescription">Short description</label>
            <textarea
              id="shortDescription"
              rows={4}
              value={draft.shortDescription}
              onChange={(e) => setDraft((p) => ({ ...p, shortDescription: e.target.value }))}
              placeholder="Deposit and withdraw from wallet."
            />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <input id="active" type="checkbox" checked={draft.active} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
            Active
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Base Interest Rate"
        description={lockedDraft ? 'Base daily interest rate used as the fallback for new locked savings when no duration tier matches.' : 'Base daily interest rate for flexible open savings. Open savings is normally zero-interest unless admin configures an exception.'}
      >
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          {lockedDraft
            ? 'Applies per day. If tiers exist, backend uses the matching duration tier for new locked savings and falls back to the base rate only when no tier matches.'
            : 'Keep this at 0 for the standard open-savings setup, or set a negotiated exception rate when needed.'}
        </div>
      </SectionCard>

      <SectionCard
        title="Default Locked-Saving Interest Tiers"
        description="These are the starting daily rates for new locked savings based on lock duration."
      >
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Changes apply only to new savings. Existing savings keep the applied terms they were created with.
        </div>
        {!lockedDraft ? (
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Interest tiers are only available for <strong>LOCKED_SAVING</strong>.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {sortedDraftTiers.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>No duration tiers configured. Backend will fall back to the base interest rate.</div>
              ) : (
                sortedDraftTiers.map((tier, index) => (
                  <div
                    key={tier.id ?? `${tier.minLockDurationDays}-${tier.maxLockDurationDays}-${index}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr)) auto',
                      gap: '0.75rem',
                      alignItems: 'end',
                      padding: '0.85rem',
                      border: '1px solid var(--border)',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      <label htmlFor={`tier-min-${index}`}>From days</label>
                      <input
                        id={`tier-min-${index}`}
                        type="number"
                        min="1"
                        step="1"
                        value={tier.minLockDurationDays}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            interestTiers: sortedDraftTiers.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, minLockDurationDays: e.target.value } : entry
                            )
                          }))
                        }
                      />
                    </div>
                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      <label htmlFor={`tier-max-${index}`}>To days</label>
                      <input
                        id={`tier-max-${index}`}
                        type="number"
                        min="1"
                        step="1"
                        value={tier.maxLockDurationDays}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            interestTiers: sortedDraftTiers.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, maxLockDurationDays: e.target.value } : entry
                            )
                          }))
                        }
                        placeholder="Leave blank for final tier"
                      />
                    </div>
                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      <label htmlFor={`tier-interest-${index}`}>Daily interest %</label>
                      <input
                        id={`tier-interest-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={tier.interestPercentage}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            interestTiers: sortedDraftTiers.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, interestPercentage: e.target.value } : entry
                            )
                          }))
                        }
                      />
                      <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                        Applies per day. Longer lock periods can offer higher daily rates.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          interestTiers: sortedDraftTiers.filter((_, entryIndex) => entryIndex !== index)
                        }))
                      }
                    >
                      Remove tier
                    </button>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Tiers are sorted by From days. Overlapping bands or open-ended non-final tiers will be rejected before save. These seeded defaults are a starting commercial ladder, not fixed product law.
              </div>
              <button
                type="button"
                className="btn-neutral"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    interestTiers: [
                      ...sortedDraftTiers,
                      normalizeTierDraft({
                        minLockDurationDays:
                          sortedDraftTiers.length > 0
                            ? Number(sortedDraftTiers[sortedDraftTiers.length - 1].maxLockDurationDays || sortedDraftTiers[sortedDraftTiers.length - 1].minLockDurationDays) + 1
                            : prev.minimumLockDurationDays || '30',
                        maxLockDurationDays: '',
                        interestPercentage: ''
                      })
                    ]
                  }))
                }
              >
                Add tier
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Additional Fields"
        description="Raw JSON object for any backend product fields not yet modeled in the form. This keeps admin unblocked when the backend adds product properties."
      >
        <textarea
          value={draft.extraJson}
          onChange={(e) => setDraft((p) => ({ ...p, extraJson: e.target.value }))}
          rows={10}
          style={{ fontFamily: 'monospace' }}
        />
      </SectionCard>
    </div>
  );

  const detailRows = useMemo(() => {
    const base = selected
      ? [
          { label: 'ID', value: selected?.id },
          { label: 'Code', value: pickFirst(selected?.code, '—') },
          { label: 'Title', value: getProductName(selected) || '—' },
          { label: 'Short Description', value: pickFirst(selected?.shortDescription, selected?.description, '—') },
          { label: 'Interest Percentage', value: formatInterest(getInterestPercentage(selected)) },
          { label: 'Interest Type', value: pickFirst(selected?.interestType, '—') },
          {
            label: 'Minimum Lock Duration',
            value: isLockedSavingProduct(selected?.code) ? `${pickFirst(getMinimumLockDurationDays(selected), '—')} days` : 'Not applicable',
            hint: isLockedSavingProduct(selected?.code)
              ? 'Affects future locked savings creation validation only.'
              : 'Open savings can leave this null.'
          },
          {
            label: 'Interest Tiers',
            value: isLockedSavingProduct(selected?.code) ? `${Array.isArray(selected?.interestTiers) ? selected.interestTiers.length : 0} configured` : 'Not applicable',
            hint: isLockedSavingProduct(selected?.code)
              ? 'Changes apply only to new savings. Existing savings keep the applied terms they were created with.'
              : 'Duration tiers are hidden for open savings.'
          },
          {
            label: 'Early Withdrawal Policy',
            value: isLockedSavingProduct(selected?.code)
              ? Boolean(pickFirst(selected?.allowEarlyWithdrawalWithoutApproval, false))
                ? 'Allowed without support approval'
                : 'Support approval required'
              : 'Not applicable',
            hint: isLockedSavingProduct(selected?.code)
              ? 'This is the default product policy. Individual savings can still be approved as exceptions.'
              : 'Open savings stays customer-flexible by design.'
          },
          { label: 'Icon', value: pickFirst(selected?.icon, '—') },
          { label: 'Icon Color', value: pickFirst(selected?.iconColor, '—') },
          { label: 'Active', value: Boolean(pickFirst(selected?.active, false)) ? 'Yes' : 'No' }
        ]
      : [];
    return base;
  }, [selected]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SavingsSubnav />
      <SavingsPageHeader
        title="Savings Products"
        description="Full admin management for savings products. Open savings is flexible and normally non-interest-bearing, while locked savings is the default interest-bearing product with maturity-driven payout rules."
        actions={
          <button type="button" onClick={openCreate} className="btn-success">
            Add saving product
          </button>
        }
      />

      <SectionCard title="Search" description="Filter products by code, title, or active state.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="filter-code">Code</label>
            <input id="filter-code" value={filters.code} onChange={(e) => setFilters((p) => ({ ...p, code: e.target.value }))} placeholder="OPEN_SAVING" />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="filter-title">Title</label>
            <input id="filter-title" value={filters.title} onChange={(e) => setFilters((p) => ({ ...p, title: e.target.value }))} placeholder="Flexible Saver" />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="filter-active">Active</label>
            <select id="filter-active" value={filters.active} onChange={(e) => setFilters((p) => ({ ...p, active: e.target.value }))}>
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setPage(0);
              setAppliedFilters(filters);
            }}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Loading…' : 'Search'}
          </button>
          <button
            type="button"
            onClick={() => {
              const reset = { code: '', title: '', active: '' };
              setFilters(reset);
              setAppliedFilters(reset);
              setPage(0);
            }}
            className="btn-neutral"
          >
            Reset
          </button>
        </div>
      </SectionCard>

      <div className="card" style={{ color: 'var(--muted)', fontSize: '13px' }}>
        Managing {formatCount(totalElements)} saving products. Use `code` to align product behavior with mobile savings flows such as `OPEN_SAVING` and `LOCKED_SAVING`.
      </div>

      <SectionCard
        title="Commercial Defaults"
        description="These defaults shape how support should explain savings products to customers and when exceptions apply."
      >
        <div style={{ display: 'grid', gap: '0.35rem', color: 'var(--muted)', fontSize: '13px' }}>
          <div>Open savings is flexible and normally non-interest-bearing.</div>
          <div>Locked savings accrues daily interest that becomes payable only at maturity.</div>
          <div>If a customer breaks a locked saving early, accrued interest is forfeited.</div>
          <div>Negotiated exceptions can still be configured by admin where needed.</div>
        </div>
      </SectionCard>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

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
        emptyLabel="No saving products found"
      />

      {showCreate && (
        <AdminModal title="Add saving product" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </AdminModal>
      )}

      {showEdit && (
        <AdminModal title={`Edit saving product ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary">Save</button>
          </div>
        </AdminModal>
      )}

      {showDetail && (
        <AdminModal title={`Saving Product ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionCard title="Product Detail" description="Core fields used by the app and personal savings flows.">
              <DetailGrid rows={detailRows} />
            </SectionCard>
            {isLockedSavingProduct(selected?.code) ? (
              <SectionCard
                title="Default Locked-Saving Interest Tiers"
                description="Current daily-rate ladder for new locked savings. Existing savings keep the applied terms they were created with."
              >
                <DataTable
                  showIndex={false}
                  showAccountQuickNav={false}
                  pageSize={100}
                  columns={[
                    { key: 'minLockDurationDays', label: 'From days', render: (row) => pickFirst(row?.minLockDurationDays, '—') },
                    { key: 'maxLockDurationDays', label: 'To days', render: (row) => (row?.maxLockDurationDays === null || row?.maxLockDurationDays === undefined ? 'Open-ended' : row.maxLockDurationDays) },
                    { key: 'interestPercentage', label: 'Daily interest rate (%)', render: (row) => formatInterest(row?.interestPercentage) }
                  ]}
                  rows={Array.isArray(selected?.interestTiers) ? [...selected.interestTiers].sort((a, b) => Number(a?.minLockDurationDays || 0) - Number(b?.minLockDurationDays || 0)) : []}
                  emptyLabel="No duration tiers configured"
                />
              </SectionCard>
            ) : null}
            <SectionCard title="Full Resource JSON" description="Raw backend payload for this product.">
              <pre style={{ margin: 0, overflow: 'auto', background: 'color-mix(in srgb, var(--surface) 96%, var(--bg) 4%)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                {prettyJson(selected)}
              </pre>
            </SectionCard>
          </div>
        </AdminModal>
      )}

      {confirmDelete && (
        <AdminModal title="Confirm delete" onClose={() => setConfirmDelete(null)} width={560}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              Delete saving product <strong>{getProductName(confirmDelete) || confirmDelete.id}</strong>? This cannot be undone.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">Cancel</button>
              <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
