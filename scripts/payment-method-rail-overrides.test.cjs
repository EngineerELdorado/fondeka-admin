const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');

const page = path.join(__dirname, '../app/(dashboard)/dashboard/payments/payment-methods/page.js');
const methods = [{ id: 22, displayName: 'M-Pesa' }, { id: 23, displayName: 'Airtel' }];
const payoutKey = 'payment.method.22.payout.enabled';
const collectionKey = 'payment.method.23.collection.enabled';
const walk = (node) => Array.isArray(node) ? node.flatMap(walk) : node?.props ? [node, ...walk(node.props.children)] : [];
const field = (view, label) => view.nodes().find((node) => node.props['aria-label'] === label).props;
const overridesTable = (view) => view.nodes().find((node) => node.type === 'data-table' && node.props.emptyLabel.startsWith('No account overrides'))?.props;
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

async function mount(t, options = {}) {
  const state = { entries: { [payoutKey]: [{ accountId: 7, key: payoutKey, enabled: false }, { accountId: 2, key: payoutKey, enabled: true }] }, reads: [], writes: [], fail: null, ...options };
  const save = async (operation, key, target, body) => {
    state.writes.push({ operation, key, target, body });
    if (state.saveError) throw new Error(state.saveError);
    const accountId = operation.includes('Email') ? 9 : Number(target);
    const entries = (state.entries[key] || []).filter((entry) => entry.accountId !== accountId);
    if (body) entries.push({ accountId, key, enabled: body.enabled });
    state.entries[key] = entries;
  };
  const api = {
    paymentMethods: { list: async () => methods }, countries: { list: async () => [] },
    accounts: { get: async (id) => {
      if (id === 7) throw new Error('Account identity unavailable');
      return { firstName: `Customer ${id}`, lastName: 'Example', email: `customer${id}@example.com` };
    } },
    featureFlags: {
      get: async () => true,
      listOverrides: async (key) => {
        state.reads.push(key);
        if (state.list) return state.list(key);
        if (state.fail) throw new Error(state.fail);
        return structuredClone(state.entries[key] || []);
      },
      upsertOverride: (...args) => save('saveAccount', ...args),
      removeOverride: (...args) => save('removeAccount', ...args),
      upsertOverrideByEmail: (...args) => save('saveEmail', ...args),
      removeOverrideByEmail: (...args) => save('removeEmail', ...args)
    }
  };
  const view = await mountComponent(page, { props: {}, modules: {
    '@/lib/api': { api }, '@/lib/use-catalog-codes': { useCatalogCodes: () => ({ options: [] }) }, '@/lib/crypto-catalog': { CRYPTO_ASSETS: [] },
    '@/components/CountrySelect': { CountrySelect: 'select' }, '@/components/RegulatorPresentation': { PresentationSelect: 'select', PresentationLink: 'a', RegulatorField: 'div' },
    '@/lib/regulator-presentation': { regulatorVisibleFields: (rows) => rows, isRegulatorRestrictedRecord: () => false },
    '@/contexts/AuthContext': { useAuth: () => ({ enableRegulatorMode: false }) },
    '@/components/DataTable': { DataTable: 'data-table' }, '@/lib/payment-method-labels': { paymentMethodAdminLabel: (row) => row.displayName }
  } });
  t.after(() => view.unmount());
  await view.flush();
  return { view, state };
}

async function open(view, row = methods[0], flow = 'payout') {
  const main = view.nodes().find((node) => node.type === 'data-table' && node.props.emptyLabel === 'No payment methods found').props;
  const button = walk(main.columns.find((column) => column.key === `${flow}Gate`).render(row)).find((node) => node.type === 'button');
  button.props.onClick();
  await view.flush();
}

async function change(view, label, value) {
  field(view, label).onChange({ target: { value, checked: value } });
  await view.flush();
}

async function formAction(view, label, form = 0) {
  view.nodes().filter((node) => node.type === 'button' && node.props.children === label)[form].props.onClick();
  await view.flush();
}

test('payout modal loads all saved accounts, retains false, and shows identities with an account-ID fallback', async (t) => {
  const { view, state } = await mount(t);
  assert.deepEqual(state.reads, []);
  await open(view);
  assert.deepEqual(state.reads, [payoutKey]);
  const table = overridesTable(view);
  assert.deepEqual(table.rows.map((row) => row.accountId), [2, 7]);
  assert.equal(table.pageSize, 10);
  assert.match(view.text(), /Existing account overrides \(2\)/);
  const accountColumn = table.columns.find((column) => column.key === 'accountId');
  const links = table.rows.map((row) => walk(accountColumn.render(row)).find((node) => node.type === 'a'));
  assert.equal(links[0].props.children, 'Customer 2 Example');
  assert.equal(links[1].props.children, 'Account 7');
  assert.equal(links[1].props.href, '/dashboard/accounts/accounts/7');
  const setting = table.columns.find((column) => column.key === 'enabled');
  assert.equal(setting.render(table.rows[0]), 'Enabled');
  assert.equal(setting.render(table.rows[1]), 'Disabled');
  assert.deepEqual(state.writes, []);
});

test('editing a listed override populates its saved choice and refreshes after account save/remove', async (t) => {
  const { view, state } = await mount(t);
  await open(view);
  let table = overridesTable(view);
  walk(table.columns.find((column) => column.key === 'actions').render(table.rows[1])).find((node) => node.props.children === 'Edit override').props.onClick();
  await view.flush();
  assert.equal(field(view, 'Override account ID').value, '7');
  assert.equal(field(view, 'Account override enabled').checked, false);
  await change(view, 'Account override enabled', true);
  await formAction(view, 'Set');
  assert.deepEqual(state.writes[0], { operation: 'saveAccount', key: payoutKey, target: '7', body: { enabled: true } });
  assert.equal(overridesTable(view).rows.find((row) => row.accountId === 7).enabled, true);
  await formAction(view, 'Remove');
  assert.deepEqual(overridesTable(view).rows.map((row) => row.accountId), [2]);
  assert.deepEqual(state.reads, [payoutKey, payoutKey, payoutKey]);
});

test('email save/remove refreshes the same account list, including a disabled override', async (t) => {
  const { view, state } = await mount(t);
  await open(view);
  await change(view, 'Override account email', 'customer9@example.com');
  await change(view, 'Email override enabled', false);
  await formAction(view, 'Set', 1);
  assert.deepEqual(state.writes[0], { operation: 'saveEmail', key: payoutKey, target: 'customer9@example.com', body: { enabled: false } });
  assert.equal(overridesTable(view).rows.find((row) => row.accountId === 9).enabled, false);
  await formAction(view, 'Remove', 1);
  assert.equal(overridesTable(view).rows.some((row) => row.accountId === 9), false);
  assert.equal(state.reads.length, 3);
});

test('removing directly from the list targets that row and refreshes without changing other accounts', async (t) => {
  const { view, state } = await mount(t);
  await open(view);
  await change(view, 'Override account ID', '2');
  const table = overridesTable(view);
  const actions = table.columns.find((column) => column.key === 'actions').render(table.rows.find((row) => row.accountId === 7));
  walk(actions).find((node) => node.props.children === 'Remove override').props.onClick();
  await view.flush();
  assert.equal(state.writes[0].operation, 'removeAccount');
  assert.equal(state.writes[0].key, payoutKey);
  assert.equal(state.writes[0].target, '7');
  assert.deepEqual(overridesTable(view).rows.map((row) => row.accountId), [2]);
  assert.deepEqual(state.reads, [payoutKey, payoutKey]);
});

test('loading, failed reads and retry stay distinct from a successful empty list', async (t) => {
  const pending = deferred();
  const { view, state } = await mount(t, { list: () => pending.promise });
  await open(view);
  assert.match(view.text(), /Loading account overrides/);
  assert.equal(overridesTable(view), undefined);
  pending.resolve([]);
  await view.flush();
  assert.equal(overridesTable(view).rows.length, 0);
  state.list = null;
  state.fail = 'Permission denied';
  await view.click('Refresh overrides');
  assert.match(view.text(), /Permission denied/);
  assert.equal(overridesTable(view), undefined);
  state.fail = null;
  await view.click('Refresh overrides');
  assert.equal(overridesTable(view).rows.length, 2);
});

test('a late response from another method cannot replace the current collection overrides', async (t) => {
  const pending = deferred();
  const entry = { accountId: 9, key: collectionKey, enabled: false };
  const { view, state } = await mount(t, { list: (key) => key === payoutKey ? pending.promise : [entry] });
  await open(view);
  await view.click('Close');
  await open(view, methods[1], 'collection');
  assert.deepEqual(overridesTable(view).rows.map((row) => row.accountId), [9]);
  pending.resolve([{ accountId: 100, key: payoutKey, enabled: true }]);
  await view.flush();
  assert.deepEqual(overridesTable(view).rows.map((row) => row.accountId), [9]);
  assert.deepEqual(state.reads, [payoutKey, collectionKey]);
});

test('a rejected mutation preserves the saved list and displays the save error', async (t) => {
  const { view, state } = await mount(t, { saveError: 'Update refused' });
  await open(view);
  await change(view, 'Override account ID', '7');
  await formAction(view, 'Set');
  assert.match(view.text(), /Update refused/);
  assert.equal(overridesTable(view).rows.find((row) => row.accountId === 7).enabled, false);
  assert.deepEqual(state.reads, [payoutKey]);
});
