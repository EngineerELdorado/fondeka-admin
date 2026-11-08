export const STOCK_FUNDING_SECTIONS = [
  { title: 'Your stock', fields: [['title', 'Main title', 160], ['body', 'Main explanation', 4000]] },
  { title: 'Using the money', fields: [['salesTitle', 'Sales title', 160], ['salesBody', 'Sales explanation', 4000]] },
  { title: 'Withdrawing the money', fields: [['availabilityTitle', 'Availability title', 160], ['availabilityBody', 'Availability explanation', 4000]] }
];
const fields = STOCK_FUNDING_SECTIONS.flatMap((section) => section.fields);
const trim = (value) => value.replace(/^[\s\u001c-\u001f]+|[\s\u001c-\u001f]+$/gu, '');
const normalized = (value) => trim(value ?? '') || null;

export function stockFundingTranslation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !(value.version === null || Number.isSafeInteger(value.version) && value.version >= 0) || !value.content || typeof value.content !== 'object' || Array.isArray(value.content)) throw new Error('Stock explanation settings are unavailable. Refresh before editing.');
  const content = {};
  for (const [key] of fields) {
    const text = value.content[key];
    if (text != null && typeof text !== 'string') throw new Error('The stock explanation contains invalid text. Refresh before editing.');
    content[key] = text ?? null;
  }
  return { version: value.version, content };
}

export function stockFundingSettings(value) {
  return { en: stockFundingTranslation(value?.en), fr: stockFundingTranslation(value?.fr) };
}

export function stockFundingDraft(translation) {
  return Object.fromEntries(fields.map(([key]) => [key, translation.content[key] ?? '']));
}

export function stockFundingChanged(draft, base) {
  return fields.some(([key]) => normalized(draft[key]) !== normalized(base.content[key]));
}

export function stockFundingReapply(draft, base, latest) {
  const next = stockFundingDraft(latest);
  for (const [key] of fields) if (normalized(draft[key]) !== normalized(base.content[key])) next[key] = draft[key];
  return next;
}

export function stockFundingPayload(draft, base) {
  if (!Number.isSafeInteger(base?.version) || base.version < 0) throw new Error('This translation has no saved version. Apply the backend migration and refresh.');
  const content = {};
  for (const [key, label, limit] of fields) {
    if (typeof draft[key] !== 'string') throw new Error(`${label} must be plain text.`);
    const text = normalized(draft[key]);
    if (text && text.length > limit) throw new Error(`${label} must be ${limit.toLocaleString('en')} characters or fewer.`);
    if (text !== normalized(base.content[key])) content[key] = text;
  }
  if (!Object.keys(content).length) throw new Error('There are no text changes to save.');
  return { version: base.version, content };
}
