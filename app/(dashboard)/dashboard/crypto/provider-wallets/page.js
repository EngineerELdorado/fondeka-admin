'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { DataTable } from '@/components/DataTable';

import { collectionWalletFields as fields, collectionWalletDraft, collectionWalletPayload } from '@/lib/crypto-provider-wallets';

export default function CryptoProviderWalletsPage() {
  const { session } = useAuth();
  const canManage = useMemo(() => [session?.tokens?.idToken?.payload, session?.tokens?.accessToken?.payload].some((payload) => {
    const role = payload?.role || payload?.adminRole || payload?.['custom:role'];
    const groups = payload?.['cognito:groups'];
    return String(role || '').toUpperCase() === 'SUPER_ADMIN' || (Array.isArray(groups) ? groups : String(groups || '').split(',')).some((group) => String(group).trim().toUpperCase() === 'SUPER_ADMIN');
  }), [session]);
  const [rows, setRows] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [page, setPage] = useState(0);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [draft, setDraft] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reading, setReading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [requiresReload, setRequiresReload] = useState(false);
  const [pairsLoading, setPairsLoading] = useState(false);
  const [pairsError, setPairsError] = useState('');
  const saveLock = useRef(false), listRequest = useRef(0), detailRequest = useRef(0), mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; listRequest.current += 1; detailRequest.current += 1; };
  }, []);

  async function load() {
    const request = ++listRequest.current;
    setLoading(true); setError('');
    try {
      const result = await api.cryptoProviderWalletConfigs.list(new URLSearchParams({ page: String(page), size: '20' }));
      if (!mounted.current || request !== listRequest.current) return;
      const list = Array.isArray(result) ? result : result?.content;
      if (!Array.isArray(list)) throw new Error('The collection wallet list could not be read.');
      const nextMeta = Array.isArray(result) ? { totalPages: 1, totalElements: list.length } : result.page || result;
      if (page > 0 && !list.length && Number.isInteger(nextMeta.totalPages) && page >= nextMeta.totalPages) {
        setPage(Math.max(0, nextMeta.totalPages - 1)); return;
      }
      setRows(list); setMeta(nextMeta); setLoaded(true);
    } catch (failure) {
      if (mounted.current && request === listRequest.current) setError(failure.status === 404 ? 'Collection wallet management is unavailable on this backend. Deploy its schema and API support first.' : failure.message || 'Unable to load collection wallets.');
    } finally { if (mounted.current && request === listRequest.current) setLoading(false); }
  }
  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  async function loadPairs() {
    setPairsLoading(true); setPairsError('');
    try { const result = await api.cryptoProductCryptoNetworks.options(); if (mounted.current) setPairs(result); }
    catch (failure) { if (mounted.current) setPairsError(failure.message || 'Unable to load crypto / network choices.'); }
    finally { if (mounted.current) setPairsLoading(false); }
  }
  useEffect(() => { if (canManage) loadPairs(); }, [canManage]); // eslint-disable-line react-hooks/exhaustive-deps

  function close() { detailRequest.current += 1; setReading(false); setDraft(null); setDetail(null); setRequiresReload(false); setError(''); }
  async function open(row, editing = false) {
    if (saveLock.current || (editing && !canManage)) return;
    const request = ++detailRequest.current;
    setReading(true); setError(''); setInfo('');
    try {
      const current = await api.cryptoProviderWalletConfigs.get(row.id);
      if (!mounted.current || request !== detailRequest.current) return;
      if (!current || String(current.id) !== String(row.id)) throw new Error('This collection wallet could not be read.');
      if (editing) { setDraft(collectionWalletDraft(current)); setDetail(null); setRequiresReload(false); }
      else setDetail(current);
    } catch (failure) { if (mounted.current && request === detailRequest.current) setError(failure.message || 'Unable to read this collection wallet.'); }
    finally { if (mounted.current && request === detailRequest.current) setReading(false); }
  }
  async function save(event) {
    event.preventDefault();
    if (!canManage || saveLock.current || reading || requiresReload || !draft) return;
    let body;
    try { body = collectionWalletPayload(draft); }
    catch (failure) { setError(failure.message); return; }
    saveLock.current = true;
    setSaving(true); setError(''); setInfo('');
    try {
      if (draft.id != null) await api.cryptoProviderWalletConfigs.update(draft.id, body);
      else await api.cryptoProviderWalletConfigs.create(body);
      if (!mounted.current) return;
      setDraft(null); setInfo('Collection wallet saved. New invoices will use the current configuration.'); await load();
    } catch (failure) {
      if (mounted.current) {
        setError(failure.message || 'The save was not confirmed. Read the current mapping before saving again.');
        setRequiresReload(failure.status === 409 || failure.status >= 500 || !failure.status);
      }
    } finally { saveLock.current = false; if (mounted.current) setSaving(false); }
  }
  const columns = [
    { key: 'providerName', label: 'Provider' }, { key: 'symbol', label: 'Crypto' }, { key: 'network', label: 'Network' },
    { key: 'walletId', label: 'Wallet ID' }, { key: 'storeId', label: 'Store ID' }, { key: 'chainNetwork', label: 'Chain' },
    { key: 'active', label: 'Status', render: (row) => row.active ? 'Active' : 'Disabled' },
    { key: 'actions', label: 'Actions', render: (row) => <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button type="button" className="btn-neutral" disabled={saving || reading || Boolean(draft)} onClick={() => open(row)}>View</button>
      {canManage && <button type="button" className="btn-neutral" disabled={saving || reading || Boolean(draft)} onClick={() => open(row, true)}>Edit</button>}
    </div> }
  ];
  const pairOptions = draft?.id && !pairs.some((pair) => Number(pair.id) === Number(draft.productNetworkId))
    ? [...pairs, { id: draft.productNetworkId, cryptoProductName: draft.symbol, cryptoNetworkName: draft.network }] : pairs;

  return <div style={{ display: 'grid', gap: '1rem' }}>
    <div className="card">
      <h1 style={{ marginTop: 0 }}>Collection wallets</h1>
      <p>Connect each crypto and network to its Bitcart wallet and merchant store. These destinations receive Fondeka payments.</p>
      <p>Changes apply to new invoices without a restart. Pending invoices keep their original destination. Disabling a mapping stops new invoices for that mapping.</p>
      <Link href="/dashboard/crypto">← Crypto hub</Link>
    </div>
    {error && <div className="card" role="alert">{error}</div>}
    {info && <div className="card" role="status">{info}</div>}
    <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="btn-neutral" disabled={loading || saving || reading} onClick={load}>{loading ? 'Loading…' : 'Refresh'}</button>
      {canManage ? <button type="button" className="btn-primary" disabled={!loaded || saving || reading || pairsLoading || Boolean(pairsError) || Boolean(draft)} onClick={() => { setDraft(collectionWalletDraft()); setDetail(null); setRequiresReload(false); setError(''); setInfo(''); }}>Add collection wallet</button> : <span>Super admins can change collection destinations.</span>}
    </div>
    {pairsError && <div className="card" role="alert">{pairsError} <button type="button" className="btn-neutral" disabled={pairsLoading || saving} onClick={loadPairs}>Retry catalogue lookup</button></div>}
    {reading && <div role="status">Loading current collection wallet…</div>}
    {detail && <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
      <h2>{detail.symbol} / {detail.network} collection wallet</h2>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: '0.75rem', margin: 0 }}>
        {[['Provider', detail.providerName], ['Product/network ID', detail.productNetworkId], ['Version', detail.version], ...fields.map(([key, label]) => [label, detail[key]]), ['Minimum confirmations', detail.minimumConfirmations], ['Status', detail.active ? 'Active' : 'Disabled']].map(([label, value]) => <div key={label}><dt style={{ color: 'var(--muted)' }}>{label}</dt><dd style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value == null || value === '' ? '—' : value}</dd></div>)}
      </dl>
      <button type="button" className="btn-neutral" onClick={close}>Close details</button>
    </div>}
    {draft && canManage && <form className="card" onSubmit={save} style={{ display: 'grid', gap: '0.75rem' }}>
      <h2>{draft.id ? `Edit ${draft.symbol} / ${draft.network}` : 'Add collection wallet'}</h2>
      <p>Enter IDs from Bitcart. Recovery phrases, spending keys and API credentials do not belong in this form.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: '0.75rem' }}>
        <label>Provider<input value={draft.providerName} disabled /></label>
        <label htmlFor="productNetworkId">Crypto / network
          <select id="productNetworkId" required disabled={Boolean(draft.id) || saving || reading} value={draft.productNetworkId} onChange={(e) => setDraft((prev) => ({ ...prev, productNetworkId: e.target.value }))}>
            <option value="">Select a product/network mapping</option>
            {pairOptions.map((pair) => <option key={pair.id} value={pair.id}>{pair.cryptoProductName || `Product ${pair.cryptoProductId}`} / {pair.cryptoNetworkName}{pair.active === false ? ' · Inactive' : ''}</option>)}
          </select>
        </label>
        {fields.map(([name, label, maximum]) => <label key={name} htmlFor={name}>{label}
          <input id={name} value={draft[name] || ''} required={!['providerSymbol', 'tokenContract'].includes(name)}
            maxLength={maximum}
            disabled={saving || reading} onChange={(e) => setDraft((prev) => ({ ...prev, [name]: e.target.value }))} />
        </label>)}
        <label htmlFor="minimumConfirmations">Minimum confirmations
          <input id="minimumConfirmations" type="number" min="1" max="2147483647" step="1" required value={draft.minimumConfirmations} disabled={saving || reading} onChange={(e) => setDraft((prev) => ({ ...prev, minimumConfirmations: e.target.value }))} />
        </label>
        <label htmlFor="active"><input id="active" type="checkbox" checked={Boolean(draft.active)} disabled={saving || reading} onChange={(e) => setDraft((prev) => ({ ...prev, active: e.target.checked }))} /> Active</label>
      </div>
      <p>Disabling retains the mapping and prevents an old environment setting from becoming active again. The server connection and blockchain support must also be configured.</p>
      {requiresReload && <div role="alert">The current draft is preserved. Reload the saved configuration and review it before another save.
        <button type="button" className="btn-neutral" disabled={saving || reading} onClick={() => { if (draft.id != null) open(draft, true); else { close(); load(); } }}>{draft.id != null ? 'Discard draft and reload' : 'Discard draft and refresh list'}</button>
      </div>}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="submit" className="btn-primary" disabled={saving || reading || requiresReload}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn-neutral" disabled={saving || reading} onClick={close}>Cancel</button>
      </div>
    </form>}
    {loaded && <DataTable columns={columns} rows={rows} page={page} pageSize={20} totalPages={meta.totalPages} totalElements={meta.totalElements} onPageChange={(next) => { if (!saving && !reading) setPage(next); }} emptyLabel="No admin wallet mappings. Existing server mappings remain in use until an override is saved." />}
  </div>;
}
