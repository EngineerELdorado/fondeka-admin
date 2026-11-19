import { contactAudienceGroups, contactExportAudience } from '@/lib/contact-exports';
import { businessAudienceFields } from '@/lib/notification-business-audience';

export const visibilityAudienceGroups = [
  ['Completed transactions', contactAudienceGroups[3][1].slice(0, 3)],
  ['Completed USD volume', [['minCompletedTransactionTotalUsd', 'Minimum completed total (USD)', 'decimal'], ['maxCompletedTransactionTotalUsd', 'Maximum completed total (USD)', 'decimal']]],
  contactAudienceGroups[0],
  ['Product ownership', [...contactAudienceGroups[2][1].filter(([key]) => key !== 'hasPaymentRequests'), ...businessAudienceFields.map(({ key, label }) => [key, label, 'boolean'])]],
  ['Recent and monthly activity', contactAudienceGroups[3][1].slice(3)],
  contactAudienceGroups[1],
  contactAudienceGroups[4]
];
export const visibilityAudienceFields = visibilityAudienceGroups.flatMap(([, fields]) => fields);
export const visibilityAudienceOptions = {
  transactionStatuses: ['NONE', 'INITIATED', 'SUBMITTED', 'PROCESSING', 'FUNDED', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELED', 'MANUAL_INTERVENTION_REQUIRED', 'UNKNOWN'],
  transactionServices: ['WALLET', 'BILL_PAYMENTS', 'LENDING', 'CARD', 'CRYPTO', 'PAYMENT_REQUEST', 'E_SIM', 'AIRTIME_AND_DATA', 'SAVINGS', 'BANK_ACCOUNT', 'BANK_ACCOUNTS', 'COMMERCE', 'BUSINESS_API', 'BUSINESS_TOOLS', 'OTHER'],
  transactionActions: ['FUND_WALLET', 'ENROLL_RESELLER', 'WITHDRAW_FROM_WALLET', 'REFUND_TO_WALLET', 'BONUS', 'MANUAL_ADJUSTMENT', 'PAY_INTERNET_BILL', 'PAY_TV_SUBSCRIPTION', 'PAY_ELECTRICITY_BILL', 'PAY_WATER_BILL', 'LOAN_REQUEST', 'LOAN_DISBURSEMENT', 'REPAY_LOAN', 'FUND_CARD', 'WITHDRAW_FROM_CARD', 'BUY_CARD', 'CARD_ONLINE_PAYMENT', 'CARD_PAYMENT_REVERSAL', 'CARD_MAINTENANCE', 'BUY_CRYPTO', 'SELL_CRYPTO', 'RECEIVE_CRYPTO', 'SEND_CRYPTO', 'SWAP_CRYPTO', 'CONVERT_FIAT', 'ORDER_BANK_ACCOUNT', 'REQUEST_PAYMENT', 'PAY_REQUEST', 'SETTLEMENT', 'BUSINESS_API_COLLECTION', 'BUSINESS_API_PAYOUT', 'BUSINESS_API_BILL_PAYMENT', 'BUSINESS_TOOLS_ACCESS', 'BUSINESS_TOOLS_PAYMENT_REQUESTS_ACCESS', 'BUSINESS_TOOLS_ONLINE_STORES_ACCESS', 'BUSINESS_TOOLS_POS_ACCESS', 'BUSINESS_TOOLS_API_ACCESS', 'E_SIM_PURCHASE', 'E_SIM_TOPUP', 'SEND_AIRTIME', 'SEND_DATA_BUNDLES', 'PERSONAL_SAVING_DEPOSIT', 'PERSONAL_SAVING_WITHDRAWAL', 'PERSONAL_SAVING_INTEREST_PAYOUT', 'GROUP_SAVING_CONTRIBUTION', 'GROUP_SAVING_TREASURY_CONTRIBUTION', 'GROUP_SAVING_TREASURY_WITHDRAWAL', 'GROUP_SAVING_PAYOUT', 'GROUP_SAVING_ROUND_DISTRIBUTION', 'BUY_GIFT_CARD', 'CREATE_COMMERCE_STORE', 'COMMERCE_CHECKOUT_PAYMENT', 'PAY_NETFLIX', 'INTER_TRANSFER', 'OTHER'].sort(),
  kycStatuses: ['NONE', 'PENDING', 'PROVISIONALLY_APPROVED', 'ADDITIONAL_VERIFICATION_NEEDED', 'APPROVED', 'REJECTED', 'FAILED', 'EXPIRED']
};
export const emptyVisibilityAudience = () => Object.fromEntries(visibilityAudienceFields.map(([key]) => [key, '']));
export function visibilityPermissions(session) {
  const roles = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload].flatMap((payload) => [payload?.['cognito:groups'], payload?.groups])
    .flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((role) => String(role).trim().toUpperCase());
  return { canRead: roles.some((role) => ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT'].includes(role)), canWrite: roles.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role)) };
}
export function visibilityAudience(filters) {
  const audience = contactExportAudience(filters, visibilityAudienceFields);
  if (audience.lastTransactionOlderThanDays === 0) throw new Error('Last transaction older-than days must be positive.');
  for (const key of ['transactionActions', 'transactionStatuses', 'transactionServices']) {
    if (audience[key]) audience[key] = [...new Set(audience[key].map((value) => value.trim().toUpperCase()))];
    if (audience[key]?.some((value) => !visibilityAudienceOptions[key].includes(value))) throw new Error('Choose supported ' + key.replace(/([A-Z])/g, ' $1').toLowerCase() + '.');
  }
  return audience;
}
export function visibilityPayload(mode, filters) {
  if (mode === 'UNRESTRICTED') return { audience: null };
  if (mode !== 'TARGETED') throw new Error('Choose how the audience is restricted.');
  const audience = visibilityAudience(filters);
  if (!Object.keys(audience).length) throw new Error('Add at least one criterion, or choose Unrestricted to remove targeting.');
  return { audience };
}
export function readVisibilityPolicy(resource) {
  if (!resource || typeof resource !== 'object' || Array.isArray(resource) || !Object.hasOwn(resource, 'audience') || Object.keys(resource).some((key) => key !== 'audience')) throw new Error('The backend did not return a supported visibility policy.');
  const audience = resource.audience;
  if (audience != null && (typeof audience !== 'object' || Array.isArray(audience))) throw new Error('The saved audience could not be read.');
  for (const [key, value] of Object.entries(audience || {})) {
    const field = visibilityAudienceFields.find(([name]) => name === key);
    if (!field) throw new Error('The saved audience contains an unsupported field: ' + key + '.');
    if (value == null) continue;
    const kind = field[2];
    if ((['ids', 'list'].includes(kind) && !Array.isArray(value)) || (kind === 'boolean' && typeof value !== 'boolean') || (['number', 'decimal'].includes(kind) && typeof value !== 'number') || (kind === 'date' && typeof value !== 'string')) throw new Error('The saved audience contains an invalid ' + key + ' value.');
  }
  const parsed = visibilityAudience(audience || {});
  return { audience: Object.keys(parsed).length ? parsed : null };
}
export function visibilityDraft(resource) {
  const { audience } = readVisibilityPolicy(resource);
  return { mode: audience ? 'TARGETED' : 'UNRESTRICTED', filters: { ...emptyVisibilityAudience(), ...Object.fromEntries(Object.entries(audience || {}).map(([key, value]) => [key, typeof value === 'boolean' ? String(value) : value])) } };
}
export function visibilitySnapshot(resource) {
  const { audience } = readVisibilityPolicy(resource);
  return JSON.stringify({ audience: audience ? Object.fromEntries(Object.entries(audience).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, Array.isArray(value) ? [...value].sort((a, b) => String(a).localeCompare(String(b))) : value])) : null });
}
