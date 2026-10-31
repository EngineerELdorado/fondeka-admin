const restrictedRoots = [
  '/dashboard/crypto', '/dashboard/loans', '/dashboard/savings',
  '/dashboard/fiat-wallets', '/dashboard/wallet-currency-audit', '/dashboard/wallet-migrations', '/dashboard/wallet-policy-config',
  '/dashboard/accounts/balances', '/dashboard/accounts/balance-activities', '/dashboard/accounts/transfers', '/dashboard/accounts/custom-fees',
  '/dashboard/payments/method-crypto-networks', '/dashboard/payment-requests/wallet-settlement-policy',
  '/dashboard/bank-deposit-proofs', '/dashboard/currency-products', '/dashboard/fiat-exchange-rates'
];

const normalize = (value) => String(value ?? '').replace(/([a-z\d])([A-Z])/g, '$1 $2').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function isRegulatorRestrictedService(value) {
  const normalized = normalize(value);
  if (/^saving(?:\.{3}|…)?$/.test(normalized)) return value === 'SAVING';
  return /(?:^|[^a-z])(wallets?|cryptos?|cryptocurrency|bitcoin|ethereum|tether|btc|eth|usdt|usdc|erc20|trc20|bep20|loans?|lending|savings|epargne|prets?|portefeuilles?|avec|likelemba)(?:$|[^a-z])/.test(normalized)
    || /(?:personal|group)[^a-z]+saving|saving[^a-z]+group|inter[^a-z]*transfer|deposit[^a-z]*prompt/.test(normalized);
}

export function isRegulatorRestrictedRoute(href) {
  const raw = typeof href === 'object' ? `${href?.pathname || ''}?${new URLSearchParams(href?.query || {})}` : String(href || '');
  const url = new URL(raw, 'https://dashboard.local');
  if (restrictedRoots.some((root) => url.pathname === root || url.pathname.startsWith(`${root}/`))) return true;
  return [...url.searchParams].some(([key, value]) => /^(service|action|type|paymentMethodType|receiptType)$/i.test(key) && isRegulatorRestrictedService(value));
}

export function isRegulatorRestrictedRecord(record) {
  if (!record || typeof record !== 'object') return false;
  const fields = ['action', 'transactionAction', 'service', 'serviceType', 'type', 'category', 'transactionType', 'productType', 'currencyType', 'methodType', 'tool', 'key', 'flagKey', 'eventType', 'jobType', 'jobName', 'code', 'label', 'value'];
  return fields.some((key) => isRegulatorRestrictedService(record[key]))
    || isRegulatorRestrictedService(record.paymentMethodType)
    || isRegulatorRestrictedService(record.paymentMethod?.type)
    || isRegulatorRestrictedService(record.currencyProduct?.type);
}

export function regulatorVisibleFields(fields, enabled) {
  if (enabled === false) return fields;
  return fields.filter((field) => field != null && !field.regulatorRestricted && !isRegulatorRestrictedService(field.key) && !isRegulatorRestrictedService(field.label)
    && !/(?:^|[^a-z])(balance|solde|amount owed|montant du|previous debt|dette precedente|total profit|eligible loan)(?:$|[^a-z])/i.test(normalize(`${field.key || ''} ${field.label || ''}`)));
}

export function adminPresentationReady(profile) {
  return profile != null && typeof profile.enableRegulatorMode === 'boolean';
}
