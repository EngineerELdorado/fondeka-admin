'use client';

import { rechargeDecimalText } from '@/lib/recharge-failover';

export default function ProductSummary({ product, title }) {
  if (!product) return <div className="failover-rule-summary"><strong>{title}</strong><span>No inspected product selected.</span></div>;
  return <div className="failover-rule-summary"><strong>{title} · {product.provider}</strong>
    <span>{product.provider === 'RELOADLY' ? 'Operator #' + product.operatorId : 'Offer ' + product.offerId}</span>
    <span>Supplier amount: {rechargeDecimalText(product.amount)} {product.currency}</span>
    <span>Delivered amount: {product.deliveredAmount == null ? 'Not supplied' : rechargeDecimalText(product.deliveredAmount)} {product.deliveredCurrency || ''}</span>
    <small>Approval fingerprint: {product.fingerprint}</small>
  </div>;
}
