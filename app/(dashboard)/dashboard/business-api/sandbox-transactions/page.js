'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canReadSandboxHistory } from '@/lib/business-api-sandbox';
import SandboxHistory from '@/components/business-api-sandbox/History';
import { SandboxPermissionDenied } from '@/components/business-api-sandbox/Common';

export default function BusinessApiSandboxHistoryPage() {
  const { session } = useAuth();
  const search = useSearchParams().toString();
  if (!canReadSandboxHistory(session)) return <SandboxPermissionDenied />;
  return <SandboxHistory key={search} initialSearch={search} />;
}
