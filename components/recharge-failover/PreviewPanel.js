'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { failoverFingerprint } from '@/lib/payout-failover';
import { rechargePreview } from '@/lib/recharge-failover';
import { Alert, Field, formatInstant, useFailoverError } from '@/components/payout-failover/Common';

export default function PreviewPanel({ saved, configuration, capabilities }) {
  const [transactionId, setTransactionId] = useState(''), [source, setSource] = useState('saved'), [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), fail = useFailoverError(setError);
  const inputKey = failoverFingerprint({ transactionId, source, configuration: source === 'draft' ? configuration : saved?.revision });
  async function preview() {
    if (lock.current) return;
    let payload;
    try {
      if (source === 'draft' && !configuration) throw new Error('Complete the local recharge draft before previewing it.');
      payload = rechargePreview(transactionId, source === 'draft' ? configuration : null, capabilities);
    } catch (err) { setError(err.message); return; }
    setBusy(true); lock.current = true; setError('');
    try {
      const response = await api.rechargeFailover.preview(payload);
      if (response?.financialStateChanged !== false || response.providerPurchaseSent !== false || !['eligible', 'alreadyManaged', 'legacyDecision'].every((key) => typeof response[key] === 'boolean') || typeof response.ruleId !== 'string') throw new Error('The backend did not confirm a complete non-purchasing recharge preview.');
      setResult({ ...response, inputKey, checkedAt: new Date().toISOString() });
    } catch (err) { await fail(err); }
    finally { setBusy(false); lock.current = false; }
  }
  return <details className="card failover-technical"><summary>Check an existing recharge without sending a purchase</summary><div className="failover-card" style={{ marginTop: '.85rem' }}>
    <p>Evaluates an existing transaction using saved or proposed mappings. Inspection and preview may read provider catalogs. They never buy, enroll, settle, refund or clear a guard.</p>
    <div className="failover-grid"><Field label="Existing recharge transaction ID" help="Use a real transaction ID. There is no synthetic future sample for recharge."><input inputMode="numeric" disabled={busy} value={transactionId} onChange={(event) => setTransactionId(event.target.value)} /></Field><Field label="Settings to test"><select disabled={busy} value={source} onChange={(event) => setSource(event.target.value)}><option value="saved">Saved recharge setup</option><option value="draft">Unsaved recharge setup</option></select></Field></div>
    <Alert>{error}</Alert><button type="button" className="btn-neutral" disabled={busy || !saved || source === 'draft' && !configuration} onClick={() => void preview()}>{busy ? 'Checking recharge…' : 'Run a no-purchase check'}</button>
    {result ? <div className="failover-rule-summary" role="region" aria-label="Recharge preview result">
      {result.inputKey !== inputKey ? <Alert>Inputs or revision changed. Run preview again for current inputs.</Alert> : null}
      {error ? <span>Latest preview failed; the previous successful result is retained.</span> : null}
      <strong>{result.eligible ? 'Eligible for managed recharge under current checks' : 'Not eligible for managed recharge'}</strong><span>Rule: {result.ruleId || 'None'}</span><span>Already tracked by failover: {result.alreadyManaged ? 'Yes' : 'No'} · Already assigned to the old purchase path: {result.legacyDecision ? 'Yes' : 'No'}</span>{result.legacyDecision ? <p>This purchase already took the legacy path. New rules or activation cannot adopt it. Inspect its original transaction instead.</p> : null}{result.alreadyManaged ? <p>This purchase already has a recorded operation. Inspect its existing attempts rather than submitting it again.</p> : null}
      <span>Financial state changed: No · Provider purchase sent: No</span><small>Last successful preview: {formatInstant(result.checkedAt)}. A permanent legacy decision cannot be adopted by a later mapping or activation.</small>
    </div> : null}
  </div></details>;
}
