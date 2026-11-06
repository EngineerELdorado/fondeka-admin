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
      <p className={styles.scope}>Set commission rates first, then open enrollment and enable earning.</p>
      {!canWrite ? <small>Read only — Super Admin required for changes.</small> : null}
      <Alert>{mismatch ? 'Program and requirements were read at different versions. Refresh settings before editing.' : ''}</Alert>
      <div className={styles.setting}>
        <div><h3>Earn on new purchases</h3><p>Allow enrolled resellers to earn points on eligible purchases.</p></div>
        {program.data ? <Badge enabled={program.data.enabled} yes="On" no="Paused" /> : <span>Status unavailable</span>}
        {canWrite ? <button type="button" className="btn-neutral" disabled={!program.ready || mismatch} onClick={() => setEditing('program')}>Manage earning</button> : null}
      </div>
      <ResourceStatus resource={program} />
      <div className={styles.setting}>
        <div><h3>Customers can join themselves</h3><p>{requirements.data ? `Required wallet balance: ${requirements.data.prefundingAmount === 0 ? `no minimum (${requirements.data.prefundingCurrency})` : `${resellerNumber(requirements.data.prefundingAmount)} ${requirements.data.prefundingCurrency}`}.` : 'Set the wallet balance required to join.'}</p></div>
        {requirements.data ? <Badge enabled={requirements.data.selfServiceEnabled} yes="On" no="Off" /> : <span>Status unavailable</span>}
        {canWrite ? <button type="button" className="btn-neutral" disabled={!requirements.ready || mismatch} onClick={() => setEditing('requirements')}>Edit enrollment settings</button> : null}
      </div>
      <ResourceStatus resource={requirements} />
      {requirements.data?.selfServiceEnabled === true ? <small>{program.ready ? program.data.enabled ? 'Self-enrollment is open to eligible customers who meet the balance requirement.' : 'Self-enrollment is configured, but remains closed while earning is paused.' : 'Earning status is unavailable. Refresh before relying on self-enrollment availability.'}</small> : null}
      <details className={styles.help}><summary>How enrollment and earning work</summary>
        <ul><li>The required balance is working capital, not a joining fee. Joining does not debit or reserve it. Only the current settled balance in the chosen wallet counts.</li><li>Customers need an available product with a positive effective commission. The balance is checked once when joining; later spending does not suspend enrollment.</li><li>Manual admin enrollment bypasses the balance requirement. An admin must reactivate a previously suspended reseller.</li><li>Pausing earning affects new purchases. Existing purchase terms and previously earned points remain; redemption stays available.</li><li>Qualified own purchases earn reseller points. Reward behavior controls rewards from direct invitees. Each purchase uses one reward program, with no ancestor commissions.</li><li>Enrollment blocks the inviter’s upstream rewards by default. Points stay in their original currency; holds change spendability.</li></ul>
        <p>The account overview shows effective rates and enrollment. The customer app’s onboarding preview additionally checks available products and current funding.</p>
        <div style={actionStyle}><small>Earning version {program.data?.version ?? '—'}</small><small>Enrollment settings version {requirements.data?.version ?? '—'}</small></div>
      </details>
    {editing && editorRecord ? <ResellerEditor key={editing} kind={editing} record={editorRecord} canWrite={canWrite} onClose={() => setEditing(null)} onReload={review} onSave={(payload) => editing === 'program' ? api.resellers.updateProgram(payload) : api.resellers.updateRequirements(payload)} onSaved={saved} /> : null}
  </Card>;
}
