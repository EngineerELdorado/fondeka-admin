'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const TARGET_TYPES = ['ACTION', 'EVENT'];
const LANGUAGE_OPTIONS = ['fr', 'en'];
const META_CATEGORIES = ['UTILITY', 'MARKETING', 'AUTHENTICATION'];
const emptyForm = {
  id: null,
  targetType: 'ACTION',
  targetKey: '',
  languageCode: 'fr',
  templateName: '',
  metaCategory: 'UTILITY',
  bodyText: '',
  bodyParameterKeysJson: '["message"]',
  variableTypesJson: '{"1":"TEXT"}',
  sampleValuesJson: '{"1":"Votre transaction Fondeka a été traitée avec succès."}',
  active: true,
  adminNotes: '',
  metaTemplateId: ''
};

const normalizeList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.content)) return response.content;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};
const formatJsonString = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return trimmed;
  }
};
const parseBodyParameterKeys = (value) => {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
};
const validateJsonField = (value, label) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return;
  try {
    JSON.parse(trimmed);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
};

export default function WhatsappTemplateCatalogPage() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [metaSyncing, setMetaSyncing] = useState({ id: null, operation: '' });
  const [metaResponseModal, setMetaResponseModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchActiveOnly, setBatchActiveOnly] = useState(true);
  const [batchSyncing, setBatchSyncing] = useState('');
  const [batchResultModal, setBatchResultModal] = useState(null);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (activeFilter === 'ACTIVE' && row.active !== true) return false;
      if (activeFilter === 'INACTIVE' && row.active === true) return false;
      if (!query) return true;
      const targetKey = String(row.targetKey || '').toLowerCase();
      const templateName = String(row.templateName || '').toLowerCase();
      return targetKey.includes(query) || templateName.includes(query);
    });
  }, [activeFilter, rows, search]);

  const selectableFilteredRows = useMemo(
    () => filteredRows.filter((row) => row?.id !== undefined && row?.id !== null),
    [filteredRows]
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds.map((id) => String(id))), [selectedIds]);
  const allVisibleSelected =
    selectableFilteredRows.length > 0 && selectableFilteredRows.every((row) => selectedIdSet.has(String(row.id)));

  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (targetTypeFilter) query.set('targetType', targetTypeFilter);
      if (languageFilter) query.set('languageCode', languageFilter);
      const res = await api.whatsappTemplateCatalog.list(query);
      setRows(normalizeList(res));
      setSelectedIds([]);
    } catch (err) {
      setError(err?.message || 'Failed to load WhatsApp template catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateForm = (patch) => {
    setInfo(null);
    setError(null);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const copyText = async (label, value) => {
    const text = String(value || '');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      pushToast({ tone: 'success', message: `${label} copied` });
    } catch {
      setError(`Could not copy ${label}.`);
    }
  };

  const startEdit = async (row) => {
    setError(null);
    setInfo(null);
    try {
      const res = await api.whatsappTemplateCatalog.get(row.id);
      setForm({
        ...emptyForm,
        ...(res || row),
        id: res?.id ?? row.id,
        targetType: String(res?.targetType || row.targetType || 'ACTION').toUpperCase(),
        languageCode: String(res?.languageCode || row.languageCode || 'fr').toLowerCase(),
        metaCategory: String(res?.metaCategory || row.metaCategory || 'UTILITY').toUpperCase(),
        active: (res?.active ?? row.active) !== false
      });
      setShowForm(true);
    } catch (err) {
      setError(err?.message || 'Failed to load template catalog item');
    }
  };

  const buildPayload = () => {
    const payload = {
      targetType: String(form.targetType || '').trim().toUpperCase(),
      targetKey: String(form.targetKey || '').trim(),
      languageCode: String(form.languageCode || '').trim().toLowerCase(),
      templateName: String(form.templateName || '').trim(),
      metaCategory: String(form.metaCategory || '').trim().toUpperCase(),
      bodyText: String(form.bodyText || ''),
      bodyParameterKeysJson: String(form.bodyParameterKeysJson || '').trim(),
      variableTypesJson: String(form.variableTypesJson || '').trim(),
      sampleValuesJson: String(form.sampleValuesJson || '').trim(),
      active: Boolean(form.active),
      adminNotes: String(form.adminNotes || '').trim(),
      metaTemplateId: String(form.metaTemplateId || '').trim() || null
    };
    if (!TARGET_TYPES.includes(payload.targetType)) throw new Error('Target type must be ACTION or EVENT.');
    if (!payload.targetKey) throw new Error('Target key is required.');
    if (!payload.languageCode) throw new Error('Language is required.');
    if (!payload.templateName) throw new Error('Template name is required.');
    if (!payload.bodyText.trim()) throw new Error('Body text is required.');
    validateJsonField(payload.bodyParameterKeysJson, 'Body parameter keys');
    validateJsonField(payload.variableTypesJson, 'Variable types');
    validateJsonField(payload.sampleValuesJson, 'Sample values');
    return payload;
  };

  const saveCatalogItem = async () => {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const payload = buildPayload();
      if (form.id) await api.whatsappTemplateCatalog.update(form.id, payload);
      else await api.whatsappTemplateCatalog.create(payload);
      setInfo('WhatsApp template catalog item saved.');
      pushToast({ tone: 'success', message: 'WhatsApp template catalog item saved' });
      setForm(emptyForm);
      setShowForm(false);
      await loadCatalog();
    } catch (err) {
      const message = err?.message || 'Failed to save WhatsApp template catalog item';
      setError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  const deleteCatalogItem = async (row) => {
    if (!row?.id) return;
    setDeletingId(row.id);
    setError(null);
    try {
      await api.whatsappTemplateCatalog.remove(row.id);
      setInfo('WhatsApp template catalog item deleted.');
      pushToast({ tone: 'success', message: 'WhatsApp template catalog item deleted' });
      if (form.id === row.id) setForm(emptyForm);
      await loadCatalog();
    } catch (err) {
      const message = err?.message || 'Failed to delete WhatsApp template catalog item';
      setError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setDeletingId(null);
    }
  };

  const runMetaSync = async (row, operation) => {
    if (!row?.id) return;
    setMetaSyncing({ id: row.id, operation });
    setError(null);
    setInfo(null);
    try {
      const res =
        operation === 'SUBMIT'
          ? await api.whatsappTemplateCatalog.submitToMeta(row.id)
          : await api.whatsappTemplateCatalog.updateInMeta(row.id);
      const responseBody = res?.responseBody || res?.catalogItem?.metaLastSyncResponse || '';
      if (res?.success === true) {
        const message = operation === 'SUBMIT' ? 'Template submitted to Meta.' : 'Meta template updated.';
        setInfo(message);
        pushToast({ tone: 'success', message });
      } else {
        const message = `Meta ${operation === 'SUBMIT' ? 'submission' : 'update'} failed.`;
        setError(message);
        pushToast({ tone: 'error', message });
        if (responseBody) setMetaResponseModal({ title: message, response: responseBody });
      }
      await loadCatalog();
    } catch (err) {
      const message = err?.message || `Failed to ${operation === 'SUBMIT' ? 'submit template to Meta' : 'update Meta template'}`;
      setError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setMetaSyncing({ id: null, operation: '' });
    }
  };

  const buildBatchPayload = (useSelected) => {
    if (useSelected) {
      const ids = selectedIds.map((id) => Number(id)).filter((id) => Number.isFinite(id));
      if (!ids.length) throw new Error('Select at least one template to sync.');
      return { ids };
    }
    const payload = { activeOnly: batchActiveOnly };
    if (targetTypeFilter) payload.targetType = targetTypeFilter;
    if (languageFilter) payload.languageCode = languageFilter;
    return payload;
  };

  const runBatchMetaSync = async (operation, useSelected) => {
    const syncKey = `${operation}-${useSelected ? 'selected' : 'filtered'}`;
    setBatchSyncing(syncKey);
    setError(null);
    setInfo(null);
    try {
      const payload = buildBatchPayload(useSelected);
      const res =
        operation === 'SUBMIT'
          ? await api.whatsappTemplateCatalog.submitBatchToMeta(payload)
          : await api.whatsappTemplateCatalog.updateBatchInMeta(payload);
      const failureCount = Number(res?.failureCount || 0);
      const successCount = Number(res?.successCount || 0);
      const requestedCount = Number(res?.requestedCount || 0);
      const message = `Meta batch ${operation === 'SUBMIT' ? 'submission' : 'update'} completed: ${successCount}/${requestedCount} succeeded, ${failureCount} failed.`;
      setInfo(message);
      setBatchResultModal(res);
      pushToast({ tone: failureCount > 0 ? 'error' : 'success', message });
      await loadCatalog();
    } catch (err) {
      const message = err?.message || `Failed to run Meta batch ${operation === 'SUBMIT' ? 'submission' : 'update'}`;
      setError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setBatchSyncing('');
    }
  };

  const toggleRowSelection = (rowId) => {
    const normalizedId = String(rowId);
    setSelectedIds((prev) => {
      const exists = prev.some((id) => String(id) === normalizedId);
      return exists ? prev.filter((id) => String(id) !== normalizedId) : [...prev, rowId];
    });
  };

  const toggleAllVisibleSelection = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(selectableFilteredRows.map((row) => String(row.id)));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(String(id))));
      return;
    }
    setSelectedIds((prev) => {
      const next = [...prev];
      const existing = new Set(next.map((id) => String(id)));
      selectableFilteredRows.forEach((row) => {
        if (!existing.has(String(row.id))) next.push(row.id);
      });
      return next;
    });
  };

  const copyPolicyRule = (row) => {
    const targetType = String(row.targetType || '').toUpperCase();
    const rule = {
      enabled: true,
      ...(targetType === 'ACTION' ? { action: row.targetKey } : { event: row.targetKey }),
      templateName: row.templateName,
      languageCode: row.languageCode,
      bodyParameterKeys: parseBodyParameterKeys(row.bodyParameterKeysJson)
    };
    copyText('policy rule JSON', JSON.stringify(rule, null, 2));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>WhatsApp Template Catalog</div>
          <div style={{ color: 'var(--muted)' }}>
            Reference templates for Meta approval. This catalog does not send WhatsApp messages directly.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/notification-delivery-policy" className="btn-neutral">
            Delivery policy
          </Link>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setForm(emptyForm);
              setShowForm(true);
            }}
          >
            New template
          </button>
          <button type="button" className="btn-neutral" onClick={loadCatalog} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div> : null}
      {info ? <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div> : null}

      {showForm ? (
      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>{form.id ? `Edit catalog item #${form.id}` : 'New catalog item'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Target type</span>
            <select value={form.targetType} onChange={(e) => updateForm({ targetType: e.target.value })}>
              {TARGET_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Target key</span>
            <input value={form.targetKey} onChange={(e) => updateForm({ targetKey: e.target.value.toUpperCase() })} placeholder="FUND_WALLET" />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Language</span>
            <select value={form.languageCode} onChange={(e) => updateForm({ languageCode: e.target.value })}>
              {LANGUAGE_OPTIONS.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Template name</span>
            <input value={form.templateName} onChange={(e) => updateForm({ templateName: e.target.value })} placeholder="fondeka_action_fund_wallet" />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Meta category</span>
            <select value={form.metaCategory} onChange={(e) => updateForm({ metaCategory: e.target.value })}>
              {META_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', alignSelf: 'end', minHeight: '42px' }}>
            <input type="checkbox" checked={form.active} onChange={(e) => updateForm({ active: e.target.checked })} />
            Active
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Meta template ID</span>
            <input value={form.metaTemplateId || ''} onChange={(e) => updateForm({ metaTemplateId: e.target.value })} placeholder="Optional Meta template ID" />
          </label>
        </div>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Body text</span>
          <textarea rows={4} value={form.bodyText} onChange={(e) => updateForm({ bodyText: e.target.value })} placeholder={'Notification Fondeka :\n{{1}}'} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Body parameter keys JSON</span>
            <textarea rows={3} value={form.bodyParameterKeysJson} onChange={(e) => updateForm({ bodyParameterKeysJson: e.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Variable types JSON</span>
            <textarea rows={3} value={form.variableTypesJson} onChange={(e) => updateForm({ variableTypesJson: e.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Sample values JSON</span>
            <textarea rows={3} value={form.sampleValuesJson} onChange={(e) => updateForm({ sampleValuesJson: e.target.value })} />
          </label>
        </div>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Admin notes</span>
          <textarea rows={3} value={form.adminNotes} onChange={(e) => updateForm({ adminNotes: e.target.value })} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-neutral"
            onClick={() => {
              setForm(emptyForm);
              setShowForm(false);
            }}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={saveCatalogItem} disabled={saving}>{saving ? 'Saving...' : 'Save catalog item'}</button>
        </div>
      </div>
      ) : null}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Target type</span>
            <select value={targetTypeFilter} onChange={(e) => setTargetTypeFilter(e.target.value)}>
              <option value="">All</option>
              {TARGET_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Language</span>
            <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
              <option value="">All</option>
              {LANGUAGE_OPTIONS.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Active</span>
            <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="target key or template name" />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-neutral" onClick={loadCatalog} disabled={loading}>{loading ? 'Loading...' : 'Apply server filters'}</button>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{filteredRows.length} shown · {selectedIds.length} selected</span>
          <label style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', color: 'var(--muted)', fontSize: '13px' }}>
            <input type="checkbox" checked={batchActiveOnly} onChange={(e) => setBatchActiveOnly(e.target.checked)} />
            Active only for matching sync
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-neutral btn-sm"
            onClick={() => runBatchMetaSync('SUBMIT', true)}
            disabled={batchSyncing !== '' || selectedIds.length === 0}
          >
            {batchSyncing === 'SUBMIT-selected' ? 'Submitting selected...' : 'Submit selected to Meta'}
          </button>
          <button
            type="button"
            className="btn-neutral btn-sm"
            onClick={() => runBatchMetaSync('UPDATE', true)}
            disabled={batchSyncing !== '' || selectedIds.length === 0}
          >
            {batchSyncing === 'UPDATE-selected' ? 'Updating selected...' : 'Update selected in Meta'}
          </button>
          <button
            type="button"
            className="btn-neutral btn-sm"
            onClick={() => runBatchMetaSync('SUBMIT', false)}
            disabled={batchSyncing !== ''}
          >
            {batchSyncing === 'SUBMIT-filtered' ? 'Submitting matching...' : 'Submit matching to Meta'}
          </button>
          <button
            type="button"
            className="btn-neutral btn-sm"
            onClick={() => runBatchMetaSync('UPDATE', false)}
            disabled={batchSyncing !== ''}
          >
            {batchSyncing === 'UPDATE-filtered' ? 'Updating matching...' : 'Update matching in Meta'}
          </button>
        </div>
      </div>

      <div className="card table-scroll" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisibleSelection}
                  disabled={selectableFilteredRows.length === 0}
                  aria-label="Select visible templates"
                />
              </th>
              {['Template', 'Target', 'Language', 'Category', 'Meta sync', 'Active', 'Notes', 'Actions'].map((header) => (
                <th key={header} style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id || `${row.targetType}-${row.targetKey}-${row.languageCode}-${row.templateName}`}>
                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                  <input
                    type="checkbox"
                    checked={selectedIdSet.has(String(row.id))}
                    onChange={() => toggleRowSelection(row.id)}
                    disabled={row?.id === undefined || row?.id === null}
                    aria-label={`Select ${row.templateName || row.targetKey || 'template'}`}
                  />
                </td>
                <td style={{ padding: '0.75rem', verticalAlign: 'top', minWidth: '240px' }}>
                  <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{row.templateName || '—'}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '0.15rem' }}>
                    {row.bodyText ? `${String(row.bodyText).replace(/\s+/g, ' ').slice(0, 96)}${String(row.bodyText).replace(/\s+/g, ' ').length > 96 ? '...' : ''}` : 'No body text'}
                  </div>
                </td>
                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 700 }}>{row.targetType || '—'}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.targetKey || '—'}</div>
                </td>
                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>{row.languageCode || '—'}</td>
                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>{row.metaCategory || '—'}</td>
                <td style={{ padding: '0.75rem', verticalAlign: 'top', minWidth: '190px' }}>
                  <div style={{ display: 'grid', gap: '0.25rem' }}>
                    <div style={{ fontWeight: 700 }}>{row.metaLastSyncStatus || 'Not synced'}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.metaLastSyncedAt ? new Date(row.metaLastSyncedAt).toLocaleString() : 'No sync date'}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>ID: {row.metaTemplateId || '—'}</div>
                    {row.metaLastSyncResponse ? (
                      <button
                        type="button"
                        className="btn-neutral btn-sm"
                        onClick={() => setMetaResponseModal({ title: `${row.templateName || 'Template'} Meta response`, response: row.metaLastSyncResponse })}
                      >
                        View response
                      </button>
                    ) : null}
                  </div>
                </td>
                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>{row.active ? 'Yes' : 'No'}</td>
                <td style={{ padding: '0.75rem', verticalAlign: 'top', minWidth: '160px' }}>
                  {row.adminNotes ? `${String(row.adminNotes).slice(0, 90)}${String(row.adminNotes).length > 90 ? '...' : ''}` : '—'}
                </td>
                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <button type="button" className="btn-neutral btn-sm" onClick={() => setDetailModal(row)}>Details</button>
                    <button type="button" className="btn-neutral btn-sm" onClick={() => startEdit(row)}>Edit</button>
                    <button
                      type="button"
                      className="btn-neutral btn-sm"
                      onClick={() => runMetaSync(row, 'SUBMIT')}
                      disabled={metaSyncing.id === row.id}
                    >
                      {metaSyncing.id === row.id && metaSyncing.operation === 'SUBMIT' ? 'Submitting...' : 'Submit to Meta'}
                    </button>
                    <button
                      type="button"
                      className="btn-neutral btn-sm"
                      onClick={() => runMetaSync(row, 'UPDATE')}
                      disabled={metaSyncing.id === row.id}
                    >
                      {metaSyncing.id === row.id && metaSyncing.operation === 'UPDATE' ? 'Updating...' : 'Update in Meta'}
                    </button>
                    <button type="button" className="btn-neutral btn-sm" onClick={() => copyPolicyRule(row)}>Use for sending</button>
                    <button type="button" className="btn-danger btn-sm" onClick={() => deleteCatalogItem(row)} disabled={deletingId === row.id}>
                      {deletingId === row.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '1rem', color: 'var(--muted)' }}>
                  No WhatsApp template catalog items found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {detailModal ? (
        <div className="modal-backdrop" onClick={() => setDetailModal(null)}>
          <div className="modal-surface" onClick={(event) => event.stopPropagation()} style={{ width: 'min(860px, 96vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '18px' }}>{detailModal.templateName || 'Template details'}</div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  {detailModal.targetType || '—'} · {detailModal.targetKey || '—'} · {detailModal.languageCode || '—'}
                </div>
              </div>
              <button type="button" className="btn-neutral btn-sm" onClick={() => setDetailModal(null)}>
                Close
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn-neutral btn-sm" onClick={() => copyText('template name', detailModal.templateName)}>Copy name</button>
              <button type="button" className="btn-neutral btn-sm" onClick={() => copyText('body text', detailModal.bodyText)}>Copy body</button>
              <button type="button" className="btn-neutral btn-sm" onClick={() => copyText('variable samples', detailModal.sampleValuesJson)}>Copy samples</button>
              <button type="button" className="btn-neutral btn-sm" onClick={() => copyPolicyRule(detailModal)}>Copy policy rule</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Meta</div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Category: {detailModal.metaCategory || '—'}</div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Meta ID: {detailModal.metaTemplateId || '—'}</div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Status: {detailModal.metaLastSyncStatus || 'Not synced'}</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>State</div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Active: {detailModal.active ? 'Yes' : 'No'}</div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  Last synced: {detailModal.metaLastSyncedAt ? new Date(detailModal.metaLastSyncedAt).toLocaleString() : '—'}
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Body text</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', font: 'inherit', background: 'color-mix(in srgb, var(--surface) 86%, var(--accent-soft) 14%)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem' }}>
                {detailModal.bodyText || '—'}
              </pre>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Body parameter keys</div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: '180px', overflow: 'auto' }}>{formatJsonString(detailModal.bodyParameterKeysJson) || '—'}</pre>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Variable types</div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: '180px', overflow: 'auto' }}>{formatJsonString(detailModal.variableTypesJson) || '—'}</pre>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Sample values</div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: '180px', overflow: 'auto' }}>{formatJsonString(detailModal.sampleValuesJson) || '—'}</pre>
              </div>
            </div>
            {detailModal.adminNotes ? (
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Admin notes</div>
                <div style={{ color: 'var(--muted)' }}>{detailModal.adminNotes}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {metaResponseModal ? (
        <div className="modal-backdrop" onClick={() => setMetaResponseModal(null)}>
          <div className="modal-surface" onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>{metaResponseModal.title}</div>
              <button type="button" className="btn-neutral btn-sm" onClick={() => setMetaResponseModal(null)}>
                Close
              </button>
            </div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowX: 'auto', background: 'color-mix(in srgb, var(--surface) 86%, var(--accent-soft) 14%)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem' }}>
              {formatJsonString(metaResponseModal.response) || String(metaResponseModal.response || '')}
            </pre>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => copyText('Meta response', metaResponseModal.response)}>
                Copy response
              </button>
              <button type="button" className="btn-primary" onClick={() => setMetaResponseModal(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {batchResultModal ? (
        <div className="modal-backdrop" onClick={() => setBatchResultModal(null)}>
          <div className="modal-surface" onClick={(event) => event.stopPropagation()} style={{ width: 'min(980px, 96vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '18px' }}>Meta batch result</div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  {batchResultModal.operation || '—'}: {Number(batchResultModal.successCount || 0)} succeeded, {Number(batchResultModal.failureCount || 0)} failed, {Number(batchResultModal.requestedCount || 0)} requested.
                </div>
              </div>
              <button type="button" className="btn-neutral btn-sm" onClick={() => setBatchResultModal(null)}>
                Close
              </button>
            </div>
            <div className="table-scroll" style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {['Result', 'Operation', 'Meta template ID', 'Status', 'Catalog item', 'Response'].map((header) => (
                      <th key={header} style={{ textAlign: 'left', padding: '0.65rem', borderBottom: '1px solid var(--border)' }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(batchResultModal.results) ? batchResultModal.results : []).map((result, index) => (
                    <tr key={`${result?.catalogItem?.id || result?.metaTemplateId || index}`}>
                      <td style={{ padding: '0.65rem', verticalAlign: 'top', color: result?.success ? '#15803d' : '#b91c1c', fontWeight: 800 }}>
                        {result?.success ? 'Success' : 'Failed'}
                      </td>
                      <td style={{ padding: '0.65rem', verticalAlign: 'top' }}>{result?.operation || '—'}</td>
                      <td style={{ padding: '0.65rem', verticalAlign: 'top' }}>{result?.metaTemplateId || result?.catalogItem?.metaTemplateId || '—'}</td>
                      <td style={{ padding: '0.65rem', verticalAlign: 'top' }}>{result?.status || result?.catalogItem?.metaLastSyncStatus || '—'}</td>
                      <td style={{ padding: '0.65rem', verticalAlign: 'top', minWidth: '180px' }}>
                        <div style={{ fontWeight: 700 }}>{result?.catalogItem?.templateName || '—'}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                          {result?.catalogItem?.targetType || '—'} {result?.catalogItem?.targetKey || ''}
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem', verticalAlign: 'top', minWidth: '260px' }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: '180px', overflow: 'auto' }}>
                          {formatJsonString(result?.responseBody || result?.catalogItem?.metaLastSyncResponse) || '—'}
                        </pre>
                      </td>
                    </tr>
                  ))}
                  {!(Array.isArray(batchResultModal.results) && batchResultModal.results.length) ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '0.75rem', color: 'var(--muted)' }}>
                        No per-template results returned.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => copyText('batch result JSON', JSON.stringify(batchResultModal, null, 2))}>
                Copy result
              </button>
              <button type="button" className="btn-primary" onClick={() => setBatchResultModal(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
