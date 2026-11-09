const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const React = require('react');
const { mountComponent } = require('./helpers/component-harness.cjs');
const roles = ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT', 'STAFF'];
const session = (role) => ({ tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } });
const nodes = (value) => Array.isArray(value) ? value.flatMap(nodes) : React.isValidElement(value) ? [value, ...nodes(value.props.children)] : [];
const purchase = { id: '11111111-1111-4111-8111-111111111111', accountId: 12, tool: 'API', status: 'COMPLETED', currency: 'USD', amount: 10 };

test('Business Tools customers stays in the menu for every admin role without opening restricted admin menus', async () => {
  const refreshSession = async () => {};
  for (const role of roles) {
    const view = await mountComponent(path.join(__dirname, '../app/(dashboard)/dashboard/layout.js'), {
      props: { children: null }, modules: {
        'next/link': { __esModule: true, default: 'a' },
        'next/navigation': { useRouter: () => ({}), usePathname: () => '/dashboard' },
        '@/contexts/AuthContext': { PreservedAdminPresentation: 'div', useAuth: () => ({ isAuthenticated: true, initialized: true, loading: false, refreshSession, session: session(role), adminProfile: { enableRegulatorMode: false }, enableRegulatorMode: false }) },
        '@/contexts/LocaleContext': { useLocale: () => ({ locale: 'en', t: (key) => key }) },
        '@/components/RegulatorPresentation': { RegulatorRouteBoundary: 'div' },
        '@/lib/regulator-presentation': { isRegulatorRestrictedRoute: () => false },
        '@/lib/business-api-sandbox': { canReadSandboxHistory: () => false }
      }
    });
    await view.flush();
    const links = view.nodes().filter((node) => node.type === 'a').map((node) => node.props.href);
    assert.ok(links.includes('/dashboard/businesses/customers'), role);
    assert.equal(links.includes('/dashboard/admins'), ['ADMIN', 'SUPER_ADMIN'].includes(role));
    assert.equal(links.includes('/dashboard/payout-failover'), ['ADMIN', 'SUPER_ADMIN'].includes(role));
    view.unmount();
  }
});

async function directory(role, customSession) {
  const reads = [], writes = [];
  const api = { businessTools: {
    subscribers: {
      list: async () => { reads.push('subscribers'); return { content: [{ account: { accountId: 12, name: 'Customer' } }], totalElements: 1, totalPages: 1 }; },
      get: async (id) => { reads.push(`subscriber:${id}`); return { account: { accountId: id }, entitlements: [] }; }
    },
    purchases: {
      list: async () => { reads.push('purchases'); return { content: [purchase], totalElements: 1, totalPages: 1 }; },
      get: async (id) => { reads.push(`purchase:${id}`); return purchase; },
      reconcile: async () => writes.push('reconcile'), refundToWallet: async () => writes.push('refund')
    }
  } };
  const view = await mountComponent(path.join(__dirname, '../app/(dashboard)/dashboard/businesses/customers/page.js'), {
    props: {}, modules: {
      '@/components/CountrySelect': { CountrySelect: 'select' }, '@/components/ResponsiveTable': { __esModule: true, default: 'table' },
      '@/components/DataTable': { DataTable: 'data-table' }, '@/components/TableCell': { __esModule: true, default: 'span', TableCellLines: 'span' },
      '@/components/RegulatorPresentation': { RegulatorRecord: 'div', PresentationSelect: 'select', NonRegulatorContent: 'div', PresentationLink: 'a', RegulatorField: 'div' },
      '@/lib/regulator-presentation': { isRegulatorRestrictedRecord: () => false },
      '@/contexts/AuthContext': { useAuth: () => ({ session: customSession || session(role) }) }, '@/lib/api': { api }
    }
  });
  await view.flush();
  return { view, reads, writes, table: () => view.nodes().find((node) => node.type === 'data-table')?.props };
}

test('all admin roles can load customer and purchase lists and open their details', async () => {
  for (const role of roles) {
    const panel = await directory(role);
    assert.deepEqual(panel.reads, ['subscribers'], role);
    let actions = nodes(panel.table().columns.find((column) => column.key === 'actions').render(panel.table().rows[0]));
    actions.find((node) => node.type === 'button' && node.props.children === 'Details').props.onClick();
    await panel.view.flush(); assert.ok(panel.reads.includes('subscriber:12'));
    await panel.view.click('Purchase ledger');
    actions = nodes(panel.table().columns.find((column) => column.key === 'actions').render(purchase));
    const labels = actions.filter((node) => node.type === 'button').map((node) => node.props.children);
    assert.deepEqual(labels, role === 'SUPER_ADMIN' ? ['Details', 'Reconcile', 'Refund'] : ['Details'], role);
    actions.find((node) => node.type === 'button' && node.props.children === 'Details').props.onClick();
    await panel.view.flush(); assert.ok(panel.reads.includes(`purchase:${purchase.id}`));
    const detailButtons = panel.view.nodes().filter((node) => node.type === 'button').map((node) => node.props.children);
    assert.equal(detailButtons.includes('Reconcile'), role === 'SUPER_ADMIN');
    assert.equal(detailButtons.includes('Refund to wallet'), role === 'SUPER_ADMIN');
    assert.deepEqual(panel.writes, []);
    panel.view.unmount();
  }
});

test('customer and unknown roles cannot query the directory', async () => {
  for (const role of ['CUSTOMER', '', 'OTHER']) {
    const panel = await directory(role);
    assert.match(panel.view.text(), /admin account is required/);
    assert.equal(panel.table(), undefined); assert.deepEqual(panel.reads, []); assert.deepEqual(panel.writes, []);
  }
});

test('directory readers also resolve admin groups from the ID token and comma-separated claims', async () => {
  const panel = await directory(null, { tokens: { idToken: { payload: { groups: ' staff , assistant ' } } } });
  assert.deepEqual(panel.reads, ['subscribers']); assert.ok(panel.table()); assert.deepEqual(panel.writes, []);
});
