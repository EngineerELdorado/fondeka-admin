'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const TYPES = ['QUICK_CHARGE', 'INVOICE', 'DONATION'];

const updateRows = (prev, type, changes) => {
  const upperType = String(type || '').toUpperCase();
  const next = (prev || []).filter((row) => String(row.type || '').toUpperCase() !== upperType);
  const existing = (prev || []).find((row) => String(row.type || '').toUpperCase() === upperType) || { type: upperType };
  return [...next, { ...existing, ...changes, type: upperType }];
};

export default function PaymentRequestSettlementOptionsPage() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState('');
  const [error, setError] = useState(null);

  const orderedRows = useMemo(() => {
    const map = new Map((rows || []).map((row) => [String(row.type || '').toUpperCase(), row]));
    return TYPES.map((type) => ({
      type,
      allowCustomSettlement: Boolean(map.get(type)?.allowCustomSettlement),
      allowAutoApproveOnCreate: Boolean(map.get(type)?.allowAutoApproveOnCreate)
    }));
  }, [rows]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.paymentRequestTypeSettings.list();
      setRows(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err.message || 'Failed to load settlement options');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async (type, updates) => {
    if (!type) return;
    const previousRow = orderedRows.find((row) => row.type === type) || { allowCustomSettlement: false, allowAutoApproveOnCreate: false };
    const nextRow = { ...previousRow, ...updates };
    setRows((prev) => updateRows(prev, type, nextRow));
    setSavingType(type);
    setError(null);
    try {
      await api.paymentRequestTypeSettings.update(type, {
        allowCustomSettlement: Boolean(nextRow.allowCustomSettlement),
        allowAutoApproveOnCreate: Boolean(nextRow.allowAutoApproveOnCreate)
      });
      pushToast({
        tone: 'success',
        message: `${type} settings updated`
      });
    } catch (err) {
      const message = err.message || 'Failed to update settlement option';
      setRows((prev) => updateRows(prev, type, previousRow));
      setError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setSavingType('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Settlement Options</div>
          <div style={{ color: 'var(--muted)' }}>Control custom settlement and auto-approve rules per payment request type.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard/payment-requests" className="btn-neutral">
            ← Payment Requests
          </Link>
          <button type="button" className="btn-neutral" onClick={loadSettings} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: '0.6rem' }}>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Auto-approve on create only applies to DONATION. Even when auto-approve is off, the backend still auto-approves if the account KYC is APPROVED or PROVISIONALLY_APPROVED and KYC level &gt; 0.
        </div>
        {orderedRows.map((row) => {
          const isSaving = savingType === row.type;
          const isDonation = row.type === 'DONATION';
          return (
            <div
              key={row.type}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '0.75rem',
                padding: '0.6rem 0.75rem',
                border: `1px solid var(--border)`,
                borderRadius: '10px'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <div style={{ fontWeight: 700 }}>{row.type}</div>
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  {row.allowCustomSettlement ? 'Custom settlement allowed' : 'Default settlement only'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '220px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={row.allowCustomSettlement}
                    onChange={(e) => saveSettings(row.type, { allowCustomSettlement: e.target.checked })}
                    disabled={isSaving}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {isSaving ? 'Saving…' : row.allowCustomSettlement ? 'Custom allowed' : 'Custom blocked'}
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isDonation ? 1 : 0.5 }}>
                  <input
                    type="checkbox"
                    checked={row.allowAutoApproveOnCreate}
                    onChange={(e) => saveSettings(row.type, { allowAutoApproveOnCreate: e.target.checked })}
                    disabled={isSaving || !isDonation}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {isDonation ? (row.allowAutoApproveOnCreate ? 'Auto-approve on create' : 'Manual approval required') : 'Auto-approve (DONATION only)'}
                  </span>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
