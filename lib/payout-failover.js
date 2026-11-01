const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, label, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const number = typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  return number;
};
const boolean = (value, label) => {
  if (typeof value !== 'boolean') throw new Error(`${label} is unavailable.`);
  return value;
};
const keys = (value, allowed, label) => {
  if (!object(value)) throw new Error(`${label} is unavailable.`);
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error(`${label} contains unsupported fields. Refresh before editing.`);
};
export function failoverPermissions(session) {
  const access = session?.tokens?.accessToken?.payload || {}, id = session?.tokens?.idToken?.payload || {};
  const roles = [access['cognito:groups'], access.groups, id['cognito:groups'], id.groups].flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((value) => String(value).trim().toUpperCase());
  return { canRead: roles.includes('ADMIN') || roles.includes('SUPER_ADMIN'), canPublish: roles.includes('SUPER_ADMIN') };
}
export function failoverInstant(value, label = 'UTC instant') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`${label} must be an ISO-8601 instant with a timezone.`);
  const day = value.slice(0, 10);
  if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) throw new Error(`${label} has an invalid date.`);
  return value;
}
export function failoverUtcInput(value) { return value ? new Date(value).toISOString().slice(0, 19) : ''; }
export function failoverUtcValue(value) { return value ? `${value.length === 16 ? `${value}:00` : value}Z` : null; }
export function failoverReason(value) {
  const reason = String(value || '').trim();
  if (!reason || reason.length > 1000) throw new Error('An audit reason of 1–1,000 characters is required.');
  return reason;
}
export function failoverCodes(capabilities) {
  return (capabilities?.errorCodes || []).filter((entry) => entry.selectable === true && entry.operation === 'PAYOUT');
}
export function failoverConfiguration(value, capabilities = null) {
  keys(value, ['enabled', 'createdAfter', 'accountIds', 'rules', 'routingRules'], 'Configuration');
  const enabled = boolean(value.enabled, 'Configured switch');
  const createdAfter = value.createdAfter == null || value.createdAfter === '' ? null : failoverInstant(value.createdAfter, 'Cutover');
  const entries = typeof value.accountIds === 'string' ? value.accountIds.trim() ? value.accountIds.split(/[,\n]/).map((id) => id.trim()) : [] : value.accountIds;
  if (!Array.isArray(entries) || entries.length > 1000) throw new Error('Use at most 1,000 rollout account IDs.');
  const accountIds = [...new Set(entries.map((id) => integer(id, 'Account ID')))];
  if (!Array.isArray(value.rules) || value.rules.length > 100) throw new Error('Use at most 100 ordered rules.');
  const ids = new Set();
  const allowed = capabilities ? new Set(failoverCodes(capabilities).map((entry) => entry.code)) : null;
  const rules = value.rules.map((rule, index) => {
    const label = `Rule ${index + 1}`;
    keys(rule, ['id', 'name', 'enabled', 'sourceRouteId', 'targetRouteId', 'rejectionCodes'], label);
    if (typeof rule.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(rule.id) || ids.has(rule.id)) throw new Error(`${label} requires a unique stable ID (letters, numbers, _ or -, up to 64 characters).`);
    ids.add(rule.id);
    if (rule.name != null && (typeof rule.name !== 'string' || rule.name.length > 120)) throw new Error(`${label} name must be at most 120 characters.`);
    if (!Array.isArray(rule.rejectionCodes) || !rule.rejectionCodes.length || rule.rejectionCodes.length > 20 || rule.rejectionCodes.some((code) => typeof code !== 'string' || !code || code.length > 128 || allowed && !allowed.has(code))) throw new Error(`${label} must select supported rejection codes from capabilities.`);
    return { id: rule.id, name: rule.name ?? null, enabled: boolean(rule.enabled, `${label} enabled`), sourceRouteId: integer(rule.sourceRouteId, `${label} source route`), targetRouteId: integer(rule.targetRouteId, `${label} target route`), rejectionCodes: [...new Set(rule.rejectionCodes)] };
  });
  let routingRules;
  if (Object.hasOwn(value, 'routingRules')) {
    if (value.routingRules != null && !Array.isArray(value.routingRules) || value.routingRules?.length > 100) throw new Error('Use at most 100 scoped rules.');
    const scopes = new Set();
    routingRules = (value.routingRules || []).map((rule, index) => {
      const label = `Scope ${index + 1}`;
      keys(rule, ['id', 'name', 'enabled', 'paymentMethod', 'countryCode', 'currency', 'providers'], label);
      if (typeof rule.id !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(rule.id) || ids.has(rule.id)) throw new Error(`${label} requires a stable ID unique across both rule lists (up to 32 letters, digits, _ or -).`);
      ids.add(rule.id);
      if (rule.name != null && (typeof rule.name !== 'string' || rule.name.length > 120)) throw new Error(`${label} name must be at most 120 characters.`);
      const filter = (key, pattern) => {
        if (rule[key] == null || rule[key] === '') return null;
        if (typeof rule[key] !== 'string' || !pattern.test(rule[key].trim())) throw new Error(`${label} has an invalid ${key}.`);
        return rule[key].trim();
      };
      const paymentMethod = filter('paymentMethod', /^[A-Z][A-Z0-9_]*$/), countryCode = filter('countryCode', /^[A-Z]{2}$/), currency = filter('currency', /^[A-Z]{3}$/);
      const scopeKey = JSON.stringify([paymentMethod, countryCode, currency]);
      if (scopes.has(scopeKey)) throw new Error(`${label} duplicates an existing scope. Edit that scope instead.`);
      scopes.add(scopeKey);
      const enabled = boolean(rule.enabled, `${label} enabled`);
      if (!Array.isArray(rule.providers) || rule.providers.length < 2 || rule.providers.length > 4 || new Set(rule.providers).size !== rule.providers.length
          || rule.providers.some((provider) => !['PAWAPAY', 'MAPLERAD', 'ARAKAPAY', 'AVADAPAY'].includes(provider))) throw new Error(`${label} needs 2–4 distinct supported mobile-money providers.`);
      if (enabled && !payoutOrderExecutable(rule.providers)) throw new Error(`${label}: only pawaPay → Maplerad can execute. Keep this scoped rule disabled to save another provider order.`);
      return { id: rule.id, name: rule.name ?? null, enabled, paymentMethod, countryCode, currency, providers: [...rule.providers] };
    });
  }
  return { enabled, createdAfter, accountIds, rules, ...(routingRules ? { routingRules } : {}) };
}

export const payoutOrderExecutable = (providers) => Array.isArray(providers) && providers.length === 2 && providers[0] === 'PAWAPAY' && providers[1] === 'MAPLERAD';
export const payoutScopeLabel = (rule) => [rule.paymentMethod, rule.countryCode && `Destination ${rule.countryCode}`, rule.currency && `Payout ${rule.currency}`].filter(Boolean).join(' · ') || 'Global default';
export function newPayoutScope() {
  return { id: 'scope_' + (globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 24) || Math.random().toString(36).slice(2) + Date.now().toString(36)), name: '', enabled: false, paymentMethod: null, countryCode: null, currency: null, providers: ['PAWAPAY', 'MAPLERAD'] };
}
export function payoutDefaultsResource(response) {
  const configuration = failoverConfiguration(response?.configuration);
  if (configuration.enabled !== false || !object(response.readiness) || typeof response.readiness.valid !== 'boolean' || !Array.isArray(response.readiness.issues) || !Array.isArray(response.readiness.routes)
      || !Number.isInteger(response.skippedSources) || response.skippedSources < 0 || typeof response.truncated !== 'boolean') throw new Error('The backend did not return complete disabled defaults.');
  if (response.coverage != null && (!Array.isArray(response.coverage) || response.coverage.some((row) => !object(row) || typeof row.executable !== 'boolean' || typeof row.enabled !== 'boolean'
      || !Array.isArray(row.providers) || row.providers.some((name) => typeof name !== 'string') || !Array.isArray(row.blockers) || row.blockers.some((code) => typeof code !== 'string')
      || !Array.isArray(row.routes) || row.routes.some((route) => !object(route) || typeof route.provider !== 'string' || typeof route.active !== 'boolean')))) throw new Error('Default coverage could not be read. Refresh before using it.');
  return { ...response, configuration };
}
export function payoutDefaultsDraft(current, configuration) {
  return { ...failoverDraft({ ...configuration, enabled: false, accountIds: [] }), accountIds: current.accountIds, createdAfter: current.createdAfter };
}
export function failoverResource(response) {
  const policy = response?.policy;
  if (!object(policy) || !['DEPLOYMENT', 'DATABASE'].includes(policy.source) || !object(response.validation) || typeof response.validation.valid !== 'boolean' || !Array.isArray(response.validation.issues) || !Array.isArray(response.validation.routes)) throw new Error('Saved failover policy is unavailable. Refresh before editing.');
  for (const key of ['updatedAt', 'cutoverFloor']) if (policy[key] != null) failoverInstant(policy[key], key);
  return { ...response, policy: { ...policy, revision: integer(policy.revision, 'Revision', 0), effectiveEnabled: boolean(policy.effectiveEnabled, 'Effective switch'), emergencyDisabled: boolean(policy.emergencyDisabled, 'Emergency switch'), configuration: failoverConfiguration(policy.configuration) } };
}
export const failoverDraft = (configuration) => ({ ...JSON.parse(JSON.stringify(configuration)), accountIds: configuration.accountIds.join(', ') });
export const failoverFingerprint = (value) => JSON.stringify(value, (_key, item) => object(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export function newFailoverRule() {
  return { id: globalThis.crypto?.randomUUID?.() || `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`, name: '', enabled: true, sourceRouteId: '', targetRouteId: '', rejectionCodes: [] };
}
export function failoverActivation(policy, enabled, createdAfter, reason, now = Date.now()) {
  const body = { expectedRevision: integer(policy.revision, 'Revision', 0), enabled: boolean(enabled, 'Activation'), reason: failoverReason(reason) };
  if (enabled) {
    const instant = failoverInstant(createdAfter, 'Future cutover');
    if (Date.parse(instant) <= now) throw new Error('Activation/resumption requires a future UTC cutover.');
    const preciseInstant = (value) => BigInt(Date.parse(value)) * 1000000n + BigInt((value.match(/T\d{2}:\d{2}:\d{2}\.(\d+)/)?.[1] || '').padEnd(9, '0').slice(3, 9) || 0);
    if (policy.cutoverFloor && preciseInstant(instant) < preciseInstant(failoverInstant(policy.cutoverFloor))) throw new Error('Cutover cannot move backwards behind the saved cutover floor.');
    body.createdAfter = instant;
  }
  return body;
}
// Automatic cutovers are a payout capability. Recharge still requires an explicit future instant.
export function payoutActivation(policy, enabled, createdAfter, reason, now = Date.now()) {
  if (enabled === true && (createdAfter == null || createdAfter === '')) return { expectedRevision: integer(policy.revision, 'Revision', 0), enabled: true, reason: failoverReason(reason) };
  return failoverActivation(policy, enabled, createdAfter, reason, now);
}
export function failoverPreview({ configuration, context = 'NONE', transactionId, sample, rejectionCode }, capabilities) {
  const body = configuration ? { configuration: failoverConfiguration(configuration, capabilities) } : {};
  if (rejectionCode) {
    if (!failoverCodes(capabilities).some((entry) => entry.code === rejectionCode)) throw new Error('Select a supported rejection code.');
    body.rejectionCode = rejectionCode;
  }
  if (context === 'EXISTING_TRANSACTION') body.transactionId = integer(transactionId, 'Transaction ID');
  else if (context === 'SAMPLE') {
    const positiveAmount = (amount, label) => {
      if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(String(amount)) || !/[1-9]/.test(String(amount))) throw new Error(`${label} must be a positive decimal amount.`);
      return String(amount);
    };
    if (!capabilities.actions.includes(sample.action)) throw new Error('Select a supported payout action.');
    if (!/^[A-Z]{3,8}$/.test(sample.currency?.trim() || '')) throw new Error('Currency must contain 3–8 uppercase letters.');
    if (!sample.accountNumber?.trim() || sample.accountNumber.trim().length > 128) throw new Error('Recipient account number is required (up to 128 characters).');
    body.sample = { accountId: integer(sample.accountId, 'Sample account ID'), sourceRouteId: integer(sample.sourceRouteId, 'Sample source route'), amount: positiveAmount(sample.amount, 'Amount'), currency: sample.currency.trim(), accountNumber: sample.accountNumber.trim(), action: sample.action,
      ...(sample.grossAmount ? { grossAmount: positiveAmount(sample.grossAmount, 'Gross amount') } : {}), ...(sample.networkId ? { networkId: integer(sample.networkId, 'Network ID') } : {}), ...(sample.createdAt ? { createdAt: failoverInstant(sample.createdAt, 'Sample created at') } : {}) };
  } else if (context !== 'NONE') throw new Error('Choose configuration, transaction or sample preview.');
  return body;
}
export function failoverQuery(filters = {}, { page = 0, size = 20, metrics = false, now = Date.now() } = {}) {
  const query = new URLSearchParams();
  const from = filters.from ? failoverInstant(filters.from, 'From') : null, to = filters.to ? failoverInstant(filters.to, 'To') : null;
  const end = to ? Date.parse(to) : now, start = from ? Date.parse(from) : end - 7 * 86400000;
  if (end <= start || end - start > 90 * 86400000) throw new Error('Choose a UTC window greater than zero and at most 90 days.');
  if (from) query.set('from', from); if (to) query.set('to', to);
  if (metrics) { query.set('staleMinutes', integer(filters.staleMinutes ?? 15, 'Stale minutes', 1, 1440)); return query; }
  for (const key of ['transactionId', 'accountId', 'sourceRouteId', 'targetRouteId']) if (filters[key] !== '' && filters[key] != null) query.set(key, integer(filters[key], key));
  for (const key of ['reference', 'provider', 'state']) if (filters[key]?.trim()) query.set(key, filters[key].trim());
  for (const key of ['conflicted', 'unresolved']) if (filters[key] !== '' && filters[key] != null) {
    if (![true, false, 'true', 'false'].includes(filters[key])) throw new Error(`${key} must be yes, no or any.`);
    query.set(key, String(filters[key]));
  }
  query.set('page', integer(page, 'Page', 0)); query.set('size', integer(size, 'Page size', 1, 100));
  return query;
}
export function failoverRoutes(routes, capabilities, source = null) {
  const providers = new Set(capabilities.providers.filter((entry) => source ? entry.targetSupported : entry.sourceSupported).map((entry) => entry.provider));
  return routes.filter((route) => providers.has(route.paymentProviderName) && (!source || String(route.paymentMethodId) === String(source.paymentMethodId))
    && (route.action == null ? route.context == null || route.context === 'PAYOUT' : capabilities.actions.includes(route.action))
    && (!source || source.action == null || route.action == null || source.action === route.action));
}
