const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const { mountComponent } = require('./helpers/component-harness.cjs');
const root = path.join(__dirname, '..');
const load = (file, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(root, file), 'utf8')).toString('base64')}#${tag}`);
const file = path.join(root, 'app/(dashboard)/dashboard/crypto/provider-wallets/page.js');
const walk = (node) => Array.isArray(node) ? node.flatMap(walk) : node?.props ? [node, ...walk(node.props.children)] : [];
const table = (view) => view.nodes().find((node) => node.type === 'data-table').props;
const row = { id: 7, version: 4, providerName: 'BITCART', productNetworkId: 5, symbol: 'BTC', network: 'BTC', walletId: 'original-wallet', storeId: 'original-store', providerCoin: 'btc', providerSymbol: null, tokenContract: '', chainNetwork: 'regtest', minimumConfirmations: 2, active: true };
async function mount(role = 'SUPER_ADMIN', update = async () => {}, config = {}) {
  const writes = [], reads = [];
  const view = await mountComponent(file, { props: {}, modules: {
    '@/lib/api': { api: { cryptoProviderWalletConfigs: { list: config.list || (async () => ({ content: [row], page: { totalPages: 1, totalElements: 1 } })),
      get: async (id) => { reads.push(id); return config.get ? config.get(id) : structuredClone(row); }, create: async (body) => { writes.push({ body }); return config.create?.(body); }, update: async (id, body) => { writes.push({ id, body }); return update(); } },
      cryptoProductCryptoNetworks: { options: config.options || (async () => [{ id: 5, cryptoProductName: 'Bitcoin', cryptoNetworkName: 'BTC', active: false }]) } } },
    '@/lib/crypto-provider-wallets': await load('lib/crypto-provider-wallets.js'),
    '@/contexts/AuthContext': { useAuth: () => ({ session: { tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } } }) },
    'next/link': { __esModule: true, default: 'a' }, '@/components/DataTable': { DataTable: 'data-table' }
  } });
  await view.flush(); return { view, writes, reads };
}
async function edit(view) {
  walk(table(view).columns.find((c) => c.key === 'actions').render(row)).find((n) => n.type === 'button' && n.props.children === 'Edit').props.onClick();
  await view.flush();
}
function change(view, id, value) {
  view.nodes().find((n) => n.props.id === id).props.onChange({ target: { value, checked: value } });
}
async function submit(view) { await view.nodes().find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} }); await view.flush(); }

test('opening the collection page only reads mappings and catalogues', async (t) => {
  const { view, writes } = await mount(); t.after(() => view.unmount());
  assert.equal(writes.length, 0); assert.equal(table(view).rows[0].walletId, 'original-wallet');
  assert.match(view.text(), /Pending invoices keep their original destination/);
});
test('an admin can read but cannot edit collection destinations', async (t) => {
  const { view, writes } = await mount('ADMIN'); t.after(() => view.unmount());
  assert.ok(!walk(table(view).columns.find((c) => c.key === 'actions').render(row)).some((node) => node.props.children === 'Edit'));
  walk(table(view).columns.find((c) => c.key === 'actions').render(row)).find((node) => node.type === 'button').props.onClick(); await view.flush();
  assert.match(view.text(), /original-wallet/); assert.match(view.text(), /Minimum confirmations/);
  assert.ok(!view.nodes().some((n) => n.type === 'form'));
  assert.ok(!view.nodes().some((n) => n.type === 'button' && n.props.children === 'Add collection wallet'));
  assert.equal(writes.length, 0);
});
test('editing sends the selected wallet, store, version and disabled state without extra financial fields', async (t) => {
  const { view, writes } = await mount(); t.after(() => view.unmount()); await edit(view);
  assert.equal(view.nodes().find((n) => n.props.id === 'productNetworkId').props.disabled, true);
  change(view, 'walletId', ' replacement-wallet '); change(view, 'storeId', 'replacement-store'); change(view, 'active', false);
  await view.flush(); await submit(view);
  assert.deepEqual(writes, [{ id: 7, body: { providerName: 'BITCART', productNetworkId: 5, walletId: 'replacement-wallet', storeId: 'replacement-store', providerCoin: 'btc', providerSymbol: null, tokenContract: '', chainNetwork: 'regtest', minimumConfirmations: 2, active: false, version: 4 } }]);
});
test('a conflict keeps unsaved edits visible and never retries or removes the mapping', async (t) => {
  const { view, writes } = await mount('SUPER_ADMIN', async () => { throw new Error('Reload before saving'); }); t.after(() => view.unmount());
  await edit(view); change(view, 'walletId', 'unsaved-wallet'); await view.flush(); await submit(view);
  assert.match(view.text(), /Reload before saving/); assert.equal(writes.length, 1);
  assert.equal(view.nodes().find((n) => n.props.id === 'walletId').props.value, 'unsaved-wallet');
});
test('new mappings start disabled and cancellation performs no write', async (t) => {
  const { view, writes } = await mount(); t.after(() => view.unmount()); await view.click('Add collection wallet');
  assert.equal(view.nodes().find((n) => n.props.id === 'active').props.checked, false);
  await view.click('Cancel'); assert.equal(writes.length, 0);
});
test('crypto hub links to merchant collection wallets separately from customer wallets', () => {
  const hub = readFileSync(path.join(root, 'app/(dashboard)/dashboard/crypto/page.js'), 'utf8');
  assert.match(hub, /\/dashboard\/crypto\/provider-wallets/); assert.match(hub, /\/dashboard\/crypto\/wallets/);
});

test('editing reads the latest version and keeps provider/pair identity fixed', async (t) => {
  const current = { ...row, version: 9, walletId: 'current-wallet', active: false };
  const { view, writes, reads } = await mount('SUPER_ADMIN', undefined, { get: async () => current }); t.after(() => view.unmount());
  await edit(view); assert.deepEqual(reads, [7]);
  assert.equal(view.nodes().find((node) => node.props.id === 'walletId').props.value, 'current-wallet');
  await submit(view); assert.equal(writes[0].body.version, 9); assert.equal(writes[0].body.providerName, 'BITCART'); assert.equal(writes[0].body.productNetworkId, 5); assert.equal(writes[0].body.active, false);
});

test('two submissions before a render issue one configuration write', async (t) => {
  let finish;
  const { view, writes } = await mount('SUPER_ADMIN', () => new Promise((resolve) => { finish = resolve; })); t.after(() => view.unmount());
  await edit(view);
  const handler = view.nodes().find((node) => node.type === 'form').props.onSubmit;
  const first = handler({ preventDefault() {} }), second = handler({ preventDefault() {} });
  await view.flush(); assert.equal(writes.length, 1); assert.equal(view.nodes().find((node) => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  finish(); await Promise.all([first, second]); await view.flush(); assert.equal(writes.length, 1);
});

for (const status of [409, 503, undefined]) test(`${status || 'network failure'} preserves the draft and requires a deliberate reload before another save`, async (t) => {
  let current = { ...row };
  const { view, writes, reads } = await mount('SUPER_ADMIN', async () => { current = { ...row, version: 5, walletId: 'saved-elsewhere' }; throw Object.assign(new Error('Refresh the saved collection wallet'), { status }); }, { get: async () => current }); t.after(() => view.unmount());
  await edit(view); change(view, 'walletId', 'my-unsaved-wallet'); await view.flush(); await submit(view);
  assert.equal(view.nodes().find((node) => node.props.id === 'walletId').props.value, 'my-unsaved-wallet');
  assert.equal(view.nodes().find((node) => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  await submit(view); assert.equal(writes.length, 1); assert.equal(reads.length, 1);
  await view.click('Discard draft and reload');
  assert.equal(reads.length, 2); assert.equal(writes.length, 1);
  assert.equal(view.nodes().find((node) => node.props.id === 'walletId').props.value, 'saved-elsewhere');
  assert.equal(view.nodes().find((node) => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
});

test('server validation preserves inputs and leaves correction available', async (t) => {
  const { view, writes } = await mount('SUPER_ADMIN', async () => { throw Object.assign(new Error('Use the deployment chain network'), { status: 400 }); }); t.after(() => view.unmount());
  await edit(view); change(view, 'chainNetwork', 'mainnet'); await view.flush(); await submit(view);
  assert.equal(writes.length, 1); assert.match(view.text(), /Use the deployment chain network/);
  assert.equal(view.nodes().find((node) => node.props.id === 'chainNetwork').props.value, 'mainnet');
  assert.equal(view.nodes().find((node) => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
});

test('create keeps inactive pairs selectable, accepts a provider alias, and does not send an update version', async (t) => {
  const { view, writes } = await mount('SUPER_ADMIN', undefined, { options: async () => [{ id: 53, cryptoProductName: 'POL', cryptoNetworkName: 'POLYGON', active: false }] }); t.after(() => view.unmount());
  await view.click('Add collection wallet');
  assert.ok(view.nodes().some((node) => node.type === 'option' && node.props.value === 53 && !node.props.disabled));
  for (const [key, value] of Object.entries({ productNetworkId: '53', walletId: 'wallet-pol', storeId: 'store-pol', providerCoin: 'eth', providerSymbol: 'MATIC', tokenContract: '0x123abc', chainNetwork: 'mainnet' })) change(view, key, value);
  await view.flush(); await submit(view);
  assert.equal(writes.length, 1); assert.equal(writes[0].body.active, false); assert.equal(writes[0].body.productNetworkId, 53); assert.equal(writes[0].body.providerSymbol, 'MATIC'); assert.equal(Object.hasOwn(writes[0].body, 'version'), false);
});

test('payload validation rejects missing identities, URLs, overlong fields and fractional confirmations before a write', async () => {
  const h = await load('lib/crypto-provider-wallets.js');
  for (const change of [{ productNetworkId: '' }, { productNetworkId: -1 }, { walletId: 'https://server.local/wallet' }, { storeId: ' ' }, { tokenContract: 'not a contract' }, { minimumConfirmations: 0 }, { minimumConfirmations: 1.5 }, { version: undefined }, { providerCoin: 'x'.repeat(33) }]) assert.throws(() => h.collectionWalletPayload({ ...row, ...change }));
  const payload = h.collectionWalletPayload({ ...row, providerSymbol: ' ', tokenContract: null, active: false });
  assert.equal(payload.providerSymbol, null); assert.equal(payload.tokenContract, ''); assert.equal(payload.active, false);
});

test('a missing endpoint is shown as unavailable rather than an empty mapping list', async (t) => {
  const { view, writes } = await mount('ADMIN', undefined, { list: async () => { throw Object.assign(new Error('Not found'), { status: 404 }); } }); t.after(() => view.unmount());
  assert.match(view.text(), /unavailable on this backend/); assert.ok(!view.nodes().some((node) => node.type === 'data-table')); assert.equal(writes.length, 0);
});

test('a late page response cannot replace a newer page', async (t) => {
  const pending = {};
  const { view } = await mount('ADMIN', undefined, { list: async (query) => {
    const page = Number(query.get('page'));
    return page === 0 ? { content: [row], page: { totalPages: 3, totalElements: 45 } } : new Promise((resolve) => { pending[page] = resolve; });
  } }); t.after(() => view.unmount());
  table(view).onPageChange(1); await view.flush(); table(view).onPageChange(2); await view.flush();
  pending[2]({ content: [{ ...row, id: 22 }], page: { totalPages: 3, totalElements: 45 } }); await view.flush();
  pending[1]({ content: [{ ...row, id: 11 }], page: { totalPages: 3, totalElements: 45 } }); await view.flush();
  assert.equal(table(view).page, 2); assert.equal(table(view).rows[0].id, 22); assert.equal(table(view).totalElements, 45);
});

test('collection wallet API uses only the authenticated config routes and exposes no delete helper', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'collection-wallet-api'); api.setAuthToken('wallet-admin');
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(row); };
  await api.cryptoProviderWalletConfigs.list(new URLSearchParams({ page: '2', size: '20' })); await api.cryptoProviderWalletConfigs.get(7);
  const body = (await load('lib/crypto-provider-wallets.js')).collectionWalletPayload(row);
  await api.cryptoProviderWalletConfigs.create({ ...body, version: undefined }); await api.cryptoProviderWalletConfigs.update(7, body);
  assert.ok(calls.every(({ url, init }) => url.includes('/admin-api/crypto-provider-wallet-configs') && init.headers.Authorization === 'Bearer wallet-admin' && init.cache === 'no-store'));
  assert.ok(calls[0].url.endsWith('?page=2&size=20')); assert.equal(calls[2].init.method, 'POST'); assert.equal(calls[3].init.method, 'PUT');
  assert.equal(api.cryptoProviderWalletConfigs.remove, undefined);
  const spec = JSON.parse(readFileSync(path.join(root, 'docs/admin-openapi.json'), 'utf8'));
  assert.deepEqual(Object.keys(spec.paths['/admin-api/crypto-provider-wallet-configs/{id}']), ['get', 'put']);
  const operations = JSON.parse(readFileSync(path.join(root, 'docs/admin-openapi-ops.json'), 'utf8')).domains.find((domain) => domain.tag === 'AdminCryptoProviderWalletConfigController').operations;
  assert.equal(operations.length, 4); assert.ok(operations.every((operation) => operation.method !== 'DELETE'));
});
