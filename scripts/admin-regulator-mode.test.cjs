const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const source = readFileSync(path.join(__dirname, '../lib/api.js'), 'utf8');
const importApi = (suffix) => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#admin-regulator-${suffix}`);

test('admin profile and ID/email mode updates preserve explicit false and encode email', async (t) => {
  const previous = global.fetch;
  t.after(() => { global.fetch = previous; });
  const { api } = await importApi('writes');
  api.setAuthToken('admin-test');
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, ...init });
    const enabled = init.body ? JSON.parse(init.body).enabled : false;
    return Response.json({ id: 7, enableRegulatorMode: enabled, regulatorModeOverride: init.body ? enabled : null });
  };
  const profile = await api.admins.me();
  assert.equal(profile.enableRegulatorMode, false);
  assert.equal(profile.regulatorModeOverride, null);
  assert.match(calls[0].url, /\/admins\/me$/);
  for (const enabled of [true, false]) {
    for (const request of [
      () => api.admins.setRegulatorMode(7, enabled),
      () => api.admins.setRegulatorModeByEmail(' Reviewer+pilot@Example.com ', enabled)
    ]) {
      const result = await request();
      assert.equal(result.enableRegulatorMode, enabled);
      assert.equal(result.regulatorModeOverride, enabled);
      const call = calls.at(-1);
      assert.equal(call.method, 'PUT');
      assert.deepEqual(JSON.parse(call.body), { enabled });
      assert.equal(call.headers.Authorization, 'Bearer admin-test');
      assert.equal(call.cache, 'no-store');
    }
  }
  assert.match(calls[1].url, /\/admins\/7\/regulator-mode$/);
  const target = new URL(calls[2].url, 'https://admin.example.test');
  assert.equal(target.searchParams.get('email'), 'Reviewer+pilot@Example.com');
  assert.match(target.search, /%2Bpilot%40/);
});

test('admin ID/email inheritance uses bodyless DELETE and accepts empty responses', async (t) => {
  const previous = global.fetch;
  t.after(() => { global.fetch = previous; });
  const { api } = await importApi('reset');
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, ...init });
    return new Response(null, { status: 204 });
  };
  assert.equal(await api.admins.resetRegulatorMode(7), null);
  assert.equal(await api.admins.resetRegulatorModeByEmail('reviewer+pilot@example.com'), null);
  for (const call of calls) {
    assert.equal(call.method, 'DELETE');
    assert.equal(Object.hasOwn(call, 'body'), false);
  }
  assert.match(calls[1].url, /\/admins\/regulator-mode\/by-email\?email=reviewer%2Bpilot%40example.com$/);
});

test('denied admin overrides remain visible errors without signing out the actor', async (t) => {
  const previousFetch = global.fetch;
  const previousWindow = global.window;
  t.after(() => {
    global.fetch = previousFetch;
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
  });
  const { api } = await importApi('errors');
  const events = [];
  global.window = { dispatchEvent: (event) => events.push(event.type) };
  global.fetch = async () => Response.json({ message: 'Super Admin required' }, { status: 403 });
  for (const request of [
    () => api.admins.setRegulatorMode(7, true),
    () => api.admins.resetRegulatorMode(7),
    () => api.admins.setRegulatorModeByEmail('reviewer@example.com', false),
    () => api.admins.resetRegulatorModeByEmail('reviewer@example.com')
  ]) await assert.rejects(request(), (err) => err.status === 403 && err.message === 'Super Admin required');
  assert.deepEqual(events, []);
  global.fetch = async () => Response.json({ message: 'Admin not found' }, { status: 404 });
  await assert.rejects(api.admins.setRegulatorModeByEmail('missing@example.com', true), (err) => err.status === 404);
});
