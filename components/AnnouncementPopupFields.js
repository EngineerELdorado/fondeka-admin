'use client';

import { PresentationSelect } from '@/components/RegulatorPresentation';

export function AnnouncementPopupFields({ draft, setDraft, notification = true }) {
  const field = (name) => (event) => setDraft((previous) => ({ ...previous, [name]: event.target.value }));
  return (
    <div style={{ display: 'grid', gap: '0.75rem', gridColumn: '1 / -1', minWidth: 0 }}>
      <label style={{ display: 'grid', gap: '0.25rem' }}>
        <span>Announcement format</span>
        <PresentationSelect aria-label="Announcement format" value={draft.presentation} onChange={field('presentation')}>
          <option value="">Current announcement format</option>
          <option value="POPUP">Popup</option>
        </PresentationSelect>
      </label>
      {draft.presentation === 'POPUP' && <div style={{ color: 'var(--muted)', fontSize: '12px' }}>An image is optional; the app uses its artwork if the image is unavailable. Editing this announcement keeps its presentation history. Create a new announcement to show another message.</div>}
      {draft.presentation === 'POPUP' && (
        <fieldset style={{ display: 'grid', gap: '0.75rem', minWidth: 0, border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem' }}>
          <legend>Popup primary action</legend>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Primary action</span>
            <PresentationSelect aria-label="Primary action" value={draft.ctaType} onChange={field('ctaType')}>
              <option value="NONE">No CTA</option>
              <option value="OPEN_URL">Open a web page</option>
              <option value="SHARE_APP">Share the app</option>
              <option value="DISMISS">Acknowledge the message</option>
            </PresentationSelect>
          </label>
          {draft.ctaType !== 'NONE' && <>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Button label (English / default) *</span>
              <input maxLength={80} value={draft.ctaLabel} onChange={field('ctaLabel')} />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Button label (French)</span>
              <input maxLength={80} value={draft.ctaLabelFr} onChange={field('ctaLabelFr')} />
            </label>
          </>}
          {draft.ctaType === 'OPEN_URL' && <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>HTTPS web destination *</span>
            <input type="url" value={draft.ctaUrl} onChange={field('ctaUrl')} placeholder="https://" />
          </label>}
          {draft.ctaType === 'SHARE_APP' && <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Requires an enabled referral summary and personal invitation code. Hidden in native regulator mode.</div>}
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>The popup uses this primary action. A legacy link or download update flag alone creates no popup button.</div>
        </fieldset>
      )}
      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>French announcement copy (optional)</summary>
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.65rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Title (French)</span>
            <input maxLength={255} value={draft.titleFr} onChange={field('titleFr')} />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Message (French)</span>
            <textarea aria-label="Message (French)" rows={4} value={draft.bodyFr} onChange={field('bodyFr')} />
          </label>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Each missing French field uses its {notification ? 'notification subject or message' : 'default title or message'}. Copy is plain text; Unicode and line breaks are preserved.</div>
        </div>
      </details>
    </div>
  );
}
