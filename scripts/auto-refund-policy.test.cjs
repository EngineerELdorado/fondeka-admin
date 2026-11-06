const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { mountComponent } = require('./helpers/component-harness.cjs');
const load = (file, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64')}#${tag}`);
const helpers = load('lib/auto-refund-policy.js');
const session = (role) => ({ tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } });
const empty = () => ({ autoRefundRules: [], autoRefundBlockedActions: ['WITHDRAW_FROM_WALLET'], autoRefundAllowedAccountIdsByAction: { WITHDRAW_FROM_WALLET: [7] }, autoRefundTimeoutAllowedActions: ['FUND_CARD'] });
const scoped = (name = 'Allow PawaPay payouts') => ({ name, decision: 'ALLOW', contexts: ['PAYOUT'], paymentProviders: ['PAWAPAY'], actions: [], billProviders: [], accountIds: [] });

test('rules preserve their ordered decisions and exact provider dimensions while normalizing wildcard selectors', async () => {
  const { normalizeRefundRules, globalRefundRule } = await helpers;
  const result = normalizeRefundRules([{ ...scoped(' Provider exception '), accountIds: ['7', 7], billProviders: ['ARAKA_PAY'] }, { name: 'Block other payouts', decision: 'BLOCK', contexts: ['PAYOUT'], paymentProviders: null }, { name: 'Catch all', decision: 'BLOCK' }]);
  assert.deepEqual(result.map((row) => row.name), ['Provider exception', 'Block other payouts', 'Catch all']);
  assert.equal(result[0].paymentProviders[0], 'PAWAPAY'); assert.equal(result[0].billProviders[0], 'ARAKA_PAY');
  assert.deepEqual(result[0].accountIds, [7]); assert.deepEqual(result[1].paymentProviders, []);
  assert.equal(globalRefundRule(result[2]), true); assert.equal(globalRefundRule(result[1]), false);
  assert.deepEqual(normalizeRefundRules([]), []);
});

test('invalid names, decisions, selectors and account IDs cannot silently become broad refund rules', async () => {
  const { normalizeRefundRules } = await helpers;
  for (const rules of [[null], [{ name: ' ' }], [{ ...scoped(), name: 'x'.repeat(101) }], [{ ...scoped(), decision: null }], [{ ...scoped(), contexts: ['REFUND'] }], [{ ...scoped(), paymentProviders: ['ARAKA_PAY'] }], [{ ...scoped(), billProviders: ['ARAKAPAY'] }], [{ ...scoped(), actions: ['ARBITRARY'] }], [{ ...scoped(), accountIds: [0] }], [{ ...scoped(), accountIds: [null] }], [{ ...scoped(), accountIds: ['not-an-id'] }], [scoped('same'), scoped(' same ')], Array.from({ length: 101 }, (_, i) => scoped(`Rule ${i}`))]) assert.throws(() => normalizeRefundRules(rules));
  assert.throws(() => normalizeRefundRules(null));
});

test('rule-only updates and clearing rules preserve unrelated fallback settings and never change the global feature flag', async () => {
  const { readRefundPolicy, refundPolicyDraft, refundPolicyPayload, refundPolicyPatch } = await helpers;
  const base = readRefundPolicy(empty()), draft = refundPolicyDraft(base);
  draft.rules = [scoped()];
  assert.deepEqual(Object.keys(refundPolicyPatch(base, refundPolicyPayload(draft))), ['autoRefundRules']);
  const existing = readRefundPolicy({ ...empty(), autoRefundRules: [scoped()] });
  const next = refundPolicyDraft(existing); next.rules = [];
  assert.deepEqual(refundPolicyPatch(existing, refundPolicyPayload(next)), { autoRefundRules: [] });
  assert.deepEqual(next.blockedActions, ['WITHDRAW_FROM_WALLET']); assert.deepEqual(next.timeoutActions, ['FUND_CARD']);
  assert.throws(() => readRefundPolicy({ autoRefundBlockedActions: [] }), /does not expose/);
});

test('account exceptions remain action-specific and partial patches retain zero-entry removal semantics', async () => {
  const { readRefundPolicy, refundPolicyDraft, refundPolicyPayload, refundPolicyPatch } = await helpers;
  const base = readRefundPolicy(empty()), draft = refundPolicyDraft(base);
  draft.exceptions = [{ action: 'WITHDRAW_FROM_WALLET', accountIds: '7, 8' }, { action: 'FUND_CARD', accountIds: '9' }];
  const patch = refundPolicyPatch(base, refundPolicyPayload(draft));
  assert.deepEqual(patch, { autoRefundAllowedAccountIdsByAction: { WITHDRAW_FROM_WALLET: [7, 8], FUND_CARD: [9] } });
  draft.exceptions = []; assert.deepEqual(refundPolicyPatch(base, refundPolicyPayload(draft)), { autoRefundAllowedAccountIdsByAction: {} });
  draft.exceptions = [{ action: 'WITHDRAW_FROM_WALLET', accountIds: 'bad' }]; assert.throws(() => refundPolicyPayload(draft));
});

test('admin and assistant permissions match existing wallet policy read/write roles', async () => {
  const { refundPermissions, invalidStoredRefundRules } = await helpers;
  for (const role of ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT', 'STAFF', 'CUSTOMER']) assert.deepEqual(refundPermissions(session(role)), { canRead: ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT'].includes(role), canWrite: ['ADMIN', 'SUPER_ADMIN'].includes(role) });
  assert.equal(invalidStoredRefundRules({ status: 500, message: 'Stored auto-refund rules are invalid; automatic refunds require manual review' }), true);
  assert.equal(invalidStoredRefundRules({ status: 500, message: 'Database unavailable' }), false);
});

test('wallet policy API retains the admin token, no-store behavior and in-place forbidden handling', async (t) => {
  const original = global.fetch, originalWindow = global.window; t.after(() => { global.fetch = original; if (originalWindow === undefined) delete global.window; else global.window = originalWindow; });
  const { api } = await load('lib/api.js', 'refund-api'); api.setAuthToken('refund-admin-token');
  const calls = []; let loggedOut = 0; global.window = { dispatchEvent: () => { loggedOut++; } };
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(empty()); };
  await api.walletPolicyConfig.get(); await api.walletPolicyConfig.update({ autoRefundRules: [] });
  for (const { url, init } of calls) { assert.match(url, /\/admin-api\/wallet-policy-config$/); assert.equal(init.headers.Authorization, 'Bearer refund-admin-token'); assert.equal(init.cache, 'no-store'); }
  assert.deepEqual(JSON.parse(calls[1].init.body), { autoRefundRules: [] });
  global.fetch = async () => Response.json({ message: 'Denied' }, { status: 403 });
  await assert.rejects(api.walletPolicyConfig.update({ autoRefundRules: [] }), (err) => err.status === 403);
  assert.equal(loggedOut, 0);
});

async function panel({ role = 'ADMIN', initial = empty(), update, get, global = false, onRecovered = () => {} } = {}) {
  const h = await helpers, writes = [], reads = [], refreshSession = async () => {};
  let current = initial;
  const api = { walletPolicyConfig: {
    get: async () => { reads.push('policy'); return get ? get() : current; },
    update: async (body) => { writes.push(body); if (update) return update(body); current = { ...current, ...body }; return current; }
  }, featureFlags: { get: async (key) => { assert.equal(key, 'auto_refund'); return { key, enabled: global }; } } };
  const view = await mountComponent(path.join(__dirname, '../components/AutoRefundPolicyPanel.js'), {
    props: { onRecovered }, modules: {
      '@/contexts/AuthContext': { useAuth: () => ({ session: session(role), refreshSession }) }, '@/lib/api': { api }, '@/lib/auto-refund-policy': h,
      '@/components/DataTable': { DataTable: 'table' }, '@/components/ContentModal': { ContentModal: 'dialog' }
    }
  });
  await view.flush();
  return { view, writes, reads, setCurrent(value) { current = value; }, rules: () => view.nodes().find((node) => node.type === 'table')?.props.rows,
    async add(rule = scoped()) { await view.click('Add rule'); const modal = view.nodes().find((node) => node.type?.name === 'RefundRuleEditor').props; modal.onApply(rule); modal.onClose(); await view.flush(); }
  };
}

test('global-off status stays explicit and policy drafts are saved separately without enabling automatic refunds', async () => {
  const p = await panel();
  assert.match(p.view.text(), /Global auto_refund: Off/);
  await p.add(); assert.equal(p.view.button('Save refund policy').disabled, false);
  await p.view.click('Save refund policy');
  assert.deepEqual(Object.keys(p.writes[0]), ['autoRefundRules']); assert.equal(p.writes[0].autoRefundRules[0].name, scoped().name);
  assert.match(p.view.text(), /Refund policy saved/); assert.match(p.view.text(), /Global auto_refund: Off/);
  assert.equal(p.view.button('Save refund policy').disabled, true);
});

test('reordering and clearing scoped rules retain list order and restore only the legacy fallback', async () => {
  const initial = { ...empty(), autoRefundRules: [scoped(), { ...scoped('Block payouts'), decision: 'BLOCK', paymentProviders: [] }] };
  const p = await panel({ initial });
  const table = p.view.nodes().find((node) => node.type === 'table').props;
  const menu = table.columns.find((column) => column.key === 'actions').render(table.rows[1]);
  require('react').Children.toArray(menu.props.children).find((node) => node.props.children === 'Move up').props.onClick(); await p.view.flush();
  assert.deepEqual(p.rules().map((row) => row.name), ['Block payouts', scoped().name]);
  await p.view.click('Save refund policy'); assert.equal(p.writes[0].autoRefundRules[0].decision, 'BLOCK');
  await p.view.click('Clear scoped rules'); await p.view.click('Save refund policy');
  assert.deepEqual(p.writes[1], { autoRefundRules: [] });
});

test('failed saves keep drafts, denied saves become read-only, and duplicate submissions are locked', async () => {
  const failed = await panel({ update: async () => { throw Object.assign(new Error('Invalid rule'), { status: 400 }); } });
  await failed.add(); await failed.view.click('Save refund policy');
  assert.equal(failed.rules()[0].name, scoped().name); assert.match(failed.view.text(), /Invalid rule/); assert.equal(failed.view.button('Save refund policy').disabled, false);
  const denied = await panel({ update: async () => { throw Object.assign(new Error('Denied'), { status: 403 }); } });
  await denied.add(); await denied.view.click('Save refund policy'); assert.equal(denied.view.button('Save refund policy').disabled, true); assert.match(denied.view.text(), /Read only/);
  let release;
  const pending = await panel({ update: (body) => new Promise((resolve) => { release = () => resolve({ ...empty(), ...body }); }) });
  await pending.add(); const submit = pending.view.button('Save refund policy').onClick; submit(); await pending.view.flush(); submit(); await pending.view.flush(); assert.equal(pending.writes.length, 1);
  release(); await pending.view.flush(); assert.match(pending.view.text(), /Refund policy saved/);
});

test('concurrent edits require a review while keeping the local draft and unrelated server changes', async () => {
  const p = await panel(); await p.add(scoped('Local rule'));
  p.setCurrent({ ...empty(), autoRefundRules: [scoped('Other admin rule')], autoRefundTimeoutAllowedActions: [] });
  await p.view.click('Save refund policy'); assert.equal(p.writes.length, 0); assert.equal(p.rules()[0].name, 'Local rule');
  assert.equal(p.view.button('Save refund policy').disabled, true);
  await p.view.click('I reviewed the current policy · keep my edits'); await p.view.click('Save refund policy');
  assert.deepEqual(Object.keys(p.writes[0]), ['autoRefundRules']); assert.equal(p.writes[0].autoRefundRules[0].name, 'Local rule');
});

test('an uncertain successful write cannot be repeated until the current saved policy is reviewed', async () => {
  let remote = empty();
  const p = await panel({ get: async () => remote, update: async (body) => { remote = { ...remote, ...body }; throw new Error('Connection lost after sending'); } });
  await p.add(); await p.view.click('Save refund policy');
  assert.equal(p.writes.length, 1); assert.equal(p.view.button('Save refund policy').disabled, true); assert.equal(p.rules()[0].name, scoped().name);
  assert.equal(p.view.button('Discard refund changes').disabled, true);
  await p.view.click('Load current saved policy'); await p.view.click('I reviewed the current policy · keep my edits');
  assert.match(p.view.text(), /No unsaved refund changes/); assert.equal(p.view.button('Save refund policy').disabled, true); assert.equal(p.writes.length, 1);
});

test('unsupported backend responses cannot be overwritten, and invalid stored rules have a narrowly scoped recovery path', async () => {
  const unsupported = await panel({ initial: { autoRefundBlockedActions: [] } });
  assert.match(unsupported.view.text(), /does not expose/); assert.ok(!unsupported.view.nodes().some((node) => node.type === 'button' && node.props.children === 'Save refund policy'));
  let recovered = 0;
  const broken = await panel({ get: async () => { throw Object.assign(new Error('Stored auto-refund rules are invalid; automatic refunds require manual review'), { status: 500 }); }, update: async (body) => ({ ...empty(), ...body }), onRecovered: () => { recovered++; } });
  await broken.view.click('Prepare replacement rules'); await broken.view.click('Save refund policy');
  assert.deepEqual(broken.writes, [{ autoRefundRules: [] }]); assert.equal(recovered, 1); assert.match(broken.view.text(), /Refund policy saved/);
});

test('recovery does not silently replace rules repaired by another admin', async () => {
  let broken = true;
  const p = await panel({ get: async () => { if (broken) throw Object.assign(new Error('Stored auto-refund rules are invalid'), { status: 500 }); return { ...empty(), autoRefundRules: [scoped('Repaired policy')] }; } });
  await p.view.click('Prepare replacement rules'); broken = false;
  await p.view.click('Save refund policy');
  assert.equal(p.writes.length, 0); assert.equal(p.view.button('Save refund policy').disabled, true); assert.match(p.view.text(), /Repaired policy/);
  await p.view.click('Use current saved policy'); assert.match(p.view.text(), /No unsaved refund changes/);
  assert.ok(!p.view.nodes().some((node) => node.type === 'button' && node.props.children === 'Prepare replacement rules'));
});

test('assistants can inspect but cannot save, and non-admin roles do not load refund data', async () => {
  const read = await panel({ role: 'ASSISTANT' }); assert.equal(read.view.button('Add rule').disabled, true); assert.equal(read.view.button('Save refund policy').disabled, true);
  const denied = await panel({ role: 'STAFF' }); assert.equal(denied.reads.length, 0); assert.match(denied.view.text(), /Admin access is required/);
});

test('a broad rule requires an intentional All automatic refunds selection', async () => {
  const h = await helpers; let applied;
  const view = await mountComponent(path.join(__dirname, '../components/AutoRefundPolicyPanel.js'), {
    exportName: 'RefundRuleEditor', props: { rules: [], index: null, onApply: (rule) => { applied = rule; }, onClose() {} }, modules: {
      '@/contexts/AuthContext': { useAuth: () => ({}) }, '@/lib/api': { api: {} }, '@/lib/auto-refund-policy': h, '@/components/DataTable': { DataTable: 'table' }, '@/components/ContentModal': { ContentModal: 'dialog' }
    }
  });
  view.change('Rule name', 'Broad rule'); await view.click('Add to draft'); assert.equal(applied, undefined); assert.match(view.text(), /Select at least one filter/);
  view.change('Applies to', 'ALL'); await view.click('Add to draft'); assert.equal(h.globalRefundRule(applied), true); assert.equal(applied.decision, 'BLOCK');
});

async function walletPage(fail = false) {
  const h = await helpers, writes = [];
  const view = await mountComponent(path.join(__dirname, '../app/(dashboard)/dashboard/wallet-policy-config/page.js'), {
    props: {}, modules: {
      '@/contexts/AuthContext': { useAuth: () => ({ session: session('ADMIN') }) }, '@/lib/auto-refund-policy': h,
      '@/components/CatalogSelect': { CatalogSelect: 'picker' }, '@/components/AutoRefundPolicyPanel': { __esModule: true, default: 'refund-panel' }, '@/lib/payment-method-labels': { paymentMethodAdminLabel: (record) => record.name },
      '@/lib/api': { api: { walletPolicyConfig: { get: async () => { if (fail) throw new Error('Stored auto-refund rules are invalid'); return { ...empty(), interTransferCooldownMinutes: 10 }; }, update: async (body) => { writes.push(body); } }, cryptoProducts: { list: async () => [] }, cryptoNetworks: { list: async () => [] }, paymentMethods: { options: async () => [] }, currencyProducts: { list: async () => [] } } }
    }
  });
  await view.flush(); return { view, writes };
}

test('other wallet saves omit refund fields and switching sections keeps the refund panel mounted', async () => {
  const { view, writes } = await walletPage();
  await view.click('Save'); assert.equal(writes.length, 1);
  assert.ok(!Object.keys(writes[0]).some((key) => key.startsWith('autoRefund')));
  await view.click('Automatic refunds'); assert.ok(view.nodes().some((node) => node.type === 'refund-panel'));
  await view.click('Operations'); assert.ok(view.nodes().some((node) => node.type === 'refund-panel'));
});

test('a failed wallet settings load disables other saves but leaves the refund recovery tab reachable', async () => {
  const { view, writes } = await walletPage(true);
  assert.equal(view.button('Save').disabled, true); await view.click('Save'); assert.equal(writes.length, 0);
  await view.click('Automatic refunds'); assert.ok(view.nodes().some((node) => node.type === 'refund-panel'));
});
