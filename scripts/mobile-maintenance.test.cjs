const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const importFile = (name, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '..', name), 'utf8')).toString('base64')}#${tag}`);
const helpers = importFile('lib/mobile-maintenance.js');

test('maintenance preserves Unicode copy, explicit false ownership and every supported audience selector', async () => {
  const { maintenancePolicyPayload, newMaintenanceRule } = await helpers;
  const rule = {
    ...newMaintenanceRule(), targetAccountIds: '123, 456', platforms: ['ios', 'android'],
    audience: {
      countryIds: '1, 2', countryCodes: 'rw, CD', deviceLanguages: 'fr-CD, en', kycStatuses: 'APPROVED',
      accountCreatedFrom: '2026-01-01', accountCreatedTo: '2026-01-31',
      hasCryptoWallets: false, hasSavings: false, hasGroupSavings: false, hasCards: true, hasLoans: false, hasEsims: true, hasPaymentRequests: false,
      hasCompletedTransactions: false, minCompletedTransactions: '0', maxCompletedTransactions: '10', lastTransactionOlderThanDays: '3', minTransactionsThisMonth: '0', maxTransactionsThisMonth: '5',
      billProductIds: '3', paymentMethodIds: '4', paymentProviderIds: '5', transactionStatuses: 'COMPLETED', transactionServices: ['CARD'], transactionActions: ['CARD_PAYMENT']
    }, appVersionAtLeast: '1.2.3', appVersionLessThan: '2.0', includeMissingAppVersion: true, startAt: '2026-11-01T03:00', endAt: '2026-11-01T04:00'
  };
  const result = maintenancePolicyPayload({ enabled: true, rules: [rule] });
  assert.deepEqual(result.rules[0].targetAccountIds, [123, 456]);
  assert.deepEqual(result.rules[0].audience.countryCodes, ['RW', 'CD']);
  for (const key of ['hasCryptoWallets', 'hasSavings', 'hasGroupSavings', 'hasLoans', 'hasPaymentRequests', 'hasCompletedTransactions']) assert.equal(result.rules[0].audience[key], false);
  assert.equal(result.rules[0].audience.minCompletedTransactions, 0);
  assert.equal(result.rules[0].messageEn, rule.messageEn);
  assert.equal(result.rules[0].messageFr, rule.messageFr);
  assert.equal(result.rules[0].startAt, '2026-11-01T03:00:00Z');
  assert.deepEqual(maintenancePolicyPayload(result, { draft: false }), result);
});

test('blank draft selectors are omitted deliberately; explicit empty audiences/lists and unknown fields are rejected', async () => {
  const { maintenancePolicyPayload, newMaintenanceRule } = await helpers;
  const policy = (fields = {}) => ({ enabled: false, rules: [{ ...newMaintenanceRule(), ...fields }] });
  const result = maintenancePolicyPayload(policy({ targetAccountIds: '', audience: { countryCodes: '', hasCards: '' }, platforms: [], appVersionAtLeast: '', startAt: '' }));
  assert.equal(Object.hasOwn(result.rules[0], 'targetAccountIds'), false);
  assert.equal(Object.hasOwn(result.rules[0], 'audience'), false);
  assert.equal(Object.hasOwn(result.rules[0], 'platforms'), false);
  for (const fields of [{ audience: {} }, { targetAccountIds: [] }, { audience: { countryCodes: [] } }, { audience: { countryCodse: ['RW'] } }, { audience: { targetAccountIds: [123] } }, { platform: 'ios' }]) assert.throws(() => maintenancePolicyPayload(policy(fields)));
  assert.throws(() => maintenancePolicyPayload({ enabled: false, rules: [], rule: {} }), /unsupported fields/);
  assert.throws(() => maintenancePolicyPayload(policy({ targetAccountIds: '' }), { draft: false }));
});

test('maintenance rejects invalid IDs, ranges, platforms, counts, versions and markup before saving', async () => {
  const { maintenancePolicyPayload, newMaintenanceRule } = await helpers;
  const invalid = [
    { targetAccountIds: '0' }, { targetAccountIds: '123abc' }, { targetAccountIds: '9007199254740993' },
    { targetAccountIds: Array.from({ length: 1001 }, (_, i) => i + 1) },
    { audience: { minCompletedTransactions: 11, maxCompletedTransactions: 10 } },
    { audience: { minTransactionsThisMonth: -1 } }, { audience: { hasCards: null } },
    { audience: { accountCreatedFrom: '2026-02-31' } }, { audience: { accountCreatedFrom: '2026-02-01', accountCreatedTo: '2026-01-31' } },
    { platforms: ['web'] }, { enabled: null }, { appVersionAtLeast: '1.2.3 (456)' }, { appVersionAtLeast: '2', appVersionLessThan: '2.0.0' },
    { startAt: '2026-02-31T01:00:00Z' }, { startAt: '2026-01-01T01:00:00Z', endAt: '2026-01-01T00:00:00Z' },
    { titleEn: 'x'.repeat(201) }, { messageFr: 'x'.repeat(4001) }, { messageEn: '<b>Maintenance</b>' }
  ];
  for (const fields of invalid) assert.throws(() => maintenancePolicyPayload({ enabled: false, rules: [{ ...newMaintenanceRule(), ...fields }] }), JSON.stringify(fields).slice(0, 100));
  assert.throws(() => maintenancePolicyPayload({ enabled: true, rules: Array.from({ length: 51 }, newMaintenanceRule) }), /50 rules/);
});

test('maintenance retains tie order and precise existing instants without sorting or truncating the policy', async () => {
  const { maintenancePolicyPayload, maintenancePolicyFingerprint, newMaintenanceRule } = await helpers;
  const rule = { ...newMaintenanceRule(), priority: 10, startAt: '2026-01-01T02:00:00.123456789+02:00', endAt: '2026-01-01T00:00:00.123456790Z' };
  const policy = { enabled: false, rules: [{ ...rule, name: 'First' }, { ...rule, name: 'Second' }] };
  const result = maintenancePolicyPayload(policy, { draft: false });
  assert.deepEqual(result.rules.map((item) => item.name), ['First', 'Second']);
  assert.equal(result.rules[0].startAt, rule.startAt);
  assert.equal(result.rules[0].endAt, rule.endAt);
  assert.equal(maintenancePolicyFingerprint({ rules: result.rules, enabled: false }), maintenancePolicyFingerprint(result));
  assert.notEqual(maintenancePolicyFingerprint({ ...result, rules: [...result.rules].reverse() }), maintenancePolicyFingerprint(result));
  assert.deepEqual(maintenancePolicyPayload({ enabled: false, rules: [] }), { enabled: false, rules: [] });
});

test('maintenance API reads and replaces the whole policy with the configured admin token; denied saves stay on screen', async (t) => {
  const oldFetch = global.fetch, oldWindow = global.window;
  t.after(() => { global.fetch = oldFetch; if (oldWindow === undefined) delete global.window; else global.window = oldWindow; });
  const { api } = await importFile('lib/api.js', 'maintenance');
  api.setAuthToken('maintenance-admin');
  const calls = [], events = [];
  const policy = { enabled: false, rules: [{ name: 'Retained', enabled: true, priority: 0, audience: { hasCards: false } }] };
  global.fetch = async (url, init) => { calls.push({ url, ...init }); return Response.json(policy); };
  assert.deepEqual(await api.mobileMaintenance.get(), policy);
  assert.deepEqual(await api.mobileMaintenance.update(policy), policy);
  assert.match(calls[0].url, /\/admin-api\/mobile-maintenance$/);
  assert.equal(calls[1].method, 'PUT');
  assert.deepEqual(JSON.parse(calls[1].body), policy);
  for (const call of calls) { assert.equal(call.headers.Authorization, 'Bearer maintenance-admin'); assert.equal(call.cache, 'no-store'); }
  global.window = { dispatchEvent: (event) => events.push(event.type) };
  global.fetch = async () => Response.json({ message: 'Maintenance permission denied' }, { status: 403 });
  await assert.rejects(api.mobileMaintenance.update(policy), (err) => err.status === 403 && err.message === 'Maintenance permission denied');
  assert.deepEqual(events, []);
});
