
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const filename = path.join(__dirname, '../app/(dashboard)/dashboard/bills/umeme-infrastructure/page.js');
const initial = () => ({ version: 3, defaultMode: 'LEGACY', productOverrides: {}, accountOverrides: {}, v1Ready: true });
async function fixture({ value = initial(), role = 'SUPER_ADMIN', fail = false, locale = 'en' } = {}) {
  const calls = [];
  const view = await mountComponent(filename, { modules: {
    '@/lib/api': { api: { umemeInfrastructure: {
      get: async () => value,
      update: async body => { calls.push(body); if (fail) throw new Error('Version conflict'); return { ...value, ...body, version: 4 }; }
    } } },
    '@/contexts/AuthContext': { useAuth: () => ({ session: { tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } } }) },
    '@/contexts/LocaleContext': { useLocale: () => ({ locale }) },
    '@/components/RegulatorPresentation': { PresentationLink: 'a' },
    './umeme-infrastructure.module.css': { __esModule: true, default: {} }
  } });
  await view.flush();
  const change = async (label, value) => { view.nodes().find(n => n.props['aria-label'] === label).props.onChange({ target: { value } }); await view.flush(); };
  const save = async () => { await view.nodes().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); await view.flush(); };
  return { view, calls, change, save };
}
test('opening settings performs no routing mutation and preserves backend decisions', async () => {
  const f = await fixture({ value: { ...initial(), defaultMode: 'V1', accountOverrides: { '42': 'LEGACY' } } });
  assert.equal(f.calls.length, 0); assert.match(f.view.text(), /Existing payments keep/);
  assert.equal(f.view.nodes().find(n => n.props['aria-label'] === 'Global default').props.value, 'V1');
  assert.equal(f.view.nodes().find(n => n.props['aria-label'] === 'Account mode 1').props.value, 'LEGACY');
});
test('QA migration sends only selected accounts with the latest version', async () => {
  const f = await fixture(); await f.view.click('Add account exception'); await f.change('Account 1', '42'); await f.save();
  assert.deepEqual(f.calls, [{ version: 3, defaultMode: 'LEGACY', productOverrides: {}, accountOverrides: { '42': 'V1' } }]);
  assert.match(f.view.text(), /routing saved/);
});
test('removing an exception restores inheritance and clears it in the saved map', async () => {
  const f = await fixture({ value: { ...initial(), accountOverrides: { '42': 'V1' } } });
  await f.view.click('Remove exception'); await f.change('SOCODEE', 'V1'); await f.save();
  assert.deepEqual(f.calls[0].accountOverrides, {}); assert.deepEqual(f.calls[0].productOverrides, { SOCODEE: 'V1' });
});
test('ordinary admins can inspect settings but cannot submit routing changes', async () => {
  const f = await fixture({ role: 'ADMIN' }); await f.save(); assert.equal(f.calls.length, 0);
  assert.equal(f.view.nodes().find(n => n.type === 'fieldset').props.disabled, true);
});
test('duplicate accounts cannot silently replace an exception', async () => {
  const f = await fixture({ value: { ...initial(), accountOverrides: { '42': 'LEGACY' } } });
  await f.view.click('Add account exception'); await f.change('Account 2', '42'); await f.save();
  assert.equal(f.calls.length, 0); assert.match(f.view.text(), /unique account ID/);
});
test('a stale or uncertain save requires a refresh before another write', async () => {
  const f = await fixture({ fail: true }); await f.change('Global default', 'V1'); await f.save(); await f.save(); assert.equal(f.calls.length, 1);
  assert.match(f.view.text(), /Refresh the policy before saving again/);
  await f.view.click('Refresh policy'); await f.change('Global default', 'V1'); await f.save(); assert.equal(f.calls.length, 2);
});
test('unconfigured v1 is unavailable and malformed older responses cannot be saved', async () => {
  const f = await fixture({ value: { ...initial(), v1Ready: false } });
  assert.match(f.view.text(), /V1 is not configured/);
  assert.equal(f.view.nodes().find(n => n.type === 'option' && n.props.value === 'V1').props.disabled, true);
  const old = await fixture({ value: { defaultMode: 'LEGACY' } }); assert.equal(old.calls.length, 0);
  assert.match(old.view.text(), /not returned a supported Umeme policy/);
});
test('French admin labels explain gradual rollout and precedence', async () => {
  const f = await fixture({ locale: 'fr' }); assert.match(f.view.text(), /Infrastructure Umeme/); assert.match(f.view.text(), /Exception du compte/);
});

test('unavailable V1 has actionable setup guidance and new account rows use an available mode', async () => {
  const f = await fixture({ value: { ...initial(), v1Ready: false } });
  assert.match(f.view.text(), /V1 setup required/); assert.match(f.view.text(), /UMEME_V1_ENABLED=true/); assert.match(f.view.text(), /UMEME_V1_CALLBACK_URL/);
  assert.match(f.view.text(), /does not identify which individual check failed/);
  await f.view.click('Add account exception');
  assert.equal(f.view.nodes().find(node => node.props['aria-label'] === 'Account mode 1').props.value, 'LEGACY');
  await f.change('Account 1', '42'); await f.save();
  assert.deepEqual(f.calls[0].accountOverrides, { '42': 'LEGACY' });
});

test('an unchanged policy is not republished and discard restores the saved draft without an API write', async () => {
  const f = await fixture();
  assert.equal(f.view.button('Save routing').disabled, true); await f.save(); assert.equal(f.calls.length, 0);
  await f.change('SOCODEE', 'V1'); assert.match(f.view.text(), /Unsaved changes/); assert.equal(f.view.button('Save routing').disabled, false);
  await f.view.click('Discard changes');
  assert.equal(f.view.nodes().find(node => node.props['aria-label'] === 'SOCODEE').props.value, '');
  assert.equal(f.view.button('Save routing').disabled, true); assert.equal(f.calls.length, 0);
});

test('the save handler refuses an unavailable V1 choice even when a control change bypasses the disabled option', async () => {
  const f = await fixture({ value: { ...initial(), v1Ready: false } });
  await f.change('SOCODEE', 'V1'); await f.save();
  assert.equal(f.calls.length, 0); assert.equal(f.view.button('Save routing').disabled, true);
  assert.match(f.view.text(), /Complete server setup or remove every V1 selection/);
});

test('refreshing after server setup enables V1 without changing the saved routing', async () => {
  const value = { ...initial(), v1Ready: false }, f = await fixture({ value });
  value.v1Ready = true; await f.view.click('Refresh policy');
  assert.equal(f.view.nodes().find(node => node.type === 'option' && node.props.value === 'V1').props.disabled, false);
  assert.match(f.view.text(), /Provider connectivity and QA must still be verified/);
  assert.equal(f.view.nodes().find(node => node.props['aria-label'] === 'Global default').props.value, 'LEGACY');
  assert.equal(f.calls.length, 0);
});

test('saving a global change keeps the other explicit product/account decisions and updates saved state', async () => {
  const f = await fixture({ value: { ...initial(), productOverrides: { VIRUNGA: 'LEGACY' }, accountOverrides: { '42': 'V1', '9223372036854775807': 'LEGACY' } } });
  await f.change('Global default', 'V1'); await f.save();
  assert.deepEqual(f.calls[0], { version: 3, defaultMode: 'V1', productOverrides: { VIRUNGA: 'LEGACY' }, accountOverrides: { '42': 'V1', '9223372036854775807': 'LEGACY' } });
  assert.match(f.view.text(), /routing saved/); assert.doesNotMatch(f.view.text(), /Unsaved changes/);
  assert.equal(f.view.button('Save routing').disabled, true);
});
