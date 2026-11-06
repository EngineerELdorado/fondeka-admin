export const REFUND_CONTEXTS = ['PAYOUT', 'COLLECTION'];
export const REFUND_PAYMENT_PROVIDERS = ['FONDEKA', 'AVADAPAY', 'COINBASE', 'STRIPE', 'PAYPAL', 'BTCPAY_SERVER', 'CUSTOMIZED_BANK_PROVIDER', 'RELOADLY', 'UNIPAYMENT', 'ARAKAPAY', 'MAPLERAD', 'PAWAPAY'];
export const REFUND_BILL_PROVIDERS = ['CGAWEB', 'RELOADLY', 'RELOADLY_UTILITIES', 'ZENDIT', 'ARAKA_PAY', 'UMEME', 'DUMMY'];
export const REFUND_ACTIONS = ['FUND_WALLET', 'WITHDRAW_FROM_WALLET', 'REFUND_TO_WALLET', 'BONUS', 'MANUAL_ADJUSTMENT', 'PAY_INTERNET_BILL', 'PAY_TV_SUBSCRIPTION', 'PAY_ELECTRICITY_BILL', 'PAY_WATER_BILL', 'LOAN_REQUEST', 'LOAN_DISBURSEMENT', 'REPAY_LOAN', 'FUND_CARD', 'WITHDRAW_FROM_CARD', 'BUY_CARD', 'CARD_ONLINE_PAYMENT', 'CARD_PAYMENT_REVERSAL', 'CARD_MAINTENANCE', 'BUY_CRYPTO', 'SELL_CRYPTO', 'RECEIVE_CRYPTO', 'SEND_CRYPTO', 'SWAP_CRYPTO', 'CONVERT_FIAT', 'ORDER_BANK_ACCOUNT', 'REQUEST_PAYMENT', 'PAY_REQUEST', 'SETTLEMENT', 'BUSINESS_API_COLLECTION', 'BUSINESS_API_PAYOUT', 'BUSINESS_TOOLS_ACCESS', 'BUSINESS_TOOLS_PAYMENT_REQUESTS_ACCESS', 'BUSINESS_TOOLS_ONLINE_STORES_ACCESS', 'BUSINESS_TOOLS_POS_ACCESS', 'BUSINESS_TOOLS_API_ACCESS', 'E_SIM_PURCHASE', 'E_SIM_TOPUP', 'SEND_AIRTIME', 'SEND_DATA_BUNDLES', 'PERSONAL_SAVING_DEPOSIT', 'PERSONAL_SAVING_WITHDRAWAL', 'PERSONAL_SAVING_INTEREST_PAYOUT', 'GROUP_SAVING_CONTRIBUTION', 'GROUP_SAVING_TREASURY_CONTRIBUTION', 'GROUP_SAVING_TREASURY_WITHDRAWAL', 'GROUP_SAVING_PAYOUT', 'GROUP_SAVING_ROUND_DISTRIBUTION', 'BUY_GIFT_CARD', 'CREATE_COMMERCE_STORE', 'COMMERCE_CHECKOUT_PAYMENT', 'PAY_NETFLIX', 'INTER_TRANSFER', 'OTHER'];
export const REFUND_SELECTORS = ['contexts', 'actions', 'paymentProviders', 'billProviders', 'accountIds'];
const SELECTOR_OPTIONS = { contexts: REFUND_CONTEXTS, actions: REFUND_ACTIONS, paymentProviders: REFUND_PAYMENT_PROVIDERS, billProviders: REFUND_BILL_PROVIDERS };
export const refundLabel = (value) => String(value || '').toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
export function refundPermissions(session) {
  const roles = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload].flatMap((payload) => {
    const groups = payload?.['cognito:groups'] || payload?.groups || [];
    return (Array.isArray(groups) ? groups : String(groups).split(',')).map((role) => String(role).trim().toUpperCase());
  });
  return { canRead: roles.some((role) => ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT'].includes(role)), canWrite: roles.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role)) };
}
function enums(value, choices, label) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some((item) => !choices.includes(item))) throw new Error(`${label} contains an unsupported value.`);
  return [...new Set(value)].sort();
}
export function refundAccountIds(value) {
  const values = Array.isArray(value) ? value : value == null || String(value).trim() === '' ? [] : String(value).trim().split(/[,\s]+/);
  if (values.some((id) => !/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) throw new Error('Account IDs must be positive whole numbers.');
  return [...new Set(values.map(Number))].sort((a, b) => a - b);
}
export function normalizeRefundRules(value) {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Use at most 100 automatic-refund rules.');
  const names = new Set();
  return value.map((rule, index) => {
    const name = typeof rule?.name === 'string' ? rule.name.trim() : '';
    if (!name || name.length > 100) throw new Error(`Rule ${index + 1} needs a name of at most 100 characters.`);
    if (names.has(name)) throw new Error(`Rule names must be unique: ${name}.`);
    names.add(name);
    if (!['ALLOW', 'BLOCK'].includes(rule.decision)) throw new Error(`Choose ALLOW or BLOCK for ${name}.`);
    return { name, decision: rule.decision, ...Object.fromEntries(Object.entries(SELECTOR_OPTIONS).map(([key, choices]) => [key, enums(rule[key], choices, key)])), accountIds: refundAccountIds(rule.accountIds) };
  });
}
export const globalRefundRule = (rule) => REFUND_SELECTORS.every((key) => !rule[key]?.length);
export function refundPolicyDraft(policy) {
  return { rules: policy.autoRefundRules.map((rule) => ({ ...rule, ...Object.fromEntries(REFUND_SELECTORS.map((key) => [key, [...rule[key]]])) })), blockedActions: [...policy.autoRefundBlockedActions], timeoutActions: [...policy.autoRefundTimeoutAllowedActions], exceptions: Object.entries(policy.autoRefundAllowedAccountIdsByAction).map(([action, ids]) => ({ action, accountIds: ids.join(', ') })) };
}
export function readRefundPolicy(response) {
  if (!response || !Object.hasOwn(response, 'autoRefundRules') || !Array.isArray(response.autoRefundRules)) throw new Error('This backend does not expose automatic-refund rules. Deploy the updated backend before editing.');
  const exceptions = response.autoRefundAllowedAccountIdsByAction ?? {};
  if (typeof exceptions !== 'object' || Array.isArray(exceptions)) throw new Error('Account exceptions could not be read. Refresh before editing.');
  const map = {};
  for (const [action, ids] of Object.entries(exceptions)) {
    if (!REFUND_ACTIONS.includes(action) || !Array.isArray(ids)) throw new Error('Account exceptions contain an unsupported action or invalid IDs.');
    const normalized = refundAccountIds(ids);
    if (normalized.length) map[action] = normalized;
  }
  return { autoRefundRules: normalizeRefundRules(response.autoRefundRules), autoRefundBlockedActions: enums(response.autoRefundBlockedActions, REFUND_ACTIONS, 'Blocked actions'), autoRefundTimeoutAllowedActions: enums(response.autoRefundTimeoutAllowedActions, REFUND_ACTIONS, 'Timeout actions'), autoRefundAllowedAccountIdsByAction: map };
}
export function refundPolicyPayload(draft) {
  const map = {}, actions = new Set();
  for (const row of draft.exceptions) {
    if (!REFUND_ACTIONS.includes(row.action)) throw new Error('Choose an action for each account exception.');
    if (actions.has(row.action)) throw new Error('Use one account-exception row per action.');
    actions.add(row.action);
    const ids = refundAccountIds(row.accountIds);
    if (ids.length) map[row.action] = ids;
  }
  return { autoRefundRules: normalizeRefundRules(draft.rules), autoRefundBlockedActions: enums(draft.blockedActions, REFUND_ACTIONS, 'Blocked actions'), autoRefundAllowedAccountIdsByAction: map, autoRefundTimeoutAllowedActions: enums(draft.timeoutActions, REFUND_ACTIONS, 'Timeout actions') };
}
export function refundFingerprint(value) {
  if (Array.isArray(value)) return `[${value.map(refundFingerprint).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${refundFingerprint(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function refundPolicyPatch(saved, next) { return Object.fromEntries(Object.entries(next).filter(([key, value]) => !saved || refundFingerprint(value) !== refundFingerprint(saved[key]))); }
export const invalidStoredRefundRules = (error) => error?.status >= 500 && /stored auto-refund rules are invalid/i.test(error.message || '');
export function refundRuleSummary(rule) {
  if (globalRefundRule(rule)) return 'All automatic refunds';
  return [rule.contexts.length ? rule.contexts.map(refundLabel).join(' / ') : null, rule.paymentProviders.length ? `Payment: ${rule.paymentProviders.join(', ')}` : null, rule.billProviders.length ? `Bill: ${rule.billProviders.join(', ')}` : null, rule.actions.length ? rule.actions.map(refundLabel).join(', ') : null, rule.accountIds.length ? `Accounts: ${rule.accountIds.join(', ')}` : null].filter(Boolean).join(' · ');
}
