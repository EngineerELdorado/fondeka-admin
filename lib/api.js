const rawBase = process.env.NEXT_PUBLIC_ADMIN_API_BASE || '';
const normalizedBase = rawBase.replace(/\/+$/, '');
const ADMIN_API = normalizedBase.endsWith('/admin-api')
  ? normalizedBase
  : `${normalizedBase}/admin-api`;

let authToken = null;
let forbiddenLogoutTriggered = false;
const FORBIDDEN_LOGOUT_EVENT = 'fondeka:auth-forbidden';

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
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const res = await fetch(toUrl(target), {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      'ngrok-skip-browser-warning': '69420',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers || {})
    },
    cache: 'no-store'
  });

  if (res.status === 403 && typeof window !== 'undefined' && !forbiddenLogoutTriggered) {
    forbiddenLogoutTriggered = true;
    window.dispatchEvent(new CustomEvent(FORBIDDEN_LOGOUT_EVENT));
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      let data = null;
      try {
        data = await res.json();
      } catch (_parseErr) {
        data = null;
      }
      const message = data?.message || data?.error || data?.detail;
      const err = new Error(message ? String(message) : `Request failed with status ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
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

const requestWithTimeout = async (path, init, timeoutMs = 60000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await request(path, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

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
  update: (id, payload) => request(`/accounts/${id}`, { method: 'PATCH', body: toBody(payload) }),
  updateAuthEnforcement: (accountId, payload) => request(`/accounts/${accountId}/auth-enforcement`, { method: 'PATCH', body: toBody(payload) }),
  updateCountry: (accountId, payload) => request(`/accounts/${accountId}/country`, { method: 'PATCH', body: toBody(payload) }),
  updatePhone: (accountId, payload) => request(`/accounts/${accountId}/phone`, { method: 'PATCH', body: toBody(payload) }),
  setAppVersionOverride: (accountId, payload) =>
    request(`/accounts/${accountId}/app-version`, { method: 'PATCH', body: toBody(payload) }),
  getLoanEligibility: (id) => request(`/accounts/${id}/loan-eligibility`),
  getEffectiveCaps: (id) => request(`/accounts/${id}/effective-caps`),
  updateLegacyLoanEligibilityAmount: (accountId, payload) =>
    request(`/accounts/${accountId}/loan-eligibility/legacy-amount`, { method: 'PATCH', body: toBody(payload) }),
  checkAml: (id) => request(`/accounts/check-aml/${id}`),
  getCustomPricing: (id) => request(`/accounts/${id}/custom-kyc-caps`),
  updateCustomPricing: (id, payload) => request(`/accounts/${id}/custom-kyc-caps`, { method: 'PUT', body: toBody(payload) }),
  removeCustomPricing: (id) => request(`/accounts/${id}/custom-kyc-caps`, { method: 'DELETE' }),
  creditWallet: (accountId, payload) => request(`/accounts/${accountId}/wallet/credit`, { method: 'POST', body: toBody(payload) }),
  debitWallet: (accountId, payload) => request(`/accounts/${accountId}/wallet/debit`, { method: 'POST', body: toBody(payload) }),
  blacklist: (accountId, payload) => request(`/accounts/${accountId}/blacklist`, { method: 'POST', body: toBody(payload) }),
  removeFromBlacklist: (accountId) => request(`/accounts/${accountId}/blacklist`, { method: 'DELETE' }),
  notifications: {
    list: (accountId, query) => request(withQuery(`/accounts/${accountId}/notifications`, query))
  },
  guideVideoSettings: {
    get: (accountId) => request(`/accounts/${accountId}/guide-videos/settings`),
    update: (accountId, payload) => request(`/accounts/${accountId}/guide-videos/settings`, { method: 'PUT', body: toBody(payload) }),
    remove: (accountId) => request(`/accounts/${accountId}/guide-videos/settings`, { method: 'DELETE' }),
    getByEmail: (accountId, email) => request(`/accounts/${accountId}/guide-videos/settings/by-email/${encodeURIComponent(email)}`),
    updateByEmail: (accountId, email, payload) =>
      request(`/accounts/${accountId}/guide-videos/settings/by-email/${encodeURIComponent(email)}`, { method: 'PUT', body: toBody(payload) }),
    removeByEmail: (accountId, email) => request(`/accounts/${accountId}/guide-videos/settings/by-email/${encodeURIComponent(email)}`, { method: 'DELETE' })
  },
  feeConfigs: {
    list: (accountId) => request(`/accounts/${accountId}/custom-fees`),
    create: (accountId, payload) => request(`/accounts/${accountId}/custom-fees`, { method: 'POST', body: toBody(payload) }),
    update: (accountId, feeId, payload) => request(`/accounts/${accountId}/custom-fees/${feeId}`, { method: 'PUT', body: toBody(payload) }),
    remove: (accountId, feeId) => request(`/accounts/${accountId}/custom-fees/${feeId}`, { method: 'DELETE' })
  },
  billProductOverrides: {
    list: (accountId) => request(`/accounts/${accountId}/bill-product-overrides`),
    upsert: (accountId, billProductId, payload) =>
      request(`/accounts/${accountId}/bill-product-overrides/${billProductId}`, { method: 'PUT', body: toBody(payload) }),
    remove: (accountId, billProductId) =>
      request(`/accounts/${accountId}/bill-product-overrides/${billProductId}`, { method: 'DELETE' })
  },
  providerRouting: {
    list: (accountId) => request(`/accounts/${accountId}/provider-routing`),
    create: (accountId, payload) => request(`/accounts/${accountId}/provider-routing`, { method: 'POST', body: toBody(payload) }),
    update: (accountId, routingId, payload) => request(`/accounts/${accountId}/provider-routing/${routingId}`, { method: 'PUT', body: toBody(payload) }),
    remove: (accountId, routingId) => request(`/accounts/${accountId}/provider-routing/${routingId}`, { method: 'DELETE' })
  },
  cardPrices: {
    list: (accountId) => request(`/accounts/${accountId}/custom-card-prices`),
    create: (accountId, payload) => request(`/accounts/${accountId}/custom-card-prices`, { method: 'POST', body: toBody(payload) }),
    update: (accountId, id, payload) => request(`/accounts/${accountId}/custom-card-prices/${id}`, { method: 'PUT', body: toBody(payload) }),
    remove: (accountId, id) => request(`/accounts/${accountId}/custom-card-prices/${id}`, { method: 'DELETE' })
  },
  cardProviderStatusOverrides: {
    list: (accountId) => request(`/accounts/${accountId}/card-provider-status-overrides`),
    create: (accountId, payload) => request(`/accounts/${accountId}/card-provider-status-overrides`, { method: 'POST', body: toBody(payload) }),
    update: (accountId, id, payload) => request(`/accounts/${accountId}/card-provider-status-overrides/${id}`, { method: 'PUT', body: toBody(payload) }),
    remove: (accountId, id) => request(`/accounts/${accountId}/card-provider-status-overrides/${id}`, { method: 'DELETE' })
  },
  loanRates: {
    list: (accountId) => request(`/accounts/${accountId}/custom-loan-rates`),
    create: (accountId, payload) => request(`/accounts/${accountId}/custom-loan-rates`, { method: 'POST', body: toBody(payload) }),
    update: (accountId, id, payload) => request(`/accounts/${accountId}/custom-loan-rates/${id}`, { method: 'PUT', body: toBody(payload) }),
    remove: (accountId, id) => request(`/accounts/${accountId}/custom-loan-rates/${id}`, { method: 'DELETE' })
  },
  cryptoRates: {
    list: (accountId) => request(`/accounts/${accountId}/custom-crypto-rates`),
    upsert: (accountId, payload) => request(`/accounts/${accountId}/custom-crypto-rates`, { method: 'PUT', body: toBody(payload) }),
    remove: (accountId, id) => request(`/accounts/${accountId}/custom-crypto-rates/${id}`, { method: 'DELETE' })
  },
  cryptoLimits: {
    list: (accountId) => request(`/accounts/${accountId}/custom-crypto-limits`),
    upsert: (accountId, payload) => request(`/accounts/${accountId}/custom-crypto-limits`, { method: 'POST', body: toBody(payload) }),
    remove: (accountId, id) => request(`/accounts/${accountId}/custom-crypto-limits/${id}`, { method: 'DELETE' })
  }
};

const cardProviderStatusOverrides = {
  list: (query) => request(withQuery('/card-provider-status-overrides', query)),
  create: (payload) => request('/card-provider-status-overrides', { method: 'POST', body: toBody(payload) }),
  update: (id, payload) => request(`/card-provider-status-overrides/${id}`, { method: 'PUT', body: toBody(payload) }),
  remove: (id) => request(`/card-provider-status-overrides/${id}`, { method: 'DELETE' })
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
  update: (id, payload) => request(`/kycs/${id}`, { method: 'PUT', body: toBody(payload) }),
  updateStatus: (id, payload) => request(`/kycs/${id}/status`, { method: 'PATCH', body: toBody(payload) }),
  updateLevel: (id, payload) => request(`/kycs/${id}/level`, { method: 'PATCH', body: toBody(payload) }),
  uploadBackupDocuments: (id, files = {}) => {
    const formData = new FormData();
    if (files.docFront) formData.append('docFront', files.docFront);
    if (files.docBack) formData.append('docBack', files.docBack);
    if (files.selfie) formData.append('selfie', files.selfie);
    return request(`/kycs/${id}/backup-documents`, { method: 'POST', body: formData });
  },
  refreshSmileIdResult: (id) => request(`/kycs/${id}/smileid-result`, { method: 'POST' }),
  smileIdReenroll: (id) => request(`/kycs/${id}/smileid/reenroll`, { method: 'POST' }),
  smileIdDelete: (id) => request(`/kycs/${id}/smileid/delete`, { method: 'POST' }),
  syncUserNames: (id) => request(`/kycs/${id}/sync-user-names`, { method: 'POST' }),
  syncSmileIdImages: (id) => request(`/kycs/${id}/sync-smileid-images`, { method: 'POST' })
};

const transactions = {
  list: (query) => request(withQuery('/transactions', query)),
  get: (transactionId) => request(`/transactions/${transactionId}`),
  fundedStuckReport: (query) => request(withQuery('/transactions/funded-stuck-report', query)),
  fundedStuckItems: (query) => request(withQuery('/transactions/funded-stuck-items', query)),
  manualReconciliationEligibility: (transactionId) => request(`/transactions/${transactionId}/manual-reconciliation/eligibility`),
  publishManualReconciliationHash: (transactionId, payload) =>
    request(`/transactions/${transactionId}/manual-reconciliation/hash`, { method: 'POST', body: toBody(payload) }),
  completeManualReconciliation: (transactionId, payload) =>
    request(`/transactions/${transactionId}/manual-reconciliation/complete`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
  failManualReconciliation: (transactionId, payload) =>
    request(`/transactions/${transactionId}/manual-reconciliation/fail`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
  cancelManualReconciliation: (transactionId, payload) =>
    request(`/transactions/${transactionId}/manual-reconciliation/cancel`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
  updateStatus: (transactionId, payload) => request(`/transactions/${transactionId}/status`, { method: 'PATCH', body: toBody(payload) }),
  approve: (id, payload) => request(`/transactions/${id}/approve`, { method: 'PATCH', body: toBody(payload) }),
  reject: (id, payload) => request(`/transactions/${id}/reject`, { method: 'PATCH', body: toBody(payload) }),
  completeBankPayout: (transactionId, payload) =>
    request(`/transactions/${transactionId}/bank-payout/complete`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
  momoStatus: (transactionId) => request(`/transactions/${transactionId}/momo-status`),
  refundToWallet: (transactionId, payload) =>
    request(`/transactions/${transactionId}/refund-to-wallet`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
  refundLookupByInternalReference: (internalReference) =>
    request(withQuery('/transactions/refunds/by-internal-reference', { internalReference })),
  refundLookupByTransactionId: (transactionId) => request(`/transactions/${transactionId}/refunds/lookup`),
  replayLoanFulfillment: (transactionId, railLabel) =>
    request(withQuery(`/transactions/${transactionId}/loan-fulfillment/replay`, railLabel ? { railLabel } : {}), { method: 'POST' }),
  retryPostWebhook: (transactionId, payload) =>
    request(`/transactions/${transactionId}/post-webhook/retry`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
  refetchBillStatus: (transactionId) => request(`/transactions/${transactionId}/bill-status/refetch`, { method: 'POST' }),
  getReceipt: (transactionId) => request(`/transactions/${transactionId}/receipt`),
  upsertReceipt: (transactionId, payload) => request(`/transactions/${transactionId}/receipt`, { method: 'PUT', body: toBody(payload) }),
  deleteReceipt: (transactionId) => request(`/transactions/${transactionId}/receipt`, { method: 'DELETE' })
};

const caches = {
  list: (query) => request(withQuery('/caches', query)),
  evict: (payload) => request('/caches/evict', { method: 'POST', body: toBody(payload) })
};

const featureFlags = {
  list: () => request('/feature-flags'),
  get: (key) => request(`/feature-flags/${key}`),
  update: (key, payload) => request(`/feature-flags/${key}`, { method: 'PUT', body: toBody(payload) }),
  remove: (key) => request(`/feature-flags/${key}`, { method: 'DELETE' }),
  listOverrides: (key) => request(`/feature-flags/${encodeURIComponent(key)}/overrides`),
  listCountryOverrides: (key) => request(`/feature-flags/${encodeURIComponent(key)}/country-overrides`),
  upsertOverride: (key, accountId, payload) =>
    request(`/feature-flags/${encodeURIComponent(key)}/overrides/${encodeURIComponent(accountId)}`, { method: 'PUT', body: toBody(payload) }),
  upsertCountryOverride: (key, countryCode, payload) =>
    request(`/feature-flags/${encodeURIComponent(key)}/country-overrides/${encodeURIComponent(countryCode)}`, { method: 'PUT', body: toBody(payload) }),
  removeOverride: (key, accountId) =>
    request(`/feature-flags/${encodeURIComponent(key)}/overrides/${encodeURIComponent(accountId)}`, { method: 'DELETE' }),
  removeCountryOverride: (key, countryCode) =>
    request(`/feature-flags/${encodeURIComponent(key)}/country-overrides/${encodeURIComponent(countryCode)}`, { method: 'DELETE' }),
  upsertOverrideByEmail: (key, email, payload) =>
    request(`/feature-flags/${encodeURIComponent(key)}/overrides/by-email/${encodeURIComponent(email)}`, {
      method: 'PUT',
      body: toBody(payload)
    }),
  removeOverrideByEmail: (key, email) =>
    request(`/feature-flags/${encodeURIComponent(key)}/overrides/by-email/${encodeURIComponent(email)}`, { method: 'DELETE' })
};

const cronJobs = {
  list: () => request('/cron-jobs'),
  pause: (key) => request(`/cron-jobs/${encodeURIComponent(key)}/pause`, { method: 'PUT' }),
  unpause: (key) => request(`/cron-jobs/${encodeURIComponent(key)}/unpause`, { method: 'PUT' })
};

const appVersion = {
  get: () => request('/app-version'),
  update: (payload) => request('/app-version', { method: 'PUT', body: toBody(payload) }),
  listServiceRules: () => request('/app-version/services'),
  getServiceRule: (service) => request(`/app-version/services/${service}`),
  updateServiceRule: (service, payload) => request(`/app-version/services/${service}`, { method: 'PUT', body: toBody(payload) }),
  removeServiceRule: (service) => request(`/app-version/services/${service}`, { method: 'DELETE' })
};

const kycDefaultLevels = {
  getGlobal: () => request('/kyc-default-levels/global'),
  setGlobal: (payload) => request('/kyc-default-levels/global', { method: 'PUT', body: toBody(payload) })
};

const walletPolicyConfig = {
  get: () => request('/wallet-policy-config'),
  update: (payload) => request('/wallet-policy-config', { method: 'PUT', body: toBody(payload) })
};

const guideVideos = {
  get: () => request('/guide-videos'),
  update: (payload) => request('/guide-videos', { method: 'PUT', body: toBody(payload) }),
  getSettings: () => request('/guide-videos/settings'),
  updateSettings: (payload) => request('/guide-videos/settings', { method: 'PUT', body: toBody(payload) })
};

const loanEligibilityRules = {
  list: (query) => request(withQuery('/loan-eligibility-rules', query)),
  get: (id) => request(`/loan-eligibility-rules/${id}`),
  create: (payload) => request('/loan-eligibility-rules', { method: 'POST', body: toBody(payload) }),
  update: (id, payload) => request(`/loan-eligibility-rules/${id}`, { method: 'PUT', body: toBody(payload) }),
  remove: (id) => request(`/loan-eligibility-rules/${id}`, { method: 'DELETE' }),
  preview: (payload) => request('/loan-eligibility-rules/preview', { method: 'POST', body: toBody(payload) })
};

const groupSavings = {
  list: (query) => request(withQuery('/group-savings', query)),
  get: (id) => request(`/group-savings/${id}`),
  update: (id, payload) => request(`/group-savings/${id}`, { method: 'PUT', body: toBody(payload) }),
  updateLikelembaLoanEligibility: (id, payload) =>
    request(`/group-savings/${id}/likelemba-loan-eligibility`, { method: 'PUT', body: toBody(payload) }),
  activate: (id) => request(`/group-savings/${id}/activate`, { method: 'POST' }),
  restart: (id) => request(`/group-savings/${id}/restart`, { method: 'POST' }),
  restore: (id) => request(`/group-savings/${id}/restore`, { method: 'POST' }),
  pause: (id) => request(`/group-savings/${id}/pause`, { method: 'POST' }),
  resume: (id) => request(`/group-savings/${id}/resume`, { method: 'POST' }),
  remove: (id) => request(`/group-savings/${id}`, { method: 'DELETE' }),
  members: {
    list: (id, query) => request(withQuery(`/group-savings/${id}/members`, query)),
    update: (id, memberId, payload) => request(`/group-savings/${id}/members/${memberId}`, { method: 'PUT', body: toBody(payload) }),
    updateGovernance: (id, memberId, payload) =>
      request(`/group-savings/${id}/members/${memberId}/governance`, { method: 'PUT', body: toBody(payload) }),
    remove: (id, memberId) => request(`/group-savings/${id}/members/${memberId}/remove`, { method: 'POST' }),
    restore: (id, memberId) => request(`/group-savings/${id}/members/${memberId}/restore`, { method: 'POST' })
  },
  cycles: {
    list: (id, query) => request(withQuery(`/group-savings/${id}/cycles`, query)),
    contributions: (groupId, cycleId, query) => request(withQuery(`/group-savings/${groupId}/cycles/${cycleId}/contributions`, query)),
    releasePayout: (groupId, cycleId) => request(`/group-savings/${groupId}/cycles/${cycleId}/release-payout`, { method: 'POST' }),
    repairReleasePayout: (groupId, cycleId, payload) =>
      request(`/group-savings/${groupId}/cycles/${cycleId}/repair-release-payout`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    forceReleasePayout: (groupId, cycleId, payload) =>
      request(`/group-savings/${groupId}/cycles/${cycleId}/force-release-payout`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    reconcileFunding: (groupId, cycleId, payload) =>
      request(`/group-savings/${groupId}/cycles/${cycleId}/reconcile-funding`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    forceMarkFunded: (groupId, cycleId, payload) =>
      request(`/group-savings/${groupId}/cycles/${cycleId}/force-mark-funded`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    remindMember: (groupId, cycleId, memberId) =>
      request(`/group-savings/${groupId}/cycles/${cycleId}/members/${memberId}/remind`, { method: 'POST' }),
    remindUnpaid: (groupId, cycleId, payload) =>
      request(`/group-savings/${groupId}/cycles/${cycleId}/remind-unpaid`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) })
  },
  contributions: {
    list: (id, query) => request(withQuery(`/group-savings/${id}/contributions`, query)),
    completePayment: (groupId, contributionId, payload) =>
      request(`/group-savings/${groupId}/contributions/${contributionId}/complete-payment`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    forceFail: (groupId, contributionId, payload) =>
      request(`/group-savings/${groupId}/contributions/${contributionId}/force-fail`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    forceCancel: (groupId, contributionId, payload) =>
      request(`/group-savings/${groupId}/contributions/${contributionId}/force-cancel`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    reopenForRetry: (groupId, contributionId, payload) =>
      request(`/group-savings/${groupId}/contributions/${contributionId}/reopen-for-retry`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) })
  },
  payouts: {
    list: (id, query) => request(withQuery(`/group-savings/${id}/payouts`, query)),
    forceComplete: (groupId, payoutId, payload) =>
      request(`/group-savings/${groupId}/payouts/${payoutId}/force-complete`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    forceFail: (groupId, payoutId, payload) =>
      request(`/group-savings/${groupId}/payouts/${payoutId}/force-fail`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    forceCancel: (groupId, payoutId, payload) =>
      request(`/group-savings/${groupId}/payouts/${payoutId}/force-cancel`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) })
  },
  loans: {
    list: (id, query) => request(withQuery(`/group-savings/${id}/loans`, query)),
    get: (groupId, loanId) => request(`/group-savings/${groupId}/loans/${loanId}`),
    repayments: (groupId, loanId, query) => request(withQuery(`/group-savings/${groupId}/loans/${loanId}/repayments`, query)),
    approve: (groupId, loanId) => request(`/group-savings/${groupId}/loans/${loanId}/approve`, { method: 'POST' }),
    forceApprove: (groupId, loanId, payload) =>
      request(`/group-savings/${groupId}/loans/${loanId}/force-approve`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    reject: (groupId, loanId) => request(`/group-savings/${groupId}/loans/${loanId}/reject`, { method: 'POST' }),
    forceReject: (groupId, loanId, payload) =>
      request(`/group-savings/${groupId}/loans/${loanId}/force-reject`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    disburse: (groupId, loanId) => request(`/group-savings/${groupId}/loans/${loanId}/disburse`, { method: 'POST' }),
    forceDisburse: (groupId, loanId, payload) =>
      request(`/group-savings/${groupId}/loans/${loanId}/force-disburse`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    completeRepaymentPayment: (groupId, loanId, repaymentId, payload) =>
      request(`/group-savings/${groupId}/loans/${loanId}/repayments/${repaymentId}/complete-payment`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) })
  },
  repayments: {
    list: (id, query) => request(withQuery(`/group-savings/${id}/repayments`, query))
  },
  treasuryWithdrawals: {
    list: (id, query) => request(withQuery(`/group-savings/${id}/treasury/withdrawals`, query)),
    get: (groupId, withdrawalId) => request(`/group-savings/${groupId}/treasury/withdrawals/${withdrawalId}`),
    approve: (groupId, withdrawalId) => request(`/group-savings/${groupId}/treasury/withdrawals/${withdrawalId}/approve`, { method: 'POST' }),
    forceApprove: (groupId, withdrawalId, payload) =>
      request(`/group-savings/${groupId}/treasury/withdrawals/${withdrawalId}/force-approve`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    reject: (groupId, withdrawalId) => request(`/group-savings/${groupId}/treasury/withdrawals/${withdrawalId}/reject`, { method: 'POST' }),
    forceReject: (groupId, withdrawalId, payload) =>
      request(`/group-savings/${groupId}/treasury/withdrawals/${withdrawalId}/force-reject`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    disburse: (groupId, withdrawalId) => request(`/group-savings/${groupId}/treasury/withdrawals/${withdrawalId}/disburse`, { method: 'POST' }),
    forceDisburse: (groupId, withdrawalId, payload) =>
      request(`/group-savings/${groupId}/treasury/withdrawals/${withdrawalId}/force-disburse`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    repairDisbursement: (groupId, withdrawalId, payload) =>
      request(`/group-savings/${groupId}/treasury/withdrawals/${withdrawalId}/repair-disbursement`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) })
  },
  treasuryContributions: {
    completePayment: (groupId, transactionId, payload) =>
      request(`/group-savings/${groupId}/treasury/contributions/${transactionId}/complete-payment`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) })
  },
  auditEvents: {
    list: (id, query) => request(withQuery(`/group-savings/${id}/audit-events`, query))
  },
  invitations: {
    list: (id, query) => request(withQuery(`/group-savings/${id}/invitations`, query)),
    create: (id, payload) => request(`/group-savings/${id}/invitations`, { method: 'POST', body: toBody(payload) }),
    update: (id, invitationId, payload) => request(`/group-savings/${id}/invitations/${invitationId}`, { method: 'PUT', body: toBody(payload) }),
    approve: (id, invitationId) => request(`/group-savings/${id}/invitations/${invitationId}/approve`, { method: 'POST' })
  },
  joinRequests: {
    list: (id, query) => request(withQuery(`/group-savings/${id}/join-requests`, query)),
    approve: (id, invitationId) => request(`/group-savings/${id}/join-requests/${invitationId}/approve`, { method: 'POST' }),
    reject: (id, invitationId) => request(`/group-savings/${id}/join-requests/${invitationId}/reject`, { method: 'POST' })
  },
  messages: {
    list: (id, query) => request(withQuery(`/group-savings/${id}/messages`, query)),
    create: (id, payload) => request(`/group-savings/${id}/messages`, { method: 'POST', body: toBody(payload) }),
    remove: (id, eventId) => request(`/group-savings/${id}/messages/${eventId}`, { method: 'DELETE' })
  },
  policy: {
    get: (id) => request(`/group-savings/${id}/policy`),
    update: (id, payload) => request(`/group-savings/${id}/policy`, { method: 'PUT', body: toBody(payload) })
  },
  policyChanges: {
    list: (id, query) => request(withQuery(`/group-savings/${id}/policy-changes`, query)),
    cancel: (groupId, policyChangeId, payload) =>
      request(`/group-savings/${groupId}/policy-changes/${policyChangeId}/cancel`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) })
  },
  settlements: {
    distribute: (id, payload) => request(`/group-savings/${id}/settlements/distribute`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    forceDistribute: (id, payload) => request(`/group-savings/${id}/settlements/force-distribute`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    closeWithDeficit: (id, payload) => request(`/group-savings/${id}/settlements/close-with-deficit`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
    forceCloseWithDeficit: (id, payload) => request(`/group-savings/${id}/settlements/force-close-with-deficit`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) })
  }
};

const registrationPolicyConfig = {
  get: () => request('/registration-policy-config'),
  update: (payload) => request('/registration-policy-config', { method: 'PUT', body: toBody(payload) })
};

const smileIdFraudBlacklistPolicy = {
  get: () => request('/kyc-smileid-fraud-blacklist-policy'),
  update: (payload) => request('/kyc-smileid-fraud-blacklist-policy', { method: 'PUT', body: toBody(payload) })
};

const rechargeCatalogSync = {
  list: () => request('/recharge-catalog-sync'),
  trigger: (providerName) => request(`/recharge-catalog-sync/${encodeURIComponent(providerName)}/trigger`, { method: 'POST' }),
  clear: (providerName) => request(`/recharge-catalog-sync/${encodeURIComponent(providerName)}/clear`, { method: 'POST' })
};

const rechargeCatalog = {
  list: (query) => request(withQuery('/recharge-catalog', query)),
  get: (offerId) => request(`/recharge-catalog/${encodeURIComponent(offerId)}`),
  getDataBundlePolicy: () => request('/recharge-catalog/data-bundle-policy'),
  updateDataBundlePolicy: (payload) => request('/recharge-catalog/data-bundle-policy', { method: 'PUT', body: toBody(payload) })
};

const rechargeOperatorAvailabilityPolicies = {
  list: (query) => request(withQuery('/recharge-operator-availability-policies', query)),
  create: (payload) => request('/recharge-operator-availability-policies', { method: 'POST', body: toBody(payload) }),
  update: (id, payload) => request(`/recharge-operator-availability-policies/${id}`, { method: 'PUT', body: toBody(payload) }),
  updateActive: (id, active) => request(`/recharge-operator-availability-policies/${id}/active`, { method: 'PATCH', body: toBody({ active: Boolean(active) }) }),
  remove: (id) => request(`/recharge-operator-availability-policies/${id}`, { method: 'DELETE' })
};

const rechargeOperatorProviderRoutes = {
  list: (query) => request(withQuery('/recharge-operator-provider-routes', query)),
  get: (id) => request(`/recharge-operator-provider-routes/${id}`),
  create: (payload) => request('/recharge-operator-provider-routes', { method: 'POST', body: toBody(payload) }),
  update: (id, payload) => request(`/recharge-operator-provider-routes/${id}`, { method: 'PUT', body: toBody(payload) }),
  updateActive: (id, active) => request(`/recharge-operator-provider-routes/${id}/active`, { method: 'PATCH', body: toBody({ active: Boolean(active) }) }),
  remove: (id) => request(`/recharge-operator-provider-routes/${id}`, { method: 'DELETE' })
};

const utilityBillCatalog = {
  list: (query) => request(withQuery('/utility-bill-catalog', query)),
  get: (id) => request(`/utility-bill-catalog/${encodeURIComponent(id)}`)
};

const utilityBillCatalogSync = {
  list: () => request('/utility-bill-catalog-sync'),
  trigger: (providerName) => request(`/utility-bill-catalog-sync/${encodeURIComponent(providerName)}/trigger`, { method: 'POST' })
};

const esimCatalogSync = {
  list: () => request('/esim-catalog-sync'),
  trigger: (providerName) => request(`/esim-catalog-sync/${encodeURIComponent(providerName)}/trigger`, { method: 'POST' })
};

const devices = {
  list: (query) => request(withQuery('/devices', query)),
  get: (deviceId) => request(`/devices/${deviceId}`),
  policy: {
    get: () => request('/devices/policy'),
    update: (payload) => request('/devices/policy', { method: 'PUT', body: toBody(payload) })
  },
  accountPolicy: {
    get: (accountId) => request(`/devices/accounts/${accountId}/policy`),
    update: (accountId, payload) => request(`/devices/accounts/${accountId}/policy`, { method: 'PUT', body: toBody(payload) })
  },
  recovery: {
    getByAccount: (accountId) => request(`/devices/accounts/${accountId}/recovery`),
    historyByAccount: (accountId, query) => request(withQuery(`/devices/accounts/${accountId}/recovery/history`, query)),
    supportApprove: (recoveryId) => request(`/devices/recovery/${recoveryId}/support-approve`, { method: 'POST' }),
    supportReject: (recoveryId, payload) => request(`/devices/recovery/${recoveryId}/support-reject`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) })
  },
  replacementRequests: (query) => request(withQuery('/devices/replacement-requests', query)),
  revoke: (deviceId) => request(`/devices/${deviceId}/revoke`, { method: 'POST' }),
  updateLanguage: (deviceId, payload) => request(`/devices/${deviceId}/language`, { method: 'PUT', body: toBody(payload) }),
  remove: (deviceId) => request(`/devices/${deviceId}`, { method: 'DELETE' }),
  removeMany: (deviceIds) => request('/devices', { method: 'DELETE', body: toBody({ deviceIds }) })
};

const cardOrderRetries = {
  list: (query) => request(withQuery('/card-order-retries', query)),
  runNow: (id) => request(`/card-order-retries/${id}/run-now`, { method: 'POST' }),
  forceResumeVerifiedOrder: (transactionId) =>
    request(`/card-order-retries/transactions/${transactionId}/force-resume-verified-order`, { method: 'POST' }),
  markFailed: (id, reason) =>
    request(withQuery(`/card-order-retries/${id}/mark-failed`, reason ? { reason } : {}), { method: 'POST' })
};

const cardPolicyConfig = {
  get: () => request('/card-policy-config'),
  update: (payload) => request('/card-policy-config', { method: 'PUT', body: toBody(payload) })
};

const receipts = {
  report: () => request('/receipts/report'),
  backfill: ({ dryRun = true, mode } = {}) =>
    request(withQuery('/receipts/backfill', { dryRun: String(Boolean(dryRun)), ...(mode ? { mode } : {}) }), { method: 'POST' })
};

const auditLogs = {
  list: (query) => request(withQuery('/audit-logs', query))
};

const liquibase = {
  listChangelogs: (query) => request(withQuery('/liquibase/changelogs', query))
};

const loans = {
  list: (query) => request(withQuery('/loans', query)),
  get: (id) => request(`/loans/${id}`),
  approve: (id, payload) => request(`/loans/${id}/approve`, { method: 'PUT', body: toBody(payload) }),
  reject: (id, payload) => request(`/loans/${id}/reject`, { method: 'PUT', body: toBody(payload) }),
  directCredit: (payload) => request('/loans/direct-credit', { method: 'POST', body: toBody(payload) }),
  policyConfig: {
    get: () => request('/loan-policy-config'),
    update: (payload) => request('/loan-policy-config', { method: 'PUT', body: toBody(payload) }),
    runDailyPenalties: (query) => request(withQuery('/loan-policy-config/run-daily-penalties', query), { method: 'POST' })
  },
  archivedPending: {
    list: (query) => request(withQuery('/archived-pending-loans', query)),
    upsert: (payload) => request('/archived-pending-loans', { method: 'POST', body: toBody(payload) }),
    upload: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return request('/archived-pending-loans/upload', {
        method: 'POST',
        body: formData
      });
    },
    remove: (id) => request(`/archived-pending-loans/${id}`, { method: 'DELETE' })
  }
};

const cards = {
  list: (query) => request(withQuery('/cards', query)),
  get: (id) => request(`/cards/${id}`),
  providerDetails: (id) => request(`/cards/${id}/provider-details`),
  providerTransactions: (id, query) => request(withQuery(`/cards/${id}/provider-transactions`, query)),
  issue: (payload) => request('/cards/issue', { method: 'POST', body: toBody(payload) }),
  reconcile: (payload) => request('/cards/reconcile', { method: 'POST', body: toBody(payload) }),
  fund: (id, payload) => request(`/cards/${id}/fund`, { method: 'POST', body: toBody(payload) }),
  withdraw: (id, payload) => request(`/cards/${id}/withdraw`, { method: 'POST', body: toBody(payload) }),
  create: (payload) => request('/cards', { method: 'POST', body: toBody(payload) }),
  update: (id, payload) => request(`/cards/${id}`, { method: 'PUT', body: toBody(payload) }),
  remove: (id) => request(`/cards/${id}`, { method: 'DELETE' }),
  block: (id) => request(`/cards/${id}/block`, { method: 'POST' }),
  unblock: (id) => request(`/cards/${id}/unblock`, { method: 'POST' })
};

const webhookEvents = {
  ...crud('webhook-events'),
  retry: (id) => request(`/webhook-events/${id}/retry`, { method: 'POST' })
};

const outboxResource = (resource) => ({
  list: (query) => request(withQuery(`/outbox/${resource}`, query)),
  get: (id) => request(`/outbox/${resource}/${id}`),
  retry: (id, payload) => request(`/outbox/${resource}/${id}/retry`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
  cancel: (id, payload) => request(`/outbox/${resource}/${id}/cancel`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) }),
  markFailed: (id, payload) => request(`/outbox/${resource}/${id}/mark-failed`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) })
});

const outbox = {
  events: outboxResource('events'),
  notifications: outboxResource('notifications'),
  webhooks: outboxResource('webhooks')
};

const cardHolders = {
  ...crud('card-holders'),
  registerSync: (payload) => requestWithTimeout('/card-holders/register-sync', { method: 'POST', body: toBody(payload) }, 70000),
  reset: (id) => request(`/card-holders/${id}/reset`, { method: 'POST' }),
  resetProvider: (cardHolderId, cardProviderId) => request(`/card-holders/${cardHolderId}/providers/${cardProviderId}/reset`, { method: 'POST' })
};

const cryptoQuotes = {
  quote: (query) => request(withQuery('/cryptos/quote', query))
};

const maplerad = {
  currencies: () => request('/maplerad/currencies'),
  bankCodes: (query) => request(withQuery('/maplerad/bank-codes', query)),
  creditSandboxWallet: (payload) => request('/maplerad/test-wallet/credit', { method: 'POST', body: toBody(payload) })
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
  paymentMethodStatusOverrides: crud('payment-method-status-overrides'),
  paymentProviders: crud('payment-providers'),
  paymentMethodPaymentProviders: crud('payment-method-payment-providers'),
  paymentMethodCryptoNetworks: crud('payment-method-crypto-networks'),
  paymentMethodActionConfigs: crud('payment-method-action-configs'),
  feeConfigs: crud('fee-configs'),
  kycCaps: crud('kyc-caps'),
  reloadlyOperatorAmounts: crud('reloadly-operator-amounts'),
  billProducts: crud('bill-products'),
  billProviders: crud('bill-providers'),
  billProductBillProviders: {
    ...crud('bill-product-bill-providers'),
    searchReloadlyUtilitiesBillers: (query) => request(withQuery('/bill-product-bill-providers/reloadly-utilities/billers', query)),
    searchZenditGroupedBillers: (query) => request(withQuery('/bill-product-bill-providers/zendit/grouped-billers', query))
  },
  billProductBillProviderOptions: crud('bill-product-bill-provider-options'),
  billProductBillProviderOffers: crud('bill-product-bill-provider-offers'),
  billProductBillProviderOfferOptions: crud('bill-product-bill-provider-offer-options'),
  rechargeProviderRouting: crud('recharge-provider-routing'),
  billPaymentIntents: crud('bill-payment-intents'),
  cardProducts: crud('card-products'),
  cardProviders: crud('card-providers'),
  cardProductCardProviders: {
    ...crud('card-product-card-providers'),
    metadataDefaults: () => request('/card-product-card-providers/metadata/defaults')
  },
  cardHolders,
  cardActivities: crud('card-activities'),
  cardPurchaseIntents: crud('card-purchase-intents'),
  paymentRequests: {
    ...crud('payment-requests'),
    recomputeLifecycle: (id) => request(`/payment-requests/${id}/recompute-lifecycle`, { method: 'POST' })
  },
  paymentRequestItems: crud('payment-request-items'),
  paymentRequestPayments: crud('payment-request-payments'),
  countries: crud('countries'),
  provinces: crud('provinces'),
  territories: crud('territories'),
  municipalities: crud('municipalities'),
  cryptoNetworks: crud('crypto-networks'),
  cryptoProducts: crud('crypto-products'),
  cryptoProductCryptoNetworks: crud('crypto-product-crypto-networks'),
  currencyProducts: crud('currency-products'),
  estimatedProcessingTimes: crud('estimated-processing-times'),
  fiatExchangeRates: {
    ...crud('fiat-exchange-rates'),
    syncMaplerad: () => request('/fiat-exchange-rates/sync/maplerad', { method: 'POST' })
  },
  cryptoQuotes,
  cryptoWallets: {
    ...crud('crypto-wallets'),
    credit: (walletId, payload) => request(`/crypto-wallets/${walletId}/credit`, { method: 'POST', body: toBody(payload) })
  },
  cryptoInvoices: crud('crypto-invoices'),
  cryptoPriceHistory: crud('crypto-price-history'),
  savingProducts: crud('saving-products'),
  savings: {
    ...crud('savings'),
    forceClose: (id, payload) => request(`/savings/${id}/force-close`, { method: 'POST', body: toBody(payload) }),
    reopen: (id, payload) => request(`/savings/${id}/reopen`, { method: 'POST', body: toBody(payload) }),
    approveEarlyWithdrawal: (id, payload) => request(`/savings/${id}/approve-early-withdrawal`, { method: 'POST', body: toBody(payload) }),
    revokeEarlyWithdrawal: (id, payload) => request(`/savings/${id}/revoke-early-withdrawal`, { method: 'POST', body: toBody(payload) })
  },
  savingActivities: crud('saving-activities'),
  blacklist: crud('blacklist'),
  previousDebts: crud('previous-debts'),
  untrustedBorrowers: {
    ...crud('untrusted-borrowers'),
    removeByEmail: (email) => request(`/untrusted-borrowers/by-email/${encodeURIComponent(email)}`, { method: 'DELETE' })
  },
  loanProducts: crud('loan-products'),
  beneficiaries: crud('beneficiaries'),
  beneficiaryPaymentMethods: crud('beneficiary-payment-methods'),
  providerTokens: crud('provider-tokens'),
  cegaWebTokens: crud('cega-web-tokens'),
  cegawebProfiles: crud('cegaweb-profiles'),
  stripeCustomers: crud('stripe-customers'),
  airtimeProviders: crud('airtime-providers'),
  airtimeOperatorFeatureFlagOverrides: crud('airtime-operator-feature-flag-overrides'),
  esimProviders: crud('esim-providers'),
  esimProducts: crud('esim-products'),
  esims: crud('esims'),
  announcements: crud('announcements'),
  webhookEvents,
  kycJobs: crud('kyc-jobs')
};

const notifications = {
  pushTest: (payload) => request('/notifications/push-test', { method: 'POST', body: toBody(payload) }),
  emailTest: (payload) => request('/notifications/email-test', { method: 'POST', body: toBody(payload) }),
  createPushCampaign: (payload) => request('/notifications/push-campaign', { method: 'POST', body: toBody(payload) }),
  createAnonymousPushCampaign: (payload) => request('/notifications/anonymous-push-campaign', { method: 'POST', body: toBody(payload) }),
  getPushCampaign: (campaignId) => request(`/notifications/push-campaign/${encodeURIComponent(campaignId)}`),
  listPushCampaigns: (query) => request(withQuery('/notifications/push-campaigns', query)),
  listAnonymousInstalls: (query) => request(withQuery('/notifications/anonymous-installs', query)),
  getAnnouncementEventPolicy: () => request('/notifications/announcement-event-policy'),
  updateAnnouncementEventPolicy: (payload) => request('/notifications/announcement-event-policy', { method: 'PUT', body: toBody(payload) })
};

const notificationDefaultChannels = {
  list: () => request('/notification-default-channels'),
  update: (payload) => request('/notification-default-channels', { method: 'PUT', body: toBody(payload) })
};

const notificationDeliveryPolicy = {
  get: () => request('/notification-delivery-policy'),
  update: (payload) => request('/notification-delivery-policy', { method: 'PUT', body: toBody(payload) })
};

const whatsappTemplateCatalog = {
  list: (query) => request(withQuery('/whatsapp-template-catalog', query)),
  get: (id) => request(`/whatsapp-template-catalog/${encodeURIComponent(id)}`),
  create: (payload) => request('/whatsapp-template-catalog', { method: 'POST', body: toBody(payload) }),
  update: (id, payload) => request(`/whatsapp-template-catalog/${encodeURIComponent(id)}`, { method: 'PUT', body: toBody(payload) }),
  submitToMeta: (id) => request(`/whatsapp-template-catalog/${encodeURIComponent(id)}/meta-submit`, { method: 'POST' }),
  updateInMeta: (id) => request(`/whatsapp-template-catalog/${encodeURIComponent(id)}/meta-update`, { method: 'POST' }),
  submitBatchToMeta: (payload) => request('/whatsapp-template-catalog/meta-submit-batch', { method: 'POST', body: toBody(payload) }),
  updateBatchInMeta: (payload) => request('/whatsapp-template-catalog/meta-update-batch', { method: 'POST', body: toBody(payload) }),
  remove: (id) => request(`/whatsapp-template-catalog/${encodeURIComponent(id)}`, { method: 'DELETE' })
};

const whatsappTemplatePolicy = {
  get: () => request('/whatsapp-template-policy'),
  update: (payload) => request('/whatsapp-template-policy', { method: 'PUT', body: toBody(payload) })
};

const whatsappMessageDeliveries = {
  list: (query) => request(withQuery('/whatsapp-message-deliveries', query)),
  get: (id) => request(`/whatsapp-message-deliveries/${encodeURIComponent(id)}`)
};

const paymentRequestTypeSettings = {
  list: () => request('/payment-request-type-settings'),
  update: (type, payload) => request(`/payment-request-type-settings/${type}`, { method: 'PUT', body: toBody(payload) })
};

const notificationProviders = {
  list: () => request('/notification-providers'),
  setActive: (payload) => request('/notification-providers/active', { method: 'PUT', body: toBody(payload) }),
  create: (payload) => request('/notification-providers', { method: 'POST', body: toBody(payload) })
};

const referralCampaigns = {
  list: (query) => request(withQuery('/referral-campaigns', query)),
  get: (id) => request(`/referral-campaigns/${id}`),
  create: (payload) => request('/referral-campaigns', { method: 'POST', body: toBody(payload) }),
  update: (id, payload) => request(`/referral-campaigns/${id}`, { method: 'PUT', body: toBody(payload) }),
  inviterRules: (campaignId, query) => request(withQuery(`/referral-campaigns/${campaignId}/inviter-rules`, query)),
  getInviterRule: (campaignId, inviterAccountId) => request(`/referral-campaigns/${campaignId}/inviter-rules/${inviterAccountId}`),
  upsertInviterRule: (campaignId, inviterAccountId, payload) =>
    request(`/referral-campaigns/${campaignId}/inviter-rules/${inviterAccountId}`, { method: 'PUT', body: toBody(payload) }),
  deleteInviterRule: (campaignId, inviterAccountId) => request(`/referral-campaigns/${campaignId}/inviter-rules/${inviterAccountId}`, { method: 'DELETE' }),
  activate: (id) => request(`/referral-campaigns/${id}/activate`, { method: 'POST' }),
  pause: (id) => request(`/referral-campaigns/${id}/pause`, { method: 'POST' }),
  archive: (id) => request(`/referral-campaigns/${id}/archive`, { method: 'POST' })
};

const referrals = {
  analytics: (query) => request(withQuery('/referrals/analytics', query)),
  reviewQueue: (query) => request(withQuery('/referrals/review-queue', query)),
  createBinding: (payload) => request('/referrals/bindings', { method: 'POST', body: toBody(payload) }),
  approveReward: (rewardId, payload) => request(`/referrals/rewards/${rewardId}/approve`, { method: 'POST', body: toBody(payload) }),
  rejectReward: (rewardId, payload) => request(`/referrals/rewards/${rewardId}/reject`, { method: 'POST', body: toBody(payload) }),
  reverseReward: (rewardId, payload) => request(`/referrals/rewards/${rewardId}/reverse`, { method: 'POST', body: toBody(payload) }),
  reissueReward: (rewardId, payload) => request(`/referrals/rewards/${rewardId}/reissue`, { method: 'POST', body: toBody(payload) }),
  recomputeReward: (rewardId, payload) => request(`/referrals/rewards/${rewardId}/recompute`, { method: 'POST', body: toBody(payload) }),
  account: (accountId, query) => request(withQuery(`/referrals/accounts/${accountId}`, query)),
  accountByEmail: (email, query) => request(withQuery('/referrals/accounts/by-email', { email, ...(query || {}) })),
  exportRewardLedgerCsv: (query) => request(withQuery('/referrals/exports/reward-ledger.csv', query))
};

const bankDepositProofs = {
  list: (query) => request(withQuery('/bank-deposit-proofs', query)),
  create: (payload) => request('/bank-deposit-proofs', { method: 'POST', body: toBody(payload) }),
  createMultipart: ({ data, file }) => {
    const formData = new FormData();
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const dataPart = typeof Blob !== 'undefined' ? new Blob([payload], { type: 'application/json' }) : payload;
    formData.append('data', dataPart);
    if (file) {
      formData.append('file', file);
    }
    return request('/bank-deposit-proofs', { method: 'POST', body: formData });
  },
  credit: (id, payload) =>
    request(`/bank-deposit-proofs/${id}/credit`, { method: 'POST', ...(payload ? { body: toBody(payload) } : {}) })
};

const qa = {
  stubFailureModes: () => request('/qa/stub-failure-modes')
};

export const api = {
  setAuthToken: (token) => {
    authToken = token || null;
    forbiddenLogoutTriggered = false;
  },
  raw: call,

  // Reports
  getReport: (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', String(startDate));
    if (endDate) params.set('endDate', String(endDate));
    return request(withQuery('/report', params), { method: 'GET' });
  },

  getDashboard: (query) => {
    const params = query instanceof URLSearchParams ? query : new URLSearchParams(query || {});
    return request(withQuery('/dashboard', params), { method: 'GET' });
  },

  accounts,
  admins,
  kycs,
  transactions,
  caches,
  featureFlags,
  cronJobs,
  appVersion,
  kycDefaultLevels,
  walletPolicyConfig,
  guideVideos,
  loanEligibilityRules,
  groupSavings,
  registrationPolicyConfig,
  smileIdFraudBlacklistPolicy,
  rechargeCatalogSync,
  rechargeCatalog,
  rechargeOperatorAvailabilityPolicies,
  rechargeOperatorProviderRoutes,
  utilityBillCatalog,
  utilityBillCatalogSync,
  esimCatalogSync,
  devices,
  cardOrderRetries,
  cardPolicyConfig,
  cardProviderStatusOverrides,
  receipts,
  auditLogs,
  liquibase,
  loans,
  cards,
  notifications,
  notificationDefaultChannels,
  notificationDeliveryPolicy,
  whatsappTemplateCatalog,
  whatsappTemplatePolicy,
  whatsappMessageDeliveries,
  paymentRequestTypeSettings,
  notificationProviders,
  referralCampaigns,
  referrals,
  bankDepositProofs,
  maplerad,
  qa,
  outbox,
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
  updateKycStatus: kycs.updateStatus,
  updateKycLevel: kycs.updateLevel,
  listTransactions: transactions.list,
  approveTransaction: transactions.approve,
  rejectTransaction: transactions.reject,
  getQaStubFailureModes: qa.stubFailureModes
};
