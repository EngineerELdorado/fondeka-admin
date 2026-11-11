export const MANUAL_TV_STATUS = 'AWAITING_MANUAL_FULFILLMENT';
export const TV_FLOWS = { SUBSCRIPTION_LOOKUP: 'Subscription lookup', MANUAL_SELECTION: 'Manual selection' };
export const MANUAL_TV_OUTCOMES = { complete: 'Confirm fulfillment', fail: 'Mark failed', cancel: 'Cancel payment' };

export function tvSubscriptionFlowPayload(draft) {
  const flow = draft.type === 'TELEVISION' ? draft.tvSubscriptionFlow || 'SUBSCRIPTION_LOOKUP' : 'SUBSCRIPTION_LOOKUP';
  if (!Object.hasOwn(TV_FLOWS, flow)) throw new Error('Select a supported TV subscription flow.');
  return { tvSubscriptionFlow: flow };
}

export function manualTvPermissions(session) {
  const groups = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload]
    .flatMap((payload) => [payload?.['cognito:groups'], payload?.groups])
    .flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .map((value) => String(value).trim().toUpperCase());
  return { canRead: groups.some((role) => ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT', 'STAFF'].includes(role)), canReconcile: groups.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role)) };
}

const id = (value) => Number.isSafeInteger(value) && value > 0;
export function manualTvIntent(value, expectedId) {
  if (!value || !id(value.id) || !id(value.transactionId) || value.operationType !== 'TV_SUBSCRIBE' || expectedId != null && value.id !== expectedId) throw new Error('This manual TV work item could not be verified. Refresh the queue.');
  return value;
}

export function manualTvPage(value) {
  if (!Array.isArray(value?.content) || !Number.isSafeInteger(value.totalPages) || value.totalPages < 0 || !Number.isSafeInteger(value.totalElements) || value.totalElements < 0) throw new Error('The manual TV queue is unavailable. Refresh to retry.');
  value.content.forEach((row) => { manualTvIntent(row); if (row.status !== MANUAL_TV_STATUS) throw new Error('The backend did not return the requested manual fulfillment queue. Update the backend and refresh.'); });
  return value;
}

export function manualTvBlocker(intent, eligibility) {
  if (!intent || intent.status !== MANUAL_TV_STATUS) return 'This work item is no longer awaiting manual fulfillment.';
  if (![intent.subscriberId || intent.accountNumber, intent.offerCode, intent.optionCode, intent.currency].every((value) => typeof value === 'string' && value.trim()) || intent.amount == null || !/^\d+(?:\.\d+)?$/.test(String(intent.amount))) return 'The captured decoder, offer, option or provider price is missing. Investigate the original transaction.';
  if (eligibility?.transactionId !== intent.transactionId || eligibility?.action !== 'PAY_TV_SUBSCRIPTION' || typeof eligibility?.status !== 'string' || !eligibility.status || typeof eligibility?.completable !== 'boolean') return 'Transaction eligibility could not be verified. Refresh before recording an outcome.';
  if (['COMPLETED', 'FAILED', 'CANCELED', 'CANCELLED'].includes(eligibility.status)) return 'This transaction is already closed. Refresh the queue.';
  return eligibility.completable === true ? '' : eligibility.reasonCode === 'bill_collection_not_confirmed' ? 'Verified full collection is required and the payment must not be refunded. Investigate this transaction before recording fulfillment.' : eligibility.reason || 'The backend has blocked reconciliation. Investigate the transaction.';
}

export function manualTvFingerprint(intent) {
  return JSON.stringify(['id', 'transactionId', 'billProductId', 'billCode', 'subscriberId', 'accountNumber', 'offerCode', 'optionCode', 'offerName', 'optionName', 'amount', 'currency', 'promotionNote', 'promotionTargetOfferDisplayName'].map((key) => intent[key] ?? null));
}

export function manualTvOutcomePayload(action, note, confirmed) {
  if (!Object.hasOwn(MANUAL_TV_OUTCOMES, action)) throw new Error('Choose an outcome.');
  const message = String(note ?? '').trim();
  if (!message || message.length > 1000) throw new Error('Enter an operational note of 1–1,000 characters.');
  if (confirmed !== true) throw new Error('Confirm the reviewed outcome before submitting.');
  return { message };
}

export function manualTvProviderAmount(row) {
  return row.amount == null || !row.currency ? 'Unavailable' : `${String(row.amount)} ${row.currency}`;
}
