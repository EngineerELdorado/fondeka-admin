const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mountComponent, compileComponent } = require('./helpers/component-harness.cjs');
const root = path.join(__dirname, '..');
const load = (file, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(root, file), 'utf8')).toString('base64')}#${tag}`);
const catalog = load('lib/crypto-catalog.js');
const pageFile = (route) => path.join(root, 'app/(dashboard)/dashboard', route, 'page.js');
const walk = (node) => Array.isArray(node) ? node.flatMap(walk) : node?.props ? [node, ...walk(node.props.children)] : [];
const control = (view, id) => view.nodes().find((node) => node.props.id === id).props;
const table = (view) => view.nodes().find((node) => node.type === 'data-table').props;
async function rowAction(view, row, label) {
  walk(table(view).columns.find((column) => column.key === 'actions').render(row)).find((node) => node.type === 'button' && node.props.children === label).props.onClick();
  await view.flush();
}
async function mountPage(route, api, extra = {}) {
  const h = await catalog;
  const hookFactory = await compileComponent(path.join(root, 'lib/use-catalog-codes.js'));
  const view = await mountComponent(pageFile(route), { props: {}, modules: (hooks) => ({
    '@/lib/api': { api }, '@/lib/crypto-catalog': h,
    '@/lib/use-catalog-codes': hookFactory(hooks, { '@/lib/api': { api }, '@/lib/crypto-catalog': h }),
    'next/link': { __esModule: true, default: 'a' }, '@/components/RegulatorPresentation': { PresentationLink: 'a', NonRegulatorContent: 'section', PresentationSelect: 'select', RegulatorField: 'div' },
    '@/components/DataTable': { DataTable: 'data-table' }, '@/components/CatalogSelect': { CatalogSelect: 'catalog-select' },
    '@/lib/payment-method-labels': { paymentMethodAdminLabel: (row) => row.name || row.paymentMethodName },
    '@/contexts/ToastContext': { useToast: () => ({ pushToast() {} }) }, ...extra
  }) });
  await view.flush(); return view;
}

test('shared catalogue includes all assets/networks, preserves unknown codes and keeps legacy networks distinct', async () => {
  const h = await catalog;
  for (const code of ['BCH', 'XMR', 'LTC', 'POL', 'TRX', 'XRG', 'GRS', 'ONEINCH', 'AAVE', 'LINK', 'DAI', 'SHIB', 'BABYDOGE', 'XAUT', 'XPUMP']) assert.ok(h.CRYPTO_ASSETS.includes(code));
  assert.equal(new Set(h.CRYPTO_ASSETS).size, h.CRYPTO_ASSETS.length);
  for (const code of ['LIGHTNING', 'BCH', 'XMR', 'LTC', 'XRG', 'GRS', 'BEP20', 'BSC']) assert.ok(h.CRYPTO_NETWORKS.includes(code));
  assert.ok(!h.CRYPTO_ASSETS.includes('MATIC'));
  assert.deepEqual(h.mergeCatalogCodes(['BTC'], ['FUTURE', 'BTC'], [null, ['SELECTED']]), ['BTC', 'FUTURE', 'SELECTED']);
  assert.equal(h.withSelectedRecord([{ id: 1 }], '1').length, 1);
  assert.equal(h.withSelectedRecord([], 99, 'Future network')[0].id, 99);
});

test('all crypto/provider lookups traverse Spring pages without filtering inactive records or writing', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'crypto-pagination'); api.setAuthToken('catalogue-admin');
  const calls = [];
  global.fetch = async (url, init) => {
    const query = new URL(url, 'https://test.local'); calls.push({ query, init });
    const page = Number(query.searchParams.get('page'));
    return Response.json({ content: [{ id: page + 1, active: false, currency: page ? 'FUTURE' : 'POL' }], page: { number: page, size: 1, totalPages: 2, totalElements: 2 } });
  };
  for (const key of ['cryptoProducts', 'cryptoNetworks', 'cryptoProductCryptoNetworks', 'paymentMethodCryptoNetworks', 'paymentProviders', 'currencyProducts']) {
    const rows = await api[key].options(); assert.equal(rows.length, 2); assert.equal(rows[1].active, false);
  }
  assert.equal(calls.length, 12);
  assert.ok(calls.every(({ query, init }) => !query.searchParams.has('active') && !init.method && init.cache === 'no-store' && init.headers.Authorization === 'Bearer catalogue-admin'));
  global.fetch = async () => Response.json([{ id: 200, name: 'BSC', active: false }]);
  assert.equal((await api.cryptoNetworks.options())[0].name, 'BSC');
});

test('editing an unpriced inactive asset round-trips human percentages and sends required fields without enabling gates', async (t) => {
  const row = { id: 76, currency: 'POL', displayName: 'Polygon', rate: 0, ask: 0.02, bid: 0.015, active: false }, writes = [];
  const view = await mountPage('crypto/products', { cryptoProducts: { list: async () => ({ content: [row] }), update: async (id, body) => writes.push({ id, body }) }, featureFlags: { get: async () => true } }); t.after(() => view.unmount());
  assert.equal(writes.length, 0); assert.equal(table(view).columns.find((column) => column.key === 'rate').render(row), 'Unpriced');
  await rowAction(view, row, 'Edit');
  assert.equal(control(view, 'ask').value, 2); assert.equal(control(view, 'bid').value, 1.5); assert.equal(control(view, 'active').checked, false);
  await view.click('Save');
  assert.deepEqual(writes, [{ id: 76, body: { currency: 'POL', displayName: 'Polygon', rate: 0, ask: 2, bid: 1.5, active: false } }]);
});

test('network edit preserves disabled activation and invoice creation independently', async (t) => {
  const row = { id: 79, name: 'XMR', displayName: 'Monero', active: false, invoiceCreationEnabled: false }, writes = [];
  const view = await mountPage('crypto/networks', { cryptoNetworks: { list: async () => [row], update: async (id, body) => writes.push(body) } }); t.after(() => view.unmount());
  assert.equal(writes.length, 0); await rowAction(view, row, 'Edit'); await view.click('Save');
  assert.deepEqual(writes, [{ name: 'XMR', displayName: 'Monero', active: false, invoiceCreationEnabled: false }]);
});

test('product mappings retain zero limits, nulls, rank, inactive state and a selected missing network', async (t) => {
  const row = { id: 15, cryptoProductId: 7, cryptoProductName: 'POL', cryptoNetworkId: 900, cryptoNetworkName: 'FUTURE', rank: 0, displayName: 'Polygon', dailyBuyLimitUsd: 0, dailySellLimitUsd: null, dailySendLimitUsd: 12, dailyReceiveLimitUsd: 0, dailySwapLimitUsd: 0, active: false }, writes = [];
  const view = await mountPage('crypto/product-networks', {
    cryptoProductCryptoNetworks: { list: async () => [row], update: async (id, body) => writes.push(body) },
    cryptoProducts: { options: async () => [{ id: 7, currency: 'POL', active: false }] }, cryptoNetworks: { options: async () => [{ id: 8, name: 'POLYGON', active: false }] }
  }); t.after(() => view.unmount());
  await rowAction(view, row, 'Edit');
  assert.ok(walk(control(view, 'cryptoNetworkId').children).some((node) => node.props.value === 900));
  await view.click('Save');
  assert.deepEqual(writes[0], { cryptoProductId: 7, cryptoNetworkId: 900, rank: 0, displayName: 'Polygon', dailyBuyLimitUsd: 0, dailySellLimitUsd: null, dailySendLimitUsd: 12, dailyReceiveLimitUsd: 0, dailySwapLimitUsd: 0, active: false });
});

for (const route of ['crypto/payment-method-networks', 'payments/method-crypto-networks']) test(`${route} uses inactive network lookups and retains the mapping's full PUT`, async (t) => {
  const row = { id: 4, paymentMethodId: 55, paymentMethodName: 'LTC', cryptoNetworkId: 97, cryptoNetworkName: 'LTC', rank: 0, active: false }, writes = [];
  const view = await mountPage(route, {
    paymentMethodCryptoNetworks: { list: async () => [row], update: async (id, body) => writes.push(body) },
    paymentMethods: { options: async () => [{ id: 55, name: 'LTC', active: false }] }, cryptoNetworks: { options: async () => [{ id: 97, name: 'LTC', active: false }] }
  }); t.after(() => view.unmount());
  await rowAction(view, row, 'Edit'); assert.equal(control(view, 'cryptoNetworkId').value, 97);
  await view.click('Save'); assert.deepEqual(writes[0], { paymentMethodId: 55, cryptoNetworkId: 97, rank: 0, active: false });
});

test('an enabled catalogue mapping stays enabled when its product/network lookups have independent disabled flags', async (t) => {
  const row = { id: 80, cryptoProductId: 40, cryptoProductName: 'TRX', cryptoNetworkId: 60, cryptoNetworkName: 'TRC20', rank: 3, active: true, dailyBuyLimitUsd: 0 }, writes = [];
  const view = await mountPage('crypto/product-networks', {
    cryptoProductCryptoNetworks: { list: async () => [row], update: async (id, body) => writes.push(body) },
    cryptoProducts: { options: async () => [{ id: 40, currency: 'TRX', active: false }] }, cryptoNetworks: { options: async () => [{ id: 60, name: 'TRC20', active: false, invoiceCreationEnabled: false }] }
  }); t.after(() => view.unmount());
  assert.equal(writes.length, 0); await rowAction(view, row, 'Edit'); assert.equal(control(view, 'active').checked, true);
  await view.click('Save'); assert.equal(writes[0].active, true); assert.equal(writes[0].rank, 3); assert.equal(writes[0].dailyBuyLimitUsd, 0);
});

test('quotes merge backend assets with fallback codes, accept custom codes and expose unavailable-price errors', async (t) => {
  const requests = [];
  const view = await mountPage('crypto/quotes', {
    cryptoProducts: { options: async () => [{ id: 12, currency: 'FUTURE', active: false }] }, currencyProducts: { options: async () => [{ currency: 'USD', active: true }] },
    cryptoQuotes: { quote: async (body) => { requests.push(body); throw new Error('Reference price unavailable'); } }
  }); t.after(() => view.unmount());
  assert.equal(requests.length, 0);
  const options = () => walk(control(view, 'toCurrency').children).map((node) => node.props.value);
  for (const code of ['POL', 'XMR', 'GRS', 'FUTURE']) assert.ok(options().includes(code));
  control(view, 'toCurrency').onChange({ target: { value: 'POL' } }); await view.flush(); await view.click('Get quote');
  assert.deepEqual(requests[0], { fromCurrency: 'USD', toCurrency: 'POL', amount: '100.00' }); assert.match(view.text(), /Reference price unavailable/);
  control(view, 'toCurrency').onChange({ target: { value: 'OTHER' } }); await view.flush();
  view.nodes().find((node) => node.props['aria-label'] === 'To currency (custom)').props.onChange({ target: { value: 'NEW' } }); await view.flush(); await view.click('Get quote'); assert.equal(requests[1].toCurrency, 'NEW');
});

test('payment-method editing keeps seeded currency null, all required fields and independent disabled flags', async (t) => {
  const row = { id: 72, name: 'XRG', displayName: 'XRG', logoUrl: 'https://test.local/xrg.png', type: 'CRYPTO', active: false, allowingCollection: false, allowingPayout: false, currency: null, rank: 0 }, writes = [];
  const view = await mountPage('payments/payment-methods', {
    paymentMethods: { list: async () => [row], options: async () => [row, { id: 90, name: 'FUTURE', active: false }], update: async (id, body) => writes.push(body) },
    countries: { list: async () => [] }, featureFlags: { get: async () => true }
  }, { '@/components/CountrySelect': { CountrySelect: 'country-select' }, '@/contexts/AuthContext': { useAuth: () => ({}) }, '@/lib/regulator-presentation': { regulatorVisibleFields: (rows) => rows, isRegulatorRestrictedRecord: () => false } }); t.after(() => view.unmount());
  assert.equal(writes.length, 0); await rowAction(view, row, 'Edit');
  assert.ok(view.nodes().some((node) => node.type === 'option' && node.props.value === 'FUTURE'));
  await view.click('Save');
  assert.equal(writes[0].name, 'XRG'); assert.equal(writes[0].displayName, 'XRG'); assert.equal(writes[0].logoUrl, row.logoUrl); assert.equal(writes[0].type, 'CRYPTO');
  assert.equal(writes[0].currency, null); assert.equal(writes[0].active, false); assert.equal(writes[0].allowingCollection, false); assert.equal(writes[0].allowingPayout, false);
  await view.click('Add method');
  for (const key of ['active', 'allowingCollection', 'allowingPayout']) assert.equal(view.nodes().find((node) => node.props.field?.key === key).props.field.value, false);
});

test('method-rule suggestions include backend and selected unknown names without changing include/exclude or unrestricted semantics', async (t) => {
  const originalWindow = global.window; global.window = { confirm: () => true }; t.after(() => { global.window = originalWindow; });
  const rows = [
    { id: 1, accountId: null, action: 'FUND_WALLET', includeNames: ['SELECTED_FUTURE'], excludeNames: ['BCH'], active: false, rank: 0 },
    { id: 2, accountId: null, action: 'FUND_WALLET', includeNames: null, excludeNames: null, active: false, rank: 1 }
  ], writes = [];
  const view = await mountPage('payments/payment-method-action-configs', {
    paymentMethods: { options: async () => [{ id: 20, name: 'BACKEND_FUTURE', active: false }] },
    paymentMethodActionConfigs: { list: async () => rows, update: async (id, body) => writes.push(body) }, accounts: { list: async () => [] }
  }, { '@/contexts/AuthContext': { useAuth: () => ({}) }, '@/lib/regulator-presentation': { regulatorVisibleFields: (rows) => rows, isRegulatorRestrictedRecord: () => false } }); t.after(() => view.unmount());
  await rowAction(view, rows[0], 'Edit');
  const selector = view.nodes().find((node) => node.props.values === undefined ? false : node.props.values.includes('SELECTED_FUTURE'));
  assert.ok(selector.props.options.includes('BACKEND_FUTURE')); assert.ok(selector.props.options.includes('POL')); assert.ok(selector.props.options.includes('SELECTED_FUTURE'));
  await view.click('Save changes'); assert.deepEqual(writes[0].includeNames, ['SELECTED_FUTURE']); assert.deepEqual(writes[0].excludeNames, ['BCH']); assert.equal(writes[0].active, false);
  await rowAction(view, rows[1], 'Edit'); await view.click('Save changes'); assert.equal(writes[1].includeNames, null); assert.equal(writes[1].excludeNames, null);
});

test('Bitcart webhook viewing links to its outbox and keeps legacy synchronous retry disabled', async (t) => {
  const row = { id: 32, provider: 'BITCART', eventType: 'INVOICE_RECHECK', processedAt: null };
  const view = await mountPage('webhook-events', { webhookEvents: { list: async () => [row] } }); t.after(() => view.unmount());
  const actions = walk(table(view).columns.find((column) => column.key === 'actions').render(row));
  assert.equal(actions.find((node) => node.type === 'button' && node.props.children === 'Retry').props.disabled, true);
  assert.equal(actions.find((node) => node.type === 'a').props.href, '/dashboard/outbox?outboxType=webhooks&provider=BITCART&handlerKey=BITCART');
});

test('Bitcart outbox link loads the correct queue and retry only calls the outbox API', async (t) => {
  const originalWindow = global.window; global.window = { location: { search: '?outboxType=webhooks&provider=BITCART&handlerKey=BITCART' } }; t.after(() => { global.window = originalWindow; });
  const calls = [], row = { id: 4, provider: 'BITCART', handlerKey: 'BITCART', status: 'FAILED', retries: 2 };
  const view = await mountPage('outbox', { outbox: { webhooks: { list: async (query) => { calls.push(['list', query.toString()]); return [row]; }, retry: async (id) => { calls.push(['retry', id]); return { ...row, status: 'PENDING' }; } } } }); t.after(() => view.unmount());
  assert.match(calls[0][1], /provider=BITCART/); assert.match(calls[0][1], /handlerKey=BITCART/);
  await rowAction(view, row, 'Retry'); await view.click('Retry');
  assert.deepEqual(calls.filter(([type]) => type === 'retry'), [['retry', 4]]);
  assert.match(view.text(), /does not confirm payment completion/);
});

test('outbox full-payload reads and progress polling are sequential, pause while hidden and stop at a terminal state', async (t) => {
  const original = { window: global.window, document: global.document, setTimeout: global.setTimeout, clearTimeout: global.clearTimeout };
  const timers = new Map(); let nextTimer = 0;
  global.window = { location: { search: '?outboxType=webhooks&provider=BITCART&handlerKey=BITCART' } }; global.document = { hidden: false };
  global.setTimeout = (callback) => { const id = ++nextTimer; timers.set(id, callback); return id; }; global.clearTimeout = (id) => timers.delete(id);
  t.after(() => { Object.assign(global, original); });
  const row = { id: 10, provider: 'BITCART', handlerKey: 'BITCART', eventType: 'INVOICE_RECHECK', payload: 'truncated', payloadTruncated: true, status: 'PENDING' };
  let reads = 0, pending;
  const view = await mountPage('outbox', { outbox: { webhooks: {
    list: async () => [row], get: async () => { reads += 1; if (reads === 1) return { ...row, payload: 'full invoice reference', payloadTruncated: false, transactionId: 42 }; return new Promise((resolve) => { pending = resolve; }); }
  } } }); t.after(() => view.unmount());
  const payloadColumn = table(view).columns.find((column) => column.key === 'payload');
  walk(payloadColumn.render(row)).find((node) => node.type === 'button').props.onClick(); await view.flush();
  assert.equal(reads, 1); assert.match(view.text(), /full invoice reference/);
  assert.ok(view.nodes().some((node) => node.props.href === '/dashboard/transactions?transactionId=42'));
  const tick = () => { const [id, callback] = timers.entries().next().value; timers.delete(id); return callback(); };
  global.document.hidden = true; await tick(); assert.equal(reads, 1);
  global.document.hidden = false; const inFlight = tick(); await view.flush(); assert.equal(reads, 2); assert.equal(timers.size, 0);
  pending({ ...row, status: 'PROCESSED', processedAt: '2026-11-20T10:00:00Z' }); await inFlight; await view.flush(); assert.equal(timers.size, 0);
});

test('refreshed admin schemas match shared enums and retain the distinct provider namespaces', async () => {
  const h = await catalog, spec = JSON.parse(readFileSync(path.join(root, 'docs/admin-openapi.json'), 'utf8'));
  assert.deepEqual(spec.components.schemas.CryptoProductRequest.properties.currency.enum, h.CRYPTO_ASSETS);
  assert.deepEqual(spec.components.schemas.CryptoNetworkRequest.properties.name.enum, h.CRYPTO_NETWORKS);
  const providers = spec.components.schemas.PaymentProviderRequest.properties.name.enum;
  assert.ok(providers.includes('BITCART')); assert.ok(providers.includes('BTCPAY_SERVER')); assert.ok(!providers.includes('BTCPAYSERVER'));
});
