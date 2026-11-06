export const RESELLER_POLICY_FIELDS = [
  ['ownPurchaseRewardsEnabled', 'Own purchase rewards'],
  ['eligibleInviteeRewardMode', 'Qualified invitee purchases'],
  ['otherInviteeReferralRewardsEnabled', 'Other invitee referral rewards'],
  ['inviteeResellerCutoff', 'Invitee reseller cutoff'],
  ['preEnrollmentPointsRedeemable', 'Pre-enrollment points redeemable']
];
export const RESELLER_SERVICES = ['WALLET', 'BILL_PAYMENTS', 'LENDING', 'CARD', 'CRYPTO', 'PAYMENT_REQUEST', 'E_SIM', 'AIRTIME_AND_DATA', 'SAVINGS', 'BANK_ACCOUNT', 'BANK_ACCOUNTS', 'COMMERCE', 'BUSINESS_API', 'BUSINESS_TOOLS', 'OTHER'];
export const resellerLabel = (value) => value == null || value === '' ? 'Inherit' : typeof value === 'boolean' ? value ? 'Enabled' : 'Disabled' : String(value).replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
export const resellerDate = (value) => value ? new Date(value).toLocaleString() : '—';
export const resellerNumber = (value) => value == null ? '—' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
export function filterResellerProducts(rows, { search = '', eligibility = '', source = '' } = {}) {
  const normalize = (value) => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_-]/g, ' ');
  const terms = normalize(search).trim().split(/\s+/).filter(Boolean);
  return rows.filter((row) => (!eligibility || (row.eligible ? 'eligible' : 'ineligible') === eligibility)
    && (!source || row.source === source)
    && terms.every((term) => normalize([row.billProductName, row.billProductCode, row.billProductId].join(' ')).includes(term)));
}
export function resellerMarkets(rows) {
  if (!Array.isArray(rows)) throw new Error('Product markets are unavailable. Refresh to retry.');
  return [...new Map(rows.filter((row) => typeof row?.alpha2Code === 'string' && /^[A-Za-z]{2}$/.test(row.alpha2Code.trim())).map((row) => {
    const code = row.alpha2Code.trim().toUpperCase();
    return [code, { code, name: row.name || code }];
  })).values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function resellerPermissions(session) {
  const groups = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload].flatMap((payload) => {
    const value = payload?.['cognito:groups'] || payload?.groups || [];
    return (Array.isArray(value) ? value : String(value).split(',')).map((group) => String(group).trim().toUpperCase());
  });
  return { canRead: groups.some((group) => ['ADMIN', 'SUPER_ADMIN'].includes(group)), canWrite: groups.includes('SUPER_ADMIN') };
}
export const resellerVersion = (value) => Number.isSafeInteger(value) && value >= 0;
export function resellerId(value, name = 'Account ID', optional = false) {
  if (optional && (value == null || value === '')) return null;
  const text = String(value ?? '').trim(), number = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number <= 0) throw new Error(`${name} must be a positive integer.`);
  return number;
}
const notes = (value) => {
  if (typeof value !== 'string' || value.length > 1000) throw new Error('Notes must be text of at most 1,000 characters.');
  return value.trim() || null;
};
const version = (value) => {
  if (!resellerVersion(value)) throw new Error('Refresh the saved configuration before saving.');
  return value;
};
const boolean = (value, name) => { if (typeof value !== 'boolean') throw new Error(`${name} must be enabled or disabled.`); return value; };
export const resellerRootPolicy = (row) => row?.accountId == null && row?.service == null && row?.billProductId == null;
export function resellerScope(row) {
  return [row.accountId == null ? 'Global' : `Account ${row.accountId}`, row.service ? resellerLabel(row.service) : 'Default', row.billProductId == null ? null : row.billProductCode || `Product ${row.billProductId}`].filter(Boolean).join(' · ');
}
export function resellerProgramPayload(draft, base) {
  return { enabled: boolean(draft.enabled, 'Program'), version: version(base.version) };
}
export function resellerRequirementsPayload(draft, base) {
  const amount = String(draft.prefundingAmount ?? '').trim();
  if (!/^\d{1,17}(?:\.\d{1,2})?$/.test(amount)) throw new Error('Prefunding must be a nonnegative amount with at most two decimal places. Zero removes the minimum.');
  const currency = String(draft.prefundingCurrency ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3,8}$/.test(currency)) throw new Error('Select an active, wallet-enabled fiat currency.');
  return { selfServiceEnabled: boolean(draft.selfServiceEnabled, 'Self-service enrollment'), prefundingAmount: Number(amount), prefundingCurrency: currency, version: version(base.version) };
}
export function resellerWalletCurrencies(rows) {
  if (!Array.isArray(rows)) throw new Error('Prefunding currencies are unavailable. Refresh to retry.');
  return [...new Map(rows.filter((row) => row?.active === true && row.walletEnabled === true && typeof row.currency === 'string' && /^[A-Za-z]{3,8}$/.test(row.currency)).map((row) => [row.currency.toUpperCase(), { ...row, currency: row.currency.toUpperCase() }])).values()];
}
export function resellerSetupReview(kind, program, requirements) {
  resellerRecord('program', program); resellerRecord('requirements', requirements);
  if (program.version !== requirements.version) throw new Error('Settings changed during refresh. Refresh both again before reviewing.');
  return kind === 'program' ? { ...program, selfServiceEnabled: requirements.selfServiceEnabled, prefundingAmount: requirements.prefundingAmount, prefundingCurrency: requirements.prefundingCurrency }
    : { ...requirements, programEnabled: program.enabled };
}
export function resellerEnrollmentPayload(draft, base) {
  return { enabled: boolean(draft.enabled, 'Enrollment'), notes: notes(draft.notes), version: version(base.version) };
}
export function resellerRulePayload(draft, base = {}) {
  if (draft.service !== 'BILL_PAYMENTS') throw new Error('Commission earning supports Bill payments only.');
  if (!['NET_AMOUNT', 'REVENUE'].includes(draft.basis)) throw new Error('Choose net amount or revenue.');
  const rate = String(draft.percentage ?? '').trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(rate) || Number(rate) > 100) throw new Error('Percentage must be 0–100 with at most four decimal places.');
  const cap = String(draft.maxPoints ?? '').trim();
  if (cap && (!/^\d{1,17}(?:\.\d{1,2})?$/.test(cap) || Number(cap) <= 0)) throw new Error('Cap must be positive with at most two decimal places, or blank for no cap.');
  return { accountId: resellerId(draft.accountId, 'Account ID', true), service: 'BILL_PAYMENTS', billProductId: resellerId(draft.billProductId, 'Bill product ID', true),
    basis: draft.basis, percentage: Number(rate), enabled: boolean(draft.enabled, 'Commission rule'), maxPoints: cap ? Number(cap) : null, notes: notes(draft.notes), ...(base.id != null ? { version: version(base.version) } : {}) };
}
export function resellerPolicyPayload(draft, base = {}) {
  const payload = { accountId: resellerId(draft.accountId, 'Account ID', true), service: draft.service || null, billProductId: resellerId(draft.billProductId, 'Bill product ID', true), notes: notes(draft.notes) };
  if (payload.service && !RESELLER_SERVICES.includes(payload.service)) throw new Error('Choose a supported service.');
  if (payload.billProductId && payload.service !== 'BILL_PAYMENTS') throw new Error('A bill product requires the Bill payments service.');
  for (const [field] of RESELLER_POLICY_FIELDS) {
    const value = draft[field] ?? null;
    const options = field === 'eligibleInviteeRewardMode' ? ['RESELLER', 'REFERRAL', 'NONE'] : field === 'inviteeResellerCutoff' ? ['PERMANENT', 'WHILE_ENABLED'] : [true, false];
    if (value !== null && !options.includes(value)) throw new Error(`Choose a valid ${resellerLabel(field)} setting.`);
    if (value === null && resellerRootPolicy(payload)) throw new Error('The global default must explicitly define every behavior.');
    payload[field] = value;
  }
  if (base.id != null) {
    payload.version = version(base.version);
    if (resellerRootPolicy(base) && !resellerRootPolicy(payload)) throw new Error('The global default cannot move to another scope.');
  }
  return payload;
}
export function resellerDraft(kind, row = {}, accountId = null) {
  if (kind === 'program') return { enabled: row.enabled };
  if (kind === 'requirements') return { selfServiceEnabled: row.selfServiceEnabled, prefundingAmount: row.prefundingAmount == null ? '' : String(row.prefundingAmount), prefundingCurrency: row.prefundingCurrency ?? '' };
  if (kind === 'enrollment') return { enabled: row.reseller, notes: row.notes ?? '' };
  if (kind === 'rule') return { accountId: row.accountId ?? accountId, service: 'BILL_PAYMENTS', billProductId: row.billProductId ?? '', basis: row.basis ?? 'NET_AMOUNT', percentage: String(row.percentage ?? ''), enabled: row.enabled ?? false, maxPoints: row.maxPoints == null ? '' : String(row.maxPoints), notes: row.notes ?? '' };
  return { accountId: row.accountId ?? accountId, service: row.service ?? '', billProductId: row.billProductId ?? '', ...Object.fromEntries(RESELLER_POLICY_FIELDS.map(([key]) => [key, row[key] ?? null])), notes: row.notes ?? '' };
}
export const resellerPayload = (kind, draft, base) => ({ program: resellerProgramPayload, requirements: resellerRequirementsPayload, enrollment: resellerEnrollmentPayload, rule: resellerRulePayload, policy: resellerPolicyPayload }[kind])(draft, base);
export function resellerRecord(kind, value) {
  if (!value || !resellerVersion(value.version)) throw new Error('Saved reseller settings are unavailable. Refresh before editing.');
  if (kind === 'program' && typeof value.enabled !== 'boolean' || kind === 'enrollment' && (!Number.isSafeInteger(value.accountId) || value.accountId <= 0 || typeof value.reseller !== 'boolean' || typeof value.upstreamEarningsBlocked !== 'boolean') || ['rule', 'policy'].includes(kind) && (!Number.isSafeInteger(value.id) || value.id <= 0)) throw new Error('The backend returned invalid reseller settings.');
  if (kind === 'requirements' && (typeof value.selfServiceEnabled !== 'boolean' || typeof value.prefundingAmount !== 'number' || !/^\d{1,17}(?:\.\d{1,2})?$/.test(String(value.prefundingAmount)) || typeof value.prefundingCurrency !== 'string' || !/^[A-Za-z]{3,8}$/.test(value.prefundingCurrency))) throw new Error('The backend returned invalid self-service requirements. Refresh before editing.');
  if (kind === 'rule' && (typeof value.enabled !== 'boolean' || !['NET_AMOUNT', 'REVENUE'].includes(value.basis) || typeof value.percentage !== 'number' || !Number.isFinite(value.percentage) || value.percentage < 0 || value.percentage > 100)) throw new Error('The backend returned invalid commission settings.');
  if (kind === 'policy') for (const [field] of RESELLER_POLICY_FIELDS) {
    const options = field === 'eligibleInviteeRewardMode' ? ['RESELLER', 'REFERRAL', 'NONE'] : field === 'inviteeResellerCutoff' ? ['PERMANENT', 'WHILE_ENABLED'] : [true, false];
    if (value[field] != null && !options.includes(value[field]) || resellerRootPolicy(value) && value[field] == null) throw new Error('The backend returned invalid behavior settings.');
  }
  return value;
}
export function resellerPage(value) {
  if (!Array.isArray(value?.content) || !Number.isInteger(value.totalPages) || !Number.isInteger(value.totalElements)) throw new Error('Unable to read reseller history. Refresh to retry.');
  return value;
}
export function resellerList(value, kind) {
  if (!Array.isArray(value)) throw new Error('Unable to read reseller configuration.');
  return value.map((row) => resellerRecord(kind, row));
}
export const resellerSameScope = (a, b) => ['accountId', 'service', 'billProductId'].every((key) => String(a[key] ?? '') === String(b[key] ?? ''));
export function resellerRetentionChanged(draft, base = {}) {
  return draft.preEnrollmentPointsRedeemable !== (base.preEnrollmentPointsRedeemable ?? null) || !resellerSameScope(draft, base) && draft.preEnrollmentPointsRedeemable !== null;
}
export function resellerFieldSource(field, sources, records) {
  for (const source of sources || []) {
    const row = records.find((record) => record.id === source.id && record.version === source.version);
    if (!row) return null; // Never guess past a missing or concurrently changed source.
    if (row[field] != null) return row;
  }
  return null;
}
