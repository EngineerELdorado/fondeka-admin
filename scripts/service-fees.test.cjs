const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const root = path.join(__dirname, '..');
const load = (file, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(root, file), 'utf8')).toString('base64')}#${tag}`);
const session = (role) => ({ tokens: { accessToken: { payload: { sub: 'fees-admin', 'cognito:groups': [role] } } } });
const fee = (extra = {}) => ({ id: 8, service: 'BILL_PAYMENTS', action: null, productType: 'BILL_PRODUCT_PROVIDER', productKey: '103', percentage: 0.02, flatAmount: 1, minimumAmount: 0, maximumAmount: null, currency: 'USD', costPercentage: 0, costFlatAmount: 0, costMinimumAmount: 0, active: true, ...extra });
const page = (rows, number = 0, size = 20, total = rows.length) => ({ content: rows, page: { number, size, totalElements: total, totalPages: Math.ceil(total / size) } });

test('business fee percentages round-trip as fractional API values, preserve explicit zero, and replace every editable field', async () => {
  const h = await load('lib/service-fees.js');
  assert.equal(h.serviceFeeDraft(fee()).percentage, '2');
  for (const percentage of ['0', '2', '2.9', '1.1', '100', '0.00000001']) {
    const payload = h.serviceFeePayload({ ...h.emptyServiceFee(), percentage });
    assert.equal(payload.percentage, Number(`${percentage}e-2`));
    assert.equal(h.serviceFeeDraft({ ...payload, id: 1 }).percentage, percentage);
  }
  const result = h.serviceFeePayload({ ...h.serviceFeeDraft(fee({ percentage: 0, maximumAmount: 5 })), maximumAmount: '', productType: '', productKey: '', action: '' });
  assert.equal(result.percentage, 0); assert.equal(result.maximumAmount, null); assert.equal(result.action, null); assert.equal(result.productType, null); assert.equal(result.productKey, null);
  assert.equal(result.costPercentage, 0); assert.equal(Object.hasOwn(result, 'feeContext'), false); assert.equal(Object.hasOwn(result, 'paymentProviderId'), false);
  const cost = h.serviceFeePayload({ ...h.emptyServiceFee(), costPercentage: '3', costFlatAmount: '2', costMinimumAmount: '4', maximumAmount: '1' });
  assert.equal(cost.costPercentage, 0.03); assert.equal(cost.costMinimumAmount, 4); assert.equal(cost.maximumAmount, 1);
});

test('all nine product scopes use the correct service, paired IDs and compatible actions', async () => {
  const h = await load('lib/service-fees.js'); assert.equal(h.serviceFeeScopes.length, 9);
  for (const scope of h.serviceFeeScopes) {
    const draft = { ...h.emptyServiceFee(), service: scope.service, productType: scope.value, productKey: scope.value.endsWith('_PAIR') ? '12:34' : '103' };
    assert.equal(h.serviceFeePayload(draft).productType, scope.value);
    assert.throws(() => h.serviceFeePayload({ ...draft, service: 'COMMERCE' }));
  }
  assert.equal(h.serviceFeePayload({ ...h.emptyServiceFee(), service: 'E_SIM', productType: 'ESIM_PRODUCT', productKey: 'AIRALO:congo-7days-1gb' }).productKey, 'AIRALO:congo-7days-1gb');
  for (const extra of [{ action: 'FUND_CARD' }, { productType: 'BILL_PRODUCT', productKey: '' }, { productType: '', productKey: '1' }, { percentage: '101' }, { percentage: '-1' }, { percentage: 'NaN' }, { percentage: '0.000000001' }, { flatAmount: '-1' }, { flatAmount: '1.001' }, { costPercentage: '101' }, { minimumAmount: '2', maximumAmount: '1' }, { currency: 'US' }]) assert.throws(() => h.serviceFeePayload({ ...h.emptyServiceFee(), ...extra }));
  for (const key of ['1:1', '1:', ':2', '1:2:3', '-1:2']) assert.throws(() => h.serviceFeePayload({ ...h.emptyServiceFee(), service: 'CRYPTO', productType: 'CRYPTO_PAIR', productKey: key }));
});

test('rail payloads require context, reject mixed business scopes, retain human percentages and allow both-context batches', async () => {
  const h = await load('lib/service-fees.js');
  assert.deepEqual(h.railOnlyPayload({ action: 'COLLECTION', ourFeePercentage: 2, ourFlatFee: 1, minAmount: 100, amountRangeCurrency: 'USD', service: null }), { feeContext: 'COLLECTION', ourFeePercentage: 2, ourFlatFee: 1, minAmount: 100, amountRangeCurrency: 'USD' });
  for (const extra of [{}, { action: 'FUND_CARD' }, { feeContext: 'COLLECTION', service: 'CARD' }, { feeContext: 'PAYOUT', billProductBillProviderId: 103 }, { feeContext: 'COLLECTION', billProviderId: 1 }, { feeContext: 'PAYOUT', fromCurrencyProductId: 1 }, { feeContext: 'COLLECTION', action: 'PAYOUT' }]) assert.throws(() => h.railOnlyPayload(extra));
  assert.deepEqual(h.railOnlyPayload({ ourFlatFee: 0 }, { requireContext: false }), { ourFlatFee: 0 });
});

test('business CRUD is uncached, preserves false filters and null replacement fields, and handles bodyless DELETE', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'service-fee-api'), calls = []; api.setAuthToken('fees-token');
  global.fetch = async (url, init) => { calls.push({ url, init }); return init.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json(fee()); };
  await api.serviceFeeConfigs.list(new URLSearchParams({ page: '1', size: '20', active: 'false', productKey: '1:2' }));
  await api.serviceFeeConfigs.get(8); await api.serviceFeeConfigs.create({ ...fee(), id: undefined }); await api.serviceFeeConfigs.update(8, { ...fee(), action: null, productKey: null, productType: null }); await api.serviceFeeConfigs.remove(8);
  assert.equal(new URL(calls[0].url, 'https://admin.local').searchParams.get('active'), 'false');
  assert.equal(JSON.parse(calls[3].init.body).productKey, null); assert.equal(calls[4].init.body, undefined);
  for (const call of calls) { assert.match(call.url, /\/admin-api\/service-fee-configs/); assert.equal(call.init.cache, 'no-store'); assert.equal(call.init.headers.Authorization, 'Bearer fees-token'); }
});

test('product option loading reads every stable DTO page without truncating a short first page', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'service-fee-options'), calls = [];
  global.fetch = async (url) => { calls.push(url); const number = Number(new URL(url, 'https://admin.local').searchParams.get('page')); return Response.json(page([{ id: number + 1, name: `Mapping ${number + 1}` }], number, 200, 201)); };
  const rows = await api.serviceFeeProducts.options('CARD_PRODUCT_PROVIDER'); assert.deepEqual(rows.map((row) => row.id), [1, 2]); assert.equal(calls.length, 2); assert.match(calls[0], /card-product-card-providers/);
  assert.deepEqual(await api.serviceFeeProducts.options('RECHARGE_OPERATOR'), []);
});

test('bill product filter options retain mapping IDs and load product names and country metadata', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'service-fee-bill-options'); api.setAuthToken('fees-token');
  global.fetch = async (url) => {
    const pathname = new URL(url, 'https://admin.local').pathname;
    return Response.json(page(pathname.endsWith('/countries') ? [{ id: 1, name: 'DR Congo', alpha2Code: 'CD' }] : pathname.endsWith('/bill-products') ? [{ id: 12, displayName: 'SOCODEE', countryIds: [1] }] : [{ id: 103, billProductId: 12, billProviderName: 'UMEME' }]));
  };
  const rows = await api.serviceFeeProducts.options('BILL_PRODUCT_PROVIDER'); assert.equal(rows[0].id, 103); assert.equal(rows[0].__catalogEntity.displayName, 'SOCODEE'); assert.equal(rows[0].__catalogCountries[0].alpha2Code, 'CD');
  const products = await api.serviceFeeProducts.options('BILL_PRODUCT'); assert.equal(products[0].id, 12); assert.equal(products[0].__catalogCountries[0].alpha2Code, 'CD');
});

async function business(t, { role = 'ADMIN', rows = [fee()], list, write, get } = {}) {
  const h = await load('lib/service-fees.js'), state = { rows: structuredClone(rows), reads: [], writes: [], gets: [] };
  const auth = { session: session(role), enableRegulatorMode: false, refreshSession: async () => {} };
  const api = { serviceFeeConfigs: {
    list: async (params) => { const query = Object.fromEntries(params); state.reads.push(query); return list ? list(query, state) : page(state.rows, Number(query.page), Number(query.size)); },
    get: async (id) => { state.gets.push(id); return get ? get(id, state) : structuredClone(state.rows.find((row) => row.id === id)); },
    create: async (payload) => { state.writes.push({ type: 'create', payload }); if (write) return write(payload, state); const result = { id: 99, ...payload }; state.rows.push(result); return result; },
    update: async (id, payload) => { state.writes.push({ type: 'update', id, payload }); if (write) return write(payload, state); const result = { id, ...payload }; state.rows = state.rows.map((row) => row.id === id ? result : row); return result; },
    remove: async (id) => { state.writes.push({ type: 'delete', id }); state.rows = state.rows.filter((row) => row.id !== id); return null; }
  } };
  const view = await mountComponent(path.join(root, 'components/fees/BusinessFees.js'), { exportName: 'BusinessFeesWorkspace', props: {}, modules: {
    '@/lib/api': { api }, '@/lib/service-fees': h, '@/contexts/AuthContext': { useAuth: () => auth }, 'next/navigation': { useSearchParams: () => new URLSearchParams() },
    '@/components/RegulatorPresentation': { PresentationLink: 'a', PresentationSelect: 'select' }, '@/lib/regulator-presentation': { isRegulatorRestrictedService: () => false, isRegulatorRestrictedRecord: () => false },
    '@/components/DataTable': { DataTable: 'data-table' }, '@/components/ContentModal': { ContentModal: 'content-modal' }, '@/components/CatalogSelect': { CatalogSelect: 'catalog-select' }, './fees.module.css': {}
  } }); t.after(() => view.unmount()); await view.flush();
  const table = () => view.nodes().find((node) => node.type === 'data-table')?.props;
  const review = async () => { table().columns.find((column) => column.key === 'actions').render(table().rows[0]).props.onClick(); await view.flush(); };
  return { view, state, table, review };
}

test('business editor displays human percentages, sends a full replacement and preserves explicit zero overrides', async (t) => {
  const { view, state, review } = await business(t); await review();
  assert.equal(view.field('Percentage (%)').props.value, '2'); view.change('Percentage (%)', '0'); view.change('Maximum charge (optional)', '10');
  await view.click('Save business fee'); assert.equal(state.writes.length, 1); assert.equal(state.writes[0].payload.percentage, 0); assert.equal(state.writes[0].payload.maximumAmount, 10); assert.equal(state.writes[0].payload.productKey, '103'); assert.equal(state.writes[0].payload.costFlatAmount, 0); assert.ok(state.gets.length >= 2); assert.match(view.text(), /saved for new quotes/);
});

test('new card product/action rules clearly replace operation settings and convert the entered fee once', async (t) => {
  const { view, state } = await business(t); await view.click('New business rule'); view.change('Service', 'CARD'); view.change('Action', 'FUND_CARD'); view.change('Product scope', 'CARD_PRODUCT_PROVIDER');
  const picker = view.nodes().find((node) => node.props.type === 'CARD_PRODUCT_PROVIDER' && node.props.onChange); picker.props.onChange('24'); await view.flush();
  view.change('Percentage (%)', '2'); assert.match(view.text(), /replaces the card mapping/); await view.click('Save business fee');
  assert.equal(state.writes[0].payload.percentage, 0.02); assert.equal(state.writes[0].payload.productType, 'CARD_PRODUCT_PROVIDER'); assert.equal(state.writes[0].payload.action, 'FUND_CARD'); assert.equal(state.writes[0].payload.productKey, '24');
});

test('business filters are server-side, preserve false and page sizes, and do not apply only to visible rows', async (t) => {
  const { view, state, table } = await business(t); view.change('Service filter', 'CARD'); view.change('Product scope filter', 'CARD_PRODUCT_PROVIDER');
  const productFilter = () => view.nodes().find((node) => node.props.filter === true);
  assert.equal(productFilter().props.type, 'CARD_PRODUCT_PROVIDER'); productFilter().props.onChange('24'); await view.flush();
  view.change('Status filter', 'false'); await view.click('Apply filters');
  assert.deepEqual(state.reads.at(-1), { page: '0', size: '20', service: 'CARD', productType: 'CARD_PRODUCT_PROVIDER', productKey: '24', active: 'false' });
  table().onPageChange(2); await view.flush(); assert.equal(state.reads.at(-1).productKey, '24');
  productFilter().props.onChange('25'); await view.flush(); await view.click('Apply filters'); assert.equal(state.reads.at(-1).page, '0'); assert.equal(state.reads.at(-1).productKey, '25');
  view.change('Rows per page', '100'); await view.flush(); assert.equal(state.reads.at(-1).page, '0'); assert.equal(state.reads.at(-1).size, '100');
  view.change('Product scope filter', ''); assert.equal(productFilter().props.value, '');
  await view.click('Clear filters'); assert.equal(Object.hasOwn(state.reads.at(-1), 'active'), false); assert.equal(Object.hasOwn(state.reads.at(-1), 'productKey'), false);
});

async function productPicker(t, { type = 'BILL_PRODUCT', value = '', options = async () => [{ id: 12, displayName: 'SOCODEE', code: 'SOCODEE' }, { id: 13, displayName: 'VIRUNGA', code: 'VIRUNGA' }] } = {}) {
  const h = await load('lib/service-fees.js'), calls = [], changes = [];
  const props = { type, value, filter: true, onChange: (next) => { changes.push(next); props.value = next; } };
  const view = await mountComponent(path.join(root, 'components/fees/BusinessFees.js'), { exportName: 'FeeProductPicker', props, modules: {
    '@/lib/api': { api: { serviceFeeProducts: { options: async (scope) => { calls.push(scope); return options(scope); } } } }, '@/lib/service-fees': h,
    '@/contexts/AuthContext': {}, 'next/navigation': {}, '@/components/RegulatorPresentation': {}, '@/lib/regulator-presentation': {}, '@/components/DataTable': {}, '@/components/ContentModal': {}, '@/components/CatalogSelect': { CatalogSelect: 'catalog-select' }, './fees.module.css': {}
  } }); t.after(() => view.unmount()); await view.flush(); return { view, props, calls, changes };
}

test('product filters load searchable named catalogue options, select IDs and clear without an exact-ID requirement', async (t) => {
  const { view, calls, changes } = await productPicker(t);
  assert.deepEqual(calls, ['BILL_PRODUCT']); const selector = view.field('Product filter');
  assert.equal(selector.type, 'catalog-select'); assert.equal(selector.props.kind, 'bill-product');
  assert.deepEqual(selector.props.records.map((row) => row.displayName), ['SOCODEE', 'VIRUNGA']); assert.match(view.text(), /All products/);
  view.change('Product filter', '12'); await view.flush(); assert.equal(view.field('Product filter').props.value, '12');
  view.change('Product filter', ''); await view.flush(); assert.deepEqual(changes, ['12', '']);
  await view.click('Enter catalogue IDs directly'); view.change('Product key filter', '999'); await view.flush();
  await view.click('Choose from catalogue'); assert.equal(view.field('Product filter').props.value, '999'); assert.match(view.text(), /Saved ID #999/);
  const noScope = await productPicker(t, { type: '' }); assert.equal(noScope.calls.length, 0); assert.equal(noScope.view.field('Product filter').props.disabled, true); assert.match(noScope.view.text(), /Select a product scope/);
});

test('conversion pair filters compose both selected product IDs and reject a partial pair before applying', async (t) => {
  const picker = await productPicker(t, { type: 'CRYPTO_PAIR' }); picker.view.change('From product filter', '12'); await picker.view.flush(); assert.equal(picker.changes.at(-1), '12:');
  picker.view.change('To product filter', '13'); await picker.view.flush(); assert.equal(picker.changes.at(-1), '12:13');
  picker.view.change('From product filter', ''); await picker.view.flush(); picker.view.change('To product filter', ''); await picker.view.flush(); assert.equal(picker.changes.at(-1), '');
  const { view, state } = await business(t); view.change('Service filter', 'CRYPTO'); view.change('Product scope filter', 'CRYPTO_PAIR');
  const filter = () => view.nodes().find((node) => node.props.filter === true);
  filter().props.onChange('12:'); await view.flush(); const count = state.reads.length; await view.click('Apply filters'); assert.equal(state.reads.length, count); assert.match(view.text(), /Choose both products/);
  filter().props.onChange('12:13'); await view.flush(); await view.click('Apply filters'); assert.equal(state.reads.at(-1).productKey, '12:13');
  filter().props.onChange(''); await view.flush(); await view.click('Apply filters'); assert.equal(Object.hasOwn(state.reads.at(-1), 'productKey'), false);
});

test('failed catalogue loads preserve the selected product filter and offer reload or direct IDs', async (t) => {
  let attempt = 0;
  const { view, calls } = await productPicker(t, { value: '12', options: async () => { if (!attempt++) throw new Error('Catalogue unavailable'); return [{ id: 12, displayName: 'SOCODEE' }]; } });
  assert.match(view.text(), /Catalogue unavailable/); assert.equal(view.field('Product filter').props.value, '12');
  await view.click('Reload products'); assert.equal(calls.length, 2); assert.doesNotMatch(view.text(), /Catalogue unavailable/); assert.equal(view.field('Product filter').props.records[0].displayName, 'SOCODEE');
});

test('Assistants inspect without write controls; denied roles and unavailable backends do not produce an empty success', async (t) => {
  const assistant = await business(t, { role: 'ASSISTANT' }); await assistant.review(); assert.match(assistant.view.text(), /Read only/); assert.equal(assistant.view.field('Percentage (%)').props.disabled, true); assert.equal(assistant.view.nodes().some((node) => node.type === 'button' && node.props.children === 'Save business fee'), false);
  const staff = await business(t, { role: 'STAFF' }); assert.equal(staff.state.reads.length, 0);
  const unavailable = await business(t, { list: async () => { throw Object.assign(new Error('Not found'), { status: 404 }); } }); assert.match(unavailable.view.text(), /unavailable on this backend/); assert.doesNotMatch(unavailable.view.text(), /No business fees match/); assert.equal(unavailable.view.button('New business rule').disabled, true);
});

test('duplicate active-scope errors keep the complete draft for correction without an automatic retry', async (t) => {
  const { view, state, review } = await business(t, { write: async () => { throw Object.assign(new Error('An active fee already exists for this scope. Edit it or deactivate it first.'), { status: 409 }); } }); await review(); view.change('Percentage (%)', '3'); await view.click('Save business fee');
  assert.equal(state.writes.length, 1); assert.equal(view.field('Percentage (%)').props.value, '3'); assert.match(view.text(), /active fee already exists/);
});

test('changed server rules block stale saves until the admin explicitly reloads the editor', async (t) => {
  const { view, state, review } = await business(t); await review(); view.change('Percentage (%)', '3'); state.rows[0].flatAmount = 9; await view.click('Save business fee');
  assert.equal(state.writes.length, 0); assert.match(view.text(), /changed on the server/); assert.equal(view.field('Percentage (%)').props.value, '3'); assert.equal(view.button('Save business fee').disabled, true);
  await view.click('Reload saved rule (replace draft)'); assert.equal(view.field('Flat charge').props.value, '9'); assert.equal(view.button('Save business fee').disabled, false);
});

test('deactivation retains a full rule and confirmed deletion consumes a bodyless response', async (t) => {
  const panel = await business(t); await panel.review(); await panel.view.click('Set inactive'); await panel.view.click('Save business fee');
  assert.equal(panel.state.writes[0].payload.active, false); assert.equal(panel.state.writes[0].payload.flatAmount, 1);
  await panel.review(); await panel.view.click('Confirm delete business fee'); assert.equal(panel.state.writes.at(-1).type, 'delete'); assert.match(panel.view.text(), /Business fee deleted/);
});

test('card editor override notice selects only explicit active product/action rows, including zero', async (t) => {
  const h = await load('lib/service-fees.js'), reads = [];
  const view = await mountComponent(path.join(root, 'components/fees/CardOperationFeeNotice.js'), { props: { mappingId: 24 }, modules: {
    '@/lib/api': { api: { serviceFeeConfigs: { list: async (params) => { reads.push(Object.fromEntries(params)); return page([fee({ id: 1, service: 'CARD', productType: 'CARD_PRODUCT_PROVIDER', productKey: '24', action: 'FUND_CARD', percentage: 0 }), fee({ id: 2, service: 'CARD', productType: 'CARD_PRODUCT_PROVIDER', productKey: '24', action: null })]); } } } }, '@/lib/service-fees': h, '@/components/RegulatorPresentation': { PresentationLink: 'a' }
  } }); t.after(() => view.unmount()); await view.flush(); assert.equal(reads[0].productKey, '24'); assert.equal(reads[0].active, 'true'); assert.match(view.text(), /Funding overridden by business fee #1/); assert.match(view.text(), /0%/); assert.doesNotMatch(view.text(), /business fee #2/); assert.match(view.text(), /Clear both/);
});

async function rail(t) {
  const h = await load('lib/service-fees.js'), state = { writes: [], rows: [] }, data = async () => [];
  const api = { feeConfigs: { list: async () => page(state.rows), create: async (payload) => { state.writes.push(payload); return payload; }, syncPawapay: async (payload) => { state.writes.push(payload); return {}; }, batchUpdateProvider: async (id, payload) => { state.writes.push({ id, ...payload }); return {}; } },
    countries: { options: data }, paymentMethodPaymentProviders: { options: data }, paymentMethods: { options: data }, paymentProviders: { list: async () => [{ id: 5, name: 'PAWAPAY' }] } };
  const view = await mountComponent(path.join(root, 'app/(dashboard)/dashboard/fees/fee-configs/page.js'), { modules: {
    '@/lib/api': { api }, '@/lib/service-fees': h, '@/contexts/AuthContext': { useAuth: () => ({ session: session('ADMIN'), enableRegulatorMode: false }) },
    '@/components/CountrySelect': { CountrySelect: 'select' }, '@/components/CatalogSelect': { CatalogSelect: 'select' }, '@/components/DataTable': { DataTable: 'data-table' },
    '@/components/RegulatorPresentation': { RegulatorRecord: 'record', PresentationSelect: 'select', NonRegulatorContent: 'non-regulator', PresentationLink: 'a', RegulatorField: 'regulator-field' },
    '@/lib/regulator-presentation': { regulatorVisibleFields: (rows) => rows, isRegulatorRestrictedRecord: () => false }, '@/lib/payment-method-labels': { paymentMethodAdminLabel: (row) => row.name, paymentMethodRouteAdminLabel: (row) => row.name }
  } }); t.after(() => view.unmount()); await view.flush();
  const change = async (id, value) => { view.nodes().find((node) => node.props.id === id).props.onChange({ target: { value } }); await view.flush(); };
  return { view, state, change };
}

test('rail form removes business selectors and saves human rail percentages, amount bands and platform flat charges', async (t) => {
  const { view, state, change } = await rail(t); await view.click('Add rail tariff');
  for (const id of ['service', 'action', 'billProviderId', 'billProductBillProviderId', 'fromCryptoProductId']) assert.equal(view.nodes().some((node) => node.props.id === id), false);
  await change('scopeType', 'global_action_fallback'); await change('feeContext', 'PAYOUT'); await change('ourFeePercentage', '2'); await change('ourFlatFee', '1'); await change('minAmount', '10'); await change('maxAmount', '100'); await change('amountRangeCurrency', 'USD');
  await view.click('Create'); assert.equal(state.writes.length, 1); assert.equal(state.writes[0].ourFeePercentage, 2); assert.equal(state.writes[0].ourFlatFee, 1); assert.equal(state.writes[0].feeContext, 'PAYOUT'); assert.equal(state.writes[0].minAmount, 10);
  for (const key of ['service', 'action', 'billProviderId', 'billProductBillProviderId', 'fromCryptoProductId']) assert.equal(Object.hasOwn(state.writes[0], key), false);
});

test('PawaPay sync requires a rail context and preserves disclosure rows while removing platform fee fields', async (t) => {
  const { view, state, change } = await rail(t); await view.click('Sync PawaPay fees');
  const submit = async () => { view.nodes().filter((node) => node.type === 'button' && node.props.children === 'Sync PawaPay fees').at(-1).props.onClick(); await view.flush(); };
  await change('pawapayFeesJson', JSON.stringify([{ paymentMethodName: 'TEST', providerFeePercentage: 1 }])); await submit(); assert.equal(state.writes.length, 0); assert.match(view.text(), /Choose COLLECTION or PAYOUT/);
  await change('pawapayFeesJson', JSON.stringify([{ paymentMethodName: 'TEST', action: 'COLLECTION', providerFeeConfigEnabled: false, customerPaidProviderFeeAmount: 400, customerPaidProviderFeeCurrency: 'TZS', ourFeePercentage: 3, ourFlatFee: 2, feeApplicationMode: 'INCLUSIVE' }])); await submit();
  assert.equal(state.writes.length, 1); const result = state.writes[0].fees[0]; assert.equal(result.feeContext, 'COLLECTION'); assert.equal(result.customerPaidProviderFeeAmount, 400); assert.equal(result.providerFeeConfigEnabled, false);
  for (const key of ['ourFeePercentage', 'ourFlatFee', 'feeApplicationMode', 'action']) assert.equal(Object.hasOwn(result, key), false);
});

test('provider batch updates can cover both rail contexts without sending action or service', async (t) => {
  const { view, state, change } = await rail(t); await view.click('Bulk provider fee update'); await change('bulkPaymentProviderId', '5');
  const checkbox = view.nodes().find((node) => node.props['aria-label'] === 'Update Our %'); checkbox.props.onChange({ target: { checked: true } }); await view.flush();
  view.nodes().find((node) => node.props['aria-label'] === 'Bulk Our %').props.onChange({ target: { value: '2' } }); await view.flush();
  await view.click('Review update'); await view.click('Confirm bulk update'); assert.deepEqual(state.writes[0], { id: 5, ourFeePercentage: 2 });
});

test('existing card operation editor retains human percentages and sends nulls only when both fields are cleared', async (t) => {
  const writes = [], mapping = { id: 24, cardProductId: 1, cardProviderId: 2, currency: 'USD', fundCardFeePercentage: 2, minFundCardFeeAmount: 1.2, withdrawFromCardFeePercentage: 1, minWithdrawFromCardFeeAmount: 0.5 };
  const data = async () => [];
  const view = await mountComponent(path.join(root, 'app/(dashboard)/dashboard/cards/product-providers/page.js'), { modules: {
    '@/contexts/AuthContext': { useAuth: () => ({ enableRegulatorMode: false }) }, '@/components/TableActions': 'table-actions', '@/components/ResponsiveTable': 'table', '@/components/fees/CardOperationFeeNotice': 'operation-notice', '@/components/DataTable': { DataTable: 'data-table' }, '@/components/RegulatorPresentation': { RegulatorRecord: 'record', PresentationLink: 'a', RegulatorField: 'regulator-field' }, '@/lib/regulator-presentation': { regulatorVisibleFields: (rows) => rows },
    '@/lib/api': { api: { cardProductCardProviders: { list: async () => page([mapping]), metadataDefaults: async () => ({}), update: async (id, payload) => { writes.push(payload); return payload; } }, cardProducts: { list: data }, cardProviders: { list: data } } }
  } }); t.after(() => view.unmount()); await view.flush();
  const table = () => view.nodes().find((node) => node.type === 'data-table').props;
  const edit = async () => { const controls = table().columns.find((column) => column.key === 'actions').render(mapping); const find = (node) => Array.isArray(node) ? node.flatMap(find) : node?.props ? [node, ...find(node.props.children)] : []; find(controls).find((node) => node.type === 'button' && node.props.children === 'Edit').props.onClick(); await view.flush(); };
  const change = async (id, value) => { view.nodes().find((node) => node.props.id === id).props.onChange({ target: { value } }); await view.flush(); };
  await edit(); assert.ok(view.nodes().some((node) => node.props.mappingId === 24)); await change('fundCardFeePercentage', '0'); await change('minFundCardFeeAmount', '0'); await view.click('Save'); assert.equal(writes[0].fundCardFeePercentage, 0); assert.equal(writes[0].minFundCardFeeAmount, 0);
  await edit(); await change('fundCardFeePercentage', ''); await change('minFundCardFeeAmount', ''); await view.click('Save'); assert.equal(writes[1].fundCardFeePercentage, null); assert.equal(writes[1].minFundCardFeeAmount, null); assert.equal(writes[1].withdrawFromCardFeePercentage, 1);
});
