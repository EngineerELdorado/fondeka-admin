// Shared by push campaigns and announcements. Keep false distinct from Any.
export const businessAudienceFields = [
  { key: 'isReseller', label: 'Is reseller', help: 'Has an enabled reseller enrollment that has not been removed. Suspended and removed enrollments do not match.' },
  { key: 'hasStores', label: 'Has store', help: 'Owns a store that is neither deleted nor archived. Draft, active and suspended stores count; employees and store customers do not.' },
  { key: 'hasPos', label: 'Has POS plan', help: 'Has active POS customer access through an individual grant, qualifying Business Tools bundle or grandfathered paid access. A free catalog offer alone does not qualify.' },
  { key: 'hasPaymentRequests', label: 'Has payment link / request', help: 'Has created a payment request, including historical requests. Paying someone else’s request does not count.' },
  { key: 'hasApi', label: 'Has API plan', help: 'Has active API customer access through an individual grant, qualifying Business Tools bundle or grandfathered paid access. An API key is not required; a free catalog offer alone does not qualify.' }
];

export function businessAudienceDraft(audience) {
  return Object.fromEntries(businessAudienceFields.map(({ key }) => [
    key, audience?.[key] === true ? 'YES' : audience?.[key] === false ? 'NO' : 'ANY'
  ]));
}

export function businessAudiencePayload(draft) {
  return Object.fromEntries(businessAudienceFields.flatMap(({ key }) => (
    draft?.[key] === 'YES' ? [[key, true]] : draft?.[key] === 'NO' ? [[key, false]] : []
  )));
}
