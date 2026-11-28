'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PresentationLink as Link } from '@/components/RegulatorPresentation';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { api } from '@/lib/api';
import { commerceTabKey, commerceLabel, commercePermissions, commerceText, commerceUrl, storeDeleted } from '@/lib/commerce-review';
import { CatalogImage, ReviewBadge } from './Catalog';
import ProductReview from './ProductReview';
import StoreOperations from './StoreOperations';
import styles from './CommerceWorkspace.module.css';

export function StoreSettings({ store, canModerate, busy, onSave, locale }) {
  const t = (en, fr) => commerceText(locale, en, fr);
  const [verification, setVerification] = useState(store.verificationStatus);
  const [priority, setPriority] = useState(String(store.marketplacePriority ?? 0));
  const [maxBytes, setMaxBytes] = useState(store.productVideoMaxBytes == null ? '' : String(store.productVideoMaxBytes));
  const [maxSeconds, setMaxSeconds] = useState(store.productVideoMaxDurationSeconds == null ? '' : String(store.productVideoMaxDurationSeconds));
  const [error, setError] = useState('');
  const saveSettings = async (event) => {
    event.preventDefault();
    if (!canModerate || busy) return;
    const number = (value) => value === '' ? null : Number(value);
    const values = [number(priority), number(maxBytes), number(maxSeconds)];
    if (values[0] == null || values.some((value) => value != null && (!Number.isSafeInteger(value) || value < 0))) { setError(t('Enter nonnegative whole numbers.', 'Saisissez des nombres entiers positifs ou nuls.')); return; }
    setError('');
    await onSave('marketplace', { marketplacePriority: values[0], ...(values[1] == null ? {} : { productVideoMaxBytes: values[1] }), ...(values[2] == null ? {} : { productVideoMaxDurationSeconds: values[2] }) });
  };
  return <div className={styles.workspace}>
    <section className="card" style={{ display: 'grid', gap: '1rem' }}><div className={styles.heading}><div><h2>{t('Store verification', 'Vérification de la boutique')}</h2><p>{t('Verification belongs to the store. Each product keeps its own marketplace approval.', 'La vérification concerne la boutique. Chaque produit conserve sa propre approbation marketplace.')}</p></div><ReviewBadge tone={store.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>{commerceLabel(store.verificationStatus)}</ReviewBadge></div>
      {storeDeleted(store) ? <p>{t('Restore this store before reviewing its verification.', 'Restaurez cette boutique avant de revoir sa vérification.')}</p> : <div className={styles.actions}><select aria-label={t('Store verification', 'Vérification de la boutique')} value={verification} disabled={!canModerate || busy} onChange={(event) => setVerification(event.target.value)}>{['UNVERIFIED', 'VERIFIED', 'REJECTED'].map((value) => <option key={value} value={value}>{commerceLabel(value)}</option>)}</select>{canModerate ? <button type="button" className="btn-primary" disabled={busy || verification === store.verificationStatus} onClick={() => onSave('verification', { verificationStatus: verification })}>{t('Save verification', 'Enregistrer la vérification')}</button> : null}</div>}
      {canModerate && storeDeleted(store) ? <button type="button" className="btn-neutral" disabled={busy} onClick={() => onSave('restore')}>{t('Restore store', 'Restaurer la boutique')}</button> : null}
    </section>
    <section className="card" style={{ display: 'grid', gap: '1rem' }}><h2 style={{ margin: 0 }}>{t('Marketplace ranking & media limits', 'Classement marketplace et limites des médias')}</h2><form onSubmit={saveSettings} className={styles.form}>
      <div className={styles.grid}><label>{t('Marketplace priority', 'Priorité marketplace')}<input type="number" min="0" step="1" value={priority} disabled={!canModerate || busy} onChange={(event) => setPriority(event.target.value)} /></label><label>{t('Product video limit (bytes)', 'Limite vidéo produit (octets)')}<input type="number" min="0" step="1" value={maxBytes} disabled={!canModerate || busy} onChange={(event) => setMaxBytes(event.target.value)} /></label><label>{t('Product video limit (seconds)', 'Limite vidéo produit (secondes)')}<input type="number" min="0" step="1" value={maxSeconds} disabled={!canModerate || busy} onChange={(event) => setMaxSeconds(event.target.value)} /></label></div>
      <small className={styles.muted}>{t('Blank media limits stay unchanged. Enter 0 to restore the backend default.', 'Les limites médias vides restent inchangées. Saisissez 0 pour rétablir la valeur par défaut du backend.')}</small>
      {error ? <div role="alert" className="alert alert-error">{error}</div> : null}
      {canModerate ? <div><button type="submit" className="btn-primary" disabled={busy}>{t('Save store settings', 'Enregistrer les réglages')}</button></div> : null}
    </form></section>
    <section className="card" style={{ display: 'grid', gap: '1rem' }}><h2 style={{ margin: 0 }}>{t('Store details', 'Détails de la boutique')}</h2><dl className={styles.metadata}>{[
      ['ID', store.id], [t('Owner account', 'Compte propriétaire'), store.ownerAccountId], [t('Business', 'Entreprise'), store.businessId], [t('Status', 'Statut'), commerceLabel(store.status)],
      [t('Visibility', 'Visibilité'), commerceLabel(store.visibility)], [t('Country', 'Pays'), store.countryName || store.countryCode], [t('Currency', 'Devise'), store.defaultCurrency],
      ['Email', store.contactEmail], ['WhatsApp', store.whatsappNumber], [t('Created', 'Créée le'), store.createdAt ? new Date(store.createdAt).toLocaleString() : '—'],
      [t('Updated', 'Modifiée le'), store.updatedAt ? new Date(store.updatedAt).toLocaleString() : '—'], [t('Deleted', 'Supprimée le'), store.deletedAt || '—']
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl></section>
  </div>;
}

export default function StoreWorkspace({ storeId }) {
  const { session } = useAuth(), { locale } = useLocale();
  const { canModerate } = commercePermissions(session);
  const t = (en, fr) => commerceText(locale, en, fr);
  const [store, setStore] = useState(null), [tab, setTab] = useState('storefront'), [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [info, setInfo] = useState(''), [ready, setReady] = useState(false);
  const request = useRef(0), lock = useRef(false);
  const invalidate = useCallback(() => { request.current++; }, []);
  const load = useCallback(async () => {
    const id = ++request.current;
    if (storeId == null) return;
    setLoading(true); setError(''); setReady(false);
    try {
      const saved = await api.commerceStores.get(storeId);
      if (id !== request.current) return;
      if (String(saved?.id) !== String(storeId)) throw new Error('The store response could not be confirmed.');
      setStore(saved); setReady(true);
    } catch (err) { if (id === request.current) setError(err?.status === 404 ? 'Store preview is unavailable. The store may not exist or this backend needs the admin store-detail endpoint.' : err?.message || 'The store could not be loaded.'); }
    finally { if (id === request.current) setLoading(false); }
  }, [storeId]);
  useEffect(() => { void load(); return invalidate; }, [load, invalidate]);
  const save = async (kind, payload) => {
    if (!canModerate || !ready || lock.current || !store) return;
    const id = request.current;
    lock.current = true; setBusy(true); setError(''); setInfo('');
    try {
      const saved = kind === 'restore' ? await api.commerceStores.restore(storeId) : kind === 'verification' ? await api.commerceStores.updateVerification(storeId, payload) : await api.commerceStores.updateMarketplace(storeId, payload);
      if (id !== request.current) return;
      if (String(saved?.id) !== String(storeId) || (kind === 'verification' && saved.verificationStatus !== payload.verificationStatus)) throw new Error('The saved store setting could not be confirmed. Reload the store.');
      setStore(saved); setInfo(t('Store setting saved.', 'Réglage de la boutique enregistré.'));
    } catch (err) { if (id === request.current) { setError(err?.message || 'The store could not be updated.'); if (!err?.status || err.status >= 500 || err.status === 403) setReady(false); } }
    finally { lock.current = false; if (id === request.current) setBusy(false); }
  };
  const url = commerceUrl(store?.storefrontUrl || store?.publicUrl);
  return <div className={styles.workspace}>
    <div className={styles.heading}><div className={styles.actions}><Link href="/dashboard/commerce/stores">← {t('Stores', 'Boutiques')}</Link><span className={styles.muted}>/</span><span>{store?.name || `#${storeId}`}</span></div><div className={styles.actions}>{store?.businessId ? <Link href={`/dashboard/businesses/${encodeURIComponent(store.businessId)}`}>{t('Business workspace', 'Espace entreprise')}</Link> : null}<button type="button" className="btn-neutral btn-sm" disabled={loading || busy} onClick={() => void load()}>{t('Refresh store', 'Actualiser la boutique')}</button></div></div>
    {error ? <div className="alert alert-error" role="alert">{error}</div> : null}{info ? <div className="alert alert-success" role="status">{info}</div> : null}
    {loading && !store ? <div className={styles.empty} role="status">{t('Loading the store…', 'Chargement de la boutique…')}</div> : null}
    {store ? <>
      <header className={styles.storeHero}>
        <div className={styles.banner}>{store.bannerUrl ? <CatalogImage src={store.bannerUrl} name="" /> : null}</div>
        <div className={styles.brand}><div className={styles.logo}><CatalogImage src={store.logoUrl} name={store.name} /></div><div className={styles.brandCopy}><div className={styles.eyebrow}>{t('Store workspace', 'Espace boutique')} · /{store.slug}</div><h1>{store.name}</h1><div className={styles.actions}><ReviewBadge tone={store.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>{commerceLabel(store.verificationStatus)}</ReviewBadge><ReviewBadge>{commerceLabel(store.status)}</ReviewBadge><span className={styles.muted}>{[store.countryCode, store.defaultCurrency].filter(Boolean).join(' · ')}</span></div><p>{store.description}</p></div></div>
        <div className={styles.heroFooter}><span className={styles.muted}>{t('Store verification and product approval are separate. Marketplace approval does not change the seller’s storefront.', 'La vérification et l’approbation sont distinctes. L’approbation marketplace ne modifie pas la vitrine du vendeur.')}</span><div className={styles.actions}>{store.ownerAccountId ? <Link href={`/dashboard/accounts/accounts/${encodeURIComponent(store.ownerAccountId)}`}>{t('Owner account', 'Compte propriétaire')}</Link> : null}{url ? <a href={url} target="_blank" rel="noopener noreferrer">{t('Visit public store', 'Voir la boutique publique')} ↗</a> : null}</div></div>
      </header>
      <div className={styles.tabs} role="tablist" aria-label={t('Store sections', 'Sections de la boutique')}>{[['storefront', 'Storefront & products', 'Vitrine et produits'], ['report', 'POS report', 'Rapport POS'], ['orders', 'Orders', 'Commandes'], ['customers', 'Customers', 'Clients'], ['settings', 'Store settings', 'Réglages de la boutique']].map(([id, en, fr]) => <button type="button" role="tab" tabIndex={tab === id ? 0 : -1} onKeyDown={(event) => commerceTabKey(event, ['storefront', 'report', 'orders', 'customers', 'settings'], tab, setTab)} aria-selected={tab === id} aria-controls={`store-panel-${id}`} id={`store-tab-${id}`} key={id} disabled={busy} onClick={() => setTab(id)}>{t(en, fr)}</button>)}</div>
      <div id="store-panel-storefront" role="tabpanel" aria-labelledby="store-tab-storefront" hidden={tab !== 'storefront'}>
        {tab === 'storefront' ? <ProductReview storeId={storeId} store={store} customerView={preview} headerActions={({ busy: productBusy }) => <div className={styles.segmented}><button type="button" aria-pressed={!preview} disabled={productBusy} onClick={() => setPreview(false)}>{t('Moderate', 'Modérer')}</button><button type="button" aria-pressed={preview} disabled={productBusy} onClick={() => setPreview(true)}>{t('Customer view', 'Vue client')}</button></div>} /> : null}
      </div>
      {['report', 'orders', 'customers'].includes(tab) ? <div id={`store-panel-${tab}`} role="tabpanel" aria-labelledby={`store-tab-${tab}`} hidden={!['report', 'orders', 'customers'].includes(tab)}>{['report', 'orders', 'customers'].includes(tab) ? <StoreOperations storeId={storeId} section={tab} onSectionChange={setTab} /> : null}</div> : null}
      {tab === 'settings' ? <div id="store-panel-settings" role="tabpanel" aria-labelledby="store-tab-settings"><StoreSettings key={store.id} store={store} canModerate={canModerate && ready} busy={busy} onSave={save} locale={locale} /></div> : null}
    </> : null}
  </div>;
}
