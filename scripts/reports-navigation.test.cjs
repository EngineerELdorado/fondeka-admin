const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const root = path.join(__dirname, '..');

test('Reports submenu is limited to report roles, expands on report routes, and marks the selected report', async t => {
  const refreshSession = async () => {};
  for (const role of ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT', 'STAFF', 'CUSTOMER']) {
    const view = await mountComponent(path.join(root, 'app/(dashboard)/dashboard/layout.js'), {
      props: { children: null }, modules: {
        'next/link': { __esModule: true, default: 'a' },
        'next/navigation': { useRouter: () => ({}), usePathname: () => '/dashboard/reports/expenses' },
        '@/contexts/AuthContext': { PreservedAdminPresentation: 'div', useAuth: () => ({ isAuthenticated: true, initialized: true, loading: false, refreshSession, session: { tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } }, adminProfile: { role, enableRegulatorMode: false }, enableRegulatorMode: false }) },
        '@/contexts/LocaleContext': { useLocale: () => ({ locale: 'en', t: key => key }) },
        '@/components/RegulatorPresentation': { RegulatorRouteBoundary: 'div' },
        '@/lib/regulator-presentation': { isRegulatorRestrictedRoute: () => false },
        '@/lib/business-api-sandbox': { canReadSandboxHistory: () => false },
        './navigation.module.css': { __esModule: true, default: {} }
      }
    }); t.after(() => view.unmount()); await view.flush();
    const allowed = ['ADMIN', 'SUPER_ADMIN'].includes(role);
    const toggle = () => view.nodes().find(node => node.props['aria-controls'] === 'reports-submenu');
    assert.equal(Boolean(toggle()), allowed, role);
    const links = () => view.nodes().filter(node => node.type === 'a' && node.props.href?.startsWith('/dashboard/reports/'));
    if (!allowed) { assert.equal(links().length, 0); continue; }
    assert.equal(toggle().props['aria-expanded'], true);
    assert.deepEqual(links().map(node => node.props.href), ['/dashboard/reports/revenue', '/dashboard/reports/expenses', '/dashboard/reports/assets']);
    assert.equal(links()[1].props['aria-current'], 'page');
    toggle().props.onClick(); await view.flush(); assert.equal(links().length, 0);
    toggle().props.onClick(); await view.flush(); assert.equal(links().length, 3);
  }
});

test('dedicated report pages reuse the matching export flow, localize labels and deny other roles', async t => {
  for (const kind of ['revenue', 'expenses', 'assets']) for (const role of ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT', 'STAFF']) {
    const view = await mountComponent(path.join(root, 'components/ReportsPage.js'), { props: { kind }, modules: {
      'next/link': { __esModule: true, default: 'a' },
      '@/contexts/AuthContext': { useAuth: () => ({ adminProfile: { id: 1, role } }) },
      '@/contexts/LocaleContext': { useLocale: () => ({ locale: 'fr' }) },
      '@/components/RevenueReportExport': { __esModule: true, default: 'revenue-export' },
      '@/components/ExpenseReportExport': { __esModule: true, default: 'expense-export' },
      '@/components/AssetReportExport': { __esModule: true, default: 'asset-export' }
    } }); t.after(() => view.unmount());
    const exports = view.nodes().filter(node => ['revenue-export', 'expense-export', 'asset-export'].includes(node.type));
    if (['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      assert.deepEqual(exports.map(node => node.type), [kind === 'revenue' ? 'revenue-export' : kind === 'assets' ? 'asset-export' : 'expense-export']);
      assert.match(view.text(), kind === 'revenue' ? /Rapports de revenus/ : kind === 'assets' ? /Rapports de valorisation des actifs/ : /Rapports de dépenses/);
      if (kind === 'assets') assert.ok(view.nodes().some(node => node.props.href === '/dashboard/assets'));
      if (kind === 'expenses') assert.ok(view.nodes().some(node => node.props.href === '/dashboard/expenses'));
    } else { assert.equal(exports.length, 0); assert.match(view.text(), /accès administrateur/); }
  }
});
