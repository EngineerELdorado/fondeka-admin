export const failoverViews = [
  ['overview', 'Overview'], ['setup', 'Backup setup'], ['activation', 'Turn on / pause'],
  ['operations', 'Payment activity'], ['history', 'Change history']
];

export function initialFailoverView(search) {
  const requested = search.get('tab');
  if (['policy', 'products'].includes(requested)) return 'setup';
  if (failoverViews.some(([key]) => key === requested)) return requested;
  return search.get('transactionId') ? 'operations' : 'overview';
}

export function failoverSummary(snapshot, kind, now = Date.now()) {
  const policy = kind === 'payout' ? snapshot?.policy : snapshot;
  const config = policy?.configuration;
  if (!config) return { state: 'unavailable', label: 'Status unavailable', description: 'Open Backup setup to load or refresh the saved configuration.' };
  const rules = Array.isArray(config.rules) ? config.rules : [];
  const enabledRules = rules.filter((rule) => rule.enabled).length;
  const count = Array.isArray(config.accountIds) ? config.accountIds.length : 0;
  const scheduled = config.enabled && Date.parse(config.createdAfter) > now;
  const state = policy.emergencyDisabled ? 'blocked' : !config.enabled ? 'off' : scheduled ? 'scheduled' : 'on';
  const labels = { blocked: 'Blocked by infrastructure', off: 'Off', scheduled: 'Scheduled', on: 'On' };
  const descriptions = {
    blocked: 'An infrastructure emergency switch prevents new backup attempts. An engineer must clear that block.',
    off: 'No new backup attempts can start. Ordinary payments and recovery of existing attempts continue.',
    scheduled: 'Enabled for the saved start time. Only payments created after that time can qualify.',
    on: 'Eligible new payments can use a backup when the required failure evidence is confirmed.'
  };
  return { state, label: labels[state], description: descriptions[state], revision: policy.revision,
    ruleCount: rules.length, enabledRules, accountCount: count, allAccounts: count === 0,
    coverage: count ? `${count} selected account${count === 1 ? '' : 's'}` : 'All eligible accounts',
    createdAfter: config.createdAfter, configuredEnabled: config.enabled, source: policy.source };
}

// Both Spring Page and Spring's VIA_DTO pagination are supported by the backend.
export function failoverPage(response) {
  const metadata = response?.page ?? response;
  if (!Array.isArray(response?.content) || !Number.isInteger(metadata?.totalPages) || metadata.totalPages < 0
      || !Number.isInteger(metadata.totalElements) || metadata.totalElements < 0) throw new Error('The saved page could not be read. Refresh to retry.');
  return { ...response, totalPages: metadata.totalPages, totalElements: metadata.totalElements };
}

const reasons = {
  POLICY_DISABLED: ['Backups are off', 'Save the intended rules, then use Turn on / pause to enable the saved setup.'],
  EMERGENCY_DISABLED: ['Blocked by infrastructure', 'The deployment emergency switch is on. Dashboard changes cannot bypass it.'],
  BEFORE_CUTOVER: ['Payment is older than the start time', 'The creation time of the original payment must be after the saved start time. Old payments cannot be adopted.'],
  ACCOUNT_NOT_IN_ROLLOUT: ['Account is outside the selected group', 'Check the customer account IDs in Backup setup. These are not Business IDs.'],
  ACCOUNT_PROVIDER_OVERRIDE: ['Account routing prevents this backup', 'An account-specific provider route still applies, even when the account is included in this setup.'],
  TRANSACTION_NOT_READY: ['Payment is not in a switchable state', 'Check the original transaction and its existing attempts. A pending or uncertain payment cannot simply be sent again.'],
  PROVIDER_ALREADY_REFERENCED: ['The primary provider already has a reference', 'An accepted or referenced request needs investigation before another provider could be considered.'],
  TRANSACTION_ALREADY_REFUNDED: ['The payment has already been refunded', 'A refunded payment cannot start a backup attempt.'],
  WHOLE_UNIT_AMOUNT_REQUIRED: ['The backup requires a whole-unit amount', 'The payout amount cannot contain a fractional unit for this route. The original quote cannot be changed to force a switch.'],
  PAYMENT_SNAPSHOT_CHANGED: ['Original payment details no longer match', 'The recorded amount, currency, fees, recipient and funding details must remain consistent. Investigate the original transaction.'],
  SOURCE_UNSUPPORTED: ['Primary provider is not supported', 'Choose a supported primary route or product for this failover system.'],
  ACTION_UNSUPPORTED: ['Payment action is not supported', 'This transaction type cannot use the selected backup route.'],
  NO_ENABLED_RULE: ['No enabled rule matches', 'Check the exact source route/product, rule order and enabled checkbox.'],
  OPERATION_ALREADY_ATTEMPTED: ['An attempt is already recorded', 'Inspect the existing payment activity. Preview does not reset the attempt limit or make it replayable.'],
  REJECTION_CODE_NOT_REVIEWED: ['This failure does not permit switching', 'Only the reviewed failure conditions offered by the backend can trigger a backup. A timeout is not sufficient.'],
  NO_ELIGIBLE_ALTERNATE: ['No eligible backup was found', 'Check the matching rule, account routing, recipient eligibility and destination route.'],
  ROUTE_PREFLIGHT_UNAVAILABLE: ['The backup route is not ready', 'Review active route/provider status, method compatibility and local currency checks. This does not certify provider funds.']
};
export function explainFailoverReason(code) {
  const [title, detail] = reasons[code] || [String(code).replaceAll('_', ' ').toLowerCase(), 'This decision was returned by the backend. Review the payment and its saved configuration.'];
  return { code, title, detail };
}

export const attemptLabel = (value) => ({ STARTED: 'Submission started', REJECTED: 'Provider rejected the request', RETURNED: 'Provider replied — outcome not yet proven', UNCERTAIN: 'Outcome unknown', UNKNOWN: 'Outcome unknown', IN_PROGRESS: 'In progress', NOT_DELIVERED: 'Confirmed not delivered', SUCCEEDED: 'Delivery confirmed', CONFLICT: 'Conflicting evidence' }[value] || value || 'Not recorded');

export const failureConditionLabel = (code) => ({
  PROVIDER_TEMPORARILY_UNAVAILABLE: 'Provider temporarily unavailable', PAWAPAY_WALLET_OUT_OF_FUNDS: 'pawaPay wallet has insufficient funds',
  REFUNDED: 'Supplier confirmed non-delivery and refunded its purchase', INSUFFICIENT_FUNDS: 'Supplier has insufficient funds',
  NO_INVENTORY: 'Supplier has no inventory', OFFER_UNAVAILABLE: 'The offer is unavailable', PROVIDER_UNAVAILABLE: 'The provider is unavailable'
}[code] || code);
