export const BILL_SECONDARY_NAME_FIELDS = [
  ['subDisplayNameEn', 'Secondary name (English, optional)'],
  ['subDisplayNameFr', 'Secondary name (French, optional)']
];

export function billSecondaryNameDraft(record = {}) {
  return Object.fromEntries(BILL_SECONDARY_NAME_FIELDS.map(([key]) => [key, typeof record[key] === 'string' ? record[key] : '']));
}

export function billSecondaryNamePayload(draft, original = {}) {
  const body = {};
  for (const [key, label] of BILL_SECONDARY_NAME_FIELDS) {
    const value = draft[key] ?? '';
    if (typeof value !== 'string') throw new Error(`${label} must be plain text.`);
    const previous = typeof original[key] === 'string' ? original[key] : '';
    if (value !== previous) body[key] = value.trim() ? value : null;
  }
  return body;
}
