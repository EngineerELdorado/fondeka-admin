'use client';

export default function HelpTip({ label, children }) {
  return <details className="failover-help"><summary aria-label={`Explain ${label}`} title={`Explain ${label}`}>?</summary><div className="failover-help-content"><strong>{label}</strong><p>{children}</p></div></details>;
}
