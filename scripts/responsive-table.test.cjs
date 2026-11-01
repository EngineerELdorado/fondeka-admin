const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transform } = require('next/dist/build/swc');
const h = React.createElement;
const loadComponent = (file) => transform(readFileSync(path.join(__dirname, '../components', file), 'utf8'), {
  filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, target: 'es2020', transform: { react: { runtime: 'classic' } } }, module: { type: 'commonjs' }
}).then(({ code }) => {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports.default;
});
const component = loadComponent('ResponsiveTable.js');

const loadDataTable = async (regulatorMode = false) => {
  const file = 'DataTable.js';
  const { code } = await transform(readFileSync(path.join(__dirname, '../components', file), 'utf8'), {
    filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, target: 'es2020', transform: { react: { runtime: 'classic' } } }, module: { type: 'commonjs' }
  });
  const load = (name) => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '../lib', name), 'utf8')).toString('base64')}`);
  const modules = {
    '@/components/ResponsiveTable': { __esModule: true, default: await component },
    '@/components/TableActions': { __esModule: true, default: await loadComponent('TableActions.js') },
    '@/contexts/AuthContext': { useAuth: () => ({ enableRegulatorMode: regulatorMode }) },
    '@/lib/regulator-presentation': await load('regulator-presentation.js'),
    '@/lib/table-columns': await load('table-columns.js'),
    'next/link': { __esModule: true, default: ({ children, ...props }) => h('a', props, children) }
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => modules[name] || require(name), module, module.exports);
  return module.exports.DataTable;
};

test('compact action menus retain every action while transaction action text stays a normal value', async () => {
  const Table = await loadDataTable();
  const columns = [{ key: 'reference', label: 'Reference' }, { key: 'action', label: 'Action' }, { key: 'actions', label: 'Actions', render: () => h('div', null, h('button', null, 'View'), h('button', null, 'Edit'), h('button', null, 'Delete')) }];
  const html = renderToStaticMarkup(h(Table, { columns, rows: [{ reference: 'TX-42', action: 'Electricity payment' }], showAccountQuickNav: false }));
  assert.equal((html.match(/class="table-row-actions"/g) || []).length, 1);
  assert.match(html, /<button[^>]+aria-expanded="false"[^>]*>Actions /);
  assert.match(html, /popover="manual" hidden=""/);
  for (const label of ['View', 'Edit', 'Delete']) assert.match(html, new RegExp(`<button>${label}<\\/button>`));
  assert.match(html, /class="data-table__value">Electricity payment<\/div>/);
  assert.equal((html.match(/<th(?:\s|>)/g) || []).length, 4);
});

test('column choices and table values remain subject to regulator presentation filtering', async () => {
  const Table = await loadDataTable(true);
  const html = renderToStaticMarkup(h(Table, { columns: [{ key: 'name', label: 'Name' }, { key: 'cryptoBalance', label: 'Crypto balance' }, { key: 'actions', label: 'Actions', render: () => h('a', { href: '/details' }, 'View') }], rows: [{ name: 'Example', cryptoBalance: 'secret balance' }], showAccountQuickNav: false }));
  assert.doesNotMatch(html, /Crypto balance|secret balance/);
  assert.match(html, /href="\/details">View<\/a>/);
  assert.doesNotMatch(html, /class="table-row-actions"/);
});

test('one visible action stays direct while hidden actions do not create a menu', async () => {
  const Actions = await loadComponent('TableActions.js');
  const html = renderToStaticMarkup(h(Actions, null,
    h('a', { href: '/details' }, 'View'),
    h('div', { hidden: true }, h('button', null, 'Hidden edit')),
    h('button', { style: { display: 'none' } }, 'Hidden delete')));
  assert.doesNotMatch(html, /aria-expanded|popover=/);
  assert.match(html, /href="\/details">View<\/a>/);
  assert.doesNotMatch(renderToStaticMarkup(h(Actions, null, '—')), /<button/);
});

test('multiple actions expose one labelled trigger and retain disabled choices and link destinations', async () => {
  const Actions = await loadComponent('TableActions.js');
  const html = renderToStaticMarkup(h(Actions, null,
    h(React.Fragment, null, h('a', { href: '/details' }, 'View'), h('button', { disabled: true }, 'Delete'))));
  assert.equal((html.match(/aria-expanded="false"/g) || []).length, 1);
  assert.match(html, /aria-controls="[^"]+"/);
  assert.match(html, /popover="manual" hidden=""/);
  assert.match(html, /role="group" aria-label="Row actions"/);
  assert.match(html, /<button disabled="">Delete<\/button>/);
  assert.match(html, /href="\/details">View<\/a>/);
});

test('responsive tables retain native headings, translated text, values, links and controls before enhancement', async () => {
  const Table = await component;
  const html = renderToStaticMarkup(h(Table, { style: { minWidth: '1600px' } },
    h('thead', null, h('tr', null, h('th', null, 'Référence'), h('th', null, 'Montant'), h('th', null, 'Actions'))),
    h('tbody', null, h('tr', null, h('td', null, h('a', { href: '/dashboard/transactions?transactionId=42' }, 'SBX-long-reference')), h('td', null, '0 USD'), h('td', null, h('button', { type: 'button' }, 'Open'), h('input', { defaultValue: 'draft retained' }))))));
  assert.match(html, /role="table"/);
  assert.match(html, /<th>Référence<\/th>/);
  assert.match(html, /<th>Montant<\/th>/);
  assert.match(html, />0 USD</);
  assert.match(html, /href="\/dashboard\/transactions\?transactionId=42"/);
  assert.match(html, /value="draft retained"/);
  assert.match(html, /<button type="button">Open<\/button>/);
  assert.match(html, /min-width:0/);
  assert.doesNotMatch(html, /1600px/);
});

test('conditional and fragment columns stay aligned, and full-width empty or expanded rows are retained', async () => {
  const Table = await component;
  const html = renderToStaticMarkup(h(Table, null,
    h('thead', null, h('tr', null, h(React.Fragment, null, h('th', null, '#'), false, h('th', null, 'Name')), h('th', { 'aria-label': 'Account' }))),
    h('tbody', null, h('tr', null, h('td', null, '1'), false, h('td', null, 'Example business'), h('td', null, '42')), h('tr', null, h('td', { colSpan: 3 }, 'No hidden or discarded details')))));
  assert.equal((html.match(/<th(?:\s|>)/g) || []).length, 3);
  assert.match(html, /<th>#<\/th>/);
  assert.match(html, /<th>Name<\/th>/);
  assert.match(html, /aria-label="Account"/);
  assert.match(html, /colSpan="3">No hidden or discarded details/);
});

test('grouped headings and visibility wrappers retain their original authority', async () => {
  const Table = await component;
  const Visible = ({ visible = true, children }) => visible ? children : null;
  const html = renderToStaticMarkup(h(Table, null,
    h('thead', null, h('tr', null, h('th', { colSpan: 2 }, 'Payment')), h('tr', null, h(Visible, null, h('th', null, 'Amount')), h('th', null, 'Currency'), h(Visible, { visible: false }, h('th', null, 'Restricted field')))),
    h('tbody', null, h(Visible, null, h('tr', null, h('td', null, '10'), h('td', null, 'USD'), h(Visible, { visible: false }, h('td', null, 'Restricted value')))))));
  assert.match(html, /<th colSpan="2">Payment<\/th>/);
  assert.match(html, /<th>Amount<\/th>/);
  assert.match(html, /<td>USD<\/td>/);
  assert.doesNotMatch(html, /Restricted/);
});

test('long transaction statuses preserve the full code and offer breaks between words', async () => {
  const Badge = await loadComponent('TransactionStatusBadge.js');
  const code = 'MANUAL_INTERVENTION_REQUIRED';
  const long = renderToStaticMarkup(h(Badge, { value: code }));
  assert.equal(long.replace(/<[^>]*>/g, ''), code);
  assert.match(long, /title="MANUAL_INTERVENTION_REQUIRED"/);
  assert.match(long, /data-long-status="true"/);
  assert.equal((long.match(/<wbr\/?\s*>/g) || []).length, 2);
  assert.doesNotMatch(renderToStaticMarkup(h(Badge, { value: 'completed' })), /data-long-status/);
  assert.equal(renderToStaticMarkup(h(Badge, { value: null })), '—');
});

test('explicit status column widths survive responsive-table enhancement', async () => {
  const Table = await component;
  const html = renderToStaticMarkup(h(Table, null,
    h('thead', null, h('tr', null, h('th', { style: { width: '19rem' } }, 'Status'))),
    h('tbody', null, h('tr', null, h('td', null, 'MANUAL_INTERVENTION_REQUIRED')))));
  assert.match(html, /width:19rem/);
  assert.match(html, />MANUAL_INTERVENTION_REQUIRED</);
});
