import { ContactExports } from '@/components/ContactExports';

export default function ContactExportsPage({ searchParams }) {
  return <ContactExports initialJobId={typeof searchParams?.jobId === 'string' ? searchParams.jobId : ''} />;
}
