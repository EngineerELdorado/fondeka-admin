const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const load = (file, tag = '') => import('data:text/javascript;base64,' + Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64') + '#' + tag);
const helpers = load('lib/payout-failover.js');
const capabilities = {
  actions: ['WITHDRAW_FROM_WALLET', 'BUSINESS_API_PAYOUT'],
  providers: [{ provider: 'PAWAPAY', sourceSupported: true }, { provider: 'MAPLERAD', targetSupported: true }],
  errorCodes: [{ code: 'PROVIDER_TEMPORARILY_UNAVAILABLE', selectable: true, operation: 'PAYOUT' }, { code: 'PAWAPAY_WALLET_OUT_OF_FUNDS', selectable: true, operation: 'PAYOUT' }, { code: 'UNKNOWN_ERROR', selectable: false, operation: 'PAYOUT' }]
};
const configuration = { enabled: false, createdAfter: null, accountIds: [123], rules: [{ id: 'pilot-1', name: null, enabled: false, sourceRouteId: 1001, targetRouteId: 1002, rejectionCodes: ['PROVIDER_TEMPORARILY_UNAVAILABLE'] }] };

test('failover draft round trips nullable defaults, explicit false, stable IDs and ordered rules', async () => {
  const h = await helpers;
  const value = { ...configuration, rules: [...configuration.rules, { ...configuration.rules[0], id: 'pilot-2', name: 'Deuxième • règle' }] };
  const draft = h.failoverDraft(value);
  assert.deepEqual(h.failoverConfiguration(draft, capabilities), value);
  const reversed = h.failoverConfiguration({ ...draft, rules: [...draft.rules].reverse() }, capabilities);
  assert.deepEqual(reversed.rules.map(rule => rule.id), ['pilot-2', 'pilot-1']);
  assert.equal(reversed.rules[0].name, 'Deuxième • règle');
  assert.equal(reversed.rules[0].enabled, false);
  assert.deepEqual(h.failoverConfiguration({ ...draft, accountIds: '' }, capabilities).accountIds, []);
  assert.match(h.newFailoverRule().id, /^[A-Za-z0-9_-]{1,64}$/);
});

test('failover request validation rejects malformed IDs, duplicates, excessive cohorts and unreviewed codes', async () => {
  const h = await helpers;
  for (const value of [
    { ...configuration, enabled: null }, { ...configuration, accountIds: '123,,456' }, { ...configuration, accountIds: [0] },
    { ...configuration, accountIds: Array(1001).fill(123) }, { ...configuration, rules: Array(101).fill(configuration.rules[0]) },
    { ...configuration, rules: [configuration.rules[0], configuration.rules[0]] },
    ...[{ id: 'bad.id' }, { sourceRouteId: '1abc' }, { enabled: null }, { rejectionCodes: ['UNKNOWN_ERROR'] }, { rejectionCodes: [] }, { name: 'x'.repeat(121) }].map(fields => ({ ...configuration, rules: [{ ...configuration.rules[0], ...fields }] }))
  ]) assert.throws(() => h.failoverConfiguration(value, capabilities));
});

test('policy response requires confirmed revision and Booleans and never silently drops unsupported fields', async () => {
  const h = await helpers;
  const response = { policy: { revision: 0, source: 'DEPLOYMENT', effectiveEnabled: false, emergencyDisabled: false, cutoverFloor: null, configuration }, validation: { valid: true, issues: [], routes: [] } };
  assert.deepEqual(h.failoverResource(response), response);
  for (const fields of [{ effectiveEnabled: null }, { emergencyDisabled: 'false' }, { revision: -1 }, { configuration: { ...configuration, newGuard: true } }]) assert.throws(() => h.failoverResource({ ...response, policy: { ...response.policy, ...fields } }));
});

test('activation uses the saved revision and future cutover floor; pause omits cutover and all draft rules', async () => {
  const h = await helpers, now = Date.parse('2026-10-31T12:00:00Z');
  const policy = { revision: 8, cutoverFloor: '2026-11-01T12:00:00.123456790Z' };
  assert.deepEqual(h.failoverActivation(policy, false, null, ' Pause now ', now), { expectedRevision: 8, enabled: false, reason: 'Pause now' });
  assert.deepEqual(h.failoverActivation(policy, true, '2026-11-02T12:00:00Z', 'Pilot', now), { expectedRevision: 8, enabled: true, createdAfter: '2026-11-02T12:00:00Z', reason: 'Pilot' });
  for (const instant of [null, '2026-10-30T12:00:00Z', '2026-11-01T12:00:00.123456789Z', '2026-02-31T00:00:00Z']) assert.throws(() => h.failoverActivation(policy, true, instant, 'Pilot', now));
  assert.throws(() => h.failoverActivation(policy, false, null, ' ', now));
  assert.throws(() => h.failoverReason('x'.repeat(1001)));
});

test('preview payloads distinguish validation, stored transaction and sample without creating submission inputs', async () => {
  const h = await helpers;
  assert.deepEqual(h.failoverPreview({ configuration, context: 'NONE' }, capabilities), { configuration });
  assert.deepEqual(h.failoverPreview({ context: 'EXISTING_TRANSACTION', transactionId: '91', rejectionCode: 'PROVIDER_TEMPORARILY_UNAVAILABLE', sample: {} }, capabilities), { transactionId: 91, rejectionCode: 'PROVIDER_TEMPORARILY_UNAVAILABLE' });
  const sample = { accountId: '123', sourceRouteId: '1001', amount: '100.000000000000000001', currency: 'GHS', accountNumber: '233240000000', action: 'BUSINESS_API_PAYOUT' };
  const result = h.failoverPreview({ context: 'SAMPLE', sample }, capabilities);
  assert.equal(result.sample.amount, sample.amount);
  assert.equal(Object.hasOwn(result.sample, 'grossAmount'), false);
  assert.equal(Object.hasOwn(result.sample, 'createdAt'), false);
  assert.equal(Object.hasOwn(result, 'transactionId'), false);
  assert.throws(() => h.failoverPreview({ context: 'SAMPLE', sample: { ...sample, amount: '0' } }, capabilities));
  assert.throws(() => h.failoverPreview({ context: 'NONE', rejectionCode: 'UNKNOWN_ERROR' }, capabilities));
});

test('operation filters preserve explicit false, enforce windows and pagination, and keep metrics separate from row filters', async () => {
  const h = await helpers;
  const filters = { from: '2026-10-01T00:00:00Z', to: '2026-10-31T00:00:00Z', transactionId: '91', reference: 'TX+pilot', conflicted: false, unresolved: 'false', staleMinutes: '15' };
  const query = h.failoverQuery(filters, { page: 0, size: 100 });
  assert.equal(query.get('conflicted'), 'false'); assert.equal(query.get('unresolved'), 'false'); assert.equal(query.get('page'), '0');
  assert.equal(query.get('reference'), 'TX+pilot');
  const metrics = h.failoverQuery(filters, { metrics: true });
  assert.deepEqual([...metrics.keys()], ['from', 'to', 'staleMinutes']);
  for (const bad of [{ ...filters, from: '2026-01-01T00:00:00Z' }, { ...filters, to: filters.from }, { ...filters, accountId: '0' }]) assert.throws(() => h.failoverQuery(bad));
  assert.throws(() => h.failoverQuery(filters, { size: 101 }));
  assert.throws(() => h.failoverQuery({ staleMinutes: 0 }, { metrics: true }));
});

test('route pickers use capabilities and identical methods while retaining inactive routes for disabled preparation', async () => {
  const h = await helpers;
  const source = { id: 1, paymentProviderName: 'PAWAPAY', paymentMethodId: 10, action: 'BUSINESS_API_PAYOUT' };
  const target = { id: 2, paymentProviderName: 'MAPLERAD', paymentMethodId: 10, active: false, action: null };
  const routes = [source, target, { ...target, id: 3, paymentMethodId: 20 }, { ...target, id: 4, action: 'FUND_WALLET' }, { ...source, id: 5, paymentProviderName: 'OTHER' }];
  assert.deepEqual(h.failoverRoutes(routes, capabilities), [source]);
  assert.deepEqual(h.failoverRoutes(routes, capabilities, source), [target]);
});

test('failover role gates deny assistants/staff and regulator presentation hides wallet investigation routes', async () => {
  const h = await helpers;
  const session = roles => ({ tokens: { accessToken: { payload: { 'cognito:groups': roles } } } });
  assert.deepEqual(h.failoverPermissions(session(' ADMIN, SUPER_ADMIN ')), { canRead: true, canPublish: true });
  assert.deepEqual(h.failoverPermissions(session(['ADMIN'])), { canRead: true, canPublish: false });
  for (const roles of [['ASSISTANT'], ['STAFF'], []]) assert.deepEqual(h.failoverPermissions(session(roles)), { canRead: false, canPublish: false });
  const presentation = await load('lib/regulator-presentation.js');
  assert.equal(presentation.isRegulatorRestrictedRoute('/dashboard/payout-failover?tab=policy'), true);
});

test('all failover APIs use scoped Bearer/no-store helpers, exact methods and bodyless observational status checks', async (t) => {
  const original = global.fetch, oldWindow = global.window;
  t.after(() => { global.fetch = original; if (oldWindow === undefined) delete global.window; else global.window = oldWindow; });
  const { api } = await load('lib/api.js', 'payout-failover-api');
  api.setAuthToken('admin-failover');
  const calls = [], events = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ ok: true }); };
  await api.payoutFailover.capabilities(); await api.payoutFailover.policy();
  await api.payoutFailover.publish({ expectedRevision: 0, reason: 'Review', configuration });
  await api.payoutFailover.activate({ expectedRevision: 1, enabled: false, reason: 'Pause' });
  await api.payoutFailover.history({ page: 0, size: 20 }); await api.payoutFailover.preview({ transactionId: 91 });
  await api.payoutFailover.operations({ conflicted: false, page: 0, size: 20 }); await api.payoutFailover.operation(91);
  await api.payoutFailover.statusCheck(91); await api.payoutFailover.metrics({ staleMinutes: 15 });
  assert.deepEqual(calls.map(call => call.init.method || 'GET'), ['GET', 'GET', 'PUT', 'PATCH', 'GET', 'POST', 'GET', 'GET', 'POST', 'GET']);
  for (const call of calls) {
    assert.match(call.url, /\/admin-api\/payout-failover\//); assert.equal(call.init.cache, 'no-store');
    assert.equal(call.init.headers.Authorization, 'Bearer admin-failover');
    assert.doesNotMatch(call.url, /momo-status|refund|resubmit/);
  }
  assert.equal(calls[8].init.body, undefined);
  assert.match(calls[6].url, /conflicted=false/);
  global.window = { dispatchEvent: event => events.push(event.type) };
  global.fetch = async () => Response.json({ message: 'Super Admin required' }, { status: 403 });
  await assert.rejects(api.payoutFailover.publish({}), err => err.status === 403 && err.message === 'Super Admin required');
  assert.deepEqual(events, []);
});
