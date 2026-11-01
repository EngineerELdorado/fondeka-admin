'use client';

import React, { useEffect, useId, useRef, useState } from 'react';

// Keep the same cells and controls in both layouts; visibility wrappers remain authoritative.
export default function ResponsiveTable({ children, className = '', style, ...props }) {
  const container = useRef(null), table = useRef(null), id = useId();
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const element = container.current, nativeTable = table.current;
    if (!element || !nativeTable) return undefined;
    const attribute = (node, key, value) => {
      if (value == null) node.removeAttribute(key);
      else if (node.getAttribute(key) !== String(value)) node.setAttribute(key, value);
    };
    const resize = () => {
      const width = element.getBoundingClientRect().width;
      const rootSize = parseFloat(window.getComputedStyle(nativeTable.ownerDocument.documentElement).fontSize) || 16;
      if (width > 0) setStacked(width < 40 * rootSize);
    };
    const prepare = () => {
      // Use rendered cells, including changes made by conditional/context-based wrappers.
      const headingRows = Array.from(nativeTable.tHead?.rows || []), headers = [];
      headingRows.forEach((row, rowIndex) => {
        attribute(row, 'role', 'row');
        Array.from(row.cells).forEach((cell, column) => {
          const headingId = `${id}-heading-${rowIndex}-${column}`;
          if (!cell.id || cell.id.startsWith(`${id}-heading-`)) cell.id = headingId;
          attribute(cell, 'role', 'columnheader'); attribute(cell, 'scope', 'col');
          const text = cell.textContent?.trim() || cell.getAttribute('aria-label') || cell.querySelector('[aria-label]')?.getAttribute('aria-label') || 'Actions';
          const label = text.replace(/\s+/g, ' ').trim();
          if (label === '#' && !cell.style.width) cell.style.width = '3rem';
          if (rowIndex === headingRows.length - 1) for (let at = 0; at < cell.colSpan; at += 1) headers.push({ label, id: cell.id });
        });
      });
      for (const section of [nativeTable.tHead, ...nativeTable.tBodies, nativeTable.tFoot].filter(Boolean)) {
        attribute(section, 'role', 'rowgroup');
        if (section === nativeTable.tHead) continue;
        for (const row of section.rows) {
          attribute(row, 'role', 'row');
          let column = 0;
          for (const cell of row.cells) {
            const heading = headers[column], fullWidth = cell.colSpan > 1;
            attribute(cell, 'role', cell.tagName === 'TH' ? 'rowheader' : 'cell');
            attribute(cell, 'headers', !fullWidth ? heading?.id : null);
            attribute(cell, 'data-label', !fullWidth ? heading?.label : null);
            attribute(cell, 'data-full-width', fullWidth ? 'true' : null);
            attribute(cell, 'data-wide-value', cell.querySelector('.transaction-status-badge[data-long-status]') ? 'true' : null);
            attribute(cell, 'data-interactive', cell.querySelector('button, input, select, textarea, [contenteditable="true"]') ? 'true' : null);
            if (!cell.hasAttribute('title') || cell.dataset.tableTitle === 'true') {
              attribute(cell, 'title', cell.textContent?.trim() || null);
              attribute(cell, 'data-table-title', 'true');
            }
            column += cell.colSpan;
          }
        }
      }
      resize();
    };
    prepare();
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(element);
    const contentObserver = new MutationObserver(prepare);
    contentObserver.observe(nativeTable, { childList: true, subtree: true, characterData: true });
    return () => { sizeObserver.disconnect(); contentObserver.disconnect(); };
  }, [children, id]);
  return <div className="responsive-table-container" ref={container} data-layout={stacked ? 'records' : 'table'}>
    <table {...props} ref={table} role="table" className={`responsive-table ${className}`} style={{ ...style, width: '100%', minWidth: 0, maxWidth: '100%', tableLayout: 'fixed' }}>{children}</table>
  </div>;
}
