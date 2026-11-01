'use client';

import ResponsiveTable from '@/components/ResponsiveTable';

import { failoverCodes, payoutConfirmedNonPayment } from '@/lib/payout-failover';
import { failureConditionLabel } from '@/lib/failover-presentation';

export default function ProviderContracts({ capabilities }) {
  const providers = capabilities.providers.filter((provider) => provider.sourceSupported || provider.targetSupported);
  return <div className="failover-card">
    <p><strong>{payoutConfirmedNonPayment(capabilities) ? 'Confirmed non-payment is required before every switch.' : 'Non-payment safeguards are unavailable.'}</strong> The limit is {capabilities.maximumProviders} distinct providers in total, including the original. A provider cannot be attempted twice. Provider order does not change primary routing ranks.</p>
    <div className="failover-table"><ResponsiveTable><thead><tr>{['Provider', 'Can continue to another provider?', 'Can receive an alternate?', 'Evidence and lookup support'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{providers.map((provider) => <tr key={provider.provider}><td><strong>{provider.provider}</strong></td><td>{provider.sourceSupported ? 'Yes, with reviewed evidence' : 'No — last position only'}</td><td>{provider.targetSupported ? 'Yes' : 'No'}</td><td>{provider.explanation}<div>{provider.liveStatusCheckSupported ? 'Live lookup supported.' : 'No live lookup; use recorded evidence and provider records.'}</div>{failoverCodes(capabilities, provider.provider).map((entry) => <div key={entry.code}><strong>{failureConditionLabel(entry.code)}</strong><small style={{ display: 'block' }}>{entry.code} · {entry.explanation}</small></div>)}</td></tr>)}</tbody></ResponsiveTable></div>
    {capabilities.providers.some((provider) => provider.provider === 'AVADAPAY' && provider.sourceSupported) ? <details className="failover-technical"><summary>AvadaPay final failure, cancellation and uncertain outcomes</summary><p>AVADAPAY_FINAL_FAILED requires a successful authenticated status lookup for the exact order_id and final status 3. It is backend evidence, not an outage or low-balance code. An accepted payout can later continue after this confirmation; a timeout alone never authorizes switching.</p><p>Known gateway/PIN/authentication errors and final cancellation are excluded from switching. Partial cancellation (status 5), missing or mismatched identities, unsuccessful lookups and unknown states remain unresolved. Signed callbacks are also verified by lookup.</p></details> : null}
    {capabilities.providers.some((provider) => provider.provider === 'MAPLERAD' && provider.sourceSupported) ? <p>MAPLERAD_FINAL_FAILED requires an admitted signed transfer.failed callback, the matching reference and explicit FAILED status. A generic submit error is insufficient; no live Maplerad lookup is exposed.</p> : null}
    {capabilities.providers.some((provider) => provider.provider === 'ARAKAPAY' && provider.targetSupported) ? <p>ArakaPay can be the last alternate. An authenticated matching 200 / APPROVED lookup can confirm success; declined/failed outcomes remain for review. Its unsigned callbacks trigger lookup and cannot directly settle or refund a managed payout.</p> : null}
    <small>An evidence code alone does not mean an attempt is REJECTED. Read its journal state, terminal evidence and observations together. Pending/uncertain attempts do not permit another payout or refund.</small>
  </div>;
}
