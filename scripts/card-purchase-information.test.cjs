const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const root = path.join(__dirname, '..');
const helpers = import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(root, 'lib/card-purchase-information.js'), 'utf8')).toString('base64')}`);

async function mountMappingPage(t, api) {
  const view = await mountComponent(path.join(root, 'app/(dashboard)/dashboard/cards/product-providers/page.js'), { modules: {
    '@/lib/api': { api }, '@/lib/card-purchase-information': await helpers,
    '@/components/cards/CardPurchaseInformationFields': { __esModule: true, default: 'purchase-information-fields' },
    '@/components/fees/CardOperationFeeNotice': { __esModule: true, default: 'fee-notice' },
    '@/components/DataTable': { DataTable: 'data-table' }, '@/components/TableActions': { __esModule: true, default: 'table-actions' },
    '@/components/ResponsiveTable': { __esModule: true, default: 'responsive-table' },
    '@/contexts/AuthContext': { useAuth: () => ({ enableRegulatorMode: false }) },
    '@/components/RegulatorPresentation': { PresentationLink: 'a', RegulatorField: 'div', RegulatorRecord: 'div' },
    '@/lib/regulator-presentation': { regulatorVisibleFields: rows => rows }
  } });
  t.after(() => view.unmount()); await view.flush();
  return view;
}

test('all twelve localized sections round-trip independently, retaining commas, Unicode, line breaks and point order', async () => {
  const h = await helpers;
  const row = { notesEn: 'Existing notes', price: 10, issuerBankName: '  Example Bank  ' };
  for (const field of h.PURCHASE_INFORMATION_FIELDS) for (const language of h.PURCHASE_INFORMATION_LANGUAGES) {
    row[field.name + language.suffix] = field.list ? ['  Épargne, achats\nDeuxième ligne  ', ' Second point '] : '  Frais d’aujourd’hui\nAutre ligne  ';
  }
  const draft = h.purchaseInformationDraft(row), payload = h.purchaseInformationPayload(draft);
  assert.equal(Object.keys(payload).length, 14);
  assert.equal(payload.issuerBankName, 'Example Bank');
  assert.equal(payload.cardCountryCode, '');
  assert.equal(h.purchaseInformationPayload({ ...draft, cardCountryCode: ' us ' }).cardCountryCode, 'US');
  assert.throws(() => h.purchaseInformationPayload({ ...draft, cardCountryCode: 'USA' }), /two-letter/);
  for (const field of h.PURCHASE_INFORMATION_FIELDS) for (const language of h.PURCHASE_INFORMATION_LANGUAGES) {
    assert.deepEqual(payload[field.name + language.suffix], field.list ? ['Épargne, achats\nDeuxième ligne', 'Second point'] : 'Frais d’aujourd’hui\nAutre ligne');
  }
  draft.prosEn.push('English only');
  assert.equal(row.prosEn.length, 2); assert.equal(draft.prosFr.length, 2);
  assert.equal(row.notesEn, 'Existing notes'); assert.equal(row.price, 10);
});

test('empty optional fields clear copy explicitly and oversized or malformed information is rejected before saving', async () => {
  const h = await helpers, draft = h.purchaseInformationDraft({});
  const payload = h.purchaseInformationPayload(draft);
  assert.deepEqual(payload.prosEn, []); assert.equal(payload.feesNoticeEn, ''); assert.equal(payload.issuerBankName, '');
  assert.throws(() => h.purchaseInformationPayload({ ...draft, issuerBankName: 'x'.repeat(256) }), /255 characters/);
  assert.throws(() => h.purchaseInformationPayload({ ...draft, prosEn: Array(21).fill('Point') }), /20 points/);
  assert.throws(() => h.purchaseInformationPayload({ ...draft, consFr: ['x'.repeat(501)] }), /500 characters/);
  assert.throws(() => h.purchaseInformationPayload({ ...draft, idealForEn: [false] }), /text points/);
  assert.throws(() => h.purchaseInformationPayload({ ...draft, idealForFr: [null] }), /text points/);
  assert.throws(() => h.purchaseInformationPayload({ ...draft, prosEn: ['First', ' \n '] }), /remove the empty point/);
  assert.throws(() => h.purchaseInformationPayload({ ...draft, feesNoticeFr: 'x'.repeat(4001) }), /4000 characters/);
  assert.equal(h.purchaseInformationDetails({ prosEn: ['First', 'Second'] }).find(row => row.label === 'Pros (English)').value, '• First\n• Second');
});

test('the editor keeps translations separate and preserves multiline bullet content while adding and removing points', async t => {
  const h = await helpers;
  const props = { value: h.purchaseInformationDraft({ prosFr: ['Français à conserver'] }) };
  props.onChange = next => { props.value = typeof next === 'function' ? next(props.value) : next; };
  const view = await mountComponent(path.join(root, 'components/cards/CardPurchaseInformationFields.js'), {
    props, modules: { '@/lib/card-purchase-information': h }
  }); t.after(() => view.unmount());
  view.nodes().find(node => node.props.id === 'issuerBankName').props.onChange({ target: { value: 'Example Bank' } }); await view.flush();
  assert.equal(props.value.issuerBankName, 'Example Bank');
  await view.click('Add pros point (English)');
  view.nodes().find(node => node.props.id === 'prosEn-0').props.onChange({ target: { value: 'New point\nSecond line' } }); await view.flush();
  assert.deepEqual(props.value.prosEn, ['New point\nSecond line']); assert.deepEqual(props.value.prosFr, ['Français à conserver']);
  view.nodes().find(node => node.props.id === 'feesNoticeFr').props.onChange({ target: { value: 'Frais à vérifier' } }); await view.flush();
  assert.equal(props.value.feesNoticeFr, 'Frais à vérifier'); assert.equal(props.value.feesNoticeEn, '');
  view.nodes().find(node => node.props['aria-label'] === 'Remove Pros point 1 (English)').props.onClick(); await view.flush();
  assert.deepEqual(h.purchaseInformationPayload(props.value).prosEn, []);
  assert.deepEqual(props.value.prosFr, ['Français à conserver']);
});

test('the real purchase editor submits its fields alongside existing pricing, operation fees, notes and metadata', async t => {
  const h = await helpers, writes = [];
  const row = { id: 3, cardProductId: 1, cardProviderId: 2, currency: 'USD', providerCurrency: 'USD', purchaseCost: 1,
    price: 10, active: false, inStock: false, fundCardFeePercentage: 2, minFundCardFeeAmount: 1.2,
    withdrawFromCardFeePercentage: 0, minWithdrawFromCardFeeAmount: 0, description: 'Existing metadata',
    issuerBankName: 'Example Bank', cardCountry: { name: 'United States', code: 'US', alpha3Code: 'USA', displayName: 'United States' }, notesEn: 'Old notes', prosEn: ['English'], prosFr: ['Français'], feesNoticeEn: 'Fees' };
  let refuseSave = true;
  const api = {
    cardProductCardProviders: { list: async () => [row], metadataDefaults: async () => ({}), update: async (id, body) => {
      writes.push({ id, body });
      if (refuseSave) throw new Error('The mapping could not be saved. Try again.');
      return body;
    } },
    countries: { options: async () => { throw new Error('Country lookup unavailable'); } },
    cardProducts: { list: async () => [] }, cardProviders: { list: async () => [] }
  };
  const view = await mountMappingPage(t, api);
  const table = view.nodes().find(node => node.type === 'data-table');
  const actions = table.props.columns.find(column => column.key === 'actions').render(row);
  actions.props.children.find(node => node?.props?.children === 'Edit').props.onClick(); await view.flush();
  const editor = () => view.nodes().find(node => node.type === 'purchase-information-fields');
  assert.deepEqual(editor().props.value.prosFr, ['Français']);
  assert.match(editor().props.countriesError, /current selection is retained/);
  const editorProps = { ...editor().props };
  const fields = await mountComponent(path.join(root, 'components/cards/CardPurchaseInformationFields.js'), {
    props: editorProps, modules: { '@/lib/card-purchase-information': h }
  }); t.after(() => fields.unmount());
  const change = async (id, value) => {
    fields.nodes().find(node => node.props.id === id).props.onChange({ target: { value } });
    await view.flush(); Object.assign(editorProps, editor().props); await fields.flush();
  };
  await change('issuerBankName', 'Confirmed bank');
  await change('prosEn-0', 'New English, verified\nSecond line');
  await change('feesNoticeEn', '');
  await view.click('Save');
  assert.ok(view.nodes().some(node => node.props.role === 'alert' && /could not be saved/.test(node.props.children)));
  assert.equal(editor().props.value.issuerBankName, 'Confirmed bank');
  refuseSave = false;
  await view.click('Save');
  assert.equal(writes[0].body.issuerBankName, 'Confirmed bank');
  assert.equal(writes[0].body.cardCountryCode, 'US');
  assert.equal(writes.length, 2); assert.equal(writes[0].id, 3);
  assert.deepEqual(writes[1], writes[0]);
  assert.deepEqual(writes[0].body.prosEn, ['New English, verified\nSecond line']); assert.deepEqual(writes[0].body.prosFr, ['Français']);
  assert.equal(writes[0].body.feesNoticeEn, ''); assert.equal(writes[0].body.price, 10); assert.equal(writes[0].body.notesEn, 'Old notes');
  for (const key of ['fundCardFeePercentage', 'minFundCardFeeAmount', 'withdrawFromCardFeePercentage', 'minWithdrawFromCardFeeAmount', 'description', 'active', 'inStock']) {
    assert.equal(writes[0].body[key], row[key], key);
  }
  assert.equal(editor(), undefined);
});

test('create starts with unconfigured purchase information and rejects empty points without losing the draft', async t => {
  const writes = [], data = async () => [];
  const view = await mountMappingPage(t, {
    cardProductCardProviders: { list: data, metadataDefaults: async () => ({}), create: async body => writes.push(body) },
    countries: { options: async () => [{ id: 1, alpha2Code: 'US', name: 'United States' }] },
    cardProducts: { list: data }, cardProviders: { list: data }
  });
  await view.click('Add mapping');
  const editor = () => view.nodes().find(node => node.type === 'purchase-information-fields');
  assert.equal(editor().props.value.issuerBankName, '');
  assert.equal(editor().props.value.cardCountryCode, '');
  assert.deepEqual(editor().props.value.prosEn, []);
  for (const [id, value] of Object.entries({ cardProductId: '1', cardProviderId: '2', currency: 'USD', price: '10', purchaseCost: '1' })) {
    view.nodes().find(node => node.props.id === id).props.onChange({ target: { value } }); await view.flush();
  }
  editor().props.onChange(previous => ({ ...previous, prosEn: [' '], prosFr: ['Texte confirmé'] })); await view.flush();
  await view.click('Create');
  assert.equal(writes.length, 0);
  assert.ok(view.nodes().some(node => node.props.role === 'alert' && /empty point/.test(node.props.children)));
  assert.deepEqual(editor().props.value.prosFr, ['Texte confirmé']);
  editor().props.onChange(previous => ({ ...previous, prosEn: [], issuerBankName: 'Confirmed bank', cardCountryCode: 'US' })); await view.flush();
  await view.click('Create');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].issuerBankName, 'Confirmed bank');
  assert.equal(writes[0].cardCountryCode, 'US');
  assert.deepEqual(writes[0].prosEn, []);
  assert.deepEqual(writes[0].prosFr, ['Texte confirmé']);
  assert.equal(writes[0].cardProductId, 1); assert.equal(writes[0].price, 10);
});

test('view displays configured purchase information as literal text with line breaks', async t => {
  const data = async () => [], row = { id: 3, issuerBankName: 'Configured bank', cardCountry: { code: 'US', displayName: 'États-Unis' },
    prosEn: ['<b>Literal text</b>\nSecond line', 'Next point'], feesNoticeFr: '**Frais**\nÀ vérifier' };
  const view = await mountMappingPage(t, {
    cardProductCardProviders: { list: async () => [row], metadataDefaults: async () => ({}) },
    countries: { options: data }, cardProducts: { list: data }, cardProviders: { list: data }
  });
  const table = view.nodes().find(node => node.type === 'data-table');
  const actions = table.props.columns.find(column => column.key === 'actions').render(row);
  actions.props.children.find(node => node?.props?.children === 'View').props.onClick(); await view.flush();
  const details = view.nodes().find(node => node.type?.name === 'DetailGrid').props.rows;
  const value = label => details.find(item => item.label === label).value;
  assert.equal(value('Issuing bank').props.children, 'Configured bank');
  assert.equal(value('Issuing country').props.children, 'États-Unis');
  assert.equal(value('Pros (English)').props.children, '• <b>Literal text</b>\nSecond line\n• Next point');
  assert.equal(value('Pros (English)').props.style.whiteSpace, 'pre-wrap');
  assert.equal(value('Fees notice (French)').props.children, '**Frais**\nÀ vérifier');
});


test('issuing-country selection retains configured values during lookup failures and supports changing or clearing explicitly', async t => {
  const h = await helpers;
  const props = { value: h.purchaseInformationDraft({ cardCountry: { code: 'US' }, prosFr: ['Français'] }), countries: [] };
  props.onChange = next => { props.value = typeof next === 'function' ? next(props.value) : next; };
  const view = await mountComponent(path.join(root, 'components/cards/CardPurchaseInformationFields.js'), {
    props, modules: { '@/lib/card-purchase-information': h }
  }); t.after(() => view.unmount());
  const select = () => view.nodes().find(node => node.props.id === 'cardCountryCode');
  assert.ok(view.nodes().some(node => node.type === 'option' && node.props.value === 'US'));
  assert.equal(h.purchaseInformationPayload(props.value).cardCountryCode, 'US');
  props.countries = [{ alpha2Code: 'US', name: 'United States' }, { alpha2Code: 'FR', name: 'France' }]; await view.flush();
  select().props.onChange({ target: { value: 'FR' } }); await view.flush();
  assert.equal(h.purchaseInformationPayload(props.value).cardCountryCode, 'FR');
  assert.deepEqual(props.value.prosFr, ['Français']);
  select().props.onChange({ target: { value: '' } }); await view.flush();
  assert.equal(h.purchaseInformationPayload(props.value).cardCountryCode, '');
});
