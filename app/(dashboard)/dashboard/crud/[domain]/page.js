'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import openApiOps from '../../../../../docs/admin-openapi-ops.json';

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button
          type="button"
          onClick={onClose}
          style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

const domains = (openApiOps.domains || [])
  .map((domain) => ({
    ...domain,
    operations: (domain.operations || []).map((op) => ({
      ...op,
      key: `${domain.key}-${op.key}`,
      sampleBody: op.sampleBody || '',
      queryParams: op.queryParams || [],
      pathParams: op.pathParams || [],
      method: op.method || 'GET',
      path: op.path || '/'
    }))
  }))
  .filter((d) => d.operations.length > 0);

const pretty = (val) => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
};

const isPrimitive = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
const isFlatObject = (obj) => obj && typeof obj === 'object' && !Array.isArray(obj)
  && Object.values(obj).every(isPrimitive);

const initBodyState = (op) => {
  if (!op?.sampleBody) return { mode: 'json', text: '' };
  try {
    const parsed = JSON.parse(op.sampleBody);
    if (isFlatObject(parsed)) {
      const fields = {};
      Object.entries(parsed).forEach(([k, v]) => { fields[k] = v === null ? '' : String(v); });
      return { mode: 'fields', fields };
    }
    return { mode: 'json', text: JSON.stringify(parsed, null, 2) };
  } catch {
    return { mode: 'json', text: op.sampleBody };
  }
};

const bodyFromState = (state) => {
  if (!state) return undefined;
  if (state.mode === 'json') {
    const text = state.text || '';
    if (!text.trim()) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Body must be valid JSON.');
    }
  }
  const out = {};
  Object.entries(state.fields || {}).forEach(([k, v]) => {
    const trimmed = v === null || v === undefined ? '' : String(v);
    if (trimmed === '') {
      out[k] = '';
      return;
    }
    if (trimmed === 'true' || trimmed === 'false') {
      out[k] = trimmed === 'true';
      return;
    }
    if (!Number.isNaN(Number(trimmed)) && trimmed.trim() !== '') {
      out[k] = Number(trimmed);
      return;
    }
    out[k] = trimmed;
  });
  return out;
};

const deriveOps = (domain) => {
  const ops = domain?.operations || [];
  const listOp = ops.find((op) => op.method === 'GET' && (op.pathParams || []).length === 0);
  const detailOp = ops.find((op) => op.method === 'GET' && (op.pathParams || []).length > 0);
  const createOp = ops.find((op) => op.method === 'POST' && (op.pathParams || []).length === 0);
  const updateOp = ops.find((op) => ['PUT', 'PATCH'].includes(op.method) && (op.pathParams || []).length > 0);
  const deleteOp = ops.find((op) => op.method === 'DELETE' && (op.pathParams || []).length > 0);
  const primaryParam = detailOp?.pathParams?.[0]
    || updateOp?.pathParams?.[0]
    || deleteOp?.pathParams?.[0]
    || 'id';
  return { listOp, detailOp, createOp, updateOp, deleteOp, primaryParam };
};

export default function CrudDomainPage({ params }) {
  const router = useRouter();
  const domainKey = params?.domain;
  const activeDomain = domains.find((d) => d.key === domainKey);
  const fallbackDomain = domains[0];
  const schemaTimestamp = useMemo(() => {
    if (!openApiOps.generatedAt) return null;
    const dt = new Date(openApiOps.generatedAt);
    return Number.isNaN(dt.getTime()) ? openApiOps.generatedAt : dt.toLocaleString();
  }, []);

  const { listOp, detailOp, createOp, updateOp, deleteOp, primaryParam } = deriveOps(activeDomain);

  const [listRows, setListRows] = useState([]);
  const [listError, setListError] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [info, setInfo] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [createBody, setCreateBody] = useState(() => initBodyState(createOp));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updateValues, setUpdateValues] = useState({});

  useEffect(() => {
    if (!activeDomain && fallbackDomain) {
      router.replace(`/dashboard/crud/${fallbackDomain.key}`);
    }
  }, [activeDomain, fallbackDomain, router]);

  useEffect(() => {
    setCreateBody(initBodyState(createOp));
    setSelectedId('');
    setDetail(null);
    setInfo(null);
    setActionError(null);
    setShowCreateModal(false);
    setShowUpdateModal(false);
    setShowDetailModal(false);
    setUpdateValues({});
  }, [createOp, updateOp]);

  const fetchList = async () => {
    if (!listOp) return;
    setListLoading(true);
    setListError(null);
    setInfo(null);
    try {
      const query = new URLSearchParams();
      if (listOp.queryParams?.includes('page')) query.set('page', String(page));
      if (listOp.queryParams?.includes('size')) query.set('size', String(size));
      const res = await api.raw(listOp.method, listOp.path, { query: query.toString() ? query : undefined });
      const rows = Array.isArray(res) ? res : res?.content || [];
      setListRows(rows || []);
    } catch (err) {
      setListError(err.message);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [page, size, listOp]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => {
    if (!listRows?.length) return [];
    const sample = listRows[0];
    const keys = Object.keys(sample || {}).slice(0, 7);
    return [
      ...keys.map((key) => ({ key, label: key })),
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => {
          const rowId = row[primaryParam] ?? row.id;
          if (rowId === undefined) return '—';
          return (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {detailOp && <button type="button" onClick={() => handleView(row)}>View</button>}
              {updateOp && <button type="button" onClick={() => openUpdate(row)}>Update</button>}
              {deleteOp && (
                <button type="button" onClick={() => handleDelete(rowId)} style={{ color: '#b91c1c' }}>
                  Delete
                </button>
              )}
            </div>
          );
        }
      }
    ];
  }, [listRows, primaryParam, detailOp, updateOp, deleteOp]);

  const handleView = async (rowOrId) => {
    if (!detailOp) return;
    setActionError(null);
    setInfo(null);
    try {
      const id = typeof rowOrId === 'object' ? (rowOrId[primaryParam] ?? rowOrId.id) : rowOrId;
      setSelectedId(id);
      const path = detailOp.path.replace(`{${detailOp.pathParams[0]}}`, id);
      const res = await api.raw(detailOp.method, path);
      setDetail(res);
      setShowDetailModal(true);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleCreate = async () => {
    if (!createOp) return;
    setActionError(null);
    setInfo(null);
    try {
      const body = bodyFromState(createBody);
      await api.raw(createOp.method, createOp.path, { body });
      setInfo('Created successfully.');
      fetchList();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const openUpdate = (row) => {
    if (!updateOp) return;
    const rowId = row[primaryParam] ?? row.id;
    setSelectedId(rowId);
    const next = {};
    Object.keys(row || {}).forEach((k) => {
      if (k === primaryParam || k === 'id') return;
      const v = row[k];
      next[k] = v === null || v === undefined ? '' : String(v);
    });
    setUpdateValues(next);
    setShowUpdateModal(true);
  };

  const submitUpdate = async () => {
    if (!updateOp || !selectedId) return;
    setActionError(null);
    setInfo(null);
    try {
      const body = {};
      Object.entries(updateValues || {}).forEach(([k, v]) => {
        const trimmed = v === null || v === undefined ? '' : String(v);
        if (trimmed === '') {
          body[k] = '';
          return;
        }
        if (trimmed === 'true' || trimmed === 'false') {
          body[k] = trimmed === 'true';
          return;
        }
        if (!Number.isNaN(Number(trimmed)) && trimmed.trim() !== '') {
          body[k] = Number(trimmed);
          return;
        }
        body[k] = trimmed;
      });
      const path = updateOp.path.replace(`{${updateOp.pathParams[0]}}`, selectedId);
      await api.raw(updateOp.method, path, { body });
      setInfo(`Updated ${selectedId}.`);
      setShowUpdateModal(false);
      fetchList();
      if (detailOp) handleView(selectedId);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!deleteOp) return;
    setActionError(null);
    setInfo(null);
    try {
      const path = deleteOp.path.replace(`{${deleteOp.pathParams[0]}}`, id);
      await api.raw(deleteOp.method, path);
      setInfo(`Deleted ${id}.`);
      fetchList();
      if (selectedId === id) {
        setDetail(null);
        setSelectedId('');
      }
      setShowDetailModal(false);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const renderBodyFields = (state, setState, prefix) => {
    if (!state) return null;
    if (state.mode === 'json') {
      return (
        <textarea
          rows={8}
          value={state.text || ''}
          onChange={(e) => setState({ mode: 'json', text: e.target.value })}
        />
      );
    }
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
        {Object.entries(state.fields || {}).map(([key, val]) => (
          <div key={`${prefix}-${key}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor={`${prefix}-${key}`}>{key}</label>
            <input
              id={`${prefix}-${key}`}
              value={val}
              onChange={(e) => setState((prev) => ({
                ...prev,
                fields: { ...(prev.fields || {}), [key]: e.target.value }
              }))}
            />
          </div>
        ))}
      </div>
    );
  };

  if (!activeDomain) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="card" style={{ color: '#b91c1c' }}>
          Domain not found.
        </div>
        <Link href="/dashboard/crud" style={{ color: '#0f172a', textDecoration: 'underline' }}>Back to Explorer</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>{activeDomain.label}</div>
          <div style={{ color: '#6b7280' }}>OpenAPI tag: {activeDomain.tag} • {activeDomain.operations.length} endpoints</div>
          {schemaTimestamp && <div style={{ color: '#9ca3af', fontSize: '12px' }}>Schema snapshot: {schemaTimestamp}</div>}
        </div>
        <Link
          href="/dashboard/crud"
          style={{
            padding: '0.55rem 0.85rem',
            borderRadius: '10px',
            border: '1px solid #e5e7eb',
            background: '#fff',
            color: '#0f172a',
            textDecoration: 'none'
          }}
        >
          ← Back to Explorer
        </Link>
      </div>

      {listOp ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {listOp.queryParams?.includes('page') && (
              <div>
                <label htmlFor="page">Page</label>
                <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
              </div>
            )}
            {listOp.queryParams?.includes('size') && (
              <div>
                <label htmlFor="size">Size</label>
                <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
              </div>
            )}
            <button
              type="button"
              onClick={fetchList}
              disabled={listLoading}
              style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#0f172a', color: '#fff' }}
            >
              {listLoading ? 'Loading…' : 'Refresh'}
            </button>
            {createOp && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#22c55e', color: '#fff' }}
              >
                Add
              </button>
            )}
            {detailOp && (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end' }}>
                <div>
                  <label htmlFor="searchId">Search by ID</label>
                  <input id="searchId" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} placeholder={primaryParam} />
                </div>
                <button
                  type="button"
                  onClick={() => handleView(selectedId)}
                  disabled={!selectedId}
                  style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff' }}
                >
                  View
                </button>
              </div>
            )}
          </div>
          {listError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{listError}</div>}
          <DataTable columns={columns} rows={listRows || []} emptyLabel="No records found" />
        </div>
      ) : (
        <div className="card" style={{ color: '#b91c1c' }}>No list endpoint available for this category.</div>
      )}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}
      {actionError && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{actionError}</div>}

      {createOp && showCreateModal && (
        <Modal title={`Add ${activeDomain.label}`} onClose={() => setShowCreateModal(false)}>
          {renderBodyFields(createBody, setCreateBody, 'create')}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
              Cancel
            </button>
            <button type="button" onClick={handleCreate} style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#22c55e', color: '#fff' }}>
              Create
            </button>
          </div>
        </Modal>
      )}

      {updateOp && showUpdateModal && (
        <Modal title={`Update ${activeDomain.label}`} onClose={() => setShowUpdateModal(false)}>
          <div style={{ color: '#6b7280', fontSize: '13px', marginBottom: '0.5rem' }}>Editing ID: {selectedId}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
            {Object.entries(updateValues || {}).map(([key, val]) => (
              <div key={`update-${key}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor={`update-${key}`}>{key}</label>
                <input
                  id={`update-${key}`}
                  value={val}
                  onChange={(e) => setUpdateValues((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" onClick={() => setShowUpdateModal(false)} style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
              Cancel
            </button>
            <button type="button" onClick={submitUpdate} style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#f97316', color: '#fff' }}>
              Save
            </button>
          </div>
        </Modal>
      )}

      {detail && showDetailModal && (
        <Modal title={`Details (${selectedId || primaryParam})`} onClose={() => setShowDetailModal(false)}>
          <pre style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
            {pretty(detail)}
          </pre>
        </Modal>
      )}
    </div>
  );
}
