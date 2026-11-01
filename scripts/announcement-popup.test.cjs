const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const load = () => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '../lib/announcement-popup.js'), 'utf8')).toString('base64')}`);

test('popup metadata round trips localized copy, optional image and actions', async () => {
  const { announcementPopupDraft, announcementPopupPayload } = await load();
  const metadata = { presentation: 'POPUP', titleFr: 'Découvrez • Fondeka', bodyFr: 'Ligne une\nLigne deux', cta: { type: 'OPEN_URL', label: 'Discover', labelFr: 'Découvrir', url: 'https://fondeka.com/news' } };
  assert.deepEqual(announcementPopupPayload(announcementPopupDraft(metadata)), metadata);
  for (const type of ['SHARE_APP', 'DISMISS']) {
    assert.deepEqual(announcementPopupPayload({ ...announcementPopupDraft(metadata), ctaType: type, ctaUrl: 'fondeka://ignored' }).cta, { type, label: 'Discover', labelFr: 'Découvrir', url: null });
  }
});

test('current format and informational popups never derive actions from legacy links', async () => {
  const { announcementPopupDraft, announcementPopupPayload } = await load();
  assert.deepEqual(announcementPopupPayload(announcementPopupDraft()), { presentation: null, titleFr: null, bodyFr: null, cta: null });
  for (const cta of [null, { type: 'NONE' }]) {
    const draft = announcementPopupDraft({ presentation: 'POPUP', cta, link: 'https://fondeka.com/legacy', downloadUpdate: true });
    assert.equal(announcementPopupPayload(draft).cta, null);
  }
});

test('bad destinations and incomplete CTA metadata fail before publishing', async () => {
  const { announcementPopupDraft, announcementPopupPayload } = await load();
  const draft = { ...announcementPopupDraft(), presentation: 'POPUP', ctaType: 'OPEN_URL', ctaLabel: 'Read', ctaUrl: 'https://fondeka.com/news' };
  for (const bad of ['', 'http://fondeka.com', 'fondeka://news', 'https:news', '//fondeka.com', 'https://user:pass@fondeka.com', 'https://fondeka.com:99999/', 'https://fondeka.com/a\nb']) {
    assert.throws(() => announcementPopupPayload({ ...draft, ctaUrl: bad }));
  }
  for (const patch of [{ ctaLabel: ' ' }, { ctaType: 'UNKNOWN' }, { ctaLabel: 'x'.repeat(81) }, { ctaLabelFr: 'Read\nnow' }, { image: 'http://fondeka.com/img' }, { titleFr: 'x'.repeat(256) }]) {
    assert.throws(() => announcementPopupPayload({ ...draft, ...patch }));
  }
});

test('disabled notification announcements ignore unused invalid draft metadata', async () => {
  const { notificationAnnouncementPayload } = await load();
  assert.equal(notificationAnnouncementPayload({ enabled: false, presentation: 'UNKNOWN', ctaType: 'OPEN_URL', image: 'invalid', titleFr: 'x'.repeat(256), startAt: 'not a date', appVersionAtLeast: 'bad' }, '', ''), undefined);
});

test('notification options inherit outer targeting and preserve Unicode, newlines and every action', async () => {
  const { announcementPopupDraft, notificationAnnouncementPayload } = await load();
  for (const type of ['NONE', 'OPEN_URL', 'SHARE_APP', 'DISMISS']) {
    const options = notificationAnnouncementPayload({ ...announcementPopupDraft(), enabled: true, presentation: 'POPUP', ctaType: type, ctaLabel: 'Discover • now', ctaUrl: 'https://fondeka.com/news', titleFr: 'Une nouvelle', bodyFr: 'Merci • Fondeka\nÀ bientôt.', image: '', startAt: '2026-12-01T12:30', endAt: '2026-12-02T12:30', audience: { hasCards: false }, appVersionAtLeast: '2.0.0' }, 'News', 'Hello\nworld');
    assert.equal(options.presentation, 'POPUP');
    assert.equal(options.cta?.type ?? 'NONE', type);
    assert.equal(options.bodyFr, 'Merci • Fondeka\nÀ bientôt.');
    assert.equal(options.startAt, '2026-12-01T12:30:00Z');
    assert.equal(Object.hasOwn(options, 'audience'), false);
    assert.equal(Object.hasOwn(options, 'appVersionAtLeast'), false);
    assert.equal(Object.hasOwn(options, 'title'), false);
  }
});

test('default copy and UTC schedules validate before a notification can send', async () => {
  const { notificationAnnouncementPayload, announcementSchedulePayload, announcementDateInput } = await load();
  for (const [title, body] of [[' ', 'Body'], ['Title', ''], ['x'.repeat(256), 'Body'], ['Title', 'Hi\0there']]) {
    assert.throws(() => notificationAnnouncementPayload({ enabled: true }, title, body));
  }
  for (const draft of [{ startAt: '2026-02-30T12:00' }, { startAt: 'bad' }, { startAt: '2026-12-02T12:00', endAt: '2026-12-01T12:00' }]) assert.throws(() => announcementSchedulePayload(draft));
  const saved = { startAt: '2026-12-01T12:30:42.123456789Z', endAt: '2026-12-02T12:30:18Z' };
  assert.deepEqual(announcementSchedulePayload(Object.fromEntries(Object.entries(saved).map(([key, value]) => [key, announcementDateInput(value)])), saved), saved);
});

test('announcement APIs use authenticated dedicated routes and denied saves stay in place', async () => {
  const { api } = await import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '../lib/api.js'), 'utf8')).toString('base64')}`);
  const originalFetch = global.fetch, originalWindow = global.window;
  const calls = [], events = [];
  try {
    global.window = { dispatchEvent: (event) => events.push(event) };
    global.fetch = async (url, init) => { calls.push({ url, ...init }); return Response.json({ message: 'Permission denied' }, { status: 403 }); };
    api.setAuthToken('popup-admin-token');
    for (const send of [() => api.announcements.create({ title: 'Default', body: 'Hello', presentation: 'POPUP', cta: null }), () => api.announcements.update(7, { presentation: null }), () => api.notifications.pushTest({ accountId: 123, subject: 'Default', message: 'Hello' }), () => api.notifications.createPushCampaign({ subject: 'Default', message: 'Hello' })]) await assert.rejects(send, (error) => error.status === 403 && error.message === 'Permission denied');
    assert.deepEqual(events, []);
    assert.deepEqual(calls.map((call) => [call.url, call.method]), [['/admin-api/announcements','POST'],['/admin-api/announcements/7','PUT'],['/admin-api/notifications/push-test','POST'],['/admin-api/notifications/push-campaign','POST']]);
    assert.ok(calls.every((call) => call.headers.Authorization === 'Bearer popup-admin-token' && call.cache === 'no-store'));
  } finally { global.fetch = originalFetch; global.window = originalWindow; }
});
