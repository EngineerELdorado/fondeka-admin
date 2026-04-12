'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function RegistrationPolicyConfigPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [forcePhoneVerificationBeforeNextStep, setForcePhoneVerificationBeforeNextStep] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.registrationPolicyConfig.get();
      setForcePhoneVerificationBeforeNextStep(Boolean(res?.forcePhoneVerificationBeforeNextStep));
    } catch (err) {
      setError(err?.message || 'Failed to load registration policy config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.registrationPolicyConfig.update({
        forcePhoneVerificationBeforeNextStep: Boolean(forcePhoneVerificationBeforeNextStep)
      });
      setInfo('Registration policy config updated.');
      await loadConfig();
    } catch (err) {
      setError(err?.message || 'Failed to save registration policy config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '760px' }}>
      <div className="card" style={{ display: 'grid', gap: '0.3rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Registration Policy Config</div>
        <div style={{ color: 'var(--muted)' }}>
          Controls global registration-flow signals sent to the client app.
        </div>
        <div style={{ color: 'var(--muted)' }}>
          This setting does not change Cognito callback handling. It only tells the app whether phone verification must happen before registration continues.
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 700 }}>Phone Verification Gate</div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            The app reads this policy through `GET /public/registration/policy`.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Disabled by default. This is currently a global setting and does not yet vary by country, account, or other criteria.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={forcePhoneVerificationBeforeNextStep}
              onChange={(e) => setForcePhoneVerificationBeforeNextStep(e.target.checked)}
              disabled={loading || saving}
            />
            Force Phone Verification Before Registration Continues
          </label>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            When enabled, the app must verify the user&apos;s phone number before proceeding to the next registration step. Disabled by default.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={loadConfig} disabled={loading || saving}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={loading || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
