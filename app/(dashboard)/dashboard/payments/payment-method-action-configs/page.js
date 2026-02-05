'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const actionOptions = [
  'FUND_WALLET',
  'WITHDRAW_FROM_WALLET',
  'REFUND_TO_WALLET',
  'BONUS',
  'MANUAL_ADJUSTMENT',
  'PAY_INTERNET_BILL',
  'PAY_TV_SUBSCRIPTION',
  'PAY_ELECTRICITY_BILL',
  'PAY_WATER_BILL',
  'LOAN_REQUEST',
  'LOAN_DISBURSEMENT',
  'REPAY_LOAN',
  'FUND_CARD',
  'WITHDRAW_FROM_CARD',
  'BUY_CARD',
  'CARD_ONLINE_PAYMENT',
  'CARD_MAINTENANCE',
  'BUY_CRYPTO',
  'SELL_CRYPTO',
  'RECEIVE_CRYPTO',
  'SEND_CRYPTO',
  'SWAP_CRYPTO',
  'REQUEST_PAYMENT',
  'PAY_REQUEST',
  'SETTLEMENT',
  'E_SIM_PURCHASE',
  'E_SIM_TOPUP',
  'SEND_AIRTIME',
  'SEND_DATA_BUNDLES',
  'BUY_GIFT_CARD',
  'PAY_NETFLIX',
  'INTER_TRANSFER',
  'OTHER'
].sort();

const paymentMethodTypeOptions = ['MOBILE_MONEY', 'CRYPTO', 'BALANCE', 'CREDIT', 'AIRTIME', 'BANK'];

const paymentMethodNameOptions = [
  'MPESA_DRC',
  'AIRTEL_MONEY_DRC',
  'ORANGE_MONEY_DRC',
  'AFRIMONEY_DRC',
  'BTC',
  'ETH',
  'USDT',
  'OTHER_CRYPTOS',
  'FONDEKA',
  'BANK',
  'CARD',
  'APPLE_PAY_OR_GOOGLE_PAY',
  'PAYPAL',
  'EQUITY_DRC',
  'BTC_LIGHTENING',
  'VODACOM_DRC',
  'AIRTEL_DRC',
  'ORANGE_DRC',
  'AFRICELL_DRC',
  'STABLECOINS',
  'USDC',
  'BNB',
  'SOL',
  'EURC',
  'INT_EURO_BANK_ACCOUNT',
  'INT_USD_BANK_ACCOUNT',
  'FONDEKA_BALANCE',
  'PAY_LATER',
  'AIRTIME_TOPUP'
].sort();

const emptyState = {
  action: '',
  countryCode: '',
  includeTypes: [],
  excludeTypes: [],
  includeNames: [],
  excludeNames: [],
  active: true,
  rank: 0
};

const normalizeList = (list) => (Array.isArray(list) && list.length ? list : null);

const toPayload = (state) => ({
  action: state.action || null,
  countryCode: state.countryCode ? state.countryCode.toUpperCase() : null,
  includeTypes: normalizeList(state.includeTypes),
  excludeTypes: normalizeList(state.excludeTypes),
  includeNames: normalizeList(state.includeNames),
  excludeNames: normalizeList(state.excludeNames),
  active: Boolean(state.active),
  rank: state.rank === '' ? 0 : Number(state.rank)
});

const toDraftFromRow = (row) => ({
  action: row.action ?? '',
  countryCode: row.countryCode ?? '',
  includeTypes: Array.isArray(row.includeTypes) ? row.includeTypes : [],
  excludeTypes: Array.isArray(row.excludeTypes) ? row.excludeTypes : [],
  includeNames: Array.isArray(row.includeNames) ? row.includeNames : [],
  excludeNames: Array.isArray(row.excludeNames) ? row.excludeNames : [],
  active: Boolean(row.active),
  rank: row.rank ?? 0
});

const toUpdatePayloadFromRow = (row, overrides = {}) => {
  const merged = { ...toDraftFromRow(row), ...overrides };
  return toPayload(merged);
};

const resolveScope = (row) => {
  if (row.action && row.countryCode) return 'Action + Country';
  if (row.action) return 'Action only';
  if (row.countryCode) return 'Country only';
  return 'Global';
};

const formatList = (list) => (Array.isArray(list) && list.length ? list.join(', ') : '—');

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button
          type="button"
          onClick={onClose}
          style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}
        >
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div
        key={row.label}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}
      >
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

const MultiSelect = ({ label, options, values, onChange, helperText }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
    <div style={{ fontWeight: 600 }}>{label}</div>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.35rem',
        maxHeight: '220px',
        overflow: 'auto',
        padding: '0.4rem',
        border: `1px solid var(--border)`,
        borderRadius: '10px',
        background: 'var(--panel, transparent)'
      }}
    >
      {options.map((option) => (
        <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '13px' }}>
          <input
            type="checkbox"
            checked={values.includes(option)}
            onChange={(e) => {
              const checked = e.target.checked;
              if (checked) {
                onChange([...values, option]);
              } else {
                onChange(values.filter((value) => value !== option));
              }
            }}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
    {helperText ? <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{helperText}</div> : null}
  </div>
);

export default function PaymentMethodActionConfigsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [arrangeBy, setArrangeBy] = useState('rank');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filters, setFilters] = useState({ action: '', countryCode: '', active: '' });
  const [appliedFilters, setAppliedFilters] = useState({ action: '', countryCode: '', active: '' });

  const typeConflicts = useMemo(
    () => draft.includeTypes.filter((type) => draft.excludeTypes.includes(type)),
    [draft.includeTypes, draft.excludeTypes]
  );
  const nameConflicts = useMemo(
    () => draft.includeNames.filter((name) => draft.excludeNames.includes(name)),
    [draft.includeNames, draft.excludeNames]
  );
  const countryCodeValid = useMemo(
    () => !draft.countryCode || /^[A-Z]{2,4}$/.test(draft.countryCode),
    [draft.countryCode]
  );

  const canSave = typeConflicts.length === 0 && nameConflicts.length === 0 && countryCodeValid;

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        params.set(key, String(value));
      });
      const res = await api.paymentMethodActionConfigs.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'scope', label: 'Scope', render: (row) => resolveScope(row) },
    { key: 'action', label: 'Action', render: (row) => row.action || '—' },
    { key: 'countryCode', label: 'Country', render: (row) => row.countryCode || '—' },
    { key: 'rank', label: 'Rank' },
    { key: 'active', label: 'Active' },
    { key: 'includeTypes', label: 'Include Types', render: (row) => formatList(row.includeTypes) },
    { key: 'excludeTypes', label: 'Exclude Types', render: (row) => formatList(row.excludeTypes) },
    { key: 'includeNames', label: 'Include Names', render: (row) => formatList(row.includeNames) },
    { key: 'excludeNames', label: 'Exclude Names', render: (row) => formatList(row.excludeNames) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral">Edit</button>
          <button type="button" onClick={() => handleQuickRank(row, 1)} className="btn-neutral">+1</button>
          <button type="button" onClick={() => handleQuickRank(row, -1)} className="btn-neutral">-1</button>
          <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger">Delete</button>
        </div>
      )
    }
  ], []);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    if (arrangeBy === 'action') {
      arr.sort((a, b) => (a.action || '').localeCompare(b.action || ''));
    } else if (arrangeBy === 'country') {
      arr.sort((a, b) => (a.countryCode || '').localeCompare(b.countryCode || ''));
    } else if (arrangeBy === 'scope') {
      arr.sort((a, b) => resolveScope(a).localeCompare(resolveScope(b)));
    } else if (arrangeBy === 'active') {
      arr.sort((a, b) => Number(b.active) - Number(a.active));
    } else {
      arr.sort((a, b) => Number(b.rank || 0) - Number(a.rank || 0));
    }
    return arr;
  }, [rows, arrangeBy]);

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft(toDraftFromRow(row));
    setShowEdit(true);
    setInfo(null);
    setError(null);
  };

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
  };

  const confirmScope = () => {
    if (!draft.action) {
      const ok = window.confirm('This rule is global for all actions. Continue?');
      if (!ok) return false;
    }
    if (draft.includeTypes.length || draft.includeNames.length) {
      const ok = window.confirm('Include lists will restrict allowed payment methods. Continue?');
      if (!ok) return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!canSave) return;
    if (!confirmScope()) return;
    setError(null);
    setInfo(null);
    try {
      await api.paymentMethodActionConfigs.create(toPayload(draft));
      setInfo('Created payment method action config.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id || !canSave) return;
    if (!confirmScope()) return;
    setError(null);
    setInfo(null);
    try {
      await api.paymentMethodActionConfigs.update(selected.id, toPayload(draft));
      setInfo(`Updated action config ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleQuickRank = async (row, delta) => {
    if (!row?.id) return;
    setError(null);
    setInfo(null);
    try {
      const nextRank = Number(row.rank || 0) + delta;
      await api.paymentMethodActionConfigs.update(row.id, toUpdatePayloadFromRow(row, { rank: nextRank }));
      setInfo(`Updated rank for ${row.id} to ${nextRank}.`);
      fetchRows();
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
      await api.paymentMethodActionConfigs.remove(id);
      setInfo(`Deleted action config ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="action">Action</label>
          <select id="action" value={draft.action} onChange={(e) => setDraft((p) => ({ ...p, action: e.target.value }))}>
            <option value="">Global (all actions)</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="countryCode">Country Code</label>
          <input
            id="countryCode"
            placeholder="CD"
            value={draft.countryCode}
            onChange={(e) => setDraft((p) => ({ ...p, countryCode: e.target.value.toUpperCase() }))}
          />
          <div style={{ fontSize: '12px', color: countryCodeValid ? 'var(--muted)' : 'var(--danger)' }}>
            {countryCodeValid ? 'Optional. 2-4 uppercase letters.' : 'Invalid country code.'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="rank">Rank</label>
          <input id="rank" type="number" value={draft.rank} onChange={(e) => setDraft((p) => ({ ...p, rank: e.target.value }))} />
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Higher rank is evaluated first.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input id="active" type="checkbox" checked={draft.active} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
          <label htmlFor="active">Active</label>
        </div>
      </div>

      <MultiSelect
        label="Include Types"
        options={paymentMethodTypeOptions}
        values={draft.includeTypes}
        onChange={(values) => setDraft((p) => ({ ...p, includeTypes: values }))}
        helperText={draft.includeTypes.length ? 'Only these types will be allowed.' : 'Leave empty for no type restriction.'}
      />
      <MultiSelect
        label="Exclude Types"
        options={paymentMethodTypeOptions}
        values={draft.excludeTypes}
        onChange={(values) => setDraft((p) => ({ ...p, excludeTypes: values }))}
        helperText="Excluded types are always removed."
      />
      {typeConflicts.length ? (
        <div style={{ color: 'var(--danger)', fontSize: '12px' }}>
          Include/exclude types conflict: {typeConflicts.join(', ')}
        </div>
      ) : null}

      <MultiSelect
        label="Include Names"
        options={paymentMethodNameOptions}
        values={draft.includeNames}
        onChange={(values) => setDraft((p) => ({ ...p, includeNames: values }))}
        helperText={draft.includeNames.length ? 'Only these names will be allowed.' : 'Leave empty for no name restriction.'}
      />
      <MultiSelect
        label="Exclude Names"
        options={paymentMethodNameOptions}
        values={draft.excludeNames}
        onChange={(values) => setDraft((p) => ({ ...p, excludeNames: values }))}
        helperText="Excluded names are always removed."
      />
      {nameConflicts.length ? (
        <div style={{ color: 'var(--danger)', fontSize: '12px' }}>
          Include/exclude names conflict: {nameConflicts.join(', ')}
        </div>
      ) : null}
    </div>
  );

  const applyFilters = () => {
    setAppliedFilters({
      action: filters.action,
      countryCode: filters.countryCode ? filters.countryCode.toUpperCase() : '',
      active: filters.active
    });
    setPage(0);
  };

  const resetFilters = () => {
    const cleared = { action: '', countryCode: '', active: '' };
    setFilters(cleared);
    setAppliedFilters(cleared);
    setPage(0);
  };

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (appliedFilters.action) chips.push({ key: 'action', label: `Action: ${appliedFilters.action}` });
    if (appliedFilters.countryCode) chips.push({ key: 'countryCode', label: `Country: ${appliedFilters.countryCode}` });
    if (appliedFilters.active !== '') chips.push({ key: 'active', label: `Active: ${appliedFilters.active === 'true' ? 'Yes' : 'No'}` });
    return chips;
  }, [appliedFilters]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Payment Method Action Configs</div>
          <div style={{ color: 'var(--muted)' }}>Control which payment methods are available per action and country.</div>
        </div>
        <Link href="/dashboard/payments" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Payments hub
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="size">Size</label>
          <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="arrangeBy">Arrange by</label>
          <select id="arrangeBy" value={arrangeBy} onChange={(e) => setArrangeBy(e.target.value)}>
            <option value="rank">Rank</option>
            <option value="action">Action</option>
            <option value="country">Country</option>
            <option value="scope">Scope</option>
            <option value="active">Active</option>
          </select>
        </div>
        <button type="button" className="btn-neutral" onClick={fetchRows} disabled={loading}>Refresh</button>
        <button type="button" className="btn-primary" onClick={openCreate}>Add rule</button>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterAction">Action</label>
            <select
              id="filterAction"
              value={filters.action}
              onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value }))}
            >
              <option value="">All actions</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterCountry">Country Code</label>
            <input
              id="filterCountry"
              placeholder="CD"
              value={filters.countryCode}
              onChange={(e) => setFilters((p) => ({ ...p, countryCode: e.target.value.toUpperCase() }))}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="filterActive">Active</label>
            <select
              id="filterActive"
              value={filters.active}
              onChange={(e) => setFilters((p) => ({ ...p, active: e.target.value }))}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn-neutral" onClick={applyFilters}>Apply</button>
            <button type="button" className="btn-neutral" onClick={resetFilters}>Reset</button>
          </div>
        </div>
        {activeFilterChips.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {activeFilterChips.map((chip) => (
              <span
                key={chip.key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.6rem',
                  background: 'var(--muted-bg, #f3f4f6)',
                  borderRadius: '999px',
                  fontSize: '13px',
                  color: 'var(--text)'
                }}
              >
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{error}</div> : null}
      {info ? <div className="card" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>{info}</div> : null}

      <DataTable columns={columns} rows={sortedRows} emptyLabel="No action configs found" />

      {showCreate ? (
        <Modal title="Add action config" onClose={() => setShowCreate(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {renderForm()}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-neutral" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleCreate} disabled={!canSave}>Save</button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showEdit ? (
        <Modal title={`Edit action config ${selected?.id}`} onClose={() => setShowEdit(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {renderForm()}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-neutral" onClick={() => setShowEdit(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleUpdate} disabled={!canSave}>Save changes</button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showDetail ? (
        <Modal title={`Action config ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <DetailGrid
              rows={[
                { label: 'Scope', value: resolveScope(selected || {}) },
                { label: 'Action', value: selected?.action || '—' },
                { label: 'Country', value: selected?.countryCode || '—' },
                { label: 'Include Types', value: formatList(selected?.includeTypes) },
                { label: 'Exclude Types', value: formatList(selected?.excludeTypes) },
                { label: 'Include Names', value: formatList(selected?.includeNames) },
                { label: 'Exclude Names', value: formatList(selected?.excludeNames) },
                { label: 'Rank', value: selected?.rank ?? '—' },
                { label: 'Active', value: selected?.active ? 'Yes' : 'No' }
              ]}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-neutral" onClick={() => setShowDetail(false)}>Close</button>
            </div>
          </div>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <Modal title="Delete action config" onClose={() => setConfirmDelete(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div>
              Delete action config <strong>{confirmDelete.id}</strong>? This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-neutral" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button type="button" className="btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
