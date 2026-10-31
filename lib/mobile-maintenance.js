const policyKeys = new Set(['enabled', 'rules']);
const ruleKeys = new Set(['name', 'enabled', 'priority', 'titleEn', 'messageEn', 'titleFr', 'messageFr', 'targetAccountIds', 'audience', 'platforms', 'appVersionAtLeast', 'appVersionLessThan', 'includeMissingAppVersion', 'startAt', 'endAt']);
export const MAINTENANCE_AUDIENCE_LISTS = [
  ['countryIds', 'Country IDs', 'ids'], ['countryCodes', 'Country codes', 'codes'],
  ['deviceLanguages', 'Device languages', 'text'], ['kycStatuses', 'KYC statuses', 'text'],
  ['billProductIds', 'Bill product IDs', 'ids'], ['paymentMethodIds', 'Payment method IDs', 'ids'], ['paymentProviderIds', 'Payment provider IDs', 'ids'],
  ['transactionStatuses', 'Transaction statuses', 'text'], ['transactionServices', 'Transaction services', 'text'], ['transactionActions', 'Transaction actions', 'text']
];
export const MAINTENANCE_AUDIENCE_BOOLEANS = [
  ['hasCryptoWallets', 'Has crypto wallets', true], ['hasSavings', 'Has savings', true], ['hasGroupSavings', 'Has group savings', true],
  ['hasCards', 'Has cards'], ['hasLoans', 'Has loans', true], ['hasEsims', 'Has eSIMs'], ['hasPaymentRequests', 'Has payment requests'], ['hasCompletedTransactions', 'Has completed transactions']
];
export const MAINTENANCE_AUDIENCE_COUNTS = [
  ['minCompletedTransactions', 'Minimum completed transactions'], ['maxCompletedTransactions', 'Maximum completed transactions'],
  ['lastTransactionOlderThanDays', 'Last transaction older than (days)'], ['minTransactionsThisMonth', 'Minimum transactions this month'], ['maxTransactionsThisMonth', 'Maximum transactions this month']
];
const audienceKeys = new Set([...MAINTENANCE_AUDIENCE_LISTS, ...MAINTENANCE_AUDIENCE_BOOLEANS, ...MAINTENANCE_AUDIENCE_COUNTS].map(([key]) => key).concat(['accountCreatedFrom', 'accountCreatedTo']));
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const unknownKeys = (value, allowed, label) => {
  if (!object(value)) throw new Error(`${label} must be an object.`);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`${label} has unsupported fields: ${unknown.join(', ')}.`);
};
const plainText = (value, max, label) => {
  if (typeof value !== 'string') throw new Error(`${label} must be plain text.`);
  if (value.length > max) throw new Error(`${label} must be ${max.toLocaleString()} characters or fewer.`);
  if (/<\/?[a-z][^>]*>/i.test(value)) throw new Error(`${label} must use plain text without markup.`);
  return value;
};
const integer = (value, label, min = 0) => {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < min) throw new Error(`${label} must be an integer of ${min} or greater.`);
  return number;
};
const list = (value, type, label, draft) => {
  if (draft && typeof value === 'string' && !value.trim()) return undefined;
  const values = draft && typeof value === 'string' ? value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean) : value;
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${label} must contain at least one entry; leave it blank for unrestricted selection.`);
  if (values.length > 1000) throw new Error(`${label} supports at most 1,000 entries.`);
  const result = values.map((item) => {
    if (type === 'ids') return integer(item, label, 1);
    if (typeof item !== 'string' || !item.trim()) throw new Error(`${label} entries must be nonempty text.`);
    return type === 'codes' ? item.trim().toUpperCase() : item.trim();
  });
  return [...new Set(result)];
};
const date = (value, label) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error(`${label} must be a valid YYYY-MM-DD date.`);
  return value;
};
const instant = (value, label, draft) => {
  if (typeof value !== 'string') throw new Error(`${label} must be an ISO-8601 instant.`);
  const utc = draft && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value) ? `${value.length === 16 ? `${value}:00` : value}Z` : value;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(utc) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(utc) || !Number.isFinite(Date.parse(utc))) throw new Error(`${label} must be a valid ISO-8601 instant.`);
  date(utc.slice(0, 10), label);
  return utc;
};
const instantOrder = (value) => BigInt(Date.parse(value)) * 1000000n + BigInt((value.match(/T\d{2}:\d{2}:\d{2}\.(\d+)/)?.[1] || '').padEnd(9, '0').slice(3, 9) || 0);
const version = (value, label) => {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)*$/.test(value.trim())) throw new Error(`${label} must be a numeric version such as 1.2.3.`);
  return value.trim();
};
const compareVersions = (a, b) => {
  const left = a.split('.'), right = b.split('.');
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const x = BigInt(left[i] || 0), y = BigInt(right[i] || 0);
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};

export function maintenancePolicyPayload(policy, { draft = true } = {}) {
  unknownKeys(policy, policyKeys, 'Policy');
  if (typeof policy.enabled !== 'boolean') throw new Error('Policy enabled must be a Boolean.');
  if (!Array.isArray(policy.rules) || policy.rules.length > 50) throw new Error('Policy rules must be a list of at most 50 rules.');
  const rules = policy.rules.map((rule, index) => {
    const label = `Rule ${index + 1}`;
    unknownKeys(rule, ruleKeys, label);
    if (typeof rule.enabled !== 'boolean') throw new Error(`${label} enabled must be a Boolean.`);
    const result = { enabled: rule.enabled, priority: rule.priority == null || rule.priority === '' ? 0 : integer(rule.priority, `${label} priority`, -2147483648) };
    for (const key of ['name', 'titleEn', 'titleFr', 'messageEn', 'messageFr']) {
      if (rule[key] != null) result[key] = plainText(rule[key], key.startsWith('title') ? 200 : key.startsWith('message') ? 4000 : Infinity, `${label} ${key}`);
    }
    if (rule.targetAccountIds !== undefined) {
      const ids = list(rule.targetAccountIds, 'ids', `${label} target account IDs`, draft);
      if (ids) result.targetAccountIds = ids;
    }
    if (rule.audience !== undefined) {
      unknownKeys(rule.audience, audienceKeys, `${label} audience`);
      if (Object.keys(rule.audience).length === 0) throw new Error(`${label} audience has no filters; remove it for unrestricted selection.`);
      const audience = {};
      for (const [key, title, type] of MAINTENANCE_AUDIENCE_LISTS) {
        if (rule.audience[key] !== undefined) {
          const values = list(rule.audience[key], type, `${label} ${title}`, draft);
          if (values) audience[key] = values;
        }
      }
      for (const [key, title] of MAINTENANCE_AUDIENCE_BOOLEANS) {
        const value = rule.audience[key];
        if (draft && value === '') continue;
        if (value !== undefined) {
          if (typeof value !== 'boolean') throw new Error(`${label} ${title} must be a Boolean.`);
          audience[key] = value;
        }
      }
      for (const [key, title] of MAINTENANCE_AUDIENCE_COUNTS) {
        const value = rule.audience[key];
        if (draft && value === '') continue;
        if (value !== undefined) audience[key] = integer(value, `${label} ${title}`);
      }
      for (const key of ['accountCreatedFrom', 'accountCreatedTo']) {
        const value = rule.audience[key];
        if (draft && value === '') continue;
        if (value !== undefined) audience[key] = date(value, `${label} ${key}`);
      }
      for (const [min, max] of [['minCompletedTransactions', 'maxCompletedTransactions'], ['minTransactionsThisMonth', 'maxTransactionsThisMonth'], ['accountCreatedFrom', 'accountCreatedTo']]) {
        if (audience[min] !== undefined && audience[max] !== undefined && audience[min] > audience[max]) throw new Error(`${label} ${min} must not exceed ${max}.`);
      }
      if (Object.keys(audience).length) result.audience = audience;
    }
    if (rule.platforms !== undefined) {
      if (!Array.isArray(rule.platforms) || rule.platforms.some((item) => item !== 'ios' && item !== 'android')) throw new Error(`${label} platforms must contain ios and/or android.`);
      if (rule.platforms.length) result.platforms = [...new Set(rule.platforms)];
    }
    for (const key of ['appVersionAtLeast', 'appVersionLessThan']) if (rule[key] !== undefined && !(draft && rule[key] === '')) result[key] = version(rule[key], `${label} ${key}`);
    if (result.appVersionAtLeast && result.appVersionLessThan && compareVersions(result.appVersionAtLeast, result.appVersionLessThan) >= 0) throw new Error(`${label} minimum version must be below its exclusive maximum.`);
    if (rule.includeMissingAppVersion !== undefined) {
      if (typeof rule.includeMissingAppVersion !== 'boolean') throw new Error(`${label} includeMissingAppVersion must be a Boolean.`);
      result.includeMissingAppVersion = rule.includeMissingAppVersion;
    }
    for (const key of ['startAt', 'endAt']) if (rule[key] !== undefined && !(draft && rule[key] === '')) result[key] = instant(rule[key], `${label} ${key}`, draft);
    if (result.startAt && result.endAt && instantOrder(result.startAt) >= instantOrder(result.endAt)) throw new Error(`${label} start must precede its exclusive end.`);
    return result;
  });
  return { enabled: policy.enabled, rules };
}

export function maintenancePolicyFingerprint(value) {
  const stable = (item) => Array.isArray(item) ? item.map(stable) : object(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, stable(item[key])])) : item;
  return JSON.stringify(stable(value));
}

export function newMaintenanceRule() {
  return {
    name: 'App maintenance', enabled: true, priority: 0,
    titleEn: 'A moment for maintenance', messageEn: 'We’re carrying out maintenance on Fondeka.\nThank you for your patience. Please check again later.',
    titleFr: 'Une pause pour maintenance', messageFr: 'Une maintenance est en cours sur Fondeka.\nMerci pour votre patience. Veuillez réessayer plus tard.'
  };
}

export const maintenanceListText = (value) => Array.isArray(value) ? value.join(', ') : value ?? '';
export const maintenanceUtcInput = (value) => value && Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? new Date(value).toISOString().slice(0, 19) : value || '';

export const MAINTENANCE_TRANSACTION_SERVICES = ['WALLET', 'BILL_PAYMENTS', 'LENDING', 'CARD', 'CRYPTO', 'COMMERCE', 'PAYMENT_REQUEST', 'E_SIM', 'AIRTIME_AND_DATA', 'OTHER'];

export const MAINTENANCE_TRANSACTION_ACTIONS = [
  'BUY_CARD',
  'BUY_CRYPTO',
  'CONVERT_FIAT',
  'BUY_GIFT_CARD',
  'E_SIM_PURCHASE',
  'E_SIM_TOPUP',
  'FUND_CARD',
  'FUND_WALLET',
  'INTER_TRANSFER',
  'LOAN_DISBURSEMENT',
  'LOAN_REQUEST',
  'PAY_ELECTRICITY_BILL',
  'PAY_INTERNET_BILL',
  'PAY_REQUEST',
  'COMMERCE_CHECKOUT_PAYMENT',
  'CREATE_COMMERCE_STORE',
  'PAY_TV_SUBSCRIPTION',
  'PAY_WATER_BILL',
  'CARD_PAYMENT_REVERSAL',
  'RECEIVE_CRYPTO',
  'REPAY_LOAN',
  'SELL_CRYPTO',
  'SEND_AIRTIME',
  'SEND_DATA_BUNDLES',
  'SEND_CRYPTO',
  'SETTLEMENT',
  'SWAP_CRYPTO',
  'WITHDRAW_FROM_CARD',
  'PERSONAL_SAVING_DEPOSIT',
  'PERSONAL_SAVING_WITHDRAWAL',
  'PERSONAL_SAVING_INTEREST_PAYOUT',
  'GROUP_SAVING_CONTRIBUTION',
  'GROUP_SAVING_PAYOUT',
  'GROUP_SAVING_ROUND_DISTRIBUTION',
  'WITHDRAW_FROM_WALLET'
].sort();
