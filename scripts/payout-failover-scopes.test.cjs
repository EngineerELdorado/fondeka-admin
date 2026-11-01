const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const load = file => import('data:text/javascript;base64,' + Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64'));
const helpers = load('lib/payout-failover.js');
const legacyCapabilities = { maximumProviders: 2, requiresSynchronousRejection: true, providers: [{ provider: 'PAWAPAY', sourceSupported: true, targetSupported: false }, { provider: 'MAPLERAD', sourceSupported: false, targetSupported: true }], errorCodes: [{ provider: 'PAWAPAY', operation: 'PAYOUT', selectable: true, code: 'PROVIDER_TEMPORARILY_UNAVAILABLE' }] };
const scope = (id, extra = {}) => ({ id, name: null, enabled: true, paymentMethod: null, countryCode: null, currency: null, providers: ['PAWAPAY', 'MAPLERAD'], ...extra });
const configuration = { enabled: false, createdAfter: null, accountIds: [123], rules: [], routingRules: [scope('global'), scope('benin', { countryCode: 'BJ' }), scope('benin-xof', { countryCode: 'BJ', currency: 'XOF' }), scope('moov-off', { enabled: false, paymentMethod: 'MOOV_MONEY_BENIN' }), scope('draft-gbp', { enabled: false, currency: 'GBP', providers: ['ARAKAPAY', 'AVADAPAY', 'MAPLERAD'] })] };
const defaults = { configuration, readiness: { valid: false, issues: [{ severity: 'ERROR', code: 'PREFLIGHT_UNAVAILABLE', path: 'routingRules[global]', message: 'Preflight unavailable' }], routes: [] }, skippedSources: 1, truncated: false, coverage: [{ paymentMethod: 'MOOV_MONEY_BENIN', countryCode: 'BJ', currency: 'XOF', action: 'BUSINESS_API_PAYOUT', scopeId: 'moov-off', enabled: false, providers: ['PAWAPAY', 'MAPLERAD'], routes: [], executable: false, blockers: ['SCOPE_DISABLED'] }] };

test('scoped policy reads, drafts and saves retain false overrides and ordered disabled provider preferences', async () => {
  const h = await helpers;
  const resource = { policy: { revision: 0, source: 'DATABASE', effectiveEnabled: false, emergencyDisabled: false, cutoverFloor: null, configuration }, validation: { valid: true, issues: [], routes: [] } };
  assert.deepEqual(h.failoverResource(resource), resource);
  assert.deepEqual(h.failoverConfiguration(h.failoverDraft(configuration)), configuration);
  const explicit = { id: 'exact-route', name: null, enabled: false, sourceRouteId: 1, targetRouteId: 2, rejectionCodes: ['PROVIDER_TEMPORARILY_UNAVAILABLE'] };
  const combined = { ...configuration, rules: [explicit] };
  assert.deepEqual(h.failoverConfiguration(h.failoverDraft(combined)), combined);
  const reversed = { ...configuration, routingRules: [...configuration.routingRules].reverse() };
  assert.deepEqual(h.failoverConfiguration(reversed).routingRules, reversed.routingRules);
  assert.deepEqual(h.failoverConfiguration(configuration).routingRules[4].providers, ['ARAKAPAY', 'AVADAPAY', 'MAPLERAD']);
  assert.equal(h.failoverConfiguration(configuration).routingRules[3].enabled, false);
  const legacy = { enabled: false, createdAfter: null, accountIds: [], rules: [] };
  assert.deepEqual(h.failoverConfiguration(legacy), legacy);
  assert.deepEqual(h.failoverConfiguration({ ...legacy, routingRules: null }).routingRules, []);
  assert.match(h.newPayoutScope().id, /^[A-Za-z0-9_-]{1,32}$/);
});

test('scoped rules reject duplicates, cross-list IDs, unsupported executable orders and malformed filters', async () => {
  const h = await helpers;
  const invalidRules = [
    [scope('one'), scope('two')], [scope('one'), scope('one', { countryCode: 'BJ' })],
    [scope('x'.repeat(33))], [scope('bad.id')], [scope('one', { enabled: null })],
    [scope('one', { providers: ['MAPLERAD', 'PAWAPAY'] })], [scope('one', { providers: ['PAWAPAY', 'MAPLERAD', 'ARAKAPAY'] })],
    [scope('one', { enabled: false, providers: ['PAWAPAY', 'PAWAPAY'] })],
    [scope('one', { enabled: false, providers: ['PAWAPAY'] })], [scope('one', { enabled: false, providers: ['PAWAPAY', 'RELOADLY'] })],
    [scope('one', { countryCode: 'BEN' })], [scope('one', { currency: 'XOFx' })], [scope('one', { paymentMethod: 'bad method' })],
    [scope('one', { newField: true })], Array(101).fill(scope('one'))
  ];
  for (const routingRules of invalidRules) assert.throws(() => h.failoverConfiguration({ ...configuration, routingRules }, legacyCapabilities));
  const routeRule = { id: 'same-id', enabled: false, sourceRouteId: 1, targetRouteId: 2, rejectionCodes: ['PROVIDER_TEMPORARILY_UNAVAILABLE'] };
  assert.throws(() => h.failoverConfiguration({ ...configuration, rules: [routeRule], routingRules: [scope('same-id')] }));
  assert.equal(h.payoutOrderExecutable(['PAWAPAY', 'MAPLERAD'], legacyCapabilities), true);
  assert.equal(h.payoutOrderExecutable(['PAWAPAY', 'MAPLERAD', 'ARAKAPAY'], legacyCapabilities), false);
});

test('payout automatic activation leaves cutoff and rules to the backend; recharge helper remains explicit', async () => {
  const h = await helpers, now = Date.parse('2026-11-01T12:00:00Z');
  const policy = { revision: 7, cutoverFloor: '2026-11-03T12:00:00Z', configuration };
  assert.deepEqual(h.payoutActivation(policy, true, null, ' Reviewed automatic start ', now), { expectedRevision: 7, enabled: true, reason: 'Reviewed automatic start' });
  assert.deepEqual(h.payoutActivation(policy, false, null, 'Pause', now), { expectedRevision: 7, enabled: false, reason: 'Pause' });
  assert.throws(() => h.payoutActivation(policy, true, '2026-11-02T12:00:00Z', 'Before floor', now));
  assert.equal(h.payoutActivation(policy, true, '2026-11-04T12:00:00Z', 'Explicit start', now).createdAfter, '2026-11-04T12:00:00Z');
  assert.throws(() => h.failoverActivation(policy, true, null, 'Recharge must stay explicit', now));
  assert.throws(() => h.payoutActivation(policy, true, null, ' ', now));
  assert.throws(() => h.payoutActivation(policy, 'true', null, 'Must be Boolean', now));
});

test('defaults remain a disabled draft and importing cannot broaden a typed account cohort', async () => {
  const h = await helpers;
  const result = h.payoutDefaultsResource(defaults);
  assert.equal(result.coverage[0].executable, false);
  assert.deepEqual(result.readiness.issues, defaults.readiness.issues);
  const current = { enabled: true, createdAfter: '2026-11-01T12:00:00Z', accountIds: ' 123,\n456, unfinished', rules: [] };
  const imported = h.payoutDefaultsDraft(current, result.configuration);
  assert.equal(imported.enabled, false);
  assert.equal(imported.accountIds, current.accountIds);
  assert.equal(imported.createdAfter, current.createdAfter);
  assert.deepEqual(imported.routingRules, configuration.routingRules);
  assert.throws(() => h.payoutDefaultsResource({ ...defaults, configuration: { ...configuration, enabled: true } }));
  assert.throws(() => h.payoutDefaultsResource({ ...defaults, coverage: [{ ...defaults.coverage[0], executable: 'true' }] }));
  assert.throws(() => h.payoutDefaultsResource({ ...defaults, readiness: null }));
});

test('overview counts scoped overrides without presenting a blocked preference as live coverage', async () => {
  const { failoverSummary, explainFailoverReason } = await load('lib/failover-presentation.js');
  const result = failoverSummary({ policy: { revision: 0, configuration, emergencyDisabled: false } }, 'payout');
  assert.equal(result.state, 'off');
  assert.equal(result.ruleCount, 5); assert.equal(result.enabledRules, 3); assert.equal(result.blockedScopes, 2);
  assert.equal(result.scopedRuleCount, 5); assert.equal(result.routeRuleCount, 0);
  assert.match(explainFailoverReason('SCOPE_DISABLED').detail, /Delete the override/);
  assert.equal(explainFailoverReason('MAPLERAD_ROUTE_MISSING').title, 'MAPLERAD route is missing');
});

test('defaults API is a read-only authenticated no-store request and scoped documents survive publish and preview', async (t) => {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js'); api.setAuthToken('scope-admin');
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(defaults); };
  await api.payoutFailover.defaults();
  await api.payoutFailover.publish({ expectedRevision: 0, reason: 'Review', configuration });
  await api.payoutFailover.preview({ configuration });
  assert.match(calls[0].url, /\/payout-failover\/defaults$/);
  assert.equal(calls[0].init.method || 'GET', 'GET'); assert.equal(calls[0].init.body, undefined);
  assert.equal(calls[0].init.cache, 'no-store'); assert.equal(calls[0].init.headers.Authorization, 'Bearer scope-admin');
  for (const call of calls.slice(1)) assert.deepEqual(JSON.parse(call.init.body).configuration.routingRules, configuration.routingRules);
});
