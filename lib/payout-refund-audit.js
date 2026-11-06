export const auditOutcomes = [
  { value: 'CONFIRMED', label: 'Refunded + approved', color: '#c94c37', description: 'A matching ArakaPay approval and a wallet credit linked by the original reference.' },
  { value: 'DECLINED', label: 'Reported declined', color: '#64748b', description: 'ArakaPay reports a negative status. This alone does not prove that a refund was correct.' },
  { value: 'NOT_FOUND', label: 'Not found', color: '#d79b35', description: 'Reporting did not find this request. The payout outcome remains unresolved.' },
  { value: 'REFUND_LINK_REVIEW', label: 'Refund link needs review', color: '#a56b28', description: 'Approved payout with a real credit linked only by account, amount, currency and time.' },
  { value: 'REFUND_UNVERIFIED', label: 'Refund needs evidence', color: '#9164b2', description: 'Approved payout with a refund marker or uncertain credit link.' },
  { value: 'PENDING', label: 'Provider pending', color: '#5483bd', description: 'ArakaPay has not reported a completed payout.' },
  { value: 'LOOKUP_ERROR', label: 'Lookup error', color: '#b96a75', description: 'The provider request could not be completed.' },
  { value: 'UNVERIFIABLE', label: 'Conflicting / unverified', color: '#8c6d9e', description: 'Reporting did not provide unique, consistent evidence for this payout.' },
  { value: 'NOT_CHECKED', label: 'Waiting for lookup', color: '#cbd5e1', description: 'This candidate has not been checked yet.' }
];
export const outcomeInfo = (value) => auditOutcomes.find((entry) => entry.value === value) || { value, label: value || 'Unknown', color: '#64748b' };
export const activeAudit = (report) => ['QUEUED', 'RUNNING'].includes(report?.status);
export function canReadRefundAudit(session) {
  const payloads = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload];
  return payloads.some((payload) => [payload?.['cognito:groups'], payload?.groups].flatMap((v) => Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []).some((v) => ['ADMIN', 'SUPER_ADMIN'].includes(String(v).trim().toUpperCase())));
}
export function auditQuery(filters = {}, page = 0, size = 20) {
  const query = new URLSearchParams({ page: String(page), size: String(size), outcome: filters.outcome || 'CONFIRMED' });
  for (const key of ['query', 'accountId', 'currency']) if (String(filters[key] ?? '').trim()) query.set(key, String(filters[key]).trim());
  return query;
}
export function auditScope(form) {
  if (form.label?.trim().length > 120) throw new Error('Use a label of at most 120 characters.');
  const date = (value) => {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error('Choose a valid date.');
    return `${value}T00:00:00Z`;
  };
  const from = date(form.from), lastDay = date(form.to);
  const to = lastDay ? new Date(Date.parse(lastDay) + 86400000).toISOString() : null;
  if (from && to && Date.parse(from) >= Date.parse(to)) throw new Error('The start date must be on or before the end date.');
  const account = String(form.accountId || '').trim();
  if (account && (!/^[1-9]\d*$/.test(account) || !Number.isSafeInteger(Number(account)))) throw new Error('Enter a positive account ID.');
  return { from, to, accountId: account ? Number(account) : null, label: form.label?.trim() || null };
}
export function auditMoney(value, currency = '') {
  if (value == null || value === '') return '—';
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (!match) return `${value} ${currency}`.trim();
  const [, sign, whole, fraction = ''] = match;
  let cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  if (Number(fraction[2] || 0) >= 5) cents += 1n;
  return `${sign}${(cents / 100n).toLocaleString('en-US')}.${String(cents % 100n).padStart(2, '0')}${currency ? ` ${currency}` : ''}`;
}
export function creditTotals(credits = []) {
  const totals = {};
  for (const credit of credits) {
    const value = /^(\d+)(?:\.(\d+))?$/.exec(String(credit.amount ?? ''));
    if (!value || credit.refundStatus !== 'COMPLETED') continue;
    totals[credit.currency] = (totals[credit.currency] || 0n) + BigInt(value[1]) * 10n ** 18n + BigInt((value[2] || '').padEnd(18, '0').slice(0, 18));
  }
  return Object.fromEntries(Object.entries(totals).map(([currency, amount]) => [currency, `${amount / 10n ** 18n}.${String(amount % 10n ** 18n).padStart(18, '0')}`]));
}
export function auditCsv(transactions = []) {
  const cell = (value) => {
    const raw = String(value ?? '');
    const safe = /^[\s]*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const headings = ['Account ID', 'Account reference', 'Name', 'Email', 'Payout reference', 'Transaction ID', 'Created UTC', 'Local status', 'Payout amount', 'Currency', 'Wallet credits', 'Refund references', 'Refund evidence', 'Audit outcome', 'ArakaPay ID', 'Checked UTC'];
  const rows = transactions.map((row) => [row.accountId, row.accountReference, row.accountName, row.email, row.reference, row.transactionId, row.createdAt, row.localStatus, row.amount, row.currency,
    Object.entries(creditTotals(row.credits)).map(([currency, amount]) => auditMoney(amount, currency)).join('; '),
    [...new Set((row.credits || []).map((c) => c.refundReference))].join('; '), row.refundEvidence, row.outcome, row.providerTransactionId, row.checkedAt]);
  return '\uFEFF' + [headings, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}
