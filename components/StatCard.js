'use client';

import { useAuth } from '@/contexts/AuthContext';
import { isRegulatorRestrictedService } from '@/lib/regulator-presentation';

export function StatCard({ title, value, hint }) {
  const { enableRegulatorMode } = useAuth();
  if (enableRegulatorMode !== false && isRegulatorRestrictedService(title)) return null;
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <div style={{ fontSize: '14px', color: '#6b7280' }}>{title}</div>
      <div style={{ fontSize: '28px', fontWeight: 800 }}>{value}</div>
      {hint && <div style={{ color: '#9ca3af', fontSize: '13px' }}>{hint}</div>}
    </div>
  );
}
