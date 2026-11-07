const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { mountComponent, compileComponent } = require('./helpers/component-harness.cjs');
const load = (file, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64')}#${tag}`);
const active = { accountId: 42, reseller: true, enabledSince: '2026-11-07T10:00:00Z', notes: 'Approved', version: 7, upstreamEarningsBlocked: true, enrollmentPresent: true, removed: false, selfEnrollmentSuspended: false };
const removed = { ...active, reseller: false, enabledSince: null, notes: null, version: 8, upstreamEarningsBlocked: false, enrollmentPresent: false, removed: true };
const apiError = (status, message) => Object.assign(new Error(message), { status });

test('enrollment removal requires the new backend contract and the exact account/version', async () => {
  const { resellerRemovalRecord, resellerEnrollmentStatus } = await load('lib/resellers.js');
  assert.equal(resellerRemovalRecord(active, 42), active);
  assert.equal(resellerRemovalRecord(removed, 42), removed);
  for (const value of [{ ...active, version: null }, { ...active, accountId: 91 }, { ...active, enrollmentPresent: undefined }, { ...active, removed: 'false' }, { ...removed, enrollmentPresent: true }]) assert.throws(() => resellerRemovalRecord(value, 42));
  assert.equal(resellerEnrollmentStatus(active), 'Enrolled');
  assert.equal(resellerEnrollmentStatus(removed), 'Not enrolled');
  assert.equal(resellerEnrollmentStatus({ ...active, reseller: false, selfEnrollmentSuspended: true }), 'Suspended');
  assert.equal(resellerEnrollmentStatus({ ...active, reseller: false, enabledSince: null }), 'Pending activation');
});

test('removal API sends bodyless versioned DELETEs and accepts 204 without parsing JSON', async (t) => {
  const previousFetch = global.fetch, previousWindow = global.window;
  t.after(() => { global.fetch = previousFetch; if (previousWindow === undefined) delete global.window; else global.window = previousWindow; });
  const { api } = await load('lib/api.js', 'enrollment-removal'); api.setAuthToken('admin-removal-token');
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); const response = new Response(null, { status: 204 }); response.json = () => { throw new Error('204 has no JSON'); }; return response; };
  assert.equal(await api.resellers.removeEnrollment(42, 7), null);
  assert.equal(await api.resellers.removeEnrollmentByEmail(' Customer+pilot@Example.com ', 8), null);
  assert.match(calls[0].url, /\/admin-api\/resellers\/accounts\/42\?version=7$/);
  const email = new URL(calls[1].url, 'https://admin.local');
  assert.equal(email.pathname, '/admin-api/resellers/accounts/by-email');
  assert.equal(email.searchParams.get('email'), 'Customer+pilot@Example.com'); assert.equal(email.searchParams.get('version'), '8');
  for (const { init } of calls) { assert.equal(init.method, 'DELETE'); assert.equal(init.body, undefined); assert.equal(init.cache, 'no-store'); assert.equal(init.headers.Authorization, 'Bearer admin-removal-token'); }
  global.window = { dispatchEvent: () => { throw new Error('Must not force logout'); } };
  global.fetch = async () => Response.json({ message: 'Stored admin role must be SUPER_ADMIN' }, { status: 403 });
  await assert.rejects(api.resellers.removeEnrollment(42, 7), (err) => err.status === 403 && /SUPER_ADMIN/.test(err.message));
});

async function confirmation({ canWrite = true, read = async () => active, remove = async () => null } = {}) {
  const helpers = await load('lib/resellers.js'), reads = [], deletions = [], observations = [];
  let closed = 0, completed = 0;
  const fail = async (err) => err.message;
  const view = await mountComponent(path.join(__dirname, '../components/resellers/EnrollmentRemoval.js'), {
    props: { accountId: 42, canWrite, onClose: () => closed++, onRemoved: () => completed++, onObserved: (record) => observations.push(record) },
    modules: (hooks) => ({
      '@/lib/api': { api: { resellers: {
        enrollment: async (id) => { reads.push(id); return read(reads.length); },
        removeEnrollment: async (...args) => { deletions.push(args); return remove(...args); }
      } } },
      '@/lib/resellers': helpers,
      '@/components/ContentModal': { ContentModal: 'dialog' },
      './Common': { Alert: 'alert', Facts: 'facts', actionStyle: {}, useResellerError: () => fail, useMounted: () => { const ref = hooks.useRef(true); hooks.useEffect(() => () => { ref.current = false; }, []); return ref; } }
    })
  });
  await view.flush();
  return { view, reads, deletions, observations, closed: () => closed, completed: () => completed };
}

test('confirmation fetches a fresh enrollment, explains payment behavior and prevents duplicate removals', async () => {
  let release;
  const run = await confirmation({ read: async () => ({ ...active, version: 11 }), remove: () => new Promise((resolve) => { release = resolve; }) });
  assert.deepEqual(run.reads, [42]); assert.equal(run.view.button('Remove reseller enrollment').disabled, true);
  assert.match(run.view.text(), /pending enrollment payment may still reach their wallet/);
  assert.match(run.view.text(), /will not restore the enrollment/);
  run.view.check(true); await run.view.click('Remove reseller enrollment');
  await run.view.click('Removing…'); assert.deepEqual(run.deletions, [[42, 11]]);
  run.view.nodes().find((node) => node.type === 'dialog').props.onClose(); assert.equal(run.closed(), 0);
  release(null); await run.view.flush();
  assert.equal(run.completed(), 1); assert.equal(run.closed(), 1);
});

test('a 409 reloads enrollment and requires fresh confirmation before using the new version', async () => {
  const run = await confirmation({ read: async (count) => count === 1 ? active : { ...active, version: 9 }, remove: async (_id, version) => { if (version === 7) throw apiError(409, 'Enrollment changed'); } });
  run.view.check(true); await run.view.click('Remove reseller enrollment');
  assert.deepEqual(run.deletions, [[42, 7]]); assert.deepEqual(run.reads, [42, 42]);
  assert.equal(run.view.button('Remove reseller enrollment').disabled, true);
  assert.match(run.view.text(), /confirm again/);
  await run.view.click('Remove reseller enrollment'); assert.equal(run.deletions.length, 1);
  run.view.check(true); await run.view.click('Remove reseller enrollment');
  assert.deepEqual(run.deletions, [[42, 7], [42, 9]]); assert.equal(run.completed(), 1);
});

test('uncertain deletion reads current state and recognizes a completed removal without resending', async () => {
  for (const error of [new Error('Timed out'), apiError(503, 'Temporarily unavailable')]) {
    const run = await confirmation({ read: async (count) => count === 1 ? active : removed, remove: async () => { throw error; } });
    run.view.check(true); await run.view.click('Remove reseller enrollment');
    assert.deepEqual(run.deletions, [[42, 7]]); assert.equal(run.completed(), 1); assert.equal(run.closed(), 1);
    assert.equal(run.observations.at(-1), removed);
  }
});

test('uncertain deletion with a new active enrollment cannot reuse the earlier confirmation', async () => {
  const run = await confirmation({ read: async (count) => count === 1 ? active : { ...active, version: 10 }, remove: async () => { throw new Error('Connection closed'); } });
  run.view.check(true); await run.view.click('Remove reseller enrollment');
  assert.equal(run.completed(), 0); assert.equal(run.view.button('Remove reseller enrollment').disabled, true);
  assert.deepEqual(run.deletions, [[42, 7]]);
});

test('permission denial and unsupported backends never offer a removal retry', async () => {
  for (const options of [{ canWrite: false }]) {
    const run = await confirmation(options);
    assert.deepEqual(run.reads, []); assert.deepEqual(run.deletions, []);
    assert.ok(!run.view.nodes().some((node) => node.props.children === 'Remove reseller enrollment'));
  }
  const denied = await confirmation({ remove: async () => { throw apiError(403, 'Super Admin required'); } });
  denied.view.check(true); await denied.view.click('Remove reseller enrollment');
  assert.equal(denied.reads.length, 1); assert.equal(denied.deletions.length, 1);
  assert.ok(!denied.view.nodes().some((node) => node.props.children === 'Refresh enrollment'));
  const unsupported = await confirmation({ read: async () => ({ ...active, enrollmentPresent: undefined }) });
  assert.equal(unsupported.deletions.length, 0); assert.match(unsupported.view.text(), /invalid enrollment state/);
  const wrongAccount = await confirmation({ read: async () => ({ ...active, accountId: 91 }) });
  assert.match(wrongAccount.view.text(), /another account/); assert.equal(wrongAccount.deletions.length, 0);
});

test('failed status reads clear confirmation and allow only a fresh read, not a blind deletion retry', async () => {
  const run = await confirmation({ read: async (count) => { if (count === 2) throw apiError(503, 'Status unavailable'); return active; }, remove: async () => { throw new Error('Timed out'); } });
  run.view.check(true); await run.view.click('Remove reseller enrollment');
  assert.match(run.view.text(), /Status unavailable/);
  assert.ok(!run.view.nodes().some((node) => node.props.children === 'Remove reseller enrollment'));
  await run.view.click('Refresh enrollment');
  assert.equal(run.view.button('Remove reseller enrollment').disabled, true); assert.equal(run.deletions.length, 1);
});

test('400 and 401 retain the API error and require a fresh resource before another confirmation', async () => {
  for (const status of [400, 401]) {
    const run = await confirmation({ remove: async () => { throw apiError(status, `Request rejected ${status}`); } });
    run.view.check(true); await run.view.click('Remove reseller enrollment');
    assert.match(run.view.text(), new RegExp(`Request rejected ${status}`));
    assert.equal(run.reads.length, 1); assert.equal(run.deletions.length, 1); assert.equal(run.completed(), 0);
    assert.ok(!run.view.nodes().some((node) => node.props.children === 'Remove reseller enrollment'));
    await run.view.click('Refresh enrollment');
    assert.equal(run.view.button('Remove reseller enrollment').disabled, true);
  }
});

test('404 refreshes the selected enrollment and cannot delete an absent enrollment', async () => {
  const neverEnrolled = { ...removed, removed: false, version: 0 };
  const run = await confirmation({ read: async (count) => count === 1 ? active : neverEnrolled, remove: async () => { throw apiError(404, 'Enrollment not found'); } });
  run.view.check(true); await run.view.click('Remove reseller enrollment');
  assert.deepEqual(run.reads, [42, 42]); assert.equal(run.observations.at(-1), neverEnrolled);
  assert.equal(run.completed(), 0); assert.ok(!run.view.nodes().some((node) => node.props.children === 'Remove reseller enrollment'));
});

test('leaving an account while enrollment is loading cannot confirm or remove the previous account', async () => {
  let release;
  const run = await confirmation({ read: () => new Promise((resolve) => { release = resolve; }) });
  run.view.unmount(); release(active); await run.view.flush();
  assert.equal(run.observations.length, 0); assert.equal(run.deletions.length, 0); assert.equal(run.completed(), 0);
});

test('provisional enrollment can be removed while already-removed enrollment cannot be deleted again from the UI', async () => {
  const provisional = await confirmation({ read: async () => ({ ...active, reseller: false, enabledSince: null }) });
  provisional.view.check(true); await provisional.view.click('Remove reseller enrollment'); assert.equal(provisional.completed(), 1);
  const absent = await confirmation({ read: async () => removed });
  assert.match(absent.view.text(), /no current reseller enrollment/);
  assert.ok(!absent.view.nodes().some((node) => node.props.children === 'Remove reseller enrollment')); assert.equal(absent.deletions.length, 0);
});

async function accountWorkspace({ canWrite = true, initial = active } = {}) {
  const helpers = await load('lib/resellers.js');
  const common = await compileComponent(path.join(__dirname, '../components/resellers/Common.js'));
  let enrollment = initial, accountRefreshes = 0, enrollmentReads = 0, summaryReads = 0;
  const balances = [{ currency: 'USD', available: 10, held: 6 }, { currency: 'CDF', available: 100, deficit: 20 }];
  const refreshSession = async () => {};
  const api = { resellers: {
    enrollment: async () => { enrollmentReads++; return enrollment; },
    summary: async () => { summaryReads++; return { accountId: 42, reseller: enrollment.reseller, earningEnabled: enrollment.reseller, pointsByCurrency: balances, billProducts: [] }; }
  } };
  const view = await mountComponent(path.join(__dirname, '../components/resellers/AccountWorkspace.js'), {
    exportName: 'AccountWorkspace', props: { accountId: 42, canWrite, onEnrollmentChanged: () => accountRefreshes++ },
    modules: (hooks) => ({
      '@/lib/api': { api }, '@/lib/resellers': helpers, '@/contexts/AuthContext': { useAuth: () => ({ refreshSession }) },
      '@/components/RegulatorPresentation': { PresentationLink: 'a' }, '@/components/DataTable': { DataTable: 'table' }, '@/components/ContentModal': { ContentModal: 'dialog' }, '@/components/TableCell': { TableCellLines: 'paired' },
      './EnrollmentRemoval': { __esModule: true, default: 'removal' }, './Editor': { __esModule: true, default: 'editor' }, './ProductRateEditor': { __esModule: true, default: 'rate-editor' }, './ConfigurationPanel': { __esModule: true, default: 'configuration' }, './Navigation': { __esModule: true, default: 'navigation' }, './TransactionInspector': { TransactionInspector: 'inspector' }, './resellers.module.css': { __esModule: true, default: {} },
      './Common': { ...common(hooks, { '@/lib/api': { api }, '@/lib/resellers': helpers, '@/contexts/AuthContext': { useAuth: () => ({ refreshSession }) }, '@/components/CountrySelect': { CountrySelect: 'country' }, '@/components/CatalogSelect': { CatalogSelect: 'catalog' }, '@/lib/regulator-presentation': {} }), Card: 'section', Alert: 'alert', Facts: 'facts', Badge: 'badge', ProductMarketPicker: 'market', Field: 'field', ResourceStatus: 'status' }
    })
  });
  await view.flush();
  return { view, balances, setEnrollment: (next) => { enrollment = next; }, counts: () => ({ enrollmentReads, summaryReads, accountRefreshes }) };
}

test('account workspace refreshes enrollment, summary and account details after removal while retaining currency balances', async () => {
  const run = await accountWorkspace(), { view, balances } = run;
  assert.equal(view.button('Remove reseller enrollment').disabled, false);
  await view.click('Remove reseller enrollment');
  const modal = view.nodes().find((node) => node.type === 'removal').props;
  assert.equal(modal.accountId, 42); assert.equal(view.button('Manage enrollment').disabled, true);
  run.setEnrollment(removed); modal.onRemoved(); modal.onClose(); await view.flush();
  assert.deepEqual(run.counts(), { enrollmentReads: 2, summaryReads: 2, accountRefreshes: 1 });
  assert.ok(!view.nodes().some((node) => node.props.children === 'Remove reseller enrollment'));
  const facts = view.nodes().find((node) => node.type === 'facts').props.rows;
  assert.equal(facts.find(([label]) => label === 'Enrollment')[1].props.no, 'Not enrolled');
  assert.equal(view.nodes().find((node) => node.type === 'table').props.rows, balances);
  assert.ok(facts.some(([label, value]) => label === 'Customer self-enrollment' && /Permitted/.test(value)));
});

test('workspace removal is hidden for admin readers and accounts without current enrollment', async () => {
  for (const options of [{ canWrite: false }, { initial: removed }]) {
    const { view } = await accountWorkspace(options);
    assert.ok(!view.nodes().some((node) => node.props.children === 'Remove reseller enrollment'));
  }
});

test('super admins can find removal and see why an older backend cannot support it', async () => {
  const legacy = { ...active }; delete legacy.enrollmentPresent; delete legacy.removed; delete legacy.selfEnrollmentSuspended;
  for (const [options, reason] of [[{ initial: legacy }, /backend needs an update/]]) {
    const { view } = await accountWorkspace(options);
    assert.equal(view.button('Remove reseller enrollment').disabled, true);
    assert.match(view.text(), reason);
    assert.ok(view.button('Remove reseller enrollment')['aria-describedby']);
    await view.click('Remove reseller enrollment');
    assert.ok(!view.nodes().some((node) => node.type === 'removal'));
  }
});
