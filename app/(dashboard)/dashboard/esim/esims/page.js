'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  accountId: '',
  iccid: '',
  providerName: '',
  status: '',
  dataGB: '',
  dataString: '',
  validityDays: '',
  autoRenewable: false,
  countryCode: '',
  countryName: '',
  countryImage: '',
  countryImageWidth: '',
  countryImageHeight: '',
  operatorName: '',
  operatorImage: '',
  operatorImageWidth: '',
  operatorImageHeight: '',
  unlimited: false,
  roaming: false,
  rechargeable: false,
  speedAtThrottle: '',
  unThrottledDataPerDay: '',
  dataSpeeds: '',
  coveredCountries: '',
  supportedNetworks: '',
  activationCode: '',
  smdpAddress: '',
  qrCode: '',
  appleDirectInstallation: '',
  manualInstallation: '',
  qrCodeInstallation: '',
  installationGuide: '',
  offerId: '',
  profileStatus: ''
};

const toPayload = (state) => {
  const payload = {
    accountId: state.accountId === '' ? null : Number(state.accountId),
    iccid: state.iccid || null,
    providerName: state.providerName || null,
    status: state.status || null,
    dataGB: state.dataGB === '' ? null : Number(state.dataGB),
    dataString: state.dataString || null,
    validityDays: state.validityDays === '' ? null : Number(state.validityDays),
    autoRenewable: Boolean(state.autoRenewable),
    countryCode: state.countryCode || null,
    countryName: state.countryName || null,
    countryImage: state.countryImage || null,
    countryImageWidth: state.countryImageWidth === '' ? null : Number(state.countryImageWidth),
    countryImageHeight: state.countryImageHeight === '' ? null : Number(state.countryImageHeight),
    operatorName: state.operatorName || null,
    operatorImage: state.operatorImage || null,
    operatorImageWidth: state.operatorImageWidth === '' ? null : Number(state.operatorImageWidth),
    operatorImageHeight: state.operatorImageHeight === '' ? null : Number(state.operatorImageHeight),
    unlimited: Boolean(state.unlimited),
    roaming: Boolean(state.roaming),
    rechargeable: Boolean(state.rechargeable),
    speedAtThrottle: state.speedAtThrottle === '' ? null : Number(state.speedAtThrottle),
    unThrottledDataPerDay: state.unThrottledDataPerDay === '' ? null : Number(state.unThrottledDataPerDay),
    dataSpeeds: state.dataSpeeds ? state.dataSpeeds.split(',').map((s) => s.trim()).filter(Boolean) : null,
    coveredCountries: state.coveredCountries ? state.coveredCountries.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name })) : null,
    supportedNetworks: state.supportedNetworks ? state.supportedNetworks.split(',').map((s) => s.trim()).filter(Boolean) : null,
    activationCode: state.activationCode || null,
    smdpAddress: state.smdpAddress || null,
    qrCode: state.qrCode || null,
    appleDirectInstallation: state.appleDirectInstallation || null,
    manualInstallation: state.manualInstallation || null,
    qrCodeInstallation: state.qrCodeInstallation || null,
    installationGuide: state.installationGuide || null,
    offerId: state.offerId || null,
    profileStatus: state.profileStatus || null
  };
  return payload;
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>×</button>
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

export default function EsimsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [iccid, setIccid] = useState('');
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
      if (iccid) params.set('iccid', iccid);
      const res = await api.esims.list(params);
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

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'iccid', label: 'ICCID' },
    { key: 'providerName', label: 'Provider' },
    { key: 'status', label: 'Status' },
    { key: 'countryName', label: 'Country' },
    { key: 'dataString', label: 'Data' },
    { key: 'validityDays', label: 'Validity days' },
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
      accountId: row.accountId ?? '',
      iccid: row.iccid ?? '',
      providerName: row.providerName ?? '',
      status: row.status ?? '',
      dataGB: row.dataGB ?? '',
      dataString: row.dataString ?? '',
      validityDays: row.validityDays ?? '',
      autoRenewable: Boolean(row.autoRenewable),
      countryCode: row.countryCode ?? '',
      countryName: row.countryName ?? '',
      countryImage: row.countryImage ?? '',
      countryImageWidth: row.countryImageWidth ?? '',
      countryImageHeight: row.countryImageHeight ?? '',
      operatorName: row.operatorName ?? '',
      operatorImage: row.operatorImage ?? '',
      operatorImageWidth: row.operatorImageWidth ?? '',
      operatorImageHeight: row.operatorImageHeight ?? '',
      unlimited: Boolean(row.unlimited),
      roaming: Boolean(row.roaming),
      rechargeable: Boolean(row.rechargeable),
      speedAtThrottle: row.speedAtThrottle ?? '',
      unThrottledDataPerDay: row.unThrottledDataPerDay ?? '',
      dataSpeeds: Array.isArray(row.dataSpeeds) ? row.dataSpeeds.join(', ') : row.dataSpeeds ?? '',
      coveredCountries: Array.isArray(row.coveredCountries) ? row.coveredCountries.map((c) => c?.name || c).join(', ') : row.coveredCountries ?? '',
      supportedNetworks: Array.isArray(row.supportedNetworks) ? row.supportedNetworks.join(', ') : row.supportedNetworks ?? '',
      activationCode: row.activationCode ?? '',
      smdpAddress: row.smdpAddress ?? '',
      qrCode: row.qrCode ?? '',
      appleDirectInstallation: row.appleDirectInstallation ?? '',
      manualInstallation: row.manualInstallation ?? '',
      qrCodeInstallation: row.qrCodeInstallation ?? '',
      installationGuide: row.installationGuide ?? '',
      offerId: row.offerId ?? '',
      profileStatus: row.profileStatus ?? ''
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
    setError(null);
    setInfo(null);
    try {
      await api.esims.create(toPayload(draft));
      setInfo('Created eSIM.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.esims.update(selected.id, toPayload(draft));
      setInfo(`Updated eSIM ${selected.id}.`);
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
      await api.esims.remove(id);
      setInfo(`Deleted eSIM ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="accountId">Account ID</label>
        <input id="accountId" type="number" value={draft.accountId} onChange={(e) => setDraft((p) => ({ ...p, accountId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="iccid">ICCID</label>
        <input id="iccid" value={draft.iccid} onChange={(e) => setDraft((p) => ({ ...p, iccid: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerName">Provider</label>
        <input id="providerName" value={draft.providerName} onChange={(e) => setDraft((p) => ({ ...p, providerName: e.target.value }))} placeholder="AIRALO / E_SIM_GO ..." />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="status">Status</label>
        <input id="status" value={draft.status} onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))} placeholder="ACTIVE / INACTIVE ..." />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="dataGB">Data GB</label>
        <input id="dataGB" type="number" value={draft.dataGB} onChange={(e) => setDraft((p) => ({ ...p, dataGB: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="dataString">Data string</label>
        <input id="dataString" value={draft.dataString} onChange={(e) => setDraft((p) => ({ ...p, dataString: e.target.value }))} placeholder="e.g. 10GB" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="validityDays">Validity days</label>
        <input id="validityDays" type="number" value={draft.validityDays} onChange={(e) => setDraft((p) => ({ ...p, validityDays: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="autoRenewable" type="checkbox" checked={draft.autoRenewable} onChange={(e) => setDraft((p) => ({ ...p, autoRenewable: e.target.checked }))} />
        <label htmlFor="autoRenewable">Auto renewable</label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="countryCode">Country code</label>
        <input id="countryCode" value={draft.countryCode} onChange={(e) => setDraft((p) => ({ ...p, countryCode: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="countryName">Country name</label>
        <input id="countryName" value={draft.countryName} onChange={(e) => setDraft((p) => ({ ...p, countryName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="countryImage">Country image URL</label>
        <input id="countryImage" value={draft.countryImage} onChange={(e) => setDraft((p) => ({ ...p, countryImage: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="countryImageWidth">Country image width</label>
        <input id="countryImageWidth" type="number" value={draft.countryImageWidth} onChange={(e) => setDraft((p) => ({ ...p, countryImageWidth: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="countryImageHeight">Country image height</label>
        <input id="countryImageHeight" type="number" value={draft.countryImageHeight} onChange={(e) => setDraft((p) => ({ ...p, countryImageHeight: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="operatorName">Operator name</label>
        <input id="operatorName" value={draft.operatorName} onChange={(e) => setDraft((p) => ({ ...p, operatorName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="operatorImage">Operator image URL</label>
        <input id="operatorImage" value={draft.operatorImage} onChange={(e) => setDraft((p) => ({ ...p, operatorImage: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="operatorImageWidth">Operator image width</label>
        <input id="operatorImageWidth" type="number" value={draft.operatorImageWidth} onChange={(e) => setDraft((p) => ({ ...p, operatorImageWidth: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="operatorImageHeight">Operator image height</label>
        <input id="operatorImageHeight" type="number" value={draft.operatorImageHeight} onChange={(e) => setDraft((p) => ({ ...p, operatorImageHeight: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="unlimited" type="checkbox" checked={draft.unlimited} onChange={(e) => setDraft((p) => ({ ...p, unlimited: e.target.checked }))} />
        <label htmlFor="unlimited">Unlimited</label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="roaming" type="checkbox" checked={draft.roaming} onChange={(e) => setDraft((p) => ({ ...p, roaming: e.target.checked }))} />
        <label htmlFor="roaming">Roaming</label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="rechargeable" type="checkbox" checked={draft.rechargeable} onChange={(e) => setDraft((p) => ({ ...p, rechargeable: e.target.checked }))} />
        <label htmlFor="rechargeable">Rechargeable</label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="speedAtThrottle">Speed at throttle (kbps)</label>
        <input id="speedAtThrottle" type="number" value={draft.speedAtThrottle} onChange={(e) => setDraft((p) => ({ ...p, speedAtThrottle: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="unThrottledDataPerDay">Unthrottled data/day</label>
        <input id="unThrottledDataPerDay" type="number" value={draft.unThrottledDataPerDay} onChange={(e) => setDraft((p) => ({ ...p, unThrottledDataPerDay: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="dataSpeeds">Data speeds (comma separated)</label>
        <input id="dataSpeeds" value={draft.dataSpeeds} onChange={(e) => setDraft((p) => ({ ...p, dataSpeeds: e.target.value }))} placeholder="4G, 5G" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="coveredCountries">Covered countries (comma separated)</label>
        <input id="coveredCountries" value={draft.coveredCountries} onChange={(e) => setDraft((p) => ({ ...p, coveredCountries: e.target.value }))} placeholder="France, Germany" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="supportedNetworks">Supported networks (comma separated)</label>
        <input id="supportedNetworks" value={draft.supportedNetworks} onChange={(e) => setDraft((p) => ({ ...p, supportedNetworks: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="activationCode">Activation code</label>
        <input id="activationCode" value={draft.activationCode} onChange={(e) => setDraft((p) => ({ ...p, activationCode: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="smdpAddress">SM-DP+ address</label>
        <input id="smdpAddress" value={draft.smdpAddress} onChange={(e) => setDraft((p) => ({ ...p, smdpAddress: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="qrCode">QR code URL</label>
        <input id="qrCode" value={draft.qrCode} onChange={(e) => setDraft((p) => ({ ...p, qrCode: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="appleDirectInstallation">Apple direct install</label>
        <input id="appleDirectInstallation" value={draft.appleDirectInstallation} onChange={(e) => setDraft((p) => ({ ...p, appleDirectInstallation: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="manualInstallation">Manual installation</label>
        <input id="manualInstallation" value={draft.manualInstallation} onChange={(e) => setDraft((p) => ({ ...p, manualInstallation: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="qrCodeInstallation">QR code installation</label>
        <input id="qrCodeInstallation" value={draft.qrCodeInstallation} onChange={(e) => setDraft((p) => ({ ...p, qrCodeInstallation: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="installationGuide">Installation guide</label>
        <input id="installationGuide" value={draft.installationGuide} onChange={(e) => setDraft((p) => ({ ...p, installationGuide: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="offerId">Offer ID</label>
        <input id="offerId" value={draft.offerId} onChange={(e) => setDraft((p) => ({ ...p, offerId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="profileStatus">Profile status</label>
        <input id="profileStatus" value={draft.profileStatus} onChange={(e) => setDraft((p) => ({ ...p, profileStatus: e.target.value }))} placeholder="READY / ..." />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>eSIMs</div>
          <div style={{ color: 'var(--muted)' }}>Manage eSIMs (ICCID, status, country, data).</div>
        </div>
        <Link href="/dashboard/esim" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← eSIM hub
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="iccid">ICCID</label>
          <input id="iccid" value={iccid} onChange={(e) => setIccid(e.target.value)} placeholder="Search by ICCID" />
        </div>
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
          Add eSIM
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No eSIMs found" />

      {showCreate && (
        <Modal title="Add eSIM" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit eSIM ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Details ${selected?.iccid || selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Account ID', value: selected?.accountId },
              { label: 'ICCID', value: selected?.iccid },
              { label: 'Provider', value: selected?.providerName },
              { label: 'Status', value: selected?.status },
              { label: 'Data GB', value: selected?.dataGB },
              { label: 'Data string', value: selected?.dataString },
              { label: 'Validity days', value: selected?.validityDays },
              { label: 'Auto renewable', value: String(selected?.autoRenewable) },
              { label: 'Country', value: selected?.countryName || selected?.countryCode },
              { label: 'Country image', value: selected?.countryImage },
              { label: 'Operator', value: selected?.operatorName },
              { label: 'Operator image', value: selected?.operatorImage },
              { label: 'Unlimited', value: String(selected?.unlimited) },
              { label: 'Roaming', value: String(selected?.roaming) },
              { label: 'Rechargeable', value: String(selected?.rechargeable) },
              { label: 'Speed throttle', value: selected?.speedAtThrottle },
              { label: 'Unthrottled/day', value: selected?.unThrottledDataPerDay },
              { label: 'Data speeds', value: Array.isArray(selected?.dataSpeeds) ? selected.dataSpeeds.join(', ') : selected?.dataSpeeds },
              { label: 'Covered countries', value: Array.isArray(selected?.coveredCountries) ? selected.coveredCountries.map((c) => c?.name || c).join(', ') : selected?.coveredCountries },
              { label: 'Supported networks', value: Array.isArray(selected?.supportedNetworks) ? selected.supportedNetworks.join(', ') : selected?.supportedNetworks },
              { label: 'Activation code', value: selected?.activationCode },
              { label: 'SM-DP+ address', value: selected?.smdpAddress },
              { label: 'QR code', value: selected?.qrCode },
              { label: 'Apple direct install', value: selected?.appleDirectInstallation },
              { label: 'Manual installation', value: selected?.manualInstallation },
              { label: 'QR code installation', value: selected?.qrCodeInstallation },
              { label: 'Installation guide', value: selected?.installationGuide },
              { label: 'Offer ID', value: selected?.offerId },
              { label: 'Profile status', value: selected?.profileStatus },
              { label: 'Created', value: selected?.createdAt },
              { label: 'Updated', value: selected?.updatedAt }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete eSIM <strong>{confirmDelete.iccid || confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
