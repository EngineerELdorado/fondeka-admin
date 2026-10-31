const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const load = (file, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64')}#${tag}`);

test('notice settings distinguish supported null defaults from unavailable backend fields', async () => {
  const { businessToolsNoticeSettings } = await load('lib/business-tools-notices.js');
  const plan = { code: 'POS', version: 2, purchaseNoticeEn: null, purchaseNoticeFr: 'Français' };
  assert.equal(businessToolsNoticeSettings(plan), plan);
  for (const value of [{ code: 'POS', version: 2 }, { ...plan, version: '2' }, { ...plan, version: -1 }, { ...plan, purchaseNoticeEn: undefined }, { ...plan, purchaseNoticeFr: false }]) assert.equal(businessToolsNoticeSettings(value), null);
});

test('notice payload preserves Unicode and line breaks, resets with empty strings and never includes pricing', async () => {
  const { businessToolsNoticePayload } = await load('lib/business-tools-notices.js');
  assert.deepEqual(businessToolsNoticePayload({ purchaseNoticeEn: " O’Brien’s {0}.\nThank you • ", purchaseNoticeFr: '  ', amount: 99 }, 3, ' Approved copy '), {
    version: 3, purchaseNoticeEn: "O’Brien’s {0}.\nThank you •", purchaseNoticeFr: '', reason: 'Approved copy'
  });
  for (const [draft, version, reason] of [[{ purchaseNoticeEn: 'x'.repeat(4001), purchaseNoticeFr: '' }, 0, 'Valid'], [{ purchaseNoticeEn: '', purchaseNoticeFr: null }, 0, 'Valid'], [{ purchaseNoticeEn: '', purchaseNoticeFr: '' }, null, 'Valid'], [{ purchaseNoticeEn: '', purchaseNoticeFr: '' }, 0, ' '], [{ purchaseNoticeEn: '', purchaseNoticeFr: '' }, 0, 'x'.repeat(1001)]]) assert.throws(() => businessToolsNoticePayload(draft, version, reason));
});

test('notice saves use the dedicated versioned endpoint and preserve a denied save in the dashboard', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'notice-api'); api.setAuthToken('notice-admin');
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ code: 'PLAN+POS', version: 3, purchaseNoticeEn: 'Notice', purchaseNoticeFr: null }); };
  const payload = { purchaseNoticeEn: 'Notice', purchaseNoticeFr: '', version: 2, reason: 'Approved' };
  await api.businessTools.plans.updatePurchaseNotice('PLAN+POS', payload);
  assert.match(calls[0].url, /\/business-tools\/plans\/PLAN%2BPOS\/purchase-notice$/);
  assert.equal(calls[0].init.method, 'PUT'); assert.equal(calls[0].init.headers.Authorization, 'Bearer notice-admin');
  assert.deepEqual(JSON.parse(calls[0].init.body), payload);
  global.fetch = async () => Response.json({ message: 'Super Admin required' }, { status: 403 });
  await assert.rejects(api.businessTools.plans.updatePurchaseNotice('POS', payload), (err) => err.status === 403 && err.message === 'Super Admin required');
});
