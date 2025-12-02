'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyEvict = {
  allCaches: false,
  cacheName: '',
  key: ''
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default function RedisCachesPage() {
  const [caches, setCaches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [evictDraft, setEvictDraft] = useState(emptyEvict);
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmCache, setConfirmCache] = useState(false);

  const fetchCaches = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.caches.list();
      setCaches(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaches();
  }, []);

  useEffect(() => {
    if (!info && !error) return;
    const t = setTimeout(() => {
      setInfo(null);
      setError(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [info, error]);

  const columns = useMemo(
    () => [
      { key: 'name', label: 'Cache name' },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setEvictDraft({ ...emptyEvict, cacheName: row.name });
                setConfirmCache(true);
                setInfo(null);
                setError(null);
              }}
              className="btn-danger"
            >
              Clear cache
            </button>
            <button
              type="button"
              onClick={() => {
                setEvictDraft({ ...emptyEvict, cacheName: row.name, key: '' });
                setInfo(`Specify a key for ${row.name} below and press Evict key.`);
              }}
              className="btn-neutral"
            >
              Evict key…
            </button>
          </div>
        )
      }
    ],
    []
  );

  const rows = caches.map((name) => ({ name }));

  const evictAll = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.caches.evict({ allCaches: true });
      setInfo('Cleared all caches.');
      setConfirmAll(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const evictCache = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.caches.evict({ cacheName: evictDraft.cacheName || null });
      setInfo(`Cleared cache ${evictDraft.cacheName || '(unspecified)'}.`);
      setConfirmCache(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const evictKey = async () => {
    if (!evictDraft.cacheName || !evictDraft.key) {
      setError('Cache name and key are required to evict a key.');
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.caches.evict({ cacheName: evictDraft.cacheName, key: evictDraft.key });
      setInfo(`Evicted key from ${evictDraft.cacheName}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Redis Caches</div>
          <div style={{ color: 'var(--muted)' }}>View cache names and evict caches or keys.</div>
        </div>
        <Link href="/dashboard" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Dashboard
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={fetchCaches} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh caches'}
        </button>
        <button type="button" onClick={() => setConfirmAll(true)} className="btn-danger">
          Clear all caches
        </button>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="evictCacheName">Cache</label>
          <select
            id="evictCacheName"
            value={evictDraft.cacheName}
            onChange={(e) => setEvictDraft((p) => ({ ...p, cacheName: e.target.value }))}
            style={{ minWidth: '200px' }}
          >
            <option value="">Select cache</option>
            {caches.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label htmlFor="evictKey">Key</label>
          <input
            id="evictKey"
            value={evictDraft.key}
            onChange={(e) => setEvictDraft((p) => ({ ...p, key: e.target.value }))}
            placeholder="Optional key to evict"
            style={{ minWidth: '220px' }}
          />
          <button type="button" onClick={evictKey} className="btn-neutral">
            Evict key
          </button>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} emptyLabel="No caches found" />

      {confirmAll && (
        <Modal title="Clear all caches" onClose={() => setConfirmAll(false)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>This will clear every cache. Proceed?</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmAll(false)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={evictAll} className="btn-danger">
              Clear all
            </button>
          </div>
        </Modal>
      )}

      {confirmCache && (
        <Modal title={`Clear cache ${evictDraft.cacheName || ''}`} onClose={() => setConfirmCache(false)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            Clear all entries in <strong>{evictDraft.cacheName || 'this cache'}</strong>?
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmCache(false)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={evictCache} className="btn-danger">
              Clear cache
            </button>
          </div>
        </Modal>
      )}

      {(info || error) && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            zIndex: 50
          }}
        >
          {info && (
            <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: '#ECFDF3', color: '#166534', minWidth: '240px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
              {info}
            </div>
          )}
          {error && (
            <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: '#FEF2F2', color: '#991B1B', minWidth: '240px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
