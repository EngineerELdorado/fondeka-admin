export const REGULATOR_MODE_KEY = 'enableRegulatorMode';

export function accountRegulatorModeSettings(flag, overrides, accountId) {
  if (typeof flag?.enabled !== 'boolean' || !Array.isArray(overrides) || accountId == null || accountId === '') return null;
  const matches = overrides.filter((entry) => String(entry?.accountId ?? entry?.account_id ?? entry?.account?.id ?? '') === String(accountId));
  if (matches.length > 1 || (matches.length === 1 && typeof matches[0].enabled !== 'boolean')) return null;
  const overrideEnabled = matches.length ? matches[0].enabled : null;
  return { globalEnabled: flag.enabled, overrideEnabled, enabled: overrideEnabled ?? flag.enabled };
}

export function accountRegulatorModeChoice(settings) {
  if (settings?.overrideEnabled == null) return 'inherit';
  return settings.overrideEnabled ? 'enabled' : 'disabled';
}
