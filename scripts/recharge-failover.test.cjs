const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const uri = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const file = name => readFileSync(path.join(__dirname, '..', name), 'utf8');
const load = (name, tag = '') => import(uri(file(name).replace("'@/lib/payout-failover'", JSON.stringify(uri(file('lib/payout-failover.js'))))) + '#' + tag);
const helpers = load('lib/recharge-failover.js');
const capabilities = { defaultEnabled: false, maximumAttempts: 2, productApprovalRequired: true, priceTypes: ['FIXED'], productTypes: ['AIRTIME', 'DATA', 'BUNDLE'], funding: 'EXISTING_WALLET_DEBIT', rejectionCodes: { RELOADLY: ['REFUNDED'], ZENDIT: ['INSUFFICIENT_FUNDS', 'NO_INVENTORY', 'OFFER_UNAVAILABLE', 'PROVIDER_UNAVAILABLE'] } };
const source = { provider: 'RELOADLY', operatorId: 1009, offerId: null, amount: 5, currency: 'USD', deliveredAmount: 15000, deliveredCurrency: 'CDF', fingerprint: 'opaque-source-fingerprint' };
const target = { provider: 'ZENDIT', operatorId: null, offerId: 'real-offer', amount: 5.1, currency: 'USD', deliveredAmount: 15000, deliveredCurrency: 'CDF', fingerprint: 'opaque-target-fingerprint' };
const rule = { id: 'cd-vodacom-fixed', enabled: true, country: 'CD', type: 'AIRTIME', source, target, networkIdentity: 'Vodacom', benefitsReview: 'Verified identical airtime, tax, prepaid eligibility and promotion terms.', expiresAt: '2099-01-01T00:00:00Z', maxAdditionalCost: '0.10', failureCodes: ['REFUNDED'] };
const configuration = { enabled: false, createdAfter: null, accountIds: [123], rules: [rule] };

test('recharge capabilities keep policies independent and expose only fixed approved products with two attempts', async () => {
  const h = await helpers;
  assert.deepEqual(h.rechargeCapabilities(capabilities), capabilities);
  assert.deepEqual(h.rechargeCodes(capabilities, 'RELOADLY'), ['REFUNDED']);
  assert.equal(h.rechargeCodes(capabilities, 'RELOADLY').includes('INSUFFICIENT_FUNDS'), false);
  for (const fields of [{ maximumAttempts: 3 }, { funding: 'EXTERNAL_COLLECTION' }, { productApprovalRequired: false }]) assert.throws(() => h.rechargeCapabilities({ ...capabilities, ...fields }));
});

test('provider inspections use exact identity, fixed amount and no purchase or quote inputs', async () => {
  const h = await helpers;
  assert.deepEqual(h.rechargeInspectionRequest({ country: ' cd ', type: 'AIRTIME', provider: 'RELOADLY', operatorId: '1009', offerId: 'ignored', amount: '5.00' }, capabilities), { country: 'CD', type: 'AIRTIME', provider: 'RELOADLY', operatorId: 1009, amount: '5.00' });
  assert.deepEqual(h.rechargeInspectionRequest({ country: 'CD', type: 'DATA', provider: 'ZENDIT', operatorId: '999', offerId: 'offer+id', amount: '5.10' }, capabilities), { country: 'CD', type: 'DATA', provider: 'ZENDIT', offerId: 'offer+id', amount: '5.10' });
  for (const fields of [{ country: '' }, { type: 'RANGE' }, { provider: 'OTHER' }, { operatorId: 0 }, { amount: '0' }]) assert.throws(() => h.rechargeInspectionRequest({ country: 'CD', type: 'AIRTIME', provider: 'RELOADLY', operatorId: '1009', amount: '5', ...fields }, capabilities));
});

test('inspection responses preserve product nulls, fingerprints and terms and reject mismatched or incomplete evidence', async () => {
  const h = await helpers, request = { country: 'CD', type: 'AIRTIME', provider: 'RELOADLY', operatorId: 1009, amount: '5.00' };
  const response = { product: source, terms: { name: 'Vodacom', notes: 'Journée • entière', fees: 0 }, reviewRequired: 'Verify equivalent benefits.' };
  const inspected = h.rechargeInspectionResource(response, request);
  assert.deepEqual(inspected.product, source); assert.deepEqual(inspected.terms, response.terms);
  assert.equal(inspected.product.offerId, null); assert.equal(inspected.product.fingerprint, source.fingerprint);
  for (const product of [{ ...source, operatorId: 99 }, { ...source, fingerprint: null }, { ...source, amount: '5.1' }]) assert.throws(() => h.rechargeInspectionResource({ ...response, product }, request));
  assert.throws(() => h.rechargeInspectionResource({ product: source }, request));
});

test('equivalence and additional-cost comparisons are exact decimals and never infer data or bundle benefits', async () => {
  const h = await helpers;
  assert.deepEqual(h.rechargeRule(rule, capabilities), rule);
  const decimals = { ...rule, source: { ...source, amount: '0.1' }, target: { ...target, amount: '0.2' }, maxAdditionalCost: '0.1' };
  assert.doesNotThrow(() => h.rechargeRule(decimals, capabilities));
  assert.throws(() => h.rechargeRule({ ...decimals, target: { ...target, amount: '0.200000000000000001' } }, capabilities), /ceiling/);
  assert.throws(() => h.rechargeRule({ ...rule, target: { ...target, deliveredAmount: '15000.000000000001' } }, capabilities), /exactly/);
  assert.throws(() => h.rechargeRule({ ...rule, target: { ...target, deliveredCurrency: 'USD' } }, capabilities));
  for (const type of ['DATA', 'BUNDLE']) assert.doesNotThrow(() => h.rechargeRule({ ...rule, type, source: { ...source, deliveredAmount: null, deliveredCurrency: null }, target: { ...target, deliveredAmount: null, deliveredCurrency: null } }, capabilities));
});

test('reviewed reverse mappings select Zendit conditions explicitly and preserve zero ceilings', async () => {
  const h = await helpers;
  const reverse = { ...rule, id: 'reverse', source: target, target: source, maxAdditionalCost: 0, failureCodes: ['NO_INVENTORY'] };
  assert.deepEqual(h.rechargeRule(reverse, capabilities), reverse);
  assert.throws(() => h.rechargeRule({ ...reverse, failureCodes: ['REFUNDED'] }, capabilities));
  assert.throws(() => h.rechargeRule({ ...rule, failureCodes: ['UNKNOWN_ERROR'] }, capabilities));
  assert.throws(() => h.rechargeRule({ ...rule, target: source }, capabilities));
  assert.throws(() => h.rechargeRule({ ...rule, target: { ...target, currency: 'CDF' } }, capabilities));
  assert.throws(() => h.rechargeRule({ ...rule, benefitsReview: 'looks similar' }, capabilities));
});

test('flat saved snapshots preserve inactive/expired approvals for pause while active drafts enforce expiry and cutovers', async () => {
  const h = await helpers;
  const expired = { ...rule, expiresAt: '2020-01-01T00:00:00Z' };
  const snapshot = { revision: 8, configuration: { ...configuration, enabled: true, createdAfter: '2026-01-01T00:00:00Z', rules: [expired] }, cutoverFloor: '2026-01-01T00:00:00Z', emergencyDisabled: false };
  assert.deepEqual(h.rechargeResource(snapshot), snapshot);
  assert.throws(() => h.rechargeConfiguration(snapshot.configuration, capabilities), /unexpired/);
  assert.doesNotThrow(() => h.rechargeConfiguration({ ...snapshot.configuration, enabled: false }, capabilities));
  for (const response of [{ policy: snapshot }, { ...snapshot, emergencyDisabled: null }, { ...snapshot, configuration: { ...configuration, enabled: null } }, { ...snapshot, revision: null }]) assert.throws(() => h.rechargeResource(response));
  assert.throws(() => h.rechargeConfiguration({ ...configuration, enabled: true }, capabilities), /cutover/);
});

test('full replacements retain ordered stable IDs and explicit false and reject empty IDs, duplicates and unknown fields', async () => {
  const h = await helpers;
  const second = { ...rule, id: 'second', enabled: false };
  const draft = h.rechargeDraft({ ...configuration, rules: [rule, second] });
  const result = h.rechargeConfiguration({ ...draft, rules: [...draft.rules].reverse(), accountIds: '' }, capabilities);
  assert.deepEqual(result.rules.map(r => r.id), ['second', rule.id]); assert.equal(result.rules[0].enabled, false); assert.deepEqual(result.accountIds, []);
  for (const value of [{ ...configuration, accountIds: '123,,456' }, { ...configuration, accountIds: [0] }, { ...configuration, rules: [rule, rule] }, { ...configuration, rules: Array(101).fill(rule) }, { ...configuration, extra: null }]) assert.throws(() => h.rechargeConfiguration(value, capabilities));
});

test('recharge preview requires a real transaction and sends only its optional complete candidate configuration', async () => {
  const h = await helpers;
  assert.deepEqual(h.rechargePreview('91'), { transactionId: 91 });
  assert.deepEqual(h.rechargePreview(91, configuration, capabilities), { transactionId: 91, configuration });
  for (const id of [0, -1, '', 'sample', '91x']) assert.throws(() => h.rechargePreview(id));
});

test('array pagination preserves false filters and missing protection flags never masquerade as resolved', async () => {
  const h = await helpers;
  const query = h.rechargeQuery({ transactionId: '91', conflicted: false }, 0, 100);
  assert.equal(query.get('conflicted'), 'false'); assert.equal(query.get('page'), '0'); assert.equal(query.get('transactionId'), '91');
  for (const args of [[{}, -1, 20], [{}, 0, 101], [{ transactionId: 0 }, 0, 20]]) assert.throws(() => h.rechargeQuery(...args));
  const operation = { transactionId: 91, purchase: { quote: {} }, currentAttempt: 1, conflicted: false, refundReserved: false, attempts: [] };
  assert.deepEqual(h.rechargeOperationResource(operation), operation);
  assert.throws(() => h.rechargeOperationResource({ ...operation, refundReserved: undefined }));
});

test('recharge API stays independent from payout, uses exact methods and preserves forbidden errors in place', async (t) => {
  const original = global.fetch, previousWindow = global.window;
  t.after(() => { global.fetch = original; if (previousWindow === undefined) delete global.window; else global.window = previousWindow; });
  const { api } = await load('lib/api.js', 'recharge');
  api.setAuthToken('recharge-admin');
  const calls = [], events = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({}); };
  await api.rechargeFailover.capabilities(); await api.rechargeFailover.policy(); await api.rechargeFailover.publish({ expectedRevision: 0, configuration, reason: 'Reviewed' });
  await api.rechargeFailover.activate({ expectedRevision: 1, enabled: false, reason: 'Pause' }); await api.rechargeFailover.history({ page: 0, size: 20 });
  await api.rechargeFailover.inspect({ country: 'CD', type: 'AIRTIME', provider: 'RELOADLY', operatorId: 1009, amount: '5' });
  await api.rechargeFailover.preview({ transactionId: 91 }); await api.rechargeFailover.operations({ conflicted: false, page: 0, size: 20 }); await api.rechargeFailover.operation(91); await api.rechargeFailover.metrics();
  assert.deepEqual(calls.map(call => call.init.method || 'GET'), ['GET', 'GET', 'PUT', 'PATCH', 'GET', 'POST', 'POST', 'GET', 'GET', 'GET']);
  for (const call of calls) { assert.match(call.url, /\/admin-api\/recharge-failover\//); assert.equal(call.init.headers.Authorization, 'Bearer recharge-admin'); assert.equal(call.init.cache, 'no-store'); assert.doesNotMatch(call.url, /payout-failover|refund|retry|reset|status-check/); }
  assert.match(calls[7].url, /conflicted=false/);
  assert.equal(api.rechargeFailover.statusCheck, undefined); assert.equal(api.rechargeFailover.refund, undefined);
  global.window = { dispatchEvent: event => events.push(event.type) };
  global.fetch = async () => Response.json({ message: 'Super Admin required' }, { status: 403 });
  await assert.rejects(api.rechargeFailover.publish({}), err => err.status === 403 && err.message === 'Super Admin required');
  assert.deepEqual(events, []);
});

test('wire amounts are lossless and retain normalized Java BigDecimal scale without changing fingerprints or catalog copy', async (t) => {
  const previous = global.fetch; t.after(() => { global.fetch = previous; });
  const { api } = await load('lib/api.js', 'recharge-decimals');
  const h = await helpers;
  const raw = '{"product":{"provider":"RELOADLY","operatorId":1009,"offerId":null,"amount":1E+1,"currency":"USD","deliveredAmount":15000.000000000000000001,"deliveredCurrency":"CDF","fingerprint":"opaque-approved"},"terms":{"message":"Copy \\"amount\\":123 stays untouched","amount":[1,2],"fees":0.000000000000000001},"reviewRequired":"Review both products."}';
  global.fetch = async () => new Response(raw, { headers: { 'Content-Type': 'application/json' } });
  const inspection = await api.rechargeFailover.inspect({ country: 'CD', type: 'AIRTIME', provider: 'RELOADLY', operatorId: 1009, amount: '10' });
  assert.equal(inspection.product.amount, '1E+1');
  assert.equal(inspection.product.deliveredAmount, '15000.000000000000000001');
  assert.equal(inspection.terms.message, 'Copy "amount":123 stays untouched');
  assert.deepEqual(inspection.terms.amount, [1, 2]);
  assert.equal(inspection.terms.fees, '0.000000000000000001');
  assert.equal(h.rechargeDecimalText('1.5E+4'), '15000');
  assert.equal(h.rechargeDecimalText('1.234E-8'), '0.00000001234');
  let body;
  global.fetch = async (_url, init) => { body = JSON.parse(init.body); return Response.json({}); };
  await api.rechargeFailover.publish({ expectedRevision: 0, configuration: { ...configuration, rules: [{ ...rule, source: inspection.product }] }, reason: 'Reviewed exact decimals' });
  assert.equal(body.configuration.rules[0].source.amount, '1e1');
  assert.equal(body.configuration.rules[0].source.deliveredAmount, '1.5000000000000000000001e4');
  assert.equal(body.configuration.rules[0].source.fingerprint, 'opaque-approved');
  assert.equal(body.configuration.rules[0].source.operatorId, 1009);
  assert.equal(body.configuration.rules[0].source.offerId, null);
});
