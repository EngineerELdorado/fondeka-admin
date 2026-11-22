const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { mountComponent } = require('./helpers/component-harness.cjs');

async function picker(t, options = {}) {
  const changes = [], props = { label: 'Reporting month', value: '2025-12', locale: 'en', ...options };
  props.onChange = value => { props.value = value; changes.push(value); };
  const view = await mountComponent(path.join(__dirname, '../components/MonthPicker.js'), { props, modules: { './MonthPicker.module.css': { __esModule: true, default: {} } } });
  t.after(() => view.unmount());
  const field = label => view.nodes().find(node => node.type === 'label' && node.props.children[0] === label).props.children.find(node => node?.type === 'select').props;
  return { view, props, changes, field };
}

test('expense month selection matches revenue navigation and allows future planning without submitting a form', async t => {
  const p = await picker(t);
  assert.equal(p.field('Month').value, '12'); assert.equal(p.field('Year').value, '2025');
  const months = p.view.nodes().filter(node => node.type === 'option' && /^\d{2}$/.test(node.props.value));
  assert.equal(months.length, 12); assert.equal(months[0].props.children, 'January'); assert.equal(months[11].props.children, 'December');
  p.view.nodes().find(node => node.props['aria-label'] === 'Next month').props.onClick(); await p.view.flush();
  assert.equal(p.props.value, '2026-01');
  const futureYear = String(new Date().getUTCFullYear() + 3);
  p.field('Year').onChange({ target: { value: futureYear } }); await p.view.flush(); assert.equal(p.props.value, `${futureYear}-01`);
  assert.equal(p.view.nodes().find(node => node.props['aria-label'] === 'Next month').props.disabled, false);
  assert.ok(p.view.nodes().filter(node => node.type === 'button').every(node => node.props.type === 'button'));
});

test('French month names retain exact API values and frozen edits cannot change the selection', async t => {
  const p = await picker(t, { locale: 'fr', value: '2025-01' });
  assert.ok(p.view.nodes().some(node => node.type === 'option' && node.props.children === 'janvier'));
  p.field('Mois').onChange({ target: { value: '02' } }); await p.view.flush(); assert.equal(p.props.value, '2025-02');
  p.props.disabled = true; await p.view.flush();
  assert.equal(p.field('Année').disabled, true);
  p.field('Mois').onChange({ target: { value: '03' } }); await p.view.flush(); assert.equal(p.props.value, '2025-02');
  assert.equal(p.view.nodes().find(node => node.props['aria-label'] === 'Mois suivant').props.disabled, true);
});

test('copy-source month starts unselected, supports historical years, and respects the January 2000 boundary', async t => {
  const p = await picker(t, { value: '', label: 'Source month' });
  assert.equal(p.field('Month').value, ''); assert.equal(p.field('Month').required, true); assert.equal(p.changes.length, 0);
  p.field('Year').onChange({ target: { value: '2000' } }); await p.view.flush();
  assert.equal(p.field('Month').value, ''); assert.equal(p.changes.length, 0);
  p.field('Month').onChange({ target: { value: '01' } }); await p.view.flush(); assert.equal(p.props.value, '2000-01');
  const previous = p.view.nodes().find(node => node.props['aria-label'] === 'Previous month'); assert.equal(previous.props.disabled, true);
  previous.props.onClick(); await p.view.flush(); assert.equal(p.props.value, '2000-01');
  p.props.value = '2099-12'; await p.view.flush(); assert.equal(p.field('Year').value, '2099');
  p.view.nodes().find(node => node.props['aria-label'] === 'Next month').props.onClick(); await p.view.flush(); assert.equal(p.props.value, '2100-01');
});
