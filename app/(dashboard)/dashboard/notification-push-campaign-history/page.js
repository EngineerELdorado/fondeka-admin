'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;
const RUNNING_REFRESH_MS = 12000;
const DETAIL_REFRESH_MS = 10000;

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

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const truncate = (value, max = 80) => {
  const text = String(value || '');
  if (text.length <= max) return text || '—';
  return `${text.slice(0, max - 1)}…`;
};

const calcProgress = (item) => {
  const total = Number(item?.totalJobs) || 0;
  const processed = Number(item?.processedJobs) || 0;
  const failed = Number(item?.failedJobs) || 0;
  const done = processed + failed;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return { total, processed, failed, done, percent };
};

export default function NotificationPushCampaignHistoryPage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [campaigns, setCampaigns] = useState([]);
  const [totalCampaigns, setTotalCampaigns] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(size) || DEFAULT_PAGE_SIZE));
      const params = new URLSearchParams({ page: String(Math.max(0, Number(page) || 0)), size: String(safeSize) });
      const res = await api.notifications.listPushCampaigns(params);
      const list = Array.isArray(res?.campaigns) ? res.campaigns : [];
      setCampaigns(list);
      setTotalCampaigns(Number.isFinite(Number(res?.totalCampaigns)) ? Number(res.totalCampaigns) : null);
      setHasNext(Boolean(res?.hasNext));
    } catch (err) {
      setCampaigns([]);
      setTotalCampaigns(null);
      setHasNext(false);
      setError(err?.message || 'Failed to load push campaign history');
    } finally {
      setLoading(false);
    }
  }, [page, size]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const refreshCampaignDetail = useCallback(async (campaignId) => {
    if (!campaignId) return null;
    setDetailLoading(true);
    try {
      const res = await api.notifications.getPushCampaign(campaignId);
      if (!res) return null;
      setCampaigns((prev) => prev.map((row) => (row.campaignId === campaignId ? { ...row, ...res } : row)));
      setSelectedCampaign((prev) => (prev?.campaignId === campaignId ? { ...prev, ...res } : prev));
      return res;
    } catch (err) {
      setError(err?.message || 'Failed to refresh campaign status');
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const runningIds = campaigns.filter((item) => !item?.completed && item?.campaignId).map((item) => item.campaignId);
    if (runningIds.length === 0) return undefined;
    const timer = setInterval(async () => {
      try {
        const results = await Promise.all(runningIds.map((id) => api.notifications.getPushCampaign(id).catch(() => null)));
        const updates = new Map(results.filter(Boolean).map((item) => [item.campaignId, item]));
        if (updates.size === 0) return;
        setCampaigns((prev) => prev.map((row) => (updates.has(row.campaignId) ? { ...row, ...updates.get(row.campaignId) } : row)));
        setSelectedCampaign((prev) => (prev && updates.has(prev.campaignId) ? { ...prev, ...updates.get(prev.campaignId) } : prev));
      } catch {
        // no-op; preserve latest visible data
      }
    }, RUNNING_REFRESH_MS);
    return () => clearInterval(timer);
  }, [campaigns]);

  useEffect(() => {
    if (!selectedCampaign?.campaignId || selectedCampaign?.completed) return undefined;
    const timer = setInterval(() => {
      refreshCampaignDetail(selectedCampaign.campaignId);
    }, DETAIL_REFRESH_MS);
    return () => clearInterval(timer);
  }, [selectedCampaign?.campaignId, selectedCampaign?.completed, refreshCampaignDetail]);

  const canPrev = page > 0;
  const canNext = hasNext;

  const selectedProgress = useMemo(() => calcProgress(selectedCampaign), [selectedCampaign]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Push Campaign History</div>
          <div style={{ color: 'var(--muted)' }}>Historical campaigns with live status updates for running rows.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/notification-push-campaigns" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
            Launch campaigns
          </Link>
          <button type="button" className="btn-neutral btn-sm" onClick={fetchHistory} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="historyPage">Page</label>
          <input id="historyPage" type="number" min={0} value={page} onChange={(e) => setPage(Math.max(0, Number(e.target.value) || 0))} style={{ width: '110px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="historySize">Size</label>
          <input
            id="historySize"
            type="number"
            min={1}
            max={MAX_PAGE_SIZE}
            value={size}
            onChange={(e) => setSize(Math.min(MAX_PAGE_SIZE, Math.max(1, Number(e.target.value) || DEFAULT_PAGE_SIZE)))}
            style={{ width: '110px' }}
          />
        </div>
        <button type="button" className="btn-neutral" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={loading || !canPrev}>
          ← Prev
        </button>
        <button type="button" className="btn-neutral" onClick={() => setPage((p) => p + 1)} disabled={loading || !canNext}>
          Next →
        </button>
        <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
          {totalCampaigns !== null ? `${totalCampaigns} campaigns total` : 'Total campaigns: —'} · page {page + 1}
        </span>
      </div>

      <div className="card table-scroll">
        <div className="table-scroll__hint">Swipe to see more</div>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Campaign ID</th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Subject</th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Message</th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Created At</th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Updated At</th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Total / Pending / Processing / Processed / Failed</th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Progress</th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)' }}>
                  {loading ? 'Loading campaigns…' : 'No campaign history found'}
                </td>
              </tr>
            )}
            {campaigns.map((row) => {
              const progress = calcProgress(row);
              const hasFailures = (Number(row.failedJobs) || 0) > 0;
              return (
                <tr
                  key={row.campaignId}
                  onClick={() => {
                    setSelectedCampaign(row);
                    refreshCampaignDetail(row.campaignId);
                  }}
                  style={{
                    cursor: 'pointer',
                    borderTop: '1px solid var(--border)',
                    background: hasFailures ? 'rgba(239, 68, 68, 0.06)' : 'transparent'
                  }}
                >
                  <td className="data-table__cell" style={{ padding: '0.65rem', fontWeight: 700 }}>{row.campaignId || '—'}</td>
                  <td className="data-table__cell" style={{ padding: '0.65rem' }} title={row.subject || ''}>{truncate(row.subject, 50)}</td>
                  <td className="data-table__cell" style={{ padding: '0.65rem' }} title={row.message || ''}>{truncate(row.message, 70)}</td>
                  <td className="data-table__cell" style={{ padding: '0.65rem' }}>{formatDateTime(row.createdAt)}</td>
                  <td className="data-table__cell" style={{ padding: '0.65rem' }}>{formatDateTime(row.updatedAt)}</td>
                  <td className="data-table__cell" style={{ padding: '0.65rem', whiteSpace: 'nowrap' }}>
                    {(Number(row.totalJobs) || 0)} / {(Number(row.pendingJobs) || 0)} / {(Number(row.processingJobs) || 0)} / {(Number(row.processedJobs) || 0)} / {(Number(row.failedJobs) || 0)}
                  </td>
                  <td className="data-table__cell" style={{ padding: '0.65rem', minWidth: '170px' }}>
                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{progress.percent}%</div>
                      <div style={{ width: '100%', height: '8px', borderRadius: '999px', background: 'color-mix(in srgb, var(--surface) 78%, var(--border) 22%)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${progress.percent}%`,
                            background: row.completed ? '#16a34a' : '#0ea5e9',
                            transition: 'width 0.2s ease'
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="data-table__cell" style={{ padding: '0.65rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        padding: '0.2rem 0.45rem',
                        borderRadius: '999px',
                        fontWeight: 700,
                        fontSize: '12px',
                        color: row.completed ? '#166534' : '#1e3a8a',
                        background: row.completed ? '#dcfce7' : '#dbeafe'
                      }}
                    >
                      {row.completed ? 'Completed' : 'Running'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedCampaign && (
        <Modal title={`Campaign ${selectedCampaign.campaignId || ''}`} onClose={() => setSelectedCampaign(null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                Auto-refresh every 10s while running
              </div>
              <button type="button" className="btn-neutral btn-sm" onClick={() => refreshCampaignDetail(selectedCampaign.campaignId)} disabled={detailLoading}>
                {detailLoading ? 'Refreshing…' : 'Refresh now'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
              <div><strong>Campaign ID:</strong> {selectedCampaign.campaignId || '—'}</div>
              <div><strong>Status:</strong> {selectedCampaign.completed ? 'Completed' : 'Running'}</div>
              <div><strong>Created:</strong> {formatDateTime(selectedCampaign.createdAt)}</div>
              <div><strong>Updated:</strong> {formatDateTime(selectedCampaign.updatedAt)}</div>
              <div><strong>Total:</strong> {selectedProgress.total}</div>
              <div><strong>Pending:</strong> {Number(selectedCampaign.pendingJobs) || 0}</div>
              <div><strong>Processing:</strong> {Number(selectedCampaign.processingJobs) || 0}</div>
              <div><strong>Processed:</strong> {selectedProgress.processed}</div>
              <div><strong>Failed:</strong> {selectedProgress.failed}</div>
            </div>
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)' }}>
                <span>Progress ({selectedProgress.done}/{selectedProgress.total || 0})</span>
                <span>{selectedProgress.percent}%</span>
              </div>
              <div style={{ width: '100%', height: '10px', borderRadius: '999px', background: 'color-mix(in srgb, var(--surface) 78%, var(--border) 22%)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${selectedProgress.percent}%`,
                    background: selectedCampaign.completed ? '#16a34a' : '#0ea5e9',
                    transition: 'width 0.2s ease'
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <div><strong>Subject:</strong> {selectedCampaign.subject || '—'}</div>
              <div><strong>Message:</strong> {selectedCampaign.message || '—'}</div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
