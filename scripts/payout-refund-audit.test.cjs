const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const load = (file, suffix = '') => import('data:text/javascript;base64,' + Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64') + '#' + suffix);
const helpers = load('lib/payout-refund-audit.js');

test('audit roles exclude assistants and customers', async () => {
  const h = await helpers;
  for (const group of ['ADMIN', 'SUPER_ADMIN']) assert.equal(h.canReadRefundAudit({ tokens: { accessToken: { payload: { 'cognito:groups': [group] } } } }), true);
  for (const group of ['ASSISTANT', 'CUSTOMER', '']) assert.equal(h.canReadRefundAudit({ tokens: { idToken: { payload: { groups: group } } } }), false);
});
test('scope uses whole UTC days, nullable defaults and validated account IDs', async () => {
  const h = await helpers;
  assert.deepEqual(h.auditScope({}), { from: null, to: null, accountId: null, label: null });
  assert.deepEqual(h.auditScope({ from: '2026-10-01', to: '2026-10-31', accountId: '42', label: ' October ' }), { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00.000Z', accountId: 42, label: 'October' });
  for (const form of [{ from: '2026-02-30' }, { from: '2026-11-02', to: '2026-11-01' }, { accountId: '-1' }, { accountId: '9007199254740993' }]) assert.throws(() => h.auditScope(form));
});
test('currency amounts remain exact and are never added across currencies', async () => {
  const h = await helpers;
  assert.equal(h.auditMoney('9007199254740993.26', 'USD'), '9,007,199,254,740,993.26 USD');
  assert.equal(h.auditMoney('1.995', 'USD'), '2.00 USD');
  const credits = [{ amount: '869.26', currency: 'USD', refundStatus: 'COMPLETED' }, { amount: '0.01', currency: 'USD', refundStatus: 'COMPLETED' }, { amount: '1000', currency: 'CDF', refundStatus: 'COMPLETED' }, { amount: '99', currency: 'USD', refundStatus: 'PROCESSING' }];
  const totals = h.creditTotals(credits);assert.equal(h.auditMoney(totals.USD, 'USD'), '869.27 USD');assert.equal(h.auditMoney(totals.CDF, 'CDF'), '1,000.00 CDF');
});
test('CSV escapes formulas and preserves evidence identifiers', async () => {
  const h = await helpers;
  const csv = h.auditCsv([{ accountId: 7, accountName: '=HYPERLINK("bad")', email: ' +SUM(1)', reference: 'TX123', amount: '10.00', currency: 'USD', credits: [], outcome: 'CONFIRMED' }]);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);assert.match(csv, /"' \+SUM\(1\)"/);assert.match(csv, /"TX123"/);
});
test('API uses dedicated audit endpoints with auth and no-store for read and write operations', { concurrency: false }, async () => {
  const calls = [], previous = global.fetch;
  global.fetch = async (url, init) => { calls.push({ url, init });return new Response(JSON.stringify({ content: [] }), { headers: { 'content-type': 'application/json' } }); };
  try {
    const module = await load('lib/api.js', 'refund-audit');module.api.setAuthToken('audit-test-token');
    const api = module.api.payoutRefundAudits;
    await api.list({ size: 20 });await api.start({ accountId: 7 });await api.report('run-1');await api.accounts('run-1', new URLSearchParams({ outcome: 'CONFIRMED' }));
    await api.transactions('run-1');await api.transaction('run-1', 42);await api.export('run-1');await api.cancel('run-1');
    assert.equal(calls.length, 8);
    for (const call of calls) { assert.match(call.url, /\/payout-refund-audits/);assert.doesNotMatch(call.url, /momo-status|refund-to-wallet|reconciliation|payout\/submit/);assert.equal(call.init.headers.Authorization, 'Bearer audit-test-token');assert.equal(call.init.cache, 'no-store'); }
    assert.equal(calls[1].init.method, 'POST');assert.deepEqual(JSON.parse(calls[1].init.body), { accountId: 7 });assert.equal(calls[7].init.method, 'POST');
  } finally { global.fetch = previous; }
});
