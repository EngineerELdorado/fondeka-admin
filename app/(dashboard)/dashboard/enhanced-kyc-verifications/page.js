'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const statusOptions = ['PENDING', 'APPROVED', 'REJECTED'];
const reviewStatusOptions = ['PENDING', 'APPROVED', 'REJECTED'];

const emptyFilters = {
  status: 'PENDING'
};

const emptyReviewDraft = {
  status: 'APPROVED',
  reviewNote: ''
};

const emptyCreateDraft = {
  targetType: 'accountId',
  accountId: '',
  email: '',
  purpose: 'IBAN_ACCESS',
  countryCode: '',
  documentType: 'PASSPORT',
  proofOfAddressUrl: '',
  sourceOfFundsUrl: '',
  idDocumentFrontUrl: '',
  idDocumentBackUrl: '',
  selfieUrl: '',
  sourceOfFundsDescription: '',
  customerNote: ''
};

const emptyCreateFiles = {
  proofOfAddress: null,
  sourceOfFunds: null,
  idDocumentFront: null,
  idDocumentBack: null,
  selfie: null
};

const field = (row, keys, fallback = '—') => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return fallback;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatJson = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const StatusBadge = ({ value }) => {
  const status = String(value || '—').toUpperCase();
  const tone =
    status === 'APPROVED'
      ? { bg: '#ECFDF3', fg: '#15803D' }
      : status === 'PENDING'
        ? { bg: '#EFF6FF', fg: '#1D4ED8' }
        : status === 'REJECTED'
          ? { bg: '#FEF2F2', fg: '#B91C1C' }
          : { bg: '#E5E7EB', fg: '#374151' };
  return (
    <span style={{ display: 'inline-flex', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: tone.bg, color: tone.fg }}>
      {status}
    </span>
  );
};

const Modal = ({ title, onClose, children, surfaceStyle = null }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={surfaceStyle || undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          x
        </button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere', whiteSpace: row.pre ? 'pre-wrap' : 'normal' }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

const DocumentLink = ({ label, value, contentType, onOpen }) => {
  if (!value) return null;
  return (
    <button type="button" className="btn-neutral btn-sm" onClick={() => onOpen({ label, url: String(value), contentType })}>
      {label}
    </button>
  );
};

const isImageDocument = (url, contentType = '') => {
  if (String(contentType || '').toLowerCase().startsWith('image/')) return true;
  const clean = String(url || '').split('?')[0].toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/.test(clean);
};

const formatDocumentLabel = (document) => {
  const title = String(document?.title || '').trim();
  const type = String(document?.type || document?.code || '').trim();
  const fileName = String(document?.fileName || '').trim();
  const base = title || type || fileName || 'Document';
  return document?.required === false ? `${base} (optional)` : base;
};

export default function EnhancedKycVerificationsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewDraft, setReviewDraft] = useState(emptyReviewDraft);
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyCreateDraft);
  const [createFiles, setCreateFiles] = useState(emptyCreateFiles);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) params.set(key, String(value).trim());
      });
      const res = await api.enhancedKycVerifications.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message || 'Failed to load enhanced KYC verifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (row) => {
    const id = row?.id;
    if (!id) return;
    setActionLoading(true);
    setError(null);
    try {
      const detail = await api.enhancedKycVerifications.get(id);
      setSelected({ ...row, ...(detail || {}) });
      setShowDetail(true);
    } catch (err) {
      setError(err.message || `Failed to load enhanced KYC verification ${id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const openReview = (row, status = 'APPROVED') => {
    setReviewTarget(row);
    setReviewDraft({ status, reviewNote: '' });
    setError(null);
    setInfo(null);
  };

  const submitReview = async () => {
    if (!reviewTarget?.id) return;
    const status = String(reviewDraft.status || '').trim().toUpperCase();
    if (!reviewStatusOptions.includes(status)) {
      setError('Review status must be PENDING, APPROVED, or REJECTED.');
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.enhancedKycVerifications.review(reviewTarget.id, {
        status,
        reviewNote: reviewDraft.reviewNote.trim() || null
      });
      setInfo(`Enhanced KYC verification ${reviewTarget.id} marked ${status}.`);
      setReviewTarget(null);
      setShowDetail(false);
      await fetchRows();
    } catch (err) {
      setError(err.message || `Failed to review enhanced KYC verification ${reviewTarget.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const openDelete = (row) => {
    if (!row?.id || String(row.status || '').toUpperCase() !== 'PENDING') return;
    setDeleteTarget(row);
    setError(null);
    setInfo(null);
  };

  const submitDelete = async () => {
    if (!deleteTarget?.id || actionLoading) return;
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.enhancedKycVerifications.remove(deleteTarget.id);
      setInfo(`Enhanced KYC verification ${deleteTarget.id} deleted.`);
      setDeleteTarget(null);
      setShowDetail(false);
      await fetchRows();
    } catch (err) {
      setError(err.message || `Failed to delete enhanced KYC verification ${deleteTarget.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const openCreate = () => {
    setCreateDraft(emptyCreateDraft);
    setCreateFiles(emptyCreateFiles);
    setShowCreate(true);
    setError(null);
    setInfo(null);
  };

  const buildCreatePayload = () => {
    const payload = {
      purpose: createDraft.purpose.trim().toUpperCase(),
      countryCode: createDraft.countryCode.trim().toUpperCase(),
      documentType: createDraft.documentType.trim().toUpperCase()
    };
    [
      'proofOfAddressUrl',
      'sourceOfFundsUrl',
      'idDocumentFrontUrl',
      'idDocumentBackUrl',
      'selfieUrl',
      'sourceOfFundsDescription',
      'customerNote'
    ].forEach((key) => {
      const value = createDraft[key].trim();
      if (value) payload[key] = value;
    });
    return payload;
  };

  const submitCreate = async () => {
    const accountId = String(createDraft.accountId || '').trim();
    const email = String(createDraft.email || '').trim();
    const targetType = createDraft.targetType === 'email' ? 'email' : 'accountId';
    if (targetType === 'accountId' && !accountId) {
      setError('Account ID is required.');
      return;
    }
    if (targetType === 'email' && !email) {
      setError('Email is required.');
      return;
    }
    if (!createDraft.purpose.trim()) {
      setError('Purpose is required.');
      return;
    }
    if (!createDraft.countryCode.trim()) {
      setError('Country code is required.');
      return;
    }
    if (!createDraft.documentType.trim()) {
      setError('Document type is required.');
      return;
    }
    if (!createDraft.proofOfAddressUrl.trim() && !createFiles.proofOfAddress) {
      setError('Proof of address file or URL is required.');
      return;
    }
    if (!createDraft.sourceOfFundsUrl.trim() && !createFiles.sourceOfFunds) {
      setError('Source of funds file or URL is required.');
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      const created =
        targetType === 'email'
          ? await api.enhancedKycVerifications.createForEmail(email, buildCreatePayload(), createFiles)
          : await api.enhancedKycVerifications.createForAccount(accountId, buildCreatePayload(), createFiles);
      setInfo(`Created enhanced KYC verification ${created?.id || ''}`.trim() + '.');
      setShowCreate(false);
      await fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to create enhanced KYC verification.');
    } finally {
      setActionLoading(false);
    }
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size : page + 1 < pageMeta.totalPages;

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'account', label: 'Account', render: (row) => field(row, ['accountReference', 'accountRef', 'accountId']) },
    { key: 'user', label: 'User', render: (row) => field(row, ['userFullName', 'fullName', 'username', 'email', 'userEmail']) },
    { key: 'currency', label: 'Currency', render: (row) => field(row, ['currency', 'walletCurrency', 'targetCurrency']) },
    { key: 'createdAt', label: 'Submitted', render: (row) => formatDateTime(field(row, ['submittedAt', 'createdAt'], '')) },
    { key: 'reviewedAt', label: 'Reviewed', hideOnMobile: true, render: (row) => formatDateTime(row.reviewedAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        const isPending = String(row.status || '').toUpperCase() === 'PENDING';
        return (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral" onClick={() => openDetail(row)} disabled={actionLoading}>View</button>
            <button type="button" className="btn-neutral" onClick={() => openReview(row, 'PENDING')} disabled={actionLoading}>Set pending</button>
            <button type="button" className="btn-success" onClick={() => openReview(row, 'APPROVED')} disabled={actionLoading}>Approve</button>
            <button type="button" className="btn-danger" onClick={() => openReview(row, 'REJECTED')} disabled={actionLoading}>Reject</button>
            {isPending ? <button type="button" className="btn-danger" onClick={() => openDelete(row)} disabled={actionLoading}>Delete</button> : null}
          </div>
        );
      }
    }
  ], [actionLoading]);

  const proofOfAddress = field(selected, ['proofOfAddressUrl', 'proofOfAddress', 'addressProofUrl'], '');
  const sourceOfFunds = field(selected, ['sourceOfFundsUrl', 'sourceOfFunds', 'fundsProofUrl'], '');
  const docFront = field(selected, ['docFront', 'documentFront', 'idDocumentFrontUrl', 'idFrontUrl'], '');
  const docBack = field(selected, ['docBack', 'documentBack', 'idDocumentBackUrl', 'idBackUrl'], '');
  const selfie = field(selected, ['selfie', 'userSelfie', 'selfieUrl'], '');
  const selectedUserLabel = field(selected, ['userFullName', 'fullName', 'username', 'email', 'userEmail', 'accountReference', 'accountId'], '');
  const submittedDocuments = useMemo(() => {
    const dynamicDocuments = Array.isArray(selected?.documents)
      ? selected.documents
          .filter((document) => document?.url)
          .map((document, index) => ({
            key: document.key || document.type || document.code || document.url || index,
            label: formatDocumentLabel(document),
            url: document.url,
            contentType: document.contentType
          }))
      : [];
    if (dynamicDocuments.length) return dynamicDocuments;
    return [
      { key: 'proofOfAddress', label: 'Proof of address', url: proofOfAddress },
      { key: 'sourceOfFunds', label: 'Source of funds', url: sourceOfFunds },
      { key: 'docFront', label: 'ID front', url: docFront },
      { key: 'docBack', label: 'ID back', url: docBack },
      { key: 'selfie', label: 'Selfie', url: selfie }
    ].filter((document) => document.url);
  }, [selected?.documents, proofOfAddress, sourceOfFunds, docFront, docBack, selfie]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Enhanced KYC verifications</div>
          <div style={{ color: 'var(--muted)' }}>Separate IBAN/bank-transfer verification queue. Approval can unlock the IBAN account gate without using the normal KYC review workflow.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-success" onClick={openCreate} disabled={actionLoading}>Create submission</button>
          <Link href="/dashboard/kycs" className="btn-neutral">Normal KYC</Link>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>Filters</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
            <button type="button" className="btn-neutral btn-sm" onClick={fetchRows} disabled={loading || actionLoading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {showFilters && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="status">Status</label>
                <select id="status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                  <option value="">All</option>
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="page">Page</label>
                <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Math.max(0, Number(e.target.value) || 0))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="size">Size</label>
                <input id="size" type="number" min={1} max={200} value={size} onChange={(e) => { setSize(Math.max(1, Number(e.target.value) || 20)); setPage(0); }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn-neutral btn-sm" onClick={() => { setFilters(emptyFilters); setAppliedFilters(emptyFilters); setPage(0); }}>Reset</button>
              <button type="button" className="btn-primary btn-sm" onClick={() => { setAppliedFilters(filters); setPage(0); }}>Apply</button>
            </div>
          </>
        )}
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        totalPages={pageMeta.totalPages}
        totalElements={pageMeta.totalElements}
        onPageChange={setPage}
        canPrev={canPrev}
        canNext={canNext}
        emptyLabel={loading ? 'Loading enhanced KYC verifications...' : 'No enhanced KYC verifications found'}
        showAccountQuickNav={false}
      />

      {showDetail && (
        <Modal title={`Enhanced KYC ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <DetailGrid
              rows={[
                { label: 'ID', value: selected?.id },
                { label: 'Status', value: <StatusBadge value={selected?.status} /> },
                { label: 'Account ID', value: field(selected, ['accountId']) },
                { label: 'Account reference', value: field(selected, ['accountReference', 'accountRef']) },
                { label: 'User', value: field(selected, ['userFullName', 'fullName', 'username', 'email', 'userEmail']) },
                { label: 'Currency', value: field(selected, ['currency', 'walletCurrency', 'targetCurrency']) },
                { label: 'Submitted', value: formatDateTime(field(selected, ['submittedAt', 'createdAt'], '')) },
                { label: 'Reviewed', value: formatDateTime(selected?.reviewedAt) },
                { label: 'Reviewed by', value: field(selected, ['reviewedBy', 'reviewedByEmail', 'reviewer']) },
                { label: 'Review note', value: field(selected, ['reviewNote', 'reviewComments']) }
              ]}
            />
            <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
              <div style={{ fontWeight: 800 }}>Submitted documents</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {submittedDocuments.map((document) => (
                  <DocumentLink
                    key={document.key}
                    label={document.label}
                    value={document.url}
                    contentType={document.contentType}
                    onOpen={setPreviewDocument}
                  />
                ))}
                {submittedDocuments.length === 0 ? <span style={{ color: 'var(--muted)' }}>No document links in this response.</span> : null}
              </div>
            </div>
            <details className="card" style={{ padding: '0.75rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Raw response</summary>
              <pre style={{ margin: '0.75rem 0 0', whiteSpace: 'pre-wrap', overflow: 'auto' }}>{formatJson(selected)}</pre>
            </details>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              {String(selected?.status || '').toUpperCase() === 'PENDING' ? <button type="button" className="btn-danger" onClick={() => openDelete(selected)}>Delete</button> : null}
              <button type="button" className="btn-neutral" onClick={() => openReview(selected, 'PENDING')}>Set pending</button>
              <button type="button" className="btn-success" onClick={() => openReview(selected, 'APPROVED')}>Approve</button>
              <button type="button" className="btn-danger" onClick={() => openReview(selected, 'REJECTED')}>Reject</button>
            </div>
          </div>
        </Modal>
      )}

      {showCreate && (
        <Modal title="Create enhanced KYC submission" onClose={() => (!actionLoading ? setShowCreate(false) : null)}>
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Submit enhanced IBAN verification on behalf of a customer. Use files for multipart upload, or provide existing uploaded URLs for JSON-only submission.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="targetType">Create by</label>
                <select id="targetType" value={createDraft.targetType} onChange={(e) => setCreateDraft((p) => ({ ...p, targetType: e.target.value }))}>
                  <option value="accountId">Account ID</option>
                  <option value="email">Email</option>
                </select>
              </div>
              {createDraft.targetType === 'email' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="createEmail">Email</label>
                  <input
                    id="createEmail"
                    type="email"
                    value={createDraft.email}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, email: e.target.value }))}
                    placeholder="user@example.com"
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="accountId">Account ID</label>
                  <input
                    id="accountId"
                    type="number"
                    value={createDraft.accountId}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, accountId: e.target.value }))}
                  />
                </div>
              )}
              {[
                ['purpose', 'Purpose', 'text'],
                ['countryCode', 'Country code', 'text'],
                ['documentType', 'Document type', 'text']
              ].map(([key, label, type]) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor={key}>{label}</label>
                  <input
                    id={key}
                    type={type}
                    value={createDraft[key]}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, [key]: type === 'text' ? e.target.value.toUpperCase() : e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem' }}>
              {[
                ['proofOfAddress', 'Proof of address'],
                ['sourceOfFunds', 'Source of funds'],
                ['idDocumentFront', 'ID document front'],
                ['idDocumentBack', 'ID document back'],
                ['selfie', 'Selfie']
              ].map(([key, label]) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor={`${key}File`}>{label} file</label>
                  <input
                    id={`${key}File`}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setCreateFiles((p) => ({ ...p, [key]: e.target.files?.[0] || null }))}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem' }}>
              {[
                ['proofOfAddressUrl', 'Proof of address URL'],
                ['sourceOfFundsUrl', 'Source of funds URL'],
                ['idDocumentFrontUrl', 'ID document front URL'],
                ['idDocumentBackUrl', 'ID document back URL'],
                ['selfieUrl', 'Selfie URL']
              ].map(([key, label]) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor={key}>{label}</label>
                  <input id={key} type="url" value={createDraft[key]} onChange={(e) => setCreateDraft((p) => ({ ...p, [key]: e.target.value }))} placeholder="https://..." />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="sourceOfFundsDescription">Source of funds description</label>
              <textarea
                id="sourceOfFundsDescription"
                rows={3}
                value={createDraft.sourceOfFundsDescription}
                onChange={(e) => setCreateDraft((p) => ({ ...p, sourceOfFundsDescription: e.target.value }))}
                placeholder="Salary and business income"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="customerNote">Customer note</label>
              <textarea
                id="customerNote"
                rows={3}
                value={createDraft.customerNote}
                onChange={(e) => setCreateDraft((p) => ({ ...p, customerNote: e.target.value }))}
                placeholder="Submitted by admin on behalf of customer"
              />
            </div>

            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Proof of address and source of funds are required unless their URL fields are provided.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn-neutral" onClick={() => setShowCreate(false)} disabled={actionLoading}>Cancel</button>
              <button type="button" className="btn-success" onClick={submitCreate} disabled={actionLoading}>
                {actionLoading ? 'Submitting...' : 'Create submission'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {reviewTarget && (
        <Modal
          title={`${reviewDraft.status === 'APPROVED' ? 'Approve' : reviewDraft.status === 'REJECTED' ? 'Reject' : 'Set pending'} enhanced KYC ${reviewTarget.id}`}
          onClose={() => (!actionLoading ? setReviewTarget(null) : null)}
        >
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              This reviews the enhanced IBAN verification submission. It is separate from the normal KYC queue.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="reviewStatus">Status</label>
              <select id="reviewStatus" value={reviewDraft.status} onChange={(e) => setReviewDraft((p) => ({ ...p, status: e.target.value }))}>
                {reviewStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="reviewNote">Review note</label>
              <textarea id="reviewNote" rows={4} value={reviewDraft.reviewNote} onChange={(e) => setReviewDraft((p) => ({ ...p, reviewNote: e.target.value }))} placeholder="Documents verified." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn-neutral" onClick={() => setReviewTarget(null)} disabled={actionLoading}>Cancel</button>
              <button
                type="button"
                className={reviewDraft.status === 'APPROVED' ? 'btn-success' : reviewDraft.status === 'REJECTED' ? 'btn-danger' : 'btn-neutral'}
                onClick={submitReview}
                disabled={actionLoading}
              >
                {actionLoading ? 'Submitting...' : 'Submit review'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {previewDocument && (
        <Modal
          title={`${previewDocument.label}${selectedUserLabel ? ` - ${selectedUserLabel}` : ''}`}
          onClose={() => setPreviewDocument(null)}
          surfaceStyle={{ width: 'min(1100px, 96vw)', maxHeight: '92vh', overflow: 'hidden' }}
        >
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: '10px',
                overflow: 'auto',
                background: '#fff',
                maxHeight: 'calc(92vh - 150px)',
                minHeight: '260px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isImageDocument(previewDocument.url, previewDocument.contentType) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewDocument.url}
                  alt={previewDocument.label}
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: 'calc(92vh - 152px)',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain'
                  }}
                />
              ) : (
                <iframe
                  src={previewDocument.url}
                  title={previewDocument.label}
                  style={{ width: '100%', height: 'calc(92vh - 152px)', minHeight: '420px', border: 'none', display: 'block' }}
                />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <a href={previewDocument.url} target="_blank" rel="noreferrer" className="btn-neutral">
                Open externally
              </a>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title={`Delete enhanced KYC ${deleteTarget.id}`} onClose={() => (!actionLoading ? setDeleteTarget(null) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Only pending enhanced KYC submissions can be deleted. This clears the pending submission so the user can submit a fresh one.
            </div>
            <DetailGrid
              rows={[
                { label: 'Status', value: <StatusBadge value={deleteTarget.status} /> },
                { label: 'Account', value: field(deleteTarget, ['accountReference', 'accountRef', 'accountId']) },
                { label: 'User', value: field(deleteTarget, ['userFullName', 'fullName', 'username', 'email', 'userEmail']) },
                { label: 'Submitted', value: formatDateTime(field(deleteTarget, ['submittedAt', 'createdAt'], '')) }
              ]}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn-neutral" onClick={() => setDeleteTarget(null)} disabled={actionLoading}>Cancel</button>
              <button type="button" className="btn-danger" onClick={submitDelete} disabled={actionLoading}>
                {actionLoading ? 'Deleting...' : 'Delete pending submission'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
