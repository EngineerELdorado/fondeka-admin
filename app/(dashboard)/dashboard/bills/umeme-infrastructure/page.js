'use client';

import { useEffect, useRef, useState } from 'react';
import { PresentationLink as Link } from '@/components/RegulatorPresentation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import styles from './umeme-infrastructure.module.css';

const mode = value => ['LEGACY', 'V1'].includes(value);
const accountId = value => {
  const text = String(value).trim();
  if (!/^[1-9][0-9]{0,18}$/.test(text) || BigInt(text) > 9223372036854775807n) return null;
  return text;
};
const settingsKey = (defaultMode, products, accounts) => JSON.stringify([
  defaultMode,
  Object.entries(products).sort(([a], [b]) => a.localeCompare(b)),
  accounts.map(row => [String(row.id).trim(), row.mode]).sort(([a], [b]) => a.localeCompare(b))
]);

export default function UmemeInfrastructurePage() {
  const { session } = useAuth();
  const { locale } = useLocale();
  const fr = String(locale).startsWith('fr');
  const say = (en, french) => fr ? french : en;
  const modeName = value => value === 'V1' ? 'Umeme V1' : say('Legacy Umeme', 'Ancienne infrastructure Umeme');
  const canWrite = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload]
    .flatMap(payload => [payload?.['cognito:groups'], payload?.groups])
    .flatMap(value => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .some(value => String(value).trim().toUpperCase() === 'SUPER_ADMIN');
  const [policy, setPolicy] = useState(null);
  const [defaultMode, setDefaultMode] = useState('LEGACY');
  const [products, setProducts] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const lock = useRef(false);
  const dirty = policy && settingsKey(defaultMode, products, accounts) !== settingsKey(policy.defaultMode, policy.productOverrides, Object.entries(policy.accountOverrides).map(([id, mode]) => ({ id, mode })));
  const frozen = busy || !canWrite || reloadRequired;
  const unavailableSelection = policy && !policy.v1Ready && (defaultMode === 'V1' || Object.values(products).includes('V1') || accounts.some(row => row.mode === 'V1'));

  const apply = value => {
    if (!value || !Number.isSafeInteger(value.version) || value.version < 0 || !mode(value.defaultMode)
        || !value.productOverrides || !value.accountOverrides || typeof value.v1Ready !== 'boolean'
        || Array.isArray(value.productOverrides) || Array.isArray(value.accountOverrides)
        || Object.entries(value.productOverrides).some(([key, value]) => !['SOCODEE', 'VIRUNGA'].includes(key) || !mode(value))
        || Object.entries(value.accountOverrides).some(([id, value]) => !accountId(id) || !mode(value))) {
      throw new Error(say('The server has not returned a supported Umeme policy.', 'Le serveur n’a pas retourné une configuration Umeme compatible.'));
    }
    setPolicy(value); setDefaultMode(value.defaultMode); setProducts(value.productOverrides);
    setAccounts(Object.entries(value.accountOverrides).map(([id, mode]) => ({ id, mode })));
    setReloadRequired(false);
  };
  const load = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setInfo('');
    try { apply(await api.umemeInfrastructure.get()); }
    catch (failure) { setError(failure.message); setReloadRequired(true); }
    finally { lock.current = false; setBusy(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const edited = () => { setInfo(''); if (!reloadRequired) setError(''); };

  const save = async event => {
    event.preventDefault();
    if (lock.current || !canWrite || !policy || reloadRequired || !dirty) return;
    if (unavailableSelection) {
      setError(say('V1 is unavailable on the server. Complete server setup or remove every V1 selection before saving.', 'V1 est indisponible sur le serveur. Terminez sa configuration ou retirez tous les choix V1 avant d’enregistrer.')); return;
    }
    const overrides = {};
    for (const row of accounts) {
      const id = accountId(row.id);
      if (!id || !mode(row.mode) || overrides[id]) {
        setError(say('Enter a valid, unique account ID for each exception.', 'Saisissez un identifiant de compte valide et unique pour chaque exception.')); return;
      }
      overrides[id] = row.mode;
    }
    const body = { version: policy.version, defaultMode, productOverrides: products, accountOverrides: overrides };
    lock.current = true; setBusy(true); setSaving(true); setError(''); setInfo('');
    try { apply(await api.umemeInfrastructure.update(body)); setInfo(say('Umeme routing saved.', 'Le routage Umeme a été enregistré.')); }
    catch (failure) { setError(failure.message); setReloadRequired(true); }
    finally { lock.current = false; setBusy(false); setSaving(false); }
  };
  const choices = (inherit = false) => <>
    {inherit && <option value="">{say('Use global default', 'Utiliser le choix global')} · {modeName(defaultMode)}</option>}
    <option value="LEGACY">{modeName('LEGACY')}</option>
    <option value="V1" disabled={!policy?.v1Ready}>{policy?.v1Ready ? 'Umeme V1' : say('Umeme V1 · server setup required', 'Umeme V1 · configuration serveur requise')}</option>
  </>;

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><Link href="/dashboard/bills" className={styles.back}>{say('← Bills', '← Factures')}</Link><h1>{say('Umeme infrastructure', 'Infrastructure Umeme')}</h1><p>{say('Choose how new SOCODEE and VIRUNGA payments are routed.', 'Choisissez le routage des nouveaux paiements SOCODEE et VIRUNGA.')}</p></div>
      <div className={styles.headerActions}>{policy && <span className={styles.revision}>{say('Revision', 'Révision')} {policy.version}</span>}<button className="btn-neutral" type="button" disabled={busy} onClick={load}>{busy && !saving ? say('Refreshing…', 'Actualisation…') : say('Refresh policy', 'Actualiser la configuration')}</button></div>
    </header>

    {error && <div className={styles.error} role="alert">{error}</div>}
    {info && <div className={styles.success} role="status">{info}</div>}
    {reloadRequired && <div className={styles.notice}>{say('Refresh the policy before saving again. A refresh replaces this draft with the latest saved settings.', 'Actualisez la configuration avant de réenregistrer. L’actualisation remplace ce brouillon par les derniers réglages enregistrés.')}</div>}
    {!policy && busy && <div className={styles.panel} role="status">{say('Loading routing settings…', 'Chargement des réglages de routage…')}</div>}

    {policy && <>
      <section className={`${styles.readiness} ${policy.v1Ready ? styles.ready : styles.notReady}`} aria-labelledby="umeme-readiness-title">
        <div className={styles.readinessHeading}><span className={styles.statusDot} aria-hidden="true"/><h2 id="umeme-readiness-title">{policy.v1Ready ? say('V1 configured', 'V1 configurée') : say('V1 setup required', 'Configuration V1 requise')}</h2><span className={styles.badge}>{policy.v1Ready ? say('Available to select', 'Sélection disponible') : say('Unavailable to select', 'Sélection indisponible')}</span></div>
        <p>{policy.v1Ready ? say('The server configuration is valid. Provider connectivity and QA must still be verified before rollout.', 'La configuration du serveur est valide. La connexion au prestataire et les tests QA restent à vérifier avant le déploiement.') : say('V1 is not configured on the server. Its options stay disabled until the backend reports that setup is ready. Configure the backend, then refresh this policy.', 'V1 n’est pas configurée sur le serveur. Ses options restent désactivées tant que le backend ne confirme pas sa disponibilité. Configurez le backend, puis actualisez cette page.')}</p>
        {!policy.v1Ready && <details className={styles.setupDetails}><summary>{say('What needs to be configured?', 'Que faut-il configurer ?')}</summary>
          <p>{say('The backend checks all of the following. This response does not identify which individual check failed.', 'Le backend vérifie les éléments suivants. Cette réponse ne précise pas quelle vérification a échoué.')}</p>
          <dl className={styles.setupList}>
            <div><dt>{say('Enable the V1 integration', 'Activer l’intégration V1')}</dt><dd><code>UMEME_V1_ENABLED=true</code></dd></div>
            <div><dt>{say('Configure the separate V1 API key', 'Configurer la clé API V1 dédiée')}</dt><dd><code>UMEME_V1_API_KEY</code></dd></div>
            <div><dt>{say('Use a valid API root ending in /v1', 'Utiliser une URL API valide se terminant par /v1')}</dt><dd><code>UMEME_V1_URL</code></dd></div>
            <div><dt>{say('Set the registered public callback URL', 'Définir l’URL publique de callback enregistrée')}</dt><dd><code>UMEME_V1_CALLBACK_URL</code></dd></div>
          </dl>
          <p>{say('Connection and response timeouts must also pass server validation. Use the same configuration on web and worker processes, restart them, then refresh. Keep keys in server configuration.', 'Les délais de connexion et de réponse doivent aussi passer la validation du serveur. Utilisez la même configuration sur les processus web et worker, redémarrez-les, puis actualisez. Conservez les clés dans la configuration du serveur.')}</p>
        </details>}
      </section>

      <div className={styles.precedence}><strong>{say('Routing priority', 'Priorité du routage')}</strong><ol><li>{say('Account exception', 'Exception du compte')}</li><li>{say('Product override', 'Exception du produit')}</li><li>{say('Global default', 'Choix global')}</li></ol></div>
      {!canWrite && <p className={styles.notice}>{say('View only. Only super administrators can change routing.', 'Consultation uniquement. Seuls les super administrateurs peuvent modifier le routage.')}</p>}

      <form onSubmit={save} className={styles.form}>
        <fieldset disabled={frozen} className={styles.fields}>
          <section className={styles.panel} aria-labelledby="umeme-default-title">
            <div className={styles.sectionHeading}><div><h2 id="umeme-default-title">{say('Global default', 'Choix global')}</h2><p>{say('Used when no account or product exception applies.', 'Utilisé lorsqu’aucune exception de compte ou de produit ne s’applique.')}</p></div></div>
            <label className={styles.defaultField}><span>{say('Default infrastructure', 'Infrastructure par défaut')}</span><select aria-label="Global default" value={defaultMode} onChange={event => { edited(); setDefaultMode(event.target.value); }}>{choices()}</select></label>
          </section>

          <section className={styles.panel} aria-labelledby="umeme-products-title">
            <div className={styles.sectionHeading}><div><h2 id="umeme-products-title">{say('Product overrides', 'Exceptions par produit')}</h2><p>{say('Move a product independently, or let it follow the global default.', 'Migrez un produit séparément ou laissez-le suivre le choix global.')}</p></div><span className={styles.count}>{Object.keys(products).length} / 2</span></div>
            <div className={styles.productRows}>{['SOCODEE', 'VIRUNGA'].map(code => <div className={styles.productRow} key={code}>
              <div><strong>{code}</strong><small>{products[code] ? say('Product override', 'Exception du produit') : say('Follows global default', 'Suit le choix global')}</small></div>
              <label><span className={styles.srOnly}>{say('Infrastructure for', 'Infrastructure pour')} {code}</span><select aria-label={code} value={products[code] || ''} onChange={event => {
                edited(); const value = event.target.value; setProducts(previous => { const next = { ...previous }; if (value) next[code] = value; else delete next[code]; return next; });
              }}>{choices(true)}</select></label>
            </div>)}</div>
          </section>

          <section className={styles.panel} aria-labelledby="umeme-accounts-title">
            <div className={styles.sectionHeading}><div><h2 id="umeme-accounts-title">{say('Account exceptions', 'Exceptions par compte')} <span className={styles.count}>{accounts.length}</span></h2><p>{say('Use for a pilot rollout or to keep specific accounts on legacy. These take priority over product settings.', 'Utilisez-les pour un pilote ou pour garder certains comptes sur l’ancienne infrastructure. Elles priment sur les réglages des produits.')}</p></div><button className="btn-neutral" type="button" disabled={accounts.length >= 10000} onClick={() => { edited(); setAccounts(previous => [...previous, { id: '', mode: policy.v1Ready ? 'V1' : 'LEGACY' }]); }}>{say('Add account exception', 'Ajouter une exception de compte')}</button></div>
            {!accounts.length ? <div className={styles.empty}><strong>{say('No account exceptions', 'Aucune exception de compte')}</strong><p>{say('All accounts follow their product setting or the global default.', 'Tous les comptes suivent le réglage de leur produit ou le choix global.')}</p></div> : <div className={styles.accountRows}>{accounts.map((row, index) => <div key={index} className={styles.accountRow}>
              <label><span>{say('Account ID', 'Identifiant du compte')}</span><input aria-label={`Account ${index + 1}`} inputMode="numeric" placeholder={say('Enter account ID', 'Saisir l’identifiant')} value={row.id} onChange={event => { edited(); const id = event.target.value; setAccounts(previous => previous.map((item, at) => at === index ? { ...item, id } : item)); }} /></label>
              <label><span>{say('Infrastructure', 'Infrastructure')}</span><select aria-label={`Account mode ${index + 1}`} value={row.mode} onChange={event => { edited(); const mode = event.target.value; setAccounts(previous => previous.map((item, at) => at === index ? { ...item, mode } : item)); }}>{choices()}</select></label>
              <button className="btn-neutral" type="button" onClick={() => { edited(); setAccounts(previous => previous.filter((_, at) => at !== index)); }}>{say('Remove exception', 'Retirer l’exception')}</button>
            </div>)}</div>}
          </section>
        </fieldset>

        <footer className={styles.saveBar}>
          <div><strong>{dirty ? say('Unsaved changes', 'Modifications non enregistrées') : say('Saved configuration', 'Configuration enregistrée')}</strong><small>{reloadRequired ? say('Refresh required before saving.', 'Actualisation requise avant d’enregistrer.') : dirty ? say('Changes apply to new payments after saving. Refreshing replaces this draft.', 'Les modifications s’appliquent aux nouveaux paiements après enregistrement. Une actualisation remplace ce brouillon.') : say('Existing payments keep their saved infrastructure.', 'Les paiements existants conservent leur infrastructure enregistrée.')}</small></div>
          <div className={styles.saveActions}>{dirty && <button className="btn-neutral" type="button" disabled={frozen} onClick={() => { if (frozen) return; apply(policy); setError(''); setInfo(''); }}>{say('Discard changes', 'Annuler les modifications')}</button>}<button className="btn-primary" type="submit" disabled={frozen || !dirty || unavailableSelection}>{saving ? say('Saving…', 'Enregistrement…') : say('Save routing', 'Enregistrer le routage')}</button></div>
        </footer>
        {unavailableSelection && <p className={styles.notice}>{say('This draft still selects V1 while the server is unconfigured. Restore server setup or switch every V1 choice to legacy before saving.', 'Ce brouillon sélectionne encore V1 alors que le serveur n’est pas configuré. Rétablissez sa configuration ou remplacez tous les choix V1 par l’ancienne infrastructure avant d’enregistrer.')}</p>}
      </form>
      <div className={styles.footnote}><p>{say('SNEL and TV keep their existing flows.', 'Les parcours SNEL et TV restent inchangés.')}</p><p>{say('For rollback, choose legacy and remove V1 exceptions. Keep the V1 server integration enabled until pending V1 payments are reconciled.', 'Pour revenir à l’ancienne infrastructure, sélectionnez-la et retirez les exceptions V1. Gardez l’intégration V1 du serveur activée jusqu’au rapprochement des paiements V1 en attente.')}</p></div>
    </>}
  </main>;
}
