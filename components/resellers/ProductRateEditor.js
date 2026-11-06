'use client';

import { useCallback } from 'react';
import { ContentModal } from '@/components/ContentModal';
import { api } from '@/lib/api';
import { resellerList } from '@/lib/resellers';
import ResellerEditor from './Editor';
import { ResourceStatus, useResellerResource } from './Common';

export default function ProductRateEditor({ accountId, product, canWrite, onClose, onSaved }) {
  const matches = useCallback((rule) => rule.accountId === accountId && rule.service === 'BILL_PAYMENTS' && rule.billProductId === product.billProductId, [accountId, product.billProductId]);
  const read = useCallback(async () => resellerList(await api.resellers.rules.list(accountId), 'rule').find(matches), [accountId, matches]);
  const load = useCallback(async () => await read() || {
    accountId, service: 'BILL_PAYMENTS', billProductId: product.billProductId, billProductCode: product.billProductCode,
    enabled: true, basis: product.basis || 'NET_AMOUNT', percentage: product.percentage ?? 0, maxPoints: product.maxPoints ?? null, notes: ''
  }, [accountId, product, read]);
  const resource = useResellerResource(load);
  if (!resource.ready) return <ContentModal title="Set account commission rate" onClose={onClose}><p>Account {accountId} · {product.billProductCode || `Product ${product.billProductId}`}</p><ResourceStatus resource={resource} /></ContentModal>;
  return <ResellerEditor kind="rule" accountId={accountId} fixedProduct={{ id: product.billProductId, name: product.billProductName || product.billProductCode || 'Bill product' }} record={resource.data} canWrite={canWrite} onClose={onClose} onReload={read}
    onSave={async (payload, base) => {
      if (!matches(payload)) throw new Error('The account or product scope changed. Close and reopen the rate editor.');
      const saved = await (base.id == null ? api.resellers.rules.create(payload) : api.resellers.rules.update(base.id, payload));
      if (!matches(saved)) throw new Error('The saved account rate could not be confirmed. Refresh before retrying.');
      return saved;
    }} onSaved={onSaved} />;
}
