'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { api } from '@/lib/api';
import AssetReportExport from '@/components/AssetReportExport';
import { assetForm, assetRecoveryKey, assetRequest, checkedAssetResult, clearAssetRecovery, emptyAsset, readAssetIntent, validAssetDate } from '@/lib/asset-register';
import styles from './assets.module.css';

const blankCategory = { id: null, version: null, nameEn: '', nameFr: '', nature: 'TANGIBLE', active: true, displayOrder: 0 };
const invalidateRequests = (...versions) => versions.forEach(version => { version.current++; });
export default function AssetRegisterPage() {
  const { adminProfile } = useAuth(), { locale } = useLocale();
  const allowed = ['ADMIN', 'SUPER_ADMIN'].includes(adminProfile?.role), actor = allowed && adminProfile?.id != null ? String(adminProfile.id) : null;
  const identity = useRef(actor); identity.current = actor;
  const controller = useRef(null), pending = useRef(null), reads = useRef(null), sequence = useRef(0), categorySequence = useRef(0), historySequence = useRef(0), optionSequence = useRef(0);
  const [ready, setReady] = useState(null), [intent, setIntent] = useState(null), [busy, setBusy] = useState(false), [rejected, setRejected] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [tab, setTab] = useState('register');
  const [filter, setFilter] = useState(() => ({ asOf: new Date().toISOString().slice(0,10), currency: '', categoryId: '', nature: '', includeInactive: false, search: '' }));
  const [rows, setRows] = useState([]), [summary, setSummary] = useState([]), [page, setPage] = useState(0), [pages, setPages] = useState(0), [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]), [catalogue, setCatalogue] = useState([]), [cataloguePage, setCataloguePage] = useState(0), [cataloguePages, setCataloguePages] = useState(0), [archived, setArchived] = useState(false), [category, setCategory] = useState(blankCategory), [selectedCategory, setSelectedCategory] = useState(null);
  const [form, setForm] = useState(emptyAsset), [editingCategory, setEditingCategory] = useState(null), [history, setHistory] = useState(null), [historyPage, setHistoryPage] = useState(0), [historyPages, setHistoryPages] = useState(0);
  const [catalogueLoading, setCatalogueLoading] = useState(false), [historyLoading, setHistoryLoading] = useState(false);
  const fr = locale === 'fr', text = (en, french) => fr ? french : en, label = row => fr && row.nameFr ? row.nameFr : row.nameEn;
  const natureNames = { TANGIBLE: text('Physical assets', 'Biens matériels'), RECEIVABLE: text('Receivables', 'Créances à recouvrer'), OTHER: text('Other assets', 'Autres actifs') };
  const statusNames = { ACTIVE: text('Held', 'Détenu'), DISPOSED: text('Disposed', 'Cédé'), RECOVERED: text('Recovered', 'Recouvré'), WRITTEN_OFF: text('Written off', 'Sorti du registre') };
  const frozen = !actor || ready !== actor || busy || Boolean(intent), currentIntent = intent?.actor === actor ? intent : null;
  const options = useMemo(() => { const values = new Map(categories.map(c => [c.id,c])); for (const c of [selectedCategory, editingCategory]) if (c && !values.has(c.id)) values.set(c.id,c); return [...values.values()]; }, [categories, selectedCategory, editingCategory]);
  const selected = options.find(c => String(c.id) === String(form.categoryId));
  const money = value => value == null ? text('Not valued', 'Non valorisé') : value;

  useEffect(() => {
    controller.current?.abort(); reads.current?.abort(); pending.current = null; sequence.current++; categorySequence.current++; historySequence.current++; optionSequence.current++;
    setReady(null); setIntent(null); setRows([]); setSummary([]); setCategories([]); setCatalogue([]); setForm(emptyAsset()); setEditingCategory(null); setSelectedCategory(null); setCategory(blankCategory); setHistory(null); setBusy(false); setError(''); setMessage(''); setRejected(false);
    try {
      clearAssetRecovery(sessionStorage, actor); if (!actor) return;
      const value = readAssetIntent(sessionStorage.getItem(assetRecoveryKey(actor)), actor);
      if (value) { pending.current = value; setIntent(value); if (value.operation.endsWith('Asset')) { setForm({ ...emptyAsset(), ...value.request, id: value.id || null, estimatedValue: value.request.estimatedValue ?? '', outstandingAmount: value.request.outstandingAmount ?? '', nameFr: value.request.nameFr || '', location: value.request.location || '', custodian: value.request.custodian || '', identification: value.request.identification || '', note: value.request.note || '', acquisitionDate: value.request.acquisitionDate || '' }); setTab('register'); } else { setCategory({ ...blankCategory,...value.request,id:value.id || null,nameFr:value.request.nameFr || '' }); setTab('categories'); } }
      else sessionStorage.removeItem(assetRecoveryKey(actor)); setReady(actor);
    } catch { setError(text('Enable browser session storage to recover interrupted changes.', 'Activez le stockage de session pour reprendre les modifications interrompues.')); }
    return () => { controller.current?.abort(); reads.current?.abort(); invalidateRequests(sequence, categorySequence, historySequence, optionSequence); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor]);

  async function loadCategories() {
    if (!actor || identity.current !== actor) return;
    const owner = actor, revision = ++optionSequence.current;
    try {
      const values = await api.assets.categoryOptions();
      if (identity.current === owner && revision === optionSequence.current) setCategories(values);
    } catch (failure) { if (identity.current === owner && revision === optionSequence.current) setError(failure.message); }
  }
  async function load(nextPage = 0) {
    if (!actor || ready !== actor || identity.current !== actor) return;
    const owner = actor, revision = ++sequence.current;
    reads.current?.abort(); const abort = new AbortController(); reads.current = abort;
    historySequence.current++; setHistoryLoading(false); setHistory(null);
    setLoading(true); setRows([]); setSummary([]); setError('');
    if (!validAssetDate(filter.asOf) || filter.currency && !/^[A-Z]{3}$/.test(filter.currency)) {
      setLoading(false); setError(text('Choose a date from 1900 through today and a three-letter currency, or leave currency blank.', 'Choisissez une date de 1900 à aujourd’hui et une devise à trois lettres, ou laissez la devise vide.')); return;
    }
    const query = Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== ''));
    try {
      const [result, totals] = await Promise.all([api.assets.list({ ...query, page: nextPage, size: 30 }, { signal: abort.signal }), api.assets.summary(query, { signal: abort.signal })]);
      if (identity.current !== owner || revision !== sequence.current || abort.signal.aborted) return;
      if (nextPage > 0 && !result.content.length && nextPage >= result.page.totalPages) { load(Math.max(0, result.page.totalPages - 1)); return; }
      setRows(result.content); setSummary(totals); setPage(nextPage); setPages(result.page.totalPages);
    } catch (failure) { if (identity.current === owner && revision === sequence.current && !abort.signal.aborted) setError(failure.message); }
    finally { if (identity.current === owner && revision === sequence.current && !abort.signal.aborted) setLoading(false); }
  }
  useEffect(()=>{if(actor&&ready===actor)loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[actor,ready]);
  useEffect(()=>{
    sequence.current++; historySequence.current++; reads.current?.abort(); setHistory(null); setHistoryLoading(false); setRows([]); setSummary([]);
    if(!actor||ready!==actor)return;
    setLoading(true); const timer=setTimeout(()=>load(0),300);return()=>{clearTimeout(timer);reads.current?.abort();};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[actor,ready,filter]);
  async function loadCatalogue(nextPage = 0) {
    if (!actor || ready !== actor || identity.current !== actor) return;
    const owner = actor, revision = ++categorySequence.current;
    setCatalogueLoading(true); setError('');
    try {
      const result = await api.assets.categories({ page: nextPage, size: 50, includeArchived: archived });
      if (identity.current !== owner || revision !== categorySequence.current) return;
      if (nextPage > 0 && !result.content.length && nextPage >= result.page.totalPages) { loadCatalogue(Math.max(0, result.page.totalPages - 1)); return; }
      setCatalogue(result.content); setCataloguePage(nextPage); setCataloguePages(result.page.totalPages);
    } catch (failure) { if (identity.current === owner && revision === categorySequence.current) setError(failure.message); }
    finally { if (identity.current === owner && revision === categorySequence.current) setCatalogueLoading(false); }
  }
  useEffect(()=>{if(actor&&ready===actor&&tab==='categories')loadCatalogue(0); return () => invalidateRequests(categorySequence);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[actor,ready,tab,archived]);
  async function mutate(operation,request,id) {
    if(!actor||ready!==actor||identity.current!==actor||controller.current)return;
    const owner=actor,abort=new AbortController();controller.current=abort;setBusy(true);setError('');setMessage('');setRejected(false);
    try {let next=pending.current;if(!next){next={actor:owner,key:crypto.randomUUID(),operation,request,...(id==null?{}:{id})};const clean=readAssetIntent(JSON.stringify(next),owner);if(!clean)throw new Error('Invalid asset request.');sessionStorage.setItem(assetRecoveryKey(owner),JSON.stringify(clean));pending.current=clean;setIntent(clean);next=clean;}
      const operations={createAsset:()=>api.assets.create(next.request,next.key,{signal:abort.signal}),reviseAsset:()=>api.assets.revise(next.id,next.request,next.key,{signal:abort.signal}),createCategory:()=>api.assets.createCategory(next.request,next.key,{signal:abort.signal}),updateCategory:()=>api.assets.updateCategory(next.id,next.request,next.key,{signal:abort.signal})};
      const result=checkedAssetResult(await operations[next.operation](),next);if(identity.current!==owner||abort.signal.aborted)return;
      sessionStorage.removeItem(assetRecoveryKey(owner));pending.current=null;setIntent(null);
      if(next.operation.endsWith('Asset')){setForm(emptyAsset(filter.asOf));setEditingCategory(null);setMessage(text('Dated revision saved. The register shows the latest value applicable to the selected date.', 'Révision datée enregistrée. Le registre affiche la dernière valeur applicable à la date choisie.'));load(0);}
      else {setCategory(blankCategory);setMessage(text('Category saved. Existing dated records keep their captured labels.', 'Catégorie enregistrée. Les fiches datées existantes conservent leurs libellés.'));loadCategories();loadCatalogue(cataloguePage);}
    } catch(failure){if(identity.current===owner&&!abort.signal.aborted){setError(failure.message||text('Outcome unconfirmed. Retry the saved change.', 'Résultat non confirmé. Réessayez la modification enregistrée.'));setRejected([400,403,404,409,422].includes(failure.status));}}
    finally {if(controller.current===abort){controller.current=null;if(identity.current===owner&&!abort.signal.aborted)setBusy(false);}}
  }
  function submitAsset(e){e.preventDefault();try{const request=assetRequest(form,selected?.nature);mutate(form.id?'reviseAsset':'createAsset',request,form.id);}catch(failure){setError(failure.message);}}
  function dismiss() {
    try {
      sessionStorage.removeItem(assetRecoveryKey(actor)); pending.current = null; setIntent(null); setRejected(false); setError('');
      setForm(emptyAsset(filter.asOf)); setEditingCategory(null); setCategory(blankCategory);
      load(page); loadCategories(); if (tab === 'categories') loadCatalogue(0);
    } catch { setError('Could not clear the rejected request.'); }
  }
  function edit(asset){setForm(assetForm(asset,filter.asOf));setEditingCategory({id:asset.categoryId,nameEn:asset.categoryNameEn,nameFr:asset.categoryNameFr,nature:asset.nature,active:false});setTab('register');}
  async function loadHistory(asset, nextPage = 0) {
    if (!actor || identity.current !== actor) return;
    const owner = actor, revision = sequence.current, historyRead = ++historySequence.current;
    setHistoryLoading(true); setError(''); setHistory(current => current?.asset.id === asset.id ? current : null);
    try {
      const result = await api.assets.history(asset.id, { page: nextPage, size: 10 });
      if (identity.current !== owner || revision !== sequence.current || historyRead !== historySequence.current) return;
      setHistory({ asset, rows: result.content }); setHistoryPage(nextPage); setHistoryPages(result.page.totalPages);
    } catch (failure) { if (identity.current === owner && revision === sequence.current && historyRead === historySequence.current) setError(failure.message); }
    finally { if (identity.current === owner && revision === sequence.current && historyRead === historySequence.current) setHistoryLoading(false); }
  }
  const change=(key,value)=>setForm(current=>({...current,[key]:value}));
  const filterField=(key,value)=>setFilter(current=>({...current,[key]:value}));
  if(!allowed)return <p role="alert">{text('Admin access is required.', 'Un accès administrateur est nécessaire.')}</p>;
  return <main className={styles.page}>
    <header className={styles.header}><div><h1>{text('Fondeka asset register', 'Registre des actifs Fondeka')}</h1><p>{text('Record what Fondeka owns and its estimated value, including legacy receivables.', 'Enregistrez les biens de Fondeka et leur valeur estimée, y compris les anciennes créances.')}</p></div><AssetReportExport categories={options} selectedAsOf={filter.asOf} selectedCategoryId={filter.categoryId} selectedCurrency={filter.currency} selectedNature={filter.nature} selectedIncludeInactive={filter.includeInactive} /></header>
    <div className={styles.tabs}><button type="button" className="btn-neutral" aria-pressed={tab==='register'} onClick={()=>setTab('register')}>{text('Register', 'Registre')}</button><button type="button" className="btn-neutral" aria-pressed={tab==='categories'} onClick={()=>setTab('categories')}>{text('Categories', 'Catégories')}</button></div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{message&&<p role="status">{message}</p>}
    {currentIntent&&<section className={styles.notice}><strong>{text('Saved change awaiting confirmation', 'Modification enregistrée en attente de confirmation')}</strong><p>{text('Retry the exact saved request. Other writes remain locked until its outcome is confirmed.', 'Réessayez la même demande enregistrée. Les autres écritures restent verrouillées jusqu’à confirmation du résultat.')}</p><button className="btn-primary" disabled={busy} onClick={()=>mutate()}>{text('Retry saved change', 'Réessayer la modification')}</button>{rejected&&<button className="btn-neutral" disabled={busy} onClick={dismiss}>{text('Dismiss rejected request', 'Fermer la demande rejetée')}</button>}</section>}
    {tab==='register'?<>
      <section className={styles.panel}><h2>{text('View the register', 'Consulter le registre')}</h2><div className={styles.controls}>
        <label>{text('As of date', 'Situation au')}<input type="date" min="1900-01-01" max={new Date().toISOString().slice(0,10)} value={filter.asOf} disabled={frozen} onChange={e=>filterField('asOf',e.target.value)} /></label>
        <label>{text('Currency (blank for all)', 'Devise (vide pour toutes)')}<input maxLength={3} value={filter.currency} disabled={frozen} onChange={e=>filterField('currency',e.target.value.toUpperCase())} /></label>
        <label>{text('Category', 'Catégorie')}<select value={filter.categoryId} disabled={frozen} onChange={e=>filterField('categoryId',e.target.value)}><option value="">{text('All', 'Toutes')}</option>{options.map(c=><option key={c.id} value={c.id}>{label(c)}</option>)}</select></label>
        <label>{text('Nature', 'Nature')}<select value={filter.nature} disabled={frozen} onChange={e=>filterField('nature',e.target.value)}><option value="">{text('All', 'Toutes')}</option>{Object.entries(natureNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
        <label>{text('Search', 'Rechercher')}<input maxLength={200} value={filter.search} disabled={frozen} onChange={e=>filterField('search',e.target.value)} /></label><label><input type="checkbox" checked={filter.includeInactive} disabled={frozen} onChange={e=>filterField('includeInactive',e.target.checked)} />{text('Include closed entries', 'Inclure les fiches clôturées')}</label><button type="button" className="btn-neutral" disabled={frozen||loading} onClick={()=>load(page)}>{text('Refresh', 'Actualiser')}</button>
      </div><div className={styles.cards}>{summary.map(total=><div key={total.currency}><span>{text('Estimated held value', 'Valeur détenue estimée')} · {total.currency}</span><strong>{money(total.estimatedValue)}</strong><small>{total.valuedCount}/{total.activeCount} {text('held entries valued', 'fiches détenues valorisées')}{!total.complete&&text(' · Partial', ' · Partiel')}{total.excludedCount>0&&` · ${total.excludedCount} ${text('excluded', 'exclues')}`}</small></div>)}</div>
      {loading&&<p role="status">{text('Loading register…', 'Chargement du registre…')}</p>}<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{text('Asset / reference', 'Actif / référence')}</th><th>{text('Category', 'Catégorie')}</th><th>{text('Qty', 'Qté')}</th><th>{text('Estimated total', 'Valeur totale estimée')}</th><th>{text('Effective date', 'Date de valeur')}</th><th>{text('Status', 'État')}</th><th>{text('Actions', 'Actions')}</th></tr></thead><tbody>{rows.map(asset=><tr key={asset.id}><td>{label(asset)}<small>{asset.reference}</small></td><td>{fr&&asset.categoryNameFr?asset.categoryNameFr:asset.categoryNameEn}<small>{natureNames[asset.nature]}</small></td><td>{asset.quantity}</td><td>{money(asset.estimatedValue)} {asset.currency}{asset.nature==='RECEIVABLE'&&asset.outstandingAmount!=null&&<small>{text('Still owed: ', 'Restant dû : ')}{asset.outstandingAmount} {asset.currency}</small>}{!asset.includedInTotal&&<small>{text('Excluded from total', 'Exclu du total')}</small>}</td><td>{asset.effectiveDate}</td><td>{statusNames[asset.status]}</td><td><button type="button" className="btn-neutral btn-sm" disabled={frozen||loading} onClick={()=>edit(asset)}>{text('Record revision', 'Enregistrer une révision')}</button><button type="button" className="btn-neutral btn-sm" disabled={busy||historyLoading||loading} onClick={()=>loadHistory(asset)}>{text('History', 'Historique')}</button></td></tr>)}</tbody></table></div>{!loading&&!error&&!rows.length&&<p>{text('No matching entries on this date.', 'Aucune fiche correspondante à cette date.')}</p>}<div className={styles.controls}><button type="button" className="btn-neutral" disabled={loading||page===0} onClick={()=>load(page-1)}>{text('Previous', 'Précédent')}</button><span>{page+1} / {Math.max(1,pages)}</span><button type="button" className="btn-neutral" disabled={loading||page+1>=pages} onClick={()=>load(page+1)}>{text('Next', 'Suivant')}</button></div></section>
      <form className={styles.panel} onSubmit={submitAsset}><h2>{form.id?text('Record a dated revision', 'Enregistrer une révision datée'):text('Register an asset', 'Enregistrer un actif')}</h2><p>{text('Estimated value is the total for this entire entry, not a unit price. Leave unknown values blank. Earlier dated corrections do not replace later valuations.', 'La valeur estimée est le total de cette fiche, pas un prix unitaire. Laissez les valeurs inconnues vides. Une correction datée antérieure ne remplace pas une valorisation plus récente.')}</p>
        <div className={styles.grid}>
          <label>{text('English name', 'Nom anglais')}<input required maxLength={200} disabled={frozen} value={form.nameEn} onChange={e=>change('nameEn',e.target.value)} /></label><label>{text('French name', 'Nom français')}<input maxLength={200} disabled={frozen} value={form.nameFr} onChange={e=>change('nameFr',e.target.value)} /></label>
          <label>{text('Reference (blank for automatic)', 'Référence (vide pour génération automatique)')}<input maxLength={100} disabled={frozen||!!form.id} value={form.reference} onChange={e=>change('reference',e.target.value)} /></label><label>{text('Currency', 'Devise')}<input required maxLength={3} disabled={frozen||!!form.id} value={form.currency} onChange={e=>change('currency',e.target.value.toUpperCase())} /></label>
          <label>{text('Category', 'Catégorie')}<select required disabled={frozen} value={form.categoryId} onChange={e=>{const c=options.find(c=>String(c.id)===e.target.value);setForm(v=>({...v,categoryId:e.target.value,quantity:c?.nature==='RECEIVABLE'?'1':v.quantity,outstandingAmount:c?.nature==='RECEIVABLE'?v.outstandingAmount:'',status:c?.nature!=='RECEIVABLE'&&v.status==='RECOVERED'?'ACTIVE':v.status}));}}><option value="">{text('Choose…', 'Choisir…')}</option>{options.filter(c=>c.active||String(c.id)===String(form.categoryId)).map(c=><option key={c.id} value={c.id}>{label(c)} · {natureNames[c.nature]}</option>)}</select></label>
          <label>{text('Quantity', 'Quantité')}<input required type="number" min={1} max={1000000} step={1} disabled={frozen||selected?.nature==='RECEIVABLE'} value={form.quantity} onChange={e=>change('quantity',e.target.value)} /></label>
          <label>{text('Total estimated value', 'Valeur totale estimée')}<input inputMode="decimal" disabled={frozen} value={form.estimatedValue} onChange={e=>change('estimatedValue',e.target.value)} /></label>{selected?.nature==='RECEIVABLE'&&<label>{text('Amount still owed (optional)', 'Montant restant dû (facultatif)')}<input inputMode="decimal" disabled={frozen} value={form.outstandingAmount} onChange={e=>change('outstandingAmount',e.target.value)} /></label>}
          <label>{text('Value effective from', 'Valeur applicable à partir du')}<input required type="date" min="1900-01-01" max={new Date().toISOString().slice(0,10)} disabled={frozen} value={form.effectiveDate} onChange={e=>change('effectiveDate',e.target.value)} /></label><label>{text('Status', 'État')}<select disabled={frozen} value={form.status} onChange={e=>change('status',e.target.value)}>{Object.entries(statusNames).filter(([value])=>value!=='RECOVERED'||selected?.nature==='RECEIVABLE').map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
          <label>{text('Acquisition date (optional)', 'Date d’acquisition (facultative)')}<input type="date" max={form.effectiveDate} disabled={frozen} value={form.acquisitionDate} onChange={e=>change('acquisitionDate',e.target.value)} /></label>
          {['location','custodian','identification'].map((key,index)=><label key={key}>{[text('Location', 'Emplacement'),text('Custodian / responsible person', 'Responsable'),text('Serial number / external reference', 'Numéro de série / référence externe')][index]}<input maxLength={key==='location'?300:200} disabled={frozen} value={form[key]} onChange={e=>change(key,e.target.value)} /></label>)}
        </div><label>{text('Reason / valuation basis', 'Motif / base de valorisation')}<textarea required maxLength={1000} disabled={frozen} value={form.reason} onChange={e=>change('reason',e.target.value)} /></label><label>{text('Notes', 'Notes')}<textarea maxLength={4000} disabled={frozen} value={form.note} onChange={e=>change('note',e.target.value)} /></label>
        <p>{text('This records an estimate only. No provider payment, wallet movement or platform loan is created.', 'Ceci enregistre uniquement une estimation. Aucun paiement prestataire, mouvement de portefeuille ou crédit de la plateforme n’est créé.')}</p><div className={styles.controls}><button className="btn-primary" disabled={frozen}>{form.id?text('Save revision', 'Enregistrer la révision'):text('Register asset', 'Enregistrer l’actif')}</button>{form.id&&<button type="button" className="btn-neutral" disabled={frozen} onClick={()=>{setForm(emptyAsset(filter.asOf));setEditingCategory(null);}}>{text('Cancel editing / new asset', 'Annuler / nouvel actif')}</button>}</div>
      </form>
      {historyLoading&&<p role="status">{text('Loading revision history…', 'Chargement de l’historique des révisions…')}</p>}
      {history&&<section className={styles.panel}><h2>{text('Revision history', 'Historique des révisions')} · {history.asset.reference}</h2>{!historyLoading&&!history.rows.length&&!error&&<p>{text('No revisions found.', 'Aucune révision trouvée.')}</p>}{history.rows.map(r=><details key={r.revisionId}><summary>v{r.revisionVersion} · {r.effectiveDate} · {money(r.estimatedValue)} {r.currency} · {statusNames[r.status]}</summary><p>{label(r)} · {r.quantity} · {fr&&r.categoryNameFr?r.categoryNameFr:r.categoryNameEn}</p>{r.outstandingAmount!=null&&<p>{text('Still owed:', 'Restant dû :')} {r.outstandingAmount} {r.currency}</p>}<p>{text('Acquired:', 'Acquisition :')} {r.acquisitionDate || '—'}</p><p>{text('Location:', 'Emplacement :')} {r.location || '—'}</p><p>{text('Responsible person:', 'Responsable :')} {r.custodian || '—'}</p><p>{text('Identification:', 'Identification :')} {r.identification || '—'}</p><p style={{ whiteSpace: 'pre-wrap' }}>{r.reason}</p><p style={{ whiteSpace: 'pre-wrap' }}>{r.note}</p><small>{text('Recorded by admin', 'Saisi par l’admin')} {r.recordedByAdminId} · {new Date(r.recordedAt).toLocaleString(locale)}</small></details>)}<div className={styles.controls}><button className="btn-neutral" disabled={historyLoading||historyPage===0} onClick={()=>loadHistory(history.asset,historyPage-1)}>{text('Previous', 'Précédent')}</button><button className="btn-neutral" disabled={historyLoading||historyPage+1>=historyPages} onClick={()=>loadHistory(history.asset,historyPage+1)}>{text('Next', 'Suivant')}</button><button className="btn-neutral" onClick={()=>{historySequence.current++;setHistoryLoading(false);setHistory(null);}}>{text('Close history', 'Fermer l’historique')}</button></div></section>}
    </>:<section className={styles.panel}><h2>{text('Manage asset categories', 'Gérer les catégories d’actifs')}</h2><p>{text('Categories are editable; nature is fixed once created. Archiving a category does not remove its assets or change saved valuations.', 'Les catégories sont modifiables ; leur nature reste fixe après création. Archiver une catégorie ne retire pas ses actifs et ne change pas les valeurs enregistrées.')}</p>
      <form className={styles.controls} onSubmit={e=>{e.preventDefault();mutate(category.id?'updateCategory':'createCategory',{...(category.id?{version:category.version}:{}),nameEn:category.nameEn.trim(),nameFr:category.nameFr.trim()||null,nature:category.nature,active:category.active,displayOrder:Number(category.displayOrder)},category.id);}}>
        <label>{text('English name', 'Nom anglais')}<input required maxLength={200} disabled={frozen} value={category.nameEn} onChange={e=>setCategory(v=>({...v,nameEn:e.target.value}))} /></label><label>{text('French name', 'Nom français')}<input maxLength={200} disabled={frozen} value={category.nameFr} onChange={e=>setCategory(v=>({...v,nameFr:e.target.value}))} /></label><label>{text('Nature', 'Nature')}<select disabled={frozen||!!category.id} value={category.nature} onChange={e=>setCategory(v=>({...v,nature:e.target.value}))}>{Object.entries(natureNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label><label>{text('Order', 'Ordre')}<input type="number" min={0} max={1000000} step={1} disabled={frozen} value={category.displayOrder} onChange={e=>setCategory(v=>({...v,displayOrder:e.target.value}))} /></label><label><input type="checkbox" disabled={frozen} checked={category.active} onChange={e=>setCategory(v=>({...v,active:e.target.checked}))} />{text('Active', 'Active')}</label><button className="btn-primary" disabled={frozen}>{category.id?text('Save category', 'Enregistrer la catégorie'):text('Add category', 'Ajouter la catégorie')}</button>{category.id&&<button className="btn-neutral" type="button" disabled={frozen} onClick={()=>setCategory(blankCategory)}>{text('Cancel', 'Annuler')}</button>}
      </form>{catalogueLoading&&<p role="status">{text('Loading categories…', 'Chargement des catégories…')}</p>}{!catalogueLoading&&!catalogue.length&&!error&&<p>{text('No categories found.', 'Aucune catégorie trouvée.')}</p>}<label><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)} />{text('Include archived categories', 'Inclure les catégories archivées')}</label><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{text('Category', 'Catégorie')}</th><th>{text('Nature', 'Nature')}</th><th>{text('Status', 'État')}</th><th>{text('Actions', 'Actions')}</th></tr></thead><tbody>{catalogue.map(c=><tr key={c.id}><td>{label(c)}</td><td>{natureNames[c.nature]}</td><td>{c.active?text('Active', 'Active'):text('Archived', 'Archivée')}</td><td><button className="btn-neutral" type="button" disabled={frozen||catalogueLoading} onClick={()=>setCategory({...c,nameFr:c.nameFr||''})}>{text('Edit', 'Modifier')}</button><button className="btn-neutral" type="button" disabled={frozen} onClick={()=>{setSelectedCategory(c);setFilter(v=>({...v,categoryId:String(c.id)}));setTab('register');}}>{text('View entries', 'Voir les fiches')}</button></td></tr>)}</tbody></table></div><div className={styles.controls}><button className="btn-neutral" disabled={catalogueLoading||cataloguePage===0} onClick={()=>loadCatalogue(cataloguePage-1)}>{text('Previous', 'Précédent')}</button><button className="btn-neutral" disabled={catalogueLoading||cataloguePage+1>=cataloguePages} onClick={()=>loadCatalogue(cataloguePage+1)}>{text('Next', 'Suivant')}</button></div>
    </section>}
  </main>;
}
