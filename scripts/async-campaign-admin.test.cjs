const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const React = require('react');
const { mountComponent } = require('./helpers/component-harness.cjs');
const root = path.join(__dirname, '..');
const load = file => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(root, file), 'utf8')).toString('base64')}`);
const text = node => Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text(node.props.children) : node == null || typeof node === 'boolean' ? '' : String(node);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function clock(t) {
  const timers = new Map(); let id = 0;
  const saved = { setTimeout: global.setTimeout, clearTimeout: global.clearTimeout, document: global.document };
  global.document = { hidden: false };
  global.setTimeout = (fn, delay) => { timers.set(++id, { fn, delay }); return id; };
  global.clearTimeout = key => timers.delete(key);
  t.after(() => { global.setTimeout = saved.setTimeout; global.clearTimeout = saved.clearTimeout; if (saved.document === undefined) delete global.document; else global.document = saved.document; });
  return { timers, next() { const [key, timer] = timers.entries().next().value || []; assert.ok(timer, 'Expected a scheduled poll'); timers.delete(key); return timer.fn(); } };
}
async function modules(api, role = 'ADMIN') {
  return {
    '@/lib/api': { api }, 'next/navigation': { useSearchParams: () => new URLSearchParams() },
    '@/lib/notification-business-audience': await load('lib/notification-business-audience.js'),
    '@/lib/push-campaigns': await load('lib/push-campaigns.js'),
    '@/lib/announcement-popup': await load('lib/announcement-popup.js'),
    '@/components/BusinessAudienceHelp': { __esModule: true, default: 'business-help' },
    '@/components/CountrySelect': { CountryListField: 'country-list', CountrySelect: 'select' },
    '@/components/CatalogSelect': { CatalogSelect: 'select' },
    '@/components/RegulatorPresentation': { PresentationSelect: 'select', PresentationLink: 'a', NonRegulatorContent: 'regular-content', RegulatorRecord: 'record' },
    '@/lib/regulator-presentation': { isRegulatorRestrictedRecord: () => false, isRegulatorRestrictedService: () => false },
    '@/contexts/AuthContext': { useAuth: () => ({ enableRegulatorMode: false, session: { tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } }, refreshSession: async () => {} }) },
    '@/components/AnnouncementPopupFields': { AnnouncementPopupFields: 'popup-fields' },
    '@/lib/payment-method-labels': { paymentMethodAdminLabel: row => row.name || '' },
    '@/components/ResponsiveTable': { __esModule: true, default: 'table' }
  };
}
async function mount(t, notifications, anonymous = false) {
  const api = { countries: { options: async () => [] }, paymentMethods: { options: async () => [] }, paymentProviders: { list: async () => [] }, billProducts: { options: async () => [] }, notifications };
  const name = anonymous ? 'notification-anonymous-push-campaigns' : 'notification-push-campaigns';
  const view = await mountComponent(path.join(root, `app/(dashboard)/dashboard/${name}/page.js`), { modules: await modules(api) });
  t.after(() => view.unmount()); await view.flush();
  for (const [label, value] of [['Subject', 'News'], ['Message', 'Hello']]) {
    const parent = view.nodes().find(node => node.type === 'label' && text(node) === label);
    const input = parent.props.htmlFor ? view.nodes().find(node => node.props.id === parent.props.htmlFor) : React.Children.toArray(parent.props.children).find(node => ['input', 'textarea'].includes(node.type));
    input.props.onChange({ target: { value } }); await view.flush();
  }
  return view;
}

test('account campaign acceptance releases the form before status lookup and polls through preparation failures and delivery', async t => {
  const time = clock(t); let posts = 0, reads = 0;
  const outcomes = [
    { status: 'PREPARING', preparationStatus: 'PREPARING', scannedRecords: 100, matchedRecipients: 75, pendingJobs: 75, completed: false },
    new Error('Temporary status failure'),
    { status: 'FAILED', preparationStatus: 'FAILED', preparationError: 'Preparation stopped', scannedRecords: 100, pendingJobs: 1, completed: false },
    { status: 'FAILED', preparationStatus: 'FAILED', preparationError: 'Preparation stopped', scannedRecords: 100, pendingJobs: 0, completed: true }
  ];
  const view = await mount(t, {
    createPushCampaign: async () => { posts++; return { campaignId: 'CMP-1', status: 'QUEUED', pollAfterSeconds: 3 }; },
    getPushCampaign: async () => { reads++; const value = outcomes.shift(); if (value instanceof Error) throw value; return { campaignId: 'CMP-1', found: true, ...value }; }
  });
  await view.click('Launch campaign');
  assert.equal(posts, 1); assert.equal(reads, 0); assert.equal(view.button('Launch campaign').disabled, false);
  assert.match(view.text(), /QUEUED/); assert.match(view.text(), /Preparing…/);
  for (let i = 0; i < 4; i++) { await time.next(); await view.flush(); }
  assert.equal(reads, 4); assert.equal(posts, 1); assert.match(view.text(), /Preparation stopped/);
  assert.equal(time.timers.size, 0, 'Stop only after delivery processing also finishes');
});

test('polling skips hidden screens, does not overlap slow requests, and ignores results after unmount', async t => {
  const time = clock(t), pending = deferred(); let reads = 0;
  const view = await mount(t, {
    createPushCampaign: async () => ({ campaignId: 'CMP-slow', status: 'QUEUED', pollAfterSeconds: 3 }),
    getPushCampaign: async () => { reads++; return pending.promise; }
  });
  await view.click('Launch campaign'); global.document.hidden = true;
  await time.next(); await view.flush(); assert.equal(reads, 0);
  global.document.hidden = false;
  const inFlight = time.next(); await view.flush(); assert.equal(reads, 1); assert.equal(time.timers.size, 0);
  view.unmount(); pending.resolve({ campaignId: 'CMP-slow', found: true, completed: false });
  await inFlight; await view.flush(); assert.equal(time.timers.size, 0);
});

test('anonymous campaigns also release the form, keep progress after transient errors and stop when complete', async t => {
  const time = clock(t); let posts = 0, reads = 0;
  const view = await mount(t, {
    createAnonymousPushCampaign: async () => { posts++; return { campaignId: 'ACMP-1', status: 'QUEUED', pollAfterSeconds: 3 }; },
    getPushCampaign: async () => { reads++; if (reads === 2) throw new Error('Try again'); return { campaignId: 'ACMP-1', status: reads === 1 ? 'PREPARING' : 'COMPLETED', scannedRecords: 40, completed: reads === 3 }; }
  }, true);
  await view.click('Launch anonymous push campaign'); assert.equal(reads, 0); assert.equal(posts, 1);
  assert.equal(view.button('Launch anonymous push campaign').disabled, false);
  await time.next(); await view.flush(); assert.match(view.text(), /Scanned: 40/);
  await time.next(); await view.flush(); assert.match(view.text(), /Try again/); assert.match(view.text(), /Scanned: 40/);
  await time.next(); await view.flush(); assert.match(view.text(), /COMPLETED/); assert.equal(time.timers.size, 0); assert.equal(posts, 1);
});

test('history polls one summary page rather than issuing a request for every active campaign', async t => {
  const time = clock(t); let reads = 0, details = 0;
  const api = { notifications: {
    listPushCampaigns: async () => { reads++; return { campaigns: Array.from({ length: 20 }, (_, i) => ({ campaignId: `CMP-${i}`, status: reads === 1 ? 'QUEUED' : 'FAILED', preparationStatus: reads === 1 ? 'QUEUED' : 'FAILED', completed: reads > 1 })), totalCampaigns: 20, hasNext: false }; },
    getPushCampaign: async () => { details++; }
  } };
  const view = await mountComponent(path.join(root, 'app/(dashboard)/dashboard/notification-push-campaign-history/page.js'), { modules: await modules(api) });
  t.after(() => view.unmount()); await view.flush(); assert.equal(reads, 1);
  await time.next(); await view.flush(); assert.equal(reads, 2); assert.equal(details, 0); assert.equal(time.timers.size, 0);
  assert.match(view.text(), /FAILED/);
});

test('the authenticated API wrapper accepts HTTP 202 for both campaign routes without issuing a status request', async t => {
  const previous = global.fetch; t.after(() => { global.fetch = previous; });
  const { api } = await load('lib/api.js'); api.setAuthToken('test-campaign-token');
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return Response.json({ campaignId: 'CMP-accepted', status: 'QUEUED', pollAfterSeconds: 3 }, { status: 202, headers: { Location: '/admin-api/notifications/push-campaign/CMP-accepted', 'Retry-After': '3' } });
  };
  for (const send of [api.notifications.createPushCampaign, api.notifications.createAnonymousPushCampaign]) {
    const result = await send({ subject: 'News', message: 'Hello' });
    assert.equal(result.status, 'QUEUED'); assert.equal(result.pollAfterSeconds, 3);
  }
  assert.equal(calls.length, 2);
  for (const { init } of calls) { assert.equal(init.method, 'POST'); assert.equal(init.headers.Authorization, 'Bearer test-campaign-token'); }
});

test('rapid repeated anonymous launch clicks create only one campaign while acceptance is pending', async t => {
  clock(t); const acceptance = deferred(); let posts = 0;
  const view = await mount(t, { createAnonymousPushCampaign: async () => { posts++; return acceptance.promise; } }, true);
  const click = view.button('Launch anonymous push campaign').onClick;
  const a = click(), b = click(); await view.flush(); assert.equal(posts, 1);
  acceptance.resolve({ campaignId: 'ACMP-once', status: 'QUEUED' });
  await Promise.all([a, b]); await view.flush(); assert.equal(posts, 1); assert.equal(view.button('Launch anonymous push campaign').disabled, false);
});

test('acceptance uses Location and Retry-After headers, and campaign deletion encodes its exact ID/type and handles 204', async t => {
  const previous = global.fetch; t.after(() => { global.fetch = previous; }); const calls = [];
  const { api } = await load('lib/api.js'); api.setAuthToken('campaign-admin');
  global.fetch = async (url, init) => { calls.push({ url, init }); return init.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({ status: 'QUEUED', pollAfterSeconds: 3 }, { status: 202, headers: { Location: '/admin-api/notifications/push-campaign/ACMP-header', 'Retry-After': '8' } }); };
  const accepted = await api.notifications.createAnonymousPushCampaign({ subject: 'News', message: 'Hello' }); assert.equal(accepted.campaignId, 'ACMP-header'); assert.equal(accepted.pollAfterSeconds, 8); assert.match(accepted.statusUrl, /ACMP-header$/);
  assert.equal(await api.notifications.deletePushCampaign('CMP-a/b+?', 'ACCOUNT'), null);
  const deleted = calls[1]; assert.equal(deleted.init.method, 'DELETE'); assert.equal(deleted.init.body, undefined); assert.equal(deleted.init.cache, 'no-store'); assert.equal(deleted.init.headers.Authorization, 'Bearer campaign-admin');
  const url = new URL(deleted.url, 'https://admin.local'); assert.equal(decodeURIComponent(url.pathname.split('/').at(-1)), 'CMP-a/b+?'); assert.equal(url.searchParams.get('campaignType'), 'ACCOUNT');
});

test('long server poll intervals are respected, malformed status retains progress, and not-found stops polling', async t => {
  const time = clock(t); let reads = 0;
  const view = await mount(t, { createPushCampaign: async () => ({ campaignId: 'CMP-wait', status: 'QUEUED', pollAfterSeconds: 90 }), getPushCampaign: async () => ++reads === 1 ? null : ({ campaignId: 'CMP-wait', found: false, status: 'NOT_FOUND' }) });
  await view.click('Launch campaign'); assert.equal([...time.timers.values()][0].delay, 90000); await time.next(); await view.flush(); assert.match(view.text(), /QUEUED/); assert.match(view.text(), /could not be read/); assert.equal([...time.timers.values()][0].delay, 90000);
  await time.next(); await view.flush(); assert.match(view.text(), /NOT_FOUND/); assert.equal(time.timers.size, 0);
});

test('ambiguous launches require checking history before another explicit POST for both audience types', async t => {
  clock(t);
  for (const anonymous of [false, true]) {
    let posts = 0;
    const view = await mount(t, { [anonymous ? 'createAnonymousPushCampaign' : 'createPushCampaign']: async () => { posts++; throw new Error('Response lost'); } }, anonymous);
    const label = anonymous ? 'Launch anonymous push campaign' : 'Launch campaign';
    await view.click(label); assert.match(view.text(), /Acceptance is unconfirmed/); assert.equal(view.button(label).disabled, true); await view.click(label); assert.equal(posts, 1);
    await view.click('I checked history — allow a new launch'); assert.equal(view.button(label).disabled, false); await view.click(label); assert.equal(posts, 2);
  }
});

test('switching the tracked campaign ignores an earlier status response and resumes after a completed campaign', async t => {
  const time = clock(t), old = deferred(); let reads = 0;
  const view = await mount(t, { createPushCampaign: async () => ({ campaignId: 'CMP-old', status: 'QUEUED' }), getPushCampaign: async id => { reads++; return id === 'CMP-old' ? old.promise : { campaignId: id, found: true, completed: true, status: 'COMPLETED' }; } });
  await view.click('Launch campaign'); const pending = time.next(); await view.flush(); assert.equal(reads, 1);
  view.nodes().find(node => node.props['aria-label'] === 'Campaign ID').props.onChange({ target: { value: 'CMP-new' } }); await view.flush();
  old.resolve({ campaignId: 'CMP-old', found: true, completed: true, status: 'COMPLETED' }); await pending; await view.flush();
  await time.next(); await view.flush(); assert.equal(reads, 2); assert.equal(time.timers.size, 0);
  view.nodes().find(node => node.props['aria-label'] === 'Campaign ID').props.onChange({ target: { value: 'CMP-third' } }); await view.flush(); assert.equal(time.timers.size, 1);
});

const row = (extra = {}) => ({ campaignId: 'CMP-finished', campaignType: 'ACCOUNT', subject: 'Finished news', message: 'Hello', totalJobs: 5, pendingJobs: 0, processingJobs: 0, processedJobs: 5, failedJobs: 0, completed: true, enqueuing: false, deletable: true, status: 'COMPLETED', ...extra });
async function history(t, { role = 'ADMIN', rows = [row()], list, remove, detail } = {}) {
  const state = { rows, reads: [], deletes: [], details: [] };
  const api = { notifications: {
    listPushCampaigns: async params => { const query = Object.fromEntries(params); state.reads.push(query); return list ? list(query, state) : { campaigns: state.rows, totalCampaigns: state.rows.length, hasNext: false }; },
    getPushCampaign: async id => { state.details.push(id); return detail ? detail(id, state) : { ...state.rows.find(item => item.campaignId === id), found: true }; },
    deletePushCampaign: async (id, type) => { state.deletes.push({ id, type }); if (remove) return remove(id, type, state); state.rows = state.rows.filter(item => item.campaignId !== id || item.campaignType !== type); return null; }
  } };
  const view = await mountComponent(path.join(root, 'app/(dashboard)/dashboard/notification-push-campaign-history/page.js'), { modules: await modules(api, role) }); t.after(() => view.unmount()); await view.flush();
  const openDelete = async (at = 0) => { view.nodes().filter(node => node.type === 'button' && text(node) === 'Delete')[at].props.onClick({ stopPropagation() {} }); await view.flush(); };
  return { view, state, openDelete };
}

test('finished campaign deletion requires confirmation with its exact type and refreshes server totals', async t => {
  const { view, state, openDelete } = await history(t, { rows: [row({ campaignId: 'ACMP-finished', campaignType: 'ANONYMOUS' })] });
  await openDelete(); assert.equal(state.deletes.length, 0); assert.match(view.text(), /ANONYMOUS/); assert.match(view.text(), /linked in-app announcement is kept/); await view.click('Cancel deletion'); assert.equal(state.deletes.length, 0);
  await openDelete(); await view.click('Confirm delete campaign'); assert.deepEqual(state.deletes, [{ id: 'ACMP-finished', type: 'ANONYMOUS' }]); assert.equal(state.reads.length, 2); assert.match(view.text(), /0 campaigns total/); assert.match(view.text(), /removed from history/);
});

test('only mutation roles can delete and only explicit deletable rows with a known type can be confirmed', async t => {
  const assistant = await history(t, { role: 'ASSISTANT' }); assert.equal(assistant.state.reads.length, 1); assert.match(assistant.view.text(), /Read only/); assert.equal(assistant.view.nodes().some(node => node.type === 'button' && text(node) === 'Delete'), false);
  const staff = await history(t, { role: 'STAFF' }); assert.equal(staff.state.reads.length, 0);
  for (const values of [{ deletable: false, enqueuing: true }, { deletable: undefined }, { campaignType: undefined }]) {
    const result = await history(t, { rows: [row(values)] }); assert.equal(result.view.button('Delete').disabled, true); await result.openDelete(); assert.doesNotMatch(result.view.text(), /Confirm delete campaign/); assert.equal(result.state.deletes.length, 0);
  }
});

test('a deletion conflict keeps the campaign, refreshes it and requires a fresh confirmation', async t => {
  const { view, state, openDelete } = await history(t, { remove: async (_id, _type, current) => { current.rows = [row({ deletable: false, completed: false, pendingJobs: 1, status: 'DELIVERING' })]; throw Object.assign(new Error('Only finished campaigns can be deleted'), { status: 409 }); } });
  clock(t); await openDelete(); await view.click('Confirm delete campaign'); assert.equal(state.deletes.length, 1); assert.equal(state.reads.length, 2); assert.match(view.text(), /Only finished campaigns/); assert.match(view.text(), /DELIVERING/); assert.equal(view.button('Delete').disabled, true); assert.doesNotMatch(view.text(), /Confirm delete campaign/);
});

test('deleting the last row of a later page returns to the previous page and reloads its totals', async t => {
  let deleted = false;
  const { view, state, openDelete } = await history(t, { list: async query => ({ campaigns: query.page === '0' ? [row({ campaignId: 'CMP-earlier', subject: 'Earlier news' })] : deleted ? [] : [row()], totalCampaigns: deleted ? 1 : 2, hasNext: query.page === '0' && !deleted }), remove: async () => { deleted = true; } });
  view.nodes().find(node => node.props.id === 'historyPage').props.onChange({ target: { value: '1' } }); await view.flush(); await openDelete(); await view.click('Confirm delete campaign');
  assert.deepEqual(state.reads.map(query => query.page), ['0', '1', '1', '0']); assert.equal(view.nodes().find(node => node.props.id === 'historyPage').props.value, 0); assert.match(view.text(), /Earlier news/); assert.match(view.text(), /1 campaigns total/);
});

test('slow deletion cannot be duplicated or dismissed, and forbidden deletion removes mutation controls', async t => {
  const wait = deferred(); const result = await history(t, { remove: async () => wait.promise }); await result.openDelete(); await result.view.click('Confirm delete campaign'); await result.view.click('Deleting…'); await result.view.click('Cancel deletion'); assert.equal(result.state.deletes.length, 1); assert.ok(result.view.nodes().some(node => node.props.title === 'Delete finished campaign?'));
  wait.resolve(null); await result.view.flush();
  const denied = await history(t, { remove: async () => { throw Object.assign(new Error('Not permitted'), { status: 403 }); } }); await denied.openDelete(); await denied.view.click('Confirm delete campaign'); assert.equal(denied.state.deletes.length, 1); assert.match(denied.view.text(), /Not permitted/); assert.equal(denied.view.nodes().some(node => node.type === 'button' && text(node) === 'Delete'), false);
});

test('history status errors retain the last progress and one summary poll updates an open detail', async t => {
  const time = clock(t);
  const { view, state } = await history(t, { rows: [row({ completed: false, enqueuing: true, deletable: false, status: 'PREPARING' })], list: async (_query, current) => { if (current.reads.length === 2) throw new Error('Read timed out'); return { campaigns: current.reads.length > 2 ? [row({ preparationStatus: 'COMPLETED' })] : current.rows, totalCampaigns: 1 }; } });
  view.nodes().find(node => node.type === 'tr' && node.props.onClick).props.onClick(); await view.flush(); assert.equal(state.details.length, 1);
  await time.next(); await view.flush(); assert.match(view.text(), /Read timed out/); assert.match(view.text(), /Finished news/); assert.equal([...time.timers.values()][0].delay, 24000);
  await time.next(); await view.flush(); assert.equal(state.details.length, 1); assert.equal(time.timers.size, 0); assert.match(view.text(), /COMPLETED/);
});

test('history serializes list requests and a late old page cannot overwrite a newer page', async t => {
  const time = clock(t), pending = deferred();
  const { view, state } = await history(t, { list: async (query, current) => current.reads.length === 2 ? pending.promise : { campaigns: [row({ campaignId: query.page === '0' ? 'CMP-old' : 'CMP-new', subject: query.page === '0' ? 'Old page' : 'New page', completed: query.page !== '0' })], totalCampaigns: 2, hasNext: query.page === '0' } });
  const flight = time.next(); await view.flush(); assert.equal(state.reads.length, 2);
  view.nodes().find(node => node.props.id === 'historyPage').props.onChange({ target: { value: '1' } }); await view.flush(); assert.equal(state.reads.length, 2);
  pending.resolve({ campaigns: [row({ subject: 'Stale old response' })], totalCampaigns: 2 }); await flight; await view.flush();
  assert.equal(state.reads.length, 3); assert.equal(state.reads[2].page, '1'); assert.match(view.text(), /New page/); assert.doesNotMatch(view.text(), /Stale old response/); assert.equal(time.timers.size, 0);
});
