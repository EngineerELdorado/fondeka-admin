'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import RevenueReportExport from '@/components/RevenueReportExport';
import ExpenseReportExport from '@/components/ExpenseReportExport';
import AssetReportExport from '@/components/AssetReportExport';

export default function ReportsPage({ kind }) {
  const { adminProfile } = useAuth();
  const { locale } = useLocale();
  const text = (en, fr) => locale === 'fr' ? fr : en;
  if (!['ADMIN', 'SUPER_ADMIN'].includes(adminProfile?.role)) {
    return <p role="alert">{text('Admin access is required.', 'Un accès administrateur est nécessaire.')}</p>;
  }
  const revenue = kind === 'revenue';
  const assets = kind === 'assets';
  const title = kind ? (assets ? text('Asset valuation reports', 'Rapports de valorisation des actifs') : revenue ? text('Revenue reports', 'Rapports de revenus') : text('Expense reports', 'Rapports de dépenses')) : text('Reports', 'Rapports');
  return <main style={{ display: 'grid', gap: '1.25rem', maxWidth: 960, margin: '0 auto' }}>
    <header><h1>{title}</h1><p style={{ color: 'var(--muted)' }}>{text('Generate a PDF, follow its progress and download the completed report.', 'Générez un PDF, suivez son avancement et téléchargez le rapport terminé.')}</p></header>
    {kind ? <section className="card" style={{ display: 'grid', gap: '1rem', justifyItems: 'start' }}>
      <p style={{ margin: 0, lineHeight: 1.6 }}>{revenue
        ? text('Use the existing transaction profit report for a month or date range, in English or French. It covers Fondeka as a whole.', 'Utilisez le rapport de bénéfice pour un mois ou une plage de dates, en français ou en anglais. Il couvre l’ensemble de Fondeka.')
        : assets ? text('Export the asset register at a chosen date in one currency, including category totals and optional inventory details.', 'Exportez le registre des actifs à une date choisie dans une seule devise, avec les totaux par catégorie et le détail du registre en option.')
        : text('Export recorded actual expenses or compare budget and actual amounts, for complete calendar months in one currency.', 'Exportez les dépenses réalisées ou comparez le budget et le réalisé, pour des mois calendaires complets dans une seule devise.')}</p>
      {revenue ? <RevenueReportExport /> : assets ? <AssetReportExport /> : <ExpenseReportExport />}
      <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6 }}>{text('Return here to recover an interrupted request or check an export that is still being prepared.', 'Revenez ici pour reprendre une demande interrompue ou vérifier un export en cours de préparation.')}</p>
      {assets ? <Link href="/dashboard/assets">{text('Manage the asset register →', 'Gérer le registre des actifs →')}</Link> : !revenue && <Link href="/dashboard/expenses">{text('Manage monthly budgets and expense categories →', 'Gérer les budgets mensuels et les catégories de dépenses →')}</Link>}
    </section> : <nav aria-label={title} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1rem' }}>
      <Link className="card" href="/dashboard/reports/revenue">{text('Revenue reports →', 'Rapports de revenus →')}</Link>
      <Link className="card" href="/dashboard/reports/expenses">{text('Expense reports →', 'Rapports de dépenses →')}</Link>
      <Link className="card" href="/dashboard/reports/assets">{text('Asset valuation reports →', 'Rapports de valorisation des actifs →')}</Link>
    </nav>}
  </main>;
}
