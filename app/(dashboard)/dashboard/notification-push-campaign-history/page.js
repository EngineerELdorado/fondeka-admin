'use client';

import ResponsiveTable from '@/components/ResponsiveTable';

import { RegulatorRecord, PresentationLink as Link } from '@/components/RegulatorPresentation';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { campaignKey, campaignPermissions, campaignRunning, campaignStatus } from '@/lib/push-campaigns';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;
const RUNNING_REFRESH_MS = 12000;

const Modal = ({ title, onClose, children }) => {
  const titleId = useId();
  const surface = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    surface.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close.current();
    } else if (event.key === 'Tab') {
      const controls = Array.from(surface.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((element) => !element.disabled && element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === surface.current)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === surface.current)) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  return <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={surface} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="modal-surface" onKeyDown={handleKeyDown}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <h2 id={titleId} style={{ margin: 0, fontSize: '1.1rem', overflowWrap: 'anywhere' }}>{title}</h2>
        <button type="button" aria-label="Close modal" onClick={onClose} className="btn-neutral btn-sm">×</button>
      </div>
      {children}
    </div>
  </div>;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const truncate = (value, max = 80) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const characters = Array.from(text);
  if (characters.length <= max) return text || '—';
  return `${characters.slice(0, max - 1).join('').trimEnd()}…`;
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
  const { session, refreshSession } = useAuth();
  const { canRead, canDelete } = campaignPermissions(session);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [campaigns, setCampaigns] = useState([]);
  const [totalCampaigns, setTotalCampaigns] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null), [deleting, setDeleting] = useState(false), [deleteDenied, setDeleteDenied] = useState(false);
  const [mutationError, setMutationError] = useState(null), [info, setInfo] = useState(null);
  const alive = useRef(true), listRequest = useRef(null), detailBusy = useRef(false), deleteLock = useRef(false), selectedKey = useRef('');
  const queryKey = `${page}:${size}`, currentQuery = useRef(queryKey);
  currentQuery.current = queryKey;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const fetchHistory = useCallback(async ({ force = false } = {}) => {
    const key = `${page}:${size}`;
    if (!canRead || !alive.current) return null;
    while (listRequest.current) {
      const pending = listRequest.current, result = await pending.promise;
      if (!alive.current || currentQuery.current !== key) return null;
      if (pending.key === key && !force) return result;
    }
    if (currentQuery.current !== key) return null;
    const request = { key, promise: null };
    listRequest.current = request;
    setLoading(true);
    request.promise = (async () => {
      try {
        const res = await api.notifications.listPushCampaigns(new URLSearchParams({ page: String(page), size: String(size) }));
        if (!Array.isArray(res?.campaigns)) throw new Error('The campaign history response could not be read.');
        if (!alive.current || currentQuery.current !== key) return null;
        if (!res.campaigns.length && page > 0) { setPage(page - 1); return res; }
        setCampaigns(res.campaigns);
        setTotalCampaigns(res.totalCampaigns != null && Number.isFinite(Number(res.totalCampaigns)) ? Number(res.totalCampaigns) : null);
        setHasNext(Boolean(res.hasNext));
        setError(null);
        setSelectedCampaign((previous) => previous ? res.campaigns.find((row) => campaignKey(row) === campaignKey(previous)) || null : null);
        return res;
      } catch (err) {
        if (alive.current && currentQuery.current === key) setError((err?.message || 'Failed to load push campaign history') + ' Any displayed progress is from the last successful refresh.');
        return null;
      } finally {
        if (listRequest.current === request) listRequest.current = null;
        if (alive.current && currentQuery.current === key) setLoading(false);
      }
    })();
    return request.promise;
  }, [page, size, canRead]);

  useEffect(() => {
    setCampaigns([]); setTotalCampaigns(null); setHasNext(false); setError(null); setSelectedCampaign(null); selectedKey.current = '';
    void fetchHistory();
  }, [fetchHistory]);

  const refreshCampaignDetail = useCallback(async (row) => {
    if (!row?.campaignId || detailBusy.current || !canRead) return null;
    const key = campaignKey(row);
    detailBusy.current = true;
    setDetailLoading(true);
    try {
      const res = await api.notifications.getPushCampaign(row.campaignId);
      if (!res || res.campaignId !== row.campaignId) throw new Error('The campaign detail response could not be read.');
      if (!alive.current || selectedKey.current !== key) return null;
      setCampaigns((prev) => prev.map((item) => campaignKey(item) === key ? { ...item, ...res } : item));
      setSelectedCampaign((prev) => campaignKey(prev) === key ? { ...prev, ...res } : prev);
      return res;
    } catch (err) {
      if (alive.current && selectedKey.current === key) setError(err?.message || 'Failed to refresh campaign status');
      return null;
    } finally {
      detailBusy.current = false;
      if (alive.current) setDetailLoading(false);
    }
  }, [canRead]);

  const hasRunning = campaigns.some(campaignRunning);
  useEffect(() => {
    if (!hasRunning || !canRead) return undefined;
    let cancelled = false, timer, failures = 0;
    const poll = async () => {
      if (cancelled) return;
      if ((typeof document !== 'undefined' && document.hidden) || deleteLock.current) { timer = setTimeout(poll, RUNNING_REFRESH_MS); return; }
      const res = await fetchHistory();
      if (cancelled || res && !res.campaigns.some(campaignRunning)) return;
      failures = res ? 0 : failures + 1;
      timer = setTimeout(poll, Math.min(60000, RUNNING_REFRESH_MS * (2 ** Math.min(failures, 3))));
    };
    timer = setTimeout(poll, RUNNING_REFRESH_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [hasRunning, canRead, fetchHistory]);

  const openDelete = (row) => {
    if (!canDelete || deleteDenied || deleteLock.current || row.deletable !== true || !['ACCOUNT', 'ANONYMOUS'].includes(row.campaignType)) return;
    setDeleteTarget({ ...row }); setMutationError(null); setInfo(null);
  };
  const removeCampaign = async () => {
    if (!canDelete || deleteDenied || deleteLock.current || !deleteTarget || deleteTarget.deletable !== true) return;
    deleteLock.current = true; setDeleting(true); setMutationError(null); setInfo(null);
    try {
      await api.notifications.deletePushCampaign(deleteTarget.campaignId, deleteTarget.campaignType);
      if (!alive.current) return;
      setDeleteTarget(null); setSelectedCampaign(null); selectedKey.current = '';
      setInfo('Campaign removed from history. Delivery jobs, deduplication history and linked announcements are preserved.');
      await fetchHistory({ force: true });
    } catch (err) {
      if (err.status === 401 || err.status === 403) { try { await refreshSession?.(true); } catch { /* Preserve the deletion error. */ } }
      if (!alive.current) return;
      setMutationError((err?.message || 'Could not delete this campaign.') + (!err.status || err.status >= 500 ? ' The outcome is unconfirmed. Review refreshed history before trying again.' : ''));
      setDeleteTarget(null);
      if (err.status === 403) setDeleteDenied(true);
      if (err.status !== 403 && err.status !== 401) await fetchHistory({ force: true });
    } finally { deleteLock.current = false; if (alive.current) setDeleting(false); }
  };

  const canPrev = page > 0;
  const canNext = hasNext;

  const selectedProgress = useMemo(() => calcProgress(selectedCampaign), [selectedCampaign]);
  if (!canRead) return <div className="card" role="alert">Admin, Super Admin or Assistant access is required to inspect campaigns.</div>;

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
          <button type="button" className="btn-neutral btn-sm" onClick={() => void fetchHistory({ force: true })} disabled={loading || deleting}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}
      {mutationError && <div className="card" role="alert">{mutationError}</div>}
      {info && <div className="card" role="status">{info}</div>}
      {(!canDelete || deleteDenied) && <div className="card">Read only. Admin or Super Admin access is required to delete finished campaigns.</div>}

      <div className="card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="historyPage">Page</label>
          <input id="historyPage" type="number" min={0} step={1} value={page} disabled={deleting} onChange={(e) => setPage(Math.max(0, Math.trunc(Number(e.target.value) || 0)))} style={{ width: '110px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="historySize">Size</label>
          <input
            id="historySize"
            type="number"
            min={1}
            max={MAX_PAGE_SIZE}
            value={size}
            disabled={deleting}
            onChange={(e) => { setSize(Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(e.target.value) || DEFAULT_PAGE_SIZE)))); setPage(0); }}
            style={{ width: '110px' }}
          />
        </div>
        <button type="button" className="btn-neutral" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={loading || deleting || !canPrev}>
          ← Prev
        </button>
        <button type="button" className="btn-neutral" onClick={() => setPage((p) => p + 1)} disabled={loading || deleting || !canNext}>
          Next →
        </button>
        <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
          {totalCampaigns !== null ? `${totalCampaigns} campaigns total` : 'Total campaigns: —'} · page {page + 1}
        </span>
      </div>

      <div className="card table-scroll">
            <ResponsiveTable className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Subject</th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Message</th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Created At</th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Updated At</th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Total / Pending / Processing / Processed / Failed</th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem', minWidth: '7rem' }}>Progress</th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Status</th>
              {canDelete && !deleteDenied && <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.65rem' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={canDelete && !deleteDenied ? 8 : 7} style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)' }}>
                  {loading ? 'Loading campaigns…' : error ? 'Campaign history is unavailable. Refresh to try again.' : 'No campaign history found'}
                </td>
              </tr>
            )}
            {campaigns.map((row) => {
              const progress = calcProgress(row);
              const hasFailures = (Number(row.failedJobs) || 0) > 0;
              const message = String(row.message || '');
              const messagePreview = truncate(message, 50);
              const canReadMore = Boolean(message.trim()) && (message.replace(/\s+/g, ' ').trim() !== messagePreview || /[\r\n]/.test(message));
              return (
                <RegulatorRecord record={row} key={campaignKey(row)}><tr
                  key={campaignKey(row)}
                  onClick={() => {
                    selectedKey.current = campaignKey(row);
                    setSelectedCampaign(row);
                    void refreshCampaignDetail(row);
                  }}
                  style={{
                    cursor: 'pointer',
                    borderTop: '1px solid var(--border)',
                    background: (hasFailures || row.preparationStatus === 'FAILED') ? 'rgba(239, 68, 68, 0.06)' : 'transparent'
                  }}
                >
                  <td className="data-table__cell" style={{ padding: '0.65rem' }} title={row.subject || ''}>{truncate(row.subject, 50)}</td>
                  <td className="data-table__cell" style={{ padding: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>{messagePreview}</span>
                      {canReadMore ? <button type="button" className="btn-neutral btn-sm" aria-haspopup="dialog" onClick={(event) => { event.stopPropagation(); setSelectedMessage(row); }}>Read more</button> : null}
                    </div>
                  </td>
                  <td className="data-table__cell" style={{ padding: '0.65rem' }}>{formatDateTime(row.createdAt)}</td>
                  <td className="data-table__cell" style={{ padding: '0.65rem' }}>{formatDateTime(row.updatedAt)}</td>
                  <td className="data-table__cell" style={{ padding: '0.65rem', whiteSpace: 'nowrap' }}>
                    {(Number(row.totalJobs) || 0)} / {(Number(row.pendingJobs) || 0)} / {(Number(row.processingJobs) || 0)} / {(Number(row.processedJobs) || 0)} / {(Number(row.failedJobs) || 0)}
                  </td>
                  <td className="data-table__cell" style={{ padding: '0.65rem', minWidth: 'min(170px, 100%)' }}>
                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{row.enqueuing ? 'Preparing · delivery so far: ' : ''}{progress.percent}%{row.scannedRecords != null ? ` · ${row.scannedRecords} scanned` : ''}</div>
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
                        color: row.preparationStatus === 'FAILED' ? '#991b1b' : row.completed ? '#166534' : '#1e3a8a',
                        background: row.preparationStatus === 'FAILED' ? '#fee2e2' : row.completed ? '#dcfce7' : '#dbeafe'
                      }}
                    >
                      {campaignStatus(row)}
                    </span>
                    {row.preparationError && <small role="alert">{row.preparationError}</small>}
                  </td>
                  {canDelete && !deleteDenied && <td className="data-table__cell" style={{ padding: '.65rem' }}><button type="button" className="btn-danger btn-sm" disabled={deleting || row.deletable !== true || !['ACCOUNT', 'ANONYMOUS'].includes(row.campaignType)} onClick={(event) => { event.stopPropagation(); openDelete(row); }}>Delete</button></td>}
                </tr></RegulatorRecord>
              );
            })}
          </tbody>
        </ResponsiveTable>
      </div>
      <small style={{ color: 'var(--muted)' }}>Preparation counts can grow. Processed jobs measure acknowledged outbox work, not device delivery or read receipts. Running rows and open details share one summary-page refresh.</small>

      {selectedMessage && (
        <Modal title="Campaign message" onClose={() => setSelectedMessage(null)}>
          <strong style={{ overflowWrap: 'anywhere' }}>{selectedMessage.subject || 'No subject'}</strong>
          <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{selectedMessage.message || '—'}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="btn-neutral" onClick={() => setSelectedMessage(null)}>Close</button></div>
        </Modal>
      )}

      {selectedCampaign && (
        <Modal title={`Campaign ${selectedCampaign.campaignId || ''}`} onClose={() => { selectedKey.current = ''; setSelectedCampaign(null); }}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                Refreshes with the history page while running; pauses while this tab is hidden
              </div>
              <button type="button" className="btn-neutral btn-sm" onClick={() => void refreshCampaignDetail(selectedCampaign)} disabled={detailLoading}>
                {detailLoading ? 'Refreshing…' : 'Refresh now'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '0.6rem' }}>
              <div><strong>Campaign ID:</strong> {selectedCampaign.campaignId || '—'}</div>
              <div><strong>Campaign type:</strong> {String(selectedCampaign.campaignType || 'ACCOUNT').toUpperCase() === 'ANONYMOUS' ? 'Anonymous Push' : 'Account Push'}</div>
              <div><strong>Status:</strong> {campaignStatus(selectedCampaign)}</div>
              <div><strong>Preparation:</strong> {selectedCampaign.preparationStatus ?? '—'}</div>
              <div><strong>Scanned / matched:</strong> {selectedCampaign.scannedRecords ?? '—'} / {selectedCampaign.matchedRecipients ?? '—'}</div>
              <div><strong>Enqueued / skipped:</strong> {selectedCampaign.enqueuedJobs ?? '—'} / {selectedCampaign.skippedJobs ?? '—'}</div>
              <div><strong>Created:</strong> {formatDateTime(selectedCampaign.createdAt)}</div>
              <div><strong>Updated:</strong> {formatDateTime(selectedCampaign.updatedAt)}</div>
              <div><strong>Total:</strong> {selectedProgress.total}</div>
              <div><strong>Pending:</strong> {Number(selectedCampaign.pendingJobs) || 0}</div>
              <div><strong>Processing:</strong> {Number(selectedCampaign.processingJobs) || 0}</div>
              <div><strong>Processed:</strong> {selectedProgress.processed}</div>
              <div><strong>Failed:</strong> {selectedProgress.failed}</div>
            </div>
            {selectedCampaign.preparationError && <div role="alert">{selectedCampaign.preparationError}</div>}
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
              <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><strong>Message:</strong> {selectedCampaign.message || '—'}</div>
            </div>
          </div>
        </Modal>
      )}
      {deleteTarget && <Modal title="Delete finished campaign?" onClose={() => { if (!deleteLock.current) setDeleteTarget(null); }}>
        <p>Remove <strong>{deleteTarget.subject || deleteTarget.campaignId}</strong> from campaign history?</p>
        <p>{deleteTarget.campaignId} · {deleteTarget.campaignType} · {deleteTarget.totalJobs ?? '—'} recipient jobs</p>
        <p>Delivery jobs and deduplication history are kept. A linked in-app announcement is kept and managed separately.</p>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}><button type="button" className="btn-neutral" disabled={deleting} onClick={() => { if (!deleteLock.current) setDeleteTarget(null); }}>Cancel deletion</button><button type="button" className="btn-danger" disabled={deleting || !canDelete || deleteDenied} onClick={() => void removeCampaign()}>{deleting ? 'Deleting…' : 'Confirm delete campaign'}</button></div>
      </Modal>}
    </div>
  );
}
