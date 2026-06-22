'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  cardProductId: '',
  cardProviderId: '',
  cardProgramId: '',
  label: '',
  labelIcon: '',
  labelBackgroundColor: '',
  backgroundImageUrl: '',
  description: '',
  bestForCodes: [],
  customBestForText: '',
  functionalityCodes: [],
  customFunctionalitiesText: '',
  popularPlatforms: [],
  capabilitiesMap: {},
  capabilitiesExtra: [],
  currency: '',
  purchaseCost: '',
  price: '',
  monthlyMaintenanceCost: '',
  verificationCost: '',
  unloadFee: '',
  transactionFeePercentage: '',
  interchangeFeePercentage: '',
  minInterchangeFeeAmount: '',
  maxInterchangeFeeAmount: '',
  providerTransactionFeePercentage: '',
  minProviderTransactionFeeAmount: '',
  maxProviderTransactionFeeAmount: '',
  fundCardFeePercentage: '',
  minFundCardFeeAmount: '',
  withdrawFromCardFeePercentage: '',
  minWithdrawFromCardFeeAmount: '',
  onlineTransactionFeePercentage: '',
  minOnlineTransactionFeeAmount: '',
  rank: '',
  maxDailyLimit: '',
  minFirstTopup: '',
  minTransactionFeeAmount: '',
  validityLength: '',
  validityType: '',
  notesEn: '',
  notesFr: '',
  active: true
};

const normalizePlatformRows = (platforms) => {
  if (!Array.isArray(platforms)) return [];
  return platforms.map((platform) => ({
    code: String(platform?.code || '').trim(),
    icon: String(platform?.icon || '').trim(),
    name: String(platform?.name || '').trim()
  }));
};

const normalizeCodeText = (value) =>
  String(value || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const uniqueCodes = (values) => [...new Set((Array.isArray(values) ? values : []).map((item) => String(item || '').trim()).filter(Boolean))];

const mergeCodeSelections = (selected, customText) => uniqueCodes([...(Array.isArray(selected) ? selected : []), ...normalizeCodeText(customText)]);

const normalizeCapabilityExtras = (capabilities, defaultCapabilityCodes = new Set()) => {
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) return [];
  return Object.entries(capabilities)
    .filter(([key]) => !defaultCapabilityCodes.has(key))
    .map(([key, value]) => ({
      key,
      value: value === null || value === undefined ? '' : String(value)
    }));
};

const normalizeCapabilityMap = (capabilities, defaultCapabilityCodes = new Set()) => {
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) return {};
  return Object.entries(capabilities).reduce((acc, [key, value]) => {
    if (!defaultCapabilityCodes.has(key)) return acc;
    if (value === true) acc[key] = 'true';
    if (value === false) acc[key] = 'false';
    return acc;
  }, {});
};

const parseCapabilityValue = (value) => {
  const text = String(value || '').trim();
  if (text.toLowerCase() === 'true') return true;
  if (text.toLowerCase() === 'false') return false;
  if (text && Number.isFinite(Number(text))) return Number(text);
  return text;
};

const toPayload = (state) => {
  const popularPlatforms = normalizePlatformRows(state.popularPlatforms).filter((platform) => platform.code || platform.icon || platform.name);
  const invalidPlatform = popularPlatforms.find((platform) => !platform.code && (!platform.icon || !platform.name));
  if (invalidPlatform) {
    throw new Error('Each custom popular platform needs both an icon and a name.');
  }
  const bestFor = mergeCodeSelections(state.bestForCodes, state.customBestForText);
  const functionalities = mergeCodeSelections(state.functionalityCodes, state.customFunctionalitiesText);
  const capabilities = {};
  Object.entries(state.capabilitiesMap || {}).forEach(([key, value]) => {
    if (value === 'true') capabilities[key] = true;
    if (value === 'false') capabilities[key] = false;
  });
  (Array.isArray(state.capabilitiesExtra) ? state.capabilitiesExtra : []).forEach((item) => {
    const key = String(item?.key || '').trim();
    if (!key) return;
    capabilities[key] = parseCapabilityValue(item?.value);
  });

  return {
    cardProductId: Number(state.cardProductId) || 0,
    cardProviderId: Number(state.cardProviderId) || 0,
    cardProgramId: state.cardProgramId?.trim() ? state.cardProgramId.trim() : null,
    label: state.label?.trim() ? state.label.trim() : null,
    labelIcon: state.labelIcon?.trim() ? state.labelIcon.trim() : null,
    labelBackgroundColor: state.labelBackgroundColor?.trim() ? state.labelBackgroundColor.trim() : null,
    backgroundImageUrl: state.backgroundImageUrl?.trim() ? state.backgroundImageUrl.trim() : null,
    description: state.description?.trim() ? state.description.trim() : null,
    bestFor: bestFor.length ? bestFor : null,
    functionalities: functionalities.length ? functionalities : null,
    popularPlatforms: popularPlatforms.length ? popularPlatforms : null,
    capabilities: Object.keys(capabilities).length ? capabilities : null,
    currency: state.currency,
    purchaseCost: state.purchaseCost === '' ? null : Number(state.purchaseCost),
    price: state.price === '' ? null : Number(state.price),
    monthlyMaintenanceCost: state.monthlyMaintenanceCost === '' ? null : Number(state.monthlyMaintenanceCost),
    verificationCost: state.verificationCost === '' ? 0 : Number(state.verificationCost),
    unloadFee: state.unloadFee === '' ? null : Number(state.unloadFee),
    transactionFeePercentage: state.transactionFeePercentage === '' ? null : Number(state.transactionFeePercentage),
    interchangeFeePercentage: state.interchangeFeePercentage === '' ? null : Number(state.interchangeFeePercentage),
    minInterchangeFeeAmount: state.minInterchangeFeeAmount === '' ? null : Number(state.minInterchangeFeeAmount),
    maxInterchangeFeeAmount: state.maxInterchangeFeeAmount === '' ? null : Number(state.maxInterchangeFeeAmount),
    providerTransactionFeePercentage: state.providerTransactionFeePercentage === '' ? null : Number(state.providerTransactionFeePercentage),
    minProviderTransactionFeeAmount: state.minProviderTransactionFeeAmount === '' ? null : Number(state.minProviderTransactionFeeAmount),
    maxProviderTransactionFeeAmount: state.maxProviderTransactionFeeAmount === '' ? null : Number(state.maxProviderTransactionFeeAmount),
    fundCardFeePercentage: state.fundCardFeePercentage === '' ? null : Number(state.fundCardFeePercentage),
    minFundCardFeeAmount: state.minFundCardFeeAmount === '' ? null : Number(state.minFundCardFeeAmount),
    withdrawFromCardFeePercentage: state.withdrawFromCardFeePercentage === '' ? null : Number(state.withdrawFromCardFeePercentage),
    minWithdrawFromCardFeeAmount: state.minWithdrawFromCardFeeAmount === '' ? null : Number(state.minWithdrawFromCardFeeAmount),
    onlineTransactionFeePercentage: state.onlineTransactionFeePercentage === '' ? null : Number(state.onlineTransactionFeePercentage),
    minOnlineTransactionFeeAmount: state.minOnlineTransactionFeeAmount === '' ? null : Number(state.minOnlineTransactionFeeAmount),
    rank: state.rank === '' ? null : Number(state.rank),
    maxDailyLimit: state.maxDailyLimit === '' ? null : Number(state.maxDailyLimit),
    minFirstTopup: state.minFirstTopup === '' ? null : Number(state.minFirstTopup),
    minTransactionFeeAmount: state.minTransactionFeeAmount === '' ? null : Number(state.minTransactionFeeAmount),
    validityLength: state.validityLength === '' ? null : Number(state.validityLength),
    validityType: state.validityType || null,
    notesEn: state.notesEn?.trim() ? state.notesEn.trim() : null,
    notesFr: state.notesFr?.trim() ? state.notesFr.trim() : null,
    active: Boolean(state.active)
  };
};

const hasConfiguredValue = (value) => value !== null && value !== undefined && value !== '';

const formatAmount = (row, key) => {
  const val = row?.[key];
  if (!hasConfiguredValue(val)) return '—';
  return `${val}${row?.currency ? ` ${row.currency}` : ''}`;
};

const formatOperationFeeLine = (row, label, percentageKey, minAmountKey) => {
  const percentage = row?.[percentageKey];
  const minAmount = row?.[minAmountKey];
  if (!hasConfiguredValue(percentage) && !hasConfiguredValue(minAmount)) return null;

  const parts = [];
  if (hasConfiguredValue(percentage)) parts.push(`${percentage}%`);
  if (hasConfiguredValue(minAmount)) parts.push(`min ${formatAmount(row, minAmountKey)}`);

  return `${label}: ${parts.join(' | ')}`;
};

const renderOperationFeeSummary = (row) => {
  const lines = [
    formatOperationFeeLine(row, 'Fund', 'fundCardFeePercentage', 'minFundCardFeeAmount'),
    formatOperationFeeLine(row, 'Withdraw', 'withdrawFromCardFeePercentage', 'minWithdrawFromCardFeeAmount'),
    formatOperationFeeLine(row, 'Online', 'onlineTransactionFeePercentage', 'minOnlineTransactionFeeAmount')
  ].filter(Boolean);

  if (!lines.length) return '—';

  return (
    <div style={{ display: 'grid', gap: '0.2rem', minWidth: '180px' }}>
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
};

const formatCodeList = (codes) => {
  if (!Array.isArray(codes) || codes.length === 0) return '—';
  return codes.join(', ');
};

const formatJson = (value) => {
  if (!value) return '—';
  return JSON.stringify(value, null, 2);
};

const renderLabelBadgeStyle = (row) => {
  if (!row?.label && !row?.labelIcon && !row?.labelBackgroundColor) return '—';
  const background = row.labelBackgroundColor || '#111827';
  return (
    <div style={{ display: 'grid', gap: '0.25rem', minWidth: '130px' }}>
      <span
        style={{
          justifySelf: 'start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.2rem 0.45rem',
          borderRadius: '999px',
          background,
          color: '#fff',
          fontSize: '11px',
          fontWeight: 800,
          lineHeight: 1.2
        }}
      >
        {row.labelIcon ? <span>{row.labelIcon}</span> : null}
        <span>{row.label || 'LABEL'}</span>
      </span>
      <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
        {[row.labelIcon, row.labelBackgroundColor].filter(Boolean).join(' | ') || 'Default style'}
      </span>
    </div>
  );
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700, wordBreak: 'break-word' }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

export default function CardProductProvidersPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [cardProducts, setCardProducts] = useState([]);
  const [cardProviders, setCardProviders] = useState([]);
  const [metadataDefaults, setMetadataDefaults] = useState(null);
  const [metadataImportRows, setMetadataImportRows] = useState([]);
  const [platformDefaultToAdd, setPlatformDefaultToAdd] = useState('');

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.cardProductCardProviders.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [productsRes, providersRes, metadataRes, mappingsRes] = await Promise.all([
          api.cardProducts.list(new URLSearchParams({ page: '0', size: '200' })),
          api.cardProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.cardProductCardProviders.metadataDefaults(),
          api.cardProductCardProviders.list(new URLSearchParams({ page: '0', size: '500' }))
        ]);
        const toList = (res) => (Array.isArray(res) ? res : res?.content || []);
        setCardProducts(toList(productsRes));
        setCardProviders(toList(providersRes));
        setMetadataDefaults(metadataRes);
        setMetadataImportRows(toList(mappingsRes));
      } catch {
        // ignore option fetch errors
      }
    };
    loadOptions();
  }, []);

  const fmtAmount = (row, key) => formatAmount(row, key);

  const columns = [
      { key: 'id', label: 'ID' },
      { key: 'cardBrandName', label: 'Product' },
      { key: 'cardProviderName', label: 'Provider' },
      {
        key: 'cardProgramId',
        label: 'Program ID',
        render: (row) => row.cardProgramId || '—'
      },
      {
        key: 'label',
        label: 'Label',
        render: (row) => row.label || '—'
      },
      {
        key: 'labelBadgeStyle',
        label: 'Badge style',
        render: (row) => renderLabelBadgeStyle(row)
      },
      {
        key: 'backgroundImageUrl',
        label: 'Background',
        render: (row) => (row.backgroundImageUrl ? 'Set' : '—')
      },
      {
        key: 'price',
        label: 'Price',
        render: (row) => fmtAmount(row, 'price')
      },
      {
        key: 'rank',
        label: 'Rank',
        render: (row) => (row.rank === null || row.rank === undefined ? '—' : row.rank)
      },
      {
        key: 'active',
        label: 'Active',
        render: (row) => (row.active === null || row.active === undefined ? '—' : String(row.active))
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
            <button type="button" onClick={() => openEdit(row)} className="btn-neutral">Edit</button>
            <button type="button" onClick={() => openMetadata(row)} className="btn-neutral">Metadata</button>
            <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger">Delete</button>
          </div>
        )
      }
    ];

  const openCreate = () => {
    setDraft(emptyState);
    setPlatformDefaultToAdd('');
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const draftFromRow = (row) => {
    const defaultBestForCodes = new Set((metadataDefaults?.bestFor || []).map((option) => option.code).filter(Boolean));
    const bestForCodes = Array.isArray(row.bestFor) ? row.bestFor.map((code) => String(code || '').trim()).filter(Boolean) : [];
    const defaultFunctionalityCodes = new Set((metadataDefaults?.functionalities || []).map((option) => option.code).filter(Boolean));
    const functionalityCodes = Array.isArray(row.functionalities) ? row.functionalities.map((code) => String(code || '').trim()).filter(Boolean) : [];
    const defaultCapabilityCodes = new Set((metadataDefaults?.capabilities || []).map((option) => option.code).filter(Boolean));

    return {
      cardProductId: row.cardProductId ?? '',
      cardProviderId: row.cardProviderId ?? '',
      cardProgramId: row.cardProgramId ?? '',
      label: row.label ?? '',
      labelIcon: row.labelIcon ?? '',
      labelBackgroundColor: row.labelBackgroundColor ?? '',
      backgroundImageUrl: row.backgroundImageUrl ?? '',
      description: row.description ?? '',
      bestForCodes: bestForCodes.filter((code) => defaultBestForCodes.has(code)),
      customBestForText: bestForCodes.filter((code) => !defaultBestForCodes.has(code)).join('\n'),
      functionalityCodes: functionalityCodes.filter((code) => defaultFunctionalityCodes.has(code)),
      customFunctionalitiesText: functionalityCodes.filter((code) => !defaultFunctionalityCodes.has(code)).join('\n'),
      popularPlatforms: normalizePlatformRows(row.popularPlatforms),
      capabilitiesMap: normalizeCapabilityMap(row.capabilities, defaultCapabilityCodes),
      capabilitiesExtra: normalizeCapabilityExtras(row.capabilities, defaultCapabilityCodes),
      currency: row.currency ?? '',
      purchaseCost: row.purchaseCost ?? '',
      price: row.price ?? '',
      monthlyMaintenanceCost: row.monthlyMaintenanceCost ?? '',
      verificationCost: row.verificationCost ?? 0,
      unloadFee: row.unloadFee ?? '',
      transactionFeePercentage: row.transactionFeePercentage ?? '',
      interchangeFeePercentage: row.interchangeFeePercentage ?? '',
      minInterchangeFeeAmount: row.minInterchangeFeeAmount ?? '',
      maxInterchangeFeeAmount: row.maxInterchangeFeeAmount ?? '',
      providerTransactionFeePercentage: row.providerTransactionFeePercentage ?? '',
      minProviderTransactionFeeAmount: row.minProviderTransactionFeeAmount ?? '',
      maxProviderTransactionFeeAmount: row.maxProviderTransactionFeeAmount ?? '',
      fundCardFeePercentage: row.fundCardFeePercentage ?? '',
      minFundCardFeeAmount: row.minFundCardFeeAmount ?? '',
      withdrawFromCardFeePercentage: row.withdrawFromCardFeePercentage ?? '',
      minWithdrawFromCardFeeAmount: row.minWithdrawFromCardFeeAmount ?? '',
      onlineTransactionFeePercentage: row.onlineTransactionFeePercentage ?? '',
      minOnlineTransactionFeeAmount: row.minOnlineTransactionFeeAmount ?? '',
      rank: row.rank ?? '',
      maxDailyLimit: row.maxDailyLimit ?? '',
      minFirstTopup: row.minFirstTopup ?? '',
      minTransactionFeeAmount: row.minTransactionFeeAmount ?? '',
      validityLength: row.validityLength ?? '',
      validityType: row.validityType ?? '',
      notesEn: row.notesEn ?? '',
      notesFr: row.notesFr ?? '',
      active: Boolean(row.active)
    };
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft(draftFromRow(row));
    setShowEdit(true);
    setPlatformDefaultToAdd('');
    setInfo(null);
    setError(null);
  };

  const openMetadata = (row) => {
    setSelected(row);
    setDraft(draftFromRow(row));
    setShowMetadata(true);
    setPlatformDefaultToAdd('');
    setInfo(null);
    setError(null);
  };

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
  };

  const updatePlatform = (index, key, value) => {
    setDraft((prev) => ({
      ...prev,
      popularPlatforms: (prev.popularPlatforms || []).map((platform, idx) => {
        if (idx !== index) return platform;
        const next = { ...platform, [key]: value };
        if (key === 'code') {
          const match = (metadataDefaults?.platforms || []).find((option) => option.code === value);
          if (match) {
            next.icon = match.icon || next.icon;
            next.name = match.label || next.name;
          }
        }
        return next;
      })
    }));
  };

  const addPlatform = () => {
    setDraft((prev) => ({
      ...prev,
      popularPlatforms: [...(prev.popularPlatforms || []), { code: '', icon: '', name: '' }]
    }));
  };

  const addPlatformDefault = () => {
    const match = (metadataDefaults?.platforms || []).find((platform) => platform.code === platformDefaultToAdd);
    if (!match) return;
    setDraft((prev) => ({
      ...prev,
      popularPlatforms: [
        ...(prev.popularPlatforms || []),
        {
          code: match.code || '',
          icon: match.icon || '',
          name: match.label || match.name || match.code || ''
        }
      ]
    }));
    setPlatformDefaultToAdd('');
  };

  const removePlatform = (index) => {
    setDraft((prev) => ({
      ...prev,
      popularPlatforms: (prev.popularPlatforms || []).filter((_, idx) => idx !== index)
    }));
  };

  const toggleCodeSelection = (field, code, checked) => {
    setDraft((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];
      return {
        ...prev,
        [field]: checked ? uniqueCodes([...current, code]) : current.filter((item) => item !== code)
      };
    });
  };

  const updateCapabilityDefault = (code, value) => {
    setDraft((prev) => ({
      ...prev,
      capabilitiesMap: {
        ...(prev.capabilitiesMap || {}),
        [code]: value
      }
    }));
  };

  const updateCapabilityExtra = (index, key, value) => {
    setDraft((prev) => ({
      ...prev,
      capabilitiesExtra: (prev.capabilitiesExtra || []).map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
    }));
  };

  const addCapabilityExtra = () => {
    setDraft((prev) => ({
      ...prev,
      capabilitiesExtra: [...(prev.capabilitiesExtra || []), { key: '', value: '' }]
    }));
  };

  const removeCapabilityExtra = (index) => {
    setDraft((prev) => ({
      ...prev,
      capabilitiesExtra: (prev.capabilitiesExtra || []).filter((_, idx) => idx !== index)
    }));
  };

  const importMetadataFromRow = (sourceId) => {
    const sourceRows = metadataImportRows.length ? metadataImportRows : rows;
    const source = sourceRows.find((row) => String(row.id) === String(sourceId));
    if (!source) return;

    const defaultBestForCodes = new Set((metadataDefaults?.bestFor || []).map((option) => option.code).filter(Boolean));
    const bestForCodes = Array.isArray(source.bestFor) ? source.bestFor.map((code) => String(code || '').trim()).filter(Boolean) : [];
    const defaultFunctionalityCodes = new Set((metadataDefaults?.functionalities || []).map((option) => option.code).filter(Boolean));
    const functionalityCodes = Array.isArray(source.functionalities) ? source.functionalities.map((code) => String(code || '').trim()).filter(Boolean) : [];
    const defaultCapabilityCodes = new Set((metadataDefaults?.capabilities || []).map((option) => option.code).filter(Boolean));

    setDraft((prev) => ({
      ...prev,
      description: source.description ?? '',
      bestForCodes: bestForCodes.filter((code) => defaultBestForCodes.has(code)),
      customBestForText: bestForCodes.filter((code) => !defaultBestForCodes.has(code)).join('\n'),
      functionalityCodes: functionalityCodes.filter((code) => defaultFunctionalityCodes.has(code)),
      customFunctionalitiesText: functionalityCodes.filter((code) => !defaultFunctionalityCodes.has(code)).join('\n'),
      popularPlatforms: normalizePlatformRows(source.popularPlatforms),
      capabilitiesMap: normalizeCapabilityMap(source.capabilities, defaultCapabilityCodes),
      capabilitiesExtra: normalizeCapabilityExtras(source.capabilities, defaultCapabilityCodes)
    }));
  };

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.cardProductCardProviders.create(toPayload(draft));
      setInfo('Created product/provider mapping.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.cardProductCardProviders.update(selected.id, toPayload(draft));
      setInfo(`Updated mapping ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMetadataUpdate = async () => {
    if (!selected?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.cardProductCardProviders.update(selected.id, toPayload(draft));
      setInfo(`Updated metadata for mapping ${selected.id}.`);
      setShowMetadata(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    const id = confirmDelete.id;
    setError(null);
    setInfo(null);
    try {
      await api.cardProductCardProviders.remove(id);
      setInfo(`Deleted mapping ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderMetadataForm = () => {
    const importSourceRows = metadataImportRows.length ? metadataImportRows : rows;
    const renderCodeSelector = ({ title, options, field, customField, customPlaceholder }) => (
      <div style={{ display: 'grid', gap: '0.45rem' }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        {(options || []).length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.4rem' }}>
            {options.map((option) => (
              <label
                key={option.code}
                style={{
                  display: 'flex',
                  gap: '0.45rem',
                  alignItems: 'flex-start',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.45rem'
                }}
              >
                <input
                  type="checkbox"
                  checked={(draft[field] || []).includes(option.code)}
                  onChange={(e) => toggleCodeSelection(field, option.code, e.target.checked)}
                />
                <span style={{ display: 'grid', gap: '0.15rem' }}>
                  <span style={{ fontWeight: 700 }}>{option.label || option.code}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '12px', wordBreak: 'break-word' }}>{option.code}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Defaults are not available yet. Custom values can still be submitted.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor={customField}>Custom {title.toLowerCase()}</label>
          <textarea
            id={customField}
            rows={3}
            value={draft[customField]}
            onChange={(e) => setDraft((p) => ({ ...p, [customField]: e.target.value }))}
            placeholder={customPlaceholder}
          />
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Use one custom code per line, or separate values with commas.</div>
        </div>
      </div>
    );

    return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="description">Best for description</label>
        <textarea
          id="description"
          rows={3}
          value={draft.description}
          onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
          placeholder="Best for streaming subscriptions, online shopping, and travel bookings."
        />
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="metadataImport">Import metadata from another mapping</label>
        <select id="metadataImport" value="" onChange={(e) => importMetadataFromRow(e.target.value)}>
          <option value="">Select mapping to copy from</option>
          {importSourceRows
            .filter((row) => !selected?.id || row.id !== selected.id)
            .map((row) => (
              <option key={row.id} value={row.id}>
                #{row.id} {row.cardBrandName || 'Product'} / {row.cardProviderName || 'Provider'} {row.label ? `(${row.label})` : ''}
              </option>
            ))}
        </select>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Copies description, best-for codes, functionality codes, platforms, and capabilities only.
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '0.9rem' }}>
        {renderCodeSelector({
          title: 'Best for',
          options: metadataDefaults?.bestFor || [],
          field: 'bestForCodes',
          customField: 'customBestForText',
          customPlaceholder: 'CUSTOM_USE_CASE'
        })}
        {renderCodeSelector({
          title: 'Functionalities',
          options: metadataDefaults?.functionalities || [],
          field: 'functionalityCodes',
          customField: 'customFunctionalitiesText',
          customPlaceholder: 'CUSTOM_FUNCTIONALITY'
        })}
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>Popular platforms</div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={platformDefaultToAdd} onChange={(e) => setPlatformDefaultToAdd(e.target.value)}>
              <option value="">Add from defaults</option>
              {(metadataDefaults?.platforms || []).map((platform) => (
                <option key={platform.code} value={platform.code}>{platform.label || platform.code}</option>
              ))}
            </select>
            <button type="button" className="btn-neutral btn-sm" onClick={addPlatformDefault} disabled={!platformDefaultToAdd}>
              Add selected
            </button>
            <button type="button" className="btn-neutral btn-sm" onClick={addPlatform}>
              Add custom
            </button>
          </div>
        </div>
        {(draft.popularPlatforms || []).length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No popular platforms configured.</div>
        )}
        {(draft.popularPlatforms || []).map((platform, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr)) auto', gap: '0.5rem', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor={`platformCode-${index}`}>Code</label>
              <input
                id={`platformCode-${index}`}
                value={platform.code}
                onChange={(e) => updatePlatform(index, 'code', e.target.value)}
                placeholder="NETFLIX"
                list="platform-code-defaults"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor={`platformIcon-${index}`}>Icon</label>
              <input
                id={`platformIcon-${index}`}
                value={platform.icon}
                onChange={(e) => updatePlatform(index, 'icon', e.target.value)}
                placeholder="netflix"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor={`platformName-${index}`}>Name</label>
              <input
                id={`platformName-${index}`}
                value={platform.name}
                onChange={(e) => updatePlatform(index, 'name', e.target.value)}
                placeholder="Netflix"
              />
            </div>
            <button type="button" className="btn-danger btn-sm" onClick={() => removePlatform(index)}>
              Remove
            </button>
          </div>
        ))}
        <datalist id="platform-code-defaults">
          {(metadataDefaults?.platforms || []).map((platform) => (
            <option key={platform.code} value={platform.code}>{platform.label}</option>
          ))}
        </datalist>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '0.65rem' }}>
        <div style={{ fontWeight: 700 }}>Capabilities</div>
        {(metadataDefaults?.capabilities || []).length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.35rem' }}>
            {(metadataDefaults?.capabilities || []).map((capability) => (
              <div
                key={capability.code}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 82px',
                  gap: '0.35rem',
                  alignItems: 'center',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.45rem'
                }}
              >
                <label htmlFor={`capabilityDefault-${capability.code}`} style={{ display: 'grid', gap: '0.15rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>{capability.label || capability.code}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '11px', wordBreak: 'break-word' }}>{capability.code}</span>
                </label>
                <select
                  id={`capabilityDefault-${capability.code}`}
                  value={draft.capabilitiesMap?.[capability.code] || ''}
                  onChange={(e) => updateCapabilityDefault(capability.code, e.target.value)}
                  style={{ padding: '0.3rem 0.35rem', fontSize: '12px' }}
                >
                  <option value="">Unset</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Capability defaults are not available yet. Custom fields can still be submitted.</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Custom capability fields</div>
          <button type="button" className="btn-neutral btn-sm" onClick={addCapabilityExtra}>
            Add capability
          </button>
        </div>
        {(draft.capabilitiesExtra || []).map((item, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) auto', gap: '0.5rem', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor={`capabilityKey-${index}`}>Key</label>
              <input
                id={`capabilityKey-${index}`}
                value={item.key}
                onChange={(e) => updateCapabilityExtra(index, 'key', e.target.value)}
                placeholder="SUPPORTS_3DS"
                list="capability-code-defaults"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor={`capabilityValue-${index}`}>Value</label>
              <input
                id={`capabilityValue-${index}`}
                value={item.value}
                onChange={(e) => updateCapabilityExtra(index, 'value', e.target.value)}
                placeholder="true"
              />
            </div>
            <button type="button" className="btn-danger btn-sm" onClick={() => removeCapabilityExtra(index)}>
              Remove
            </button>
          </div>
        ))}
        <datalist id="capability-code-defaults">
          {(metadataDefaults?.capabilities || []).map((capability) => (
            <option key={capability.code} value={capability.code}>{capability.label}</option>
          ))}
        </datalist>
      </div>
    </div>
    );
  };

  const renderForm = () => {
    const selectedProvider = cardProviders.find((provider) => String(provider.id) === String(draft.cardProviderId));
    const selectedProviderName = String(selectedProvider?.cardProviderName || selectedProvider?.name || '').trim().toUpperCase();
    const sudoProviderSelected = selectedProviderName.includes('SUDO');

    return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="cardProductId">Card product</label>
        <select id="cardProductId" value={draft.cardProductId} onChange={(e) => setDraft((p) => ({ ...p, cardProductId: e.target.value }))}>
          <option value="">Select product</option>
          {cardProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.cardBrandName || `Product ${p.id}`}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="cardProviderId">Card provider</label>
        <select id="cardProviderId" value={draft.cardProviderId} onChange={(e) => setDraft((p) => ({ ...p, cardProviderId: e.target.value }))}>
          <option value="">Select provider</option>
          {cardProviders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.cardProviderName || p.name || `Provider ${p.id}`}
            </option>
          ))}
        </select>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          gridColumn: sudoProviderSelected ? '1 / -1' : undefined,
          padding: sudoProviderSelected ? '0.75rem' : undefined,
          border: sudoProviderSelected ? '1px solid #bfdbfe' : undefined,
          borderRadius: sudoProviderSelected ? '12px' : undefined,
          background: sudoProviderSelected ? '#eff6ff' : undefined
        }}
      >
        <label htmlFor="cardProgramId">Provider card program ID</label>
        <input
          id="cardProgramId"
          value={draft.cardProgramId}
          onChange={(e) => setDraft((p) => ({ ...p, cardProgramId: e.target.value }))}
          placeholder={sudoProviderSelected ? 'SUDO card program ID' : 'Optional provider program ID'}
        />
        {sudoProviderSelected && (
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Used for this SUDO product/provider mapping. Leave blank to use backend defaults.
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="label">Label</label>
        <input
          id="label"
          value={draft.label}
          onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
          placeholder="SIMPLE, PREMIUM, VIP"
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="labelIcon">Label icon</label>
        <input
          id="labelIcon"
          value={draft.labelIcon}
          onChange={(e) => setDraft((p) => ({ ...p, labelIcon: e.target.value }))}
          placeholder="star, diamond, shield-checkmark"
        />
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Use the client app MaterialCommunityIcons name.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="labelBackgroundColor">Label background color</label>
        <input
          id="labelBackgroundColor"
          value={draft.labelBackgroundColor}
          onChange={(e) => setDraft((p) => ({ ...p, labelBackgroundColor: e.target.value }))}
          placeholder="#111827"
        />
      </div>
      {(draft.label || draft.labelIcon || draft.labelBackgroundColor) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label>Label badge preview</label>
          <div
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '999px',
              background: draft.labelBackgroundColor || '#111827',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 800
            }}
          >
            {draft.labelIcon ? <span>{draft.labelIcon}</span> : null}
            <span>{draft.label || 'LABEL'}</span>
          </div>
        </div>
      )}
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="backgroundImageUrl">Provider background image URL</label>
        <input
          id="backgroundImageUrl"
          value={draft.backgroundImageUrl}
          onChange={(e) => setDraft((p) => ({ ...p, backgroundImageUrl: e.target.value }))}
          placeholder="Optional override for this product/provider mapping"
        />
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          When set, this image is returned to the client app instead of the card product background image.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="currency">Currency</label>
        <input id="currency" value={draft.currency} onChange={(e) => setDraft((p) => ({ ...p, currency: e.target.value }))} placeholder="e.g. USD" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="price">Price</label>
        <input id="price" type="number" value={draft.price} onChange={(e) => setDraft((p) => ({ ...p, price: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="purchaseCost">Purchase cost</label>
        <input id="purchaseCost" type="number" value={draft.purchaseCost} onChange={(e) => setDraft((p) => ({ ...p, purchaseCost: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="verificationCost">Verification cost (USD)</label>
        <input
          id="verificationCost"
          type="number"
          min={0}
          step="0.01"
          value={draft.verificationCost}
          onChange={(e) => setDraft((p) => ({ ...p, verificationCost: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="unloadFee">Unload fee (USD)</label>
        <input
          id="unloadFee"
          type="number"
          min={0}
          step="0.01"
          value={draft.unloadFee}
          onChange={(e) => setDraft((p) => ({ ...p, unloadFee: e.target.value }))}
          placeholder="1.00"
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="transactionFeePercentage">Transaction fee %</label>
        <input
          id="transactionFeePercentage"
          type="number"
          step="0.01"
          min={0}
          value={draft.transactionFeePercentage}
          onChange={(e) => setDraft((p) => ({ ...p, transactionFeePercentage: e.target.value }))}
        />
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontWeight: 700 }}>Fondeka Fees</div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Internal fee and interchange configuration used by Fondeka pricing.
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="interchangeFeePercentage">Interchange fee %</label>
          <input
            id="interchangeFeePercentage"
            type="number"
            min={0}
            step="0.01"
            value={draft.interchangeFeePercentage}
            onChange={(e) => setDraft((p) => ({ ...p, interchangeFeePercentage: e.target.value }))}
            placeholder="5.00"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="minInterchangeFeeAmount">Min interchange fee (USD)</label>
          <input
            id="minInterchangeFeeAmount"
            type="number"
            min={0}
            step="0.01"
            value={draft.minInterchangeFeeAmount}
            onChange={(e) => setDraft((p) => ({ ...p, minInterchangeFeeAmount: e.target.value }))}
            placeholder="2.00"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="maxInterchangeFeeAmount">Max interchange fee (USD)</label>
          <input
            id="maxInterchangeFeeAmount"
            type="number"
            min={0}
            step="0.01"
            value={draft.maxInterchangeFeeAmount}
            onChange={(e) => setDraft((p) => ({ ...p, maxInterchangeFeeAmount: e.target.value }))}
            placeholder="10.00"
          />
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1', color: 'var(--muted)', fontSize: '12px' }}>
        Leave all interchange fields empty for no interchange earnings; set percentage only for pure percent; set percentage + min/max for bounded earnings.
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontWeight: 700 }}>Provider Fees</div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Provider-side fallback fee estimate used for declined card-payment notifications when the webhook does not send explicit provider fee amounts.
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="providerTransactionFeePercentage">Provider transaction fee %</label>
          <input
            id="providerTransactionFeePercentage"
            type="number"
            min={0}
            step="0.01"
            value={draft.providerTransactionFeePercentage}
            onChange={(e) => setDraft((p) => ({ ...p, providerTransactionFeePercentage: e.target.value }))}
            placeholder="1.00"
          />
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Percentage charged by the provider on card payments.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="minProviderTransactionFeeAmount">Min provider transaction fee ({draft.currency || 'USD'})</label>
          <input
            id="minProviderTransactionFeeAmount"
            type="number"
            min={0}
            step="0.01"
            value={draft.minProviderTransactionFeeAmount}
            onChange={(e) => setDraft((p) => ({ ...p, minProviderTransactionFeeAmount: e.target.value }))}
            placeholder="1.00"
          />
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Minimum provider fee amount charged per transaction.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="maxProviderTransactionFeeAmount">Max provider transaction fee ({draft.currency || 'USD'})</label>
          <input
            id="maxProviderTransactionFeeAmount"
            type="number"
            min={0}
            step="0.01"
            value={draft.maxProviderTransactionFeeAmount}
            onChange={(e) => setDraft((p) => ({ ...p, maxProviderTransactionFeeAmount: e.target.value }))}
            placeholder="10.00"
          />
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Optional cap on provider fee amount.
          </div>
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontWeight: 700 }}>App Display Fee Labels</div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Informational fee labels returned to the customer app only. These values do not control pricing, charging, refunds, or provider fee logic.
          Percentages are human values, so 3.25 means 3.25%.
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="fundCardFeePercentage">Fund card fee %</label>
          <input
            id="fundCardFeePercentage"
            type="number"
            min={0}
            step="0.01"
            value={draft.fundCardFeePercentage}
            onChange={(e) => setDraft((p) => ({ ...p, fundCardFeePercentage: e.target.value }))}
            placeholder="3.25"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="minFundCardFeeAmount">Minimum fund card fee ({draft.currency || 'currency'})</label>
          <input
            id="minFundCardFeeAmount"
            type="number"
            min={0}
            step="0.01"
            value={draft.minFundCardFeeAmount}
            onChange={(e) => setDraft((p) => ({ ...p, minFundCardFeeAmount: e.target.value }))}
            placeholder="1.00"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="withdrawFromCardFeePercentage">Withdraw from card fee %</label>
          <input
            id="withdrawFromCardFeePercentage"
            type="number"
            min={0}
            step="0.01"
            value={draft.withdrawFromCardFeePercentage}
            onChange={(e) => setDraft((p) => ({ ...p, withdrawFromCardFeePercentage: e.target.value }))}
            placeholder="2.50"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="minWithdrawFromCardFeeAmount">Minimum withdraw from card fee ({draft.currency || 'currency'})</label>
          <input
            id="minWithdrawFromCardFeeAmount"
            type="number"
            min={0}
            step="0.01"
            value={draft.minWithdrawFromCardFeeAmount}
            onChange={(e) => setDraft((p) => ({ ...p, minWithdrawFromCardFeeAmount: e.target.value }))}
            placeholder="0.75"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="onlineTransactionFeePercentage">Online transaction fee %</label>
          <input
            id="onlineTransactionFeePercentage"
            type="number"
            min={0}
            step="0.01"
            value={draft.onlineTransactionFeePercentage}
            onChange={(e) => setDraft((p) => ({ ...p, onlineTransactionFeePercentage: e.target.value }))}
            placeholder="1.50"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="minOnlineTransactionFeeAmount">Minimum online transaction fee ({draft.currency || 'currency'})</label>
          <input
            id="minOnlineTransactionFeeAmount"
            type="number"
            min={0}
            step="0.01"
            value={draft.minOnlineTransactionFeeAmount}
            onChange={(e) => setDraft((p) => ({ ...p, minOnlineTransactionFeeAmount: e.target.value }))}
            placeholder="0.50"
          />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="validityLength">Validity length</label>
          <input
            id="validityLength"
            type="number"
            value={draft.validityLength}
            onChange={(e) => setDraft((p) => ({ ...p, validityLength: e.target.value }))}
            placeholder="12"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="validityType">Validity type</label>
          <select
            id="validityType"
            value={draft.validityType}
            onChange={(e) => setDraft((p) => ({ ...p, validityType: e.target.value }))}
          >
            <option value="">Select</option>
            {['DAYS', 'MONTHS', 'YEARS'].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rank">Rank</label>
        <input id="rank" type="number" value={draft.rank} onChange={(e) => setDraft((p) => ({ ...p, rank: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="active" type="checkbox" checked={draft.active} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
        <label htmlFor="active">Active</label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="notesEn">Notes (English, optional)</label>
        <textarea
          id="notesEn"
          rows={3}
          value={draft.notesEn}
          onChange={(e) => setDraft((p) => ({ ...p, notesEn: e.target.value }))}
          placeholder="This works best for online purchases."
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="notesFr">Notes (French, optional)</label>
        <textarea
          id="notesFr"
          rows={3}
          value={draft.notesFr}
          onChange={(e) => setDraft((p) => ({ ...p, notesFr: e.target.value }))}
          placeholder="Cette carte fonctionne mieux pour les achats en ligne."
        />
      </div>
    </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Product ↔ Provider</div>
          <div style={{ color: 'var(--muted)' }}>Map card products to providers with pricing and fees.</div>
        </div>
        <Link href="/dashboard/cards" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Cards hub
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="size">Size</label>
          <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button type="button" onClick={openCreate} className="btn-success">
          Add mapping
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No mappings found" />

      {showCreate && (
        <Modal title="Add product/provider mapping" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit mapping ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {showMetadata && (
        <Modal title={`Edit metadata ${selected?.id}`} onClose={() => setShowMetadata(false)}>
          {renderMetadataForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowMetadata(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleMetadataUpdate} className="btn-primary">Save metadata</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Card product ID', value: selected?.cardProductId },
              { label: 'Card product', value: selected?.cardBrandName },
              { label: 'Card provider ID', value: selected?.cardProviderId },
              { label: 'Card provider', value: selected?.cardProviderName },
              { label: 'Provider card program ID', value: selected?.cardProgramId || '—' },
              { label: 'Label', value: selected?.label || '—' },
              { label: 'Label icon', value: selected?.labelIcon || '—' },
              { label: 'Label background color', value: selected?.labelBackgroundColor || '—' },
              { label: 'Provider background image URL', value: selected?.backgroundImageUrl || '—' },
              { label: 'Best for description', value: selected?.description || '—' },
              { label: 'Best for codes', value: formatCodeList(selected?.bestFor) },
              { label: 'Functionality codes', value: formatCodeList(selected?.functionalities) },
              { label: 'Popular platforms', value: formatJson(selected?.popularPlatforms) },
              { label: 'Capabilities', value: formatJson(selected?.capabilities) },
              { label: 'Currency', value: selected?.currency || '—' },
              { label: 'Price', value: selected?.price ?? '—' },
              { label: 'Purchase cost', value: selected?.purchaseCost ?? '—' },
              { label: 'Verification cost (USD)', value: selected?.verificationCost ?? '—' },
              { label: 'Unload fee (USD)', value: selected?.unloadFee ?? '—' },
              { label: 'Transaction fee %', value: selected?.transactionFeePercentage ?? '—' },
              { label: 'Interchange fee %', value: selected?.interchangeFeePercentage ?? '—' },
              { label: 'Min interchange fee (USD)', value: selected?.minInterchangeFeeAmount ?? '—' },
              { label: 'Max interchange fee (USD)', value: selected?.maxInterchangeFeeAmount ?? '—' },
              { label: 'Provider transaction fee %', value: selected?.providerTransactionFeePercentage ?? '—' },
              { label: 'Min provider transaction fee', value: selected?.minProviderTransactionFeeAmount ?? '—' },
              { label: 'Max provider transaction fee', value: selected?.maxProviderTransactionFeeAmount ?? '—' },
              { label: 'Fund card fee %', value: selected?.fundCardFeePercentage ?? '—' },
              { label: 'Minimum fund card fee', value: formatAmount(selected, 'minFundCardFeeAmount') },
              { label: 'Withdraw from card fee %', value: selected?.withdrawFromCardFeePercentage ?? '—' },
              { label: 'Minimum withdraw from card fee', value: formatAmount(selected, 'minWithdrawFromCardFeeAmount') },
              { label: 'Online transaction fee %', value: selected?.onlineTransactionFeePercentage ?? '—' },
              { label: 'Minimum online transaction fee', value: formatAmount(selected, 'minOnlineTransactionFeeAmount') },
              { label: 'Validity length', value: selected?.validityLength ?? '—' },
              { label: 'Validity type', value: selected?.validityType ?? '—' },
              { label: 'Rank', value: selected?.rank ?? '—' },
              { label: 'Notes (EN)', value: selected?.notesEn || '—' },
              { label: 'Notes (FR)', value: selected?.notesFr || '—' },
              { label: 'Active', value: selected?.active === undefined || selected?.active === null ? '—' : String(selected?.active) }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete mapping <strong>{confirmDelete.cardBrandName || confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
