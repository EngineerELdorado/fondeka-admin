const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const root = path.join(__dirname, '..');
const file = path.join(root, 'components/risk/CheckoutIpBlocks.js');
const load = (name, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(root, name), 'utf8')).toString('base64')}#${tag}`);
const session = (role) => ({ tokens: { accessToken: { payload: { sub: 'admin-1', 'cognito:groups': [role] } } } });
const entry = (extra = {}) => ({ id: 42, ipAddress: '203.0.113.10', violationCount: 3, windowStartedAt: new Date(Date.now() - 60000).toISOString(), lastViolationAt: new Date().toISOString(), lastReason: 'SIMULATED_CHECKOUT_BUYER_EMAIL', blockedAt: new Date().toISOString(), blockedUntil: new Date(Date.now() + 3600000).toISOString(), blockReason: 'SIMULATED_CHECKOUT_BUYER_EMAIL', ...extra });
const dto = (rows, number = 0, size = 20, total = rows.length) => ({ content: rows, page: { size, number, totalElements: total, totalPages: Math.ceil(total / size) } });
const scopes = new WeakMap();

test('checkout IP statuses use expiry and latest action, including a manual block with no violations', async () => {
  const h = await load('lib/checkout-ip-blocks.js'), now = Date.now();
  assert.equal(h.checkoutIpStatus(entry({ violationCount: 0 }), now), 'Blocked');
  assert.equal(h.checkoutIpStatus(entry({ blockedUntil: new Date(now).toISOString() }), now), 'Expired');
  assert.equal(h.checkoutIpStatus(entry({ blockedUntil: null, blockedAt: null, lastReason: 'ADMIN_UNBLOCKED', blockReason: 'ADMIN: old reason' }), now), 'Unblocked');
  assert.equal(h.checkoutIpStatus(entry({ blockedUntil: null, blockedAt: null }), now), 'Violations recorded');
  assert.equal(h.checkoutIpReason('A_FUTURE_REASON <b>plain text</b>'), 'A_FUTURE_REASON <b>plain text</b>');
  assert.equal(h.checkoutIpReason('ADMIN: Reviewed <script>'), 'Manual block: Reviewed <script>');
  assert.match(h.checkoutIpDate(entry().blockedUntil), /UTC$/);
  assert.equal(h.checkoutIpDate(null), '—');
  assert.deepEqual(h.checkoutIpPage(dto([])).page, { size: 20, number: 0, totalElements: 0, totalPages: 0 });
  for (const bad of [{}, { content: [] }, { ...dto([]), page: { size: 0 } }, { content: [{}], page: dto([]).page }]) assert.throws(() => h.checkoutIpPage(bad));
});

test('checkout IP block validation accepts IPv4 and IPv6 while leaving public/proxy validation to the backend', async () => {
  const h = await load('lib/checkout-ip-blocks.js');
  for (const ipAddress of ['203.0.113.10', '2001:db8::1', '2001:DB8:0:0:0:0:0:1', '::ffff:203.0.113.10']) assert.equal(h.checkoutIpBlockPayload({ ipAddress, reason: ' Reviewed ', durationHours: '24' }).reason, 'Reviewed');
  assert.equal(h.checkoutIpKey('2001:db8::1'), h.checkoutIpKey('2001:DB8:0:0:0:0:0:1'));
  assert.equal(h.checkoutIpKey('::ffff:203.0.113.10'), h.checkoutIpKey('203.0.113.10'));
  for (const ipAddress of ['', 'host.example', '203.0.113.10/32', '203.0.113.256', '203.0.113.10:80', '[2001:db8::1]', '2001:::1', '2001:db8::1%eth0']) assert.throws(() => h.checkoutIpBlockPayload({ ipAddress, reason: 'Reason', durationHours: 24 }));
  for (const durationHours of ['0', '721', '1.5', '-1', 'NaN', '1e2']) assert.throws(() => h.checkoutIpBlockPayload({ ipAddress: '203.0.113.10', reason: 'Reason', durationHours }));
  for (const reason of ['', '   ', 'a'.repeat(501)]) assert.throws(() => h.checkoutIpBlockPayload({ ipAddress: '203.0.113.10', reason, durationHours: 24 }));
  assert.equal(h.checkoutIpBlockPayload({ ipAddress: '203.0.113.10', reason: 'Reason', durationHours: '' }).durationHours, 24);
  for (const role of ['ASSISTANT', 'STAFF', 'CUSTOMER']) assert.deepEqual(h.checkoutIpPermissions(session(role)), { canRead: false, canWrite: false });
  assert.deepEqual(h.checkoutIpPermissions(session('ADMIN')), { canRead: true, canWrite: false });
  assert.deepEqual(h.checkoutIpPermissions(session('SUPER_ADMIN')), { canRead: true, canWrite: true });
});

test('checkout IP API uses authenticated uncached calls, encoded IPv6, bodyless 204 DELETE and inline 403 errors', async (t) => {
  const originalFetch = global.fetch, originalWindow = global.window;
  t.after(() => { global.fetch = originalFetch; global.window = originalWindow; });
  const { api } = await load('lib/api.js', 'checkout-ip-api'), calls = [], events = [];
  api.setAuthToken('admin-token'); global.window = { dispatchEvent: (event) => events.push(event) };
  global.fetch = async (url, init) => { calls.push({ url, init }); return init.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json(dto([])); };
  await api.checkoutIpBlocks.list(new URLSearchParams({ activeOnly: 'false', page: '2', size: '100' }));
  const payload = { ipAddress: '2001:db8::1', reason: 'Reviewed', durationHours: 24 };
  await api.checkoutIpBlocks.block(payload);
  assert.equal(await api.checkoutIpBlocks.unblock('2001:db8::1'), null);
  assert.equal(new URL(calls[0].url, 'https://admin.local').searchParams.get('activeOnly'), 'false');
  assert.deepEqual(JSON.parse(calls[1].init.body), payload);
  assert.match(calls[2].url, /ipAddress=2001%3Adb8%3A%3A1/);
  assert.equal(calls[2].init.body, undefined);
  for (const call of calls) { assert.match(call.url, /\/admin-api\/commerce\/checkout-ip-blocks/); assert.equal(call.init.cache, 'no-store'); assert.equal(call.init.headers.Authorization, 'Bearer admin-token'); }
  global.fetch = async () => new Response(null, { status: 403 });
  for (const call of [() => api.checkoutIpBlocks.list(), () => api.checkoutIpBlocks.block(payload), () => api.checkoutIpBlocks.unblock(payload.ipAddress)]) await assert.rejects(call(), (err) => err.status === 403);
  assert.deepEqual(events, []);
});

async function panel(t, { role = 'SUPER_ADMIN', rows = [entry()], list, block, unblock } = {}) {
  const h = await load('lib/checkout-ip-blocks.js'), state = { rows: structuredClone(rows), reads: [], writes: [], sessions: 0 };
  if (!scopes.has(t)) {
    const originalWindow = global.window, scope = { views: [] }; scopes.set(t, scope);
    global.window = { addEventListener() {}, removeEventListener() {} };
    t.after(() => { scope.views.forEach((view) => view.unmount()); global.window = originalWindow; });
  }
  const auth = { session: session(role), refreshSession: async () => { state.sessions++; } };
  const api = { checkoutIpBlocks: {
    list: async (params) => {
      const query = Object.fromEntries(params); state.reads.push(query);
      if (list) return list(query, state);
      const selected = state.rows.filter((row) => query.activeOnly === 'false' || h.checkoutIpStatus(row) === 'Blocked');
      return dto(structuredClone(selected.slice(Number(query.page) * Number(query.size), (Number(query.page) + 1) * Number(query.size))), Number(query.page), Number(query.size), selected.length);
    },
    block: async (payload) => { state.writes.push({ type: 'block', payload }); if (block) return block(payload, state); const result = entry({ id: 42, ...payload, ipAddress: h.checkoutIpKey(payload.ipAddress), lastReason: `ADMIN: ${payload.reason}`, blockReason: `ADMIN: ${payload.reason}` }); state.rows = [result]; return result; },
    unblock: async (ipAddress) => { state.writes.push({ type: 'unblock', ipAddress }); if (unblock) return unblock(ipAddress, state); state.rows = state.rows.map((row) => row.ipAddress === ipAddress ? { ...row, blockedAt: null, blockedUntil: null, violationCount: 0, lastReason: 'ADMIN_UNBLOCKED' } : row); return null; }
  } };
  const view = await mountComponent(file, { exportName: 'CheckoutIpBlocksWorkspace', modules: {
    '@/contexts/AuthContext': { useAuth: () => auth }, '@/lib/api': { api }, '@/lib/checkout-ip-blocks': h,
    '@/components/DataTable': { DataTable: 'data-table' }, '@/components/ContentModal': { ContentModal: 'content-modal' }, './checkout-ip-blocks.module.css': {}
  } });
  scopes.get(t).views.push(view); await view.flush();
  const table = () => view.nodes().find((node) => node.type === 'data-table')?.props;
  const review = async (row = table().rows[0]) => { table().columns.find((column) => column.key === 'actions').render(row).props.onClick(); await view.flush(); };
  const confirm = async (name) => { view.nodes().find((node) => node.props['aria-label'] === `Confirm IP ${name}`).props.onChange({ target: { checked: true } }); await view.flush(); };
  const submit = async () => { view.nodes().find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} }); await view.flush(); };
  return { view, state, table, review, confirm, submit };
}

test('review roles, hidden navigation and direct route guards follow the checkout-specific contract', async (t) => {
  const admin = await panel(t, { role: 'ADMIN' });
  assert.equal(admin.state.reads.length, 1); assert.match(admin.view.text(), /Read only/);
  assert.equal(admin.view.nodes().some((node) => node.type === 'button' && node.props.children === 'Block IP'), false);
  await admin.review(); assert.equal(admin.view.nodes().some((node) => node.type === 'button' && node.props.children === 'Unblock'), false);
  for (const role of ['ASSISTANT', 'STAFF', 'CUSTOMER', '']) {
    const denied = await panel(t, { role }); assert.equal(denied.state.reads.length, 0); assert.match(denied.view.text(), /Admin or Super Admin access is required/);
  }
  const layout = readFileSync(path.join(root, 'app/(dashboard)/dashboard/layout.js'), 'utf8');
  assert.match(layout, /href: '\/dashboard\/risk\/checkout-ip-blocks'[^\n]+adminOnly: true/);
});

test('active/all views and page sizes use server metadata and reset pagination', async (t) => {
  const rows = Array.from({ length: 23 }, (_, index) => entry({ id: index + 1, ipAddress: `203.0.113.${index + 1}` }));
  rows.push(entry({ id: 99, blockedAt: null, blockedUntil: null, lastReason: 'ADMIN_UNBLOCKED' }));
  const { view, state, table } = await panel(t, { rows });
  assert.deepEqual(state.reads[0], { activeOnly: 'true', page: '0', size: '20' });
  assert.equal(table().totalElements, 23); assert.equal(table().totalPages, 2); assert.equal(table().canNext, true);
  table().onPageChange(1); await view.flush(); assert.equal(table().rows.length, 3); assert.equal(table().page, 1); assert.equal(table().canNext, false);
  await view.click('All records'); assert.equal(table().page, 0); assert.equal(table().totalElements, 24); assert.equal(state.reads.at(-1).activeOnly, 'false');
  view.change('Rows per page', '100'); await view.flush(); assert.equal(table().pageSize, 100); assert.equal(table().page, 0); assert.equal(table().rows.length, 24);
});

test('empty, failed, forbidden and unavailable loads never appear as a successful empty list', async (t) => {
  const empty = await panel(t, { rows: [] }); assert.match(empty.view.text(), /No active checkout IP blocks/);
  await empty.view.click('All records'); assert.match(empty.view.text(), /No retained checkout IP records/);
  for (const status of [401, 403, 404, 500]) {
    const failed = await panel(t, { list: async () => { throw Object.assign(new Error('Backend error'), { status }); } });
    assert.equal(failed.table(), undefined); assert.doesNotMatch(failed.view.text(), /No active checkout IP blocks/);
    assert.match(failed.view.text(), status === 404 ? /unavailable on this backend/ : status === 403 ? /Permission denied/ : status === 401 ? /session needs to be refreshed/ : /Backend error/);
    if ([401, 403].includes(status)) assert.equal(failed.state.sessions, 1);
  }
});

test('a late active-view response cannot overwrite the newer all-records result', async (t) => {
  let finishOld;
  const fresh = entry({ id: 99, blockedAt: null, blockedUntil: null, lastReason: 'ADMIN_UNBLOCKED' });
  const { view, table } = await panel(t, { list: async (query) => query.activeOnly === 'true' ? new Promise((resolve) => { finishOld = resolve; }) : dto([fresh]) });
  await view.click('All records'); assert.equal(table().rows[0].id, 99);
  finishOld(dto([entry()])); await view.flush(); assert.equal(table().rows[0].id, 99);
});

test('block confirmation shows the existing expiry, saves only block fields, canonicalizes from the response and refreshes both views', async (t) => {
  const { view, state, review, confirm, submit } = await panel(t);
  await review(); await view.click('Set block duration');
  assert.match(view.text(), /Recorded expiry:/); assert.match(view.text(), /shorten or extend/);
  view.change('Reason', ' Reviewed <b>as text</b> '); view.change('Duration in hours', '48');
  assert.equal(view.button('Confirm block').disabled, true); await confirm('block'); await submit();
  assert.deepEqual(state.writes, [{ type: 'block', payload: { ipAddress: '203.0.113.10', reason: 'Reviewed <b>as text</b>', durationHours: 48 } }]);
  assert.match(view.text(), /203\.0\.113\.10 blocked until/);
  assert.deepEqual(state.reads.slice(-2).map((query) => query.activeOnly).sort(), ['false', 'true']);
  assert.equal(view.nodes().filter((node) => node.props.dangerouslySetInnerHTML).length, 0);
});

test('block validation and server errors retain inputs without claiming a saved block', async (t) => {
  const { view, state, confirm, submit } = await panel(t, { block: async () => { throw Object.assign(new Error('Proxy addresses cannot be blocked'), { status: 400 }); } });
  await view.click('Block IP'); view.change('IP address', 'host.example'); view.change('Reason', 'Reviewed'); await confirm('block'); await submit();
  assert.match(view.text(), /Enter one IPv4 or IPv6/); assert.equal(state.writes.length, 0);
  view.change('IP address', '2001:db8::1'); await confirm('block'); await submit();
  assert.match(view.text(), /Proxy addresses cannot be blocked/); assert.equal(view.field('IP address').props.value, '2001:db8::1'); assert.equal(view.field('Reason').props.value, 'Reviewed');
  assert.equal(state.writes.length, 1); assert.doesNotMatch(view.text(), /blocked until/);
});

test('uncertain block outcomes require a refresh and fresh confirmation before retrying', async (t) => {
  const { view, state, confirm, submit } = await panel(t, { block: async () => { throw new Error('Network timeout'); } });
  await view.click('Block IP'); view.change('IP address', '2001:db8::1'); view.change('Reason', 'Reviewed'); await confirm('block'); await submit();
  assert.match(view.text(), /outcome is unconfirmed/); assert.equal(view.button('Confirm block').disabled, true);
  await submit(); assert.equal(state.writes.length, 1);
  await view.click('Refresh records before retry'); assert.deepEqual(state.reads.slice(-2).map((query) => query.activeOnly).sort(), ['false', 'true']);
  assert.equal(view.button('Confirm block').disabled, true);
  await confirm('block'); await submit(); assert.equal(state.writes.length, 2);
  view.nodes().find((node) => node.type === 'content-modal').props.onClose(); await view.flush();
  assert.equal(view.button('Block IP').disabled, true);
  await view.click('Block IP'); assert.equal(view.nodes().some((node) => node.type === 'content-modal'), false);
  await view.click('Refresh'); assert.equal(view.button('Block IP').disabled, false);
});

test('pending block submission cannot be duplicated or dismissed', async (t) => {
  let finish;
  const { view, state, confirm, submit } = await panel(t, { block: (payload) => new Promise((resolve) => { finish = () => resolve(entry({ ipAddress: payload.ipAddress })); }) });
  await view.click('Block IP'); view.change('IP address', '2001:db8::1'); view.change('Reason', 'Reviewed'); await confirm('block');
  await submit(); await submit(); assert.equal(state.writes.length, 1); assert.equal(view.button('Blocking…').disabled, true);
  view.nodes().find((node) => node.type === 'content-modal').props.onClose(); await view.flush();
  assert.ok(view.nodes().some((node) => node.type === 'content-modal'));
  finish(); await view.flush(); assert.match(view.text(), /2001:db8::1 blocked until/);
});

test('server write permission errors refresh the session and remove mutation controls', async (t) => {
  const { view, state, confirm, submit } = await panel(t, { block: async () => { throw Object.assign(new Error('Stored role denied'), { status: 403 }); } });
  await view.click('Block IP'); view.change('IP address', '203.0.113.10'); view.change('Reason', 'Reviewed'); await confirm('block'); await submit();
  assert.equal(state.sessions, 1); assert.equal(state.writes.length, 1); assert.match(view.text(), /Permission denied/);
  assert.equal(view.nodes().some((node) => node.type === 'content-modal'), false);
});

test('unblocking consumes 204, retains the record in All records, and returns an emptied last page to a valid page', async (t) => {
  const rows = Array.from({ length: 21 }, (_, index) => entry({ id: index + 1, ipAddress: `203.0.113.${index + 1}` }));
  const { view, state, table, review, confirm } = await panel(t, { rows });
  table().onPageChange(1); await view.flush(); await review(); await view.click('Unblock');
  assert.match(view.text(), /203\.0\.113\.21/); assert.match(view.text(), /Rate-limit quotas/);
  await confirm('unblock'); await view.click('Confirm unblock'); await view.flush();
  assert.deepEqual(state.writes, [{ type: 'unblock', ipAddress: '203.0.113.21' }]); assert.equal(table().page, 0); assert.equal(table().totalElements, 20);
  await view.click('All records'); table().onPageChange(1); await view.flush();
  assert.equal(table().rows[0].lastReason, 'ADMIN_UNBLOCKED'); assert.equal(table().rows[0].violationCount, 0);
});

test('a displayed block expiry refreshes active results without repeated expiry polling', async (t) => {
  const originalTimeout = global.setTimeout, originalClear = global.clearTimeout, originalNow = Date.now;
  let callback, milliseconds, clock = originalNow();
  global.setTimeout = (fn, delay) => { callback = fn; milliseconds = delay; return 123; }; global.clearTimeout = () => {}; Date.now = () => clock;
  t.after(() => { global.setTimeout = originalTimeout; global.clearTimeout = originalClear; Date.now = originalNow; });
  const { state, view } = await panel(t, { rows: [entry({ blockedUntil: new Date(clock + 1000).toISOString() })] });
  assert.ok(milliseconds >= 1000 && milliseconds <= 1050);
  clock += 1100; callback(); await view.flush();
  assert.equal(state.reads.length, 2); assert.match(view.text(), /No active checkout IP blocks/);
});

test('manual audit uses the record ID and displays actor and metadata as text', async (t) => {
  const h = await load('lib/checkout-ip-blocks.js'), queries = [];
  const view = await mountComponent(file, { exportName: 'CheckoutIpAudit', props: { entryId: 42 }, modules: {
    '@/contexts/AuthContext': { useAuth: () => ({ session: session('ADMIN') }) }, '@/components/DataTable': { DataTable: 'data-table' }, '@/components/ContentModal': { ContentModal: 'content-modal' }, './checkout-ip-blocks.module.css': {}, '@/lib/checkout-ip-blocks': h,
    '@/lib/api': { api: { auditLogs: { list: async (params) => { queries.push(Object.fromEntries(params)); return { content: [{ id: 1, action: 'CHECKOUT_IP_BLOCK', targetType: 'CHECKOUT_IP', targetId: 42, adminEmail: 'admin@example.com', createdAt: new Date().toISOString(), metadata: { reason: '<b>literal</b>' } }], page: { totalPages: 1, totalElements: 1 } }; } } } }
  } });
  t.after(() => view.unmount()); await view.flush();
  assert.deepEqual(queries[0], { targetType: 'CHECKOUT_IP', targetId: '42', page: '0', size: '10' });
  assert.match(view.text(), /admin@example.com/); assert.match(view.text(), /<b>literal<\/b>/);
  assert.equal(view.nodes().some((node) => node.props.dangerouslySetInnerHTML), false);
});
