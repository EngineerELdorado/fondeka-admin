const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const load = (file, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64')}#${tag}`);
const key = 'business_tools.reseller.visible';
const session = (role) => ({ tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } });
const override = (accountId, enabled) => ({ key, accountId, enabled });

test('visibility preserves explicit account false and true over both global settings', async () => {
  const h = await load('lib/reseller-card-visibility.js');
  for (const enabled of [false, true]) for (const account of [undefined, false, true]) {
    const saved = h.resellerCardSettings([{ key, enabled }], account === undefined ? [] : [override(12, account)]);
    assert.deepEqual(h.resellerCardAccount(saved, 12), { choice: account === undefined ? 'inherit' : account ? 'show' : 'hide', enabled: account ?? enabled });
  }
  assert.deepEqual(h.resellerCardPayload('hide'), { enabled: false });
  assert.deepEqual(h.resellerCardPayload('show'), { enabled: true });
  assert.equal(h.resellerCardPayload('inherit'), null);
});

test('missing backend advertisement never falls back to an unknown enabled flag', async () => {
  const h = await load('lib/reseller-card-visibility.js');
  for (const flags of [null, [], [{ key: 'other', enabled: true }], [{ key, enabled: 'false' }], [{ key, enabled: false }, { key, enabled: true }]]) assert.throws(() => h.resellerCardSettings(flags, []));
  for (const overrides of [null, [override(0, false)], [override(12, null)], [override(12, false), override(12, true)], [{ ...override(12, true), key: 'another-flag' }]]) assert.throws(() => h.resellerCardSettings([{ key, enabled: false }], overrides));
  assert.throws(() => h.resellerCardPayload('disabled'));
  assert.deepEqual(h.resellerCardTarget('accountId', ' 12 '), { type: 'accountId', value: 12 });
  assert.deepEqual(h.resellerCardTarget('email', ' Customer+pilot@Example.com '), { type: 'email', value: 'Customer+pilot@Example.com' });
  for (const [kind, value] of [['accountId', '0'], ['accountId', '-1'], ['accountId', '9007199254740992'], ['email', 'partial@'], ['email', 'a b@example.com']]) assert.throws(() => h.resellerCardTarget(kind, value));
});

test('visibility uses existing Boolean feature-flag writes and encoded email resets without financial settings', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'reseller-visibility-api'); api.setAuthToken('visibility-admin');
  const calls = []; global.fetch = async (url, init) => { calls.push({ url, init }); return init.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({ key, enabled: false }); };
  await api.featureFlags.update(key, { enabled: false, disabledBehavior: 'ACCEPT_AND_QUEUE', clientPresentation: 'HIDE', disabledMessageEn: 'unused' });
  await api.featureFlags.upsertOverride(key, 12, { enabled: true, prefundingAmount: 99 });
  await api.featureFlags.upsertOverrideByEmail(key, ' Customer+pilot@Example.com ', { enabled: false, selfServiceEnabled: true });
  await api.featureFlags.removeOverride(key, 12); await api.featureFlags.removeOverrideByEmail(key, ' Customer+pilot@Example.com ');
  assert.deepEqual(JSON.parse(calls[0].init.body), { enabled: false }); assert.deepEqual(JSON.parse(calls[1].init.body), { enabled: true }); assert.deepEqual(JSON.parse(calls[2].init.body), { enabled: false });
  assert.equal(new URL(calls[2].url, 'https://admin.local').searchParams.get('email'), 'Customer+pilot@Example.com'); assert.match(calls[2].url, /Customer%2Bpilot%40Example.com/);
  for (const call of calls.slice(3)) { assert.equal(call.init.method, 'DELETE'); assert.equal(call.init.body, undefined); }
  for (const call of calls) { assert.match(call.url, /\/admin-api\/feature-flags\/business_tools.reseller.visible/); assert.equal(call.init.cache, 'no-store'); assert.equal(call.init.headers.Authorization, 'Bearer visibility-admin'); }
});

test('visibility permission errors retain the session and original backend error', async (t) => {
  const originalFetch = global.fetch, originalWindow = global.window;
  t.after(() => { global.fetch = originalFetch; if (originalWindow === undefined) delete global.window; else global.window = originalWindow; });
  const { api } = await load('lib/api.js', 'visibility-denied'), events = [];
  global.window = { dispatchEvent: (event) => events.push(event.type) };
  global.fetch = async () => Response.json({ message: 'Permission denied' }, { status: 403 });
  for (const call of [() => api.featureFlags.list(), () => api.featureFlags.get(key), () => api.featureFlags.listOverrides(key), () => api.featureFlags.update(key, { enabled: true }), () => api.featureFlags.upsertOverride(key, 12, { enabled: false }), () => api.featureFlags.upsertOverrideByEmail(key, 'customer@example.com', { enabled: true }), () => api.featureFlags.removeOverride(key, 12), () => api.featureFlags.removeOverrideByEmail(key, 'customer@example.com')]) await assert.rejects(call(), (error) => error.status === 403 && error.message === 'Permission denied');
  assert.deepEqual(events, []);
});

async function panel({ role = 'SUPER_ADMIN', enabled = false, overrides = [], list, write } = {}) {
  const h = await load('lib/reseller-card-visibility.js'), state = { enabled, overrides: structuredClone(overrides), writes: [], reads: [] };
  const mutate = async (operation, target, body) => {
    state.writes.push({ operation, target, body }); if (write) return write(operation, target, body, state);
    if (operation === 'global') state.enabled = body.enabled;
    else {
      const id = typeof target === 'number' ? target : 22;
      state.overrides = state.overrides.filter((row) => row.accountId !== id);
      if (body) state.overrides.push(override(id, body.enabled));
    }
    return body == null ? null : { key, ...body };
  };
  const api = { featureFlags: {
    list: async () => { state.reads.push('flags'); return list ? list(state) : [{ key, enabled: state.enabled }, { key: 'unrelated', enabled: true }]; },
    listOverrides: async (requested) => { assert.equal(requested, key); state.reads.push('overrides'); return structuredClone(state.overrides); },
    update: async (requested, body) => { assert.equal(requested, key); return mutate('global', null, body); },
    upsertOverride: async (requested, target, body) => { assert.equal(requested, key); return mutate('account', target, body); },
    removeOverride: async (requested, target) => { assert.equal(requested, key); return mutate('remove-account', target, null); },
    upsertOverrideByEmail: async (requested, target, body) => { assert.equal(requested, key); return mutate('email', target, body); },
    removeOverrideByEmail: async (requested, target) => { assert.equal(requested, key); return mutate('remove-email', target, null); }
  } };
  const view = await mountComponent(path.join(__dirname, '../components/resellers/CardVisibilityPanel.js'), { props: {}, modules: (hooks) => ({
    '@/contexts/AuthContext': { useAuth: () => ({ session: session(role) }) }, '@/lib/api': { api }, '@/lib/reseller-card-visibility': h, '@/components/DataTable': { DataTable: 'data-table' },
    './Common': { Card: 'section', Field: 'field', Alert: 'alert', actionStyle: {}, gridStyle: {}, useMounted: () => { const mounted = hooks.useRef(true); hooks.useEffect(() => () => { mounted.current = false; }, []); return mounted; }, useResellerError: () => hooks.useCallback(async (err) => err.message, []) }
  }) });
  await view.flush(); return { view, state };
}

test('loading never enables visibility; global edits preserve explicit account overrides', async () => {
  const { view, state } = await panel({ enabled: false, overrides: [override(12, false), override(13, true)] });
  assert.deepEqual(state.writes, []); assert.match(view.text(), /Global default: Hidden/); assert.equal(view.button('Save global visibility').disabled, true);
  view.change('Default card visibility', 'true'); await view.click('Save global visibility');
  assert.deepEqual(state.writes, [{ operation: 'global', target: null, body: { enabled: true } }]); assert.deepEqual(state.overrides, [override(12, false), override(13, true)]); assert.match(view.text(), /Global default: Shown/);
  assert.equal(view.button('Save global visibility').disabled, true);
});

test('account Hide wins over global Show and Inherit deletes the override', async () => {
  const { view, state } = await panel({ enabled: true });
  view.change('Account ID', '12'); view.change('Card visibility', 'hide'); await view.click('Save account visibility');
  assert.deepEqual(state.writes[0], { operation: 'account', target: 12, body: { enabled: false } }); assert.match(view.text(), /Effective card visibility: Hidden/);
  view.change('Card visibility', 'inherit'); await view.click('Save account visibility');
  assert.deepEqual(state.writes[1], { operation: 'remove-account', target: 12, body: null }); assert.deepEqual(state.overrides, []); assert.match(view.text(), /Effective card visibility: Shown/);
});

test('email Show can enable a pilot while globally hidden and email Inherit restores the default', async () => {
  const { view, state } = await panel();
  view.change('Find account by', 'email'); view.change('Account email', ' Customer+pilot@Example.com '); view.change('Card visibility', 'show'); await view.click('Save account visibility');
  assert.deepEqual(state.writes[0], { operation: 'email', target: 'Customer+pilot@Example.com', body: { enabled: true } }); assert.equal(state.enabled, false); assert.deepEqual(state.overrides, [override(22, true)]);
  view.change('Card visibility', 'inherit'); await view.click('Save account visibility'); assert.equal(state.writes[1].operation, 'remove-email'); assert.deepEqual(state.overrides, []);
});

test('unsupported backends and failed reads disable saving without assuming the card is shown', async () => {
  const missing = await panel({ list: () => [] }); assert.match(missing.view.text(), /backend does not advertise/); assert.match(missing.view.text(), /Global default: Unavailable/); assert.equal(missing.view.button('Save global visibility').disabled, true); assert.deepEqual(missing.state.writes, []);
  let fails = false;
  const current = await panel({ list: (state) => { if (fails) throw new Error('Read failed'); return [{ key, enabled: state.enabled }]; } });
  current.view.change('Default card visibility', 'true'); fails = true; await current.view.click('Refresh visibility'); assert.match(current.view.text(), /Global default: Unavailable/); assert.equal(current.view.button('Save global visibility').disabled, true); assert.equal(current.view.field('Default card visibility').props.value, 'true');
});

test('read-only roles cannot mutate visibility and a 403 locks further saves', async () => {
  const reader = await panel({ role: 'ASSISTANT' }); assert.match(reader.view.text(), /Read only/); assert.ok(!reader.view.nodes().some((node) => node.type === 'button' && node.props.children === 'Save global visibility')); assert.ok(reader.view.nodes().find((node) => node.type === 'fieldset').props.disabled);
  const denied = await panel({ write: async () => { throw Object.assign(new Error('Permission denied'), { status: 403 }); } }); denied.view.change('Default card visibility', 'true'); await denied.view.click('Save global visibility'); assert.match(denied.view.text(), /Read only/); assert.equal(denied.state.writes.length, 1);
  const admin = await panel({ role: 'ADMIN' }); admin.view.change('Default card visibility', 'true'); assert.equal(admin.view.button('Save global visibility').disabled, false);
});

test('validation and uncertain save failures keep the draft and require reading the saved outcome', async () => {
  let status = 400;
  const { view, state } = await panel({ write: async () => { throw Object.assign(new Error('Save failed'), { status }); } });
  view.change('Account ID', '12'); view.change('Card visibility', 'hide'); await view.click('Save account visibility'); assert.equal(view.field('Card visibility').props.value, 'hide'); assert.equal(view.button('Save account visibility').disabled, false);
  status = 500; await view.click('Save account visibility'); assert.equal(view.button('Save account visibility').disabled, true);
  await view.click('Save account visibility'); assert.equal(state.writes.length, 2); await view.click('Refresh visibility'); assert.equal(view.field('Card visibility').props.value, 'hide'); assert.equal(view.button('Save account visibility').disabled, false);
});

test('pending saves block double submission and editing another scope', async () => {
  let release;
  const { view, state } = await panel({ write: () => new Promise((resolve) => { release = resolve; }) });
  view.change('Default card visibility', 'true'); const pending = view.click('Save global visibility'); await view.flush();
  await view.click('Save global visibility'); view.change('Default card visibility', 'false'); assert.equal(view.field('Default card visibility').props.value, 'true'); assert.equal(state.writes.length, 1);
  state.enabled = true; release({ key, enabled: true }); await pending; await view.flush(); assert.match(view.text(), /Global default: Shown/);
});
