export const fundingScopeOptions = ['SAME_PROVIDER', 'ANY_PROVIDER'];
export function normalizeFundingExemptions(value, countries) {
  if (!Array.isArray(value)) throw new Error('Country exceptions must be a list. Refresh the provider before editing.');
  const allowed = countries ? new Set(countries.map((country) => String(country.cca2 || country.alpha2Code || country.code).toUpperCase())) : null;
  const codes = value.map((code) => {
    if (typeof code !== 'string') throw new Error('Choose valid ISO two-letter countries; blank or null entries are not allowed.');
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized) || (allowed && !allowed.has(normalized))) throw new Error(`Invalid destination country: ${code || '(blank)'}. Choose a supported two-letter country.`);
    return normalized;
  });
  return [...new Set(codes)];
}
export function providerPolicyPermissions(session) {
  const roles = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload]
    .flatMap((payload) => [payload?.['cognito:groups'], payload?.groups]).flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((role) => String(role).trim().toUpperCase());
  return { canWrite: roles.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role)) };
}
export function paymentProviderPayload(state, countries) {
  if (!fundingScopeOptions.includes(state.sameFundingDestinationScope) && state.sameFundingDestinationScope !== null) throw new Error('Choose Same provider or Any provider as the funding scope.');
  return {
    name: String(state.name || '').trim(), active: Boolean(state.active), requireSameFundingDestinationForPayout: Boolean(state.requireSameFundingDestinationForPayout), sameFundingDestinationScope: state.sameFundingDestinationScope,
    ...(state.sameFundingDestinationExemptCountryCodes === null ? {} : { sameFundingDestinationExemptCountryCodes: normalizeFundingExemptions(state.sameFundingDestinationExemptCountryCodes, countries) })
  };
}
export function paymentProviderDraft(row) {
  return { name: row.name ?? '', active: Boolean(row.active), requireSameFundingDestinationForPayout: Boolean(row.requireSameFundingDestinationForPayout), sameFundingDestinationScope: row.sameFundingDestinationScope ?? null,
    sameFundingDestinationExemptCountryCodes: Array.isArray(row.sameFundingDestinationExemptCountryCodes) ? normalizeFundingExemptions(row.sameFundingDestinationExemptCountryCodes) : null };
}
export function providerPolicySnapshot(row) {
  const value = paymentProviderPayload(paymentProviderDraft(row));
  if (value.sameFundingDestinationExemptCountryCodes) value.sameFundingDestinationExemptCountryCodes.sort();
  return JSON.stringify(value);
}
const scopeText = (value) => value === 'ANY_PROVIDER' ? 'any mobile-money provider' : 'the same provider';
const exceptions = (provider) => Array.isArray(provider?.sameFundingDestinationExemptCountryCodes) ? provider.sameFundingDestinationExemptCountryCodes.join(', ') || 'None' : 'Not reported';
export function providerFundingPolicy(provider) {
  if (typeof provider?.requireSameFundingDestinationForPayout !== 'boolean') return 'Payout source policy not reported';
  if (!provider.requireSameFundingDestinationForPayout) return 'Prior-funding check disabled for all countries';
  return `Prior funding through ${scopeText(provider.sameFundingDestinationScope)} required · Country exceptions: ${exceptions(provider)}`;
}
export function routeFundingPolicy(route, provider) {
  const source = typeof route?.requireSameFundingDestinationForPayout === 'boolean' ? route : provider || route;
  // Use the backend's resolved route decision. Never derive eligibility from a sender's country.
  if (route?.sameFundingDestinationEnforcedForCountry === true) return `Prior funding through ${scopeText(source?.sameFundingDestinationScope)} required`;
  if (route?.sameFundingDestinationEnforcedForCountry === false) {
    if (source?.requireSameFundingDestinationForPayout === false) return 'Prior-funding check disabled for all countries';
    const country = String(route?.countryCode || '').trim().toUpperCase();
    if (country && source?.requireSameFundingDestinationForPayout === true && Array.isArray(source.sameFundingDestinationExemptCountryCodes) && source.sameFundingDestinationExemptCountryCodes.includes(country)) return `${country} country exception · No prior-funding check`;
    return 'Prior-funding check not required for this route';
  }
  if (source?.requireSameFundingDestinationForPayout === false) return 'Prior-funding check disabled for all countries';
  if (source?.requireSameFundingDestinationForPayout === true) return 'Prior-funding policy enabled · Country enforcement not reported';
  return 'Payout source policy not reported';
}
