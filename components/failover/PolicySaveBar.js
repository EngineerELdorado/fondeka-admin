'use client';

import { Alert, Field } from '@/components/payout-failover/Common';

export default function PolicySaveBar({ canPublish, changed, busy, disabled, disabledReason, version, enabled, reason, onReason, onSave, onDiscard, error }) {
  return <section className={'card failover-save-bar' + (canPublish ? '' : ' failover-save-bar--read-only')} aria-label="Save policy changes" aria-busy={busy}>
    <div className="failover-save-bar__status">
      <strong role="status">{busy ? 'Saving changes…' : changed ? 'Unsaved changes' : 'No unsaved changes'}</strong>
      <small>No automatic saves.{version != null ? <span className="failover-save-bar__version"> Based on version {version}.</span> : null}</small>
      {canPublish ? <small>{enabled ? 'Changes apply immediately on save.' : 'Saving turns backups off.'}</small> : <small>Only Super Admins can save.</small>}
    </div>
    {canPublish ? <Field label="Reason for this setup change" help="Required audit note · up to 1,000 characters."><textarea rows={1} maxLength={1000} value={reason} disabled={disabled} onChange={(event) => onReason(event.target.value)} /></Field> : null}
    <div className="failover-save-bar__actions">
      {canPublish ? <button type="button" className="btn-primary" disabled={disabled || !!disabledReason} onClick={onSave}>{busy ? 'Saving changes…' : 'Save changes'}</button> : null}
      {canPublish || changed ? <button type="button" className="btn-neutral" disabled={disabled || !changed} onClick={onDiscard}>{canPublish ? 'Discard changes' : 'Discard preview draft'}</button> : null}
      {canPublish && disabledReason ? <small>{disabledReason}</small> : null}
    </div>
    {error ? <div className="failover-save-bar__error"><Alert>{error}</Alert></div> : null}
  </section>;
}
