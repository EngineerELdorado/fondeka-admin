const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');
const filename = path.join(__dirname, '../app/(dashboard)/dashboard/page.js');
const walk = (node) => Array.isArray(node) ? node.flatMap(walk) : node?.props ? [node, ...walk(node.props.children)] : [];
const text = (node) => Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : node == null || typeof node === 'boolean' ? '' : String(node);

async function fixture(t, french = false) {
  const originalInterval = global.setInterval, originalClear = global.clearInterval;
  global.setInterval = () => 1; global.clearInterval = () => {};
  let view;
  t.after(() => { view?.unmount(); global.setInterval = originalInterval; global.clearInterval = originalClear; });
  const labels = { 'dashboard.providerFees': french ? 'Frais fournisseur' : 'Provider fees', 'dashboard.completed': 'Completed', 'dashboard.grossProfit': 'Gross profit', 'dashboard.netRevenue': french ? 'Revenu net' : 'Net Revenue', 'dashboard.completedBreakdownTitle': 'Completed transactions' };
  const state = { queries: [], response: { totals: { revenue: 100, referralCost: 10, completedCount: 5 }, timeseries: [{ date: '2026-11-01', providerFees: '2.25' }, { date: '2026-11-02', providerFees: 1.5 }, { date: '2026-11-03', providerFees: 0 }] } };
  const emptyOptions = { options: async () => [], list: async () => [] };
  view = await mountComponent(filename, { modules: {
    '@/lib/api': { api: { getDashboard: async (query) => { state.queries.push(new URLSearchParams(query)); return structuredClone(state.response); }, transactions: { fundedStuckReport: async () => ({}) }, paymentMethods: emptyOptions, paymentProviders: emptyOptions, billProducts: emptyOptions, billProviders: emptyOptions, countries: emptyOptions } },
    '@/contexts/LocaleContext': { useLocale: () => ({ t: (key) => labels[key] || key }) }, '@/contexts/AuthContext': { useAuth: () => ({ enableRegulatorMode: false }) },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/components/CountrySelect': { CountrySelect: 'country-select' }, '@/components/TableActions': { __esModule: true, default: 'table-actions' }, '@/components/ResponsiveTable': { __esModule: true, default: 'table' }, '@/components/CatalogSelect': { CatalogSelect: 'catalog-select' },
    '@/components/RegulatorOverview': { RegulatorOverview: 'regulator-overview' }, '@/components/RevenueReportExport': { __esModule: true, default: 'revenue-report' }, '@/lib/payment-method-labels': { paymentMethodAdminLabel: (row) => row.name },
    recharts: Object.fromEntries(['ResponsiveContainer', 'LineChart', 'Line', 'BarChart', 'Bar', 'CartesianGrid', 'XAxis', 'YAxis', 'Tooltip', 'Legend'].map((name) => [name, name]))
  } });
  await view.flush();
  const card = (label) => view.nodes().find((node) => node.props.className === 'dashboard-kpi-grid').props.children.find((node) => node.key === label);
  const value = (label) => walk(card(label)).find((node) => node.props.style?.fontSize === 'var(--font-stat)').props.children;
  return { view, state, card, value, labels };
}

test('provider costs are restored in the summary, trend and completed detail using the same filtered USD values', async (t) => {
  const f = await fixture(t);
  assert.equal(f.value('Provider fees'), '$3.75');
  assert.equal(f.value('Gross profit'), '$100.00'); assert.equal(f.value('Net Revenue'), '$90.00');
  const line = f.view.nodes().find((node) => node.type === 'Line' && node.props.dataKey === 'providerFees');
  assert.equal(line.props.name, 'Provider fees'); assert.equal(line.props.yAxisId, 'left');
  const chart = f.view.nodes().find((node) => node.type === 'LineChart');
  assert.deepEqual(chart.props.data.map((point) => point.providerFees), ['2.25', 1.5, 0]);
  const tooltip = walk(chart.props.children).find((node) => node.type === 'Tooltip');
  assert.deepEqual(tooltip.props.formatter(2.25, line.props.name), ['$2.25', 'Provider fees']);
  f.card('Completed').props.onClick(); await f.view.flush();
  const detail = f.view.nodes().find((node) => node.props.title === 'Completed transactions');
  const providerRow = walk(detail.props.children).find((node) => node.key === 'Provider fees');
  assert.equal(text(providerRow), 'Provider fees$3.75');
});

test('applying another provider filter recalculates the card from the refreshed response and retains explicit zero', async (t) => {
  const f = await fixture(t);
  await f.view.click('common.showFilters');
  f.view.nodes().find((node) => node.props.id === 'paymentProviderId').props.onChange({ target: { value: '8' } });
  await f.view.flush();
  f.state.response.timeseries = [{ date: '2026-11-03', providerFees: '0' }];
  await f.view.click('dashboard.applyFilters');
  assert.equal(f.state.queries.at(-1).get('paymentProviderId'), '8');
  assert.equal(f.value('Provider fees'), '$0.00');
  assert.equal(f.value('Net Revenue'), '$90.00');
});

test('French provider-cost labels format the chart tooltip as USD too', async (t) => {
  const f = await fixture(t, true);
  assert.equal(f.value('Frais fournisseur'), '$3.75');
  const chart = f.view.nodes().find((node) => node.type === 'LineChart');
  const tooltip = walk(chart.props.children).find((node) => node.type === 'Tooltip');
  assert.deepEqual(tooltip.props.formatter(1.5, 'Frais fournisseur'), ['$1.50', 'Frais fournisseur']);
  assert.equal(f.value('Revenu net'), '$90.00');
  assert.deepEqual(tooltip.props.formatter(90, 'Revenu net'), ['$90.00', 'Revenu net']);
});

test('every financial breakdown table shows its own provider fees and uses the Net Revenue label', async (t) => {
  const f = await fixture(t);
  const tables = f.view.nodes().filter((node) => node.props.columns?.some((column) => column.key === 'netRevenue'));
  assert.equal(tables.length, 8);
  for (const table of tables) {
    const fees = table.props.columns.find((column) => column.key === 'providerFees');
    const revenue = table.props.columns.find((column) => column.key === 'netRevenue');
    assert.equal(fees.label, 'Provider fees');
    assert.equal(fees.render({ providerFees: '12.34' }), '$12.34');
    assert.equal(fees.render({ providerFees: 0 }), '$0.00');
    assert.equal(fees.render({}), '—');
    assert.equal(revenue.label, 'Net Revenue');
    assert.equal(revenue.render({ revenue: 20, referralCost: 2, providerFees: 7 }), '$18.00');
  }
  const line = f.view.nodes().find((node) => node.type === 'Line' && node.props.dataKey === 'netRevenue');
  assert.equal(line.props.name, 'Net Revenue');
  assert.doesNotMatch(f.view.text(), /Net profit/);
});
