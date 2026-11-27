'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { CountrySelect } from '@/components/CountrySelect';
import COUNTRIES from '@/data/countries';
import { api } from '@/lib/api';
import { mobileMoneyCountryPermissions, mobileMoneyCountryCodes, mobileMoneyCountryPolicy, mobileMoneyCountryName, sameCountryCodes } from '@/lib/business-api-mobile-money-countries';

const actions = { display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' };

export default function BusinessApiMobileMoneyCountriesPanel({ accountId = null }) {
  const { session, refreshSession } = useAuth();
  const { locale } = useLocale();
  const { canRead, canWrite } = mobileMoneyCountryPermissions(session);
  const accountScope = accountId != null;
  const [policy, setPolicy] = useState(null), [codes, setCodes] = useState([]), [mode, setMode] = useState('inherit');
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [info, setInfo] = useState('');
  const [reload, setReload] = useState(0), [needsReload, setNeedsReload] = useState(false), [denied, setDenied] = useState(false);
  const scope = useRef(null);
  const countryOptions = useMemo(() => COUNTRIES.filter((country) => country.cca2 !== 'XK').map((country) => ({ ...country, name: mobileMoneyCountryName(country.cca2, COUNTRIES, locale) })), [locale]);
  const countryList = (values) => values.length ? values.map((code) => `${mobileMoneyCountryName(code, COUNTRIES, locale)} (${code})`).join(', ') : 'No countries enabled';
  const apply = useCallback((saved) => {
    setPolicy(saved);
    setCodes(saved.overrideCountryCodes ?? saved.globalCountryCodes);
    setMode(saved.inherited ? 'inherit' : 'custom');
    setNeedsReload(false);
  }, []);

  useEffect(() => {
    const current = { active: true, pending: true };
    scope.current = current;
    setPolicy(null); setCodes([]); setMode('inherit'); setError(''); setInfo(''); setNeedsReload(false); setDenied(false);
    setBusy(canRead);
    if (canRead) {
      const load = async () => {
        try {
          const response = accountId == null ? await api.businessApiMobileMoneyCountries.get() : await api.businessApiMobileMoneyCountries.getAccount(accountId);
          const saved = mobileMoneyCountryPolicy(response, accountId);
          if (current.active) apply(saved);
        } catch (err) {
          if (current.active) setError(err?.status === 404 ? 'Mobile Money country settings are unavailable for this backend or account.' : err?.status === 403 ? 'Permission denied. You cannot read this policy.' : err?.status === 401 ? 'Your session has expired. Sign in again or reload after renewing your session.' : err?.message || 'Failed to load Mobile Money countries.');
        } finally {
          current.pending = false;
          if (current.active) setBusy(false);
        }
      };
      void load();
    }
    return () => { current.active = false; };
  }, [accountId, canRead, reload, apply]);

  const currentPolicy = policy && (accountScope ? String(policy.accountId) === String(accountId) : policy.accountId === null) ? policy : null;
  const ready = Boolean(currentPolicy) && !needsReload && !denied;
  const dirty = Boolean(currentPolicy) && (accountScope
    ? mode === 'inherit' ? !currentPolicy.inherited : currentPolicy.inherited || !sameCountryCodes(codes, currentPolicy.overrideCountryCodes)
    : !sameCountryCodes(codes, currentPolicy.globalCountryCodes));
  const disabled = busy || !ready || !canWrite;
  const save = async () => {
    const current = scope.current;
    if (disabled || !dirty || !current?.active || current.pending) return;
    current.pending = true; setBusy(true); setError(''); setInfo('');
    let accepted = false;
    try {
      const payload = { allowedCountryCodes: mobileMoneyCountryCodes(codes) };
      const response = accountScope
        ? mode === 'inherit' ? await api.businessApiMobileMoneyCountries.resetAccount(accountId) : await api.businessApiMobileMoneyCountries.updateAccount(accountId, payload)
        : await api.businessApiMobileMoneyCountries.update(payload);
      accepted = true;
      const saved = mobileMoneyCountryPolicy(response, accountId);
      if (current.active) {
        apply(saved);
        setInfo(accountScope && saved.inherited ? 'Account override removed. This account now uses the global settings.' : 'Mobile Money API countries saved. New collections, payouts and quotes use this policy.');
      }
    } catch (err) {
      if (current.active) {
        setError(`${accepted ? 'The update was accepted, but the saved policy could not be verified. ' : ''}${err?.status === 403 ? 'Permission denied. ' : ''}${err?.message || 'Failed to save Mobile Money countries.'}`);
        if (err?.status === 403) setDenied(true);
        if (accepted || !err?.status || err.status >= 500 || err.status === 409) setNeedsReload(true);
        if (err?.status === 401 && refreshSession) await refreshSession(true);
      }
    } finally {
      current.pending = false;
      if (current.active) setBusy(false);
    }
  };

  if (!canRead) return <section className="card" role="alert">Permission denied. Admin, Super Admin or Assistant access is required to review Mobile Money API countries.</section>;
  const id = accountScope ? 'account-api-settings' : 'mobile-money-api-countries';
  return <section id={id} className="card" aria-labelledby={`${id}-title`} style={{ display: 'grid', gap: '0.85rem', minWidth: 0 }}>
    <div style={{ ...actions, justifyContent: 'space-between' }}>
      <div><h2 id={`${id}-title`} style={{ margin: 0, fontSize: '1.1rem' }}>{accountScope ? 'Account API settings — Mobile Money countries' : 'Mobile Money API countries'}</h2><p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: 0 }}>{accountScope ? `Applies to every Business and API key belonging to account ${accountId}.` : 'Global country list for accounts without a custom override.'}</p></div>
      <button type="button" className="btn-neutral btn-sm" disabled={busy} onClick={() => setReload((value) => value + 1)}>Reload saved country settings</button>
    </div>
    {busy ? <div role="status">Loading or saving country settings…</div> : null}
    {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
    {info ? <div className="alert alert-success" role="status">{info}</div> : null}
    {currentPolicy ? <div style={{ display: 'grid', gap: '0.5rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
      <div><strong>Saved effective countries: </strong>{countryList(currentPolicy.effectiveCountryCodes)}</div>
      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Policy source: {accountScope ? currentPolicy.inherited ? 'Global settings (inherited)' : 'Custom account override' : 'Global settings'}</div>
      {accountScope ? <div style={{ fontSize: '13px' }}><strong>Current global countries: </strong>{countryList(currentPolicy.globalCountryCodes)}</div> : null}
    </div> : null}
    {!canWrite || denied ? <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Read only. Admin or Super Admin access is required to change this policy.</div> : null}
    {accountScope ? <fieldset disabled={disabled} style={{ margin: 0, border: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
      <legend style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Country policy for this account</legend>
      <label style={actions}><input style={{ width: 'auto' }} type="radio" name={`${id}-scope`} aria-label="Use global settings" checked={mode === 'inherit'} onChange={() => setMode('inherit')} />Use global settings</label>
      <label style={actions}><input style={{ width: 'auto' }} type="radio" name={`${id}-scope`} aria-label="Custom account countries" checked={mode === 'custom'} onChange={() => setMode('custom')} />Custom countries for this account</label>
      <small>Choose Use global settings and save to remove the override. A custom list replaces the global list; it does not add to it.</small>
    </fieldset> : null}
    {!accountScope || mode === 'custom' ? <label style={{ display: 'grid', gap: '0.4rem', minWidth: 0 }}>
      <span style={{ fontWeight: 700 }}>Allowed payment-method countries</span>
      <CountrySelect aria-label="Allowed Mobile Money API countries" records={countryOptions} multiple emptyLabel="No countries enabled" value={codes} disabled={disabled} onChange={(event) => setCodes(mobileMoneyCountryCodes(Array.from(event.target.selectedOptions, (option) => option.value)))} />
      <small>DR Congo (CD) and Congo-Brazzaville (CG) are separate countries. Clearing this list disables Mobile Money API for accounts using this policy.</small>
    </label> : null}
    {dirty ? <div style={{ background: 'var(--accent-soft)', padding: '0.7rem', borderRadius: '10px' }}><strong>Unsaved changes. After saving: </strong>{accountScope && mode === 'inherit' ? `Use global settings — ${countryList(currentPolicy.globalCountryCodes)}` : countryList(codes)}</div> : null}
    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Changes affect new Mobile Money API collections, payouts and quotes in both LIVE and SANDBOX. Previously accepted payments continue processing. Country enablement does not configure routes, providers, fees or funding eligibility.</div>
    {needsReload ? <div role="alert">Reload the saved country settings before saving again. Review the saved result before making another change.</div> : null}
    {canWrite && !denied ? <div style={actions}><button type="button" className="btn-primary" disabled={disabled || !dirty} onClick={() => void save()}>Save country policy</button>{dirty ? <small>Reloading replaces your unsaved selection with the saved policy.</small> : null}</div> : null}
    {accountScope ? <Link href="/dashboard/feature-flags#business-api-settings">Manage global API settings</Link> : <small>Account overrides can enable a different list, including when the global list is empty. Manage them under Accounts → account details → Account API settings.</small>}
  </section>;
}
