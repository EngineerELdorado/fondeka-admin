export const announcementPopupDraft = (row = {}) => ({
  presentation: row.presentation ?? '',
  titleFr: row.titleFr ?? '',
  bodyFr: row.bodyFr ?? '',
  ctaType: row.cta?.type ?? 'NONE',
  ctaLabel: row.cta?.label ?? '',
  ctaLabelFr: row.cta?.labelFr ?? '',
  ctaUrl: row.cta?.url ?? ''
});

const httpsUrl = (value, field) => {
  const text = String(value ?? '').trim();
  try {
    const url = new URL(text);
    if (/^https:\/\//i.test(text) && url.protocol === 'https:' && url.hostname && !url.username && !url.password
        && url.port !== '0' && !/[\s\u0000-\u001f\u007f]/u.test(text)) return url.href;
  } catch { /* Show the same validation error for malformed URLs. */ }
  throw new Error(`${field} must be an absolute HTTPS URL.`);
};
const optionalText = (value) => String(value ?? '').trim() ? String(value) : null;

export const announcementPopupPayload = (draft) => {
  const presentation = draft.presentation || null;
  if (presentation !== null && presentation !== 'POPUP') throw new Error('Choose a supported announcement format.');
  if (String(draft.titleFr || '').length > 255) throw new Error('French title must not exceed 255 characters.');
  for (const value of [draft.titleFr, draft.bodyFr]) {
    if (String(value || '').includes('\0')) throw new Error('Announcement copy must not contain null characters.');
  }
  let cta = null;
  if (presentation === 'POPUP') {
    if (String(draft.image || '').trim()) httpsUrl(draft.image, 'Image URL');
    const type = draft.ctaType || 'NONE';
    if (!['NONE', 'OPEN_URL', 'SHARE_APP', 'DISMISS'].includes(type)) throw new Error('Choose a supported primary action.');
    if (type !== 'NONE') {
      const label = optionalText(draft.ctaLabel);
      const labelFr = optionalText(draft.ctaLabelFr);
      if (!label) throw new Error('English / default button label is required.');
      for (const value of [label, labelFr]) {
        if (value && (value.length > 80 || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value))) throw new Error('Button labels must be single-line text of at most 80 characters.');
      }
      cta = { type, label, labelFr, url: type === 'OPEN_URL' ? httpsUrl(draft.ctaUrl, 'Web destination') : null };
    }
  }
  return { presentation, titleFr: optionalText(draft.titleFr), bodyFr: optionalText(draft.bodyFr), cta };
};

export const announcementCopyPayload = (title, body) => {
  const copy = { title: String(title ?? '').trim(), body: String(body ?? '').trim() };
  if (!copy.title || !copy.body) throw new Error('Default title and message are required.');
  if (copy.title.length > 255) throw new Error('Default title must not exceed 255 characters.');
  if ([copy.title, copy.body].some((value) => value.includes('\0'))) throw new Error('Announcement copy must not contain null characters.');
  return copy;
};

export const announcementDateInput = (instant) => {
  if (!instant) return '';
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
};

export const announcementSchedulePayload = (draft, saved = {}) => {
  const result = {};
  for (const field of ['startAt', 'endAt']) {
    const value = String(draft[field] ?? '').trim();
    if (!value) { result[field] = null; continue; }
    // Keep the saved instant's seconds and precision when a copy-only edit leaves the input unchanged.
    if (saved[field] && value === announcementDateInput(saved[field])) { result[field] = saved[field]; continue; }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)) throw new Error('Use a valid UTC date and time.');
    const date = new Date(`${value}Z`);
    if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(value)) throw new Error('Use a valid UTC date and time.');
    result[field] = `${value.length === 16 ? `${value}:00` : value}Z`;
  }
  if (result.startAt && result.endAt && new Date(result.startAt) >= new Date(result.endAt)) throw new Error('Announcement end must be after its start.');
  return result;
};

// Both notification endpoints accept this same small options DTO. Campaign audience and
// account targeting belong to the outer request; app-version filters are edited in Announcements.
export const notificationAnnouncementPayload = (draft, subject, message) => {
  if (draft?.enabled !== true) return undefined;
  announcementCopyPayload(subject, message);
  const schedule = announcementSchedulePayload(draft);
  return {
    enabled: true,
    ...announcementPopupPayload(draft),
    ...(optionalText(draft.severity) ? { severity: draft.severity.trim() } : {}),
    ...(optionalText(draft.link) ? { link: draft.link.trim() } : {}),
    ...(optionalText(draft.image) ? { image: draft.presentation === 'POPUP' ? httpsUrl(draft.image, 'Image URL') : draft.image.trim() } : {}),
    downloadUpdate: Boolean(draft.downloadUpdate),
    ...(schedule.startAt ? { startAt: schedule.startAt } : {}),
    ...(schedule.endAt ? { endAt: schedule.endAt } : {})
  };
};
