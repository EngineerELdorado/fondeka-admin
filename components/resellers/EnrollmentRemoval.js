'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { ContentModal } from '@/components/ContentModal';
import { resellerEnrollmentStatus, resellerRemovalRecord } from '@/lib/resellers';
import { Alert, Facts, actionStyle, useMounted, useResellerError } from './Common';

export default function EnrollmentRemoval({ accountId, canWrite, onClose, onRemoved, onObserved }) {
  const [current, setCurrent] = useState(null), [busy, setBusy] = useState(false), [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [denied, setDenied] = useState(false);
  const lock = useRef(false), mounted = useMounted(), fail = useResellerError();
  const observed = useRef(onObserved); observed.current = onObserved;
  const allowed = canWrite && !denied;
  const readCurrent = useCallback(async () => {
    const next = resellerRemovalRecord(await api.resellers.enrollment(accountId), accountId);
    if (mounted.current) { setCurrent(next); setAcknowledged(false); observed.current?.(next); }
    return next;
  }, [accountId, mounted]);
  const report = useCallback(async (err) => {
    const message = await fail(err);
    if (mounted.current) { setError(message); if (err.status === 403) setDenied(true); }
  }, [fail, mounted]);
  const refresh = useCallback(async () => {
    if (!allowed || lock.current) return;
    lock.current = true; setBusy(true); setCurrent(null); setAcknowledged(false); setError(''); setNotice('');
    try { await readCurrent(); }
    catch (err) { await report(err); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }, [allowed, mounted, readCurrent, report]);
  useEffect(() => { void refresh(); }, [refresh]);
  const remove = async () => {
    if (!allowed || lock.current || !acknowledged || current?.enrollmentPresent !== true) return;
    const confirmed = current;
    lock.current = true; setBusy(true); setAcknowledged(false); setError(''); setNotice('');
    try {
      await api.resellers.removeEnrollment(accountId, confirmed.version);
      if (mounted.current) { onRemoved(); onClose(); }
    } catch (err) {
      if (!mounted.current) return;
      setCurrent(null); await report(err);
      if (!mounted.current) return;
      if (err.status !== 403 && (err.status === 409 || err.status === 404 || !err.status || err.status >= 500)) {
        try {
          const latest = await readCurrent();
          if (!mounted.current) return;
          if (latest.removed) { onRemoved(); onClose(); }
          else setNotice('Current enrollment reloaded. Review this state and confirm again before removing it.');
        } catch (readError) { await report(readError); }
      }
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return <ContentModal title={`Remove reseller enrollment · Account ${accountId}`} onClose={() => { if (!lock.current) onClose(); }}>
    <Alert>{error}</Alert><Alert success>{notice}</Alert>
    {!allowed ? <p>Super Admin access is required. Removal is unavailable for this session.</p> : <>
      {busy ? <div role="status">{current ? 'Removing enrollment…' : 'Checking enrollment…'}</div> : null}
      {current ? <Facts rows={[
        ['Account', current.accountId], ['Enrollment', resellerEnrollmentStatus(current)], ['Enrollment version', current.version],
        ['Customer self-enrollment', current.selfEnrollmentSuspended ? 'Blocked by suspension' : 'Subject to current eligibility']
      ]} /> : null}
      {current?.enrollmentPresent ? <>
        <p>The customer can enroll again when they meet the current requirements. Wallet balances, earned commissions, history and account overrides will be kept.</p>
        <p>A pending enrollment payment may still reach their wallet, but it will not restore the enrollment being removed.</p>
        <small>Suspension keeps customer self-enrollment blocked. Removal allows a new enrollment; historical reward holds still apply.</small>
        <label style={actionStyle}><input type="checkbox" checked={acknowledged} disabled={busy} onChange={(event) => setAcknowledged(event.target.checked)} style={{ width: 'auto' }} />I confirm removal for account {accountId}.</label>
      </> : current ? <p>This account has no current reseller enrollment to remove. Customer enrollment remains subject to current eligibility.</p> : null}
      <div style={{ ...actionStyle, justifyContent: 'flex-end' }}>
        <button type="button" className="btn-neutral" disabled={busy} onClick={() => void refresh()}>Refresh enrollment</button>
        {current?.enrollmentPresent ? <button type="button" className="btn-danger" disabled={busy || !acknowledged} onClick={() => void remove()}>{busy ? 'Removing…' : 'Remove reseller enrollment'}</button> : null}
      </div>
    </>}
  </ContentModal>;
}
