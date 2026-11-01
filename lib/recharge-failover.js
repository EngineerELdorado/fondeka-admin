import { failoverInstant, failoverFingerprint } from '@/lib/payout-failover';

const PROVIDERS = ['RELOADLY', 'ZENDIT'];
const TYPES = ['AIRTIME', 'DATA', 'BUNDLE'];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, allowed, label) => {
  if (!object(value) || Object.keys(value).some((key) => !allowed.includes(key))) throw new Error(label + ' is unavailable or contains unsupported fields.');
};
const integer = (value, label, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const number = typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error(label + ' must be an integer from ' + min + ' to ' + max + '.');
  return number;
};
const bool = (value, label) => {
  if (typeof value !== 'boolean') throw new Error(label + ' must be a Boolean.');
  return value;
};
// Approval cost comparisons use decimal integers, never floating point math.
function decimal(value, label, positive = false) {
  const text = String(value ?? '').trim();
  if (text.length > 256 || !/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)) throw new Error(label + ' must be a nonnegative decimal amount.');
  const [mantissa, exponent = '0'] = text.toLowerCase().split('e');
  const power = Number(exponent);
  if (!Number.isSafeInteger(power) || Math.abs(power) > 1000) throw new Error(label + ' is out of range.');
  const parts = mantissa.split('.');
  let coefficient = BigInt(parts.join('')), scale = (parts[1]?.length || 0) - power;
  if (scale < 0) { coefficient *= 10n ** BigInt(-scale); scale = 0; }
  if (positive && coefficient === 0n) throw new Error(label + ' must be positive.');
  return { coefficient, scale };
}
function scaled(values) {
  const scale = Math.max(...values.map((value) => value.scale));
  return values.map((value) => value.coefficient * 10n ** BigInt(scale - value.scale));
}
export function rechargeCapabilities(value) {
  if (!object(value) || value.maximumAttempts !== 2 || value.productApprovalRequired !== true || !Array.isArray(value.productTypes) || !value.productTypes.every((type) => TYPES.includes(type)) || !Array.isArray(value.priceTypes) || !value.priceTypes.includes('FIXED') || value.funding !== 'EXISTING_WALLET_DEBIT'
    || !object(value.rejectionCodes) || !PROVIDERS.every((provider) => Array.isArray(value.rejectionCodes[provider]) && value.rejectionCodes[provider].every((code) => typeof code === 'string' && code.trim()))) throw new Error('Recharge failover capabilities are unavailable. Deploy the compatible backend and refresh.');
  return value;
}
export const rechargeCodes = (capabilities, provider) => capabilities?.rejectionCodes?.[provider] || [];
export function rechargeInspectionRequest(input, capabilities) {
  const country = String(input.country || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('Country must be an ISO alpha-2 code.');
  if (!capabilities.productTypes.includes(input.type)) throw new Error('Choose a supported product type.');
  if (!PROVIDERS.includes(input.provider)) throw new Error('Choose RELOADLY or ZENDIT.');
  decimal(input.amount, 'Fixed supplier amount', true);
  const amount = String(input.amount).trim();
  return { country, type: input.type, provider: input.provider, amount, ...(input.provider === 'RELOADLY'
    ? { operatorId: integer(input.operatorId, 'Reloadly operator ID') }
    : { offerId: (() => { const id = String(input.offerId || '').trim(); if (!id) throw new Error('Zendit offer ID is required.'); return id; })() }) };
}
export function rechargeProduct(product) {
  keys(product, ['provider', 'operatorId', 'offerId', 'amount', 'currency', 'deliveredAmount', 'deliveredCurrency', 'fingerprint'], 'Inspected product');
  if (!PROVIDERS.includes(product.provider) || typeof product.currency !== 'string' || !product.currency.trim() || typeof product.fingerprint !== 'string' || !product.fingerprint.trim()) throw new Error('A complete inspected product and approval fingerprint are required.');
  decimal(product.amount, 'Inspected supplier amount', true);
  if (product.provider === 'RELOADLY') integer(product.operatorId, 'Reloadly operator ID');
  else if (typeof product.offerId !== 'string' || !product.offerId.trim()) throw new Error('Zendit offer ID is required.');
  if (product.deliveredAmount != null) decimal(product.deliveredAmount, 'Delivered amount');
  if (product.deliveredCurrency != null && typeof product.deliveredCurrency !== 'string') throw new Error('Delivered currency must be text.');
  return JSON.parse(JSON.stringify(product));
}
export function rechargeInspectionResource(response, request) {
  const product = rechargeProduct(response?.product);
  if (!object(response.terms) || typeof response.reviewRequired !== 'string') throw new Error('The backend did not return current catalog terms and review instructions.');
  const [actual, wanted] = scaled([decimal(product.amount, 'Amount'), decimal(request.amount, 'Amount')]);
  if (product.provider !== request.provider || actual !== wanted || (request.provider === 'RELOADLY' ? String(product.operatorId) !== String(request.operatorId) : product.offerId !== request.offerId)) throw new Error('The inspected product does not match the requested identity.');
  return { product, terms: response.terms, reviewRequired: response.reviewRequired, requestKey: failoverFingerprint(request) };
}
export function rechargeRule(rule, capabilities = null, { active = false, now = Date.now() } = {}) {
  keys(rule, ['id', 'enabled', 'country', 'type', 'source', 'target', 'networkIdentity', 'benefitsReview', 'expiresAt', 'maxAdditionalCost', 'failureCodes'], 'Mapping');
  if (typeof rule.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(rule.id)) throw new Error('Each mapping needs a stable ID of up to 64 letters, numbers, _ or -.');
  bool(rule.enabled, 'Mapping enabled');
  if (!/^[A-Z]{2}$/.test(rule.country) || !(capabilities?.productTypes || TYPES).includes(rule.type)) throw new Error('A supported country and AIRTIME, DATA or BUNDLE type are required.');
  const source = rechargeProduct(rule.source), target = rechargeProduct(rule.target);
  if (source.provider === target.provider) throw new Error('Source and target must be distinct providers.');
  if (source.currency !== target.currency) throw new Error('Source and target supplier currencies must match.');
  const [sourceCost, targetCost, ceiling] = scaled([decimal(source.amount, 'Source amount'), decimal(target.amount, 'Target amount'), decimal(rule.maxAdditionalCost, 'Maximum additional supplier cost')]);
  if (targetCost - sourceCost > ceiling) throw new Error('Target supplier cost exceeds the approved additional-cost ceiling.');
  if (rule.type === 'AIRTIME') {
    if (source.deliveredAmount == null || target.deliveredAmount == null || !source.deliveredCurrency || source.deliveredCurrency !== target.deliveredCurrency) throw new Error('Airtime must deliver the same amount and currency.');
    const [left, right] = scaled([decimal(source.deliveredAmount, 'Delivered amount'), decimal(target.deliveredAmount, 'Delivered amount')]);
    if (left !== right) throw new Error('Airtime delivered amounts must match exactly.');
  }
  if (typeof rule.networkIdentity !== 'string' || !rule.networkIdentity.trim() || rule.networkIdentity.length > 200) throw new Error('Identify the same real network (1–200 characters).');
  if (typeof rule.benefitsReview !== 'string' || rule.benefitsReview.trim().length < 20 || rule.benefitsReview.length > 4000) throw new Error('Record the benefits review in 20–4,000 characters.');
  failoverInstant(rule.expiresAt, 'Approval expiry');
  if (active && rule.enabled && Date.parse(rule.expiresAt) <= now) throw new Error('Enabled mappings require unexpired approval.');
  if (!Array.isArray(rule.failureCodes) || !rule.failureCodes.length || rule.failureCodes.some((code) => typeof code !== 'string' || !code || capabilities && !rechargeCodes(capabilities, source.provider).includes(code))) throw new Error('Choose executable failure codes for the source provider from capabilities.');
  return { ...rule, source, target, failureCodes: [...new Set(rule.failureCodes)] };
}
export function rechargeConfiguration(value, capabilities = null, options = {}) {
  keys(value, ['enabled', 'createdAfter', 'accountIds', 'rules'], 'Configuration');
  const enabled = bool(value.enabled, 'Configured switch');
  const createdAfter = value.createdAfter == null || value.createdAfter === '' ? null : failoverInstant(value.createdAfter, 'Cutover');
  const ids = typeof value.accountIds === 'string' ? value.accountIds.trim() ? value.accountIds.split(/[,\n]/).map((id) => id.trim()) : [] : value.accountIds;
  if (!Array.isArray(ids) || ids.length > 1000) throw new Error('Use at most 1,000 rollout account IDs.');
  const accountIds = [...new Set(ids.map((id) => integer(id, 'Account ID')))];
  if (!Array.isArray(value.rules) || value.rules.length > 100) throw new Error('Use at most 100 ordered mappings.');
  const rules = value.rules.map((rule) => rechargeRule(rule, capabilities, { ...options, active: options.saved ? false : enabled }));
  if (new Set(rules.map((rule) => rule.id)).size !== rules.length) throw new Error('Mapping IDs must be unique.');
  if (!options.saved && enabled && (!createdAfter || !rules.some((rule) => rule.enabled))) throw new Error('An enabled policy requires a cutover and an enabled mapping.');
  return { enabled, createdAfter, accountIds, rules };
}
export function rechargeResource(response) {
  if (!object(response)) throw new Error('Saved recharge policy is unavailable.');
  const revision = integer(response.revision, 'Revision', 0); bool(response.emergencyDisabled, 'Emergency switch');
  if (response.cutoverFloor != null) failoverInstant(response.cutoverFloor, 'Cutover floor');
  return { ...response, revision, configuration: rechargeConfiguration(response.configuration, null, { saved: true }) };
}
export const rechargeDraft = (configuration) => ({ ...JSON.parse(JSON.stringify(configuration)), accountIds: configuration.accountIds.join(', ') });
export function rechargeDecimalText(value) {
  if (value == null) return '—';
  const text = String(value), match = text.match(/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match || Math.abs(Number(match[4] || 0)) > 1000) return text;
  const digits = match[2] + (match[3] || ''), position = match[2].length + Number(match[4] || 0);
  const result = position <= 0 ? '0.' + '0'.repeat(-position) + digits : position >= digits.length ? digits + '0'.repeat(position - digits.length) : digits.slice(0, position) + '.' + digits.slice(position);
  return match[1] + result.replace(/^0+(?=\d)/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
export const rechargeInspectionInput = (product) => ({ provider: product?.provider || '', operatorId: product?.operatorId == null ? '' : String(product.operatorId), offerId: product?.offerId || '', amount: product?.amount == null ? '' : rechargeDecimalText(product.amount) });
export function rechargePreview(transactionId, configuration = null, capabilities = null) {
  return { transactionId: integer(transactionId, 'Transaction ID'), ...(configuration ? { configuration: rechargeConfiguration(configuration, capabilities) } : {}) };
}
export function rechargeQuery(filters = {}, page = 0, size = 20) {
  const query = new URLSearchParams({ page: String(integer(page, 'Page', 0)), size: String(integer(size, 'Page size', 1, 100)) });
  if (filters.transactionId !== '' && filters.transactionId != null) query.set('transactionId', integer(filters.transactionId, 'Transaction ID'));
  if (filters.conflicted !== '' && filters.conflicted != null) {
    if (![true, false, 'true', 'false'].includes(filters.conflicted)) throw new Error('Conflicted must be any, yes or no.');
    query.set('conflicted', String(filters.conflicted));
  }
  return query;
}
export function rechargeOperationResource(operation) {
  if (!object(operation) || !object(operation.purchase) || !Array.isArray(operation.attempts)) throw new Error('Managed recharge evidence is unavailable.');
  integer(operation.transactionId, 'Transaction ID'); integer(operation.currentAttempt, 'Current attempt');
  bool(operation.conflicted, 'Conflict state'); bool(operation.refundReserved, 'Refund reservation state');
  return operation;
}
