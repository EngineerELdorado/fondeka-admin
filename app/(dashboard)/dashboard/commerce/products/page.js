'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { api } from '@/lib/api';

const PRODUCT_TYPES = ['PHYSICAL', 'DIGITAL', 'SERVICE', 'TRAINING'];

const normalizeGroups = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim().toUpperCase()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);
  return [];
};

const formatEnum = (value) => {
  if (!value) return '—';
  return String(value).toLowerCase().split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

const formatDateTime = (value, locale) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US');
};

const formatMoney = (amount, currency, locale) => {
  if (amount === null || amount === undefined || amount === '') return '—';
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return `${amount} ${currency || ''}`.trim();
  try {
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(numericAmount);
  } catch {
    return `${numericAmount.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} ${currency || ''}`.trim();
  }
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <strong>{title}</strong>
        <button type="button" onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--text)', fontSize: '18px', cursor: 'pointer' }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

export default function CommerceProductsPage() {
  const { session } = useAuth();
  const { locale } = useLocale();
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const groups = useMemo(() => {
    const access = session?.tokens?.accessToken?.payload || {};
    const id = session?.tokens?.idToken?.payload || {};
    return new Set([
      ...normalizeGroups(access['cognito:groups'] || access.groups),
      ...normalizeGroups(id['cognito:groups'] || id.groups)
    ]);
  }, [session]);
  const canModerate = groups.has('ADMIN') || groups.has('SUPER_ADMIN');

  const typeLabel = useCallback((value) => {
    if (String(value).toUpperCase() === 'TRAINING') return locale === 'fr' ? 'Formation' : 'Training';
    const english = formatEnum(value);
    if (locale !== 'fr') return english;
    return { PHYSICAL: 'Physique', DIGITAL: 'Numérique', SERVICE: 'Service' }[String(value).toUpperCase()] || english;
  }, [locale]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.commerceProducts.list(new URLSearchParams({ page: String(page), size: String(size) }));
      const rows = Array.isArray(response) ? response : response?.content || [];
      setProducts(rows);
      setPageMeta({
        totalElements: Number.isFinite(response?.totalElements) ? response.totalElements : null,
        totalPages: Number.isFinite(response?.totalPages) ? response.totalPages : null
      });
    } catch (err) {
      setProducts([]);
      setPageMeta({ totalElements: null, totalPages: null });
      setError(err?.message || (locale === 'fr' ? 'Impossible de charger les produits.' : 'Failed to load products.'));
    } finally {
      setLoading(false);
    }
  }, [locale, page, size]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const visibleProducts = useMemo(
    () => typeFilter ? products.filter((product) => String(product?.type).toUpperCase() === typeFilter) : products,
    [products, typeFilter]
  );

  const openMarketplace = (product) => setEditing({
    product,
    marketplaceEnabled: Boolean(product.marketplaceEnabled),
    marketplaceApproved: Boolean(product.marketplaceApproved),
    marketplaceCategory: product.marketplaceCategory ?? '',
    marketplacePriority: product.marketplacePriority ?? 0
  });

  const saveMarketplace = async () => {
    if (!editing || saving) return;
    const original = editing.product;
    const nextPriority = Number(editing.marketplacePriority);
    if (!Number.isInteger(nextPriority)) {
      setError(locale === 'fr' ? 'La priorité marketplace doit être un nombre entier.' : 'Marketplace priority must be a whole number.');
      return;
    }
    const payload = {};
    if (Boolean(original.marketplaceEnabled) !== editing.marketplaceEnabled) payload.marketplaceEnabled = editing.marketplaceEnabled;
    if (Boolean(original.marketplaceApproved) !== editing.marketplaceApproved) payload.marketplaceApproved = editing.marketplaceApproved;
    if (String(original.marketplaceCategory ?? '') !== String(editing.marketplaceCategory).trim()) payload.marketplaceCategory = String(editing.marketplaceCategory).trim() || null;
    if (Number(original.marketplacePriority ?? 0) !== nextPriority) payload.marketplacePriority = nextPriority;
    if (Object.keys(payload).length === 0) {
      setEditing(null);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await api.commerceProducts.updateMarketplace(original.id, payload);
      setProducts((current) => current.map((product) => product.id === original.id ? { ...product, ...(updated || {}), ...payload } : product));
      setEditing(null);
      setInfo(locale === 'fr' ? 'Paramètres marketplace du produit enregistrés.' : 'Product marketplace settings saved.');
    } catch (err) {
      setError(err?.message || (locale === 'fr' ? 'Impossible d’enregistrer les paramètres marketplace.' : 'Failed to save marketplace settings.'));
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    {
      key: 'name',
      label: locale === 'fr' ? 'Produit' : 'Product',
      render: (row) => <div><strong>{row.name || `#${row.id}`}</strong><div style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.description || '—'}</div></div>
    },
    { key: 'type', label: locale === 'fr' ? 'Type' : 'Type', render: (row) => <span className="table-pagination__meta-badge">{typeLabel(row.type)}</span> },
    { key: 'store', label: locale === 'fr' ? 'Boutique' : 'Store', render: (row) => <div>{row.storeName || row.storeSlug || row.storeId || '—'}{row.storeSlug ? <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.storeSlug}</div> : null}</div> },
    { key: 'price', label: locale === 'fr' ? 'Prix' : 'Price', render: (row) => formatMoney(row.priceAmount, row.priceCurrency, locale) },
    { key: 'status', label: locale === 'fr' ? 'Statut' : 'Status', render: (row) => formatEnum(row.status) },
    {
      key: 'inventory',
      label: locale === 'fr' ? 'Accès / stock' : 'Access / stock',
      render: (row) => String(row.type).toUpperCase() === 'TRAINING'
        ? (locale === 'fr' ? 'Accès numérique illimité' : 'Unlimited digital access')
        : row.inventoryPolicy === 'UNLIMITED' ? (locale === 'fr' ? 'Illimité' : 'Unlimited') : (row.inventoryQuantity ?? '—')
    },
    { key: 'shipping', label: locale === 'fr' ? 'Livraison' : 'Shipping', render: (row) => row.requiresShipping ? (locale === 'fr' ? 'Requise' : 'Required') : (locale === 'fr' ? 'Non requise' : 'Not required') },
    { key: 'marketplace', label: 'Marketplace', render: (row) => <div style={{ display: 'grid', gap: '0.2rem' }}><span>{row.marketplaceEnabled ? (locale === 'fr' ? 'Activé' : 'Enabled') : (locale === 'fr' ? 'Désactivé' : 'Disabled')}</span><span style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.marketplaceApproved ? (locale === 'fr' ? 'Approuvé' : 'Approved') : (locale === 'fr' ? 'Non approuvé' : 'Not approved')}</span></div> },
    { key: 'updatedAt', label: locale === 'fr' ? 'Mis à jour' : 'Updated', render: (row) => formatDateTime(row.updatedAt, locale) },
    {
      key: 'actions',
      label: '',
      render: (row) => canModerate ? <button type="button" className="btn-neutral btn-sm" onClick={() => openMarketplace(row)}>{locale === 'fr' ? 'Modérer' : 'Moderate'}</button> : '—'
    }
  ], [canModerate, locale, typeLabel]);

  const canNext = pageMeta.totalPages === null ? products.length === size && products.length > 0 : page + 1 < pageMeta.totalPages;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0 }}>{locale === 'fr' ? 'Produits commerce' : 'Commerce products'}</h1>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)' }}>{locale === 'fr' ? 'Consultez les produits et gérez leur découverte sur la marketplace.' : 'Review products and manage their marketplace discovery.'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/commerce/stores" className="btn-neutral" style={{ textDecoration: 'none' }}>{locale === 'fr' ? 'Boutiques' : 'Stores'}</Link>
          <Link href="/dashboard/feature-flags" className="btn-neutral" style={{ textDecoration: 'none' }}>{locale === 'fr' ? 'Fonctionnalités' : 'Feature flags'}</Link>
          <button type="button" className="btn-neutral" disabled={loading} onClick={() => void loadProducts()}>{loading ? (locale === 'fr' ? 'Actualisation…' : 'Refreshing…') : (locale === 'fr' ? 'Actualiser' : 'Refresh')}</button>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>{locale === 'fr' ? 'Type (page actuelle uniquement)' : 'Type (current page only)'}</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">{locale === 'fr' ? 'Tous sur cette page' : 'All on this page'}</option>
            {PRODUCT_TYPES.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>{locale === 'fr' ? 'Taille de page' : 'Page size'}</span>
          <select value={size} onChange={(event) => { setPage(0); setSize(Number(event.target.value)); }}>
            {[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <div style={{ color: 'var(--muted)', fontSize: '12px', maxWidth: '620px' }}>
          {locale === 'fr'
            ? 'Le backend ne fournit pas encore de filtre TRAINING global ni de nombre de modules. Les totaux de pagination restent ceux du catalogue complet.'
            : 'The backend does not yet provide a catalog-wide TRAINING filter or module counts. Pagination totals remain those of the full catalog.'}
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {info ? <div className="alert alert-success">{info}</div> : null}

      <DataTable
        columns={columns}
        rows={visibleProducts}
        page={page}
        pageSize={size}
        totalElements={pageMeta.totalElements}
        totalPages={pageMeta.totalPages}
        onPageChange={setPage}
        canPrev={page > 0}
        canNext={canNext}
        emptyLabel={loading ? (locale === 'fr' ? 'Chargement des produits…' : 'Loading products…') : (locale === 'fr' ? 'Aucun produit trouvé.' : 'No products found.')}
      />

      <div className="card" style={{ color: 'var(--muted)', fontSize: '13px' }}>
        {locale === 'fr'
          ? 'Pour une formation, le prix correspond à la formation complète. L’approbation marketplace contrôle uniquement la découverte : sa suppression ne rembourse pas un achat et ne révoque pas l’accès apprenant.'
          : 'For a training, the price covers the complete training. Marketplace approval controls discovery only: removing it does not refund a purchase or revoke learner access.'}
      </div>

      {editing ? (
        <Modal title={`${locale === 'fr' ? 'Modération marketplace' : 'Marketplace moderation'} — ${editing.product.name || `#${editing.product.id}`}`} onClose={() => !saving && setEditing(null)}>
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><input type="checkbox" checked={editing.marketplaceEnabled} onChange={(event) => setEditing((current) => ({ ...current, marketplaceEnabled: event.target.checked }))} /><span>{locale === 'fr' ? 'Marketplace activée' : 'Marketplace enabled'}</span></label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><input type="checkbox" checked={editing.marketplaceApproved} onChange={(event) => setEditing((current) => ({ ...current, marketplaceApproved: event.target.checked }))} /><span>{locale === 'fr' ? 'Marketplace approuvée' : 'Marketplace approved'}</span></label>
            <label style={{ display: 'grid', gap: '0.25rem' }}><span>{locale === 'fr' ? 'Catégorie marketplace' : 'Marketplace category'}</span><input value={editing.marketplaceCategory} onChange={(event) => setEditing((current) => ({ ...current, marketplaceCategory: event.target.value }))} /></label>
            <label style={{ display: 'grid', gap: '0.25rem' }}><span>{locale === 'fr' ? 'Priorité marketplace' : 'Marketplace priority'}</span><input type="number" step="1" value={editing.marketplacePriority} onChange={(event) => setEditing((current) => ({ ...current, marketplacePriority: event.target.value }))} /></label>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{locale === 'fr' ? 'Ces contrôles modifient la découverte marketplace uniquement. Ils ne révoquent pas l’accès aux formations déjà achetées.' : 'These controls affect marketplace discovery only. They do not revoke access to purchased training.'}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}><button type="button" className="btn-neutral" disabled={saving} onClick={() => setEditing(null)}>{locale === 'fr' ? 'Annuler' : 'Cancel'}</button><button type="button" className="btn-primary" disabled={saving} onClick={() => void saveMarketplace()}>{saving ? (locale === 'fr' ? 'Enregistrement…' : 'Saving…') : (locale === 'fr' ? 'Enregistrer' : 'Save')}</button></div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
