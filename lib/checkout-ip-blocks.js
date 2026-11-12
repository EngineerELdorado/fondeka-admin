export function checkoutIpPermissions(session) {
  const roles = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload]
    .flatMap((payload) => [payload?.['cognito:groups'], payload?.groups])
    .flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .map((role) => String(role).trim().toUpperCase());
  return { canRead: roles.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role)), canWrite: roles.includes('SUPER_ADMIN') };
}

// Syntax only. Public-address and trusted-proxy checks belong to the backend.
export function checkoutIpKey(value) {
  const ip = String(value ?? '').trim();
  const ipv4 = (text) => {
    const parts = text.split('.');
    return parts.length === 4 && parts.every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)
      ? parts.map(Number) : null;
  };
  const v4 = ipv4(ip);
  if (v4) return v4.join('.');
  if (!ip.includes(':') || /[^\da-f:.]/i.test(ip) || ip.length > 128) return null;
  let address = ip;
  if (ip.includes('.')) {
    const tail = ipv4(ip.slice(ip.lastIndexOf(':') + 1));
    if (!tail) return null;
    address = ip.slice(0, ip.lastIndexOf(':') + 1) + ((tail[0] << 8) + tail[1]).toString(16) + ':' + ((tail[2] << 8) + tail[3]).toString(16);
  }
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [], right = halves[1] ? halves[1].split(':') : [];
  if (![...left, ...right].every((part) => /^[\da-f]{1,4}$/i.test(part))) return null;
  const count = left.length + right.length;
  if (halves.length === 1 ? count !== 8 : count >= 8) return null;
  const groups = [...left, ...Array(8 - count).fill('0'), ...right].map((part) => parseInt(part, 16));
  if (groups.slice(0, 5).every((part) => part === 0) && groups[5] === 65535) return [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join('.');
  return groups.map((part) => part.toString(16)).join(':');
}

export function checkoutIpBlockPayload(draft) {
  const ipAddress = String(draft.ipAddress ?? '').trim(), reason = String(draft.reason ?? '').trim();
  if (!ipAddress || ipAddress.length > 128 || !checkoutIpKey(ipAddress)) throw new Error('Enter one IPv4 or IPv6 address, without a hostname, port or CIDR range.');
  if (!reason || reason.length > 500) throw new Error('Enter a reason of 1–500 characters.');
  const hours = String(draft.durationHours ?? '').trim() || '24';
  if (!/^\d+$/.test(hours) || Number(hours) < 1 || Number(hours) > 720) throw new Error('Duration must be a whole number from 1 to 720 hours.');
  return { ipAddress, reason, durationHours: Number(hours) };
}

export function checkoutIpEntry(row) {
  const date = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || typeof row.ipAddress !== 'string' || !checkoutIpKey(row.ipAddress)
      || !Number.isSafeInteger(row.violationCount) || row.violationCount < 0 || typeof row.lastReason !== 'string'
      || !date(row.windowStartedAt) || !date(row.lastViolationAt)
      || ![row.blockedAt, row.blockedUntil].every((value) => value === null || date(value))
      || !(row.blockReason === null || typeof row.blockReason === 'string')) {
    throw new Error('The backend returned an unreadable IP record. Refresh before continuing.');
  }
  return row;
}

export function checkoutIpPage(value) {
  const page = value?.page;
  if (!Array.isArray(value?.content) || !page || !['number', 'size', 'totalElements', 'totalPages'].every((key) => Number.isSafeInteger(page[key]) && page[key] >= 0)
      || page.size < 1 || page.size > 100 || value.content.length > page.size) {
    throw new Error('The backend returned an unreadable IP block list. Refresh or check backend support.');
  }
  value.content.forEach(checkoutIpEntry);
  return value;
}

export function checkoutIpStatus(row, now = Date.now()) {
  if (row.blockedUntil && Date.parse(row.blockedUntil) > now) return 'Blocked';
  if (row.blockedUntil) return 'Expired';
  if (row.lastReason === 'ADMIN_UNBLOCKED') return 'Unblocked';
  return 'Violations recorded';
}

export function checkoutIpReason(value) {
  return ({ SIMULATED_CHECKOUT_BUYER_EMAIL: 'Simulated buyer email', REPEATED_CHECKOUT_RATE_LIMIT: 'Repeated checkout rate-limit violations', ADMIN_UNBLOCKED: 'Unblocked by admin' })[value]
    || (value?.startsWith('ADMIN: ') ? `Manual block: ${value.slice(7)}` : value || '—');
}

export function checkoutIpDate(value) {
  return value ? `${new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC` : '—';
}
