'use client';

import { Amplify } from 'aws-amplify';
import { useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import awsConfig from '@/lib/amplify-config';

export default function Providers({ children }) {
  useEffect(() => {
    Amplify.configure(awsConfig);
  }, []);

  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
