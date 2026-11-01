'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PresentationLink as Link, NonRegulatorContent } from '@/components/RegulatorPresentation';
import { isRegulatorRestrictedRecord } from '@/lib/regulator-presentation';
import { api } from '@/lib/api';
import { SANDBOX_HISTORY_PATH, sandboxPaymentResource } from '@/lib/business-api-sandbox';
import { SandboxAlert, SandboxHeader, SandboxHistoryLink, SandboxInfo, SandboxStatus, formatSandboxTime, sandboxAmount, sandboxReadError } from '@/components/business-api-sandbox/Common';

export default function SandboxPaymentDetail({ reference }) {
  const { enableRegulatorMode, refreshSession } = useAuth();
  const [resource, setResource] = useState(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [notFound, setNotFound] = useState(false), [reload, setReload] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    const token = ++request.current;
    setLoading(true); setError(''); setNotFound(false);
    api.businessApiSandbox.get(reference).then((response) => {
      const saved = sandboxPaymentResource(response, reference);
      if (token === request.current) setResource(saved);
    }).catch((err) => {
      if (token !== request.current) return;
      setNotFound(err.status === 404);
      setError(err.status === 404 ? 'Sandbox payment not found. The reference may be unknown or belong to LIVE history.' : sandboxReadError(err));
      if (err.status === 401) void refreshSession(true);
    }).finally(() => { if (token === request.current) setLoading(false); });
    return () => { request.current += 1; };
  }, [reference, reload, refreshSession]);

  const visible = resource && !notFound && !(enableRegulatorMode !== false && isRegulatorRestrictedRecord(resource));
  const payment = resource?.transaction, crypto = payment?.cryptoDetails;
  return <div className="sandbox-history">
    <SandboxHeader title="Sandbox API payment"><Link href={SANDBOX_HISTORY_PATH} className="btn-neutral">All sandbox history</Link><button type="button" className="btn-primary" disabled={loading} onClick={() => setReload((value) => value + 1)}>{loading ? 'Refreshing…' : 'Refresh payment'}</button></SandboxHeader>
    <SandboxAlert>{error}</SandboxAlert>
    {loading ? <div className="card" role="status">Loading stored sandbox payment…</div> : null}
    {resource && error && !notFound ? <small>Showing the last successful payment state. Refresh to retry.</small> : null}
    {resource && !visible && !notFound ? <section className="card">This payment is unavailable in the current dashboard presentation.</section> : null}
    {visible ? <>
      <section className="card sandbox-card" aria-label="Sandbox payment summary">
        <div className="sandbox-heading"><div><h2>Fondeka reference</h2><strong className="sandbox-reference">{payment.fondekaReference}</strong></div><SandboxStatus status={payment.status} /></div>
        <SandboxInfo items={[
          ['API request ID', resource.requestId], ['Merchant order reference', payment.orderReference],
          ['Action', payment.action === 'BUSINESS_API_COLLECTION' ? 'Collection' : 'Payout'], ['Scenario', resource.scenario],
          ['Test amount', sandboxAmount(payment.amount, payment.currency)], ['Test fee', sandboxAmount(payment.fee, payment.currency)],
          ['Test gross amount', sandboxAmount(payment.grossAmount, payment.currency)], ['Fiat currency', payment.currency],
          ['Request created (UTC)', formatSandboxTime(resource.createdAt)], ['Payment updated (UTC)', formatSandboxTime(resource.updatedAt)]
        ]} />
        <small>The API request ID is separate from financial transaction IDs. This payment is identified by its opaque Fondeka reference.</small>
      </section>
      <section className="card sandbox-card" aria-label="Business and credential metadata"><h2>Business & credential</h2>
        <SandboxInfo items={[
          ['Business', <Link key="business" href={`/dashboard/businesses/${encodeURIComponent(resource.businessId)}`}>{resource.businessName || `Business ${resource.businessId}`} · #{resource.businessId}</Link>],
          ['Owner account', <Link key="account" href={`/dashboard/accounts/accounts/${encodeURIComponent(resource.ownerAccountId)}`}>Account #{resource.ownerAccountId}</Link>],
          ['Credential ID', resource.apiKeyId], ['Credential name', resource.apiKeyName],
          ['Payment method', resource.paymentMethodName], ['Method type', resource.paymentMethodType], ['Network', resource.networkName]
        ]} />
        <div className="sandbox-actions"><SandboxHistoryLink businessId={resource.businessId}>This Business&apos;s sandbox history</SandboxHistoryLink><SandboxHistoryLink accountId={resource.ownerAccountId}>Owner sandbox history</SandboxHistoryLink><SandboxHistoryLink apiKeyId={resource.apiKeyId}>Credential sandbox history</SandboxHistoryLink></div>
        <small>History remains available for revoked credentials. Credential names and IDs do not reveal key material.</small>
      </section>
      <NonRegulatorContent><section className="card sandbox-card" aria-label="Virtual sandbox accounting"><h2>Virtual sandbox accounting</h2>
        <SandboxInfo items={[
          ['Virtual wallet tracking', resource.walletTracked === true ? 'Tracked by virtual sandbox wallets' : resource.walletTracked === false ? 'Historical status-only simulation' : 'Unavailable'],
          ['Virtual refund recorded (UTC)', resource.refundedAt ? formatSandboxTime(resource.refundedAt) : 'No virtual refund recorded']
        ]} />
        <small>Virtual sandbox activity has no real financial value. Historical status-only records can retain an original zero-fee response.</small>
      </section></NonRegulatorContent>
      {payment.failureCode || payment.failureMessage ? <section className="card sandbox-card" aria-label="Sandbox failure"><h2>Failure information</h2><SandboxInfo items={[
        ['Failure code', payment.failureCode], ['Failure message', payment.failureMessage]
      ]} /></section> : null}
      {crypto ? <NonRegulatorContent><section className="card sandbox-card" aria-label="Synthetic crypto details"><h2>Synthetic crypto details</h2>
        <p>Sandbox destinations are deliberately non-payable. These values are test instructions.</p>
        <SandboxInfo items={[
          ['Crypto currency', crypto.cryptoCurrency], ['Crypto network', crypto.network], ['Synthetic destination', crypto.address],
          ['Test token amount', sandboxAmount(crypto.amountInCrypto, crypto.cryptoCurrency)],
          ['Test exchange rate', sandboxAmount(crypto.exchangeRate, crypto.exchangeRateCurrency)],
          ['Synthetic invoice URL', crypto.invoiceUrl], ['Invoice expires (UTC)', formatSandboxTime(crypto.expiresAt)]
        ]} />
      </section></NonRegulatorContent> : null}
    </> : null}
  </div>;
}
