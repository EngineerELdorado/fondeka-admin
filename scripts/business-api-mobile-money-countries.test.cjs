const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const root = path.join(__dirname, '..');
const load = (file, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(root, file), 'utf8')).toString('base64')}#${tag}`);
const helpers = load('lib/business-api-mobile-money-countries.js');
const countries = [{ cca2: 'CD', name: 'Congo' }, { cca2: 'CG', name: 'Congo' }, { cca2: 'KE', name: 'Kenya' }, { cca2: 'RW', name: 'Rwanda' }, { cca2: 'XK', name: 'Kosovo' }];
const resource = (accountId = null, global = ['CD'], override = null) => ({ accountId, globalCountryCodes: global, overrideCountryCodes: override, effectiveCountryCodes: override ?? global, inherited: override === null, availableCountries: (override ?? global).map((code) => ({ code, name: code })) });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

async function fixture(t, options = {}) {
  const h = await helpers, props = { accountId: options.accountId ?? null };
  const state = { saved: resource(props.accountId), reads: [], writes: [], refreshed: 0, ...options };
  const read = async (accountId = null) => { state.reads.push(accountId); if (state.readError) throw state.readError; return state.read ? state.read(accountId) : structuredClone(state.saved); };
  const save = async (operation, accountId, body) => {
    state.writes.push({ operation, accountId, body });
    if (state.saveError) throw state.saveError;
    if (state.write) return state.write(operation, accountId, body);
    state.saved = operation === 'reset' ? resource(accountId, state.saved.globalCountryCodes) : operation === 'global' ? resource(null, body.allowedCountryCodes) : resource(accountId, state.saved.globalCountryCodes, body.allowedCountryCodes);
    return structuredClone(state.saved);
  };
  const api = { businessApiMobileMoneyCountries: {
    get: () => read(), getAccount: (id) => read(id), update: (body) => save('global', null, body),
    updateAccount: (id, body) => save('account', id, body), resetAccount: (id) => save('reset', id)
  } };
  const session = options.session || { tokens: { accessToken: { payload: { 'cognito:groups': [options.role || 'ADMIN'] } } } };
  const view = await mountComponent(path.join(root, 'components/BusinessApiMobileMoneyCountriesPanel.js'), { props, modules: {
    '@/lib/api': { api }, '@/lib/business-api-mobile-money-countries': h,
    '@/contexts/AuthContext': { useAuth: () => ({ session, refreshSession: async () => { state.refreshed++; } }) },
    '@/contexts/LocaleContext': { useLocale: () => ({ locale: options.locale || 'en' }) },
    '@/components/CountrySelect': { CountrySelect: 'country-select' }, '@/data/countries': { __esModule: true, default: countries }, 'next/link': { __esModule: true, default: 'a' }
  } });
  t.after(() => view.unmount()); await view.flush();
  const picker = () => view.nodes().find((node) => node.type === 'country-select')?.props;
  const select = async (codes) => { picker().onChange({ target: { selectedOptions: codes.map((value) => ({ value })) } }); await view.flush(); };
  const mode = async (label) => { view.nodes().find((node) => node.props['aria-label'] === label).props.onChange(); await view.flush(); };
  return { view, state, props, picker, select, mode };
}

test('country lists normalize and sort without merging CD/CG, while malformed or missing lists are refused', async () => {
  const h = await helpers;
  assert.deepEqual(h.mobileMoneyCountryCodes([' ke ', 'cg', 'CD', 'cd']), ['CD', 'CG', 'KE']);
  assert.deepEqual(h.mobileMoneyCountryCodes([]), []);
  for (const value of [undefined, null, 'CD', [null], [''], ['COD']]) assert.throws(() => h.mobileMoneyCountryCodes(value));
  for (const invalid of [null, {}, { ...resource(), globalCountryCodes: null }, { ...resource(), inherited: false }, { ...resource(), effectiveCountryCodes: ['KE'] }, resource(42)]) assert.throws(() => h.mobileMoneyCountryPolicy(invalid));
  assert.throws(() => h.mobileMoneyCountryPolicy(resource(43), 42));
  assert.deepEqual(h.mobileMoneyCountryPolicy(resource(42, ['CD'], []), 42).overrideCountryCodes, []);
});

test('API calls use the configured admin prefix, bearer authentication, no-store and a bodyless reset', async (t) => {
  const originalFetch = global.fetch, originalBase = process.env.NEXT_PUBLIC_ADMIN_API_BASE;
  t.after(() => { global.fetch = originalFetch; if (originalBase === undefined) delete process.env.NEXT_PUBLIC_ADMIN_API_BASE; else process.env.NEXT_PUBLIC_ADMIN_API_BASE = originalBase; });
  for (const base of ['https://admin.example.test/', 'https://admin.example.test/admin-api/']) {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = base;
    const { api } = await load('lib/api.js', base); api.setAuthToken('country-policy-test');
    const calls = [];
    global.fetch = async (url, init) => { calls.push({ url, ...init }); return Response.json(resource()); };
    const endpoint = api.businessApiMobileMoneyCountries;
    await endpoint.get(); await endpoint.update({ allowedCountryCodes: [] });
    await endpoint.getAccount(42); await endpoint.updateAccount(42, { allowedCountryCodes: ['CD', 'KE'] }); await endpoint.resetAccount(42);
    assert.deepEqual(calls.map((call) => call.url), ['', '', '/accounts/42', '/accounts/42', '/accounts/42'].map((suffix) => `https://admin.example.test/admin-api/business-api/mobile-money-countries${suffix}`));
    assert.deepEqual(JSON.parse(calls[1].body), { allowedCountryCodes: [] });
    assert.deepEqual(JSON.parse(calls[3].body), { allowedCountryCodes: ['CD', 'KE'] });
    assert.equal(calls[4].method, 'DELETE'); assert.equal(Object.hasOwn(calls[4], 'body'), false);
    for (const call of calls) { assert.equal(call.headers.Authorization, 'Bearer country-policy-test'); assert.equal(call.cache, 'no-store'); }
  }
});

test('policy errors keep their status and server message and do not log out on permission denial', async (t) => {
  const originalFetch = global.fetch, originalWindow = global.window;
  t.after(() => { global.fetch = originalFetch; if (originalWindow === undefined) delete global.window; else global.window = originalWindow; });
  const events = []; global.window = { dispatchEvent: (event) => events.push(event.type) };
  const { api } = await load('lib/api.js', 'country-errors');
  for (const status of [400, 401, 403, 404, 500]) {
    global.fetch = async () => Response.json({ message: `Policy error ${status}` }, { status });
    for (const call of [() => api.businessApiMobileMoneyCountries.get(), () => api.businessApiMobileMoneyCountries.update({ allowedCountryCodes: [] }), () => api.businessApiMobileMoneyCountries.getAccount(42), () => api.businessApiMobileMoneyCountries.updateAccount(42, { allowedCountryCodes: [] }), () => api.businessApiMobileMoneyCountries.resetAccount(42)]) {
      await assert.rejects(call(), (err) => err.status === status && err.message === `Policy error ${status}`);
    }
  }
  assert.deepEqual(events, []);
});

test('opening global settings reads the saved list without enabling countries or performing a write', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(f.state.reads, [null]); assert.deepEqual(f.state.writes, []);
  assert.deepEqual(f.picker().value, ['CD']); assert.equal(f.picker().multiple, true);
  assert.equal(f.picker().emptyLabel, 'No countries enabled');
  assert.equal(f.picker().records.find((country) => country.cca2 === 'CD').name, 'DR Congo');
  assert.match(f.picker().records.find((country) => country.cca2 === 'CG').name, /Congo-Brazzaville/);
  assert.equal(f.picker().records.some((country) => country.cca2 === 'XK'), false);
  assert.equal(f.view.button('Save country policy').disabled, true);
  assert.match(f.view.text(), /both LIVE and SANDBOX/);
});

test('a global replacement sends the full normalized list and supports an explicit empty list', async (t) => {
  const f = await fixture(t, { role: 'SUPER_ADMIN' });
  await f.select(['KE', 'CD', 'CG', 'CD']); await f.view.click('Save country policy');
  assert.deepEqual(f.state.writes[0], { operation: 'global', accountId: null, body: { allowedCountryCodes: ['CD', 'CG', 'KE'] } });
  assert.equal(f.view.button('Save country policy').disabled, true);
  await f.select([]); await f.view.click('Save country policy');
  assert.deepEqual(f.state.writes[1].body, { allowedCountryCodes: [] });
  assert.match(f.view.text(), /Saved effective countries: No countries enabled/);
});

test('an account can replace CD with Kenya only and a custom empty selection remains an explicit override', async (t) => {
  const f = await fixture(t, { accountId: 42 });
  assert.equal(f.picker(), undefined); assert.match(f.view.text(), /Global settings \(inherited\)/);
  await f.mode('Custom account countries'); await f.select(['KE']); await f.view.click('Save country policy');
  assert.deepEqual(f.state.writes[0], { operation: 'account', accountId: 42, body: { allowedCountryCodes: ['KE'] } });
  assert.match(f.view.text(), /Saved effective countries: Kenya \(KE\)/);
  await f.select([]); await f.view.click('Save country policy');
  assert.deepEqual(f.state.writes[1].body, { allowedCountryCodes: [] });
  assert.equal(f.state.saved.inherited, false);
  assert.deepEqual(f.picker().value, []);
  assert.match(f.view.text(), /Custom account override/);
});

test('Use global settings deletes the override instead of sending an empty list and applies the returned current global policy', async (t) => {
  const f = await fixture(t, { accountId: 42, saved: resource(42, ['CD'], []) });
  await f.mode('Use global settings');
  f.state.saved.globalCountryCodes = ['CG'];
  await f.view.click('Save country policy');
  assert.deepEqual(f.state.writes, [{ operation: 'reset', accountId: 42, body: undefined }]);
  assert.equal(f.picker(), undefined);
  assert.match(f.view.text(), /Saved effective countries: Republic of the Congo \(Congo-Brazzaville\) \(CG\)/);
  assert.match(f.view.text(), /This account now uses the global settings/);
});

test('an explicit account override can enable a country while the global list is empty', async (t) => {
  const f = await fixture(t, { accountId: '9223372036854775807', saved: resource('9223372036854775807', []) });
  await f.mode('Custom account countries'); await f.select(['CD']); await f.view.click('Save country policy');
  assert.equal(f.state.writes[0].accountId, '9223372036854775807');
  assert.deepEqual(f.state.saved.globalCountryCodes, []); assert.deepEqual(f.state.saved.effectiveCountryCodes, ['CD']);
});

test('assistants can read but cannot write, and other roles do not request the policy', async (t) => {
  const f = await fixture(t, { role: 'ASSISTANT' });
  assert.deepEqual(f.state.reads, [null]); assert.equal(f.picker().disabled, true);
  assert.match(f.view.text(), /Read only/);
  assert.equal(f.view.nodes().some((node) => node.type === 'button' && node.props.children === 'Save country policy'), false);
  for (const role of ['STAFF', 'CUSTOMER']) {
    const denied = await fixture(t, { role });
    assert.deepEqual(denied.state.reads, []); assert.deepEqual(denied.state.writes, []);
    assert.match(denied.view.text(), /Permission denied/);
  }
  const h = await helpers;
  assert.deepEqual(h.mobileMoneyCountryPermissions({ tokens: { idToken: { payload: { groups: 'assistant, admin' } } } }), { canRead: true, canWrite: true });
});

test('server validation preserves the draft and saved policy instead of resetting to an unrestricted selection', async (t) => {
  const f = await fixture(t, { saveError: Object.assign(new Error('Unknown country code'), { status: 400 }) });
  await f.select(['CG']); await f.view.click('Save country policy');
  assert.deepEqual(f.picker().value, ['CG']); assert.match(f.view.text(), /Unknown country code/);
  assert.match(f.view.text(), /Saved effective countries: DR Congo \(CD\)/);
  assert.equal(f.view.button('Save country policy').disabled, false);
});

test('unavailable or malformed backend responses never become an editable empty policy', async (t) => {
  for (const options of [{ readError: Object.assign(new Error('No route'), { status: 404 }) }, { saved: {} }, { saved: { ...resource(), effectiveCountryCodes: null } }]) {
    const f = await fixture(t, options);
    assert.equal(f.view.button('Save country policy').disabled, true); assert.equal(f.picker().disabled, true);
    assert.deepEqual(f.state.writes, []); assert.doesNotMatch(f.view.text(), /Saved effective countries:/);
  }
});

test('an uncertain save is not automatically retried and requires a saved-policy reload before another change', async (t) => {
  const f = await fixture(t, { saveError: new TypeError('Network unavailable') });
  await f.select(['KE']); await f.view.click('Save country policy'); await f.view.click('Save country policy');
  assert.equal(f.state.writes.length, 1); assert.deepEqual(f.picker().value, ['KE']);
  assert.equal(f.view.button('Save country policy').disabled, true);
  assert.match(f.view.text(), /Reload the saved country settings before saving again/);
  f.state.saveError = null; await f.view.click('Reload saved country settings');
  assert.deepEqual(f.picker().value, ['CD']); await f.select(['KE']); await f.view.click('Save country policy');
  assert.equal(f.state.writes.length, 2);
});

test('pending saves cannot be dispatched twice and cannot publish a result onto another account', async (t) => {
  const pending = deferred();
  const f = await fixture(t, { accountId: 42, write: () => pending.promise });
  await f.mode('Custom account countries'); await f.select(['KE']);
  const click = f.view.button('Save country policy').onClick;
  click(); click(); await f.view.flush(); assert.equal(f.state.writes.length, 1);
  f.props.accountId = 43; f.state.saved = resource(43, ['CG']); await f.view.flush();
  pending.resolve(resource(42, ['CD'], ['KE'])); await f.view.flush();
  assert.match(f.view.text(), /account 43/); assert.match(f.view.text(), /Congo-Brazzaville/);
  assert.doesNotMatch(f.view.text(), /Saved effective countries: Kenya/);
  assert.deepEqual(f.state.reads, [42, 43]);
});

test('a late policy read cannot replace a newer account selection', async (t) => {
  const pending = deferred();
  const f = await fixture(t, { accountId: 42, read: (id) => id === 42 ? pending.promise : resource(id, ['KE'], []) });
  f.props.accountId = 43; await f.view.flush();
  assert.deepEqual(f.picker().value, []); pending.resolve(resource(42)); await f.view.flush();
  assert.match(f.view.text(), /account 43/); assert.match(f.view.text(), /Custom account override/);
  assert.deepEqual(f.picker().value, []);
});

test('global and account controls are mounted in API settings, with bilingual country labels', async (t) => {
  const globalSource = readFileSync(path.join(root, 'app/(dashboard)/dashboard/feature-flags/page.js'), 'utf8');
  const accountSource = readFileSync(path.join(root, 'app/(dashboard)/dashboard/accounts/accounts/[id]/page.js'), 'utf8');
  assert.match(globalSource, /id="business-api-settings".*title="API settings"/);
  assert.match(globalSource, /<BusinessApiMobileMoneyCountriesPanel \/>/);
  assert.match(accountSource, /<BusinessApiMobileMoneyCountriesPanel key=.*accountId=\{resolvedAccountId\}/);
  const f = await fixture(t, { locale: 'fr-CD' });
  assert.match(f.view.text(), /RD Congo \(CD\)/);
  assert.match(f.picker().records.find((country) => country.cca2 === 'CG').name, /République du Congo/);
});
