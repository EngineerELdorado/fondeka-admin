'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import openApiOps from '../../../../docs/admin-openapi-ops.json';

const domains = (openApiOps.domains || []).filter((d) => (d.operations || []).length > 0);

export default function CrudLandingPage() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return domains;
    return domains.filter((d) => d.label.toLowerCase().includes(term) || d.tag?.toLowerCase().includes(term));
  }, [search]);

  const schemaTimestamp = useMemo(() => {
    if (!openApiOps.generatedAt) return null;
    const dt = new Date(openApiOps.generatedAt);
    return Number.isNaN(dt.getTime()) ? openApiOps.generatedAt : dt.toLocaleString();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800, fontSize: '20px' }}>API Explorer</div>
        <div style={{ color: '#6b7280' }}>
          Browse every admin endpoint by OpenAPI tag. Pick a category to run requests with path, query and body helpers.
          {schemaTimestamp ? ` (Schema snapshot: ${schemaTimestamp})` : ''}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="Search category or tag"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: '240px' }}
          />
          <div style={{ color: '#6b7280', fontSize: '13px' }}>
            {filtered.length} of {domains.length} categories
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        {filtered.map((d) => (
          <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ fontWeight: 700 }}>{d.label}</div>
              <div style={{ color: '#6b7280', fontSize: '13px' }}>
                Tag: {d.tag} • {d.operations.length} endpoints
              </div>
            </div>
            <Link
              href={`/dashboard/crud/${d.key}`}
              style={{
                padding: '0.55rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                background: '#0f172a',
                color: '#fff',
                textDecoration: 'none'
              }}
            >
              Open
            </Link>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ color: '#6b7280', textAlign: 'center' }}>No categories match your search.</div>
        )}
      </div>
    </div>
  );
}
