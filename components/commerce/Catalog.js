'use client';

import { useState } from 'react';
import { RegulatorRecord, PresentationLink as Link } from '@/components/RegulatorPresentation';
import { commerceText, commerceUrl, commerceLabel, storeDeleted } from '@/lib/commerce-review';
import styles from './CommerceWorkspace.module.css';

export function CatalogImage({ src, name = '', className, ...props }) {
  const [failed, setFailed] = useState('');
  const url = commerceUrl(src);
  // Merchant media stays browser-loaded; do not proxy arbitrary seller URLs through Next's image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return url && failed !== url ? <img {...props} className={className} src={url} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(url)} /> : <span className={`${styles.fallback} ${className || ''}`} aria-label={name}>{String(name || '—').trim().slice(0, 2).toUpperCase()}</span>;
}

export function ReviewBadge({ children, tone = 'neutral' }) { return <span className={styles.badge} data-tone={tone}>{children}</span>; }

export function CatalogPagination({ page, size, totalElements, totalPages, rowCount, busy, onPageChange, onSizeChange, locale = 'en' }) {
  const t = (en, fr) => commerceText(locale, en, fr);
  const next = totalPages == null ? rowCount >= size : page + 1 < totalPages;
  return <div className={styles.pagination}>
    <span>{totalElements == null ? `${rowCount} ${t('shown', 'affichés')}` : `${totalElements} ${t('results', 'résultats')}`} · {t('Page', 'Page')} {page + 1}{totalPages ? ` / ${totalPages}` : ''}</span>
    <div className={styles.actions}>
      {onSizeChange ? <label>{t('Per page', 'Par page')} <select aria-label={t('Items per page', 'Éléments par page')} value={size} disabled={busy} onChange={(event) => onSizeChange(Number(event.target.value))}>{[12, 24, 48, 100].map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}
      <button type="button" className="btn-neutral btn-sm" disabled={busy || page === 0} onClick={() => onPageChange(page - 1)}>{t('Previous', 'Précédent')}</button>
      <button type="button" className="btn-neutral btn-sm" disabled={busy || !next} onClick={() => onPageChange(page + 1)}>{t('Next', 'Suivant')}</button>
    </div>
  </div>;
}

export function StoreDirectoryCard({ store, locale = 'en', children }) {
  const t = (en, fr) => commerceText(locale, en, fr);
  const id = store.id ?? store.storeId;
  return <RegulatorRecord record={store}><article className={styles.productCard}>
    <Link href={`/dashboard/commerce/stores/${encodeURIComponent(id)}`} aria-label={`${t('Open store', 'Ouvrir la boutique')} ${store.name || id}`} className={styles.storeCardCover}>{store.bannerUrl ? <CatalogImage src={store.bannerUrl} name={store.name} /> : null}</Link>
    <div className={styles.storeCardBody}>
      <div className={styles.storeCardHead}><div className={styles.logo}><CatalogImage src={store.logoUrl} name={store.name || `#${id}`} /></div><div><Link href={`/dashboard/commerce/stores/${encodeURIComponent(id)}`}>{store.name || store.storeName || `Store ${id}`}</Link><small>/{store.slug || id}</small></div></div>
      <div className={styles.actions}><ReviewBadge tone={store.verificationStatus === 'VERIFIED' ? 'success' : store.verificationStatus === 'REJECTED' ? 'danger' : 'warning'}>{commerceLabel(store.verificationStatus || 'UNVERIFIED')}</ReviewBadge><ReviewBadge tone={storeDeleted(store) ? 'danger' : 'neutral'}>{storeDeleted(store) ? t('Deleted / archived', 'Supprimée / archivée') : commerceLabel(store.status)}</ReviewBadge></div>
      <p>{store.description || t('No store description provided.', 'Aucune description de boutique.')}</p>
      <div className={styles.productMeta}><span>{[store.countryCode, store.defaultCurrency || store.currency].filter(Boolean).join(' · ') || '—'}</span><span>{commerceLabel(store.visibility)}</span></div>
      <div className={styles.cardFooter}><Link href={`/dashboard/commerce/stores/${encodeURIComponent(id)}`} className="btn-primary btn-sm">{t('Open workspace', 'Ouvrir l’espace')}</Link>{children}</div>
    </div>
  </article></RegulatorRecord>;
}
