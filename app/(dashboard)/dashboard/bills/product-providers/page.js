'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const giftCardKeys = ['SPOTIFY', 'APP_STORE', 'GOOGLE_PLAY', 'NETFLIX', 'APPLE', 'AIRBNB', 'UBER'];

const emptyState = {
  billProductId: '',
  billProviderId: '',
  rank: '',
  active: true,
  commissionPercentage: '',
  kwhPerUsd: '',
  cegawebProfileKey: '',
  reloadlyBillerId: '',
  reloadlyServiceType: '',
  reloadlyDenominationType: '',
  reloadlyRequiresInvoice: false
};

const emptyReloadlySearch = {
  id: '',
  name: '',
  type: '',
  serviceType: '',
  countryISOCode: ''
};

const normalizeProviderLabel = (provider) => String(provider?.name || provider?.displayName || '').toUpperCase();
const isReloadlyUtilitiesProviderLabel = (label) => label.includes('RELOADLY') && label.includes('UTIL');
const isReloadlyGiftCardProviderLabel = (label) => label.includes('RELOADLY') && !label.includes('UTIL');

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toPayload = (state) => ({
  billProductId: Number(state.billProductId) || 0,
  billProviderId: Number(state.billProviderId) || 0,
  rank: state.rank === '' ? null : Number(state.rank),
  commissionPercentage: state.commissionPercentage === '' ? null : Number(state.commissionPercentage),
  kwhPerUsd: state.kwhPerUsd === '' ? null : Number(state.kwhPerUsd),
  active: Boolean(state.active),
  cegawebProfileKey: state.cegawebProfileKey ? String(state.cegawebProfileKey) : null,
  reloadlyBillerId: toNumberOrNull(state.reloadlyBillerId),
  reloadlyServiceType: state.reloadlyServiceType ? String(state.reloadlyServiceType) : null,
  reloadlyDenominationType: state.reloadlyDenominationType ? String(state.reloadlyDenominationType) : null,
  reloadlyRequiresInvoice: state.reloadlyBillerId === '' ? null : Boolean(state.reloadlyRequiresInvoice)
});

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

const formatMoneyRange = (min, max) => {
  const minValue = min === null || min === undefined || min === '' ? null : min;
  const maxValue = max === null || max === undefined || max === '' ? null : max;
  if (minValue !== null && maxValue !== null) return `${minValue} - ${maxValue}`;
  if (minValue !== null) return `From ${minValue}`;
  if (maxValue !== null) return `Up to ${maxValue}`;
  return '—';
};

const formatFixedAmounts = (biller) => {
  const list = Array.isArray(biller?.fixedAmounts) ? biller.fixedAmounts : [];
  if (list.length === 0) return '—';
  return list
    .map((item) => item?.amount ?? item?.value ?? item?.providerAmountId ?? item?.id ?? item)
    .join(', ');
};

export default function BillProductProvidersPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [products, setProducts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [cegawebProfiles, setCegawebProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [seedingGiftCards, setSeedingGiftCards] = useState(false);
  const [reloadlyBillerSearch, setReloadlyBillerSearch] = useState(emptyReloadlySearch);
  const [reloadlyBillers, setReloadlyBillers] = useState([]);
  const [reloadlyBillersLoading, setReloadlyBillersLoading] = useState(false);
  const [selectedReloadlyBiller, setSelectedReloadlyBiller] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.billProductBillProviders.list(params);
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
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [prodRes, provRes, profilesRes] = await Promise.all([
          api.billProducts.list(new URLSearchParams({ page: '0', size: '200' })),
          api.billProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.cegawebProfiles.list(new URLSearchParams({ page: '0', size: '200' }))
        ]);
        const prodList = Array.isArray(prodRes) ? prodRes : prodRes?.content || [];
        const provList = Array.isArray(provRes) ? provRes : provRes?.content || [];
        const profileList = Array.isArray(profilesRes) ? profilesRes : profilesRes?.content || [];
        setProducts(prodList);
        setProviders(provList);
        setCegawebProfiles(profileList);
      } catch {
        // silent fail for option loading
      }
    };
    loadOptions();
  }, []);

  const selectedProduct = products.find((p) => String(p.id) === String(draft.billProductId));
  const selectedProvider = providers.find((p) => String(p.id) === String(draft.billProviderId));
  const selectedProductName = String(selectedProduct?.name || '').toUpperCase();
  const selectedProductCode = String(selectedProduct?.code || '').toUpperCase();
  const selectedProviderName = normalizeProviderLabel(selectedProvider);
  const reloadlyGiftCardProductSelected = giftCardKeys.includes(selectedProductName) || giftCardKeys.includes(selectedProductCode);
  const reloadlyUtilitiesProviderSelected = isReloadlyUtilitiesProviderLabel(selectedProviderName);
  const reloadlyProvider = providers.find((provider) => isReloadlyGiftCardProviderLabel(normalizeProviderLabel(provider)));
  const reloadlyUtilitiesProvider = providers.find((provider) => isReloadlyUtilitiesProviderLabel(normalizeProviderLabel(provider)));

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'billProductName', label: 'Product' },
    { key: 'billProviderName', label: 'Provider' },
    {
      key: 'reloadlyBillerId',
      label: 'Reloadly Utility',
      render: (row) => {
        if (!row?.reloadlyBillerId) return '—';
        return `${row.reloadlyBillerId} • ${row.reloadlyServiceType || '—'} • ${row.reloadlyDenominationType || '—'}`;
      }
    },
    { key: 'cegawebProfileKey', label: 'CegaWeb profile' },
    { key: 'rank', label: 'Rank' },
    {
      key: 'commissionPercentage',
      label: 'Commission (%)',
      render: (row) => (row.commissionPercentage === null || row.commissionPercentage === undefined ? '—' : row.commissionPercentage)
    },
    {
      key: 'kwhPerUsd',
      label: 'kWh/USD',
      render: (row) => (row.kwhPerUsd === null || row.kwhPerUsd === undefined ? '—' : row.kwhPerUsd)
    },
    { key: 'active', label: 'Active' },
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
  ], []);

  const resetReloadlyUtilitiesState = () => {
    setReloadlyBillerSearch(emptyReloadlySearch);
    setReloadlyBillers([]);
    setSelectedReloadlyBiller(null);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setDraft(emptyState);
    resetReloadlyUtilitiesState();
  };

  const closeEdit = () => {
    setShowEdit(false);
    setDraft(emptyState);
    setSelected(null);
    resetReloadlyUtilitiesState();
  };

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
    resetReloadlyUtilitiesState();
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      billProductId: row.billProductId ?? '',
      billProviderId: row.billProviderId ?? '',
      rank: row.rank ?? '',
      commissionPercentage: row.commissionPercentage ?? '',
      kwhPerUsd: row.kwhPerUsd ?? '',
      active: Boolean(row.active),
      cegawebProfileKey: row.cegawebProfileKey ?? '',
      reloadlyBillerId: row.reloadlyBillerId ?? '',
      reloadlyServiceType: row.reloadlyServiceType ?? '',
      reloadlyDenominationType: row.reloadlyDenominationType ?? '',
      reloadlyRequiresInvoice: Boolean(row.reloadlyRequiresInvoice)
    });
    setShowEdit(true);
    setInfo(null);
    setError(null);
    setReloadlyBillerSearch(emptyReloadlySearch);
    setReloadlyBillers([]);
    setSelectedReloadlyBiller(
      row.reloadlyBillerId
        ? {
            id: row.reloadlyBillerId,
            name: row.reloadlyBillerName || 'Mapped biller',
            countryCode: row.reloadlyCountryCode || '',
            countryName: row.reloadlyCountryName || '',
            type: row.reloadlyBillerType || '',
            serviceType: row.reloadlyServiceType || '',
            denominationType: row.reloadlyDenominationType || '',
            requiresInvoice: row.reloadlyRequiresInvoice,
            localMinAmount: row.reloadlyLocalMinAmount,
            localMaxAmount: row.reloadlyLocalMaxAmount,
            internationalMinAmount: row.reloadlyInternationalMinAmount,
            internationalMaxAmount: row.reloadlyInternationalMaxAmount,
            fixedAmounts: row.reloadlyFixedAmounts || []
          }
        : null
    );
  };

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
  };

  const validateDraft = () => {
    if (!draft.billProductId) return 'Select a bill product.';
    if (!draft.billProviderId) return 'Select a bill provider.';
    if (reloadlyUtilitiesProviderSelected) {
      if (!draft.reloadlyBillerId) return 'Select a Reloadly utility biller before saving this mapping.';
      if (!draft.reloadlyServiceType || !draft.reloadlyDenominationType) return 'Reloadly utility fields must come from the selected biller.';
    }
    return null;
  };

  const handleCreate = async () => {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.billProductBillProviders.create(toPayload(draft));
      setInfo('Created mapping.');
      closeCreate();
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.billProductBillProviders.update(selected.id, toPayload(draft));
      setInfo(`Updated mapping ${selected.id}.`);
      closeEdit();
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
      await api.billProductBillProviders.remove(id);
      setInfo(`Deleted mapping ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const searchReloadlyBillers = async () => {
    setReloadlyBillersLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(reloadlyBillerSearch).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.set(key, String(value));
        }
      });
      const res = await api.billProductBillProviders.searchReloadlyUtilitiesBillers(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setReloadlyBillers(list || []);
    } catch (err) {
      setReloadlyBillers([]);
      setError(err.message || 'Failed to search Reloadly billers');
    } finally {
      setReloadlyBillersLoading(false);
    }
  };

  const handleSelectReloadlyBiller = (biller) => {
    setSelectedReloadlyBiller(biller);
    setDraft((prev) => ({
      ...prev,
      billProviderId: reloadlyUtilitiesProvider ? String(reloadlyUtilitiesProvider.id) : prev.billProviderId,
      reloadlyBillerId: biller?.id ?? '',
      reloadlyServiceType: biller?.serviceType || '',
      reloadlyDenominationType: biller?.denominationType || '',
      reloadlyRequiresInvoice: Boolean(biller?.requiresInvoice)
    }));
    setInfo(`Selected Reloadly biller ${biller?.name || biller?.id}. Mapping fields were prefilled from backend metadata.`);
  };

  const handleSeedGiftCards = async () => {
    setError(null);
    setInfo(null);
    setSeedingGiftCards(true);
    try {
      const provider = providers.find((p) => isReloadlyGiftCardProviderLabel(normalizeProviderLabel(p)));
      if (!provider) {
        throw new Error('RELOADLY bill provider is missing. Create/enable RELOADLY provider first.');
      }

      const targets = [
        { name: 'NETFLIX', displayName: 'Netflix' },
        { name: 'SPOTIFY', displayName: 'Spotify' },
        { name: 'APP_STORE', displayName: 'Apple' },
        { name: 'GOOGLE_PLAY', displayName: 'Google Play' },
        { name: 'AIRBNB', displayName: 'Airbnb' },
        { name: 'UBER', displayName: 'Uber' }
      ];

      let createdProducts = 0;
      let createdMappings = 0;

      for (const target of targets) {
        let product = products.find(
          (p) => String(p?.name || '').toUpperCase() === target.name || String(p?.code || '').toUpperCase() === target.name
        );
        if (!product) {
          const productType = ['AIRBNB', 'UBER'].includes(target.name) ? 'TRAVELLING' : 'ENTERTAINMENT';
          const created = await api.billProducts.create({
            name: target.name,
            code: target.name,
            displayName: target.displayName,
            type: productType,
            giftCard: true,
            logoUrl: null,
            countryIds: [],
            rank: null,
            active: true,
            available: true
          });
          product = created;
          createdProducts += 1;
        }

        const existingMapping = rows.find(
          (row) => String(row.billProductId) === String(product?.id) && String(row.billProviderId) === String(provider.id)
        );
        if (!existingMapping) {
          try {
            await api.billProductBillProviders.create({
              billProductId: Number(product?.id),
              billProviderId: Number(provider.id),
              rank: null,
              commissionPercentage: null,
              kwhPerUsd: null,
              active: true,
              cegawebProfileKey: null
            });
            createdMappings += 1;
          } catch (mappingErr) {
            const msg = String(mappingErr?.message || '');
            if (!msg.toLowerCase().includes('already') && !msg.toLowerCase().includes('exists') && !msg.toLowerCase().includes('duplicate')) {
              throw mappingErr;
            }
          }
        }
      }

      setInfo(`Gift-card seed complete: ${createdProducts} product(s) created, ${createdMappings} mapping(s) created. NETFLIX, SPOTIFY, APP_STORE, GOOGLE_PLAY, AIRBNB, and UBER are ready on RELOADLY.`);
      await fetchRows();
      const [prodRes, provRes] = await Promise.all([
        api.billProducts.list(new URLSearchParams({ page: '0', size: '200' })),
        api.billProviders.list(new URLSearchParams({ page: '0', size: '200' }))
      ]);
      setProducts(Array.isArray(prodRes) ? prodRes : prodRes?.content || []);
      setProviders(Array.isArray(provRes) ? provRes : provRes?.content || []);
    } catch (err) {
      setError(err.message || 'Failed to seed gift-card mappings');
    } finally {
      setSeedingGiftCards(false);
    }
  };

  const renderReloadlyUtilitiesSearch = () => (
    <>
      <div style={{ gridColumn: '1 / -1', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.8rem', display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>Search Reloadly biller</div>
          <button type="button" className="btn-neutral btn-sm" onClick={searchReloadlyBillers} disabled={reloadlyBillersLoading}>
            {reloadlyBillersLoading ? 'Searching…' : 'Search billers'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="reloadlyBillerIdSearch">Biller ID</label>
            <input id="reloadlyBillerIdSearch" value={reloadlyBillerSearch.id} onChange={(e) => setReloadlyBillerSearch((prev) => ({ ...prev, id: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="reloadlyBillerNameSearch">Name</label>
            <input id="reloadlyBillerNameSearch" value={reloadlyBillerSearch.name} onChange={(e) => setReloadlyBillerSearch((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="reloadlyBillerTypeSearch">Type</label>
            <input id="reloadlyBillerTypeSearch" value={reloadlyBillerSearch.type} onChange={(e) => setReloadlyBillerSearch((prev) => ({ ...prev, type: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="reloadlyServiceTypeSearch">Service Type</label>
            <input id="reloadlyServiceTypeSearch" value={reloadlyBillerSearch.serviceType} onChange={(e) => setReloadlyBillerSearch((prev) => ({ ...prev, serviceType: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="reloadlyCountrySearch">Country ISO</label>
            <input id="reloadlyCountrySearch" value={reloadlyBillerSearch.countryISOCode} onChange={(e) => setReloadlyBillerSearch((prev) => ({ ...prev, countryISOCode: e.target.value }))} />
          </div>
        </div>
        {reloadlyBillers.length > 0 && (
          <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
            {reloadlyBillers.map((biller) => {
              const isSelected = String(selectedReloadlyBiller?.id) === String(biller?.id);
              return (
                <button
                  key={biller.id}
                  type="button"
                  onClick={() => handleSelectReloadlyBiller(biller)}
                  style={{
                    display: 'grid',
                    gap: '0.25rem',
                    textAlign: 'left',
                    padding: '0.7rem',
                    borderRadius: '10px',
                    border: `1px solid ${isSelected ? '#60a5fa' : 'var(--border)'}`,
                    background: isSelected ? '#eff6ff' : 'var(--surface)',
                    color: 'var(--text)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{biller.name || `Biller #${biller.id}`}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    #{biller.id} {biller.countryName ? `• ${biller.countryName}` : ''} {biller.serviceType ? `• ${biller.serviceType}` : ''} {biller.denominationType ? `• ${biller.denominationType}` : ''}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {reloadlyBillers.length === 0 && !reloadlyBillersLoading && (
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Search by name, country, type, service type, or exact biller id.</div>
        )}
      </div>

      <div style={{ gridColumn: '1 / -1', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.8rem', display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 700 }}>Reloadly biller preview</div>
        <DetailGrid
          rows={[
            { label: 'Biller', value: selectedReloadlyBiller?.name || '—' },
            { label: 'Biller ID', value: draft.reloadlyBillerId || '—' },
            { label: 'Country', value: [selectedReloadlyBiller?.countryName, selectedReloadlyBiller?.countryCode].filter(Boolean).join(' ') || '—' },
            { label: 'Type', value: selectedReloadlyBiller?.type || '—' },
            { label: 'Service type', value: draft.reloadlyServiceType || '—' },
            { label: 'Denomination', value: draft.reloadlyDenominationType || '—' },
            { label: 'Requires invoice', value: draft.reloadlyBillerId === '' ? '—' : draft.reloadlyRequiresInvoice ? 'Yes' : 'No' },
            { label: 'Local amount range', value: formatMoneyRange(selectedReloadlyBiller?.localMinAmount, selectedReloadlyBiller?.localMaxAmount) },
            { label: 'International amount range', value: formatMoneyRange(selectedReloadlyBiller?.internationalMinAmount, selectedReloadlyBiller?.internationalMaxAmount) }
          ]}
        />
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Fixed amounts: {formatFixedAmounts(selectedReloadlyBiller)}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {draft.reloadlyDenominationType && <span style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', border: '1px solid var(--border)', fontSize: '12px', fontWeight: 700 }}>{draft.reloadlyDenominationType}</span>}
          {draft.reloadlyServiceType && <span style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', border: '1px solid var(--border)', fontSize: '12px', fontWeight: 700 }}>{draft.reloadlyServiceType}</span>}
          {draft.reloadlyRequiresInvoice && <span style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: '12px', fontWeight: 700 }}>INVOICE REQUIRED</span>}
        </div>
        <div style={{ display: 'grid', gap: '0.35rem', fontSize: '12px', color: 'var(--muted)' }}>
          {draft.reloadlyDenominationType === 'FIXED' && <div>Client payments for this biller must use `amountId` from backend offers.</div>}
          {draft.reloadlyDenominationType === 'RANGE' && <div>Client payments for this biller require manual amount entry.</div>}
          {draft.reloadlyRequiresInvoice && <div>Client payments for this biller must include `invoiceId`.</div>}
        </div>
      </div>
    </>
  );

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="billProductId">Bill Product</label>
        <select id="billProductId" value={draft.billProductId} onChange={(e) => setDraft((prev) => ({ ...prev, billProductId: e.target.value }))}>
          <option value="">Select product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName || p.name || p.id}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="billProviderId">Bill Provider</label>
        <select
          id="billProviderId"
          value={draft.billProviderId}
          onChange={(e) => {
            const nextProviderId = e.target.value;
            const nextProvider = providers.find((prov) => String(prov.id) === String(nextProviderId));
            const nextLabel = normalizeProviderLabel(nextProvider);
            setDraft((prev) => ({
              ...prev,
              billProviderId: nextProviderId,
              ...(isReloadlyUtilitiesProviderLabel(nextLabel)
                ? {}
                : {
                    reloadlyBillerId: '',
                    reloadlyServiceType: '',
                    reloadlyDenominationType: '',
                    reloadlyRequiresInvoice: false
                  })
            }));
            if (!isReloadlyUtilitiesProviderLabel(nextLabel)) {
              resetReloadlyUtilitiesState();
            }
          }}
        >
          <option value="">Select provider</option>
          {providers.map((prov) => (
            <option key={prov.id} value={prov.id}>
              {prov.name || prov.displayName || prov.id}
            </option>
          ))}
        </select>
        {reloadlyGiftCardProductSelected && (
          <div
            style={{
              marginTop: '0.35rem',
              padding: '0.45rem 0.6rem',
              borderRadius: '8px',
              fontSize: '12px',
              background: isReloadlyGiftCardProviderLabel(selectedProviderName) ? '#ecfdf3' : '#fff7ed',
              color: isReloadlyGiftCardProviderLabel(selectedProviderName) ? '#166534' : '#9a3412',
              border: `1px solid ${isReloadlyGiftCardProviderLabel(selectedProviderName) ? '#bbf7d0' : '#fed7aa'}`
            }}
          >
            This gift card product uses the Reloadly gift-card flow. Select provider <strong>RELOADLY</strong>.
            {!isReloadlyGiftCardProviderLabel(selectedProviderName) && reloadlyProvider && (
              <button
                type="button"
                className="btn-neutral"
                onClick={() => setDraft((prev) => ({ ...prev, billProviderId: String(reloadlyProvider.id) }))}
                style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '12px' }}
              >
                Use RELOADLY
              </button>
            )}
          </div>
        )}
        {reloadlyUtilitiesProviderSelected && (
          <div style={{ marginTop: '0.35rem', padding: '0.45rem 0.6rem', borderRadius: '8px', fontSize: '12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
            Reloadly utility mappings must come from a searched biller. Do not type biller metadata manually.
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="cegawebProfileKey">CegaWeb profile</label>
        <select id="cegawebProfileKey" value={draft.cegawebProfileKey} onChange={(e) => setDraft((prev) => ({ ...prev, cegawebProfileKey: e.target.value }))}>
          <option value="">Inherit provider</option>
          {cegawebProfiles.map((profile) => (
            <option key={profile.id ?? profile.profileKey} value={profile.profileKey}>
              {profile.profileKey}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rank">Rank</label>
        <input id="rank" type="number" value={draft.rank} onChange={(e) => setDraft((prev) => ({ ...prev, rank: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="commissionPercentage">Commission (%)</label>
        <input id="commissionPercentage" type="number" step="0.01" value={draft.commissionPercentage} onChange={(e) => setDraft((prev) => ({ ...prev, commissionPercentage: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="kwhPerUsd">kWh per USD</label>
        <input id="kwhPerUsd" type="number" step="0.0001" value={draft.kwhPerUsd} onChange={(e) => setDraft((prev) => ({ ...prev, kwhPerUsd: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="active" type="checkbox" checked={draft.active} onChange={(e) => setDraft((prev) => ({ ...prev, active: e.target.checked }))} />
        <label htmlFor="active">Active</label>
      </div>
      {reloadlyUtilitiesProviderSelected && renderReloadlyUtilitiesSearch()}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Bill Product ↔ Provider</div>
          <div style={{ color: '#6b7280' }}>Manage mapping with rank, active flag, and provider-specific metadata.</div>
        </div>
        <Link href="/dashboard/bills" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid #e5e7eb', textDecoration: 'none', color: '#0f172a' }}>
          ← Bills hub
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
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button type="button" onClick={openCreate} className="btn-success">
          Add mapping
        </button>
        <button type="button" onClick={handleSeedGiftCards} className="btn-neutral" disabled={seedingGiftCards}>
          {seedingGiftCards ? 'Seeding gift cards…' : 'Seed Gift Card Mappings'}
        </button>
      </div>

      <div className="card" style={{ color: 'var(--muted)', fontSize: '13px' }}>
        Reloadly Utilities is a separate mapping flow from Reloadly gift cards. Search the backend biller catalog, review denomination and invoice constraints, then save the internal bill product against provider <strong>RELOADLY_UTILITIES</strong>.
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No mappings found" />

      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Add mapping</div>
              <button type="button" onClick={closeCreate} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>×</button>
            </div>
            {renderForm()}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeCreate} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
                Cancel
              </button>
              <button type="button" onClick={handleCreate} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#22c55e', color: '#fff' }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Edit mapping {selected?.id}</div>
              <button type="button" onClick={closeEdit} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>×</button>
            </div>
            {renderForm()}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeEdit} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
                Cancel
              </button>
              <button type="button" onClick={handleUpdate} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#f97316', color: '#fff' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetail && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Details {selected?.id}</div>
              <button type="button" onClick={() => setShowDetail(false)} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>×</button>
            </div>
            <DetailGrid
              rows={[
                { label: 'ID', value: selected?.id },
                { label: 'Product', value: selected?.billProductName || selected?.billProductId },
                { label: 'Provider', value: selected?.billProviderName || selected?.billProviderId },
                { label: 'Reloadly biller ID', value: selected?.reloadlyBillerId ?? '—' },
                { label: 'Reloadly service type', value: selected?.reloadlyServiceType ?? '—' },
                { label: 'Reloadly denomination', value: selected?.reloadlyDenominationType ?? '—' },
                { label: 'Reloadly requires invoice', value: selected?.reloadlyRequiresInvoice === null || selected?.reloadlyRequiresInvoice === undefined ? '—' : selected?.reloadlyRequiresInvoice ? 'Yes' : 'No' },
                { label: 'CegaWeb profile', value: selected?.cegawebProfileKey || '—' },
                { label: 'Rank', value: selected?.rank },
                { label: 'Commission (%)', value: selected?.commissionPercentage ?? '—' },
                { label: 'kWh per USD', value: selected?.kwhPerUsd ?? '—' },
                { label: 'Active', value: selected?.active ? 'Yes' : 'No' },
                { label: 'Created at', value: selected?.createdAt },
                { label: 'Updated at', value: selected?.updatedAt }
              ]}
            />
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ gap: '0.6rem' }}>
            <div style={{ fontWeight: 800 }}>Confirm delete</div>
            <div style={{ color: 'var(--muted)' }}>
              Delete mapping for <strong>{confirmDelete.billProductName || confirmDelete.billProductId}</strong> → <strong>{confirmDelete.billProviderName || confirmDelete.billProviderId}</strong>? This cannot be undone.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setConfirmDelete(null)} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
                Cancel
              </button>
              <button type="button" onClick={handleDelete} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#b91c1c', color: '#fff' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
