'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(undefined);

const toneToStyle = (tone) => {
  switch (tone) {
    case 'success':
      return { border: 'rgba(34, 197, 94, 0.35)', bg: 'rgba(34, 197, 94, 0.08)' };
    case 'error':
      return { border: 'rgba(239, 68, 68, 0.35)', bg: 'rgba(239, 68, 68, 0.08)' };
    case 'warning':
      return { border: 'rgba(245, 158, 11, 0.35)', bg: 'rgba(245, 158, 11, 0.08)' };
    default:
      return { border: 'var(--border)', bg: 'var(--surface)' };
  }
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(1);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ message, tone = 'success', durationMs = 4500 } = {}) => {
      if (!message) return;
      const id = idRef.current++;
      setToasts((prev) => [{ id, message: String(message), tone }, ...prev].slice(0, 4));
      if (durationMs > 0) {
        window.setTimeout(() => removeToast(id), durationMs);
      }
    },
    [removeToast]
  );

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-relevant="additions removals">
        {toasts.map((t) => {
          const style = toneToStyle(t.tone);
          return (
            <div
              key={t.id}
              className="toast"
              style={{ borderColor: style.border, background: style.bg }}
              role="status"
            >
              <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{t.message}</div>
              <button type="button" onClick={() => removeToast(t.id)} className="toast-close" aria-label="Dismiss toast">
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback to avoid hard crashes if a component renders outside the provider
    return { pushToast: () => {} };
  }
  return ctx;
}
