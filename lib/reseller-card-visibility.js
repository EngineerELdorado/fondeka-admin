export const RESELLER_CARD_FLAG = 'business_tools.reseller.visible';

export function resellerCardPermissions(session) {
  const groups = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload]
    .flatMap((payload) => [payload?.['cognito:groups'], payload?.groups])
    .flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .map((value) => String(value).trim().toUpperCase());
  return { canWrite: groups.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role)) };
}

export function resellerCardSettings(flags, overrides) {
  const matches = Array.isArray(flags) ? flags.filter((flag) => flag.key === RESELLER_CARD_FLAG) : [];
  if (matches.length !== 1 || typeof matches[0].enabled !== 'boolean') throw new Error('The backend does not advertise reseller card visibility. Deploy the updated backend and refresh.');
  if (!Array.isArray(overrides)) throw new Error('Account overrides are unavailable. Refresh before changing visibility.');
  const ids = new Set();
  for (const row of overrides) {
    if (row.key !== RESELLER_CARD_FLAG || !Number.isSafeInteger(row.accountId) || row.accountId < 1 || typeof row.enabled !== 'boolean' || ids.has(row.accountId)) throw new Error('Account visibility overrides could not be verified. Refresh before editing.');
    ids.add(row.accountId);
  }
  return { enabled: matches[0].enabled, overrides };
}

export function resellerCardTarget(type, value) {
  const target = String(value ?? '').trim();
  if (type === 'email') {
    if (!/^[^\s@]+@[^\s@]+$/.test(target)) throw new Error('Enter the existing account’s full email address.');
    return { type, value: target };
  }
  if (type !== 'accountId' || !/^[1-9]\d*$/.test(target) || !Number.isSafeInteger(Number(target))) throw new Error('Enter a positive account ID.');
  return { type, value: Number(target) };
}

export function resellerCardAccount(settings, accountId) {
  const override = settings.overrides.find((row) => String(row.accountId) === String(accountId));
  return { choice: override ? override.enabled ? 'show' : 'hide' : 'inherit', enabled: override?.enabled ?? settings.enabled };
}

export function resellerCardPayload(choice) {
  if (choice === 'inherit') return null;
  if (!['show', 'hide'].includes(choice)) throw new Error('Choose Inherit, Show or Hide.');
  return { enabled: choice === 'show' };
}
