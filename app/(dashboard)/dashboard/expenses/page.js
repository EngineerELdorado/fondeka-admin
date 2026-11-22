'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { api } from '@/lib/api';
import ExpenseReportExport from '@/components/ExpenseReportExport';
import MonthPicker from '@/components/MonthPicker';
import { budgetRecoveryKey, checkedBudgetResult, clearBudgetRecovery, draftTotals, readBudgetIntent, updateBudgetRequest } from '@/lib/expense-budgets';
import styles from './expenses.module.css';

const blankItem = { id: null, version: null, nameEn: '', nameFr: '', active: true, displayOrder: 0 };
export default function ExpenseBudgetsPage() {
  const { adminProfile } = useAuth(), { locale } = useLocale();
  const allowed = ['ADMIN', 'SUPER_ADMIN'].includes(adminProfile?.role), actor = allowed && adminProfile?.id != null ? String(adminProfile.id) : null;
  const identity = useRef(actor); identity.current = actor;
  const controller = useRef(null), pending = useRef(null), readController = useRef(null), sequence = useRef(0), prior = useRef(null);
  const catalogueController = useRef(null), historyController = useRef(null);
  const [ready, setReady] = useState(null), [intent, setIntent] = useState(null), [busy, setBusy] = useState(false), [rejected, setRejected] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [tab, setTab] = useState('budget');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)), [currency, setCurrency] = useState('USD');
  const [budget, setBudget] = useState(null), [loaded, setLoaded] = useState(false), [lines, setLines] = useState([]), [note, setNote] = useState('');
  const [source, setSource] = useState('EMPTY'), [copyMonth, setCopyMonth] = useState(''), [includeActuals, setIncludeActuals] = useState(false);
  const [template, setTemplate] = useState(null), [templateError, setTemplateError] = useState(''), [templateConfirmed, setTemplateConfirmed] = useState(false);
  const [items, setItems] = useState([]), [catalogue, setCatalogue] = useState([]), [cataloguePage, setCataloguePage] = useState(0), [cataloguePages, setCataloguePages] = useState(0), [archived, setArchived] = useState(false), [item, setItem] = useState(blankItem), [addId, setAddId] = useState('');
  const [history, setHistory] = useState([]), [historyPage, setHistoryPage] = useState(0), [historyPages, setHistoryPages] = useState(0);
  const [catalogueLoading, setCatalogueLoading] = useState(false), [historyLoading, setHistoryLoading] = useState(false), [historyOpened, setHistoryOpened] = useState(false);
  const fr = locale === 'fr', text = (en, french) => fr ? french : en, label = row => fr && row.nameFr ? row.nameFr : row.nameEn;
  const frozen = !actor || busy || Boolean(intent) || ready !== actor;
  const currentIntent = intent?.actor === actor ? intent : null;
  const totals = useMemo(() => { try { return { value: draftTotals(lines, budget?.currency || currency), error: null }; } catch (failure) { return { value: null, error: failure.message }; } }, [lines, budget, currency]);

  useEffect(() => {
    controller.current?.abort(); readController.current?.abort(); catalogueController.current?.abort(); historyController.current?.abort(); pending.current = null; sequence.current++;
    setIntent(null); setBudget(null); setLines([]); setItems([]); setCatalogue([]); setHistory([]); setLoaded(false); setReady(null); setBusy(false); setError(''); setMessage(''); setRejected(false); setItem(blankItem);
    if (prior.current && prior.current !== actor) { setMonth(new Date().toISOString().slice(0, 7)); setCurrency('USD'); }
    prior.current = actor;
    try {
      clearBudgetRecovery(sessionStorage, actor);
      if (!actor) return;
      const value = readBudgetIntent(sessionStorage.getItem(budgetRecoveryKey(actor)), actor);
      if (value) { pending.current = value; setIntent(value); } else sessionStorage.removeItem(budgetRecoveryKey(actor));
      setReady(actor);
    } catch { setError(text('Enable browser session storage to recover interrupted changes.', 'Activez le stockage de session pour reprendre les modifications interrompues.')); }
    return () => { controller.current?.abort(); readController.current?.abort(); catalogueController.current?.abort(); historyController.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor]);

  async function load() {
    if (!actor || identity.current !== actor) return;
    const owner = actor, number = ++sequence.current; readController.current?.abort(); const abort = new AbortController(); readController.current = abort;
    historyController.current?.abort(); setHistoryLoading(false); setHistoryOpened(false);
    setLoaded(false); setError(''); setBudget(null); setLines([]); setHistory([]); setNote(''); setAddId('');
    if (!/^[A-Z]{3}$/.test(currency) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < '2000-01') {
      setError(text('Choose a month from January 2000 and a three-letter currency.', 'Choisissez un mois à partir de janvier 2000 et une devise à trois lettres.')); return;
    }
    try {
      const active = []; let page = 0;
      while (page < 3) { const result = await api.expenses.items({ page, size: 200, includeArchived: false }, { signal: abort.signal }); active.push(...result.content); page++; if (page >= result.page.totalPages) break; }
      let value = null;
      try { value = await api.expenses.byMonth(month, currency.trim().toUpperCase(), { signal: abort.signal }); } catch (failure) { if (failure.status !== 404) throw failure; }
      if (identity.current !== owner || number !== sequence.current || abort.signal.aborted) return;
      setItems(active); setBudget(value); setLines(value?.lines.map(line => ({ ...line, planned: line.planned ?? '', actual: line.actual ?? '', note: line.note ?? '' })) || []); setNote(value?.note || ''); setLoaded(true);
    } catch (failure) { if (identity.current === owner && number === sequence.current && !abort.signal.aborted) setError(failure.message || 'Could not load expenses.'); }
  }
  useEffect(() => { if (actor && ready === actor && !intent) load(); return () => { readController.current?.abort(); historyController.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, ready, month, currency, Boolean(intent)]);

  async function loadCatalogue(page = cataloguePage) {
    if (!actor || identity.current !== actor) return;
    const owner = actor;
    catalogueController.current?.abort(); const abort = new AbortController(); catalogueController.current = abort;
    setCatalogueLoading(true); setError('');
    try {
      const result = await api.expenses.items({ page, size: 50, includeArchived: archived }, { signal: abort.signal });
      if (identity.current !== owner || abort.signal.aborted) return;
      if (page > 0 && !result.content.length && page >= result.page.totalPages) { loadCatalogue(Math.max(0, result.page.totalPages - 1)); return; }
      setCatalogue(result.content); setCataloguePage(page); setCataloguePages(result.page.totalPages);
    } catch (failure) { if (identity.current === owner && !abort.signal.aborted) setError(failure.message); }
    finally { if (identity.current === owner && !abort.signal.aborted) setCatalogueLoading(false); }
  }
  useEffect(() => { if (actor && ready === actor && tab === 'catalogue') loadCatalogue(0); return () => catalogueController.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, ready, tab, archived]);

  useEffect(() => { setIncludeActuals(false); setTemplateConfirmed(false); }, [month, currency, source]);
  useEffect(() => {
    setTemplate(null); setTemplateError('');
    if (!actor || ready !== actor || source !== 'CSV' || !loaded || budget || tab !== 'budget') return;
    const abort = new AbortController();
    api.expenses.template({ signal: abort.signal }).then(value => {
      if (!abort.signal.aborted) setTemplate(value);
    }).catch(failure => { if (!abort.signal.aborted) setTemplateError(failure.message || 'Could not load the starter template.'); });
    return () => abort.abort();
  }, [actor, ready, source, loaded, budget, tab]);

  async function mutate(operation, request, id) {
    if (!actor || identity.current !== actor || controller.current || ready !== actor) return;
    const owner = actor, abort = new AbortController(); controller.current = abort; setBusy(true); setError(''); setMessage(''); setRejected(false);
    try {
      let next = pending.current;
      if (!next) {
        if (operation === 'createBudget' && source === 'COPY') { const previous = await api.expenses.byMonth(copyMonth, currency.trim().toUpperCase(), { signal: abort.signal }); request = { ...request, copyFrom: previous.id }; }
        if (identity.current !== owner || abort.signal.aborted) return;
        next = { actor: owner, key: crypto.randomUUID(), operation, request, ...(id == null ? {} : { id }) };
        const clean = readBudgetIntent(JSON.stringify(next), owner); if (!clean) throw new Error('Invalid expense request.');
        sessionStorage.setItem(budgetRecoveryKey(owner), JSON.stringify(clean)); pending.current = clean; setIntent(clean); next = clean;
      }
      const methods = {
        createBudget: () => api.expenses.create(next.request, next.key, { signal: abort.signal }),
        updateBudget: () => api.expenses.update(next.id, next.request, next.key, { signal: abort.signal }),
        createItem: () => api.expenses.createItem(next.request, next.key, { signal: abort.signal }),
        updateItem: () => api.expenses.updateItem(next.id, next.request, next.key, { signal: abort.signal })
      };
      const result = checkedBudgetResult(await methods[next.operation](), next);
      if (identity.current !== owner || abort.signal.aborted) return;
      sessionStorage.removeItem(budgetRecoveryKey(owner)); pending.current = null; setIntent(null); setItem(blankItem);
      if (next.operation.endsWith('Budget')) { setMonth(result.month); setCurrency(result.currency); }
      setMessage(text('Changes saved.', 'Modifications enregistrées.')); if (tab === 'catalogue') loadCatalogue();
    } catch (failure) {
      if (identity.current !== owner || abort.signal.aborted) return;
      setError(failure.message || text('The outcome is not confirmed. Retry the saved request.', 'Le résultat n’est pas confirmé. Réessayez la demande enregistrée.'));
      setRejected([400, 403, 404, 409, 422].includes(failure.status));
    } finally { if (controller.current === abort) { controller.current = null; if (identity.current === owner && !abort.signal.aborted) setBusy(false); } }
  }
  const abandonRejected = () => {
    try {
      sessionStorage.removeItem(budgetRecoveryKey(actor)); pending.current = null; setIntent(null); setError(''); setRejected(false); setItem(blankItem);
      if (tab === 'catalogue') loadCatalogue(0);
    } catch { setError('Could not clear this request.'); }
  };
  function save(event) { event.preventDefault(); try { mutate('updateBudget', updateBudgetRequest(budget, lines, note), budget.id); } catch (failure) { setError(failure.message); } }
  function create(event) {
    event.preventDefault();
    if (source === 'CSV' && (!template || !templateConfirmed)) { setError(text('Confirm the template month and currency first.', 'Confirmez d’abord le mois et la devise du modèle.')); return; }
    mutate('createBudget', { month, currency: currency.trim().toUpperCase(), source, includeSourceActuals: source === 'CSV' && includeActuals, note: note.trim() || null });
  }
  async function loadHistory(page = 0) {
    if (!actor || !budget || identity.current !== actor) return;
    const owner = actor;
    historyController.current?.abort(); const abort = new AbortController(); historyController.current = abort;
    setHistoryLoading(true); setHistoryOpened(true); setError('');
    try {
      const value = await api.expenses.history(budget.id, { page, size: 10 }, { signal: abort.signal });
      if (identity.current === owner && !abort.signal.aborted) { setHistory(value.content); setHistoryPage(page); setHistoryPages(value.page.totalPages); }
    } catch (failure) { if (identity.current === owner && !abort.signal.aborted) setError(failure.message); }
    finally { if (identity.current === owner && !abort.signal.aborted) setHistoryLoading(false); }
  }
  function changeLine(id, field, value) { setLines(rows => rows.map(row => row.expenseItemId === id ? { ...row, [field]: value } : row)); }
  const amount = value => value == null ? text('Not entered', 'Non renseigné') : value;
  if (!allowed) return <p role="alert">{text('Admin access is required.', 'Un accès administrateur est nécessaire.')}</p>;
  return <main className={styles.page}>
    <header className={styles.header}><div><h1>{text('Expense budgets', 'Budgets de dépenses')}</h1><p>{text('Plan expenses, record actual amounts and backfill prior months.', 'Planifiez les dépenses, renseignez le réalisé et complétez les mois précédents.')}</p></div><ExpenseReportExport /></header>
    <div className={styles.tabs}><button className="btn-neutral" aria-pressed={tab === 'budget'} onClick={() => setTab('budget')}>{text('Monthly budgets', 'Budgets mensuels')}</button><button className="btn-neutral" aria-pressed={tab === 'catalogue'} onClick={() => setTab('catalogue')}>{text('Expense categories', 'Catégories de dépenses')}</button></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status">{message}</p>}
    {currentIntent && <section className={styles.notice} aria-live="polite"><strong>{text('Saved change awaiting confirmation', 'Modification enregistrée en attente de confirmation')}</strong><p>{text('Retry with the same saved data. Other edits remain locked until the outcome is confirmed.', 'Réessayez avec les mêmes données enregistrées. Les autres modifications restent verrouillées jusqu’à confirmation.')}</p><button className="btn-primary" disabled={busy} onClick={() => mutate()}>{text('Retry saved change', 'Réessayer la modification')}</button>{rejected && <button className="btn-neutral" disabled={busy} onClick={abandonRejected}>{text('Dismiss rejected request and reload', 'Fermer la demande rejetée et recharger')}</button>}</section>}
    {tab === 'budget' ? <>
      {!loaded && !currentIntent && !error && <p role="status">{text('Loading monthly budget…', 'Chargement du budget mensuel…')}</p>}
      <div className={styles.controls}><div style={{ flex: '1 1 340px', maxWidth: 480 }}><MonthPicker label={text('Month (past or future)', 'Mois (passé ou futur)')} locale={locale} disabled={frozen} value={month} onChange={setMonth} /></div><label>{text('Currency', 'Devise')}<input maxLength={3} disabled={frozen} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} /></label><button className="btn-neutral" disabled={frozen} onClick={load}>{text('Reload', 'Recharger')}</button></div>
      {loaded && !budget && !currentIntent && <form className={styles.panel} onSubmit={create}><h2>{text('Create this month’s budget', 'Créer le budget de ce mois')}</h2><label>{text('Starting point', 'Point de départ')}<select value={source} disabled={frozen} onChange={e => setSource(e.target.value)}><option value="EMPTY">{text('Empty amounts with active categories', 'Montants vides et catégories actives')}</option><option value="COPY">{text('Copy a previous plan (actuals stay empty)', 'Copier un budget précédent (réalisé vide)')}</option><option value="CSV">{text('Use the supplied CSV template', 'Utiliser le modèle CSV fourni')}</option></select></label>
        {source === 'COPY' && <MonthPicker label={text('Source month (same currency)', 'Mois source (même devise)')} locale={locale} disabled={frozen} value={copyMonth} onChange={setCopyMonth} />}
        {source === 'CSV' && <div className={styles.notice}><p>{text('The CSV has no month or currency. Confirm that its figures belong to this selected period and currency before using them.', 'Le CSV ne précise ni mois ni devise. Vérifiez que ses montants correspondent à la période et à la devise choisies avant de les utiliser.')}</p><label><input type="checkbox" disabled={frozen} checked={includeActuals} onChange={e => { setIncludeActuals(e.target.checked); setTemplateConfirmed(false); }} /> {text('Also import its actual amounts into this month', 'Importer aussi ses montants réalisés dans ce mois')}</label>
          {templateError ? <p role="alert" className={styles.error}>{templateError}</p> : !template ? <p role="status">{text('Loading starter figures…', 'Chargement des montants du modèle…')}</p> : <>
            <p>{text('Active starter categories:', 'Catégories actives du modèle :')} {template.items.length} · {text('Planned figures:', 'Montants prévus :')} {template.plannedTotal} · {text('Actual figures:', 'Montants réalisés :')} {template.actualTotal}</p>
            <label><input type="checkbox" disabled={frozen} checked={templateConfirmed} onChange={e => setTemplateConfirmed(e.target.checked)} /> {text('I confirm these figures belong to', 'Je confirme que ces montants correspondent à')} {month} · {currency}{includeActuals ? text(' (including actual amounts)', ' (y compris le réalisé)') : ''}</label>
          </>}
        </div>}
        <label>{text('Monthly notes', 'Notes du mois')}<textarea maxLength={4000} disabled={frozen} value={note} onChange={e => setNote(e.target.value)} /></label>
        <p>{text('Selected budget:', 'Budget sélectionné :')} <strong>{month} · {currency}</strong></p>
        <button className="btn-primary" disabled={frozen || !month || currency.length !== 3 || source === 'CSV' && (!template || !templateConfirmed)}>{text('Create budget', 'Créer le budget')}</button>
      </form>}
      {budget && <form onSubmit={save} className={styles.panel}>
        <h2>{budget.month} · {budget.currency}</h2><p>{text('Leave unknown amounts blank; enter 0 only when confirmed. Actual amounts may be negative for credits. Use a decimal point.', 'Laissez les montants inconnus vides ; saisissez 0 seulement après vérification. Un avoir peut être négatif dans le réalisé. Utilisez un point décimal.')}</p>
        {totals.value && <div className={styles.cards}><div>{totals.value.planned.entered < totals.value.count ? text('Partial planned total', 'Total prévu partiel') : text('Planned', 'Budget')}<strong>{amount(totals.value.planned.amount)} {budget.currency}</strong><small>{totals.value.planned.entered}/{totals.value.count} {text('entered', 'renseignés')}</small></div><div>{totals.value.actual.entered < totals.value.count ? text('Partial actual total', 'Total réalisé partiel') : text('Actual', 'Réalisé')}<strong>{amount(totals.value.actual.amount)} {budget.currency}</strong><small>{totals.value.actual.entered}/{totals.value.count} {text('entered', 'renseignés')}</small></div><div>{text('Variance (planned − actual)', 'Écart (budget − réalisé)')}<strong>{amount(totals.value.variance)} {budget.currency}</strong><small>{totals.value.complete ? text('Positive means under budget', 'Un écart positif indique un budget non dépassé') : text('Requires every planned and actual amount', 'Tous les montants prévus et réalisés sont nécessaires')}</small></div><div>{text('Saved version', 'Version enregistrée')}<strong>{budget.version}</strong><small>{new Date(budget.updatedAt).toLocaleString(locale)}</small></div></div>}
        {totals.error && <p role="alert" className={styles.error}>{totals.error}</p>}
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{text('Category', 'Catégorie')}</th><th>{text('Planned', 'Budget')}</th><th>{text('Actual', 'Réalisé')}</th><th>{text('Note / receipt reference', 'Note / référence du justificatif')}</th><th/></tr></thead><tbody>{lines.map(row => <tr key={row.expenseItemId}><td>{label(row)} {!row.itemActive && <small>({text('archived', 'archivée')})</small>}</td><td><input aria-label={`${text('Planned', 'Budget')} ${label(row)}`} inputMode="decimal" value={row.planned} disabled={frozen} onChange={e => changeLine(row.expenseItemId, 'planned', e.target.value)} /></td><td><input aria-label={`${text('Actual', 'Réalisé')} ${label(row)}`} inputMode="decimal" value={row.actual} disabled={frozen} onChange={e => changeLine(row.expenseItemId, 'actual', e.target.value)} /></td><td><input aria-label={`${text('Note', 'Note')} ${label(row)}`} maxLength={2000} value={row.note} disabled={frozen} onChange={e => changeLine(row.expenseItemId, 'note', e.target.value)} /></td><td><button type="button" className="btn-neutral btn-sm" disabled={frozen} onClick={() => setLines(value => value.filter(line => line.expenseItemId !== row.expenseItemId))}>{text('Remove', 'Retirer')}</button></td></tr>)}</tbody></table></div>
        <div className={styles.controls}><label>{text('Add a category', 'Ajouter une catégorie')}<select value={addId} disabled={frozen} onChange={e => setAddId(e.target.value)}><option value="">{text('Choose…', 'Choisir…')}</option>{items.filter(item => !lines.some(line => line.expenseItemId === item.id)).map(item => <option value={item.id} key={item.id}>{label(item)}</option>)}</select></label><button type="button" className="btn-neutral" disabled={frozen || !addId} onClick={() => { const found = items.find(item => String(item.id) === addId); if (found) setLines(value => [...value, { expenseItemId: found.id, nameEn: found.nameEn, nameFr: found.nameFr, itemActive: found.active, planned: '', actual: '', note: '' }]); setAddId(''); }}>{text('Add', 'Ajouter')}</button></div>
        <label>{text('Monthly notes', 'Notes du mois')}<textarea maxLength={4000} disabled={frozen} value={note} onChange={e => setNote(e.target.value)} /></label>
        <button className="btn-primary" disabled={frozen || Boolean(totals.error)}>{text('Save changes', 'Enregistrer')}</button>
        <button type="button" className="btn-neutral" disabled={busy || historyLoading} onClick={() => loadHistory(0)}>{text('View edit history', 'Voir l’historique')}</button>
      </form>}
      {historyOpened && <section className={styles.panel}><h2>{text('Edit history', 'Historique des modifications')}</h2>
        {historyLoading && <p role="status">{text('Loading history…', 'Chargement de l’historique…')}</p>}
        {!historyLoading && !history.length && !error && <p>{text('No edit history found.', 'Aucune modification trouvée.')}</p>}
        {history.map(entry => <details key={entry.id}>
          <summary>{new Date(entry.createdAt).toLocaleString(locale)} · Admin {entry.actorAdminId} · v{entry.before?.version ?? '—'} → v{entry.after.version}</summary>
          {[['before', text('Before', 'Avant')], ['after', text('After', 'Après')]].map(([key, heading]) => <div key={key}>
            <h3>{heading}</h3>{entry[key] ? <>
              <p>{entry[key].month} · {entry[key].currency} · {text('Planned / actual:', 'Budget / réalisé :')} {amount(entry[key].totals.planned)} / {amount(entry[key].totals.actual)}</p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{entry[key].note}</p>
              <ul>{entry[key].lines.map(line => <li key={line.expenseItemId}>{label(line)} : {amount(line.planned)} / {amount(line.actual)} {entry[key].currency} <span style={{ whiteSpace: 'pre-wrap' }}>{line.note}</span></li>)}</ul>
            </> : <p>{text('Budget not yet created.', 'Budget non encore créé.')}</p>}
          </div>)}
        </details>)}
        <div className={styles.controls}><button className="btn-neutral" disabled={historyLoading || historyPage === 0} onClick={() => loadHistory(historyPage - 1)}>{text('Previous', 'Précédent')}</button><button className="btn-neutral" disabled={historyLoading || historyPage + 1 >= historyPages} onClick={() => loadHistory(historyPage + 1)}>{text('Next', 'Suivant')}</button></div>
      </section>}
    </> : <section className={styles.panel}><h2>{text('Manage expense categories', 'Gérer les catégories de dépenses')}</h2><p>{text('Renaming or archiving a category affects new budgets. Existing months keep their captured labels and figures.', 'Renommer ou archiver une catégorie affecte les nouveaux budgets. Les mois existants conservent leurs libellés et montants.')}</p><label><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} /> {text('Include archived categories', 'Inclure les catégories archivées')}</label>
      <form onSubmit={e => { e.preventDefault(); mutate(item.id == null ? 'createItem' : 'updateItem', { ...(item.id == null ? {} : { version: item.version }), nameEn: item.nameEn.trim(), nameFr: item.nameFr.trim() || null, active: item.active, displayOrder: Number(item.displayOrder) }, item.id); }} className={styles.controls}>
        <label>{text('English name', 'Nom anglais')}<input required maxLength={200} disabled={frozen} value={item.nameEn} onChange={e => setItem(value => ({ ...value, nameEn: e.target.value }))} /></label><label>{text('French name', 'Nom français')}<input maxLength={200} disabled={frozen} value={item.nameFr} onChange={e => setItem(value => ({ ...value, nameFr: e.target.value }))} /></label><label>{text('Order', 'Ordre')}<input type="number" min={0} max={1000000} disabled={frozen} value={item.displayOrder} onChange={e => setItem(value => ({ ...value, displayOrder: e.target.value }))} /></label><label><input type="checkbox" disabled={frozen} checked={item.active} onChange={e => setItem(value => ({ ...value, active: e.target.checked }))} /> {text('Active', 'Active')}</label><button className="btn-primary" disabled={frozen}>{item.id == null ? text('Add category', 'Ajouter la catégorie') : text('Save category', 'Enregistrer la catégorie')}</button>{item.id != null && <button className="btn-neutral" type="button" disabled={frozen} onClick={() => setItem(blankItem)}>{text('Cancel', 'Annuler')}</button>}
      </form>
      {catalogueLoading && <p role="status">{text('Loading categories…', 'Chargement des catégories…')}</p>}
      {!catalogueLoading && !catalogue.length && !error && <p>{text('No expense categories found.', 'Aucune catégorie de dépenses trouvée.')}</p>}
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{text('Category', 'Catégorie')}</th><th>EN</th><th>FR</th><th>{text('Status', 'État')}</th><th/></tr></thead><tbody>{catalogue.map(row => <tr key={row.id}><td>{label(row)}</td><td>{row.nameEn}</td><td>{row.nameFr}</td><td>{row.active ? text('Active', 'Active') : text('Archived', 'Archivée')}</td><td><button type="button" className="btn-neutral" disabled={frozen || catalogueLoading} onClick={() => setItem({ ...row, nameFr: row.nameFr || '' })}>{text('Edit', 'Modifier')}</button></td></tr>)}</tbody></table></div><button className="btn-neutral" disabled={catalogueLoading || cataloguePage === 0} onClick={() => loadCatalogue(cataloguePage - 1)}>{text('Previous', 'Précédent')}</button><button className="btn-neutral" disabled={catalogueLoading || cataloguePage + 1 >= cataloguePages} onClick={() => loadCatalogue(cataloguePage + 1)}>{text('Next', 'Suivant')}</button>
    </section>}
  </main>;
}
