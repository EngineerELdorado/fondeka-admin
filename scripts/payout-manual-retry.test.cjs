const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const helpers = import('data:text/javascript;base64,' + Buffer.from(readFileSync(path.join(__dirname, '..', 'lib/payout-manual-retry.js'), 'utf8')).toString('base64'));
const key = 'd4b4ee7c-822f-4944-91c0-05d37272abe2';
const preview = { transactionId: 91, reference: 'TX91', destination: '+233240000000', amount: 100, grossAmount: 105, currency: 'GHS', version: 4, currentAttempt: 0, defaultRouteId: 1, sendsPayments: false, canRetry: true,
  evidence: { confirmedNonPayment: true }, blockers: [], retries: [],
  routes: [{ routeId: 1, provider: 'PAWAPAY', originalProvider: true, available: true }, { routeId: 2, provider: 'MAPLERAD', originalProvider: false, available: true }] };

test('manual retry defaults to original provider and does not send editable money or beneficiary fields', async () => {
  const h = await helpers;
  const request = h.manualRetryRequest(preview, '', ' Provider confirmed non-payment ', true, key);
  assert.deepEqual(request, { idempotencyKey: key, expectedVersion: 4, expectedAttempt: 0, targetRouteId: null, reason: 'Provider confirmed non-payment', confirmed: true });
  assert.equal('amount' in request, false);assert.equal('destination' in request, false);assert.equal('currency' in request, false);
});
test('switching providers requires an explicit available route selection', async () => {
  const h = await helpers;
  assert.equal(h.manualRetryRequest(preview, '2', 'Approved switch', true, key).targetRouteId, 2);
  const disabled = { ...preview, routes: [{ ...preview.routes[0], available: false, unavailableReason: 'Original route disabled' }, preview.routes[1]] };
  assert.throws(() => h.manualRetryRequest(disabled, '', 'Approved retry', true, key), /Original route disabled/);
  assert.equal(h.manualRetryRequest(disabled, '2', 'Approved switch', true, key).targetRouteId, 2);
  assert.throws(() => h.manualRetryRequest(preview, '99', 'Approved switch', true, key), /available/);
});
test('unconfirmed evidence, missing approval, invalid identity and missing reason block submission', async () => {
  const h = await helpers;
  assert.throws(() => h.manualRetryRequest({ ...preview, evidence: { confirmedNonPayment: false } }, '', 'Approved retry', true, key), /reconciled/);
  assert.throws(() => h.manualRetryRequest(preview, '', 'Approved retry', false, key), /Confirm/);
  assert.throws(() => h.manualRetryRequest(preview, '', ' ', true, key), /reason/);
  assert.throws(() => h.manualRetryRequest(preview, '', 'Approved retry', true, ''), /unique/);
});
test('preview responses for another transaction or with missing safety fields are rejected', async () => {
  const h = await helpers;
  assert.throws(() => h.manualRetryPreview(preview, 92), /verified/);
  assert.throws(() => h.manualRetryPreview({ ...preview, sendsPayments: true }, 91), /verified/);
  assert.throws(() => h.manualRetryPreview({ ...preview, version: null }, 91), /verified/);
  assert.throws(() => h.manualRetryPreview({ ...preview, routes: null }, 91), /verified/);
  assert.throws(() => h.manualRetryPreview({ ...preview, amount: true }, 91), /quote/);
  assert.throws(() => h.manualRetryPreview({ ...preview, destination: null }, 91), /beneficiary/);
  assert.throws(() => h.manualRetryPreview({ ...preview, routes: [{ ...preview.routes[0], originalProvider: false }] }, 91), /verified/);
  assert.throws(() => h.manualRetryPreview({ ...preview, maximumAttempts: 4 }, 91), /verified/);
});
test('lost response recovery accepts only the exact transaction and approval receipt', async () => {
  const h = await helpers;
  const receipt = { id: 10, transactionId: 91, idempotencyKey: key, state: 'DISPATCHED' };
  assert.equal(h.manualRetryReceipt(receipt, 91, key), receipt);
  assert.throws(() => h.manualRetryReceipt({ ...receipt, transactionId: 92 }, 91, key), /verified/);
  assert.throws(() => h.manualRetryReceipt({ ...receipt, idempotencyKey: 'other' }, 91, key), /verified/);
  assert.throws(() => h.manualRetryReceipt({ ...receipt, state: 'PAID' }, 91, key), /verified/);
});
test('queued approval detection stops another request while its worker has not started', async () => {
  const h = await helpers;
  assert.equal(h.pendingManualRetry(preview), null);
  assert.equal(h.pendingManualRetry({ ...preview, retries: [{ id: 10, state: 'QUEUED' }] }).id, 10);
  assert.equal(h.pendingManualRetry({ ...preview, retries: [{ id: 10, state: 'DISPATCHED' }] }).id, 10);
});

const { mountComponent } = require('./helpers/component-harness.cjs');
const receipt = (payload, state = 'QUEUED', transactionId = 91) => ({ id: 10, transactionId, idempotencyKey: payload.idempotencyKey, state, expectedVersion: payload.expectedVersion, expectedAttempt: payload.expectedAttempt });
const event = () => ({ preventDefault() {} });
async function panel({ read = async () => preview, send = async (_id, payload) => receipt(payload), status = async () => receipt({ idempotencyKey: key }, 'RETURNED'), enabled = true, active = true, actor = 'admin-1' } = {}) {
  const h = await helpers, reads = [], posts = [], lookups = [];
  const view = await mountComponent(path.join(__dirname, '../components/payout-failover/ManualRetryPanel.js'), {
    props: { initialTransactionId: 91, enabled, active }, modules: {
      '@/lib/payout-manual-retry': h,
      '@/lib/api': { api: { payoutFailover: {
        manualRetryPreview: async id => { reads.push(id); return read(id, reads.length); },
        manualRetry: async (id, payload) => { posts.push({ id, payload }); return send(id, payload); },
        manualRetryStatus: async id => { lookups.push(id); return status(id); }
      } } },
      '@/contexts/AuthContext': { useAuth: () => ({ session: { tokens: { accessToken: { payload: { sub: actor } } } } }) },
      './Common': { Card: 'section', Alert: 'alert', Field: 'field', formatInstant: value => value || '—', useFailoverError: setError => async err => setError(err.message) }
    }
  });
  return { view, reads, posts, lookups };
}
async function review(view) { void view.nodes().find(node => node.type === 'form').props.onSubmit(event()); await view.flush(); }
async function approve(view) { const form = view.nodes().filter(node => node.type === 'form')[1]; if (form) void form.props.onSubmit(event()); await view.flush(); }
async function ready(view) { await review(view); view.change('Reason for retry', ' Provider confirmed non-payment '); view.check(true); }

test('manual approval renders fixed quote, defaults to the original provider and prevents duplicate submits', async () => {
  let release;
  const run = await panel({ send: (_id, payload) => new Promise(resolve => { release = () => resolve(receipt(payload)); }) });
  await ready(run.view);
  assert.match(run.view.text(), /100 GHS/); assert.match(run.view.text(), /105 GHS/); assert.equal(run.view.field('Payout provider').props.value, '');
  await approve(run.view); await approve(run.view); assert.equal(run.posts.length, 1);
  assert.equal(run.posts[0].id, 91); assert.equal(run.posts[0].payload.targetRouteId, null);
  assert.equal(run.posts[0].payload.expectedVersion, 4); assert.equal(run.posts[0].payload.expectedAttempt, 0);
  assert.equal(run.posts[0].payload.reason, 'Provider confirmed non-payment');
  release(); await run.view.flush(); assert.match(run.view.text(), /QUEUED/);
  assert.ok(!run.view.nodes().some(node => node.props.children === 'Approve one retry'));
});

test('an unavailable original provider is not replaced automatically and edits invalidate confirmation', async () => {
  const run = await panel({ read: async () => ({ ...preview, routes: [{ ...preview.routes[0], available: false, unavailableReason: 'Original route disabled' }, preview.routes[1]] }) });
  await ready(run.view); assert.equal(run.view.button('Approve one retry').disabled, true);
  assert.equal(run.view.field('Payout provider').props.value, ''); assert.match(run.view.text(), /Original route disabled/);
  run.view.change('Payout provider', '2'); assert.equal(run.view.button('Approve one retry').disabled, true);
  run.view.check(true); run.view.change('Reason for retry', 'Approve the selected alternate'); assert.equal(run.view.button('Approve one retry').disabled, true);
  run.view.check(true); await approve(run.view); assert.equal(run.posts[0].payload.targetRouteId, 2);
});

test('a timeout recovers its exact receipt and never submits a second approval automatically', async () => {
  let recorded;
  const run = await panel({ read: async (_id, count) => count === 1 ? preview : { ...preview, canRetry: false, retries: [recorded] }, send: async (_id, payload) => { recorded = receipt(payload, 'DISPATCHED'); throw new Error('Timed out'); } });
  await ready(run.view); await approve(run.view); assert.equal(run.posts.length, 1);
  await review(run.view); assert.match(run.view.text(), /DISPATCHED/); assert.equal(run.posts.length, 1);
  assert.ok(!run.view.nodes().some(node => node.props.children === 'Approve one retry'));
});

test('an unrecorded timeout can only resend the identical approval after a fresh check and confirmation', async () => {
  const run = await panel({ send: async (_id, payload) => { if (run.posts.length === 1) throw new Error('Connection lost'); return receipt(payload); } });
  await ready(run.view); await approve(run.view); await review(run.view);
  assert.equal(run.view.button('Resend same approval').disabled, true);
  assert.equal(run.view.field('Reason for retry').props.disabled, true);
  run.view.check(true); await run.view.click('Resend same approval');
  assert.equal(run.posts.length, 2); assert.deepEqual(run.posts[1].payload, run.posts[0].payload);
});

test('a retained approval ID survives remounts and is scoped to the signed-in admin and payment', async t => {
  const oldWindow = global.window, storage = new Map();
  t.after(() => { if (oldWindow === undefined) delete global.window; else global.window = oldWindow; });
  global.window = { sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } };
  let recorded;
  const first = await panel({ send: async (_id, payload) => { recorded = receipt(payload); throw new Error('No response'); } });
  await ready(first.view); await approve(first.view); first.view.unmount();
  const restored = await panel({ read: async () => ({ ...preview, canRetry: false, retries: [recorded] }) });
  await review(restored.view); assert.match(restored.view.text(), /Approval #10/); assert.equal(restored.posts.length, 0);
  const otherAdmin = await panel({ actor: 'admin-2' }); await review(otherAdmin.view);
  assert.ok(otherAdmin.view.nodes().some(node => node.props.children === 'Approve one retry'));
  assert.ok(!otherAdmin.view.nodes().some(node => node.props.children === 'Resend same approval'));
});

test('stale approvals retain the reason and require another preview and explicit confirmation', async () => {
  const run = await panel({ read: async (_id, count) => ({ ...preview, version: count === 1 ? 4 : 5 }), send: async (_id, payload) => { if (payload.expectedVersion === 4) throw Object.assign(new Error('Payout changed'), { status: 409 }); return receipt(payload); } });
  await ready(run.view); await approve(run.view); assert.match(run.view.text(), /Payout changed/);
  await review(run.view); assert.equal(run.view.field('Reason for retry').props.value, ' Provider confirmed non-payment ');
  assert.equal(run.view.button('Approve one retry').disabled, true); assert.equal(run.posts.length, 1);
  run.view.check(true); await approve(run.view); assert.equal(run.posts[1].payload.expectedVersion, 5);
  assert.notEqual(run.posts[1].payload.idempotencyKey, run.posts[0].payload.idempotencyKey);
});

test('a returned submit response is not settlement and a fresh preview is required for a new approval', async () => {
  let recorded;
  const run = await panel({ read: async (_id, count) => count === 1 ? preview : { ...preview, currentAttempt: 1, version: 5, retries: [recorded] }, send: async (_id, payload) => { recorded = receipt(payload, 'RETURNED'); return recorded; } });
  await ready(run.view); await approve(run.view);
  assert.match(run.view.text(), /not settlement confirmation/);
  assert.ok(!run.view.nodes().some(node => node.props.children === 'Review a new approval'));
  await review(run.view); await run.view.click('Review a new approval');
  assert.equal(run.view.button('Approve one retry').disabled, true);
  run.view.check(true); await approve(run.view); assert.equal(run.posts[1].payload.expectedAttempt, 1);
});

test('denied, unverified and inactive views cannot send approvals', async () => {
  for (const options of [{ enabled: false }, { active: false }]) {
    const run = await panel(options); await review(run.view); assert.equal(run.reads.length, 0); assert.equal(run.posts.length, 0);
  }
  const denied = await panel({ send: async () => { throw Object.assign(new Error('Stored role denied'), { status: 403 }); } });
  await ready(denied.view); await approve(denied.view);
  assert.equal(denied.view.button('Check payout status').disabled, true); await review(denied.view); assert.equal(denied.reads.length, 1);
});

test('older previews and receipt lookups cannot leak into a different payment', async () => {
  let release;
  const run = await panel({ read: id => id === 91 ? new Promise(resolve => { release = resolve; }) : { ...preview, transactionId: 92, reference: 'TX92' } });
  await review(run.view); run.view.change('Payout transaction ID', '92'); await review(run.view);
  release(preview); await run.view.flush(); assert.match(run.view.text(), /TX92/); assert.doesNotMatch(run.view.text(), /TX91/);
  const pending = await panel({ read: async () => ({ ...preview, canRetry: false, retries: [receipt({ idempotencyKey: key }, 'DISPATCHED')] }), status: () => new Promise(resolve => { release = resolve; }) });
  await review(pending.view); await pending.view.click('Refresh retry status');
  pending.view.change('Payout transaction ID', '92'); release(receipt({ idempotencyKey: key }, 'RETURNED')); await pending.view.flush();
  assert.ok(!pending.view.nodes().some(node => node.props.children === 'Refresh retry status'));
});

test('blocked historical payouts still display diagnostics and missing originals are never auto-selected', async () => {
  const run = await panel({ read: async () => ({ ...preview, version: null, canRetry: false, defaultRouteId: 0, routes: [], blockers: ['The original payout context is missing.'], evidence: { confirmedNonPayment: false } }) });
  await review(run.view); assert.match(run.view.text(), /original payout context is missing/);
  assert.equal(run.view.button('Approve one retry').disabled, true);
  const h = await helpers;
  assert.throws(() => h.manualRetryRequest({ ...preview, currentAttempt: 3 }, '', 'Approved retry', true, key), /maximum/);
});

test('retry APIs use admin authentication, no-store and the dedicated safe preview/approval/receipt routes', async t => {
  const oldFetch = global.fetch; t.after(() => { global.fetch = oldFetch; });
  const source = readFileSync(path.join(__dirname, '../lib/api.js'), 'utf8');
  const { api } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64') + '#manual-retry-api');
  api.setAuthToken('test-admin-token'); const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(init.method === 'POST' ? receipt({ idempotencyKey: key }) : preview, { status: init.method === 'POST' ? 202 : 200 }); };
  await api.payoutFailover.manualRetryPreview(91); const payload = (await helpers).manualRetryRequest(preview, '', 'Approved retry', true, key);
  await api.payoutFailover.manualRetry(91, payload); await api.payoutFailover.manualRetryStatus(10);
  assert.match(calls[0].url, /\/payout-failover\/transactions\/91\/manual-retry$/);
  assert.match(calls[2].url, /\/payout-failover\/manual-retries\/10$/);
  assert.deepEqual(JSON.parse(calls[1].init.body), payload);
  for (const { url, init } of calls) { assert.equal(init.headers.Authorization, 'Bearer test-admin-token'); assert.equal(init.cache, 'no-store'); assert.doesNotMatch(url, /momo-status|refund|guard/); }
});

async function payoutPage({ role = 'ADMIN', supports = true } = {}) {
  const load = file => import('data:text/javascript;base64,' + Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64'));
  const payout = await load('lib/payout-failover.js'), presentation = await load('lib/failover-presentation.js');
  let requests = 0, failNext = false;
  const view = await mountComponent(path.join(__dirname, '../app/(dashboard)/dashboard/payout-failover/page.js'), {
    modules: (hooks) => ({
      'next/navigation': { useSearchParams: () => new URLSearchParams('tab=operations&transactionId=91') },
      '@/contexts/AuthContext': { useAuth: () => ({ session: { tokens: { accessToken: { payload: { sub: 'test-admin', 'cognito:groups': [role] } } } }, enableRegulatorMode: false }) },
      '@/lib/payout-failover': payout, '@/lib/failover-presentation': presentation,
      '@/lib/api': { api: { payoutFailover: { capabilities: async () => { requests++; if (failNext) throw new Error('Capabilities unavailable'); return { providers: [{ provider: 'PAWAPAY', sourceSupported: true, targetSupported: true }], errorCodes: [], actions: ['WITHDRAW_FROM_WALLET'], maximumProviders: 3, requiresConfirmedNonPayment: true, allowsManualResubmit: supports }; } } } },
      '@/components/payout-failover/Common': { Card: 'section', Alert: 'alert', useFailoverError: setError => hooks.useCallback(async error => setError(error.message), []) },
      '@/components/failover/Experience': { FailoverIntro: 'intro', FailoverNavigation: 'navigation', FailoverOverview: 'overview' },
      ...Object.fromEntries(['PolicyPanel', 'OperationsPanel', 'HistoryPanel', 'ManualRetryPanel'].map(name => [`@/components/payout-failover/${name}`, { __esModule: true, default: name }]))
    })
  });
  await view.flush();
  return { view, requests: () => requests, failNext: () => { failNext = true; } };
}

test('manual retry is capability-gated for Admins and Super Admins, unavailable to other roles and disabled after refresh failure', async () => {
  for (const role of ['ADMIN', 'SUPER_ADMIN']) {
    const run = await payoutPage({ role });
    let retry = run.view.nodes().find(node => node.type === 'ManualRetryPanel').props;
    assert.equal(retry.enabled, true); assert.equal(retry.active, true); assert.equal(retry.initialTransactionId, '91');
    run.failNext(); run.view.nodes().find(node => node.type === 'intro').props.onRefresh(); await run.view.flush();
    retry = run.view.nodes().find(node => node.type === 'ManualRetryPanel').props;
    assert.equal(retry.enabled, false);
  }
  const older = await payoutPage({ supports: false });
  assert.ok(!older.view.nodes().some(node => node.type === 'ManualRetryPanel'));
  for (const role of ['ASSISTANT', 'STAFF', 'CUSTOMER']) {
    const denied = await payoutPage({ role }); assert.equal(denied.requests(), 0);
    assert.ok(!denied.view.nodes().some(node => node.type === 'ManualRetryPanel'));
  }
});

test('saved approval recovery retains only the exact immutable request and rejects another transaction', async () => {
  const h = await helpers, payload = h.manualRetryRequest(preview, '', 'Approved retry', true, key);
  const value = { transactionId: 91, payload: { ...payload, amount: 999, destination: 'changed' } };
  assert.deepEqual(h.savedManualRetry(value, 91), payload);
  assert.equal(h.savedManualRetry(value, 92), null);
  assert.equal(h.savedManualRetry({ ...value, payload: { ...payload, confirmed: false } }, 91), null);
  assert.notEqual(h.manualRetryStorageKey('admin-A', 91), h.manualRetryStorageKey('admin-B', 91));
});
