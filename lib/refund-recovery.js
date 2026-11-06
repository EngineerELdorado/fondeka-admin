export function recoveryDebitIds(value) {
  const parts = String(value || '').trim().split(/[\s,;]+/).filter(Boolean);
  const ids = parts.map(Number);
  if (!parts.length || parts.length > 100 || parts.some((part) => !/^[1-9]\d*$/.test(part)) || ids.some((id) => !Number.isSafeInteger(id)) || new Set(ids).size !== ids.length) {
    throw new Error('Enter 1 to 100 distinct numeric admin debit transaction IDs, separated by commas.');
  }
  return ids;
}
