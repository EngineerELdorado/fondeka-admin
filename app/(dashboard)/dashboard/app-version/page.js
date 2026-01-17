'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const serviceOptions = ['LENDING', 'CRYPTO', 'WALLET', 'BILL_PAYMENTS', 'CARD', 'PAYMENT_REQUEST', 'E_SIM', 'AIRTIME_AND_DATA', 'OTHER'];

export default function AppVersionPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('');
  const [draftVersion, setDraftVersion] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesDeleting, setRulesDeleting] = useState(null);
  const [rulesError, setRulesError] = useState(null);
  const [rulesInfo, setRulesInfo] = useState(null);
  const [ruleService, setRuleService] = useState('');
  const [ruleMinVersion, setRuleMinVersion] = useState('');

  const loadVersion = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.appVersion.get();
      const value = res?.appVersion ?? '';
      setCurrentVersion(value);
      setDraftVersion(value);
    } catch (err) {
      setError(err.message || 'Failed to load global app version');
    } finally {
      setLoading(false);
    }
  };

  const loadServiceRules = async () => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const res = await api.appVersion.listServiceRules();
      const list = Array.isArray(res) ? res : res?.content || [];
      const order = (service) => {
        const index = serviceOptions.indexOf(service);
        return index === -1 ? Number.MAX_SAFE_INTEGER : index;
      };
      setRules([...list].sort((a, b) => order(a?.service) - order(b?.service)));
    } catch (err) {
      setRulesError(err.message || 'Failed to load service rules');
    } finally {
      setRulesLoading(false);
    }
  };

  useEffect(() => {
    loadVersion();
    loadServiceRules();
  }, []);

  useEffect(() => {
    if (!info && !error) return;
    const timer = setTimeout(() => {
      setInfo(null);
      setError(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [info, error]);

  useEffect(() => {
    if (!rulesInfo && !rulesError) return;
    const timer = setTimeout(() => {
      setRulesInfo(null);
      setRulesError(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [rulesInfo, rulesError]);

  const handleUpdate = async () => {
    const nextVersion = draftVersion.trim();
    if (!nextVersion) {
      setError('Enter an app version.');
      return;
    }
    if (saving) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.appVersion.update({ appVersion: nextVersion });
      const value = res?.appVersion ?? nextVersion;
      setCurrentVersion(value);
      setDraftVersion(value);
      setInfo(`Global app version updated to ${value}.`);
    } catch (err) {
      setError(err.message || 'Failed to update app version');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRule = async () => {
    const service = ruleService.trim();
    const minVersion = ruleMinVersion.trim();
    if (!service) {
      setRulesError('Select a service.');
      return;
    }
    if (!minVersion) {
      setRulesError('Enter a minimum version.');
      return;
    }
    if (rulesSaving) return;
    setRulesSaving(true);
    setRulesError(null);
    setRulesInfo(null);
    try {
      await api.appVersion.updateServiceRule(service, { minVersion });
      setRulesInfo(`Rule saved for ${service}.`);
      setRuleService('');
      setRuleMinVersion('');
      await loadServiceRules();
    } catch (err) {
      setRulesError(err.message || 'Failed to save service rule');
    } finally {
      setRulesSaving(false);
    }
  };

  const handleEditRule = (rule) => {
    setRuleService(rule?.service || '');
    setRuleMinVersion(rule?.minVersion || '');
  };

  const handleDeleteRule = async (service) => {
    if (!service || rulesDeleting) return;
    if (!window.confirm(`Remove rule for ${service}?`)) return;
    setRulesDeleting(service);
    setRulesError(null);
    setRulesInfo(null);
    try {
      await api.appVersion.removeServiceRule(service);
      setRulesInfo(`Rule removed for ${service}.`);
      if (ruleService === service) {
        setRuleService('');
        setRuleMinVersion('');
      }
      await loadServiceRules();
    } catch (err) {
      setRulesError(err.message || 'Failed to remove service rule');
    } finally {
      setRulesDeleting(null);
    }
  };

  const handleClearRuleForm = () => {
    setRuleService('');
    setRuleMinVersion('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 800 }}>App Version</div>
        <div style={{ color: 'var(--muted)' }}>Update the default app version for all accounts.</div>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}
      {info && (
        <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>
          {info}
        </div>
      )}

      <div className="card" style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Global version</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          {loading ? 'Loading global version...' : currentVersion ? `Current: ${currentVersion}` : 'No global version set.'}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: '200px' }}>
            <span>Version</span>
            <input value={draftVersion} onChange={(e) => setDraftVersion(e.target.value)} placeholder="1.2" />
          </label>
          <button type="button" className="btn-primary" onClick={handleUpdate} disabled={loading || saving}>
            {saving ? 'Saving...' : 'Update version'}
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Service version rules</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Set minimum versions per service. LENDING and CRYPTO are pre-seeded to 1.1.
        </div>

        {rulesError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{rulesError}</div>}
        {rulesInfo && <div style={{ color: '#15803d', fontWeight: 700 }}>{rulesInfo}</div>}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '220px' }}>
            <span>Service</span>
            <select value={ruleService} onChange={(e) => setRuleService(e.target.value)}>
              <option value="">Select service</option>
              {serviceOptions.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '160px' }}>
            <span>Min version</span>
            <input value={ruleMinVersion} onChange={(e) => setRuleMinVersion(e.target.value)} placeholder="1.1" />
          </label>
          <button type="button" className="btn-primary" onClick={handleSaveRule} disabled={rulesSaving || rulesLoading}>
            {rulesSaving ? 'Saving...' : 'Save rule'}
          </button>
          <button type="button" className="btn-neutral" onClick={handleClearRuleForm} disabled={rulesSaving}>
            Clear
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Service</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Min version</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rulesLoading ? (
                <tr>
                  <td colSpan={3} style={{ padding: '0.75rem', color: 'var(--muted)' }}>
                    Loading service rules...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '0.75rem', color: 'var(--muted)' }}>
                    No service rules configured.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.service}>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{rule.service}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{rule.minVersion || '—'}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn-neutral btn-sm" onClick={() => handleEditRule(rule)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-neutral btn-sm"
                          onClick={() => handleDeleteRule(rule.service)}
                          disabled={rulesDeleting === rule.service}
                        >
                          {rulesDeleting === rule.service ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
