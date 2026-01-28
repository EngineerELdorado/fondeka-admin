'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const TYPES = ['QUICK_CHARGE', 'INVOICE', 'DONATION'];

const updateRows = (prev, type, allowCustomSettlement) => {
  const next = (prev || []).filter((row) => String(row.type || '').toUpperCase() !== type);
  return [...next, { type, allowCustomSettlement }];
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
      allowCustomSettlement: Boolean(map.get(type)?.allowCustomSettlement)
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

  const toggleSetting = async (type, nextValue) => {
    if (!type) return;
    const previousValue = orderedRows.find((row) => row.type === type)?.allowCustomSettlement ?? false;
    setRows((prev) => updateRows(prev, type, nextValue));
    setSavingType(type);
    setError(null);
    try {
      await api.paymentRequestTypeSettings.update(type, { allowCustomSettlement: nextValue });
      pushToast({
        tone: 'success',
        message: `${type} custom settlement ${nextValue ? 'enabled' : 'disabled'}`
      });
    } catch (err) {
      const message = err.message || 'Failed to update settlement option';
      setRows((prev) => updateRows(prev, type, previousValue));
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
          <div style={{ color: 'var(--muted)' }}>Control whether each payment request type can choose custom settlement.</div>
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
        {orderedRows.map((row) => {
          const isSaving = savingType === row.type;
          return (
            <div
              key={row.type}
              style={{
                display: 'flex',
                alignItems: 'center',
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={row.allowCustomSettlement}
                  onChange={(e) => toggleSetting(row.type, e.target.checked)}
                  disabled={isSaving}
                />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{isSaving ? 'Saving…' : row.allowCustomSettlement ? 'Allowed' : 'Not allowed'}</span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
