const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const React = require('react');
const { mountComponent } = require('./helpers/component-harness.cjs');
const load = (file, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64')}#${tag}`);
const session = (role) => ({ tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } });
const item = { id: 8, transactionId: 91, transactionReference: 'TX91', operationType: 'TV_SUBSCRIBE', status: 'AWAITING_MANUAL_FULFILLMENT', billProductId: 12, billProductDisplayName: 'Television Congo', billCode: 'CANAL_PLUS_DRC', subscriberId: '12345678901234', offerCode: 'REAL-OFFER', optionCode: 'REAL-FREE-OPTION', offerName: 'Monthly TV', optionName: 'No extra option', amount: 15.25, currency: 'USD', promotionNote: '<b>Literal promotion</b>\nNo markup', promotionTargetOfferDisplayName: 'Captured target offer' };
const eligibility = { transactionId: 91, action: 'PAY_TV_SUBSCRIPTION', status: 'MANUAL_INTERVENTION_REQUIRED', completable: true, nextExpirationDateSupported: true };
const page = (rows = [item], totalPages = 1) => ({ content: rows, totalElements: rows.length, totalPages });
const nodes = (value) => Array.isArray(value) ? value.flatMap(nodes) : React.isValidElement(value) ? [value, ...nodes(value.props.children)] : [];
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const input = (view, label) => view.nodes().find((node) => node.props['aria-label'] === label);
async function change(view, label, value) { input(view, label).props.onChange({ target: { value } }); await view.flush(); }

test('TV flows default to lookup, preserve manual television and clear manual mode for other product types', async () => {
  const h = await load('lib/manual-tv.js');
  assert.deepEqual(h.tvSubscriptionFlowPayload({ type: 'TELEVISION' }), { tvSubscriptionFlow: 'SUBSCRIPTION_LOOKUP' });
  assert.deepEqual(h.tvSubscriptionFlowPayload({ type: 'TELEVISION', tvSubscriptionFlow: 'MANUAL_SELECTION' }), { tvSubscriptionFlow: 'MANUAL_SELECTION' });
  assert.deepEqual(h.tvSubscriptionFlowPayload({ type: 'ELECTRICITY', tvSubscriptionFlow: 'MANUAL_SELECTION' }), { tvSubscriptionFlow: 'SUBSCRIPTION_LOOKUP' });
  assert.throws(() => h.tvSubscriptionFlowPayload({ type: 'TELEVISION', tvSubscriptionFlow: 'UNKNOWN' }));
});

test('manual work guards require a complete captured selection and fresh matching eligibility', async () => {
  const h = await load('lib/manual-tv.js');
  assert.equal(h.manualTvBlocker(item, eligibility), '');
  assert.equal(h.manualTvBlocker(item, { ...eligibility, status: 'PROCESSING' }), ''); // Collected requests from the earlier backend remain inspectable.
  for (const patch of [{ transactionId: 92 }, { action: 'WITHDRAW_FROM_WALLET' }, { completable: 'true' }, { status: null }, { completable: false }, { status: 'COMPLETED' }]) assert.ok(h.manualTvBlocker(item, { ...eligibility, ...patch }));
  for (const patch of [{ status: 'EXECUTED' }, { optionCode: '' }, { amount: null }, { currency: '' }, { subscriberId: '' }]) assert.ok(h.manualTvBlocker({ ...item, ...patch }, eligibility));
  assert.match(h.manualTvBlocker(item, { ...eligibility, completable: false, reasonCode: 'bill_collection_not_confirmed' }), /Verified full collection/);
  assert.equal(h.manualTvProviderAmount({ amount: 0, currency: 'CDF' }), '0 CDF');
  assert.equal(h.manualTvProviderAmount({ amount: 15 }), 'Unavailable');
  assert.throws(() => h.manualTvPage(page([{ ...item, operationType: 'TV_RENEW' }])));
  assert.throws(() => h.manualTvPage(page([{ ...item, status: 'PENDING_COLLECTION' }])));
  assert.throws(() => h.manualTvPage([item]));
  assert.throws(() => h.manualTvIntent({ ...item, transactionId: null }));
  assert.throws(() => h.manualTvIntent(item, 9));
});

test('outcomes require explicit confirmation and a note; the payload cannot submit payment or selection fields', async () => {
  const h = await load('lib/manual-tv.js');
  for (const action of ['complete', 'fail', 'cancel']) assert.deepEqual(h.manualTvOutcomePayload(action, ' Reviewed provider confirmation ', true), { message: 'Reviewed provider confirmation' });
  for (const args of [['refund', 'note', true], ['complete', '', true], ['complete', 'x'.repeat(1001), true], ['complete', 'note', false]]) assert.throws(() => h.manualTvOutcomePayload(...args));
  for (const role of ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT', 'STAFF', 'CUSTOMER']) assert.deepEqual(h.manualTvPermissions(session(role)), { canRead: role !== 'CUSTOMER', canReconcile: ['ADMIN', 'SUPER_ADMIN'].includes(role) });
  assert.deepEqual(h.manualTvPermissions(null), { canRead: false, canReconcile: false });
});

test('TV completion includes only a valid explicitly entered date and never carries it into other outcomes', async () => {
  const h = await load('lib/manual-tv.js');
  assert.deepEqual(h.manualTvOutcomePayload('complete', 'Confirmed activation', true, ' 2027-02-28 '), { message: 'Confirmed activation', nextExpirationDate: '2027-02-28' });
  assert.deepEqual(h.tvCompletionExpiration('complete', 'PAY_TV_SUBSCRIPTION', '2028-02-29'), { nextExpirationDate: '2028-02-29' });
  for (const value of ['2027-02-29', '2027-04-31', '2027-13-01', '0000-01-01', '2027-02-28T23:00:00Z', 'tomorrow']) assert.throws(() => h.tvCompletionExpiration('complete', 'PAY_TV_SUBSCRIPTION', value));
  for (const action of ['fail', 'cancel']) assert.deepEqual(h.manualTvOutcomePayload(action, 'Reviewed', true, '2027-02-28'), { message: 'Reviewed' });
  assert.deepEqual(h.tvCompletionExpiration('complete', 'SEND_CRYPTO', '2027-02-28'), {});
  assert.deepEqual(h.manualTvOutcomePayload('complete', 'Confirmed activation', true, ''), { message: 'Confirmed activation' });
});

test('manual TV API calls only the filtered read queue and existing reconciliation endpoints', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'manual-tv-api'); api.setAuthToken('manual-tv-admin');
  const calls = []; global.fetch = async (url, init) => { calls.push({ url, init }); return init.method === 'POST' ? new Response(null, { status: 202 }) : Response.json({}); };
  await api.billPaymentIntents.list({ status: 'AWAITING_MANUAL_FULFILLMENT', page: 0, size: 20 }); await api.billPaymentIntents.get(8);
  await api.transactions.manualReconciliationEligibility(91);
  for (const method of ['completeManualReconciliation', 'failManualReconciliation', 'cancelManualReconciliation']) assert.equal(await api.transactions[method](91, { message: 'Activation confirmed' }), '');
  const query = new URL(calls[0].url, 'https://admin.local').searchParams;
  assert.deepEqual(Object.fromEntries(query), { status: 'AWAITING_MANUAL_FULFILLMENT', page: '0', size: '20' });
  assert.match(calls[1].url, /bill-payment-intents\/8$/); assert.match(calls[2].url, /transactions\/91\/manual-reconciliation\/eligibility$/);
  for (const [offset, action] of ['complete', 'fail', 'cancel'].entries()) {
    const call = calls[3 + offset]; assert.ok(call.url.endsWith(`/transactions/91/manual-reconciliation/${action}`));
    assert.equal(call.init.method, 'POST'); assert.deepEqual(JSON.parse(call.init.body), { message: 'Activation confirmed' });
  }
  for (const call of calls) { assert.equal(call.init.cache, 'no-store'); assert.equal(call.init.headers.Authorization, 'Bearer manual-tv-admin'); assert.doesNotMatch(call.url, /momo-status|post-webhook|refund-to-wallet|\/status$/); }
});

async function productEditor(row) {
  const h = await load('lib/manual-tv.js'), writes = [], rows = row ? [row] : [];
  const view = await mountComponent(path.join(__dirname, '../app/(dashboard)/dashboard/bills/products/page.js'), { props: {}, modules: {
    '@/components/CountrySelect': { CountrySelect: 'select' }, '@/components/RegulatorPresentation': { PresentationSelect: 'select', NonRegulatorContent: 'div', PresentationLink: 'a' },
    '@/lib/regulator-presentation': { regulatorVisibleFields: (values) => values, isRegulatorRestrictedRecord: () => false }, '@/contexts/AuthContext': { useAuth: () => ({ session: session('ADMIN'), enableRegulatorMode: false }) },
    '@/lib/api': { api: { countries: { options: async () => [] }, billProducts: { list: async () => page(rows), create: async (body) => writes.push({ body }), update: async (id, body) => writes.push({ id, body }) } } },
    '@/components/DataTable': { DataTable: 'data-table' }, '@/components/TableCell': { __esModule: true, default: 'span' }, '@/lib/manual-tv': h
  } });
  await view.flush();
  if (row) { const table = view.nodes().find((node) => node.type === 'data-table'); nodes(table.props.columns.find((column) => column.key === 'actions').render(row)).find((node) => node.type === 'button' && node.props.children === 'Edit').props.onClick(); await view.flush(); }
  const set = async (id, value) => { view.nodes().find((node) => node.props.id === id).props.onChange({ target: { value } }); await view.flush(); };
  return { view, writes, set };
}

test('product saves preserve manual flow during unrelated edits and update only the selected market record', async () => {
  for (const [id, code] of [[12, 'CANAL_PLUS_DRC'], [13, 'CANAL_PLUS_RWANDA']]) {
    const panel = await productEditor({ id, name: 'STARTIMES', code, displayName: 'TV product', type: 'TELEVISION', active: true, tvSubscriptionFlow: 'MANUAL_SELECTION', countryIds: [id] });
    assert.equal(panel.view.nodes().find((node) => node.props.id === 'tvSubscriptionFlow').props.value, 'MANUAL_SELECTION');
    await panel.set('displayName', 'Edited name'); await panel.view.click('Save');
    assert.equal(panel.writes[0].id, id); assert.equal(panel.writes[0].body.tvSubscriptionFlow, 'MANUAL_SELECTION'); assert.equal(panel.writes[0].body.code, code); assert.deepEqual(panel.writes[0].body.countryIds, [id]);
  }
});

test('product editor supports restoring lookup and hides manual selection when changing to a non-TV type', async () => {
  const base = { id: 12, name: 'CANAL_PLUS', code: 'CANAL_PLUS_DRC', displayName: 'TV', type: 'TELEVISION', active: true, tvSubscriptionFlow: 'MANUAL_SELECTION' };
  const lookup = await productEditor(base); await lookup.set('tvSubscriptionFlow', 'SUBSCRIPTION_LOOKUP'); await lookup.view.click('Save'); assert.equal(lookup.writes[0].body.tvSubscriptionFlow, 'SUBSCRIPTION_LOOKUP');
  const other = await productEditor(base); await other.set('type', 'ELECTRICITY'); assert.ok(!other.view.nodes().some((node) => node.props.id === 'tvSubscriptionFlow')); await other.view.click('Save'); assert.equal(other.writes[0].body.tvSubscriptionFlow, 'SUBSCRIPTION_LOOKUP');
  const old = await productEditor({ ...base, tvSubscriptionFlow: undefined }); assert.equal(old.view.nodes().find((node) => node.props.id === 'tvSubscriptionFlow').props.value, 'SUBSCRIPTION_LOOKUP');
});

async function review({ canReconcile = true, read, check, write } = {}) {
  const h = await load('lib/manual-tv.js'), events = [], resolved = [];
  const api = { billPaymentIntents: { get: async (id) => { events.push(`read:${id}`); return read ? read(events) : { ...item }; } }, transactions: {
    manualReconciliationEligibility: async (id) => { events.push(`check:${id}`); return check ? check(events) : { ...eligibility }; }
  } };
  for (const [action, method] of Object.entries({ complete: 'completeManualReconciliation', fail: 'failManualReconciliation', cancel: 'cancelManualReconciliation' })) api.transactions[method] = async (id, body) => { events.push({ action, id, body }); return write ? write(action, id, body) : null; };
  const fail = async (err) => err.message;
  const view = await mountComponent(path.join(__dirname, '../components/manual-tv/ManualTvReview.js'), { props: { item, canReconcile, fail, onClose() {}, onResolved: (action) => resolved.push(action) }, modules: {
    '@/components/ContentModal': { ContentModal: 'modal' }, '@/components/RegulatorPresentation': { PresentationLink: 'a' }, '@/lib/api': { api }, '@/lib/manual-tv': h
  } });
  await view.flush();
  const prepare = async (action = 'complete') => { await change(view, 'Outcome', action); await change(view, 'Operational note', 'Provider activation or failure confirmed'); view.check(true); await view.flush(); };
  return { view, events, resolved, prepare };
}

test('review reads exact selection and promotion literally; each confirmed outcome uses only reconciliation once', async () => {
  for (const [action, button] of [['complete', 'Confirm fulfillment'], ['fail', 'Mark failed'], ['cancel', 'Cancel payment']]) {
    const panel = await review(); assert.deepEqual(panel.events, ['read:8', 'check:91']); assert.match(panel.view.text(), /REAL-FREE-OPTION/); assert.match(panel.view.text(), /<b>Literal promotion<\/b>/); assert.match(panel.view.text(), /Captured target offer/);
    assert.ok(!panel.view.nodes().some((node) => node.props.dangerouslySetInnerHTML));
    await panel.prepare(action); await panel.view.click(button);
    assert.deepEqual(panel.events, ['read:8', 'check:91', 'read:8', 'check:91', { action, id: 91, body: { message: 'Provider activation or failure confirmed' } }]); assert.deepEqual(panel.resolved, [action]);
  }
});

test('manual TV completion sends the entered expiration date and changing it requires confirmation again', async () => {
  const panel = await review(); await panel.prepare();
  await change(panel.view, 'Next expiration date', '2027-02-28'); assert.equal(panel.view.button('Confirm fulfillment').disabled, true);
  panel.view.check(true); await panel.view.flush(); await panel.view.click('Confirm fulfillment');
  assert.deepEqual(panel.events.find((event) => typeof event === 'object'), { action: 'complete', id: 91, body: { message: 'Provider activation or failure confirmed', nextExpirationDate: '2027-02-28' } });
  const failure = await review(); await failure.prepare(); await change(failure.view, 'Next expiration date', '2027-02-28'); await change(failure.view, 'Outcome', 'fail');
  assert.equal(input(failure.view, 'Next expiration date'), undefined); failure.view.check(true); await failure.view.flush(); await failure.view.click('Mark failed');
  assert.deepEqual(failure.events.find((event) => typeof event === 'object').body, { message: 'Provider activation or failure confirmed' });
});

test('unsupported backends block date submission and uncertain responses preserve the entered date', async () => {
  const old = await review({ check: () => ({ ...eligibility, nextExpirationDateSupported: undefined }) }); await old.prepare(); await change(old.view, 'Next expiration date', '2027-02-28'); old.view.check(true); await old.view.flush();
  assert.equal(old.view.button('Confirm fulfillment').disabled, true); await old.view.click('Confirm fulfillment'); assert.ok(old.events.every((event) => typeof event === 'string'));
  const uncertain = await review({ write: async () => { throw new Error('Response lost'); } }); await uncertain.prepare(); await change(uncertain.view, 'Next expiration date', '2027-02-28'); uncertain.view.check(true); await uncertain.view.flush(); await uncertain.view.click('Confirm fulfillment');
  assert.equal(input(uncertain.view, 'Next expiration date').props.value, '2027-02-28'); await uncertain.view.click('Refresh latest state'); assert.equal(input(uncertain.view, 'Next expiration date').props.value, '2027-02-28'); assert.equal(uncertain.view.button('Confirm fulfillment').disabled, true);
});

test('unconfirmed collection, refund fences, closed and malformed work items cannot be submitted', async () => {
  for (const params of [
    { read: () => ({ ...item, status: 'EXECUTED' }) },
    { check: () => ({ ...eligibility, completable: false, reasonCode: 'bill_collection_not_confirmed' }) },
    { check: () => ({ ...eligibility, status: 'COMPLETED' }) },
    { check: () => ({ ...eligibility, transactionId: 92 }) },
    { read: () => ({ ...item, optionCode: '' }) }
  ]) {
    const panel = await review(params); assert.ok(panel.view.nodes().find((node) => node.type === 'fieldset').props.disabled); assert.ok(panel.events.every((event) => typeof event === 'string')); assert.deepEqual(panel.resolved, []);
  }
  const wrong = await review({ read: () => ({ ...item, transactionId: 99 }) }); assert.ok(!wrong.view.nodes().some((node) => node.type === 'fieldset')); assert.match(wrong.view.text(), /transaction changed/);
});

test('a changed captured selection or collection state requires another review and sends no action', async () => {
  let reads = 0;
  const panel = await review({ read: () => ({ ...item, offerCode: ++reads === 1 ? item.offerCode : 'NEW-CODE' }) });
  await panel.prepare(); await panel.view.click('Confirm fulfillment');
  assert.match(panel.view.text(), /stored selection changed/); assert.match(panel.view.text(), /NEW-CODE/); assert.equal(panel.view.button('Confirm fulfillment').disabled, true); assert.ok(panel.events.every((event) => typeof event === 'string'));
  panel.view.check(true); await panel.view.flush(); await panel.view.click('Confirm fulfillment'); assert.deepEqual(panel.resolved, ['complete']);
  let checks = 0;
  const blocked = await review({ check: () => ++checks === 1 ? eligibility : { ...eligibility, completable: false, reasonCode: 'bill_collection_not_confirmed' } });
  await blocked.prepare(); await blocked.view.click('Confirm fulfillment'); assert.ok(blocked.events.every((event) => typeof event === 'string')); assert.match(blocked.view.text(), /Verified full collection/);
});

test('uncertain and conflicting submissions retain notes and require refreshing and fresh confirmation', async () => {
  for (const status of [undefined, 409, 500]) {
    const panel = await review({ write: async () => { throw Object.assign(new Error('Outcome unconfirmed'), { status }); } });
    await panel.prepare(); await panel.view.click('Confirm fulfillment');
    assert.equal(input(panel.view, 'Operational note').props.value, 'Provider activation or failure confirmed'); assert.equal(panel.view.button('Confirm fulfillment').disabled, true);
    await panel.view.click('Confirm fulfillment'); assert.equal(panel.events.filter((event) => typeof event === 'object').length, 1);
    await panel.view.click('Refresh latest state'); assert.equal(panel.view.button('Confirm fulfillment').disabled, true); assert.deepEqual(panel.resolved, []);
  }
});

test('read-only admins cannot submit outcomes and a denied writer stays read-only', async () => {
  const reader = await review({ canReconcile: false }); assert.match(reader.view.text(), /Read only/); assert.ok(!reader.view.nodes().some((node) => node.type === 'fieldset')); assert.ok(reader.events.every((event) => typeof event === 'string'));
  const denied = await review({ write: async () => { throw Object.assign(new Error('Permission denied'), { status: 403 }); } });
  await denied.prepare(); await denied.view.click('Confirm fulfillment'); assert.match(denied.view.text(), /Read only/); assert.ok(!denied.view.nodes().some((node) => node.type === 'fieldset'));
});

test('a running reconciliation blocks duplicate clicks and confirmation edits', async () => {
  const pending = deferred(), panel = await review({ write: () => pending.promise });
  await panel.prepare(); const running = panel.view.click('Confirm fulfillment'); await panel.view.flush();
  await panel.view.click('Confirm fulfillment'); await change(panel.view, 'Operational note', 'A second note');
  assert.equal(input(panel.view, 'Operational note').props.value, 'Provider activation or failure confirmed'); assert.equal(panel.events.filter((event) => typeof event === 'object').length, 1);
  pending.resolve(null); await running; await panel.view.flush(); assert.deepEqual(panel.resolved, ['complete']);
});

async function queue({ role = 'ADMIN', list } = {}) {
  const h = await load('lib/manual-tv.js'), calls = [], refreshSession = async () => {};
  const view = await mountComponent(path.join(__dirname, '../components/manual-tv/ManualTvQueue.js'), { props: {}, modules: {
    '@/contexts/AuthContext': { useAuth: () => ({ session: session(role), refreshSession }) }, '@/lib/manual-tv': h,
    '@/lib/api': { api: { billPaymentIntents: { list: async (params) => { calls.push(params); return list ? list(params) : page(); } } } },
    '@/components/RegulatorPresentation': { PresentationLink: 'a' }, '@/components/DataTable': { DataTable: 'data-table' }, '@/components/TableCell': { __esModule: true, default: 'span', TableCellLines: 'span' }, './ManualTvReview': { __esModule: true, default: 'review' }
  } });
  await view.flush(); return { view, calls, table: () => view.nodes().find((node) => node.type === 'data-table')?.props };
}

test('queue filters before pagination, keeps one review action and refreshes after reconciliation', async () => {
  const panel = await queue(); assert.deepEqual(panel.calls, [{ status: 'AWAITING_MANUAL_FULFILLMENT', page: 0, size: 20 }]);
  const actions = nodes(panel.table().columns.find((column) => column.key === 'actions').render(item)); assert.equal(actions.filter((node) => node.type === 'button').length, 1);
  actions.find((node) => node.type === 'button').props.onClick(); await panel.view.flush();
  const modal = panel.view.nodes().find((node) => node.type === 'review'); assert.equal(modal.props.canReconcile, true); modal.props.onResolved('complete'); await panel.view.flush(); assert.equal(panel.calls.length, 2);
  const reader = await queue({ role: 'ASSISTANT' }); assert.match(reader.view.text(), /Read only/);
  const none = await queue({ role: 'CUSTOMER' }); assert.deepEqual(none.calls, []); assert.equal(none.table(), undefined);
});

test('queue errors clear rows and late responses cannot replace a newer page', async () => {
  const pending = deferred();
  const panel = await queue({ list: (params) => params.page === 1 ? pending.promise : page([{ ...item, id: params.page + 8 }], 3) });
  const navigate = panel.table().onPageChange;
  navigate(1); await panel.view.flush(); assert.equal(panel.table(), undefined);
  navigate(2); await panel.view.flush(); assert.equal(panel.table().rows[0].id, 10);
  pending.resolve(page([{ ...item, id: 9 }], 3)); await panel.view.flush(); assert.equal(panel.table().rows[0].id, 10);
  let fail = false;
  const error = await queue({ list: () => { if (fail) throw new Error('Queue unavailable'); return page(); } }); fail = true; await error.view.click('Refresh queue'); assert.equal(error.table(), undefined); assert.match(error.view.text(), /Queue unavailable/);
});
