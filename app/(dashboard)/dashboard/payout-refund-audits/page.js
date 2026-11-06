'use client';

import Link from 'next/link';
import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { activeAudit, auditCsv, auditMoney, auditOutcomes, auditQuery, auditScope, canReadRefundAudit, creditTotals, outcomeInfo } from '@/lib/payout-refund-audit';
import styles from './page.module.css';

const emptyFilters = { outcome: 'CONFIRMED', query: '', accountId: '', currency: '' };
const dateTime = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const dateOnly = (value) => value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' }) : '—';
const moneyEntries = (totals) => Object.entries(totals || {});

function Money({ totals, empty = '—' }) {
  const entries = moneyEntries(totals);
  return entries.length ? <span className={styles.money}>{entries.map(([currency, amount]) => <span key={currency}>{auditMoney(amount, currency)}</span>)}</span> : empty;
}
function Outcome({ value }) {
  const info = outcomeInfo(value);
  return <span className={styles.outcome} title={info.description} style={{ '--outcome-color': info.color }}><span />{info.label}</span>;
}
function Dialog({ title, children, onClose, wide = false }) {
  const surface = useRef(null), titleId = useId();
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    surface.current?.querySelector('button, input, select')?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  const onKeyDown = (event) => {
    if (event.key === 'Escape') onClose();
    if (event.key !== 'Tab') return;
    const nodes = [...surface.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className={styles.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={onKeyDown}>
    <section className={`${styles.dialog} ${wide ? styles.wide : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={surface}>
      <header className={styles.dialogHeader}><h2 id={titleId}>{title}</h2><button className={styles.iconButton} onClick={onClose} aria-label="Close dialog">×</button></header>
      {children}
    </section>
  </div>;
}
function Detail({ runId, transactionId, onClose }) {
  const [item, setItem] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setItem(null); setError('');
    api.payoutRefundAudits.transaction(runId, transactionId).then((value) => { if (active) setItem(value); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [runId, transactionId]);
  return <Dialog title={item?.reference || 'Transaction evidence'} onClose={onClose} wide>
    {error ? <div className={styles.error} role="alert">{error}</div> : !item ? <p role="status">Loading transaction evidence…</p> : <>
      <div className={styles.detailLead}><Outcome value={item.outcome} /><span>Checked {dateTime(item.checkedAt)}</span></div>
      {item.diagnostic && <div className={styles.notice}>{item.diagnostic}</div>}
      <div className={styles.detailGrid}>
        <div><small>Account</small><strong>{item.accountName || item.accountReference}</strong><span>{item.email || `Account #${item.accountId}`}</span></div>
        <div><small>Payout principal</small><strong>{auditMoney(item.amount, item.currency)}</strong><span>Local status: {item.localStatus}</span></div>
        <div><small>Wallet credits</small><strong><Money totals={creditTotals(item.credits)} empty="No verified credit" /></strong><span>{String(item.refundEvidence || '').replaceAll('_', ' ').toLowerCase()}</span></div>
        <div><small>ArakaPay transaction ID</small><strong>{item.providerTransactionId || '—'}</strong><span>Payout created {dateTime(item.createdAt)}</span></div>
      </div>
      <div className={styles.detailLinks}><Link href={`/dashboard/accounts/accounts/${item.accountId}`}>Open account ↗</Link><Link href={`/dashboard/transactions?transactionId=${item.transactionId}`}>Open transaction ↗</Link></div>
      <h3>Refund credit evidence</h3>
      {item.credits?.length ? <div className={styles.creditList}>{item.credits.map((credit, index) => <div key={`${credit.refundTransactionId}-${credit.activityId}-${index}`}>
        <div><strong>{auditMoney(credit.amount, credit.currency)}</strong><Link href={`/dashboard/transactions?transactionId=${credit.refundTransactionId}`}>{credit.refundReference} ↗</Link></div>
        <p>{credit.linkMethod === 'EXACT_REFERENCE' ? 'Linked by original transaction reference' : credit.linkMethod === 'AMBIGUOUS_LINK' ? 'Ambiguous source link · needs review' : 'Matched by account, time and amount · needs review'}</p>
        <small>{credit.ledger} #{credit.activityId} · {auditMoney(credit.previousBalance, credit.currency)} → {auditMoney(credit.newBalance, credit.currency)} · {dateTime(credit.createdAt)}</small>
      </div>)}</div> : <div className={styles.notice}>The refund marker does not have a linked positive wallet credit in this report.{item.expectedCryptoRefund ? <span> Expected crypto quantity: {item.expectedCryptoRefund}; wallet #{item.cryptoWalletId}. This is not proof of a credit.</span> : null}</div>}
      <h3>Provider reporting</h3>
      <p className={styles.muted}>Each lookup uses the stored payout reference. Provider dates are shown as returned; their timezone is unspecified.</p>
      {(item.checks || []).map((check, index) => <details className={styles.evidence} key={`${check.reference}-${index}`} open={index === 0}>
        <summary><strong>{check.reference}</strong><span>{check.providerStatus || outcomeInfo(check.outcome).label} · HTTP {check.httpStatus || '—'}</span></summary>
        <pre>{JSON.stringify(check, null, 2)}</pre>
      </details>)}
      {!item.checkedAt && <p role="status">This payout is waiting for its provider lookup.</p>}
    </>}
  </Dialog>;
}

function Workspace() {
  const { session, enableRegulatorMode } = useAuth();
  const search = useSearchParams(), router = useRouter();
  const canRead = canReadRefundAudit(session), visible = canRead && enableRegulatorMode === false;
  const identity = session?.tokens?.accessToken?.payload?.sub || session?.tokens?.idToken?.payload?.sub || '';
  const [runs, setRuns] = useState([]), [runId, setRunId] = useState(''), [run, setRun] = useState(null);
  const [historyPage, setHistoryPage] = useState(0), [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [view, setView] = useState('accounts'), [page, setPage] = useState(0), [rows, setRows] = useState([]), [total, setTotal] = useState(0), [totalPages, setTotalPages] = useState(0);
  const [draft, setDraft] = useState(emptyFilters), [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true), [rowsLoading, setRowsLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0), [denied, setDenied] = useState(false), [selected, setSelected] = useState(null);
  const [newAudit, setNewAudit] = useState(false), [scope, setScope] = useState({ label: '', from: '', to: '', accountId: '' }), [starting, setStarting] = useState(false), [startError, setStartError] = useState('');
  const [exporting, setExporting] = useState(false), [stopping, setStopping] = useState(false);
  const wantedRun = search.get('run');

  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    setLoading(true); setError(''); setDenied(false); setRuns([]); setRun(null); setRows([]);
    api.payoutRefundAudits.list({ page: 0, size: 20 }).then((response) => {
      if (!active) return;
      setRuns(response.content || []); setHistoryPage(0); setHistoryTotalPages(response.totalPages || 0);
      setRunId(wantedRun || response.content?.[0]?.id || '');
    }).catch((err) => { if (active) { setError(err.message); setDenied([401, 403].includes(err.status)); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // URL changes are handled when a saved report is selected, without resetting a running view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, identity, reload]);

  useEffect(() => { setRun(null); setRows([]); setPage(0); setSelected(null); }, [runId]);
  useEffect(() => {
    if (!visible || !runId || denied) return undefined;
    let active = true, timer;
    const fetchReport = async () => {
      try {
        const response = await api.payoutRefundAudits.report(runId);
        if (!active) return;
        setRun(response); setError('');
        setRuns((existing) => existing.map((entry) => entry.id === response.id ? response : entry));
        if (activeAudit(response)) timer = setTimeout(fetchReport, 4000);
      } catch (err) {
        if (!active) return;
        setError(`${err.message}${[401, 403].includes(err.status) ? '' : ' Showing the last loaded data.'}`);
        if ([401, 403].includes(err.status)) { setDenied(true); setRun(null); setRows([]); }
        else timer = setTimeout(fetchReport, 12000);
      }
    };
    void fetchReport();
    return () => { active = false; clearTimeout(timer); };
  }, [visible, runId, denied, reload]);

  useEffect(() => {
    if (!visible || !run || run.id !== runId || denied) return undefined;
    let active = true;
    setRowsLoading(true); setRows([]);
    const method = view === 'accounts' ? api.payoutRefundAudits.accounts : api.payoutRefundAudits.transactions;
    method(runId, auditQuery(filters, page)).then((response) => {
      if (!active) return;
      setRows(response.content || []); setTotal(response.totalElements || 0); setTotalPages(response.totalPages || 0);
    }).catch((err) => { if (active) { setError(err.message); if ([401, 403].includes(err.status)) { setDenied(true); setRun(null); } } }).finally(() => { if (active) setRowsLoading(false); });
    return () => { active = false; };
  }, [visible, runId, run?.id, run?.checkedCount, run?.lastProgressAt, view, filters, page, denied, reload]);

  const chooseRun = (id) => { setRunId(id); setFilters(emptyFilters); setDraft(emptyFilters); setPage(0); setError(''); setNotice(''); router.replace(`/dashboard/payout-refund-audits?run=${encodeURIComponent(id)}`, { scroll: false }); };
  const providerReportHref = () => {
    const query = new URLSearchParams({ provider: 'ARAKAPAY', issue: 'ALL', auditRunId: runId, auditOutcome: filters.outcome });
    if (filters.query) query.set('auditQuery', filters.query);
    if (filters.accountId) query.set('accountId', filters.accountId);
    if (filters.currency) query.set('currency', filters.currency);
    return `/dashboard/provider-investigations?${query}`;
  };
  const outcomeFilter = (outcome) => { const next = { ...filters, outcome }; setFilters(next); setDraft(next); setPage(0); };
  const apply = (event) => { event.preventDefault(); if (draft.accountId && !/^[1-9]\d*$/.test(draft.accountId)) { setError('Enter a positive account ID.'); return; } setFilters({ ...draft }); setPage(0); setError(''); };
  const start = async (event) => {
    event.preventDefault(); setStartError('');
    try {
      const request = auditScope(scope); setStarting(true);
      const result = await api.payoutRefundAudits.start(request);
      const report = await api.payoutRefundAudits.report(result.runId);
      setRuns((existing) => [report, ...existing.filter((entry) => entry.id !== report.id)]);
      setNewAudit(false); chooseRun(report.id);
      setNotice(result.reusedActiveRun ? 'An ArakaPay audit is already running. Opened that report; its saved scope is shown below.' : 'Audit started. Results appear as provider lookups finish.');
    } catch (err) { setStartError(err.message); }
    finally { setStarting(false); }
  };
  const stop = async () => {
    setStopping(true); setError('');
    try { const response = await api.payoutRefundAudits.cancel(runId); setRun(response); setNotice('Audit stopped. Completed observations remain available.'); }
    catch (err) { setError(err.message); }
    finally { setStopping(false); }
  };
  const exportReport = async (format) => {
    if (exporting) return;
    setExporting(true); setError('');
    try {
      const response = await api.payoutRefundAudits.export(runId, auditQuery(filters));
      const blob = new Blob([format === 'csv' ? auditCsv(response.transactions) : JSON.stringify(response, null, 2)], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' });
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = `arakapay-refund-audit-${runId}.${format}`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err.message); }
    finally { setExporting(false); }
  };
  const moreHistory = async () => {
    try { const response = await api.payoutRefundAudits.list({ page: historyPage + 1, size: 20 }); setRuns((current) => [...new Map([...current, ...(response.content || [])].map((entry) => [entry.id, entry])).values()]); setHistoryPage(historyPage + 1); setHistoryTotalPages(response.totalPages || 0); }
    catch (err) { setError(err.message); }
  };
  const accountRows = [
    { key: 'account', label: 'Account', minWidth: '16rem', render: (row) => <span className={styles.cellStack}><Link href={`/dashboard/accounts/accounts/${row.accountId}`} className={styles.cellTitle}>{row.accountName || row.accountReference}</Link><small>{row.email || row.accountReference} · #{row.accountId}</small></span> },
    { key: 'payoutCount', label: 'Matched payouts', render: (row) => <strong>{row.payoutCount}</strong> },
    { key: 'payoutTotals', label: 'Payout principal', render: (row) => <Money totals={row.payoutTotals} /> },
    { key: 'confirmedRefundTotals', label: 'Confirmed refunds', render: (row) => <Money totals={row.confirmedRefundTotals} /> },
    { key: 'details', label: '', render: (row) => <button className={styles.textButton} onClick={() => { const next = { ...filters, accountId: String(row.accountId) }; setFilters(next); setDraft(next); setView('transactions'); setPage(0); }}>View payouts →</button> }
  ];
  const transactionRows = [
    { key: 'reference', label: 'Payout', minWidth: '12rem', render: (row) => <span className={styles.cellStack}><button className={styles.referenceButton} onClick={() => setSelected(row.transactionId)}>{row.reference}</button><small>{dateOnly(row.createdAt)} · {row.localStatus}</small></span> },
    { key: 'account', label: 'Account', minWidth: '12rem', render: (row) => <span className={styles.cellStack}><Link href={`/dashboard/accounts/accounts/${row.accountId}`}>{row.accountName || row.accountReference}</Link><small>Account #{row.accountId}</small></span> },
    { key: 'amount', label: 'Payout principal', render: (row) => auditMoney(row.amount, row.currency) },
    { key: 'credits', label: 'Wallet credits', render: (row) => <Money totals={creditTotals(row.credits)} /> },
    { key: 'outcome', label: 'Audit outcome', minWidth: '13rem', render: (row) => <span className={styles.cellStack}><Outcome value={row.outcome} />{row.providerTransactionId && <small>ArakaPay #{row.providerTransactionId}</small>}</span> },
    { key: 'details', label: '', render: (row) => <button className={styles.textButton} onClick={() => setSelected(row.transactionId)}>Evidence ↗</button> }
  ];

  if (!canRead) return <div className="card" role="alert">Admin or Super Admin access is required to view refund audits.</div>;
  if (enableRegulatorMode !== false) return <div className="card">This report is unavailable in the current dashboard presentation.</div>;
  const checked = run?.checkedCount || 0, candidates = run?.candidateCount || 0;
  const progress = candidates ? Math.min(100, Math.round(checked / candidates * 100)) : run?.status === 'COMPLETED' ? 100 : 0;
  const processing = activeAudit(run), scopeDescription = run ? `${run.from ? dateOnly(run.from) : 'All history'}${run.to ? ` → ${dateOnly(new Date(Date.parse(run.to) - 1).toISOString())}` : ''}${run.accountId ? ` · Account #${run.accountId}` : ' · All accounts'}` : '';
  return <div className={styles.workspace}>
    <header className={styles.heading}>
      <div><div className={styles.eyebrow}>PAYMENTS / RECONCILIATION</div><h1>Payout refund audit</h1><p>Compare ArakaPay payout status with recorded wallet refunds.</p></div>
      <div className={styles.headerActions}><button className={styles.button} onClick={() => setReload((v) => v + 1)} disabled={loading}>↻ Refresh</button><button className={styles.primary} onClick={() => { setNewAudit(true); setStartError(''); }} disabled={denied}>+ Run audit</button></div>
    </header>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {notice && <div className={styles.notice} role="status">{notice}</div>}
    <section className={styles.reportPicker} aria-label="Saved audit reports">
      <label><span>Saved report</span><select aria-label="Saved report" value={runId} onChange={(e) => chooseRun(e.target.value)} disabled={!runs.length || denied}>
        {!runs.length && <option value="">{loading ? 'Loading saved reports…' : 'No saved reports yet'}</option>}
        {runId && !runs.some((entry) => entry.id === runId) && <option value={runId}>{run?.label || `Report ${runId.slice(0, 8)}`}</option>}
        {runs.map((entry) => <option key={entry.id} value={entry.id}>{entry.label || dateTime(entry.createdAt)} · {entry.status.toLowerCase()} · {entry.confirmedCount || 0} confirmed</option>)}
      </select></label>
      <div className={styles.reportMeta}>{run && <><span className={styles.runStatus} data-active={processing}>{run.status.toLowerCase()}</span><span>{scopeDescription}</span><span>Snapshot {dateTime(run.snapshotAt)}</span></>}</div>
      {historyPage + 1 < historyTotalPages && <button className={styles.textButton} onClick={moreHistory}>Load older reports</button>}
    </section>
    {loading || runId && !run && !error ? <div className={styles.empty} role="status">Loading audit report…</div> : !run ? <section className={styles.empty}><div className={styles.emptyIcon}>↗</div><h2>Bring the payout and refund records together</h2><p>Run an audit to find approved ArakaPay payouts with wallet refunds. Saved reports and their evidence stay available here.</p><button className={styles.primary} onClick={() => setNewAudit(true)} disabled={denied}>Run your first audit</button></section> : <>
      {(processing || run.status === 'CANCELED' || run.status === 'FAILED') && <section className={styles.progressPanel}>
        <div><strong>{processing ? run.status === 'QUEUED' ? 'Audit queued' : 'Checking ArakaPay reporting' : run.status === 'CANCELED' ? 'Audit stopped · partial results' : 'Audit incomplete'}</strong><span>{checked.toLocaleString()} of {candidates.toLocaleString()} payouts checked · {progress}%</span></div>
        <div className={styles.progress} role="progressbar" aria-label="Provider lookups complete" aria-valuenow={checked} aria-valuemin={0} aria-valuemax={Math.max(1, candidates)}><span style={{ width: `${progress}%` }} /></div>
        <div><span>Last progress {dateTime(run.lastProgressAt)}{run.diagnostic ? ` · ${run.diagnostic}` : ''}</span>{processing && <button className={styles.textButton} disabled={stopping} onClick={stop}>{stopping ? 'Stopping…' : 'Stop audit'}</button>}</div>
      </section>}
      <section className={styles.stats} aria-label="Audit summary">
        <div className={`${styles.stat} ${styles.confirmedStat}`}><span>{processing ? 'Confirmed so far' : 'Confirmed payouts'}</span><strong>{(run.confirmedCount || 0).toLocaleString()}</strong><small>Refunded + approved by ArakaPay</small></div>
        <div className={styles.stat}><span>Affected accounts</span><strong>{(run.confirmedAccounts || 0).toLocaleString()}</strong><small>With at least one confirmed case</small></div>
        <div className={styles.stat}><span>Confirmed wallet refunds</span><strong className={styles.statMoney}><Money totals={run.confirmedRefundTotals} empty="—" /></strong><small>Historical credits · before recoveries</small></div>
        <div className={styles.stat}><span>Confirmed payout principal</span><strong className={styles.statMoney}><Money totals={run.confirmedPayoutTotals} empty="—" /></strong><small>Original payout amounts</small></div>
      </section>
      <section className={styles.overview}>
        <div className={styles.sectionTop}><div><h2>Reporting outcomes</h2><p>{candidates.toLocaleString()} refund candidates in this snapshot</p></div><button className={styles.textButton} onClick={() => outcomeFilter('ALL')}>View all candidates →</button></div>
        <div className={styles.outcomeBar} role="img" aria-label={auditOutcomes.map((o) => `${o.label}: ${run.outcomes?.[o.value] || 0}`).join(', ')}>{auditOutcomes.filter((o) => run.outcomes?.[o.value]).map((o) => <span key={o.value} style={{ width: `${run.outcomes[o.value] / Math.max(1, candidates) * 100}%`, background: o.color }} title={`${o.label}: ${run.outcomes[o.value]}`} />)}</div>
        <div className={styles.legend}>{auditOutcomes.filter((o) => run.outcomes?.[o.value]).map((o) => <button key={o.value} title={o.description} aria-pressed={filters.outcome === o.value} onClick={() => outcomeFilter(o.value)}><span style={{ background: o.color }} />{o.label}<strong>{run.outcomes[o.value].toLocaleString()}</strong></button>)}</div>
        <p className={styles.contextNote}>Not-found and declined results do not prove that a recipient was unpaid. Refund totals are historical credits; later recoveries are not deducted.</p>
      </section>
      <section className={styles.results} aria-label="Audit results">
        <div className={styles.sectionTop}><div className={styles.tabs} role="tablist" aria-label="Results view">{['accounts', 'transactions'].map((value) => <button key={value} role="tab" aria-selected={view === value} onClick={() => { setView(value); setPage(0); }}>{value === 'accounts' ? 'Accounts' : 'Transactions'}</button>)}</div><div className={styles.exports}><Link className={styles.button} style={{ textDecoration: 'none' }} href={providerReportHref()}>Provider document</Link><button className={styles.button} disabled={exporting || denied} onClick={() => exportReport('csv')}>{exporting ? 'Exporting…' : 'Export CSV'}</button><button className={styles.button} disabled={exporting || denied} onClick={() => exportReport('json')}>Evidence JSON</button></div></div>
        <form className={styles.filters} onSubmit={apply}>
          <label className={styles.search}><span>Search</span><input aria-label="Search accounts or payouts" placeholder="Name, email, reference or ID" value={draft.query} maxLength={200} onChange={(e) => setDraft({ ...draft, query: e.target.value })} /></label>
          <label><span>Outcome</span><select aria-label="Outcome" value={draft.outcome} onChange={(e) => setDraft({ ...draft, outcome: e.target.value })}><option value="ALL">All outcomes</option>{auditOutcomes.map((o) => <option value={o.value} key={o.value}>{o.label}</option>)}</select></label>
          <label><span>Currency</span><select aria-label="Currency" value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })}><option value="">All currencies</option>{(run.currencies || []).map((currency) => <option key={currency}>{currency}</option>)}</select></label>
          <label className={styles.accountFilter}><span>Account ID</span><input aria-label="Account ID" inputMode="numeric" placeholder="Any" value={draft.accountId} onChange={(e) => setDraft({ ...draft, accountId: e.target.value })} /></label>
          <button className={styles.button} type="submit">Apply</button>
          {(filters.query || filters.accountId || filters.currency || filters.outcome !== 'CONFIRMED') && <button className={styles.textButton} type="button" onClick={() => { setFilters(emptyFilters); setDraft(emptyFilters); setPage(0); }}>Reset</button>}
        </form>
        <div className={styles.resultCaption}><span>{rowsLoading ? 'Loading results…' : `${total.toLocaleString()} ${view}`} · {filters.outcome === 'ALL' ? 'All outcomes' : outcomeInfo(filters.outcome).label}{filters.accountId ? ` · Account #${filters.accountId}` : ''}</span><small>Exports include all filtered transactions</small></div>
        {rowsLoading ? <div className={styles.tableLoading} role="status">Loading {view}…</div> : <DataTable columns={view === 'accounts' ? accountRows : transactionRows} rows={rows} page={page} pageSize={20} totalPages={totalPages} totalElements={total} onPageChange={setPage} showIndex={false} showAccountQuickNav={false} emptyLabel={processing && filters.outcome === 'CONFIRMED' ? 'Confirmed cases appear here as provider checks finish.' : 'No results match these filters.'} />}
      </section>
      <footer className={styles.footer}>ArakaPay reporting and wallet credit evidence · Report {run.id.slice(0, 8)} · {run.status === 'COMPLETED' ? `Completed ${dateTime(run.completedAt)}` : `Snapshot ${dateTime(run.snapshotAt)}`}</footer>
    </>}
    {newAudit && <Dialog title="Run a refund audit" onClose={() => { if (!starting) setNewAudit(false); }}><form className={styles.newAuditForm} onSubmit={start}>
      <p>Read ArakaPay payout reporting and compare it with wallet refund credits. Large audits may take several minutes.</p>
      <label><span>Report label <small>Optional</small></span><input value={scope.label} maxLength={120} placeholder="e.g. November payout review" onChange={(e) => setScope({ ...scope, label: e.target.value })} /></label>
      <div className={styles.formDates}><label><span>From <small>UTC · optional</small></span><input type="date" value={scope.from} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setScope({ ...scope, from: e.target.value })} /></label><label><span>Through <small>UTC · optional</small></span><input type="date" value={scope.to} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setScope({ ...scope, to: e.target.value })} /></label></div>
      <label><span>Account ID <small>Optional</small></span><input inputMode="numeric" placeholder="All accounts" value={scope.accountId} onChange={(e) => setScope({ ...scope, accountId: e.target.value })} /></label>
      <div className={styles.notice}>Blank dates cover all stored history. Each audit supports up to 5,000 refund candidates. Provider lookups save observations without changing payout statuses or wallet balances.</div>
      {startError && <div className={styles.error} role="alert">{startError}</div>}
      <div className={styles.dialogActions}><button type="button" className={styles.button} disabled={starting} onClick={() => setNewAudit(false)}>Cancel</button><button type="submit" className={styles.primary} disabled={starting}>{starting ? 'Preparing audit…' : 'Start audit'}</button></div>
    </form></Dialog>}
    {selected != null && runId && <Detail runId={runId} transactionId={selected} onClose={() => setSelected(null)} />}
  </div>;
}
export default function PayoutRefundAuditsPage() { return <Suspense fallback={<div role="status">Loading refund audits…</div>}><Workspace /></Suspense>; }
