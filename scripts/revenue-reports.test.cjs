const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const read = file => readFileSync(path.join(__dirname, '..', file), 'utf8');
const url = value => 'data:text/javascript;base64,' + Buffer.from(value).toString('base64');
const helpers = import(url(read('lib/revenue-reports.js')));
const key = 'f8ab243b-bceb-403c-b876-9b7c7c738d6b';
const request = { month: '2026-10', language: 'fr', timeZone: 'UTC' };
const job = { id: key, reportType: 'TRANSACTION_NET_PROFIT', status: 'COMPLETED', fromDate: '2026-10-01', toDate: '2026-10-31', language: 'fr', timeZone: 'UTC', currency: 'USD', expiresAt: '2026-11-22T12:00:00Z', downloadUrlExpiresAt: '2026-11-21T12:05:00Z', downloadUrl: 'https://files.example/report.pdf?signature=sample' };
test('month and custom range requests retain selected language/timezone and default to the prior month across years', async () => {
  const h = await helpers;
  assert.equal(h.previousReportMonth(new Date('2026-01-01T01:00:00Z')), '2025-12');
  assert.deepEqual(h.reportRequest({ ...request, mode: 'month', timeZone: ' UTC ', from: 'ignored' }), request);
  assert.deepEqual(h.reportRequest({ mode: 'range', from: '2026-10-01', to: '2026-10-02', language: 'en', timeZone: 'Africa/Kinshasa', month: 'ignored' }), { from: '2026-10-01', to: '2026-10-02', language: 'en', timeZone: 'Africa/Kinshasa' });
});
test('reload recovery keeps the original submission key/body but never another account or signed URLs', async () => {
  const h = await helpers, original = { actor: '1', key, request, jobId: key, downloadUrl: job.downloadUrl };
  const recovered = h.readReportIntent(JSON.stringify(original), 1);
  assert.deepEqual(recovered, { actor: '1', key, request, jobId: key });
  assert.equal(h.readReportIntent(JSON.stringify(original), 2), null);
  assert.equal(h.readReportIntent('{corrupt', 1), null);
  assert.equal(h.readReportIntent(JSON.stringify({ ...original, jobId: '../escape' }), 1), null);
  assert.notEqual(h.reportStorageKey(1), h.reportStorageKey(2));
});
test('unknown status, wrong report identity/period/currency cannot be treated as a finished report', async () => {
  const h = await helpers;assert.equal(h.checkedReport(job, key, request), job);
  for (const change of [{ id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa' }, { status: 'ACCEPTED' }, { currency: 'CDF' }, { language: 'en' }, { fromDate: '2026-11-01' }]) assert.throws(() => h.checkedReport({ ...job, ...change }, key, request));
  for (const change of [{ downloadUrl: 'javascript:alert(1)' }, { downloadUrl: 'http://files.example/r.pdf' }, { downloadUrl: 'https://user:secret@files.example/r.pdf' }, { downloadUrlExpiresAt: 'bad' }, { status: 'PROCESSING' }]) assert.equal(h.reportDownload({ ...job, ...change }, Date.parse('2026-11-21T12:00:00Z')), null);
  assert.equal(h.reportDownload(job, Date.parse('2026-11-21T12:06:00Z')), null);
  assert.equal(h.reportDownload(job, Date.parse('2026-11-21T12:00:00Z')), job.downloadUrl);
});
test('report submission and retries send the same idempotency key/body; polling is a read only authenticated no-store request', { concurrency: false }, async () => {
  const calls = [], previous = global.fetch;let attempt = 0;
  global.fetch = async (target, init) => { calls.push({ target, init }); if (init.method === 'POST' && attempt++ === 0) throw new Error('Lost response'); return new Response(JSON.stringify(job), { headers: { 'content-type': 'application/json' } }); };
  try {
    const { api } = await import(url(read('lib/api.js')) + '#revenue-reports');api.setAuthToken('test-token');
    await assert.rejects(api.revenueReports.create(request, key));await api.revenueReports.create(request, key);await api.revenueReports.get(key);
    assert.equal(calls[0].init.body, calls[1].init.body);assert.equal(calls[0].init.headers['Idempotency-Key'], key);assert.equal(calls[1].init.headers['Idempotency-Key'], key);
    assert.match(calls[2].target, new RegExp('/dashboard/revenue-reports/' + key + '$'));assert.equal(calls[2].init.body, undefined);
    for (const call of calls) { assert.equal(call.init.cache, 'no-store');assert.equal(call.init.headers.Authorization, 'Bearer test-token');assert.doesNotMatch(call.target, /refund|transactions|payments/); }
  } finally { global.fetch = previous; }
});

test('period validation handles leap years, timezone dates and the inclusive 366-day limit', async () => {
  const h = await helpers, now = new Date('2026-11-01T00:30:00Z');
  assert.equal(h.reportToday('America/Los_Angeles', now), '2026-10-31');
  assert.equal(h.reportToday('Africa/Kinshasa', now), '2026-11-01');
  assert.equal(h.reportToday('UTC-02:00', now), '2026-10-31');
  assert.equal(h.reportToday('UTC+14:00', new Date('2026-12-31T12:00:00Z')), '2027-01-01');
  assert.equal(h.reportToday('UTC+19:00', now), null);
  assert.doesNotThrow(() => h.reportRequest({ mode: 'range', from: '2024-01-01', to: '2024-12-31', language: 'en', timeZone: 'UTC' }, now));
  for (const input of [{ mode: 'range', from: '2024-01-01', to: '2025-01-01' }, { mode: 'range', from: '2026-02-30', to: '2026-03-01' }, { mode: 'range', from: '2026-10-02', to: '2026-10-01' }, { mode: 'month', month: '2026-13' }, { mode: 'month', month: '1999-12' }, { mode: 'month', month: '2026-11', timeZone: 'America/Los_Angeles' }]) assert.throws(() => h.reportRequest({ language: 'en', timeZone: 'UTC', ...input }, now));
  assert.equal(h.readReportIntent(JSON.stringify({ actor: '1', key, request: { ...request, month: '2026-02-31' } }), '1'), null);
  assert.throws(() => h.checkedReport({ ...job, fromDate: '2026-10-02' }, key, request));
});

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return { get length() { return values.size; }, key: (index) => [...values.keys()][index] ?? null, getItem: (name) => values.get(name) ?? null, setItem: (name, value) => values.set(name, String(value)), removeItem: (name) => values.delete(name), values };
}
const walk = (node) => Array.isArray(node) ? node.flatMap(walk) : node?.props ? [node, ...walk(node.props.children)] : [];
async function reportPanel(t, options = {}) {
  const h = await helpers, original = Object.fromEntries(['sessionStorage', 'window', 'document', 'setTimeout', 'clearTimeout', 'Date'].map((name) => [name, global[name]]));
  const originalCrypto = Object.getOwnPropertyDescriptor(global, 'crypto');
  const storage = options.storage || memoryStorage(), timers = new Map(), listeners = new Map(), views = [];
  const clock = { now: Date.parse('2026-11-21T13:00:00Z') }; let timerId = 0, uuid = 0;
  const state = { profile: options.profile === undefined ? { id: 42, role: 'ADMIN' } : options.profile, posts: [], gets: [] };
  global.Date = class extends original.Date { constructor(...args) { super(...(args.length ? args : [clock.now])); } static now() { return clock.now; } };
  Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` } });
  global.sessionStorage = storage; global.window = { sessionStorage: storage };
  global.document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) };
  global.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: clock.now + delay, delay }); return id; };
  global.clearTimeout = (id) => timers.delete(id);
  t.after(() => { views.forEach((view) => view.unmount()); Object.assign(global, original); if (originalCrypto) Object.defineProperty(global, 'crypto', originalCrypto); else delete global.crypto; });
  const resource = (status = 'QUEUED', extra = {}) => ({ ...job, language: 'en', status, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), monthToDate: false, expiresAt: new Date(clock.now + 86400000).toISOString(), downloadUrl: null, downloadUrlExpiresAt: null, ...extra });
  const api = { revenueReports: {
    create: async (body, operationKey, config) => { state.posts.push({ body, key: operationKey, config }); return options.create ? options.create(body, operationKey, config, resource) : resource(); },
    get: async (id, config) => { state.gets.push({ id, config }); return options.get ? options.get(id, config, resource) : resource('PROCESSING'); }
  } };
  async function mount() {
    const view = await mountComponent(path.join(__dirname, '../components/RevenueReportExport.js'), { props: {}, modules: {
      '@/contexts/AuthContext': { useAuth: () => ({ adminProfile: state.profile }) }, '@/contexts/LocaleContext': { useLocale: () => ({ locale: options.locale || 'en' }) },
      '@/lib/api': { api }, '@/lib/revenue-reports': h, './RevenueReportExport.module.css': { __esModule: true, default: {} }
    } }); views.push(view); await view.flush(); return view;
  }
  const view = await mount();
  function nextTimer() {
    const [id, timer] = [...timers].sort((left, right) => left[1].at - right[1].at)[0] || [];
    if (!timer) return null;
    timers.delete(id); clock.now = timer.at; return timer.callback();
  }
  const field = (panel, label) => panel.nodes().find((node) => node.type === 'label' && node.props.children[0] === label).props.children.find((child) => child?.props?.onChange).props;
  return { view, state, storage, timers, clock, resource, remount: mount, nextTimer, field, async tick(panel = view) { await nextTimer(); await panel.flush(); }, async visible(value) { document.hidden = !value; listeners.get('visibilitychange')(); await view.flush(); } };
}
const send = async (view) => { await view.nodes().find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} }); await view.flush(); };
const closeDialog = async (view) => { view.nodes().find((node) => node.props['aria-label'] === 'Close').props.onClick(); await view.flush(); };

test('rapid submissions share one persisted intent and one POST, with no dashboard filter fields', async (t) => {
  let finish;
  const panel = await reportPanel(t, { create: async (body, operationKey, config, resource) => new Promise((resolve) => { finish = () => resolve(resource()); }) });
  await panel.view.click('Export net profit PDF');
  const handler = panel.view.nodes().find((node) => node.type === 'form').props.onSubmit;
  const first = handler({ preventDefault() {} }), second = handler({ preventDefault() {} }); await panel.view.flush();
  assert.equal(panel.state.posts.length, 1); assert.deepEqual(panel.state.posts[0].body, { month: '2026-10', language: 'en', timeZone: 'UTC' });
  const saved = JSON.parse(panel.storage.getItem('fondeka:revenue-report:v1:42')); assert.equal(saved.key, panel.state.posts[0].key); assert.equal(saved.jobId, null);
  finish(); await Promise.all([first, second]); await panel.view.flush(); assert.equal(panel.state.posts.length, 1);
});

test('a lost POST response and reload recover the same body/key; a known job is recovered using GET', async (t) => {
  let attempt = 0;
  const panel = await reportPanel(t, { create: async (body, operationKey, config, resource) => { if (++attempt === 1) throw new Error('Lost response'); return resource(); } });
  await panel.view.click('Export net profit PDF'); await send(panel.view); assert.match(panel.view.text(), /Lost response/);
  panel.view.unmount(); const recovered = await panel.remount(); await recovered.click('Export net profit PDF'); await recovered.click('Retry this submission');
  assert.equal(panel.state.posts.length, 2); assert.equal(panel.state.posts[0].key, panel.state.posts[1].key); assert.deepEqual(panel.state.posts[0].body, panel.state.posts[1].body);
  recovered.unmount(); const known = await panel.remount(); await known.click('Export net profit PDF'); await panel.tick(known);
  assert.equal(panel.state.posts.length, 2); assert.equal(panel.state.gets.length, 1); assert.equal(panel.state.gets[0].id, key);
});

test('automatic progress reads increase their delay and stop after 12; a manual check does not start another automatic batch', async (t) => {
  const panel = await reportPanel(t); await panel.view.click('Export net profit PDF'); await send(panel.view);
  const delays = [];
  for (let index = 0; index < 12; index += 1) { delays.push(Math.min(...[...panel.timers.values()].map((timer) => timer.delay))); await panel.tick(); }
  assert.deepEqual(delays.slice(0, 4), [2000, 4000, 8000, 15000]); assert.equal(panel.state.gets.length, 12);
  assert.ok(![...panel.timers.values()].some((timer) => timer.delay <= 15000)); assert.match(panel.view.text(), /Automatic checks paused/);
  await panel.view.click('Check progress / refresh link'); assert.equal(panel.state.gets.length, 13); assert.ok(![...panel.timers.values()].some((timer) => timer.delay <= 15000));
});

test('a progress error pauses polling and preserves the job for an explicit read', async (t) => {
  let attempt = 0;
  const panel = await reportPanel(t, { get: async (id, config, resource) => { if (++attempt === 1) throw new Error('Temporarily unavailable'); return resource('PROCESSING'); } });
  await panel.view.click('Export net profit PDF'); await send(panel.view); await panel.tick();
  assert.match(panel.view.text(), /Temporarily unavailable/); assert.equal(panel.state.gets.length, 1); assert.ok(![...panel.timers.values()].some((timer) => timer.delay <= 15000));
  await panel.view.click('Check progress / refresh link'); assert.equal(panel.state.gets.length, 2); assert.ok(![...panel.timers.values()].some((timer) => timer.delay <= 15000)); assert.equal(panel.state.posts.length, 1);
});

test('closing the dialog and hiding the tab pause scheduling without canceling the accepted job', async (t) => {
  const panel = await reportPanel(t); await panel.view.click('Export net profit PDF'); await send(panel.view);
  await closeDialog(panel.view); assert.ok(![...panel.timers.values()].some((timer) => timer.delay <= 15000)); assert.ok(panel.storage.getItem('fondeka:revenue-report:v1:42'));
  await panel.view.click('Export net profit PDF'); await panel.visible(false); assert.ok(![...panel.timers.values()].some((timer) => timer.delay <= 15000));
  await panel.visible(true); await panel.tick(); assert.equal(panel.state.gets.length, 1); assert.equal(panel.state.posts.length, 1);
});

test('progress never overlaps and completed links expire in memory without being written to session storage', async (t) => {
  let finish;
  const panel = await reportPanel(t, { get: async (id, config, resource) => new Promise((resolve) => { finish = () => resolve(resource('COMPLETED', { downloadUrl: job.downloadUrl, downloadUrlExpiresAt: new Date(panel.clock.now + 300000).toISOString() })); }) });
  await panel.view.click('Export net profit PDF'); await send(panel.view); const pending = panel.nextTimer(); await panel.view.flush();
  const manual = panel.view.button('Check progress / refresh link').onClick(); await panel.view.flush(); assert.equal(panel.state.gets.length, 1);
  finish(); await Promise.all([pending, manual]); await panel.view.flush();
  assert.ok(panel.view.nodes().some((node) => node.type === 'a' && node.props.href === job.downloadUrl));
  assert.doesNotMatch([...panel.storage.values.values()].join(''), /signature|downloadUrl/);
  await panel.tick(); assert.ok(!panel.view.nodes().some((node) => node.type === 'a')); assert.equal(panel.state.gets.length, 1);
  assert.match(panel.view.text(), /fresh download link/);
});

test('account switching aborts pending work, clears prior recovery and ignores late signed links', async (t) => {
  let finish;
  const panel = await reportPanel(t, { get: async (id, config, resource) => new Promise((resolve) => { finish = () => resolve(resource('COMPLETED', { downloadUrl: job.downloadUrl, downloadUrlExpiresAt: new Date(panel.clock.now + 300000).toISOString() })); }) });
  await panel.view.click('Export net profit PDF'); await send(panel.view); const pending = panel.nextTimer(); await panel.view.flush();
  panel.state.profile = { id: 43, role: 'ADMIN' }; await panel.view.flush(); assert.equal(panel.storage.getItem('fondeka:revenue-report:v1:42'), null); assert.equal(panel.state.gets[0].config.signal.aborted, true);
  finish(); await pending; await panel.view.flush(); assert.ok(!panel.view.nodes().some((node) => node.type === 'a')); assert.doesNotMatch(panel.view.text(), /Report ready/);
  panel.state.profile = { id: 43, role: 'ASSISTANT' }; await panel.view.flush(); assert.equal(panel.view.nodes().length, 0);
});

test('roles without export access cannot submit or recover reports', async (t) => {
  const panel = await reportPanel(t, { profile: { id: 44, role: 'ASSISTANT' } });
  assert.equal(panel.view.nodes().length, 0); assert.equal(panel.state.posts.length, 0); assert.equal(panel.state.gets.length, 0);
});

test('storage failures prevent an unrecoverable POST while preserving the form', async (t) => {
  const storage = memoryStorage(); storage.setItem = () => { throw new Error('Storage full'); };
  const panel = await reportPanel(t, { storage }); await panel.view.click('Export net profit PDF'); await send(panel.view);
  assert.equal(panel.state.posts.length, 0); assert.match(panel.view.text(), /Storage full/); assert.ok(panel.view.nodes().some((node) => node.type === 'form'));
});

test('changing criteria for a genuinely new report creates a new key, while the old intent remains immutable', async (t) => {
  const panel = await reportPanel(t, { create: async (body, operationKey, config, resource) => resource('FAILED', { errorMessage: 'Report generation failed' }) });
  await panel.view.click('Export net profit PDF'); await send(panel.view); const first = panel.state.posts[0]; await panel.view.click('New report');
  panel.field(panel.view, 'Period').onChange({ target: { value: 'range' } }); await panel.view.flush();
  for (const [label, value] of [['From', '2026-10-01'], ['To (inclusive)', '2026-10-15'], ['PDF language', 'fr'], ['Reporting timezone', 'Africa/Kinshasa']]) panel.field(panel.view, label).onChange({ target: { value } });
  await panel.view.flush(); await send(panel.view);
  assert.notEqual(panel.state.posts[1].key, first.key); assert.deepEqual(panel.state.posts[1].body, { from: '2026-10-01', to: '2026-10-15', language: 'fr', timeZone: 'Africa/Kinshasa' }); assert.deepEqual(first.body, { month: '2026-10', language: 'en', timeZone: 'UTC' });
});

test('recovery cleanup clears only revenue-report keys and can retain the current admin intent', async () => {
  const h = await helpers, storage = memoryStorage([[h.reportStorageKey(1), 'first'], [h.reportStorageKey(2), 'second'], ['other-feature', 'kept']]);
  h.clearReportRecovery(storage, 2); assert.equal(storage.getItem(h.reportStorageKey(1)), null); assert.equal(storage.getItem(h.reportStorageKey(2)), 'second');
  h.clearReportRecovery(storage); assert.equal(storage.getItem(h.reportStorageKey(2)), null); assert.equal(storage.getItem('other-feature'), 'kept');
});

test('authentication clears recovery on account changes and logout even when the export component is not mounted', async (t) => {
  const h = await helpers, storage = memoryStorage([[h.reportStorageKey(1), 'original request'], ['unrelated', 'kept']]);
  const expenses = await import(url(read('lib/expense-reports.js')));
  const budgets = await import(url(read('lib/expense-budgets.js')));
  const assetReports = await import(url(read('lib/asset-reports.js')));
  const assets = await import(url(read('lib/asset-register.js').replace("'./expense-budgets'", JSON.stringify(url(read('lib/expense-budgets.js'))))));
  storage.setItem(assetReports.reportStorageKey(1), 'asset report'); storage.setItem(assets.assetRecoveryKey(1), 'asset revision');
  storage.setItem(expenses.reportStorageKey(1), 'expense report');
  storage.setItem(budgets.budgetRecoveryKey(1), 'expense budget');
  const previous = { window: global.window, setInterval: global.setInterval, clearInterval: global.clearInterval };
  global.window = { sessionStorage: storage, addEventListener() {}, removeEventListener() {} };
  global.setInterval = () => 1; global.clearInterval = () => {};
  const session = (subject, token) => ({ tokens: { accessToken: { payload: { sub: subject }, toString: () => token } } });
  let current = session('first-admin', 'first-token');
  const view = await mountComponent(path.join(__dirname, '../contexts/AuthContext.js'), { exportName: 'AuthProvider', props: { children: null }, modules: {
    'aws-amplify/auth': { fetchAuthSession: async () => current, signOut: async () => { throw new Error('Local sign out still required'); }, signIn() {}, confirmSignIn() {} },
    '@/lib/api': { api: { setAuthToken() {}, admins: { me: async () => ({ id: 1, role: 'ADMIN', enableRegulatorMode: false }) } } },
    '@/lib/regulator-presentation': { adminPresentationReady: (profile) => Boolean(profile && typeof profile.enableRegulatorMode === 'boolean') }, '@/lib/revenue-reports': h,
    '@/lib/expense-reports': expenses, '@/lib/expense-budgets': budgets, '@/lib/asset-reports': assetReports, '@/lib/asset-register': assets
  } });
  t.after(() => { view.unmount(); Object.assign(global, previous); }); await view.flush();
  const context = () => view.nodes().find((node) => node.props.value?.refreshSession).props.value;
  assert.equal(storage.getItem(h.reportStorageKey(1)), 'original request');
  current = session('first-admin', 'refreshed-token'); await context().refreshSession(); await view.flush(); assert.equal(storage.getItem(h.reportStorageKey(1)), 'original request');
  assert.equal(storage.getItem(expenses.reportStorageKey(1)), 'expense report');
  current = session('second-admin', 'another-token'); await context().refreshSession(); await view.flush(); assert.equal(storage.getItem(h.reportStorageKey(1)), null); assert.equal(storage.getItem('unrelated'), 'kept');
  assert.equal(storage.getItem(expenses.reportStorageKey(1)), null); assert.equal(storage.getItem(budgets.budgetRecoveryKey(1)), null);
  assert.equal(storage.getItem(assetReports.reportStorageKey(1)), null); assert.equal(storage.getItem(assets.assetRecoveryKey(1)), null);
  storage.setItem(assetReports.reportStorageKey(2), 'second asset report'); storage.setItem(assets.assetRecoveryKey(2), 'second asset revision');
  storage.setItem(expenses.reportStorageKey(2), 'second expense report'); storage.setItem(budgets.budgetRecoveryKey(2), 'second expense budget');
  storage.setItem(h.reportStorageKey(2), 'second request'); await context().logout(); await view.flush(); assert.equal(storage.getItem(h.reportStorageKey(2)), null); assert.equal(context().isAuthenticated, false);
  assert.equal(storage.getItem(expenses.reportStorageKey(2)), null); assert.equal(storage.getItem(budgets.budgetRecoveryKey(2)), null);
  assert.equal(storage.getItem(assetReports.reportStorageKey(2)), null); assert.equal(storage.getItem(assets.assetRecoveryKey(2)), null);
});

test('month selection offers named months and direct year changes, clamps future choices, and never submits from navigation', async (t) => {
  const panel = await reportPanel(t, { create: async (body, operationKey, config, resource) => resource('QUEUED', { fromDate: '2026-11-01', toDate: '2026-11-21', monthToDate: true }) });
  await panel.view.click('Export net profit PDF');
  assert.equal(panel.field(panel.view, 'Month').value, '10'); assert.equal(panel.field(panel.view, 'Year').value, '2026');
  const options = () => walk(panel.field(panel.view, 'Month').children).filter((node) => node.type === 'option');
  assert.equal(options().length, 12); assert.equal(options()[0].props.children, 'January'); assert.equal(options()[11].props.children, 'December'); assert.equal(options()[11].props.disabled, true);
  panel.field(panel.view, 'Year').onChange({ target: { value: '2025' } }); await panel.view.flush();
  panel.field(panel.view, 'Month').onChange({ target: { value: '12' } }); await panel.view.flush(); assert.equal(panel.field(panel.view, 'Month').value, '12');
  panel.field(panel.view, 'Year').onChange({ target: { value: '2026' } }); await panel.view.flush(); assert.equal(panel.field(panel.view, 'Month').value, '11');
  const next = () => panel.view.nodes().find((node) => node.props['aria-label'] === 'Next month').props;
  assert.equal(next().disabled, true); panel.field(panel.view, 'Month').onChange({ target: { value: '10' } }); await panel.view.flush();
  panel.view.nodes().find((node) => node.props['aria-label'] === 'Previous month').props.onClick(); await panel.view.flush(); assert.equal(panel.field(panel.view, 'Month').value, '09');
  next().onClick(); await panel.view.flush(); assert.equal(panel.field(panel.view, 'Month').value, '10');
  panel.field(panel.view, 'Month').onChange({ target: { value: '11' } }); await panel.view.flush(); assert.equal(panel.state.posts.length, 0);
  const group = panel.view.nodes().find((node) => node.props['aria-label'] === 'Reporting month'); assert.ok(walk(group).filter((node) => node.type === 'button').every((node) => node.props.type === 'button'));
  await send(panel.view); assert.equal(panel.state.posts[0].body.month, '2026-11'); assert.match(panel.view.text(), /Month to date/);
});

test('month navigation crosses year boundaries and stops at the earliest report year', async (t) => {
  const panel = await reportPanel(t); panel.clock.now = Date.parse('2027-01-08T12:00:00Z'); await panel.view.click('Export net profit PDF');
  panel.field(panel.view, 'Month').onChange({ target: { value: '12' } }); await panel.view.flush(); assert.equal(panel.field(panel.view, 'Month').value, '12'); assert.equal(panel.field(panel.view, 'Year').value, '2026');
  panel.view.nodes().find((node) => node.props['aria-label'] === 'Next month').props.onClick(); await panel.view.flush(); assert.equal(panel.field(panel.view, 'Year').value, '2027'); assert.equal(panel.field(panel.view, 'Month').value, '01');
  assert.equal(panel.view.nodes().find((node) => node.props['aria-label'] === 'Next month').props.disabled, true);
  panel.field(panel.view, 'Year').onChange({ target: { value: '2000' } }); await panel.view.flush();
  assert.equal(panel.view.nodes().find((node) => node.props['aria-label'] === 'Previous month').props.disabled, true); assert.equal(panel.state.posts.length, 0);
});

test('month availability uses the reporting timezone at a year boundary', async (t) => {
  const panel = await reportPanel(t); panel.clock.now = Date.parse('2027-01-01T00:30:00Z'); await panel.view.click('Export net profit PDF');
  panel.field(panel.view, 'Year').onChange({ target: { value: '2027' } }); await panel.view.flush();
  assert.equal(panel.field(panel.view, 'Year').value, '2027');
  panel.field(panel.view, 'Reporting timezone').onChange({ target: { value: 'America/Los_Angeles' } }); await panel.view.flush();
  panel.field(panel.view, 'Year').onChange({ target: { value: '2026' } }); await panel.view.flush();
  panel.field(panel.view, 'Month').onChange({ target: { value: '12' } }); await panel.view.flush(); assert.equal(panel.field(panel.view, 'Month').value, '12'); assert.equal(panel.field(panel.view, 'Year').value, '2026');
  panel.field(panel.view, 'Month').onChange({ target: { value: '11' } }); await panel.view.flush(); assert.equal(panel.field(panel.view, 'Month').value, '11'); assert.equal(panel.state.posts.length, 0);
});

test('French month names preserve the selected numeric API month', async (t) => {
  const panel = await reportPanel(t, { locale: 'fr', profile: { id: 42, role: 'SUPER_ADMIN' }, create: async (body, operationKey, config, resource) => resource('QUEUED', { language: 'fr', fromDate: '2026-02-01', toDate: '2026-02-28' }) });
  await panel.view.click('Exporter le bénéfice en PDF');
  assert.ok(walk(panel.field(panel.view, 'Mois').children).some((node) => node.type === 'option' && node.props.children === 'février'));
  panel.field(panel.view, 'Mois').onChange({ target: { value: '02' } }); await panel.view.flush(); await send(panel.view);
  assert.deepEqual(panel.state.posts[0].body, { month: '2026-02', language: 'fr', timeZone: 'UTC' });
});


test('report types preserve legacy revenue without calling it net profit and reject unknown measures', async () => {
  const h = await helpers;
  assert.equal(h.checkedReport({ ...job, reportType: 'REVENUE' }, key, request).reportType, 'REVENUE');
  assert.throws(() => h.checkedReport({ ...job, reportType: 'UNSUPPORTED' }, key, request));
});

test('a recovered revenue export is visibly identified as the previous version', { concurrency: false }, async (t) => {
  const panel = await reportPanel(t, { create: async (body, operationKey, config, resource) => resource('COMPLETED', { reportType: 'REVENUE' }) });
  await panel.view.click('Export net profit PDF'); await send(panel.view);
  assert.match(panel.view.text(), /Revenue report · previous version/);
  assert.match(panel.view.text(), /This saved report shows revenue/);
  assert.match(panel.view.text(), /Start a new report to obtain transaction net profit/);
});
