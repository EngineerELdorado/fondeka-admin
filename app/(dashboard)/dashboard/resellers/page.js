'use client';

import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { resellerId, resellerPermissions, resellerRecord, resellerPage, resellerDate, resellerEnrollmentStatus } from '@/lib/resellers';
import { Card, Alert, Badge, Field, ResourceStatus, actionStyle, useMounted, useResellerError, useResellerResource } from '@/components/resellers/Common';
import SetupPanel from '@/components/resellers/SetupPanel';
import StockFundingPanel from '@/components/resellers/StockFundingPanel';
import ConfigurationPanel from '@/components/resellers/ConfigurationPanel';
import { AccountWorkspace } from '@/components/resellers/AccountWorkspace';
import { RecoveryPanel } from '@/components/resellers/TransactionInspector';
import Navigation from '@/components/resellers/Navigation';
import styles from '@/components/resellers/resellers.module.css';

export default function ResellersPage() {
  const { session } = useAuth();
  const { canRead, canWrite } = resellerPermissions(session);
  const search = useSearchParams();
  const [accountId, setAccountId] = useState(() => { try { return search.get('accountId') ? resellerId(search.get('accountId')) : null; } catch { return null; } });
  const [tab, setTab] = useState(accountId == null ? 'rules' : 'accounts');
  const [settingsTab, setSettingsTab] = useState('setup');
  if (!canRead) return <Card title="Reseller program"><Alert>Permission denied. Admin or Super Admin access is required.</Alert></Card>;
  return <div className={styles.workspace}>
    <header className={styles.heading}><div><h1>Resellers</h1><p>Configure products once. Enrolled resellers inherit global rates automatically.</p></div>{!canWrite ? <small>Read only · Super Admin required to make changes.</small> : null}</header>
    <Navigation label="Reseller administration" items={[
      ['rules', 'Commission rates'], ['accounts', 'Resellers'], ['settings', 'Program settings'], ['recovery', 'Purchase lookup']
    ]} value={tab} onChange={setTab} />
    {tab === 'rules' ? <ConfigurationPanel kind="rule" canWrite={canWrite} /> : null}
    {tab === 'accounts' ? accountId == null ? <>
      <Card title="Find an account"><p className={styles.scope}>Open any existing customer to enroll them or manage their reseller settings.</p><AccountLookup onSelect={setAccountId} /></Card>
      <EnrollmentDirectory onSelect={setAccountId} />
    </> : <>
      <div style={actionStyle}><button type="button" className="btn-neutral" onClick={() => setAccountId(null)}>← All resellers</button><span>Account {accountId} · changes here apply to this account only</span></div>
      <AccountWorkspace key={accountId} accountId={accountId} canWrite={canWrite} manageConfiguration />
    </> : null}
    {tab === 'settings' ? <>
      <p className={styles.scope}>Global defaults · account overrides take priority.</p>
      <Navigation label="Program settings" items={[
        ['setup', 'Enrollment & earning'], ['policies', 'Reward behavior'], ['copy', 'Stock explanation']
      ]} value={settingsTab} onChange={setSettingsTab} />
      {settingsTab === 'setup' ? <SetupPanel canWrite={canWrite} /> : settingsTab === 'copy' ? <StockFundingPanel canWrite={canWrite} /> : <ConfigurationPanel kind="policy" canWrite={canWrite} />}
    </> : null}
    {tab === 'recovery' ? <RecoveryPanel canWrite={canWrite} /> : null}
  </div>;
}

function AccountLookup({ onSelect }) {
  const [selector, setSelector] = useState('email'), [value, setValue] = useState(''), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), mounted = useMounted(), fail = useResellerError();
  const resolve = async () => {
    if (lock.current) return;
    let target;
    try { target = selector === 'accountId' ? resellerId(value) : value.trim(); if (selector === 'email' && (!target || !/^[^\s@]+@[^\s@]+$/.test(target))) throw new Error('Enter an existing account email.'); }
    catch (err) { setError(err.message); return; }
    lock.current = true; setLoading(true); setError('');
    try {
      const result = resellerRecord('enrollment', await (selector === 'email' ? api.resellers.enrollmentByEmail(target) : api.resellers.enrollment(target)));
      if (mounted.current) onSelect(result.accountId);
    } catch (err) { if (mounted.current) setError(await fail(err)); }
    finally { lock.current = false; if (mounted.current) setLoading(false); }
  };
  return <form onSubmit={(event) => { event.preventDefault(); void resolve(); }}><div className={styles.lookup}>
    <Field label="Search by"><select disabled={loading} value={selector} onChange={(event) => { setSelector(event.target.value); setValue(''); setError(''); }}><option value="email">Email</option><option value="accountId">Account ID</option></select></Field>
    <Field label={selector === 'email' ? 'Customer email' : 'Account ID'}><input disabled={loading} type={selector === 'email' ? 'email' : 'text'} inputMode={selector === 'accountId' ? 'numeric' : 'email'} value={value} onChange={(event) => setValue(event.target.value)} /></Field>
    <button type="submit" className="btn-primary" disabled={loading || !value.trim()}>{loading ? 'Finding…' : 'Open account'}</button>
  </div><Alert>{error}</Alert></form>;
}

function EnrollmentDirectory({ onSelect }) {
  const [filter, setFilter] = useState('true'), [page, setPage] = useState(0);
  const load = useCallback(async () => {
    const result = resellerPage(await api.resellers.accounts({ ...(filter ? { enabled: filter } : {}), page, size: 20 }));
    result.content.forEach((row) => resellerRecord('enrollment', row));
    return result;
  }, [filter, page]);
  const resource = useResellerResource(load);
  return <Card title="Enrolled accounts"><div style={{ ...actionStyle, justifyContent: 'space-between' }}><Field label="Enrollment status"><select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0); }}><option value="true">Enabled</option><option value="false">Suspended / disabled</option><option value="">All records</option></select></Field><button type="button" className="btn-neutral" disabled={resource.loading} onClick={resource.reload}>Refresh list</button></div><ResourceStatus resource={resource} />{resource.data ? <DataTable columns={[
    { key: 'account', label: 'Account', priority: 0, render: (row) => `Account ${row.accountId}` }, { key: 'reseller', label: 'Enrollment', render: (row) => <Badge enabled={row.reseller} yes="Enrolled" no={resellerEnrollmentStatus(row)} /> },
    { key: 'enabledSince', label: 'First activation', priority: 1, render: (row) => resellerDate(row.enabledSince) },
    { key: 'actions', label: 'Actions', render: (row) => <button type="button" className="btn-neutral btn-sm" onClick={() => onSelect(row.accountId)}>Open account</button> }
  ]} rows={resource.data.content} page={page} pageSize={20} totalElements={resource.data.totalElements} totalPages={resource.data.totalPages} onPageChange={setPage} canNext={page + 1 < resource.data.totalPages} showAccountQuickNav={false} showIndex={false} emptyLabel="No accounts match this status. Use Find an account to enroll a customer." /> : null}</Card>;
}
