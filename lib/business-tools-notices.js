export const BUSINESS_TOOLS_NOTICE_LIMIT = 4000;
export const BUSINESS_TOOLS_FAQ_URL_LIMIT = 2048;
export const BUSINESS_TOOLS_FAQ_LABEL_LIMIT = 160;
const linkFields = ['url', 'urlFr', 'labelEn', 'labelFr'];

export function businessToolsNoticeSettings(plan) {
  if (!plan || !plan.code || !Number.isInteger(plan.version) || plan.version < 0) return null;
  for (const field of ['purchaseNoticeEn', 'purchaseNoticeFr']) {
    if (!Object.hasOwn(plan, field) || (plan[field] !== null && typeof plan[field] !== 'string')) return null;
  }
  return plan;
}

export function businessToolsFaqAvailable(plan) {
  const link = plan?.purchaseNoticeLink;
  return Boolean(plan && Object.hasOwn(plan, 'purchaseNoticeLink') && (link === null ||
    (typeof link === 'object' && !Array.isArray(link) && linkFields.every((field) => link[field] == null || typeof link[field] === 'string'))));
}

const privateIpv4 = (parts) => {
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
};
const privateHost = (hostname) => {
  const host = hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === 'localhost.localdomain' || /\.(localhost|local|internal)$/.test(host)) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return privateIpv4(host.split('.').map(Number));
  if (!host.includes(':')) return false;
  const [left, right = ''] = host.split('::');
  const start = left ? left.split(':') : [], end = right ? right.split(':') : [];
  const words = [...start, ...Array(Math.max(0, 8 - start.length - end.length)).fill('0'), ...end].map((word) => parseInt(word, 16));
  const loopback = words.slice(0, 7).every((word) => word === 0) && words[7] <= 1;
  const mapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  return loopback || (words[0] & 0xfe00) === 0xfc00 || (words[0] & 0xffc0) === 0xfe80 ||
    (mapped && privateIpv4([words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255]));
};

export function businessToolsFaqUrl(value, label = 'FAQ URL') {
  const text = String(value ?? '').trim();
  if (text.length > BUSINESS_TOOLS_FAQ_URL_LIMIT) throw new Error(`${label} must be 2,048 characters or fewer.`);
  try {
    const url = new URL(text);
    if (/^https:\/\//i.test(text) && url.protocol === 'https:' && url.hostname && !url.username && !url.password && url.port !== '0' && !privateHost(url.hostname) &&
      !/[\s\\\u0000-\u001f\u007f-\u009f]/u.test(text)) return text;
  } catch { /* Report the field's validation message below. */ }
  throw new Error(`${label} must be an absolute HTTPS URL without credentials, localhost or a private IP address.`);
}

export function businessToolsNoticePayload(draft, version, reason, linkOperation = 'keep') {
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
  payload.reason = trimmed;
  if (linkOperation === 'keep') return payload;
  if (linkOperation === 'remove') return { ...payload, purchaseNoticeLink: {} };
  if (linkOperation !== 'replace') throw new Error('Choose a valid FAQ edit operation.');
  const link = { url: businessToolsFaqUrl(draft.url, 'Primary FAQ URL'), urlFr: draft.urlFr?.trim() ? businessToolsFaqUrl(draft.urlFr, 'French FAQ URL') : null };
  for (const field of ['labelEn', 'labelFr']) {
    const value = String(draft[field] ?? '');
    if (value.length > BUSINESS_TOOLS_FAQ_LABEL_LIMIT || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value) || /<\/?[a-z][^>]*>/i.test(value)) {
      throw new Error('FAQ labels must be single-line plain text of at most 160 characters.');
    }
    link[field] = value.trim() || null;
  }
  return { ...payload, purchaseNoticeLink: link };
}

export const businessToolsNoticeDraft = (plan) => ({
  purchaseNoticeEn: plan?.purchaseNoticeEn ?? '', purchaseNoticeFr: plan?.purchaseNoticeFr ?? '',
  faqEnabled: Boolean(plan?.purchaseNoticeLink?.url),
  ...Object.fromEntries(linkFields.map((field) => [field, plan?.purchaseNoticeLink?.[field] ?? '']))
});

export function businessToolsFaqOperation(plan, draft) {
  if (!businessToolsFaqAvailable(plan)) return 'keep';
  if (!draft.faqEnabled) return plan.purchaseNoticeLink?.url ? 'remove' : 'keep';
  if (!plan.purchaseNoticeLink?.url) return 'replace';
  return linkFields.every((field) => String(draft[field] ?? '').trim() === (plan.purchaseNoticeLink?.[field] || '')) ? 'keep' : 'replace';
}

export function businessToolsNoticeSaveConfirmed(plan, previous, payload) {
  if (!businessToolsNoticeSettings(plan) || plan.code !== previous.code || plan.version < payload.version) return false;
  if (['purchaseNoticeEn', 'purchaseNoticeFr'].some((field) => (plan[field] || '') !== payload[field])) return false;
  if (businessToolsFaqAvailable(previous) && !businessToolsFaqAvailable(plan)) return false;
  if (!Object.hasOwn(payload, 'purchaseNoticeLink')) return true;
  return businessToolsFaqAvailable(plan) && linkFields.every((field) => {
    const saved = plan.purchaseNoticeLink?.[field] || '', requested = payload.purchaseNoticeLink[field] || '';
    if (field.startsWith('url') && saved && requested) {
      try { return new URL(saved).href === new URL(requested).href; } catch { return false; }
    }
    return saved === requested;
  });
}

export const businessToolsNoticeChanged = (plan, draft) => Boolean(plan &&
  (draft.purchaseNoticeEn.trim() !== (plan.purchaseNoticeEn || '') || draft.purchaseNoticeFr.trim() !== (plan.purchaseNoticeFr || '') || businessToolsFaqOperation(plan, draft) !== 'keep'));

export const sameBusinessToolsNotices = (a, b) => JSON.stringify(businessToolsNoticeDraft(a)) === JSON.stringify(businessToolsNoticeDraft(b)) && businessToolsFaqAvailable(a) === businessToolsFaqAvailable(b);

export function businessToolsFaqPreview(link, language = 'en') {
  if (!link?.url) return null;
  const french = /^fr(?:-|$)/i.test(language);
  try {
    return { url: businessToolsFaqUrl(french && link.urlFr?.trim() ? link.urlFr : link.url), label: (french ? link.labelFr : link.labelEn)?.trim() || (french ? 'Consulter la FAQ' : 'Read the FAQ') };
  } catch { return null; }
}

export function businessToolsAccountNoticePreview(access, tool) {
  const bundle = access?.bundle || access;
  const selected = tool === 'BUNDLE' ? bundle : access?.tools?.find((entry) => entry.tool === tool);
  if (!selected) throw new Error('This account response does not include the selected tool.');
  const resolvedLink = (link) => {
    if (!link?.url) return null;
    try { return { url: businessToolsFaqUrl(link.url), label: link.label || null }; } catch { return null; }
  };
  const ownLink = resolvedLink(selected.purchaseNoticeLink);
  const bundleLink = tool === 'BUNDLE' || access.pricingMode === 'BUNDLE' ? resolvedLink(bundle?.purchaseNoticeLink) || resolvedLink(access.purchaseNoticeLink) : null;
  const link = ownLink || bundleLink;
  return { notice: selected.purchaseNotice || '', link, linkSource: link ? tool === 'BUNDLE' ? 'Bundle' : ownLink ? 'Selected tool' : 'Bundle fallback' : null };
}
