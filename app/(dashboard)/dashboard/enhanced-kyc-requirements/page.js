'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const PURPOSE_OPTIONS = ['ACCOUNT_FORCE', 'BANK_ACCOUNT'];
const CODE_OPTIONS = [
  'PROOF_OF_ADDRESS',
  'SOURCE_OF_FUNDS',
  'ID_DOCUMENT_FRONT',
  'ID_DOCUMENT_BACK',
  'SELFIE',
  'POLICE_RECORD',
  'BUSINESS_PERMIT',
  'TAX_CERTIFICATE',
  'BANK_STATEMENT',
  'PAYSLIP'
];
const SOURCE_OPTIONS = ['GALLERY', 'FILES', 'CAMERA'];
const FORMAT_OPTIONS = ['jpg', 'jpeg', 'png', 'pdf'];
const CONTENT_TYPE_OPTIONS = ['image/jpeg', 'image/png', 'application/pdf'];
const ENHANCED_KYC_REQUIRED_FLAG_KEY = 'account.enhanced_kyc_verification.required';

const emptyDraft = {
  purpose: 'BANK_ACCOUNT',
  countryCode: '',
  accountId: '',
  email: '',
  code: 'PROOF_OF_ADDRESS',
  titleEn: '',
  titleFr: '',
  descriptionEn: '',
  descriptionFr: '',
  required: true,
  groupCode: '',
  groupTitleEn: '',
  groupTitleFr: '',
  minRequiredInGroup: '',
  supportedFormats: 'jpg, jpeg, png, pdf',
  supportedContentTypes: 'image/jpeg, image/png, application/pdf',
  allowedSources: 'GALLERY, FILES',
  active: true,
  rank: '10'
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          x
        </button>
      </div>
      {children}
    </div>
  </div>
);

const splitList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const formatList = (value) => (Array.isArray(value) && value.length ? value.join(', ') : '-');

const formatScope = (row) => {
  if (row?.accountId !== null && row?.accountId !== undefined && String(row.accountId).trim() !== '') return `Account ${row.accountId}`;
  if (row?.email) return `Email ${row.email}`;
  if (row?.countryCode) return `Country ${String(row.countryCode).toUpperCase()}`;
  return 'Global';
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const buildPayload = (draft) => {
  const countryCode = String(draft.countryCode || '').trim().toUpperCase();
  const accountId = String(draft.accountId || '').trim();
  const email = String(draft.email || '').trim();
  const groupCode = String(draft.groupCode || '').trim().toUpperCase();
  const minRequiredInGroup = String(draft.minRequiredInGroup || '').trim();
  return {
    purpose: String(draft.purpose || '').trim().toUpperCase(),
    countryCode: countryCode || null,
    accountId: accountId ? Number(accountId) : null,
    email: email || null,
    code: String(draft.code || '').trim().toUpperCase(),
    titleEn: String(draft.titleEn || '').trim(),
    titleFr: String(draft.titleFr || '').trim(),
    descriptionEn: String(draft.descriptionEn || '').trim(),
    descriptionFr: String(draft.descriptionFr || '').trim(),
    required: Boolean(draft.required),
    groupCode: groupCode || null,
    groupTitleEn: String(draft.groupTitleEn || '').trim() || null,
    groupTitleFr: String(draft.groupTitleFr || '').trim() || null,
    minRequiredInGroup: minRequiredInGroup ? Number(minRequiredInGroup) : null,
    supportedFormats: splitList(draft.supportedFormats).map((item) => item.toLowerCase()),
    supportedContentTypes: splitList(draft.supportedContentTypes),
    allowedSources: splitList(draft.allowedSources).map((item) => item.toUpperCase()),
    active: Boolean(draft.active),
    rank: Number(draft.rank || 0)
  };
};

const validateDraft = (draft) => {
  const payload = buildPayload(draft);
  if (!PURPOSE_OPTIONS.includes(payload.purpose)) return 'Purpose is required.';
  if (!payload.code) return 'Code is required.';
  if (!payload.titleEn) return 'English title is required.';
  if (!payload.titleFr) return 'French title is required.';
  if (!Number.isFinite(payload.rank)) return 'Rank must be a number.';
  if (payload.accountId !== null && (!Number.isInteger(payload.accountId) || payload.accountId <= 0)) return 'Account ID must be a positive integer.';
  if (payload.countryCode && payload.countryCode.length !== 2) return 'Country code must be ISO alpha-2.';
  if (payload.minRequiredInGroup !== null && (!Number.isInteger(payload.minRequiredInGroup) || payload.minRequiredInGroup <= 0)) return 'Min required in group must be a positive integer.';
  if (payload.minRequiredInGroup !== null && !payload.groupCode) return 'Group code is required when min required in group is set.';
  return null;
};

export default function EnhancedKycRequirementsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [filters, setFilters] = useState({ purpose: '', countryCode: '', accountId: '', email: '', active: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (filters.purpose) params.set('purpose', filters.purpose);
      if (filters.countryCode.trim()) params.set('countryCode', filters.countryCode.trim().toUpperCase());
      if (filters.accountId.trim()) params.set('accountId', filters.accountId.trim());
      if (filters.email.trim()) params.set('email', filters.email.trim());
      if (filters.active) params.set('active', filters.active);
      const res = await api.enhancedKycDocumentRequirements.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message || 'Failed to load enhanced KYC requirements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDraft = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));

  const openCreate = () => {
    setSelected(null);
    setDraft(emptyDraft);
    setShowForm(true);
    setError(null);
    setInfo(null);
  };

  const openEdit = async (row) => {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const data = await api.enhancedKycDocumentRequirements.get(row.id);
      setSelected(data || row);
      setDraft({
        purpose: data?.purpose || row?.purpose || 'BANK_ACCOUNT',
        countryCode: data?.countryCode || row?.countryCode || '',
        accountId: data?.accountId ?? row?.accountId ?? '',
        email: data?.email || row?.email || '',
        code: data?.code || row?.code || '',
        titleEn: data?.titleEn || row?.titleEn || '',
        titleFr: data?.titleFr || row?.titleFr || '',
        descriptionEn: data?.descriptionEn || row?.descriptionEn || '',
        descriptionFr: data?.descriptionFr || row?.descriptionFr || '',
        required: Boolean(data?.required ?? row?.required ?? true),
        groupCode: data?.groupCode || row?.groupCode || '',
        groupTitleEn: data?.groupTitleEn || row?.groupTitleEn || '',
        groupTitleFr: data?.groupTitleFr || row?.groupTitleFr || '',
        minRequiredInGroup: data?.minRequiredInGroup ?? row?.minRequiredInGroup ?? '',
        supportedFormats: formatList(data?.supportedFormats || row?.supportedFormats).replace(/^-$/, ''),
        supportedContentTypes: formatList(data?.supportedContentTypes || row?.supportedContentTypes).replace(/^-$/, ''),
        allowedSources: formatList(data?.allowedSources || row?.allowedSources).replace(/^-$/, ''),
        active: Boolean(data?.active ?? row?.active ?? true),
        rank: String(data?.rank ?? row?.rank ?? 0)
      });
      setShowForm(true);
    } catch (err) {
      setError(err.message || `Failed to load requirement ${row.id}.`);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (row) => {
    setSaving(true);
    setError(null);
    try {
      const data = await api.enhancedKycDocumentRequirements.get(row.id);
      setSelected(data || row);
      setShowDetail(true);
    } catch (err) {
      setError(err.message || `Failed to load requirement ${row.id}.`);
    } finally {
      setSaving(false);
    }
  };

  const saveRequirement = async () => {
    const message = validateDraft(draft);
    if (message) {
      setError(message);
      return;
    }
    const payload = buildPayload(draft);
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      if (selected?.id) {
        await api.enhancedKycDocumentRequirements.update(selected.id, payload);
        setInfo(`Updated requirement ${selected.id}.`);
      } else {
        await api.enhancedKycDocumentRequirements.create(payload);
        setInfo('Created enhanced KYC requirement.');
      }
      setShowForm(false);
      setSelected(null);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to save enhanced KYC requirement.');
    } finally {
      setSaving(false);
    }
  };

  const saveRequirementAndForceAccount = async () => {
    const message = validateDraft(draft);
    if (message) {
      setError(message);
      return;
    }
    const payload = buildPayload({ ...draft, purpose: 'ACCOUNT_FORCE' });
    if (!payload.accountId && !payload.email) {
      setError('Enter account ID or email before requesting this document from a user.');
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      if (selected?.id) {
        await api.enhancedKycDocumentRequirements.update(selected.id, payload);
      } else {
        await api.enhancedKycDocumentRequirements.create(payload);
      }
      if (payload.accountId) {
        await api.featureFlags.upsertOverride(ENHANCED_KYC_REQUIRED_FLAG_KEY, payload.accountId, { enabled: true });
      } else {
        await api.featureFlags.upsertOverrideByEmail(ENHANCED_KYC_REQUIRED_FLAG_KEY, payload.email, { enabled: true });
      }
      setInfo(`Requested ${payload.code} and enabled enhanced verification for ${payload.accountId ? `account ${payload.accountId}` : payload.email}.`);
      setShowForm(false);
      setSelected(null);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to request document from user.');
    } finally {
      setSaving(false);
    }
  };

  const deleteRequirement = async () => {
    if (!deleteTarget?.id) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.enhancedKycDocumentRequirements.remove(deleteTarget.id);
      setInfo(`Deleted requirement ${deleteTarget.id}.`);
      setDeleteTarget(null);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to delete requirement ${deleteTarget.id}.`);
    } finally {
      setSaving(false);
    }
  };

  const applyFilters = () => {
    if (page === 0) {
      fetchRows();
      return;
    }
    setPage(0);
  };

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'purpose', label: 'Purpose' },
      { key: 'scope', label: 'Scope', render: formatScope },
      { key: 'code', label: 'Code' },
      { key: 'titleEn', label: 'Title EN' },
      { key: 'required', label: 'Required', render: (row) => (row.required ? 'Yes' : 'No') },
      { key: 'groupCode', label: 'Group', render: (row) => row.groupCode || '-' },
      { key: 'minRequiredInGroup', label: 'Min in group', render: (row) => row.minRequiredInGroup ?? '-' },
      { key: 'formats', label: 'Formats', render: (row) => formatList(row.supportedFormats) },
      { key: 'active', label: 'Active', render: (row) => (row.active ? 'Yes' : 'No') },
      { key: 'rank', label: 'Rank' },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => openDetail(row)} disabled={saving}>
              View
            </button>
            <button type="button" className="btn-neutral btn-sm" onClick={() => openEdit(row)} disabled={saving}>
              Edit
            </button>
            <button type="button" className="btn-danger btn-sm" onClick={() => setDeleteTarget(row)} disabled={saving}>
              Delete
            </button>
          </div>
        )
      }
    ],
    [saving]
  );

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size : page + 1 < pageMeta.totalPages;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Enhanced KYC requirements</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)' }}>
            Configure the document list returned for forced account verification and bank account applications.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          Add requirement
        </button>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.6rem' }}>
        <div style={{ fontWeight: 800 }}>Context</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px', display: 'grid', gap: '0.25rem' }}>
          <div>Use the feature flag account.enhanced_kyc_verification.required to decide who must complete enhanced verification.</div>
          <div>Use these requirements as a dynamic checklist for ACCOUNT_FORCE or BANK_ACCOUNT enhanced verification.</div>
          <div>Resolution order: account-specific, then country + purpose, then global + purpose, then backend fallback defaults.</div>
          <div>Account-specific rows replace country/global rows, so use them when asking one user for only one new document.</div>
          <div>Rows sharing group code and min required in group let the app show alternatives, such as uploading one of several proof-of-funds documents.</div>
        </div>
      </div>

      {(error || info) && (
        <div className="card" style={{ borderColor: error ? '#fecaca' : '#bbf7d0', color: error ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
          {error || info}
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Filters</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Purpose</span>
            <select value={filters.purpose} onChange={(e) => setFilters((prev) => ({ ...prev, purpose: e.target.value }))}>
              <option value="">All</option>
              {PURPOSE_OPTIONS.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Country</span>
            <input value={filters.countryCode} onChange={(e) => setFilters((prev) => ({ ...prev, countryCode: e.target.value }))} placeholder="US" />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Account ID</span>
            <input value={filters.accountId} onChange={(e) => setFilters((prev) => ({ ...prev, accountId: e.target.value }))} placeholder="7" />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Email</span>
            <input value={filters.email} onChange={(e) => setFilters((prev) => ({ ...prev, email: e.target.value }))} placeholder="user@example.com" />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Active</span>
            <select value={filters.active} onChange={(e) => setFilters((prev) => ({ ...prev, active: e.target.value }))}>
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Page size</span>
            <input type="number" min="1" max="100" value={size} onChange={(e) => { setPage(0); setSize(Number(e.target.value) || 20); }} />
          </label>
          <button type="button" className="btn-primary btn-sm" onClick={applyFilters} disabled={loading}>
            {loading ? 'Loading...' : 'Apply'}
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        emptyLabel={loading ? 'Loading requirements...' : 'No enhanced KYC requirements found.'}
        page={page}
        pageSize={size}
        totalPages={pageMeta.totalPages}
        totalElements={pageMeta.totalElements}
        canPrev={canPrev}
        canNext={canNext}
        onPageChange={setPage}
        showAccountQuickNav={false}
      />

      {showForm && (
        <Modal title={selected?.id ? `Edit requirement ${selected.id}` : 'Add enhanced KYC requirement'} onClose={() => (!saving ? setShowForm(false) : null)}>
          <RequirementForm draft={draft} updateDraft={updateDraft} saving={saving} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
            <button type="button" className="btn-neutral" onClick={saveRequirementAndForceAccount} disabled={saving}>
              {saving ? 'Saving...' : 'Request this document from user'}
            </button>
            <button type="button" className="btn-primary" onClick={saveRequirement} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}

      {showDetail && selected && (
        <Modal title={`Requirement ${selected.id}`} onClose={() => setShowDetail(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
            {[
              ['Purpose', selected.purpose],
              ['Scope', formatScope(selected)],
              ['Code', selected.code],
              ['Title EN', selected.titleEn],
              ['Title FR', selected.titleFr],
              ['Description EN', selected.descriptionEn],
              ['Description FR', selected.descriptionFr],
              ['Required', selected.required ? 'Yes' : 'No'],
              ['Group code', selected.groupCode],
              ['Group title EN', selected.groupTitleEn],
              ['Group title FR', selected.groupTitleFr],
              ['Min required in group', selected.minRequiredInGroup],
              ['Formats', formatList(selected.supportedFormats)],
              ['Content types', formatList(selected.supportedContentTypes)],
              ['Allowed sources', formatList(selected.allowedSources)],
              ['Active', selected.active ? 'Yes' : 'No'],
              ['Rank', selected.rank],
              ['Created', formatDateTime(selected.createdAt)],
              ['Updated', formatDateTime(selected.updatedAt)]
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'grid', gap: '0.15rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
                <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{value ?? '-'}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete requirement" onClose={() => (!saving ? setDeleteTarget(null) : null)}>
          <p>Delete {deleteTarget.code} for {deleteTarget.purpose} ({formatScope(deleteTarget)})?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral" onClick={() => setDeleteTarget(null)} disabled={saving}>Cancel</button>
            <button type="button" className="btn-danger" onClick={deleteRequirement} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RequirementForm({ draft, updateDraft, saving }) {
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Purpose</span>
          <select value={draft.purpose} onChange={(e) => updateDraft('purpose', e.target.value)} disabled={saving}>
            {PURPOSE_OPTIONS.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Code</span>
          <select
            value={CODE_OPTIONS.includes(draft.code) ? draft.code : '__CUSTOM__'}
            onChange={(e) => updateDraft('code', e.target.value === '__CUSTOM__' ? '' : e.target.value)}
            disabled={saving}
          >
            {CODE_OPTIONS.map((code) => <option key={code} value={code}>{code}</option>)}
            <option value="__CUSTOM__">Custom code</option>
          </select>
          {!CODE_OPTIONS.includes(draft.code) ? (
            <input value={draft.code} onChange={(e) => updateDraft('code', e.target.value)} placeholder="CUSTOM_DOCUMENT_CODE" disabled={saving} />
          ) : null}
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Rank</span>
          <input type="number" value={draft.rank} onChange={(e) => updateDraft('rank', e.target.value)} disabled={saving} />
        </label>
      </div>

      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <div style={{ fontWeight: 800 }}>Scope</div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Leave all scope fields empty for global. Use country for country requirements, or account ID/email for account-specific requirements.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Country</span>
            <input value={draft.countryCode} onChange={(e) => updateDraft('countryCode', e.target.value)} placeholder="US" disabled={saving} />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Account ID</span>
            <input value={draft.accountId} onChange={(e) => updateDraft('accountId', e.target.value)} placeholder="7" disabled={saving} />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Email</span>
            <input value={draft.email} onChange={(e) => updateDraft('email', e.target.value)} placeholder="user@example.com" disabled={saving} />
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Title EN</span>
          <input value={draft.titleEn} onChange={(e) => updateDraft('titleEn', e.target.value)} disabled={saving} />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Title FR</span>
          <input value={draft.titleFr} onChange={(e) => updateDraft('titleFr', e.target.value)} disabled={saving} />
        </label>
      </div>

      <label style={{ display: 'grid', gap: '0.25rem' }}>
        <span>Description EN</span>
        <textarea rows={3} value={draft.descriptionEn} onChange={(e) => updateDraft('descriptionEn', e.target.value)} disabled={saving} />
      </label>
      <label style={{ display: 'grid', gap: '0.25rem' }}>
        <span>Description FR</span>
        <textarea rows={3} value={draft.descriptionFr} onChange={(e) => updateDraft('descriptionFr', e.target.value)} disabled={saving} />
      </label>

      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <div style={{ fontWeight: 800 }}>Alternative group</div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Use the same group code on multiple rows when the user only needs to submit some of them, for example 1 of 3 proof-of-funds documents.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Group code</span>
            <input value={draft.groupCode} onChange={(e) => updateDraft('groupCode', e.target.value)} placeholder="SOURCE_OF_FUNDS_EXTRA" disabled={saving} />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Group title EN</span>
            <input value={draft.groupTitleEn} onChange={(e) => updateDraft('groupTitleEn', e.target.value)} placeholder="Additional proof of funds" disabled={saving} />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Group title FR</span>
            <input value={draft.groupTitleFr} onChange={(e) => updateDraft('groupTitleFr', e.target.value)} placeholder="Preuve supplementaire de fonds" disabled={saving} />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Min required in group</span>
            <input type="number" min="1" value={draft.minRequiredInGroup} onChange={(e) => updateDraft('minRequiredInGroup', e.target.value)} placeholder="1" disabled={saving} />
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Supported formats</span>
          <input list="enhancedKycRequirementFormatOptions" value={draft.supportedFormats} onChange={(e) => updateDraft('supportedFormats', e.target.value)} disabled={saving} />
          <datalist id="enhancedKycRequirementFormatOptions">
            {FORMAT_OPTIONS.map((format) => <option key={format} value={format} />)}
          </datalist>
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Supported content types</span>
          <input list="enhancedKycRequirementContentTypeOptions" value={draft.supportedContentTypes} onChange={(e) => updateDraft('supportedContentTypes', e.target.value)} disabled={saving} />
          <datalist id="enhancedKycRequirementContentTypeOptions">
            {CONTENT_TYPE_OPTIONS.map((contentType) => <option key={contentType} value={contentType} />)}
          </datalist>
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Allowed sources</span>
          <input list="enhancedKycRequirementSourceOptions" value={draft.allowedSources} onChange={(e) => updateDraft('allowedSources', e.target.value)} disabled={saving} />
          <datalist id="enhancedKycRequirementSourceOptions">
            {SOURCE_OPTIONS.map((source) => <option key={source} value={source} />)}
          </datalist>
        </label>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
          <input type="checkbox" checked={draft.required} onChange={(e) => updateDraft('required', e.target.checked)} disabled={saving} />
          Required
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
          <input type="checkbox" checked={draft.active} onChange={(e) => updateDraft('active', e.target.checked)} disabled={saving} />
          Active
        </label>
      </div>
    </div>
  );
}
