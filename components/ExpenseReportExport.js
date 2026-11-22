'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { api } from '@/lib/api';
import MonthPicker from '@/components/MonthPicker';
import { checkedReport, clearReportRecovery, previousReportMonth, readReportIntent, reportDownload, reportPollDelay, reportRequest, reportStorageKey, terminalReport } from '@/lib/expense-reports';
import styles from './RevenueReportExport.module.css';

const initialForm = (locale) => ({ mode: 'month', month: previousReportMonth(), from: '', to: '', language: locale === 'fr' ? 'fr' : 'en', timeZone: 'UTC', currency: 'USD', reportMode: 'ACTUALS', includeDetails: false });

export default function ExpenseReportExport() {
  const { adminProfile } = useAuth();
  const { locale } = useLocale();
  const canExport = ['ADMIN', 'SUPER_ADMIN'].includes(adminProfile?.role);
  const actor = canExport && adminProfile?.id != null ? String(adminProfile.id) : null;
  const identity = useRef(actor); identity.current = actor;
  const dialog = useRef(null), controller = useRef(null), intentRef = useRef(null), priorActor = useRef(null), readCount = useRef(0);
  const [open, setOpen] = useState(false);
  const [storedIntent, setIntent] = useState(null);
  const [storedJob, setJob] = useState(null);
  const intent = storedIntent?.actor === actor ? storedIntent : null;
  const job = intent ? storedJob : null;
  const [error, setError] = useState('');
  const [operation, setOperation] = useState(null);
  const busy = operation !== null;
  const [reads, setReads] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [readyActor, setReadyActor] = useState(null);
  const storageReady = Boolean(actor && readyActor === actor);
  const [visible, setVisible] = useState(true);
  const [now, setNow] = useState(Date.now);
  const [form, setForm] = useState(() => initialForm(locale));
  const fr = locale === 'fr';
  const text = (en, french) => fr ? french : en;
  const states = fr ? { QUEUED: 'En attente', PROCESSING: 'Génération en cours', COMPLETED: 'Rapport prêt', FAILED: 'Échec de génération', EXPIRED: 'Rapport expiré' }
    : { QUEUED: 'Queued', PROCESSING: 'Generating report', COMPLETED: 'Report ready', FAILED: 'Generation failed', EXPIRED: 'Report expired' };
  useEffect(() => {
    controller.current?.abort(); controller.current = null; intentRef.current = null; readCount.current = 0;
    setIntent(null); setJob(null); setError(''); setOperation(null); setReads(0); setAutoPaused(false); setRejected(false); setReadyActor(null);
    if (priorActor.current && priorActor.current !== actor) {
      setOpen(false);
      try { clearReportRecovery(sessionStorage); } catch {}
    }
    priorActor.current = actor;
    if (!actor) return;
    setForm(initialForm(locale));
    try {
      clearReportRecovery(sessionStorage, actor);
      const key = reportStorageKey(actor), restored = readReportIntent(sessionStorage.getItem(key), actor);
      if (restored) sessionStorage.setItem(key, JSON.stringify(restored));
      else sessionStorage.removeItem(key);
      intentRef.current = restored; setIntent(restored); setReadyActor(actor);
    } catch { setError(text('Browser session storage is unavailable. Enable it to recover interrupted exports.', 'Le stockage de session est indisponible. Activez-le pour reprendre un export interrompu.')); }
    return () => controller.current?.abort();
    // PDF language is independent of the UI language once an export is reviewed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor]);
  useEffect(() => {
    const changed = () => { setVisible(!document.hidden); setNow(Date.now()); };
    changed(); document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); else if (!open && dialog.current?.open) dialog.current?.close(); }, [open]);
  useEffect(() => {
    setNow(Date.now());
    if (!job) return;
    const deadline = Math.min(...[job.downloadUrlExpiresAt, job.expiresAt].map(Date.parse).filter(Number.isFinite));
    if (!Number.isFinite(deadline) || deadline <= Date.now()) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(2147483647, deadline - Date.now() + 1));
    return () => clearTimeout(timer);
  }, [job]);
  const persist = (next, owner) => {
    const clean = readReportIntent(JSON.stringify(next), owner);
    if (!clean) throw new Error('This report request could not be saved for recovery.');
    sessionStorage.setItem(reportStorageKey(owner), JSON.stringify(clean)); intentRef.current = clean; setIntent(clean);
  };
  const applyForm = (field) => (e) => setForm((value) => ({ ...value, [field]: e.target.value }));
  async function submit(event) {
    event?.preventDefault(); if (!actor || identity.current !== actor || controller.current || !storageReady) return;
    let next = intentRef.current;
    if (next?.jobId) return;
    try { if (!next) next = { actor, key: crypto.randomUUID(), request: reportRequest(form), jobId: null }; }
    catch (failure) { setError(failure.message); return; }
    const owner = actor, abort = new AbortController(); controller.current = abort;
    setError(''); setRejected(false); setOperation('submit');
    try {
      persist(next, owner); // Persist exact criteria/key before the first POST.
      const result = checkedReport(await api.expenses.createReport(next.request, next.key, { signal: abort.signal }), null, next.request);
      if (identity.current !== owner || abort.signal.aborted) return;
      persist({ ...next, jobId: result.id }, owner); setJob(result); setReads(0); readCount.current = 0; setAutoPaused(false);
    } catch (failure) {
      if (identity.current !== owner || abort.signal.aborted) return;
      setError(failure.message || text('The submission was not confirmed. Retry this same request.', 'La demande n’est pas confirmée. Réessayez cette même demande.'));
      setRejected([400, 403, 404, 422, 503].includes(failure.status) || failure.status === 409 && failure.data?.errorCode === 'IDEMPOTENCY_CONFLICT');
    } finally { if (controller.current === abort) { controller.current = null; if (identity.current === owner && !abort.signal.aborted) setOperation(null); } }
  }
  async function check(manual = false) {
    const next = intentRef.current;
    if (!next?.jobId || !actor || identity.current !== actor || next.actor !== actor || !storageReady || controller.current) return;
    if (!manual && (document.hidden || autoPaused || readCount.current >= 12)) return;
    const owner = actor, abort = new AbortController(); controller.current = abort;
    setOperation('check'); setError('');
    const count = ++readCount.current; setReads(count); if (count >= 12) setAutoPaused(true);
    try {
      const result = checkedReport(await api.expenses.getReport(next.jobId, { signal: abort.signal }), next.jobId, next.request);
      if (identity.current !== owner || abort.signal.aborted) return;
      setJob(result);
    } catch (failure) {
      if (identity.current === owner && !abort.signal.aborted) { setAutoPaused(true); setError(failure.message || text('Progress could not be checked.', 'Impossible de vérifier l’avancement.')); }
    } finally { if (controller.current === abort) { controller.current = null; if (identity.current === owner && !abort.signal.aborted) setOperation(null); } }
  }
  const expired = job && Date.parse(job.expiresAt) <= now;
  useEffect(() => {
    if (!open || !visible || !storageReady || !intent?.jobId || busy || error || autoPaused || expired || (terminalReport(job) && (job.status !== 'COMPLETED' || job.downloadUrl)) || reads >= 12) return;
    const timer = setTimeout(() => check(), reportPollDelay(reads)); return () => clearTimeout(timer);
    // Dependencies cancel obsolete timers; the operation ref also prevents overlapping reads/submits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visible, storageReady, actor, intent, job, busy, error, autoPaused, expired, reads]);
  const reset = () => {
    if (controller.current) return;
    try { sessionStorage.removeItem(reportStorageKey(actor)); }
    catch { setError(text('The previous request could not be cleared. Try again before starting a new report.', 'Impossible d’effacer la demande précédente. Réessayez avant de créer un rapport.')); return; }
    intentRef.current = null; readCount.current = 0; setIntent(null); setJob(null); setError(''); setReads(0); setAutoPaused(false); setRejected(false); setForm(initialForm(locale));
  };
  const download = reportDownload(job, now);
  if (!canExport) return null;
  return <>
    <button className="btn-neutral btn-sm" type="button" disabled={!actor} onClick={() => { setNow(Date.now()); setOpen(true); }}>{text('Export expense PDF', 'Exporter les dépenses en PDF')}</button>
    <dialog ref={dialog} className={styles.dialog} onCancel={() => setOpen(false)} onClose={() => setOpen(false)} aria-labelledby="expense-report-title">
      <div className={styles.header}><div><span className={styles.eyebrow}>FONDEKA</span><h2 id="expense-report-title">{text('Expense report', 'Rapport de dépenses')}</h2></div><button className="btn-neutral btn-sm" type="button" aria-label={text('Close', 'Fermer')} onClick={() => setOpen(false)}>×</button></div>
      <p className={styles.description}>{text('Recorded monthly expenses, with optional budget comparison. Choose complete calendar months in one currency.', 'Dépenses mensuelles renseignées, avec comparaison au budget en option. Choisissez des mois complets dans une seule devise.')}</p>
      {!intent && <form onSubmit={submit} className={styles.form}>
        <label>{text('Period', 'Période')}<select value={form.mode} onChange={applyForm('mode')}><option value="month">{text('Month', 'Mois')}</option><option value="range">{text('Date range', 'Plage de dates')}</option></select></label>
        {form.mode === 'month' ? <MonthPicker label={text('Reporting month', 'Mois du rapport')} locale={locale} value={form.month} onChange={month => setForm(value => ({ ...value, month }))} /> : <div className={styles.pair}><label>{text('From (first day of month)', 'Du (premier jour du mois)')}<input type="date" required value={form.from} onChange={applyForm('from')} /></label><label>{text('To (last day of month)', 'Au (dernier jour du mois)')}<input type="date" required value={form.to} onChange={applyForm('to')} /></label></div>}
        <div className={styles.pair}><label>{text('Currency', 'Devise')}<input required maxLength={3} value={form.currency} onChange={applyForm('currency')} /></label><label>{text('Content', 'Contenu')}<select value={form.reportMode} onChange={applyForm('reportMode')}><option value="ACTUALS">{text('Actual expenses', 'Dépenses réalisées')}</option><option value="BUDGET_VS_ACTUAL">{text('Budget versus actual', 'Budget et réalisé')}</option></select></label></div>
        <label><input type="checkbox" checked={form.includeDetails} onChange={e => setForm(v => ({ ...v, includeDetails: e.target.checked }))} /> {text('Include monthly category details', 'Inclure le détail des catégories par mois')}</label>
        <div className={styles.pair}><label>{text('PDF language', 'Langue du PDF')}<select value={form.language} onChange={applyForm('language')}><option value="en">English</option><option value="fr">Français</option></select></label><label>{text('Reporting timezone', 'Fuseau horaire')}<input required maxLength={80} list="expense-report-zones" value={form.timeZone} onChange={applyForm('timeZone')} /><datalist id="expense-report-zones"><option value="UTC"/><option value="Africa/Kinshasa"/><option value="Africa/Lubumbashi"/><option value="Europe/Luxembourg"/></datalist></label></div>
        <p className={styles.description}>{text('Unfilled amounts and missing months are identified. No currency conversion or partial-month estimates are applied.', 'Les montants vides et les mois manquants sont signalés. Aucune conversion de devise ni estimation de mois partiel n’est appliquée.')}</p>
        <button className="btn-primary" disabled={busy || !storageReady}>{text('Generate PDF', 'Générer le PDF')}</button>
      </form>}
      {intent && <div className={styles.progress} aria-live="polite">
        <strong>{job ? states[expired ? 'EXPIRED' : job.status] : text('Submission awaiting confirmation', 'Confirmation de la demande en attente')}</strong>
        <span>{job ? `${job.fromDate} → ${job.toDate}` : intent.request.month || `${intent.request.from} → ${intent.request.to}`} · {intent.request.language.toUpperCase()} · {intent.request.currency} · {intent.request.timeZone}</span>
        {job?.monthToDate && <small>{text('Month to date', 'Mois en cours')}</small>}
        {job?.id && <small>{text('Report reference: ', 'Référence : ')}{job.id}</small>}
        {job?.errorMessage && <p>{job.errorMessage}</p>}
        {!terminalReport(job) && <p>{text('You can close this window while the report is prepared. Return here to check progress.', 'Vous pouvez fermer cette fenêtre pendant la préparation du rapport et revenir ici pour suivre son avancement.')}</p>}
        <div className={styles.actions}>
          {download && <a className="btn-primary" href={download} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{text('Download PDF', 'Télécharger le PDF')}</a>}
          {intent.jobId ? <button className="btn-neutral" disabled={busy} onClick={() => check(true)}>{text('Check progress / refresh link', 'Vérifier / actualiser le lien')}</button> : <button className="btn-neutral" disabled={busy} onClick={submit}>{text('Retry this submission', 'Réessayer cette demande')}</button>}
          {(terminalReport(job) || expired || rejected) && <button className="btn-neutral" disabled={busy} onClick={reset}>{text('New report', 'Nouveau rapport')}</button>}
        </div>
        {busy && <small>{operation === 'submit' ? text('Submitting…', 'Envoi…') : text('Checking…', 'Vérification…')}</small>}
        {job?.status === 'COMPLETED' && !download && !expired && <small>{text('Check progress to obtain a fresh download link.', 'Vérifiez l’avancement pour obtenir un nouveau lien de téléchargement.')}</small>}
        {autoPaused && !terminalReport(job) && !expired && <small>{text('Automatic checks paused. Use Check progress to continue.', 'Vérifications automatiques en pause. Cliquez sur Vérifier pour continuer.')}</small>}
      </div>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </dialog>
  </>;
}
