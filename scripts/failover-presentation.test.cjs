const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const helpers = import('data:text/javascript;base64,' + Buffer.from(readFileSync(path.join(__dirname, '../lib/failover-presentation.js'), 'utf8')).toString('base64'));
const configuration = { enabled: false, createdAfter: null, accountIds: [42], rules: [{ id: 'one', enabled: true }, { id: 'two', enabled: false }] };
const snapshot = (configuration, extra = {}) => ({ revision: 3, source: 'DATABASE', emergencyDisabled: false, configuration, ...extra });

test('failover starts with an overview while preserving legacy and payment deep links', async () => {
  const { initialFailoverView: view } = await helpers;
  const pick = value => view(new URLSearchParams(value));
  assert.equal(pick(''), 'overview');
  assert.equal(pick('tab=unknown'), 'overview');
  assert.equal(pick('transactionId=91'), 'operations');
  for (const tab of ['policy', 'products']) assert.equal(pick('tab=' + tab), 'setup');
  for (const tab of ['overview', 'setup', 'activation', 'operations', 'history']) assert.equal(pick('tab=' + tab), tab);
  assert.equal(pick('tab=history&transactionId=91&revision=2'), 'history');
});

test('saved status distinguishes off, scheduled, on and infrastructure suppression for both contracts', async () => {
  const { failoverSummary: summary } = await helpers;
  const now = Date.parse('2026-11-01T12:00:00Z');
  for (const kind of ['payout', 'recharge']) {
    const get = (config, extra) => summary(kind === 'payout' ? { policy: snapshot(config, extra) } : snapshot(config, extra), kind, now);
    const off = get(configuration);
    assert.equal(off.state, 'off');
    assert.equal(off.enabledRules, 1);
    assert.equal(off.ruleCount, 2);
    assert.equal(off.coverage, '1 selected account');
    assert.equal(off.revision, 3);
    assert.equal(get({ ...configuration, enabled: true, createdAfter: '2026-11-01T12:01:00Z' }).state, 'scheduled');
    assert.equal(get({ ...configuration, enabled: true, createdAfter: '2026-11-01T11:59:00Z' }).state, 'on');
    assert.equal(get({ ...configuration, enabled: true }, { emergencyDisabled: true }).state, 'blocked');
    const empty = get({ ...configuration, accountIds: [], rules: [] });
    assert.equal(empty.allAccounts, true);
    assert.equal(empty.coverage, 'All eligible accounts');
    assert.equal(empty.enabledRules, 0);
    assert.equal(summary(null, kind).state, 'unavailable');
  }
});

test('payout lists and history accept flat and nested Spring pagination without inventing totals', async () => {
  const { failoverPage } = await helpers;
  const content = [{ transactionId: 91 }];
  for (const value of [{ content, totalPages: 2, totalElements: 21 }, { content, page: { number: 0, size: 20, totalPages: 2, totalElements: 21 } }]) {
    assert.deepEqual(failoverPage(value).content, content);
    assert.equal(failoverPage(value).totalPages, 2);
    assert.equal(failoverPage(value).totalElements, 21);
  }
  assert.equal(failoverPage({ content: [], page: { totalPages: 0, totalElements: 0 } }).totalElements, 0);
  for (const value of [[], { content }, { content, totalPages: -1, totalElements: 0 }, { content, page: { totalPages: 1, totalElements: null } }]) assert.throws(() => failoverPage(value));
});

test('operator explanations retain backend codes and do not describe provider replies as settlement', async () => {
  const { explainFailoverReason, attemptLabel, failureConditionLabel } = await helpers;
  assert.equal(explainFailoverReason('BEFORE_CUTOVER').title, 'Payment is older than the start time');
  assert.equal(explainFailoverReason('ACCOUNT_NOT_IN_ROLLOUT').code, 'ACCOUNT_NOT_IN_ROLLOUT');
  assert.equal(explainFailoverReason('NEW_SERVER_REASON').title, 'new server reason');
  assert.match(attemptLabel('RETURNED'), /not yet proven/);
  assert.equal(attemptLabel('UNKNOWN'), 'Outcome unknown');
  assert.equal(attemptLabel('NEW_STATE'), 'NEW_STATE');
  assert.match(failureConditionLabel('REFUNDED'), /Supplier/);
  assert.equal(failureConditionLabel('NEW_CONDITION'), 'NEW_CONDITION');
});
