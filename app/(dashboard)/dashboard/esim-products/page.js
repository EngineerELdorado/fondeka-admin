'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  id: '',
  providerName: '',
  providerOfferId: '',
  name: '',
  countryIso2: '',
  region: '',
  roaming: false,
  dataGB: '',
  validityDays: '',
  cost: '',
  currency: '',
  description: '',
  supportedNetworks: '',
  smsUnlimited: false,
  dataUnlimited: false,
  callsUnlimited: false,
  dataSpeeds: '',
  throttledSpeedName: '',
  speedAtThrottle: '',
  unThrottledDataPerDay: '',
  dataString: '',
  voice: '',
  sms: '',
  countryImageUrl: '',
  countryImageWidth: '',
  countryImageHeight: '',
  operatorImageUrl: '',
  operatorImageWidth: '',
  operatorImageHeight: '',
  operatorName: '',
  scope: '',
  type: '',
  coveredCountries: '',
  rechargeable: false,
  active: true,
  requireKyc: false
};

const emptyFilters = {
  operator: '',
  country: '',
  region: '',
  speed: '',
  unlimited: '',
  rechargeable: '',
  scope: '',
  type: '',
  providerName: '',
  active: '',
  requireKyc: '',
  roaming: '',
  minDurationDays: '',
  maxDurationDays: '',
  minDataMb: '',
  maxDataMb: '',
  sort: ''
};

const splitList = (value) => {
  if (!value) return null;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const parseCoveredCountries = (value) => {
  const items = splitList(value);
  if (!items) return null;
  return items
    .map((item) => {
      const parts = item.split(':').map((part) => part.trim()).filter(Boolean);
      if (parts.length === 2) {
        return { name: parts[0], code: parts[1] };
      }
      if (parts.length === 1) {
        const token = parts[0];
        if (token.length === 2) return { name: token, code: token };
        return { name: token };
      }
      return null;
    })
    .filter(Boolean);
};

const formatCoveredCountries = (value) => {
  if (!Array.isArray(value) || value.length === 0) return '—';
  return value
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item;
      const name = item.name || item.code || '';
      const code = item.code && item.code !== name ? item.code : '';
      return code ? `${name} (${code})` : name;
    })
    .filter(Boolean)
    .join(', ');
};

const formatImage = (value) => {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  if (value?.url) {
    const dims = value.width || value.height ? ` (${value.width || '-'}x${value.height || '-'})` : '';
    return `${value.url}${dims}`;
  }
  return '—';
};

const toPayload = (state) => ({
  id: state.id || null,
  providerName: state.providerName || null,
  providerOfferId: state.providerOfferId || null,
  name: state.name || null,
  countryIso2: state.countryIso2 || null,
  region: state.region || null,
  roaming: Boolean(state.roaming),
  dataGB: state.dataGB === '' ? null : Number(state.dataGB),
  validityDays: state.validityDays === '' ? null : Number(state.validityDays),
  cost: state.cost === '' ? null : Number(state.cost),
  currency: state.currency || null,
  description: state.description || null,
  supportedNetworks: splitList(state.supportedNetworks),
  smsUnlimited: Boolean(state.smsUnlimited),
  dataUnlimited: Boolean(state.dataUnlimited),
  callsUnlimited: Boolean(state.callsUnlimited),
  dataSpeeds: splitList(state.dataSpeeds),
  throttledSpeedName: state.throttledSpeedName || null,
  speedAtThrottle: state.speedAtThrottle === '' ? null : Number(state.speedAtThrottle),
  unThrottledDataPerDay: state.unThrottledDataPerDay === '' ? null : Number(state.unThrottledDataPerDay),
  dataString: state.dataString || null,
  voice: state.voice === '' ? null : Number(state.voice),
  sms: state.sms === '' ? null : Number(state.sms),
  countryImage: state.countryImageUrl
    ? {
        url: state.countryImageUrl,
        width: state.countryImageWidth === '' ? null : Number(state.countryImageWidth),
        height: state.countryImageHeight === '' ? null : Number(state.countryImageHeight)
      }
    : null,
  operatorImage: state.operatorImageUrl
    ? {
        url: state.operatorImageUrl,
        width: state.operatorImageWidth === '' ? null : Number(state.operatorImageWidth),
        height: state.operatorImageHeight === '' ? null : Number(state.operatorImageHeight)
      }
    : null,
  operatorName: state.operatorName || null,
  scope: state.scope || null,
  type: state.type || null,
  coveredCountries: parseCoveredCountries(state.coveredCountries),
  rechargeable: Boolean(state.rechargeable),
  active: Boolean(state.active),
  requireKyc: Boolean(state.requireKyc)
});

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

export default function EsimProductsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [filters, setFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) params.set(key, String(value));
      });
      const res = await api.esimProducts.list(params);
      const list = Array.isArray(res) ? res : res?.items || res?.content || [];
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

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'providerName', label: 'Provider' },
    { key: 'countryIso2', label: 'Country' },
    { key: 'region', label: 'Region' },
    { key: 'dataGB', label: 'Data (GB)' },
    { key: 'validityDays', label: 'Days' },
    { key: 'cost', label: 'Cost' },
    { key: 'currency', label: 'Currency' },
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

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      id: row.id ?? '',
      providerName: row.providerName ?? '',
      providerOfferId: row.providerOfferId ?? '',
      name: row.name ?? '',
      countryIso2: row.countryIso2 ?? '',
      region: row.region ?? '',
      roaming: Boolean(row.roaming),
      dataGB: row.dataGB ?? '',
      validityDays: row.validityDays ?? '',
      cost: row.cost ?? '',
      currency: row.currency ?? '',
      description: row.description ?? '',
      supportedNetworks: Array.isArray(row.supportedNetworks) ? row.supportedNetworks.join(', ') : row.supportedNetworks ?? '',
      smsUnlimited: Boolean(row.smsUnlimited),
      dataUnlimited: Boolean(row.dataUnlimited),
      callsUnlimited: Boolean(row.callsUnlimited),
      dataSpeeds: Array.isArray(row.dataSpeeds) ? row.dataSpeeds.join(', ') : row.dataSpeeds ?? '',
      throttledSpeedName: row.throttledSpeedName ?? '',
      speedAtThrottle: row.speedAtThrottle ?? '',
      unThrottledDataPerDay: row.unThrottledDataPerDay ?? '',
      dataString: row.dataString ?? '',
      voice: row.voice ?? '',
      sms: row.sms ?? '',
      countryImageUrl: row.countryImage?.url ?? '',
      countryImageWidth: row.countryImage?.width ?? '',
      countryImageHeight: row.countryImage?.height ?? '',
      operatorImageUrl: row.operatorImage?.url ?? '',
      operatorImageWidth: row.operatorImage?.width ?? '',
      operatorImageHeight: row.operatorImage?.height ?? '',
      operatorName: row.operatorName ?? '',
      scope: row.scope ?? '',
      type: row.type ?? '',
      coveredCountries: Array.isArray(row.coveredCountries)
        ? row.coveredCountries.map((c) => (typeof c === 'string' ? c : c?.code ? `${c?.name || c.code}:${c.code}` : c?.name)).filter(Boolean).join(', ')
        : row.coveredCountries ?? '',
      rechargeable: Boolean(row.rechargeable),
      active: Boolean(row.active),
      requireKyc: Boolean(row.requireKyc)
    });
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

  const handleCreate = async () => {
    if (!draft.id) {
      setError('ID is required to create an eSIM product.');
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.esimProducts.create(toPayload(draft));
      setInfo('Created eSIM product.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    const nextId = draft.id || selected.id;
    if (draft.id && draft.id !== selected.id) {
      setError('ID in the form must match the selected product ID.');
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.esimProducts.update(nextId, toPayload({ ...draft, id: nextId }));
      setInfo(`Updated eSIM product ${nextId}.`);
      setShowEdit(false);
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
      await api.esimProducts.remove(id);
      setInfo(`Deleted eSIM product ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="id">ID</label>
        <input id="id" value={draft.id} onChange={(e) => setDraft((p) => ({ ...p, id: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerName">Provider name</label>
        <input id="providerName" value={draft.providerName} onChange={(e) => setDraft((p) => ({ ...p, providerName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerOfferId">Provider offer ID</label>
        <input id="providerOfferId" value={draft.providerOfferId} onChange={(e) => setDraft((p) => ({ ...p, providerOfferId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="name">Name</label>
        <input id="name" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="countryIso2">Country ISO2</label>
        <input id="countryIso2" value={draft.countryIso2} onChange={(e) => setDraft((p) => ({ ...p, countryIso2: e.target.value.toUpperCase() }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="region">Region</label>
        <input id="region" value={draft.region} onChange={(e) => setDraft((p) => ({ ...p, region: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="scope">Scope</label>
        <input id="scope" value={draft.scope} onChange={(e) => setDraft((p) => ({ ...p, scope: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="type">Type</label>
        <input id="type" value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="operatorName">Operator name</label>
        <input id="operatorName" value={draft.operatorName} onChange={(e) => setDraft((p) => ({ ...p, operatorName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="dataGB">Data GB</label>
        <input id="dataGB" type="number" value={draft.dataGB} onChange={(e) => setDraft((p) => ({ ...p, dataGB: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="validityDays">Validity days</label>
        <input id="validityDays" type="number" value={draft.validityDays} onChange={(e) => setDraft((p) => ({ ...p, validityDays: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="cost">Cost</label>
        <input id="cost" type="number" value={draft.cost} onChange={(e) => setDraft((p) => ({ ...p, cost: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="currency">Currency</label>
        <input id="currency" value={draft.currency} onChange={(e) => setDraft((p) => ({ ...p, currency: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="description">Description</label>
        <input id="description" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="dataString">Data string</label>
        <input id="dataString" value={draft.dataString} onChange={(e) => setDraft((p) => ({ ...p, dataString: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="voice">Voice</label>
        <input id="voice" type="number" value={draft.voice} onChange={(e) => setDraft((p) => ({ ...p, voice: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="sms">SMS</label>
        <input id="sms" type="number" value={draft.sms} onChange={(e) => setDraft((p) => ({ ...p, sms: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="supportedNetworks">Supported networks</label>
        <input id="supportedNetworks" value={draft.supportedNetworks} onChange={(e) => setDraft((p) => ({ ...p, supportedNetworks: e.target.value }))} placeholder="Orange, SFR" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="dataSpeeds">Data speeds</label>
        <input id="dataSpeeds" value={draft.dataSpeeds} onChange={(e) => setDraft((p) => ({ ...p, dataSpeeds: e.target.value }))} placeholder="4G, 5G" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="throttledSpeedName">Throttled speed name</label>
        <input id="throttledSpeedName" value={draft.throttledSpeedName} onChange={(e) => setDraft((p) => ({ ...p, throttledSpeedName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="speedAtThrottle">Speed at throttle</label>
        <input id="speedAtThrottle" type="number" value={draft.speedAtThrottle} onChange={(e) => setDraft((p) => ({ ...p, speedAtThrottle: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="unThrottledDataPerDay">Unthrottled data per day</label>
        <input id="unThrottledDataPerDay" type="number" value={draft.unThrottledDataPerDay} onChange={(e) => setDraft((p) => ({ ...p, unThrottledDataPerDay: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="coveredCountries">Covered countries</label>
        <input id="coveredCountries" value={draft.coveredCountries} onChange={(e) => setDraft((p) => ({ ...p, coveredCountries: e.target.value }))} placeholder="France:FR, Germany:DE" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="countryImageUrl">Country image URL</label>
        <input id="countryImageUrl" value={draft.countryImageUrl} onChange={(e) => setDraft((p) => ({ ...p, countryImageUrl: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label>Country image size</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input id="countryImageWidth" type="number" value={draft.countryImageWidth} onChange={(e) => setDraft((p) => ({ ...p, countryImageWidth: e.target.value }))} placeholder="W" />
          <input id="countryImageHeight" type="number" value={draft.countryImageHeight} onChange={(e) => setDraft((p) => ({ ...p, countryImageHeight: e.target.value }))} placeholder="H" />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="operatorImageUrl">Operator image URL</label>
        <input id="operatorImageUrl" value={draft.operatorImageUrl} onChange={(e) => setDraft((p) => ({ ...p, operatorImageUrl: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label>Operator image size</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input id="operatorImageWidth" type="number" value={draft.operatorImageWidth} onChange={(e) => setDraft((p) => ({ ...p, operatorImageWidth: e.target.value }))} placeholder="W" />
          <input id="operatorImageHeight" type="number" value={draft.operatorImageHeight} onChange={(e) => setDraft((p) => ({ ...p, operatorImageHeight: e.target.value }))} placeholder="H" />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="roaming" type="checkbox" checked={draft.roaming} onChange={(e) => setDraft((p) => ({ ...p, roaming: e.target.checked }))} />
        <label htmlFor="roaming">Roaming</label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="rechargeable" type="checkbox" checked={draft.rechargeable} onChange={(e) => setDraft((p) => ({ ...p, rechargeable: e.target.checked }))} />
        <label htmlFor="rechargeable">Rechargeable</label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="active" type="checkbox" checked={draft.active} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
        <label htmlFor="active">Active</label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="requireKyc" type="checkbox" checked={draft.requireKyc} onChange={(e) => setDraft((p) => ({ ...p, requireKyc: e.target.checked }))} />
        <label htmlFor="requireKyc">Require KYC</label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="smsUnlimited" type="checkbox" checked={draft.smsUnlimited} onChange={(e) => setDraft((p) => ({ ...p, smsUnlimited: e.target.checked }))} />
        <label htmlFor="smsUnlimited">SMS unlimited</label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="dataUnlimited" type="checkbox" checked={draft.dataUnlimited} onChange={(e) => setDraft((p) => ({ ...p, dataUnlimited: e.target.checked }))} />
        <label htmlFor="dataUnlimited">Data unlimited</label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="callsUnlimited" type="checkbox" checked={draft.callsUnlimited} onChange={(e) => setDraft((p) => ({ ...p, callsUnlimited: e.target.checked }))} />
        <label htmlFor="callsUnlimited">Calls unlimited</label>
      </div>
    </div>
  );

  const detailRows = selected
    ? [
        { label: 'ID', value: selected.id },
        { label: 'Provider', value: selected.providerName },
        { label: 'Provider offer ID', value: selected.providerOfferId },
        { label: 'Name', value: selected.name },
        { label: 'Country ISO2', value: selected.countryIso2 },
        { label: 'Region', value: selected.region },
        { label: 'Scope', value: selected.scope },
        { label: 'Type', value: selected.type },
        { label: 'Operator', value: selected.operatorName },
        { label: 'Roaming', value: selected.roaming ? 'Yes' : 'No' },
        { label: 'Rechargeable', value: selected.rechargeable ? 'Yes' : 'No' },
        { label: 'Active', value: selected.active ? 'Yes' : 'No' },
        { label: 'Require KYC', value: selected.requireKyc ? 'Yes' : 'No' },
        { label: 'Data GB', value: selected.dataGB },
        { label: 'Validity days', value: selected.validityDays },
        { label: 'Cost', value: selected.cost },
        { label: 'Currency', value: selected.currency },
        { label: 'Description', value: selected.description },
        { label: 'Data string', value: selected.dataString },
        { label: 'Voice', value: selected.voice },
        { label: 'SMS', value: selected.sms },
        { label: 'SMS unlimited', value: selected.smsUnlimited ? 'Yes' : 'No' },
        { label: 'Data unlimited', value: selected.dataUnlimited ? 'Yes' : 'No' },
        { label: 'Calls unlimited', value: selected.callsUnlimited ? 'Yes' : 'No' },
        { label: 'Supported networks', value: Array.isArray(selected.supportedNetworks) ? selected.supportedNetworks.join(', ') : selected.supportedNetworks },
        { label: 'Data speeds', value: Array.isArray(selected.dataSpeeds) ? selected.dataSpeeds.join(', ') : selected.dataSpeeds },
        { label: 'Throttled speed name', value: selected.throttledSpeedName },
        { label: 'Speed at throttle', value: selected.speedAtThrottle },
        { label: 'Unthrottled data per day', value: selected.unThrottledDataPerDay },
        { label: 'Covered countries', value: formatCoveredCountries(selected.coveredCountries) },
        { label: 'Country image', value: formatImage(selected.countryImage) },
        { label: 'Operator image', value: formatImage(selected.operatorImage) }
      ]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>eSIM Products</div>
          <div style={{ color: 'var(--muted)' }}>Manage the eSIM product catalog with filters and full record edits.</div>
        </div>
        <Link href="/dashboard/esim" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← eSIM hub
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Filters</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
            <button type="button" onClick={fetchRows} disabled={loading} className="btn-neutral btn-sm">
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
        {showFilters && (
          <>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label htmlFor="page">Page</label>
                <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
              </div>
              <div>
                <label htmlFor="size">Size</label>
                <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
              </div>
              <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
                {loading ? 'Loading…' : 'Apply filters'}
              </button>
              <button type="button" onClick={openCreate} className="btn-success">
                Add product
              </button>
              <button type="button" onClick={() => setFilters(emptyFilters)} className="btn-neutral">
                Clear filters
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.6rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterOperator">Operator</label>
                <input id="filterOperator" value={filters.operator} onChange={(e) => setFilters((p) => ({ ...p, operator: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterCountry">Country ISO2</label>
                <input id="filterCountry" value={filters.country} onChange={(e) => setFilters((p) => ({ ...p, country: e.target.value.toUpperCase() }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterRegion">Region</label>
                <input id="filterRegion" value={filters.region} onChange={(e) => setFilters((p) => ({ ...p, region: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterSpeed">Speed</label>
                <input id="filterSpeed" value={filters.speed} onChange={(e) => setFilters((p) => ({ ...p, speed: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterProvider">Provider name</label>
                <input id="filterProvider" value={filters.providerName} onChange={(e) => setFilters((p) => ({ ...p, providerName: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterScope">Scope</label>
                <input id="filterScope" value={filters.scope} onChange={(e) => setFilters((p) => ({ ...p, scope: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterType">Type</label>
                <input id="filterType" value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterActive">Active</label>
                <select id="filterActive" value={filters.active} onChange={(e) => setFilters((p) => ({ ...p, active: e.target.value }))}>
                  <option value="">Any</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterRoaming">Roaming</label>
                <select id="filterRoaming" value={filters.roaming} onChange={(e) => setFilters((p) => ({ ...p, roaming: e.target.value }))}>
                  <option value="">Any</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterRechargeable">Rechargeable</label>
                <select id="filterRechargeable" value={filters.rechargeable} onChange={(e) => setFilters((p) => ({ ...p, rechargeable: e.target.value }))}>
                  <option value="">Any</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterUnlimited">Unlimited</label>
                <select id="filterUnlimited" value={filters.unlimited} onChange={(e) => setFilters((p) => ({ ...p, unlimited: e.target.value }))}>
                  <option value="">Any</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterRequireKyc">Require KYC</label>
                <select id="filterRequireKyc" value={filters.requireKyc} onChange={(e) => setFilters((p) => ({ ...p, requireKyc: e.target.value }))}>
                  <option value="">Any</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterMinDuration">Min duration days</label>
                <input id="filterMinDuration" type="number" value={filters.minDurationDays} onChange={(e) => setFilters((p) => ({ ...p, minDurationDays: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterMaxDuration">Max duration days</label>
                <input id="filterMaxDuration" type="number" value={filters.maxDurationDays} onChange={(e) => setFilters((p) => ({ ...p, maxDurationDays: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterMinData">Min data MB</label>
                <input id="filterMinData" type="number" value={filters.minDataMb} onChange={(e) => setFilters((p) => ({ ...p, minDataMb: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterMaxData">Max data MB</label>
                <input id="filterMaxData" type="number" value={filters.maxDataMb} onChange={(e) => setFilters((p) => ({ ...p, maxDataMb: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterSort">Sort</label>
                <select id="filterSort" value={filters.sort} onChange={(e) => setFilters((p) => ({ ...p, sort: e.target.value }))}>
                  <option value="">Default (cost desc)</option>
                  <option value="cost.asc">Cost asc</option>
                  <option value="cost.desc">Cost desc</option>
                  <option value="price.asc">Price asc</option>
                  <option value="price.desc">Price desc</option>
                  <option value="data.asc">Data asc</option>
                  <option value="data.desc">Data desc</option>
                  <option value="days.asc">Days asc</option>
                  <option value="days.desc">Days desc</option>
                  <option value="speedAtThrottle.asc">Speed at throttle asc</option>
                  <option value="speedAtThrottle.desc">Speed at throttle desc</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#0f766e', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No products found" />

      {showCreate && (
        <Modal title="Add eSIM product" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title="Edit eSIM product" onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {showDetail && selected && (
        <Modal title="eSIM product details" onClose={() => setShowDetail(false)}>
          <DetailGrid rows={detailRows} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button type="button" onClick={() => setShowDetail(false)} className="btn-neutral">Close</button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete eSIM product" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>Delete product {confirmDelete.id}? This cannot be undone.</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
