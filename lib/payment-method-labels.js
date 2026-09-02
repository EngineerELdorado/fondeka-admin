const present = (value) => value !== null && value !== undefined && String(value).trim() !== '';

const pickFirst = (...values) => values.find(present);

const normalizeUpper = (value) => (present(value) ? String(value).trim().toUpperCase() : '');

const uniqueParts = (parts) => {
  const seen = new Set();
  return parts.filter((part) => {
    const normalized = normalizeUpper(part);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export const paymentMethodAdminLabel = (method, fallback = '—') => {
  if (!method || typeof method !== 'object') return fallback;
  const id = pickFirst(method.paymentMethodId, method.id);
  const name = pickFirst(method.paymentMethodName, method.name, method.paymentMethodCode, method.code, id ? `Method #${id}` : null);
  if (!name) return fallback;

  const country = pickFirst(
    method.paymentMethodCountryCode,
    method.countryCode,
    method.paymentMethodCountryName,
    method.countryName,
    method.country?.code,
    method.country?.name
  );
  const currency = pickFirst(method.paymentMethodCurrency, method.currency);
  const details = uniqueParts([country, currency]);

  return details.length > 0 ? `${name} • ${details.join(' • ')}` : String(name);
};

export const paymentMethodRouteAdminLabel = (route, fallback = 'Method') => (
  paymentMethodAdminLabel(route, fallback)
);
