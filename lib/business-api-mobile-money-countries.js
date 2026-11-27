export function mobileMoneyCountryPermissions(session) {
  const groups = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload]
    .flatMap((payload) => [payload?.['cognito:groups'], payload?.groups])
    .flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .map((value) => String(value).trim().toUpperCase());
  return {
    canRead: groups.some((value) => ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT'].includes(value)),
    canWrite: groups.some((value) => ['ADMIN', 'SUPER_ADMIN'].includes(value))
  };
}

export function mobileMoneyCountryCodes(value) {
  if (!Array.isArray(value)) throw new Error('Allowed countries must be a list. Reload the saved policy.');
  return [...new Set(value.map((code) => {
    if (typeof code !== 'string' || !/^[A-Z]{2}$/.test(code.trim().toUpperCase())) throw new Error('Choose valid two-letter country codes.');
    return code.trim().toUpperCase();
  }))].sort();
}

export const sameCountryCodes = (a, b) => JSON.stringify(mobileMoneyCountryCodes(a)) === JSON.stringify(mobileMoneyCountryCodes(b));

// Never invent a default or interpret a missing list as an empty, editable policy.
export function mobileMoneyCountryPolicy(response, accountId = null) {
  const invalid = () => { throw new Error('The backend did not return a supported Mobile Money country policy. Reload before saving.'); };
  if (!response || (accountId == null ? response.accountId !== null : String(response.accountId) !== String(accountId)) || typeof response.inherited !== 'boolean') invalid();
  const globalCountryCodes = mobileMoneyCountryCodes(response.globalCountryCodes);
  const effectiveCountryCodes = mobileMoneyCountryCodes(response.effectiveCountryCodes);
  const overrideCountryCodes = response.overrideCountryCodes === null ? null : mobileMoneyCountryCodes(response.overrideCountryCodes);
  if (response.inherited !== (overrideCountryCodes === null) || (accountId == null && overrideCountryCodes !== null)
      || !sameCountryCodes(effectiveCountryCodes, overrideCountryCodes ?? globalCountryCodes)) invalid();
  return { ...response, globalCountryCodes, effectiveCountryCodes, overrideCountryCodes };
}

export function mobileMoneyCountryName(code, countries, locale = 'en') {
  const french = String(locale).toLowerCase().startsWith('fr');
  if (code === 'CD') return french ? 'RD Congo' : 'DR Congo';
  if (code === 'CG') return french ? 'République du Congo (Congo-Brazzaville)' : 'Republic of the Congo (Congo-Brazzaville)';
  try {
    const name = new Intl.DisplayNames([french ? 'fr' : 'en'], { type: 'region' }).of(code);
    if (name && name !== code) return name;
  } catch { /* Keep the catalogue label when localization is unavailable. */ }
  return countries.find((country) => (country.cca2 || country.alpha2Code || country.code) === code)?.name || code;
}
