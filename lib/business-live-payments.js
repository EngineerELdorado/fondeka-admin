export function livePaymentMode(business) {
  const override = business?.apiLivePaymentsEnabledOverride;
  if (override == null) return 'inherit';
  return override ? 'enabled' : 'disabled';
}

export function livePaymentSettingsAvailable(business) {
  const override = business?.apiLivePaymentsEnabledOverride;
  return typeof business?.apiLivePaymentsEnabled === 'boolean'
    && typeof business?.apiLivePaymentsGlobalEnabled === 'boolean'
    && (override == null || typeof override === 'boolean');
}
