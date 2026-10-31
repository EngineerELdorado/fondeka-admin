'use client';

import { RegulatorRecord, PresentationLink as Link, RegulatorField } from '@/components/RegulatorPresentation';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';
import { useLocale } from '@/contexts/LocaleContext';

const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PARTIALLY_PAID',
  'ON_CREDIT',
  'CONFIRMED',
  'FULFILLING',
  'FULFILLED',
  'COMPLETED',
  'CANCELED',
  'REFUND_PENDING',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'DISPUTED'
];
const PAYMENT_STATUSES = ['PAID', 'PARTIALLY_PAID', 'ON_CREDIT'];
const PAYMENT_MODES = ['CASH', 'FONDEKA'];
const REPORT_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'last-7-days', label: 'Last 7 days' },
  { value: 'last-30-days', label: 'Last 30 days' },
  { value: 'all', label: 'All time' }
];

const emptyOrderFilters = {
  status: '',
  paymentStatus: '',
  paymentMode: '',
  customerId: '',
  from: '',
  to: ''
};

const formatEnum = (value) => {
  if (!value) return '—';
  return String(value)
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatProductType = (value, locale) => {
  if (String(value || '').toUpperCase() === 'TRAINING') return locale === 'fr' ? 'Formation' : 'Training';
  return formatEnum(value);
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const formatMoney = (amount, currency) => {
  if (amount === null || amount === undefined || amount === '') return '—';
  const number = Number(amount);
  if (!Number.isFinite(number)) return `${amount} ${currency || ''}`.trim();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  } catch {
    return `${number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`.trim();
  }
};

const pageData = (response) => ({
  rows: Array.isArray(response) ? response : response?.content || [],
  totalElements: Number.isFinite(response?.totalElements) ? response.totalElements : null,
  totalPages: Number.isFinite(response?.totalPages) ? response.totalPages : null
});

const queryFrom = (values) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, String(value));
  });
  return params;
};

const MetricCard = ({ label, value, help }) => (
  <div className="card" style={{ display: 'grid', gap: '0.25rem', minWidth: 0 }}>
    <div style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    <div style={{ fontSize: '22px', fontWeight: 800, overflowWrap: 'anywhere' }}>{value}</div>
    {help ? <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{help}</div> : null}
  </div>
);

const BucketList = ({ title, rows }) => (
  <div className="card" style={{ display: 'grid', gap: '0.65rem' }}>
    <div style={{ fontWeight: 800 }}>{title}</div>
    {!rows?.length ? (
      <div style={{ color: 'var(--muted)' }}>No data.</div>
    ) : (
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {rows.map((row) => (
          <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.35rem' }}>
            <span>{formatEnum(row.key)}</span>
            <strong>{Number(row.count || 0).toLocaleString()}</strong>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default function CommerceStorePosPage() {
  const params = useParams();
  const { locale } = useLocale();
  const storeId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [report, setReport] = useState(null);
  const [reportPeriod, setReportPeriod] = useState('today');
  const [reportCurrency, setReportCurrency] = useState('');
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

  const [orders, setOrders] = useState([]);
  const [orderPage, setOrderPage] = useState(0);
  const [orderSize, setOrderSize] = useState(20);
  const [orderMeta, setOrderMeta] = useState({ totalElements: null, totalPages: null });
  const [orderFilters, setOrderFilters] = useState(emptyOrderFilters);
  const [appliedOrderFilters, setAppliedOrderFilters] = useState(emptyOrderFilters);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);

  const [customers, setCustomers] = useState([]);
  const [customerPage, setCustomerPage] = useState(0);
  const [customerSize, setCustomerSize] = useState(20);
  const [customerMeta, setCustomerMeta] = useState({ totalElements: null, totalPages: null });
  const [customerSearch, setCustomerSearch] = useState('');
  const [appliedCustomerSearch, setAppliedCustomerSearch] = useState('');
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState(null);

  const loadReport = async () => {
    if (!storeId) return;
    if (reportFrom && reportTo && reportFrom > reportTo) {
      setReportError('Report start date must be on or before the end date.');
      return;
    }
    setReportLoading(true);
    setReportError(null);
    try {
      const response = await api.commerceStores.getPosReport(storeId, queryFrom({
        period: reportPeriod,
        currency: reportCurrency,
        from: reportFrom,
        to: reportTo
      }));
      setReport(response || null);
    } catch (err) {
      setReportError(err?.message || 'Failed to load POS report.');
    } finally {
      setReportLoading(false);
    }
  };

  const loadOrders = async () => {
    if (!storeId) return;
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const response = await api.commerceStores.listPosOrders(storeId, queryFrom({
        page: orderPage,
        size: orderSize,
        ...appliedOrderFilters
      }));
      const parsed = pageData(response);
      setOrders(parsed.rows);
      setOrderMeta({ totalElements: parsed.totalElements, totalPages: parsed.totalPages });
    } catch (err) {
      setOrdersError(err?.message || 'Failed to load POS orders.');
      setOrders([]);
      setOrderMeta({ totalElements: null, totalPages: null });
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadCustomers = async () => {
    if (!storeId) return;
    setCustomersLoading(true);
    setCustomersError(null);
    try {
      const response = await api.commerceStores.listCustomers(storeId, queryFrom({
        page: customerPage,
        size: customerSize,
        search: appliedCustomerSearch
      }));
      const parsed = pageData(response);
      setCustomers(parsed.rows);
      setCustomerMeta({ totalElements: parsed.totalElements, totalPages: parsed.totalPages });
    } catch (err) {
      setCustomersError(err?.message || 'Failed to load store customers.');
      setCustomers([]);
      setCustomerMeta({ totalElements: null, totalPages: null });
    } finally {
      setCustomersLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadOrders();
  }, [storeId, orderPage, orderSize, appliedOrderFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadCustomers();
  }, [storeId, customerPage, customerSize, appliedCustomerSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const reportCurrencyValue = report?.currency || reportCurrency || 'USD';
  const orderColumns = useMemo(() => [
    {
      key: 'order',
      label: 'Order',
      render: (row) => (
        <div style={{ display: 'grid', gap: '0.15rem' }}>
          <strong>{row.reference || `#${row.id}`}</strong>
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>ID {row.id ?? '—'} · {formatDateTime(row.createdAt)}</span>
        </div>
      )
    },
    { key: 'status', label: 'Status', render: (row) => formatEnum(row.status) },
    {
      key: 'customer',
      label: 'Customer',
      render: (row) => (
        <div style={{ display: 'grid', gap: '0.1rem' }}>
          <strong>{row.buyerName || 'Walk-in customer'}</strong>
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.buyerEmail || row.buyerPhone || (row.customerId ? `Customer ${row.customerId}` : 'Anonymous')}</span>
        </div>
      )
    },
    { key: 'paymentMode', label: 'Payment mode', render: (row) => formatEnum(row.posPaymentMode) },
    { key: 'paymentStatus', label: 'Payment status', render: (row) => formatEnum(row.posPaymentStatus || row.paymentStatus) },
    { key: 'total', label: 'Total', render: (row) => formatMoney(row.totalAmount, row.totalCurrency) },
    { key: 'paid', label: 'Paid', render: (row) => formatMoney(row.amountPaid, row.amountPaidCurrency || row.totalCurrency) },
    { key: 'outstanding', label: 'Outstanding', render: (row) => formatMoney(row.outstandingAmount ?? row.balanceDue, row.outstandingCurrency || row.balanceDueCurrency || row.totalCurrency) },
    { key: 'dueDate', label: 'Due date', render: (row) => row.paymentDueDate || '—' },
    { key: 'items', label: 'Items', render: (row) => Array.isArray(row.items) ? row.items.length : '—' },
    {
      key: 'productTypes',
      label: 'Product types',
      render: (row) => {
        if (!Array.isArray(row.items) || row.items.length === 0) return '—';
        const types = Array.from(new Set(row.items.map((item) => item?.productType ?? item?.type).filter(Boolean)));
        return types.length ? types.map((type) => formatProductType(type, locale)).join(', ') : '—';
      }
    }
  ], [locale]);

  const customerColumns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name', render: (row) => row.name || '—' },
    { key: 'email', label: 'Email', render: (row) => row.email || '—' },
    { key: 'phone', label: 'Phone', render: (row) => row.phone || '—' },
    { key: 'note', label: 'Note', render: (row) => row.note || '—' },
    { key: 'createdAt', label: 'Registered', render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'orders',
      label: 'POS history',
      render: (row) => (
        <button
          type="button"
          className="btn-neutral btn-sm"
          onClick={() => {
            const next = { ...emptyOrderFilters, customerId: String(row.id) };
            setOrderFilters(next);
            setAppliedOrderFilters(next);
            setOrderPage(0);
          }}
        >
          Filter orders
        </button>
      )
    }
  ], []);

  const applyOrderFilters = () => {
    if (orderFilters.from && orderFilters.to && orderFilters.from > orderFilters.to) {
      setOrdersError('Order start date must be on or before the end date.');
      return;
    }
    setOrderPage(0);
    setAppliedOrderFilters({ ...orderFilters });
  };

  const orderCanNext = orderMeta.totalPages === null ? orders.length === orderSize && orders.length > 0 : orderPage + 1 < orderMeta.totalPages;
  const customerCanNext = customerMeta.totalPages === null ? customers.length === customerSize && customers.length > 0 : customerPage + 1 < customerMeta.totalPages;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 800 }}>Store #{storeId} POS reporting</div>
          <div style={{ color: 'var(--muted)' }}>Sales, POS orders, outstanding balances, products and registered customers.</div>
        </div>
        <Link href="/dashboard/commerce/stores" className="btn-neutral" style={{ textDecoration: 'none' }}>← Commerce stores</Link>
      </div>

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ fontSize: '18px', fontWeight: 800 }}>POS report</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem', alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Period</span>
              <select value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value)}>
                {REPORT_PERIODS.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Currency</span>
              <select value={reportCurrency} onChange={(event) => setReportCurrency(event.target.value)}>
                <option value="">Store default</option>
                {(report?.availableCurrencies || []).map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>From (UTC)</span>
              <input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>To (UTC)</span>
              <input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} />
            </label>
            <button type="button" className="btn-primary" onClick={loadReport} disabled={reportLoading}>
              {reportLoading ? 'Loading…' : 'Run report'}
            </button>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Custom dates are inclusive and override the selected period.</div>
        </div>

        {reportError ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{reportError}</div> : null}

        {report ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
              <MetricCard label="Total sales" value={formatMoney(report.totalSalesAmount, reportCurrencyValue)} help={`${report.orderCount || 0} orders`} />
              <MetricCard label="Amount paid" value={formatMoney(report.amountPaid, reportCurrencyValue)} help={`${report.paidOrderCount || 0} paid orders`} />
              <MetricCard label="Balance due" value={formatMoney(report.balanceDue, reportCurrencyValue)} help={`${report.partialOrderCount || 0} partial · ${report.creditOrderCount || 0} credit`} />
              <MetricCard label="Merchant proceeds" value={formatMoney(report.merchantProceedsAmount, reportCurrencyValue)} />
              <MetricCard label="Item subtotal" value={formatMoney(report.itemSubtotalAmount, reportCurrencyValue)} />
              <MetricCard label="Report range" value={`${report.fromDate || '—'} → ${report.toDate || '—'}`} help={`Generated ${formatDateTime(report.generatedAt)}`} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
              <BucketList title="Sales by status" rows={report.salesByStatus} />
              <BucketList title="Sales by channel" rows={report.salesByChannel} />
              <BucketList title="Payment status" rows={report.salesByPaymentStatus} />
              <BucketList title="Payment mode" rows={report.salesByPaymentMode} />
            </div>

            <div className="card" style={{ display: 'grid', gap: '0.65rem', overflowX: 'auto' }}>
              <div style={{ fontWeight: 800 }}>Top products</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Product', 'Type', 'Quantity', 'Orders', 'Sales'].map((label) => <RegulatorField field={label} key={label}><th key={label} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{label}</th></RegulatorField>)}</tr></thead>
                <tbody>
                  {!report.topProducts?.length ? <tr><td colSpan={5} style={{ padding: '0.75rem', color: 'var(--muted)' }}>No product sales.</td></tr> : report.topProducts.map((product) => (
                    <RegulatorRecord record={product} key={product.productId || product.productSlug}><tr key={product.productId || product.productSlug}>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{product.productName || product.productSlug || product.productId}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{formatProductType(product.productType || product.type, locale)}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{product.quantitySold ?? '—'}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{product.orderCount ?? 0}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{formatMoney(product.salesAmount, product.salesCurrency)}</td>
                    </tr></RegulatorRecord>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card" style={{ display: 'grid', gap: '0.65rem', overflowX: 'auto' }}>
              <div style={{ fontWeight: 800 }}>Unpaid customers</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Customer', 'Contact', 'Orders', 'Balance due', 'Earliest due'].map((label) => <RegulatorField field={label} key={label}><th key={label} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{label}</th></RegulatorField>)}</tr></thead>
                <tbody>
                  {!report.unpaidCustomers?.length ? <tr><td colSpan={5} style={{ padding: '0.75rem', color: 'var(--muted)' }}>No unpaid customers.</td></tr> : report.unpaidCustomers.map((customer, index) => (
                    <RegulatorRecord record={customer} key={customer.customerId || `${customer.buyerEmail}-${index}`}><tr key={customer.customerId || `${customer.buyerEmail}-${index}`}>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{customer.buyerName || (customer.customerId ? `Customer ${customer.customerId}` : 'Walk-in customer')}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{customer.buyerEmail || customer.buyerPhone || '—'}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{customer.orderCount ?? 0}</td>
                      <RegulatorField field="balanceDue"><td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{formatMoney(customer.balanceDue, customer.balanceDueCurrency)}</td></RegulatorField>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{customer.earliestPaymentDueDate || '—'}</td>
                    </tr></RegulatorRecord>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontSize: '18px', fontWeight: 800 }}>POS orders</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}><span>Order status</span><select value={orderFilters.status} onChange={(event) => setOrderFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All</option>{ORDER_STATUSES.map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}</select></label>
          <label style={{ display: 'grid', gap: '0.25rem' }}><span>Payment status</span><select value={orderFilters.paymentStatus} onChange={(event) => setOrderFilters((current) => ({ ...current, paymentStatus: event.target.value }))}><option value="">All</option>{PAYMENT_STATUSES.map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}</select></label>
          <label style={{ display: 'grid', gap: '0.25rem' }}><span>Payment mode</span><select value={orderFilters.paymentMode} onChange={(event) => setOrderFilters((current) => ({ ...current, paymentMode: event.target.value }))}><option value="">All</option>{PAYMENT_MODES.map((value) => <option key={value} value={value}>{formatEnum(value)}</option>)}</select></label>
          <label style={{ display: 'grid', gap: '0.25rem' }}><span>Customer ID</span><input type="number" min="1" value={orderFilters.customerId} onChange={(event) => setOrderFilters((current) => ({ ...current, customerId: event.target.value }))} /></label>
          <label style={{ display: 'grid', gap: '0.25rem' }}><span>From (UTC)</span><input type="date" value={orderFilters.from} onChange={(event) => setOrderFilters((current) => ({ ...current, from: event.target.value }))} /></label>
          <label style={{ display: 'grid', gap: '0.25rem' }}><span>To (UTC)</span><input type="date" value={orderFilters.to} onChange={(event) => setOrderFilters((current) => ({ ...current, to: event.target.value }))} /></label>
          <label style={{ display: 'grid', gap: '0.25rem' }}><span>Page size</span><input type="number" min="1" max="100" value={orderSize} onChange={(event) => { setOrderSize(Math.min(100, Math.max(1, Number(event.target.value) || 20))); setOrderPage(0); }} /></label>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn-primary" onClick={applyOrderFilters} disabled={ordersLoading}>Apply filters</button>
          <button type="button" className="btn-neutral" onClick={() => { setOrderFilters(emptyOrderFilters); setAppliedOrderFilters(emptyOrderFilters); setOrderPage(0); }} disabled={ordersLoading}>Clear</button>
          {orderMeta.totalElements !== null ? <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{orderMeta.totalElements} POS orders</span> : null}
        </div>
        {ordersError ? <div style={{ color: '#b91c1c', fontWeight: 700 }}>{ordersError}</div> : null}
        <DataTable columns={orderColumns} rows={orders} page={orderPage} pageSize={orderSize} totalPages={orderMeta.totalPages} totalElements={orderMeta.totalElements} onPageChange={setOrderPage} canPrev={orderPage > 0} canNext={orderCanNext} emptyLabel={ordersLoading ? 'Loading POS orders…' : 'No POS orders found'} />
      </section>

      <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontSize: '18px', fontWeight: 800 }}>Registered customers</div>
        <form onSubmit={(event) => { event.preventDefault(); setCustomerPage(0); setAppliedCustomerSearch(customerSearch.trim()); }} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: '0.25rem', minWidth: '260px', flex: 1 }}><span>Search name, email or phone</span><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customers" /></label>
          <label style={{ display: 'grid', gap: '0.25rem', width: '120px' }}><span>Page size</span><input type="number" min="1" max="100" value={customerSize} onChange={(event) => { setCustomerSize(Math.min(100, Math.max(1, Number(event.target.value) || 20))); setCustomerPage(0); }} /></label>
          <button type="submit" className="btn-primary" disabled={customersLoading}>Search</button>
          <button type="button" className="btn-neutral" onClick={() => { setCustomerSearch(''); setAppliedCustomerSearch(''); setCustomerPage(0); }} disabled={customersLoading}>Clear</button>
          {customerMeta.totalElements !== null ? <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{customerMeta.totalElements} customers</span> : null}
        </form>
        {customersError ? <div style={{ color: '#b91c1c', fontWeight: 700 }}>{customersError}</div> : null}
        <DataTable columns={customerColumns} rows={customers} page={customerPage} pageSize={customerSize} totalPages={customerMeta.totalPages} totalElements={customerMeta.totalElements} onPageChange={setCustomerPage} canPrev={customerPage > 0} canNext={customerCanNext} emptyLabel={customersLoading ? 'Loading customers…' : 'No customers found'} />
      </section>
    </div>
  );
}
