'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ContentModal } from '@/components/ContentModal';

export default function TableText({ value, label = 'Full value', lines = 2, expandable = true }) {
  const text = value == null || value === '' ? '—' : String(value);
  const content = useRef(null);
  const [overflow, setOverflow] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const compact = Array.from(text).length > 32 || /[\r\n]/.test(text);
  useEffect(() => {
    const element = content.current;
    if (!element || !expandable) return undefined;
    const measure = () => setOverflow(element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, compact, lines, expandable]);
  if (!compact) return text;
  return <span className="table-text">
    <span ref={content} className="table-text__content" title={text} style={{ WebkitLineClamp: lines, lineClamp: lines }}>{text}</span>
    {expandable && overflow ? <button type="button" className="btn-neutral btn-sm table-text__more" aria-haspopup="dialog" aria-label={`Read full ${label}`} onClick={(event) => { event.stopPropagation(); setExpanded({ text, label }); }}>Read more</button> : null}
    {expanded ? <ContentModal title={expanded.label} onClose={() => setExpanded(null)}><div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{expanded.text}</div></ContentModal> : null}
  </span>;
}

export function TableCellLines({ primary, secondary, strong = false, secondaryColor = 'var(--muted)', label = 'Cell details' }) {
  const renderLine = (value) => typeof value === 'string' ? <TableText value={value} label={label} lines={1} /> : value;
  return <span className="table-cell-lines" style={{ display: 'grid', gap: '0.15rem', lineHeight: 1.3 }}>
    <span style={strong ? { fontWeight: 700 } : undefined}>{renderLine(primary)}</span>
    {secondary !== null && secondary !== undefined && secondary !== '' ? <small style={{ color: secondaryColor }}>{renderLine(secondary)}</small> : null}
  </span>;
}
