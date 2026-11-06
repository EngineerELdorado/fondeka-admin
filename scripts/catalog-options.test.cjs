const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const load = (file, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64')}#${tag}`);
const helpers = load('lib/catalog-options.js');

test('catalog country groups resolve IDs, localize codes and distinguish global from multiple countries', async () => {
  const { catalogCountries, groupCatalogOptions, catalogOptionDetails } = await helpers;
  const countries = [{ id: 1, name: 'Rwanda', alpha2Code: 'RW' }, { id: 2, name: 'Congo', alpha2Code: 'CD' }];
  assert.equal(catalogCountries({ countryId: 1 }, 'en', countries)[0].key, 'RW');
  assert.equal(catalogCountries({ countryCode: 'RW' }, 'fr')[0].label, 'Rwanda');
  assert.equal(catalogCountries({ countryIds: [999] })[0].label, 'Country #999');
  const options = [
    { id: 1, name: 'Netflix', countryIds: [] },
    { id: 2, name: 'Canal Plus', countryIds: [1, 2] },
    { id: 3, name: 'SNEL', countryId: 2 }
  ].map((record) => ({ value: String(record.id), label: record.name, ...catalogOptionDetails(record, 'bill-product', 'en', countries) }));
  const groups = groupCatalogOptions(options);
  assert.deepEqual(groups.map((g) => g.key), ['CD', '__multiple', '__global']);
  assert.deepEqual(groupCatalogOptions([options[1]], 'RW').map((g) => g.key), ['RW']);
  assert.deepEqual(options.map((o) => o.value), ['1', '2', '3'], 'grouping does not mutate catalog order');
});

test('local catalog search matches accents, codes, IDs, currencies, countries and route providers with AND semantics', async () => {
  const { catalogOptionDetails, filterCatalogOptions } = await helpers;
  const records = [
    { id: 41, paymentMethodId: 7, paymentProviderName: 'PawaPay', providerCode: 'MTN_MOMO_RWA', __catalogEntity: { id: 7, name: 'MTN_MOBILE_MONEY', displayName: 'MTN Mobile Money', currency: 'RWF', countryCode: 'RW', type: 'MOBILE_MONEY' } },
    { id: 42, name: 'Électricité', code: 'SNEL_DRC', countryCode: 'CD', currency: 'CDF' },
    { id: 43, name: 'Global service' }
  ];
  const options = records.map((record) => ({ value: String(record.id), label: record.name || '', ...catalogOptionDetails(record, 'payment-route') }));
  for (const query of ['mtn rwanda', 'rw RWF pawapay', '#41', 'momo rwa']) assert.deepEqual(filterCatalogOptions(options, query).map((o) => o.value), ['41']);
  assert.deepEqual(filterCatalogOptions(options, 'electricite cdf').map((o) => o.value), ['42']);
  assert.deepEqual(filterCatalogOptions(options, 'RDC').map((o) => o.value), ['42']);
  assert.equal(filterCatalogOptions(options, 'mtn cdf').length, 0);
  assert.deepEqual(filterCatalogOptions(options, '', '__global').map((o) => o.value), ['43']);
  assert.deepEqual(filterCatalogOptions(options, '', 'RW').map((o) => o.value), ['41']);
});

test('catalog options load all pages, join route metadata and leave directory list pagination unchanged', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'catalog-pages'); api.setAuthToken('catalog-test');
  const calls = [];
  global.fetch = async (url, init) => {
    const u = new URL(url, 'https://test.local'); calls.push({ url: u, init });
    if (u.pathname.endsWith('/countries')) return Response.json([{ id: 10, alpha2Code: 'RW', name: 'Rwanda' }]);
    if (u.pathname.endsWith('/payment-methods')) return Response.json([{ id: 1, name: 'MTN', countryId: 10 }]);
    const page = Number(u.searchParams.get('page'));
    return Response.json({ content: [{ id: page + 1, paymentMethodId: 1, paymentProviderName: page ? 'Provider B' : 'Provider A' }], totalPages: 2, totalElements: 2, size: 1 });
  };
  const result = await api.paymentMethodPaymentProviders.options(new URLSearchParams({ page: '0', size: '1', active: 'true' }));
  assert.equal(result.length, 2);
  assert.equal(result[1].__catalogEntity.name, 'MTN');
  assert.equal(result[1].__catalogCountries[0].alpha2Code, 'RW');
  const routes = calls.filter((call) => call.url.pathname.endsWith('/payment-method-payment-providers'));
  assert.deepEqual(routes.map((call) => call.url.searchParams.get('page')), ['0', '1']);
  assert.equal(routes.every((call) => call.url.searchParams.get('active') === 'true'), true);
  assert.equal(calls.every((call) => call.init.headers.Authorization === 'Bearer catalog-test' && call.init.cache === 'no-store'), true);
  const before = calls.length;
  await api.paymentMethods.list(new URLSearchParams({ page: '7', size: '20' }));
  assert.equal(calls.length, before + 1);
  assert.equal(calls.at(-1).url.searchParams.get('page'), '7');
});

test('bill route options retain inactive entries and every country of a product', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'catalog-bills');
  global.fetch = async (url) => {
    if (url.includes('/countries')) return Response.json([{ id: 1, alpha2Code: 'RW' }, { id: 2, alpha2Code: 'CD' }]);
    if (url.includes('/bill-product-bill-providers')) return Response.json([{ id: 55, billProductId: 3, billProviderName: 'Provider', active: false }]);
    return Response.json([{ id: 3, displayName: 'Canal Plus', countryIds: [1, 2] }]);
  };
  const [route] = await api.billProductBillProviders.options();
  assert.equal(route.id, 55); assert.equal(route.active, false);
  assert.equal(route.__catalogEntity.displayName, 'Canal Plus');
  assert.deepEqual(route.__catalogCountries.map((c) => c.id), [1, 2]);
});

test('catalog loaders stop on failed, repeated or stale pages without returning an incomplete selection list', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'catalog-failure'); api.setAuthToken('first');
  global.fetch = async (url) => url.includes('/countries') ? Response.json([]) : Response.json({ content: [{ id: 1 }], totalPages: 3 });
  await assert.rejects(api.paymentMethods.options(), /fully loaded/);
  global.fetch = async (url) => url.includes('/countries') ? Response.json([]) : Response.json({ message: 'Options unavailable' }, { status: 500 });
  await assert.rejects(api.paymentMethods.options(), /Options unavailable/);
  global.fetch = async (url) => { if (url.includes('/countries')) return Response.json([]); api.setAuthToken('second'); return Response.json([{ id: 1 }]); };
  await assert.rejects(api.paymentMethods.options(), /session changed/);
});

test('country search matches names in both languages, accents, alpha codes, IDs and Congo aliases', async () => {
  const { countryOptionDetails, filterCatalogOptions } = await helpers;
  const records = [{ id: 42, name: 'Congo', alpha2Code: 'CD', alpha3Code: 'COD' }, { id: 7, name: 'Côte d’Ivoire', alpha2Code: 'CI', alpha3Code: 'CIV' }, { id: 5, name: 'United States', alpha2Code: 'US' }];
  const entries = records.map((record) => ({ value: String(record.id), label: record.name, ...countryOptionDetails(record, { value: String(record.id) }, 'fr') }));
  for (const query of ['DRC', 'RDC', 'COD', '42', 'democratic congo', 'congo kinshasa']) assert.deepEqual(filterCatalogOptions(entries, query).map((row) => row.value), ['42']);
  assert.deepEqual(filterCatalogOptions(entries, 'cote ivoire').map((row) => row.value), ['7']);
  assert.deepEqual(filterCatalogOptions(entries, 'etats unis').map((row) => row.value), ['5']);
  assert.deepEqual(filterCatalogOptions(entries, 'USA').map((row) => row.value), ['5']);
});

async function countryPicker({ multiple = false, value = '', disabled = false, kind = 'country' } = {}) {
  const React = require('react');
  const catalog = await helpers;
  const { mountComponent } = require('./helpers/component-harness.cjs');
  const changes = [];
  const props = { portal: false, kind, multiple, value, disabled, records: [{ id: 42, name: 'DR Congo', alpha2Code: 'CD' }, { id: 7, name: 'Rwanda', alpha2Code: 'RW' }], children: [React.createElement('option', { key: '', value: '' }, 'Any country'), React.createElement('option', { key: 42, value: '42' }, 'DR Congo (CD)'), React.createElement('option', { key: 7, value: '7' }, 'Rwanda (RW)')] };
  props.onChange = (event) => { props.value = multiple ? Array.from(event.target.selectedOptions, (option) => option.value) : event.target.value; changes.push(props.value); };
  const view = await mountComponent(path.join(__dirname, '../components/CatalogSelect.js'), {
    exportName: 'CatalogSelect', props, modules: (hooks) => {
      hooks.useLayoutEffect = () => {}; // Layout is exercised in a browser; this test covers selection and keyboard behavior.
      return { '@/contexts/AuthContext': { useAuth: () => ({ enableRegulatorMode: false, adminProfileLoading: false }) }, '@/contexts/LocaleContext': { useLocale: () => ({ locale: 'en' }) }, '@/lib/catalog-options': catalog, '@/lib/regulator-presentation': { isRegulatorRestrictedRecord: () => false, isRegulatorRestrictedService: () => false } };
    }
  });
  const native = view.nodes().find((node) => node.type === 'select');
  const options = React.Children.toArray(native.props.children).map((option) => ({ value: option.props.value, selected: multiple ? value.includes(option.props.value) : String(value) === option.props.value }));
  native.ref.current = { options, get value() { return options.find((option) => option.selected)?.value || ''; }, get selectedOptions() { return options.filter((option) => option.selected); }, dispatchEvent() { native.props.onChange({ target: this, currentTarget: this }); } };
  const trigger = view.nodes().find((node) => node.type === 'button' && node.props.role === 'combobox');
  trigger.props.onClick(); await view.flush();
  return { view, changes, props, search: () => view.nodes().find((node) => node.type === 'input' && node.props.role === 'combobox')?.props };
}

test('searching and selecting a country retains exact IDs and native event behavior, with keyboard selection', async () => {
  const { view, search, changes } = await countryPicker();
  search().onChange({ target: { value: 'RDC' } }); await view.flush();
  assert.equal(view.nodes().filter((node) => node.props.role === 'option').length, 1);
  search().onKeyDown({ key: 'Enter', preventDefault() {} }); await view.flush();
  assert.deepEqual(changes, ['42']); // Search aliases must not replace a stored country ID with a country code.
  assert.ok(!view.nodes().some((node) => node.props.role === 'dialog'));
  const read = await countryPicker({ disabled: true }); assert.equal(read.search(), undefined);
});

test('country multi-selection keeps selected values that are outside the current search or missing from the catalog', async () => {
  const { view, search, changes } = await countryPicker({ multiple: true, value: ['42', '999'] });
  search().onChange({ target: { value: 'Rwanda' } }); await view.flush();
  view.nodes().find((node) => node.props.role === 'option').props.onClick(); await view.flush();
  assert.deepEqual(changes, [['42', '7', '999']]);
  assert.ok(view.nodes().some((node) => node.props.role === 'dialog'));
});

test('country directory search reaches countries outside the current page without another request or mutation', async () => {
  const { mountComponent } = require('./helpers/component-harness.cjs');
  const catalog = await helpers;
  const rows = [...Array.from({ length: 21 }, (_, index) => ({ id: index + 1, name: `Country ${index + 1}`, alpha2Code: 'RW' })), { id: 99, name: 'DR Congo', alpha2Code: 'CD', alpha3Code: 'COD' }];
  let loads = 0;
  const view = await mountComponent(path.join(__dirname, '../app/(dashboard)/dashboard/geo/countries/page.js'), {
    props: {}, modules: {
      '@/components/ResponsiveTable': { __esModule: true, default: 'responsive-table' }, '@/components/RegulatorPresentation': { NonRegulatorContent: 'div', PresentationLink: 'a' }, '@/lib/regulator-presentation': { regulatorVisibleFields: (fields) => fields },
      '@/contexts/AuthContext': { useAuth: () => ({}) }, '@/lib/api': { api: { countries: { options: async () => { loads++; return rows; } } } }, '@/components/DataTable': { DataTable: 'table' }, '@/lib/catalog-options': catalog
    }
  });
  await view.flush();
  const table = () => view.nodes().find((node) => node.type === 'table').props;
  assert.equal(table().rows.length, 20); assert.equal(table().totalElements, 22);
  view.nodes().find((node) => node.props.id === 'countrySearch').props.onChange({ target: { value: 'RDC' } }); await view.flush();
  assert.deepEqual(table().rows, [rows[21]]); assert.equal(table().page, 0); assert.equal(table().totalElements, 1);
  assert.equal(loads, 1);
  view.unmount();
});
