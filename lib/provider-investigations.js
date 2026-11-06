import { auditScope } from './payout-refund-audit';

export const providerIssues = [
  ['ANY_ISSUE', 'Provider errors or local review'],
  ['PROVIDER_ERROR', 'Recorded provider errors'],
  ['PROVIDER_DECLINED', 'Reported failure / decline'],
  ['LOCAL_FAILED', 'Local failed / canceled'],
  ['ALL', 'All matching transactions']
];
export function initialProviderFilters(search, now = new Date()) {
  const audit = search.get('auditRunId') || '';
  return { provider: search.get('provider') || '', fromDate: audit ? '' : new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10),
    toDate: audit ? '' : now.toISOString().slice(0, 10), action: '', context: '', localStatus: '', operation: '',
    issue: search.get('issue') || (audit ? 'ALL' : 'ANY_ISSUE'), accountId: search.get('accountId') || '', reference: '', currency: search.get('currency') || '',
    auditRunId: audit, auditOutcome: search.get('auditOutcome') || '', auditQuery: search.get('auditQuery') || '' };
}
export function providerFilter(form) {
  if (!form.provider?.trim()) throw new Error('Choose a provider.');
  const dates = auditScope({ from: form.fromDate, to: form.toDate, accountId: form.accountId });
  if (form.auditRunId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(form.auditRunId)) throw new Error('The saved audit reference is invalid.');
  return { provider: form.provider.trim().toUpperCase(), from: dates.from, to: dates.to,
    action: form.action || null, context: form.context || null, localStatus: form.localStatus || null, operation: form.operation || null,
    issue: form.issue || 'ANY_ISSUE', accountId: dates.accountId, reference: form.reference?.trim() || null, currency: form.currency?.trim().toUpperCase() || null,
    auditRunId: form.auditRunId || null, auditOutcome: form.auditOutcome || null, auditQuery: form.auditQuery || null };
}
export function providerQuery(form, page = 0) {
  const query = new URLSearchParams({ page: String(page), size: '20' });
  Object.entries(providerFilter(form)).forEach(([key, value]) => { if (value != null && value !== '') query.set(key, String(value)); });
  return query;
}
export function providerDocumentRequest(form, selected, details, previewHash = null) {
  const ids = [...new Set(selected.map(Number))];
  if (ids.length > 100 || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) throw new Error('Select at most 100 valid transactions.');
  return { filter: providerFilter(form), transactionIds: ids, title: details.title?.trim() || null,
    caseReference: details.caseReference?.trim() || null, message: details.message?.trim() || null, previewHash };
}
