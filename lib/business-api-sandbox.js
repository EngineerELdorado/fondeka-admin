export const SANDBOX_HISTORY_PATH = '/dashboard/business-api/sandbox-transactions';
export const SANDBOX_ACTIONS = ['BUSINESS_API_COLLECTION', 'BUSINESS_API_PAYOUT'];
export const SANDBOX_STATUSES = ['ACCEPTED', 'PROCESSING', 'COMPLETED', 'FAILED'];
export const SANDBOX_SCENARIOS = [
  'SUCCESS', 'INVALID_DESTINATION', 'INSUFFICIENT_FUNDS', 'PAYMENT_NOT_APPROVED',
  'CANCELED', 'EXPIRED', 'PENDING', 'PAYER_INSUFFICIENT_FUNDS', 'PROVIDER_UNAVAILABLE',
  'PAYMENT_EXPIRED', 'PAYMENT_CANCELLED', 'CRYPTO_INVOICE_EXPIRED', 'CRYPTO_ADDRESS_INVALID',
  'CRYPTO_NETWORK_UNAVAILABLE', 'CRYPTO_TRANSFER_REJECTED', 'CRYPTO_CONFIRMATIONS_PENDING'
];
export const emptySandboxFilters = {
  businessId: '', accountId: '', apiKeyId: '', action: '', status: '', scenario: '',
  currency: '', reference: '', orderReference: '', fromDate: '', toDate: ''
};
const maxDate = 253402300799999;
const text = (value) => String(value ?? '').trim();

export function canReadSandboxHistory(session) {
  const groups = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload]
    .flatMap((payload) => [payload?.['cognito:groups'], payload?.groups])
    .flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .map((group) => String(group).trim().toUpperCase());
  return groups.some((group) => ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT'].includes(group));
}

export function sandboxHistoryQuery(filters = {}, { page = 0, size = 20 } = {}) {
  const pageText = text(page), sizeText = text(size);
  if (!/^\d+$/.test(pageText) || !/^\d+$/.test(sizeText) || !Number.isSafeInteger(Number(pageText))
      || Number(sizeText) < 1 || Number(sizeText) > 100 || Number(pageText) * Number(sizeText) > 2147483647) {
    throw new Error('Page must be nonnegative, size must be 1–100, and the page offset must not exceed 2,147,483,647.');
  }
  const query = new URLSearchParams({ page: String(Number(pageText)), size: String(Number(sizeText)) });
  for (const key of ['businessId', 'accountId', 'apiKeyId']) {
    const value = text(filters[key]);
    if (!value) continue;
    if (!/^\d+$/.test(value) || BigInt(value) <= 0n || BigInt(value) > 9223372036854775807n) throw new Error(`${key} must be a positive ID.`);
    query.set(key, value);
  }
  for (const [key, choices] of [['action', SANDBOX_ACTIONS], ['status', SANDBOX_STATUSES], ['scenario', SANDBOX_SCENARIOS]]) {
    const value = text(filters[key]);
    if (!value) continue;
    if (!choices.includes(value)) throw new Error(`Choose a supported ${key}.`);
    query.set(key, value);
  }
  const currency = text(filters.currency).toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be a three-letter fiat code.');
  if (currency) query.set('currency', currency);
  for (const key of ['reference', 'orderReference']) {
    const value = text(filters[key]);
    if (value.length > 128) throw new Error(`${key} must not exceed 128 characters.`);
    if (value) query.set(key, value);
  }
  for (const key of ['fromDate', 'toDate']) {
    const value = text(filters[key]);
    if (!value) continue;
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maxDate) throw new Error('Creation dates must be Unix milliseconds from 1970 through 9999.');
    query.set(key, value);
  }
  if (query.has('fromDate') && query.has('toDate') && Number(query.get('fromDate')) > Number(query.get('toDate'))) throw new Error('From date must not follow to date.');
  return query;
}

export function sandboxFiltersFromSearch(search) {
  const params = new URLSearchParams(search);
  return Object.fromEntries(Object.keys(emptySandboxFilters).map((key) => [key, params.get(key) ?? '']));
}

export function sandboxHistoryHref(filters = {}) {
  const query = sandboxHistoryQuery(filters);
  query.delete('page'); query.delete('size');
  return `${SANDBOX_HISTORY_PATH}${query.size ? `?${query}` : ''}`;
}

export const sandboxPaymentHref = (reference) => `${SANDBOX_HISTORY_PATH}/${encodeURIComponent(reference)}`;

export function sandboxDateInput(epoch) {
  if (text(epoch) === '' || !/^\d+$/.test(text(epoch)) || Number(epoch) > maxDate) return '';
  return new Date(Number(epoch)).toISOString().slice(0, -1);
}

export function sandboxDateValue(input) {
  if (!input) return '';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(input)) throw new Error('Use a valid UTC date and time.');
  const date = new Date(`${input}Z`), epoch = date.getTime();
  if (!Number.isFinite(epoch) || epoch < 0 || epoch > maxDate || !date.toISOString().startsWith(input)) throw new Error('Use a valid UTC date and time from 1970 through 9999.');
  return String(epoch);
}

export function sandboxPaymentResource(resource, reference) {
  const payment = resource?.transaction;
  if (resource?.environment !== 'SANDBOX' || payment?.environment !== 'SANDBOX'
      || typeof payment.fondekaReference !== 'string' || !payment.fondekaReference
      || (reference !== undefined && payment.fondekaReference !== reference)
      || !SANDBOX_STATUSES.includes(payment.status) || !SANDBOX_ACTIONS.includes(payment.action)) {
    throw new Error('The sandbox payment response is unavailable or does not match the requested reference.');
  }
  return resource;
}

export function sandboxHistoryPage(resource, page, size) {
  // Spring's VIA_DTO serialization places pagination under `page`. Keep
  // supporting the flat Page shape used by older backend deployments too.
  const metadata = resource?.page ?? resource;
  if (!Array.isArray(resource?.content) || metadata?.number !== Number(page) || metadata?.size !== Number(size)
      || !Number.isInteger(metadata.totalPages) || metadata.totalPages < 0
      || !Number.isInteger(metadata.totalElements) || metadata.totalElements < 0) throw new Error('The sandbox history page is unavailable.');
  resource.content.forEach((row) => sandboxPaymentResource(row));
  return metadata === resource ? resource : {
    ...resource,
    number: metadata.number,
    size: metadata.size,
    totalPages: metadata.totalPages,
    totalElements: metadata.totalElements
  };
}
