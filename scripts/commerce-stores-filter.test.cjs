const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const page = path.join(__dirname, '../app/(dashboard)/dashboard/commerce/stores/page.js');
const response = (id = 42) => ({ content: [{ id, name: 'Synthetic Store' }], totalElements: 60, totalPages: 3 });
const control = (view, id) => view.nodes().find(node => node.props.id === id).props;
const rows = view => view.nodes().find(node => node.type === 'storeTable').props.rows;
async function setup(t, read = async () => response()) {
  const calls = [];
  const view = await mountComponent(page, { modules: {
    '@/lib/api': { api: { commerceStores: { list: async query => { const params = new URLSearchParams(query); calls.push(params); return read(params, calls.length); } } } },
    '@/contexts/AuthContext': { useAuth: () => ({ enableRegulatorMode: false }) },
    '@/contexts/LocaleContext': { useLocale: () => ({ t: key => key }) },
    '@/components/RegulatorPresentation': { NonRegulatorContent: 'private', PresentationLink: 'a' },
    '@/lib/regulator-presentation': { regulatorVisibleFields: fields => fields },
    '@/components/DataTable': { DataTable: 'storeTable' }, '@/components/TableCell': { TableCellLines: 'lines' }
  } });
  t.after(() => view.unmount()); await view.flush(); return { view, calls };
}
async function change(view,id,value) { control(view,id).onChange({ target: { value } }); await view.flush(); }
async function enter(view) { let prevented = false; control(view,'creatorEmail').onKeyDown({ key: 'Enter', preventDefault: () => { prevented = true; } }); await view.flush(); assert.equal(prevented,true); }

test('creator email applies after typing and resets pagination without losing existing filters', async t => {
  const { view, calls } = await setup(t);
  await change(view,'verificationStatus','VERIFIED'); await change(view,'storeStatus','ACTIVE'); await change(view,'visibility','PUBLIC');
  view.nodes().find(node => node.type === 'storeTable').props.onPageChange(1); await view.flush(); assert.equal(calls.at(-1).get('page'),'1');
  await change(view,'creatorEmail','  Creator+tag@Example.test  ');
  const before = calls.length;
  await new Promise(resolve => setTimeout(resolve,350)); await view.flush();
  assert.equal(calls.length,before+1);
  assert.deepEqual(Object.fromEntries(calls.at(-1)), { page:'0',size:'20',creatorEmail:'Creator+tag@Example.test',verificationStatus:'VERIFIED',status:'ACTIVE',visibility:'PUBLIC',deleted:'false' });
  view.nodes().find(node => node.type === 'storeTable').props.onPageChange(1); await view.flush(); assert.equal(calls.at(-1).get('creatorEmail'),'Creator+tag@Example.test'); assert.equal(calls.at(-1).get('page'),'1');
});

test('Enter and Refresh apply the current email immediately and clearing filters removes it', async t => {
  const { view, calls } = await setup(t);
  await change(view,'creatorEmail','first@example.test'); await enter(view);
  assert.equal(calls.at(-1).get('creatorEmail'),'first@example.test');
  await change(view,'creatorEmail','second+tag@example.test'); await view.click('Refresh');
  assert.equal(calls.at(-1).get('creatorEmail'),'second+tag@example.test');
  await view.click('Clear filters');
  assert.equal(control(view,'creatorEmail').value,''); assert.equal(calls.at(-1).has('creatorEmail'),false);
  assert.equal(calls.at(-1).has('deleted'),false); assert.equal(calls.at(-1).get('page'),'0');
});

test('a late response from an older filter cannot overwrite the current creator result', async t => {
  let resolveOld;
  const old = new Promise(resolve => { resolveOld = resolve; });
  const { view, calls } = await setup(t, async (_params,count) => count===1 ? old : response(99));
  await change(view,'creatorEmail','current@example.test'); await enter(view);
  assert.equal(calls.length,2); assert.equal(rows(view)[0].id,99);
  resolveOld(response(1)); await view.flush();
  assert.equal(rows(view)[0].id,99);
});

test('blank email leaves the existing unfiltered request unchanged', async t => {
  const { view, calls } = await setup(t);
  assert.deepEqual(Object.fromEntries(calls[0]),{ page:'0',size:'20',deleted:'false' });
  await change(view,'creatorEmail','   '); await enter(view);
  assert.equal(calls.at(-1).has('creatorEmail'),false);
  await change(view,'creatorEmail','owner@'); await enter(view);
  view.nodes().find(node => node.type === 'storeTable').props.onPageChange(1); await view.flush();
  await change(view,'creatorEmail','   '); await enter(view);
  assert.deepEqual(Object.fromEntries(calls.at(-1)),{ page:'0',size:'20',deleted:'false' });
});

test('partial email input is debounced and only the latest typed value is applied', async t => {
  const { view, calls } = await setup(t);
  assert.equal(control(view, 'creatorEmail').type, 'search');
  assert.equal(control(view, 'creatorEmail').placeholder, 'Full or partial email');
  await change(view, 'creatorEmail', 'creator@');
  await change(view, 'creatorEmail', '@example.test');
  assert.equal(calls.length, 1);
  await new Promise(resolve => setTimeout(resolve, 350)); await view.flush();
  assert.equal(calls.length, 2); assert.equal(calls.at(-1).get('creatorEmail'), '@example.test');
  assert.equal(calls.at(-1).has('contactEmail'), false);
});

test('Refresh and Clear can replace pending requests without displaying previous-filter rows or totals', async t => {
  const requests = [];
  const { view, calls } = await setup(t, (_params, count) => count === 1 ? response(42) : new Promise(resolve => requests.push(resolve)));
  assert.equal(rows(view)[0].id, 42);
  await change(view, 'creatorEmail', 'creator@'); await view.click('Refresh');
  assert.deepEqual(rows(view), []);
  let table = view.nodes().find(node => node.type === 'storeTable').props;
  assert.equal(table.totalElements, null); assert.equal(table.totalPages, null);
  assert.equal(view.button('Refresh').disabled, false); assert.equal(view.button('Clear filters').disabled, false);
  await view.click('Clear filters');
  assert.equal(calls.at(-1).has('creatorEmail'), false); assert.equal(calls.at(-1).has('deleted'), false);
  requests[0](response(1)); await view.flush();
  assert.deepEqual(rows(view), []); assert.equal(view.button('Refresh')['aria-busy'], true);
  requests[1]({ content: [], totalElements: 0, totalPages: 0 }); await view.flush();
  table = view.nodes().find(node => node.type === 'storeTable').props;
  assert.deepEqual(table.rows, []); assert.equal(table.totalElements, 0); assert.equal(table.totalPages, 0);
  assert.equal(view.button('Refresh')['aria-busy'], false);
});

test('a failed new filter clears old rows and totals and displays the API message', async t => {
  const { view } = await setup(t, async (_params, count) => {
    if (count === 1) return response(42);
    throw Object.assign(new Error('Invalid store filter'), { status: 400 });
  });
  await change(view, 'creatorEmail', 'missing@'); await enter(view);
  assert.deepEqual(rows(view), []); assert.match(view.text(), /Invalid store filter/);
  const table = view.nodes().find(node => node.type === 'storeTable').props;
  assert.equal(table.totalElements, null); assert.equal(table.totalPages, null);
  assert.equal(view.button('Refresh')['aria-busy'], false);
});

test('an older failed request cannot clear newer results or show its error', async t => {
  let rejectOld;
  const { view } = await setup(t, (_params, count) => count === 1 ? new Promise((_resolve, reject) => { rejectOld = reject; }) : response(99));
  await change(view, 'creatorEmail', 'current@'); await enter(view);
  rejectOld(new Error('Old request failed')); await view.flush();
  assert.equal(rows(view)[0].id, 99); assert.doesNotMatch(view.text(), /Old request failed/);
  assert.equal(view.button('Refresh')['aria-busy'], false);
});

test('store filter choices use supported enums and keep archived/deleted selectors independent', async t => {
  const { Children } = require('react');
  const { view, calls } = await setup(t, async params => params.get('status') === 'ARCHIVED' && params.get('deleted') === 'false' ? { content: [], totalElements: 0, totalPages: 0 } : response());
  const values = id => Children.toArray(control(view, id).children).map(node => node.props.value);
  assert.deepEqual(values('verificationStatus'), ['', 'UNVERIFIED', 'VERIFIED', 'REJECTED']);
  assert.deepEqual(values('storeStatus'), ['', 'DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']);
  assert.deepEqual(values('visibility'), ['', 'PUBLIC', 'PRIVATE']);
  await change(view, 'storeStatus', 'ARCHIVED');
  assert.equal(calls.at(-1).get('deleted'), 'false'); assert.deepEqual(rows(view), []);
  await change(view, 'deletedState', 'deleted');
  assert.equal(calls.at(-1).get('status'), 'ARCHIVED'); assert.equal(calls.at(-1).get('deleted'), 'true');
  assert.equal(rows(view)[0].id, 42);
});

test('server rows and totals are retained without filtering storefront contactEmail in the browser', async t => {
  const stores = [{ id: 1, contactEmail: 'shop@example.test' }, { id: 2, contactEmail: null }];
  const { view } = await setup(t, async () => ({ content: stores, totalElements: 123, totalPages: 7 }));
  await change(view, 'creatorEmail', 'owner@'); await enter(view);
  const table = view.nodes().find(node => node.type === 'storeTable').props;
  assert.equal(table.rows, stores); assert.equal(table.totalElements, 123); assert.equal(table.totalPages, 7);
});

test('the admin API encodes creator email without turning plus signs into spaces', async t => {
  const oldFetch = global.fetch;
  t.after(() => { global.fetch = oldFetch; });
  const source = readFileSync(path.join(__dirname,'../lib/api.js'),'utf8');
  const { api } = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')+'#creator-filter');
  api.setAuthToken('synthetic-admin-token');
  let requested;
  global.fetch = async url => { requested = url; return Response.json(response()); };
  const email = String.raw`creator+tag%_\@example.test`;
  await api.commerceStores.list(new URLSearchParams({ page:'0',size:'20',creatorEmail:email }));
  const url = new URL(requested,'https://admin.local');
  assert.equal(url.pathname,'/admin-api/commerce/stores');
  assert.equal(url.searchParams.get('creatorEmail'),email);
});
