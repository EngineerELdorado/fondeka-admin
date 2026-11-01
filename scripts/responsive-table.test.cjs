const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transform } = require('next/dist/build/swc');
const h = React.createElement;
const component = transform(readFileSync(path.join(__dirname, '../components/ResponsiveTable.js'), 'utf8'), {
  filename: 'ResponsiveTable.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, target: 'es2020', transform: { react: { runtime: 'classic' } } }, module: { type: 'commonjs' }
}).then(({ code }) => {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports.default;
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
