'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const humanizeEnum = (value) =>
  String(value || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function AnnouncementEventPolicyPage() {
  const { pushToast } = useToast();
  const [availableEvents, setAvailableEvents] = useState([]);
  const [enabledEvents, setEnabledEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const enabledSet = useMemo(() => new Set((enabledEvents || []).map((event) => String(event))), [enabledEvents]);
  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const events = Array.from(new Set([...(availableEvents || []), ...(enabledEvents || [])])).sort();
    if (!query) return events;
    return events.filter((event) => {
      const raw = String(event || '');
      return raw.toLowerCase().includes(query) || humanizeEnum(raw).toLowerCase().includes(query);
    });
  }, [availableEvents, enabledEvents, search]);

  const loadPolicy = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.notifications.getAnnouncementEventPolicy();
      setAvailableEvents(Array.isArray(res?.availableEvents) ? res.availableEvents.map(String).filter(Boolean) : []);
      setEnabledEvents(Array.isArray(res?.enabledEvents) ? res.enabledEvents.map(String).filter(Boolean) : []);
    } catch (err) {
      setError(err?.message || 'Failed to load announcement event policy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []);

  const toggleEvent = (event, checked) => {
    setEnabledEvents((prev) => {
      const set = new Set((prev || []).map(String));
      if (checked) set.add(event);
      else set.delete(event);
      return Array.from(set).sort();
    });
  };

  const savePolicy = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        enabledEvents: Array.from(new Set((enabledEvents || []).map((event) => String(event).trim()).filter(Boolean))).sort()
      };
      const res = await api.notifications.updateAnnouncementEventPolicy(payload);
      setAvailableEvents(Array.isArray(res?.availableEvents) ? res.availableEvents.map(String).filter(Boolean) : availableEvents);
      setEnabledEvents(Array.isArray(res?.enabledEvents) ? res.enabledEvents.map(String).filter(Boolean) : payload.enabledEvents);
      pushToast({ tone: 'success', message: 'Announcement event policy updated' });
    } catch (err) {
      const message = err?.message || 'Failed to update announcement event policy';
      setError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Announcement Event Policy</div>
          <div style={{ color: 'var(--muted)' }}>
            Choose which notification events also create targeted in-app announcements for the same account.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard/notification-default-channels" className="btn-neutral">
            Notification defaults
          </Link>
          <button type="button" className="btn-neutral" onClick={loadPolicy} disabled={loading || saving}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div> : null}

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <div style={{ fontWeight: 800 }}>Events</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Enabled events: {enabledEvents.length}. Dedupe is handled by the backend when notification data has a stable key.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral" onClick={() => setEnabledEvents([])} disabled={loading || saving || enabledEvents.length === 0}>
              Clear all
            </button>
            <button type="button" className="btn-primary" onClick={savePolicy} disabled={loading || saving}>
              {saving ? 'Saving...' : 'Save policy'}
            </button>
          </div>
        </div>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search events"
          disabled={loading || saving}
        />

        {loading ? (
          <div style={{ color: 'var(--muted)' }}>Loading events...</div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ color: 'var(--muted)' }}>No events found.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            {filteredEvents.map((event) => {
              const checked = enabledSet.has(event);
              return (
                <label
                  key={event}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                    padding: '0.65rem 0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    background: checked ? 'var(--accent-soft)' : 'var(--surface)'
                  }}
                >
                  <span style={{ display: 'grid', gap: '0.15rem' }}>
                    <span style={{ fontWeight: 700 }}>{humanizeEnum(event)}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{event}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(changeEvent) => toggleEvent(event, changeEvent.target.checked)}
                    disabled={saving}
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
