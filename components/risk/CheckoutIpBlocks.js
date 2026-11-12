'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { ContentModal } from '@/components/ContentModal';
import { checkoutIpPermissions, checkoutIpKey, checkoutIpBlockPayload, checkoutIpEntry, checkoutIpPage, checkoutIpStatus, checkoutIpReason, checkoutIpDate } from '@/lib/checkout-ip-blocks';
import styles from './checkout-ip-blocks.module.css';

const emptyDraft = () => ({ ipAddress: '', reason: '', durationHours: '24' });
const Field = ({ label, children }) => <label className={styles.field}><span>{label}</span>{children}</label>;

export function CheckoutIpAudit({ entryId }) {
  const [page, setPage] = useState(0), [data, setData] = useState(null), [error, setError] = useState(''), [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null); setError('');
    const query = new URLSearchParams({ targetType: 'CHECKOUT_IP', targetId: String(entryId), page: String(page), size: '10' });
    api.auditLogs.list(query).then((value) => {
      const metadata = value?.page || value;
      if (!Array.isArray(value?.content) || !Number.isSafeInteger(metadata?.totalPages) || !Number.isSafeInteger(metadata?.totalElements)
          || value.content.some((row) => row.targetType !== 'CHECKOUT_IP' || String(row.targetId) !== String(entryId))) throw new Error('Manual audit history could not be verified.');
      if (active) setData({ rows: value.content, ...metadata });
    }).catch((err) => { if (active) setError(err.message || 'Could not load manual audit history.'); });
    return () => { active = false; };
  }, [entryId, page, reload]);
  return <section className={styles.audit} aria-label="Manual audit history">
    <div className={styles.toolbar}><h3>Manual audit history</h3><button className="btn-neutral btn-sm" onClick={() => setReload((value) => value + 1)}>Refresh audit</button></div>
    <p>Manual block and unblock actions only. Automatic violations are recorded separately.</p>
    {error ? <div role="alert">{error}</div> : !data ? <div role="status">Loading manual audit…</div> : !data.rows.length ? <p>No manual audit entries for this record.</p> : <>
      {data.rows.map((row) => <div className={styles.auditRow} key={row.id}>
        <strong>{row.action === 'CHECKOUT_IP_BLOCK' ? 'IP blocked' : row.action === 'CHECKOUT_IP_UNBLOCK' ? 'IP unblocked' : row.action}</strong>
        <span>{row.adminEmail || row.adminName || (row.adminId ? `Admin #${row.adminId}` : 'Actor not recorded')} · {checkoutIpDate(row.createdAt)}</span>
        {row.metadata && <pre>{JSON.stringify(row.metadata, null, 2)}</pre>}
      </div>)}
      <div className={styles.toolbar}><small>{data.totalElements} manual entries · Page {page + 1} of {data.totalPages}</small><div className={styles.actions}>
        <button className="btn-neutral btn-sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous audit page</button>
        <button className="btn-neutral btn-sm" disabled={page + 1 >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Next audit page</button>
      </div></div>
    </>}
  </section>;
}

export function CheckoutIpBlocksWorkspace() {
  const { session, refreshSession } = useAuth();
  const { canRead, canWrite } = checkoutIpPermissions(session);
  const [query, setQuery] = useState({ activeOnly: true, page: 0, size: 20 }), [reload, setReload] = useState(0);
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [warning, setWarning] = useState(''), [info, setInfo] = useState(''), [denied, setDenied] = useState(false);
  const [dialog, setDialog] = useState(null), [draft, setDraft] = useState(emptyDraft), [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false), [formError, setFormError] = useState(''), [reviewNeeded, setReviewNeeded] = useState(false), [now, setNow] = useState(Date.now);
  const request = useRef(0), lock = useRef(false), refreshBoth = useRef(false), expired = useRef(new Set()), alive = useRef(true), recovery = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current += 1; }; }, []);
  const fail = useCallback(async (err) => {
    if (err.status === 401 || err.status === 403) {
      try { await refreshSession?.(true); } catch { /* Keep the original endpoint error available. */ }
    }
    if (err.status === 404) return 'Checkout IP blocks are unavailable on this backend. Deploy backend support before using this screen.';
    if (err.status === 401) return 'Your session needs to be refreshed. Sign in again if the problem continues.';
    if (err.status === 403) return 'Permission denied. Checkout IP blocks require Admin review access and Super Admin write access.';
    return err.message || 'The request failed. Refresh and try again.';
  }, [refreshSession]);
  useEffect(() => {
    if (!canRead || denied) return undefined;
    const current = ++request.current, both = refreshBoth.current;
    refreshBoth.current = false;
    setLoading(true); setData(null); setError(''); setWarning('');
    const queries = [query];
    if (both) queries.push({ ...query, activeOnly: !query.activeOnly, page: 0 });
    Promise.allSettled(queries.map(async (params) => checkoutIpPage(await api.checkoutIpBlocks.list(new URLSearchParams({ activeOnly: String(params.activeOnly), page: String(params.page), size: String(params.size) }))))).then(async (results) => {
      if (request.current !== current) return;
      try {
        if (results[0].status === 'rejected') throw results[0].reason;
        const next = results[0].value;
        if (!next.content.length && query.page > 0) {
          setQuery((value) => ({ ...value, page: Math.max(0, Math.min(value.page - 1, next.page.totalPages - 1)) })); return;
        }
        setData(next); setNow(Date.now()); setReviewNeeded(false);
        if (recovery.current) { recovery.current = false; setConfirmed(false); setFormError('Records refreshed. Review the current IP and expiry before confirming another submission.'); }
        if (results[1]?.status === 'rejected') setWarning('The current view is fresh, but the other view could not be refreshed. Open it and refresh before relying on its records.');
      } catch (err) {
        const message = await fail(err);
        if (request.current === current) { setError(message); if (err.status === 403) setDenied(true); }
      } finally { if (request.current === current) setLoading(false); }
    });
    return () => { request.current += 1; };
  }, [query, reload, canRead, denied, fail]);

  // One refresh per displayed expiry, including an expiry crossed during the request.
  useEffect(() => {
    if (!data) return undefined;
    const candidates = data.content.filter((row) => row.blockedUntil && (Date.parse(row.blockedUntil) > Date.now() || (query.activeOnly && !expired.current.has(`${row.id}:${row.blockedUntil}`))));
    if (!candidates.length) return undefined;
    const first = candidates.reduce((left, right) => Date.parse(left.blockedUntil) < Date.parse(right.blockedUntil) ? left : right);
    const timer = setTimeout(() => {
      expired.current.add(`${first.id}:${first.blockedUntil}`); setNow(Date.now());
      if (query.activeOnly && !lock.current) setReload((value) => value + 1);
    }, Math.min(2147483647, Math.max(0, Date.parse(first.blockedUntil) - Date.now() + 50)));
    return () => clearTimeout(timer);
  }, [data, query.activeOnly, now]);
  useEffect(() => {
    const focus = () => { if (!lock.current && canRead && !denied) setReload((value) => value + 1); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [canRead, denied]);

  const refresh = () => { if (lock.current) return; refreshBoth.current = true; setReload((value) => value + 1); };
  const changeQuery = (next) => { if (lock.current) return; setData(null); setQuery((value) => ({ ...value, ...next })); };
  const openBlock = (entry = null) => {
    if (!canWrite || denied || lock.current || loading || !data) return;
    setDraft({ ...emptyDraft(), ipAddress: entry?.ipAddress || '' }); setDialog({ kind: 'block', entry }); setConfirmed(false); setFormError(''); setReviewNeeded(false); recovery.current = false;
  };
  const close = () => { if (!lock.current) { setDialog(null); setFormError(''); setReviewNeeded(false); setConfirmed(false); } };
  const mutate = async () => {
    if (!canWrite || denied || lock.current || loading || reviewNeeded || !confirmed || !['block', 'unblock'].includes(dialog?.kind)) return;
    let payload;
    try { if (dialog.kind === 'block') payload = checkoutIpBlockPayload(draft); }
    catch (err) { setFormError(err.message); return; }
    lock.current = true; setSaving(true); setFormError(''); setInfo(''); request.current += 1;
    try {
      if (dialog.kind === 'block') {
        const result = checkoutIpEntry(await api.checkoutIpBlocks.block(payload));
        if (checkoutIpKey(result.ipAddress) !== checkoutIpKey(payload.ipAddress) || !result.blockedAt || !result.blockedUntil) throw new Error('The backend did not confirm the requested IP block.');
        if (alive.current) setInfo(`${result.ipAddress} blocked until ${checkoutIpDate(result.blockedUntil)}.`);
      } else {
        await api.checkoutIpBlocks.unblock(dialog.entry.ipAddress);
        if (alive.current) setInfo(`${dialog.entry.ipAddress} unblocked. Existing checkout validation and rate limits still apply.`);
      }
      if (alive.current) { setDialog(null); setDraft(emptyDraft()); setConfirmed(false); refreshBoth.current = true; setReload((value) => value + 1); }
    } catch (err) {
      const message = await fail(err);
      if (alive.current) {
        const uncertain = !err.status || err.status >= 500;
        setFormError(uncertain ? `${message} The outcome is unconfirmed. Refresh records and review the current state before another submission.` : message);
        setConfirmed(false); setReviewNeeded(uncertain); recovery.current = uncertain;
        if (uncertain) { setData(null); setError('The last IP change is unconfirmed. Refresh records before making another change.'); refreshBoth.current = true; }
        if (err.status === 403) { setError(message); setDenied(true); }
      }
    } finally { lock.current = false; if (alive.current) setSaving(false); }
  };
  if (!canRead || denied) return <div className="card" role="alert">{error || 'Admin or Super Admin access is required to review checkout IP blocks.'}</div>;
  const existing = dialog?.kind === 'block' ? data?.content.find((row) => checkoutIpKey(row.ipAddress) === checkoutIpKey(draft.ipAddress)) || (checkoutIpKey(dialog.entry?.ipAddress) === checkoutIpKey(draft.ipAddress) ? dialog.entry : null) : null;
  const columns = [
    { key: 'ipAddress', label: 'IP address', render: (row) => <code className={styles.ip}>{row.ipAddress}</code> },
    { key: 'status', label: 'Status', render: (row) => <span className={styles.badge} data-blocked={checkoutIpStatus(row, now) === 'Blocked'}>{checkoutIpStatus(row, now)}</span> },
    { key: 'violationCount', label: 'Violations in window' },
    { key: 'lastReason', label: 'Last reason', render: (row) => <span className={styles.reason}>{checkoutIpReason(row.lastReason)}</span> },
    { key: 'lastViolationAt', label: 'Last activity · UTC', render: (row) => checkoutIpDate(row.lastViolationAt) },
    { key: 'blockedAt', label: 'Blocked at · UTC', render: (row) => checkoutIpDate(row.blockedAt) },
    { key: 'blockedUntil', label: 'Expires at · UTC', render: (row) => checkoutIpDate(row.blockedUntil) },
    { key: 'actions', label: 'Actions', render: (row) => <button className="btn-neutral btn-sm" disabled={saving || loading} onClick={() => { setDialog({ kind: 'review', entry: row }); setFormError(''); }}>Review</button> }
  ];
  return <div className={styles.workspace}>
    <header className={styles.heading}><div><small>RISK</small><h1>Checkout IP blocks</h1><p>Review IP protection for public checkout requests.</p></div><div className={styles.actions}>
      <button className="btn-neutral" disabled={loading || saving} onClick={refresh}>Refresh</button>
      {canWrite && <button className="btn-primary" disabled={loading || saving || !data} onClick={() => openBlock()}>Block IP</button>}
    </div></header>
    {info && <div className="card" role="status">{info}</div>}
    {!canWrite && <div className={styles.note}>Read only. A Super Admin can manually block or unblock an IP.</div>}
    <section className="card" aria-label="Checkout IP records">
      <div className={styles.toolbar}><div className={styles.views} role="group" aria-label="Record view">
        <button className="btn-neutral" aria-pressed={query.activeOnly} disabled={saving} onClick={() => changeQuery({ activeOnly: true, page: 0 })}>Active blocks</button>
        <button className="btn-neutral" aria-pressed={!query.activeOnly} disabled={saving} onClick={() => changeQuery({ activeOnly: false, page: 0 })}>All records</button>
      </div><Field label="Rows per page"><select value={query.size} disabled={saving} onChange={(event) => changeQuery({ size: Number(event.target.value), page: 0 })}>{[20, 50, 100].map((size) => <option value={size} key={size}>{size}</option>)}</select></Field></div>
      <p className={styles.note}>{query.activeOnly ? 'Currently blocked addresses.' : 'One retained record per IP, including expired blocks, unblocked IPs and violations below the threshold. This is not an event log.'} Activity is ordered newest first.</p>
      {loading ? <div className={styles.empty} role="status">Loading IP records…</div> : error ? <div className={styles.empty} role="alert"><strong>{error}</strong><button className="btn-neutral" onClick={refresh}>Refresh records</button></div> : data && <>
        {warning && <p role="alert">{warning}</p>}
        <small>{data.page.totalElements} {query.activeOnly ? 'active blocks' : 'retained records'}</small>
        {!data.content.length ? <div className={styles.empty}><strong>{query.activeOnly ? 'No active checkout IP blocks' : 'No retained checkout IP records'}</strong><p>{query.activeOnly ? 'Blocked addresses will appear here.' : 'Recorded violations and manual blocks will appear here.'}</p></div> : <DataTable rows={data.content} columns={columns} showIndex={false} showAccountQuickNav={false}
          page={data.page.number} pageSize={data.page.size} totalElements={data.page.totalElements} totalPages={data.page.totalPages}
          canPrev={!saving && data.page.number > 0} canNext={!saving && data.page.number + 1 < data.page.totalPages} onPageChange={(page) => changeQuery({ page })} />}
      </>}
    </section>
    <details className="card"><summary>About checkout protection</summary><div className={styles.explanation}>
      <p><strong>Production defaults:</strong> three simulated-buyer or checkout rate-limit violations within 15 minutes block a verified public client IP for 24 hours. Deployment settings may differ; this screen does not report or edit the live policy.</p>
      <p>Protection covers public checkout and order creation, payment start and quotes. It is not a site-wide firewall ban. An IP does not identify a customer account.</p>
      <p>Simulated buyer email domains such as example.com, .test and .invalid are rejected at checkout creation. A name alone does not establish abuse. Requests during a block do not extend its expiry.</p>
      <p>Unblocking resets the recorded violation window, but does not clear rate-limit quotas or permanently allowlist the IP. Further violations can block it again.</p>
    </div></details>

    {dialog && <ContentModal title={dialog.kind === 'review' ? `IP record · ${dialog.entry.ipAddress}` : dialog.kind === 'unblock' ? `Unblock ${dialog.entry.ipAddress}?` : 'Block checkout IP'} onClose={close}>
      <div className={styles.dialog}>
        {formError && <div role="alert" className={styles.formError}>{formError}</div>}
        {reviewNeeded && <button className="btn-neutral" disabled={loading || saving} onClick={refresh}>{loading ? 'Refreshing records…' : 'Refresh records before retry'}</button>}
        {dialog.kind === 'review' ? <>
          <dl className={styles.facts}>{[
            ['Status', checkoutIpStatus(dialog.entry, now)], ['Violations in recorded window', dialog.entry.violationCount], ['Window started', checkoutIpDate(dialog.entry.windowStartedAt)], ['Last activity', checkoutIpDate(dialog.entry.lastViolationAt)],
            ['Last reason', checkoutIpReason(dialog.entry.lastReason)], ['Blocked at', checkoutIpDate(dialog.entry.blockedAt)], ['Expires at', checkoutIpDate(dialog.entry.blockedUntil)], ['Block reason', checkoutIpReason(dialog.entry.blockReason)]
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {canWrite && <div className={styles.actions}><button className="btn-primary" disabled={saving || loading} onClick={() => openBlock(dialog.entry)}>Set block duration</button>
            {checkoutIpStatus(dialog.entry, now) === 'Blocked' && <button className="btn-danger" disabled={saving || loading} onClick={() => { setDialog({ kind: 'unblock', entry: dialog.entry }); setConfirmed(false); setFormError(''); setReviewNeeded(false); }}>Unblock</button>}
          </div>}
          <CheckoutIpAudit key={dialog.entry.id} entryId={dialog.entry.id} />
        </> : dialog.kind === 'block' ? <form className={styles.dialog} onSubmit={(event) => { event.preventDefault(); void mutate(); }}>
          <Field label="IP address"><input aria-label="IP address" value={draft.ipAddress} maxLength={128} required spellCheck={false} disabled={saving} onChange={(event) => { setDraft({ ...draft, ipAddress: event.target.value }); setConfirmed(false); }} placeholder="IPv4 or IPv6" /></Field>
          <small>One public address. The backend excludes private, loopback and recognized proxy infrastructure addresses.</small>
          <Field label="Reason"><textarea aria-label="Reason" value={draft.reason} maxLength={500} required rows={3} disabled={saving} onChange={(event) => { setDraft({ ...draft, reason: event.target.value }); setConfirmed(false); }} /></Field>
          <Field label="Duration in hours"><input aria-label="Duration in hours" type="number" min="1" max="720" step="1" value={draft.durationHours} disabled={saving} onChange={(event) => { setDraft({ ...draft, durationHours: event.target.value }); setConfirmed(false); }} placeholder="24" /></Field>
          <div className={styles.note}><strong>{draft.ipAddress.trim() || 'Selected IP'} · {draft.durationHours || 24} hours</strong>
            {existing?.blockedUntil && <p>Recorded expiry: {checkoutIpDate(existing.blockedUntil)}</p>}
            <p>The expiry will be replaced with the server time plus this duration. This can shorten or extend an existing block.</p>
          </div>
          <label className={styles.confirm}><input type="checkbox" aria-label="Confirm IP block" checked={confirmed} disabled={saving || reviewNeeded} onChange={(event) => setConfirmed(event.target.checked)} />I reviewed this IP, reason and expiry change.</label>
          <button type="submit" className="btn-primary" disabled={saving || loading || reviewNeeded || !confirmed}>{saving ? 'Blocking…' : 'Confirm block'}</button>
        </form> : <>
          <p>Allow subsequent public checkout attempts from <strong className={styles.ip}>{dialog.entry.ipAddress}</strong> again, subject to existing validation and rate limits.</p>
          <p>Current recorded expiry: {checkoutIpDate(dialog.entry.blockedUntil)}. Rate-limit quotas will remain in place; further violations can block this IP again.</p>
          <label className={styles.confirm}><input type="checkbox" aria-label="Confirm IP unblock" checked={confirmed} disabled={saving || reviewNeeded} onChange={(event) => setConfirmed(event.target.checked)} />I reviewed the IP to unblock.</label>
          <button className="btn-danger" disabled={saving || loading || reviewNeeded || !confirmed} onClick={() => void mutate()}>{saving ? 'Unblocking…' : 'Confirm unblock'}</button>
        </>}
      </div>
    </ContentModal>}
  </div>;
}

export default function CheckoutIpBlocksPage() {
  const { session } = useAuth();
  const identity = session?.tokens?.accessToken?.payload?.sub || session?.tokens?.idToken?.payload?.sub || session?.tokens?.accessToken?.toString() || 'anonymous';
  return <CheckoutIpBlocksWorkspace key={identity} />;
}
