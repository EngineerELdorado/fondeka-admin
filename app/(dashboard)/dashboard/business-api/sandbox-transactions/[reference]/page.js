'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canReadSandboxHistory } from '@/lib/business-api-sandbox';
import SandboxPaymentDetail from '@/components/business-api-sandbox/Detail';
import { SandboxPermissionDenied } from '@/components/business-api-sandbox/Common';

export default function BusinessApiSandboxPaymentPage() {
  const { session } = useAuth();
  const params = useParams();
  const reference = params.reference;
  if (!canReadSandboxHistory(session)) return <SandboxPermissionDenied />;
  return <SandboxPaymentDetail key={reference} reference={reference} />;
}
