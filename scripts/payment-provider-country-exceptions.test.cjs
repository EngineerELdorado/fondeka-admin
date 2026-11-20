const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const root = path.join(__dirname, '..');
const load = (file) => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(root, file), 'utf8')).toString('base64')}`);
const countries = [{ cca2: 'CD', name: 'Congo' }, { cca2: 'CG', name: 'Congo (Brazza)' }, { cca2: 'KE', name: 'Kenya' }, { cca2: 'RW', name: 'Rwanda' }, { cca2: 'XK', name: 'Kosovo' }];
const provider = (extra = {}) => ({ id: 7, name: 'PAWAPAY', active: true, requireSameFundingDestinationForPayout: true, sameFundingDestinationScope: 'ANY_PROVIDER', sameFundingDestinationExemptCountryCodes: ['CD', 'CG'], ...extra });

test('provider exceptions normalize valid ISO codes, deduplicate and clear explicitly without changing name or scope', async () => {
  const h = await load('lib/payment-provider-policy.js');
  assert.deepEqual(h.normalizeFundingExemptions([' cd ', 'cg', 'CD'], countries), ['CD', 'CG']);
  for (const values of [null, '', [null], [''], ['  '], ['ZZ'], ['COD']]) assert.throws(() => h.normalizeFundingExemptions(values, countries));
  const selected = provider({ name: 'MAPLERAD', sameFundingDestinationScope: 'ANY_PROVIDER' });
  const payload = h.paymentProviderPayload({ ...h.paymentProviderDraft(selected), sameFundingDestinationExemptCountryCodes: [] }, countries);
  assert.equal(payload.name, 'MAPLERAD'); assert.equal(payload.sameFundingDestinationScope, 'ANY_PROVIDER'); assert.equal(payload.requireSameFundingDestinationForPayout, true); assert.deepEqual(payload.sameFundingDestinationExemptCountryCodes, []);
  assert.deepEqual(h.paymentProviderPayload({ ...h.paymentProviderDraft(selected), requireSameFundingDestinationForPayout: false }, countries).sameFundingDestinationExemptCountryCodes, ['CD', 'CG']);
  assert.equal(Object.hasOwn(h.paymentProviderPayload(h.paymentProviderDraft(provider({ sameFundingDestinationExemptCountryCodes: undefined }))), 'sameFundingDestinationExemptCountryCodes'), false);
});

test('route policy trusts effective backend enforcement and never infers exemption from sender or country selection alone', async () => {
  const h = await load('lib/payment-provider-policy.js');
  assert.match(h.routeFundingPolicy({ ...provider(), countryCode: 'CD', sameFundingDestinationEnforcedForCountry: false }), /CD country exception/);
  assert.match(h.routeFundingPolicy({ ...provider(), countryCode: 'CG', sameFundingDestinationEnforcedForCountry: false }), /CG country exception/);
  assert.match(h.routeFundingPolicy({ ...provider(), countryCode: 'RW', accountCountry: 'CD', sameFundingDestinationEnforcedForCountry: true }), /any mobile-money provider required/);
  assert.match(h.routeFundingPolicy({ ...provider(), countryCode: '', sameFundingDestinationEnforcedForCountry: true }), /required/);
  assert.match(h.routeFundingPolicy({ ...provider(), countryCode: 'CD' }), /Country enforcement not reported/);
  assert.match(h.routeFundingPolicy({ ...provider({ sameFundingDestinationExemptCountryCodes: [] }), countryCode: 'CD', sameFundingDestinationEnforcedForCountry: true }, provider({ requireSameFundingDestinationForPayout: false })), /required/);
  assert.match(h.routeFundingPolicy({ sameFundingDestinationEnforcedForCountry: false, ...provider({ requireSameFundingDestinationForPayout: false }) }), /disabled for all countries/);
  assert.match(h.routeFundingPolicy({}), /not reported/);
});

async function panel(t, { role = 'ADMIN', current = provider(), listed = current, write } = {}) {
  const h = await load('lib/payment-provider-policy.js'), state = { current: structuredClone(current), rows: [structuredClone(listed)], gets: [], writes: [] };
  const api = { paymentProviders: {
    list: async () => ({ content: state.rows }), get: async (id) => { state.gets.push(id); return structuredClone(state.current); },
    create: async (payload) => { state.writes.push({ type: 'create', payload }); if (write) return write(payload, state); state.current = { id: 7, ...payload }; state.rows = [state.current]; return structuredClone(state.current); },
    update: async (id, payload) => { state.writes.push({ type: 'update', id, payload }); if (write) return write(payload, state); state.current = { ...state.current, ...payload }; state.rows = [state.current]; return structuredClone(state.current); },
    remove: async () => { throw new Error('No provider deletion expected'); }
  } };
  const view = await mountComponent(path.join(root, 'app/(dashboard)/dashboard/payments/payment-providers/page.js'), { modules: {
    '@/lib/use-catalog-codes': { useCatalogCodes: (resource, field, fallback, selected) => ({ options: [...new Set([...fallback, ...selected])] }) },
    '@/lib/api': { api }, '@/lib/payment-provider-policy': h, '@/data/countries': countries, '@/contexts/AuthContext': { useAuth: () => ({ session: { tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } }, enableRegulatorMode: false }) },
    '@/lib/regulator-presentation': { regulatorVisibleFields: (value) => value }, '@/components/RegulatorPresentation': { PresentationLink: 'a' }, '@/components/DataTable': { DataTable: 'data-table' }, '@/components/CountrySelect': { CountrySelect: 'country-select' }
  } }); t.after(() => view.unmount()); await view.flush();
  const table = () => view.nodes().find((node) => node.type === 'data-table').props;
  const walk = (node) => Array.isArray(node) ? node.flatMap(walk) : node?.props ? [node, ...walk(node.props.children)] : [];
  const edit = async () => { walk(table().columns.find((column) => column.key === 'actions').render(state.rows[0])).find((node) => node.type === 'button' && node.props.children === 'Edit').props.onClick(); await view.flush(); };
  const picker = () => view.nodes().find((node) => node.type === 'country-select');
  const select = async (values) => { picker().props.onChange({ target: { selectedOptions: values.map((value) => ({ value })) } }); await view.flush(); };
  const change = async (id, value) => { view.nodes().find((node) => node.props.id === id).props.onChange({ target: { value, checked: value } }); await view.flush(); };
  return { view, state, table, edit, picker, select, change };
}

test('editing loads fresh provider terms and clearly distinguishes both Congos in the searchable multi-select', async (t) => {
  const { view, state, edit, picker, select } = await panel(t, { listed: provider({ sameFundingDestinationScope: 'SAME_PROVIDER', sameFundingDestinationExemptCountryCodes: [] }) });
  await edit(); assert.deepEqual(state.gets, [7]); assert.equal(picker().props.multiple, true); assert.deepEqual(picker().props.value, ['CD', 'CG']);
  assert.equal(picker().props.records.find((country) => country.cca2 === 'CD').name, 'DR Congo'); assert.match(picker().props.records.find((country) => country.cca2 === 'CG').name, /Congo-Brazzaville/); assert.equal(picker().props.records.some((country) => country.cca2 === 'XK'), false);
  await select(['CD']); await view.click('Save'); assert.deepEqual(state.writes[0].payload, { name: 'PAWAPAY', active: true, requireSameFundingDestinationForPayout: true, sameFundingDestinationScope: 'ANY_PROVIDER', sameFundingDestinationExemptCountryCodes: ['CD'] });
  assert.match(view.text(), /New routing decisions use the saved policy/);
});

test('clearing every selected country sends an empty array, while disabling the main flag preserves the saved list', async (t) => {
  const clear = await panel(t); await clear.edit(); await clear.select([]); await clear.view.click('Save'); assert.deepEqual(clear.state.writes[0].payload.sameFundingDestinationExemptCountryCodes, []);
  const paused = await panel(t); await paused.edit(); await paused.change('requireSameFundingDestinationForPayout', false); assert.equal(paused.picker().props.disabled, false); await paused.view.click('Save'); assert.equal(paused.state.writes[0].payload.requireSameFundingDestinationForPayout, false); assert.deepEqual(paused.state.writes[0].payload.sameFundingDestinationExemptCountryCodes, ['CD', 'CG']);
});

test('creating a provider does not preselect Congo exceptions or enable the funding restriction', async (t) => {
  const { view, state, picker, change } = await panel(t); await view.click('Add provider'); assert.deepEqual(picker().props.value, []);
  await change('name', 'MAPLERAD'); await view.click('Create'); assert.equal(state.writes[0].payload.name, 'MAPLERAD'); assert.equal(state.writes[0].payload.requireSameFundingDestinationForPayout, false); assert.deepEqual(state.writes[0].payload.sameFundingDestinationExemptCountryCodes, []);
});

test('an older backend can save unrelated settings without clearing unreported exceptions', async (t) => {
  const old = provider(); delete old.sameFundingDestinationExemptCountryCodes;
  const { view, state, edit, picker, change } = await panel(t, { current: old }); await edit(); assert.equal(picker().props.disabled, true); assert.match(view.text(), /unavailable on this backend/);
  await change('active', false); await view.click('Save'); assert.equal(Object.hasOwn(state.writes[0].payload, 'sameFundingDestinationExemptCountryCodes'), false); assert.equal(state.writes[0].payload.active, false); assert.equal(state.writes[0].payload.sameFundingDestinationScope, 'ANY_PROVIDER');
  await view.click('Add provider'); assert.equal(picker().props.disabled, true); assert.match(view.text(), /unavailable on this backend/);
});

test('server validation errors retain the selected countries, name and scope inside the editor', async (t) => {
  const { view, state, edit, picker, select } = await panel(t, { write: async () => { throw Object.assign(new Error('Unknown destination country'), { status: 400 }); } });
  await edit(); await select(['CG']); await view.click('Save'); assert.equal(state.writes.length, 1); assert.deepEqual(picker().props.value, ['CG']); assert.match(view.text(), /Unknown destination country/); assert.equal(view.nodes().find((node) => node.props.id === 'sameFundingDestinationScope').props.value, 'ANY_PROVIDER');
});

test('concurrent provider changes require an explicit reload and do not overwrite another exception list', async (t) => {
  const { view, state, edit, select, picker } = await panel(t); await edit(); await select(['CD']); state.current.sameFundingDestinationExemptCountryCodes = ['KE']; await view.click('Save'); assert.equal(state.writes.length, 0); assert.equal(view.button('Save').disabled, true); assert.deepEqual(picker().props.value, ['CD']);
  await view.click('Reload provider (replace draft)'); assert.deepEqual(picker().props.value, ['KE']); assert.equal(view.button('Save').disabled, false);
});

test('unconfirmed country writes never display success or automatically submit again', async (t) => {
  const { view, state, edit, select, picker } = await panel(t, { write: async () => provider({ sameFundingDestinationExemptCountryCodes: [] }) }); await edit(); await select(['CD']); await view.click('Save');
  assert.match(view.text(), /did not confirm/); assert.deepEqual(picker().props.value, ['CD']); assert.equal(view.button('Save').disabled, true); await view.click('Save'); assert.equal(state.writes.length, 1); assert.doesNotMatch(view.text(), /Updated payment provider/);
});

test('non-writing roles cannot open an editable form or submit provider changes', async (t) => {
  const { view, state, edit } = await panel(t, { role: 'ASSISTANT' }); assert.equal(view.button('Add provider').disabled, true); await view.click('Add provider'); await edit(); assert.equal(state.gets.length, 0); assert.equal(state.writes.length, 0); assert.equal(view.nodes().some((node) => node.type === 'country-select'), false);
});

test('coverage displays separate backend country decisions per provider instead of one global flag', async (t) => {
  const h = await load('lib/payment-provider-policy.js');
  const view = await mountComponent(path.join(root, 'app/(dashboard)/dashboard/payments/provider-coverage/page.js'), { modules: {
    '@/lib/api': { api: { paymentMethodPaymentProviders: { coverage: async () => ({ paymentMethods: [{ paymentMethodId: 1, countryCode: 'CD', providers: [provider({ mappingId: 10, sameFundingDestinationEnforcedForCountry: false }), provider({ id: 8, name: 'MAPLERAD', mappingId: 11, sameFundingDestinationExemptCountryCodes: [], sameFundingDestinationEnforcedForCountry: true })] }], providers: [] }) } } },
    '@/lib/payment-provider-policy': h, '@/lib/regulator-presentation': { isRegulatorRestrictedRecord: () => false }, '@/lib/payment-method-labels': { paymentMethodAdminLabel: () => 'Mobile money' }, '@/components/RegulatorPresentation': { PresentationSelect: 'select', PresentationLink: 'a' }, '@/components/DataTable': { DataTable: 'data-table' }, '@/components/TableCell': 'table-text'
  } }); t.after(() => view.unmount()); await view.flush();
  const table = view.nodes().find((node) => node.type === 'data-table').props, cell = table.columns.find((column) => column.key === 'payoutPolicy').render(table.rows[0]);
  const text = (node) => Array.isArray(node) ? node.map(text).join(' ') : node?.props ? text(node.props.children) : String(node || '');
  assert.match(text(cell), /CD country exception/); assert.match(text(cell), /any mobile-money provider required/);
});

test('failover validation distinguishes a required target check from an exemption without claiming payout eligibility', async (t) => {
  const routes = [true, false].map((destinationCheckRequired, index) => ({ ruleId: String(index), order: index + 1, enabled: true, destinationCheckRequired, sourceRouteId: 1, targetRouteId: 2 }));
  const view = await mountComponent(path.join(root, 'components/payout-failover/Common.js'), { exportName: 'ValidationReport', props: { report: { valid: true, issues: [], routes } }, modules: { '@/contexts/AuthContext': { useAuth: () => ({}) }, '@/components/failover/HelpTip': 'help-tip' } }); t.after(() => view.unmount());
  assert.match(view.text(), /Recipient funding eligibility must be checked/); assert.match(view.text(), /does not require a prior-funding check/); assert.match(view.text(), /Other payout eligibility checks still apply/);
});
