'use client';

import Link from 'next/link';
import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { auditMoney, canReadRefundAudit } from '@/lib/payout-refund-audit';
import { initialProviderFilters, providerDocumentRequest, providerIssues, providerQuery } from '@/lib/provider-investigations';
import base from '../payout-refund-audits/page.module.css';
import styles from './page.module.css';

const utc = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : 'Not recorded';
const emptyDetails = { title: '', caseReference: '', message: '' };
function PreviewDialog({ preview, onClose, onDownload, downloading, error }) {
  const ref = useRef(null), titleId = useId(), document = preview.document;
  useEffect(() => {
    const previous = window.document.activeElement, overflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';ref.current?.querySelector('button')?.focus();
    return () => { window.document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  const keys = (event) => {
    if (event.key === 'Escape' && !downloading) onClose();
    if (event.key !== 'Tab') return;
    const nodes = [...ref.current.querySelectorAll('button:not(:disabled),a[href],summary,[tabindex="0"]')];
    if (event.shiftKey && window.document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
    if (!event.shiftKey && window.document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
  };
  return <div className={base.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget && !downloading) onClose(); }} onKeyDown={keys}>
    <section className={`${base.dialog} ${base.wide} ${styles.preview}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className={base.dialogHeader}><div><small className={styles.eyebrow}>PROVIDER DOCUMENT PREVIEW</small><h2 id={titleId}>{document.title}</h2></div><button className={base.iconButton} disabled={downloading} onClick={onClose} aria-label="Close preview">×</button></header>
      {error && <div className={base.error} role="alert">{error}</div>}
      <div className={styles.previewSummary}><span><small>Provider</small><strong>{document.provider}</strong></span><span><small>Transactions</small><strong>{document.transactions.length}</strong></span><span><small>Recorded events</small><strong>{document.eventCount}</strong></span><span><small>Prepared</small>{utc(preview.preparedAt)}</span></div>
      {document.caseReference && <div className={styles.caseReference}>Provider case: <strong>{document.caseReference}</strong></div>}
      <p className={styles.request}>{document.message}</p>
      <div className={base.notice}>Only this provider&apos;s recorded events are included. Credentials are redacted. Recorded errors do not establish the final settlement outcome; later responses are retained below.</div>
      {(document.missingRequests > 0 || document.missingResponses > 0) && <div className={styles.gaps}><strong>Evidence gaps</strong><span>{document.missingRequests} without a captured request · {document.missingResponses} without a captured response or saved reporting check</span></div>}
      <div className={styles.previewActions}><button className={base.primary} disabled={downloading} onClick={() => onDownload('pdf')}>{downloading ? 'Generating…' : 'Download PDF'}</button><button className={base.button} disabled={downloading} onClick={() => onDownload('json')}>Download JSON evidence</button><small>Review the document before sharing it with the provider.</small></div>
      <div className={styles.transactionList}>{document.transactions.map((tx, index) => <details className={styles.transaction} key={tx.id} open={index === 0}>
        <summary><span><small>{String(index + 1).padStart(2, '0')}</small><strong>{tx.reference}</strong></span><span>{auditMoney(tx.amount, tx.currency)}<em>Local: {tx.localStatus}</em></span></summary>
        <div className={styles.transactionBody}><div className={styles.recordMeta}><span>Created {utc(tx.createdAt)}</span>{tx.providerReference && <span>Provider reference: {tx.providerReference}</span>}{tx.latestRecordedStatus && <span>Latest recorded provider status: <strong>{tx.latestRecordedStatus}</strong></span>}{tx.auditOutcome && <span>Saved audit outcome: {tx.auditOutcome}</span>}</div>
          {tx.latestRecordedApproval && <div className={styles.approval}>The latest recorded response includes an approval. Confirm final settlement with the provider.</div>}
          <h3>Our recorded request payloads</h3>
          {!tx.events.some((event) => event.type === 'REQUEST') && <p className={styles.missing}>No request payload was captured. No request has been reconstructed.</p>}
          {tx.events.filter((event) => event.type === 'REQUEST').map((event) => <Evidence key={event.id} event={event} />)}
          <h3>Recorded provider responses and errors</h3>
          {!tx.events.some((event) => event.type !== 'REQUEST') && <p className={styles.missing}>No response or exception was captured in the retained event records.</p>}
          {tx.events.filter((event) => event.type !== 'REQUEST').map((event) => <Evidence key={event.id} event={event} />)}
          {tx.auditChecks?.length > 0 && <><h3>Reporting checks from the saved refund audit</h3><pre className={styles.json}>{tx.auditChecksText || JSON.stringify(tx.auditChecks, null, 2)}</pre></>}
        </div>
      </details>)}</div>
    </section>
  </div>;
}
function Evidence({ event }) {
  return <section className={styles.event}><header><strong>{event.type.replaceAll('_', ' ')} · {event.operation || 'Operation not recorded'}</strong><small>{utc(event.occurredAt)} · Event #{event.id}{event.status ? ` · Recorded status ${event.status}` : ''}</small></header>
    {event.payload != null && <><small>{event.type === 'ERROR' ? 'Payload attached to the recorded error' : event.type === 'REQUEST' ? 'Request payload' : 'Response payload'}</small><pre className={styles.json}>{event.payloadText || JSON.stringify(event.payload, null, 2)}</pre></>}
    {event.error != null && <><small>Recorded exception / HTTP response details</small><pre className={styles.json}>{event.errorText || JSON.stringify(event.error, null, 2)}</pre></>}
    {event.payload == null && event.error == null && <p className={styles.missing}>No payload or response body is retained for this event.</p>}
  </section>;
}

function Workspace() {
  const { session, enableRegulatorMode } = useAuth(), search = useSearchParams();
  const visible = canReadRefundAudit(session) && enableRegulatorMode === false;
  const identity = session?.tokens?.accessToken?.payload?.sub || session?.tokens?.idToken?.payload?.sub || '';
  const [draft, setDraft] = useState(() => initialProviderFilters(search)), [filters, setFilters] = useState(() => initialProviderFilters(search));
  const [options, setOptions] = useState(null), [rows, setRows] = useState([]), [total, setTotal] = useState(0), [totalPages, setTotalPages] = useState(0), [page, setPage] = useState(0);
  const [selected, setSelected] = useState([]), [details, setDetails] = useState(emptyDetails), [advanced, setAdvanced] = useState(false);
  const [loading, setLoading] = useState(false), [preparing, setPreparing] = useState(false), [downloading, setDownloading] = useState(false), [error, setError] = useState('');
  const [preview, setPreview] = useState(null), [previewRequest, setPreviewRequest] = useState(null), [openPreview, setOpenPreview] = useState(false), [reload, setReload] = useState(0);
  const revision = useRef(0), requestSignature = JSON.stringify({ filters, selected, details });
  useEffect(() => { revision.current += 1; setPreview(null); setPreviewRequest(null); setOpenPreview(false); }, [requestSignature, identity]);
  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    api.providerInvestigations.options(draft.provider || null).then((value) => {
      if (!active) return;
      setOptions(value);
      if (!draft.provider && value.providers?.length) {
        const provider = value.providers.includes('ARAKAPAY') ? 'ARAKAPAY' : value.providers[0];
        setDraft((v) => ({ ...v, provider })); setFilters((v) => ({ ...v, provider }));
      }
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [visible, identity, draft.provider, reload]);
  useEffect(() => {
    if (!visible || !filters.provider) return undefined;
    let active = true, query;
    try { query = providerQuery(filters, page); } catch (err) { setError(err.message); return undefined; }
    setLoading(true); setRows([]); setError('');
    api.providerInvestigations.transactions(query).then((value) => { if (active) { setRows(value.content || []); setTotal(value.totalElements || 0); setTotalPages(value.totalPages || 0); } })
      .catch((err) => { if (active) { setRows([]); setTotal(0); setError(err.message); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, identity, filters, page, reload]);
  const apply = (event) => {
    event.preventDefault();
    try { providerQuery(draft); setFilters({ ...draft }); setSelected([]); setPage(0); setError(''); }
    catch (err) { setError(err.message); }
  };
  const toggle = (id) => {
    if (selected.includes(id)) setSelected(selected.filter((value) => value !== id));
    else if (selected.length < 100) setSelected([...selected, id]);
    else setError('A provider document supports up to 100 transactions. Clear a selection or narrow the filters.');
  };
  const pageSelected = rows.length > 0 && rows.every((row) => selected.includes(row.transactionId));
  const togglePage = () => {
    const ids = rows.map((row) => row.transactionId);
    const next = pageSelected ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])];
    if (next.length > 100) { setError('Select at most 100 transactions for one document.'); return; }
    setSelected(next);
  };
  const prepare = async () => {
    const current = revision.current;setPreparing(true);setError('');
    try {
      const request = providerDocumentRequest(filters, selected, details);
      const value = await api.providerInvestigations.preview(request);
      if (revision.current === current) { setPreview(value); setPreviewRequest(request); setOpenPreview(true); }
    } catch (err) { if (revision.current === current) setError(err.message); }
    finally { setPreparing(false); }
  };
  const download = async (format) => {
    if (!preview || !previewRequest || downloading) return;
    setDownloading(true);setError('');
    try {
      const request = { ...previewRequest, previewHash: preview.fingerprint };
      const blob = format === 'pdf' ? await api.providerInvestigations.pdf(request) : await api.providerInvestigations.evidence(request);
      if (format === 'pdf' && await blob.slice(0, 5).text() !== '%PDF-') throw new Error('The server did not return a valid PDF. Refresh the preview and try again.');
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');anchor.href = url;
      anchor.download = `provider-investigation-${preview.document.provider.replace(/[^A-Z0-9_-]/g, '-')}-${new Date().toISOString().slice(0, 10)}.${format}`;
      anchor.click();setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err.message);if (err.status === 409) { setPreview(null); setPreviewRequest(null); setOpenPreview(false); } }
    finally { setDownloading(false); }
  };
  const clearAudit = () => { const next = initialProviderFilters(new URLSearchParams({ provider: draft.provider }));setDraft(next);setFilters(next);setSelected([]);setPage(0); };
  const columns = [
    { key: 'selection', label: <input type="checkbox" aria-label="Select this page" checked={pageSelected} onChange={togglePage} />, width: '3rem', priority: 0, render: (row) => <input type="checkbox" aria-label={`Select ${row.reference}`} checked={selected.includes(row.transactionId)} onChange={() => toggle(row.transactionId)} /> },
    { key: 'reference', label: 'Transaction', width: '15rem', render: (row) => <span className={styles.cell}><Link href={`/dashboard/transactions?transactionId=${row.transactionId}`}>{row.reference} ↗</Link><small>{utc(row.createdAt)}</small>{row.providerReference && <small>Provider #{row.providerReference}</small>}</span> },
    { key: 'amount', label: 'Local amount', width: '9rem', render: (row) => <span className={styles.cell}><strong>{auditMoney(row.amount, row.currency)}</strong><small>{row.context}</small></span> },
    { key: 'status', label: 'Recorded issue / status', width: '15rem', render: (row) => <span className={styles.cell}>{row.recordedError && <span className={styles.badge}>Provider error recorded</span>}{row.reportedFailure && <span className={styles.badge}>Failure / decline reported</span>}{row.latestRecordedApproval && <span className={styles.approved}>Approval in later history</span>}<small>Local: {row.localStatus}{row.latestRecordedStatus ? ` · Provider: ${row.latestRecordedStatus}` : ''}</small></span> },
    { key: 'evidence', label: 'Retained evidence', width: '12rem', render: (row) => <span className={styles.cell}><span>{row.requestCount} request(s) · {row.responseCount} response(s)</span>{(!row.requestCount || !row.responseCount) && <small className={styles.missingText}>Some evidence is missing</small>}</span> }
  ];
  if (!canReadRefundAudit(session)) return <div className="card" role="alert">Admin or Super Admin access is required.</div>;
  if (enableRegulatorMode !== false) return <div className="card">Provider investigations are unavailable in the current dashboard presentation.</div>;
  const count = selected.length || total, limit = options?.maxTransactions || 100;
  const dirtyFilters = JSON.stringify(draft) !== JSON.stringify(filters);
  return <div className={base.workspace}>
    <header className={base.heading}><div><div className={base.eyebrow}>PAYMENTS / PROVIDER SUPPORT</div><h1>Provider investigations</h1><p>Prepare transaction requests and responses for a provider to investigate.</p></div><button className={base.button} onClick={() => setReload((v) => v + 1)}>↻ Refresh</button></header>
    {error && <div className={base.error} role="alert">{error}</div>}
    {filters.auditRunId && <div className={`${base.notice} ${styles.auditNotice}`}><div><strong>Scoped to a saved refund audit</strong><span>Outcome: {filters.auditOutcome || 'ALL'}{filters.accountId ? ` · Account #${filters.accountId}` : ''}{filters.auditQuery ? ` · Search: ${filters.auditQuery}` : ''}. Saved reporting checks will be included.</span></div><div><Link href={`/dashboard/payout-refund-audits?run=${filters.auditRunId}`}>Open audit ↗</Link><button className={base.textButton} onClick={clearAudit}>Remove audit scope</button></div></div>}
    <section className={base.overview}>
      <div className={base.sectionTop}><div><h2>Choose the transactions</h2><p>One provider per document. Transaction dates use UTC.</p></div><button className={base.textButton} onClick={() => setAdvanced(!advanced)}>{advanced ? 'Fewer filters' : 'More filters'}</button></div>
      <form className={styles.filters} onSubmit={apply}>
        <label><span>Provider</span><select aria-label="Provider" value={draft.provider} disabled={Boolean(draft.auditRunId)} onChange={(e) => setDraft({ ...draft, provider: e.target.value, operation: '' })}>{!options?.providers?.length && <option value="">Loading providers…</option>}{options?.providers?.map((provider) => <option key={provider}>{provider}</option>)}</select></label>
        <label><span>From · UTC</span><input aria-label="From date" type="date" value={draft.fromDate} onChange={(e) => setDraft({ ...draft, fromDate: e.target.value })} /></label>
        <label><span>Through · UTC</span><input aria-label="Through date" type="date" value={draft.toDate} onChange={(e) => setDraft({ ...draft, toDate: e.target.value })} /></label>
        <label className={styles.issueFilter}><span>Recorded issue</span><select aria-label="Recorded issue" value={draft.issue} onChange={(e) => setDraft({ ...draft, issue: e.target.value })}>{providerIssues.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {advanced && <>
          <label><span>Local status</span><select aria-label="Local status" value={draft.localStatus} onChange={(e) => setDraft({ ...draft, localStatus: e.target.value })}><option value="">Any status</option>{options?.localStatuses?.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label><span>Operation</span><select aria-label="Operation" value={draft.operation} onChange={(e) => setDraft({ ...draft, operation: e.target.value })}><option value="">Any recorded operation</option>{options?.operations?.map((operation) => <option key={operation}>{operation}</option>)}</select></label>
          <label><span>Action</span><select aria-label="Action" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}><option value="">Any action</option>{options?.actions?.map((action) => <option key={action}>{action}</option>)}</select></label>
          <label><span>Transaction context</span><select aria-label="Transaction context" value={draft.context} onChange={(e) => setDraft({ ...draft, context: e.target.value })}><option value="">Any context</option>{['PAYOUT', 'COLLECTION', 'OTHER'].map((context) => <option key={context}>{context}</option>)}</select></label>
          <label><span>Account ID</span><input aria-label="Account ID" inputMode="numeric" value={draft.accountId} placeholder="Any account" onChange={(e) => setDraft({ ...draft, accountId: e.target.value })} /></label>
          <label><span>Currency</span><input aria-label="Currency" maxLength={12} value={draft.currency} placeholder="Any currency" onChange={(e) => setDraft({ ...draft, currency: e.target.value })} /></label>
        </>}
        <label className={styles.referenceFilter}><span>Reference or transaction ID</span><input aria-label="Reference or transaction ID" maxLength={200} value={draft.reference} placeholder="Our reference or provider ID" onChange={(e) => setDraft({ ...draft, reference: e.target.value })} /></label>
        <button className={base.primary} type="submit" disabled={loading}>Apply filters</button>
      </form>
      <p className={base.contextNote}>Documents include this provider&apos;s complete retained event history for each chosen transaction, including later responses. A local failure or an HTTP error does not prove the provider failed to settle it.</p>
    </section>
    <section className={base.results} aria-label="Matching provider transactions"><div className={base.sectionTop}><div><h2>{loading ? 'Loading transactions…' : `${Number(total).toLocaleString()} matching transaction${total === 1 ? '' : 's'}`}</h2><p>{selected.length ? `${selected.length} selected across pages` : 'No manual selection: the document will use all matching transactions'} · Maximum {limit} per document</p></div>{selected.length > 0 && <button className={base.textButton} onClick={() => setSelected([])}>Clear selection</button>}</div>
      {loading ? <div className={base.tableLoading} role="status">Loading recorded provider evidence…</div> : <DataTable columns={columns} rows={rows} page={page} pageSize={20} totalElements={total} totalPages={totalPages} onPageChange={setPage} showIndex={false} showAccountQuickNav={false} emptyLabel="No transactions match these provider filters." />}
    </section>
    <section className={base.overview}><div className={base.sectionTop}><div><h2>Prepare the provider document</h2><p>Review the payloads and responses, then download the PDF to share.</p></div><span className={styles.count}>{Number(count).toLocaleString()} transaction{count === 1 ? '' : 's'}</span></div>
      <div className={styles.details}><label><span>Document title · optional</span><input aria-label="Document title" maxLength={160} value={details.title} placeholder={`Transaction investigation - ${filters.provider || 'provider'}`} onChange={(e) => setDetails({ ...details, title: e.target.value })} /></label><label><span>Provider case reference · optional</span><input aria-label="Provider case reference" maxLength={120} value={details.caseReference} placeholder="Existing support ticket or case number" onChange={(e) => setDetails({ ...details, caseReference: e.target.value })} /></label><label className={styles.message}><span>Investigation request · optional</span><textarea aria-label="Investigation request" rows={3} maxLength={2000} value={details.message} placeholder="Please investigate these attempts and confirm the final settlement status, processing timestamps and reason for each error." onChange={(e) => setDetails({ ...details, message: e.target.value })} /></label></div>
      {count > limit && <div className={base.notice}>This selection exceeds {limit} transactions. Narrow the filters or select the transactions to include.</div>}
      <div className={styles.prepareActions}><span>{dirtyFilters ? 'Apply your filter changes before preparing a document.' : 'Credential fields are redacted automatically. The report includes references, timestamps, original recorded payloads and responses.'}</span><button className={base.primary} disabled={preparing || loading || dirtyFilters || count < 1 || count > limit} onClick={prepare}>{preparing ? 'Preparing preview…' : 'Preview document'}</button></div>
    </section>
    {openPreview && preview && <PreviewDialog preview={preview} downloading={downloading} error={error} onClose={() => setOpenPreview(false)} onDownload={download} />}
  </div>;
}
export default function ProviderInvestigationsPage() { return <Suspense fallback={<div role="status">Loading provider investigations…</div>}><Workspace /></Suspense>; }
