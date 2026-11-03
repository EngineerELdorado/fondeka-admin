export function shouldWrapTableValue(value, column = {}) {
  if (column.wrap === false || typeof value !== 'string' || (Array.from(value).length <= 32 && !/[\r\n]/.test(value))) return false;
  // Amounts and dates keep their established formatting and precision.
  if (/amount|balance|price|percentage|exchangeRate|count|(?:created|updated|completed|paid|refunded|expires|started|ended|lastSynced|lastActivity)At|timestamp|date$/i.test(String(column.key || ''))) return false;
  if (/^[+\-]?\d[\d.,\s]*(?:%|[A-Z]{3,5})?$/.test(value.trim())) return false;
  return true;
}
