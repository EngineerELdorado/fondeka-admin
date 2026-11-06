const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const load = (file, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64')}#${tag}`);
const session = (role) => ({ tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } });
const rule = { id: 12, version: 7, accountId: null, service: 'BILL_PAYMENTS', billProductId: 12, basis: 'NET_AMOUNT', percentage: 2.5, enabled: true, maxPoints: null, notes: 'Approved rate' };
const root = { id: 1, version: 3, accountId: null, service: null, billProductId: null, ownPurchaseRewardsEnabled: true, eligibleInviteeRewardMode: 'RESELLER', otherInviteeReferralRewardsEnabled: true, inviteeResellerCutoff: 'PERMANENT', preEnrollmentPointsRedeemable: true, notes: null };

test('only Admins inspect resellers and only Super Admins can mutate', async () => {
  const { resellerPermissions } = await load('lib/resellers.js');
  for (const role of ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT', 'STAFF', 'CUSTOMER', '']) assert.deepEqual(resellerPermissions(session(role)), { canRead: ['ADMIN', 'SUPER_ADMIN'].includes(role), canWrite: role === 'SUPER_ADMIN' });
  assert.deepEqual(resellerPermissions(null), { canRead: false, canWrite: false });
});

test('program and enrollment use saved versions and explicit false without commercial fields', async () => {
  const { resellerProgramPayload, resellerEnrollmentPayload } = await load('lib/resellers.js');
  assert.deepEqual(resellerProgramPayload({ enabled: false, percentage: 90 }, { version: 8 }), { enabled: false, version: 8 });
  assert.deepEqual(resellerEnrollmentPayload({ enabled: false, notes: ' Révision 👋 ' }, { version: 0 }), { enabled: false, version: 0, notes: 'Révision 👋' });
  assert.throws(() => resellerProgramPayload({ enabled: null }, { version: 0 }));
  assert.throws(() => resellerEnrollmentPayload({ enabled: true, notes: '' }, { version: null }));
  assert.throws(() => resellerEnrollmentPayload({ enabled: true, notes: 'x'.repeat(1001) }, { version: 0 }));
});

test('commission payloads keep zero, nullable scopes, numeric percentages and independent currency caps', async () => {
  const { resellerDraft, resellerRulePayload } = await load('lib/resellers.js');
  const draft = resellerDraft('rule', { ...rule, enabled: false, percentage: 0 });
  assert.deepEqual(resellerRulePayload(draft, rule), { accountId: null, service: 'BILL_PAYMENTS', billProductId: 12, basis: 'NET_AMOUNT', percentage: 0, enabled: false, maxPoints: null, notes: 'Approved rate', version: 7 });
  const created = resellerRulePayload({ ...draft, accountId: 35418, percentage: '2.5001', maxPoints: '10.25' });
  assert.equal(created.percentage, 2.5001); assert.equal(created.maxPoints, 10.25); assert.equal(Object.hasOwn(created, 'version'), false);
  for (const patch of [{ percentage: '2.50001' }, { percentage: '-1' }, { percentage: '101' }, { percentage: '' }, { percentage: 'NaN' }, { maxPoints: '0' }, { maxPoints: '1.001' }, { service: 'AIRTIME_AND_DATA' }, { basis: 'GROSS_AMOUNT' }, { enabled: null }, { billProductId: '-4' }]) assert.throws(() => resellerRulePayload({ ...draft, ...patch }, rule));
});

test('new commission rules require a specific product unless a service default is explicitly chosen', async () => {
  const { resellerDraft, resellerRulePayload } = await load('lib/resellers.js');
  const draft = { ...resellerDraft('rule'), percentage: '3', enabled: true };
  assert.equal(draft.accountId, null); assert.equal(draft.productScope, 'PRODUCT');
  assert.throws(() => resellerRulePayload(draft), /Choose a bill product/);
  const product = resellerRulePayload({ ...draft, billProductId: '12' });
  assert.equal(product.accountId, null); assert.equal(product.billProductId, 12);
  assert.equal(product.maxPoints, null); assert.equal(Object.hasOwn(product, 'productScope'), false);
  const service = resellerRulePayload({ ...draft, productScope: 'SERVICE' });
  assert.equal(service.billProductId, null); assert.equal(Object.hasOwn(service, 'version'), false);
  const existing = { ...rule, billProductId: null, enabled: false, percentage: 0 };
  const savedDefault = resellerDraft('rule', existing);
  assert.equal(savedDefault.productScope, 'SERVICE');
  const expected = { ...existing }; delete expected.id;
  assert.deepEqual(resellerRulePayload(savedDefault, existing), expected);
});

test('commission rule filters find products and exclusions without changing their order or values', async () => {
  const { filterResellerRules } = await load('lib/resellers.js');
  const rows = [
    { ...rule, id: 3, billProductCode: 'CANAL_PLUS_DRC', billProductName: 'Canal Plus Congo' },
    { ...rule, id: 4, billProductId: 77, billProductCode: 'SOCODEE', enabled: false },
    { ...rule, id: 5, billProductId: 88, billProductName: 'Électricité locale', percentage: 0 },
    { ...rule, id: 6, billProductId: null, enabled: false, percentage: 0 }
  ];
  assert.deepEqual(filterResellerRules(rows), rows);
  assert.deepEqual(filterResellerRules(rows, { search: 'canal plus' }), [rows[0]]);
  assert.deepEqual(filterResellerRules(rows, { search: 'electricite' }), [rows[2]]);
  assert.deepEqual(filterResellerRules(rows, { search: '77', status: 'disabled' }), [rows[1]]);
  assert.deepEqual(filterResellerRules(rows, { search: 'service default' }), [rows[3]]);
  assert.deepEqual(filterResellerRules(rows, { status: 'enabled' }), [rows[0]]);
  assert.deepEqual(filterResellerRules(rows, { status: 'zero' }), [rows[2]]);
  assert.deepEqual(filterResellerRules(rows, { status: 'disabled' }), [rows[1], rows[3]]);
});

test('sparse policies preserve false and null independently, and cannot offer a combined reward path', async () => {
  const { resellerDraft, resellerPolicyPayload } = await load('lib/resellers.js');
  const draft = resellerDraft('policy', {}, 35418);
  draft.ownPurchaseRewardsEnabled = false; draft.eligibleInviteeRewardMode = 'NONE'; draft.preEnrollmentPointsRedeemable = false;
  const payload = resellerPolicyPayload(draft);
  assert.equal(payload.accountId, 35418); assert.equal(payload.service, null); assert.equal(payload.billProductId, null);
  assert.equal(payload.ownPurchaseRewardsEnabled, false); assert.equal(payload.preEnrollmentPointsRedeemable, false);
  assert.equal(payload.otherInviteeReferralRewardsEnabled, null); assert.equal(payload.inviteeResellerCutoff, null);
  assert.equal(Object.hasOwn(payload, 'version'), false);
  assert.throws(() => resellerPolicyPayload({ ...draft, eligibleInviteeRewardMode: 'BOTH' }));
  assert.throws(() => resellerPolicyPayload({ ...draft, billProductId: 12, service: 'COMMERCE' }));
  assert.throws(() => resellerPolicyPayload({ ...draft, service: 'TYPO_SERVICE' }));
  assert.equal(resellerPolicyPayload({ ...draft, service: 'COMMERCE' }).service, 'COMMERCE');
});

test('global default policies remain complete, immovable and undeletable scopes', async () => {
  const { resellerDraft, resellerPolicyPayload, resellerRootPolicy } = await load('lib/resellers.js');
  assert.equal(resellerRootPolicy(root), true);
  const draft = resellerDraft('policy', root);
  assert.equal(resellerPolicyPayload(draft, root).version, root.version);
  assert.throws(() => resellerPolicyPayload({ ...draft, ownPurchaseRewardsEnabled: null }, root));
  assert.throws(() => resellerPolicyPayload({ ...draft, service: 'BILL_PAYMENTS' }, root));
  assert.equal(resellerRootPolicy({ ...root, accountId: 35418 }), false);
});

test('effective source explanations honor explicit false and source order without guessing over missing versions', async () => {
  const { resellerFieldSource } = await load('lib/resellers.js');
  const override = { ...root, id: 4, version: 1, accountId: 35418, ownPurchaseRewardsEnabled: false, preEnrollmentPointsRedeemable: null };
  const sources = [{ id: 4, version: 1 }, { id: 1, version: 3 }];
  assert.equal(resellerFieldSource('ownPurchaseRewardsEnabled', sources, [root, override]), override);
  assert.equal(resellerFieldSource('preEnrollmentPointsRedeemable', sources, [root, override]), root);
  assert.equal(resellerFieldSource('ownPurchaseRewardsEnabled', sources, [root, { ...override, version: 2 }]), null);
  assert.equal(resellerFieldSource('ownPurchaseRewardsEnabled', sources, [root]), null);
});

test('retention changes include restoring inheritance and moving an explicit retention override', async () => {
  const { resellerDraft, resellerRetentionChanged } = await load('lib/resellers.js');
  const draft = resellerDraft('policy', root);
  assert.equal(resellerRetentionChanged(draft, root), false);
  assert.equal(resellerRetentionChanged({ ...draft, preEnrollmentPointsRedeemable: false }, root), true);
  assert.equal(resellerRetentionChanged({ ...draft, preEnrollmentPointsRedeemable: null }, root), true);
  assert.equal(resellerRetentionChanged({ ...draft, service: 'BILL_PAYMENTS' }, root), true);
});

test('unavailable saved settings never synthesize enabled enrollment or program defaults', async () => {
  const { resellerRecord, resellerPage, resellerNumber } = await load('lib/resellers.js');
  assert.throws(() => resellerRecord('program', { version: 0 }));
  assert.throws(() => resellerRecord('enrollment', { accountId: 1, reseller: false, version: 0 }));
  assert.throws(() => resellerRecord('rule', { ...rule, version: '7' }));
  assert.throws(() => resellerRecord('policy', { ...root, ownPurchaseRewardsEnabled: undefined }));
  assert.equal(resellerRecord('program', { enabled: false, version: 0 }).enabled, false);
  assert.throws(() => resellerPage([]));
  assert.ok(resellerNumber(-4).includes('-')); // A reversal deficit must never be silently clamped away.
});

test('reseller API encodes selectors, sends versioned complete mutations and never calls financial/provider actions', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'reseller-api'); api.setAuthToken('reseller-admin-token');
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return init?.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({ enabled: false, version: 1 }); };
  await api.resellers.program(); await api.resellers.updateProgram({ enabled: false, version: 7 });
  await api.resellers.accounts({ enabled: false, page: 0, size: 20 });
  await api.resellers.enrollmentByEmail(' Customer+pilot@Example.com ');
  await api.resellers.updateEnrollmentByEmail(' Customer+pilot@Example.com ', { enabled: true, notes: '', version: 0 });
  await api.resellers.enrollment(42); await api.resellers.updateEnrollment(42, { enabled: false, version: 2, notes: null });
  await api.resellers.rules.list(); await api.resellers.rules.list(42); await api.resellers.rules.create({ percentage: 0, enabled: false }); await api.resellers.rules.update(12, { ...rule, version: 7 }); await api.resellers.rules.remove(12, 7);
  await api.resellers.policies.list(42); await api.resellers.policies.get(4); await api.resellers.policies.effective({ accountId: 42, service: 'BILL_PAYMENTS', billProductId: 12 }); await api.resellers.policies.create({ ...root, id: undefined, version: undefined }); await api.resellers.policies.update(1, root); await api.resellers.policies.remove(4, 1);
  await api.resellers.summary(42); await api.resellers.rewards(42, { page: 0, size: 20 }); await api.resellers.entries(42, { page: 1, size: 20 }); await api.resellers.decision(91); await api.resellers.reconcile(91);
  assert.match(calls[0].url, /\/admin-api\/resellers\/program$/);
  assert.deepEqual(JSON.parse(calls[1].init.body), { enabled: false, version: 7 });
  assert.equal(new URL(calls[2].url, 'https://admin.local').searchParams.get('enabled'), 'false');
  assert.match(calls[3].url, /Customer%2Bpilot%40Example.com/);
  assert.match(calls[7].url, /\/rules$/); assert.match(calls[8].url, /\/rules\?accountId=42$/);
  assert.match(calls[11].url, /\/rules\/12\?version=7$/);
  assert.match(calls[17].url, /\/policies\/4\?version=1$/);
  assert.match(calls.at(-1).url, /\/transactions\/91\/reconcile$/);
  assert.equal(calls.at(-1).init.method, 'POST'); assert.equal(calls.at(-1).init.body, undefined);
  for (const call of calls) { assert.equal(call.init.headers.Authorization, 'Bearer reseller-admin-token'); assert.equal(call.init.cache, 'no-store'); assert.doesNotMatch(call.url, /redeem|refund|retry|momo-status|submit|payout/); }
});

test('403 reseller mutations remain in place for read-only feedback instead of forcing logout', async (t) => {
  const originalFetch = global.fetch, originalWindow = global.window;
  t.after(() => { global.fetch = originalFetch; if (originalWindow === undefined) delete global.window; else global.window = originalWindow; });
  global.window = { dispatchEvent: () => { throw new Error('Must not sign the operator out'); } };
  global.fetch = async () => Response.json({ message: 'Stored admin role must be SUPER_ADMIN' }, { status: 403 });
  const { api } = await load('lib/api.js', 'reseller-forbidden');
  await assert.rejects(api.resellers.updateProgram({ enabled: true, version: 0 }), (err) => err.status === 403 && /SUPER_ADMIN/.test(err.message));
});

async function editor(props) {
  const { mountComponent } = require('./helpers/component-harness.cjs');
  const helpers = await load('lib/resellers.js'), presentation = await load('lib/regulator-presentation.js');
  return mountComponent(path.join(__dirname, '../components/resellers/Editor.js'), {
    props: { kind: 'rule', record: rule, canWrite: true, onClose() {}, onSaved() {}, ...props },
    modules: (React) => ({
      '@/lib/resellers': helpers,
      '@/components/ContentModal': { ContentModal: 'dialog' },
      '@/components/RegulatorPresentation': { PresentationSelect: 'select' },
      '@/lib/regulator-presentation': presentation,
      './Common': { Alert: 'alert', Field: 'field', Facts: 'facts', BehaviorFacts: 'behavior', ProductPicker: 'picker', PrefundingCurrencyPicker: 'currency-picker', actionStyle: {}, gridStyle: {}, useMounted: () => React.useRef(true), useResellerError: () => async (err) => err.message }
    })
  });
}

test('failed editor saves retain the draft and do not update saved state; retry uses the original version', async () => {
  let fail = true, accepted = null, submitted;
  const view = await editor({ onSaved: (value) => { accepted = value; }, onSave: async (payload) => { submitted = payload; if (fail) throw Object.assign(new Error('Validation error'), { status: 400 }); return { ...rule, ...payload, version: 8 }; } });
  view.change('Percentage', '3.25'); await view.click('Save');
  assert.equal(accepted, null); assert.equal(view.field('Percentage').props.value, '3.25'); assert.ok(view.text().includes('Validation error'));
  fail = false; await view.click('Save'); assert.equal(submitted.version, 7); assert.equal(accepted.percentage, 3.25);
});

test('conflicts preserve drafts and require explicit review before submitting a newer version', async () => {
  let conflict = true, calls = 0, submitted;
  const view = await editor({ onReload: async () => ({ ...rule, version: 8, percentage: 5 }), onSave: async (payload) => { submitted = payload; calls++; if (conflict) throw Object.assign(new Error('Another admin changed this rule'), { status: 409 }); return { ...rule, ...payload, version: 9 }; } });
  view.change('Percentage', '3'); await view.click('Save'); assert.equal(calls, 1); assert.equal(view.button('Save').disabled, true);
  await view.click('Refresh latest saved settings'); assert.equal(calls, 1); assert.equal(view.button('Save').disabled, true); assert.equal(view.field('Percentage').props.value, '3');
  await view.click('I reviewed version 8 — apply my draft'); conflict = false; await view.click('Save');
  assert.equal(submitted.version, 8); assert.equal(submitted.percentage, 3);
});

test('duplicate-scope creation adopts an existing record only after the operator reviews it', async () => {
  let first = true, target;
  const view = await editor({ record: {}, onReload: async () => rule, onSave: async (payload, base) => { target = base.id; if (first) throw Object.assign(new Error('Duplicate scope'), { status: 409 }); return { ...rule, ...payload, version: 8 }; } });
  view.field('Bill product').props.onChange('12'); await view.flush();
  view.change('Percentage', '4'); await view.click('Save'); assert.equal(target, undefined);
  await view.click('Refresh latest saved settings'); await view.click('I reviewed version 7 — apply my draft');
  first = false; await view.click('Save'); assert.equal(target, rule.id);
});

test('a new global product rule never silently saves an all-products default', async () => {
  let submitted;
  const view = await editor({ record: {}, onSave: async (payload) => { submitted = payload; return { ...rule, ...payload, version: 0 }; } });
  view.change('Percentage', '3'); view.change('Commission rule', 'true');
  await view.click('Save'); assert.equal(submitted, undefined); assert.match(view.text(), /Choose a bill product/);
  view.field('Bill product').props.onChange('12'); await view.flush();
  await view.click('Save');
  assert.equal(submitted.billProductId, 12); assert.equal(submitted.accountId, null);
  assert.equal(submitted.percentage, 3); assert.equal(submitted.enabled, true);
  const service = await editor({ record: {}, onSave: async (payload) => { submitted = payload; return { ...rule, ...payload, version: 0 }; } });
  service.change('Percentage', '0'); service.change('Product scope', 'SERVICE');
  assert.ok(!service.nodes().some((node) => node.props.label === 'Bill product'));
  await service.click('Save');
  assert.equal(submitted.billProductId, null); assert.equal(submitted.enabled, false); assert.equal(submitted.percentage, 0);
});

test('retention changes and first enrollment require an impact acknowledgement', async () => {
  let submitted;
  const behavior = await editor({ kind: 'policy', record: root, onSave: async (payload) => { submitted = payload; return { ...root, ...payload, version: 4 }; } });
  behavior.change('Pre-enrollment points redeemable', 'false');
  assert.equal(behavior.button('Save').disabled, true); assert.ok(behavior.text().includes('existing spendability in BOTH reseller and referral balances'));
  behavior.check(true); await behavior.click('Save'); assert.equal(submitted.preEnrollmentPointsRedeemable, false);
  const enrollment = await editor({ kind: 'enrollment', record: { accountId: 42, reseller: false, upstreamEarningsBlocked: false, enabledSince: null, notes: null, version: 0 }, onSave: async (payload) => { submitted = payload; return { accountId: 42, reseller: true, upstreamEarningsBlocked: true, version: 0 }; } });
  enrollment.change('Reseller enrollment', 'true'); assert.equal(enrollment.button('Save').disabled, true);
  assert.ok(enrollment.text().includes('First activation stops the direct inviter earning'));
  enrollment.check(true); await enrollment.click('Save'); assert.equal(submitted.enabled, true); assert.equal(submitted.version, 0);
});

test('read-only and server-denied editors prevent subsequent mutation attempts', async () => {
  const readOnly = await editor({ canWrite: false });
  assert.ok(readOnly.nodes().find((node) => node.type === 'fieldset').props.disabled);
  assert.ok(!readOnly.nodes().some((node) => node.type === 'button' && node.props.children === 'Save'));
  const denied = await editor({ onSave: async () => { throw Object.assign(new Error('Permission denied'), { status: 403 }); } });
  denied.change('Percentage', '4'); await denied.click('Save');
  assert.ok(denied.nodes().find((node) => node.type === 'fieldset').props.disabled);
  assert.ok(!denied.nodes().some((node) => node.type === 'button' && node.props.children === 'Save'));
});

test('a malformed success response does not claim the draft was saved', async () => {
  let accepted = false;
  const view = await editor({ onSave: async () => ({ ...rule, version: null }), onSaved: () => { accepted = true; } });
  view.change('Percentage', '4'); await view.click('Save'); assert.equal(accepted, false); assert.equal(view.button('Save').disabled, true); assert.equal(view.field('Percentage').props.value, '4');
});

async function inspector({ canWrite = true, decision, reconcile } = {}) {
  const { mountComponent } = require('./helpers/component-harness.cjs');
  const helpers = await load('lib/resellers.js');
  return mountComponent(path.join(__dirname, '../components/resellers/TransactionInspector.js'), {
    exportName: 'TransactionInspector', props: { transactionId: 91, canWrite },
    modules: (React) => ({
      '@/lib/resellers': helpers, '@/lib/api': { api: { resellers: { decision, reconcile } } },
      '@/contexts/AuthContext': { useAuth: () => ({ session: session('SUPER_ADMIN') }) },
      '@/components/RegulatorPresentation': { PresentationLink: 'a' },
      './Common': { Card: 'section', Alert: 'alert', Field: 'field', Facts: 'facts', BehaviorFacts: 'behavior', actionStyle: {}, useMounted: () => React.useRef(true), useResellerError: () => async (err) => err.message }
    })
  });
}

test('purchase inspection displays the frozen policy and distinguishes missing decisions from payment failure', async () => {
  let reads = 0;
  const frozen = { ...root, preEnrollmentPointsRedeemable: false };
  const view = await inspector({ decision: async (id) => { reads++; assert.equal(id, 91); return { sourceTransactionId: 91, mode: 'REFERRAL', policy: frozen, policySources: [{ id: 3, version: 2 }], purchasingAccountId: 100, beneficiaryAccountId: 42, cancelledByEnrollment: true }; } });
  await view.click('Read captured decision'); assert.equal(reads, 1);
  assert.equal(view.nodes().find((node) => node.type === 'behavior').props.values, frozen);
  assert.ok(view.text().includes('version 2')); assert.ok(view.text().includes('Check referral history'));
  const missing = await inspector({ decision: async () => { throw Object.assign(new Error('Not found'), { status: 404 }); } });
  await missing.click('Read captured decision'); assert.ok(missing.text().includes('does not mean the payment failed'));
});

test('reconciliation requires acknowledgement, prevents duplicate submission, and uses no provider API', async () => {
  let release, calls = 0;
  const view = await inspector({ reconcile: async (id) => { calls++; assert.equal(id, 91); return new Promise((resolve) => { release = resolve; }); } });
  assert.equal(view.button('Reconcile reward').disabled, true);
  view.check(true); await view.click('Reconcile reward'); await view.click('Reconcile reward'); assert.equal(calls, 1);
  release({ sourceTransactionId: 91, status: 'APPROVED', points: 3, currency: 'USD' }); await view.flush();
  assert.ok(view.text().includes('APPROVED')); assert.equal(view.button('Reconcile reward').disabled, true);
  const reader = await inspector({ canWrite: false }); assert.ok(!reader.nodes().some((node) => node.type === 'button' && node.props.children === 'Reconcile reward'));
});

test('currency balances keep held/deficit/earned/redeemed/reversed independent without an aggregate total', async () => {
  const { mountComponent } = require('./helpers/component-harness.cjs');
  const helpers = await load('lib/resellers.js');
  const rows = [{ currency: 'USD', available: 6, held: 4, deficit: 0, lifetimeEarned: 14, redeemed: 4, reversed: 0 }, { currency: 'CDF', available: 0, held: 0, deficit: 12, lifetimeEarned: 10, redeemed: 10, reversed: 12 }];
  const view = await mountComponent(path.join(__dirname, '../components/resellers/AccountWorkspace.js'), {
    exportName: 'AccountWorkspace', props: { accountId: 42, canWrite: false }, modules: {
      '@/contexts/AuthContext': { useAuth: () => ({}) }, '@/components/RegulatorPresentation': { PresentationLink: 'a' }, '@/lib/api': { api: { resellers: {} } }, '@/components/DataTable': { DataTable: 'table' },
      '@/components/ContentModal': { ContentModal: 'dialog' }, '@/components/TableCell': { TableCellLines: 'paired' }, '@/lib/resellers': helpers, './Editor': { __esModule: true, default: 'editor' }, './TransactionInspector': { TransactionInspector: 'inspector' }, './ProductRateEditor': { __esModule: true, default: 'rate-editor' }, './ConfigurationPanel': { __esModule: true, default: 'configuration' }, './Navigation': { __esModule: true, default: 'navigation' }, './resellers.module.css': { __esModule: true, default: {} },
      './Common': { Card: 'section', Facts: 'facts', Badge: 'badge', BehaviorFacts: 'behavior', ProductMarketPicker: 'market', Field: 'field', ResourceStatus: 'status', actionStyle: {}, useResellerResource: () => ({ data: { accountId: 42, reseller: false, upstreamEarningsBlocked: true, version: 0, countryCode: '', summary: { pointsByCurrency: rows, billProducts: [], earningEnabled: false } }, ready: true }) }
    }
  });
  const balances = view.nodes().find((node) => node.type === 'table' && node.props.rows === rows);
  assert.ok(balances);
  assert.deepEqual(balances.props.rows.map((row) => row.currency), ['USD', 'CDF']);
  for (const key of ['available', 'held', 'deficit', 'lifetimeEarned', 'redeemed', 'reversed']) {
    const column = balances.props.columns.find((entry) => entry.key === key);
    assert.equal(column.render(rows[1]), helpers.resellerNumber(rows[1][key]));
  }
  assert.ok(!balances.props.columns.some((entry) => entry.key === 'total'));
});

test('reseller detail facts preserve false settings and respect Review mode field filtering', async () => {
  const { mountComponent } = require('./helpers/component-harness.cjs');
  const { renderToStaticMarkup } = require('react-dom/server');
  const helpers = await load('lib/resellers.js'), presentation = await load('lib/regulator-presentation.js');
  const view = await mountComponent(path.join(__dirname, '../components/resellers/Common.js'), {
    exportName: 'Facts', props: { rows: [['Wallet transaction ID', 123], ['Balance', 100], ['Policy version', 3], ['Own purchase rewards', false]] }, modules: {
      '@/lib/resellers': helpers, '@/lib/regulator-presentation': presentation, '@/contexts/AuthContext': { useAuth: () => ({ enableRegulatorMode: true }) }, '@/lib/api': { api: {} }, '@/components/CountrySelect': { CountrySelect: 'country-picker' }, '@/components/CatalogSelect': { CatalogSelect: 'picker' }
    }
  });
  const html = renderToStaticMarkup(view.nodes()[0]);
  assert.doesNotMatch(html, /Wallet transaction ID|>123<|Balance|>100</);
  assert.match(html, /Policy version/); assert.match(html, /Disabled/);
});

const requirements = { selfServiceEnabled: false, prefundingAmount: 100, prefundingCurrency: 'USD', version: 4 };

test('self-service payloads preserve zero and false, normalize currency and never change earning or rates', async () => {
  const { resellerDraft, resellerRequirementsPayload } = await load('lib/resellers.js');
  const draft = { ...resellerDraft('requirements', requirements), selfServiceEnabled: false, prefundingAmount: '0.00', prefundingCurrency: ' cdf ', enabled: true, percentage: 90 };
  assert.deepEqual(resellerRequirementsPayload(draft, requirements), { selfServiceEnabled: false, prefundingAmount: 0, prefundingCurrency: 'CDF', version: 4 });
  assert.equal(resellerDraft('requirements', { ...requirements, prefundingAmount: 0 }).prefundingAmount, '0');
  for (const patch of [{ selfServiceEnabled: null }, { selfServiceEnabled: 'false' }, { prefundingAmount: '-1' }, { prefundingAmount: '0.001' }, { prefundingAmount: '' }, { prefundingAmount: '1e2' }, { prefundingCurrency: '' }, { prefundingCurrency: '123' }]) assert.throws(() => resellerRequirementsPayload({ ...draft, ...patch }, requirements));
  assert.throws(() => resellerRequirementsPayload(draft, { version: null }));
});

test('missing or invalid requirements do not default to self-service enabled or invent funding settings', async () => {
  const { resellerRecord } = await load('lib/resellers.js');
  assert.equal(resellerRecord('requirements', { ...requirements, prefundingAmount: 0 }).selfServiceEnabled, false);
  for (const patch of [{ selfServiceEnabled: undefined }, { prefundingAmount: undefined }, { prefundingAmount: -1 }, { prefundingAmount: 1.001 }, { prefundingCurrency: null }, { version: '4' }]) assert.throws(() => resellerRecord('requirements', { ...requirements, ...patch }));
});

test('shared-version reviews reject torn reads and show the other setting without silently rebasing', async () => {
  const { resellerSetupReview, resellerRequirementsPayload, resellerProgramPayload, resellerDraft } = await load('lib/resellers.js');
  assert.throws(() => resellerSetupReview('requirements', { enabled: true, version: 5 }, requirements), /changed during refresh/);
  const req = resellerSetupReview('requirements', { enabled: true, version: 4 }, requirements);
  assert.equal(req.programEnabled, true);
  const program = resellerSetupReview('program', { enabled: false, version: 4 }, requirements);
  assert.equal(program.prefundingCurrency, 'USD'); assert.equal(program.selfServiceEnabled, false);
  assert.deepEqual(Object.keys(resellerProgramPayload(resellerDraft('program', program), program)).sort(), ['enabled', 'version']);
  assert.deepEqual(Object.keys(resellerRequirementsPayload(resellerDraft('requirements', req), req)).sort(), ['prefundingAmount', 'prefundingCurrency', 'selfServiceEnabled', 'version']);
});

test('currency choices exclude inactive, non-wallet and malformed products without hardcoding currencies', async () => {
  const { resellerWalletCurrencies } = await load('lib/resellers.js');
  const choices = resellerWalletCurrencies([
    { currency: 'usd', active: true, walletEnabled: true }, { currency: 'CDF', active: true, walletEnabled: true }, { currency: 'USD', active: true, walletEnabled: true },
    { currency: 'EUR', active: false, walletEnabled: true }, { currency: 'KES', active: true, walletEnabled: false }, { currency: null, active: true, walletEnabled: true }, { currency: 'BAD1', active: true, walletEnabled: true }
  ]);
  assert.deepEqual(choices.map((row) => row.currency), ['USD', 'CDF']);
  assert.throws(() => resellerWalletCurrencies({ content: [] }));
});

test('requirements endpoints use admin authentication, complete numeric payloads and no customer activation call', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'reseller-requirements'); api.setAuthToken('self-service-admin');
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(requirements); };
  await api.resellers.requirements();
  const payload = { ...requirements, selfServiceEnabled: true, prefundingAmount: 0 };
  await api.resellers.updateRequirements(payload);
  for (const call of calls) { assert.match(call.url, /\/admin-api\/resellers\/requirements$/); assert.equal(call.init.headers.Authorization, 'Bearer self-service-admin'); assert.equal(call.init.cache, 'no-store'); }
  assert.equal(calls[1].init.method, 'PUT'); assert.deepEqual(JSON.parse(calls[1].init.body), payload);
  global.fetch = async () => Response.json({ message: 'Super Admin required' }, { status: 403 });
  await assert.rejects(api.resellers.updateRequirements(payload), (err) => err.status === 403);
  assert.ok(!Object.hasOwn(api.resellers, 'enroll')); assert.ok(!Object.hasOwn(api.resellers, 'onboarding'));
});

test('currency options load all pages using the active and wallet-enabled filters', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'reseller-currencies'); api.setAuthToken('currency-admin');
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); const page = Number(new URL(url, 'https://local.test').searchParams.get('page')); return Response.json({ content: [{ id: page + 1, currency: page ? 'CDF' : 'USD', active: true, walletEnabled: true }], totalPages: 2, size: 200, last: page === 1 }); };
  const rows = await api.currencyProducts.walletOptions();
  assert.deepEqual(rows.map((row) => row.currency), ['USD', 'CDF']); assert.equal(calls.length, 2);
  for (const call of calls) { const params = new URL(call.url, 'https://local.test').searchParams; assert.equal(params.get('active'), 'true'); assert.equal(params.get('walletEnabled'), 'true'); assert.equal(call.init.headers.Authorization, 'Bearer currency-admin'); }
});

test('requirements failures keep drafts and closing self-service remains usable while earning is paused', async () => {
  let fail = true, submitted, accepted;
  const base = { ...requirements, selfServiceEnabled: true, programEnabled: false };
  const view = await editor({ kind: 'requirements', record: base, onSaved: (value) => { accepted = value; }, onSave: async (payload) => { submitted = payload; if (fail) throw Object.assign(new Error('Currency unavailable'), { status: 400 }); return { ...payload, version: 5 }; } });
  view.change('Customer self-enrollment', 'false'); view.change('Prefunding minimum', '0');
  assert.equal(view.button('Save').disabled, false);
  await view.click('Save'); assert.equal(accepted, undefined); assert.equal(view.field('Prefunding minimum').props.value, '0');
  assert.ok(view.text().includes('Currency unavailable')); fail = false; await view.click('Save');
  assert.deepEqual(submitted, { selfServiceEnabled: false, prefundingAmount: 0, prefundingCurrency: 'USD', version: 4 }); assert.equal(accepted.selfServiceEnabled, false);
});

test('self-service enabling requires review and shared-version conflicts preserve the funding draft', async () => {
  let conflict = true, submitted, calls = 0;
  const { resellerSetupReview } = await load('lib/resellers.js');
  const view = await editor({ kind: 'requirements', record: requirements, onReload: async () => resellerSetupReview('requirements', { enabled: true, version: 5 }, { ...requirements, version: 5, prefundingAmount: 50 }), onSave: async (payload) => { submitted = payload; calls++; if (conflict) throw Object.assign(new Error('Program version changed'), { status: 409 }); return { ...payload, version: 6 }; } });
  view.change('Customer self-enrollment', 'true'); view.change('Prefunding minimum', '200.25');
  assert.equal(view.button('Save').disabled, true); view.check(true); await view.click('Save'); assert.equal(calls, 1);
  await view.click('Refresh latest saved settings'); assert.equal(view.button('Save').disabled, true); assert.equal(view.field('Prefunding minimum').props.value, '200.25');
  const latestFacts = view.nodes().find((node) => node.type === 'facts');
  assert.ok(latestFacts.props.rows.some(([label, value]) => label === 'New purchase earning' && value === 'Enabled'));
  await view.click('I reviewed version 5 — apply my draft'); assert.equal(view.button('Save').disabled, true); view.check(true);
  conflict = false; await view.click('Save'); assert.equal(submitted.version, 5); assert.equal(submitted.prefundingAmount, 200.25); assert.equal(Object.hasOwn(submitted, 'enabled'), false);
});

test('Admin requirements views are read-only and a denied Super Admin save locks further editing', async () => {
  const read = await editor({ kind: 'requirements', record: requirements, canWrite: false });
  assert.ok(read.nodes().find((node) => node.type === 'fieldset').props.disabled); assert.ok(!read.nodes().some((node) => node.type === 'button' && node.props.children === 'Save'));
  const denied = await editor({ kind: 'requirements', record: requirements, onSave: async () => { throw Object.assign(new Error('Permission denied'), { status: 403 }); } });
  denied.change('Prefunding minimum', '101'); await denied.click('Save'); assert.ok(denied.nodes().find((node) => node.type === 'fieldset').props.disabled);
});

async function setupPanel({ canWrite = true, program = { enabled: false, version: 4 }, req = requirements, programReady = true, requirementsReady = true, programLoading = false, requirementsLoading = false } = {}) {
  const { mountComponent } = require('./helpers/component-harness.cjs');
  const helpers = await load('lib/resellers.js');
  const events = [];
  const resources = [
    { data: program, ready: programReady, loading: programLoading, accept(value) { this.data = value; events.push('accept program'); }, reload() { events.push('reload program'); } },
    { data: req, ready: requirementsReady, loading: requirementsLoading, accept(value) { this.data = value; events.push('accept requirements'); }, reload() { events.push('reload requirements'); } }
  ];
  // accept/reload are passed as functions by this component, so avoid relying on binding.
  resources.forEach((resource) => { resource.accept = resource.accept.bind(resource); });
  let reads = 0;
  const view = await mountComponent(path.join(__dirname, '../components/resellers/SetupPanel.js'), {
    props: { canWrite }, modules: {
      '@/lib/api': { api: { resellers: { program: async () => resources[0].data, requirements: async () => resources[1].data } } }, '@/lib/resellers': helpers,
      './Editor': { __esModule: true, default: 'editor' }, './resellers.module.css': { __esModule: true, default: {} }, './Common': { Card: 'section', Badge: 'badge', Alert: 'alert', Facts: 'facts', ResourceStatus: 'status', actionStyle: {}, useResellerResource: () => resources[reads++ % 2] }
    }
  });
  return { view, resources, events, editor: () => view.nodes().find((node) => node.type === 'editor')?.props };
}

test('saving either global setting refreshes the other without rebasing its displayed version', async () => {
  const panel = await setupPanel();
  await panel.view.click('Edit enrollment settings');
  assert.equal(panel.editor().kind, 'requirements'); assert.equal(panel.editor().record.programEnabled, false);
  panel.editor().onSaved({ ...requirements, selfServiceEnabled: true, version: 5 });
  panel.editor().onClose(); await panel.view.flush();
  assert.deepEqual(panel.events, ['accept requirements', 'reload program']); assert.equal(panel.resources[0].data.version, 4);
  assert.equal(panel.view.button('Manage earning').disabled, true); // Different shared versions require a refresh.
  panel.resources[0].data = { enabled: false, version: 5 }; await panel.view.flush();
  await panel.view.click('Manage earning');
  assert.equal(panel.editor().record.selfServiceEnabled, true);
  panel.editor().onSaved({ enabled: true, version: 6 });
  assert.deepEqual(panel.events.slice(-2), ['accept program', 'reload requirements']); assert.equal(panel.resources[1].data.version, 5);
});

test('setup controls stay independent of enabled flags and do not expose editing to Admin readers', async () => {
  const panel = await setupPanel({ program: { enabled: true, version: 4 }, req: { ...requirements, selfServiceEnabled: true } });
  assert.equal(panel.view.button('Manage earning').disabled, false); assert.equal(panel.view.button('Edit enrollment settings').disabled, false);
  const loading = await setupPanel({ program: { enabled: true, version: 4 }, requirementsReady: false, requirementsLoading: true });
  assert.equal(loading.view.button('Manage earning').disabled, false);
  const reader = await setupPanel({ canWrite: false });
  assert.ok(!reader.view.nodes().some((node) => node.type === 'button' && node.props.children === 'Manage earning'));
  assert.ok(!reader.view.nodes().some((node) => node.type === 'button' && node.props.children === 'Edit enrollment settings'));
});

async function resellerWorkspace(role = 'SUPER_ADMIN', initialAccount = null) {
  const { mountComponent } = require('./helpers/component-harness.cjs');
  const helpers = await load('lib/resellers.js');
  const view = await mountComponent(path.join(__dirname, '../app/(dashboard)/dashboard/resellers/page.js'), {
    props: {}, modules: {
      'next/navigation': { useSearchParams: () => new URLSearchParams(initialAccount == null ? '' : `accountId=${initialAccount}`) },
      '@/contexts/AuthContext': { useAuth: () => ({ session: session(role) }) }, '@/lib/resellers': helpers,
      '@/lib/api': { api: {} }, '@/components/DataTable': { DataTable: 'table' },
      '@/components/resellers/Common': { Card: 'section', Alert: 'alert', actionStyle: {} },
      '@/components/resellers/SetupPanel': { __esModule: true, default: 'setup' },
      '@/components/resellers/ConfigurationPanel': { __esModule: true, default: 'configuration' },
      '@/components/resellers/AccountWorkspace': { AccountWorkspace: 'account' },
      '@/components/resellers/TransactionInspector': { RecoveryPanel: 'recovery' },
      '@/components/resellers/Navigation': { __esModule: true, default: 'navigation' },
      '@/components/resellers/resellers.module.css': { __esModule: true, default: {} }
    }
  });
  return { view, async select(label, value) { view.nodes().find((node) => node.type === 'navigation' && node.props.label === label).props.onChange(value); await view.flush(); } };
}

test('main reseller tasks isolate global settings from a selected account and retain the account when returning', async () => {
  const { view, select } = await resellerWorkspace();
  const defaults = view.nodes().find((node) => node.type === 'configuration').props;
  assert.equal(defaults.kind, 'rule'); assert.equal(defaults.accountId, undefined); assert.equal(defaults.canWrite, true);
  assert.ok(!view.nodes().some((node) => ['account', 'setup', 'recovery'].includes(node.type)));
  await select('Reseller administration', 'accounts');
  view.nodes().find((node) => node.type?.name === 'AccountLookup').props.onSelect(42); await view.flush();
  assert.equal(view.nodes().find((node) => node.type === 'account').props.accountId, 42);
  assert.equal(view.nodes().find((node) => node.type === 'account').props.manageConfiguration, true);
  await select('Reseller administration', 'settings');
  assert.ok(view.nodes().some((node) => node.type === 'setup'));
  assert.ok(!view.nodes().some((node) => node.type === 'account'));
  await select('Reseller administration', 'rules');
  const global = view.nodes().find((node) => node.type === 'configuration').props;
  assert.equal(global.kind, 'rule'); assert.equal(global.accountId, undefined);
  await select('Reseller administration', 'settings');
  await select('Program settings', 'policies');
  assert.equal(view.nodes().find((node) => node.type === 'configuration').props.kind, 'policy');
  await select('Reseller administration', 'recovery');
  assert.ok(view.nodes().some((node) => node.type === 'recovery'));
  assert.ok(!view.nodes().some((node) => ['configuration', 'setup', 'account'].includes(node.type)));
  await select('Reseller administration', 'accounts');
  assert.equal(view.nodes().find((node) => node.type === 'account').props.accountId, 42);
  await view.click('← All resellers');
  assert.ok(view.nodes().some((node) => node.type?.name === 'EnrollmentDirectory'));
  assert.ok(!view.nodes().some((node) => node.type === 'account'));
});

test('account deep links open the scoped workspace and unauthorized roles never mount reseller tools', async () => {
  const reader = await resellerWorkspace('ADMIN');
  assert.equal(reader.view.nodes().find((node) => node.type === 'configuration').props.canWrite, false);
  const linked = await resellerWorkspace('ADMIN', 42);
  assert.equal(linked.view.nodes().find((node) => node.type === 'account').props.accountId, 42);
  assert.equal(linked.view.nodes().find((node) => node.type === 'account').props.canWrite, false);
  await linked.select('Reseller administration', 'settings');
  assert.equal(linked.view.nodes().find((node) => node.type === 'setup').props.canWrite, false);
  for (const role of ['ASSISTANT', 'STAFF']) {
    const { view } = await resellerWorkspace(role);
    assert.match(view.text(), /Permission denied/);
    assert.ok(!view.nodes().some((node) => ['navigation', 'setup', 'configuration', 'account', 'recovery'].includes(node.type)));
  }
});

async function commissionPanel({ accountId = null, canWrite = true, rows = [rule] } = {}) {
  const { mountComponent, compileComponent } = require('./helpers/component-harness.cjs');
  const helpers = await load('lib/resellers.js');
  const compiledCommon = await compileComponent(path.join(__dirname, '../components/resellers/Common.js'));
  const state = { rows }, reads = [], writes = [], refreshSession = async () => {};
  const api = { resellers: { rules: {
    list: async (scope) => { reads.push(scope); return state.rows; },
    create: async (payload) => { writes.push(payload); return { ...payload, id: 90, version: 0 }; },
    update: async (id, payload) => { writes.push({ id, ...payload }); return { id, ...payload, version: payload.version + 1 }; }
  } } };
  const view = await mountComponent(path.join(__dirname, '../components/resellers/ConfigurationPanel.js'), {
    props: { kind: 'rule', accountId, canWrite }, modules: (hooks) => ({
      '@/lib/api': { api }, '@/lib/resellers': helpers, '@/components/DataTable': { DataTable: 'table' },
      '@/components/ContentModal': { ContentModal: 'dialog' }, './Editor': { __esModule: true, default: 'editor' },
      './EffectivePolicy': { __esModule: true, default: 'effective' }, './resellers.module.css': { __esModule: true, default: {} },
      './Common': {
        ...compiledCommon(hooks, { '@/contexts/AuthContext': { useAuth: () => ({ refreshSession }) }, '@/lib/api': { api }, '@/lib/resellers': helpers, '@/components/CountrySelect': { CountrySelect: 'country-picker' }, '@/components/CatalogSelect': { CatalogSelect: 'picker' }, '@/lib/regulator-presentation': {} }),
        Card: 'section', Field: 'field', Badge: 'badge', Alert: 'alert', ResourceStatus: 'status'
      }
    })
  });
  await view.flush();
  return { view, reads, writes, state, helpers };
}

test('global commission management works without selecting an account and never enrolls or copies rules', async () => {
  const { view, reads, writes, helpers, state } = await commissionPanel();
  assert.deepEqual(reads, [null]); assert.equal(writes.length, 0);
  assert.match(view.text(), /no product assignment is needed/);
  await view.click('New rule');
  const editor = view.nodes().find((node) => node.type === 'editor').props;
  assert.equal(editor.accountId, null); assert.deepEqual(editor.record, {});
  const payload = helpers.resellerRulePayload({ ...helpers.resellerDraft('rule'), billProductId: 12, enabled: true, percentage: '3' });
  const saved = await editor.onSave(payload, {});
  assert.deepEqual(writes, [payload]); assert.equal(writes[0].accountId, null);
  state.rows = [saved];
  editor.onSaved(saved); await view.flush();
  assert.deepEqual(reads, [null, null]); assert.equal(writes.length, 1);
  assert.deepEqual(view.nodes().find((node) => node.type === 'table').props.rows, [saved]);
});

test('commission lists combine product filters and prevent editing records from a different account scope', async () => {
  const rows = [{ ...rule, billProductCode: 'SOCODEE' }, { ...rule, id: 13, billProductId: null, enabled: false, percentage: 0 }];
  const { view, writes } = await commissionPanel({ rows });
  const table = () => view.nodes().find((node) => node.type === 'table').props;
  view.change('Find a product', 'SOCODEE'); view.change('Rule status', 'enabled');
  assert.deepEqual(table().rows, [rows[0]]);
  view.change('Rule status', 'disabled'); assert.deepEqual(table().rows, []);
  await view.click('Clear rate filters'); assert.deepEqual(table().rows, rows); assert.equal(writes.length, 0);
  await view.click('New rule');
  const editor = view.nodes().find((node) => node.type === 'editor').props;
  await assert.rejects(editor.onSave({ ...rule, accountId: 42 }, {}), /scope changed/);
  assert.equal(writes.length, 0);
  const wrongScope = await commissionPanel({ rows: [{ ...rule, accountId: 42 }] });
  assert.equal(wrongScope.view.button('New rule').disabled, true);
  assert.match(wrongScope.view.nodes().find((node) => node.type === 'status').props.resource.error, /does not match/);
  const reader = await commissionPanel({ canWrite: false });
  assert.ok(!reader.view.nodes().some((node) => node.type === 'button' && node.props.children === 'New rule'));
  assert.deepEqual(reader.reads, [null]); assert.equal(reader.writes.length, 0);
});

test('commission and behavior views inside an account keep its scope and read-only permissions', async () => {
  const { mountComponent } = require('./helpers/component-harness.cjs');
  const helpers = await load('lib/resellers.js');
  const view = await mountComponent(path.join(__dirname, '../components/resellers/AccountWorkspace.js'), {
    exportName: 'AccountWorkspace', props: { accountId: 42, canWrite: false, manageConfiguration: true }, modules: {
      '@/contexts/AuthContext': { useAuth: () => ({}) }, '@/components/RegulatorPresentation': { PresentationLink: 'a' }, '@/lib/api': { api: {} }, '@/lib/resellers': helpers,
      '@/components/DataTable': { DataTable: 'table' }, '@/components/ContentModal': { ContentModal: 'dialog' }, '@/components/TableCell': { TableCellLines: 'paired' },
      './Editor': { __esModule: true, default: 'editor' }, './TransactionInspector': { TransactionInspector: 'inspector' }, './ProductRateEditor': { __esModule: true, default: 'rate-editor' },
      './ConfigurationPanel': { __esModule: true, default: 'configuration' }, './Navigation': { __esModule: true, default: 'navigation' }, './resellers.module.css': { __esModule: true, default: {} },
      './Common': { Card: 'section', Facts: 'facts', Badge: 'badge', BehaviorFacts: 'behavior', ProductMarketPicker: 'market', Field: 'field', ResourceStatus: 'status', actionStyle: {}, useResellerResource: () => ({ data: { accountId: 42, reseller: false, upstreamEarningsBlocked: true, version: 0, countryCode: '', summary: { pointsByCurrency: [], billProducts: [], earningEnabled: false } }, ready: true }) }
    }
  });
  for (const [tab, kind] of [['rules', 'rule'], ['policies', 'policy']]) {
    view.nodes().find((node) => node.type === 'navigation').props.onChange(tab); await view.flush();
    const panel = view.nodes().find((node) => node.type === 'configuration').props;
    assert.equal(panel.accountId, 42); assert.equal(panel.kind, kind); assert.equal(panel.canWrite, false);
    assert.ok(!view.nodes().some((node) => node.type === 'table'));
  }
  view.nodes().find((node) => node.type === 'navigation').props.onChange('summary'); await view.flush();
  assert.ok(!view.nodes().some((node) => node.type === 'configuration'));
  assert.ok(view.nodes().some((node) => node.type === 'table'));
});

test('admin summary market queries normalize alpha-2 codes and omit blank overrides without changing other routes', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'reseller-markets'); api.setAuthToken('admin-market-token');
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({}); };
  await api.resellers.summary(42);
  await api.resellers.summary(42, { countryCode: '  ' });
  await api.resellers.summary(42, { countryCode: ' rw ', accountId: 99 });
  await api.resellers.summary(42, { countryCode: 'cd' });
  await api.resellers.summary(42, { countryCode: 'DRC' });
  assert.match(calls[0].url, /\/admin-api\/resellers\/accounts\/42\/summary$/);
  assert.equal(calls[1].url, calls[0].url);
  assert.equal(new URL(calls[2].url, 'https://admin.local').search, '?countryCode=RW');
  assert.equal(new URL(calls[3].url, 'https://admin.local').searchParams.get('countryCode'), 'CD');
  assert.equal(new URL(calls[4].url, 'https://admin.local').searchParams.get('countryCode'), 'DRC'); // Never reinterpret aliases as CD.
  for (const { url, init } of calls) {
    assert.match(url, /\/resellers\/accounts\/42\/summary/);
    assert.equal(init.headers.Authorization, 'Bearer admin-market-token'); assert.equal(init.cache, 'no-store');
    assert.equal(init.body, undefined); assert.ok(!init.method || init.method === 'GET');
  }
});

test('country options load every catalog page and only alpha-2 catalog countries become product markets', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'reseller-country-catalog'); api.setAuthToken('country-admin');
  const pages = [];
  global.fetch = async (url) => {
    const query = new URL(url, 'https://admin.local').searchParams;
    const page = Number(query.get('page')); pages.push(page);
    assert.equal(query.get('size'), '200');
    return Response.json({ content: page ? [{ id: 2, name: 'Rwanda', alpha2Code: 'RW' }] : [{ id: 1, name: 'DR Congo', alpha2Code: ' cd ' }], totalPages: 2, last: page === 1 });
  };
  const rows = await api.countries.options();
  assert.deepEqual(pages, [0, 1]);
  const { resellerMarkets } = await load('lib/resellers.js');
  assert.deepEqual(resellerMarkets([...rows, { name: 'Invalid alias', alpha2Code: 'COD' }, { name: 'Invalid alias', alpha2Code: 'DRC' }, { name: 'No code' }]), [
    { name: 'DR Congo', code: 'CD' }, { name: 'Rwanda', code: 'RW' }
  ]);
});

test('market changes preserve backend product order and all currency balances, ignore stale responses and keep manual enrollment usable', async () => {
  const { mountComponent, compileComponent } = require('./helpers/component-harness.cjs');
  const helpers = await load('lib/resellers.js');
  const compiledCommon = await compileComponent(path.join(__dirname, '../components/resellers/Common.js'));
  const enrollment = { accountId: 42, reseller: false, upstreamEarningsBlocked: false, enabledSince: null, notes: null, version: 0 };
  const balances = [{ currency: 'USD', available: 6 }, { currency: 'CDF', available: 100 }];
  const defaultProducts = [{ billProductId: 77 }, { billProductId: 2 }, { billProductId: 9 }], cdProducts = [{ billProductId: 9 }, { billProductId: 2 }];
  const summary = (billProducts) => ({ accountId: 42, reseller: false, earningEnabled: false, pointsByCurrency: balances, billProducts });
  const requests = [], updates = [], refreshSession = async () => {};
  const api = { resellers: {
    enrollment: async (id) => { assert.equal(id, 42); return enrollment; },
    summary: (id, query) => new Promise((resolve, reject) => requests.push({ id, query, resolve, reject })),
    updateEnrollment: async (...args) => { updates.push(args); return enrollment; }
  } };
  const view = await mountComponent(path.join(__dirname, '../components/resellers/AccountWorkspace.js'), {
    exportName: 'AccountWorkspace', props: { accountId: 42, canWrite: true, manageConfiguration: true }, modules: (hooks) => ({
      '@/contexts/AuthContext': { useAuth: () => ({ refreshSession }) }, '@/components/RegulatorPresentation': { PresentationLink: 'a' }, '@/lib/api': { api }, '@/lib/resellers': helpers,
      '@/components/DataTable': { DataTable: 'table' }, '@/components/ContentModal': { ContentModal: 'dialog' }, '@/components/TableCell': { TableCellLines: 'paired' },
      './Editor': { __esModule: true, default: 'editor' }, './TransactionInspector': { TransactionInspector: 'inspector' }, './ProductRateEditor': { __esModule: true, default: 'rate-editor' },
      './ConfigurationPanel': { __esModule: true, default: 'configuration' }, './Navigation': { __esModule: true, default: 'navigation' }, './resellers.module.css': { __esModule: true, default: {} },
      './Common': {
        ...compiledCommon(hooks, { '@/contexts/AuthContext': { useAuth: () => ({ refreshSession }) }, '@/lib/api': { api }, '@/lib/resellers': helpers, '@/components/CountrySelect': { CountrySelect: 'country-picker' }, '@/components/CatalogSelect': { CatalogSelect: 'picker' }, '@/lib/regulator-presentation': {} }),
        Card: 'section', Facts: 'facts', Badge: 'badge', BehaviorFacts: 'behavior', ProductMarketPicker: 'market', Field: 'field', ResourceStatus: 'status'
      }
    })
  });
  await view.flush();
  const products = () => view.nodes().find((node) => node.type === 'table' && node.props.columns.some((column) => column.key === 'billProductCode'));
  const market = () => view.nodes().find((node) => node.type === 'market').props;
  const choose = async (code) => { market().onChange(code); await view.flush(); };
  assert.deepEqual(requests[0].query, { countryCode: '' }); assert.equal(requests[0].id, 42);
  assert.equal(view.button('Manage enrollment').disabled, false); // Summary need not load before manual enrollment.
  requests[0].resolve(summary(defaultProducts)); await view.flush();
  assert.equal(products().props.rows, defaultProducts);
  view.change('Find a product', '9'); await view.flush();
  assert.deepEqual(products().props.rows, [defaultProducts[2]]);
  assert.match(view.text(), /1 of 3 products/);
  await view.click('Clear product filters'); assert.equal(products().props.rows, defaultProducts);
  const actions = products().props.columns.find((column) => column.key === 'actions').render(defaultProducts[0]);
  require('react').Children.toArray(actions.props.children).find((node) => node.props.children === 'Set account override').props.onClick(); await view.flush();
  const rateEditor = view.nodes().find((node) => node.type === 'rate-editor').props;
  assert.equal(rateEditor.accountId, 42); assert.equal(rateEditor.product, defaultProducts[0]);
  rateEditor.onClose(); await view.flush();
  await choose('RW'); assert.equal(products(), undefined); // Never label the previous market's products as RW.
  await choose('CD');
  requests[2].resolve(summary(cdProducts)); await view.flush();
  requests[1].resolve(summary([{ billProductId: 500 }])); await view.flush();
  assert.equal(market().value, 'CD'); assert.equal(products().props.rows, cdProducts);
  assert.equal(view.nodes().find((node) => node.type === 'table' && node.props.rows === balances).props.rows, balances);
  view.nodes().find((node) => node.type === 'navigation').props.onChange('entries'); await view.flush();
  view.nodes().find((node) => node.type === 'navigation').props.onChange('summary'); await view.flush();
  assert.equal(market().value, 'CD'); assert.equal(requests.length, 3);
  await view.click('Refresh');
  assert.deepEqual(requests[3].query, { countryCode: 'CD' });
  requests[3].resolve(summary(cdProducts)); await view.flush();
  await choose('RW');
  requests[4].reject(Object.assign(new Error('Unsupported country'), { status: 400 })); await view.flush();
  assert.equal(market().value, 'RW'); assert.equal(products(), undefined);
  assert.ok(view.nodes().some((node) => node.type === 'status' && node.props.resource.error.includes('Unsupported country')));
  assert.equal(view.button('Manage enrollment').disabled, false);
  await view.click('Manage enrollment');
  const payload = { enabled: true, notes: null, version: 0 };
  await view.nodes().find((node) => node.type === 'editor').props.onSave(payload);
  assert.deepEqual(updates, [[42, payload]]); // Market is not an enrollment selector.
  await choose('');
  assert.deepEqual(requests[5].query, { countryCode: '' });
  requests[5].resolve(summary(defaultProducts)); await view.flush();
  assert.equal(products().props.rows, defaultProducts);
  view.unmount();
});

test('local product filters combine search, eligibility and source without changing backend order or rates', async () => {
  const { filterResellerProducts } = await load('lib/resellers.js');
  const rows = [{ billProductId: 77, billProductCode: 'SNEL', billProductName: 'Électricité SNEL', eligible: true, source: 'GLOBAL_PRODUCT', percentage: 3 }, { billProductId: 2, billProductCode: 'VIRUNGA', eligible: false, source: 'ACCOUNT_PRODUCT', percentage: 0 }, { billProductId: 9, billProductCode: 'CANAL_PLUS_DRC', eligible: true, source: 'GLOBAL_PRODUCT', percentage: 2 }];
  assert.deepEqual(filterResellerProducts(rows, { search: 'electricite snel' }), [rows[0]]);
  assert.deepEqual(filterResellerProducts(rows, { search: 'canal plus' }), [rows[2]]);
  assert.deepEqual(filterResellerProducts(rows, { search: '2', eligibility: 'ineligible', source: 'ACCOUNT_PRODUCT' }), [rows[1]]);
  assert.deepEqual(filterResellerProducts(rows, { eligibility: 'eligible', source: 'GLOBAL_PRODUCT' }), [rows[0], rows[2]]);
  assert.deepEqual(filterResellerProducts(rows, { eligibility: 'eligible', source: 'ACCOUNT_PRODUCT' }), []);
  assert.deepEqual(rows.map((row) => row.billProductId), [77, 2, 9]); assert.equal(rows[1].percentage, 0);
});

async function productRateEditor(records, product = { billProductId: 12, billProductCode: 'SNEL', basis: 'NET_AMOUNT', percentage: 3, maxPoints: null }) {
  const { mountComponent } = require('./helpers/component-harness.cjs');
  const helpers = await load('lib/resellers.js');
  let loaded, current, rows = records;
  const calls = [];
  const api = { resellers: { rules: {
    list: async (id) => { assert.equal(id, 42); return rows; },
    create: async (body) => { calls.push(['create', body]); return { ...body, id: 88, version: 0 }; },
    update: async (id, body) => { calls.push(['update', id, body]); return { ...body, id, version: body.version + 1 }; }
  } } };
  const view = await mountComponent(path.join(__dirname, '../components/resellers/ProductRateEditor.js'), {
    props: { accountId: 42, product, canWrite: true, onClose() {}, onSaved() {} }, modules: {
      '@/components/ContentModal': { ContentModal: 'dialog' }, '@/lib/api': { api }, '@/lib/resellers': helpers,
      './Editor': { __esModule: true, default: 'editor' }, './Common': { ResourceStatus: 'status', useResellerResource: (read) => { loaded = read; return { ready: Boolean(current), data: current }; } }
    }
  });
  current = await loaded(); await view.flush();
  return { view, calls, editor: () => view.nodes().find((node) => node.type === 'editor').props, setRules: (next) => { rows = next; } };
}

test('setting a product rate loads the account/product rule and its latest version instead of editing global defaults', async () => {
  const accountRule = { ...rule, id: 19, accountId: 42, version: 8 };
  const panel = await productRateEditor([rule, { ...rule, id: 15, accountId: 9 }, accountRule]);
  assert.equal(panel.editor().record, accountRule); assert.equal(panel.editor().accountId, 42);
  assert.deepEqual(panel.editor().fixedProduct, { id: 12, name: 'SNEL' });
  assert.equal(panel.calls.length, 0);
  const { resellerDraft, resellerRulePayload } = await load('lib/resellers.js');
  const payload = resellerRulePayload({ ...resellerDraft('rule', accountRule), percentage: '4' }, accountRule);
  await panel.editor().onSave(payload, accountRule);
  assert.deepEqual(panel.calls, [['update', 19, { ...payload, version: 8 }]]);
  await assert.rejects(panel.editor().onSave({ ...payload, accountId: null }, accountRule), /scope changed/);
  assert.equal(panel.calls.length, 1);
  const changed = { ...accountRule, version: 9, percentage: 5 };
  panel.setRules([rule, changed]);
  assert.equal(await panel.editor().onReload(), changed);
  assert.equal(panel.editor().record.version, 8); // Reloading is a review step, not an automatic overwrite.
});

test('a rate inherited from global or account defaults creates only a product-specific account override', async () => {
  const panel = await productRateEditor([rule, { ...rule, id: 22, accountId: 42, billProductId: null }]);
  const base = panel.editor().record;
  assert.equal(base.id, undefined); assert.equal(base.accountId, 42); assert.equal(base.billProductId, 12);
  assert.equal(base.percentage, 3);
  const { resellerRulePayload, resellerDraft } = await load('lib/resellers.js');
  const payload = resellerRulePayload({ ...resellerDraft('rule', base, 42), percentage: '0' }, base);
  await panel.editor().onSave(payload, base);
  assert.equal(panel.calls[0][0], 'create'); assert.equal(panel.calls[0][1].percentage, 0);
  assert.equal(panel.calls[0][1].accountId, 42); assert.equal(panel.calls[0][1].billProductId, 12);
  assert.equal(Object.hasOwn(panel.calls[0][1], 'version'), false);
});
