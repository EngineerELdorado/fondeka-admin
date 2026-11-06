const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const read = (file) => readFileSync(path.join(__dirname, '..', file), 'utf8');
const url = (value) => 'data:text/javascript;base64,' + Buffer.from(value).toString('base64');
const helpers = import(url(read('lib/provider-investigations.js').replace("'./payout-refund-audit'", JSON.stringify(url(read('lib/payout-refund-audit.js'))))));

test('normal provider reports default to a UTC date scope and all issue observations', async () => {
  const h = await helpers, form = h.initialProviderFilters(new URLSearchParams(), new Date('2026-11-06T16:00:00Z'));
  assert.equal(form.fromDate, '2026-10-07');assert.equal(form.toDate, '2026-11-06');assert.equal(form.issue, 'ANY_ISSUE');
  form.provider = 'ARAKAPAY';const query = h.providerQuery(form);assert.equal(query.get('from'), '2026-10-07T00:00:00Z');assert.equal(query.get('to'), '2026-11-07T00:00:00.000Z');
});
test('audit deep links keep the exact outcome, search, account and currency scope without a new date restriction', async () => {
  const h = await helpers, form = h.initialProviderFilters(new URLSearchParams({ provider: 'ARAKAPAY', auditRunId: '11111111-2222-4333-8444-555555555555', auditOutcome: 'CONFIRMED', auditQuery: 'somebody@example.test', accountId: '7', currency: 'USD', issue: 'ALL' }));
  const filter = h.providerFilter(form);assert.equal(filter.from, null);assert.equal(filter.to, null);assert.equal(filter.auditOutcome, 'CONFIRMED');assert.equal(filter.auditQuery, 'somebody@example.test');assert.equal(filter.accountId, 7);assert.equal(filter.issue, 'ALL');
});
test('document requests preserve selection, user case details and preview fingerprint', async () => {
  const h = await helpers, form = { provider: 'ARAKAPAY' };
  const result = h.providerDocumentRequest(form, [3, 4, 3], { title: ' Review ', caseReference: ' CASE-1 ', message: ' Please check ' }, 'abc');
  assert.deepEqual(result.transactionIds, [3, 4]);assert.equal(result.caseReference, 'CASE-1');assert.equal(result.title, 'Review');assert.equal(result.message, 'Please check');assert.equal(result.previewHash, 'abc');
  assert.throws(() => h.providerDocumentRequest(form, Array.from({ length: 101 }, (_, n) => n + 1), {}));assert.throws(() => h.providerFilter({ provider: '' }));
});
test('PDF and JSON downloads use authenticated no-store endpoints and preserve raw numeric bytes', { concurrency: false }, async () => {
  const calls = [], previous = global.fetch;
  global.fetch = async (target, init) => {
    calls.push({ target, init });
    if (target.endsWith('/pdf')) return new Response('%PDF-sample', { headers: { 'content-type': 'application/pdf' } });
    if (target.endsWith('/evidence')) return new Response('{"amount":1.234567891234567891}', { headers: { 'content-type': 'application/json' } });
    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  };
  try {
    const { api } = await import(url(read('lib/api.js')) + '#provider-docs');api.setAuthToken('report-test-token');
    await api.providerInvestigations.options('ARAKAPAY');await api.providerInvestigations.transactions(new URLSearchParams({ provider: 'ARAKAPAY' }));await api.providerInvestigations.preview({ filter: { provider: 'ARAKAPAY' } });
    const pdf = await api.providerInvestigations.pdf({ previewHash: 'hash' });assert.equal(await pdf.text(), '%PDF-sample');
    const evidence = await api.providerInvestigations.evidence({ previewHash: 'hash' });assert.equal(await evidence.text(), '{"amount":1.234567891234567891}');
    for (const call of calls) { assert.equal(call.init.headers.Authorization, 'Bearer report-test-token');assert.equal(call.init.cache, 'no-store');assert.match(call.target, /\/provider-investigations\//);assert.doesNotMatch(call.target, /momo-status|refund-to-wallet|resubmit|sendmobilemoney/); }
  } finally { global.fetch = previous; }
});
