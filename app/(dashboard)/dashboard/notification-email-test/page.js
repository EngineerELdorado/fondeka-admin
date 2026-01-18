'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const emptyKeyItem = { label: '', value: '' };
const emptyLineItem = { label: '', qty: '', amount: '', total: '' };

const normalizeRow = (row) => ({
  label: String(row.label || '').trim(),
  value: String(row.value || '').trim()
});

const normalizeLineItem = (row) => ({
  label: String(row.label || '').trim(),
  qty: String(row.qty || '').trim(),
  amount: String(row.amount || '').trim(),
  total: String(row.total || '').trim()
});

export default function NotificationEmailTestPage() {
  const [accountId, setAccountId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [eyebrow, setEyebrow] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [preheader, setPreheader] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [accessPlatformLink, setAccessPlatformLink] = useState('');
  const [keyItems, setKeyItems] = useState([emptyKeyItem]);
  const [lineItems, setLineItems] = useState([emptyLineItem]);
  const [dataJson, setDataJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!info && !error) return;
    const timer = setTimeout(() => {
      setInfo(null);
      setError(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [info, error]);

  const payloadPreview = useMemo(() => {
    const rows = keyItems.map(normalizeRow).filter((row) => row.label || row.value);
    const lines = lineItems.map(normalizeLineItem).filter((row) => row.label || row.amount || row.qty || row.total);
    const trimmedData = dataJson.trim();
    let parsedData = undefined;
    if (trimmedData) {
      try {
        parsedData = JSON.parse(trimmedData);
      } catch {
        parsedData = null;
      }
    }
    return {
      accountId: accountId.trim() || undefined,
      recipientEmail: recipientEmail.trim() || undefined,
      recipientName: recipientName.trim() || undefined,
      subject: subject.trim() || undefined,
      message: message.trim() || undefined,
      eyebrow: eyebrow.trim() || undefined,
      title: title.trim() || undefined,
      subtitle: subtitle.trim() || undefined,
      preheader: preheader.trim() || undefined,
      buttonText: buttonText.trim() || undefined,
      accessPlatformLink: accessPlatformLink.trim() || undefined,
      keyItems: rows.length ? rows : undefined,
      lineItems: lines.length ? lines : undefined,
      data: parsedData === null ? 'Invalid JSON' : parsedData
    };
  }, [
    accountId,
    recipientEmail,
    recipientName,
    subject,
    message,
    eyebrow,
    title,
    subtitle,
    preheader,
    buttonText,
    accessPlatformLink,
    keyItems,
    lineItems,
    dataJson
  ]);

  const updateKeyItem = (index, patch) => {
    setKeyItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const updateLineItem = (index, patch) => {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeKeyItem = (index) => {
    setKeyItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [emptyKeyItem]));
  };

  const removeLineItem = (index) => {
    setLineItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [emptyLineItem]));
  };

  const handleSend = async () => {
    setError(null);
    setInfo(null);
    setResult(null);
    const accountIdValue = accountId.trim();
    const recipientEmailValue = recipientEmail.trim();
    const subjectValue = subject.trim();
    const messageValue = message.trim();
    if (!accountIdValue && !recipientEmailValue) {
      setError('Provide accountId or recipient email.');
      return;
    }
    if (!subjectValue) {
      setError('Subject is required.');
      return;
    }
    if (!messageValue) {
      setError('Message is required.');
      return;
    }

    const payload = {};
    const addIf = (key, value) => {
      if (value !== undefined && value !== null && value !== '') payload[key] = value;
    };

    if (accountIdValue) {
      const parsed = Number(accountIdValue);
      if (Number.isNaN(parsed)) {
        setError('Account ID must be a number.');
        return;
      }
      payload.accountId = parsed;
    }

    addIf('recipientEmail', recipientEmailValue);
    addIf('recipientName', recipientName.trim());
    addIf('subject', subjectValue);
    addIf('message', messageValue);
    addIf('eyebrow', eyebrow.trim());
    addIf('title', title.trim());
    addIf('subtitle', subtitle.trim());
    addIf('preheader', preheader.trim());
    addIf('buttonText', buttonText.trim());
    addIf('accessPlatformLink', accessPlatformLink.trim());

    const items = keyItems.map(normalizeRow).filter((row) => row.label || row.value);
    if (items.length) payload.keyItems = items;

    const lines = lineItems.map(normalizeLineItem).filter((row) => row.label || row.amount || row.qty || row.total);
    if (lines.length) payload.lineItems = lines;

    const trimmedData = dataJson.trim();
    if (trimmedData) {
      try {
        payload.data = JSON.parse(trimmedData);
      } catch {
        setError('Data JSON is invalid.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await api.notifications.emailTest(payload);
      setResult(res || { success: true });
      setInfo('Test email sent.');
    } catch (err) {
      setError(err.message || 'Failed to send test email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Email Test</div>
          <div style={{ color: 'var(--muted)' }}>Send a test email with custom content blocks.</div>
        </div>
        <Link href="/dashboard/notification-providers" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Notification providers
        </Link>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}
      {info && (
        <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>
          {info}
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ fontWeight: 800 }}>Recipient</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Account ID (optional)</span>
            <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="12345" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Recipient email</span>
            <input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="qa@fondeka.com" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Recipient name</span>
            <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="QA" />
          </label>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ fontWeight: 800 }}>Content</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Fondeka Email Preview" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Preheader</span>
            <input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Preview of new email layout" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Eyebrow</span>
            <input value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} placeholder="Transaction" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Payment received" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Subtitle</span>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="TX123456789" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Button text</span>
            <input value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="View in app" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>Access platform link</span>
            <input value={accessPlatformLink} onChange={(e) => setAccessPlatformLink(e.target.value)} placeholder="https://fondeka.com/transaction/123" />
          </label>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span>Message</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Your purchase was successful." />
        </label>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ fontWeight: 800 }}>Key items</div>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {keyItems.map((item, index) => (
            <div key={`key-${index}`} style={{ display: 'grid', gridTemplateColumns: '2fr 3fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span>Label</span>
                <input value={item.label} onChange={(e) => updateKeyItem(index, { label: e.target.value })} placeholder="Token" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span>Value</span>
                <input value={item.value} onChange={(e) => updateKeyItem(index, { value: e.target.value })} placeholder="54323396295782397642" />
              </label>
              <button type="button" className="btn-neutral btn-sm" onClick={() => removeKeyItem(index)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn-neutral btn-sm" onClick={() => setKeyItems((prev) => [...prev, emptyKeyItem])}>
            Add key item
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ fontWeight: 800 }}>Line items</div>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {lineItems.map((item, index) => (
            <div key={`line-${index}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span>Label</span>
                <input value={item.label} onChange={(e) => updateLineItem(index, { label: e.target.value })} placeholder="Bundle 5GB" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span>Qty</span>
                <input value={item.qty} onChange={(e) => updateLineItem(index, { qty: e.target.value })} placeholder="1" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span>Amount</span>
                <input value={item.amount} onChange={(e) => updateLineItem(index, { amount: e.target.value })} placeholder="20 USD" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span>Total</span>
                <input value={item.total} onChange={(e) => updateLineItem(index, { total: e.target.value })} placeholder="20 USD" />
              </label>
              <button type="button" className="btn-neutral btn-sm" onClick={() => removeLineItem(index)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn-neutral btn-sm" onClick={() => setLineItems((prev) => [...prev, emptyLineItem])}>
            Add line item
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ fontWeight: 800 }}>Extra data</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Optional JSON for data-driven placeholders and auto-highlighted values.
        </div>
        <textarea value={dataJson} onChange={(e) => setDataJson(e.target.value)} rows={6} placeholder='{"tokens":["54323396295782397642"]}' />
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn-primary" onClick={handleSend} disabled={loading}>
          {loading ? 'Sending…' : 'Send test email'}
        </button>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Payload preview</div>
        <pre style={{ margin: 0, background: 'var(--muted-bg, #f3f4f6)', padding: '0.75rem', borderRadius: '10px', overflowX: 'auto' }}>
          {JSON.stringify(payloadPreview, null, 2)}
        </pre>
        {result && (
          <>
            <div style={{ fontWeight: 800 }}>Response</div>
            <pre style={{ margin: 0, background: 'var(--muted-bg, #f3f4f6)', padding: '0.75rem', borderRadius: '10px', overflowX: 'auto' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
