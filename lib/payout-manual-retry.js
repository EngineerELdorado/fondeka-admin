const positiveId = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const nonnegative = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const states = new Set(['QUEUED', 'DISPATCHED', 'RETURNED', 'UNCERTAIN', 'REFUSED']);
const uuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const amount = (value) => (typeof value === 'number' || typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)) && Number.isFinite(Number(value)) && Number(value) > 0;

export function manualRetryPreview(value, transactionId) {
  if (!value || !positiveId(value.transactionId) || String(value.transactionId) !== String(transactionId) || value.sendsPayments !== false
      || typeof value.canRetry !== 'boolean' || !(nonnegative(value.version) || value.version == null && !value.canRetry)
      || !Number.isInteger(value.currentAttempt) || value.currentAttempt < 0 || value.currentAttempt > 3
      || value.maximumAttempts != null && value.maximumAttempts !== 3
      || !Array.isArray(value.routes) || !Array.isArray(value.blockers) || !Array.isArray(value.retries)
      || !nonnegative(value.defaultRouteId) || value.blockers.some((item) => typeof item !== 'string')
      || !value.evidence || typeof value.evidence.confirmedNonPayment !== 'boolean'
      || value.routes.some((route) => !positiveId(route.routeId) || typeof route.provider !== 'string' || typeof route.available !== 'boolean' || typeof route.originalProvider !== 'boolean')
      || new Set(value.routes.map((route) => route.routeId)).size !== value.routes.length
      || value.routes.some((route) => route.routeId === value.defaultRouteId && !route.originalProvider)) {
    throw new Error('The payout retry preview could not be verified. Refresh before authorizing a payment.');
  }
  if (value.canRetry && (typeof value.destination !== 'string' || !value.destination.trim()
      || !/^[A-Z]{3}$/.test(value.currency || '') || !amount(value.amount) || !amount(value.grossAmount)
      || Number(value.grossAmount) < Number(value.amount))) throw new Error('The saved beneficiary and quote could not be verified. Refresh before authorizing a payment.');
  value.retries.forEach((retry) => manualRetryReceipt(retry, value.transactionId));
  return value;
}

export function manualRetryRequest(preview, selectedRoute, reason, confirmed, idempotencyKey) {
  manualRetryPreview(preview, preview?.transactionId);
  if (preview.currentAttempt >= 3) throw new Error('The maximum number of payout attempts has been reached.');
  if (!preview.canRetry || preview.blockers.length || preview.evidence.confirmedNonPayment !== true || pendingManualRetry(preview)) throw new Error('The payout and all prior attempts must be reconciled before another payout.');
  const routeId = selectedRoute === '' || selectedRoute == null ? preview.defaultRouteId : /^\d+$/.test(String(selectedRoute)) ? Number(selectedRoute) : NaN;
  const route = preview.routes.find((item) => Number(item.routeId) === routeId);
  if (!route?.available) throw new Error(route?.unavailableReason || 'Select an available payout provider.');
  const explanation = typeof reason === 'string' ? reason.trim() : '';
  if (explanation.length < 3 || explanation.length > 1000) throw new Error('Enter a reason between 3 and 1,000 characters.');
  if (confirmed !== true) throw new Error('Confirm the beneficiary, amount and provider before retrying.');
  if (!uuid(idempotencyKey)) throw new Error('A unique retry approval ID is required. Refresh the page.');
  return { idempotencyKey, expectedVersion: preview.version, expectedAttempt: preview.currentAttempt,
    targetRouteId: selectedRoute === '' || selectedRoute == null ? null : routeId, reason: explanation, confirmed: true };
}

export function manualRetryReceipt(value, transactionId, idempotencyKey = null) {
  if (!value || !positiveId(value.id) || String(value.transactionId) !== String(transactionId)
      || !uuid(value.idempotencyKey) || !states.has(value.state) || idempotencyKey && value.idempotencyKey !== idempotencyKey) {
    throw new Error('The retry receipt could not be verified. Check payout status before submitting again.');
  }
  return value;
}

export function pendingManualRetry(preview) {
  return preview?.retries?.find((retry) => ['QUEUED', 'DISPATCHED'].includes(retry.state)) || null;
}

export function manualRetryStorageKey(actor, transactionId) {
  return actor ? `payout-manual-retry:${encodeURIComponent(actor)}:${transactionId}` : null;
}

export function savedManualRetry(value, transactionId) {
  if (!value || String(value.transactionId) !== String(transactionId) || !uuid(value.payload?.idempotencyKey)
      || !nonnegative(value.payload.expectedVersion) || !nonnegative(value.payload.expectedAttempt)
      || value.payload.targetRouteId !== null && !positiveId(value.payload.targetRouteId)
      || typeof value.payload.reason !== 'string' || value.payload.reason.trim().length < 3 || value.payload.reason.length > 1000
      || value.payload.confirmed !== true) return null;
  const { idempotencyKey, expectedVersion, expectedAttempt, targetRouteId, reason } = value.payload;
  return { idempotencyKey, expectedVersion, expectedAttempt, targetRouteId, reason, confirmed: true };
}
