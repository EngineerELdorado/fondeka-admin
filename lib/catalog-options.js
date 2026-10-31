export const catalogSearchText = (value) => String(value ?? '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[_\-•→/#().,]+/g, ' ').replace(/\s+/g, ' ').trim();

const first = (...values) => values.find((value) => value !== null && value !== undefined && String(value).trim() !== '');
const array = (value) => Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
const unique = (items) => [...new Set(items.filter(Boolean).map(String))];

export function catalogCountries(record = {}, locale = 'en', lookup = []) {
  const entity = record.__catalogEntity || record.paymentMethod || record.billProduct || record;
  const country = entity.country || record.country;
  const ids = array(first(entity.countryIds, entity.paymentMethodCountryId, entity.billProductCountryId, entity.countryId, country?.id));
  const codes = array(first(entity.countryCodes, entity.paymentMethodCountryCode, entity.billProductCountryCode, entity.countryCode, country?.alpha2Code, country?.code));
  const names = array(first(entity.countryNames, entity.paymentMethodCountryName, entity.billProductCountryName, entity.countryName, country?.name));
  const objects = array(entity.countries);
  const known = [...(record.__catalogCountries || []), ...lookup];
  let displayNames;
  try { displayNames = new Intl.DisplayNames([locale], { type: 'region' }); } catch { /* use backend names */ }
  const result = Array.from({ length: Math.max(ids.length, codes.length, names.length, objects.length) }, (_, index) => {
    const item = objects[index] || {};
    const id = first(item.id, ids[index]);
    const code = first(item.alpha2Code, item.cca2, item.code, codes[index]);
    const name = first(item.name, names[index]);
    const match = known.find((entry) => (id != null && String(entry.id) === String(id))
      || (code && String(entry.alpha2Code || entry.code || entry.cca2).toUpperCase() === String(code).toUpperCase())
      || (name && catalogSearchText(entry.name) === catalogSearchText(name)));
    const resolvedCode = String(first(match?.alpha2Code, match?.cca2, match?.code, code) || '').toUpperCase();
    let label = first(match?.name, name);
    if (/^[A-Z]{2}$/.test(resolvedCode)) {
      try { label = displayNames?.of(resolvedCode) || label || resolvedCode; } catch { /* retain backend label */ }
    }
    label = label || resolvedCode || `${locale === 'fr' ? 'Pays' : 'Country'} #${id}`;
    const aliases = resolvedCode === 'CD' ? ['DRC', 'RDC', 'DR Congo', 'Democratic Republic of the Congo', 'République démocratique du Congo'] : [];
    return { key: resolvedCode || `country:${first(match?.id, id, catalogSearchText(label))}`, label: String(label), code: resolvedCode, id: first(match?.id, id), aliases: unique([name, match?.name, label, resolvedCode, id, match?.alpha3Code, ...aliases]) };
  });
  return [...new Map(result.map((item) => [item.key, item])).values()];
}

export function catalogOptionDetails(record = {}, kind = 'payment-method', locale = 'en', lookup = []) {
  const entity = record.__catalogEntity || record.paymentMethod || record.billProduct || record;
  const bill = kind.startsWith('bill');
  const route = kind.endsWith('route');
  const name = first(entity.displayName, bill ? record.billProductName : record.paymentMethodName, entity.name, bill ? record.billProductCode : record.paymentMethodCode, entity.code);
  const provider = route ? first(record.paymentProviderName, record.billProviderName, record.paymentProvider?.name, record.billProvider?.name) : null;
  const countries = catalogCountries(record, locale, lookup);
  const code = first(entity.code, bill ? record.billProductCode : record.paymentMethodCode);
  const currency = first(record.currency, record.paymentMethodCurrency, entity.currency);
  const type = first(entity.type, entity.methodType, record.paymentMethodType);
  const id = record.id ?? record.value;
  const details = unique([entity.name !== name ? entity.name : null, code !== name ? code : null, provider, route ? record.providerCode : null, currency, type, route ? first(record.action, record.context) : null, id != null ? `#${id}` : null]);
  const search = catalogSearchText(unique([
    name, entity.name, entity.displayName, code, provider, currency, type, id,
    record.providerCode, record.action, record.context, record.paymentMethodId, record.billProductId,
    record.paymentProviderId, record.billProviderId,
    ...countries.flatMap((item) => item.aliases)
  ]).join(' '));
  return { name: String(name || ''), details, countries, search, inactive: record.active === false || entity.active === false, unavailable: entity.available === false };
}

export function filterCatalogOptions(options, query, country = '') {
  const terms = catalogSearchText(query).split(' ').filter(Boolean);
  return options.filter((option) => {
    if (country === '__global' && option.countries.length) return false;
    if (country && country !== '__global' && !option.countries.some((item) => item.key === country)) return false;
    const text = `${option.search} ${catalogSearchText(option.label)}`;
    return terms.every((term) => text.includes(term));
  });
}

export function groupCatalogOptions(options, country = '', locale = 'en') {
  const groups = new Map();
  for (const option of options) {
    const selectedCountry = country && option.countries.find((item) => item.key === country);
    const group = selectedCountry || (option.countries.length === 1 ? option.countries[0] : option.countries.length > 1
      ? { key: '__multiple', label: locale === 'fr' ? 'Plusieurs pays' : 'Multiple countries' }
      : { key: '__global', label: locale === 'fr' ? 'Global / tous les pays' : 'Global / all countries' });
    if (!groups.has(group.key)) groups.set(group.key, { ...group, options: [] });
    groups.get(group.key).options.push(option);
  }
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  return [...groups.values()].sort((a, b) => a.key === '__global' ? 1 : b.key === '__global' ? -1 : a.key === '__multiple' ? 1 : b.key === '__multiple' ? -1 : collator.compare(a.label, b.label))
    .map((group) => ({ ...group, options: [...group.options].sort((a, b) => collator.compare(a.name || a.label, b.name || b.label) || collator.compare(a.value, b.value)) }));
}
