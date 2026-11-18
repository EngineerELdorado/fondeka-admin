export const serviceFeeActions = {
  WALLET: ['FUND_WALLET', 'WITHDRAW_FROM_WALLET', 'INTER_TRANSFER', 'ENROLL_RESELLER', 'SETTLEMENT'],
  CARD: ['FUND_CARD', 'WITHDRAW_FROM_CARD', 'BUY_CARD'],
  BILL_PAYMENTS: ['PAY_INTERNET_BILL', 'PAY_TV_SUBSCRIPTION', 'PAY_ELECTRICITY_BILL', 'PAY_WATER_BILL', 'BUY_GIFT_CARD', 'PAY_NETFLIX', 'BUSINESS_API_BILL_PAYMENT'],
  LENDING: ['LOAN_REQUEST', 'LOAN_DISBURSEMENT', 'REPAY_LOAN'],
  CRYPTO: ['BUY_CRYPTO', 'SELL_CRYPTO', 'RECEIVE_CRYPTO', 'SEND_CRYPTO', 'SWAP_CRYPTO', 'CONVERT_FIAT'],
  BANK_ACCOUNT: ['ORDER_BANK_ACCOUNT'], COMMERCE: ['CREATE_COMMERCE_STORE', 'COMMERCE_CHECKOUT_PAYMENT'],
  PAYMENT_REQUEST: ['REQUEST_PAYMENT', 'PAY_REQUEST'], BUSINESS_API: ['BUSINESS_API_COLLECTION', 'BUSINESS_API_PAYOUT'],
  BUSINESS_TOOLS: ['BUSINESS_TOOLS_ACCESS', 'BUSINESS_TOOLS_PAYMENT_REQUESTS_ACCESS', 'BUSINESS_TOOLS_ONLINE_STORES_ACCESS', 'BUSINESS_TOOLS_POS_ACCESS', 'BUSINESS_TOOLS_API_ACCESS'],
  E_SIM: ['E_SIM_PURCHASE', 'E_SIM_TOPUP'], AIRTIME_AND_DATA: ['SEND_AIRTIME', 'SEND_DATA_BUNDLES'],
  SAVINGS: ['PERSONAL_SAVING_DEPOSIT', 'PERSONAL_SAVING_WITHDRAWAL', 'PERSONAL_SAVING_INTEREST_PAYOUT', 'GROUP_SAVING_CONTRIBUTION', 'GROUP_SAVING_TREASURY_CONTRIBUTION', 'GROUP_SAVING_TREASURY_WITHDRAWAL', 'GROUP_SAVING_PAYOUT', 'GROUP_SAVING_ROUND_DISTRIBUTION']
};
export const serviceFeeScopes = [
  { value: 'CARD_PRODUCT_PROVIDER', label: 'Card product / provider', service: 'CARD' },
  { value: 'BILL_PRODUCT_PROVIDER', label: 'Bill product / provider', service: 'BILL_PAYMENTS' },
  { value: 'BILL_PRODUCT', label: 'Bill product', service: 'BILL_PAYMENTS' },
  { value: 'BILL_PROVIDER', label: 'Bill provider', service: 'BILL_PAYMENTS' },
  { value: 'CRYPTO_PRODUCT', label: 'Crypto product', service: 'CRYPTO' },
  { value: 'CRYPTO_PAIR', label: 'Crypto conversion pair', service: 'CRYPTO' },
  { value: 'CURRENCY_PAIR', label: 'Fiat conversion pair', service: 'CRYPTO' },
  { value: 'ESIM_PRODUCT', label: 'eSIM product', service: 'E_SIM' },
  { value: 'RECHARGE_OPERATOR', label: 'Recharge operator', service: 'AIRTIME_AND_DATA' }
];
export function feePermissions(session) {
  const roles = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload]
    .flatMap((payload) => [payload?.['cognito:groups'], payload?.groups]).flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((role) => String(role).trim().toUpperCase());
  return { canRead: roles.some((role) => ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT'].includes(role)), canWrite: roles.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role)) };
}
export const feeLabel = (value) => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
export const humanBusinessPercent = (value) => value == null ? '' : new Intl.NumberFormat('en-US', { useGrouping: false, maximumFractionDigits: 8 }).format(Number(value) * 100);
export const emptyServiceFee = () => ({ service: 'BILL_PAYMENTS', action: '', productType: '', productKey: '', percentage: '0', flatAmount: '0', minimumAmount: '0', maximumAmount: '', currency: 'USD', costPercentage: '0', costFlatAmount: '0', costMinimumAmount: '0', active: true });
export function serviceFeeDraft(row) {
  return Object.fromEntries(Object.keys(emptyServiceFee()).map((key) => [key, key === 'active' ? row[key] : key === 'percentage' || key === 'costPercentage' ? humanBusinessPercent(row[key]) : row[key] == null ? '' : String(row[key])]));
}
export function serviceFeePayload(draft) {
  if (!serviceFeeActions[draft.service]) throw new Error('Choose a supported service.');
  if (draft.action && !serviceFeeActions[draft.service].includes(draft.action)) throw new Error('The action must belong to the selected service.');
  const productType = draft.productType || null, productKey = String(draft.productKey || '').trim() || null;
  if (!!productType !== !!productKey) throw new Error('Choose both the product scope and its product.');
  if (productType) {
    const scope = serviceFeeScopes.find((item) => item.value === productType);
    if (!scope || scope.service !== draft.service) throw new Error('The product scope must belong to the selected service.');
    if (productKey.length > 128) throw new Error('Product keys allow at most 128 characters.');
    // eSIM catalogue IDs are strings; numeric catalogue families use Long IDs.
    const ids = productKey.split(':');
    if (productType !== 'ESIM_PRODUCT' && (ids.length !== (productType.endsWith('_PAIR') ? 2 : 1) || ids.some((id) => !/^[1-9]\d*$/.test(id) || id.length > 19 || BigInt(id) > 9223372036854775807n) || (ids.length === 2 && ids[0] === ids[1]))) throw new Error('Choose valid product IDs. A pair needs different source and destination IDs.');
  }
  const number = (key, percent = false, optional = false) => {
    const text = String(draft[key] ?? '').trim();
    if (optional && !text) return null;
    if (!/^\d+(?:\.\d+)?$/.test(text) || !Number.isFinite(Number(text)) || (text.split('.')[1]?.length || 0) > (percent ? 8 : 2)) throw new Error(`${feeLabel(key)} must be a nonnegative number with at most ${percent ? 8 : 2} decimal places.`);
    if (percent && Number(text) > 100) throw new Error('Percentages must be between 0 and 100.');
    // Decimal exponent conversion avoids adding binary division noise to JSON.
    return percent ? Number(`${text}e-2`) : Number(text);
  };
  const percentage = number('percentage', true), costPercentage = number('costPercentage', true), flatAmount = number('flatAmount'), minimumAmount = number('minimumAmount'), maximumAmount = number('maximumAmount', false, true), costFlatAmount = number('costFlatAmount'), costMinimumAmount = number('costMinimumAmount');
  if (maximumAmount !== null && maximumAmount < minimumAmount) throw new Error('Maximum charge must be at least the minimum charge.');
  const currency = String(draft.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Enter a three-letter rule currency.');
  if (typeof draft.active !== 'boolean') throw new Error('Choose whether this rule is active.');
  return { service: draft.service, action: draft.action || null, productType, productKey, percentage, flatAmount, minimumAmount, maximumAmount, currency, costPercentage, costFlatAmount, costMinimumAmount, active: draft.active };
}
export function feePage(response) {
  const meta = response?.page || response;
  if (!Array.isArray(response?.content) || !['number', 'size', 'totalPages', 'totalElements'].every((key) => Number.isSafeInteger(meta?.[key]) && meta[key] >= 0) || !meta.size) throw new Error('The fee list could not be read. Refresh or check backend support.');
  return { rows: response.content, ...Object.fromEntries(['number', 'size', 'totalPages', 'totalElements'].map((key) => [key, meta[key]])) };
}
export const businessFeeSnapshot = (row) => JSON.stringify(serviceFeePayload(serviceFeeDraft(row)));
export function railOnlyPayload(payload, { requireContext = true } = {}) {
  const forbidden = ['service', 'billProductId', 'billProviderId', 'billProductBillProviderId', 'fromCryptoProductId', 'toCryptoProductId', 'fromCurrencyProductId', 'toCurrencyProductId'];
  if (forbidden.some((key) => payload[key] !== null && payload[key] !== undefined && payload[key] !== '') || (payload.action && !['COLLECTION', 'PAYOUT'].includes(payload.action))) throw new Error('Configure business actions and product charges in Business fees. Rail pricing supports COLLECTION or PAYOUT only.');
  const context = payload.feeContext || payload.action || null;
  if (payload.feeContext && payload.action && payload.feeContext !== payload.action) throw new Error('The action alias and rail context must agree.');
  if ((requireContext && !context) || (context && !['COLLECTION', 'PAYOUT'].includes(context))) throw new Error('Choose COLLECTION or PAYOUT for the rail tariff.');
  const result = { ...payload, ...(context ? { feeContext: context } : {}) };
  for (const key of [...forbidden, 'action']) delete result[key];
  return result;
}
