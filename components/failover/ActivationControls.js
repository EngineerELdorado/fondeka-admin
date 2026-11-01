'use client';

import { useRef, useState } from 'react';
import { failoverReason } from '@/lib/payout-failover';
import { Alert, Field } from '@/components/payout-failover/Common';

export default function ActivationControls({ enabled, busy, disabled, blockedReason, reason, onReason, onSubmit, children }) {
  const reasonInput = useRef(null);
  const [reasonError, setReasonError] = useState('');
  const submit = (event) => {
    event.preventDefault();
    if (disabled || blockedReason) return;
    try { failoverReason(reason); }
    catch (err) { setReasonError(err.message); reasonInput.current?.focus(); return; }
    setReasonError('');
    onSubmit(enabled ? 'pause' : 'enable');
  };
  return <form className="failover-activation" aria-label="Automatic failover controls" onSubmit={submit} noValidate>
    <div className="failover-card"><span className={'failover-state failover-state--' + (enabled ? 'on' : 'off')}>{enabled ? 'On' : 'Off'}</span><p>{enabled ? 'Turn off to stop new backup attempts.' : 'Turn on to use your saved backup setup.'}</p><small>Accepted attempts continue processing.</small></div>
    <div className="failover-card">
    {!enabled ? children : null}
    <Field label="Reason for turning on or pausing" help="Required for the audit log.">
      <textarea ref={reasonInput} rows={2} maxLength={1000} disabled={disabled} value={reason} aria-invalid={Boolean(reasonError)} onChange={(event) => { onReason(event.target.value); setReasonError(''); }} />
    </Field>
    <Alert>{reasonError}</Alert>
    <div className="failover-actions">
      <button type="submit" className={enabled ? 'btn-danger' : 'btn-primary'} disabled={disabled || Boolean(blockedReason)}>{busy ? 'Updating automatic failover…' : 'Turn ' + (enabled ? 'off' : 'on') + ' automatic failover'}</button>
      {blockedReason ? <small>{blockedReason}</small> : null}
    </div>
    </div>
  </form>;
}
