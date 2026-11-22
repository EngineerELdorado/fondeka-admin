export const REPORT_STATES = ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'];
export const terminalReport = (job) => ['COMPLETED', 'FAILED', 'EXPIRED'].includes(job?.status);
export const reportStorageKey = (actor) => `fondeka:expense-report:v1:${actor}`;
export function clearReportRecovery(storage, keepActor = null) {
  const keep = keepActor == null ? null : reportStorageKey(keepActor);
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith('fondeka:expense-report:v1:') && key !== keep) storage.removeItem(key);
  }
}
export const validReportId = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 2000) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const validMonth = (value) => typeof value === 'string' && /^\d{4}-\d{2}$/.test(value) && validDate(`${value}-01`);
const validRange = (from, to) => {
  if (!validDate(from) || !validDate(to) || from > to || !from.endsWith('-01')) return false;
  const last = new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return last === to && (Number(to.slice(0,4)) - Number(from.slice(0,4))) * 12 + Number(to.slice(5,7)) - Number(from.slice(5,7)) < 24;
};
export function reportToday(timeZone, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = (type) => parts.find((value) => value.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    // Java also accepts fixed offsets that some browsers cannot format directly.
    if (['UT', 'Z'].includes(timeZone)) return now.toISOString().slice(0, 10);
    const offset = /^(?:(?:UTC|GMT|UT))?([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeZone);
    if (!offset) return null;
    const hours = Number(offset[2]), minutes = Number(offset[3]), seconds = Number(offset[4] || 0);
    if (hours > 18 || minutes > 59 || seconds > 59 || hours === 18 && (minutes || seconds)) return null;
    const milliseconds = (hours * 3600 + minutes * 60 + seconds) * 1000 * (offset[1] === '-' ? -1 : 1);
    return new Date(now.getTime() + milliseconds).toISOString().slice(0, 10);
  }
}
export function previousReportMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
}
export function shiftReportMonth(month, offset) {
  if (!validMonth(month) || !Number.isInteger(offset)) return '';
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}
export function reportRequest(form) {
  if (!['month', 'range'].includes(form.mode) || !['en', 'fr'].includes(form.language)) throw new Error('Choose a report period and English or French.');
  const currency = form.currency?.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency || '') || !['ACTUALS', 'BUDGET_VS_ACTUAL'].includes(form.reportMode)) throw new Error('Choose a currency and report content.');
  if (typeof form.timeZone !== 'string' || !form.timeZone.trim() || form.timeZone.trim().length > 80) throw new Error('Enter a reporting timezone.');
  if (form.mode === 'month' ? !validMonth(form.month) : !validRange(form.from, form.to)) throw new Error('Choose complete calendar months, up to 24 months, from year 2000 onward.');
  const common = { currency, language: form.language, timeZone: form.timeZone.trim(), mode: form.reportMode, includeDetails: form.includeDetails === true };
  return form.mode === 'month' ? { month: form.month, ...common } : { from: form.from, to: form.to, ...common };
}
export function readReportIntent(raw, actor) {
  try {
    if (!raw || raw.length > 3000) return null;
    const item = JSON.parse(raw);
    if (String(item.actor) !== String(actor) || !validReportId(item.key) || (item.jobId && !validReportId(item.jobId))) return null;
    const r = item.request;
    if (!r || !['en', 'fr'].includes(r.language) || !/^[A-Z]{3}$/.test(r.currency || '') || !['ACTUALS', 'BUDGET_VS_ACTUAL'].includes(r.mode) || typeof r.includeDetails !== 'boolean' || typeof r.timeZone !== 'string' || !r.timeZone.trim() || r.timeZone.length > 80) return null;
    // Recovery validates syntax only. Retrying never recalculates an accepted period.
    const month = validMonth(r.month) && !r.from && !r.to;
    const range = !r.month && validRange(r.from, r.to);
    if (!month && !range) return null;
    return { actor: String(actor), key: item.key, jobId: item.jobId || null, request: month
      ? { month: r.month, currency: r.currency, mode: r.mode, includeDetails: r.includeDetails, language: r.language, timeZone: r.timeZone }
      : { from: r.from, to: r.to, currency: r.currency, mode: r.mode, includeDetails: r.includeDetails, language: r.language, timeZone: r.timeZone } };
  } catch { return null; }
}
export function checkedReport(job, expectedId, request) {
  if (!job || !validReportId(job.id) || (expectedId && job.id !== expectedId) || !REPORT_STATES.includes(job.status)
      || job.reportType != null && job.reportType !== 'EXPENSES'
      || job.currency !== request.currency || job.mode !== request.mode || job.includeDetails !== request.includeDetails || job.language !== request.language || job.timeZone !== request.timeZone
      || !validRange(job.fromDate, job.toDate) || !Number.isFinite(Date.parse(job.expiresAt))
      || job.errorMessage != null && typeof job.errorMessage !== 'string') throw new Error('Unexpected expense report response. Check progress before trying again.');
  if (request.month ? job.fromDate !== `${request.month}-01` || !job.toDate.startsWith(`${request.month}-`)
    : job.fromDate !== request.from || job.toDate !== request.to) throw new Error('The reporting period does not match this export.');
  return job;
}
export function reportDownload(job, now = Date.now()) {
  if (job?.status !== 'COMPLETED' || Date.parse(job.downloadUrlExpiresAt) <= now || !(Date.parse(job.expiresAt) > now)) return null;
  if (!Number.isFinite(Date.parse(job.downloadUrlExpiresAt))) return null;
  try { const url = new URL(job.downloadUrl); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export const reportPollDelay = (attempt) => Math.min(15000, 2000 * 2 ** Math.min(attempt, 3));
