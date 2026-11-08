const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const load = (file, tag = '') => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64')}#${tag}`);
const translation = (version, title) => ({ version, content: { title, body: 'Your working capital.', salesTitle: 'Ready for sales', salesBody: 'Buy products.', availabilityTitle: 'Available', availabilityBody: 'Withdraw when needed.' } });
const settings = () => ({ en: translation(4, 'Your stock'), fr: translation(9, 'Votre stock') });

test('stock copy patches only edited fields and keeps text literal, with independent language versions', async () => {
  const h = await load('lib/reseller-stock-funding.js');
  const base = h.stockFundingSettings(settings()), draft = h.stockFundingDraft(base.fr);
  draft.body = ' \u00a0L’argent <b>reste</b> à vous.\n**Texte** https://example.com/?lang=fr#stock \ufeff';
  draft.salesTitle = ' \n ';
  assert.deepEqual(h.stockFundingPayload(draft, base.fr), { version: 9, content: { body: 'L’argent <b>reste</b> à vous.\n**Texte** https://example.com/?lang=fr#stock', salesTitle: null } });
  assert.equal(h.stockFundingChanged(h.stockFundingDraft(base.en), base.en), false);
  const merged = h.stockFundingReapply(draft, base.fr, h.stockFundingTranslation({ ...base.fr, version: 10, content: { ...base.fr.content, title: 'Another admin’s title' } }));
  assert.equal(merged.title, 'Another admin’s title'); assert.equal(merged.body, draft.body);
});

test('stock copy rejects malformed records, invalid text, excess lengths and missing versions', async () => {
  const h = await load('lib/reseller-stock-funding.js'), base = h.stockFundingTranslation(settings().en), draft = h.stockFundingDraft(base);
  for (const bad of [undefined, {}, { version: -1, content: {} }, { version: '4', content: {} }, { version: 1, content: [] }, { version: 1, content: { body: 2 } }]) assert.throws(() => h.stockFundingTranslation(bad));
  for (const [field, value] of [['title', 'x'.repeat(161)], ['salesBody', 'x'.repeat(4001)], ['body', {}]]) assert.throws(() => h.stockFundingPayload({ ...draft, [field]: value }, base));
  assert.throws(() => h.stockFundingPayload(draft, base), /no text changes/i);
  assert.throws(() => h.stockFundingPayload({ ...draft, title: 'New' }, { ...base, version: null }), /migration/);
  const missing = h.stockFundingTranslation({ version: null, content: {} });
  assert.ok(Object.values(h.stockFundingDraft(missing)).every((value) => value === ''));
  const maximum = h.stockFundingPayload({ ...draft, title: 'x'.repeat(160), body: 'x'.repeat(4000), prefundingAmount: 999, action: 'PAY' }, base);
  assert.deepEqual(Object.keys(maximum), ['version', 'content']); assert.deepEqual(Object.keys(maximum.content), ['title', 'body']);
});

test('admin stock copy API uses uncached authenticated reads and sparse PATCH, never financial endpoints', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'stock-copy-api'); api.setAuthToken('stock-copy-admin');
  const calls = []; global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(init.method === 'PATCH' ? settings().fr : settings()); };
  await api.resellers.stockFundingInfo(); await api.resellers.updateStockFundingInfo('fr', { version: 9, content: { body: null } });
  assert.match(calls[0].url, /\/admin-api\/resellers\/program\/stock-funding-info$/);
  assert.match(calls[1].url, /\/stock-funding-info\/fr$/); assert.equal(calls[1].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[1].init.body), { version: 9, content: { body: null } });
  assert.throws(() => api.resellers.updateStockFundingInfo('fr-CD', {})); assert.equal(calls.length, 2);
  for (const call of calls) { assert.equal(call.init.cache, 'no-store'); assert.equal(call.init.headers.Authorization, 'Bearer stock-copy-admin'); }
});

async function panel({ canWrite = true, initial = settings(), read, write } = {}) {
  const helpers = await load('lib/reseller-stock-funding.js');
  const state = { saved: structuredClone(initial), reads: 0, writes: [] };
  const api = { resellers: {
    stockFundingInfo: async () => { state.reads++; return read ? read(state) : structuredClone(state.saved); },
    updateStockFundingInfo: async (language, payload) => {
      state.writes.push({ language, payload });
      if (write) return write(language, payload, state);
      state.saved[language] = { version: payload.version + 1, content: { ...state.saved[language].content, ...payload.content } };
      return structuredClone(state.saved[language]);
    }
  } };
  const view = await mountComponent(path.join(__dirname, '../components/resellers/StockFundingPanel.js'), {
    props: { canWrite }, modules: (hooks) => ({
      '@/lib/api': { api }, '@/lib/reseller-stock-funding': helpers, './resellers.module.css': { __esModule: true, default: {} },
      './Common': { Card: 'section', Alert: 'alert', Field: 'field', actionStyle: {}, useMounted: () => hooks.useRef(true), useResellerError: () => hooks.useCallback(async (err) => err.message, []) }
    })
  });
  await view.flush(); return { view, state };
}

test('language drafts survive switching; saving English cannot alter French or fund an account', async () => {
  const { view, state } = await panel();
  assert.equal(view.button('Save English').disabled, true);
  view.change('Main title', 'New English'); await view.click('French');
  view.change('Main explanation', 'Nouveau texte'); await view.click('English · Unsaved');
  assert.equal(view.field('Main title').props.value, 'New English'); await view.click('Save English');
  assert.deepEqual(state.writes, [{ language: 'en', payload: { version: 4, content: { title: 'New English' } } }]);
  assert.match(view.text(), /English stock explanation saved/);
  await view.click('French · Unsaved'); assert.equal(view.field('Main explanation').props.value, 'Nouveau texte');
  await view.click('Save French'); assert.equal(state.writes[1].payload.version, 9);
  assert.equal(state.reads, 1);
});

test('preview renders markup-looking content literally and blank French fields use French fallback', async () => {
  const { view } = await panel(); await view.click('French');
  view.change('Main title', '<script>literal</script>'); view.change('Main explanation', '**Copie**\nhttps://example.com/'); view.change('Sales title', '');
  assert.match(view.text(), /<script>literal<\/script>/); assert.match(view.text(), /Sales title: bundled French text/);
  assert.ok(!view.nodes().some((node) => node.props.dangerouslySetInnerHTML || node.type === 'a'));
  assert.equal(view.nodes().find((node) => node.type === 'aside').props.lang, 'fr');
});

test('409 preserves edits, requires review, and reapplication preserves other administrators’ fields', async () => {
  let conflict = true;
  const { view, state } = await panel({ write: async (lang, payload, current) => {
    if (conflict) { current.saved.en = translation(5, 'Another admin’s title'); throw Object.assign(new Error('Text changed'), { status: 409 }); }
    return { version: 6, content: { ...current.saved[lang].content, ...payload.content } };
  } });
  view.change('Main explanation', 'My edited explanation'); await view.click('Save English');
  assert.equal(view.field('Main explanation').props.value, 'My edited explanation'); assert.equal(view.button('Save English').disabled, true);
  await view.click('Save English'); assert.equal(state.writes.length, 1);
  await view.click('Refresh saved text'); assert.match(view.text(), /Another admin’s title/); assert.equal(view.button('Save English').disabled, true);
  await view.click('I reviewed version 5 — keep my edits');
  assert.equal(view.field('Main title').props.value, 'Another admin’s title'); assert.equal(view.field('Main explanation').props.value, 'My edited explanation');
  conflict = false; await view.click('Save English');
  assert.deepEqual(state.writes[1].payload, { version: 5, content: { body: 'My edited explanation' } });
});

test('an uncertain save requires reading the outcome before retry and can recover already saved text', async () => {
  const { view, state } = await panel({ write: async (lang, payload, current) => {
    current.saved[lang] = { version: 5, content: { ...current.saved[lang].content, ...payload.content } };
    throw new Error('Response lost');
  } });
  view.change('Main title', 'Published despite timeout'); await view.click('Save English');
  assert.equal(view.button('Save English').disabled, true); await view.click('Refresh saved text');
  await view.click('Use saved English text'); assert.equal(view.button('Save English').disabled, true); assert.equal(state.writes.length, 1);
  assert.equal(view.field('Main title').props.value, 'Published despite timeout');
});

test('400 keeps the editable draft, while 403 locks saving without discarding it', async () => {
  let status = 400;
  const { view, state } = await panel({ write: async () => { throw Object.assign(new Error('Save rejected'), { status }); } });
  view.change('Main title', 'Retained'); await view.click('Save English'); assert.equal(view.button('Save English').disabled, false);
  status = 403; await view.click('Save English');
  assert.equal(view.field('Main title').props.value, 'Retained'); assert.match(view.text(), /Read only/);
  assert.ok(view.nodes().find((node) => node.type === 'fieldset').props.disabled);
  assert.ok(!view.nodes().some((node) => node.type === 'button' && node.props.children === 'Save English')); assert.equal(state.writes.length, 2);
});

test('read-only and unseeded translations never synthesize a writable version', async () => {
  const reader = await panel({ canWrite: false });
  assert.ok(reader.view.nodes().find((node) => node.type === 'fieldset').props.disabled);
  assert.ok(!reader.view.nodes().some((node) => node.type === 'button' && node.props.children === 'Save English'));
  const missing = await panel({ initial: { en: { version: null, content: {} }, fr: translation(9, 'Votre stock') } });
  assert.equal(missing.view.button('Save English').disabled, true); assert.match(missing.view.text(), /backend migration/);
  await missing.view.click('French'); assert.equal(missing.view.nodes().find((node) => node.type === 'fieldset').props.disabled, false);
});

test('read failures retain drafts and prevent stale saves until an explicit review', async () => {
  let fail = false;
  const { view, state } = await panel({ read: (current) => { if (fail) throw new Error('Server unavailable'); return structuredClone(current.saved); } });
  view.change('Main title', 'Kept draft'); fail = true; await view.click('Refresh saved text');
  assert.equal(view.field('Main title').props.value, 'Kept draft'); assert.equal(view.button('Save English').disabled, true);
  fail = false; await view.click('Refresh saved text'); await view.click('I reviewed version 4 — keep my edits'); await view.click('Save English');
  assert.equal(state.writes.length, 1);
});

test('a pending save cannot submit twice or switch its response into another language', async () => {
  let release;
  const { view, state } = await panel({ write: () => new Promise((resolve) => { release = resolve; }) });
  view.change('Main title', 'Pending title');
  const saving = view.click('Save English'); await view.flush();
  view.change('Main title', 'A second edit during save'); await view.flush();
  assert.equal(view.field('Main title').props.value, 'Pending title');
  assert.equal(view.button('French').disabled, true); await view.click('French'); await view.click('Save English'); assert.equal(state.writes.length, 1);
  release(translation(5, 'Pending title')); await saving; await view.flush(); assert.match(view.text(), /English stock explanation saved/);
  await view.click('French'); assert.equal(view.field('Main title').props.value, 'Votre stock');
});
