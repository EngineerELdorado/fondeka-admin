'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { api } from '@/lib/api';
import { checkedReport, clearReportRecovery, readReportIntent, reportDownload, reportPollDelay, reportRequest, reportStorageKey, terminalReport } from '@/lib/asset-reports';
import styles from './RevenueReportExport.module.css';

const initialForm = (locale) => ({ asOf: new Date().toISOString().slice(0, 10), language: locale === 'fr' ? 'fr' : 'en', timeZone: 'UTC', currency: 'USD', categoryId: '', nature: '', includeInactive: false, includeDetails: true });

export default function AssetReportExport({ categories, selectedAsOf, selectedCategoryId, selectedCurrency, selectedNature, selectedIncludeInactive } = {}) {
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
  const [availableCategories, setAvailableCategories] = useState([]);
  const [categoryError, setCategoryError] = useState('');
  const categoryOptions = categories ?? availableCategories;
  const fr = locale === 'fr';
  const text = (en, french) => fr ? french : en;
  const states = fr ? { QUEUED: 'En attente', PROCESSING: 'Génération en cours', COMPLETED: 'Rapport prêt', FAILED: 'Échec de génération', EXPIRED: 'Rapport expiré' }
    : { QUEUED: 'Queued', PROCESSING: 'Generating report', COMPLETED: 'Report ready', FAILED: 'Generation failed', EXPIRED: 'Report expired' };
  useEffect(() => {
    let current = true;
    setAvailableCategories([]); setCategoryError('');
    if (!actor || categories != null) return;
    api.assets.categoryOptions().then(values => { if (current) setAvailableCategories(values); })
      .catch(failure => { if (current) setCategoryError(failure.message || text('Category options could not be loaded. The selected scope is retained.', 'Impossible de charger les catégories. Le périmètre sélectionné est conservé.')); });
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, categories]);
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
      const result = checkedReport(await api.assets.createReport(next.request, next.key, { signal: abort.signal }), null, next.request);
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
      const result = checkedReport(await api.assets.getReport(next.jobId, { signal: abort.signal }), next.jobId, next.request);
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
    <button className="btn-neutral btn-sm" type="button" disabled={!actor} onClick={() => { setNow(Date.now()); if (!intent) setForm(value => ({ ...value, asOf: selectedAsOf || value.asOf, categoryId: selectedCategoryId === undefined ? value.categoryId : String(selectedCategoryId || ''), currency: selectedCurrency || value.currency, nature: selectedNature === undefined ? value.nature : selectedNature || '', includeInactive: selectedIncludeInactive === undefined ? value.includeInactive : selectedIncludeInactive === true })); setOpen(true); }}>{text('Export asset PDF', 'Exporter les actifs en PDF')}</button>
    <dialog ref={dialog} className={styles.dialog} onCancel={() => setOpen(false)} onClose={() => setOpen(false)} aria-labelledby="asset-report-title">
      <div className={styles.header}><div><span className={styles.eyebrow}>FONDEKA</span><h2 id="asset-report-title">{text('Asset register report', 'Rapport du registre des actifs')}</h2></div><button className="btn-neutral btn-sm" type="button" aria-label={text('Close', 'Fermer')} onClick={() => setOpen(false)}>×</button></div>
      <p className={styles.description}>{text('A snapshot of recorded assets and estimated recoverable receivables at the selected date, in one currency. Search text and table pagination do not apply.', 'Une photographie des biens enregistrés et des créances estimées recouvrables à la date choisie, dans une seule devise. Le texte recherché et la pagination du tableau ne s’appliquent pas.')}</p>
      {!intent && <form onSubmit={submit} className={styles.form}>
        <div className={styles.pair}><label>{text('As of date', 'Situation au')}<input type="date" required min="1900-01-01" max={new Date(now).toISOString().slice(0,10)} value={form.asOf} onChange={applyForm('asOf')} /></label><label>{text('Currency', 'Devise')}<input required maxLength={3} value={form.currency} onChange={applyForm('currency')} /></label></div>
        <div className={styles.pair}><label>{text('Category', 'Catégorie')}<select value={form.categoryId} onChange={applyForm('categoryId')}><option value="">{text('All categories', 'Toutes les catégories')}</option>{form.categoryId && !categoryOptions.some(category => String(category.id) === String(form.categoryId)) && <option value={form.categoryId}>{text('Category', 'Catégorie')} #{form.categoryId} ({text('current selection', 'sélection actuelle')})</option>}{categoryOptions.map(category => <option key={category.id} value={category.id}>{fr && category.nameFr ? category.nameFr : category.nameEn}</option>)}</select></label><label>{text('Nature', 'Nature')}<select value={form.nature} onChange={applyForm('nature')}><option value="">{text('All natures', 'Toutes les natures')}</option><option value="TANGIBLE">{text('Physical assets', 'Biens matériels')}</option><option value="RECEIVABLE">{text('Receivables', 'Créances à recouvrer')}</option><option value="OTHER">{text('Other assets', 'Autres actifs')}</option></select></label></div>
        {categoryError && <p role="alert">{categoryError}</p>}
        <label><input type="checkbox" checked={form.includeDetails} onChange={e => setForm(v => ({ ...v, includeDetails: e.target.checked }))} /> {text('Include the full inventory detail', 'Inclure le détail complet du registre')}</label>
        <label><input type="checkbox" checked={form.includeInactive} onChange={e => setForm(v => ({ ...v, includeInactive: e.target.checked }))} /> {text('List closed entries separately from held totals', 'Lister les fiches clôturées sans les inclure dans le total détenu')}</label>
        <div className={styles.pair}><label>{text('PDF language', 'Langue du PDF')}<select value={form.language} onChange={applyForm('language')}><option value="en">English</option><option value="fr">Français</option></select></label><label>{text('Reporting timezone', 'Fuseau horaire')}<input required maxLength={80} list="asset-report-zones" value={form.timeZone} onChange={applyForm('timeZone')} /><datalist id="asset-report-zones"><option value="UTC"/><option value="Africa/Kinshasa"/><option value="Africa/Lubumbashi"/><option value="Europe/Luxembourg"/></datalist></label></div>
        <p className={styles.description}>{text('Missing valuations are identified. Totals include held entries only. No automatic currency conversion is applied.', 'Les valorisations manquantes sont signalées. Les totaux comprennent uniquement les fiches détenues. Aucune conversion de devise n’est appliquée.')}</p>
        <button className="btn-primary" disabled={busy || !storageReady}>{text('Generate PDF', 'Générer le PDF')}</button>
      </form>}
      {intent && <div className={styles.progress} aria-live="polite">
        <strong>{job ? states[expired ? 'EXPIRED' : job.status] : text('Submission awaiting confirmation', 'Confirmation de la demande en attente')}</strong>
        <span>{job?.asOf || intent.request.asOf} · {intent.request.language.toUpperCase()} · {intent.request.currency} · {intent.request.timeZone}</span>
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
