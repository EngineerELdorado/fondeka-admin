// Widths are in rem so fitting columns never requires shrinking the table font.
export function tableColumnWidth(column) {
  const width = String(column.width || '');
  if (/^[\d.]+rem$/.test(width)) return Number.parseFloat(width);
  if (/^[\d.]+px$/.test(width)) return Number.parseFloat(width) / 16;
  const key = String(column.key).toLowerCase();
  if (key === '__account_quick_nav__') return 3.5;
  if (/email|reference/.test(key)) return 13;
  if (/created|updated|date|time/.test(key)) return 12;
  if (key === 'actions') return 6;
  if (key === 'action') return 12;
  if (/status|name|business|customer|title|display|payment/.test(key)) return 12;
  if (/amount|price/.test(key)) return 10;
  if (/currency|rank|active|enabled/.test(key)) return 6;
  return 9;
}

export function tableColumnPriority(column, index) {
  if (Number.isFinite(column.priority)) return column.priority;
  const key = String(column.key).toLowerCase();
  if (key === 'actions') return 0;
  if (/status/.test(key)) return 1;
  if (/^(reference|name|username|displayname|title|business|payment|account|customer)$/.test(key)) return 1;
  if (/active|enabled|amount|price|available|collectiongate|payoutgate/.test(key)) return 2;
  if (/created|updated|rank|version|__account|giftcard|returnascard|cardproductmin|loaneligibility|defaultforfees/.test(key)) return 6;
  if (/country|currency|type|method/.test(key)) return 3;
  return index === 0 ? 1 : 4;
}

export function fitTableColumns(columns, availableRem) {
  if (!availableRem || availableRem < 40) return columns;
  if (columns.reduce((total, column) => total + tableColumnWidth(column), 0) <= availableRem) return columns;
  const selected = new Set();
  let used = 0;
  const ordered = columns.map((column, index) => ({ column, index }))
    .sort((a, b) => tableColumnPriority(a.column, a.index) - tableColumnPriority(b.column, b.index) || a.index - b.index);
  for (const { column, index } of ordered) {
    if (tableColumnPriority(column, index) >= 6 && selected.size > 0) continue;
    const width = tableColumnWidth(column);
    if (used + width <= availableRem || selected.size === 0) {
      selected.add(column.key);
      used += width;
    }
  }
  return columns.filter((column) => selected.has(column.key));
}
