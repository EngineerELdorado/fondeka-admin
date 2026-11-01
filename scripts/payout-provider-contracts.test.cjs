const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const load = file => import('data:text/javascript;base64,' + Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64'));
const helpers = load('lib/payout-failover.js');
const capabilities = {
  maximumProviders: 3, maximumDraftProviders: 4, requiresSynchronousRejection: false, requiresConfirmedNonPayment: true,
  providers: ['PAWAPAY', 'AVADAPAY', 'MAPLERAD', 'ARAKAPAY'].map(provider => ({ provider, sourceSupported: provider !== 'ARAKAPAY', targetSupported: true, liveStatusCheckSupported: provider !== 'MAPLERAD' })),
  actions: ['WITHDRAW_FROM_WALLET', 'BUSINESS_API_PAYOUT'],
  errorCodes: [
    ['PAWAPAY', 'PROVIDER_TEMPORARILY_UNAVAILABLE', true], ['PAWAPAY', 'PAWAPAY_WALLET_OUT_OF_FUNDS', true],
    ['AVADAPAY', 'AVADAPAY_FINAL_FAILED', true], ['MAPLERAD', 'MAPLERAD_FINAL_FAILED', true],
    ['AVADAPAY', 'AVADAPAY_FINAL_NON_RETRYABLE', false], ['AVADAPAY', 'AVADAPAY_FINAL_CANCELLED', false]
  ].map(([provider, code, selectable]) => ({ provider, code, selectable, operation: 'PAYOUT' }))
};
const scope = (providers, enabled = true) => ({ id: 'reviewed-chain', name: null, enabled, paymentMethod: null, countryCode: null, currency: 'CDF', providers });
const configuration = routingRules => ({ enabled: false, createdAfter: null, accountIds: [123], rules: [], routingRules });
const routes = capabilities.providers.map((provider, index) => ({ id: index + 1, paymentMethodId: 42, paymentMethodName: 'MPESA_DRC_CDF', paymentProviderName: provider.provider, action: 'BUSINESS_API_PAYOUT' }));

test('expanded capabilities require confirmed non-payment while preserving the old synchronous two-provider contract', async () => {
  const h = await helpers;
  assert.equal(h.payoutCapabilities(capabilities), capabilities);
  for (const value of [{ ...capabilities, requiresConfirmedNonPayment: false }, { ...capabilities, requiresConfirmedNonPayment: undefined }, { ...capabilities, maximumProviders: 4 }, { ...capabilities, maximumProviders: null }]) assert.throws(() => h.payoutCapabilities(value));
  const legacy = { ...capabilities, maximumProviders: 2, requiresSynchronousRejection: true, providers: capabilities.providers.map(provider => ({ ...provider, sourceSupported: provider.provider === 'PAWAPAY', targetSupported: provider.provider === 'MAPLERAD' })) };
  delete legacy.requiresConfirmedNonPayment;
  assert.equal(h.payoutCapabilities(legacy), legacy);
  assert.equal(h.payoutConfirmedNonPayment({ ...legacy, requiresConfirmedNonPayment: false }), false);
  assert.throws(() => h.payoutCapabilities({ ...capabilities, maximumProviders: 2, requiresSynchronousRejection: true, requiresConfirmedNonPayment: undefined }));
});

test('provider ordering follows backend source/target roles and caps execution at three distinct providers', async () => {
  const h = await helpers;
  for (const order of [['PAWAPAY', 'AVADAPAY', 'ARAKAPAY'], ['AVADAPAY', 'PAWAPAY', 'MAPLERAD'], ['MAPLERAD', 'PAWAPAY'], ['PAWAPAY', 'AVADAPAY'], ['AVADAPAY', 'PAWAPAY']]) assert.equal(h.payoutOrderExecutable(order, capabilities), true, order.join(' → '));
  for (const order of [['ARAKAPAY', 'PAWAPAY'], ['PAWAPAY', 'ARAKAPAY', 'MAPLERAD'], ['PAWAPAY', 'AVADAPAY', 'MAPLERAD', 'ARAKAPAY'], ['PAWAPAY', 'AVADAPAY', 'PAWAPAY'], ['UNKNOWN', 'PAWAPAY']]) assert.equal(h.payoutOrderExecutable(order, capabilities), false, order.join(' → '));
  assert.equal(h.payoutOrderExecutable(['MAPLERAD', 'PAWAPAY'], { ...capabilities, providers: capabilities.providers.map(item => item.provider === 'MAPLERAD' ? { ...item, sourceSupported: false } : item) }), false);
  assert.equal(h.payoutOrderExecutable(['PAWAPAY', 'AVADAPAY'], { ...capabilities, errorCodes: [] }), false);
  assert.equal(h.payoutOrderExecutable(['PAWAPAY', 'AVADAPAY']), false);
});

test('new enabled chain policies can be read without losing data and writes use current capability limits', async () => {
  const h = await helpers;
  const config = configuration([scope(['PAWAPAY', 'AVADAPAY', 'ARAKAPAY'])]);
  assert.deepEqual(h.failoverConfiguration(h.failoverDraft(config), capabilities), config);
  const response = { policy: { revision: 4, source: 'DATABASE', effectiveEnabled: false, emergencyDisabled: false, configuration: config }, validation: { valid: true, issues: [], routes: [] } };
  assert.deepEqual(h.failoverResource(response), response);
  assert.throws(() => h.failoverConfiguration(config, { ...capabilities, maximumProviders: 2 }));
  assert.deepEqual(h.failoverConfiguration(configuration([scope(['ARAKAPAY', 'AVADAPAY', 'PAWAPAY', 'MAPLERAD'], false)]), capabilities).routingRules[0].providers, ['ARAKAPAY', 'AVADAPAY', 'PAWAPAY', 'MAPLERAD']);
  assert.throws(() => h.failoverConfiguration(configuration([scope(['ARAKAPAY', 'PAWAPAY'])]), capabilities));
});

test('evidence choices are provider-bound and exclude cancellation and known non-retryable conditions', async () => {
  const h = await helpers;
  assert.deepEqual(h.failoverCodes(capabilities, 'AVADAPAY').map(item => item.code), ['AVADAPAY_FINAL_FAILED']);
  assert.deepEqual(h.failoverCodes(capabilities, 'MAPLERAD').map(item => item.code), ['MAPLERAD_FINAL_FAILED']);
  assert.equal(h.failoverCodes(capabilities, 'ARAKAPAY').length, 0);
  assert.equal(h.failoverCodes(capabilities).length, 4);
});

test('explicit pairs retain source-bound evidence and never allow a provider to be its own alternate', async () => {
  const h = await helpers;
  const rule = { id: 'maplerad-native-tzs', name: null, enabled: true, sourceRouteId: 3, targetRouteId: 1, rejectionCodes: ['MAPLERAD_FINAL_FAILED'] };
  const config = { ...configuration([scope(['AVADAPAY', 'PAWAPAY', 'MAPLERAD'])]), rules: [rule] };
  assert.deepEqual(h.failoverConfiguration(config, capabilities, routes), config);
  assert.throws(() => h.failoverConfiguration({ ...config, rules: [{ ...rule, rejectionCodes: ['AVADAPAY_FINAL_FAILED'] }] }, capabilities, routes));
  assert.throws(() => h.failoverConfiguration({ ...config, rules: [{ ...rule, targetRouteId: rule.sourceRouteId }] }, capabilities, routes));
  assert.throws(() => h.failoverConfiguration({ ...config, rules: [{ ...rule, sourceRouteId: 2, rejectionCodes: ['AVADAPAY_FINAL_NON_RETRYABLE'] }] }, capabilities, routes));
  assert.throws(() => h.failoverConfiguration(config, { ...capabilities, providers: capabilities.providers.map(provider => ({ ...provider, sourceSupported: provider.provider === 'PAWAPAY' })) }, routes));
  assert.throws(() => h.failoverConfiguration(config, { ...capabilities, providers: capabilities.providers.map(provider => ({ ...provider, targetSupported: provider.provider !== 'PAWAPAY' })) }, routes));
});

test('route pickers include all reviewed sources, alternate-only ArakaPay and inactive mappings for review', async () => {
  const h = await helpers;
  const inventory = [...routes, { ...routes[1], id: 22, active: false }, { ...routes[0], id: 23, paymentMethodId: 99 }];
  assert.deepEqual(h.failoverRoutes(inventory, capabilities).map(route => route.id), [1, 2, 3, 22, 23]);
  assert.deepEqual(h.failoverRoutes(inventory, capabilities, routes[2]).map(route => route.id), [1, 2, 4, 22]);
  assert.deepEqual(h.failoverRoutes(inventory, capabilities, routes[0]).map(route => route.id), [2, 3, 4, 22]);
});

test('sample previews reject evidence from another provider without adding any submit or provider inputs', async () => {
  const h = await helpers;
  const sample = { accountId: '123', sourceRouteId: '2', amount: '10', currency: 'CDF', accountNumber: '243810000000', action: 'BUSINESS_API_PAYOUT' };
  const result = h.failoverPreview({ context: 'SAMPLE', sample, rejectionCode: 'AVADAPAY_FINAL_FAILED' }, capabilities, routes);
  assert.equal(result.rejectionCode, 'AVADAPAY_FINAL_FAILED'); assert.equal(result.sample.sourceRouteId, 2);
  assert.equal(Object.hasOwn(result, 'provider'), false);
  for (const rejectionCode of ['MAPLERAD_FINAL_FAILED', 'AVADAPAY_FINAL_NON_RETRYABLE', 'AVADAPAY_FINAL_CANCELLED']) assert.throws(() => h.failoverPreview({ context: 'SAMPLE', sample, rejectionCode }, capabilities, routes));
});

test('coverage preserves executable paths when optional routes are missing instead of overriding backend readiness', async () => {
  const h = await helpers;
  const response = { configuration: configuration([scope(['PAWAPAY', 'AVADAPAY', 'ARAKAPAY'])]), readiness: { valid: true, issues: [], routes: [] }, skippedSources: 0, truncated: false,
    coverage: [{ paymentMethod: 'MPESA_DRC_CDF', countryCode: 'CD', currency: 'CDF', action: 'BUSINESS_API_PAYOUT', scopeId: 'reviewed-chain', enabled: true, providers: ['PAWAPAY', 'AVADAPAY', 'ARAKAPAY'], routes: [{ provider: 'PAWAPAY', routeId: 1, active: true }, { provider: 'AVADAPAY', routeId: 2, active: true }, { provider: 'ARAKAPAY', routeId: null, active: false }], executable: true, blockers: [] }] };
  const result = h.payoutDefaultsResource(response);
  assert.equal(result.coverage[0].executable, true); assert.equal(result.skippedSources, 0); assert.equal(result.coverage[0].routes[2].routeId, null);
});

test('evidence labels distinguish backend final-failure codes from journal state and submission replies', async () => {
  const { failureConditionLabel, attemptLabel } = await load('lib/failover-presentation.js');
  assert.match(failureConditionLabel('AVADAPAY_FINAL_FAILED'), /authenticated/);
  assert.match(failureConditionLabel('MAPLERAD_FINAL_FAILED'), /signed/);
  assert.match(failureConditionLabel('AVADAPAY_FINAL_NON_RETRYABLE'), /no switch/);
  assert.equal(attemptLabel('REJECTED'), 'Confirmed non-payment');
  assert.match(attemptLabel('RETURNED'), /not yet proven/);
});
