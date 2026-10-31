const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const source = readFileSync(path.join(__dirname, '../lib/regulator-presentation.js'), 'utf8');
const policy = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('presentation requires a resolved Boolean profile, including explicit false', async () => {
  const { adminPresentationReady } = await policy;
  for (const value of [undefined, null, 'false', 0]) assert.equal(adminPresentationReady({ enableRegulatorMode: value }), false);
  assert.equal(adminPresentationReady(null), false);
  assert.equal(adminPresentationReady({ enableRegulatorMode: false, regulatorModeOverride: false }), true);
  assert.equal(adminPresentationReady({ enableRegulatorMode: true, regulatorModeOverride: null }), true);
});

test('hidden service routes cover subpages and query shortcuts without hiding unrelated management', async () => {
  const { isRegulatorRestrictedRoute } = await policy;
  for (const route of ['/crypto/products', '/crypto/wallets', '/loans', '/loans/applications', '/savings/groups/42', '/fiat-wallets', '/accounts/balances', '/accounts/balance-activities', '/accounts/transfers', '/accounts/custom-fees', '/wallet-policy-config', '/wallet-currency-audit', '/wallet-migrations/legacy-usd', '/payments/method-crypto-networks', '/payment-requests/wallet-settlement-policy', '/currency-products', '/bank-deposit-proofs']) assert.equal(isRegulatorRestrictedRoute(`/dashboard${route}`), true, route);
  for (const route of ['', '/admins', '/accounts/accounts/123', '/feature-flags', '/businesses', '/commerce/stores', '/cards', '/bills', '/kycs', '/payments/payment-methods']) assert.equal(isRegulatorRestrictedRoute(`/dashboard${route}`), false, route);
  assert.equal(isRegulatorRestrictedRoute('/dashboard/transactions?action=BUY_CRYPTO'), true);
  assert.equal(isRegulatorRestrictedRoute('/dashboard/transactions?service=LENDING'), true);
  assert.equal(isRegulatorRestrictedRoute('/dashboard/transactions?action=CARD_PAYMENT'), false);
  assert.equal(isRegulatorRestrictedRoute('/dashboard/accounts/accounts?email=loans%40example.com'), false);
  assert.equal(isRegulatorRestrictedRoute({ pathname: '/dashboard/transactions', query: { action: 'FUND_WALLET' } }), true);
});

test('service identifiers and translated labels hide the requested products but retain normal save actions', async () => {
  const { isRegulatorRestrictedService } = await policy;
  for (const value of ['BUY_CRYPTO', 'LOAN_DISBURSEMENT', 'LENDING', 'FUND_WALLET', 'GROUP_SAVING_PAYOUT', 'PERSONAL_SAVING_DEPOSIT', 'savings.enabled', 'loanEligibility', 'cryptoBalance', 'wallet.inter_transfer.enabled', 'AVEC', 'Likelemba', 'Épargne', 'Prêts', 'Portefeuille']) assert.equal(isRegulatorRestrictedService(value), true, value);
  for (const value of ['Saving…', 'Saving...', 'Saved', 'Business API', 'CARD_PAYMENT', 'COMMERCE', 'BILL_PAYMENTS', 'kycApproved', 'enableRegulatorMode']) assert.equal(isRegulatorRestrictedService(value), false, value);
});

test('shared tables hide restricted rows and fields while retaining account identities and allowed services', async () => {
  const { isRegulatorRestrictedRecord, regulatorVisibleFields } = await policy;
  for (const record of [{ service: 'WALLET' }, { action: 'REPAY_LOAN' }, { type: 'CRYPTO' }, { paymentMethod: { type: 'CRYPTO' } }, { key: 'service.savings.enabled' }, { jobName: 'processLoanRepayments' }]) assert.equal(isRegulatorRestrictedRecord(record), true);
  for (const record of [{ id: 123, email: 'loans@example.com' }, { action: 'CARD_PAYMENT', service: 'CARD' }, { key: 'enableRegulatorMode' }, { action: 'BUSINESS_TOOLS_PURCHASE' }]) assert.equal(isRegulatorRestrictedRecord(record), false);
  const fields = [{ key: 'email', label: 'Email' }, { key: 'balance', label: 'Balance' }, { key: 'owedLoans', label: 'Amount owed' }, { label: 'Montant dû' }, { key: 'cryptoBalance', label: 'Crypto' }, { key: 'hidden', regulatorRestricted: true }, { key: 'role', label: 'Role' }];
  assert.deepEqual(regulatorVisibleFields(fields, true), [fields[0], fields[6]]);
  assert.equal(regulatorVisibleFields(fields, false), fields);
  assert.deepEqual(regulatorVisibleFields(fields, null), [fields[0], fields[6]]);
});
