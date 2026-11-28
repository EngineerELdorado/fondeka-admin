export const PRODUCT_TYPES = ['PHYSICAL', 'DIGITAL', 'SERVICE', 'TRAINING'];
export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'];

export function commercePermissions(session) {
  const groups = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload]
    .flatMap((payload) => [payload?.['cognito:groups'], payload?.groups])
    .flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .map((value) => String(value).trim().toUpperCase());
  return { canModerate: groups.some((value) => ['ADMIN', 'SUPER_ADMIN'].includes(value)) };
}

export const commerceText = (locale, english, french) => String(locale).startsWith('fr') ? french : english;
export const commerceLabel = (value) => String(value || '—').toLowerCase().split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
export function commerceMoney(amount, currency, locale = 'en') {
  if (amount == null || amount === '') return '—';
  if (!Number.isFinite(Number(amount))) return `${amount} ${currency || ''}`.trim();
  try { return new Intl.NumberFormat(String(locale).startsWith('fr') ? 'fr-FR' : 'en-US', { style: 'currency', currency: currency || 'USD' }).format(Number(amount)); }
  catch { return `${amount} ${currency || ''}`.trim(); }
}

export function commercePage(response) {
  if (Array.isArray(response)) return { rows: response, totalElements: response.length, totalPages: 1 };
  if (!Array.isArray(response?.content)) throw new Error('The catalogue response could not be read. Refresh to try again.');
  const page = response.page || response;
  return { rows: response.content, totalElements: Number.isFinite(page.totalElements) ? page.totalElements : null, totalPages: Number.isFinite(page.totalPages) ? page.totalPages : null };
}

export function commerceUrl(value) {
  const text = String(value || '').trim();
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  try { const url = new URL(text); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}

export const productImages = (product) => [...new Set([product?.imageUrl, product?.image1, product?.image2, product?.image3, product?.image4, product?.videoThumbnailUrl].map(commerceUrl).filter(Boolean))];
export const storeDeleted = (store) => Boolean(store?.deleted || store?.isDeleted || store?.deletedAt || store?.deleted_at || String(store?.status).toUpperCase() === 'ARCHIVED');
export const publicStorefront = (store) => store?.status === 'ACTIVE' && store?.visibility === 'PUBLIC' && !storeDeleted(store);
export const storefrontProduct = (product) => product?.status === 'ACTIVE' && product?.storefrontEnabled === true;

// Approval is independent of verification and of the seller's marketplace opt-in.
export function productDiscovery(product, locale = 'en') {
  const t = (en, fr) => commerceText(locale, en, fr);
  if (product?.marketplaceApproved !== true) return { tone: 'warning', label: t('Not approved', 'Non approuvé'), detail: t('Not allowed on the marketplace', 'Non autorisé sur la marketplace') };
  if (product?.marketplaceEnabled !== true) return { tone: 'neutral', label: t('Approved · seller opted out', 'Approuvé · désactivé par le vendeur'), detail: t('The seller has not enabled marketplace discovery', 'Le vendeur n’a pas activé la découverte marketplace') };
  if (product?.status !== 'ACTIVE') return { tone: 'neutral', label: t('Approved · not active', 'Approuvé · inactif'), detail: t('The product must be active to be discovered', 'Le produit doit être actif pour être découvert') };
  return { tone: 'success', label: t('Approved', 'Approuvé'), detail: t('Store eligibility and marketplace settings still apply', 'L’éligibilité de la boutique et les réglages marketplace s’appliquent') };
}

export function productReviewQuery({ page = 0, size = 12, storeId, search = '', type = '', status = '', approval = '', storefront = false }) {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (storeId != null) query.set('storeId', String(storeId));
  if (search.trim()) query.set('search', search.trim());
  if (type) query.set('type', type);
  if (storefront) { query.set('status', 'ACTIVE'); query.set('storefrontEnabled', 'true'); }
  else if (status) query.set('status', status);
  if (approval === 'approved' || approval === 'unapproved') query.set('marketplaceApproved', String(approval === 'approved'));
  return query;
}

export function assertProductScope(rows, storeId) {
  if (storeId != null && rows.some((row) => String(row.storeId) !== String(storeId))) throw new Error('The backend did not return products scoped to this store. Update the backend before moderating this view.');
}

export function commerceTabKey(event, values, current, select) {
  let index = values.indexOf(current);
  if (event.key === 'ArrowRight') index = (index + 1) % values.length;
  else if (event.key === 'ArrowLeft') index = (index - 1 + values.length) % values.length;
  else if (event.key === 'Home') index = 0;
  else if (event.key === 'End') index = values.length - 1;
  else return;
  event.preventDefault();
  select(values[index]);
  event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[index]?.focus();
}
