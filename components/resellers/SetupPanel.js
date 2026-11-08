'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { resellerRecord, resellerSetupReview, resellerNumber } from '@/lib/resellers';
import ResellerEditor from './Editor';
import { Card, Badge, Alert, ResourceStatus, actionStyle, useResellerResource } from './Common';
import styles from './resellers.module.css';

export default function SetupPanel({ canWrite }) {
  const loadProgram = useCallback(async () => resellerRecord('program', await api.resellers.program()), []);
  const loadRequirements = useCallback(async () => resellerRecord('requirements', await api.resellers.requirements()), []);
  const program = useResellerResource(loadProgram), requirements = useResellerResource(loadRequirements);
  const [editing, setEditing] = useState(null);
  const mismatch = program.ready && requirements.ready && program.data.version !== requirements.data.version;
  const refresh = () => { program.reload(); requirements.reload(); };
  const review = async () => {
    const [savedProgram, savedRequirements] = await Promise.all([api.resellers.program(), api.resellers.requirements()]);
    return resellerSetupReview(editing, savedProgram, savedRequirements);
  };
  const saved = (next) => {
    if (editing === 'program') { program.accept(next); requirements.reload(); }
    else { requirements.accept(next); program.reload(); }
  };
  const record = editing === 'program' ? program.data : requirements.data;
  const editorRecord = editing && record && program.ready && requirements.ready && !mismatch ? resellerSetupReview(editing, program.data, requirements.data) : record;
  return <Card>
      <div className={styles.heading}><h2 style={{ margin: 0 }}>Enrollment & earning</h2><button type="button" className="btn-neutral btn-sm" disabled={program.loading || requirements.loading} onClick={refresh}>Refresh settings</button></div>
      <p className={styles.scope}>Configure global product rates once, then open enrollment and enable earning. Joining does not create account-specific rates.</p>
      {!canWrite ? <small>Read only — Super Admin required for changes.</small> : null}
      <Alert>{mismatch ? 'Program and requirements were read at different versions. Refresh settings before editing.' : ''}</Alert>
      <div className={styles.setting}>
        <div><h3>Earn on new purchases</h3><p>Allow enrolled resellers to earn points on eligible purchases.</p></div>
        {program.data ? <Badge enabled={program.data.enabled} yes="On" no="Paused" /> : <span>Status unavailable</span>}
        {canWrite ? <button type="button" className="btn-neutral" disabled={!program.ready || mismatch} onClick={() => setEditing('program')}>Manage earning</button> : null}
      </div>
      <ResourceStatus resource={program} />
      <div className={styles.setting}>
        <div><h3>Customers can join themselves</h3><p>{requirements.data ? requirements.data.prefundingAmount === 0 ? 'No enrollment payment required.' : `New enrollment payment: at least ${resellerNumber(requirements.data.prefundingAmount)} ${requirements.data.prefundingCurrency} in net wallet credit. Collection fees follow the payment quote.` : 'Set the minimum credited by a new enrollment payment.'}</p></div>
        {requirements.data ? <Badge enabled={requirements.data.selfServiceEnabled} yes="On" no="Off" /> : <span>Status unavailable</span>}
        {canWrite ? <button type="button" className="btn-neutral" disabled={!requirements.ready || mismatch} onClick={() => setEditing('requirements')}>Edit enrollment settings</button> : null}
      </div>
      <ResourceStatus resource={requirements} />
      {requirements.data?.selfServiceEnabled === true ? <small>{program.ready ? program.data.enabled ? 'Self-enrollment is open to eligible customers under the current payment requirements.' : 'Self-enrollment is configured, but remains closed while earning is paused.' : 'Earning status is unavailable. Refresh before relying on self-enrollment availability.'}</small> : null}
      <details className={styles.help}><summary>How enrollment and earning work</summary>
        <ul><li>A positive minimum requires one new enrollment-linked payment to credit the full minimum. Existing wallet balances, unrelated deposits and separate top-ups do not count. Zero permits direct enrollment when otherwise eligible.</li><li>The payment becomes the customer’s working capital, not a joining fee. Activation does not debit or reserve it. Spending a qualifying payment’s credited funds does not invalidate it or suspend enrollment.</li><li>Customers need an active, accessible product with a positive effective commission and an enabled earning path. The catalogue’s availability flag does not exclude products from reseller lists.</li><li>Manual admin enrollment bypasses the payment requirement, including for customers who already deposited. An admin must reactivate a suspended reseller. After removal, customer re-enrollment requires a new full-minimum payment unless the minimum is zero.</li><li>Pausing earning affects new purchases. Existing purchase terms and previously earned points remain; redemption stays available.</li><li>Qualified own purchases earn reseller points. Reward behavior controls rewards from direct invitees. Each purchase uses one reward program, with no ancestor commissions.</li><li>Enrollment blocks the inviter’s upstream rewards by default. Points stay in their original currency; holds change spendability.</li></ul>
        <p>The account overview shows effective rates and enrollment. The customer app’s onboarding preview additionally checks product eligibility and enrollment-payment requirements.</p>
        <div style={actionStyle}><small>Earning version {program.data?.version ?? '—'}</small><small>Enrollment settings version {requirements.data?.version ?? '—'}</small></div>
      </details>
    {editing && editorRecord ? <ResellerEditor key={editing} kind={editing} record={editorRecord} canWrite={canWrite} onClose={() => setEditing(null)} onReload={review} onSave={(payload) => editing === 'program' ? api.resellers.updateProgram(payload) : api.resellers.updateRequirements(payload)} onSaved={saved} /> : null}
  </Card>;
}
