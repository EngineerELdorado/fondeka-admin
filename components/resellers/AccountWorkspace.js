'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PresentationLink as Link } from '@/components/RegulatorPresentation';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { ContentModal } from '@/components/ContentModal';
import { TableCellLines } from '@/components/TableCell';
import { resellerPermissions, resellerRecord, resellerPage, resellerDate, resellerLabel, resellerNumber, filterResellerProducts } from '@/lib/resellers';
import ResellerEditor from './Editor';
import ProductRateEditor from './ProductRateEditor';
import ConfigurationPanel from './ConfigurationPanel';
import Navigation from './Navigation';
import styles from './resellers.module.css';
import { TransactionInspector } from './TransactionInspector';
import { Card, Facts, Badge, BehaviorFacts, Field, ResourceStatus, ProductMarketPicker, actionStyle, gridStyle, useResellerResource } from './Common';

export function AccountWorkspace({ accountId, canWrite, onConfigure, manageConfiguration = false }) {
  const [countryCode, setCountryCode] = useState('');
  const loadEnrollment = useCallback(async () => {
    const enrollment = await api.resellers.enrollment(accountId);
    resellerRecord('enrollment', enrollment);
    if (enrollment.accountId !== accountId) throw new Error('Account reseller enrollment is unavailable. Refresh to retry.');
    return enrollment;
  }, [accountId]);
  const loadSummary = useCallback(async () => {
    const summary = await api.resellers.summary(accountId, { countryCode });
    if (summary?.accountId !== accountId || typeof summary.reseller !== 'boolean' || typeof summary.earningEnabled !== 'boolean' || !Array.isArray(summary.pointsByCurrency) || !Array.isArray(summary.billProducts)) throw new Error('Account reseller summary is unavailable. Refresh to retry.');
    return { countryCode, summary };
  }, [accountId, countryCode]);
  const enrollmentResource = useResellerResource(loadEnrollment), summaryResource = useResellerResource(loadSummary);
  const [tab, setTab] = useState('summary'), [editing, setEditing] = useState(false), [behavior, setBehavior] = useState(null);
  const [productFilters, setProductFilters] = useState({ search: '', eligibility: '', source: '' }), [rateProduct, setRateProduct] = useState(null);
  const enrollment = enrollmentResource.data, summary = summaryResource.data?.summary;
  const products = summaryResource.data?.countryCode === countryCode ? summary?.billProducts : null;
  const filteredProducts = useMemo(() => products ? Object.values(productFilters).some(Boolean) ? filterResellerProducts(products, productFilters) : products : [], [products, productFilters]);
  const sources = useMemo(() => [...new Set((products || []).map((product) => product.source).filter(Boolean))], [products]);
  const refresh = () => { enrollmentResource.reload(); summaryResource.reload(); };
  return <div style={{ display: 'grid', gap: '1rem' }}>
    <Card title={`Reseller account ${accountId}`}>
      <div style={{ ...actionStyle, justifyContent: 'space-between' }}><Link href={`/dashboard/accounts/accounts/${accountId}`}>Open account details ↗</Link><div style={actionStyle}><button type="button" className="btn-neutral" disabled={enrollmentResource.loading || summaryResource.loading} onClick={refresh}>Refresh</button>{canWrite ? <button type="button" className="btn-primary" disabled={!enrollmentResource.ready} onClick={() => setEditing(true)}>Manage enrollment</button> : <span>Read only — Super Admin required.</span>}</div></div>
      <ResourceStatus resource={enrollmentResource} />
      {enrollment ? <Facts rows={[
        ['Enrollment', <Badge key="enrollment" enabled={enrollment.reseller} yes="Enrolled" no={enrollment.enabledSince ? 'Suspended' : 'Not enrolled'} />],
        ['New own earning', summaryResource.loading ? 'Refreshing…' : summary ? <Badge key="earning" enabled={summary.earningEnabled} yes="Enabled" no="Not enabled" /> : 'Unavailable'],
        ...(!manageConfiguration ? [['First activation', resellerDate(enrollment.enabledSince)], ['Upstream earnings (general context)', enrollment.upstreamEarningsBlocked ? 'Blocked' : 'Not blocked'], ['Version', enrollment.version], ['Admin notes', enrollment.notes]] : [])
      ]} /> : null}
      {manageConfiguration ? <>
        {enrollment ? <details className={`${styles.help} ${styles.accountMeta}`}><summary>Enrollment details & notes</summary><Facts rows={[
          ['First activation', resellerDate(enrollment.enabledSince)], ['Inviter earnings (general context)', enrollment.upstreamEarningsBlocked ? 'Blocked' : 'Not blocked'], ['Version', enrollment.version], ['Admin notes', enrollment.notes]
        ]} /><p>Enrollment and global earning are separate. The inviter indicator is a general context; product/service behavior may differ.</p></details> : null}
        <Navigation label="Reseller account views" value={tab} onChange={setTab} items={[
          ['summary', 'Overview'], ['rules', 'Commission overrides'], ['rewards', 'Reward history'], ['entries', 'Points ledger'], ['policies', 'Reward behavior']
        ]} />
      </> : <>
        <small>Enrollment and global earning are separate. The upstream indicator is a general context; product/service behavior may differ.</small>
        <nav aria-label="Reseller account views" style={actionStyle}>{[['summary', 'Balances & products'], ['rewards', 'Reward snapshots'], ['entries', 'Points ledger']].map(([value, label]) => <button key={value} type="button" className={tab === value ? 'btn-primary' : 'btn-neutral'} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}{onConfigure ? <><button type="button" className="btn-neutral" onClick={() => onConfigure('rules')}>Negotiated rates</button><button type="button" className="btn-neutral" onClick={() => onConfigure('policies')}>Behavior overrides</button></> : <Link className="btn-neutral" href={`/dashboard/resellers?accountId=${accountId}`}>Configure rates & behavior</Link>}</nav>
      </>}
    </Card>
    {manageConfiguration && ['rules', 'policies'].includes(tab) ? <ConfigurationPanel key={`${accountId}:${tab}`} kind={tab === 'rules' ? 'rule' : 'policy'} accountId={accountId} canWrite={canWrite} onChanged={refresh} /> : null}
    {tab === 'summary' ? <>
      {summary ? <Card title="Reseller points by currency"><small>Available excludes held points. Deficits must be offset by earnings in the same currency. Referral points are separate.</small><DataTable columns={[
        { key: 'currency', label: 'Currency', priority: 0 }, { key: 'available', label: 'Available', priority: 1, render: (row) => resellerNumber(row.available) },
        { key: 'held', label: 'Held', priority: 1, render: (row) => resellerNumber(row.held) }, { key: 'deficit', label: 'Deficit', priority: 1, render: (row) => resellerNumber(row.deficit) },
        { key: 'lifetimeEarned', label: 'Gross earned', render: (row) => resellerNumber(row.lifetimeEarned) }, { key: 'redeemed', label: 'Redeemed', render: (row) => resellerNumber(row.redeemed) }, { key: 'reversed', label: 'Reversed', render: (row) => resellerNumber(row.reversed) }
      ]} rows={summary.pointsByCurrency} showIndex={false} showAccountQuickNav={false} emptyLabel="No reseller points recorded." /></Card> : null}
      <Card title="Effective product rates">
        <ProductMarketPicker value={countryCode} onChange={(value) => { setCountryCode(value); setBehavior(null); }} />
        <div style={gridStyle}>
          <Field label="Find a product"><input type="search" placeholder="Product name, code or ID" value={productFilters.search} onChange={(event) => setProductFilters((previous) => ({ ...previous, search: event.target.value }))} /></Field>
          <Field label="Reward eligibility"><select value={productFilters.eligibility} onChange={(event) => setProductFilters((previous) => ({ ...previous, eligibility: event.target.value }))}><option value="">All products</option><option value="eligible">Eligible</option><option value="ineligible">Not eligible</option></select></Field>
          <Field label="Rate source"><select value={productFilters.source} onChange={(event) => setProductFilters((previous) => ({ ...previous, source: event.target.value }))}><option value="">All sources</option>{productFilters.source && !sources.includes(productFilters.source) ? <option value={productFilters.source}>{resellerLabel(productFilters.source)}</option> : null}{sources.map((source) => <option key={source} value={source}>{resellerLabel(source)}</option>)}</select></Field>
        </div>
        <ResourceStatus resource={summaryResource} />
        <small>Viewing a market does not change enrollment or commission rules. Product access and checkout checks still apply.</small>
        {products ? <><div style={{ ...actionStyle, justifyContent: 'space-between' }}><small>{filteredProducts.length} of {products.length} products</small>{Object.values(productFilters).some(Boolean) ? <button type="button" className="btn-neutral btn-sm" onClick={() => setProductFilters({ search: '', eligibility: '', source: '' })}>Clear product filters</button> : null}</div><DataTable key={`${countryCode}:${JSON.stringify(productFilters)}`} columns={[
        { key: 'billProductCode', label: 'Bill product', priority: 0, render: (row) => row.billProductCode || `Product ${row.billProductId}` },
        { key: 'eligible', label: 'Reward path', render: (row) => row.eligible ? 'Eligible' : 'Not eligible' }, { key: 'ownPurchaseEligible', label: 'Own purchase', render: (row) => row.ownPurchaseEligible ? 'Eligible' : 'Not eligible' },
        { key: 'percentage', label: 'Rate', render: (row) => row.percentage == null ? '—' : `${resellerNumber(row.percentage)}%` }, { key: 'basis', label: 'Basis', render: (row) => row.basis ? resellerLabel(row.basis) : '—' },
        { key: 'maxPoints', label: 'Cap', render: (row) => row.maxPoints == null ? 'No cap' : `${resellerNumber(row.maxPoints)} per currency` }, { key: 'source', label: 'Rate source', render: (row) => row.source || 'No matching rule' },
        { key: 'actions', label: 'Actions', render: (row) => <>{canWrite ? <button type="button" className="btn-neutral btn-sm" disabled={!summaryResource.ready} onClick={() => setRateProduct(row)}>Set account rate</button> : null}<button type="button" className="btn-neutral btn-sm" onClick={() => setBehavior(row)}>Effective behavior</button></> }
      ]} rows={filteredProducts} showIndex={false} showAccountQuickNav={false} emptyLabel={products.length ? 'No products match these filters.' : 'No products are available in this market.'} /></> : null}</Card>
    </> : null}
    {['rewards', 'entries'].includes(tab) ? <AccountHistory key={`${accountId}:${tab}`} kind={tab} accountId={accountId} canWrite={canWrite} onChanged={refresh} /> : null}
    {editing && enrollment ? <ResellerEditor kind="enrollment" record={enrollment} canWrite={canWrite} onClose={() => setEditing(false)} onReload={() => api.resellers.enrollment(accountId)} onSave={(payload) => api.resellers.updateEnrollment(accountId, payload)} onSaved={(next) => { enrollmentResource.accept(next); refresh(); }} /> : null}
    {behavior ? <ContentModal title={`Effective behavior · ${behavior.billProductCode || behavior.billProductId}`} onClose={() => setBehavior(null)}><BehaviorFacts values={behavior.behavior} /></ContentModal> : null}
    {rateProduct ? <ProductRateEditor accountId={accountId} product={rateProduct} canWrite={canWrite} onClose={() => setRateProduct(null)} onSaved={refresh} /> : null}
  </div>;
}

function AccountHistory({ kind, accountId, canWrite, onChanged }) {
  const [page, setPage] = useState(0), [selected, setSelected] = useState(null), [transaction, setTransaction] = useState(null);
  const load = useCallback(async () => resellerPage(await api.resellers[kind](accountId, { page, size: 20 })), [kind, accountId, page]);
  const resource = useResellerResource(load);
  const reward = kind === 'rewards';
  const sourceLink = (id, label) => id ? <Link href={`/dashboard/transactions?transactionId=${id}`}>{label || `Transaction ${id}`}</Link> : '—';
  const columns = reward ? [
    { key: 'source', label: 'Source purchase', priority: 0, render: (row) => sourceLink(row.sourceTransactionId, row.sourceTransactionReference) },
    { key: 'billProductCode', label: 'Product' }, { key: 'origin', label: 'Origin', render: (row) => resellerLabel(row.origin) },
    { key: 'accounts', label: 'Beneficiary / buyer', render: (row) => <TableCellLines primary={`Beneficiary ${row.beneficiaryAccountId ?? accountId}`} secondary={`Buyer ${row.purchasingAccountId ?? '—'}`} /> },
    { key: 'status', label: 'Reward state' }, { key: 'points', label: 'Points', render: (row) => `${resellerNumber(row.points)} ${row.currency || ''}` }, { key: 'createdAt', label: 'Captured', render: (row) => resellerDate(row.createdAt) },
    { key: 'actions', label: 'Actions', render: (row) => <><button type="button" className="btn-neutral btn-sm" onClick={() => setSelected(row)}>Commission details</button><button type="button" className="btn-neutral btn-sm" onClick={() => setTransaction(row.sourceTransactionId)}>Decision / reconciliation</button></> }
  ] : [
    { key: 'type', label: 'Entry', priority: 0 }, { key: 'points', label: 'Points', render: (row) => `${resellerNumber(row.points)} ${row.currency || ''}` }, { key: 'rewardId', label: 'Reward' },
    { key: 'walletTransactionId', label: 'Wallet transaction', regulatorRestricted: true, render: (row) => sourceLink(row.walletTransactionId) }, { key: 'createdAt', label: 'Recorded', render: (row) => resellerDate(row.createdAt) },
    { key: 'actions', label: 'Actions', render: (row) => <button type="button" className="btn-neutral btn-sm" onClick={() => setSelected(row)}>Details</button> }
  ];
  return <Card title={reward ? 'Reward snapshots' : 'Immutable points ledger'}><small>{reward ? 'A completed purchase can briefly have a pending reward while the worker posts it. Failed or refunded purchases cannot create spendable rewards.' : 'EARN minus REVERSAL is accrued cost. REDEEM settles the liability; do not count it as another commission expense.'}</small><ResourceStatus resource={resource} />{resource.data ? <DataTable rows={resource.data.content} columns={columns} page={page} pageSize={20} onPageChange={setPage} totalElements={resource.data.totalElements} totalPages={resource.data.totalPages} canNext={page + 1 < resource.data.totalPages} showIndex={false} showAccountQuickNav={false} /> : null}
    {selected ? <ContentModal title={reward ? 'Reseller commission details' : 'Reseller ledger entry'} onClose={() => setSelected(null)}><Facts rows={Object.entries(selected).map(([key, value]) => [key, value])} /></ContentModal> : null}
    {transaction ? <ContentModal title={`Captured reward · transaction ${transaction}`} onClose={() => setTransaction(null)}><TransactionInspector transactionId={transaction} canWrite={canWrite} onReconciled={() => { resource.reload(); onChanged(); }} /></ContentModal> : null}
  </Card>;
}

export default function ResellerAccountPanel({ accountId }) {
  const { session } = useAuth();
  const { canRead, canWrite } = resellerPermissions(session);
  const [expanded, setExpanded] = useState(false);
  if (!canRead) return null;
  return <details className="card" onToggle={(event) => setExpanded(event.currentTarget.open)}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Reseller program</summary>{expanded ? <div style={{ marginTop: '1rem' }}><AccountWorkspace key={accountId} accountId={Number(accountId)} canWrite={canWrite} /></div> : null}</details>;
}
