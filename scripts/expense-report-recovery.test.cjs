const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const root = path.join(__dirname, '..');
const helpers = import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(root, 'lib/expense-reports.js'), 'utf8')).toString('base64')}`);
const id = '9265b38b-922e-4711-a084-d89b5ba67405';

async function panel(t, options = {}) {
  const h = await helpers, saved = new Map(), timers = new Map(), listeners = new Map(), views = [];
  const original = Object.fromEntries(['Date', 'sessionStorage', 'document', 'setTimeout', 'clearTimeout'].map(key => [key, Object.getOwnPropertyDescriptor(global, key)]));
  const clock = { now: Date.parse('2026-11-22T13:00:00Z') }; let timerId = 0;
  const RealDate = Date;
  global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [clock.now])); } static now() { return clock.now; } };
  const storage = { get length() { return saved.size; }, key: i => [...saved.keys()][i], getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)), removeItem: key => saved.delete(key) };
  global.sessionStorage = storage;
  global.document = { hidden: false, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  global.setTimeout = (fn, delay) => { const key = ++timerId; timers.set(key, { fn, delay, at: clock.now + delay }); return key; };
  global.clearTimeout = key => timers.delete(key);
  t.after(() => { views.forEach(view => view.unmount()); for (const [key, descriptor] of Object.entries(original)) { if (descriptor) Object.defineProperty(global, key, descriptor); else delete global[key]; } });
  const state = { profile: { id: 1, role: 'ADMIN' }, posts: [], gets: [] };
  let request;
  const resource = (status = 'QUEUED', extra = {}) => ({ id, reportType: 'EXPENSES', status, fromDate: `${request.month}-01`, toDate: `${request.month}-31`,
    currency: request.currency, language: request.language, timeZone: request.timeZone, mode: request.mode, includeDetails: request.includeDetails,
    expiresAt: new Date(clock.now + 86400000).toISOString(), downloadUrl: null, downloadUrlExpiresAt: null, ...extra });
  const api = { expenses: {
    createReport: async (body, key, config) => { request = body; state.posts.push({ body, key, config }); return options.create ? options.create(resource, state.posts.length) : resource(); },
    getReport: async (jobId, config) => { state.gets.push({ jobId, config }); return options.get ? options.get(resource, state.gets.length) : resource('PROCESSING'); }
  } };
  const mount = async () => {
    const view = await mountComponent(path.join(root, 'components/ExpenseReportExport.js'), { props: {}, modules: {
      '@/contexts/AuthContext': { useAuth: () => ({ adminProfile: state.profile }) }, '@/contexts/LocaleContext': { useLocale: () => ({ locale: 'en' }) },
      '@/lib/api': { api }, '@/lib/expense-reports': h, '@/components/MonthPicker': { __esModule: true, default: 'month-picker' }, './RevenueReportExport.module.css': { __esModule: true, default: {} }
    } }); views.push(view); await view.flush(); return view;
  };
  const view = await mount();
  return { view, mount, state, h, storage, resource, clock,
    async tick() {
      const [key, timer] = [...timers].sort((a,b) => a[1].at - b[1].at)[0] || [];
      if (!timer || timer.at - clock.now > 15000) return false;
      timers.delete(key); clock.now = timer.at; await timer.fn(); await view.flush(); return true;
    },
    async visible(value) { document.hidden = !value; listeners.get('visibilitychange')(); await view.flush(); }
  };
}
const send = async view => { await view.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await view.flush(); };

test('lost export acceptance survives reload with the same body/key, and a known job recovers using GET only', async t => {
  const p = await panel(t, { create: async (resource, attempt) => { if (attempt === 1) throw new Error('Lost response'); return resource(); } });
  await p.view.click('Export expense PDF'); await send(p.view); assert.match(p.view.text(), /Lost response/);
  p.view.unmount(); const restored = await p.mount(); await restored.click('Export expense PDF'); await restored.click('Retry this submission');
  assert.equal(p.state.posts.length, 2); assert.equal(p.state.posts[0].key, p.state.posts[1].key); assert.deepEqual(p.state.posts[0].body, p.state.posts[1].body);
  restored.unmount(); const accepted = await p.mount(); await accepted.click('Export expense PDF'); await accepted.click('Check progress / refresh link');
  assert.equal(p.state.posts.length, 2); assert.equal(p.state.gets.length, 1);
  const recovery = JSON.parse(p.storage.getItem(p.h.reportStorageKey(1))); assert.equal(recovery.jobId, id); assert.equal(recovery.downloadUrl, undefined);
});

test('automatic expense checks pause while hidden and stop at twelve; a manual read does not restart polling', async t => {
  const p = await panel(t); await p.view.click('Export expense PDF'); await send(p.view);
  await p.visible(false); assert.equal(await p.tick(), false); assert.equal(p.state.gets.length, 0);
  await p.visible(true);
  for (let i = 0; i < 12; i++) assert.equal(await p.tick(), true);
  assert.equal(p.state.gets.length, 12); assert.equal(await p.tick(), false); assert.match(p.view.text(), /Automatic checks paused/);
  await p.view.click('Check progress / refresh link'); assert.equal(p.state.gets.length, 13); assert.equal(await p.tick(), false);
  assert.equal(p.state.posts.length, 1);
});

test('status errors pause checks, retain the last job and never repeat creation', async t => {
  const p = await panel(t, { get: async () => { throw new Error('Progress unavailable'); } });
  await p.view.click('Export expense PDF'); await send(p.view); await p.tick();
  assert.match(p.view.text(), /Progress unavailable/); assert.match(p.view.text(), /Queued/); assert.equal(await p.tick(), false);
  assert.equal(p.state.posts.length, 1); assert.equal(p.state.gets.length, 1);
});

test('switching accounts aborts in-flight reads and ignores late private download links', async t => {
  let finish;
  const p = await panel(t, { get: resource => new Promise(resolve => { finish = () => resolve(resource('COMPLETED', { downloadUrl: 'https://files.example/private.pdf', downloadUrlExpiresAt: new Date(Date.now() + 300000).toISOString() })); }) });
  await p.view.click('Export expense PDF'); await send(p.view);
  const read = p.view.button('Check progress / refresh link').onClick(); await p.view.flush();
  p.state.profile = { id: 2, role: 'ADMIN' }; await p.view.flush();
  assert.equal(p.state.gets[0].config.signal.aborted, true); assert.equal(p.storage.getItem(p.h.reportStorageKey(1)), null);
  finish(); await read; await p.view.flush();
  assert.equal(p.view.nodes().some(node => node.type === 'a'), false); assert.doesNotMatch(p.view.text(), /Report ready/);
});
