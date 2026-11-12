const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const adminRoot = process.env.CARD_FLOW_ADMIN_ROOT || path.join(__dirname, '..');
const { mountComponent } = require(path.join(adminRoot, 'scripts/helpers/component-harness.cjs'));
const page = process.env.CARD_FLOW_PAGE_PATH || path.join(adminRoot, 'app/(dashboard)/dashboard/cards/card-policy-config/page.js');

const initial = () => ({
  sudoCustomerCardReadyDelaySeconds: 30,
  bridgecardCardholderRegistrationMode: 'REGISTER_CARDHOLDER_SYNCHRONOUSLY',
  bridgecardInfrastructureMode: 'ANCHOR',
  bridgecardInfrastructureModeAccountOverrides: { '6': 'ANCHOR' },
  cardDetailsDeliveryMode: 'AUTO',
  cardDetailsDeliveryModeAccountOverrides: { '42': 'BACKEND' }
});

async function panel({ config = initial(), write, role = 'ADMIN' } = {}) {
  const state = { config: structuredClone(config), writes: [], reads: 0, confirmations: 0 };
  global.window = { confirm: () => { state.confirmations++; return true; } };
  const api = { cardPolicyConfig: {
    get: async () => { state.reads++; return structuredClone(state.config); },
    update: async (payload) => {
      state.writes.push(structuredClone(payload));
      if (write) return write(payload, state);
      state.config = { ...state.config, ...structuredClone(payload) };
      return structuredClone(state.config);
    }
  } };
  const view = await mountComponent(page, { modules: {
    '@/lib/api': { api }, '@/components/RegulatorPresentation': { PresentationLink: 'a' },
    '@/contexts/AuthContext': { useAuth: () => ({ session: { tokens: { accessToken: { payload: { 'cognito:groups': [role] } } } } }) }
  } });
  await view.flush();
  const field = (id) => view.nodes().find((node) => node.props.id === id);
  const change = async (id, value) => { field(id).props.onChange({ target: { value } }); await view.flush(); };
  return { view, state, field, change };
}

test('emergency backend switch saves delivery policy only and does not prompt or change Anchor routing', async () => {
  const { view, state, change } = await panel();
  assert.equal(view.button('Save card details flow').disabled, true);
  await change('cardDetailsDeliveryMode', 'BACKEND');
  await view.click('Save card details flow');
  assert.deepEqual(state.writes, [{ cardDetailsDeliveryMode: 'BACKEND', cardDetailsDeliveryModeAccountOverrides: { '42': 'BACKEND' } }]);
  assert.equal(state.confirmations, 0);
  assert.equal(state.config.bridgecardInfrastructureMode, 'ANCHOR');
  assert.deepEqual(state.config.bridgecardInfrastructureModeAccountOverrides, { '6': 'ANCHOR' });
  assert.match(view.text(), /Card details flow updated/);
  assert.equal(view.button('Save card details flow').disabled, true);
});

test('account overrides can select token or automatic mode, and clearing restores global inheritance', async () => {
  const { view, state, change } = await panel();
  await change('cardDetailsOverrideAccountId', '043');
  await change('cardDetailsOverrideMode', 'PROVIDER_TOKEN');
  await view.click('Add flow override');
  await view.click('Save card details flow');
  assert.deepEqual(state.writes[0].cardDetailsDeliveryModeAccountOverrides, { '42': 'BACKEND', '43': 'PROVIDER_TOKEN' });
  const row = view.nodes().find((node) => node.type === 'select' && node.props['aria-label'] === 'Flow for account 43');
  row.props.onChange({ target: { value: 'AUTO' } }); await view.flush();
  await view.click('Save card details flow');
  assert.equal(state.writes[1].cardDetailsDeliveryModeAccountOverrides['43'], 'AUTO');
  await view.click('Clear flow overrides');
  await change('cardDetailsDeliveryMode', 'BACKEND');
  await view.click('Save card details flow');
  assert.deepEqual(state.writes[2], { cardDetailsDeliveryMode: 'BACKEND', cardDetailsDeliveryModeAccountOverrides: {} });
  assert.deepEqual(state.config.bridgecardInfrastructureModeAccountOverrides, { '6': 'ANCHOR' });
});

test('invalid account IDs do not add an override or write configuration', async () => {
  const { view, state, change } = await panel();
  for (const id of ['0', '-1', 'bad', '9223372036854775808']) {
    await change('cardDetailsOverrideAccountId', id);
    await view.click('Add flow override');
    assert.match(view.text(), /valid positive account ID/);
  }
  assert.equal(view.button('Save card details flow').disabled, true);
  assert.deepEqual(state.writes, []);
});

test('an older or unfamiliar backend cannot falsely enable flow controls or receive a policy write', async () => {
  for (const unsupported of [
    { cardDetailsDeliveryMode: undefined }, { cardDetailsDeliveryMode: 'FUTURE_FLOW' },
    { cardDetailsDeliveryModeAccountOverrides: undefined }, { cardDetailsDeliveryModeAccountOverrides: null },
    { cardDetailsDeliveryModeAccountOverrides: [] }, { cardDetailsDeliveryModeAccountOverrides: { '42': null } },
    { cardDetailsDeliveryModeAccountOverrides: { '42': 'FUTURE_FLOW' } }
  ]) {
    const config = { ...initial(), ...unsupported };
    const { view, state, field } = await panel({ config });
    assert.equal(field('cardDetailsDeliveryMode').props.disabled, true);
    assert.match(view.text(), /controls require backend support/);
    await view.click('Save card details flow');
    assert.deepEqual(state.writes, []);
  }
});

test('read-only roles can inspect policy and refresh without writing either settings group', async () => {
  for (const role of ['ASSISTANT', 'STAFF', 'CUSTOMER']) {
    const { view, state, field } = await panel({ role });
    assert.match(view.text(), /Read only/);
    assert.equal(field('cardDetailsDeliveryMode').props.value, 'AUTO');
    assert.equal(field('cardDetailsDeliveryMode').props.disabled, true);
    assert.equal(view.button('Save card details flow').disabled, true);
    assert.equal(view.button('Save provider settings').disabled, true);
    await view.click('Save card details flow');
    await view.click('Save provider settings');
    assert.equal(state.writes.length, 0);
    await view.click('Refresh');
    assert.equal(state.reads, 2);
  }
});

test('save failures keep the selected emergency policy and account drafts available to retry', async () => {
  let fail = true;
  const { view, state, field, change } = await panel({ write: async (payload, current) => {
    if (fail) throw new Error('Configuration service unavailable');
    current.config = { ...current.config, ...structuredClone(payload) }; return structuredClone(current.config);
  } });
  await change('cardDetailsDeliveryMode', 'BACKEND');
  await view.click('Save card details flow');
  assert.match(view.text(), /Configuration service unavailable/);
  assert.equal(field('cardDetailsDeliveryMode').props.value, 'BACKEND');
  assert.equal(view.button('Save card details flow').disabled, false);
  fail = false; await view.click('Save card details flow');
  assert.equal(state.writes.length, 2);
  assert.match(view.text(), /Card details flow updated/);
});

test('unconfirmed save responses do not display success or discard drafts', async () => {
  const { view, field, change } = await panel({ write: async () => ({}) });
  await change('cardDetailsDeliveryMode', 'BACKEND');
  await view.click('Save card details flow');
  assert.match(view.text(), /server did not confirm/);
  assert.doesNotMatch(view.text(), /Card details flow updated/);
  assert.equal(field('cardDetailsDeliveryMode').props.value, 'BACKEND');
  assert.equal(view.button('Save card details flow').disabled, false);
});

test('saving existing provider settings does not send or overwrite card-details policy', async () => {
  const { view, state, field, change } = await panel();
  await change('cardDetailsDeliveryMode', 'BACKEND');
  await change('sudoCustomerCardReadyDelaySeconds', '45');
  await view.click('Save provider settings');
  assert.equal(state.writes.length, 1);
  assert.equal(state.writes[0].sudoCustomerCardReadyDelaySeconds, 45);
  assert.equal(Object.hasOwn(state.writes[0], 'cardDetailsDeliveryMode'), false);
  assert.equal(Object.hasOwn(state.writes[0], 'cardDetailsDeliveryModeAccountOverrides'), false);
  assert.equal(state.config.cardDetailsDeliveryMode, 'AUTO');
  assert.deepEqual(state.config.cardDetailsDeliveryModeAccountOverrides, { '42': 'BACKEND' });
  assert.equal(field('cardDetailsDeliveryMode').props.value, 'BACKEND');
  assert.equal(view.button('Save card details flow').disabled, false);
  await view.click('Save card details flow');
  assert.equal(state.config.cardDetailsDeliveryMode, 'BACKEND');
});

test('delivery saves preserve unsaved provider edits and removing one override retains the others', async () => {
  const config = initial(); config.cardDetailsDeliveryModeAccountOverrides['43'] = 'AUTO';
  const { view, state, field, change } = await panel({ config, role: 'SUPER_ADMIN' });
  await change('sudoCustomerCardReadyDelaySeconds', '45');
  await view.click('Remove flow override');
  await view.click('Save card details flow');
  assert.deepEqual(state.writes, [{ cardDetailsDeliveryMode: 'AUTO', cardDetailsDeliveryModeAccountOverrides: { '43': 'AUTO' } }]);
  assert.equal(field('sudoCustomerCardReadyDelaySeconds').props.value, '45');
  assert.equal(state.config.sudoCustomerCardReadyDelaySeconds, 30);
});

test('a double submission cannot overlap delivery and provider policy writes', async () => {
  let finish;
  const { view, state, change } = await panel({ write: (payload, current) => new Promise((resolve) => {
    finish = () => { current.config = { ...current.config, ...payload }; resolve(structuredClone(current.config)); };
  }) });
  await change('cardDetailsDeliveryMode', 'BACKEND');
  const saveDelivery = view.button('Save card details flow').onClick;
  const saveProvider = view.button('Save provider settings').onClick;
  const first = saveDelivery();
  await saveDelivery();
  await saveProvider();
  await view.flush();
  assert.equal(state.writes.length, 1);
  assert.equal(view.button('Saving card details flow...').disabled, true);
  assert.equal(view.button('Save provider settings').disabled, true);
  finish(); await first; await view.flush();
  assert.match(view.text(), /Card details flow updated/);
});
