export const budgetRecoveryKey = actor => `fondeka:expense-budget:v1:${actor}`;
export function clearBudgetRecovery(storage, keepActor = null) {
  const keep = keepActor == null ? null : budgetRecoveryKey(keepActor);
  for (let i = storage.length - 1; i >= 0; i--) { const key = storage.key(i); if (key?.startsWith('fondeka:expense-budget:v1:') && key !== keep) storage.removeItem(key); }
}
export const validId = id => typeof id === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
export function readBudgetIntent(raw, actor) {
  try {
    if (!raw || raw.length > 1500000) return null;
    const value = JSON.parse(raw), { operation, id, request } = value;
    if (String(value.actor) !== String(actor) || !validId(value.key) || !request || !['createBudget', 'updateBudget', 'createItem', 'updateItem'].includes(operation)) return null;
    if (operation === 'updateBudget' && !validId(id) || operation === 'updateItem' && !Number.isSafeInteger(id)) return null;
    if (operation === 'createBudget' && (!/^\d{4}-\d{2}$/.test(request.month) || !/^[A-Z]{3}$/.test(request.currency))) return null;
    if (operation === 'updateBudget' && (!Number.isSafeInteger(request.expectedVersion) || !Array.isArray(request.lines) || request.lines.length > 500)) return null;
    if (operation.endsWith('Item') && (typeof request.nameEn !== 'string' || !request.nameEn.trim() || typeof request.active !== 'boolean')) return null;
    return { actor: String(actor), key: value.key, operation, ...(id == null ? {} : { id }), request };
  } catch { return null; }
}
export function checkedBudgetResult(result, intent) {
  if (!result || !Number.isSafeInteger(result.version) || result.version < 0) throw new Error('Unexpected expense response. Retry this same request to confirm it.');
  if (intent.operation.endsWith('Budget')) {
    if (!validId(result.id) || !Array.isArray(result.lines) || intent.operation === 'updateBudget' && result.id !== intent.id
        || intent.operation === 'createBudget' && (result.month !== intent.request.month || result.currency !== intent.request.currency)) throw new Error('The returned budget does not match the saved request.');
  } else if (!Number.isSafeInteger(result.id) || result.id <= 0 || intent.operation === 'updateItem' && result.id !== intent.id) throw new Error('The returned expense item does not match the saved request.');
  return result;
}
export function currencyDigits(currency) {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Enter a three-letter currency code.');
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
}
export function decimalAmount(raw, currency, planned = false) {
  if (raw == null || String(raw).trim() === '') return null;
  const value = String(raw).trim(), dp = currencyDigits(currency);
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) throw new Error('Use a decimal amount, for example 12.50.');
  const negative = value.startsWith('-'), [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  if (fraction.slice(dp).replace(/0/g, '') || whole.replace(/^0+/, '').length > 16) throw new Error(`Check the amount precision for ${currency}.`);
  const units = BigInt(whole) * 10n ** BigInt(dp) + BigInt(fraction.slice(0, dp).padEnd(dp, '0') || '0');
  if (planned && negative && units !== 0n) throw new Error('Planned expenses cannot be negative.');
  return `${negative && units ? '-' : ''}${BigInt(whole)}${dp ? '.' + fraction.slice(0, dp).padEnd(dp, '0') : ''}`;
}
export function draftTotals(lines, currency) {
  const dp = currencyDigits(currency);
  const money = units => {
    const negative = units < 0n, digits = (negative ? -units : units).toString().padStart(dp + 1, '0');
    return `${negative ? '-' : ''}${dp ? digits.slice(0, -dp) + '.' + digits.slice(-dp) : digits}`;
  };
  const total = field => {
    let units = 0n, entered = 0;
    for (const line of lines) { const value = decimalAmount(line[field], currency, field === 'planned'); if (value != null) { units += BigInt(value.replace('.', '')); entered++; } }
    return { amount: entered || !lines.length ? money(units) : null, entered };
  };
  const planned = total('planned'), actual = total('actual');
  const complete = planned.entered === lines.length && actual.entered === lines.length;
  return { planned, actual, count: lines.length, complete,
    variance: complete ? money(BigInt(planned.amount.replace('.', '')) - BigInt(actual.amount.replace('.', ''))) : null };
}
export function updateBudgetRequest(budget, lines, note) {
  const seen = new Set();
  const inputs = lines.map(line => { if (!Number.isSafeInteger(line.expenseItemId) || seen.has(line.expenseItemId)) throw new Error('Choose each expense category once.'); seen.add(line.expenseItemId);
    return { expenseItemId: line.expenseItemId, planned: decimalAmount(line.planned, budget.currency, true), actual: decimalAmount(line.actual, budget.currency), note: line.note?.trim() || null }; });
  return { expectedVersion: budget.version, lines: inputs, note: note.trim() || null };
}
