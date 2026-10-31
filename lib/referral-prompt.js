export const referralPromptAudienceFields = [
  ['countryCodes', 'Country codes', 'list', 'CD, RW'], ['countryIds', 'Country IDs', 'ids', '1, 2'],
  ['deviceLanguages', 'Device languages', 'list', 'fr, en'], ['kycStatuses', 'KYC statuses', 'list', 'APPROVED, NONE'],
  ['hasCompletedTransactions', 'Has completed transactions', 'boolean'],
  ['minCompletedTransactions', 'Min completed transactions', 'number'], ['maxCompletedTransactions', 'Max completed transactions', 'number'],
  ['lastTransactionOlderThanDays', 'Last transaction older than (days)', 'positive'],
  ['minTransactionsThisMonth', 'Min transactions this month', 'number'], ['maxTransactionsThisMonth', 'Max transactions this month', 'number'],
  ['accountCreatedFrom', 'Account created from (UTC)', 'date'], ['accountCreatedTo', 'Account created to (UTC)', 'date'],
  ['hasCryptoWallets', 'Has crypto wallets', 'boolean'], ['hasSavings', 'Has savings', 'boolean'],
  ['hasGroupSavings', 'Has group savings', 'boolean'], ['hasCards', 'Has cards', 'boolean'],
  ['hasLoans', 'Has loans', 'boolean'], ['hasEsims', 'Has eSIMs', 'boolean'], ['hasPaymentRequests', 'Has payment requests', 'boolean'],
  ['billProductIds', 'Bill product IDs', 'ids'], ['paymentMethodIds', 'Payment method IDs', 'ids'], ['paymentProviderIds', 'Payment provider IDs', 'ids'],
  ['transactionStatuses', 'Transaction statuses', 'list', 'COMPLETED'], ['transactionServices', 'Transaction services', 'list', 'CARD, COMMERCE'],
  ['transactionActions', 'Transaction actions', 'list', 'BUY_CARD, COMMERCE_CHECKOUT_PAYMENT']
];

const text = (value) => typeof value === 'string' ? value : '';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const configurationFields = new Set(['enabled', 'campaignId', 'titleEn', 'titleFr', 'messageEn', 'messageFr', 'audience', 'targetAccountIds']);
const audienceKeys = new Set(referralPromptAudienceFields.map(([key]) => key));

export const supportsReferralPrompt = (campaign) => Boolean(campaign && Object.hasOwn(campaign, 'referralPrompt') && (campaign.referralPrompt === null || object(campaign.referralPrompt)));

function checkKeys(value, keys, label) {
  if (!object(value)) throw new Error(label + ' must be an object.');
  const unknown = Object.keys(value).filter((key) => !keys.has(key));
  if (unknown.length) throw new Error(label + ' contains unsupported fields: ' + unknown.join(', ') + '. Update the dashboard before editing.');
}

function validateList(values, label, ids = false) {
  if (values.length > 1000) throw new Error(label + ': maximum 1,000 entries.');
  if (ids && values.some((item) => !/^\d+$/.test(String(item)) || !Number.isSafeInteger(Number(item)) || Number(item) <= 0)) throw new Error(label + ' must contain positive integer IDs.');
  if (!ids && values.some((item) => typeof item !== 'string' || !item.trim() || /[\0\r\n]/.test(item))) throw new Error(label + ' cannot contain blank or invalid entries.');
  return [...new Set(ids ? values.map(Number) : values.map((value) => value.trim()))];
}

function list(value, label, ids = false) {
  if (Array.isArray(value)) return validateList(value, label, ids);
  if (value != null && typeof value !== 'string') throw new Error(label + ' must be a list.');
  const raw = text(value).trim();
  if (!raw) return [];
  // A comma may be followed by a line break, but blank entries cannot disappear silently.
  return validateList(raw.split(/,\s*|\r?\n/).map((item) => item.trim()), label, ids);
}

export function referralPromptDraft(policy) {
  if (policy != null) {
    checkKeys(policy, configurationFields, 'Saved popup configuration');
    if (policy.enabled != null && typeof policy.enabled !== 'boolean') throw new Error('Saved popup enabled must be a Boolean.');
    for (const key of ['campaignId', 'titleEn', 'titleFr', 'messageEn', 'messageFr']) {
      if (policy[key] != null && typeof policy[key] !== 'string') throw new Error('Saved ' + key + ' must be text.');
    }
    if (policy.targetAccountIds != null && (!Array.isArray(policy.targetAccountIds) || !policy.targetAccountIds.length)) throw new Error('Saved account IDs must be a nonempty list.');
    if (policy.targetAccountIds != null) validateList(policy.targetAccountIds, 'Saved account IDs', true);
    if (policy.audience != null) checkKeys(policy.audience, audienceKeys, 'Saved audience');
  }
  const filters = Object.fromEntries(referralPromptAudienceFields.map(([key, label, kind]) => {
    const value = policy?.audience?.[key];
    if (value == null) return [key, ''];
    if (kind === 'ids' || kind === 'list') {
      if (!Array.isArray(value)) throw new Error('Saved ' + label + ' must be a list.');
      if (value.length) validateList(value, label, kind === 'ids');
      return [key, value.join(', ')];
    }
    if (kind === 'boolean' && typeof value !== 'boolean') throw new Error('Saved ' + label + ' must be a Boolean.');
    if (['number', 'positive'].includes(kind) && typeof value !== 'number') throw new Error('Saved ' + label + ' must be a number.');
    if (kind === 'date' && typeof value !== 'string') throw new Error('Saved ' + label + ' must be a date.');
    return [key, String(value)];
  }));
  const hasFilters = Object.values(filters).some((value) => value !== '');
  if (policy?.audience != null && !hasFilters) throw new Error('Saved audience has no meaningful filters.');
  return {
    enabled: policy?.enabled === true, campaignId: text(policy?.campaignId),
    titleEn: text(policy?.titleEn), titleFr: text(policy?.titleFr), messageEn: text(policy?.messageEn), messageFr: text(policy?.messageFr),
    audienceMode: hasFilters || policy?.targetAccountIds?.length ? 'FILTERED' : 'ALL',
    targetAccountIds: Array.isArray(policy?.targetAccountIds) ? policy.targetAccountIds.join(', ') : '',
    filters
  };
}

export function referralPromptPayload(draft) {
  if (typeof draft.enabled !== 'boolean') throw new Error('Popup enabled must be a Boolean.');
  if (draft.campaignId != null && typeof draft.campaignId !== 'string') throw new Error('Campaign ID must be text.');
  const campaignId = text(draft.campaignId).trim();
  if (draft.enabled && !campaignId) throw new Error('A stable campaign ID is required when the popup is enabled.');
  if (campaignId && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(campaignId)) throw new Error('Campaign ID must use 1–128 letters, numbers, dots, underscores, colons or hyphens.');
  const policy = { enabled: draft.enabled, campaignId, audience: null, targetAccountIds: null };
  for (const field of ['titleEn', 'titleFr', 'messageEn', 'messageFr']) {
    if (draft[field] != null && typeof draft[field] !== 'string') throw new Error(field + ' must be text.');
    const value = text(draft[field]), limit = field.startsWith('title') ? 200 : 4000;
    if (value.length > limit || /<[^>]+>|\*\*|\x60\x60\x60|\[[^\]]+\]\([^)]*\)/s.test(value) || value.includes('\0')) throw new Error(field + ' must be plain text with at most ' + limit + ' characters.');
    policy[field] = value;
  }
  if (draft.audienceMode === 'ALL') return policy;
  if (draft.audienceMode !== 'FILTERED') throw new Error('Choose all users or a filtered audience.');
  checkKeys(draft.filters || {}, audienceKeys, 'Audience');
  const audience = {};
  for (const [key, label, kind] of referralPromptAudienceFields) {
    const input = draft.filters?.[key];
    if ((kind === 'list' || kind === 'ids') && Array.isArray(input)) {
      const values = list(input, label, kind === 'ids');
      if (values.length) audience[key] = key === 'countryCodes' ? values.map((value) => value.toUpperCase()) : values;
      continue;
    }
    if (input != null && !['string', 'number', 'boolean'].includes(typeof input)) throw new Error(label + ' has an invalid value.');
    const raw = input == null ? '' : String(input).trim();
    if (!raw) continue;
    if (kind === 'list' || kind === 'ids') {
      const values = list(raw, label, kind === 'ids');
      if (values.length) audience[key] = key === 'countryCodes' ? values.map((value) => value.toUpperCase()) : values;
    } else if (kind === 'boolean') {
      if (!['true', 'false'].includes(raw)) throw new Error(label + ' must be Any, Yes or No.');
      audience[key] = raw === 'true';
    } else if (kind === 'date') {
      const parsed = new Date(raw + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw || raw.startsWith('0000')) throw new Error(label + ' must be a valid date.');
      audience[key] = raw;
    } else {
      const value = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isInteger(value) || value > 2147483647 || value < (kind === 'positive' ? 1 : 0)) throw new Error(label + ' must be an integer >= ' + (kind === 'positive' ? 1 : 0) + '.');
      audience[key] = value;
    }
  }
  for (const [from, to] of [['minCompletedTransactions', 'maxCompletedTransactions'], ['minTransactionsThisMonth', 'maxTransactionsThisMonth'], ['accountCreatedFrom', 'accountCreatedTo']]) {
    if (audience[from] != null && audience[to] != null && audience[from] > audience[to]) throw new Error(from + ' must not exceed ' + to + '.');
  }
  const ids = list(draft.targetAccountIds, 'Account IDs', true);
  if (!Object.keys(audience).length && !ids.length) throw new Error('Choose at least one filter or account ID, or select all users.');
  policy.audience = Object.keys(audience).length ? audience : null;
  policy.targetAccountIds = ids.length ? ids : null;
  return policy;
}

export function referralPromptResource(campaign, expectedId) {
  if (!supportsReferralPrompt(campaign)) throw new Error('Invitation popup settings are unavailable. Deploy the updated backend and refresh.');
  if (campaign.id == null || String(campaign.id) !== String(expectedId)) throw new Error('The response does not match the selected referral campaign. Refresh before editing.');
  const draft = referralPromptDraft(campaign.referralPrompt);
  referralPromptPayload(draft);
  return { campaign, draft };
}

export function referralPromptFingerprint(value) {
  const stable = (item) => Array.isArray(item) ? [...item].map(stable).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    : object(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, stable(item[key])])) : item;
  return JSON.stringify(stable(value));
}
