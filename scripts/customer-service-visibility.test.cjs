const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const root = path.join(__dirname, '..');
const source = (file) => readFileSync(path.join(root, file), 'utf8');
const uri = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const helperSource = () => source('lib/customer-service-visibility.js')
  .replace("'@/lib/contact-exports'", JSON.stringify(uri(source('lib/contact-exports.js'))))
  .replace("'@/lib/notification-business-audience'", JSON.stringify(uri(source('lib/notification-business-audience.js'))));
const load = () => import(uri(helperSource()));
const session = (role) => ({ tokens: { accessToken: { payload: { sub: 'visibility-admin', 'cognito:groups': [role] } } } });
const example = { audience: { countryCodes: ['CD'], hasCompletedTransactions: true, minCompletedTransactionTotalUsd: 25, transactionActions: ['PAY_ELECTRICITY_BILL', 'PAY_TV_SUBSCRIPTION'], hasApi: false } };

test('visibility audience round trips every shared criterion including false, zero, USD bounds and selected actions', async () => {
  const h = await load();
  const audience = { countryIds: [1], countryCodes: ['CD'], deviceLanguages: ['fr-CD'], kycStatuses: ['APPROVED'], hasCryptoWallets: false, hasSavings: true, hasGroupSavings: false, hasCards: true, hasLoans: false, hasEsims: true, isReseller: true, hasStores: false, hasPos: true, hasPaymentRequests: false, hasApi: false, hasCompletedTransactions: true, minCompletedTransactions: 0, maxCompletedTransactions: 10, minCompletedTransactionTotalUsd: 25.5, maxCompletedTransactionTotalUsd: 100, lastTransactionOlderThanDays: 1, minTransactionsThisMonth: 0, maxTransactionsThisMonth: 5, accountCreatedFrom: '2026-01-01', accountCreatedTo: '2026-12-31', billProductIds: [12], paymentMethodIds: [22], paymentProviderIds: [7], transactionStatuses: ['FAILED'], transactionServices: ['BILL_PAYMENTS'], transactionActions: ['PAY_TV_SUBSCRIPTION'] };
  const draft = h.visibilityDraft({ audience }); assert.equal(draft.filters.hasApi, 'false'); assert.equal(draft.filters.minCompletedTransactions, 0);
  assert.deepEqual(h.visibilityPayload(draft.mode, draft.filters), { audience });
  assert.equal(h.visibilityAudienceFields.length, Object.keys(audience).length);
  assert.equal(h.visibilityAudience({ minCompletedTransactionTotalUsd: 1e-18 }).minCompletedTransactionTotalUsd, 1e-18);
});

test('only explicit unrestricted mode clears targeting; empty and null saved audiences normalize safely', async () => {
  const h = await load();
  for (const audience of [null, {}, { hasCards: null, transactionActions: [] }]) assert.equal(h.visibilityDraft({ audience }).mode, 'UNRESTRICTED');
  assert.deepEqual(h.visibilityPayload('UNRESTRICTED', example.audience), { audience: null });
  assert.throws(() => h.visibilityPayload('TARGETED', h.emptyVisibilityAudience()), /at least one criterion/);
  assert.throws(() => h.visibilityPayload('UNKNOWN', {}));
  assert.notEqual(h.visibilitySnapshot({ audience: { hasCards: false } }), h.visibilitySnapshot({ audience: null }));
});

test('invalid ranges, amounts, enum values, IDs, dates and unknown filters are rejected without widening the audience', async () => {
  const h = await load();
  for (const audience of [{ minCompletedTransactionTotalUsd: '-1' }, { minCompletedTransactionTotalUsd: 'NaN' }, { minCompletedTransactionTotalUsd: '25.123456789012345678' }, { minCompletedTransactionTotalUsd: 1e-19 }, { minCompletedTransactionTotalUsd: '9007199254740993' }, { minCompletedTransactionTotalUsd: '26', maxCompletedTransactionTotalUsd: '25' }, { minCompletedTransactions: '3', maxCompletedTransactions: '2' }, { minTransactionsThisMonth: '3', maxTransactionsThisMonth: '2' }, { lastTransactionOlderThanDays: '0' }, { lastTransactionOlderThanDays: '-1' }, { minCompletedTransactions: '1.5' }, { countryIds: [0] }, { paymentMethodIds: [null] }, { countryCodes: ['DRC'] }, { transactionActions: ['FAKE'] }, { transactionStatuses: ['SUCCESS'] }, { transactionServices: ['FAKE'] }, { deviceLanguages: [''] }, { accountCreatedFrom: '2026-02-30' }, { accountCreatedFrom: '2026-02-02', accountCreatedTo: '2026-02-01' }, { fakeCriterion: true }]) assert.throws(() => h.visibilityAudience(audience), JSON.stringify(audience));
  assert.throws(() => h.readVisibilityPolicy({ audience: { hasApi: 'false' } }));
  assert.throws(() => h.readVisibilityPolicy({ audience: { futureFilter: null } }));
  assert.throws(() => h.readVisibilityPolicy({}));
  assert.deepEqual(h.visibilityAudience({ transactionActions: ['pay_tv_subscription'] }), { transactionActions: ['PAY_TV_SUBSCRIPTION'] });
});

test('visibility role checks cover both token types and permit only documented roles', async () => {
  const h = await load();
  for (const role of ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT', 'STAFF', 'CUSTOMER']) {
    assert.equal(h.visibilityPermissions(session(role)).canRead, ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT'].includes(role));
    assert.equal(h.visibilityPermissions(session(role)).canWrite, ['ADMIN', 'SUPER_ADMIN'].includes(role));
  }
  assert.deepEqual(h.visibilityPermissions({ tokens: { idToken: { payload: { groups: ' ADMIN,ASSISTANT ' } } } }), { canRead: true, canWrite: true });
  assert.equal(h.visibilityPermissions(null).canRead, false);
});

test('policy API uses authenticated uncached GET and full PUT without modifying feature flags', async (t) => {
  const before = global.fetch; t.after(() => { global.fetch = before; });
  const { api } = await import(uri(source('lib/api.js')) + '#visibility-api'); api.setAuthToken('visibility-token'); const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(example); };
  await api.customerServiceVisibilityPolicy.get(); await api.customerServiceVisibilityPolicy.update({ audience: { hasApi: false, minCompletedTransactionTotalUsd: 0 } }); await api.customerServiceVisibilityPolicy.update({ audience: null });
  for (const { url, init } of calls) { assert.match(url, /\/admin-api\/customer-service-visibility-policy$/); assert.equal(init.cache, 'no-store'); assert.equal(init.headers.Authorization, 'Bearer visibility-token'); }
  assert.equal(calls[0].init.body, undefined); assert.equal(calls[1].init.method, 'PUT'); assert.deepEqual(JSON.parse(calls[1].init.body), { audience: { hasApi: false, minCompletedTransactionTotalUsd: 0 } }); assert.deepEqual(JSON.parse(calls[2].init.body), { audience: null });
  global.fetch = async () => new Response(null, { status: 403 }); await assert.rejects(api.customerServiceVisibilityPolicy.get(), (err) => err.status === 403);
});

async function panel(t, { role = 'ADMIN', initial = example, read, write } = {}) {
  const h = await load(), state = { saved: structuredClone(initial), reads: 0, writes: [], refreshes: 0 };
  const auth = { session: session(role), enableRegulatorMode: false, refreshSession: async () => { state.refreshes++; } };
  const api = { customerServiceVisibilityPolicy: {
    get: async () => { state.reads++; return read ? read(state) : structuredClone(state.saved); },
    update: async (payload) => { state.writes.push(payload); if (write) return write(payload, state); state.saved = structuredClone(payload); return structuredClone(state.saved); }
  } };
  const view = await mountComponent(path.join(root, 'components/CustomerServiceVisibilityPolicy.js'), { exportName: 'CustomerServiceVisibilityWorkspace', modules: {
    '@/lib/api': { api }, '@/lib/customer-service-visibility': h, '@/contexts/AuthContext': { useAuth: () => auth }, '@/components/RegulatorPresentation': { PresentationLink: 'a' }, '@/components/ContactExportAudience': { ContactExportAudience: 'audience-editor' }, '@/components/BusinessAudienceHelp': { __esModule: true, default: 'business-help' }, './customer-service-visibility.module.css': {}
  } }); t.after(() => view.unmount()); await view.flush();
  const editor = () => view.nodes().find((node) => node.type === 'audience-editor')?.props;
  const mode = async (value) => { view.nodes().find((node) => node.props['aria-label'] === 'Audience targeting').props.onChange({ target: { value } }); await view.flush(); };
  const change = async (key, value) => { editor().onChange(key, value); await view.flush(); };
  return { view, state, editor, mode, change };
}

test('editing restores false criteria and saves the complete audience while retaining other selected filters', async (t) => {
  const { view, state, editor, change } = await panel(t); assert.equal(editor().filters.hasApi, 'false'); assert.equal(state.writes.length, 0);
  await change('minCompletedTransactionTotalUsd', '50'); await change('hasStores', 'true'); await view.click('Save audience targeting');
  assert.deepEqual(state.writes, [{ audience: { ...example.audience, hasStores: true, minCompletedTransactionTotalUsd: 50 } }]);
  assert.match(view.text(), /Audience saved/); assert.equal(editor().filters.hasApi, 'false'); assert.equal(state.reads, 2);
});

test('unrestricted selection explicitly sends null and empty targeted drafts cannot accidentally clear a policy', async (t) => {
  const { view, state, mode } = await panel(t); await mode('UNRESTRICTED'); assert.equal(state.writes.length, 0); await view.click('Save audience targeting'); assert.deepEqual(state.writes, [{ audience: null }]); assert.match(view.text(), /Targeting removed/);
  await mode('TARGETED'); await view.click('Save audience targeting'); assert.equal(state.writes.length, 1); assert.match(view.text(), /at least one criterion/);
});

test('Assistants can inspect but cannot save, while denied roles cannot load the policy', async (t) => {
  const assistant = await panel(t, { role: 'ASSISTANT' }); assert.equal(assistant.editor().disabled, true); assert.match(assistant.view.text(), /Read only/); assert.equal(assistant.view.nodes().some((node) => node.type === 'button' && node.props.children === 'Save audience targeting'), false);
  for (const role of ['STAFF', 'CUSTOMER']) { const denied = await panel(t, { role }); assert.equal(denied.state.reads, 0); assert.match(denied.view.text(), /access is required/); }
});

test('400 save validation preserves all fields and the targeted mode instead of widening saved state', async (t) => {
  const { view, state, editor, change } = await panel(t, { write: async () => { throw Object.assign(new Error('Invalid audience values'), { status: 400 }); } });
  await change('minCompletedTransactionTotalUsd', '26'); await view.click('Save audience targeting'); assert.equal(state.writes.length, 1); assert.equal(editor().filters.minCompletedTransactionTotalUsd, '26'); assert.equal(editor().filters.hasApi, 'false'); assert.match(view.text(), /Invalid audience values/); assert.deepEqual(state.saved, example);
});

test('concurrent saved changes block replacement until explicit reload; local draft remains intact', async (t) => {
  const { view, state, editor, change } = await panel(t); await change('hasApi', 'true'); state.saved = { audience: { hasCards: false } };
  await view.click('Save audience targeting'); assert.equal(state.writes.length, 0); assert.equal(editor().filters.hasApi, 'true'); assert.match(view.text(), /saved audience changed/); assert.equal(view.button('Save audience targeting').disabled, true);
  await view.click('Reload saved targeting (replace draft)'); assert.equal(editor().filters.hasCards, 'false'); assert.equal(editor().filters.hasApi, ''); assert.equal(view.button('Save audience targeting').disabled, false);
});

test('unavailable, forbidden and failed reads never appear as a successful unrestricted policy', async (t) => {
  for (const status of [401, 403, 404, 500]) {
    const result = await panel(t, { read: async () => { throw Object.assign(new Error('Policy read failed'), { status }); } }); assert.equal(result.editor(), undefined); assert.equal(result.state.writes.length, 0);
    assert.match(result.view.text(), status === 404 ? /unavailable on this backend/ : /Policy read failed/);
    if ([401, 403].includes(status)) assert.equal(result.state.refreshes, 1);
  }
});

test('malformed saved targeting requires deliberate repair and cannot overwrite a policy repaired by another admin', async (t) => {
  let broken = true;
  const { view, state, editor, change } = await panel(t, { read: async (current) => { if (broken) throw Object.assign(new Error('Saved targeting is invalid'), { status: 400 }); return current.saved; } });
  assert.equal(editor(), undefined); assert.match(view.text(), /has not been replaced/); await view.click('Replace invalid saved targeting'); await change('hasCompletedTransactions', 'true'); await view.click('Save audience targeting');
  assert.deepEqual(state.writes[0], { audience: { hasCompletedTransactions: true } }); assert.match(view.text(), /Audience saved/);
  const conflict = await panel(t, { read: async (current) => { if (current.reads === 1) throw Object.assign(new Error('Invalid saved targeting'), { status: 400 }); return example; } }); await conflict.view.click('Replace invalid saved targeting'); await conflict.change('hasCards', 'false'); await conflict.view.click('Save audience targeting'); assert.equal(conflict.state.writes.length, 0); assert.match(conflict.view.text(), /saved audience changed/);
});

test('uncertain or unconfirmed writes prevent duplicate submissions until saved state is reloaded', async (t) => {
  for (const write of [async () => { throw new Error('Connection lost'); }, async () => ({ audience: null })]) {
    const result = await panel(t, { write }); await result.change('hasApi', 'true'); await result.view.click('Save audience targeting'); assert.equal(result.state.writes.length, 1); assert.match(result.view.text(), /outcome is unconfirmed/); assert.equal(result.editor().filters.hasApi, 'true');
    await result.view.click('Save audience targeting'); assert.equal(result.state.writes.length, 1); await result.view.click('Reload saved targeting (replace draft)'); assert.equal(result.editor().filters.hasApi, 'false');
  }
});

test('a pending save cannot be submitted twice and server role failures disable mutation controls', async (t) => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const result = await panel(t, { write: async () => pending }); await result.change('hasApi', 'true'); await result.view.click('Save audience targeting'); await result.view.click('Saving…'); assert.equal(result.state.writes.length, 1); assert.equal(result.view.button('Saving…').disabled, true);
  release(result.state.writes[0]); await result.view.flush();
  const denied = await panel(t, { write: async () => { throw Object.assign(new Error('Permission denied'), { status: 403 }); } }); await denied.change('hasApi', 'true'); await denied.view.click('Save audience targeting'); assert.equal(denied.editor().disabled, true); assert.equal(denied.state.refreshes, 1); assert.match(denied.view.text(), /Read only/);
});

test('the shared audience editor shows USD amounts independently of monthly counts and preserves saved lists and false', async (t) => {
  const h = await load(), contact = await import(uri(source('lib/contact-exports.js'))), changes = [];
  const props = { filters: { ...h.emptyVisibilityAudience(), hasApi: 'false', deviceLanguages: ['fr-CD', 'en'], minCompletedTransactionTotalUsd: '25.50' }, groups: h.visibilityAudienceGroups, options: h.visibilityAudienceOptions, initiallyOpen: ['Completed transactions', 'Completed USD volume'], onChange: (key, value) => changes.push([key, value]) };
  const view = await mountComponent(path.join(root, 'components/ContactExportAudience.js'), { exportName: 'ContactExportAudience', props, modules: {
    '@/lib/api': { api: {} }, '@/lib/contact-exports': contact, '@/contexts/AuthContext': { useAuth: () => ({ enableRegulatorMode: false }) }, '@/components/CatalogSelect': { CatalogSelect: 'catalog-select' }, '@/components/CountrySelect': { CountryListField: 'country-list' }, '@/lib/regulator-presentation': { isRegulatorRestrictedRecord: () => false, isRegulatorRestrictedService: () => false }
  } }); t.after(() => view.unmount());
  const control = (label) => view.nodes().find((node) => node.type === 'label' && node.props.children[0]?.props?.children === label).props.children[1];
  assert.equal(control('Minimum completed total (USD)').props.type, 'number'); assert.equal(control('Minimum completed total (USD)').props.step, 'any'); assert.equal(control('Min transactions this month').props.step, '1');
  assert.equal(control('Device languages').props.value, 'fr-CD, en'); assert.equal(control('Has API plan').props.value, 'false');
  const actions = control('Transaction actions'); assert.equal(actions.type, 'catalog-select'); assert.equal(actions.props.multiple, true); actions.props.onChange({ target: { selectedOptions: [{ value: 'PAY_TV_SUBSCRIPTION' }] } }); assert.deepEqual(changes.at(-1), ['transactionActions', ['PAY_TV_SUBSCRIPTION']]);
});
