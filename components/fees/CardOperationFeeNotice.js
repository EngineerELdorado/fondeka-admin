'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PresentationLink as Link } from '@/components/RegulatorPresentation';
import { feePage, humanBusinessPercent } from '@/lib/service-fees';

export default function CardOperationFeeNotice({ mappingId }) {
  const [rules, setRules] = useState(null), [error, setError] = useState(''), [reload, setReload] = useState(0);
  useEffect(() => {
    if (!mappingId) return undefined;
    let active = true; setRules(null); setError('');
    (async () => {
      const rows = [];
      for (let page = 0; ; page++) {
        const result = feePage(await api.serviceFeeConfigs.list(new URLSearchParams({ service: 'CARD', productType: 'CARD_PRODUCT_PROVIDER', productKey: String(mappingId), active: 'true', page: String(page), size: '100' })));
        rows.push(...result.rows);
        if (page + 1 >= result.totalPages || !result.rows.length) break;
      }
      if (active) setRules(rows.filter((row) => row.active && row.service === 'CARD' && row.productType === 'CARD_PRODUCT_PROVIDER' && String(row.productKey) === String(mappingId) && ['FUND_CARD', 'WITHDRAW_FROM_CARD'].includes(row.action)));
    })().catch((err) => { if (active) setError(err.status === 404 ? 'Business-fee overrides are unavailable on this backend. Deploy the matching fee backend before relying on the new pricing model.' : err.message || 'Could not verify business-fee overrides.'); });
    return () => { active = false; };
  }, [mappingId, reload]);
  return <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '.5rem', border: '1px solid var(--border)', borderRadius: '8px', padding: '.75rem' }}>
    <strong>Funding and withdrawal pricing</strong>
    <small>These operation percentages use human values: 2 means 2%. They replace broader business charges when configured. Clear both the percentage and minimum for an operation to inherit broader settings; zero remains an explicit setting.</small>
    {mappingId ? <>
      {error ? <div role="alert">{error}</div> : rules === null ? <div role="status">Checking business-fee overrides…</div> : rules.length ? rules.map((rule) => <div key={rule.id}><strong>{rule.action === 'FUND_CARD' ? 'Funding' : 'Withdrawal'} overridden by business fee #{rule.id}:</strong> {humanBusinessPercent(rule.percentage)}% + {rule.flatAmount} {rule.currency}, minimum {rule.minimumAmount}{rule.maximumAmount == null ? ', uncapped' : `, maximum ${rule.maximumAmount}`}. This replaces the operation fields below, including a zero override.</div>) : <small>No active product/action business rule overrides these operation fields. A generic product rule cannot replace them.</small>}
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}><Link className="btn-neutral btn-sm" href={`/dashboard/fees/service-fee-configs?${new URLSearchParams({ service: 'CARD', productType: 'CARD_PRODUCT_PROVIDER', productKey: String(mappingId), active: 'true' })}`}>Manage business-fee overrides</Link><button type="button" className="btn-neutral btn-sm" onClick={() => setReload((value) => value + 1)}>Refresh fee overrides</button></div>
    </> : <small>Save the card mapping first to manage a product/action override.</small>}
  </div>;
}
