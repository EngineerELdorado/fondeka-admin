const rawBase = process.env.NEXT_PUBLIC_ADMIN_API_BASE || '';
const normalizedBase = rawBase.replace(/\/+$/, '');
const ADMIN_API = normalizedBase.endsWith('/admin-api')
  ? normalizedBase
  : `${normalizedBase}/admin-api`;

let authToken = null;

const toUrl = (path) => `${path}`.replace(/(?<!:)\/{2,}/g, '/');

const normalizePath = (path) => {
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  if (withLeadingSlash.startsWith('/admin-api')) {
    const trimmed = withLeadingSlash.replace(/^\/admin-api/, '');
    return trimmed || '/';
  }
  return withLeadingSlash;
};

const withQuery = (base, query) => {
  if (!query) return base;
  if (query instanceof URLSearchParams) return `${base}?${query.toString()}`;
  return `${base}?${new URLSearchParams(query).toString()}`;
};

const toBody = (payload) => {
  if (payload === undefined || payload === null) return undefined;
  return typeof payload === 'string' ? payload : JSON.stringify(payload);
};

async function request(path, init) {
  const target = path.startsWith('http') ? path : `${ADMIN_API}${path}`;
  const res = await fetch(toUrl(target), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers || {})
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const data = await res.json();
        const message = data?.message || data?.error || data?.detail;
        const err = new Error(message ? String(message) : JSON.stringify(data));
        err.status = res.status;
        err.data = data;
        throw err;
      } catch (err) {
        const wrapped = new Error(err?.message || `Request failed with status ${res.status}`);
        wrapped.status = res.status;
        throw wrapped;
      }
    }

    const text = await res.text().catch(() => '');
    const err = new Error(text || `Request failed with status ${res.status}`);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

const call = (method, path, { query, body, headers } = {}) => {
  const normalized = normalizePath(path);
  const target = withQuery(normalized, query);
  return request(target, {
    method,
    ...(body !== undefined ? { body: toBody(body) } : {}),
    headers
  });
};

const crud = (resource) => ({
  list: (query) => request(withQuery(`/${resource}`, query)),
  get: (id) => request(`/${resource}/${id}`),
  create: (payload) => request(`/${resource}`, { method: 'POST', body: toBody(payload) }),
  update: (id, payload) => request(`/${resource}/${id}`, { method: 'PUT', body: toBody(payload) }),
  remove: (id) => request(`/${resource}/${id}`, { method: 'DELETE' })
});

const accounts = {
  list: (query) => request(withQuery('/accounts', query)),
  get: (id) => request(`/accounts/${id}`),
  checkAml: (id) => request(`/accounts/check-aml/${id}`),
  getCustomPricing: (id) => request(`/accounts/${id}/custom-pricing`),
  updateCustomPricing: (id, payload) => request(`/accounts/${id}/custom-pricing`, { method: 'PUT', body: toBody(payload) }),
  removeCustomPricing: (id) => request(`/accounts/${id}/custom-pricing`, { method: 'DELETE' }),
  creditWalletBonus: (accountId, payload) => request(`/accounts/${accountId}/wallet/credit`, { method: 'POST', body: toBody(payload) })
};

const admins = {
  list: (query) => request(withQuery('/admins', query)),
  get: (id) => request(`/admins/${id}`),
  create: (payload) => request('/admins', { method: 'POST', body: toBody(payload) }),
  update: (id, payload) => request(`/admins/${id}`, { method: 'PUT', body: toBody(payload) }),
  remove: (id) => request(`/admins/${id}`, { method: 'DELETE' }),
  resetPassword: (id) => request(`/admins/${id}/reset-password`, { method: 'GET' }),
  changeMyPassword: (payload) => request('/admins/change-my-password', { method: 'PATCH', body: toBody(payload) })
};

const kycs = {
  list: (query) => request(withQuery('/kycs', query)),
  get: (id) => request(`/kycs/${id}`),
  update: (id, payload) => request(`/kycs/${id}`, { method: 'PATCH', body: toBody(payload) })
};

const transactions = {
  list: (query) => request(withQuery('/transactions', query)),
  approve: (id, payload) => request(`/transactions/${id}/approve`, { method: 'PATCH', body: toBody(payload) }),
  reject: (id, payload) => request(`/transactions/${id}/reject`, { method: 'PATCH', body: toBody(payload) }),
  refundToWallet: (transactionId, payload) =>
    request(`/transactions/${transactionId}/refund-to-wallet`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) })
};

const caches = {
  list: (query) => request(withQuery('/caches', query)),
  evict: (payload) => request('/caches/evict', { method: 'POST', body: toBody(payload) })
};

const devices = {
  list: (query) => request(withQuery('/devices', query)),
  get: (deviceId) => request(`/devices/${deviceId}`),
  replacementRequests: (query) => request(withQuery('/devices/replacement-requests', query)),
  revoke: (deviceId) => request(`/devices/${deviceId}/revoke`, { method: 'POST' })
};

const loans = {
  list: (query) => request(withQuery('/loans', query)),
  get: (id) => request(`/loans/${id}`),
  approve: (id, payload) => request(`/loans/${id}/approve`, { method: 'PUT', body: toBody(payload) }),
  reject: (id, payload) => request(`/loans/${id}/reject`, { method: 'PUT', body: toBody(payload) })
};

const cards = {
  list: (query) => request(withQuery('/cards', query)),
  get: (id) => request(`/cards/${id}`),
  create: (payload) => request('/cards', { method: 'POST', body: toBody(payload) }),
  update: (id, payload) => request(`/cards/${id}`, { method: 'PUT', body: toBody(payload) }),
  remove: (id) => request(`/cards/${id}`, { method: 'DELETE' }),
  block: (id) => request(`/cards/${id}/block`, { method: 'POST' }),
  unblock: (id) => request(`/cards/${id}/unblock`, { method: 'POST' })
};

const apiCrudResources = {
  adminLoanDecisions: crud('admin-loan-decisions'),
  loanInstallments: crud('loan-installments'),
  loanInstallmentPayments: crud('loan-installment-payments'),
  accountBalances: crud('account-balances'),
  accountBalanceActivities: crud('account-balance-activities'),
  accountTransfers: crud('account-transfers'),
  users: crud('users'),
  contacts: crud('contacts'),
  addresses: crud('addresses'),
  paymentMethods: crud('payment-methods'),
  paymentProviders: crud('payment-providers'),
  paymentMethodPaymentProviders: crud('payment-method-payment-providers'),
  paymentMethodCryptoNetworks: crud('payment-method-crypto-networks'),
  feeConfigs: crud('fee-configs'),
  kycCaps: crud('kyc-caps'),
  reloadlyOperatorAmounts: crud('reloadly-operator-amounts'),
  billProducts: crud('bill-products'),
  billProviders: crud('bill-providers'),
  billProductBillProviders: crud('bill-product-bill-providers'),
  billProductBillProviderOptions: crud('bill-product-bill-provider-options'),
  billProductBillProviderOffers: crud('bill-product-bill-provider-offers'),
  billProductBillProviderOfferOptions: crud('bill-product-bill-provider-offer-options'),
  billPaymentIntents: crud('bill-payment-intents'),
  cardProducts: crud('card-products'),
  cardProviders: crud('card-providers'),
  cardProductCardProviders: crud('card-product-card-providers'),
  cardHolders: crud('card-holders'),
  cardActivities: crud('card-activities'),
  cardPurchaseIntents: crud('card-purchase-intents'),
  paymentRequests: crud('payment-requests'),
  paymentRequestItems: crud('payment-request-items'),
  paymentRequestPayments: crud('payment-request-payments'),
  countries: crud('countries'),
  provinces: crud('provinces'),
  territories: crud('territories'),
  municipalities: crud('municipalities'),
  cryptoNetworks: crud('crypto-networks'),
  cryptoProducts: crud('crypto-products'),
  cryptoProductCryptoNetworks: crud('crypto-product-crypto-networks'),
  cryptoWallets: crud('crypto-wallets'),
  cryptoInvoices: crud('crypto-invoices'),
  cryptoPriceHistory: crud('crypto-price-history'),
  savingProducts: crud('saving-products'),
  savings: crud('savings'),
  savingActivities: crud('saving-activities'),
  blacklist: crud('blacklist'),
  previousDebts: crud('previous-debts'),
  loanProducts: crud('loan-products'),
  beneficiaries: crud('beneficiaries'),
  beneficiaryPaymentMethods: crud('beneficiary-payment-methods'),
  providerTokens: crud('provider-tokens'),
  cegaWebTokens: crud('cega-web-tokens'),
  stripeCustomers: crud('stripe-customers'),
  airtimeProviders: crud('airtime-providers'),
  esimProviders: crud('esim-providers'),
  esims: crud('esims'),
  webhookEvents: crud('webhook-events'),
  kycJobs: crud('kyc-jobs')
};

export const api = {
  setAuthToken: (token) => {
    authToken = token || null;
  },
  raw: call,

  // Reports
  getReport: (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', String(startDate));
    if (endDate) params.set('endDate', String(endDate));
    return request(withQuery('/report', params), { method: 'GET' });
  },

  accounts,
  admins,
  kycs,
  transactions,
  caches,
  devices,
  loans,
  cards,
  ...apiCrudResources,

  // Backwards-compatible top-level helpers
  listAccounts: accounts.list,
  getAccount: accounts.get,
  getAccountPricing: accounts.getCustomPricing,
  updateAccountPricing: accounts.updateCustomPricing,
  removeAccountPricing: accounts.removeCustomPricing,
  checkAccountAml: accounts.checkAml,
  listAdmins: admins.list,
  createAdmin: admins.create,
  updateAdmin: admins.update,
  deleteAdmin: admins.remove,
  resetAdminPassword: admins.resetPassword,
  changeMyPassword: admins.changeMyPassword,
  listLoans: loans.list,
  getLoan: loans.get,
  approveLoan: loans.approve,
  rejectLoan: loans.reject,
  listKycs: kycs.list,
  getKyc: kycs.get,
  updateKyc: kycs.update,
  listTransactions: transactions.list,
  approveTransaction: transactions.approve,
  rejectTransaction: transactions.reject
};
