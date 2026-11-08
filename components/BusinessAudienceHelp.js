'use client';

import { businessAudienceFields } from '@/lib/notification-business-audience';

export default function BusinessAudienceHelp() {
  return <details>
    <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>How business accounts are matched</summary>
    <ul style={{ display: 'grid', gap: '.5rem', paddingLeft: '1.25rem' }}>{businessAudienceFields.map(({ key, label, help }) => <li key={key}><strong>{label}:</strong> {help}</li>)}</ul>
    <p style={{ color: 'var(--muted)' }}>No selects accounts that do not match, including those with no enrollment or resource. POS/API access follows current customer grants and paid access. Revoked or payment-required individual access blocks bundle inheritance; a valid individual grant can stand on its own. Targeting does not change access or authorize tool use.</p>
  </details>;
}
