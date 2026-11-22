'use client';

import { PURCHASE_INFORMATION_FIELDS, PURCHASE_INFORMATION_LANGUAGES } from '@/lib/card-purchase-information';

export default function CardPurchaseInformationFields({ value, onChange, countries = [], countriesError = '' }) {
  const update = (key, next) => onChange(previous => ({ ...previous, [key]: next }));
  const countryOptions = (Array.isArray(countries) ? countries : []).filter(country => /^[A-Za-z]{2}$/.test(country.alpha2Code || ''));
  const selectedCountry = value.cardCountryCode || '';
  const hasSelectedCountry = countryOptions.some(country => country.alpha2Code.toUpperCase() === selectedCountry);
  return (
    <fieldset style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem', minWidth: 0, gridColumn: '1 / -1', display: 'grid', gap: '1rem' }}>
      <legend>Purchase information</legend>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>
        Explain this card in English and French using plain text. Leave unconfirmed information empty. These descriptions do not change the card’s fees, limits or policies.
      </div>
      <div style={{ display: 'grid', gap: '0.3rem' }}>
        <label htmlFor="issuerBankName">Issuing bank</label>
        <input id="issuerBankName" type="text" maxLength={255} value={value.issuerBankName || ''}
          onChange={event => update('issuerBankName', event.target.value)} />
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>Use the bank’s official name. Leave empty if it has not been confirmed.</span>
      </div>
      <div style={{ display: 'grid', gap: '0.3rem' }}>
        <label htmlFor="cardCountryCode">Issuing country</label>
        <select id="cardCountryCode" value={selectedCountry} onChange={event => update('cardCountryCode', event.target.value)}>
          <option value="">Not configured</option>
          {selectedCountry && !hasSelectedCountry ? <option value={selectedCountry}>{selectedCountry} (current selection)</option> : null}
          {countryOptions.map(country => <option key={country.alpha2Code} value={country.alpha2Code.toUpperCase()}>
            {country.name} ({country.alpha2Code.toUpperCase()})
          </option>)}
        </select>
        {countriesError ? <span role="alert" style={{ color: 'var(--muted)', fontSize: 12 }}>{countriesError}</span> : null}
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>Choose the card’s issuing country. Leave empty if it has not been confirmed.</span>
      </div>
      {PURCHASE_INFORMATION_FIELDS.map(field => (
        <section key={field.name} style={{ display: 'grid', gap: '0.5rem' }}>
          <strong>{field.label}</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: '0.8rem' }}>
            {PURCHASE_INFORMATION_LANGUAGES.map(language => {
              const key = field.name + language.suffix;
              const points = Array.isArray(value[key]) ? value[key] : [];
              return <div key={key} style={{ display: 'grid', alignContent: 'start', gap: '0.4rem' }}>
                {field.list ? <>
                  <span>{language.label}</span>
                  {points.map((point, index) => <div key={index} style={{ display: 'grid', gap: '0.2rem' }}>
                    <label htmlFor={`${key}-${index}`}>{field.label} ({language.label}) — point {index + 1}</label>
                    <textarea id={`${key}-${index}`} rows={2} maxLength={500} value={point}
                      onChange={event => update(key, points.map((item, at) => at === index ? event.target.value : item))} />
                    <button type="button" aria-label={`Remove ${field.label} point ${index + 1} (${language.label})`}
                      onClick={() => update(key, points.filter((_, at) => at !== index))}>Remove point</button>
                  </div>)}
                  {!points.length ? <span style={{ color: 'var(--muted)', fontSize: 12 }}>No points configured.</span> : null}
                  <button type="button" disabled={points.length >= 20} onClick={() => update(key, [...points, ''])}>
                    Add {field.label.toLowerCase()} point ({language.label})
                  </button>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>Up to 20 points; 500 characters per point.</span>
                </> : <>
                  <label htmlFor={key}>{field.label} ({language.label})</label>
                  <textarea id={key} rows={4} maxLength={4000} value={value[key] || ''} onChange={event => update(key, event.target.value)} />
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>Up to 4000 characters.</span>
                </>}
              </div>;
            })}
          </div>
        </section>
      ))}
    </fieldset>
  );
}
