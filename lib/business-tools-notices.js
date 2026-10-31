export const BUSINESS_TOOLS_NOTICE_LIMIT = 4000;

export function businessToolsNoticeSettings(plan) {
  if (!plan || !plan.code || !Number.isInteger(plan.version) || plan.version < 0) return null;
  for (const field of ['purchaseNoticeEn', 'purchaseNoticeFr']) {
    if (!Object.hasOwn(plan, field) || (plan[field] !== null && typeof plan[field] !== 'string')) return null;
  }
  return plan;
}

export function businessToolsNoticePayload(draft, version, reason) {
  if (!Number.isInteger(version) || version < 0) throw new Error('Refresh saved notices before saving.');
  const payload = { version };
  for (const field of ['purchaseNoticeEn', 'purchaseNoticeFr']) {
    if (typeof draft[field] !== 'string') throw new Error('Both notice fields must be text. Leave a field blank to use its default.');
    if (draft[field].length > BUSINESS_TOOLS_NOTICE_LIMIT) throw new Error('Each notice must be 4,000 characters or fewer.');
    payload[field] = draft[field].trim();
  }
  const trimmed = String(reason || '').trim();
  if (!trimmed) throw new Error('Enter an audit reason before saving.');
  if (trimmed.length > 1000) throw new Error('Audit reason must be 1,000 characters or fewer.');
  return { ...payload, reason: trimmed };
}

export const businessToolsNoticeDraft = (plan) => ({ purchaseNoticeEn: plan?.purchaseNoticeEn || '', purchaseNoticeFr: plan?.purchaseNoticeFr || '' });
export const sameBusinessToolsNotices = (a, b) => a?.purchaseNoticeEn === b?.purchaseNoticeEn && a?.purchaseNoticeFr === b?.purchaseNoticeFr;
