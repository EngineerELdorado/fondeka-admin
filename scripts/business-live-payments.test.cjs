const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.join(__dirname, '..');
const importSource = (file, suffix = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(root, file), 'utf8')).toString('base64')}#${suffix}`);
const flagKey = 'business_api.live_payments.enabled';

test('Business modes preserve explicit disables and require valid saved policy fields', async () => {
  const { livePaymentMode, livePaymentSettingsAvailable } = await importSource('lib/business-live-payments.js');
  for (const global of [false, true]) {
    for (const override of [null, false, true]) {
      const business = { apiLivePaymentsEnabledOverride: override, apiLivePaymentsGlobalEnabled: global, apiLivePaymentsEnabled: override ?? global };
      assert.equal(livePaymentMode(business), override === null ? 'inherit' : override ? 'enabled' : 'disabled');
      assert.equal(livePaymentSettingsAvailable(business), true);
    }
  }
  const valid = { apiLivePaymentsEnabledOverride: false, apiLivePaymentsGlobalEnabled: true, apiLivePaymentsEnabled: false };
  for (const field of ['apiLivePaymentsEnabled', 'apiLivePaymentsGlobalEnabled']) {
    for (const value of [undefined, null, 'false', 0]) {
      assert.equal(livePaymentSettingsAvailable({ ...valid, [field]: value }), false);
    }
  }
  assert.equal(livePaymentSettingsAvailable({ ...valid, apiLivePaymentsEnabledOverride: 'false' }), false);
  assert.equal(livePaymentSettingsAvailable(null), false);
});

test('LIVE API requests use the configured base, Bearer token and bodyless inheritance reset', async (t) => {
  const originalBase = process.env.NEXT_PUBLIC_ADMIN_API_BASE;
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.NEXT_PUBLIC_ADMIN_API_BASE;
    else process.env.NEXT_PUBLIC_ADMIN_API_BASE = originalBase;
  });
  for (const base of ['https://admin.example.test/', 'https://admin.example.test/admin-api/']) {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = base;
    const { api } = await importSource('lib/api.js', base);
    api.setAuthToken('admin-test-token');
    const calls = [];
    const savedBusiness = { id: 42, apiLivePaymentsEnabledOverride: false, apiLivePaymentsGlobalEnabled: true, apiLivePaymentsEnabled: false };
    global.fetch = async (url, init) => {
      calls.push({ url, ...init });
      return Response.json(savedBusiness);
    };
    assert.deepEqual(await api.businesses.updateApiLivePayments(42, { enabled: false, reason: 'Pilot paused' }), savedBusiness);
    assert.deepEqual(await api.businesses.resetApiLivePayments(42), savedBusiness);
    await api.featureFlags.get(flagKey);
    await api.featureFlags.update(flagKey, { enabled: true });
    assert.equal(calls[0].url, 'https://admin.example.test/admin-api/businesses/42/api-live-payments');
    assert.equal(calls[0].method, 'PUT');
    assert.deepEqual(JSON.parse(calls[0].body), { enabled: false, reason: 'Pilot paused' });
    assert.equal(calls[1].method, 'DELETE');
    assert.equal(Object.hasOwn(calls[1], 'body'), false);
    assert.equal(calls[2].url, `https://admin.example.test/admin-api/feature-flags/${flagKey}`);
    assert.deepEqual(JSON.parse(calls[3].body), { enabled: true });
    for (const call of calls) {
      assert.equal(call.headers.Authorization, 'Bearer admin-test-token');
      assert.equal(call.cache, 'no-store');
    }
  }
});

test('policy failures retain backend status and validation messages for the UI', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  const { api } = await importSource('lib/api.js', 'errors');
  for (const status of [400, 401, 403, 404, 409, 500]) {
    const message = `Backend policy error ${status}`;
    global.fetch = async () => Response.json({ message }, { status });
    await assert.rejects(api.businesses.updateApiLivePayments(42, { enabled: true }), (error) => error.status === status && error.message === message);
  }
  global.fetch = async () => { throw new TypeError('Network unavailable'); };
  await assert.rejects(api.businesses.resetApiLivePayments(42), /Network unavailable/);
});

test('policy permission denials stay on screen while unrelated authorization behavior is preserved', async (t) => {
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  });
  const events = [];
  global.window = { dispatchEvent: (event) => events.push(event.type) };
  global.fetch = async () => Response.json({ message: 'Permission denied' }, { status: 403 });
  const { api } = await importSource('lib/api.js', 'permissions');
  for (const call of [
    () => api.businesses.get(42),
    () => api.businesses.updateApiLivePayments(42, { enabled: true }),
    () => api.businesses.resetApiLivePayments(42),
    () => api.featureFlags.get(flagKey),
    () => api.featureFlags.update(flagKey, { enabled: false })
  ]) await assert.rejects(call(), (error) => error.status === 403);
  assert.deepEqual(events, []);
  await assert.rejects(api.accounts.get(1), (error) => error.status === 403);
  assert.deepEqual(events, ['fondeka:auth-forbidden']);
});
