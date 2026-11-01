'use client';

import React, { Fragment } from 'react';

export default function TransactionStatusBadge({ value }) {
  if (!value) return '—';
  const status = String(value).toUpperCase();
  const tone = status === 'COMPLETED' ? { bg: '#ECFDF3', fg: '#15803D' }
    : status === 'PROCESSING' ? { bg: '#EFF6FF', fg: '#1D4ED8' }
      : status === 'FAILED' ? { bg: '#FEF2F2', fg: '#B91C1C' }
        : ['CANCELED', 'CANCELLED'].includes(status) ? { bg: '#FFF7ED', fg: '#C2410C' }
          : { bg: '#E5E7EB', fg: '#374151' };
  return <span className="transaction-status-badge" data-long-status={status.length > 20 || undefined} title={status} style={{ background: tone.bg, color: tone.fg }}>
    {status.split('_').map((part, index) => <Fragment key={index}>{index ? <>_<wbr /></> : null}{part}</Fragment>)}
  </span>;
}
