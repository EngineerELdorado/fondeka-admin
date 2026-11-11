const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const React = require('react');
const { mountComponent } = require('./helpers/component-harness.cjs');
const load = (file) => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64')}`);
const row = { id: 8, billProductBillProviderId: 7, name: 'REAL-OFFER', externalReference: 'REAL-EXTERNAL-CODE', displayName: 'Family', price: 0, currency: 'USD', ourPriceInUsd: 0, active: true, promotionEnabled: true, promotionExtraAmountUsd: 2, promotionTargetOfferId: 21, subDisplayNameEn: 'Essential channels', subDisplayNameFr: 'Le bouquet essentiel' };
const nodes = (value) => Array.isArray(value) ? value.flatMap(nodes) : React.isValidElement(value) ? [value, ...nodes(value.props.children)] : [];

test('secondary-copy patches preserve unmodified languages, literal text and independent clearing', async () => {
  const h = await load('lib/bill-catalog-secondary-names.js'), draft = h.billSecondaryNameDraft(row);
  assert.deepEqual(h.billSecondaryNamePayload(draft, row), {});
  const text = ' L’offre <b>Famille</b>\n**Un mois** — https://example.com/?lang=fr ';
  assert.deepEqual(h.billSecondaryNamePayload({ ...draft, subDisplayNameFr: text }, row), { subDisplayNameFr: text });
  assert.deepEqual(h.billSecondaryNamePayload({ ...draft, subDisplayNameFr: '\n \t' }, row), { subDisplayNameFr: null });
  assert.deepEqual(h.billSecondaryNameDraft({ subDisplayName: 'Do not derive this', name: 'INTERNAL', displayName: 'Primary' }), { subDisplayNameEn: '', subDisplayNameFr: '' });
  assert.deepEqual(h.billSecondaryNamePayload(h.billSecondaryNameDraft()), {});
  assert.throws(() => h.billSecondaryNamePayload({ ...draft, subDisplayNameEn: {} }, row));
});

async function catalogue(kind, record = row, { fail = false } = {}) {
  const h = await load('lib/bill-catalog-secondary-names.js'), state = { record: structuredClone(record), writes: [], fail };
  const resource = kind === 'offers' ? 'billProductBillProviderOffers' : 'billProductBillProviderOptions';
  const api = {
    billProductBillProviders: { options: async () => [{ id: 7, billProductName: 'TV Congo', billProviderName: 'CGAWEB' }] },
    [resource]: {
      list: async () => ({ content: [state.record], totalPages: 1, totalElements: 1 }),
      create: async (body) => { state.writes.push({ body }); if (state.fail) throw new Error('Catalogue save failed'); state.record = { id: 8, ...body }; return state.record; },
      update: async (id, body) => { state.writes.push({ id, body }); if (state.fail) throw new Error('Catalogue save failed'); state.record = { ...state.record, ...body }; return state.record; }
    }
  };
  const view = await mountComponent(path.join(__dirname, `../app/(dashboard)/dashboard/bills/${kind}/page.js`), { props: {}, modules: {
    '@/components/CatalogSelect': { CatalogSelect: 'select' }, '@/components/RegulatorPresentation': { PresentationLink: 'a' },
    '@/lib/regulator-presentation': { regulatorVisibleFields: (values) => values }, '@/contexts/AuthContext': { useAuth: () => ({ enableRegulatorMode: false }) },
    '@/lib/api': { api }, '@/components/DataTable': { DataTable: 'data-table' }, '@/lib/bill-catalog-secondary-names': h
  } });
  await view.flush();
  const table = () => view.nodes().find((node) => node.type === 'data-table').props;
  const act = async (label) => { nodes(table().columns.find((column) => column.key === 'actions').render(state.record)).find((node) => node.type === 'button' && node.props.children === label).props.onClick(); await view.flush(); };
  const field = (id) => view.nodes().find((node) => node.props.id === id)?.props;
  const change = async (id, value) => { field(id).onChange({ target: { value } }); await view.flush(); };
  return { view, state, table, act, field, change };
}

test('both catalogue editors send one edited translation without changing mapping, prices, codes or promotions', async () => {
  for (const kind of ['offers', 'options']) {
    const panel = await catalogue(kind); await panel.act('Edit');
    assert.equal(panel.field('subDisplayNameEn').value, row.subDisplayNameEn); assert.equal(panel.field('subDisplayNameFr').value, row.subDisplayNameFr);
    const text = 'L’offre Famille\n1 mois d’abonnement'; await panel.change('subDisplayNameFr', text); await panel.view.click('Save');
    const { id, body } = panel.state.writes[0]; assert.equal(id, 8); assert.equal(body.subDisplayNameFr, text); assert.equal(Object.hasOwn(body, 'subDisplayNameEn'), false);
    for (const key of ['billProductBillProviderId', 'name', 'externalReference', 'displayName', 'price', 'currency', 'ourPriceInUsd', 'active']) assert.equal(body[key], row[key], `${kind}:${key}`);
    if (kind === 'offers') for (const key of ['promotionEnabled', 'promotionExtraAmountUsd', 'promotionTargetOfferId']) assert.equal(body[key], row[key]);
    await panel.act('Edit'); assert.equal(panel.field('subDisplayNameFr').value, text);
  }
});

test('clearing a single language sends null while unrelated edits and active toggles omit both translations', async () => {
  for (const kind of ['offers', 'options']) {
    const clear = await catalogue(kind); await clear.act('Edit'); await clear.change('subDisplayNameEn', ' '); await clear.view.click('Save');
    assert.equal(clear.state.writes[0].body.subDisplayNameEn, null); assert.equal(Object.hasOwn(clear.state.writes[0].body, 'subDisplayNameFr'), false);
    const edit = await catalogue(kind); await edit.act('Edit'); await edit.change('price', '12'); await edit.view.click('Save');
    assert.equal(edit.state.writes[0].body.price, 12); for (const key of ['subDisplayNameEn', 'subDisplayNameFr']) assert.equal(Object.hasOwn(edit.state.writes[0].body, key), false);
    const toggle = await catalogue(kind); nodes(toggle.table().columns.find((column) => column.key === 'active').render(row)).find((node) => node.type === 'input').props.onChange(); await toggle.view.flush();
    assert.equal(toggle.state.writes[0].body.active, false); for (const key of ['subDisplayNameEn', 'subDisplayNameFr']) assert.equal(Object.hasOwn(toggle.state.writes[0].body, key), false);
  }
});

test('new offers and options accept literal bilingual copy alongside required fields and explicit zero price', async () => {
  for (const kind of ['offers', 'options']) {
    const panel = await catalogue(kind); await panel.view.click(kind === 'offers' ? 'Add offer' : 'Add option');
    assert.equal(panel.field('subDisplayNameEn').value, ''); assert.equal(panel.field('subDisplayNameFr').value, '');
    for (const [key, value] of Object.entries({ billProductBillProviderId: '7', name: 'REAL-OPTION', externalReference: 'ACTUAL-PROVIDER-CODE', displayName: 'No extras', price: '0', currency: 'USD', subDisplayNameEn: '<b>Plain text</b>\nOne month', subDisplayNameFr: '1 mois d’abonnement' })) await panel.change(key, value);
    await panel.view.click('Create');
    const body = panel.state.writes[0].body; assert.equal(body.price, 0); assert.equal(body.billProductBillProviderId, 7); assert.equal(body.subDisplayNameEn, '<b>Plain text</b>\nOne month'); assert.equal(body.subDisplayNameFr, '1 mois d’abonnement');
    assert.equal(body.externalReference, 'ACTUAL-PROVIDER-CODE');
  }
});

test('details show both stored translations without adding table columns or interpreting markup', async () => {
  for (const kind of ['offers', 'options']) {
    const literal = '<b>Le bouquet</b>\n**Famille**', panel = await catalogue(kind, { ...row, subDisplayNameFr: literal });
    await panel.act('View');
    const details = panel.view.nodes().find((node) => node.type?.name === 'DetailGrid').props.rows;
    assert.equal(details.find((entry) => entry.label === 'Secondary name (French)').value, literal);
    assert.equal(details.find((entry) => entry.label === 'Secondary name (English)').value, row.subDisplayNameEn);
    assert.ok(!panel.table().columns.some((column) => column.key.startsWith('subDisplayName')));
    assert.ok(!panel.view.nodes().some((node) => node.props.dangerouslySetInnerHTML));
  }
});

test('save failures retain bilingual drafts and expose the error inside the open editor', async () => {
  for (const kind of ['offers', 'options']) {
    const panel = await catalogue(kind, row, { fail: true }); await panel.act('Edit'); await panel.change('subDisplayNameFr', 'Texte conservé'); await panel.view.click('Save');
    assert.equal(panel.field('subDisplayNameFr').value, 'Texte conservé'); assert.equal(panel.field('subDisplayNameEn').value, row.subDisplayNameEn);
    const modal = panel.view.nodes().find((node) => node.props.title === `Edit ${kind === 'offers' ? 'offer' : 'option'} 8`);
    assert.ok(nodes(modal).some((node) => node.props.role === 'alert' && node.props.children === 'Catalogue save failed'));
    panel.state.fail = false; await panel.view.click('Save'); assert.equal(panel.state.writes.at(-1).body.subDisplayNameFr, 'Texte conservé');
  }
});
