const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const importSource = (file, suffix = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64')}#${suffix}`);
const helpers = importSource('lib/contact-exports.js');
const catalog = { availableFields: [{ name: 'email', label: 'Email', type: 'text' }, { name: 'firstName', label: 'First name', type: 'text' }, { name: 'countryCode', label: 'Country', type: 'text' }], defaultFields: ['firstName', 'email'] };
const jobId = '16a98b94-c506-4fb5-a090-64a731859986';
const resource = { jobId, status: 'QUEUED', fields: ['email'], rowCount: 0, createdAt: '2026-11-02T16:00:00Z', updatedAt: '2026-11-02T16:00:00Z', expiresAt: '2026-11-03T16:00:00Z' };

test('contact export columns come from the backend and preserve the exact selected order', async () => {
  const { contactExportFields, contactExportPayload } = await helpers;
  const saved = contactExportFields(catalog);
  const fields = ['email', 'countryCode', 'firstName'];
  assert.deepEqual(contactExportPayload(fields, saved, {}), { fields, audience: {} });
  assert.notEqual(contactExportPayload(fields, saved, {}).fields, fields);
  for (const selection of [[], ['email', 'email'], ['password'], null]) assert.throws(() => contactExportPayload(selection, saved, {}), /supported column/);
  for (const invalid of [{}, { ...catalog, defaultFields: [] }, { ...catalog, defaultFields: ['password'] }, { ...catalog, availableFields: [...catalog.availableFields, catalog.availableFields[0]] }, { ...catalog, availableFields: [{ name: 'email', label: 'Email', type: 'secret' }] }]) assert.throws(() => contactExportFields(invalid), /unavailable/);
});

test('campaign audience semantics preserve false and zero across all selectors', async () => {
  const { contactExportAudience, emptyContactAudience } = await helpers;
  assert.deepEqual(contactExportAudience(emptyContactAudience()), {});
  assert.deepEqual(contactExportAudience({ hasCards: 'false', hasCompletedTransactions: false, minCompletedTransactions: '0', maxCompletedTransactions: 0, lastTransactionOlderThanDays: '0', minTransactionsThisMonth: 0, maxTransactionsThisMonth: 0, countryCodes: 'cd, RW', countryIds: '1, 2', deviceLanguages: 'fr, en', kycStatuses: ['NONE'], paymentMethodIds: ['8'], billProductIds: [], paymentProviderIds: '9', transactionStatuses: 'FAILED', transactionServices: 'COMMERCE', transactionActions: 'COMMERCE_CHECKOUT_PAYMENT' }), {
    hasCards: false, hasCompletedTransactions: false, minCompletedTransactions: 0, maxCompletedTransactions: 0, lastTransactionOlderThanDays: 0, minTransactionsThisMonth: 0, maxTransactionsThisMonth: 0, countryCodes: ['CD', 'RW'], countryIds: [1, 2], deviceLanguages: ['fr', 'en'], kycStatuses: ['NONE'], paymentMethodIds: [8], paymentProviderIds: [9], transactionStatuses: ['FAILED'], transactionServices: ['COMMERCE'], transactionActions: ['COMMERCE_CHECKOUT_PAYMENT']
  });
});

test('invalid and misspelled filters cannot broaden a contact export silently', async () => {
  const { contactExportAudience } = await helpers;
  for (const invalid of [{ countries: ['CD'] }, { hasCards: 'NO' }, { countryCodes: [''] }, { countryCodes: 'CD,,RW' }, { countryCodes: 'DRC' }, { deviceLanguages: [null] }, { countryIds: [false] }, { paymentMethodIds: [0] }, { billProductIds: [1.5] }, { paymentProviderIds: '1,' }, { minCompletedTransactions: -1 }, { maxCompletedTransactions: '1.2' }, { minCompletedTransactions: 2, maxCompletedTransactions: 1 }, { minTransactionsThisMonth: 2, maxTransactionsThisMonth: 0 }, { deviceLanguages: Array(1001).fill('fr') }]) assert.throws(() => contactExportAudience(invalid));
});

test('creation date bounds are real whole-day dates within years 1–9999', async () => {
  const { contactExportAudience } = await helpers;
  assert.deepEqual(contactExportAudience({ accountCreatedFrom: '0001-01-01', accountCreatedTo: '9999-12-31' }), { accountCreatedFrom: '0001-01-01', accountCreatedTo: '9999-12-31' });
  for (const invalid of [{ accountCreatedFrom: '0000-01-01' }, { accountCreatedFrom: '2026-02-30' }, { accountCreatedTo: '10000-01-01' }, { accountCreatedFrom: '2026-11-03', accountCreatedTo: '2026-11-02' }]) assert.throws(() => contactExportAudience(invalid));
});

test('only Admin and Super Admin roles can access contact exports', async () => {
  const { canExportContacts } = await helpers;
  for (const role of ['ADMIN', 'SUPER_ADMIN']) assert.equal(canExportContacts({ tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } }), true);
  for (const role of ['ASSISTANT', 'STAFF', 'CUSTOMER', '']) assert.equal(canExportContacts({ tokens: { idToken: { payload: { groups: role } } } }), false);
  assert.equal(canExportContacts(null), false);
});

test('saved jobs must match the requested ID and valid status before displaying progress', async () => {
  const { contactExportJob } = await helpers;
  for (const status of ['QUEUED', 'RUNNING', 'READY', 'FAILED', 'EXPIRED']) assert.equal(contactExportJob({ ...resource, status }, jobId).status, status);
  for (const invalid of [{ ...resource, jobId: 'other' }, { ...resource, status: 'COMPLETE' }, { ...resource, rowCount: -1 }, { ...resource, expiresAt: null }, { ...resource, fields: [] }]) assert.throws(() => contactExportJob(invalid));
  assert.throws(() => contactExportJob(resource, '26a98b94-c506-4fb5-a090-64a731859986'));
});

test('download actions require a ready job, an unexpired file and link, and an HTTPS destination', async () => {
  const { contactExportDownload } = await helpers;
  const now = Date.parse('2026-11-02T17:00:00Z');
  const ready = { ...resource, status: 'READY', downloadUrl: 'https://private-bucket.s3.amazonaws.com/admin-contact-exports/job.csv?signature=example', downloadUrlExpiresAt: '2026-11-02T17:05:00Z' };
  assert.equal(contactExportDownload(ready, now), ready.downloadUrl);
  for (const invalid of [{ ...ready, status: 'RUNNING' }, { ...ready, expiresAt: new Date(now).toISOString() }, { ...ready, downloadUrlExpiresAt: new Date(now).toISOString() }, { ...ready, downloadUrlExpiresAt: undefined }, { ...ready, downloadUrl: 'http://example.com/file' }, { ...ready, downloadUrl: 'javascript:alert(1)' }, { ...ready, downloadUrl: 'https://user:password@example.com/file' }]) assert.equal(contactExportDownload(invalid, now), null);
});

test('export APIs use the configured admin API, Bearer authentication and no-store; denied requests stay in place', async (t) => {
  const originalFetch = global.fetch, originalWindow = global.window;
  t.after(() => { global.fetch = originalFetch; if (originalWindow === undefined) delete global.window; else global.window = originalWindow; });
  const { api } = await importSource('lib/api.js', 'contact-exports');
  api.setAuthToken('contact-export-admin-test');
  const calls = [], events = [];
  global.window = { dispatchEvent: (event) => events.push(event.type) };
  global.fetch = async (url, init) => { calls.push({ url, ...init }); return Response.json(url.endsWith('/fields') ? catalog : resource, { status: init.method === 'POST' ? 202 : 200 }); };
  await api.accounts.contactExports.fields();
  await api.accounts.contactExports.create({ fields: ['email', 'countryCode'], audience: { hasCards: false, minCompletedTransactions: 0 } });
  await api.accounts.contactExports.get(jobId);
  assert.match(calls[0].url, /\/admin-api\/accounts\/exports\/contacts\/fields$/);
  assert.match(calls[1].url, /\/admin-api\/accounts\/exports\/contacts$/);
  assert.match(calls[2].url, new RegExp('/admin-api/accounts/exports/contacts/' + jobId + '$'));
  assert.deepEqual(JSON.parse(calls[1].body), { fields: ['email', 'countryCode'], audience: { hasCards: false, minCompletedTransactions: 0 } });
  for (const call of calls) { assert.equal(call.cache, 'no-store'); assert.equal(call.headers.Authorization, 'Bearer contact-export-admin-test'); }
  assert.equal(calls[0].body, undefined); assert.equal(calls[2].body, undefined);
  for (const status of [400, 401, 403, 404, 409, 503]) {
    global.fetch = async () => Response.json({ message: 'Safe backend message' }, { status });
    for (const call of [() => api.accounts.contactExports.fields(), () => api.accounts.contactExports.create({}), () => api.accounts.contactExports.get(jobId)]) await assert.rejects(call(), (err) => err.status === status && err.message === 'Safe backend message');
  }
  assert.deepEqual(events, []);
});
