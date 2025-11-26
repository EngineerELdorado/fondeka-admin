'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';

const STEPS = Object.freeze({ EMAIL: 0, CODE: 1 });

export default function LoginPage() {
  const router = useRouter();
  const { requestEmailCode, confirmEmailCode, isAuthenticated, loading } = useAuth();

  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const codeInputRef = useRef(null);

  const helperText = {
    [STEPS.EMAIL]: 'Enter your admin email to receive a sign-in code.',
    [STEPS.CODE]: 'We sent a verification code to your inbox. Enter it to continue.'
  };

  const title = step === STEPS.EMAIL ? 'Fondeka Admin' : 'Check your email';

  const isValid = useMemo(() => {
    if (step === STEPS.EMAIL) return /.+@.+/.test(email.trim());
    if (step === STEPS.CODE) return /^[0-9]{4,8}$/.test(code.trim());
    return false;
  }, [email, code, step]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!isValid) {
      setError(step === STEPS.EMAIL ? 'Please provide a valid email.' : 'Enter the 4-8 digit code.');
      return;
    }

    try {
      if (step === STEPS.EMAIL) {
        await requestEmailCode(email.trim());
        setStep(STEPS.CODE);
        requestAnimationFrame(() => codeInputRef.current?.focus());
        return;
      }

      await confirmEmailCode(code.trim());
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    }
  };

  if (isAuthenticated) {
    router.replace('/dashboard');
    return null;
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '480px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img src="/icon.svg" alt="Fondeka" width={36} height={36} style={{ borderRadius: '10px' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: '24px' }}>{title}</h1>
            <div style={{ color: '#6b7280', fontSize: '13px' }}>Secure admin access</div>
          </div>
        </div>
        <p style={{ color: '#6b7280', margin: '0' }}>{helperText[step]}</p>

        <form onSubmit={handleSubmit}>
          {step === STEPS.EMAIL && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@fondeka.com"
                autoComplete="email"
                required
              />
            </div>
          )}

          {step === STEPS.CODE && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label htmlFor="code">Verification code</label>
              <input
                ref={codeInputRef}
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
                placeholder="6-digit code"
                required
              />
            </div>
          )}

          {error && (
            <div style={{ color: '#b91c1c', marginTop: '0.75rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid || loading}
            style={{
              marginTop: '1.2rem',
              width: '100%',
              padding: '0.9rem 1rem',
              border: 'none',
              borderRadius: '10px',
              background: 'var(--accent)',
              color: '#fff',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: !isValid || loading ? 0.7 : 1
            }}
          >
            {loading ? 'Processing…' : step === STEPS.EMAIL ? 'Send code' : 'Verify & continue'}
          </button>
        </form>
      </div>
    </main>
  );
}
