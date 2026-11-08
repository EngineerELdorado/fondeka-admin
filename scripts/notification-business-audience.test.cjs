const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const load = () => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '../lib/notification-business-audience.js'), 'utf8')).toString('base64')}`);

test('all business criteria default to Any and do not silently narrow existing audiences', async () => {
  const { businessAudienceFields, businessAudienceDraft, businessAudiencePayload } = await load();
  assert.deepEqual(businessAudienceFields.map(({ key }) => key), ['isReseller', 'hasStores', 'hasPos', 'hasPaymentRequests', 'hasApi']);
  for (const source of [undefined, null, {}, { countryCodes: ['CD'] }]) {
    assert.deepEqual(Object.values(businessAudienceDraft(source)), Array(5).fill('ANY'));
    assert.deepEqual(businessAudiencePayload(businessAudienceDraft(source)), {});
  }
});

test('every Yes and No survives saved announcement edit and push payload round trips', async () => {
  const { businessAudienceFields, businessAudienceDraft, businessAudiencePayload } = await load();
  for (const { key } of businessAudienceFields) for (const value of [true, false]) {
    assert.deepEqual(businessAudiencePayload(businessAudienceDraft({ [key]: value })), { [key]: value });
  }
  const criteria = { isReseller: true, hasStores: false, hasPos: true, hasPaymentRequests: false, hasApi: true };
  assert.deepEqual(businessAudiencePayload(businessAudienceDraft(criteria)), criteria);
});

test('partial or malformed old content never turns strings or unrelated settings into targeting', async () => {
  const { businessAudienceDraft, businessAudiencePayload } = await load();
  assert.deepEqual(businessAudiencePayload(businessAudienceDraft({ isReseller: 'false', hasStores: null, hasPos: 1, hasApi: {}, hasPaymentRequests: false })), { hasPaymentRequests: false });
  assert.deepEqual(businessAudiencePayload({ isReseller: 'ANY', hasPos: 'YES', hasApi: 'NO', hasCards: 'YES', countryCodes: ['CD'] }), { hasPos: true, hasApi: false });
});

const React = require('react');
const { mountComponent } = require('./helpers/component-harness.cjs');
const loadFile = file => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64')}`);
const text = node => Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text(node.props.children) : node == null || typeof node === 'boolean' ? '' : String(node);
function control(view, label) {
  const parent = view.nodes().find(node => node.type === 'label' && (React.Children.toArray(node.props.children).some(child => React.isValidElement(child) && child.type === 'span' && text(child) === label) || text(node).trim() === label && React.Children.toArray(node.props.children).some(child => React.isValidElement(child) && child.type === 'input')));
  if (parent) return React.Children.toArray(parent.props.children).find(child => React.isValidElement(child) && ['input', 'select', 'textarea', 'country-list'].includes(child.type)).props;
  const htmlLabel = view.nodes().find(node => node.type === 'label' && text(node) === label && node.props.htmlFor);
  if (htmlLabel) return view.nodes().find(node => node.props.id === htmlLabel.props.htmlFor).props;
  throw new Error(`Missing control: ${label}`);
}
async function change(view, label, value) {
  const input = control(view, label);
  if (input['aria-label'] === 'Country codes' || input['aria-label'] === 'Country codes override') input.onChange(value);
  else input.onChange({ target: { value, checked: value, selectedOptions: Array.isArray(value) ? value.map(value => ({ value })) : [] } });
  await view.flush();
}
async function modules(api) {
  return {
    '@/lib/api': { api }, '@/lib/notification-business-audience': await load(), '@/lib/announcement-popup': await loadFile('lib/announcement-popup.js'),
    '@/components/BusinessAudienceHelp': { __esModule: true, default: 'business-help' },
    '@/components/CountrySelect': { CountryListField: 'country-list', CountrySelect: 'select' },
    '@/components/CatalogSelect': { CatalogSelect: 'select' }, '@/components/DataTable': { DataTable: 'table' }, '@/components/TableCell': { TableCellLines: 'lines' },
    '@/components/RegulatorPresentation': { PresentationSelect: 'select', PresentationLink: 'a', RegulatorField: 'regulator-field', NonRegulatorContent: 'regular-content' },
    '@/lib/regulator-presentation': { isRegulatorRestrictedRecord: () => false, isRegulatorRestrictedService: () => false },
    '@/contexts/AuthContext': { useAuth: () => ({ enableRegulatorMode: false }) },
    '@/components/AnnouncementPopupFields': { AnnouncementPopupFields: 'popup-fields' }, '@/components/ContentModal': { ContentModal: 'dialog' },
    '@/lib/payment-method-labels': { paymentMethodAdminLabel: row => row.name || '' }
  };
}
async function push(t, send = async () => ({})) {
  const posts = [];
  const api = { countries: { options: async () => [] }, paymentMethods: { options: async () => [] }, paymentProviders: { list: async () => [] }, billProducts: { options: async () => [] }, notifications: { createPushCampaign: async payload => { posts.push(payload); return send(payload); } } };
  const view = await mountComponent(path.join(__dirname, '../app/(dashboard)/dashboard/notification-push-campaigns/page.js'), { modules: await modules(api) });
  t.after(() => view.unmount()); await view.flush(); return { view, posts };
}
const announcement = {
  id: 11, title: 'Business news', body: 'Hello 👋\nSecond line', active: true, presentation: 'POPUP', titleFr: 'Actualités', bodyFr: 'Bonjour\nMerci',
  image: 'https://example.test/news.png', cta: { type: 'DISMISS', label: 'Got it', labelFr: 'Compris' },
  startAt: '2026-11-01T00:00:00Z', endAt: '2027-01-01T00:00:00Z', targetAccountId: 123, appVersionAtLeast: '2.0.0', appVersionLessThan: '3.0.0',
  audience: { countryCodes: ['CD'], deviceLanguages: ['fr'], kycStatuses: ['APPROVED'], transactionStatuses: ['COMPLETED'], paymentProviderIds: [8], transactionServices: ['BILL_PAYMENTS'], transactionActions: ['PAY_ELECTRICITY_BILL'], hasCards: false, minCompletedTransactions: 0, isReseller: true, hasStores: false, hasPos: true, hasPaymentRequests: false, hasApi: false }
};
async function announcements(t, { record = announcement, send = async payload => payload, editing = true } = {}) {
  const previousWindow = global.window, posts = [], reads = [];
  global.window = { location: { search: editing ? '?announcementId=11' : '' } };
  t.after(() => { if (previousWindow === undefined) delete global.window; else global.window = previousWindow; });
  const api = { announcements: {
    list: async () => ({ content: [record], totalElements: 1, totalPages: 1 }), get: async id => { reads.push(id); return record; },
    update: async (id, payload) => { posts.push({ id, payload }); return send(payload); },
    create: async payload => { posts.push({ payload }); return send(payload); }
  } };
  const view = await mountComponent(path.join(__dirname, '../app/(dashboard)/dashboard/announcements/page.js'), { modules: await modules(api) });
  t.after(() => view.unmount()); await view.flush(); return { view, posts, reads };
}

test('push campaigns publish the business criteria with other account filters and preserve false and zero', async t => {
  const { view, posts } = await push(t);
  await change(view, 'Subject', 'Grow your sales'); await change(view, 'Message', 'Discover reseller products.');
  await change(view, 'Country codes override', 'CD'); await change(view, 'Device languages', 'fr'); await change(view, 'Min completed', '0');
  await change(view, 'Is reseller', 'YES'); await change(view, 'Has store', 'YES'); await change(view, 'Has API plan', 'NO');
  await view.click('Launch campaign'); assert.equal(posts.length, 1);
  assert.deepEqual(posts[0].audience, { countryCodes: ['cd'], deviceLanguages: ['fr'], minCompletedTransactions: 0, isReseller: true, hasStores: true, hasApi: false });
  assert.ok(view.nodes().some(node => node.type === 'business-help'));
});

test('Any omits a business selector while other business criteria can target accounts on their own', async t => {
  const { view, posts } = await push(t);
  await change(view, 'Subject', 'News'); await change(view, 'Message', 'Business updates');
  await change(view, 'Is reseller', 'YES'); await change(view, 'Is reseller', 'ANY'); await change(view, 'Has POS plan', 'NO');
  await view.click('Launch campaign'); assert.deepEqual(posts[0].audience, { hasPos: false });
  await change(view, 'Has POS plan', 'ANY'); await view.click('Launch campaign'); assert.equal(Object.hasOwn(posts[1], 'audience'), false);
});

test('a campaign with an attached announcement keeps its audience and does not send unused nested audience overrides', async t => {
  const { view, posts } = await push(t);
  await change(view, 'Subject', 'Business news'); await change(view, 'Message', 'Latest updates');
  await change(view, 'Has API plan', 'YES'); await change(view, 'Has payment link / request', 'NO');
  await change(view, 'Also create announcement', true);
  await view.click('Launch campaign');
  assert.deepEqual(posts[0].audience, { hasPaymentRequests: false, hasApi: true });
  assert.equal(posts[0].announcement.enabled, true); assert.equal(Object.hasOwn(posts[0].announcement, 'audience'), false);
});

test('announcement editing restores all business choices and preserves existing targeting, scheduling and popup copy', async t => {
  const { view, posts, reads } = await announcements(t);
  assert.equal(reads.length, 1); assert.equal(posts.length, 0);
  assert.equal(control(view, 'Is reseller').value, 'YES'); assert.equal(control(view, 'Has store').value, 'NO');
  assert.equal(control(view, 'Has POS plan').value, 'YES'); assert.equal(control(view, 'Has API plan').value, 'NO');
  assert.equal(control(view, 'Has payment link / request').value, 'NO');
  await change(view, 'Has store', 'YES'); await view.click('Save');
  assert.equal(posts.length, 1); const saved = posts[0].payload;
  assert.deepEqual(saved.audience, { ...announcement.audience, hasStores: true });
  for (const key of ['title', 'body', 'titleFr', 'bodyFr', 'presentation', 'image', 'targetAccountId', 'appVersionAtLeast', 'appVersionLessThan']) assert.equal(saved[key], announcement[key]);
  assert.equal(Date.parse(saved.startAt), Date.parse(announcement.startAt)); assert.equal(Date.parse(saved.endAt), Date.parse(announcement.endAt));
  assert.equal(saved.cta.type, 'DISMISS'); assert.equal(saved.cta.labelFr, 'Compris');
});

test('changing a saved criterion to Any removes just that restriction', async t => {
  const { view, posts } = await announcements(t);
  await change(view, 'Is reseller', 'ANY'); await view.click('Save');
  const expected = { ...announcement.audience }; delete expected.isReseller;
  assert.deepEqual(posts[0].payload.audience, expected);
});

test('new announcements support a business-only negative audience and begin with no targeting restrictions', async t => {
  const { view, posts } = await announcements(t, { editing: false });
  await view.click('New announcement');
  for (const { label } of (await load()).businessAudienceFields) assert.equal(control(view, label).value, 'ANY');
  await change(view, 'Title (English / default) *', 'API updates'); await change(view, 'Message (English / default) *', 'Learn about the API');
  await change(view, 'Has API plan', 'NO'); await view.click('Create');
  assert.deepEqual(posts[0].payload.audience, { hasApi: false });
});

test('failed publication retains business audience choices for correction and retry', async t => {
  let fail = true;
  const { view, posts } = await announcements(t, { send: async payload => { if (fail) throw new Error('Audience validation failed'); return payload; } });
  await change(view, 'Has POS plan', 'NO'); await view.click('Save');
  assert.match(view.text(), /Audience validation failed/); assert.equal(control(view, 'Has POS plan').value, 'NO');
  fail = false; await view.click('Save');
  assert.deepEqual(posts[1].payload.audience, posts[0].payload.audience); assert.equal(posts[1].payload.audience.hasPos, false);
});

test('Any on every new-announcement criterion produces an unrestricted audience', async t => {
  const { view, posts } = await announcements(t, { editing: false });
  await view.click('New announcement');
  await change(view, 'Title (English / default) *', 'General news'); await change(view, 'Message (English / default) *', 'For eligible accounts');
  await view.click('Create'); assert.equal(posts[0].payload.audience, null);
});

test('push launch errors keep the selected business audience for an explicit retry', async t => {
  let fail = true;
  const { view, posts } = await push(t, async () => { if (fail) throw new Error('Campaign rejected'); return {}; });
  await change(view, 'Subject', 'News'); await change(view, 'Message', 'Business updates'); await change(view, 'Is reseller', 'NO');
  await view.click('Launch campaign'); assert.match(view.text(), /Campaign rejected/); assert.equal(control(view, 'Is reseller').value, 'NO');
  fail = false; await view.click('Launch campaign'); assert.deepEqual(posts[1].audience, { isReseller: false });
});

test('the existing campaign and announcement APIs retain literal booleans in authenticated JSON requests', async t => {
  const previous = global.fetch; t.after(() => { global.fetch = previous; });
  const { api } = await loadFile('lib/api.js'); api.setAuthToken('test-audience-token');
  const calls = []; global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(JSON.parse(init.body)); };
  const audience = { isReseller: true, hasStores: false, hasPos: true, hasPaymentRequests: false, hasApi: false };
  await api.notifications.createPushCampaign({ subject: 'News', message: 'Business updates', audience });
  await api.announcements.create({ title: 'News', body: 'Business updates', audience });
  await api.announcements.update(11, { title: 'News', body: 'Business updates', audience });
  assert.match(calls[0].url, /\/admin-api\/notifications\/push-campaign$/);
  assert.match(calls[1].url, /\/admin-api\/announcements$/); assert.match(calls[2].url, /\/admin-api\/announcements\/11$/);
  for (const { init } of calls) { assert.deepEqual(JSON.parse(init.body).audience, audience); assert.equal(init.cache, 'no-store'); assert.equal(init.headers.Authorization, 'Bearer test-audience-token'); }
});
