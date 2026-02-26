'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const asText = (value) => (value === undefined || value === null ? '' : String(value).trim());
const asList = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
};

const uniqueStrings = (values) => {
  const out = [];
  const seen = new Set();
  values.forEach((value) => {
    const text = asText(value);
    if (!text) return;
    if (seen.has(text)) return;
    seen.add(text);
    out.push(text);
  });
  return out;
};

const normalizeSharedMode = (row) => {
  const tokens = uniqueStrings([
    ...asList(row?.triggerTokens),
    ...asList(row?.tokens),
    ...asList(row?.triggers),
    ...asList(row?.triggerToken)
  ]);

  return {
    mode: asText(row?.mode || row?.name || row?.key || row?.code || 'UNKNOWN'),
    tokens,
    expectedOutcome: asText(
      row?.expectedOutcome ||
        row?.expected ||
        row?.outcome ||
        row?.behavior ||
        row?.description ||
        '—'
    )
  };
};

const normalizeProvider = (row) => {
  const whereToInject = uniqueStrings([
    ...asList(row?.whereToInject),
    ...asList(row?.injectionFields),
    ...asList(row?.fieldPaths),
    ...asList(row?.fields)
  ]);

  const notes = uniqueStrings([
    ...asList(row?.notes),
    ...asList(row?.note),
    ...asList(row?.providerNotes)
  ]).join(' | ');

  return {
    provider: asText(row?.provider || row?.providerName || row?.name || 'UNKNOWN'),
    whereToInject,
    notes: notes || '—'
  };
};

const TokenChip = ({ token, onCopy, copied }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.4rem',
      border: '1px solid var(--border)',
      borderRadius: '999px',
      padding: '0.2rem 0.5rem',
      background: 'var(--surface)'
    }}
  >
    <code>{token}</code>
    <button type="button" className="btn-neutral btn-sm" onClick={() => onCopy(token)}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  </div>
);

export default function StubFailureModesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [copiedToken, setCopiedToken] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.qa.stubFailureModes();
        if (!alive) return;
        setPayload(res || {});
      } catch (err) {
        if (!alive) return;
        setError(err?.message || 'Failed to load stub failure modes.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const sharedModes = useMemo(() => {
    const rows = asList(payload?.sharedModes || payload?.modes || payload?.shared || []);
    return rows.map(normalizeSharedMode);
  }, [payload]);

  const providers = useMemo(() => {
    const rows = asList(payload?.providers || []);
    return rows.map(normalizeProvider);
  }, [payload]);

  const copyToken = async (token) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken((current) => (current === token ? '' : current)), 1400);
    } catch {
      setError('Copy failed. Your browser blocked clipboard access.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Stub Failure Modes</div>
          <div style={{ color: 'var(--muted)' }}>QA guide for trigger tokens and provider injection fields.</div>
        </div>
        <Link href="/dashboard/admins" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Admins
        </Link>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}

      <div className="card" style={{ display: 'grid', gap: '0.7rem' }}>
        <div style={{ fontWeight: 800 }}>Shared Triggers</div>
        {loading ? (
          <div style={{ color: 'var(--muted)' }}>Loading shared modes…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '0.6rem' }}>Mode</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '0.6rem' }}>Trigger tokens</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '0.6rem' }}>Expected outcome</th>
                </tr>
              </thead>
              <tbody>
                {sharedModes.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '0.8rem', color: 'var(--muted)' }}>No shared modes returned.</td>
                  </tr>
                ) : (
                  sharedModes.map((row, index) => (
                    <tr key={`${row.mode}-${index}`}>
                      <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>{row.mode}</td>
                      <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                          {row.tokens.length === 0 ? (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          ) : (
                            row.tokens.map((token) => (
                              <TokenChip key={`${row.mode}-${token}`} token={token} onCopy={copyToken} copied={copiedToken === token} />
                            ))
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)' }}>{row.expectedOutcome || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.7rem' }}>
        <div style={{ fontWeight: 800 }}>Provider Injection Guide</div>
        {loading ? (
          <div style={{ color: 'var(--muted)' }}>Loading providers…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '0.6rem' }}>Provider</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '0.6rem' }}>Where to inject</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '0.6rem' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {providers.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '0.8rem', color: 'var(--muted)' }}>No provider injection data returned.</td>
                  </tr>
                ) : (
                  providers.map((row, index) => (
                    <tr key={`${row.provider}-${index}`}>
                      <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>{row.provider}</td>
                      <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                          {row.whereToInject.length === 0 ? (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          ) : (
                            row.whereToInject.map((path) => (
                              <span
                                key={`${row.provider}-${path}`}
                                style={{
                                  border: '1px solid var(--border)',
                                  borderRadius: '999px',
                                  padding: '0.2rem 0.5rem',
                                  background: 'var(--surface)'
                                }}
                              >
                                <code>{path}</code>
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)' }}>{row.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
