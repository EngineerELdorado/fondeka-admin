'use client';

export default function ArrayPager({ page, size, length, busy, onChange }) {
  return <div className="failover-actions"><button type="button" className="btn-neutral btn-sm" disabled={busy || page === 0} onClick={() => onChange(page - 1)}>Previous recharge page</button><span>Page {page + 1} · {length} records on this page</span><button type="button" className="btn-neutral btn-sm" disabled={busy || length < size} onClick={() => onChange(page + 1)}>Next recharge page</button><small>The API returns an array without a total. A full page may be followed by an empty page.</small></div>;
}
