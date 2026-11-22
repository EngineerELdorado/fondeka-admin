export const PURCHASE_INFORMATION_FIELDS = Object.freeze([
  { name: 'pros', label: 'Pros', list: true },
  { name: 'cons', label: 'Cons', list: true },
  { name: 'insufficientFundsDeclineNotice', label: 'Declined payments due to insufficient funds', list: false },
  { name: 'feesNotice', label: 'Fees notice', list: false },
  { name: 'idealFor', label: 'Ideal for', list: true },
  { name: 'notIdealFor', label: 'Not ideal for', list: true }
]);
export const PURCHASE_INFORMATION_LANGUAGES = Object.freeze([
  { suffix: 'En', label: 'English' }, { suffix: 'Fr', label: 'French' }
]);

export function purchaseInformationDraft(row = {}) {
  const localized = Object.fromEntries(PURCHASE_INFORMATION_FIELDS.flatMap(field => PURCHASE_INFORMATION_LANGUAGES.map(language => {
    const key = field.name + language.suffix, value = row[key];
    return [key, field.list ? (Array.isArray(value) ? [...value] : []) : (typeof value === 'string' ? value : '')];
  })));
  return { issuerBankName: typeof row.issuerBankName === 'string' ? row.issuerBankName : '', cardCountryCode: row.cardCountry?.code || '', ...localized };
}

export function purchaseInformationPayload(draft) {
  const bank = draft.issuerBankName ?? '';
  const country = String(draft.cardCountryCode ?? '').trim().toUpperCase();
  if (country && !/^[A-Z]{2}$/.test(country)) throw new Error('Issuing country must be a two-letter country code.');
  if (typeof bank !== 'string') throw new Error('Issuing bank must be text.');
  if (bank.trim().length > 255) throw new Error('Issuing bank allows at most 255 characters.');
  const localized = Object.fromEntries(PURCHASE_INFORMATION_FIELDS.flatMap(field => PURCHASE_INFORMATION_LANGUAGES.map(language => {
    const key = field.name + language.suffix;
    const label = `${field.label} (${language.label})`;
    if (field.list) {
      const raw = draft[key] ?? [];
      if (!Array.isArray(raw) || raw.some(value => typeof value !== 'string')) throw new Error(`${label} must contain text points.`);
      const points = raw.map(value => value.trim());
      if (points.length > 20) throw new Error(`${label} allows at most 20 points.`);
      if (points.some(value => !value)) throw new Error(`${label}: enter text for each point or remove the empty point.`);
      if (points.some(value => value.length > 500)) throw new Error(`${label} allows at most 500 characters per point.`);
      return [key, points];
    }
    const raw = draft[key] ?? '';
    if (typeof raw !== 'string') throw new Error(`${label} must be text.`);
    const text = raw.trim();
    if (text.length > 4000) throw new Error(`${label} allows at most 4000 characters.`);
    // Empty strings explicitly clear copy; null/omitted values preserve it on the backend.
    return [key, text];
  })));
  return { issuerBankName: bank.trim(), cardCountryCode: country, ...localized };
}

export function purchaseInformationDetails(row = {}) {
  return [{ label: 'Issuing bank', value: row.issuerBankName || '—' }, { label: 'Issuing country', value: row.cardCountry?.displayName || row.cardCountry?.name || row.cardCountry?.code || '—' }, ...PURCHASE_INFORMATION_FIELDS.flatMap(field => PURCHASE_INFORMATION_LANGUAGES.map(language => {
    const value = row[field.name + language.suffix];
    return {
      label: `${field.label} (${language.label})`,
      value: field.list ? (Array.isArray(value) && value.length ? value.map(point => `• ${point}`).join('\n') : '—') : (value || '—')
    };
  }))];
}
