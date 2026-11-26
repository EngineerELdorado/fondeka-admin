const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const component = path.join(__dirname, '../components/cards/ActiveCardCsvExport.js');
const csv = 'card_id,cardholder_id\r\n"provider-card","provider-holder"\r\n';

async function setup(t, { role = 'ADMIN', regulator = false, read } = {}) {
  const auth = { enableRegulatorMode: regulator, session: { tokens: { accessToken: { payload: { sub: 'admin-1', 'cognito:groups': [role] } } } } };
  const state = { requests: [], downloads: [], blobs: [], removed: 0 };
  const originalDocument = global.document, originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  global.document = { body: { appendChild() {} }, createElement: () => ({ click() { state.downloads.push(this.download); }, remove() { state.removed++; } }) };
  URL.createObjectURL = blob => { state.blobs.push(blob); return 'blob:card-export'; };
  URL.revokeObjectURL = () => {};
  const api = { cards: { exportActiveCsv: async (scope, options) => {
    state.requests.push({ scope, options }); return read ? read(scope, options) : csv;
  } } };
  const view = await mountComponent(component, { modules: { '@/contexts/AuthContext': { useAuth: () => auth }, '@/lib/api': { api } } });
  t.after(() => { view.unmount(); global.document = originalDocument; URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; });
  return { view, auth, state };
}

test('downloads every-card backend CSV using the reviewed migration scope, never visible rows', async t => {
  const { view, state } = await setup(t);
  await view.click('Export CSV');
  assert.equal(state.requests.length, 0);
  await view.click('Download CSV');
  assert.equal(state.requests[0].scope, 'LEGACY_BRIDGECARD');
  assert.match(state.downloads[0], /^active-legacy-bridgecard-cards-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.equal(await state.blobs[0].text(), csv);
  assert.equal(state.removed, 1);
});

test('explicit all-provider selection is sent to the backend', async t => {
  const { view, state } = await setup(t);
  await view.click('Export CSV');
  view.nodes().find(node => node.type === 'select').props.onChange({ target: { value: 'ALL' } });
  await view.flush(); await view.click('Download CSV');
  assert.equal(state.requests[0].scope, 'ALL');
  assert.match(state.downloads[0], /^active-cards-/);
});

test('duplicate clicks make one read and inputs stay disabled until it finishes', async t => {
  let finish;
  const { view, state } = await setup(t, { read: () => new Promise(resolve => { finish = resolve; }) });
  await view.click('Export CSV');
  const click = view.button('Download CSV').onClick;
  click(); click(); await view.flush();
  assert.equal(state.requests.length, 1);
  assert.equal(view.button('Exporting…').disabled, true);
  assert.equal(view.nodes().find(node => node.type === 'select').props.disabled, true);
  finish(csv); await view.flush(); assert.equal(state.downloads.length, 1);
});

test('an incomplete export error or non-CSV response stays visible without a download', async t => {
  for (const read of [async () => { throw new Error('Missing provider IDs'); }, async () => '<html>Error</html>']) {
    const { view, state } = await setup(t, { read });
    await view.click('Export CSV'); await view.click('Download CSV');
    assert.equal(state.downloads.length, 0);
    assert.ok(view.nodes().some(node => node.props.role === 'alert'));
    assert.equal(view.button('Download CSV').disabled, false);
    view.unmount();
  }
});

test('read-only roles and regulator presentation cannot export', async t => {
  for (const options of [{ role: 'ASSISTANT' }, { role: 'STAFF' }, { role: 'CUSTOMER' }, { regulator: true }]) {
    const { view, state } = await setup(t, options);
    assert.equal(view.nodes().length, 0); assert.equal(state.requests.length, 0);
  }
});

test('account changes abort an in-flight read and discard its late file', async t => {
  let finish;
  const { view, auth, state } = await setup(t, { read: () => new Promise(resolve => { finish = resolve; }) });
  await view.click('Export CSV'); view.button('Download CSV').onClick(); await view.flush();
  auth.session.tokens.accessToken.payload.sub = 'admin-2'; await view.flush();
  assert.equal(state.requests[0].options.signal.aborted, true);
  finish(csv); await view.flush(); assert.equal(state.downloads.length, 0);
});

test('CSV read uses authenticated no-store admin GET and no provider or payment endpoint', { concurrency: false }, async () => {
  const original = global.fetch, requests = [];
  global.fetch = async (url, options) => { requests.push({ url, options }); return new Response(csv, { headers: { 'content-type': 'text/csv;charset=UTF-8' } }); };
  try {
    const source = fs.readFileSync(path.join(__dirname, '../lib/api.js'), 'utf8');
    const { api } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    api.setAuthToken('admin-fixture');
    assert.equal(await api.cards.exportActiveCsv('LEGACY_BRIDGECARD'), csv);
    assert.match(requests[0].url, /\/admin-api\/cards\/exports\/active\.csv\?scope=LEGACY_BRIDGECARD$/);
    assert.equal(requests[0].options.method, 'GET');
    assert.equal(requests[0].options.cache, 'no-store');
    assert.equal(requests[0].options.headers.Authorization, 'Bearer admin-fixture');
    assert.equal(requests[0].options.headers.Accept, 'text/csv');
  } finally { global.fetch = original; }
});
