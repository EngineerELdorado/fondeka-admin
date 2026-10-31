'use client';

import { Children, Fragment, cloneElement, forwardRef, isValidElement, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isRegulatorRestrictedRecord, isRegulatorRestrictedRoute, isRegulatorRestrictedService, regulatorVisibleFields } from '@/lib/regulator-presentation';

export function NonRegulatorContent({ children }) {
  const { enableRegulatorMode } = useAuth();
  return enableRegulatorMode === false ? children : null;
}

export function RegulatorRecord({ record, children }) {
  const { enableRegulatorMode } = useAuth();
  return enableRegulatorMode !== false && isRegulatorRestrictedRecord(record) ? null : children;
}

export function RegulatorField({ field, children }) {
  const { enableRegulatorMode } = useAuth();
  if (enableRegulatorMode !== false && isRegulatorRestrictedRecord(field)) return null;
  const descriptor = typeof field === 'object' ? field : { label: field };
  return regulatorVisibleFields([descriptor], enableRegulatorMode).length ? children : null;
}

export function RegulatorList({ values, separator = ', ' }) {
  const { enableRegulatorMode } = useAuth();
  const visible = enableRegulatorMode === false ? values : values.filter((value) => !isRegulatorRestrictedService(value));
  return visible.length ? visible.join(separator) : '—';
}

export function PresentationLink(props) {
  const { enableRegulatorMode } = useAuth();
  if (enableRegulatorMode !== false && isRegulatorRestrictedRoute(props.href)) return null;
  return <Link {...props} />;
}

const optionText = (children) => Children.toArray(children).map((child) => typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement(child) ? optionText(child.props.children) : '').join(' ');
const optionValues = (children) => Children.toArray(children).flatMap((child) => !isValidElement(child) ? [] : child.type === 'option' ? [String(child.props.value ?? optionText(child.props.children))] : optionValues(child.props.children));
const visibleOptions = (children) => Children.toArray(children).flatMap((child) => {
  if (!isValidElement(child)) return [child];
  if (child.props['data-regulator-restricted']) return [];
  if (child.type === Fragment) return visibleOptions(child.props.children);
  if (child.type === 'optgroup') return isRegulatorRestrictedService(child.props.label) ? [] : [cloneElement(child, {}, visibleOptions(child.props.children))];
  return isRegulatorRestrictedService(child.props.value) || isRegulatorRestrictedService(optionText(child.props.children)) ? [] : [child];
});

export const PresentationSelect = forwardRef(function PresentationSelect({ children, ...props }, ref) {
  const { enableRegulatorMode } = useAuth();
  const select = useRef(null);
  const options = useMemo(() => enableRegulatorMode === false ? children : visibleOptions(children), [children, enableRegulatorMode]);
  const originalValues = useMemo(() => optionValues(children), [children]);
  const allowedValues = useMemo(() => optionValues(options), [options]);
  useImperativeHandle(ref, () => select.current);
  useEffect(() => {
    if (enableRegulatorMode === false || props.multiple || !select.current) return;
    const value = String(props.value ?? '');
    if (!originalValues.includes(value) || allowedValues.includes(value)) return;
    const first = select.current.options[0];
    if (first) {
      select.current.value = first.value;
      select.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, [enableRegulatorMode, props.multiple, props.value, originalValues, allowedValues]);
  const onChange = (event) => {
    if (enableRegulatorMode !== false && props.multiple && Array.isArray(props.value)) {
      // Edits to visible choices must preserve existing settings for hidden services.
      const preserved = props.value.filter((value) => !allowedValues.includes(String(value))).map((value) => ({ value: String(value) }));
      if (preserved.length) {
        const target = new Proxy(event.target, { get: (element, key) => key === 'selectedOptions' ? [...element.selectedOptions, ...preserved] : typeof element[key] === 'function' ? element[key].bind(element) : element[key] });
        props.onChange?.({ ...event, target, currentTarget: target });
        return;
      }
    }
    props.onChange?.(event);
  };
  return <select {...props} onChange={onChange} ref={select}>{options}</select>;
});

export function RegulatorRouteBoundary({ children }) {
  const { enableRegulatorMode } = useAuth();
  const pathname = usePathname();
  const search = useSearchParams();
  if (enableRegulatorMode !== false && isRegulatorRestrictedRoute(`${pathname}?${search}`)) {
    return <div className="card" role="status"><p>This area is unavailable in the current dashboard presentation.</p><Link href="/dashboard">Return to dashboard</Link></div>;
  }
  return children;
}
