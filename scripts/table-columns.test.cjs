const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const load = () => import(`data:text/javascript;base64,${Buffer.from(readFileSync(path.join(__dirname, '../lib/table-columns.js'), 'utf8')).toString('base64')}`);

test('desktop columns fit without shrinking text and keep identity, status and actions ahead of metadata', async () => {
  const { fitTableColumns, tableColumnWidth } = await load();
  const columns = [
    { key: 'createdAt' }, { key: 'reference', priority: 0 },
    { key: 'status', priority: 0, width: '19rem' },
    { key: 'amount', priority: 1 }, { key: 'paymentMethodName' },
    { key: 'customer' }, { key: 'actions', width: '6rem' }
  ];
  const fitted = fitTableColumns(columns, 50);
  assert.deepEqual(fitted.map(({ key }) => key), ['reference', 'status', 'amount', 'actions']);
  assert.ok(fitted.reduce((total, column) => total + tableColumnWidth(column), 0) <= 50);
  assert.deepEqual(columns.map(({ key }) => key), ['createdAt', 'reference', 'status', 'amount', 'paymentMethodName', 'customer', 'actions']);
  assert.deepEqual(fitTableColumns(columns, 100), columns);
});

test('phone layouts retain all fields and column filtering keeps original rendering and permission metadata', async () => {
  const { fitTableColumns } = await load();
  const render = (row) => row.name;
  const columns = [{ key: 'name', render }, { key: 'status' }, { key: 'balance', regulatorRestricted: true }, { key: 'actions' }];
  assert.equal(fitTableColumns(columns, null), columns);
  assert.equal(fitTableColumns(columns, 22), columns);
  assert.equal(fitTableColumns(columns, 40)[0], columns[0]);
  assert.equal(fitTableColumns(columns, 40)[0].render, render);
});

test('width hints respect wide statuses and compact navigation columns', async () => {
  const { tableColumnWidth } = await load();
  assert.equal(tableColumnWidth({ key: 'status', width: '19rem' }), 19);
  assert.equal(tableColumnWidth({ key: 'amount', width: '160px' }), 10);
  assert.equal(tableColumnWidth({ key: '__account_quick_nav__' }), 3.5);
  assert.equal(tableColumnWidth({ key: 'actions' }), 6);
  assert.equal(tableColumnWidth({ key: 'action' }), 12);
});
