export const contactAudienceGroups = [
  ['Country, language and KYC', [
    ['countryCodes', 'Country codes', 'list', 'CD, RW'], ['countryIds', 'Country IDs', 'ids', '1, 2'],
    ['deviceLanguages', 'Device languages', 'list', 'fr, en'], ['kycStatuses', 'KYC statuses', 'list', 'APPROVED, NONE']
  ]],
  ['Account creation', [['accountCreatedFrom', 'Created from (UTC)', 'date'], ['accountCreatedTo', 'Created through (UTC)', 'date']]],
  ['Products owned', [
    ['hasCryptoWallets', 'Has crypto wallets', 'boolean'], ['hasSavings', 'Has savings', 'boolean'],
    ['hasGroupSavings', 'Has active group savings', 'boolean'], ['hasCards', 'Has active cards', 'boolean'],
    ['hasLoans', 'Has loans', 'boolean'], ['hasEsims', 'Has eSIMs', 'boolean'], ['hasPaymentRequests', 'Has payment requests', 'boolean']
  ]],
  ['Transactions and activity', [
    ['hasCompletedTransactions', 'Has completed transactions', 'boolean'],
    ['minCompletedTransactions', 'Min completed transactions', 'number'], ['maxCompletedTransactions', 'Max completed transactions', 'number'],
    ['lastTransactionOlderThanDays', 'Last transaction older than (days)', 'number'],
    ['minTransactionsThisMonth', 'Min transactions this month', 'number'], ['maxTransactionsThisMonth', 'Max transactions this month', 'number']
  ]],
  ['Transaction attributes', [
    ['billProductIds', 'Bill products', 'ids'], ['paymentMethodIds', 'Payment methods', 'ids'], ['paymentProviderIds', 'Payment provider IDs', 'ids'],
    ['transactionStatuses', 'Transaction statuses', 'list', 'COMPLETED, FAILED'],
    ['transactionServices', 'Transaction services', 'list', 'COMMERCE, BUSINESS_API'], ['transactionActions', 'Transaction actions', 'list', 'COMMERCE_CHECKOUT_PAYMENT']
  ]]
];
export const contactAudienceFields = contactAudienceGroups.flatMap(([, fields]) => fields);
export const emptyContactAudience = () => Object.fromEntries(contactAudienceFields.map(([key]) => [key, '']));
export const canExportContacts = (session) => {
  const access = session?.tokens?.accessToken?.payload || {}, id = session?.tokens?.idToken?.payload || {};
  return [access['cognito:groups'], access.groups, id['cognito:groups'], id.groups]
    .flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(String(role).trim().toUpperCase()));
};
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const isContactExportId = (value) => typeof value === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value);

export function contactExportFields(resource) {
  const fields = resource?.availableFields, defaults = resource?.defaultFields;
  if (!Array.isArray(fields) || !fields.length || fields.some((field) => !field || typeof field.name !== 'string' || !field.name || typeof field.label !== 'string' || !field.label || !['text', 'number', 'boolean', 'datetime'].includes(field.type))
    || new Set(fields.map((field) => field.name)).size !== fields.length || !Array.isArray(defaults) || !defaults.length || new Set(defaults).size !== defaults.length || defaults.some((name) => !fields.some((field) => field.name === name))) {
    throw new Error('Export columns are unavailable. Refresh to load the supported fields.');
  }
  return { availableFields: fields, defaultFields: defaults };
}

export function contactExportAudience(filters = {}) {
  if (!object(filters) || Object.keys(filters).some((key) => !contactAudienceFields.some(([name]) => key === name))) throw new Error('Unsupported audience filter.');
  const audience = {};
  for (const [key, label, kind] of contactAudienceFields) {
    const input = filters[key];
    if (input == null || input === '') continue;
    if (kind === 'ids' || kind === 'list') {
      if (!Array.isArray(input) && typeof input !== 'string') throw new Error(label + ' must be a list.');
      if (typeof input === 'string' && !input.trim()) continue;
      const values = Array.isArray(input) ? input : input.split(/,\s*|\r?\n/).map((value) => value.trim());
      if (!values.length) continue;
      if (values.length > 1000) throw new Error(label + ' must contain at most 1,000 entries.');
      if (kind === 'ids') {
        if (values.some((value) => !['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0)) throw new Error(label + ' must contain positive integer IDs.');
        audience[key] = [...new Set(values.map(Number))];
      } else {
        if (values.some((value) => typeof value !== 'string' || !value.trim() || /[\0\r\n]/.test(value))) throw new Error(label + ' cannot contain blank entries.');
        const list = values.map((value) => value.trim());
        if (key === 'countryCodes' && list.some((value) => !/^[a-z]{2}$/i.test(value))) throw new Error('Country codes must be two-letter ISO codes.');
        audience[key] = [...new Set(key === 'countryCodes' ? list.map((value) => value.toUpperCase()) : list)];
      }
      continue;
    }
    if (!['string', 'number', 'boolean'].includes(typeof input)) throw new Error(label + ' has an invalid value.');
    const raw = String(input).trim();
    if (!raw) continue;
    if (kind === 'boolean') {
      if (!['true', 'false'].includes(raw)) throw new Error(label + ' must be Any, Yes or No.');
      audience[key] = raw === 'true';
    } else if (kind === 'date') {
      const parsed = new Date(raw + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw.startsWith('0000') || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) throw new Error(label + ' must be a valid date between years 1 and 9999.');
      audience[key] = raw;
    } else {
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > 2147483647) throw new Error(label + ' must be a nonnegative integer.');
      audience[key] = Number(raw);
    }
  }
  for (const [min, max] of [['minCompletedTransactions', 'maxCompletedTransactions'], ['minTransactionsThisMonth', 'maxTransactionsThisMonth'], ['accountCreatedFrom', 'accountCreatedTo']]) {
    if (audience[min] != null && audience[max] != null && audience[min] > audience[max]) throw new Error(min + ' must not exceed ' + max + '.');
  }
  return audience;
}

export function contactExportPayload(fields, catalog, filters) {
  if (!Array.isArray(fields) || !fields.length || new Set(fields).size !== fields.length || fields.some((name) => !catalog?.availableFields?.some((field) => field.name === name))) throw new Error('Select at least one supported column, without duplicates.');
  return { fields: [...fields], audience: contactExportAudience(filters) };
}

export function contactExportJob(resource, expectedId = null) {
  if (!object(resource) || !isContactExportId(resource.jobId) || expectedId && resource.jobId.toLowerCase() !== expectedId.toLowerCase()
    || !['QUEUED', 'RUNNING', 'READY', 'FAILED', 'EXPIRED'].includes(resource.status)
    || !Number.isSafeInteger(resource.rowCount) || resource.rowCount < 0
    || !Array.isArray(resource.fields) || !resource.fields.length || resource.fields.some((field) => typeof field !== 'string')
    || ['createdAt', 'updatedAt', 'expiresAt'].some((key) => !Number.isFinite(Date.parse(resource[key])))) throw new Error('The backend returned an unavailable export status. Refresh before continuing.');
  return resource;
}

export function contactExportDownload(job, now = Date.now()) {
  if (job?.status !== 'READY' || Date.parse(job.expiresAt) <= now || !Number.isFinite(Date.parse(job.expiresAt)) || !Number.isFinite(Date.parse(job.downloadUrlExpiresAt)) || Date.parse(job.downloadUrlExpiresAt) <= now) return null;
  try {
    const url = new URL(job.downloadUrl);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
