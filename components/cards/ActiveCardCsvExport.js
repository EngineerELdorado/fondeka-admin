'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

export default function ActiveCardCsvExport() {
  const { session, adminProfile, enableRegulatorMode } = useAuth();
  const payload = session?.tokens?.accessToken?.payload || session?.tokens?.idToken?.payload;
  const roles = [payload?.role, payload?.['custom:role'], payload?.['cognito:groups'], payload?.groups]
    .flatMap(value => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .map(value => String(value).trim().toUpperCase());
  const allowed = enableRegulatorMode === false && roles.some(role => ['ADMIN', 'SUPER_ADMIN'].includes(role));
  const actor = String(payload?.sub || adminProfile?.id || '');
  const identity = useRef(null);
  identity.current = allowed ? actor : null;
  const pending = useRef(null);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState('LEGACY_BRIDGECARD');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setOpen(false); setError(''); setBusy(false); setScope('LEGACY_BRIDGECARD');
    return () => { pending.current?.abort(); pending.current = null; };
  }, [actor, allowed]);

  const download = async () => {
    if (!allowed || !actor || pending.current) return;
    const currentActor = actor;
    const selectedScope = scope;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError('');
    try {
      const csv = await api.cards.exportActiveCsv(selectedScope, { signal: controller.signal });
      if (controller.signal.aborted || identity.current !== currentActor) return;
      if (typeof csv !== 'string' || !/^card_id,cardholder_id\r?\n/.test(csv)) {
        throw new Error('The server did not return the card CSV. Please refresh and try again.');
      }
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      const prefix = selectedScope === 'LEGACY_BRIDGECARD' ? 'active-legacy-bridgecard-cards-' : 'active-cards-';
      anchor.download = `${prefix}${new Date().toISOString().slice(0, 10)}.csv`;
      try { document.body.appendChild(anchor); anchor.click(); }
      finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setOpen(false);
    } catch (failure) {
      if (!controller.signal.aborted && identity.current === currentActor) setError(failure.message || 'Could not export the cards. Please try again.');
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  };

  if (!allowed || !actor) return null;
  return <>
    <button type="button" className="btn-neutral" onClick={() => { setError(''); setOpen(true); }}>Export CSV</button>
    {open && <div className="modal-backdrop">
      <div className="modal-surface" role="dialog" aria-modal="true" aria-labelledby="active-card-export-title" style={{ display: 'grid', gap: '1rem' }}>
        <h2 id="active-card-export-title" style={{ margin: 0 }}>Export active cards</h2>
        <p style={{ margin: 0, color: 'var(--muted)' }}>Download provider card and cardholder IDs for every matching active, issued card. Table filters and pagination do not limit this export.</p>
        <label htmlFor="active-card-export-scope">Cards to export</label>
        <select id="active-card-export-scope" disabled={busy} value={scope} onChange={event => { setScope(event.target.value); setError(''); }}>
          <option value="LEGACY_BRIDGECARD">Legacy Bridgecard — Anchor migration</option>
          <option value="ALL">All providers</option>
        </select>
        {error && <div role="alert" style={{ color: '#b91c1c' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="btn-primary" disabled={busy} aria-busy={busy} onClick={download}>{busy ? 'Exporting…' : 'Download CSV'}</button>
        </div>
      </div>
    </div>}
  </>;
}
