const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const source = readFileSync(path.join(__dirname, '../lib/api.js'), 'utf8');
const importApi = (suffix) => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#regulator-${suffix}`);
const key = 'enableRegulatorMode';

test('account detail settings resolve all six global/override combinations without losing explicit false', async () => {
  const source = readFileSync(path.join(__dirname, '../lib/regulator-mode.js'), 'utf8');
  const { accountRegulatorModeSettings, accountRegulatorModeChoice } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  for (const globalEnabled of [false, true]) {
    for (const override of [null, false, true]) {
      const overrides = [
        { accountId: 456, enabled: !globalEnabled },
        ...(override == null ? [] : [{ accountId: 123, email: 'customer+pilot@example.com', enabled: override }])
      ];
      const saved = accountRegulatorModeSettings({ enabled: globalEnabled }, overrides, '123');
      assert.deepEqual(saved, { globalEnabled, overrideEnabled: override, enabled: override ?? globalEnabled });
      assert.equal(accountRegulatorModeChoice(saved), override == null ? 'inherit' : override ? 'enabled' : 'disabled');
    }
  }
});

test('account detail settings require valid saved Booleans and match the resolved account ID', async () => {
  const source = readFileSync(path.join(__dirname, '../lib/regulator-mode.js'), 'utf8');
  const { accountRegulatorModeSettings } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  for (const enabled of [null, undefined, 'false', 0]) {
    assert.equal(accountRegulatorModeSettings({ enabled }, [], 123), null);
    assert.equal(accountRegulatorModeSettings({ enabled: true }, [{ accountId: 123, enabled }], 123), null);
  }
  assert.equal(accountRegulatorModeSettings({ enabled: false }, null, 123), null);
  assert.equal(accountRegulatorModeSettings({ enabled: false }, [], null), null);
  assert.equal(accountRegulatorModeSettings({ enabled: true }, [{ accountId: 123, enabled: true }, { accountId: 123, enabled: false }], 123), null);
  assert.deepEqual(accountRegulatorModeSettings({ enabled: true }, [{ accountId: 456, email: 'same@example.com', enabled: false }], 123), { globalEnabled: true, overrideEnabled: null, enabled: true });
  assert.deepEqual(accountRegulatorModeSettings({ enabled: true }, [{ account: { id: 123 }, enabled: false }], 123), { globalEnabled: true, overrideEnabled: false, enabled: false });
});

test('global and account Regulator mode updates send only the Boolean signal and return saved backend values', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  const { api } = await importApi('writes');
  api.setAuthToken('admin-test-token');
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, ...init });
    const enabled = JSON.parse(init.body).enabled;
    return Response.json({ key, accountId: 123, enabled });
  };
  for (const enabled of [true, false]) {
    const genericEditorPayload = { enabled, disabledBehavior: 'BLOCK_REQUEST', clientPresentation: 'DISABLED', disabledMessageEn: 'unused' };
    assert.equal((await api.featureFlags.update(key, genericEditorPayload)).enabled, enabled);
    assert.equal((await api.featureFlags.upsertOverride(key, 123, genericEditorPayload)).enabled, enabled);
    const byEmail = await api.featureFlags.upsertOverrideByEmail(key, ' Customer+pilot@Example.com ', genericEditorPayload);
    assert.deepEqual(byEmail, { key, accountId: 123, enabled });
    for (const call of calls.slice(-3)) {
      assert.equal(call.method, 'PUT');
      assert.deepEqual(JSON.parse(call.body), { enabled });
      assert.equal(call.headers.Authorization, 'Bearer admin-test-token');
      assert.equal(call.cache, 'no-store');
    }
  }
  assert.match(calls[0].url, /\/feature-flags\/enableRegulatorMode$/);
  assert.match(calls[1].url, /\/overrides\/123$/);
  const emailUrl = new URL(calls[2].url, 'https://admin.example.test');
  assert.equal(emailUrl.searchParams.get('email'), 'Customer+pilot@Example.com');
  assert.match(emailUrl.search, /%2Bpilot%40/);
});

test('account and email resets use bodyless DELETE and accept empty 204 responses', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  const { api } = await importApi('reset');
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, ...init });
    return new Response(null, { status: 204 });
  };
  assert.equal(await api.featureFlags.removeOverride(key, 123), null);
  assert.equal(await api.featureFlags.removeOverrideByEmail(key, 'customer+pilot@example.com'), null);
  for (const call of calls) {
    assert.equal(call.method, 'DELETE');
    assert.equal(Object.hasOwn(call, 'body'), false);
  }
  assert.match(calls[1].url, /\/overrides\/by-email\?email=customer%2Bpilot%40example.com$/);
});

test('explicit false overrides survive reads and permission failures stay visible without signing out', async (t) => {
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  });
  const { api } = await importApi('failures');
  const saved = [{ accountId: 123, key, enabled: false }];
  global.fetch = async () => Response.json(saved);
  assert.deepEqual(await api.featureFlags.listOverrides(key), saved);
  const events = [];
  global.window = { dispatchEvent: (event) => events.push(event.type) };
  global.fetch = async () => Response.json({ message: 'Administrators only' }, { status: 403 });
  for (const call of [
    () => api.featureFlags.get(key),
    () => api.featureFlags.update(key, { enabled: true }),
    () => api.featureFlags.listOverrides(key),
    () => api.featureFlags.upsertOverride(key, 123, { enabled: false }),
    () => api.featureFlags.upsertOverrideByEmail(key, 'pilot@example.com', { enabled: true }),
    () => api.featureFlags.removeOverride(key, 123),
    () => api.featureFlags.removeOverrideByEmail(key, 'pilot@example.com')
  ]) await assert.rejects(call(), (error) => error.status === 403 && error.message === 'Administrators only');
  assert.deepEqual(events, []);
  global.fetch = async () => Response.json({ message: 'Existing account not found' }, { status: 404 });
  await assert.rejects(api.featureFlags.upsertOverrideByEmail(key, 'missing@example.com', { enabled: true }), (error) => error.status === 404 && error.message === 'Existing account not found');
});
