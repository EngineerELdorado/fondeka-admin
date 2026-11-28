'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLocale } from '@/contexts/LocaleContext';
import { commercePage, commerceText } from '@/lib/commerce-review';
import { CatalogPagination, StoreDirectoryCard } from './Catalog';
import styles from './CommerceWorkspace.module.css';

export default function BusinessStores({ businessId }) {
  const { locale } = useLocale();
  const t = (en, fr) => commerceText(locale, en, fr);
  const [data, setData] = useState({ rows: [], totalElements: null, totalPages: null });
  const [page, setPage] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const request = useRef(0);
  const invalidate = useCallback(() => { request.current++; }, []);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setError(''); setData({ rows: [], totalElements: null, totalPages: null });
    try {
      const response = await api.commerceStores.list(new URLSearchParams({ businessId: String(businessId), page: String(page), size: '12' }));
      const parsed = commercePage(response);
      if (id !== request.current) return;
      if (parsed.rows.some((store) => String(store.businessId) !== String(businessId))) throw new Error('This backend did not return stores scoped to this Business. Update the backend to use this workspace.');
      if (page > 0 && parsed.totalPages != null && page >= parsed.totalPages) { setPage(Math.max(0, parsed.totalPages - 1)); return; }
      setData(parsed);
    } catch (err) { if (id === request.current) setError(err?.message || 'Stores could not be loaded.'); }
    finally { if (id === request.current) setLoading(false); }
  }, [businessId, page]);
  useEffect(() => { void load(); return invalidate; }, [load, invalidate]);
  return <section className={styles.workspace} aria-label={t('Business stores', 'Boutiques de l’entreprise')}>
    <div className={styles.heading}><div><h2>{t('Stores', 'Boutiques')}</h2><p>{t('Open a storefront to review its catalogue and manage individual marketplace approvals.', 'Ouvrez une vitrine pour examiner son catalogue et gérer les approbations marketplace de chaque produit.')}</p></div><button type="button" className="btn-neutral btn-sm" disabled={loading} onClick={() => void load()}>{t('Refresh stores', 'Actualiser les boutiques')}</button></div>
    {error ? <div role="alert" className="alert alert-error">{error}</div> : loading ? <div className={styles.empty} role="status">{t('Loading stores…', 'Chargement des boutiques…')}</div> : !data.rows.length ? <div className={styles.empty}><h3>{t('No stores linked to this Business', 'Aucune boutique liée à cette entreprise')}</h3><p>{t('Stores belonging to another Business of the same owner are kept in their own workspace.', 'Les boutiques d’une autre entreprise du même propriétaire restent dans leur propre espace.')}</p></div> : <div className={styles.grid}>{data.rows.map((store) => <StoreDirectoryCard key={store.id} store={store} locale={locale} />)}</div>}
    <CatalogPagination {...data} page={page} size={12} rowCount={data.rows.length} busy={loading} onPageChange={setPage} locale={locale} />
  </section>;
}
