export const campaignKey = (campaign) => `${campaign?.campaignType || ''}:${campaign?.campaignId || ''}`;
export const campaignRunning = (campaign) => Boolean(campaign?.campaignId && campaign.found !== false && campaign.completed !== true);
export function campaignStatus(campaign) {
  if (campaign?.found === false) return 'NOT_FOUND';
  if (campaign?.status) return campaign.status;
  if (campaign?.preparationStatus === 'FAILED') return 'FAILED';
  if (campaign?.enqueuing) return campaign.preparationStatus || 'PREPARING';
  return campaign?.completed ? Number(campaign.failedJobs) > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED' : 'DELIVERING';
}
export function campaignPollDelay(campaign, fallback = 3000) {
  const seconds = Number(campaign?.pollAfterSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? Math.max(1000, Math.min(2147483647, seconds * 1000)) : fallback;
}
export function acceptedCampaign(resource, type) {
  const id = resource?.campaignId;
  if (typeof id !== 'string' || !id.trim() || id.length > 256 || !id.startsWith(type === 'ANONYMOUS' ? 'ACMP-' : 'CMP-')) throw new Error('The backend did not confirm a campaign ID. Check campaign history before launching again.');
  return { ...resource, campaignId: id.trim() };
}
export function readCampaignStatus(resource, campaignId) {
  if (!resource || resource.campaignId !== campaignId || (resource.found != null && typeof resource.found !== 'boolean') || (resource.completed != null && typeof resource.completed !== 'boolean')) throw new Error('The campaign status response could not be read. Keeping the last known progress.');
  return resource;
}
export function campaignPermissions(session) {
  const roles = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload].flatMap((payload) => [payload?.['cognito:groups'], payload?.groups])
    .flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((role) => String(role).trim().toUpperCase());
  return { canRead: roles.some((role) => ['ADMIN', 'SUPER_ADMIN', 'ASSISTANT'].includes(role)), canDelete: roles.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role)) };
}
