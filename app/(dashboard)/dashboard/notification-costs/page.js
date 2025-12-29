'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NotificationCostsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/notification-default-channels');
  }, [router]);

  return (
    <div style={{ color: 'var(--muted)' }}>
      Notification costs have been removed. Redirecting…
    </div>
  );
}
