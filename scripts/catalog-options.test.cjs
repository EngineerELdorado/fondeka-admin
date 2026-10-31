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
