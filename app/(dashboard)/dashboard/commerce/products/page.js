'use client';

import { useLocale } from '@/contexts/LocaleContext';
import { PresentationLink as Link } from '@/components/RegulatorPresentation';
import ProductReview from '@/components/commerce/ProductReview';
import styles from '@/components/commerce/CommerceWorkspace.module.css';

export default function CommerceProductsPage() {
  const { locale } = useLocale();
  const text = (en, fr) => String(locale).startsWith('fr') ? fr : en;
  return <div className={styles.workspace}>
    <header className={styles.heading}><div><div className={styles.eyebrow}>Commerce</div><h1>{text('Marketplace moderation', 'Modération marketplace')}</h1><p>{text('Review what customers discover, one product at a time.', 'Examinez ce que les clients découvrent, produit par produit.')}</p></div><div className={styles.actions}><Link className="btn-neutral" href="/dashboard/commerce/stores">{text('Stores', 'Boutiques')}</Link><Link className="btn-neutral" href="/dashboard/feature-flags">{text('Feature flags', 'Fonctionnalités')}</Link><Link className="btn-neutral" href="/dashboard/businesses">{text('Businesses', 'Entreprises')}</Link></div></header>
    <ProductReview />
  </div>;
}
