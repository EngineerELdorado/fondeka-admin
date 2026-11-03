'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function ContentModal({ title, onClose, children, width = 'min(760px, 95vw)' }) {
  const surface = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    surface.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); onClose();
    } else if (event.key === 'Tab') {
      const controls = Array.from(surface.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((element) => !element.disabled && element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === surface.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === surface.current)) {
        event.preventDefault(); first?.focus();
      }
    }
  };
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="modal-backdrop" onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}>
    <div ref={surface} tabIndex={-1} onKeyDown={onKeyDown} className="modal-surface" role="dialog" aria-modal="true" aria-label={title} style={{ width }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{title}</h2>
        <button type="button" className="btn-neutral btn-sm" aria-label="Close content" onClick={onClose}>×</button>
      </div>
      {children}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="btn-neutral" onClick={onClose}>Close</button></div>
    </div>
  </div>, document.body);
}
