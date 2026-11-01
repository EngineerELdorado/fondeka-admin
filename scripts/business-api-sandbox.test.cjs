const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const load = (file, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64')}#${tag}`);
const payment = () => ({ environment: 'SANDBOX', requestId: 100, businessId: 42, ownerAccountId: 7, apiKeyId: 8, walletTracked: false, transaction: { environment: 'SANDBOX', fondekaReference: 'opaque/%_+?ref', status: 'COMPLETED', action: 'BUSINESS_API_COLLECTION', amount: 10, fee: 0, grossAmount: 10, currency: 'USD' } });

test('sandbox read permissions include assistants, exclude Staff/customers and require an explicit admin group', async () => {
  const { canReadSandboxHistory } = await load('lib/business-api-sandbox.js');
  for (const role of ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT']) {
    assert.equal(canReadSandboxHistory({ tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } }), true);
    assert.equal(canReadSandboxHistory({ tokens: { idToken: { payload: { groups: `OTHER, ${role}` } } } }), true);
  }
  for (const role of ['STAFF', 'CUSTOMER', 'NOT_ADMIN', '']) assert.equal(canReadSandboxHistory({ tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } }), false);
  assert.equal(canReadSandboxHistory(null), false);
});

test('all sandbox filters combine exactly, preserve literal references and omit environment selectors', async () => {
  const { sandboxHistoryQuery } = await load('lib/business-api-sandbox.js');
  const query = sandboxHistoryQuery({ businessId: ' 42 ', accountId: '9223372036854775807', apiKeyId: '8', action: 'BUSINESS_API_PAYOUT', status: 'FAILED', scenario: 'INVALID_DESTINATION', currency: ' usd ', reference: ' opaque/%_+?ref ', orderReference: ' merchant%_order ', fromDate: 0, toDate: 253402300799999, environment: 'LIVE', enabled: true }, { page: 2, size: 100 });
  assert.deepEqual(Object.fromEntries(query), { page: '2', size: '100', businessId: '42', accountId: '9223372036854775807', apiKeyId: '8', action: 'BUSINESS_API_PAYOUT', status: 'FAILED', scenario: 'INVALID_DESTINATION', currency: 'USD', reference: 'opaque/%_+?ref', orderReference: 'merchant%_order', fromDate: '0', toDate: '253402300799999' });
  assert.match(query.toString(), /orderReference=merchant%25_order/);
  assert.equal(new URLSearchParams(query.toString()).get('reference'), 'opaque/%_+?ref');
});

test('invalid IDs, currency, enums, dates and excessive references fail before a read', async () => {
  const { sandboxHistoryQuery } = await load('lib/business-api-sandbox.js');
  for (const filter of [{ businessId: 0 }, { accountId: '-1' }, { apiKeyId: '1.5' }, { accountId: '9223372036854775808' }, { currency: 'USDT' }, { currency: '1$D' }, { action: 'WITHDRAW_FROM_WALLET' }, { status: 'CANCELED' }, { scenario: 'UNKNOWN' }, { reference: 'x'.repeat(129) }, { orderReference: 'x'.repeat(129) }, { fromDate: '-1' }, { toDate: '253402300800000' }, { fromDate: '12.5' }, { fromDate: '2', toDate: '1' }]) assert.throws(() => sandboxHistoryQuery(filter));
  for (const pagination of [{ page: -1 }, { page: 1.5 }, { size: 0 }, { size: 101 }, { size: 1.5 }, { page: 2147483648, size: 1 }, { page: 21474837, size: 100 }]) assert.throws(() => sandboxHistoryQuery({}, pagination));
  assert.equal(sandboxHistoryQuery({}, { page: 2147483647, size: 1 }).get('page'), '2147483647');
});

test('UTC date controls preserve epoch zero, milliseconds and inclusive year-9999 bounds', async () => {
  const { sandboxDateInput, sandboxDateValue } = await load('lib/business-api-sandbox.js');
  for (const epoch of [0, 1793527200123, 253402300799999]) assert.equal(sandboxDateValue(sandboxDateInput(epoch)), String(epoch));
  assert.equal(sandboxDateValue('2026-11-01T10:00'), '1793527200000');
  assert.equal(sandboxDateInput(''), ''); assert.equal(sandboxDateValue(''), '');
  for (const input of ['1969-12-31T23:59', '2026-02-30T12:00', '2026-11-01T24:00', 'invalid', '2026-11-01T12:00+02:00']) assert.throws(() => sandboxDateValue(input));
});

test('scoped history and detail links keep opaque references and never use financial transaction routes', async () => {
  const { sandboxHistoryHref, sandboxPaymentHref, sandboxFiltersFromSearch } = await load('lib/business-api-sandbox.js');
  assert.equal(sandboxHistoryHref({ businessId: 42, apiKeyId: 8 }), '/dashboard/business-api/sandbox-transactions?businessId=42&apiKeyId=8');
  const reference = 'SBX%2F?+_/#é';
  const href = sandboxPaymentHref(reference);
  assert.equal(decodeURIComponent(href.split('/').at(-1)), reference);
  assert.equal(href.includes('/dashboard/transactions/'), false);
  assert.equal(sandboxFiltersFromSearch('businessId=42&environment=LIVE').businessId, '42');
  assert.equal(Object.hasOwn(sandboxFiltersFromSearch('environment=LIVE'), 'environment'), false);
});

test('resource confirmation rejects LIVE, missing and wrong-reference responses and keeps API status/zero fees', async () => {
  const { sandboxPaymentResource, sandboxHistoryPage } = await load('lib/business-api-sandbox.js');
  const row = payment();
  assert.equal(sandboxPaymentResource(row, row.transaction.fondekaReference), row);
  assert.equal(sandboxPaymentResource(row).transaction.fee, 0);
  for (const value of [null, { ...row, environment: 'LIVE' }, { ...row, transaction: { ...row.transaction, environment: 'LIVE' } }, { ...row, transaction: { ...row.transaction, status: 'EXPIRED' } }]) assert.throws(() => sandboxPaymentResource(value));
  assert.throws(() => sandboxPaymentResource(row, 'another-reference'));
  const page = { content: [row], number: 0, size: 20, totalElements: 1, totalPages: 1 };
  assert.equal(sandboxHistoryPage(page, 0, 20), page);
  assert.throws(() => sandboxHistoryPage(page, 1, 20));
  assert.throws(() => sandboxHistoryPage({ ...page, content: [{ ...row, environment: 'LIVE' }] }, 0, 20));
});

test('sandbox API helpers expose GETs only, use the admin JWT/base, encode once and retain denied reads', async (t) => {
  const originalFetch = global.fetch, originalWindow = global.window, originalBase = process.env.NEXT_PUBLIC_ADMIN_API_BASE;
  t.after(() => { global.fetch = originalFetch; global.window = originalWindow; if (originalBase === undefined) delete process.env.NEXT_PUBLIC_ADMIN_API_BASE; else process.env.NEXT_PUBLIC_ADMIN_API_BASE = originalBase; });
  for (const base of ['https://api.example.test', 'https://api.example.test/admin-api/']) {
    process.env.NEXT_PUBLIC_ADMIN_API_BASE = base;
    const { api } = await load('lib/api.js', base);
    api.setAuthToken('sandbox-admin-token');
    const calls = [], events = [];
    global.window = { dispatchEvent: (event) => events.push(event) };
    global.fetch = async (url, init) => { calls.push({ url, ...init }); return Response.json(payment()); };
    assert.deepEqual(Object.keys(api.businessApiSandbox).sort(), ['get', 'list']);
    await api.businessApiSandbox.list(new URLSearchParams({ page: '0', size: '20', orderReference: '%_test' }));
    await api.businessApiSandbox.get('SBX%2F?+_/#é');
    assert.equal(calls[0].url, 'https://api.example.test/admin-api/business-api/sandbox/transactions?page=0&size=20&orderReference=%25_test');
    assert.equal(calls[1].url, 'https://api.example.test/admin-api/business-api/sandbox/transactions/SBX%252F%3F%2B_%2F%23%C3%A9');
    assert.ok(calls.every((call) => (call.method ?? 'GET') === 'GET' && call.body === undefined && call.headers.Authorization === 'Bearer sandbox-admin-token' && call.cache === 'no-store' && !call.headers['X-API-Key']));
    global.fetch = async () => Response.json({ message: 'Read denied' }, { status: 403 });
    await assert.rejects(api.businessApiSandbox.get('unknown'), (error) => error.status === 403 && error.message === 'Read denied');
    assert.deepEqual(events, []);
  }
});
