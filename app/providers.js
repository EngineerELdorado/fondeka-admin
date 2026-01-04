'use client';

import { Amplify } from 'aws-amplify';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import awsConfig from '@/lib/amplify-config';

let amplifyConfigured = false;

if (!amplifyConfigured) {
  Amplify.configure(awsConfig);
  amplifyConfigured = true;
}

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
