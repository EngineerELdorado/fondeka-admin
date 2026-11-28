'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PresentationLink as Link } from '@/components/RegulatorPresentation';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { isRegulatorRestrictedRecord } from '@/lib/regulator-presentation';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';
import { PRODUCT_TYPES, PRODUCT_STATUSES, assertProductScope, commerceLabel, commerceMoney, commercePage, commercePermissions, commerceText, commerceUrl, productDiscovery, productImages, productReviewQuery, publicStorefront, storefrontProduct } from '@/lib/commerce-review';
import { CatalogImage, CatalogPagination, ReviewBadge } from './Catalog';
import styles from './CommerceWorkspace.module.css';

export function ProductInspector({ product, busy, canModerate, onClose, onSave, error, locale = 'en', customerView = false }) {
  const dialog = useRef(null);
  const [image, setImage] = useState(0);
  const [draft, setDraft] = useState({ marketplaceEnabled: product.marketplaceEnabled, marketplaceCategory: product.marketplaceCategory || '', marketplacePriority: String(product.marketplacePriority ?? 0) });
  const [validation, setValidation] = useState('');
  const t = (en, fr) => commerceText(locale, en, fr);
  const images = productImages(product), discovery = productDiscovery(product, locale);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  const saveAdvanced = async (event) => {
    event.preventDefault();
    if (!canModerate || busy) return;
    const priority = Number(draft.marketplacePriority);
    if (!Number.isSafeInteger(priority) || priority < 0) { setValidation(t('Priority must be a nonnegative whole number.', 'La priorité doit être un entier positif ou nul.')); return; }
    const payload = {};
    if (draft.marketplaceEnabled !== product.marketplaceEnabled) payload.marketplaceEnabled = draft.marketplaceEnabled;
    if (draft.marketplaceCategory.trim() !== (product.marketplaceCategory || '')) payload.marketplaceCategory = draft.marketplaceCategory.trim();
    if (priority !== (product.marketplacePriority ?? 0)) payload.marketplacePriority = priority;
    setValidation('');
    if (Object.keys(payload).length) await onSave(product, payload);
  };
  const url = commerceUrl(product.productUrl || product.publicUrl);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="product-inspector-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className={styles.dialogHeader}><h2 id="product-inspector-title">{product.name}</h2><button type="button" className="btn-neutral btn-sm" aria-label={t('Close product', 'Fermer le produit')} disabled={busy} onClick={onClose}>×</button></div>
    <div className={styles.inspector}>
      <div><CatalogImage src={images[image] || images[0]} name={product.name} className={styles.inspectorImage} />
        {images.length > 1 ? <div className={styles.thumbnails}>{images.map((src, index) => <button type="button" key={src} aria-label={`${t('Product image', 'Image du produit')} ${index + 1}`} aria-pressed={image === index} onClick={() => setImage(index)}><CatalogImage src={src} name="" /></button>)}</div> : null}
        {commerceUrl(product.videoUrl) ? <video style={{ width: '100%', marginTop: '.75rem', borderRadius: '.75rem' }} src={commerceUrl(product.videoUrl)} poster={commerceUrl(product.videoThumbnailUrl)} controls preload="none" aria-label={t('Product video', 'Vidéo du produit')} /> : null}
      </div>
      <div className={styles.inspectorCopy}>
        <div><div className={styles.productMeta}>{commerceLabel(product.type)} · #{product.id}</div><div style={{ fontSize: 'var(--font-heading)', fontWeight: 800, marginTop: '.4rem' }}>{commerceMoney(product.priceAmount, product.priceCurrency, locale)}</div></div>
        {!customerView ? <div className={styles.approval} style={{ margin: 0, border: '1px solid var(--border)', borderRadius: '.7rem' }}>
          <label><span>{t('Allow on marketplace', 'Autoriser sur la marketplace')}</span><input type="checkbox" aria-label={t('Allow this product on marketplace', 'Autoriser ce produit sur la marketplace')} checked={product.marketplaceApproved === true} disabled={busy || !canModerate || typeof product.marketplaceApproved !== 'boolean'} onChange={(event) => onSave(product, { marketplaceApproved: event.target.checked })} /></label>
          <ReviewBadge tone={discovery.tone}>{discovery.label}</ReviewBadge><small>{discovery.detail}</small>
          <small>{t('This decision applies to this product, even when its store is verified.', 'Cette décision s’applique à ce produit, même si la boutique est vérifiée.')}</small>
        </div> : null}
        {error || validation ? <div role="alert" className="alert alert-error">{validation || error}</div> : null}
        <p className={styles.description}>{product.description || t('No description provided.', 'Aucune description.')}</p>
        <dl className={styles.metadata}>{[
          [t('Status', 'Statut'), commerceLabel(product.status)],
          [t('Store', 'Boutique'), product.storeName || product.storeId],
          [t('Inventory / access', 'Stock / accès'), product.type === 'TRAINING' || product.inventoryPolicy === 'UNLIMITED' ? t('Unlimited', 'Illimité') : product.inventoryQuantity ?? '—'],
          [t('Shipping', 'Livraison'), product.requiresShipping ? t('Required', 'Requise') : t('Not required', 'Non requise')],
          ['SKU', product.sku || '—'],
          [t('Storefront listing', 'Vitrine de la boutique'), product.storefrontEnabled ? t('Enabled', 'Activée') : t('Disabled', 'Désactivée')],
          [t('Updated', 'Modifié le'), product.updatedAt ? new Date(product.updatedAt).toLocaleString() : '—']
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <div className={styles.actions}><Link href={`/dashboard/commerce/stores/${encodeURIComponent(product.storeId)}`}>{t('Open store workspace', 'Ouvrir l’espace boutique')}</Link>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{t('Open public product', 'Ouvrir le produit public')} ↗</a> : null}</div>
        {!customerView ? <details className={styles.details}><summary>{t('Advanced marketplace settings', 'Réglages marketplace avancés')}</summary><form className={styles.form} onSubmit={saveAdvanced}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}><input style={{ width: 'auto' }} type="checkbox" checked={draft.marketplaceEnabled === true} disabled={busy || !canModerate} onChange={(event) => setDraft((value) => ({ ...value, marketplaceEnabled: event.target.checked }))} />{t('Marketplace listing enabled', 'Publication marketplace activée')}</label>
          <label>{t('Marketplace category', 'Catégorie marketplace')}<input value={draft.marketplaceCategory} disabled={busy || !canModerate} onChange={(event) => setDraft((value) => ({ ...value, marketplaceCategory: event.target.value }))} /></label>
          <label>{t('Marketplace priority', 'Priorité marketplace')}<input type="number" min="0" step="1" value={draft.marketplacePriority} disabled={busy || !canModerate} onChange={(event) => setDraft((value) => ({ ...value, marketplacePriority: event.target.value }))} /></label>
          {canModerate ? <button type="submit" className="btn-primary" disabled={busy}>{t('Save settings', 'Enregistrer les réglages')}</button> : null}
        </form></details> : null}
        {product.type === 'TRAINING' ? <small className={styles.muted}>{t('The price covers the complete training. Discovery changes do not revoke access to a purchased training.', 'Le prix couvre la formation complète. Les changements de découverte ne révoquent pas l’accès à une formation achetée.')}</small> : null}
      </div>
    </div>
  </dialog>;
}

export default function ProductReview({ storeId = null, store = null, customerView = false, headerActions = null }) {
  const { session, enableRegulatorMode } = useAuth(), { locale } = useLocale();
  const { canModerate } = commercePermissions(session);
  const t = (en, fr) => commerceText(locale, en, fr);
  const [products, setProducts] = useState([]), [meta, setMeta] = useState({ totalElements: null, totalPages: null });
  const [page, setPage] = useState(0), [size, setSize] = useState(12), [view, setView] = useState('grid');
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [type, setType] = useState(''), [status, setStatus] = useState(''), [approval, setApproval] = useState('');
  const [loading, setLoading] = useState(true), [ready, setReady] = useState(false), [savingId, setSavingId] = useState(null);
  const [selected, setSelected] = useState(null), [error, setError] = useState(''), [info, setInfo] = useState(''), [decisions, setDecisions] = useState(0);
  const request = useRef(0), lock = useRef(false), mounted = useRef(true), scope = useRef(storeId);
  scope.current = storeId;
  const invalidate = useCallback(() => { request.current++; }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; invalidate(); }; }, [invalidate]);
  const load = useCallback(async ({ preserve = false } = {}) => {
    const id = ++request.current;
    setLoading(true); setReady(false); setError('');
    if (!preserve) { setProducts([]); setMeta({ totalElements: null, totalPages: null }); }
    try {
      const response = await api.commerceProducts.list(productReviewQuery({ page, size, storeId, search: query, type, status, approval: customerView ? '' : approval, storefront: customerView }));
      const result = commercePage(response);
      assertProductScope(result.rows, storeId);
      if (id !== request.current || !mounted.current) return;
      if (result.totalPages != null && page > 0 && page >= result.totalPages) { setPage(Math.max(0, result.totalPages - 1)); return; }
      setProducts(result.rows); setMeta(result); setReady(true);
    } catch (err) { if (id === request.current && mounted.current) setError(err?.message || 'Failed to load products.'); }
    finally { if (id === request.current && mounted.current) setLoading(false); }
  }, [approval, customerView, page, query, size, status, storeId, type]);
  useEffect(() => { void load(); return invalidate; }, [load, invalidate]);
  useEffect(() => { setPage(0); setSelected(null); }, [storeId, customerView]);

  const save = async (product, payload) => {
    if (lock.current || !canModerate || !ready || !product?.id) return null;
    const originalScope = storeId;
    lock.current = true; setSavingId(product.id); setError(''); setInfo('');
    try {
      const updated = await api.commerceProducts.updateMarketplace(product.id, payload);
      if (!mounted.current || originalScope !== scope.current) return null;
      if (String(updated?.id) !== String(product.id) || Object.entries(payload).some(([key, value]) => key === 'marketplaceCategory' ? String(updated[key] ?? '') !== value : key === 'marketplacePriority' ? (updated[key] ?? 0) !== value : updated[key] !== value)) throw new Error(t('The saved decision could not be confirmed. Refresh products before trying again.', 'La décision enregistrée n’a pas pu être confirmée. Actualisez les produits avant de réessayer.'));
      assertProductScope([updated], storeId);
      setProducts((rows) => rows.map((row) => String(row.id) === String(updated.id) ? updated : row));
      setSelected((value) => String(value?.id) === String(updated.id) ? updated : value);
      setDecisions((value) => value + 1);
      setInfo(payload.marketplaceApproved == null ? t('Product settings saved.', 'Réglages du produit enregistrés.') : `${product.name} · ${payload.marketplaceApproved ? t('Marketplace approval on', 'Approbation marketplace activée') : t('Marketplace approval off', 'Approbation marketplace désactivée')}`);
      await load({ preserve: true });
      return updated;
    } catch (err) {
      if (mounted.current && originalScope === scope.current) {
        setError(err?.message || 'The product could not be saved.');
        if (!err?.status || err.status >= 500 || err.status === 409 || err.status === 403) setReady(false);
      }
      return null;
    } finally { lock.current = false; if (mounted.current && originalScope === scope.current) setSavingId(null); }
  };
  const visibleProducts = products.filter((product) => enableRegulatorMode === false || !isRegulatorRestrictedRecord(product));
  const approved = visibleProducts.filter((product) => product.marketplaceApproved === true).length;
  useEffect(() => { if (selected && enableRegulatorMode !== false && isRegulatorRestrictedRecord(selected)) setSelected(null); }, [enableRegulatorMode, selected]);
  const previewUnavailable = customerView && store && !publicStorefront(store);
  const shown = customerView ? visibleProducts.filter(storefrontProduct) : visibleProducts;
  const busy = savingId != null;
  const columns = useMemo(() => [
    { key: 'name', label: commerceText(locale, 'Product', 'Produit'), render: (row) => <button type="button" className={styles.productTitle} onClick={() => setSelected(row)}>{row.name}</button> },
    { key: 'type', label: 'Type', render: (row) => commerceLabel(row.type) },
    { key: 'store', label: commerceText(locale, 'Store', 'Boutique'), render: (row) => <Link href={`/dashboard/commerce/stores/${encodeURIComponent(row.storeId)}`}>{row.storeName || row.storeId}</Link> },
    { key: 'price', label: commerceText(locale, 'Price', 'Prix'), render: (row) => commerceMoney(row.priceAmount, row.priceCurrency, locale) },
    { key: 'status', label: commerceText(locale, 'Status', 'Statut'), render: (row) => commerceLabel(row.status) },
    { key: 'marketplaceApproved', label: commerceText(locale, 'Marketplace approval', 'Approbation marketplace'), render: (row) => row.marketplaceApproved ? commerceText(locale, 'Approved', 'Approuvé') : commerceText(locale, 'Not approved', 'Non approuvé') },
    { key: 'actions', label: '', render: (row) => <button type="button" className="btn-neutral btn-sm" disabled={busy} onClick={() => setSelected(row)}>{commerceText(locale, 'Inspect product', 'Examiner le produit')}</button> }
  ], [busy, locale]);
  return <section className={styles.workspace} aria-label={t('Product review workspace', 'Espace de modération des produits')}>
    <div className={styles.heading}><div><h2>{customerView ? t('Customer storefront preview', 'Aperçu de la vitrine client') : storeId ? t('Products in this store', 'Produits de cette boutique') : t('Product review', 'Modération des produits')}</h2>{!storeId ? <p>{customerView ? t('An admin preview of active storefront listings. No checkout is started here.', 'Un aperçu admin des produits actifs de la vitrine. Aucun paiement n’est lancé ici.') : t('Inspect the product, then decide whether it may appear on the marketplace.', 'Examinez le produit puis décidez s’il peut apparaître sur la marketplace.')}</p> : null}</div><div className={styles.actions}>{typeof headerActions === 'function' ? headerActions({ busy }) : headerActions}<button type="button" className="btn-neutral btn-sm" disabled={loading || busy} onClick={() => void load()}>{t('Refresh products', 'Actualiser les produits')}</button></div></div>
    {!canModerate && !customerView ? <div className={styles.feedback}>{t('Read only. An Admin or Super Admin can change marketplace approval.', 'Lecture seule. Un Admin ou Super Admin peut modifier l’approbation marketplace.')}</div> : null}
    {!customerView ? <div className={styles.toolbar}><div className={styles.actions} role="group" aria-label={t('Approval filter', 'Filtre d’approbation')}>{[['', 'All products', 'Tous les produits'], ['unapproved', 'Not approved', 'Non approuvés'], ['approved', 'Approved', 'Approuvés']].map(([value, en, fr]) => <button type="button" className={styles.filterChip} aria-pressed={approval === value} key={value} disabled={busy} onClick={() => { setApproval(value); setPage(0); }}>{t(en, fr)}</button>)}</div><div className={styles.segmented}><button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>{t('Gallery', 'Galerie')}</button><button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>{t('Table', 'Tableau')}</button></div></div> : null}
    <form className={styles.toolbar} onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); setPage(0); }}>
      <label className={styles.search}><span>{t('Find a product', 'Rechercher un produit')}</span><input type="search" aria-label={t('Find a product', 'Rechercher un produit')} value={search} disabled={busy} placeholder={t('Name, description or SKU', 'Nom, description ou SKU')} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className={styles.filters}><label>Type<select aria-label={t('Product type', 'Type de produit')} value={type} disabled={busy} onChange={(event) => { setType(event.target.value); setPage(0); }}><option value="">{t('All types', 'Tous les types')}</option>{PRODUCT_TYPES.map((value) => <option key={value} value={value}>{value === 'TRAINING' ? t('Training', 'Formation') : commerceLabel(value)}</option>)}</select></label>{!customerView ? <label>{t('Status', 'Statut')}<select aria-label={t('Product status', 'Statut du produit')} value={status} disabled={busy} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><option value="">{t('All statuses', 'Tous les statuts')}</option>{PRODUCT_STATUSES.map((value) => <option key={value} value={value}>{commerceLabel(value)}</option>)}</select></label> : null}<button type="submit" className="btn-neutral" disabled={busy}>{t('Search', 'Rechercher')}</button></div>
    </form>
    {error ? <div role="alert" className="alert alert-error">{error}{!ready ? ` ${t('Refresh products before making another change.', 'Actualisez les produits avant une nouvelle modification.')}` : ''}</div> : null}
    {info ? <div className="alert alert-success" role="status">{info}</div> : null}
    {!customerView && ready && visibleProducts.length ? <div className={styles.feedback}><div><strong>{approved} / {visibleProducts.length}</strong> <span className={styles.muted}>{t('approved on this page', 'approuvés sur cette page')}</span></div><progress value={approved} max={visibleProducts.length} aria-label={t('Approved products on this page', 'Produits approuvés sur cette page')} /><small className={styles.muted}>{t('This session', 'Cette session')} · {decisions} {t('changes saved', 'modifications enregistrées')}</small></div> : null}
    {loading && !products.length ? <div className={styles.empty} role="status">{t('Loading products…', 'Chargement des produits…')}</div> : previewUnavailable ? <div className={styles.empty}><h3>{t('This storefront is not public', 'Cette vitrine n’est pas publique')}</h3><p>{t('Review products in moderation mode. Store status, visibility or deletion prevents public storefront access.', 'Examinez les produits en mode modération. Le statut, la visibilité ou la suppression empêche l’accès public à la boutique.')}</p></div> : !error && !shown.length ? <div className={styles.empty}><h3>{t('No products in this view', 'Aucun produit dans cette vue')}</h3><p>{t('Try another filter or check the next catalogue page.', 'Essayez un autre filtre ou vérifiez la page suivante du catalogue.')}</p></div> : view === 'table' && !customerView ? <DataTable columns={columns} rows={shown} showIndex={false} showAccountQuickNav={false} page={page} pageSize={size} totalPages={meta.totalPages} totalElements={meta.totalElements} canPrev={page > 0 && !busy && !loading} canNext={!busy && !loading && (meta.totalPages == null ? products.length >= size : page + 1 < meta.totalPages)} onPageChange={(value) => { if (!busy && !loading) setPage(value); }} /> : <div className={styles.grid}>
      {shown.map((product) => {
        const discovery = productDiscovery(product, locale);
        return <article key={product.id} className={styles.productCard}>
          <button type="button" className={styles.productMedia} aria-label={`${t('Inspect', 'Examiner')} ${product.name}`} onClick={() => setSelected(product)}><CatalogImage src={productImages(product)[0]} name={product.name} /><span className={styles.mediaTag}>{product.type === 'TRAINING' ? t('Training', 'Formation') : commerceLabel(product.type)}</span></button>
          <div className={styles.productCopy}>
            <button type="button" className={styles.productTitle} onClick={() => setSelected(product)}>{product.name || `#${product.id}`}</button>
            <div className={styles.productPrice}>{commerceMoney(product.priceAmount, product.priceCurrency, locale)}</div>
            <div className={styles.productMeta}>{storeId ? <span>{product.inventoryPolicy === 'UNLIMITED' || product.type === 'TRAINING' ? t('Unlimited access / stock', 'Accès / stock illimité') : `${product.inventoryQuantity ?? '—'} ${t('in stock', 'en stock')}`}</span> : <Link href={`/dashboard/commerce/stores/${encodeURIComponent(product.storeId)}`}>{product.storeName || `Store ${product.storeId}`}</Link>}<span>{commerceLabel(product.status)}</span></div>
            {!customerView ? <div className={styles.approval}><label><span>{savingId === product.id ? t('Saving…', 'Enregistrement…') : t('Allow on marketplace', 'Autoriser sur la marketplace')}</span><input type="checkbox" aria-label={`${t('Allow on marketplace', 'Autoriser sur la marketplace')}: ${product.name}`} checked={product.marketplaceApproved === true} disabled={busy || !ready || !canModerate || typeof product.marketplaceApproved !== 'boolean'} onChange={(event) => void save(product, { marketplaceApproved: event.target.checked })} /></label><small><ReviewBadge tone={discovery.tone}>{discovery.label}</ReviewBadge>{product.storefrontEnabled !== true ? ` · ${t('Storefront off', 'Vitrine désactivée')}` : ''}</small></div> : null}
          </div>
        </article>;
      })}
    </div>}
    {view !== 'table' || customerView ? <CatalogPagination page={page} size={size} {...meta} rowCount={products.length} busy={loading || busy} locale={locale} onPageChange={setPage} onSizeChange={(value) => { setSize(value); setPage(0); }} /> : null}
    {selected ? <ProductInspector key={selected.id} product={selected} customerView={customerView} busy={busy} canModerate={canModerate && ready} onClose={() => !busy && setSelected(null)} onSave={save} error={error} locale={locale} /> : null}
  </section>;
}
