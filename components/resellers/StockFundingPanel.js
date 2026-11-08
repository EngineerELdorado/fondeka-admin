'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { STOCK_FUNDING_SECTIONS, stockFundingSettings, stockFundingTranslation, stockFundingDraft, stockFundingChanged, stockFundingPayload, stockFundingReapply } from '@/lib/reseller-stock-funding';
import { Card, Alert, Field, actionStyle, useMounted, useResellerError } from './Common';
import styles from './resellers.module.css';

const names = { en: 'English', fr: 'French' };
const entry = (base) => ({ base, draft: stockFundingDraft(base), stale: false, latest: null });

export default function StockFundingPanel({ canWrite }) {
  const [language, setLanguage] = useState('en'), [entries, setEntries] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''), [denied, setDenied] = useState(false);
  const lock = useRef(false), mounted = useMounted(), fail = useResellerError();
  const refresh = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const next = stockFundingSettings(await api.resellers.stockFundingInfo());
      if (!mounted.current) return;
      setEntries((previous) => Object.fromEntries(['en', 'fr'].map((lang) => {
        const current = previous?.[lang];
        return [lang, current && (current.stale || stockFundingChanged(current.draft, current.base)) ? { ...current, stale: true, latest: next[lang] } : entry(next[lang])];
      })));
    } catch (err) {
      const message = await fail(err);
      if (mounted.current) {
        if (err.status === 403) setDenied(true);
        setEntries((previous) => previous && Object.fromEntries(Object.entries(previous).map(([lang, current]) => [lang, { ...current, stale: true, latest: null }])));
        setError(message);
      }
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }, [fail, mounted]);
  useEffect(() => { void refresh(); }, [refresh]);

  const current = entries?.[language], disabled = busy || !canWrite || denied;
  const changed = current && stockFundingChanged(current.draft, current.base);
  const update = (key, value) => {
    if (disabled || lock.current) return;
    setEntries((previous) => ({ ...previous, [language]: { ...previous[language], draft: { ...previous[language].draft, [key]: value } } }));
    setSuccess('');
  };
  const save = async () => {
    if (lock.current || disabled || !current || current.stale || !changed) return;
    let payload;
    try { payload = stockFundingPayload(current.draft, current.base); }
    catch (err) { setError(err.message); return; }
    const lang = language;
    lock.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const saved = stockFundingTranslation(await api.resellers.updateStockFundingInfo(lang, payload));
      if (saved.version == null || saved.version < current.base.version) throw new Error('The saved text could not be confirmed. Refresh before retrying.');
      if (mounted.current) { setEntries((previous) => ({ ...previous, [lang]: entry(saved) })); setSuccess(`${names[lang]} stock explanation saved.`); }
    } catch (err) {
      const message = await fail(err);
      if (mounted.current) {
        if (err.status === 403) setDenied(true);
        if (err.status === 409 || !err.status || err.status >= 500) setEntries((previous) => ({ ...previous, [lang]: { ...previous[lang], stale: true, latest: null } }));
        setError(message);
      }
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const review = (keepDraft) => {
    if (disabled || lock.current || !current?.latest || current.latest.version == null) return;
    const next = entry(current.latest);
    if (keepDraft) next.draft = stockFundingReapply(current.draft, current.base, current.latest);
    setEntries((previous) => ({ ...previous, [language]: next })); setError(''); setSuccess('');
  };

  return <Card>
    <div className={styles.heading}><div><h2 style={{ margin: 0 }}>Stock explanation</h2><p>Text shown in the customer’s enrollment info popup.</p></div><button type="button" className="btn-neutral btn-sm" disabled={busy} onClick={() => void refresh()}>Refresh saved text</button></div>
    {!canWrite || denied ? <small>Read only · Super Admin required to save.</small> : null}
    <Alert>{error}</Alert><Alert success>{success}</Alert>
    <div style={actionStyle} aria-label="Explanation language">{Object.entries(names).map(([lang, name]) => <button key={lang} type="button" className={language === lang ? 'btn-primary btn-sm' : 'btn-neutral btn-sm'} aria-pressed={language === lang} disabled={busy} onClick={() => { if (!lock.current) { setLanguage(lang); setSuccess(''); } }}>{name}{entries?.[lang] && stockFundingChanged(entries[lang].draft, entries[lang].base) ? ' · Unsaved' : ''}</button>)}</div>
    {busy ? <div role="status">Loading or saving text…</div> : null}
    {current ? <>
      {current.base.version == null ? <Alert>This translation has no saved version. Apply the stock explanation backend migration and refresh before saving.</Alert> : null}
      <div className={styles.copyLayout}>
        <fieldset disabled={disabled || current.base.version == null} className={styles.copyFields}>
          <legend className="sr-only">{names[language]} stock explanation</legend>
          <small>Blank fields use the customer app’s bundled {names[language]} text.</small>
          {STOCK_FUNDING_SECTIONS.map((section) => <div key={section.title} className={styles.copySection}>
            <h3>{section.title}</h3>
            {section.fields.map(([key, label, limit]) => <Field key={key} label={label} help={`${current.draft[key].length.toLocaleString('en')} / ${limit.toLocaleString('en')}`}><textarea rows={limit === 160 ? 2 : 3} maxLength={limit} value={current.draft[key]} onChange={(event) => update(key, event.target.value)} /></Field>)}
          </div>)}
        </fieldset>
        <aside className={styles.copyPreview} aria-label={`${names[language]} preview`} lang={language}>
          <strong>{names[language]} preview</strong><small>Configured text; blank fields use the app’s translation.</small>
          {STOCK_FUNDING_SECTIONS.map((section) => <div key={section.title} className={styles.copySection}>{section.fields.map(([key, label, limit]) => {
            const text = current.draft[key].trim();
            return text ? limit === 160 ? <h3 key={key}>{text}</h3> : <p key={key}>{text}</p> : <small key={key}>{label}: bundled {names[language]} text</small>;
          })}</div>)}
        </aside>
      </div>
      {current.stale ? <div role="status" className={styles.copySection}>
        <p>Your draft is kept. Refresh saved text and review it before saving again.</p>
        {current.latest ? <>
          <details open><summary>Latest saved {names[language]} · version {current.latest.version ?? 'unavailable'}</summary>
            <dl className={styles.copyComparison}>{STOCK_FUNDING_SECTIONS.flatMap((section) => section.fields).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{current.latest.content[key] || `Bundled ${names[language]} text`}</dd></div>)}</dl>
          </details>
          <div style={actionStyle}><button type="button" className="btn-neutral" disabled={disabled || current.latest.version == null} onClick={() => review(true)}>I reviewed version {current.latest.version} — keep my edits</button><button type="button" className="btn-neutral" disabled={disabled || current.latest.version == null} onClick={() => review(false)}>Use saved {names[language]} text</button></div>
        </> : null}
      </div> : null}
      <div className={styles.heading}><small>Only explanation text changes. Funding amounts and accepted payments stay as configured.</small>{canWrite && !denied ? <button type="button" className="btn-primary" disabled={disabled || current.stale || current.base.version == null || !changed} onClick={() => void save()}>Save {names[language]}</button> : null}</div>
    </> : null}
  </Card>;
}
