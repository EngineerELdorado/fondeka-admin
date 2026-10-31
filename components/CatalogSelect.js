'use client';

import { Children, Fragment, forwardRef, isValidElement, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { isRegulatorRestrictedRecord, isRegulatorRestrictedService } from '@/lib/regulator-presentation';
import { catalogOptionDetails, filterCatalogOptions, groupCatalogOptions } from '@/lib/catalog-options';

const copy = {
  en: { method: 'Payment method', product: 'Bill product', paymentRoute: 'Payment method route', billRoute: 'Bill product route', search: 'Search name, code, ID, currency or country…', country: 'Country', all: 'All countries', global: 'Global / all countries', selected: 'selected', selectedOnly: 'Selected only', clear: 'Clear selection', clearVisible: 'Clear visible selections', done: 'Done', close: 'Close picker', noMatch: 'No matches', tryAgain: 'Try another search or country.', reset: 'Reset filters', empty: 'No options available', loading: 'Loading options…', hidden: 'Selection hidden in this presentation', protected: 'Hidden selections are preserved.', unknown: 'Unavailable selection', inactive: 'Inactive', unavailable: 'Unavailable', remove: 'Remove', of: 'of', results: 'options' },
  fr: { method: 'Moyen de paiement', product: 'Produit de facturation', paymentRoute: 'Route de paiement', billRoute: 'Route de facturation', search: 'Rechercher un nom, code, ID, devise ou pays…', country: 'Pays', all: 'Tous les pays', global: 'Global / tous les pays', selected: 'sélectionné(s)', selectedOnly: 'Sélection uniquement', clear: 'Effacer la sélection', clearVisible: 'Effacer la sélection visible', done: 'Terminé', close: 'Fermer la sélection', noMatch: 'Aucun résultat', tryAgain: 'Essayez une autre recherche ou un autre pays.', reset: 'Réinitialiser les filtres', empty: 'Aucune option disponible', loading: 'Chargement…', hidden: 'Sélection masquée dans cette présentation', protected: 'Les sélections masquées sont conservées.', unknown: 'Sélection indisponible', inactive: 'Inactif', unavailable: 'Indisponible', remove: 'Retirer', of: 'sur', results: 'options' }
};
const textContent = (children) => Children.toArray(children).map((child) => typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement(child) ? textContent(child.props.children) : '').join('').replace(/\s+/g, ' ').trim();
const readOptions = (children, inheritedDisabled = false) => Children.toArray(children).flatMap((child) => {
  if (!isValidElement(child)) return [];
  if (child.type === Fragment || child.type === 'optgroup') return readOptions(child.props.children, inheritedDisabled || child.props.disabled);
  if (child.type !== 'option') return [];
  return [{ value: String(child.props.value ?? textContent(child.props.children)), label: textContent(child.props.children), disabled: Boolean(inheritedDisabled || child.props.disabled), restricted: child.props['data-regulator-restricted'] === true }];
});
const EMPTY = [];

export const CatalogSelect = forwardRef(function CatalogSelect({ children, records = EMPTY, countries = EMPTY, kind = 'payment-method', value, onChange, id, name, multiple = false, disabled = false, loading = false, required = false, className = '', style, onBlur, 'aria-label': ariaLabel, 'aria-describedby': describedBy, ...rest }, ref) {
  const { enableRegulatorMode } = useAuth();
  const { locale: language } = useLocale();
  const locale = language === 'fr' ? 'fr' : 'en';
  const t = copy[locale];
  const label = ariaLabel || (kind === 'bill-product' ? multiple ? locale === 'fr' ? 'Produits de facturation' : 'Bill products' : t.product : kind === 'payment-route' ? t.paymentRoute : kind === 'bill-route' ? t.billRoute : multiple ? locale === 'fr' ? 'Moyens de paiement' : 'Payment methods' : t.method);
  const generatedId = useId();
  const pickerId = id || `catalog-${generatedId}`;
  const listId = `${pickerId}-options`;
  const trigger = useRef(null), panel = useRef(null), search = useRef(null), native = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [activeValue, setActiveValue] = useState(null);
  const [position, setPosition] = useState(null);
  useImperativeHandle(ref, () => trigger.current);

  const options = useMemo(() => {
    const byId = new Map(records.map((record) => [String(record.id ?? record.value), record]));
    return [...new Map(readOptions(children).map((option) => {
      const record = byId.get(option.value) || {};
      const details = catalogOptionDetails(record, kind, locale, countries);
      const restricted = option.restricted || isRegulatorRestrictedRecord(record) || isRegulatorRestrictedRecord(record.__catalogEntity)
        || isRegulatorRestrictedService(option.label);
      return [option.value, { ...option, ...details, restricted }];
    })).values()];
  }, [children, records, kind, locale, countries]);
  const empty = options.find((option) => option.value === '');
  const entries = useMemo(() => options.filter((option) => option.value !== '' && (enableRegulatorMode === false || !option.restricted)), [options, enableRegulatorMode]);
  const selected = useMemo(() => (multiple ? Array.isArray(value) ? value : [] : value == null || value === '' ? [] : [value]).map(String), [multiple, value]);
  const protectedValues = selected.filter((item) => enableRegulatorMode !== false && options.some((option) => option.value === item && option.restricted));
  const selectedEntries = selected.filter((item) => !protectedValues.includes(item)).map((item) => entries.find((option) => option.value === item) || { value: item, label: `${t.unknown} · #${item}`, name: `${t.unknown} · #${item}` });
  const countryOptions = useMemo(() => [...new Map(entries.flatMap((option) => option.countries).map((item) => [item.key, item])).values()].sort((a, b) => a.label.localeCompare(b.label, locale)), [entries, locale]);
  const filtered = useMemo(() => filterCatalogOptions(selectedOnly ? entries.filter((option) => selected.includes(option.value)) : entries, query, country), [entries, query, country, selectedOnly, selected]);
  const groups = useMemo(() => groupCatalogOptions(filtered, country, locale), [filtered, country, locale]);
  const results = useMemo(() => groups.flatMap((group) => group.options), [groups]);
  const enabledResults = results.filter((option) => !option.disabled);
  const active = enabledResults.find((option) => option.value === activeValue) || enabledResults.find((option) => selected.includes(option.value)) || enabledResults[0];
  const title = selectedEntries.length > 1 ? `${selectedEntries.length} ${t.selected}` : selectedEntries[0]?.name || selectedEntries[0]?.label || (protectedValues.length ? t.hidden : empty?.label || label);

  const close = (focus = true) => { setOpen(false); if (focus) trigger.current?.focus(); };
  const change = (next) => {
    if (disabled || loading) return;
    const values = multiple ? [...new Set([...next, ...protectedValues])] : next;
    for (const option of native.current.options) option.selected = values.includes(option.value);
    native.current.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const choose = (option) => {
    if (option.disabled) return;
    change(multiple ? selected.includes(option.value) ? selected.filter((item) => item !== option.value) : [...selected, option.value] : [option.value]);
    if (!multiple) close(); else search.current?.focus();
  };
  const resetFilters = () => { setQuery(''); setCountry(''); setSelectedOnly(false); search.current?.focus(); };
  const show = () => { if (!disabled && !loading) { setQuery(''); setCountry(''); setSelectedOnly(false); setActiveValue(selected[0] || null); setPosition(null); setOpen(true); } };

  useEffect(() => { if (disabled || loading) setOpen(false); }, [disabled, loading]);
  useEffect(() => { setOpen(false); }, [enableRegulatorMode]);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const rect = trigger.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
      if (width <= 600) {
        setPosition({ left: 12, right: 12, bottom: Math.max(12, window.innerHeight - height - (viewport?.offsetTop || 0) + 12), maxHeight: Math.max(180, height - 24) });
      } else {
        const below = window.innerHeight - rect.bottom - 16, above = rect.top - 16;
        const upwards = below < 320 && above > below;
        const panelWidth = Math.min(Math.max(rect.width, 390), window.innerWidth - 32);
        setPosition({ width: panelWidth, left: Math.min(Math.max(16, rect.left), window.innerWidth - panelWidth - 16), ...(upwards ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }), maxHeight: Math.max(180, Math.min(510, upwards ? above : below)) });
      }
    };
    update(); search.current?.focus();
    const outside = (event) => { if (!panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) close(false); };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    document.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); window.visualViewport?.removeEventListener('resize', update); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  useEffect(() => {
    if (open && active) panel.current?.querySelector(`[data-option-index="${results.indexOf(active)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, results]);

  const onSearchKeyDown = (event) => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'Enter') { if (active) choose(active); return; }
      const index = enabledResults.findIndex((option) => option.value === active?.value);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabledResults.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + enabledResults.length) % enabledResults.length;
      setActiveValue(enabledResults[next]?.value || null);
    }
  };
  return <div className={`catalog-select ${className}`} style={multiple ? { ...style, minHeight: undefined, height: undefined } : style}>
    <select ref={native} hidden aria-hidden="true" tabIndex={-1} name={name} value={multiple ? selected : selected[0] ?? ''} multiple={multiple} disabled={disabled || loading} onChange={onChange}>
      {!multiple && !empty ? <option value="" /> : null}
      {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
      {selected.filter((item) => !options.some((option) => option.value === item)).map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
    <button {...rest} id={pickerId} ref={trigger} type="button" role="combobox" className="catalog-select__trigger" title={selectedEntries.map((option) => [option.name || option.label, option.countries?.map((item) => item.label).join(', '), ...(option.details || [])].filter(Boolean).join(' · ')).join('\n') || title} aria-label={label} aria-describedby={[describedBy, `${pickerId}-value`].filter(Boolean).join(' ')} aria-haspopup="dialog" aria-controls={open ? `${pickerId}-dialog` : undefined} aria-expanded={open} aria-required={required || undefined} disabled={disabled || loading}
      onClick={() => open ? close() : show()} onBlur={onBlur} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(); } }}>
      <span className="catalog-select__value" id={`${pickerId}-value`}><span>{loading ? t.loading : title}</span>{selectedEntries.length === 1 && selectedEntries[0].details?.length ? <small>{[selectedEntries[0].countries?.map((item) => item.label).join(', '), ...selectedEntries[0].details].filter(Boolean).join(' · ')}</small> : null}</span>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" /></svg>
    </button>
    {open && typeof enableRegulatorMode === 'boolean' && createPortal(<div id={`${pickerId}-dialog`} ref={panel} className="catalog-select__panel" role="dialog" aria-label={`${label} — ${locale === 'fr' ? 'sélection' : 'picker'}`} style={{ ...position, visibility: position ? 'visible' : 'hidden' }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }} onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && !trigger.current?.contains(event.relatedTarget)) close(false); }}>
      <div className="catalog-select__heading"><strong>{label}</strong><button type="button" className="catalog-select__icon" aria-label={t.close} onClick={() => close()}>×</button></div>
      <div className="catalog-select__search"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5"/></svg><input ref={search} role="combobox" aria-label={t.search} aria-controls={listId} aria-expanded="true" aria-autocomplete="list" aria-activedescendant={active ? `${listId}-${results.indexOf(active)}` : undefined} placeholder={t.search} value={query} autoComplete="off" onChange={(event) => { setQuery(event.target.value); setActiveValue(null); }} onKeyDown={onSearchKeyDown}/></div>
      <div className="catalog-select__filters"><select aria-label={t.country} value={country} onChange={(event) => { setCountry(event.target.value); setActiveValue(null); }}><option value="">{t.all}</option>{entries.some((option) => !option.countries.length) ? <option value="__global">{t.global}</option> : null}{countryOptions.map((item) => <option key={item.key} value={item.key}>{item.label}{item.code ? ` (${item.code})` : ''}</option>)}</select>{multiple ? <label><input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)}/>{t.selectedOnly}</label> : null}</div>
      {multiple && selectedEntries.length ? <div className="catalog-select__chips">{selectedEntries.slice(0, 3).map((option) => <button type="button" key={option.value} aria-label={`${t.remove} ${option.name || option.label}`} onClick={() => change(selected.filter((item) => item !== option.value))}><span>{option.name || option.label}</span><span aria-hidden="true">×</span></button>)}{selectedEntries.length > 3 ? <span>+{selectedEntries.length - 3}</span> : null}</div> : null}
      <div className="catalog-select__count" role="status" aria-live="polite">{results.length} {t.of} {entries.length} {t.results}{multiple ? ` · ${selectedEntries.length} ${t.selected}` : ''}</div>
      <div id={listId} role="listbox" aria-label={label} aria-multiselectable={multiple || undefined} className="catalog-select__results">
        {groups.map((group) => <div key={group.key} role="group" aria-label={group.label}><div className="catalog-select__group" aria-hidden="true"><span>{group.label}</span><span>{group.options.length}</span></div>{group.options.map((option) => <div key={option.value} id={`${listId}-${results.indexOf(option)}`} role="option" aria-selected={selected.includes(option.value)} aria-disabled={option.disabled || undefined} data-option-index={results.indexOf(option)} className={`catalog-select__option${active?.value === option.value ? ' is-active' : ''}`} onPointerMove={() => setActiveValue(option.value)} onPointerDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
          <span className={`catalog-select__check${selected.includes(option.value) ? ' is-selected' : ''}`} aria-hidden="true">{selected.includes(option.value) ? '✓' : ''}</span><span className="catalog-select__option-copy"><strong>{option.name || option.label}</strong><small>{[...option.details, option.countries.length > 1 ? option.countries.map((item) => item.label).join(', ') : null].filter(Boolean).join(' · ') || option.label}</small>{option.inactive || option.unavailable ? <small>{[option.inactive ? t.inactive : null, option.unavailable ? t.unavailable : null].filter(Boolean).join(' · ')}</small> : null}</span>
        </div>)}</div>)}
        {!results.length ? <div className="catalog-select__empty"><strong>{entries.length ? t.noMatch : t.empty}</strong>{entries.length ? <><span>{t.tryAgain}</span><button type="button" className="btn-neutral btn-sm" onClick={resetFilters}>{t.reset}</button></> : null}</div> : null}
      </div>
      <div className="catalog-select__footer">{(!required && (multiple || empty)) ? <button type="button" className="catalog-select__clear" disabled={!selectedEntries.length} onClick={() => { change([]); if (!multiple) close(); }}>{protectedValues.length ? t.clearVisible : empty?.label || t.clear}</button> : <span/>}<button type="button" className="btn-neutral btn-sm" onClick={() => close()}>{t.done}</button></div>
      {protectedValues.length ? <div className="catalog-select__count">{t.protected}</div> : null}
    </div>, document.body)}
  </div>;
});
