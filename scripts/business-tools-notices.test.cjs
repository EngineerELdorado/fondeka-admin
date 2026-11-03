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

const faqPlan = {
  code: 'API+CUSTOM', tool: 'API', active: false, version: 8,
  purchaseNoticeEn: 'Integrate {0}.\nKeep your existing quote.', purchaseNoticeFr: null,
  purchaseNoticeLink: { url: 'https://www.fondeka.com/docs/faq?lang=en#api', urlFr: 'https://www.fondeka.com/docs/faq?lang=fr#api', labelEn: 'Read the API FAQ', labelFr: 'Consulter la FAQ de l’API' }
};

test('FAQ drafts preserve each returned code’s settings, including inactive and extra offers', async () => {
  const { businessToolsNoticeDraft, businessToolsFaqAvailable, businessToolsNoticeChanged } = await load('lib/business-tools-notices.js');
  for (const tool of ['BUNDLE', 'PAYMENT_REQUESTS', 'ONLINE_STORES', 'POS', 'API']) {
    const plan = { ...faqPlan, code: `CUSTOM_${tool}`, tool };
    const draft = businessToolsNoticeDraft(plan);
    assert.equal(businessToolsFaqAvailable(plan), true);
    assert.equal(draft.faqEnabled, true);
    assert.equal(draft.urlFr, faqPlan.purchaseNoticeLink.urlFr);
    assert.equal(draft.purchaseNoticeFr, '');
    assert.equal(businessToolsNoticeChanged(plan, draft), false);
  }
  assert.equal(businessToolsFaqAvailable({ ...faqPlan, purchaseNoticeLink: null }), true);
  assert.equal(businessToolsFaqAvailable({ ...faqPlan, purchaseNoticeLink: undefined }), false);
  assert.equal(businessToolsFaqAvailable({ ...faqPlan, purchaseNoticeLink: [] }), false);
});

test('notice-only edits omit the FAQ, a single FAQ edit replaces all fields, and removal sends an empty object', async () => {
  const { businessToolsNoticeDraft, businessToolsFaqOperation, businessToolsNoticePayload } = await load('lib/business-tools-notices.js');
  const draft = businessToolsNoticeDraft(faqPlan);
  draft.purchaseNoticeFr = 'Intégrez Fondeka.\nMerci 👋';
  const keep = businessToolsNoticePayload(draft, faqPlan.version, 'Benefits only', businessToolsFaqOperation(faqPlan, draft));
  assert.equal(Object.hasOwn(keep, 'purchaseNoticeLink'), false);
  draft.labelEn = 'New API FAQ label';
  const replace = businessToolsNoticePayload(draft, faqPlan.version, 'FAQ label', businessToolsFaqOperation(faqPlan, draft));
  assert.deepEqual(replace.purchaseNoticeLink, { ...faqPlan.purchaseNoticeLink, labelEn: draft.labelEn });
  draft.faqEnabled = false;
  const remove = businessToolsNoticePayload(draft, faqPlan.version, 'Remove FAQ', businessToolsFaqOperation(faqPlan, draft));
  assert.deepEqual(remove.purchaseNoticeLink, {});
  assert.equal(remove.purchaseNoticeFr, draft.purchaseNoticeFr);
  assert.equal(Object.hasOwn(remove, 'active'), false);
  assert.equal(Object.hasOwn(remove, 'amount'), false);
});

test('new links require a primary URL and optional blank values explicitly restore fallback', async () => {
  const { businessToolsNoticeDraft, businessToolsFaqOperation, businessToolsNoticePayload } = await load('lib/business-tools-notices.js');
  const plan = { ...faqPlan, purchaseNoticeLink: null }, draft = businessToolsNoticeDraft(plan);
  draft.faqEnabled = true;
  assert.equal(businessToolsFaqOperation(plan, draft), 'replace');
  assert.throws(() => businessToolsNoticePayload(draft, 8, 'Configure FAQ', 'replace'), /Primary FAQ URL/);
  draft.url = ' https://www.fondeka.com/docs/faq?lang=en#api ';
  assert.deepEqual(businessToolsNoticePayload(draft, 8, 'Configure FAQ', 'replace').purchaseNoticeLink, {
    url: draft.url.trim(), urlFr: null, labelEn: null, labelFr: null
  });
  assert.throws(() => businessToolsNoticePayload(draft, 8, 'Configure FAQ', 'unknown'), /operation/);
});

test('FAQ destinations preserve query strings and reject unsafe or invalid URLs', async () => {
  const { businessToolsFaqUrl } = await load('lib/business-tools-notices.js');
  const url = 'https://www.fondeka.com/docs/faq?lang=fr&topic=api%2Btools#paiements';
  assert.equal(businessToolsFaqUrl(url), url);
  assert.equal(businessToolsFaqUrl('https://[2606:4700::1111]/faq'), 'https://[2606:4700::1111]/faq');
  for (const invalid of ['', '/docs/faq', 'http://fondeka.com/faq', 'javascript:alert(1)', 'https://user:pass@fondeka.com', 'https://localhost/faq', 'https://test.localhost/faq', 'https://127.0.0.1/faq', 'https://2130706433/faq', 'https://10.1.2.3', 'https://172.31.0.1', 'https://192.168.1.1', 'https://169.254.1.1', 'https://[::1]/faq', 'https://[fc00::1]', 'https://[fe80::1]', 'https://[::ffff:192.168.0.1]', 'https://www.fondeka.com/a b', `https://www.fondeka.com/${'x'.repeat(2048)}`]) {
    assert.throws(() => businessToolsFaqUrl(invalid), Error, invalid);
  }
});

test('FAQ labels are optional single-line plain text and preserve Unicode without substituting placeholders', async () => {
  const { businessToolsNoticeDraft, businessToolsNoticePayload } = await load('lib/business-tools-notices.js');
  const draft = businessToolsNoticeDraft(faqPlan);
  for (const labelEn of ['x'.repeat(161), 'Two\nlines', '\nNewline', '<b>FAQ</b>', 'FAQ\u2028link']) {
    assert.throws(() => businessToolsNoticePayload({ ...draft, labelEn }, 8, 'Reviewed FAQ', 'replace'), /single-line plain text/);
  }
  const payload = businessToolsNoticePayload({ ...draft, labelEn: 'Lire {0} 👋', labelFr: '  ', urlFr: ' ' }, 8, 'Reviewed FAQ', 'replace');
  assert.equal(payload.purchaseNoticeLink.labelEn, 'Lire {0} 👋');
  assert.equal(payload.purchaseNoticeLink.labelFr, null);
  assert.equal(payload.purchaseNoticeLink.urlFr, null);
});

test('bilingual FAQ previews use regional French and documented URL and label fallbacks', async () => {
  const { businessToolsFaqPreview } = await load('lib/business-tools-notices.js');
  assert.deepEqual(businessToolsFaqPreview(faqPlan.purchaseNoticeLink, 'fr-CD'), { url: faqPlan.purchaseNoticeLink.urlFr, label: faqPlan.purchaseNoticeLink.labelFr });
  const fallback = { url: faqPlan.purchaseNoticeLink.url, labelEn: '', labelFr: '' };
  assert.deepEqual(businessToolsFaqPreview(fallback, 'fr-CD'), { url: fallback.url, label: 'Consulter la FAQ' });
  assert.deepEqual(businessToolsFaqPreview(fallback, 'en'), { url: fallback.url, label: 'Read the FAQ' });
  assert.equal(businessToolsFaqPreview({ url: 'http://unsafe.test' }), null);
});

test('account previews prioritize the selected tool, allow bundle fallback only in BUNDLE, and use localized labels', async () => {
  const { businessToolsAccountNoticePreview } = await load('lib/business-tools-notices.js');
  const bundle = { url: 'https://www.fondeka.com/faq?lang=fr', label: 'FAQ des outils' };
  const own = { url: 'https://www.fondeka.com/faq?tool=api&lang=fr', label: 'FAQ API' };
  const access = { pricingMode: 'BUNDLE', bundle: { purchaseNotice: 'Bundle benefits', purchaseNoticeLink: bundle }, tools: [{ tool: 'API', purchaseNotice: 'Avantages API', purchaseNoticeLink: own }] };
  assert.deepEqual(businessToolsAccountNoticePreview(access, 'API'), { notice: 'Avantages API', link: own, linkSource: 'Selected tool' });
  access.tools[0].purchaseNoticeLink = { url: 'http://invalid.test' };
  assert.equal(businessToolsAccountNoticePreview(access, 'API').linkSource, 'Bundle fallback');
  assert.deepEqual(businessToolsAccountNoticePreview(access, 'BUNDLE'), { notice: 'Bundle benefits', link: bundle, linkSource: 'Bundle' });
  access.bundle.purchaseNoticeLink = null;
  access.purchaseNoticeLink = bundle;
  assert.equal(businessToolsAccountNoticePreview(access, 'API').linkSource, 'Bundle fallback');
  access.pricingMode = 'PER_TOOL';
  assert.equal(businessToolsAccountNoticePreview(access, 'API').link, null);
  assert.throws(() => businessToolsAccountNoticePreview(access, 'POS'), /selected tool/);
});

test('save confirmation rejects ignored FAQ changes, missing contracts, wrong versions and wrong plan codes', async () => {
  const { businessToolsNoticeDraft, businessToolsNoticePayload, businessToolsNoticeSaveConfirmed } = await load('lib/business-tools-notices.js');
  const payload = businessToolsNoticePayload({ ...businessToolsNoticeDraft(faqPlan), labelEn: 'Updated FAQ' }, 8, 'Update FAQ', 'replace');
  const saved = { ...faqPlan, version: 9, purchaseNoticeLink: payload.purchaseNoticeLink };
  assert.equal(businessToolsNoticeSaveConfirmed(saved, faqPlan, payload), true);
  assert.equal(businessToolsNoticeSaveConfirmed(faqPlan, faqPlan, payload), false);
  assert.equal(businessToolsNoticeSaveConfirmed({ ...saved, purchaseNoticeLink: null }, faqPlan, payload), false);
  assert.equal(businessToolsNoticeSaveConfirmed({ ...saved, code: 'OTHER' }, faqPlan, payload), false);
  assert.equal(businessToolsNoticeSaveConfirmed({ ...saved, version: 7 }, faqPlan, payload), false);
  const unicodePayload = { ...payload, purchaseNoticeLink: { ...payload.purchaseNoticeLink, url: 'HTTPS://www.fondeka.com/faq/réponse?lang=fr#détails' } };
  assert.equal(businessToolsNoticeSaveConfirmed({ ...saved, purchaseNoticeLink: { ...saved.purchaseNoticeLink, url: 'https://www.fondeka.com/faq/r%C3%A9ponse?lang=fr#d%C3%A9tails' } }, faqPlan, unicodePayload), true);
});

test('account previews send the requested language without modifying access or payment settings', async (t) => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const { api } = await load('lib/api.js', 'faq-preview-api'); api.setAuthToken('faq-admin');
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ tools: [] }); };
  await api.businessTools.accounts.getAccess(123, 'fr-CD');
  await api.businessTools.accounts.getToolAccess(123, 'API', 'en');
  assert.match(calls[0].url, /\/business-tools\/accounts\/123\/access$/);
  assert.match(calls[1].url, /\/business-tools\/accounts\/123\/tools\/API\/access$/);
  assert.equal(calls[0].init.headers['Accept-Language'], 'fr-CD');
  assert.equal(calls[1].init.headers['Accept-Language'], 'en');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer faq-admin');
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.body, undefined);
});

// Exercise the real editor handlers with deterministic hooks; no browser or backend mutation.
async function noticeEditor({ plan = faqPlan, canManage = true, update, list = async () => [plan] } = {}) {
  const React = require('react'), { transform } = require('next/dist/build/swc');
  const helpers = await load('lib/business-tools-notices.js');
  const slots = [], pending = [];
  let cursor = 0, dirty = false, tree;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (next) => { const value = typeof next === 'function' ? next(slots[index].value) : next; if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; } }];
    },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: { current: initial } }; return slots[index].value; },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, at) => !Object.is(value, previous.deps[at]))) {
        slots[index] = { deps }; pending.push(effect);
      }
    }
  };
  const { code } = await transform(readFileSync(path.join(__dirname, '../components/BusinessToolsPurchaseNoticePanel.js'), 'utf8'), {
    filename: 'BusinessToolsPurchaseNoticePanel.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, target: 'es2020', transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' }
  });
  const modules = {
    react: hooks, '@/contexts/AuthContext': { useAuth: () => ({ refreshSession: async () => {} }) },
    '@/lib/business-tools-notices': helpers,
    '@/lib/api': { api: { businessTools: { plans: { list, updatePurchaseNotice: update } } } }
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => modules[name] || require(name), module, module.exports);
  const render = () => {
    let count = 0;
    do {
      dirty = false; cursor = 0;
      tree = module.exports.BusinessToolsPurchaseNoticePanel({ plan, canManage });
      pending.splice(0).forEach((effect) => effect());
      if (++count > 20) throw new Error('Editor rendered repeatedly');
    } while (dirty);
  };
  const walk = (node) => Array.isArray(node) ? node.flatMap(walk) : React.isValidElement(node) ? [node, ...walk(node.props.children)] : [];
  const nodes = (node = tree) => walk(node);
  const text = (node) => Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text(node.props.children) : node == null || typeof node === 'boolean' ? '' : String(node);
  const by = (predicate) => { const node = nodes().find(predicate); assert.ok(node, 'Editor control not found'); return node; };
  render();
  return {
    field: (label) => by((node) => node.props['aria-label'] === label || (node.type === 'label' && text(node.props.children?.[0]) === label)).props,
    button: (name) => by((node) => node.type === 'button' && text(node) === name).props,
    nodes, text: () => text(tree),
    change(label, value) {
      const labelNode = nodes().find((node) => node.type === 'label' && text(node.props.children?.[0]) === label);
      const control = nodes().find((node) => node.props['aria-label'] === label) || nodes(labelNode).find((node) => ['input', 'textarea'].includes(node.type));
      assert.ok(control, label); control.props.onChange({ target: { value, checked: value } }); render();
    },
    async click(name) {
      by((node) => node.type === 'button' && text(node) === name).props.onClick();
      for (let i = 0; i < 8; i++) { await Promise.resolve(); render(); }
    }
  };
}

test('editor saves FAQ changes for inactive plans and keeps failed drafts without changing saved settings', async () => {
  let fail = true, payload;
  const editor = await noticeEditor({ update: async (code, body) => {
    payload = body; assert.equal(code, faqPlan.code);
    if (fail) throw Object.assign(new Error('Invalid destination'), { status: 400 });
    return { ...faqPlan, ...body, version: 9 };
  } });
  editor.change('English link label (optional)', 'My reviewed FAQ');
  editor.change('Notice audit reason', 'Update reviewed FAQ');
  await editor.click('Save purchase notices & FAQ');
  assert.ok(editor.nodes().some((node) => node.type === 'input' && node.props.value === 'My reviewed FAQ'));
  assert.ok(editor.text().includes('Invalid destination'));
  const savedPreview = editor.nodes().filter((node) => typeof node.type === 'function' && node.props.saved).at(0);
  assert.equal(savedPreview.props.draft.labelEn, faqPlan.purchaseNoticeLink.labelEn);
  fail = false;
  await editor.click('Save purchase notices & FAQ');
  assert.equal(payload.version, 8);
  assert.equal(payload.purchaseNoticeLink.urlFr, faqPlan.purchaseNoticeLink.urlFr);
  assert.ok(editor.text().includes('Purchase notices and FAQ settings saved.'));
  assert.equal(editor.button('Save purchase notices & FAQ').disabled, true);
});

test('editor preserves a conflict draft and requires explicit review before using the newly fetched version', async () => {
  let conflict = true, submitted;
  const latest = { ...faqPlan, version: 9, purchaseNoticeLink: { ...faqPlan.purchaseNoticeLink, labelEn: 'Another administrator’s FAQ' } };
  const editor = await noticeEditor({
    list: async () => [{ ...latest, code: 'OTHER_PLAN' }, latest],
    update: async (_code, body) => { submitted = body; if (conflict) throw Object.assign(new Error('Version changed'), { status: 409 }); return { ...latest, ...body, version: 10 }; }
  });
  editor.change('English link label (optional)', 'My unsaved FAQ');
  editor.change('Notice audit reason', 'Apply reviewed FAQ');
  await editor.click('Save purchase notices & FAQ');
  assert.equal(editor.button('Save purchase notices & FAQ').disabled, true);
  await editor.click('Refresh before retrying');
  assert.equal(editor.button('Save purchase notices & FAQ').disabled, true);
  const previews = editor.nodes().filter((node) => typeof node.type === 'function' && node.props.saved);
  assert.equal(previews[0].props.draft.labelEn, latest.purchaseNoticeLink.labelEn);
  assert.ok(editor.nodes().some((node) => node.type === 'input' && node.props.value === 'My unsaved FAQ'));
  await editor.click('I reviewed the latest settings — keep my draft');
  assert.equal(editor.button('Save purchase notices & FAQ').disabled, false);
  conflict = false;
  await editor.click('Save purchase notices & FAQ');
  assert.equal(submitted.version, 9);
  assert.equal(submitted.purchaseNoticeLink.labelEn, 'My unsaved FAQ');
});

test('read-only and denied editors prevent saving, while old backends retain notice-only edits', async () => {
  const readOnly = await noticeEditor({ canManage: false });
  assert.ok(readOnly.nodes().find((node) => node.type === 'fieldset').props.disabled);
  assert.ok(readOnly.text().includes('Read only'));
  assert.ok(!readOnly.nodes().some((node) => node.type === 'button' && node.props.children === 'Save purchase notices & FAQ'));
  const denied = await noticeEditor({ update: async () => { throw Object.assign(new Error('Super Admin required'), { status: 403 }); } });
  denied.change('Notice audit reason', 'Reviewed change');
  denied.change('Purchase notice (English)', 'Changed benefits');
  await denied.click('Save purchase notices & FAQ');
  assert.ok(denied.nodes().find((node) => node.type === 'fieldset').props.disabled);
  let submitted;
  const oldPlan = { ...faqPlan }; delete oldPlan.purchaseNoticeLink;
  const old = await noticeEditor({ plan: oldPlan, update: async (_code, body) => { submitted = body; return { ...oldPlan, ...body, version: 9 }; } });
  old.change('Purchase notice (English)', 'Benefits without touching a link'); old.change('Notice audit reason', 'Notice only');
  await old.click('Save purchase notices & FAQ');
  assert.equal(Object.hasOwn(submitted, 'purchaseNoticeLink'), false);
});

test('a notice-only conflict does not turn an untouched FAQ into an overwrite of another administrator’s link', async () => {
  let conflict = true, submitted;
  const latest = { ...faqPlan, version: 9, purchaseNoticeLink: { ...faqPlan.purchaseNoticeLink, url: 'https://www.fondeka.com/new-faq', labelEn: 'New published FAQ' } };
  const editor = await noticeEditor({ list: async () => [latest], update: async (_code, body) => {
    submitted = body;
    if (conflict) throw Object.assign(new Error('Plan changed'), { status: 409 });
    return { ...latest, ...body, version: 10 };
  } });
  editor.change('Purchase notice (English)', 'New benefits only');
  editor.change('Notice audit reason', 'Review notice-only update');
  await editor.click('Save purchase notices & FAQ');
  await editor.click('Refresh before retrying');
  assert.ok(editor.nodes().some((node) => node.type === 'input' && node.props.value === latest.purchaseNoticeLink.url));
  await editor.click('I reviewed the latest settings — keep my draft');
  conflict = false;
  await editor.click('Save purchase notices & FAQ');
  assert.equal(submitted.version, 9);
  assert.equal(submitted.purchaseNoticeEn, 'New benefits only');
  assert.equal(Object.hasOwn(submitted, 'purchaseNoticeLink'), false);
});
